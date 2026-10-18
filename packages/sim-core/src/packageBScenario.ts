import type { CommandEnvelope } from './audit';
import { canonicalString } from './canonical';
import { validateMandateAt } from './authority';
import {
  commandId,
  entityId,
  worldId,
  worldRevision,
  type ActorRef,
} from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import { ORG_SUBSTRATE_SEED } from './orgSubstrateSeed';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import {
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
} from './persistence';
import { SYNTHETIC_RULESET } from './syntheticFixtures';
import { createWorld, fingerprintWorld } from './world';

/**
 * The Package B golden scenario. Like Package A's it lives in pure sim-core so Node, Vitest
 * and Hermes run literally the same code on the same inputs.
 *
 * Two organizations see the same public fact; each gets a different legitimate private
 * claim from its own scout, forms a belief, and adopts a strategy plan through the real
 * proposal/approval/commit path. Later evidence makes one organization supersede its
 * belief and revise its plan with a stated cause, while the original belief and receipt
 * stay byte-identical. A revoked execute right makes a pending commit fail, and an ended
 * delegate role retires its mandate while history remains.
 */
export const PACKAGE_B_SCENARIO_ID = 'package-b-golden-v4';
export const PACKAGE_B_WORLD_ID = 'world-package-b-1';

const NF = {
  org: 'org-northfield',
  owner: 'person-nf-owner',
  gm: 'person-nf-gm',
  scout: 'person-nf-scout',
};
const SP = {
  org: 'org-southport',
  owner: 'person-sp-owner',
  gm: 'person-sp-gm',
  scout: 'person-sp-scout',
};

const harness: ActorRef = {
  kind: 'test_harness',
  id: entityId('package-b-harness'),
};

type Memo = Record<string, string>;
type Command = Record<string, unknown>;

export class PackageBScenarioError extends Error {
  constructor(message: string) {
    super(`Package B scenario violated: ${message}`);
    this.name = 'PackageBScenarioError';
  }
}

interface StepSpec {
  readonly label: string;
  readonly expect: 'committed' | RejectionCode;
  readonly command: (k: WorldKernel, m: Memo) => Command;
  /** Resubmit the previous command id (duplicate test). */
  readonly duplicate?: true;
  /** Send a revision that is already out of date. */
  readonly staleRevision?: true;
  /** Record ids and check invariants after a committed step. */
  readonly after?: (k: WorldKernel, m: Memo) => void;
}

const lastOf = <T extends { readonly id: string }>(xs: readonly T[]): string =>
  xs[xs.length - 1]!.id;
const lastClaim = (k: WorldKernel) => lastOf(k.world.information.claims);
const lastBelief = (k: WorldKernel) => lastOf(k.world.information.beliefs);
const lastProposal = (k: WorldKernel) => lastOf(k.world.decisions.proposals);
const lastReceipt = (k: WorldKernel) => lastOf(k.world.decisions.receipts);
const planOf = (k: WorldKernel, org: string) =>
  k.world.plans.plans.find(
    (p) => p.organizationId === org && p.status === 'active',
  )!.id;

const claim = (
  by: string,
  org: string,
  proposition: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Command => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: SP.org },
  propositionType: 'option_note',
  proposition,
  sourceFamilyId: `family-${by}`,
  observedAt: '2026-10-16',
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
  ...extra,
});

const belief = (
  by: string,
  org: string,
  evidence: string[],
  extra: Record<string, unknown> = {},
): Command => ({
  type: 'FormBelief',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: SP.org },
  assessmentType: 'option_assessment',
  assessment: { stance: 'leaning' },
  confidence: 'medium',
  evidenceClaimIds: evidence,
  supersedesBeliefId: null,
  ...extra,
});

const planTerms = (
  owner: string,
  prefer: string,
  extra: Record<string, unknown> = {},
) => ({
  planId: null,
  kind: 'strategy',
  scopeKey: 'direction',
  ownerPersonId: owner,
  effectiveAt: '2026-10-16',
  horizon: { seasons: 2 },
  objectives: [{ key: 'direction', priority: 'high', target: { prefer } }],
  constraints: [],
  triggerRefs: [],
  fallbackPlanIds: [],
  changeReasonRefs: [],
  ...extra,
});

const submit = (
  by: string,
  org: string,
  terms: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Command => ({
  type: 'SubmitProposal',
  organizationId: org,
  actingPersonId: by,
  category: 'organizational_plan',
  subjects: [{ kind: 'entity', id: org }],
  termsType: 'organization_plan_v1',
  terms,
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
  ...extra,
});

const commit = (
  by: string,
  proposalId: string,
  beliefIds: string[],
  evidenceClaimIds: string[],
): Command => ({
  type: 'CommitPlanProposal',
  actingPersonId: by,
  proposalId,
  expectedRevision: 1,
  beliefIds,
  evidenceClaimIds,
  rationale: { note: 'adopt the plan' },
});

const require_ = (ok: boolean, message: string): void => {
  if (!ok) throw new PackageBScenarioError(message);
};

export const PACKAGE_B_STEPS: readonly StepSpec[] = [
  {
    label: 'public-fact',
    expect: 'committed',
    command: () =>
      claim(
        NF.scout,
        NF.org,
        { fact: 'rival_front_office_in_flux' },
        {
          propositionType: 'public_situation',
          visibility: 'public',
          sourceFamilyId: 'family-public-report',
        },
      ),
    after: (k, m) => {
      m.publicClaim = lastClaim(k);
    },
  },
  {
    label: 'nf-private-claim',
    expect: 'committed',
    command: () => claim(NF.scout, NF.org, { favors: 'opt-a' }),
    after: (k, m) => {
      m.nfClaim = lastClaim(k);
    },
  },
  {
    label: 'sp-private-claim',
    expect: 'committed',
    command: () => claim(SP.scout, SP.org, { favors: 'opt-b' }),
    after: (k, m) => {
      m.spClaim = lastClaim(k);
    },
  },
  {
    label: 'nf-belief',
    expect: 'committed',
    command: (_k, m) => belief(NF.gm, NF.org, [m.publicClaim!, m.nfClaim!]),
    after: (k, m) => {
      m.nfBelief = lastBelief(k);
    },
  },
  {
    label: 'sp-belief',
    expect: 'committed',
    command: (_k, m) => belief(SP.gm, SP.org, [m.publicClaim!, m.spClaim!]),
    after: (k, m) => {
      m.spBelief = lastBelief(k);
      m.spBeliefCanon = canonicalString(
        k.world.information.beliefs.find((b) => b.id === m.spBelief),
      );
    },
  },
  {
    label: 'nf-plan-proposed-needs-owner',
    expect: 'committed',
    command: () =>
      submit(NF.gm, NF.org, planTerms(NF.gm, 'opt-a'), {
        requiredApproverPersonIds: [NF.owner],
      }),
    after: (k, m) => {
      m.nfProposal = lastProposal(k);
      require_(
        k.world.decisions.proposals.at(-1)!.state === 'awaiting_approval',
        'a plan that needs the owner must wait for approval',
      );
    },
  },
  {
    label: 'nf-owner-approves',
    expect: 'committed',
    command: (_k, m) => ({
      type: 'ApproveProposal',
      actingPersonId: NF.owner,
      proposalId: m.nfProposal,
      expectedRevision: 1,
    }),
  },
  {
    label: 'nf-plan-committed',
    expect: 'committed',
    command: (_k, m) =>
      commit(NF.gm, m.nfProposal!, [m.nfBelief!], [m.nfClaim!]),
    after: (k, m) => {
      m.nfPlan = planOf(k, NF.org);
      m.nfReceipt = lastReceipt(k);
    },
  },
  {
    label: 'sp-plan-proposed',
    expect: 'committed',
    command: () => submit(SP.gm, SP.org, planTerms(SP.gm, 'opt-b')),
    after: (k, m) => {
      m.spProposal = lastProposal(k);
      require_(
        k.world.decisions.proposals.at(-1)!.state === 'authorized',
        'a GM with approve rights authorizes directly',
      );
    },
  },
  {
    label: 'sp-plan-committed',
    expect: 'committed',
    command: (_k, m) =>
      commit(SP.gm, m.spProposal!, [m.spBelief!], [m.spClaim!]),
    after: (k, m) => {
      m.spPlan = planOf(k, SP.org);
      m.spReceipt = lastReceipt(k);
      m.spReceiptCanon = canonicalString(
        k.world.decisions.receipts.find((r) => r.id === m.spReceipt),
      );
      require_(
        planOf(k, NF.org) !== m.spPlan,
        'each organization holds its own plan',
      );
    },
  },
  {
    label: 'advance-3',
    expect: 'committed',
    command: () => ({ type: 'AdvanceDays', days: 3 }),
  },
  {
    label: 'duplicate-command',
    expect: 'DUPLICATE_COMMAND',
    duplicate: true,
    command: () => ({ type: 'AdvanceDays', days: 3 }),
  },
  {
    label: 'stale-revision',
    expect: 'STALE_REVISION',
    staleRevision: true,
    command: () => ({ type: 'AdvanceDays', days: 1 }),
  },
  {
    label: 'sp-contradicting-claim',
    expect: 'committed',
    command: (k, m) =>
      claim(
        SP.scout,
        SP.org,
        { opposes: 'opt-b', favors: 'opt-c' },
        { observedAt: k.world.simDate, contradictsClaimIds: [m.spClaim!] },
      ),
    after: (k, m) => {
      m.spNewClaim = lastClaim(k);
    },
  },
  {
    label: 'sp-belief-superseded',
    expect: 'committed',
    command: (_k, m) =>
      belief(SP.gm, SP.org, [m.spNewClaim!, m.spClaim!], {
        supersedesBeliefId: m.spBelief,
        assessment: { stance: 'reversed' },
      }),
    after: (k, m) => {
      m.spNewBelief = lastBelief(k);
    },
  },
  {
    label: 'sp-revision-proposed',
    expect: 'committed',
    command: (k, m) =>
      submit(
        SP.gm,
        SP.org,
        planTerms(SP.gm, 'opt-c', {
          planId: m.spPlan,
          effectiveAt: k.world.simDate,
          changeReasonRefs: [m.spNewClaim!],
        }),
      ),
    after: (k, m) => {
      m.spRevisionProposal = lastProposal(k);
    },
  },
  {
    label: 'sp-revision-committed',
    expect: 'committed',
    command: (_k, m) =>
      commit(SP.gm, m.spRevisionProposal!, [m.spNewBelief!], [m.spNewClaim!]),
    after: (k, m) => {
      m.spRevisionReceipt = lastReceipt(k);
      const plan = k.world.plans.plans.find((p) => p.id === m.spPlan)!;
      require_(plan.currentRevision === 2, 'the plan gained a second revision');
      require_(
        plan.revisions[1]!.changeReasonRefs[0] === m.spNewClaim,
        'the revision cites its cause',
      );
      require_(
        canonicalString(
          k.world.information.beliefs.find((b) => b.id === m.spBelief),
        ) === m.spBeliefCanon,
        'the original belief must not change',
      );
      require_(
        canonicalString(
          k.world.decisions.receipts.find((r) => r.id === m.spReceipt),
        ) === m.spReceiptCanon,
        'the original receipt must not change',
      );
    },
  },
  {
    label: 'nf-reversal-proposed-without-cause',
    expect: 'committed',
    command: (k, m) =>
      submit(
        NF.gm,
        NF.org,
        planTerms(NF.gm, 'opt-b', {
          planId: m.nfPlan,
          effectiveAt: k.world.simDate,
        }),
      ),
    after: (k, m) => {
      m.nfReversalProposal = lastProposal(k);
    },
  },
  {
    label: 'nf-unexplained-reversal-refused',
    expect: 'INVALID_PAYLOAD',
    command: (_k, m) => commit(NF.gm, m.nfReversalProposal!, [], []),
  },
  {
    label: 'nf-pending-proposal',
    expect: 'committed',
    command: (k) =>
      submit(
        NF.gm,
        NF.org,
        planTerms(NF.gm, 'opt-a', {
          scopeKey: 'cap-contingency',
          effectiveAt: k.world.simDate,
        }),
      ),
    after: (k, m) => {
      m.nfPending = lastProposal(k);
    },
  },
  {
    label: 'sp-delegates-to-scout',
    expect: 'committed',
    command: (k) => ({
      type: 'CreateMandate',
      organizationId: SP.org,
      actingPersonId: SP.gm,
      delegatePersonId: SP.scout,
      category: 'organizational_plan',
      scope: { scopeKeys: ['strategy'] },
      hardConstraints: { unit: 'synthetic_units', maxAmount: 100 },
      preferences: {},
      allowedRights: ['propose'],
      fallback: {},
      escalationRules: { onExceedsHardConstraint: 'escalate' },
      effectiveFrom: k.world.simDate,
      effectiveUntil: null,
    }),
    after: (k, m) => {
      m.spMandate = lastOf(k.world.authority.mandates);
      require_(
        validateMandateAt(k.world, m.spMandate, k.world.simDate).ok,
        'a fresh mandate is valid',
      );
    },
  },
  {
    label: 'sp-scout-role-ends',
    expect: 'committed',
    command: () => ({
      type: 'EndRoleEpisode',
      actingPersonId: SP.owner,
      episodeId: 'role-sp-scout',
    }),
    after: (k, m) => {
      const mandate = k.world.authority.mandates.find(
        (x) => x.id === m.spMandate,
      );
      require_(mandate !== undefined, 'mandate history is preserved');
      require_(
        !validateMandateAt(k.world, m.spMandate!, k.world.simDate).ok,
        'a mandate cannot outlive the role behind it',
      );
    },
  },
  {
    label: 'nf-gm-grant-revoked',
    expect: 'committed',
    command: () => ({
      type: 'RevokeAuthority',
      actingPersonId: NF.owner,
      grantId: 'grant-nf-gm-plan',
    }),
  },
  {
    label: 'nf-pending-commit-fails',
    expect: 'INSUFFICIENT_AUTHORITY',
    command: (_k, m) => commit(NF.gm, m.nfPending!, [], []),
  },
];

export interface PackageBStepResult {
  readonly label: string;
  readonly outcome: 'committed' | RejectionCode;
  readonly revision: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly chainHead: string;
}

export interface PackageBResult {
  readonly scenario: typeof PACKAGE_B_SCENARIO_ID;
  readonly worldId: string;
  readonly finalSimDate: string;
  readonly revision: number;
  readonly eventCount: number;
  readonly rngDraws: number;
  readonly fingerprint: string;
  readonly eventChainHead: string;
  /** Stable ids of the records the scenario creates, for human inspection. */
  readonly keyRecordIds: Readonly<Record<string, string>>;
  readonly steps: readonly PackageBStepResult[];
}

const stateOf = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  rngDraws: k.world.rng.draws,
  chainHead: k.chainHead,
  events: k.eventCount,
});

export const createPackageBGenesisKernel = (): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(ORG_SUBSTRATE_SEED, SYNTHETIC_RULESET, {
      newWorldId: () => worldId(PACKAGE_B_WORLD_ID),
    }),
    SYNTHETIC_RULESET,
  );

export interface PackageBRunOptions {
  readonly onCommit?: (record: CommitRecord) => void;
  /** Called before each step; may return a replacement kernel (e.g. one reloaded from storage). */
  readonly beforeStep?: (
    index: number,
    kernel: WorldKernel,
  ) => WorldKernel | void;
}

export const runPackageBScenario = (
  options: PackageBRunOptions = {},
): PackageBResult => {
  let kernel = createPackageBGenesisKernel();
  const memo: Memo = {};
  const steps: PackageBStepResult[] = [];
  PACKAGE_B_STEPS.forEach((spec, index) => {
    kernel = options.beforeStep?.(index, kernel) ?? kernel;
    const known = kernel.knownCommandIds;
    const n = spec.duplicate === true ? known.length : known.length + 1;
    const envelope = {
      commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
      expectedRevision: worldRevision(
        spec.staleRevision === true ? 0 : Number(kernel.world.revision),
      ),
      actor: harness,
      command: spec.command(kernel, memo),
    } as unknown as CommandEnvelope;
    const before = stateOf(kernel);
    const result = kernel.execute(envelope);
    if (spec.expect === 'committed') {
      if (!result.ok)
        throw new PackageBScenarioError(
          `${spec.label} should commit but was rejected: ${result.rejection.code}: ${result.rejection.message}`,
        );
      options.onCommit?.({
        snapshot: sealSnapshot({
          world: kernel.world,
          chainHead: kernel.chainHead,
          eventCount: kernel.eventCount,
          knownCommandIds: kernel.knownCommandIds,
        }),
        commands: [{ envelope, resultRevision: Number(result.world.revision) }],
        events: result.events,
      });
      spec.after?.(kernel, memo);
    } else {
      if (result.ok)
        throw new PackageBScenarioError(
          `${spec.label} should be rejected as ${spec.expect} but committed`,
        );
      if (result.rejection.code !== spec.expect)
        throw new PackageBScenarioError(
          `${spec.label} rejected as ${result.rejection.code}, expected ${spec.expect}`,
        );
      const after = stateOf(kernel);
      if (
        after.fingerprint !== before.fingerprint ||
        after.rngDraws !== before.rngDraws ||
        after.chainHead !== before.chainHead ||
        after.events !== before.events
      )
        throw new PackageBScenarioError(
          `${spec.label} changed state or consumed randomness`,
        );
    }
    steps.push({
      label: spec.label,
      outcome: spec.expect,
      revision: Number(kernel.world.revision),
      rngDraws: kernel.world.rng.draws,
      fingerprint: fingerprintWorld(kernel.world),
      chainHead: kernel.chainHead,
    });
  });
  const keys = [
    'publicClaim',
    'nfClaim',
    'spClaim',
    'nfBelief',
    'spBelief',
    'nfProposal',
    'nfPlan',
    'nfReceipt',
    'spProposal',
    'spPlan',
    'spReceipt',
    'spNewClaim',
    'spNewBelief',
    'spRevisionProposal',
    'spRevisionReceipt',
    'nfPending',
    'spMandate',
  ];
  return {
    scenario: PACKAGE_B_SCENARIO_ID,
    worldId: kernel.world.worldId,
    finalSimDate: kernel.world.simDate,
    revision: Number(kernel.world.revision),
    eventCount: kernel.eventCount,
    rngDraws: kernel.world.rng.draws,
    fingerprint: fingerprintWorld(kernel.world),
    eventChainHead: kernel.chainHead,
    keyRecordIds: Object.fromEntries(keys.map((key) => [key, memo[key]!])),
    steps,
  };
};

export interface PackageBStoreRun {
  readonly result: PackageBResult;
  readonly loadStatus: string;
  readonly replayOk: boolean;
  readonly reloadedFingerprint: string | null;
  readonly reloadedChainHead: string | null;
}

/** Run the scenario, persist every commit, reload from the store and replay stored history. */
export const runPackageBThroughStore = async (
  store: CareerStore,
): Promise<PackageBStoreRun> => {
  const genesis = createPackageBGenesisKernel();
  await store.initialize();
  await store.saveCommit({
    snapshot: sealSnapshot({
      world: genesis.world,
      chainHead: genesis.chainHead,
      eventCount: 0,
      knownCommandIds: [],
    }),
    commands: [],
    events: [],
  });
  const commits: CommitRecord[] = [];
  const result = runPackageBScenario({ onCommit: (r) => commits.push(r) });
  for (const record of commits) await store.saveCommit(record);
  const loaded = await loadCareer(store, {
    ruleset: SYNTHETIC_RULESET,
    seed: ORG_SUBSTRATE_SEED,
  });
  const replay = await verifyCareerReplay(store, SYNTHETIC_RULESET);
  return {
    result,
    loadStatus: loaded.status,
    replayOk: replay.ok,
    reloadedFingerprint:
      loaded.status === 'loaded' ? fingerprintWorld(loaded.kernel.world) : null,
    reloadedChainHead:
      loaded.status === 'loaded' ? loaded.kernel.chainHead : null,
  };
};

/** Compare a run against recorded expectations; returns human-readable differences. */
export const diffPackageB = (
  actual: PackageBResult,
  expected: PackageBResult,
): string[] => {
  const diffs: string[] = [];
  const keys = [
    'scenario',
    'worldId',
    'finalSimDate',
    'revision',
    'eventCount',
    'rngDraws',
    'fingerprint',
    'eventChainHead',
  ] as const;
  for (const k of keys)
    if (actual[k] !== expected[k])
      diffs.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
  if (
    JSON.stringify(actual.keyRecordIds) !==
    JSON.stringify(expected.keyRecordIds)
  )
    diffs.push('keyRecordIds differ');
  if (JSON.stringify(actual.steps) !== JSON.stringify(expected.steps))
    diffs.push('per-step results differ');
  return diffs;
};
