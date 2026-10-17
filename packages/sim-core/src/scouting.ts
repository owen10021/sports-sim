import type { ClaimRecord, ConfidenceBand } from './information';
import { entityId, type EntityId, type RecordId } from './ids';
import type { PackageCSubstrateSeed } from './packageCSeedParse';
import type { PreferenceLevel } from './market';

/**
 * Draft & Scouting domain: scouting state (Package C). Evaluator lenses, questions,
 * assignments and report links. Evidence and beliefs stay in Package B's information
 * domain; this state never becomes a second evidence store: a report only LINKS the claims
 * it read and the belief it formed.
 *
 * Nothing in this module can see a player's latent capabilities. Interpretation is a pure
 * function of visible claims and the evaluator's lens.
 */

/** A small scouting lens: which dimensions an evaluator reads well or poorly, and risk appetite. */
export type ScoutEvaluatorProfile = {
  readonly personId: EntityId;
  readonly strongDimensions: readonly string[];
  readonly weakDimensions: readonly string[];
  readonly riskTolerance: PreferenceLevel;
};

export const SCOUTING_CONTEXT_KINDS = [
  'draft_selection',
  'free_agent_signing',
  'trade_target',
  'roster_decision',
] as const;
export type ScoutingContextKind = (typeof SCOUTING_CONTEXT_KINDS)[number];

/** The real decision a question serves. Without one there is nothing to scout for. */
export type ScoutingDecisionContext = {
  readonly kind: ScoutingContextKind;
  /** The draft pick the question serves; only for `draft_selection`. */
  readonly pickId: RecordId | null;
};

export const SCOUTING_QUESTION_STATUSES = ['open', 'answered'] as const;
export type ScoutingQuestionStatus =
  (typeof SCOUTING_QUESTION_STATUSES)[number];

export type ScoutingQuestion = {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly questionKey: string;
  /** The capability dimensions the question turns on. */
  readonly dimensions: readonly string[];
  readonly decisionContext: ScoutingDecisionContext;
  readonly createdByPersonId: EntityId;
  readonly createdAt: string;
  readonly status: ScoutingQuestionStatus;
};

export const SCOUTING_ASSIGNMENT_STATUSES = ['assigned', 'resolved'] as const;
export type ScoutingAssignmentStatus =
  (typeof SCOUTING_ASSIGNMENT_STATUSES)[number];

export type ScoutingAssignment = {
  readonly id: RecordId;
  readonly questionId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly evaluatorPersonId: EntityId;
  /** The visible claims the evaluator is asked to read, sorted. */
  readonly evidenceClaimIds: readonly RecordId[];
  readonly requestedAt: string;
  readonly dueAt: string;
  readonly status: ScoutingAssignmentStatus;
  readonly resolvedReportId: RecordId | null;
};

/** Links the knowledge a piece of work produced; the assessment itself lives in the belief. */
export type ScoutingReport = {
  readonly id: RecordId;
  readonly assignmentId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly evaluatorPersonId: EntityId;
  readonly questionId: RecordId;
  readonly evidenceClaimIds: readonly RecordId[];
  readonly beliefId: RecordId;
  readonly unresolvedQuestionKeys: readonly string[];
  readonly formedAt: string;
};

export type ScoutingState = {
  readonly evaluatorProfiles: readonly ScoutEvaluatorProfile[];
  readonly questions: readonly ScoutingQuestion[];
  readonly assignments: readonly ScoutingAssignment[];
  readonly reports: readonly ScoutingReport[];
};

export const emptyScoutingState = (): ScoutingState => ({
  evaluatorProfiles: [],
  questions: [],
  assignments: [],
  reports: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Initial scouting state from the seed's Package C block, in canonical order. */
export const seededScoutingState = (
  sub: PackageCSubstrateSeed | undefined,
): ScoutingState => {
  if (sub === undefined) return emptyScoutingState();
  return {
    ...emptyScoutingState(),
    evaluatorProfiles: sub.evaluatorProfiles
      .map((e): ScoutEvaluatorProfile => ({
        personId: entityId(e.personId),
        strongDimensions: [...e.strongDimensions].sort(byText),
        weakDimensions: [...e.weakDimensions].sort(byText),
        riskTolerance: e.riskTolerance,
      }))
      .sort((a, b) => byText(a.personId, b.personId)),
  };
};

// --- interpretation ------------------------------------------------------------

/** The assessment type scouting beliefs use in Package B's belief records. */
export const SCOUTING_ASSESSMENT = 'scouting_assessment';
/** The claim convention scouting reads: `{ dimension, signal }`. */
export const OBSERVATION_SIGNALS = ['positive', 'negative', 'mixed'] as const;
export type ObservationSignal = (typeof OBSERVATION_SIGNALS)[number];

export const READINGS = [
  'supports',
  'against',
  'mixed',
  'insufficient',
] as const;
export type Reading = (typeof READINGS)[number];

export const DIMENSION_STATUSES = [
  'positive',
  'negative',
  'conflict',
  'discounted',
  'no_evidence',
] as const;
export type DimensionStatus = (typeof DIMENSION_STATUSES)[number];

export type DimensionReading = {
  readonly dimension: string;
  readonly status: DimensionStatus;
  /** Distinct independent source families that spoke to this dimension. */
  readonly independentFamilies: number;
  readonly confidence: ConfidenceBand | null;
};

export type EvaluatorLens = {
  readonly strongDimensions: readonly string[];
  readonly weakDimensions: readonly string[];
  readonly riskTolerance: PreferenceLevel;
};

/** A lens for an evaluator with no recorded profile: no strengths, no weaknesses. */
export const NEUTRAL_LENS: EvaluatorLens = {
  strongDimensions: [],
  weakDimensions: [],
  riskTolerance: 'medium',
};

export type Interpretation = {
  readonly reading: Reading;
  readonly confidence: ConfidenceBand;
  readonly dimensions: readonly DimensionReading[];
  readonly unresolvedQuestionKeys: readonly string[];
  readonly independentFamilyCount: number;
};

const BANDS: readonly ConfidenceBand[] = [
  'very_low',
  'low',
  'medium',
  'high',
  'very_high',
];
const bandIndex = (b: ConfidenceBand): number => BANDS.indexOf(b);
const bandAt = (i: number): ConfidenceBand =>
  BANDS[Math.max(0, Math.min(BANDS.length - 1, i))]!;

/** What a given number of independent source families can support, however many claims. */
const familyCap = (families: number): number =>
  families >= 3 ? 4 : families === 2 ? 3 : 2;

type Observation = { readonly signal: ObservationSignal };
const observationOf = (
  claim: ClaimRecord,
  dimension: string,
): Observation | null => {
  const p = claim.proposition;
  if (p === null || typeof p !== 'object' || Array.isArray(p)) return null;
  const rec = p as Record<string, unknown>;
  if (rec.dimension !== dimension) return null;
  return (OBSERVATION_SIGNALS as readonly unknown[]).includes(rec.signal)
    ? { signal: rec.signal as ObservationSignal }
    : null;
};

/**
 * Reads claims through a lens. Pure: the only inputs are the visible claims, the question's
 * dimensions and the lens, so the same inputs always give the same answer and nothing about
 * the player beyond those claims can leak in.
 *
 * Independence is by source family: ten claims from one family are one voice. A dimension
 * the evaluator reads poorly needs two independent families before it counts at all. When
 * dimensions are left unresolved, risk tolerance decides whether to lean on what is known.
 */
export const interpretEvidence = (
  dimensions: readonly string[],
  claims: readonly ClaimRecord[],
  lens: EvaluatorLens,
): Interpretation => {
  const readings: DimensionReading[] = [];
  const countedFamilies = new Set<string>();
  for (const dimension of [...dimensions].sort(byText)) {
    const relevant = claims.filter((c) => observationOf(c, dimension) !== null);
    if (relevant.length === 0) {
      readings.push({
        dimension,
        status: 'no_evidence',
        independentFamilies: 0,
        confidence: null,
      });
      continue;
    }
    const families = new Map<
      string,
      { signals: Set<ObservationSignal>; best: number }
    >();
    for (const c of relevant) {
      const f = families.get(c.sourceFamilyId) ?? {
        signals: new Set<ObservationSignal>(),
        best: 0,
      };
      f.signals.add(observationOf(c, dimension)!.signal);
      f.best = Math.max(f.best, bandIndex(c.confidence));
      families.set(c.sourceFamilyId, f);
    }
    const n = families.size;
    const needed = lens.weakDimensions.includes(dimension) ? 2 : 1;
    if (n < needed) {
      readings.push({
        dimension,
        status: 'discounted',
        independentFamilies: n,
        confidence: null,
      });
      continue;
    }
    const signals = new Set<ObservationSignal>();
    for (const f of families.values())
      for (const s of f.signals) signals.add(s);
    const best = Math.max(...[...families.values()].map((f) => f.best));
    const confidence = bandAt(Math.min(best, familyCap(n)));
    if (signals.size !== 1 || signals.has('mixed')) {
      readings.push({
        dimension,
        status: 'conflict',
        independentFamilies: n,
        confidence,
      });
      continue;
    }
    for (const id of families.keys()) countedFamilies.add(id);
    readings.push({
      dimension,
      status: signals.has('positive') ? 'positive' : 'negative',
      independentFamilies: n,
      confidence,
    });
  }

  const counted = readings.filter(
    (r) => r.status === 'positive' || r.status === 'negative',
  );
  const unresolved = readings.filter(
    (r) => r.status === 'no_evidence' || r.status === 'discounted',
  );
  const conflicts = readings.filter((r) => r.status === 'conflict');
  const positives = counted.filter((r) => r.status === 'positive').length;
  const negatives = counted.length - positives;

  let reading: Reading;
  if (conflicts.length > 0 || (positives > 0 && negatives > 0))
    reading = 'mixed';
  else if (counted.length === 0) reading = 'insufficient';
  else if (
    unresolved.length > 0 &&
    (lens.riskTolerance === 'low' ||
      (lens.riskTolerance === 'medium' && unresolved.length > counted.length))
  )
    reading = 'insufficient';
  else reading = negatives > 0 ? 'against' : 'supports';

  let confidenceIndex =
    counted.length === 0
      ? 0
      : Math.min(...counted.map((r) => bandIndex(r.confidence!)));
  if (unresolved.length > 0 || conflicts.length > 0)
    confidenceIndex = Math.min(confidenceIndex, 2);
  if (reading === 'mixed' || reading === 'insufficient')
    confidenceIndex = Math.min(confidenceIndex, 1);

  return {
    reading,
    confidence: bandAt(confidenceIndex),
    dimensions: readings,
    unresolvedQuestionKeys: [
      ...unresolved.map((r) => `dimension:${r.dimension}`),
      ...conflicts.map((r) => `conflict:${r.dimension}`),
    ].sort(byText),
    independentFamilyCount: countedFamilies.size,
  };
};
