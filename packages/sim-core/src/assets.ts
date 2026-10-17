import type { CanonicalValue } from './audit';
import { dayBefore, mintRecordIds } from './commandSupport';
import { tradeImpact } from './contractMath';
import type { ContractAgreement, ContractTermination } from './contracts';
import type { TransactionRulesV1 } from './economy';
import type { EntityId, RecordId } from './ids';
import {
  activeRightsFor,
  currentRosterMembership,
  seasonOfDate,
  type PlayerRightsRecord,
  type RosterMembership,
} from './roster';
import type { FootballWorld } from './world';

/**
 * Whole-asset transfers only: a player's rights (with the contract and roster membership
 * that go with them) or one draft pick. There is no cash, no partial rights and no
 * conditional-pick settlement here. Assets are named by stable ids, never by a value.
 */
export type AcquisitionAssetRef =
  | {
      readonly kind: 'player_rights';
      readonly playerId: EntityId;
      /** The specific right being transferred, so a stale reference is detectable. */
      readonly rightsId: RecordId;
    }
  | { readonly kind: 'draft_pick'; readonly pickId: RecordId };

export type TradePackageV1 = {
  readonly organizationAId: EntityId;
  readonly organizationBId: EntityId;
  readonly assetsFromA: readonly AcquisitionAssetRef[];
  readonly assetsFromB: readonly AcquisitionAssetRef[];
  readonly validity: { readonly expiresAt: string | null };
  readonly contingencies: Readonly<Record<string, CanonicalValue>>;
};

export const assetKey = (a: AcquisitionAssetRef): string =>
  a.kind === 'player_rights'
    ? `player_rights:${a.playerId}:${a.rightsId}`
    : `draft_pick:${a.pickId}`;

const rightOf = (
  world: FootballWorld,
  a: Extract<AcquisitionAssetRef, { kind: 'player_rights' }>,
  date: string,
): PlayerRightsRecord | undefined =>
  activeRightsFor(world.roster, a.playerId, date).find(
    (r) => r.id === a.rightsId,
  );

/** The organization that owns the asset on `date`, or `undefined` when it is not owned. */
export const assetOwner = (
  world: FootballWorld,
  asset: AcquisitionAssetRef,
  date: string,
): EntityId | undefined => {
  if (asset.kind === 'player_rights')
    return rightOf(world, asset, date)?.holderOrganizationId;
  return world.draft.picks.find((p) => p.id === asset.pickId)
    ?.ownerOrganizationId;
};

export const TRADE_PROBLEM_CODES = [
  'SELF_TRADE',
  'EMPTY_PACKAGE',
  'DUPLICATE_ASSET',
  'UNKNOWN_ASSET',
  'WRONG_OWNER',
  'USED_PICK',
  'PICK_BEYOND_HORIZON',
  'PLAYER_ON_WAIVERS',
] as const;
export type TradeProblemCode = (typeof TRADE_PROBLEM_CODES)[number];
export type TradeProblem = {
  readonly code: TradeProblemCode;
  readonly message: string;
  readonly asset: string | null;
};

/**
 * Structural and ownership legality of a package on `date`. A pick beyond the ruleset's
 * future-pick horizon is illegal, not worth zero. Cap and roster-room legality is separate
 * (`tradeCapacityProblems`) because it depends on the post-trade state.
 */
export const tradePackageProblems = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  pkg: TradePackageV1,
  date: string,
): readonly TradeProblem[] => {
  const out: TradeProblem[] = [];
  const add = (code: TradeProblemCode, message: string, asset?: string) =>
    out.push({ code, message, asset: asset ?? null });
  if (pkg.organizationAId === pkg.organizationBId)
    add('SELF_TRADE', 'an organization cannot trade with itself');
  if (pkg.assetsFromA.length + pkg.assetsFromB.length === 0)
    add('EMPTY_PACKAGE', 'a trade must move at least one asset');
  const horizon = seasonOfDate(date) + tx.market.futurePickTradeHorizonSeasons;
  const seen = new Set<string>();
  const check = (
    assets: readonly AcquisitionAssetRef[],
    from: EntityId,
  ): void => {
    for (const a of assets) {
      const key = assetKey(a);
      const identity =
        a.kind === 'player_rights' ? `rights:${a.rightsId}` : key;
      if (seen.has(identity)) {
        add('DUPLICATE_ASSET', `${key} appears more than once`, key);
        continue;
      }
      seen.add(identity);
      if (a.kind === 'draft_pick') {
        const pick = world.draft.picks.find((p) => p.id === a.pickId);
        if (pick === undefined) {
          add('UNKNOWN_ASSET', `${key} is not a draft pick`, key);
          continue;
        }
        if (pick.status === 'used')
          add('USED_PICK', `${key} has already been used`, key);
        if (pick.season > horizon)
          add(
            'PICK_BEYOND_HORIZON',
            `${key} is for ${pick.season}; only picks through ${horizon} may be traded`,
            key,
          );
        if (pick.ownerOrganizationId !== from)
          add('WRONG_OWNER', `${key} is not owned by ${from}`, key);
        continue;
      }
      const right = world.roster.rights.find((r) => r.id === a.rightsId);
      if (right === undefined || right.playerId !== a.playerId) {
        add('UNKNOWN_ASSET', `${key} is not a rights record`, key);
        continue;
      }
      if (assetOwner(world, a, date) !== from)
        add('WRONG_OWNER', `${key} is not currently held by ${from}`, key);
      if (
        world.roster.waivers.some(
          (w) => w.playerId === a.playerId && w.status === 'open',
        )
      )
        add('PLAYER_ON_WAIVERS', `${a.playerId} is on waivers`, key);
    }
  };
  check(pkg.assetsFromA, pkg.organizationAId);
  check(pkg.assetsFromB, pkg.organizationBId);
  return out;
};

/**
 * What the receiving club owes. When the signing bonus stays with the original club, the
 * successor carries only the seasons still to be played and no bonus, so the receiver is
 * charged exactly base salary plus roster bonus; otherwise it takes the terms whole.
 */
const successorTerms = (
  tx: TransactionRulesV1,
  terms: ContractAgreement['terms'],
  tradeSeason: number,
): ContractAgreement['terms'] => {
  if (!tx.contracts.signingBonusStaysWithOriginalClubOnTrade) return terms;
  const years = terms.years.filter((y) => y.season >= tradeSeason);
  return {
    startSeason: years[0]?.season ?? terms.startSeason,
    years,
    signingBonus: 0 as ContractAgreement['terms']['signingBonus'],
  };
};

// --- post-trade state ---------------------------------------------------------

const byId = <T extends { readonly id: string }>(a: T, b: T): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * The world after the package moves, as a pure function. It assumes the package is legal
 * (`tradePackageProblems` is empty) and does not check cap or roster room. Contract-bearing
 * rights move with a successor agreement (same terms); under the ruleset's trade-split flag
 * the sender keeps the signing-bonus remainder as dead cap in a termination record. The
 * player keeps the roster status they had. Conservation: every asset ends with exactly one
 * owner, and no asset is created or destroyed.
 */
export const applyTradePackage = (
  world: FootballWorld,
  tx: TransactionRulesV1,
  pkg: TradePackageV1,
  date: string,
): FootballWorld => {
  const moves: { asset: AcquisitionAssetRef; from: EntityId; to: EntityId }[] =
    [
      ...pkg.assetsFromA.map((asset) => ({
        asset,
        from: pkg.organizationAId,
        to: pkg.organizationBId,
      })),
      ...pkg.assetsFromB.map((asset) => ({
        asset,
        from: pkg.organizationBId,
        to: pkg.organizationAId,
      })),
    ];
  const tradeSeason = seasonOfDate(date);
  const rightMoves = moves.filter(
    (
      m,
    ): m is typeof m & {
      asset: Extract<AcquisitionAssetRef, { kind: 'player_rights' }>;
    } => m.asset.kind === 'player_rights',
  );
  const pickIds = new Map(
    moves
      .filter((m) => m.asset.kind === 'draft_pick')
      .map((m) => [(m.asset as { pickId: RecordId }).pickId, m.to]),
  );

  let rights = [...world.roster.rights];
  let memberships = [...world.roster.memberships];
  let agreements = [...world.contracts.agreements];
  const terminations: ContractTermination[] = [...world.contracts.terminations];

  // Each moving right needs one new right; a contract needs an agreement, a membership
  // (when rostered) and possibly a dead-cap termination.
  const perMove = rightMoves.map((m) => {
    const right = rightOf(world, m.asset, date)!;
    const agreement =
      right.kind === 'contract'
        ? agreements.find(
            (a) => a.id === right.sourceRecordId && a.status === 'active',
          )
        : undefined;
    const membership = currentRosterMembership(
      world.roster,
      m.asset.playerId,
      date,
    );
    return { m, right, agreement, membership };
  });
  const needed = perMove.reduce(
    (n, x) =>
      n +
      1 +
      (x.agreement !== undefined ? 1 : 0) +
      (x.membership !== undefined ? 1 : 0) +
      (x.agreement !== undefined &&
      tradeImpact(tx.contracts, x.agreement.terms, tradeSeason)
        .senderDeadCapBySeason.length > 0
        ? 1
        : 0),
    0,
  );
  const minted = mintRecordIds(world, needed);
  let cursor = 0;
  const next = (): RecordId => minted.ids[cursor++]!;

  for (const { m, right, agreement, membership } of perMove) {
    const newAgreementId = agreement !== undefined ? next() : undefined;
    const newRightId = next();
    rights = rights.map((r) =>
      r.id === right.id ? { ...r, effectiveUntil: dayBefore(date) } : r,
    );
    rights.push({
      id: newRightId,
      playerId: right.playerId,
      holderOrganizationId: m.to,
      kind: right.kind,
      sourceRecordId: newAgreementId ?? right.sourceRecordId,
      effectiveFrom: date,
      effectiveUntil: null,
    });
    if (agreement !== undefined && newAgreementId !== undefined) {
      const successor: ContractAgreement = {
        id: newAgreementId,
        playerId: agreement.playerId,
        organizationId: m.to,
        terms: successorTerms(tx, agreement.terms, tradeSeason),
        signedAt: agreement.signedAt,
        sourceOfferId: null,
        sourceProposalId: null,
        supersedesAgreementId: agreement.id,
        status: 'active',
      };
      agreements = agreements.map((a) =>
        a.id === agreement.id ? { ...a, status: 'superseded' as const } : a,
      );
      agreements.push(successor);
      const impact = tradeImpact(tx.contracts, agreement.terms, tradeSeason);
      if (impact.senderDeadCapBySeason.length > 0)
        terminations.push({
          id: next(),
          agreementId: agreement.id,
          organizationId: m.from,
          playerId: agreement.playerId,
          terminatedAt: date,
          reason: 'trade_retained_bonus',
          deadCapBySeason: impact.senderDeadCapBySeason,
          guaranteedCashDue: 0 as ContractTermination['guaranteedCashDue'],
        });
    }
    if (membership !== undefined) {
      const moved: RosterMembership = {
        id: next(),
        playerId: membership.playerId,
        organizationId: m.to,
        status: membership.status,
        effectiveFrom: date,
        effectiveUntil: null,
        sourceRecordId: newAgreementId ?? newRightId,
      };
      memberships = [
        ...memberships.map((x) =>
          x.id === membership.id
            ? { ...x, effectiveUntil: dayBefore(date) }
            : x,
        ),
        moved,
      ];
    }
  }

  return {
    ...world,
    roster: {
      ...world.roster,
      rights: rights.sort(byId),
      memberships: memberships.sort(byId),
    },
    contracts: {
      ...world.contracts,
      agreements: agreements.sort(byId),
      terminations: terminations.sort(byId),
    },
    draft: {
      ...world.draft,
      picks: world.draft.picks.map((p) =>
        pickIds.has(p.id)
          ? { ...p, ownerOrganizationId: pickIds.get(p.id)! }
          : p,
      ),
    },
    nextIds: { ...world.nextIds, record: minted.next },
  };
};
