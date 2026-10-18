import {
  effectiveRightsAt,
  type AuthorityGrant,
  type DecisionRight,
  type Mandate,
  type ProtectedConstraint,
} from './authority';
import type { EntityId, RecordId } from './ids';
import {
  buildOrganizationKnowledgeView,
  type OrganizationKnowledgeView,
} from './knowledgeView';
import type { MedicalClearanceRecord, MedicalReport } from './medical';
import { remainingOpportunity } from './opportunity';
import { holdsRoleAt } from './people';
import type { PlanConstraint, PlanObjective } from './plans';
import type { RelationshipEdge, RelationshipEffect } from './relationships';
import {
  activeRightsFor,
  currentRosterMembership,
  type RosterStatus,
} from './roster';
import type { ScoutingReport } from './scouting';
import type { FootballWorld } from './world';

export interface DevelopmentRosterFact {
  readonly playerId: EntityId;
  readonly primaryRole: string;
  readonly roleTags: readonly string[];
  readonly rosterStatus: RosterStatus;
  readonly playerRightIds: readonly RecordId[];
}

export interface DevelopmentPlanFact {
  readonly planId: RecordId;
  readonly kind: 'development' | 'succession';
  readonly scopeKey: string;
  readonly ownerPersonId: EntityId;
  readonly effectiveAt: string;
  readonly objectives: readonly PlanObjective[];
  readonly constraints: readonly PlanConstraint[];
}

export interface DevelopmentOpportunityPoolFact {
  readonly resourceKey: string;
  readonly scopeKey: string;
  readonly capacityUnits: number;
  readonly allocatedUnits: number;
  readonly openUnits: number;
}

export interface DevelopmentOpportunityWindowFact {
  readonly windowId: RecordId;
  readonly phaseKey: string;
  readonly fromDate: string;
  readonly toDate: string;
  readonly pools: readonly DevelopmentOpportunityPoolFact[];
}

export interface DevelopmentAllocationFact {
  readonly allocationId: RecordId;
  readonly windowId: RecordId;
  readonly playerId: EntityId;
  readonly resourceKey: string;
  readonly scopeKey: string;
  readonly units: number;
  readonly teacherPersonId: EntityId | null;
  readonly responsibilityKeys: readonly string[];
  readonly basisPlanIds: readonly RecordId[];
  readonly committedAt: string;
}

export interface DevelopmentSchemeAssignmentFact {
  readonly proposalId: RecordId;
  readonly playerId: EntityId;
  readonly schemeKey: string;
  readonly responsibilityKeys: readonly string[];
}

export interface CommunicatedMedicalRecommendationFact {
  readonly recommendationId: RecordId;
  readonly episodeId: RecordId;
  readonly playerId: EntityId;
  readonly medicalPersonId: EntityId;
  readonly participation: 'out' | 'limited' | 'full';
  readonly maxLoadUnits: number | null;
  readonly issuedAt: string;
}

export interface DevelopmentMedicalView {
  readonly recommendations: readonly CommunicatedMedicalRecommendationFact[];
  readonly clearances: readonly MedicalClearanceRecord[];
  readonly reports: readonly MedicalReport[];
}

export interface DevelopmentReportView {
  readonly scouting: readonly ScoutingReport[];
  readonly medical: readonly MedicalReport[];
}

export interface DevelopmentRelationshipView {
  readonly edges: readonly RelationshipEdge[];
  readonly effects: readonly RelationshipEffect[];
}

export interface DevelopmentAuthorityView {
  readonly rights: {
    readonly organizationalPlan: readonly DecisionRight[];
    readonly workloadUsage: readonly DecisionRight[];
    readonly medicalClearance: readonly DecisionRight[];
    readonly scheme: readonly DecisionRight[];
    readonly roster: readonly DecisionRight[];
  };
  readonly grants: readonly AuthorityGrant[];
  readonly mandates: readonly Mandate[];
  readonly protectedConstraints: readonly ProtectedConstraint[];
}

/**
 * Organization-scoped development reasoning surface. It contains facts the acting staff
 * member may legitimately use, never the simulation's private causal substrate.
 */
export interface DevelopmentDecisionView {
  readonly organizationId: EntityId;
  readonly actorPersonId: EntityId;
  readonly asOf: string;
  readonly roster: readonly DevelopmentRosterFact[];
  readonly plans: readonly DevelopmentPlanFact[];
  readonly opportunity: {
    readonly windows: readonly DevelopmentOpportunityWindowFact[];
    readonly allocations: readonly DevelopmentAllocationFact[];
  };
  readonly knowledge: OrganizationKnowledgeView;
  readonly reports: DevelopmentReportView;
  readonly medical: DevelopmentMedicalView;
  readonly schemeAssignments: readonly DevelopmentSchemeAssignmentFact[];
  readonly relationships: DevelopmentRelationshipView;
  readonly authority: DevelopmentAuthorityView;
}

export type DevelopmentViewResult =
  | { readonly ok: true; readonly view: DevelopmentDecisionView }
  | { readonly ok: false; readonly reason: string };

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const inInterval = (
  from: string,
  until: string | null,
  date: string,
): boolean => from <= date && (until === null || date <= until);

const activeWindow = (
  world: FootballWorld,
  organizationId: EntityId,
  window: FootballWorld['development']['opportunityWindows'][number],
): boolean =>
  window.organizationId === organizationId &&
  window.status === 'open' &&
  window.fromDate <= world.simDate &&
  world.simDate < window.toDate;

const schemeAssignments = (
  world: FootballWorld,
  organizationId: EntityId,
): readonly DevelopmentSchemeAssignmentFact[] => {
  const assignments: DevelopmentSchemeAssignmentFact[] = [];
  for (const proposal of world.decisions.proposals) {
    if (
      proposal.organizationId !== organizationId ||
      proposal.category !== 'scheme' ||
      proposal.state !== 'committed' ||
      proposal.termsType !== 'role_scheme_transition_v1' ||
      typeof proposal.terms !== 'object' ||
      proposal.terms === null ||
      Array.isArray(proposal.terms)
    )
      continue;
    const terms = proposal.terms as {
      readonly playerId?: unknown;
      readonly schemeKey?: unknown;
      readonly responsibilityKeys?: unknown;
    };
    if (
      typeof terms.playerId !== 'string' ||
      typeof terms.schemeKey !== 'string' ||
      !Array.isArray(terms.responsibilityKeys) ||
      !terms.responsibilityKeys.every((key) => typeof key === 'string')
    )
      continue;
    assignments.push({
      proposalId: proposal.id,
      playerId: terms.playerId as EntityId,
      schemeKey: terms.schemeKey,
      responsibilityKeys: [...terms.responsibilityKeys].sort(
        byText,
      ) as string[],
    });
  }
  return assignments.sort((a, b) => byText(a.proposalId, b.proposalId));
};

export const buildDevelopmentDecisionView = (
  world: FootballWorld,
  organizationId: EntityId,
  actorPersonId: EntityId,
): DevelopmentViewResult => {
  const today = world.simDate;
  if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
    return {
      ok: false,
      reason: `${actorPersonId} holds no role in ${organizationId}`,
    };

  const roster: DevelopmentRosterFact[] = [];
  const rosterPlayerIds = new Set<EntityId>();
  for (const player of world.roster.players) {
    const membership = currentRosterMembership(
      world.roster,
      player.personId,
      today,
    );
    if (membership?.organizationId !== organizationId) continue;
    rosterPlayerIds.add(player.personId);
    roster.push({
      playerId: player.personId,
      primaryRole: player.primaryRole,
      roleTags: [...player.roleTags].sort(byText),
      rosterStatus: membership.status,
      playerRightIds: activeRightsFor(world.roster, player.personId, today)
        .filter((right) => right.holderOrganizationId === organizationId)
        .map((right) => right.id)
        .sort(byText),
    });
  }
  roster.sort((a, b) => byText(a.playerId, b.playerId));

  const plans: DevelopmentPlanFact[] = world.plans.plans
    .filter(
      (plan) =>
        plan.organizationId === organizationId &&
        plan.status === 'active' &&
        (plan.kind === 'development' || plan.kind === 'succession'),
    )
    .map((plan): DevelopmentPlanFact => {
      const revision = plan.revisions.find(
        (entry) => entry.revision === plan.currentRevision,
      )!;
      return {
        planId: plan.id,
        kind: plan.kind as 'development' | 'succession',
        scopeKey: plan.scopeKey,
        ownerPersonId: revision.ownerPersonId,
        effectiveAt: revision.effectiveAt,
        objectives: revision.objectives,
        constraints: revision.constraints,
      };
    })
    .sort((a, b) => byText(a.planId, b.planId));

  const windows = world.development.opportunityWindows
    .filter((window) => activeWindow(world, organizationId, window))
    .sort((a, b) => byText(a.id, b.id));
  const opportunityWindows: DevelopmentOpportunityWindowFact[] = windows.map(
    (window) => ({
      windowId: window.id,
      phaseKey: window.phaseKey,
      fromDate: window.fromDate,
      toDate: window.toDate,
      pools: window.pools
        .map((pool) => {
          const allocatedUnits = world.development.opportunityAllocations
            .filter(
              (allocation) =>
                allocation.windowId === window.id &&
                allocation.organizationId === organizationId &&
                allocation.resourceKey === pool.resourceKey &&
                allocation.scopeKey === pool.scopeKey,
            )
            .reduce((sum, allocation) => sum + allocation.units, 0);
          return {
            resourceKey: pool.resourceKey,
            scopeKey: pool.scopeKey,
            capacityUnits: pool.capacityUnits,
            allocatedUnits,
            openUnits: remainingOpportunity(
              window,
              world.development.opportunityAllocations,
              pool.resourceKey,
              pool.scopeKey,
            ),
          };
        })
        .sort(
          (a, b) =>
            byText(a.scopeKey, b.scopeKey) ||
            byText(a.resourceKey, b.resourceKey),
        ),
    }),
  );
  const windowIds = new Set(windows.map((window) => window.id));
  const allocations: DevelopmentAllocationFact[] =
    world.development.opportunityAllocations
      .filter(
        (allocation) =>
          allocation.organizationId === organizationId &&
          windowIds.has(allocation.windowId),
      )
      .map((allocation) => ({
        allocationId: allocation.id,
        windowId: allocation.windowId,
        playerId: allocation.playerId,
        resourceKey: allocation.resourceKey,
        scopeKey: allocation.scopeKey,
        units: allocation.units,
        teacherPersonId: allocation.teacherPersonId,
        responsibilityKeys: [...allocation.responsibilityKeys].sort(byText),
        basisPlanIds: [...allocation.basisPlanIds].sort(byText),
        committedAt: allocation.committedAt,
      }))
      .sort((a, b) => byText(a.allocationId, b.allocationId));

  const knowledge = buildOrganizationKnowledgeView(
    world,
    organizationId,
    actorPersonId,
  );
  const visibleClaimIds = new Set(knowledge.claims.map((claim) => claim.id));
  const visibleBeliefIds = new Set(
    knowledge.beliefs.map((belief) => belief.id),
  );
  const scoutingReports = world.scouting.reports
    .filter(
      (report) =>
        report.organizationId === organizationId &&
        visibleBeliefIds.has(report.beliefId) &&
        report.evidenceClaimIds.every((id) => visibleClaimIds.has(id)),
    )
    .sort((a, b) => byText(a.id, b.id));
  const medicalReports = world.medical.reports
    .filter(
      (report) =>
        report.organizationId === organizationId &&
        visibleBeliefIds.has(report.beliefId) &&
        report.evidenceClaimIds.every((id) => visibleClaimIds.has(id)),
    )
    .sort((a, b) => byText(a.id, b.id));

  const recommendations: CommunicatedMedicalRecommendationFact[] = [];
  for (const recommendation of world.medical.recommendations) {
    const episode = world.medical.episodes.find(
      (entry) => entry.id === recommendation.episodeId,
    );
    if (
      episode === undefined ||
      !holdsRoleAt(
        world.people,
        organizationId,
        recommendation.medicalPersonId,
        recommendation.issuedAt,
      ) ||
      !recommendation.basisClaimIds.every((id) => visibleClaimIds.has(id)) ||
      !recommendation.basisBeliefIds.every((id) => visibleBeliefIds.has(id))
    )
      continue;
    recommendations.push({
      recommendationId: recommendation.id,
      episodeId: recommendation.episodeId,
      playerId: episode.playerId,
      medicalPersonId: recommendation.medicalPersonId,
      participation: recommendation.participation,
      maxLoadUnits: recommendation.maxLoadUnits,
      issuedAt: recommendation.issuedAt,
    });
  }
  recommendations.sort((a, b) =>
    byText(a.recommendationId, b.recommendationId),
  );
  const clearances = world.medical.clearances
    .filter((clearance) => clearance.organizationId === organizationId)
    .sort((a, b) => byText(a.id, b.id));

  const relevantEdges = world.relationships.edges
    .filter((edge) => {
      if (edge.partyA.kind !== 'person' || edge.partyB.kind !== 'person')
        return false;
      if (edge.partyA.entityId === actorPersonId)
        return rosterPlayerIds.has(edge.partyB.entityId);
      if (edge.partyB.entityId === actorPersonId)
        return rosterPlayerIds.has(edge.partyA.entityId);
      return false;
    })
    .sort((a, b) => byText(a.id, b.id));
  const relevantEdgeIds = new Set(relevantEdges.map((edge) => edge.id));
  const relationshipEffects = world.relationships.effects
    .filter((effect) => relevantEdgeIds.has(effect.relationshipId))
    .sort((a, b) => byText(a.id, b.id));

  const grants = world.authority.grants
    .filter(
      (grant) =>
        grant.organizationId === organizationId &&
        grant.personId === actorPersonId &&
        inInterval(grant.effectiveFrom, grant.effectiveUntil, today),
    )
    .sort((a, b) => byText(a.id, b.id));
  const mandates = world.authority.mandates
    .filter(
      (mandate) =>
        mandate.organizationId === organizationId &&
        mandate.active &&
        inInterval(mandate.effectiveFrom, mandate.effectiveUntil, today) &&
        (mandate.delegatePersonId === actorPersonId ||
          mandate.delegatorPersonId === actorPersonId),
    )
    .sort((a, b) => byText(a.id, b.id));
  const protectedConstraints = world.authority.protectedConstraints
    .filter(
      (constraint) =>
        constraint.organizationId === organizationId &&
        constraint.active &&
        inInterval(constraint.effectiveFrom, constraint.effectiveUntil, today),
    )
    .sort((a, b) => byText(a.id, b.id));

  const rights = (category: Parameters<typeof effectiveRightsAt>[3]) => [
    ...effectiveRightsAt(world, organizationId, actorPersonId, category, today)
      .rights,
  ];

  return {
    ok: true,
    view: {
      organizationId,
      actorPersonId,
      asOf: today,
      roster,
      plans,
      opportunity: { windows: opportunityWindows, allocations },
      knowledge,
      reports: { scouting: scoutingReports, medical: medicalReports },
      medical: {
        recommendations,
        clearances,
        reports: medicalReports,
      },
      schemeAssignments: schemeAssignments(world, organizationId),
      relationships: { edges: relevantEdges, effects: relationshipEffects },
      authority: {
        rights: {
          organizationalPlan: rights('organizational_plan'),
          workloadUsage: rights('workload_usage'),
          medicalClearance: rights('medical_clearance'),
          scheme: rights('scheme'),
          roster: rights('roster'),
        },
        grants,
        mandates,
        protectedConstraints,
      },
    },
  };
};
