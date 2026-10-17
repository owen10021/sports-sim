import { describe, expect, it } from 'vitest';
import {
  buildOrganizationKnowledgeView,
  buildScoutingView,
  entityId,
  interpretEvidence,
  recordId,
  type ClaimRecord,
  type EvaluatorLens,
} from '../src/index';
import { newPackageCKernel } from './support/packageCHarness';
import {
  NF,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';
import {
  EB_PICK,
  EB_SCOUT,
  NF_SCOUT,
  PROSPECT,
  askQuestion,
  assignWork,
  lastAssignmentId,
  lastQuestionId,
  recordObservation,
  resolveWork,
  scoutOnce,
} from './support/scoutingHarness';

const fresh = () => runnerFor(newPackageCKernel());
const EB = { org: 'org-eastbrook' };

const claim = (
  id: string,
  dimension: string,
  signal: string,
  family: string,
  confidence: ClaimRecord['confidence'] = 'medium',
): ClaimRecord => ({
  id: recordId(id),
  subject: { kind: 'entity', id: PROSPECT },
  propositionType: 'prospect_observation',
  proposition: { dimension, signal },
  sourcePersonId: entityId(NF_SCOUT),
  sourceFamilyId: family,
  observedAt: '2027-02-15',
  acquiredAt: '2027-02-15',
  visibility: 'public',
  holderOrganizationIds: [],
  confidence,
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
  sharedFromClaimId: null,
});

const LENS: EvaluatorLens = {
  strongDimensions: [],
  weakDimensions: [],
  riskTolerance: 'medium',
};

describe('interpreting evidence through a lens', () => {
  it('counts independent source families, not claims', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      claim(`rec-8000${i}0`, 'burst', 'positive', 'family-film', 'very_high'),
    );
    const one = interpretEvidence(['burst'], many, LENS);
    expect(one.dimensions[0]).toMatchObject({
      status: 'positive',
      independentFamilies: 1,
      confidence: 'medium',
    });
    const two = interpretEvidence(
      ['burst'],
      [
        ...many,
        claim('rec-800090', 'burst', 'positive', 'family-timing', 'very_high'),
      ],
      LENS,
    );
    expect(two.dimensions[0]).toMatchObject({
      independentFamilies: 2,
      confidence: 'high',
    });
    expect(two.independentFamilyCount).toBe(2);
  });

  it('needs independent corroboration for a dimension the evaluator reads poorly', () => {
    const claims = [claim('rec-800001', 'burst', 'positive', 'family-film')];
    const weak: EvaluatorLens = { ...LENS, weakDimensions: ['burst'] };
    expect(
      interpretEvidence(['burst'], claims, weak).dimensions[0]!.status,
    ).toBe('discounted');
    const corroborated = [
      ...claims,
      claim('rec-800002', 'burst', 'positive', 'family-timing'),
    ];
    expect(
      interpretEvidence(['burst'], corroborated, weak).dimensions[0]!.status,
    ).toBe('positive');
  });

  it('treats disagreeing sources as a conflict, never an average', () => {
    const r = interpretEvidence(
      ['burst'],
      [
        claim('rec-800001', 'burst', 'positive', 'family-film'),
        claim('rec-800002', 'burst', 'negative', 'family-timing'),
      ],
      LENS,
    );
    expect(r.reading).toBe('mixed');
    expect(r.unresolvedQuestionKeys).toEqual(['conflict:burst']);
    expect(r.confidence).toBe('very_low');
  });

  it('lets risk tolerance decide whether to lean on partial evidence', () => {
    const claims = [claim('rec-800001', 'burst', 'positive', 'family-film')];
    const dims = ['burst', 'processing'];
    const read = (risk: EvaluatorLens['riskTolerance']) =>
      interpretEvidence(dims, claims, { ...LENS, riskTolerance: risk }).reading;
    expect(read('low')).toBe('insufficient');
    expect(read('medium')).toBe('supports');
    expect(read('high')).toBe('supports');
    const none = interpretEvidence(dims, [], {
      ...LENS,
      riskTolerance: 'high',
    });
    expect(none.reading).toBe('insufficient');
    expect(none.confidence).toBe('very_low');
  });

  it('is a pure function: the same inputs always give the same answer', () => {
    const claims = [
      claim('rec-800001', 'burst', 'positive', 'family-film'),
      claim('rec-800002', 'processing', 'negative', 'family-timing'),
    ];
    expect(interpretEvidence(['burst', 'processing'], claims, LENS)).toEqual(
      interpretEvidence(['burst', 'processing'], [...claims].reverse(), LENS),
    );
  });
});

describe('the scouting workflow', () => {
  it('asks a decision-relevant question, assigns visible evidence, and files a Package B belief', () => {
    const r = fresh();
    const c1 = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'processing',
      signal: 'positive',
      family: 'family-nf-film',
    });
    const q = okResult(askQuestion(r, NF.org, NF_SCOUT));
    expect(q.events.map((e) => e.type)).toEqual(['ScoutingQuestionAsked']);
    const qid = lastQuestionId(r);
    okResult(assignWork(r, NF_SCOUT, qid, NF_SCOUT, [c1]));
    // Work takes logical time: it is not due the day it is assigned.
    expect(messageOf(resolveWork(r, NF_SCOUT, lastAssignmentId(r)))).toContain(
      'not due until',
    );
    okResult(r.run({ type: 'AdvanceDays', days: 1 }));
    const drawsBeforeWork = r.kernel.world.rng.draws;
    const res = okResult(resolveWork(r, NF_SCOUT, lastAssignmentId(r)));
    expect(res.events.map((e) => e.type)).toEqual(['ScoutingReportFiled']);
    const w = r.kernel.world;
    const report = w.scouting.reports[0]!;
    const belief = w.information.beliefs.find((b) => b.id === report.beliefId)!;
    expect(belief).toMatchObject({
      organizationId: NF.org,
      authorPersonId: NF_SCOUT,
      assessmentType: 'scouting_assessment',
      evidenceClaimIds: [c1],
    });
    expect(report.evidenceClaimIds).toEqual([c1]);
    expect(w.scouting.questions[0]!.status).toBe('answered');
    // It reads through the ordinary Package B knowledge view, with source families.
    const view = buildOrganizationKnowledgeView(
      w,
      entityId(NF.org),
      entityId(NF_SCOUT),
    );
    expect(
      view.beliefs.find((b) => b.id === belief.id)!.evidenceSourceFamilyIds,
    ).toEqual(['family-nf-film']);
    // Scouting work draws no randomness.
    expect(w.rng.draws).toBe(drawsBeforeWork);
  });

  it('refuses a question that serves no real decision', () => {
    const r = fresh();
    const ask = (decisionContext: unknown) =>
      messageOf(askQuestion(r, NF.org, NF_SCOUT, { decisionContext }));
    expect(ask(undefined)).toContain('decisionContext');
    expect(ask({ kind: 'curiosity' })).toContain('decisionContext.kind');
    // A pick the club does not own.
    expect(ask({ kind: 'draft_selection', pickId: EB_PICK })).toContain(
      'this organization owns',
    );
    // The prospect is not a free agent or on a roster.
    expect(ask({ kind: 'free_agent_signing' })).not.toBe('');
    expect(ask({ kind: 'roster_decision' })).toContain('not under');
    expect(ask({ kind: 'trade_target' })).toContain('not held by another');
    expect(r.kernel.world.scouting.questions).toHaveLength(0);
    // A real free agent, a real trade target and a real roster player are all decisions.
    okResult(
      askQuestion(r, NF.org, NF_SCOUT, {
        playerId: 'player-fa-01',
        questionKey: 'fa',
        decisionContext: { kind: 'free_agent_signing' },
      }),
    );
    okResult(
      askQuestion(r, NF.org, NF_SCOUT, {
        playerId: 'player-eb-01',
        questionKey: 'tr',
        decisionContext: { kind: 'trade_target' },
      }),
    );
    okResult(
      askQuestion(r, NF.org, NF_SCOUT, {
        playerId: 'player-nf-01',
        questionKey: 'ro',
        decisionContext: { kind: 'roster_decision' },
      }),
    );
  });

  it('is not a progress meter: an answered question is not asked again without new evidence', () => {
    const r = fresh();
    const a = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f1',
    });
    const b = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'processing',
      signal: 'positive',
      family: 'f2',
    });
    scoutOnce(r, NF.org, NF_SCOUT, [a, b]);
    const belief = r.kernel.world.information.beliefs.at(-1)!;
    expect(belief.confidence).toBe('medium');
    const before = snapshotOf(r.kernel);
    expect(messageOf(askQuestion(r, NF.org, NF_SCOUT))).toContain(
      'would learn nothing',
    );
    expect(snapshotOf(r.kernel)).toEqual(before);
    // New evidence arrives: now there is something to learn.
    recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f3',
    });
    okResult(askQuestion(r, NF.org, NF_SCOUT));
  });

  it('does not reroll: the same evaluator on the same evidence is refused', () => {
    const r = fresh();
    const a = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f1',
    });
    scoutOnce(r, NF.org, NF_SCOUT, [a], { dimensions: ['burst'] });
    const drawsBefore = r.kernel.world.rng.draws;
    const qid = r.kernel.world.scouting.questions[0]!.id;
    const again = assignWork(r, NF_SCOUT, qid, NF_SCOUT, [a]);
    expect(messageOf(again)).toContain('cannot change the answer');
    expect(r.kernel.world.scouting.reports).toHaveLength(1);
    expect(r.kernel.world.rng.draws).toBe(drawsBefore);
  });

  it('keeps one source family one voice however often it is re-read', () => {
    const r = fresh();
    const ids = ['processing', 'processing', 'processing'].map((d, i) =>
      recordObservation(r, {
        org: NF.org,
        by: NF_SCOUT,
        dimension: d,
        signal: 'positive',
        family: 'family-film',
        confidence: i === 0 ? 'very_high' : 'high',
      }),
    );
    scoutOnce(r, NF.org, NF_SCOUT, ids, { dimensions: ['processing'] });
    const belief = r.kernel.world.information.beliefs.at(-1)!;
    expect(belief.confidence).toBe('medium');
    expect(
      (belief.assessment as { independentFamilyCount: number })
        .independentFamilyCount,
    ).toBe(1);
  });

  it('lets two organizations rationally disagree about the same public evidence', () => {
    const r = fresh();
    // Public observations, each from a single source family.
    const burst = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'family-timing',
      visibility: 'public',
    });
    const proc = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'processing',
      signal: 'positive',
      family: 'family-film',
      visibility: 'public',
    });
    const nf = scoutOnce(r, NF.org, NF_SCOUT, [burst, proc]);
    const eb = scoutOnce(r, EB.org, EB_SCOUT, [burst, proc], {
      decisionContext: { kind: 'draft_selection', pickId: EB_PICK },
    });
    const read = (reportId: string) => {
      const rep = r.kernel.world.scouting.reports.find(
        (x) => x.id === reportId,
      )!;
      return r.kernel.world.information.beliefs.find(
        (b) => b.id === rep.beliefId,
      )!.assessment as {
        reading: string;
        unresolvedQuestionKeys: string[];
      };
    };
    // Northfield reads processing well and burst poorly; Eastbrook the reverse and is cautious.
    expect(read(nf.id).reading).toBe('supports');
    expect(read(nf.id).unresolvedQuestionKeys).toEqual(['dimension:burst']);
    expect(read(eb.id).reading).toBe('insufficient');
    expect(read(eb.id).unresolvedQuestionKeys).toEqual([
      'dimension:processing',
    ]);
  });

  it('keeps old reports immutable when new evidence supersedes the belief', () => {
    const r = fresh();
    const burst = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'family-timing',
    });
    const proc = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'processing',
      signal: 'positive',
      family: 'family-film',
    });
    const first = scoutOnce(r, NF.org, NF_SCOUT, [burst, proc]);
    const frozenReport = JSON.stringify(first);
    const frozenBelief = JSON.stringify(
      r.kernel.world.information.beliefs.find((b) => b.id === first.beliefId),
    );
    const burst2 = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'negative',
      family: 'family-film2',
    });
    okResult(
      askQuestion(r, NF.org, NF_SCOUT, {
        questionKey: 'can_start_in_year_one',
      }),
    );
    const second = scoutOnce(
      r,
      NF.org,
      NF_SCOUT,
      [burst, proc, burst2],
      {},
      lastQuestionId(r),
    );
    const w = r.kernel.world;
    expect(second.id).not.toBe(first.id);
    expect(
      JSON.stringify(w.scouting.reports.find((x) => x.id === first.id)),
    ).toBe(frozenReport);
    expect(
      JSON.stringify(
        w.information.beliefs.find((b) => b.id === first.beliefId),
      ),
    ).toBe(frozenBelief);
    const newBelief = w.information.beliefs.find(
      (b) => b.id === second.beliefId,
    )!;
    expect(newBelief.supersedesBeliefId).toBe(first.beliefId);
    const view = buildOrganizationKnowledgeView(
      w,
      entityId(NF.org),
      entityId(NF_SCOUT),
    );
    expect(
      view.beliefs.find((b) => b.id === first.beliefId)!.supersededByBeliefId,
    ).toBe(newBelief.id);
  });
});

describe('who may do the work', () => {
  it('needs a role and advise authority in the organization', () => {
    const r = fresh();
    expect(askQuestion(r, NF.org, 'person-agent-ashby').ok).toBe(false);
    expect(askQuestion(r, NF.org, 'person-sp-scout').ok).toBe(false);
    expect(r.kernel.world.scouting.questions).toHaveLength(0);
  });

  it('cannot assign evidence the evaluator may not see; a hidden claim looks missing', () => {
    const r = fresh();
    const mine = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f1',
    });
    okResult(
      askQuestion(r, EB.org, EB_SCOUT, {
        decisionContext: { kind: 'draft_selection', pickId: EB_PICK },
      }),
    );
    const res = assignWork(r, EB_SCOUT, lastQuestionId(r), EB_SCOUT, [mine]);
    expect(messageOf(res)).toContain('not available');
    expect(
      messageOf(
        assignWork(r, EB_SCOUT, lastQuestionId(r), EB_SCOUT, ['rec-999999']),
      ),
    ).toContain('not available');
  });

  it('needs evidence that actually speaks to the question', () => {
    const r = fresh();
    const off = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'hands',
      signal: 'positive',
      family: 'f1',
    });
    okResult(askQuestion(r, NF.org, NF_SCOUT));
    expect(
      messageOf(assignWork(r, NF_SCOUT, lastQuestionId(r), NF_SCOUT, [off])),
    ).toContain('says nothing about');
    expect(
      messageOf(assignWork(r, NF_SCOUT, lastQuestionId(r), NF_SCOUT, [])),
    ).toContain('at least one');
  });

  it('scouting work is private to the organization that did it', () => {
    const r = fresh();
    const a = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f1',
    });
    scoutOnce(r, NF.org, NF_SCOUT, [a], { dimensions: ['burst'] });
    const w = r.kernel.world;
    const own = buildScoutingView(w, entityId(NF.org), entityId(NF_SCOUT));
    expect(own.reports).toHaveLength(1);
    expect(own.reports[0]!.evidenceClaimIds).toEqual([a]);
    const rival = buildScoutingView(w, entityId(EB.org), entityId(EB_SCOUT));
    expect(rival.questions).toHaveLength(0);
    expect(rival.reports).toHaveLength(0);
    // Asking for another organization's work as an outsider returns nothing either.
    const outsider = buildScoutingView(w, entityId(NF.org), entityId(EB_SCOUT));
    expect(outsider.questions).toHaveLength(0);
  });
});
