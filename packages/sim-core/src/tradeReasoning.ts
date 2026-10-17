import {
  ACQUISITION_TIERS,
  ACQUISITION_TIER_ASSESSMENT,
  COMPETITIVE_WINDOWS,
  COMPETITIVE_WINDOW_KEY,
  type AcquisitionDecisionView,
  type AcquisitionTier,
  type CompetitiveWindow,
  type PublicContractFact,
  type PublicPickFact,
  type PublicPlayerFact,
} from './acquisitionView';
import type { AcquisitionAssetRef, TradePackageV1 } from './assets';
import { assetKey } from './assets';
import { hashCanonical } from './hash';
import type { EntityId } from './ids';
import type {
  InquiryDirection,
  TradeDisposition,
  TradeInterestBand,
  TradeReason,
} from './market';
import type { RosterStatus } from './roster';
import { SimDate } from './simDate';

/**
 * How a club answers a trade question, using only its own AcquisitionDecisionView. The
 * answer is a disposition with reasons that cite the parts of that view they rest on. There
 * is no number that ranks assets, no shared value table, and no hidden offer score: the same
 * package can honestly be "accept" for one club and "reject" for another because their
 * plans, evaluations, rosters and caps differ.
 */

export type TradeEvaluation = {
  readonly disposition: TradeDisposition;
  readonly reasons: readonly TradeReason[];
  readonly uncertainties: readonly string[];
};

/** The player's age is a public fact; this is whole years on `date`. */
export const ageOn = (birthDate: string, date: string): number => {
  const b = SimDate.parse(birthDate).toISO();
  const d = SimDate.parse(date).toISO();
  let age = Number(d.slice(0, 4)) - Number(b.slice(0, 4));
  if (d.slice(5) < b.slice(5)) age -= 1;
  return age;
};

const AGING_FROM = 29;
const PREMIUM_ROUND_MAX = 2;

export const competitiveWindowOf = (
  view: AcquisitionDecisionView,
): CompetitiveWindow | null => {
  for (const plan of view.plans) {
    if (plan.kind !== 'strategy') continue;
    for (const o of plan.objectives)
      if (
        o.key === COMPETITIVE_WINDOW_KEY &&
        typeof o.target === 'string' &&
        (COMPETITIVE_WINDOWS as readonly string[]).includes(o.target)
      )
        return o.target as CompetitiveWindow;
  }
  return null;
};

/** This club's own current tier for a player, from its own latest belief; `null` if none. */
export const ownTierFor = (
  view: AcquisitionDecisionView,
  playerId: EntityId,
): AcquisitionTier | null => {
  const latest = view.knowledge.beliefs.find(
    (b) =>
      b.assessmentType === ACQUISITION_TIER_ASSESSMENT &&
      b.subject.id === playerId &&
      b.supersededByBeliefId === null,
  );
  const tier =
    latest !== undefined &&
    typeof latest.assessment === 'object' &&
    latest.assessment !== null &&
    !Array.isArray(latest.assessment)
      ? (latest.assessment as { readonly [key: string]: unknown }).tier
      : undefined;
  return (ACQUISITION_TIERS as readonly unknown[]).includes(tier)
    ? (tier as AcquisitionTier)
    : null;
};

const playerFact = (
  view: AcquisitionDecisionView,
  id: EntityId,
): PublicPlayerFact | undefined =>
  view.publicContext.players.find((p) => p.playerId === id);
const contractFact = (
  view: AcquisitionDecisionView,
  id: EntityId,
): PublicContractFact | undefined =>
  view.publicContext.contracts.find((c) => c.playerId === id);
const pickFact = (
  view: AcquisitionDecisionView,
  id: string,
): PublicPickFact | undefined =>
  view.publicContext.picks.find((p) => p.pickId === id);

const sumAt = (xs: readonly { season: number; amount: number }[], s: number) =>
  xs.find((x) => x.season === s)?.amount ?? 0;

/**
 * Cap and roster-room problems this package would cause the club, from its own view. The
 * rules are the same ones commit enforces; this is the club noticing them in advance.
 */
const feasibilityReasons = (
  view: AcquisitionDecisionView,
  incoming: readonly AcquisitionAssetRef[],
  outgoing: readonly AcquisitionAssetRef[],
): TradeReason[] => {
  const out: TradeReason[] = [];
  const delta = new Map<number, number>();
  const bump = (s: number, n: number) => delta.set(s, (delta.get(s) ?? 0) + n);
  const slots: Record<RosterStatus, number> = {
    active: 0,
    reserve: 0,
    practice_squad: 0,
  };
  for (const a of incoming) {
    if (a.kind !== 'player_rights') continue;
    const c = contractFact(view, a.playerId);
    for (const x of c?.receiverChargeBySeason ?? []) bump(x.season, x.amount);
    const st = playerFact(view, a.playerId)?.rosterStatus;
    if (st) slots[st] += 1;
  }
  for (const a of outgoing) {
    if (a.kind !== 'player_rights') continue;
    const c = contractFact(view, a.playerId);
    for (const x of c?.capChargeBySeason ?? [])
      bump(
        x.season,
        -(x.amount - sumAt(c?.retainedDeadCapBySeason ?? [], x.season)),
      );
    const st = playerFact(view, a.playerId)?.rosterStatus;
    if (st) slots[st] -= 1;
  }
  for (const pos of view.own.capBySeason) {
    const d = delta.get(pos.season) ?? 0;
    const held = sumAt(view.own.reserved.capBySeason, pos.season);
    if (d > 0 && pos.committed + held + d > pos.cap)
      out.push({
        code: 'CAP_INFEASIBLE',
        source: 'own_cap',
        detail: `season ${pos.season}: committed ${pos.committed} plus ${held} held plus ${d} incoming exceeds ${pos.cap}`,
      });
  }
  for (const s of ['active', 'reserve', 'practice_squad'] as const) {
    const cap = view.own.capacity[s];
    const held = view.own.reserved.slots[s];
    if (slots[s] > 0 && cap.count + held + slots[s] > cap.limit)
      out.push({
        code: 'ROSTER_INFEASIBLE',
        source: 'own_roster',
        detail: `${s} list would hold ${cap.count + held + slots[s]} of ${cap.limit}`,
      });
  }
  return out;
};

const isPremium = (p: PublicPickFact | undefined) =>
  p !== undefined && p.round <= PREMIUM_ROUND_MAX;

export const evaluateTradeForOrganization = (
  view: AcquisitionDecisionView,
  pkg: TradePackageV1,
): TradeEvaluation => {
  const me = view.organizationId;
  const isA = me === pkg.organizationAId;
  const isB = me === pkg.organizationBId;
  if (!isA && !isB)
    return {
      disposition: 'reject',
      reasons: [
        {
          code: 'NOT_A_PARTY',
          source: 'public',
          detail: `${me} is not a party to this package`,
        },
      ],
      uncertainties: [],
    };
  const incoming = isA ? pkg.assetsFromB : pkg.assetsFromA;
  const outgoing = isA ? pkg.assetsFromA : pkg.assetsFromB;
  const window = competitiveWindowOf(view);
  const reasons: TradeReason[] = [];
  const uncertainties: string[] = [];
  const favorable: TradeReason[] = [];
  const unfavorable: TradeReason[] = [];

  // Hard limits first: infeasible or forbidden by the club's own plan.
  const hard: TradeReason[] = feasibilityReasons(view, incoming, outgoing);
  for (const plan of view.plans)
    for (const c of plan.constraints)
      if (
        c.kind === 'hard' &&
        c.key === 'keep_player' &&
        outgoing.some(
          (a) => a.kind === 'player_rights' && a.playerId === c.value,
        )
      )
        hard.push({
          code: 'PLAN_HARD_CONSTRAINT',
          source: 'own_plan',
          detail: `plan ${plan.planId} requires keeping ${String(c.value)}`,
        });
  if (hard.length > 0)
    return { disposition: 'reject', reasons: hard, uncertainties };

  // Players leaving.
  for (const a of outgoing) {
    if (a.kind !== 'player_rights') continue;
    const tier = ownTierFor(view, a.playerId);
    const fact = playerFact(view, a.playerId);
    if (tier === 'priority' || tier === 'target')
      unfavorable.push({
        code: 'KEEP_CORE_PLAYER',
        source: 'own_belief',
        detail: `our own evaluation lists ${a.playerId} as ${tier}`,
      });
    else if (tier === 'avoid')
      favorable.push({
        code: 'GLAD_TO_MOVE',
        source: 'own_belief',
        detail: `our own evaluation lists ${a.playerId} as avoid`,
      });
    if (
      fact !== undefined &&
      window === 'rebuild' &&
      ageOn(fact.birthDate, view.asOf) >= AGING_FROM
    )
      favorable.push({
        code: 'MOVES_AGING_PLAYER',
        source: 'own_plan',
        detail: `a rebuilding plan; ${a.playerId} is ${ageOn(fact.birthDate, view.asOf)}`,
      });
    if (window === 'contend' && fact?.rosterStatus === 'active') {
      const replaced = incoming.some(
        (i) =>
          i.kind === 'player_rights' &&
          playerFact(view, i.playerId)?.primaryRole === fact.primaryRole &&
          playerFact(view, i.playerId)?.rosterStatus === 'active',
      );
      if (!replaced)
        unfavorable.push({
          code: 'WEAKENS_CURRENT_ROSTER',
          source: 'own_plan',
          detail: `a contending plan; ${a.playerId} is an active ${fact.primaryRole} with no active replacement coming back`,
        });
    }
  }

  // Players arriving.
  for (const a of incoming) {
    if (a.kind !== 'player_rights') continue;
    const tier = ownTierFor(view, a.playerId);
    const fact = playerFact(view, a.playerId);
    if (tier === null) {
      uncertainties.push(`NO_EVALUATION:${a.playerId}`);
      continue;
    }
    if (tier === 'avoid')
      unfavorable.push({
        code: 'UNWANTED_PLAYER',
        source: 'own_belief',
        detail: `our own evaluation lists ${a.playerId} as avoid`,
      });
    else if (tier === 'priority' || tier === 'target')
      favorable.push({
        code: 'WANTED_PLAYER',
        source: 'own_belief',
        detail: `our own evaluation lists ${a.playerId} as ${tier}`,
      });
    if (
      fact !== undefined &&
      window === 'rebuild' &&
      ageOn(fact.birthDate, view.asOf) >= AGING_FROM
    )
      unfavorable.push({
        code: 'AGING_ACQUISITION',
        source: 'own_plan',
        detail: `a rebuilding plan; ${a.playerId} is ${ageOn(fact.birthDate, view.asOf)}`,
      });
  }

  // Draft capital: premium picks matter to a rebuilding plan, not to a contending one.
  if (window === 'rebuild') {
    const premiumIn = incoming.filter(
      (a) => a.kind === 'draft_pick' && isPremium(pickFact(view, a.pickId)),
    ).length;
    const premiumOut = outgoing.filter(
      (a) => a.kind === 'draft_pick' && isPremium(pickFact(view, a.pickId)),
    ).length;
    if (premiumIn > premiumOut)
      favorable.push({
        code: 'ADDS_PREMIUM_CAPITAL',
        source: 'own_picks',
        detail: `a rebuilding plan; ${premiumIn} premium picks in, ${premiumOut} out`,
      });
    else if (premiumOut > premiumIn)
      unfavorable.push({
        code: 'SPENDS_PREMIUM_CAPITAL',
        source: 'own_picks',
        detail: `a rebuilding plan; ${premiumOut} premium picks out, ${premiumIn} in`,
      });
  }
  if (window === null)
    uncertainties.push(
      'NO_COMPETITIVE_WINDOW: no strategy plan states a posture',
    );

  reasons.push(...unfavorable, ...favorable);
  const blocking = uncertainties.filter((u) => u.startsWith('NO_EVALUATION:'));
  let disposition: TradeDisposition;
  if (unfavorable.length === 0 && favorable.length > 0) disposition = 'accept';
  else if (unfavorable.length > 0 && favorable.length > 0)
    disposition = 'counter';
  else if (unfavorable.length > 0) disposition = 'reject';
  else if (blocking.length > 0) disposition = 'defer';
  else {
    disposition = 'reject';
    reasons.push({
      code: 'NOTHING_FOR_PLAN',
      source: 'own_plan',
      detail: 'the package advances none of our own stated aims',
    });
  }
  return { disposition, reasons, uncertainties };
};

/**
 * What a club chooses to communicate when asked about one asset. `shop`: the asker offers
 * the asset to this club. `seek`: the asker wants an asset this club holds. `none` carries no
 * information about hidden interest.
 */
export const inquiryBandFor = (
  view: AcquisitionDecisionView,
  asset: AcquisitionAssetRef,
  direction: InquiryDirection,
): TradeInterestBand => {
  const window = competitiveWindowOf(view);
  if (asset.kind === 'player_rights') {
    const tier = ownTierFor(view, asset.playerId);
    if (direction === 'shop') {
      if (tier === 'priority') return 'priority';
      if (tier === 'target') return 'interested';
      if (tier === 'depth') return 'open';
      return 'none';
    }
    // Seek: the club speaks only about its own player.
    if (tier === 'priority' || tier === 'target') return 'none';
    if (tier === 'avoid') return 'interested';
    if (tier === 'depth') return 'open';
    return 'none';
  }
  const pick = pickFact(view, asset.pickId);
  if (direction === 'shop')
    return window === 'rebuild' && isPremium(pick)
      ? 'interested'
      : window === null
        ? 'none'
        : 'open';
  return window === 'contend'
    ? 'open'
    : window === 'rebuild' && !isPremium(pick)
      ? 'open'
      : 'none';
};

/**
 * A fingerprint of the state a response depends on: the responder's own view and the
 * package or asset asked about, without the date, the communications log or anything about
 * other clubs. An unchanged fingerprint means an unchanged question and returns the recorded
 * answer instead of asking again.
 */
export const responseBasisHash = (
  view: AcquisitionDecisionView,
  subject: TradePackageV1 | AcquisitionAssetRef,
): string => {
  const { asOf: _asOf, market: _market, ...rest } = view;
  void _asOf;
  void _market;
  const subjectKey =
    'kind' in subject ? assetKey(subject) : hashCanonical(subject as never);
  return hashCanonical({
    view: { ...rest, knowledge: { ...rest.knowledge, asOf: '' } } as never,
    subject: subjectKey,
    window: competitiveWindowOf(view),
  } as never);
};
