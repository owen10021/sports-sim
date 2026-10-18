import type { CanonicalValue } from './audit';
import { canonicalString } from './canonical';
import { isPlainObject, mintRecordIds, hasKind } from './commandSupport';
import type { GamePlanExecutionSnapshot } from './football';
import { footballConcept, type FootballRulesV1 } from './footballRules';
import { entityId, isValidId, recordId } from './ids';
import { holdsRoleAt } from './people';
import type { ProposalRecord } from './decisions';
import type { FootballWorld } from './world';

/** Terms type of a game-plan proposal (category `scheme`) and of its domain commit. */
export const GAME_PLAN_EXECUTION_TERMS_TYPE = 'game_plan_execution_v1';

const TERMS_KEYS =
  'authorizedStaffPersonIds,conceptKeys,constraints,fixtureId,organizationId,personnelPreferenceKeys,schemeKey,strategyPlanRefs';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sortedText = (v: readonly CanonicalValue[]): CanonicalValue[] =>
  [...v].sort((a, b) => byText(canonicalString(a), canonicalString(b)));

/**
 * Order-insensitive game-plan terms are put in one canonical order before approval and
 * hashing. Malformed terms are returned as they are: the strict parse at commit rejects them.
 */
export const canonicalGamePlanTerms = (terms: {
  readonly [key: string]: CanonicalValue;
}): { readonly [key: string]: CanonicalValue } => {
  const out: { [key: string]: CanonicalValue } = { ...terms };
  for (const key of [
    'strategyPlanRefs',
    'authorizedStaffPersonIds',
    'conceptKeys',
    'personnelPreferenceKeys',
  ]) {
    const v = terms[key];
    if (Array.isArray(v)) out[key] = sortedText(v);
  }
  return out;
};

export interface ParsedGamePlanTerms {
  readonly fixtureId: string;
  readonly organizationId: string;
  readonly strategyPlanRefs: readonly { planId: string; revision: number }[];
  readonly authorizedStaffPersonIds: readonly string[];
  readonly schemeKey: string;
  readonly conceptKeys: readonly string[];
  readonly personnelPreferenceKeys: readonly string[];
  readonly constraints: { readonly [key: string]: CanonicalValue };
}

const idList = (v: unknown, label: string): readonly string[] | string => {
  if (
    !Array.isArray(v) ||
    !v.every((x) => typeof x === 'string' && isValidId(x))
  )
    return `${label} must be an array of valid ids`;
  if (new Set(v).size !== v.length) return `${label} contains a duplicate`;
  return v as string[];
};

/** Exact-key parse of game-plan terms. A string result is the rejection reason. */
export const parseGamePlanTerms = (
  terms: unknown,
): ParsedGamePlanTerms | string => {
  if (!isPlainObject(terms)) return 'terms must be an object';
  if (Object.keys(terms).sort().join(',') !== TERMS_KEYS)
    return `terms must have exactly the keys ${TERMS_KEYS}`;
  if (!isValidId(terms.fixtureId)) return 'fixtureId must be a valid id';
  if (!isValidId(terms.organizationId))
    return 'organizationId must be a valid id';
  if (!isValidId(terms.schemeKey)) return 'schemeKey must be a valid key';
  if (!Array.isArray(terms.strategyPlanRefs))
    return 'strategyPlanRefs must be an array';
  const refs: { planId: string; revision: number }[] = [];
  for (const r of terms.strategyPlanRefs) {
    if (
      !isPlainObject(r) ||
      Object.keys(r).sort().join(',') !== 'planId,revision' ||
      !isValidId(r.planId) ||
      typeof r.revision !== 'number' ||
      !Number.isSafeInteger(r.revision) ||
      r.revision < 1
    )
      return 'each strategy plan ref must be exactly { planId, revision }';
    refs.push({ planId: r.planId, revision: r.revision });
  }
  if (new Set(refs.map((r) => r.planId)).size !== refs.length)
    return 'strategyPlanRefs names a plan twice';
  const staff = idList(
    terms.authorizedStaffPersonIds,
    'authorizedStaffPersonIds',
  );
  if (typeof staff === 'string') return staff;
  const concepts = idList(terms.conceptKeys, 'conceptKeys');
  if (typeof concepts === 'string') return concepts;
  const personnel = idList(
    terms.personnelPreferenceKeys,
    'personnelPreferenceKeys',
  );
  if (typeof personnel === 'string') return personnel;
  if (!isPlainObject(terms.constraints)) return 'constraints must be an object';
  return {
    fixtureId: terms.fixtureId,
    organizationId: terms.organizationId,
    strategyPlanRefs: refs,
    authorizedStaffPersonIds: staff,
    schemeKey: terms.schemeKey,
    conceptKeys: concepts,
    personnelPreferenceKeys: personnel,
    constraints: terms.constraints,
  };
};

export interface GamePlanFailure {
  readonly failure: string;
}
export const isGamePlanFailure = (v: unknown): v is GamePlanFailure =>
  typeof v === 'object' && v !== null && 'failure' in v;

/**
 * Validates a game-plan proposal against the live world and, if it holds, builds the
 * immutable execution snapshot it would commit. Pins the exact strategy-plan revisions and
 * the proposal's own revision and terms hash; nothing in the snapshot follows live state.
 * Pure: reads the world, mints no id into it (the caller applies `nextRecord`).
 */
export const buildGamePlanExecutionSnapshot = (
  world: FootballWorld,
  rules: FootballRulesV1,
  fixtureId: string,
  organizationId: string,
  proposal: ProposalRecord,
):
  | { snapshot: GamePlanExecutionSnapshot; nextRecord: number }
  | GamePlanFailure => {
  const parsed = parseGamePlanTerms(proposal.terms);
  if (typeof parsed === 'string') return { failure: parsed };
  if (
    parsed.fixtureId !== fixtureId ||
    parsed.organizationId !== organizationId
  )
    return {
      failure: 'terms do not match the requested fixture and organization',
    };
  if (proposal.organizationId !== organizationId)
    return { failure: 'proposal belongs to a different organization' };
  const fixture = world.football.fixtures.find((f) => f.id === fixtureId);
  if (fixture === undefined)
    return { failure: 'fixtureId does not name a fixture' };
  if (fixture.status !== 'scheduled')
    return { failure: `fixture ${fixtureId} is already final` };
  if (world.simDate > fixture.fixtureDate)
    return { failure: `fixture ${fixtureId} is past its date` };
  if (
    fixture.homeOrganizationId !== organizationId &&
    fixture.awayOrganizationId !== organizationId
  )
    return {
      failure: `${organizationId} does not play in fixture ${fixtureId}`,
    };
  if (
    world.football.gamePlans.some(
      (g) => g.fixtureId === fixtureId && g.organizationId === organizationId,
    )
  )
    return {
      failure: `${organizationId} already has a committed game plan for ${fixtureId}`,
    };

  for (const ref of parsed.strategyPlanRefs) {
    const plan = world.plans.plans.find((p) => p.id === ref.planId);
    if (
      plan === undefined ||
      plan.organizationId !== organizationId ||
      plan.kind !== 'strategy'
    )
      return {
        failure: `${ref.planId} is not a strategy plan of ${organizationId}`,
      };
    if (plan.status !== 'active')
      return { failure: `strategy plan ${ref.planId} is ${plan.status}` };
    if (plan.currentRevision !== ref.revision)
      return {
        failure: `strategy plan ${ref.planId} is at revision ${plan.currentRevision}, not ${ref.revision}`,
      };
  }
  if (!rules.schemes.some((s) => s.schemeKey === parsed.schemeKey))
    return { failure: `scheme ${parsed.schemeKey} is not in the rules` };
  if (parsed.conceptKeys.length === 0)
    return { failure: 'conceptKeys must name at least one concept' };
  for (const key of parsed.conceptKeys)
    if (footballConcept(rules, key) === undefined)
      return { failure: `concept ${key} is not in the rules` };
  for (const key of parsed.personnelPreferenceKeys)
    if (!rules.personnelGroups.some((p) => p.personnelKey === key))
      return { failure: `personnel group ${key} is not in the rules` };
  if (parsed.authorizedStaffPersonIds.length === 0)
    return {
      failure: 'authorizedStaffPersonIds must name at least one person',
    };
  for (const person of parsed.authorizedStaffPersonIds)
    if (
      !hasKind(world, person, 'person') ||
      !holdsRoleAt(
        world.people,
        entityId(organizationId),
        entityId(person),
        world.simDate,
      )
    )
      return {
        failure: `${person} does not hold a role in ${organizationId}`,
      };

  const minted = mintRecordIds(world, 1);
  const snapshot: GamePlanExecutionSnapshot = {
    id: minted.ids[0]!,
    fixtureId: recordId(fixtureId),
    organizationId: entityId(organizationId),
    capturedAt: world.simDate,
    strategyPlanRefs: [...parsed.strategyPlanRefs]
      .sort((a, b) => byText(a.planId, b.planId))
      .map((r) => ({ planId: recordId(r.planId), revision: r.revision })),
    schemeProposalRef: {
      proposalId: recordId(proposal.id),
      revision: proposal.revision,
      termsHash: proposal.termsHash,
    },
    authorizedStaffPersonIds: [...parsed.authorizedStaffPersonIds]
      .sort(byText)
      .map(entityId),
    schemeKey: parsed.schemeKey,
    conceptKeys: [...parsed.conceptKeys].sort(byText),
    personnelPreferenceKeys: [...parsed.personnelPreferenceKeys].sort(byText),
    constraints: parsed.constraints,
    sourceProposalId: recordId(proposal.id),
  };
  return { snapshot, nextRecord: minted.next };
};
