import {
  agentFor,
  CONTRACT_OFFER_TERMS_TYPE,
  DRAFT_SELECTION_TERMS_TYPE,
  contractOfferProposalTerms,
  entityId,
  requireTransactionRules,
  rookieScaleTerms,
  SYNTHETIC_PACKAGE_C_RULESET,
  type ContractOfferRecord,
  type ExecuteResult,
} from '../../src/index';
import { okResult, type Runner } from './orgHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);

export const GM_OF: Record<string, string> = {
  'org-northfield': 'person-nf-gm',
  'org-southport': 'person-sp-gm',
  'org-eastbrook': 'person-eb-gm',
  'org-westlake': 'person-wl-gm',
};

export const OWNER_OF: Record<string, string> = {
  'org-northfield': 'person-nf-owner',
  'org-southport': 'person-sp-owner',
  'org-eastbrook': 'person-eb-owner',
  'org-westlake': 'person-wl-owner',
};

/** Advances in <=30 day steps until the world is on `date`. */
export const advanceTo = (r: Runner, date: string): void => {
  while (r.kernel.world.simDate < date) {
    const left = Math.round(
      (Date.parse(`${date}T00:00:00Z`) -
        Date.parse(`${r.kernel.world.simDate}T00:00:00Z`)) /
        86_400_000,
    );
    okResult(r.run({ type: 'AdvanceDays', days: Math.min(30, left) }));
  }
};

export const DRAFT_DAY = '2027-04-25';

export const classOf = (r: Runner): string =>
  r.kernel.world.draft.classes[0]!.id;

export const openDraft = (r: Runner): ExecuteResult =>
  r.run({ type: 'OpenDraft', draftClassId: classOf(r) });

export const sessionOf = (r: Runner) => r.kernel.world.draft.sessions[0]!;

/** Runs the world to draft day and opens the draft. */
export const openedDraft = (r: Runner): string => {
  advanceTo(r, DRAFT_DAY);
  okResult(openDraft(r));
  return sessionOf(r).id;
};

export const clockPick = (r: Runner) => {
  const s = sessionOf(r);
  const id = s.orderedPickIds[s.currentIndex]!;
  return r.kernel.world.draft.picks.find((p) => p.id === id)!;
};

export const selectionProposal = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
  pickId: string,
  approvers: string[] = [],
  sessionId: string = sessionOf(r).id,
): string => {
  const res = r.run({
    type: 'SubmitProposal',
    organizationId: org,
    actingPersonId: by,
    category: 'acquisition',
    subjects: [{ kind: 'entity', id: org }],
    termsType: DRAFT_SELECTION_TERMS_TYPE,
    terms: { sessionId, pickId, playerId },
    requiredApproverPersonIds: approvers,
    expiresAt: null,
    contingencies: {},
  });
  if (!res.ok) throw new Error(`proposal refused: ${res.rejection.message}`);
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

export const makeSelection = (
  r: Runner,
  by: string,
  proposalId: string,
  extra: Record<string, unknown> = {},
): ExecuteResult =>
  r.run({
    type: 'MakeDraftSelection',
    actingPersonId: by,
    proposalId,
    expectedRevision: 1,
    rationale: { note: 'draft' },
    ...extra,
  });

/** The club on the clock takes `playerId` with its own GM. */
export const pickFor = (r: Runner, playerId: string): ExecuteResult => {
  const pick = clockPick(r);
  const org = pick.ownerOrganizationId as string;
  const gm = GM_OF[org]!;
  const proposalId = selectionProposal(r, org, gm, playerId, pick.id);
  return makeSelection(r, gm, proposalId);
};

/** Drafts the remaining prospects in id order until the draft completes. */
export const runWholeDraft = (r: Runner): void => {
  const klass = r.kernel.world.draft.classes[0]!;
  for (const playerId of klass.eligiblePlayerIds) {
    if (sessionOf(r).status === 'complete') return;
    okResult(pickFor(r, playerId));
  }
};

/** Authorizes, offers, resolves and returns the offer for `playerId` at rookie scale. */
export const rookieOffer = (
  r: Runner,
  org: string,
  by: string,
  playerId: string,
  round: number,
  overrides: { terms?: ReturnType<typeof rookieScaleTerms> } = {},
): { res: ExecuteResult; proposalId: string } => {
  const rule = TX.draft.rookieContractByRound.find((x) => x.round === round)!;
  const terms = overrides.terms ?? rookieScaleTerms(rule, 2027);
  const prop = r.run({
    type: 'SubmitProposal',
    organizationId: org,
    actingPersonId: by,
    category: 'contract',
    subjects: [{ kind: 'entity', id: playerId }],
    termsType: CONTRACT_OFFER_TERMS_TYPE,
    terms: contractOfferProposalTerms({
      playerId: entityId(playerId),
      targetRosterStatus: 'active',
      roleCommitment: 'starter',
      terms,
    }),
    requiredApproverPersonIds: [],
    expiresAt: null,
    contingencies: {},
  });
  if (!prop.ok) throw new Error(`proposal refused: ${prop.rejection.message}`);
  const proposalId = r.kernel.world.decisions.proposals.at(-1)!.id;
  const res = r.run({
    type: 'SubmitContractOffer',
    organizationId: org,
    actingPersonId: by,
    proposalId,
    expectedRevision: 1,
    playerId,
    agentPersonId: agentFor(
      r.kernel.world,
      entityId(playerId),
      r.kernel.world.simDate,
    ),
    terms,
    roleCommitment: 'starter',
    targetRosterStatus: 'active',
    priority: 0,
    contingencyGroupId: null,
  });
  return { res, proposalId };
};

export const lastOffer = (r: Runner, playerId: string): ContractOfferRecord =>
  r.kernel.world.market.contractOffers
    .filter((o) => o.playerId === playerId)
    .sort((a, b) => a.revision - b.revision)
    .at(-1)!;
