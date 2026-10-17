import {
  CONTRACT_OFFER_TERMS_TYPE,
  contractOfferProposalTerms,
  entityId,
  moneyAmount,
  type ContractOfferRecord,
  type ContractTermsV1,
  type ExecuteResult,
  type RoleCommitment,
  type RosterStatus,
} from '../../src/index';
import { agentFor } from '../../src/index';
import { okResult, type Runner } from './orgHarness';

export { NF, SP } from './orgHarness';

export const EB = {
  org: entityId('org-eastbrook'),
  gm: entityId('person-eb-gm'),
  owner: entityId('person-eb-owner'),
};
export const WL = {
  org: entityId('org-westlake'),
  gm: entityId('person-wl-gm'),
  owner: entityId('person-wl-owner'),
};

/** The market opens on 2027-03-10; the Package C world starts on 2027-02-15. */
export const openMarket = (r: Runner): void => {
  okResult(r.run({ type: 'AdvanceDays', days: 23 }));
};

export type TermsSpec = {
  years?: number;
  base?: number;
  roster?: number;
  guaranteed?: number;
  signing?: number;
  start?: number;
};

export const terms = (o: TermsSpec = {}): ContractTermsV1 => {
  const years = o.years ?? 2;
  const start = o.start ?? 2027;
  return {
    startSeason: start,
    signingBonus: moneyAmount(o.signing ?? 0),
    years: Array.from({ length: years }, (_, i) => ({
      season: start + i,
      baseSalary: moneyAmount(o.base ?? 100_000),
      rosterBonus: moneyAmount(o.roster ?? 0),
      guaranteedBase: moneyAmount(o.guaranteed ?? 0),
    })),
  };
};

export type OfferSpec = {
  terms?: TermsSpec;
  role?: RoleCommitment;
  target?: RosterStatus;
  priority?: number;
  group?: string | null;
  agent?: string | null | 'auto';
  expiresAt?: string | null;
  supersedes?: string;
  approvers?: string[];
};

export const submitContractProposal = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
  s: OfferSpec = {},
  extra: Record<string, unknown> = {},
): string => {
  const res = r.run({
    type: 'SubmitProposal',
    organizationId: org,
    actingPersonId: by,
    category: 'contract',
    subjects: [{ kind: 'entity', id: playerId }],
    termsType: CONTRACT_OFFER_TERMS_TYPE,
    terms: contractOfferProposalTerms({
      playerId: entityId(playerId),
      targetRosterStatus: s.target ?? 'active',
      roleCommitment: s.role ?? 'starter',
      terms: terms(s.terms),
    }),
    requiredApproverPersonIds: s.approvers ?? [],
    expiresAt: null,
    contingencies: {},
    ...extra,
  });
  if (!res.ok) throw new Error(`proposal refused: ${res.rejection.message}`);
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

export const agentOf = (r: Runner, playerId: string): string | null =>
  agentFor(r.kernel.world, entityId(playerId), r.kernel.world.simDate);

/** Authorizes and submits an offer; returns the result and the proposal id. */
export const sendOffer = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
  s: OfferSpec = {},
  overrides: Record<string, unknown> = {},
): { res: ExecuteResult; proposalId: string } => {
  const proposalId = submitContractProposal(r, org, by, playerId, s);
  const agent =
    s.agent === undefined || s.agent === 'auto'
      ? agentOf(r, playerId)
      : s.agent;
  const res = r.run({
    type: 'SubmitContractOffer',
    organizationId: org,
    actingPersonId: by,
    proposalId,
    expectedRevision: 1,
    playerId,
    agentPersonId: agent,
    terms: terms(s.terms),
    roleCommitment: s.role ?? 'starter',
    targetRosterStatus: s.target ?? 'active',
    priority: s.priority ?? 0,
    contingencyGroupId: s.group ?? null,
    ...(s.expiresAt === undefined ? {} : { expiresAt: s.expiresAt }),
    ...(s.supersedes === undefined ? {} : { supersedesOfferId: s.supersedes }),
    ...overrides,
  });
  return { res, proposalId };
};

export const offersOf = (
  r: Runner,
  org: string,
  playerId: string,
): ContractOfferRecord[] =>
  r.kernel.world.market.contractOffers
    .filter((o) => o.organizationId === org && o.playerId === playerId)
    .sort((a, b) => a.revision - b.revision);

export const latestOfferOf = (
  r: Runner,
  org: string,
  playerId: string,
): ContractOfferRecord => offersOf(r, org, playerId).at(-1)!;

export const resolveMarket = (r: Runner): ExecuteResult =>
  r.run({ type: 'ResolveFreeAgencyMarket' });

export const commitSigning = (
  r: Runner,
  by: string,
  offer: ContractOfferRecord,
  overrides: Record<string, unknown> = {},
): ExecuteResult =>
  r.run({
    type: 'CommitContractSigning',
    actingPersonId: by,
    offerId: offer.id,
    offerRevision: offer.revision,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'sign' },
    ...overrides,
  });

/** Flat terms: cash band medium, no guarantee. */
export const FLAT: TermsSpec = { base: 100_000 };
/** Front-loaded: early-cash band high. */
export const FRONT: TermsSpec = { base: 60_000, signing: 100_000 };
/** Guaranteed: security band high. */
export const SECURE: TermsSpec = { base: 100_000, guaranteed: 100_000 };
