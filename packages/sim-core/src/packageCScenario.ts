import { auditAcquisitionWorld } from './acquisitionAudit';
import { previewAcquisitionImpact } from './acquisitionImpact';
import type { CommandEnvelope } from './audit';
import { canonicalString } from './canonical';
import { capPosition } from './contractMath';
import type { ContractTermsV1 } from './contracts';
import {
  contractOfferProposalTerms,
  CONTRACT_OFFER_TERMS_TYPE,
} from './freeAgencyCommands';
import { DRAFT_BOARD_TERMS_TYPE, latestBoard } from './draftBoardCommands';
import { DRAFT_SELECTION_TERMS_TYPE } from './draftCommands';
import { moneyAmount, requireTransactionRules } from './economy';
import {
  commandId,
  entityId,
  worldId,
  worldRevision,
  type ActorRef,
} from './ids';
import { WorldKernel, type RejectionCode } from './kernel';
import { agentFor } from './playerMarketView';
import { PACKAGE_C_SEED } from './packageCWorldSeed';
import { loadCareer } from './recovery';
import { verifyCareerReplay } from './replay';
import { rookieScaleTerms } from './rookieContracts';
import { activeRightsFor, rosterCapacity } from './roster';
import {
  sealSnapshot,
  type CareerStore,
  type CommitRecord,
} from './persistence';
import { SYNTHETIC_PACKAGE_C_RULESET } from './syntheticFixtures';
import { tradePackageTerms } from './tradeCommands';
import type { AcquisitionAssetRef, TradePackageV1 } from './assets';
import { createWorld, fingerprintWorld } from './world';

/**
 * The Package C golden scenario. Like Packages A and B it lives in pure sim-core so Node,
 * Vitest, standalone Hermes and the phone run literally the same code on the same inputs.
 *
 * Four organizations adopt different strategy plans, two of them scout the same unresolved
 * prospect through legitimate claims and reach different beliefs and boards, a veteran is
 * shopped and traded, concurrent free-agency offers (with a fallback chain and a rival)
 * resolve without double-spending, a player is extended and another released into waivers
 * where several clubs claim him, the draft opens, a pick trades and its new owner selects,
 * and a rookie and an undrafted player sign through the shared market path. Every step
 * goes through the real command router; nothing writes world state directly.
 */
export const PACKAGE_C_SCENARIO_ID = 'package-c-golden-v1';
export const PACKAGE_C_WORLD_ID = 'world-package-c-1';

const ORGS = {
  nf: { org: 'org-northfield', gm: 'person-nf-gm', scout: 'person-nf-scout' },
  sp: { org: 'org-southport', gm: 'person-sp-gm', scout: 'person-sp-scout' },
  eb: { org: 'org-eastbrook', gm: 'person-eb-gm', scout: 'person-eb-scout' },
  wl: { org: 'org-westlake', gm: 'person-wl-gm', scout: 'person-wl-scout' },
} as const;
export const NF = ORGS.nf;
export const SP = ORGS.sp;
export const EB = ORGS.eb;
export const WL = ORGS.wl;
const GM_OF: Record<string, string> = {
  [NF.org]: NF.gm,
  [SP.org]: SP.gm,
  [EB.org]: EB.gm,
  [WL.org]: WL.gm,
};
const PROSPECT = 'player-pr-01';
const NF_PICK = 'pick-2027-r1-s4';
const EB_PICK = 'pick-2027-r2-s2';

export const harness: ActorRef = {
  kind: 'test_harness',
  id: entityId('package-c-harness'),
};

export type Memo = Record<string, string>;
type Command = Record<string, unknown>;

export class PackageCScenarioError extends Error {
  constructor(message: string) {
    super(`Package C scenario violated: ${message}`);
    this.name = 'PackageCScenarioError';
  }
}

/** The two legal paths the scenario can take from the same seed. */
export type PackageCVariant = 'primary' | 'alternate';

export interface Context {
  readonly k: WorldKernel;
  readonly m: Memo;
  readonly variant: PackageCVariant;
}

export interface StepSpec {
  readonly label: string;
  readonly expect: 'committed' | RejectionCode;
  readonly command: (c: Context) => Command;
  /** Resubmit the previous command id (duplicate test). */
  readonly duplicate?: true;
  /** Send a revision that is already out of date. */
  readonly staleRevision?: true;
  /** Record ids and check invariants after a committed step. */
  readonly after?: (c: Context) => void;
  /** Runs before the command is built, e.g. to capture an impact preview. */
  readonly before?: (c: Context) => void;
}

const require_ = (ok: boolean, message: string): void => {
  if (!ok) throw new PackageCScenarioError(message);
};

export const tx = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);

const lastOf = <T extends { readonly id: string }>(xs: readonly T[]): string =>
  xs[xs.length - 1]!.id;
const lastClaim = (k: WorldKernel) => lastOf(k.world.information.claims);
const lastBelief = (k: WorldKernel) => lastOf(k.world.information.beliefs);
const lastProposal = (k: WorldKernel) => lastOf(k.world.decisions.proposals);

const rightsAsset = (k: WorldKernel, playerId: string): AcquisitionAssetRef => {
  const r = activeRightsFor(
    k.world.roster,
    entityId(playerId),
    k.world.simDate,
  )[0]!;
  return { kind: 'player_rights', playerId: r.playerId, rightsId: r.id };
};
const pickAsset = (id: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: id as never,
});
const pkg = (
  a: string,
  b: string,
  from: readonly AcquisitionAssetRef[],
  to: readonly AcquisitionAssetRef[],
): TradePackageV1 => ({
  organizationAId: entityId(a),
  organizationBId: entityId(b),
  assetsFromA: from,
  assetsFromB: to,
  validity: { expiresAt: null },
  contingencies: {},
});

const daysTo = (k: WorldKernel, date: string): number =>
  Math.round(
    (Date.parse(`${date}T00:00:00Z`) -
      Date.parse(`${k.world.simDate}T00:00:00Z`)) /
      86_400_000,
  );

// --- command builders ----------------------------------------------------------------

const claimCmd = (
  org: string,
  by: string,
  player: string,
  propositionType: string,
  proposition: Record<string, unknown>,
  family: string,
  k: WorldKernel,
): Command => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: player },
  propositionType,
  proposition,
  sourceFamilyId: family,
  observedAt: k.world.simDate,
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
});

const observation =
  (
    org: string,
    by: string,
    dimension: string,
    family: string,
    signal = 'positive',
    player = PROSPECT,
  ) =>
  (c: Context): Command =>
    claimCmd(
      org,
      by,
      player,
      'prospect_observation',
      { dimension, signal },
      family,
      c.k,
    );

const proposalCmd = (
  org: string,
  by: string,
  category: string,
  subjects: readonly { kind: string; id: string }[],
  termsType: string,
  terms: unknown,
  approvers: readonly string[] = [],
): Command => ({
  type: 'SubmitProposal',
  organizationId: org,
  actingPersonId: by,
  category,
  subjects,
  termsType,
  terms,
  requiredApproverPersonIds: approvers,
  expiresAt: null,
  contingencies: {},
});

const planTermsFor = (owner: string, window: 'contend' | 'rebuild') => ({
  planId: null,
  kind: 'strategy',
  scopeKey: 'franchise',
  ownerPersonId: owner,
  effectiveAt: '2027-02-15',
  horizon: { seasons: 3 },
  objectives: [{ key: 'competitive_window', priority: 'high', target: window }],
  constraints: [],
  triggerRefs: [],
  fallbackPlanIds: [],
  changeReasonRefs: [],
});

const steps: StepSpec[] = [];
const add = (
  label: string,
  command: Command | ((c: Context) => Command),
  extra: Partial<StepSpec> = {},
): void => {
  steps.push({
    label,
    expect: 'committed',
    command: typeof command === 'function' ? command : () => command,
    ...extra,
  });
};

// ============================ phase 1: plans ======================================

const adoptPlan = (
  key: string,
  org: string,
  gm: string,
  window: 'contend' | 'rebuild',
): void => {
  add(
    `plan-propose-${key}`,
    proposalCmd(
      org,
      gm,
      'organizational_plan',
      [{ kind: 'entity', id: org }],
      'organization_plan_v1',
      planTermsFor(gm, window),
    ),
    {
      after: (c) => {
        c.m[`${key}PlanProposal`] = lastProposal(c.k);
      },
    },
  );
  add(`plan-commit-${key}`, (c) => ({
    type: 'CommitPlanProposal',
    actingPersonId: gm,
    proposalId: c.m[`${key}PlanProposal`],
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'adopt the plan' },
  }));
};
adoptPlan('nf', NF.org, NF.gm, 'contend');
adoptPlan('sp', SP.org, SP.gm, 'contend');
adoptPlan('eb', EB.org, EB.gm, 'rebuild');
adoptPlan('wl', WL.org, WL.gm, 'rebuild');

// ============================ phase 2: scouting ===================================

add(
  'nf-observe-processing',
  observation(NF.org, NF.scout, 'processing', 'nf-camp'),
  {
    after: (c) => {
      c.m.nfClaimA = lastClaim(c.k);
    },
  },
);
add(
  'nf-observe-coverage',
  observation(NF.org, NF.scout, 'coverage_instincts', 'nf-film'),
  {
    after: (c) => {
      c.m.nfClaimB = lastClaim(c.k);
    },
  },
);
add('eb-observe-burst', observation(EB.org, EB.scout, 'burst', 'eb-camp'), {
  after: (c) => {
    c.m.ebClaimA = lastClaim(c.k);
  },
});
add(
  'eb-observe-route',
  observation(EB.org, EB.scout, 'route_craft', 'eb-film', 'mixed'),
  {
    after: (c) => {
      c.m.ebClaimB = lastClaim(c.k);
    },
  },
);

const scoutQuestion = (
  key: string,
  org: string,
  scout: string,
  pick: string,
  dims: readonly string[],
): void => {
  add(
    `${key}-ask`,
    {
      type: 'AskScoutingQuestion',
      organizationId: org,
      actingPersonId: scout,
      playerId: PROSPECT,
      questionKey: 'can_start_in_year_one',
      dimensions: dims,
      decisionContext: { kind: 'draft_selection', pickId: pick },
    },
    {
      after: (c) => {
        c.m[`${key}Question`] = lastOf(c.k.world.scouting.questions);
      },
    },
  );
  add(
    `${key}-assign`,
    (c) => ({
      type: 'AssignScoutingEvaluation',
      actingPersonId: scout,
      questionId: c.m[`${key}Question`],
      evaluatorPersonId: scout,
      evidenceClaimIds: [c.m[`${key}ClaimA`], c.m[`${key}ClaimB`]],
    }),
    {
      after: (c) => {
        c.m[`${key}Assignment`] = lastOf(c.k.world.scouting.assignments);
      },
    },
  );
};
scoutQuestion('nf', NF.org, NF.scout, NF_PICK, [
  'processing',
  'coverage_instincts',
]);
scoutQuestion('eb', EB.org, EB.scout, EB_PICK, ['burst', 'route_craft']);
add('advance-scouting-day', { type: 'AdvanceDays', days: 1 });
for (const key of ['nf', 'eb'] as const) {
  const who = key === 'nf' ? NF : EB;
  add(
    `${key}-resolve`,
    (c) => ({
      type: 'ResolveScoutingAssignment',
      actingPersonId: who.scout,
      assignmentId: c.m[`${key}Assignment`],
    }),
    {
      after: (c) => {
        const report = c.k.world.scouting.reports.at(-1)!;
        c.m[`${key}Report`] = report.id;
        c.m[`${key}Belief`] = report.beliefId;
      },
    },
  );
}

// ============================ phase 3: boards =====================================

const boardTerms = (c: Context, key: 'nf' | 'eb', need: string) => ({
  draftClassId: c.k.world.draft.classes[0]!.id,
  tiers: [
    {
      tier: key === 'nf' ? 1 : 2,
      entries: [
        {
          playerId: PROSPECT,
          beliefIds: [c.m[`${key}Belief`]],
          roleProjection: key === 'nf' ? 'coverage' : 'receiver',
          withinTierOrder: null,
          needPriority: need,
          planIds: [],
          noteClaimIds: [],
        },
      ],
    },
  ],
});
for (const key of ['nf', 'eb'] as const) {
  const who = key === 'nf' ? NF : EB;
  add(
    `${key}-board-propose`,
    (c) =>
      proposalCmd(
        who.org,
        who.gm,
        'acquisition',
        [{ kind: 'entity', id: who.org }],
        DRAFT_BOARD_TERMS_TYPE,
        boardTerms(c, key, 'normal'),
      ),
    {
      after: (c) => {
        c.m[`${key}BoardProposal`] = lastProposal(c.k);
      },
    },
  );
  add(
    `${key}-board-commit`,
    (c) => ({
      type: 'CommitDraftBoardProposal',
      actingPersonId: who.gm,
      proposalId: c.m[`${key}BoardProposal`],
      expectedRevision: 1,
      rationale: { note: 'first board' },
    }),
    {
      after: (c) => {
        c.m[`${key}Board1`] = lastOf(c.k.world.draft.boards);
      },
    },
  );
}
// Northfield's need rises; the evaluation (tier, belief) is untouched.
add(
  'nf-board-need-propose',
  (c) =>
    proposalCmd(
      NF.org,
      NF.gm,
      'acquisition',
      [{ kind: 'entity', id: NF.org }],
      DRAFT_BOARD_TERMS_TYPE,
      boardTerms(c, 'nf', 'must_address'),
    ),
  {
    after: (c) => {
      c.m.nfBoardProposal2 = lastProposal(c.k);
    },
  },
);
add(
  'nf-board-need-commit',
  (c) => ({
    type: 'CommitDraftBoardProposal',
    actingPersonId: NF.gm,
    proposalId: c.m.nfBoardProposal2,
    expectedRevision: 1,
    supersedesBoardRevisionId: c.m.nfBoard1,
    rationale: { note: 'need changed' },
  }),
  {
    after: (c) => {
      c.m.nfBoard2 = lastOf(c.k.world.draft.boards);
      const first = c.k.world.draft.boards.find((b) => b.id === c.m.nfBoard1)!;
      const second = c.k.world.draft.boards.find((b) => b.id === c.m.nfBoard2)!;
      require_(
        canonicalString(first.tiers.map((t) => t.tier)) ===
          canonicalString(second.tiers.map((t) => t.tier)),
        'a need change must not move the prospect between tiers',
      );
      require_(
        latestBoard(c.k.world, entityId(NF.org), first.draftClassId)?.id ===
          second.id,
        'latest board is the revision',
      );
    },
  },
);

// ============================ phase 4: trade discovery and negotiation ============

type Org = {
  readonly org: string;
  readonly gm: string;
  readonly scout: string;
};

const capNow = (k: WorldKernel, org: string, season: number): number =>
  capPosition(tx, k.world.contracts, entityId(org), season).committed;

const tradeFlow = (
  key: string,
  a: Org,
  b: Org,
  build: (k: WorldKernel) => TradePackageV1,
  opts: { ask?: boolean; commit?: boolean; preview?: boolean },
): void => {
  add(
    `${key}-propose-a`,
    (c) =>
      proposalCmd(
        a.org,
        a.gm,
        'acquisition',
        [{ kind: 'entity', id: b.org }],
        'trade_package_v1',
        tradePackageTerms(build(c.k)),
      ),
    {
      after: (c) => {
        c.m[`${key}ProposalA`] = lastProposal(c.k);
      },
    },
  );
  add(
    `${key}-post`,
    (c) => ({
      type: 'PostTradeOffer',
      actingPersonId: a.gm,
      proposalId: c.m[`${key}ProposalA`],
      expectedRevision: 1,
    }),
    {
      after: (c) => {
        c.m[`${key}Offer`] = lastOf(c.k.world.market.tradeOffers);
      },
    },
  );
  if (opts.ask === true)
    add(
      `${key}-ask`,
      (c) => ({
        type: 'RequestTradeResponse',
        actingPersonId: a.gm,
        offerId: c.m[`${key}Offer`],
        offerRevision: 1,
      }),
      {
        after: (c) => {
          const r = c.k.world.market.responses.at(-1)! as {
            disposition: string;
          };
          c.m[`${key}Disposition`] = r.disposition;
          require_(
            r.disposition !== 'accept',
            'a club with its own reasons must not simply accept this package',
          );
        },
      },
    );
  if (opts.commit !== true) return;
  add(
    `${key}-propose-b`,
    (c) =>
      proposalCmd(
        b.org,
        b.gm,
        'acquisition',
        [{ kind: 'entity', id: a.org }],
        'trade_package_v1',
        tradePackageTerms(build(c.k)),
      ),
    {
      after: (c) => {
        c.m[`${key}ProposalB`] = lastProposal(c.k);
      },
    },
  );
  add(`${key}-answer`, (c) => ({
    type: 'AnswerTradeOffer',
    actingPersonId: b.gm,
    offerId: c.m[`${key}Offer`],
    offerRevision: 1,
    answer: 'accept',
  }));
  const side = (by: string) => ({
    actingPersonId: by,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'trade' },
  });
  add(
    `${key}-commit`,
    (c) => ({
      type: 'CommitTradeAgreement',
      actingPersonId: a.gm,
      offerId: c.m[`${key}Offer`],
      offerRevision: 1,
      counterpartyProposalId: c.m[`${key}ProposalB`],
      proposerSide: side(a.gm),
      counterpartySide: side(b.gm),
    }),
    {
      before: (c) => {
        if (opts.preview !== true) return;
        const p = build(c.k);
        const view = (o: Org) => ({
          preview: previewAcquisitionImpact(
            c.k.world,
            tx,
            p,
            c.k.world.simDate,
            entityId(o.org),
          ),
          cap: [2027, 2028, 2029, 2030].map((s) => capNow(c.k, o.org, s)),
          slots: rosterCapacity(
            c.k.world.roster,
            tx,
            entityId(o.org),
            c.k.world.simDate,
          ).active.count,
        });
        c.m[`${key}PreviewA`] = JSON.stringify(view(a));
        c.m[`${key}PreviewB`] = JSON.stringify(view(b));
      },
      after: (c) => {
        if (opts.preview !== true) return;
        for (const [o, tag] of [
          [a, 'A'],
          [b, 'B'],
        ] as const) {
          const before = JSON.parse(c.m[`${key}Preview${tag}`]!) as {
            preview: {
              capDeltaBySeason: { season: number; delta: number }[];
              activeSlotsAfter: number;
            };
            cap: number[];
          };
          [2027, 2028, 2029, 2030].forEach((season, i) => {
            const promised =
              before.preview.capDeltaBySeason.find((d) => d.season === season)
                ?.delta ?? 0;
            const actual = capNow(c.k, o.org, season) - before.cap[i]!;
            require_(
              promised === actual,
              `${key}: the preview promised ${promised} for ${o.org} in ${season} but the trade changed it by ${actual}`,
            );
          });
          const active = rosterCapacity(
            c.k.world.roster,
            tx,
            entityId(o.org),
            c.k.world.simDate,
          ).active.count;
          require_(
            active === before.preview.activeSlotsAfter,
            `${key}: the preview promised ${before.preview.activeSlotsAfter} active slots for ${o.org}, found ${active}`,
          );
        }
      },
    },
  );
};

add(
  'eb-note-nf02',
  (c) =>
    claimCmd(
      EB.org,
      EB.scout,
      'player-nf-02',
      'player_note',
      { note: 'skill set does not fit our plan' },
      'eb-pro-dept',
      c.k,
    ),
  {
    after: (c) => {
      c.m.ebNoteClaim = lastClaim(c.k);
    },
  },
);
add(
  'eb-avoid-nf02',
  (c) => ({
    type: 'FormBelief',
    organizationId: EB.org,
    actingPersonId: EB.gm,
    subject: { kind: 'entity', id: 'player-nf-02' },
    assessmentType: 'acquisition_tier',
    assessment: { tier: 'avoid' },
    confidence: 'medium',
    evidenceClaimIds: [c.m.ebNoteClaim],
    supersedesBeliefId: null,
  }),
  {
    after: (c) => {
      c.m.ebAvoidBelief = lastBelief(c.k);
    },
  },
);

for (const target of [EB, WL] as const) {
  add(
    `nf-shop-nf01-${target === EB ? 'eb' : 'wl'}`,
    (c) => ({
      type: 'SubmitMarketInquiry',
      organizationId: NF.org,
      actingPersonId: NF.gm,
      contactedOrganizationId: target.org,
      asset: rightsAsset(c.k, 'player-nf-01'),
      direction: 'shop',
    }),
    {
      after: (c) => {
        c.m[`shop${target === EB ? 'Eb' : 'Wl'}`] = lastOf(
          c.k.world.market.inquiries,
        );
      },
    },
  );
}

// Eastbrook has its own reasons to turn down player-nf-02; the answer is recorded.
tradeFlow(
  'dump',
  NF,
  EB,
  (k) =>
    pkg(
      NF.org,
      EB.org,
      [rightsAsset(k, 'player-nf-02')],
      [rightsAsset(k, 'player-eb-03')],
    ),
  { ask: true },
);
// A separate, legal, dual-proposal trade: each side authorizes the same package.
tradeFlow(
  'swap',
  NF,
  EB,
  (k) =>
    pkg(
      NF.org,
      EB.org,
      [rightsAsset(k, 'player-nf-01')],
      [rightsAsset(k, 'player-eb-04')],
    ),
  { commit: true, preview: true },
);

// ============================ phase 5: release and waivers ========================

add(
  'nf-release-propose',
  proposalCmd(
    NF.org,
    NF.gm,
    'roster',
    [{ kind: 'entity', id: 'player-nf-04' }],
    'release_player_v1',
    { playerId: 'player-nf-04' },
  ),
  {
    after: (c) => {
      c.m.releaseProposal = lastProposal(c.k);
    },
    before: (c) => {
      c.m['cap:nf2027BeforeRelease'] = String(capNow(c.k, NF.org, 2027));
      c.m['cap:nf2028BeforeRelease'] = String(capNow(c.k, NF.org, 2028));
    },
  },
);
add(
  'nf-release-commit',
  (c) => ({
    type: 'CommitReleaseProposal',
    actingPersonId: NF.gm,
    proposalId: c.m.releaseProposal,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'cut down' },
  }),
  {
    after: (c) => {
      c.m.waiver = lastOf(c.k.world.roster.waivers);
      c.m['cap:nf2027AfterRelease'] = String(capNow(c.k, NF.org, 2027));
      c.m['cap:nf2028AfterRelease'] = String(capNow(c.k, NF.org, 2028));
    },
  },
);
for (const o of [SP, EB, WL] as const)
  add(`waiver-claim-${o.org.slice(4, 6)}`, (c) => ({
    type: 'SubmitWaiverClaim',
    organizationId: o.org,
    actingPersonId: o.gm,
    waiverId: c.m.waiver,
    rosterStatus: 'active',
  }));
add('advance-waiver-day', { type: 'AdvanceDays', days: 1 });
add(
  'resolve-waivers',
  { type: 'ResolveWaivers' },
  {
    after: (c) => {
      const w = c.k.world.roster.waivers.find((x) => x.id === c.m.waiver)!;
      require_(
        w.status === 'awarded' && w.winnerOrganizationId !== null,
        'the waiver should be awarded to a claimant',
      );
      c.m.waiverWinner = String(w.winnerOrganizationId);
    },
  },
);

// ============================ phase 6: concurrent free agency =====================

type TermSpec = {
  readonly years: number;
  readonly base: number;
  readonly signing?: number;
  readonly guaranteed?: number;
  readonly start?: number;
};
const termsOf = (s: TermSpec): ContractTermsV1 => {
  const start = s.start ?? 2027;
  return {
    startSeason: start,
    signingBonus: moneyAmount(s.signing ?? 0),
    years: Array.from({ length: s.years }, (_, i) => ({
      season: start + i,
      baseSalary: moneyAmount(s.base),
      rosterBonus: moneyAmount(0),
      guaranteedBase: moneyAmount(s.guaranteed ?? 0),
    })),
  };
};
const FLAT: TermSpec = { years: 2, base: 100_000 };
const SECURE: TermSpec = { years: 2, base: 100_000, guaranteed: 100_000 };
const FRONT: TermSpec = { years: 2, base: 60_000, signing: 100_000 };

type OfferOpts = {
  readonly terms: ContractTermsV1;
  readonly role?: 'starter' | 'rotation' | 'depth' | 'developmental';
  readonly target?: 'active' | 'reserve' | 'practice_squad';
  readonly priority?: number;
  readonly group?: string | null;
};

const offerFor = (
  key: string,
  o: Org,
  playerId: string,
  opts: OfferOpts,
): void => {
  const role = opts.role ?? 'starter';
  const target = opts.target ?? 'active';
  add(
    `${key}-contract-propose`,
    proposalCmd(
      o.org,
      o.gm,
      'contract',
      [{ kind: 'entity', id: playerId }],
      CONTRACT_OFFER_TERMS_TYPE,
      contractOfferProposalTerms({
        playerId: entityId(playerId),
        targetRosterStatus: target,
        roleCommitment: role,
        terms: opts.terms,
      }),
    ),
    {
      after: (c) => {
        c.m[`${key}ContractProposal`] = lastProposal(c.k);
      },
    },
  );
  add(
    `${key}-offer`,
    (c) => ({
      type: 'SubmitContractOffer',
      organizationId: o.org,
      actingPersonId: o.gm,
      proposalId: c.m[`${key}ContractProposal`],
      expectedRevision: 1,
      playerId,
      agentPersonId: agentFor(c.k.world, entityId(playerId), c.k.world.simDate),
      terms: opts.terms,
      roleCommitment: role,
      targetRosterStatus: target,
      priority: opts.priority ?? 0,
      contingencyGroupId: opts.group ?? null,
    }),
    {
      after: (c) => {
        c.m[`${key}Offer`] = lastOf(c.k.world.market.contractOffers);
      },
    },
  );
};

const offerRecord = (c: Context, key: string) => {
  const id = c.m[`${key}Offer`]!;
  return c.k.world.market.contractOffers
    .filter((x) => x.id === id)
    .sort((a, b) => a.revision - b.revision)
    .at(-1)!;
};

const signStep = (key: string, o: Org, expectStatus: string): void => {
  add(
    `${key}-sign`,
    (c) => {
      const offer = offerRecord(c, key);
      require_(
        offer.status === expectStatus,
        `${key}: offer is ${offer.status} (${offer.communicated.join(',')}), expected ${expectStatus}`,
      );
      return {
        type: 'CommitContractSigning',
        actingPersonId: o.gm,
        offerId: offer.id,
        offerRevision: offer.revision,
        expectedRevision: 1,
        beliefIds: [],
        evidenceClaimIds: [],
        rationale: { note: 'sign' },
      };
    },
    {
      before: (c) => {
        c.m[`cap:${key}SigningBefore2028`] = String(capNow(c.k, o.org, 2028));
      },
      after: (c) => {
        c.m[`cap:${key}SigningAfter2028`] = String(capNow(c.k, o.org, 2028));
      },
    },
  );
};

add('advance-to-free-agency', (c) => ({
  type: 'AdvanceDays',
  days: daysTo(c.k, '2027-03-10'),
}));
// Eastbrook's first choice and its fallback share a group; Westlake bids on the first choice.
offerFor('eb-fa01', EB, 'player-fa-01', {
  terms: termsOf(SECURE),
  priority: 0,
  group: 'eb-receiver',
});
offerFor('eb-fa02', EB, 'player-fa-02', {
  terms: termsOf(FRONT),
  priority: 5,
  group: 'eb-receiver',
});
offerFor('wl-fa01', WL, 'player-fa-01', {
  terms: termsOf({ ...SECURE, signing: 40_000 }),
  priority: 0,
});
add(
  'resolve-free-agency-1',
  { type: 'ResolveFreeAgencyMarket' },
  {
    after: (c) => {
      for (const key of ['eb-fa01', 'eb-fa02', 'wl-fa01'])
        c.m[`status:${key}`] = offerRecord(c, key).status;
    },
  },
);

signStep('wl-fa01', WL, 'accepted_pending_commit');
signStep('eb-fa02', EB, 'accepted_pending_commit');

// Second round: an extension of a rostered player and a practice-squad signing, both
// through the same offer, agent, reservation and cap path.
offerFor('eb-ext02', EB, 'player-eb-02', {
  terms: termsOf({ years: 4, base: 200_000, guaranteed: 100_000 }),
  priority: 0,
});
offerFor('sp-ps04', SP, 'player-fa-04', {
  terms: termsOf({ years: 1, base: 20_000 }),
  role: 'starter',
  target: 'practice_squad',
  priority: 0,
});
add('resolve-free-agency-2', { type: 'ResolveFreeAgencyMarket' });
signStep('eb-ext02', EB, 'accepted_pending_commit');
signStep('sp-ps04', SP, 'accepted_pending_commit');

// ============================ phase 7: the live draft =============================

add('advance-toward-draft', (c) => ({
  type: 'AdvanceDays',
  days: Math.min(30, daysTo(c.k, '2027-04-25')),
}));
add('advance-to-draft-day', (c) => ({
  type: 'AdvanceDays',
  days: daysTo(c.k, '2027-04-25'),
}));
add(
  'open-draft',
  (c) => ({
    type: 'OpenDraft',
    draftClassId: c.k.world.draft.classes[0]!.id,
  }),
  {
    after: (c) => {
      c.m.draftSession = c.k.world.draft.sessions[0]!.id;
    },
  },
);

// A live pick trade: the new owner, not the old one, is on the clock for the traded pick.
tradeFlow(
  'picktrade',
  NF,
  EB,
  () => pkg(NF.org, EB.org, [pickAsset(NF_PICK)], [pickAsset(EB_PICK)]),
  { commit: true, preview: true },
);

const onClock = (k: WorldKernel) => {
  const s = k.world.draft.sessions[0]!;
  return k.world.draft.picks.find(
    (p) => p.id === s.orderedPickIds[s.currentIndex],
  )!;
};
const choose = (c: Context, org: string) => {
  const klass = c.k.world.draft.classes[0]!;
  const taken = new Set(c.k.world.draft.selections.map((s) => s.playerId));
  const free = klass.eligiblePlayerIds.filter((p) => !taken.has(p));
  if (c.variant === 'alternate') return { playerId: free[0]!, boardId: null };
  const board = latestBoard(c.k.world, entityId(org), klass.id);
  const entry = board?.tiers
    .flatMap((t) => t.entries)
    .find((e) => free.includes(e.playerId));
  if (board !== undefined && entry !== undefined)
    return { playerId: entry.playerId as string, boardId: board.id as string };
  return { playerId: free[free.length - 1]! as string, boardId: null };
};
for (let i = 0; i < 12; i += 1) {
  const slot = String(i + 1).padStart(2, '0');
  add(
    `draft-${slot}-propose`,
    (c) => {
      const pick = onClock(c.k);
      const org = pick.ownerOrganizationId as string;
      const { playerId } = choose(c, org);
      return proposalCmd(
        org,
        GM_OF[org]!,
        'acquisition',
        [{ kind: 'entity', id: org }],
        DRAFT_SELECTION_TERMS_TYPE,
        { sessionId: c.m.draftSession, pickId: pick.id, playerId },
      );
    },
    {
      after: (c) => {
        c.m[`draftProposal${slot}`] = lastProposal(c.k);
      },
    },
  );
  add(
    `draft-${slot}-select`,
    (c) => {
      const pick = onClock(c.k);
      const org = pick.ownerOrganizationId as string;
      const { boardId } = choose(c, org);
      return {
        type: 'MakeDraftSelection',
        actingPersonId: GM_OF[org],
        proposalId: c.m[`draftProposal${slot}`],
        expectedRevision: 1,
        rationale: { note: 'draft' },
        ...(boardId === null ? {} : { boardRevisionId: boardId }),
      };
    },
    {
      after: (c) => {
        const sel = c.k.world.draft.selections.at(-1)!;
        if (sel.pickId === NF_PICK)
          require_(
            sel.organizationId === EB.org,
            'the traded pick must be used by its new owner',
          );
        c.m[`selection${slot}`] = sel.id;
      },
    },
  );
}

// ============================ phase 8: rookie and undrafted signings ==============

const rookieOwner = (k: WorldKernel) => {
  const sel = k.world.draft.selections.find((s) => s.playerId === PROSPECT);
  return sel === undefined
    ? undefined
    : { sel, org: sel.organizationId as string };
};
add(
  'rookie-contract-propose',
  (c) => {
    const { sel, org } = rookieOwner(c.k) ?? { sel: undefined, org: '' };
    require_(sel !== undefined, 'the board prospect should have been drafted');
    const round = c.k.world.draft.picks.find(
      (p) => p.id === sel!.pickId,
    )!.round;
    const rule = tx.draft.rookieContractByRound.find((r) => r.round === round)!;
    return proposalCmd(
      org,
      GM_OF[org]!,
      'contract',
      [{ kind: 'entity', id: PROSPECT }],
      CONTRACT_OFFER_TERMS_TYPE,
      contractOfferProposalTerms({
        playerId: entityId(PROSPECT),
        targetRosterStatus: 'active',
        roleCommitment: 'starter',
        terms: rookieScaleTerms(rule, 2027),
      }),
    );
  },
  {
    after: (c) => {
      c.m.rookieContractProposal = lastProposal(c.k);
    },
  },
);
add(
  'rookie-offer',
  (c) => {
    const { sel, org } = rookieOwner(c.k)!;
    const round = c.k.world.draft.picks.find((p) => p.id === sel.pickId)!.round;
    const rule = tx.draft.rookieContractByRound.find((r) => r.round === round)!;
    return {
      type: 'SubmitContractOffer',
      organizationId: org,
      actingPersonId: GM_OF[org],
      proposalId: c.m.rookieContractProposal,
      expectedRevision: 1,
      playerId: PROSPECT,
      agentPersonId: agentFor(c.k.world, entityId(PROSPECT), c.k.world.simDate),
      terms: rookieScaleTerms(rule, 2027),
      roleCommitment: 'starter',
      targetRosterStatus: 'active',
      priority: 0,
      contingencyGroupId: null,
    };
  },
  {
    after: (c) => {
      c.m.rookieOffer = lastOf(c.k.world.market.contractOffers);
    },
  },
);

// An undrafted player is an ordinary free agent once the draft is complete.
const undrafted = (k: WorldKernel): string => {
  const taken = new Set(k.world.draft.selections.map((s) => s.playerId));
  return k.world.draft.classes[0]!.eligiblePlayerIds.find(
    (p) => !taken.has(p),
  )!;
};
add(
  'udfa-contract-propose',
  (c) => {
    const player = undrafted(c.k);
    c.m.udfaPlayer = player;
    return proposalCmd(
      SP.org,
      SP.gm,
      'contract',
      [{ kind: 'entity', id: player }],
      CONTRACT_OFFER_TERMS_TYPE,
      contractOfferProposalTerms({
        playerId: entityId(player),
        targetRosterStatus: 'active',
        roleCommitment: 'starter',
        terms: termsOf(SECURE),
      }),
    );
  },
  {
    after: (c) => {
      c.m.udfaContractProposal = lastProposal(c.k);
    },
  },
);
add(
  'udfa-offer',
  (c) => ({
    type: 'SubmitContractOffer',
    organizationId: SP.org,
    actingPersonId: SP.gm,
    proposalId: c.m.udfaContractProposal,
    expectedRevision: 1,
    playerId: c.m.udfaPlayer,
    agentPersonId: agentFor(
      c.k.world,
      entityId(c.m.udfaPlayer!),
      c.k.world.simDate,
    ),
    terms: termsOf(SECURE),
    roleCommitment: 'starter',
    targetRosterStatus: 'active',
    priority: 0,
    contingencyGroupId: null,
  }),
  {
    after: (c) => {
      c.m.udfaOffer = lastOf(c.k.world.market.contractOffers);
    },
  },
);
add('resolve-free-agency-3', { type: 'ResolveFreeAgencyMarket' });

const commitById = (c: Context, offerKey: string, by: string): Command => {
  const offer = offerRecord(c, offerKey);
  require_(
    offer.status === 'accepted_pending_commit',
    `${offerKey}: offer is ${offer.status}`,
  );
  return {
    type: 'CommitContractSigning',
    actingPersonId: by,
    offerId: offer.id,
    offerRevision: offer.revision,
    expectedRevision: 1,
    beliefIds: [],
    evidenceClaimIds: [],
    rationale: { note: 'sign' },
  };
};
add('rookie-sign', (c) =>
  commitById(c, 'rookie', GM_OF[rookieOwner(c.k)!.org]!),
);
add('udfa-sign', (c) => commitById(c, 'udfa', SP.gm));

// ============================ phase 9: attempts that must fail cleanly ============

add(
  'replay-udfa-sign',
  (c) => {
    const offer = offerRecord(c, 'udfa');
    return {
      type: 'CommitContractSigning',
      actingPersonId: SP.gm,
      offerId: offer.id,
      offerRevision: offer.revision,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'sign again' },
    };
  },
  { expect: 'INVALID_PAYLOAD' },
);
add(
  'late-selection-after-draft',
  (c) => ({
    type: 'MakeDraftSelection',
    actingPersonId:
      GM_OF[
        c.k.world.decisions.proposals.find((p) => p.id === c.m.draftProposal12)!
          .organizationId as string
      ],
    proposalId: c.m.draftProposal12,
    expectedRevision: 1,
    rationale: { note: 'too late' },
  }),
  { expect: 'INVALID_PAYLOAD' },
);
add(
  'stale-revision-advance',
  { type: 'AdvanceDays', days: 1 },
  {
    expect: 'STALE_REVISION',
    staleRevision: true,
  },
);

export const PACKAGE_C_STEPS: readonly StepSpec[] = steps;
