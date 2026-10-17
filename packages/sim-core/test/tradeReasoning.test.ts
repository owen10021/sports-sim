import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_C_RULESET,
  activeRightsFor,
  buildAcquisitionDecisionView,
  entityId,
  evaluateTradeForOrganization,
  inquiryBandFor,
  recordId,
  requireTransactionRules,
  type AcquisitionAssetRef,
  type AcquisitionDecisionView,
  type FootballWorld,
  type TradePackageV1,
} from '../src/index';
import {
  NF,
  compose,
  newKernelWith,
  newPackageCKernel,
  postureOnlyPlan,
  tierBelief,
  withBeliefs,
  withPlans,
} from './support/packageCHarness';

const TX = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
const TODAY = '2027-02-15';
const EB = { org: 'org-eastbrook', gm: 'person-eb-gm' };
const WL = { org: 'org-westlake', gm: 'person-wl-gm' };

const rights = (w: FootballWorld, playerId: string): AcquisitionAssetRef => {
  const r = activeRightsFor(w.roster, entityId(playerId), TODAY)[0]!;
  return { kind: 'player_rights', playerId: r.playerId, rightsId: r.id };
};
const pick = (id: string): AcquisitionAssetRef => ({
  kind: 'draft_pick',
  pickId: recordId(id),
});
const pkg = (
  a: readonly AcquisitionAssetRef[],
  b: readonly AcquisitionAssetRef[],
): TradePackageV1 => ({
  organizationAId: entityId(NF.org),
  organizationBId: entityId(EB.org),
  assetsFromA: a,
  assetsFromB: b,
  validity: { expiresAt: null },
  contingencies: {},
});
const viewOf = (
  w: FootballWorld,
  org = EB.org,
  person = EB.gm,
  tx = TX,
): AcquisitionDecisionView => {
  const r = buildAcquisitionDecisionView(
    w,
    entityId(org),
    entityId(person),
    tx,
  );
  if (!r.ok) throw new Error(r.reason);
  return r.view;
};
const codes = (e: { reasons: readonly { code: string }[] }) =>
  e.reasons.map((r) => r.code).sort();

const ebWorld = (
  window: string | null,
  ...beliefs: ReturnType<typeof tierBelief>[]
) =>
  newKernelWith(
    compose(
      withBeliefs(...beliefs),
      window === null
        ? (w) => w
        : withPlans(postureOnlyPlan(EB.org, EB.gm, window)),
    ),
  ).world;

describe('contextual trade reasoning', () => {
  it('answers the same package differently for a contender and a rebuilder', () => {
    // Northfield sends a first-round pick; Eastbrook sends an active offensive lineman.
    const base = newPackageCKernel().world;
    const p = pkg([pick('pick-2027-r1-s4')], [rights(base, 'player-eb-01')]);
    const rebuild = evaluateTradeForOrganization(viewOf(ebWorld('rebuild')), p);
    const contend = evaluateTradeForOrganization(viewOf(ebWorld('contend')), p);
    expect(rebuild.disposition).toBe('accept');
    expect(codes(rebuild)).toEqual(['ADDS_PREMIUM_CAPITAL']);
    expect(contend.disposition).toBe('reject');
    expect(codes(contend)).toEqual(['WEAKENS_CURRENT_ROSTER']);
  });

  it('diverges the other way for a player a contender wants', () => {
    // Northfield sends a 29-year-old lineman Eastbrook rates a target, for a second-round pick.
    const base = newPackageCKernel().world;
    const p = pkg([rights(base, 'player-nf-02')], [pick('pick-2027-r2-s2')]);
    const belief = tierBelief(EB.org, EB.gm, 'player-nf-02', 'target');
    const contend = evaluateTradeForOrganization(
      viewOf(ebWorld('contend', belief)),
      p,
    );
    const rebuild = evaluateTradeForOrganization(
      viewOf(ebWorld('rebuild', belief)),
      p,
    );
    expect(contend.disposition).toBe('accept');
    expect(codes(contend)).toEqual(['WANTED_PLAYER']);
    expect(rebuild.disposition).toBe('counter');
    expect(codes(rebuild)).toEqual([
      'AGING_ACQUISITION',
      'SPENDS_PREMIUM_CAPITAL',
      'WANTED_PLAYER',
    ]);
  });

  it('counters when its plan likes part of the package and its own evaluation resists another part', () => {
    const base = newPackageCKernel().world;
    const p = pkg([pick('pick-2027-r1-s4')], [rights(base, 'player-eb-01')]);
    const core = tierBelief(EB.org, EB.gm, 'player-eb-01', 'target');
    const e = evaluateTradeForOrganization(viewOf(ebWorld('rebuild', core)), p);
    expect(e.disposition).toBe('counter');
    expect(codes(e)).toEqual(['ADDS_PREMIUM_CAPITAL', 'KEEP_CORE_PLAYER']);
  });

  it('defers rather than guessing when it has no evaluation of an incoming player', () => {
    const base = newPackageCKernel().world;
    const e = evaluateTradeForOrganization(
      viewOf(ebWorld(null)),
      pkg([rights(base, 'player-nf-03')], []),
    );
    expect(e.disposition).toBe('defer');
    expect(e.uncertainties).toEqual(
      expect.arrayContaining(['NO_EVALUATION:player-nf-03']),
    );
  });

  it('rejects what its own cap or roster cannot hold', () => {
    const base = newPackageCKernel().world;
    const incoming = pkg([rights(base, 'player-nf-03')], []);
    const tightCap = {
      ...TX,
      seasonRules: TX.seasonRules.map((s) => ({
        ...s,
        salaryCap: 1_085_000 as never,
      })),
    };
    const capped = evaluateTradeForOrganization(
      viewOf(
        ebWorld(null, tierBelief(EB.org, EB.gm, 'player-nf-03', 'target')),
        EB.org,
        EB.gm,
        tightCap,
      ),
      incoming,
    );
    expect(capped.disposition).toBe('reject');
    expect(codes(capped)).toEqual(['CAP_INFEASIBLE']);
    const tightRoster = {
      ...TX,
      seasonRules: TX.seasonRules.map((s) => ({ ...s, activeRosterLimit: 3 })),
    };
    const crowded = evaluateTradeForOrganization(
      viewOf(ebWorld(null), EB.org, EB.gm, tightRoster),
      incoming,
    );
    expect(codes(crowded)).toEqual(['ROSTER_INFEASIBLE']);
  });

  it('honours a hard keep-player constraint in its own plan', () => {
    const base = newPackageCKernel().world;
    const plan = postureOnlyPlan(EB.org, EB.gm, 'rebuild');
    const constrained = {
      ...plan,
      revisions: [
        {
          ...plan.revisions[0]!,
          constraints: [
            {
              key: 'keep_player',
              kind: 'hard' as const,
              value: 'player-eb-01',
            },
          ],
        },
      ],
    };
    const w = newKernelWith(withPlans(constrained)).world;
    const e = evaluateTradeForOrganization(
      viewOf(w),
      pkg([pick('pick-2027-r1-s4')], [rights(base, 'player-eb-01')]),
    );
    expect(e.disposition).toBe('reject');
    expect(codes(e)).toEqual(['PLAN_HARD_CONSTRAINT']);
  });

  it('is not a party to a package between other clubs', () => {
    const base = newPackageCKernel().world;
    const e = evaluateTradeForOrganization(
      viewOf(base, WL.org, WL.gm),
      pkg([pick('pick-2027-r1-s4')], []),
    );
    expect(codes(e)).toEqual(['NOT_A_PARTY']);
  });

  it('produces no number, score or value anywhere in its result', () => {
    const base = newPackageCKernel().world;
    const e = evaluateTradeForOrganization(
      viewOf(ebWorld('rebuild')),
      pkg([pick('pick-2027-r1-s4')], [rights(base, 'player-eb-01')]),
    );
    expect(Object.keys(e).sort()).toEqual([
      'disposition',
      'reasons',
      'uncertainties',
    ]);
    const numbers: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'number') numbers.push(path);
      if (typeof v === 'object' && v !== null)
        for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(e, 'result');
    expect(numbers).toEqual([]);
    expect(JSON.stringify(e)).not.toMatch(/score|value|rating|worth/i);
  });

  it('is unchanged by the private state of rival clubs', () => {
    const base = newPackageCKernel().world;
    const p = pkg([pick('pick-2027-r1-s4')], [rights(base, 'player-eb-01')]);
    const quiet = ebWorld('rebuild');
    const noisy = newKernelWith(
      compose(
        withPlans(postureOnlyPlan(EB.org, EB.gm, 'rebuild')),
        withBeliefs(tierBelief(WL.org, WL.gm, 'player-eb-01', 'priority')),
        withPlans(postureOnlyPlan(WL.org, WL.gm, 'contend', 'plan-wl-private')),
      ),
    ).world;
    expect(evaluateTradeForOrganization(viewOf(noisy), p)).toEqual(
      evaluateTradeForOrganization(viewOf(quiet), p),
    );
  });
});

describe('inquiryBandFor', () => {
  const asset = (w: FootballWorld): AcquisitionAssetRef =>
    rights(w, 'player-eb-01');

  it('tells the seller of a player how interested the club is, from its own tier', () => {
    const w = newPackageCKernel().world;
    const band = (tier: string | null) =>
      inquiryBandFor(
        viewOf(
          ebWorld(
            null,
            ...(tier === null
              ? []
              : [tierBelief(EB.org, EB.gm, 'player-eb-01', tier)]),
          ),
        ),
        asset(w),
        'shop',
      );
    expect(band('priority')).toBe('priority');
    expect(band('target')).toBe('interested');
    expect(band('depth')).toBe('open');
    expect(band('avoid')).toBe('none');
    expect(band(null)).toBe('none');
  });

  it('says nothing that separates a protected player from an unevaluated one when asked to sell', () => {
    const w = newPackageCKernel().world;
    const core = inquiryBandFor(
      viewOf(
        ebWorld(null, tierBelief(EB.org, EB.gm, 'player-eb-01', 'priority')),
      ),
      asset(w),
      'seek',
    );
    const unknown = inquiryBandFor(viewOf(ebWorld(null)), asset(w), 'seek');
    expect(core).toBe('none');
    expect(unknown).toBe('none');
  });
});
