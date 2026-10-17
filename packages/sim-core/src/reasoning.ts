import { DECISION_RIGHTS, effectiveRightsAt } from './authority';
import type { DecisionCategory, DecisionRight } from './authority';
import { rightBackingAt } from './decisions';
import type { EntityId, RecordId } from './ids';
import {
  buildOrganizationKnowledgeView,
  type OrganizationKnowledgeView,
} from './knowledgeView';
import { holdsRoleAt } from './people';
import type { OrganizationPlan } from './plans';
import type { RelationshipEdge } from './relationships';
import type { FootballWorld } from './world';

/**
 * CPU reasoning sees the world only through this view. It is plain data built from the
 * same knowledge filter as human reads: it never holds a `FootballWorld`, an RNG, other
 * organizations' private records, or an actor kind. Identical role + grants + knowledge
 * therefore produce an identical view (and identical legal options) for any actor.
 */
export type ReasoningRequest = {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly category: DecisionCategory;
  readonly optionIds: readonly string[];
  /** Latest sim date by which a decision is wanted; informational for the reasoner. */
  readonly deadline: string | null;
};

export type ViewAuthority = {
  readonly category: DecisionCategory;
  readonly rights: readonly DecisionRight[];
  readonly grantIds: readonly RecordId[];
  readonly mandateIds: readonly RecordId[];
};

export type PublicEntityFact = {
  readonly id: EntityId;
  readonly kind: 'organization';
};

export type OrganizationDecisionView = {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly category: DecisionCategory;
  readonly optionIds: readonly string[];
  readonly deadline: string | null;
  readonly knowledge: OrganizationKnowledgeView;
  /** The organization's own active plans only. */
  readonly plans: readonly OrganizationPlan[];
  /** Edges with this organization, or a current member of it, as a party. */
  readonly relationships: readonly RelationshipEdge[];
  readonly authority: ViewAuthority;
  readonly publicFacts: { readonly organizations: readonly PublicEntityFact[] };
};

export type RejectedOption = {
  readonly optionId: string;
  readonly reason: string;
};

export type ReasoningTrace = {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly category: DecisionCategory;
  readonly goalPlanIds: readonly RecordId[];
  readonly beliefIds: readonly RecordId[];
  readonly claimIds: readonly RecordId[];
  readonly authorityGrantIds: readonly RecordId[];
  readonly consideredOptionIds: readonly string[];
  readonly rejectedOptions: readonly RejectedOption[];
  readonly uncertainties: readonly string[];
};

export type OrganizationRecommendation = {
  readonly selectedOptionId: string | null;
  readonly rationale: string;
  readonly trace: ReasoningTrace;
};

/** Production domains supply policies later; Package B only fixes the interface. */
export interface OrganizationReasoner {
  recommend(view: OrganizationDecisionView): OrganizationRecommendation;
}

export type ViewFailure = { readonly ok: false; readonly message: string };
export type ViewResult =
  { readonly ok: true; readonly view: OrganizationDecisionView } | ViewFailure;

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Build the knowledge-filtered view for one acting person. Pure and non-mutating. */
export const buildOrganizationDecisionView = (
  world: FootballWorld,
  request: ReasoningRequest,
): ViewResult => {
  const today = world.simDate;
  const { organizationId: org, actorPersonId: actor, category } = request;
  if (!world.entities.some((e) => e.id === org && e.kind === 'organization'))
    return {
      ok: false,
      message: 'organizationId does not name an organization',
    };
  if (!holdsRoleAt(world.people, org, actor, today))
    return {
      ok: false,
      message: 'the actor holds no role in this organization',
    };
  if (new Set(request.optionIds).size !== request.optionIds.length)
    return { ok: false, message: 'optionIds contains a duplicate' };

  const rights = effectiveRightsAt(world, org, actor, category, today).rights;
  const grantIds = new Set<RecordId>();
  const mandateIds = new Set<RecordId>();
  for (const right of rights) {
    const backing = rightBackingAt(world, org, actor, category, right, today);
    if (backing === null) continue;
    for (const g of backing.grantIds) grantIds.add(g);
    if (backing.mandateId !== null) mandateIds.add(backing.mandateId);
  }

  const members = new Set<string>(
    world.people.roleEpisodes
      .filter((e) => e.organizationId === org)
      .map((e) => e.personId)
      .filter((p) => holdsRoleAt(world.people, org, p as EntityId, today)),
  );
  const relationships = world.relationships.edges.filter((e) =>
    [e.partyA, e.partyB].some(
      (p) =>
        (p.kind === 'organization' && p.entityId === org) ||
        (p.kind === 'person' && members.has(p.entityId)),
    ),
  );

  return {
    ok: true,
    view: {
      organizationId: org,
      actorPersonId: actor,
      asOf: today,
      category,
      optionIds: [...request.optionIds],
      deadline: request.deadline,
      knowledge: buildOrganizationKnowledgeView(world, org, actor),
      plans: world.plans.plans.filter(
        (p) => p.organizationId === org && p.status === 'active',
      ),
      relationships,
      authority: {
        category,
        rights: [...rights].sort(
          (a, b) => DECISION_RIGHTS.indexOf(a) - DECISION_RIGHTS.indexOf(b),
        ),
        grantIds: [...grantIds].sort(byText) as RecordId[],
        mandateIds: [...mandateIds].sort(byText) as RecordId[],
      },
      publicFacts: {
        organizations: world.entities
          .filter((e) => e.kind === 'organization')
          .map((e): PublicEntityFact => ({ id: e.id, kind: 'organization' }))
          .sort((a, b) => byText(a.id, b.id)),
      },
    },
  };
};

/**
 * The options this actor may legitimately put forward: all of them when the actor holds
 * `propose` on the category, none otherwise. Depends only on the view, so actor kind
 * (human or CPU) cannot change it.
 */
export const legalOptionIds = (
  view: OrganizationDecisionView,
): readonly string[] =>
  view.authority.rights.includes('propose') ? [...view.optionIds] : [];

/**
 * QA check: every record a recommendation cites must be present in the view it was
 * given. Returns a sorted list of violations; empty means the trace is clean.
 */
export const traceViolations = (
  view: OrganizationDecisionView,
  recommendation: OrganizationRecommendation,
): readonly string[] => {
  const t = recommendation.trace;
  const out: string[] = [];
  if (t.organizationId !== view.organizationId)
    out.push('organization mismatch');
  if (t.actorPersonId !== view.actorPersonId) out.push('actor mismatch');
  const known = (
    ids: readonly string[],
    have: readonly string[],
    label: string,
  ) => {
    for (const id of ids)
      if (!have.includes(id)) out.push(`${label} ${id} is not in the view`);
  };
  known(
    t.goalPlanIds,
    view.plans.map((p) => p.id),
    'plan',
  );
  known(
    t.beliefIds,
    view.knowledge.beliefs.map((b) => b.id),
    'belief',
  );
  known(
    t.claimIds,
    view.knowledge.claims.map((c) => c.id),
    'claim',
  );
  known(t.authorityGrantIds, view.authority.grantIds, 'grant');
  known(t.consideredOptionIds, view.optionIds, 'option');
  known(
    t.rejectedOptions.map((r) => r.optionId),
    view.optionIds,
    'option',
  );
  const selected = recommendation.selectedOptionId;
  if (selected !== null && !legalOptionIds(view).includes(selected))
    out.push(`selected option ${selected} is not legal for this actor`);
  return out.sort(byText);
};
