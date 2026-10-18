import type { EventSpec } from './commandRouter';
import { mintRecordIds } from './commandSupport';
import type {
  FootballCausalInputRef,
  FootballCausalLink,
  FootballCausalRecordKind,
  FootballGameRecord,
  ResolvedPlayFact,
} from './football';
import type { EntityId, RecordId } from './ids';
import { latestMedicalClearance } from './medical';
import { currentRosterMembership } from './roster';
import type { FootballWorld } from './world';

export class SundayProofError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SundayProofError';
  }
}

const fail = (message: string): never => {
  throw new SundayProofError(message);
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const recordRef = (
  recordKind: FootballCausalRecordKind,
  id: RecordId,
): FootballCausalInputRef => ({ kind: 'record', recordKind, id });

const inputKey = (ref: FootballCausalInputRef): string => {
  switch (ref.kind) {
    case 'record':
      return `0|${ref.recordKind}|${ref.id}`;
    case 'role_knowledge':
      return `1|${ref.playerId}|${ref.schemeKey}|${ref.responsibilityKey}`;
    case 'ruleset_key':
      return `2|${ref.keyKind}|${ref.key}`;
  }
};

const uniqueInputs = (
  refs: readonly FootballCausalInputRef[],
): FootballCausalInputRef[] => {
  const byKey = new Map<string, FootballCausalInputRef>();
  for (const ref of refs) byKey.set(inputKey(ref), ref);
  return [...byKey.entries()]
    .sort(([a], [b]) => byText(a, b))
    .map(([, ref]) => ref);
};

const causalInputsForOrganization = (
  sourceWorld: FootballWorld,
  play: ResolvedPlayFact,
  organizationId: EntityId,
): {
  readonly participantPlayerIds: readonly EntityId[];
  readonly inputRefs: readonly FootballCausalInputRef[];
} => {
  const participants = play.participation
    .filter((p) => p.organizationId === organizationId)
    .sort((a, b) => byText(a.playerId, b.playerId));
  if (participants.length === 0)
    return fail(`play ${play.id} has no participants for ${organizationId}`);

  const refs: FootballCausalInputRef[] = [];
  const plan = sourceWorld.football.gamePlans.find(
    (candidate) =>
      candidate.fixtureId === play.fixtureId &&
      candidate.organizationId === organizationId,
  );
  if (plan === undefined)
    return fail(
      `play ${play.id} has no pre-play game plan for ${organizationId}`,
    );
  refs.push(recordRef('game_plan_snapshot', plan.id));

  const sourceProposalIds = new Set<RecordId>([plan.sourceProposalId]);
  const conceptKey =
    play.offenseOrganizationId === organizationId
      ? play.offense.conceptKey
      : play.defense.conceptKey;
  refs.push({ kind: 'ruleset_key', keyKind: 'concept', key: conceptKey });

  for (const participant of participants) {
    const membership = currentRosterMembership(
      sourceWorld.roster,
      participant.playerId,
      sourceWorld.simDate,
    );
    if (
      membership === undefined ||
      membership.organizationId !== organizationId
    )
      return fail(
        `play ${play.id} participant ${participant.playerId} lacks pre-play roster membership in ${organizationId}`,
      );
    refs.push(recordRef('roster_membership', membership.id));

    const designation = sourceWorld.football.designations.find(
      (candidate) =>
        candidate.fixtureId === play.fixtureId &&
        candidate.organizationId === organizationId &&
        candidate.playerId === participant.playerId &&
        candidate.status === 'active',
    );
    if (designation === undefined)
      return fail(
        `play ${play.id} participant ${participant.playerId} lacks a pre-play active designation`,
      );
    refs.push(recordRef('game_day_designation', designation.id));
    sourceProposalIds.add(designation.sourceProposalId);

    for (const action of participant.actionExposures)
      refs.push({
        kind: 'ruleset_key',
        keyKind: 'action',
        key: action.actionKey,
      });
    for (const responsibility of participant.responsibilityExposures) {
      refs.push({
        kind: 'ruleset_key',
        keyKind: 'responsibility',
        key: responsibility.responsibilityKey,
      });
      const learned = sourceWorld.development.roleKnowledge.find(
        (knowledge) =>
          knowledge.playerId === participant.playerId &&
          knowledge.schemeKey === responsibility.schemeKey &&
          knowledge.responsibilityKey === responsibility.responsibilityKey,
      );
      if (learned !== undefined)
        refs.push({
          kind: 'role_knowledge',
          playerId: participant.playerId,
          schemeKey: learned.schemeKey,
          responsibilityKey: learned.responsibilityKey,
        });
    }

    for (const episode of sourceWorld.medical.episodes) {
      if (
        episode.playerId !== participant.playerId ||
        episode.status !== 'open'
      )
        continue;
      refs.push(recordRef('medical_episode', episode.id));
      const clearance = latestMedicalClearance(
        sourceWorld.medical,
        episode.id,
        organizationId,
      );
      if (clearance !== undefined)
        refs.push(recordRef('medical_clearance', clearance.id));
    }
  }

  for (const receipt of sourceWorld.decisions.receipts)
    if (sourceProposalIds.has(receipt.proposalId))
      refs.push(recordRef('decision_receipt', receipt.id));

  return {
    participantPlayerIds: [
      ...new Set(participants.map((p) => p.playerId)),
    ].sort(byText),
    inputRefs: uniqueInputs(refs),
  };
};

/**
 * Records resolution-time causal edges using ONLY the world as it existed before the play.
 * `targetWorld` may already contain same-play usage/injury consequences and is used only for
 * authoritative id allocation and storage; it is never consulted to decide what caused the play.
 */
export const recordCausalLinksForPlay = (
  sourceWorld: FootballWorld,
  targetWorld: FootballWorld,
  play: ResolvedPlayFact,
): {
  readonly nextWorld: FootballWorld;
  readonly links: readonly FootballCausalLink[];
  readonly eventSpecs: readonly EventSpec[];
} => {
  if (!targetWorld.football.plays.some((candidate) => candidate.id === play.id))
    return fail(
      `play ${play.id} must exist in target football history before causal recording`,
    );
  const organizations = [
    play.homeOrganizationId,
    play.awayOrganizationId,
  ] as const;
  const derived = organizations.map((organizationId) => ({
    organizationId,
    ...causalInputsForOrganization(sourceWorld, play, organizationId),
  }));
  const minted = mintRecordIds(targetWorld, derived.length);
  const links: FootballCausalLink[] = derived.map((entry, index) => ({
    id: minted.ids[index]!,
    fixtureId: play.fixtureId,
    gameId: play.gameId,
    playId: play.id,
    organizationId: entry.organizationId,
    participantPlayerIds: entry.participantPlayerIds,
    visibility: 'organization',
    inputRefs: entry.inputRefs,
    consequenceRef: {
      kind: 'play_fact',
      playId: play.id,
      resultKind: play.resultKind,
    },
    recordedAt: sourceWorld.simDate,
  }));
  return {
    nextWorld: {
      ...targetWorld,
      nextIds: { ...targetWorld.nextIds, record: minted.next },
      football: {
        ...targetWorld.football,
        causalLinks: [...targetWorld.football.causalLinks, ...links].sort(
          (a, b) => byText(a.id, b.id),
        ),
      },
    },
    links,
    eventSpecs: [
      {
        type: 'FootballCausalLinksRecorded',
        payload: {
          playId: play.id,
          gameId: play.gameId,
          causalLinkIds: links.map((link) => link.id),
        },
      },
    ],
  };
};

export interface OrganizationSundayProofLink {
  readonly id: RecordId;
  readonly fixtureId: RecordId;
  readonly gameId: RecordId;
  readonly playId: RecordId;
  readonly organizationId: EntityId;
  readonly participantPlayerIds: readonly EntityId[];
  readonly inputRefs: readonly FootballCausalInputRef[];
  readonly consequenceRef: FootballCausalLink['consequenceRef'];
  readonly recordedAt: string;
}

export interface OrganizationSundayProofView {
  readonly organizationId: EntityId;
  readonly gameId: RecordId;
  readonly links: readonly OrganizationSundayProofLink[];
}

const knownMedicalEpisodesFor = (
  world: FootballWorld,
  organizationId: EntityId,
): ReadonlySet<RecordId> =>
  new Set<RecordId>([
    ...world.medical.reports
      .filter((report) => report.organizationId === organizationId)
      .map((report) => report.episodeId),
    ...world.medical.clearances
      .filter((clearance) => clearance.organizationId === organizationId)
      .map((clearance) => clearance.episodeId),
  ]);

const discloseRef = (
  ref: FootballCausalInputRef,
  knownMedicalEpisodeIds: ReadonlySet<RecordId>,
): FootballCausalInputRef | null => {
  if (ref.kind === 'role_knowledge') return null;
  if (
    ref.kind === 'record' &&
    ref.recordKind === 'medical_episode' &&
    !knownMedicalEpisodeIds.has(ref.id)
  )
    return null;
  switch (ref.kind) {
    case 'record':
      return { kind: 'record', recordKind: ref.recordKind, id: ref.id };
    case 'ruleset_key':
      return { kind: 'ruleset_key', keyKind: ref.keyKind, key: ref.key };
  }
};

const safeLink = (
  link: FootballCausalLink,
  knownMedicalEpisodeIds: ReadonlySet<RecordId>,
): OrganizationSundayProofLink => ({
  id: link.id,
  fixtureId: link.fixtureId,
  gameId: link.gameId,
  playId: link.playId,
  organizationId: link.organizationId,
  participantPlayerIds: [...link.participantPlayerIds],
  inputRefs: link.inputRefs
    .map((ref) => discloseRef(ref, knownMedicalEpisodeIds))
    .filter((ref): ref is FootballCausalInputRef => ref !== null),
  consequenceRef: {
    kind: 'play_fact',
    playId: link.consequenceRef.playId,
    resultKind: link.consequenceRef.resultKind,
  },
  recordedAt: link.recordedAt,
});

export const sundayProofForOrganization = (
  world: FootballWorld,
  organizationId: EntityId,
  gameId: RecordId,
): OrganizationSundayProofView => {
  const game: FootballGameRecord =
    world.football.games.find((candidate) => candidate.id === gameId) ??
    fail(`game ${gameId} does not exist`);
  if (
    organizationId !== game.homeOrganizationId &&
    organizationId !== game.awayOrganizationId
  )
    return fail(`${organizationId} did not participate in game ${gameId}`);
  const knownMedical = knownMedicalEpisodesFor(world, organizationId);
  const links = world.football.causalLinks
    .filter(
      (link) =>
        link.gameId === gameId &&
        link.visibility !== 'debug' &&
        (link.visibility === 'public' ||
          link.organizationId === organizationId),
    )
    .sort((a, b) => {
      const playA =
        world.football.plays.find((play) => play.id === a.playId)?.sequence ??
        0;
      const playB =
        world.football.plays.find((play) => play.id === b.playId)?.sequence ??
        0;
      return playA - playB || byText(a.id, b.id);
    })
    .map((link) => safeLink(link, knownMedical));
  return { organizationId, gameId, links };
};
