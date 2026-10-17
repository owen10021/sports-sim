import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  denied,
  isFailure,
  isPlainObject,
  mintRecordIds,
  parseActingPerson,
  spec,
  type Cmd,
} from './commandSupport';
import { latestProposal } from './decisions';
import {
  transactionSeasonRules,
  UnknownTransactionSeasonError,
} from './economy';
import {
  type DraftBoardRevision,
  type DraftPickAsset,
  type DraftSelection,
  type DraftSession,
} from './draft';
import { latestBoard } from './draftBoardCommands';
import { isValidId, type EntityId, type RecordId } from './ids';
import { holdsRoleAt } from './people';
import { activeRightsFor, type PlayerRightsRecord } from './roster';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { FootballWorld } from './world';

/**
 * Live draft transactions (Package C, Task 13). The draft is a logical-time session: it
 * opens on or after the ruleset's draft date, then waits on the pick at `currentIndex` for
 * an explicit selection command. There is no wall-clock deadline. A selection is an
 * atomic, revalidated acquisition: it re-derives the pick's CURRENT owner, the player's
 * availability and the club's authority at commit, then marks the pick used, records the
 * selection, grants draft rights and advances the clock in one change.
 */

export const DRAFT_COMMAND_TYPES = ['OpenDraft', 'MakeDraftSelection'] as const;
export type DraftCommandType = (typeof DRAFT_COMMAND_TYPES)[number];

export const DRAFT_SELECTION_TERMS_TYPE = 'draft_selection_v1';

/** Actors that may open a draft; clubs and delegates may not. */
const OPENERS: ReadonlySet<string> = new Set([
  'human_gm',
  'commissioner',
  'system',
  'test_harness',
]);

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const draftSelectionTerms = (o: {
  readonly sessionId: RecordId;
  readonly pickId: RecordId;
  readonly playerId: EntityId;
}): CanonicalValue => ({
  sessionId: o.sessionId,
  pickId: o.pickId,
  playerId: o.playerId,
});

/** Pick order: round, then slot, then id. Only picks whose slot is known can be ordered. */
const pickOrder = (a: DraftPickAsset, b: DraftPickAsset): number =>
  a.round - b.round ||
  (a.slot ?? Number.MAX_SAFE_INTEGER) - (b.slot ?? Number.MAX_SAFE_INTEGER) ||
  byText(a.id, b.id);

export const sessionForClass = (
  world: FootballWorld,
  draftClassId: RecordId,
): DraftSession | undefined =>
  world.draft.sessions.find((s) => s.draftClassId === draftClassId);

const replaceSession = (
  sessions: readonly DraftSession[],
  next: DraftSession,
): readonly DraftSession[] =>
  sessions.map((s) => (s.id === next.id ? next : s));

// --- OpenDraft ---------------------------------------------------------------------

const routeOpen = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  if (!OPENERS.has(ctx.actor.kind))
    return denied(`${ctx.actor.kind} cannot open the draft`);
  const { world } = ctx;
  const tx = ctx.ruleset.rules.transactions;
  if (tx === undefined) return bad('the ruleset has no transaction rules');
  if (!isValidId(c.draftClassId)) return bad('draftClassId must be a valid id');
  const klass = world.draft.classes.find((x) => x.id === c.draftClassId);
  if (klass === undefined) return bad('draftClassId does not name a class');
  if (sessionForClass(world, klass.id) !== undefined)
    return bad('this draft class already has a session');
  let draftDate: string;
  try {
    draftDate = transactionSeasonRules(tx, klass.season).draftDate;
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
    throw e;
  }
  const today = world.simDate;
  if (today < draftDate)
    return bad(`the ${klass.season} draft opens on ${draftDate}`);
  const picks = world.draft.picks
    .filter((p) => p.season === klass.season && p.status === 'available')
    .sort(pickOrder);
  if (picks.length === 0)
    return bad('there are no unused picks for this draft');
  if (picks.some((p) => p.slot === null))
    return bad('the pick order is not set: every pick needs a slot');
  const minted = mintRecordIds(world, 1);
  const session: DraftSession = {
    id: minted.ids[0]!,
    draftClassId: klass.id,
    status: 'open',
    orderedPickIds: picks.map((p) => p.id),
    currentIndex: 0,
    selectionIds: [],
    openedAt: today,
    completedAt: null,
  };
  return {
    ok: true,
    authorizationDetail: `${ctx.actor.kind} may open the draft`,
    resolution: {
      nextWorld: {
        ...world,
        draft: {
          ...world.draft,
          sessions: [...world.draft.sessions, session].sort((a, b) =>
            byText(a.id, b.id),
          ),
        },
        nextIds: { ...world.nextIds, record: minted.next },
      },
      eventSpecs: [
        spec('DraftOpened', {
          sessionId: session.id,
          draftClassId: klass.id,
          picks: session.orderedPickIds.length,
        }),
      ],
      detail: `the ${klass.season} draft is open with ${picks.length} picks`,
    },
  };
};

// --- MakeDraftSelection ------------------------------------------------------------

const TERM_KEYS = 'pickId,playerId,sessionId';

const routeSelect = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const { world } = ctx;
  const by = parseActingPerson(ctx, c);
  if (isFailure(by)) return by;
  if (!isValidId(c.proposalId)) return bad('proposalId must be a valid id');
  const proposal = latestProposal(world.decisions, c.proposalId);
  if (proposal === undefined) return bad('proposalId does not name a proposal');
  if (typeof c.expectedRevision !== 'number')
    return bad('expectedRevision must be the proposal revision');
  if (c.expectedRevision !== proposal.revision)
    return bad(
      `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`,
    );
  if (
    proposal.termsType !== DRAFT_SELECTION_TERMS_TYPE ||
    proposal.category !== 'acquisition'
  )
    return bad(
      `only ${DRAFT_SELECTION_TERMS_TYPE} acquisition proposals make selections`,
    );
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );
  const org = proposal.organizationId;
  if (!holdsRoleAt(world.people, org, by, world.simDate))
    return bad(`${by} holds no role in ${org}`);

  const t = proposal.terms;
  if (
    !isPlainObject(t) ||
    Object.keys(t).sort().join(',') !== TERM_KEYS ||
    !isValidId(t.sessionId) ||
    !isValidId(t.pickId) ||
    !isValidId(t.playerId)
  )
    return bad(`selection terms must be exactly {${TERM_KEYS}}`);
  const session = world.draft.sessions.find((s) => s.id === t.sessionId);
  if (session === undefined) return bad('the draft session does not exist');
  if (session.status !== 'open')
    return bad(`the draft is ${session.status}; no selections can be made`);
  const onClock = session.orderedPickIds[session.currentIndex];
  if (onClock === undefined) return bad('the draft has no pick on the clock');
  if (t.pickId !== onClock)
    return bad(
      `stale selection: ${String(t.pickId)} is not on the clock (${onClock} is)`,
    );
  const pick = world.draft.picks.find((p) => p.id === onClock);
  if (pick === undefined) return bad('the pick on the clock does not exist');
  if (pick.status !== 'available')
    return bad(`${pick.id} has already been used`);
  if (pick.ownerOrganizationId !== org)
    return bad(
      `${pick.id} is owned by ${pick.ownerOrganizationId}, not ${org}; only the current owner selects`,
    );

  const klass = world.draft.classes.find((x) => x.id === session.draftClassId);
  if (klass === undefined) return bad('the draft class does not exist');
  const playerId = t.playerId as EntityId;
  if (
    !klass.eligiblePlayerIds.includes(playerId) ||
    !world.roster.players.some((p) => p.personId === playerId)
  )
    return bad(`${playerId} is not eligible in this draft`);
  if (world.draft.selections.some((s) => s.playerId === playerId))
    return bad(`${playerId} has already been drafted`);
  if (activeRightsFor(world.roster, playerId, world.simDate).length > 0)
    return bad(`${playerId} is already under another right`);

  // Optional basis: the club's own latest board must still list the player.
  let board: DraftBoardRevision | undefined;
  let beliefIds: RecordId[] = [];
  let claimIds: RecordId[] = [];
  if (c.boardRevisionId !== undefined && c.boardRevisionId !== null) {
    if (!isValidId(c.boardRevisionId))
      return bad('boardRevisionId must be a valid id');
    board = world.draft.boards.find((b) => b.id === c.boardRevisionId);
    if (board === undefined || board.organizationId !== org)
      return bad('boardRevisionId is not one of this organization’s boards');
    if (latestBoard(world, org, klass.id)?.id !== board.id)
      return bad('boardRevisionId is not the latest board revision');
    const entry = board.tiers
      .flatMap((x) => x.entries)
      .find((e) => e.playerId === playerId);
    if (entry === undefined) return bad(`${playerId} is not on that board`);
    beliefIds = [...entry.beliefIds];
    claimIds = [...entry.noteClaimIds];
  }

  const minted = mintRecordIds(world, 2);
  const selection: DraftSelection = {
    id: minted.ids[0]!,
    sessionId: session.id,
    pickId: pick.id,
    organizationId: org,
    playerId,
    organizationProposalId: proposal.id,
    selectedAt: world.simDate,
    boardRevisionId: board?.id ?? null,
  };
  const right: PlayerRightsRecord = {
    id: minted.ids[1]!,
    playerId,
    holderOrganizationId: org,
    kind: 'draft',
    sourceRecordId: selection.id,
    effectiveFrom: world.simDate,
    effectiveUntil: null,
  };
  const nextIndex = session.currentIndex + 1;
  const done = nextIndex >= session.orderedPickIds.length;
  const nextSession: DraftSession = {
    ...session,
    currentIndex: nextIndex,
    selectionIds: [...session.selectionIds, selection.id],
    status: done ? 'complete' : 'open',
    completedAt: done ? world.simDate : null,
  };
  const events = [
    spec('DraftSelectionMade', {
      selectionId: selection.id,
      sessionId: session.id,
      pickId: pick.id,
      round: pick.round,
      slot: pick.slot,
      organizationId: org,
      playerId,
      boardRevisionId: selection.boardRevisionId,
    }),
    ...(done
      ? [
          spec('DraftCompleted', {
            sessionId: session.id,
            selections: nextSession.selectionIds.length,
          }),
        ]
      : []),
  ];
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      roster: {
        ...world.roster,
        rights: [...world.roster.rights, right].sort((a, b) =>
          byText(a.id, b.id),
        ),
      },
      draft: {
        ...world.draft,
        picks: world.draft.picks.map((p) =>
          p.id === pick.id ? { ...p, status: 'used' as const } : p,
        ),
        sessions: replaceSession(world.draft.sessions, nextSession),
        selections: [...world.draft.selections, selection].sort((a, b) =>
          byText(a.id, b.id),
        ),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    domainEvents: events,
    requests: [
      {
        organizationId: org,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        expectedCategory: 'acquisition',
        executedTerms: {
          termsType: DRAFT_SELECTION_TERMS_TYPE,
          terms: proposal.terms,
        },
        beliefIds: [...new Set(beliefIds)].sort(byText) as RecordId[],
        evidenceClaimIds: [...new Set(claimIds)].sort(byText) as RecordId[],
        rationale: c.rationale as CanonicalValue,
      },
    ],
  });
};

export const routeDraftCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: DraftCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'OpenDraft':
      return routeOpen(ctx, c);
    case 'MakeDraftSelection':
      return routeSelect(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable draft command: ${String(unreachable)}`);
    }
  }
};

// --- public view ---------------------------------------------------------------------

export type DraftSessionView = {
  readonly sessionId: RecordId;
  readonly status: DraftSession['status'];
  readonly onTheClock: {
    readonly pickId: RecordId;
    readonly round: number;
    readonly slot: number | null;
    readonly organizationId: EntityId;
  } | null;
  readonly selections: readonly {
    readonly pickId: RecordId;
    readonly organizationId: EntityId;
    readonly playerId: EntityId;
  }[];
  readonly remainingPickIds: readonly RecordId[];
};

/** League-public draft state: who is on the clock and who has been taken. No private data. */
export const buildDraftSessionView = (
  world: FootballWorld,
  sessionId: RecordId,
): DraftSessionView | undefined => {
  const s = world.draft.sessions.find((x) => x.id === sessionId);
  if (s === undefined) return undefined;
  const clock =
    s.status === 'open' ? s.orderedPickIds[s.currentIndex] : undefined;
  const pick = world.draft.picks.find((p) => p.id === clock);
  return {
    sessionId: s.id,
    status: s.status,
    onTheClock:
      pick === undefined
        ? null
        : {
            pickId: pick.id,
            round: pick.round,
            slot: pick.slot,
            organizationId: pick.ownerOrganizationId,
          },
    selections: world.draft.selections
      .filter((x) => x.sessionId === s.id)
      .map((x) => ({
        pickId: x.pickId,
        organizationId: x.organizationId,
        playerId: x.playerId,
      })),
    remainingPickIds: s.orderedPickIds.slice(s.currentIndex),
  };
};
