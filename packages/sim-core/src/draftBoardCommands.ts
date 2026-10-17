import type { CanonicalValue, CommandPayloadBase } from './audit';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  isFailure,
  isPlainObject,
  mintRecordIds,
  parseActingPerson,
  spec,
  type Cmd,
} from './commandSupport';
import {
  MAX_BOARD_TIER,
  MIN_BOARD_TIER,
  NEED_PRIORITIES,
  type DraftBoardEntry,
  type DraftBoardRevision,
  type DraftBoardTier,
  type NeedPriority,
} from './draft';
import { latestProposal } from './decisions';
import { isValidId, type EntityId, type RecordId } from './ids';
import { isBeliefVisibleTo, isClaimVisibleTo } from './knowledgeView';
import { holdsRoleAt } from './people';
import { commitAuthorizedDomainChange } from './transactionCommit';
import type { FootballWorld } from './world';

export const DRAFT_BOARD_COMMAND_TYPES = ['CommitDraftBoardProposal'] as const;
export type DraftBoardCommandType = (typeof DRAFT_BOARD_COMMAND_TYPES)[number];

export const DRAFT_BOARD_TERMS_TYPE = 'draft_board_v1';

const MAX_ENTRIES = 400;
const MAX_REFS = 16;

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// --- terms <-> board ---------------------------------------------------------------

const ENTRY_KEYS = [
  'beliefIds',
  'needPriority',
  'noteClaimIds',
  'planIds',
  'playerId',
  'roleProjection',
  'withinTierOrder',
];

const exactKeys = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');

const idList = (v: unknown, label: string): RecordId[] | string => {
  if (!Array.isArray(v) || v.length > MAX_REFS || v.some((x) => !isValidId(x)))
    return `${label} must be a list of up to ${MAX_REFS} ids`;
  return [...new Set(v as string[])].sort(byText) as RecordId[];
};

type ParsedBoard = {
  readonly draftClassId: RecordId;
  readonly tiers: readonly DraftBoardTier[];
};

const entryOrder = (a: DraftBoardEntry, b: DraftBoardEntry): number =>
  (a.withinTierOrder ?? Number.MAX_SAFE_INTEGER) -
    (b.withinTierOrder ?? Number.MAX_SAFE_INTEGER) ||
  byText(a.playerId, b.playerId);

/**
 * Parses and validates a board's canonical terms for one organization and viewer. Only
 * references the viewer may legitimately see are accepted, and any field that is not part
 * of the board (a rating, a grade, raw capabilities) is refused outright.
 */
export const parseDraftBoardTerms = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
  terms: CanonicalValue,
): ParsedBoard | string => {
  if (!isPlainObject(terms) || !exactKeys(terms, ['draftClassId', 'tiers']))
    return 'board terms must be exactly { draftClassId, tiers }';
  const draftClass = world.draft.classes.find(
    (c) => c.id === terms.draftClassId,
  );
  if (draftClass === undefined)
    return 'draftClassId does not name a draft class';
  if (!Array.isArray(terms.tiers) || terms.tiers.length === 0)
    return 'a board needs at least one tier';
  const seenTiers = new Set<number>();
  const seenPlayers = new Set<string>();
  let entries = 0;
  const tiers: DraftBoardTier[] = [];
  for (const rawTier of terms.tiers as unknown[]) {
    if (!isPlainObject(rawTier) || !exactKeys(rawTier, ['entries', 'tier']))
      return 'each tier must be exactly { tier, entries }';
    const tier = rawTier.tier;
    if (
      typeof tier !== 'number' ||
      !Number.isInteger(tier) ||
      tier < MIN_BOARD_TIER ||
      tier > MAX_BOARD_TIER
    )
      return `tier must be an integer ${MIN_BOARD_TIER}..${MAX_BOARD_TIER}`;
    if (seenTiers.has(tier)) return `tier ${tier} appears twice`;
    seenTiers.add(tier);
    if (!Array.isArray(rawTier.entries) || rawTier.entries.length === 0)
      return `tier ${tier} needs at least one entry`;
    const usedOrders = new Set<number>();
    const parsed: DraftBoardEntry[] = [];
    for (const raw of rawTier.entries as unknown[]) {
      if (!isPlainObject(raw)) return 'each entry must be an object';
      if (!exactKeys(raw, ENTRY_KEYS))
        return `an entry is exactly ${ENTRY_KEYS.join(', ')}: no other field (such as a rating or capabilities) is accepted`;
      entries += 1;
      if (entries > MAX_ENTRIES)
        return `a board holds at most ${MAX_ENTRIES} prospects`;
      if (!isValidId(raw.playerId)) return 'entry.playerId must be a valid id';
      const playerId = raw.playerId as EntityId;
      if (!draftClass.eligiblePlayerIds.includes(playerId))
        return `${playerId} is not eligible in this draft class`;
      if (seenPlayers.has(playerId)) return `${playerId} is on the board twice`;
      seenPlayers.add(playerId);
      if (
        typeof raw.needPriority !== 'string' ||
        !(NEED_PRIORITIES as readonly string[]).includes(raw.needPriority)
      )
        return `needPriority must be one of ${NEED_PRIORITIES.join(', ')}`;
      const role = raw.roleProjection;
      if (
        role !== null &&
        (typeof role !== 'string' || role.length === 0 || role.length > 48)
      )
        return 'roleProjection must be null or 1-48 characters';
      const order = raw.withinTierOrder;
      if (order !== null) {
        if (typeof order !== 'number' || !Number.isInteger(order) || order < 1)
          return 'withinTierOrder must be null or a positive integer';
        if (usedOrders.has(order))
          return `tier ${tier} gives order ${order} to two prospects; use null for a tie`;
        usedOrders.add(order);
      }
      const beliefIds = idList(raw.beliefIds, 'beliefIds');
      if (typeof beliefIds === 'string') return beliefIds;
      const planIds = idList(raw.planIds, 'planIds');
      if (typeof planIds === 'string') return planIds;
      const noteClaimIds = idList(raw.noteClaimIds, 'noteClaimIds');
      if (typeof noteClaimIds === 'string') return noteClaimIds;
      if (beliefIds.length === 0 && noteClaimIds.length === 0)
        return `${playerId} needs a belief or a noted claim behind its place on the board`;
      for (const id of beliefIds) {
        const belief = world.information.beliefs.find((b) => b.id === id);
        if (
          belief === undefined ||
          !isBeliefVisibleTo(world, organizationId, actorPersonId, belief)
        )
          return `beliefIds: ${id} is not available to this organization`;
        if (belief.subject.kind !== 'entity' || belief.subject.id !== playerId)
          return `beliefIds: ${id} is not about ${playerId}`;
      }
      for (const id of noteClaimIds) {
        const claim = world.information.claims.find((x) => x.id === id);
        if (
          claim === undefined ||
          !isClaimVisibleTo(world, organizationId, actorPersonId, claim)
        )
          return `noteClaimIds: ${id} is not available to this organization`;
        if (claim.subject.kind !== 'entity' || claim.subject.id !== playerId)
          return `noteClaimIds: ${id} is not about ${playerId}`;
      }
      for (const id of planIds) {
        const plan = world.plans.plans.find((p) => p.id === id);
        if (plan === undefined || plan.organizationId !== organizationId)
          return `planIds: ${id} is not a plan of this organization`;
      }
      parsed.push({
        playerId,
        beliefIds,
        roleProjection: role as string | null,
        withinTierOrder: order as number | null,
        needPriority: raw.needPriority as NeedPriority,
        planIds,
        noteClaimIds,
      });
    }
    tiers.push({ tier, entries: parsed.sort(entryOrder) });
  }
  return {
    draftClassId: draftClass.id,
    tiers: tiers.sort((a, b) => a.tier - b.tier),
  };
};

// --- reads ----------------------------------------------------------------------------

/** The organization's current board for a class: its highest revision. */
export const latestBoard = (
  world: FootballWorld,
  organizationId: EntityId,
  draftClassId: string,
): DraftBoardRevision | undefined =>
  world.draft.boards
    .filter(
      (b) =>
        b.organizationId === organizationId && b.draftClassId === draftClassId,
    )
    .sort((a, b) => a.revision - b.revision)
    .at(-1);

export type BoardChange = {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly tierChanged: readonly string[];
  readonly orderChanged: readonly string[];
  readonly needChanged: readonly string[];
  readonly basisChanged: readonly string[];
};

const flat = (b: DraftBoardRevision | null) =>
  new Map(
    (b?.tiers ?? []).flatMap((t) =>
      t.entries.map(
        (e) => [e.playerId as string, { tier: t.tier, entry: e }] as const,
      ),
    ),
  );

/**
 * How a revision differs from the one before it, kept separate on purpose: a change of
 * need alters priority without touching tiers or beliefs, and says so.
 */
export const describeBoardChange = (
  previous: DraftBoardRevision | null,
  next: DraftBoardRevision,
): BoardChange => {
  const before = flat(previous);
  const after = flat(next);
  const added: string[] = [];
  const removed: string[] = [];
  const tierChanged: string[] = [];
  const orderChanged: string[] = [];
  const needChanged: string[] = [];
  const basisChanged: string[] = [];
  for (const [id, now] of after) {
    const was = before.get(id);
    if (was === undefined) {
      added.push(id);
      continue;
    }
    if (was.tier !== now.tier) tierChanged.push(id);
    if (was.entry.withinTierOrder !== now.entry.withinTierOrder)
      orderChanged.push(id);
    if (was.entry.needPriority !== now.entry.needPriority) needChanged.push(id);
    if (
      was.entry.beliefIds.join() !== now.entry.beliefIds.join() ||
      was.entry.noteClaimIds.join() !== now.entry.noteClaimIds.join() ||
      was.entry.planIds.join() !== now.entry.planIds.join() ||
      was.entry.roleProjection !== now.entry.roleProjection
    )
      basisChanged.push(id);
  }
  for (const id of before.keys()) if (!after.has(id)) removed.push(id);
  const sorted = (xs: string[]) => xs.sort(byText);
  return {
    added: sorted(added),
    removed: sorted(removed),
    tierChanged: sorted(tierChanged),
    orderChanged: sorted(orderChanged),
    needChanged: sorted(needChanged),
    basisChanged: sorted(basisChanged),
  };
};

export type DraftBoardView = {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  /** Every revision, oldest first, with references limited to what the viewer may see. */
  readonly boards: readonly DraftBoardRevision[];
};

/** An organization's own boards, for its own members only; a rival's board is never visible. */
export const buildDraftBoardView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
): DraftBoardView => {
  const member = holdsRoleAt(
    world.people,
    organizationId,
    actorPersonId,
    world.simDate,
  );
  const beliefOk = new Set<string>(
    member
      ? world.information.beliefs
          .filter((b) =>
            isBeliefVisibleTo(world, organizationId, actorPersonId, b),
          )
          .map((b) => b.id)
      : [],
  );
  const claimOk = new Set<string>(
    member
      ? world.information.claims
          .filter((c) =>
            isClaimVisibleTo(world, organizationId, actorPersonId, c),
          )
          .map((c) => c.id)
      : [],
  );
  return {
    organizationId,
    actorPersonId,
    asOf: world.simDate,
    boards: world.draft.boards
      .filter((b) => member && b.organizationId === organizationId)
      .map((b) => ({
        ...b,
        tiers: b.tiers.map((t) => ({
          ...t,
          entries: t.entries.map((e) => ({
            ...e,
            beliefIds: e.beliefIds.filter((id) => beliefOk.has(id)),
            noteClaimIds: e.noteClaimIds.filter((id) => claimOk.has(id)),
          })),
        })),
      }))
      .sort((a, b) => a.revision - b.revision || byText(a.id, b.id)),
  };
};

// --- CommitDraftBoardProposal ----------------------------------------------------------

const routeCommitBoard = (ctx: RouteContext, c: Cmd): RouteOutcome => {
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
    proposal.termsType !== DRAFT_BOARD_TERMS_TYPE ||
    proposal.category !== 'acquisition'
  )
    return bad(
      `only ${DRAFT_BOARD_TERMS_TYPE} acquisition proposals commit as boards`,
    );
  if (!isPlainObject(c.rationale)) return bad('rationale must be an object');
  if (proposal.state !== 'authorized')
    return bad(
      `proposal is ${proposal.state}; only an authorized proposal commits`,
    );
  const org = proposal.organizationId;
  if (!holdsRoleAt(world.people, org, by, world.simDate))
    return bad(`${by} holds no role in ${org}`);

  const parsed = parseDraftBoardTerms(world, org, by, proposal.terms);
  if (typeof parsed === 'string') return bad(parsed);

  const previous = latestBoard(world, org, parsed.draftClassId);
  const named = c.supersedesBoardRevisionId ?? null;
  if (previous === undefined) {
    if (named !== null)
      return bad('there is no earlier board revision to supersede');
  } else if (named !== previous.id) {
    return bad(
      `${org} already has a board for this class: revise ${previous.id} (revisions link, they never overwrite)`,
    );
  }

  const minted = mintRecordIds(world, 1);
  const board: DraftBoardRevision = {
    id: minted.ids[0]!,
    organizationId: org,
    draftClassId: parsed.draftClassId,
    revision: (previous?.revision ?? 0) + 1,
    tiers: parsed.tiers,
    createdAt: world.simDate,
    supersedesBoardRevisionId: previous?.id ?? null,
    organizationProposalId: proposal.id,
    createdByPersonId: by,
  };
  const change = describeBoardChange(previous ?? null, board);
  const entries = board.tiers.flatMap((t) => t.entries);
  const beliefIds = [...new Set(entries.flatMap((e) => e.beliefIds))].sort(
    byText,
  );
  const claimIds = [...new Set(entries.flatMap((e) => e.noteClaimIds))].sort(
    byText,
  );
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      draft: {
        ...world.draft,
        boards: [...world.draft.boards, board].sort((a, b) =>
          byText(a.id, b.id),
        ),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    domainEvents: [
      spec('DraftBoardCommitted', {
        boardId: board.id,
        organizationId: org,
        draftClassId: board.draftClassId,
        revision: board.revision,
        supersedesBoardRevisionId: board.supersedesBoardRevisionId,
        prospects: entries.length,
        tiers: board.tiers.length,
        change: {
          added: [...change.added],
          removed: [...change.removed],
          tierChanged: [...change.tierChanged],
          orderChanged: [...change.orderChanged],
          needChanged: [...change.needChanged],
          basisChanged: [...change.basisChanged],
        },
      }),
    ],
    requests: [
      {
        organizationId: org,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        expectedCategory: 'acquisition',
        executedTerms: {
          termsType: DRAFT_BOARD_TERMS_TYPE,
          terms: proposal.terms,
        },
        beliefIds,
        evidenceClaimIds: claimIds,
        rationale: c.rationale as CanonicalValue,
      },
    ],
  });
};

export const routeDraftBoardCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: DraftBoardCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CommitDraftBoardProposal':
      return routeCommitBoard(ctx, c);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable draft board command: ${String(unreachable)}`);
    }
  }
};
