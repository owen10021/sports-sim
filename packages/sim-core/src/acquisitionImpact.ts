import {
  assetKey,
  type AcquisitionAssetRef,
  type TradePackageV1,
} from './assets';
import { capPosition, tradeImpact, agreementCapCharge } from './contractMath';
import type { SeasonAmount } from './contracts';
import { UnknownTransactionSeasonError } from './economy';
import type { TransactionRulesV1 } from './economy';
import type { EntityId, RecordId } from './ids';
import { reservedCap, reservedSlots } from './market';
import {
  currentRosterMembership,
  rosterCapacity,
  seasonOfDate,
  type RosterStatus,
} from './roster';
import type { FootballWorld } from './world';

/** A signed change in cap charge; unlike `SeasonAmount` it can be negative. */
export type SeasonDelta = { readonly season: number; readonly delta: number };

/**
 * What a transaction would change for one organization, derived from the current world and
 * the package alone. Non-authoritative: nothing here is stored or committed. It states
 * facts (dollars, slots, assets) and carries no capability, preference or value score.
 */
export type AcquisitionImpactPreview = {
  readonly organizationId: EntityId;
  readonly capDeltaBySeason: readonly SeasonDelta[];
  readonly activeSlotsBefore: number;
  readonly activeSlotsAfter: number;
  readonly reserveSlotsBefore: number;
  readonly reserveSlotsAfter: number;
  readonly practiceSquadSlotsBefore: number;
  readonly practiceSquadSlotsAfter: number;
  readonly incomingAssets: readonly string[];
  readonly outgoingAssets: readonly string[];
  readonly draftPickIdsGained: readonly RecordId[];
  readonly draftPickIdsLost: readonly RecordId[];
  /** Active reservations of the organization that compete for the same cap and slots. */
  readonly reservationIdsAffected: readonly RecordId[];
};

/** Per-asset consequences for the organization on one side of the package. */
const incomingCharges = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  asset: AcquisitionAssetRef,
  date: string,
  receiving: boolean,
): { charges: SeasonAmount[]; status: RosterStatus | null } => {
  if (asset.kind !== 'player_rights') return { charges: [], status: null };
  const right = world.roster.rights.find((r) => r.id === asset.rightsId);
  const agreement =
    right?.kind === 'contract'
      ? world.contracts.agreements.find(
          (a) => a.id === right.sourceRecordId && a.status === 'active',
        )
      : undefined;
  const membership = currentRosterMembership(
    world.roster,
    asset.playerId,
    date,
  );
  const status = membership?.status ?? null;
  if (agreement === undefined) return { charges: [], status };
  const season = seasonOfDate(date);
  const impact = tradeImpact(tx.contracts, agreement.terms, season);
  if (receiving) return { charges: [...impact.receiverCapBySeason], status };
  // The sender sheds the whole charge and keeps any retained bonus as dead cap.
  const shed: SeasonAmount[] = agreement.terms.years
    .map((y) => y.season)
    .filter((s) => s >= season)
    .map((s) => ({
      season: s,
      amount: agreementCapCharge(tx.contracts, agreement, s),
    }));
  const kept = impact.senderDeadCapBySeason;
  const seasons = [
    ...new Set([...shed.map((x) => x.season), ...kept.map((x) => x.season)]),
  ];
  return {
    charges: seasons.map((s) => ({
      season: s,
      amount: ((kept.find((k) => k.season === s)?.amount ?? 0) -
        (shed.find((x) => x.season === s)?.amount ?? 0)) as never,
    })),
    status,
  };
};

/**
 * The one shared calculation of what a package does to an organization's cap, roster and
 * assets. Trade, free-agency, draft legality and later read models all use it, so they
 * cannot disagree. `date` fixes the current season; contract seasons before it are history.
 */
export const previewAcquisitionImpact = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  pkg: TradePackageV1,
  date: string,
  organizationId: EntityId,
): AcquisitionImpactPreview => {
  const gaining = organizationId === pkg.organizationBId;
  const incoming = gaining ? pkg.assetsFromA : pkg.assetsFromB;
  const outgoing = gaining ? pkg.assetsFromB : pkg.assetsFromA;
  const delta = new Map<number, number>();
  const bump = (season: number, by: number) =>
    delta.set(season, (delta.get(season) ?? 0) + by);
  const slots = { active: 0, reserve: 0, practice_squad: 0 };
  for (const a of incoming) {
    const x = incomingCharges(world, tx, a, date, true);
    for (const c of x.charges) bump(c.season, c.amount);
    if (x.status !== null) slots[x.status] += 1;
  }
  for (const a of outgoing) {
    const x = incomingCharges(world, tx, a, date, false);
    for (const c of x.charges) bump(c.season, c.amount);
    if (x.status !== null) slots[x.status] -= 1;
  }
  const before = rosterCapacity(world.roster, tx, organizationId, date);
  const pickIds = (assets: readonly AcquisitionAssetRef[]) =>
    assets
      .filter(
        (a): a is Extract<AcquisitionAssetRef, { kind: 'draft_pick' }> =>
          a.kind === 'draft_pick',
      )
      .map((a) => a.pickId)
      .sort();
  return {
    organizationId,
    capDeltaBySeason: [...delta.entries()]
      .filter(([, d]) => d !== 0)
      .sort(([a], [b]) => a - b)
      .map(([season, d]) => ({ season, delta: d })),
    activeSlotsBefore: before.active.count,
    activeSlotsAfter: before.active.count + slots.active,
    reserveSlotsBefore: before.reserve.count,
    reserveSlotsAfter: before.reserve.count + slots.reserve,
    practiceSquadSlotsBefore: before.practice_squad.count,
    practiceSquadSlotsAfter: before.practice_squad.count + slots.practice_squad,
    incomingAssets: incoming.map(assetKey).sort(),
    outgoingAssets: outgoing.map(assetKey).sort(),
    draftPickIdsGained: pickIds(incoming),
    draftPickIdsLost: pickIds(outgoing),
    reservationIdsAffected: world.market.reservations
      .filter(
        (r) => r.organizationId === organizationId && r.status === 'active',
      )
      .map((r) => r.id)
      .sort(),
  };
};

export type CapacityProblem = {
  readonly organizationId: EntityId;
  readonly message: string;
};

/**
 * Cap and roster-room legality of a package for both organizations, from the shared
 * preview. Room already held by active reservations counts against the organization.
 */
export const tradeCapacityProblems = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  pkg: TradePackageV1,
  date: string,
): readonly CapacityProblem[] => {
  const out: CapacityProblem[] = [];
  for (const org of [pkg.organizationAId, pkg.organizationBId]) {
    const p = previewAcquisitionImpact(world, tx, pkg, date, org);
    try {
      for (const d of p.capDeltaBySeason) {
        if (d.delta <= 0) continue;
        const pos = capPosition(tx, world.contracts, org, d.season);
        const held = reservedCap(world.market, org, d.season);
        if (pos.committed + held + d.delta > pos.cap)
          out.push({
            organizationId: org,
            message: `cap: season ${d.season} would exceed ${pos.cap} (committed ${pos.committed}, reserved ${held}, incoming ${d.delta})`,
          });
      }
      const cap = rosterCapacity(world.roster, tx, org, date);
      const after = {
        active: p.activeSlotsAfter,
        reserve: p.reserveSlotsAfter,
        practice_squad: p.practiceSquadSlotsAfter,
      };
      for (const s of ['active', 'reserve', 'practice_squad'] as const) {
        const grew = after[s] > cap[s].count;
        const held = grew ? reservedSlots(world.market, org, s) : 0;
        if (grew && after[s] + held > cap[s].limit)
          out.push({
            organizationId: org,
            message: `roster capacity: ${s} would hold ${after[s]} plus ${held} reserved of ${cap[s].limit}`,
          });
      }
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError)
        out.push({ organizationId: org, message: e.message });
      else throw e;
    }
  }
  return out;
};
