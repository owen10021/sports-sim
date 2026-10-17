import { assetKey } from './assets';
import { capPosition, contractTermsProblems } from './contractMath';
import {
  UnknownTransactionSeasonError,
  type TransactionRulesV1,
} from './economy';
import type { EntityId } from './ids';
import { reservedCap, reservedSlots } from './market';
import {
  ROSTER_STATUSES,
  activeRightsFor,
  currentRosterMembership,
  rosterCapacity,
  rosterInvariantFindings,
} from './roster';
import type { FootballWorld } from './world';

/**
 * Acquisition-ecology audit (Package C, Task 14). Read-only QA over authoritative state.
 * Findings describe incoherence; nothing here repairs, rewrites or blocks anything, and the
 * world is never mutated. The result is deterministic and sorted, and depends only on
 * `(world, tx)`: a clean world returns `[]`.
 */

export const ACQUISITION_FINDING_CODES = [
  // roster conservation (delegates to the roster audit)
  'DUPLICATE_ACTIVE_RIGHTS',
  'DUPLICATE_ACTIVE_MEMBERSHIP',
  'MEMBERSHIP_WITHOUT_RIGHTS',
  'ACTIVE_OVER_LIMIT',
  'RESERVE_OVER_LIMIT',
  'PRACTICE_SQUAD_OVER_LIMIT',
  // rights / contracts
  'CONTRACT_WITHOUT_RIGHT',
  'CONTRACT_RIGHT_WITHOUT_CONTRACT',
  'ILLEGAL_ACTIVE_CONTRACT',
  'DUPLICATE_ACTIVE_CONTRACT',
  // picks and the draft
  'DUPLICATE_PICK',
  'PICK_USED_WITHOUT_SELECTION',
  'SELECTION_PICK_NOT_USED',
  'DUPLICATE_PICK_SELECTION',
  'DUPLICATE_PLAYER_SELECTION',
  'SELECTION_OWNER_MISMATCH',
  'SELECTION_WITHOUT_RIGHT',
  // cap and reservations
  'CAP_EXCEEDED',
  'RESERVATION_CAP_OVERCOMMIT',
  'RESERVATION_SLOT_OVERCOMMIT',
  'ORPHAN_RESERVATION',
  'LIVE_OFFER_WITHOUT_RESERVATION',
  'COMMITTED_OFFER_STILL_RESERVED',
  'COMMITTED_OFFER_WITHOUT_AGREEMENT',
  // trades
  'USED_PICK_IN_LIVE_TRADE',
  // waivers
  'WAIVER_CONTRACT_RIGHT_MISMATCH',
  'WAIVER_PLAYER_STILL_ROSTERED',
  // knowledge and decisions
  'INACCESSIBLE_BOARD_REFERENCE',
  'INACCESSIBLE_SCOUTING_REFERENCE',
  'MISSING_RECEIPT',
  'RECEIPT_WITHOUT_OUTCOME',
] as const;
export type AcquisitionFindingCode = (typeof ACQUISITION_FINDING_CODES)[number];

export type AcquisitionSeverity = 'error' | 'warning';

export type AcquisitionFinding = {
  readonly code: AcquisitionFindingCode;
  readonly severity: AcquisitionSeverity;
  readonly organizationId?: EntityId;
  readonly subjectIds: readonly string[];
  readonly detail: string;
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const LIVE_OFFER: ReadonlySet<string> = new Set([
  'communicated',
  'countered',
  'accepted_pending_commit',
]);

const latestOffers = <
  T extends { readonly id: string; readonly revision: number },
>(
  offers: readonly T[],
): readonly T[] => {
  const latest = new Map<string, T>();
  for (const o of offers) {
    const have = latest.get(o.id);
    if (have === undefined || o.revision > have.revision) latest.set(o.id, o);
  }
  return [...latest.values()];
};

export const auditAcquisitionWorld = (
  world: FootballWorld,
  tx: TransactionRulesV1,
): readonly AcquisitionFinding[] => {
  const out: AcquisitionFinding[] = [];
  const today = world.simDate;
  const add = (
    code: AcquisitionFindingCode,
    detail: string,
    subjectIds: readonly string[],
    organizationId?: EntityId,
    severity: AcquisitionSeverity = 'error',
  ): void => {
    out.push({
      code,
      severity,
      ...(organizationId === undefined ? {} : { organizationId }),
      subjectIds: [...subjectIds].sort(byText),
      detail,
    });
  };

  // --- roster conservation -------------------------------------------------------
  for (const f of rosterInvariantFindings(world.roster, tx, today))
    add(
      f.code,
      f.detail,
      f.playerId === null ? [] : [f.playerId],
      f.organizationId ?? undefined,
    );

  // --- contracts <-> rights ------------------------------------------------------
  const activeAgreements = world.contracts.agreements.filter(
    (a) => a.status === 'active',
  );
  const perPlayer = new Map<string, number>();
  for (const a of activeAgreements) {
    perPlayer.set(a.playerId, (perPlayer.get(a.playerId) ?? 0) + 1);
    const rights = activeRightsFor(world.roster, a.playerId, today);
    if (
      !rights.some(
        (r) =>
          r.kind === 'contract' && r.holderOrganizationId === a.organizationId,
      )
    )
      add(
        'CONTRACT_WITHOUT_RIGHT',
        `${a.id} is active for ${a.playerId} but ${a.organizationId} holds no contract right`,
        [a.id, a.playerId],
        a.organizationId,
      );
    const problems = contractTermsProblems(tx, a.terms);
    if (problems.length > 0)
      add(
        'ILLEGAL_ACTIVE_CONTRACT',
        `${a.id} breaks the ruleset: ${problems[0]!}`,
        [a.id, a.playerId],
        a.organizationId,
      );
  }
  for (const [playerId, n] of perPlayer)
    if (n > 1)
      add(
        'DUPLICATE_ACTIVE_CONTRACT',
        `${playerId} has ${n} active contract agreements`,
        [playerId],
      );
  for (const r of world.roster.rights) {
    if (r.kind !== 'contract') continue;
    if (
      !activeRightsFor(world.roster, r.playerId, today).some(
        (x) => x.id === r.id,
      )
    )
      continue;
    if (
      !activeAgreements.some(
        (a) =>
          a.playerId === r.playerId &&
          a.organizationId === r.holderOrganizationId,
      )
    )
      add(
        'CONTRACT_RIGHT_WITHOUT_CONTRACT',
        `${r.id} is an active contract right with no active agreement`,
        [r.id, r.playerId],
        r.holderOrganizationId,
      );
  }

  // --- picks and the draft -----------------------------------------------------------
  const pickIds = new Map<string, number>();
  for (const p of world.draft.picks)
    pickIds.set(p.id, (pickIds.get(p.id) ?? 0) + 1);
  for (const [id, n] of pickIds)
    if (n > 1) add('DUPLICATE_PICK', `${id} appears ${n} times`, [id]);
  const selectionsByPick = new Map<string, number>();
  const selectionsByPlayer = new Map<string, number>();
  for (const s of world.draft.selections) {
    selectionsByPick.set(s.pickId, (selectionsByPick.get(s.pickId) ?? 0) + 1);
    selectionsByPlayer.set(
      s.playerId,
      (selectionsByPlayer.get(s.playerId) ?? 0) + 1,
    );
    const pick = world.draft.picks.find((p) => p.id === s.pickId);
    if (pick === undefined || pick.status !== 'used')
      add(
        'SELECTION_PICK_NOT_USED',
        `${s.id} used ${s.pickId}, which is not marked used`,
        [s.id, s.pickId],
        s.organizationId,
      );
    else if (pick.ownerOrganizationId !== s.organizationId)
      add(
        'SELECTION_OWNER_MISMATCH',
        `${s.id} was made by ${s.organizationId} but ${s.pickId} is owned by ${pick.ownerOrganizationId}`,
        [s.id, s.pickId],
        s.organizationId,
      );
    if (!world.roster.rights.some((r) => r.sourceRecordId === s.id))
      add(
        'SELECTION_WITHOUT_RIGHT',
        `${s.id} granted no draft right to ${s.playerId}`,
        [s.id, s.playerId],
        s.organizationId,
      );
  }
  for (const [id, n] of selectionsByPick)
    if (n > 1)
      add('DUPLICATE_PICK_SELECTION', `${id} was used ${n} times`, [id]);
  for (const [id, n] of selectionsByPlayer)
    if (n > 1)
      add('DUPLICATE_PLAYER_SELECTION', `${id} was drafted ${n} times`, [id]);
  if (world.draft.sessions.length > 0)
    for (const p of world.draft.picks)
      if (
        p.status === 'used' &&
        (selectionsByPick.get(p.id) ?? 0) === 0 &&
        world.draft.sessions.some((s) => s.orderedPickIds.includes(p.id))
      )
        add(
          'PICK_USED_WITHOUT_SELECTION',
          `${p.id} is marked used with no selection`,
          [p.id],
          p.ownerOrganizationId,
        );

  // --- cap and reservations -----------------------------------------------------------
  const orgs = new Set<EntityId>([
    ...world.contracts.agreements.map((a) => a.organizationId),
    ...world.market.reservations.map((r) => r.organizationId),
  ]);
  for (const org of [...orgs].sort(byText)) {
    const seasons = new Set<number>();
    for (const a of activeAgreements)
      if (a.organizationId === org)
        for (const y of a.terms.years) seasons.add(y.season);
    for (const r of world.market.reservations)
      if (r.organizationId === org && r.status === 'active')
        for (const c of r.capBySeason) seasons.add(c.season);
    for (const season of [...seasons].sort((a, b) => a - b)) {
      try {
        const position = capPosition(tx, world.contracts, org, season);
        if (position.committed > position.cap)
          add(
            'CAP_EXCEEDED',
            `${org} has ${position.committed} committed in ${season}, cap ${position.cap}`,
            [org, String(season)],
            org,
          );
        const held = reservedCap(world.market, org, season);
        if (position.committed + held > position.cap)
          add(
            'RESERVATION_CAP_OVERCOMMIT',
            `${org} has ${position.committed} committed and ${held} reserved in ${season}, cap ${position.cap}`,
            [org, String(season)],
            org,
          );
      } catch (e) {
        if (!(e instanceof UnknownTransactionSeasonError)) throw e;
      }
    }
    const capacity = rosterCapacity(world.roster, tx, org, today);
    for (const status of ROSTER_STATUSES) {
      const held = reservedSlots(world.market, org, status);
      if (capacity[status].count + held > capacity[status].limit)
        add(
          'RESERVATION_SLOT_OVERCOMMIT',
          `${org} has ${capacity[status].count} ${status} players and ${held} reserved, limit ${capacity[status].limit}`,
          [org, status],
          org,
        );
    }
  }

  const offers = latestOffers(world.market.contractOffers);
  const reservationOf = (id: string | null) =>
    id === null
      ? undefined
      : world.market.reservations.find((r) => r.id === id);
  for (const o of offers) {
    const res = reservationOf(o.reservationId);
    if (
      LIVE_OFFER.has(o.status) &&
      (res === undefined || res.status !== 'active')
    )
      add(
        'LIVE_OFFER_WITHOUT_RESERVATION',
        `${o.id} is ${o.status} but its reservation is not active`,
        [o.id, ...(o.reservationId === null ? [] : [o.reservationId])],
        o.organizationId,
      );
    if (o.status === 'committed') {
      if (res !== undefined && res.status === 'active')
        add(
          'COMMITTED_OFFER_STILL_RESERVED',
          `${o.id} is committed but still holds an active reservation`,
          [o.id, ...(o.reservationId === null ? [] : [o.reservationId])],
          o.organizationId,
        );
      if (!world.contracts.agreements.some((a) => a.sourceOfferId === o.id))
        add(
          'COMMITTED_OFFER_WITHOUT_AGREEMENT',
          `${o.id} is committed with no agreement`,
          [o.id],
          o.organizationId,
        );
    }
  }
  for (const r of world.market.reservations) {
    if (r.status !== 'active') continue;
    if (r.sourceKind === 'contract_offer') {
      const o = offers.find((x) => x.id === r.sourceRecordId);
      if (o === undefined || !LIVE_OFFER.has(o.status))
        add(
          'ORPHAN_RESERVATION',
          `${r.id} is active but its offer is not live`,
          [r.id, r.sourceRecordId],
          r.organizationId,
          'warning',
        );
    } else if (r.sourceKind === 'waiver_claim') {
      const c = world.roster.waiverClaims.find(
        (x) => x.id === r.sourceRecordId,
      );
      if (c === undefined || !c.active)
        add(
          'ORPHAN_RESERVATION',
          `${r.id} is active but its waiver claim is not`,
          [r.id, r.sourceRecordId],
          r.organizationId,
          'warning',
        );
    }
  }

  // --- trades ------------------------------------------------------------------------------
  for (const t of world.market.tradeOffers) {
    if (t.status !== 'open' && t.status !== 'accepted') continue;
    for (const a of [...t.package.assetsFromA, ...t.package.assetsFromB]) {
      if (a.kind !== 'draft_pick') continue;
      const pick = world.draft.picks.find((p) => p.id === a.pickId);
      if (pick?.status === 'used')
        add(
          'USED_PICK_IN_LIVE_TRADE',
          `${t.id} still offers ${assetKey(a)}, which has been used`,
          [t.id, a.pickId],
          t.proposerOrganizationId,
        );
    }
  }

  // --- waivers -------------------------------------------------------------------------------
  for (const w of world.roster.waivers) {
    if (w.status !== 'open') continue;
    const agreement = world.contracts.agreements.find(
      (a) => a.id === w.contractAgreementId,
    );
    const holds = activeRightsFor(world.roster, w.playerId, today).some(
      (r) =>
        r.kind === 'contract' &&
        r.holderOrganizationId === w.waivingOrganizationId,
    );
    if (
      agreement === undefined ||
      agreement.status !== 'active' ||
      agreement.playerId !== w.playerId ||
      agreement.organizationId !== w.waivingOrganizationId ||
      !holds
    )
      add(
        'WAIVER_CONTRACT_RIGHT_MISMATCH',
        `${w.id}: the waiving club's contract and right for ${w.playerId} do not line up`,
        [w.id, w.playerId],
        w.waivingOrganizationId,
      );
    if (currentRosterMembership(world.roster, w.playerId, today) !== undefined)
      add(
        'WAIVER_PLAYER_STILL_ROSTERED',
        `${w.playerId} is on a roster while waiver ${w.id} is open`,
        [w.id, w.playerId],
        w.waivingOrganizationId,
      );
  }

  // --- knowledge references -------------------------------------------------------------------
  const claimHeldBy = (claimId: string, org: EntityId): boolean => {
    const c = world.information.claims.find((x) => x.id === claimId);
    return (
      c !== undefined &&
      (c.visibility === 'public' || c.holderOrganizationIds.includes(org))
    );
  };
  const beliefOf = (beliefId: string, org: EntityId): boolean =>
    world.information.beliefs.some(
      (b) => b.id === beliefId && b.organizationId === org,
    );
  for (const b of world.draft.boards)
    for (const e of b.tiers.flatMap((t) => t.entries)) {
      for (const id of e.beliefIds)
        if (!beliefOf(id, b.organizationId))
          add(
            'INACCESSIBLE_BOARD_REFERENCE',
            `${b.id} cites belief ${id}, which ${b.organizationId} does not own`,
            [b.id, id],
            b.organizationId,
          );
      for (const id of e.noteClaimIds)
        if (!claimHeldBy(id, b.organizationId))
          add(
            'INACCESSIBLE_BOARD_REFERENCE',
            `${b.id} cites claim ${id}, which ${b.organizationId} cannot see`,
            [b.id, id],
            b.organizationId,
          );
    }
  for (const r of world.scouting.reports) {
    const org = r.organizationId;
    for (const id of r.evidenceClaimIds)
      if (!claimHeldBy(id, org))
        add(
          'INACCESSIBLE_SCOUTING_REFERENCE',
          `${r.id} cites claim ${id}, which ${org} cannot see`,
          [r.id, id],
          org,
        );
  }

  // --- receipts -----------------------------------------------------------------------------------
  const hasReceipt = (proposalId: string | null): boolean =>
    proposalId !== null &&
    world.decisions.receipts.some((x) => x.proposalId === proposalId);
  for (const a of world.contracts.agreements)
    if (a.sourceProposalId !== null && !hasReceipt(a.sourceProposalId))
      add(
        'MISSING_RECEIPT',
        `${a.id} executed proposal ${a.sourceProposalId} with no receipt`,
        [a.id, a.sourceProposalId],
        a.organizationId,
      );
  for (const s of world.draft.selections)
    if (!hasReceipt(s.organizationProposalId))
      add(
        'MISSING_RECEIPT',
        `${s.id} executed proposal ${s.organizationProposalId} with no receipt`,
        [s.id, s.organizationProposalId],
        s.organizationId,
      );
  for (const b of world.draft.boards)
    if (!hasReceipt(b.organizationProposalId))
      add(
        'MISSING_RECEIPT',
        `${b.id} executed proposal ${b.organizationProposalId} with no receipt`,
        [b.id, b.organizationProposalId],
        b.organizationId,
      );
  for (const r of world.decisions.receipts)
    if (r.outcomeEventIds.length === 0)
      add('RECEIPT_WITHOUT_OUTCOME', `${r.id} records no outcome event`, [
        r.id,
        r.proposalId,
      ]);

  return out.sort(
    (a, b) =>
      byText(a.code, b.code) ||
      byText(a.organizationId ?? '', b.organizationId ?? '') ||
      byText(a.subjectIds.join(','), b.subjectIds.join(',')) ||
      byText(a.detail, b.detail),
  );
};
