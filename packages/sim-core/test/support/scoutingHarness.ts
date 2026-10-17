import type { ExecuteResult } from '../../src/index';
import { okResult, type Runner } from './orgHarness';

export const NF_SCOUT = 'person-nf-scout';
export const EB_SCOUT = 'person-eb-scout';
export const NF_PICK = 'pick-2027-r1-s4';
export const EB_PICK = 'pick-2027-r2-s2';
export const PROSPECT = 'player-pr-01';

export type ClaimSpec = {
  org: string;
  by: string;
  player?: string;
  dimension: string;
  signal: 'positive' | 'negative' | 'mixed';
  family: string;
  confidence?: string;
  visibility?: 'public' | 'organization' | 'restricted';
};

/** Records an observation claim through Package B and returns its id. */
export const recordObservation = (r: Runner, s: ClaimSpec): string => {
  okResult(
    r.run({
      type: 'RecordClaim',
      organizationId: s.org,
      actingPersonId: s.by,
      subject: { kind: 'entity', id: s.player ?? PROSPECT },
      propositionType: 'prospect_observation',
      proposition: { dimension: s.dimension, signal: s.signal },
      sourceFamilyId: s.family,
      observedAt: r.kernel.world.simDate,
      visibility: s.visibility ?? 'organization',
      confidence: s.confidence ?? 'medium',
      possibleBias: null,
      corroboratesClaimIds: [],
      contradictsClaimIds: [],
    }),
  );
  return r.kernel.world.information.claims.at(-1)!.id;
};

export const askQuestion = (
  r: Runner,
  org: string,
  by: string,
  overrides: Record<string, unknown> = {},
): ExecuteResult =>
  r.run({
    type: 'AskScoutingQuestion',
    organizationId: org,
    actingPersonId: by,
    playerId: PROSPECT,
    questionKey: 'can_start_in_year_one',
    dimensions: ['burst', 'processing'],
    decisionContext: { kind: 'draft_selection', pickId: NF_PICK },
    ...overrides,
  });

export const lastQuestionId = (r: Runner): string =>
  r.kernel.world.scouting.questions.at(-1)!.id;

export const assignWork = (
  r: Runner,
  by: string,
  questionId: string,
  evaluator: string,
  evidence: string[],
  overrides: Record<string, unknown> = {},
): ExecuteResult =>
  r.run({
    type: 'AssignScoutingEvaluation',
    actingPersonId: by,
    questionId,
    evaluatorPersonId: evaluator,
    evidenceClaimIds: evidence,
    ...overrides,
  });

export const resolveWork = (
  r: Runner,
  by: string,
  assignmentId: string,
): ExecuteResult =>
  r.run({
    type: 'ResolveScoutingAssignment',
    actingPersonId: by,
    assignmentId,
  });

export const lastAssignmentId = (r: Runner): string =>
  r.kernel.world.scouting.assignments.at(-1)!.id;

/** Ask, assign, wait a day and resolve. Returns the new report. */
export const scoutOnce = (
  r: Runner,
  org: string,
  by: string,
  evidence: string[],
  overrides: Record<string, unknown> = {},
  questionId?: string,
) => {
  let qid = questionId;
  if (qid === undefined) {
    okResult(askQuestion(r, org, by, overrides));
    qid = lastQuestionId(r);
  }
  okResult(assignWork(r, by, qid, by, evidence));
  okResult(r.run({ type: 'AdvanceDays', days: 1 }));
  okResult(resolveWork(r, by, lastAssignmentId(r)));
  return r.kernel.world.scouting.reports.at(-1)!;
};
