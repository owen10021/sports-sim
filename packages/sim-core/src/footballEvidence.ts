import type { EventSpec } from './commandRouter';
import { mintRecordId } from './commandSupport';
import { effectiveRightsAt } from './authority';
import type { EntityId, RecordId } from './ids';
import type { ClaimRecord } from './information';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

export type FootballObservationType =
  'execution_result' | 'assignment_result' | 'participation_result';

export interface FootballObservationInput {
  readonly sourcePersonId: EntityId;
  readonly organizationId: EntityId;
  readonly fixtureId: RecordId;
  readonly gameId: RecordId;
  readonly playId: RecordId;
  readonly observationType: FootballObservationType;
  readonly subjectPlayerId: EntityId;
}

export interface FootballObservationChange {
  readonly nextWorld: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
}

export class FootballObservationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballObservationError';
  }
}

const fail = (message: string): never => {
  throw new FootballObservationError(message);
};

const mayObserveFootballFor = (
  world: FootballWorld,
  organizationId: EntityId,
  sourcePersonId: EntityId,
): boolean => {
  if (
    !world.people.persons.some(
      (person) => person.entityId === sourcePersonId && person.active,
    ) ||
    !holdsRoleAt(world.people, organizationId, sourcePersonId, world.simDate)
  )
    return false;
  return (
    effectiveRightsAt(
      world,
      organizationId,
      sourcePersonId,
      'scheme',
      world.simDate,
    ).rights.includes('advise') ||
    effectiveRightsAt(
      world,
      organizationId,
      sourcePersonId,
      'organizational_plan',
      world.simDate,
    ).rights.includes('advise')
  );
};

const observationClaim = (
  world: FootballWorld,
  input: FootballObservationInput,
  id: RecordId,
): ClaimRecord => {
  if (!mayObserveFootballFor(world, input.organizationId, input.sourcePersonId))
    fail(
      `${input.sourcePersonId} is not a legitimate football observer for ${input.organizationId}`,
    );
  const fixture =
    world.football.fixtures.find((x) => x.id === input.fixtureId) ??
    fail('football observation references missing fixture facts');
  const game =
    world.football.games.find((x) => x.id === input.gameId) ??
    fail('football observation references missing game facts');
  const play =
    world.football.plays.find((x) => x.id === input.playId) ??
    fail('football observation references missing play facts');
  if (
    game.fixtureId !== fixture.id ||
    play.fixtureId !== fixture.id ||
    play.gameId !== game.id
  )
    fail('football observation references do not belong to one game');
  if (
    input.organizationId !== game.homeOrganizationId &&
    input.organizationId !== game.awayOrganizationId
  )
    fail('observer organization did not participate in the referenced game');
  const subjectParticipation =
    play.participation.find((p) => p.playerId === input.subjectPlayerId) ??
    fail('observation subject did not participate in the referenced play');

  return {
    id,
    subject: { kind: 'entity', id: input.subjectPlayerId },
    propositionType: `football_${input.observationType.replace('_result', '_observation')}`,
    proposition: {
      fixtureId: fixture.id,
      gameId: game.id,
      playId: play.id,
      playSequence: play.sequence,
      observationType: input.observationType,
      playCategory: play.playCategory,
      resultKind: play.resultKind,
      yardsGained: play.yardsGained,
      turnover: play.turnover,
      touchdown: play.touchdown,
      safety: play.safety,
      playStands: play.playStands,
      subjectPlayerId: input.subjectPlayerId,
      subjectSide: subjectParticipation.side,
      subjectSlotKey: subjectParticipation.slotKey,
      scoreAfter: {
        home: play.post.homeScore,
        away: play.post.awayScore,
      },
    },
    sourcePersonId: input.sourcePersonId,
    sourceFamilyId: `football-observation-${input.sourcePersonId}`,
    observedAt: game.playedAt,
    acquiredAt: world.simDate,
    visibility: 'organization',
    holderOrganizationIds: [input.organizationId],
    confidence: 'high',
    possibleBias: null,
    corroboratesClaimIds: [],
    contradictsClaimIds: [],
    sharedFromClaimId: null,
  };
};

/**
 * Converts already-resolved football facts into ordinary immutable Package B claims.
 * It reads no latent roster/development/medical value and the engine itself can never be a
 * source person. All validation completes before any returned world is constructed.
 */
export const createFootballObservationClaims = (
  world: FootballWorld,
  inputs: readonly FootballObservationInput[],
): FootballObservationChange => {
  let validationWorld = world;
  const prepared: ClaimRecord[] = [];
  for (const input of inputs) {
    const minted = mintRecordId(validationWorld);
    const claim = observationClaim(world, input, minted.id);
    prepared.push(claim);
    validationWorld = {
      ...validationWorld,
      nextIds: { ...validationWorld.nextIds, record: minted.next },
    };
  }
  if (prepared.length === 0) return { nextWorld: world, eventSpecs: [] };
  const claims = [...world.information.claims, ...prepared].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return {
    nextWorld: {
      ...world,
      nextIds: validationWorld.nextIds,
      information: { ...world.information, claims },
    },
    eventSpecs: prepared.map((claim) => ({
      type: 'ClaimRecorded',
      payload: {
        actingPersonId: claim.sourcePersonId,
        organizationId: claim.holderOrganizationIds[0]!,
        claim: { ...claim },
      },
    })),
  };
};

/** Stable eligible staff source for automatic post-game observation, if one exists. */
export const defaultFootballObserver = (
  world: FootballWorld,
  organizationId: EntityId,
): EntityId | null => {
  const candidates = world.people.roleEpisodes
    .filter(
      (role) =>
        role.organizationId === organizationId &&
        role.startDate <= world.simDate &&
        (role.endDate === null || world.simDate <= role.endDate) &&
        (role.role === 'head_coach' ||
          role.role === 'offensive_coordinator' ||
          role.role === 'defensive_coordinator'),
    )
    .map((role) => role.personId)
    .filter((personId) =>
      mayObserveFootballFor(world, organizationId, personId),
    )
    .sort();
  return candidates[0] ?? null;
};
