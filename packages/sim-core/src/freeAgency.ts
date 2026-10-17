import { capChargeBySeason, capPosition } from './contractMath';
import type { SeasonAmount } from './contracts';
import { UnknownTransactionSeasonError, addMoney } from './economy';
import type { TransactionRulesV1 } from './economy';
import type { EntityId } from './ids';
import type {
  ContractOfferRecord,
  ContractOfferStatus,
  PlayerDisposition,
} from './market';
import {
  buildPlayerMarketDecisionView,
  evaluatePlayerOfferSet,
  rankAcceptableOffers,
  type OfferAsSeenByPlayer,
} from './playerMarketView';
import { rosterCapacity } from './roster';
import type { FootballWorld } from './world';

/**
 * Concurrent free-agency resolution (Package C, Task 10).
 *
 * Every live offer is decided together at a logical checkpoint, never in arrival order.
 * It is player-proposing deferred acceptance: each player points at the best offer he would
 * accept; each club keeps, among the offers pointed at it, those it can actually afford, in
 * its own private priority order, using at most one offer per fallback group; a player whose
 * offer is turned away points at his next acceptable offer. Players only ever move down
 * their lists, so it terminates, and every ordering rule uses offer content (priority, player
 * id, club id, terms), never record ids or insertion order. Permuting the order offers were
 * submitted in therefore cannot change the outcome.
 */

export type OfferOutcomeStatus = Extract<
  ContractOfferStatus,
  'accepted_pending_commit' | 'rejected' | 'withdrawn' | 'countered'
>;

export type FreeAgencyOutcome = {
  readonly offer: ContractOfferRecord;
  readonly status: OfferOutcomeStatus;
  readonly disposition: PlayerDisposition;
  /** Private to the player side. */
  readonly reasons: readonly string[];
  /** What the offering club is told. */
  readonly communicated: readonly string[];
};

/** Cap charges the signing would add: the whole contract, or only the increase for an extension. */
export const offerCharges = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  offer: ContractOfferRecord,
): readonly SeasonAmount[] => {
  const next = capChargeBySeason(tx.contracts, offer.terms);
  if (!offer.extension) return next.filter((x) => x.amount > 0);
  const old = world.contracts.agreements.find(
    (a) =>
      a.playerId === offer.playerId &&
      a.organizationId === offer.organizationId &&
      a.status === 'active',
  );
  // The old signing-bonus proration is retained as dead cap by the extension, so only
  // the replaced base salary and roster bonus are offset by the new charge.
  const before =
    old === undefined
      ? []
      : old.terms.years.map((y) => ({
          season: y.season,
          amount: addMoney(y.baseSalary, y.rosterBonus),
        }));
  return next
    .map((x) => ({
      season: x.season,
      amount: Math.max(
        0,
        x.amount - (before.find((b) => b.season === x.season)?.amount ?? 0),
      ) as SeasonAmount['amount'],
    }))
    .filter((x) => x.amount > 0);
};

/** The roster slot a signing needs; an extension needs none. */
export const offerSlot = (offer: ContractOfferRecord) =>
  offer.extension ? null : offer.targetRosterStatus;

/**
 * Whether `candidate` fits for its club on top of `chosen`, judged against actual state
 * (reservations are deliberately ignored: they are the very room being allocated).
 */
export const fitProblem = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  chosen: readonly ContractOfferRecord[],
  candidate: ContractOfferRecord,
): string | null => {
  const all = [...chosen, candidate];
  try {
    for (const charge of offerCharges(world, tx, candidate)) {
      const position = capPosition(
        tx,
        world.contracts,
        candidate.organizationId,
        charge.season,
      );
      const incoming = all.reduce(
        (sum, o) =>
          sum +
          (offerCharges(world, tx, o).find((x) => x.season === charge.season)
            ?.amount ?? 0),
        0,
      );
      if (position.committed + incoming > position.cap)
        return `cap: season ${charge.season} would exceed ${position.cap}`;
    }
    const slot = offerSlot(candidate);
    if (slot !== null) {
      const capacity = rosterCapacity(
        world.roster,
        tx,
        candidate.organizationId,
        world.simDate,
      )[slot];
      const wanted = all.filter((o) => offerSlot(o) === slot).length;
      if (capacity.count + wanted > capacity.limit)
        return `roster capacity: ${slot} is full`;
    }
  } catch (e) {
    if (e instanceof UnknownTransactionSeasonError) return e.message;
    throw e;
  }
  return null;
};

const text = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byClubOrder = (a: ContractOfferRecord, b: ContractOfferRecord): number =>
  a.priority - b.priority || text(a.playerId, b.playerId);

const livePlayers = (offers: readonly ContractOfferRecord[]): EntityId[] =>
  [...new Set(offers.map((o) => o.playerId))].sort(text);

/** Resolves every live (communicated, unexpired) offer at once; see the module comment. */
export const resolveFreeAgencyRound = (
  world: FootballWorld,
  tx: TransactionRulesV1,
): readonly FreeAgencyOutcome[] => {
  const today = world.simDate;
  const live = world.market.contractOffers
    .filter(
      (o) =>
        o.status === 'communicated' &&
        (o.expiresAt === null || today < o.expiresAt),
    )
    .sort(
      (a, b) =>
        text(a.organizationId, b.organizationId) ||
        text(a.playerId, b.playerId),
    );

  const outcomes = new Map<ContractOfferRecord, FreeAgencyOutcome>();
  const record = (
    offer: ContractOfferRecord,
    status: OfferOutcomeStatus,
    disposition: PlayerDisposition,
    reasons: readonly string[],
    communicated: readonly string[],
  ): void => {
    outcomes.set(offer, { offer, status, disposition, reasons, communicated });
  };

  // Player side, per player: the view, the evaluation and the acceptable ranking.
  const ranking = new Map<EntityId, readonly ContractOfferRecord[]>();
  const evaluations = new Map<
    string,
    ReturnType<typeof evaluatePlayerOfferSet>[number]
  >();
  for (const playerId of livePlayers(live)) {
    const view = buildPlayerMarketDecisionView(world, playerId);
    for (const e of evaluatePlayerOfferSet(view))
      evaluations.set(`${e.organizationId}|${playerId}`, e);
    const seen = new Set(view.offers.map((o) => o.offerId));
    const mine = live.filter((o) => o.playerId === playerId);
    for (const o of mine)
      if (!seen.has(o.id))
        record(
          o,
          'rejected',
          'reject',
          ['offer_not_made_through_current_agent'],
          ['not_a_fit'],
        );
    const offerOf = (s: OfferAsSeenByPlayer): ContractOfferRecord =>
      mine.find((o) => o.id === s.offerId)!;
    ranking.set(
      playerId,
      rankAcceptableOffers(view.preferences, playerId, view.offers).map(
        offerOf,
      ),
    );
  }

  // Deferred acceptance.
  const pointer = new Map<EntityId, number>();
  for (const p of ranking.keys()) pointer.set(p, 0);
  const droppedByClub = new Map<ContractOfferRecord, string>();
  const pick = (p: EntityId): ContractOfferRecord | undefined =>
    ranking.get(p)![pointer.get(p)!];
  let held = new Map<EntityId, ContractOfferRecord>();
  for (;;) {
    const proposals = [...ranking.keys()]
      .map((p) => pick(p))
      .filter((o): o is ContractOfferRecord => o !== undefined);
    const orgs = [...new Set(proposals.map((o) => o.organizationId))].sort(
      text,
    );
    const kept: ContractOfferRecord[] = [];
    let turnedAway = false;
    for (const org of orgs) {
      const mine = proposals
        .filter((o) => o.organizationId === org)
        .sort(byClubOrder);
      const chosen: ContractOfferRecord[] = [];
      const groups = new Set<string>();
      for (const o of mine) {
        let why: string | null = null;
        if (o.contingencyGroupId !== null && groups.has(o.contingencyGroupId))
          why = 'club_group_already_filled';
        else
          why =
            fitProblem(world, tx, chosen, o) === null
              ? null
              : 'club_could_not_fit';
        if (why === null) {
          chosen.push(o);
          if (o.contingencyGroupId !== null) groups.add(o.contingencyGroupId);
        } else {
          droppedByClub.set(o, why);
          pointer.set(o.playerId, pointer.get(o.playerId)! + 1);
          turnedAway = true;
        }
      }
      kept.push(...chosen);
    }
    held = new Map(kept.map((o) => [o.playerId, o]));
    if (!turnedAway) break;
  }

  // Outcomes.
  for (const o of live) {
    if (outcomes.has(o)) continue;
    const evaluation = evaluations.get(`${o.organizationId}|${o.playerId}`)!;
    const winner = held.get(o.playerId);
    if (winner === o) {
      record(o, 'accepted_pending_commit', 'accept', evaluation.reasons, [
        'interested',
      ]);
    } else if (droppedByClub.has(o)) {
      record(
        o,
        'withdrawn',
        'reject',
        [...evaluation.reasons, `club_side:${droppedByClub.get(o)!}`],
        ['club_withdrew'],
      );
    } else if (evaluation.disposition === 'counter') {
      record(
        o,
        'countered',
        'counter',
        evaluation.reasons,
        evaluation.communicated,
      );
    } else if (evaluation.disposition === 'reject') {
      record(
        o,
        'rejected',
        'reject',
        evaluation.reasons,
        evaluation.communicated,
      );
    } else {
      record(
        o,
        'rejected',
        'reject',
        [...evaluation.reasons, 'player_chose_another_offer'],
        ['not_selected'],
      );
    }
  }
  return [...outcomes.values()].sort(
    (a, b) =>
      text(a.offer.organizationId, b.offer.organizationId) ||
      text(a.offer.playerId, b.offer.playerId),
  );
};
