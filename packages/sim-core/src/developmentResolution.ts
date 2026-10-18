import type { EventSpec } from './commandRouter';
import { byId, mintRecordIds, spec } from './commandSupport';
import type {
  DevelopmentCheckpointRecord,
  DevelopmentEvent,
  OpportunityAllocation,
  RoleKnowledgeRecord,
} from './development';
import { developmentProfileFor, readinessFor } from './development';
import {
  familyOfCapability,
  requireDevelopmentRules,
  type CapabilityFamilyRule,
  type DevelopmentRulesV1,
} from './developmentRules';
import { isValidId, type EntityId, type RecordId } from './ids';
import type { ClaimRecord } from './information';
import { opportunityProblems } from './opportunity';
import { holdsRoleAt } from './people';
import { resolvePassiveDevelopment } from './developmentPassive';
import { resolveRoleLearning } from './roleLearning';
import {
  applyCapabilityDeltas,
  currentRosterMembership,
  type CapabilityDelta,
} from './roster';
import { DeterministicRng } from './rng';
import { SimDate } from './simDate';
import type { LeagueRulesetManifest } from './ruleset';
import type { FootballWorld } from './world';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const bp = (v: number): number => Math.max(0, Math.min(10000, Math.floor(v)));
const mulBp = (v: number, factor: number): number =>
  Math.floor((v * factor) / 10000);

/** Only causal dimension/context inputs; no salary, statistics, draft status or beliefs. */
export interface CapabilityAdaptationInput {
  readonly currentValueBp: number;
  readonly family: CapabilityFamilyRule;
  readonly ageDays: number;
  readonly malleabilityBp: number;
  readonly meaningfulUnits: number;
  readonly loadUnits: number;
  readonly maxLoadUnits: number;
  readonly teachingBp: number;
  readonly conditioningBp: number;
  readonly acuteFatigueBp: number;
  readonly elapsedDays: number;
  readonly rollU32: number;
  /** Work checkpoints exclude aging already applied by person-owned passive ticks. */
  readonly includeAging?: boolean;
}

/**
 * Synthetic fixed-point response, NOT an NFL empirical curve. Recoverable opportunity
 * saturates at half the declared maximum; extra load creates strain rather than free
 * growth. Headroom, family-specific age context and bounded uncertainty allow plateaus.
 * Aging and strain can exceed adaptation. Bounds are proposed here, never silently
 * clamped by the authoritative roster mutation boundary.
 */
export const resolveCapabilityAdaptation = (
  i: CapabilityAdaptationInput,
): number => {
  const usefulLimit = Math.max(1, Math.floor(i.maxLoadUnits / 2));
  const exposureBp = Math.floor(
    (Math.min(usefulLimit, i.meaningfulUnits) * 10000) / usefulLimit,
  );
  const ageDistance = Math.abs(i.ageDays - i.family.maturationMidpointAgeDays);
  const maturationBp = Math.floor(
    (i.family.maturationMidpointAgeDays * 10000) /
      (i.family.maturationMidpointAgeDays + ageDistance),
  );
  let growth = mulBp(10000 - i.currentValueBp, i.family.adaptationScaleBp);
  growth = Math.floor((growth * i.elapsedDays) / 365);
  growth = mulBp(growth, maturationBp);
  growth = mulBp(growth, i.malleabilityBp);
  growth = mulBp(growth, exposureBp);
  growth = mulBp(growth, 5000 + Math.floor(i.teachingBp / 2));
  growth = mulBp(growth, i.conditioningBp);
  growth = mulBp(growth, 10000 - i.acuteFatigueBp);
  growth = mulBp(growth, i.rollU32 % 10001);
  const yearsBeyondBp = Math.floor(
    (Math.max(0, i.ageDays - i.family.declineOnsetAgeDays) * 10000) / 3650,
  );
  const aging =
    i.includeAging !== false && i.ageDays > i.family.declineOnsetAgeDays
      ? Math.floor(
          (((i.family.declineScaleBpPerYear * i.elapsedDays) / 365) *
            (10000 + yearsBeyondBp)) /
            10000,
        )
      : 0;
  const excessBp = bp(
    (Math.max(0, i.loadUnits - usefulLimit) * 10000) / usefulLimit,
  );
  const strain = Math.floor(
    (mulBp(i.family.adaptationScaleBp, excessBp) * i.elapsedDays) / 365,
  );
  return Math.max(
    -i.currentValueBp,
    Math.min(10000 - i.currentValueBp, growth - aging - strain),
  );
};

export class DevelopmentResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevelopmentResolutionError';
  }
}
const fail = (message: string): never => {
  throw new DevelopmentResolutionError(message);
};

type LearningTarget = {
  readonly playerId: EntityId;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
};
const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/**
 * Existing unambiguous responsibilities keep their scheme. New/ambiguous scheme work
 * may be named explicitly in linked B plan objectives; unqualified labels install no
 * knowledge. Targets come from intent, not hidden future ability.
 */
const learningTargets = (
  world: FootballWorld,
  allocations: readonly OpportunityAllocation[],
): readonly LearningTarget[] => {
  const targets = new Map<string, LearningTarget>();
  for (const a of allocations)
    for (const responsibilityKey of a.responsibilityKeys) {
      const explicit: LearningTarget[] = [];
      for (const id of a.basisPlanIds) {
        const plan = world.plans.plans.find((p) => p.id === id);
        const pin = a.basisPlanRevisions?.find((r) => r.planId === id);
        const rev = plan?.revisions.find((r) => r.revision === pin?.revision);
        for (const objective of rev?.objectives ?? []) {
          const t = asObject(objective.target);
          if (
            t?.playerId === a.playerId &&
            t.responsibilityKey === responsibilityKey &&
            isValidId(t.schemeKey) &&
            isValidId(t.transferFamilyKey)
          )
            explicit.push({
              playerId: a.playerId,
              schemeKey: t.schemeKey,
              responsibilityKey,
              transferFamilyKey: t.transferFamilyKey,
            });
        }
      }
      const known = world.development.roleKnowledge.filter(
        (k) =>
          k.playerId === a.playerId &&
          k.responsibilityKey === responsibilityKey,
      );
      const choices =
        explicit.length > 0 ? explicit : known.length === 1 ? [known[0]!] : [];
      for (const t of choices)
        targets.set(
          t.playerId + '|' + t.schemeKey + '|' + t.responsibilityKey,
          t,
        );
    }
  return [...targets.values()].sort(
    (a, b) =>
      byText(a.playerId, b.playerId) ||
      byText(a.schemeKey, b.schemeKey) ||
      byText(a.responsibilityKey, b.responsibilityKey),
  );
};

/**
 * Pure composition for a due window. Caller supplies a LOCAL RNG; all legality and
 * cross-reference checks finish before its first draw. No authoritative commit here.
 * RNG contract: one uint32 per ruled capability, sorted player then capability key;
 * role learning/readiness/qualitative claims draw none.
 */
export const resolveDevelopmentWindow = (
  input: FootballWorld,
  ruleset: LeagueRulesetManifest,
  windowId: string,
  rng: DeterministicRng,
): {
  readonly world: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
} => {
  let world = input;
  const rules: DevelopmentRulesV1 = requireDevelopmentRules(ruleset);
  const window = world.development.opportunityWindows.find(
    (w) => w.id === windowId,
  );
  if (window === undefined)
    return fail('windowId does not name an opportunity window');
  if (world.simDate !== window.toDate)
    return fail('development checkpoint must resolve on its logical due date');
  if (world.development.checkpoints.some((c) => c.windowId === window.id))
    return fail('development window already checkpointed');
  let allocations = world.development.opportunityAllocations
    .filter((a) => a.windowId === window.id)
    .sort(byId);
  if (allocations.length === 0)
    return fail('window has no committed allocations/defaults');
  const problems = opportunityProblems(world, window, allocations, {
    committedHistory: true,
  });
  if (problems.length > 0) return fail(problems.join('; '));
  const loads = new Map<EntityId, number>();
  for (const a of allocations)
    loads.set(a.playerId, (loads.get(a.playerId) ?? 0) + a.units);
  if (
    [...loads.values()].some(
      (n) =>
        !Number.isSafeInteger(n) || n > rules.maxPlayerLoadUnitsPerCheckpoint,
    )
  )
    return fail('player workload exceeds maxPlayerLoadUnitsPerCheckpoint');
  const lastPassive = world.development.checkpoints
    .filter((c) => c.kind === 'passive')
    .map((c) => c.toDate)
    .sort()
    .at(-1);
  if (lastPassive !== undefined && lastPassive > window.toDate)
    return fail(
      'cannot apply overdue work behind the passive development clock',
    );
  // Reserved units remain spent. Actual exposure is clipped to days after commitment
  // with roster access and, for supervised work, the teacher still serving this org.
  const duration = SimDate.parse(window.toDate).daysSince(
    SimDate.parse(window.fromDate),
  );
  allocations = allocations.map((a) => {
    let days = 0;
    for (
      let day = SimDate.parse(a.committedAt);
      day.toISO() < window.toDate;
      day = day.addDays(1)
    ) {
      const date = day.toISO();
      if (
        currentRosterMembership(world.roster, a.playerId, date)
          ?.organizationId === window.organizationId &&
        (a.teacherPersonId === null ||
          holdsRoleAt(
            world.people,
            window.organizationId,
            a.teacherPersonId,
            date,
          ))
      )
        days++;
    }
    return { ...a, units: Math.floor((a.units * days) / duration) };
  });
  loads.clear();
  for (const a of allocations)
    loads.set(a.playerId, (loads.get(a.playerId) ?? 0) + a.units);
  const passive = resolvePassiveDevelopment(
    world,
    ruleset,
    lastPassive ?? window.fromDate,
    window.toDate,
  );
  world = passive.world;
  const players = world.roster.players
    .filter((p) => allocations.some((a) => a.playerId === p.personId))
    .sort((a, b) => byText(a.personId, b.personId));
  const targets = learningTargets(world, allocations);
  // IDs are allocated from the same snapshot, including all existing D records.
  const capabilityCount = players.reduce(
    (n, p) =>
      n +
      p.capabilities.filter(
        (c) => familyOfCapability(rules, c.key) !== undefined,
      ).length,
    0,
  );
  const readinessCount =
    players.filter(
      (p) => readinessFor(world.development, p.personId) !== undefined,
    ).length * 2;
  const groups = new Map<string, OpportunityAllocation[]>();
  for (const a of allocations)
    if (
      a.units > 0 &&
      a.teacherPersonId !== null &&
      a.responsibilityKeys.length > 0
    ) {
      const key = a.playerId + '|' + a.teacherPersonId;
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
  const teachingGroups = [...groups.entries()]
    .sort((a, b) => byText(a[0], b[0]))
    .map(([, a]) => a);
  const minted = mintRecordIds(
    world,
    1 +
      capabilityCount +
      readinessCount +
      targets.length +
      teachingGroups.length,
  );
  let cursor = 0;
  const checkpointId = minted.ids[cursor++]!;
  const events: DevelopmentEvent[] = [];
  const deltas: CapabilityDelta[] = [];
  let readiness = [...world.development.readiness];
  let roleKnowledge = [...world.development.roleKnowledge];
  const elapsedDays = SimDate.parse(window.toDate).daysSince(
    SimDate.parse(window.fromDate),
  );
  const drawStart = rng.snapshot().draws;
  const addEvent = (
    playerId: EntityId,
    kind: string,
    beforeBp: number,
    afterBp: number,
    capabilityKeys: readonly string[],
    responsibilityKeys: readonly string[],
    causes: readonly RecordId[],
  ) => {
    events.push({
      id: minted.ids[cursor++]!,
      playerId,
      checkpointId,
      occurredAt: window.toDate,
      kind,
      capabilityKeys,
      responsibilityKeys,
      beforeBp,
      afterBp,
      causalRecordIds: [window.id, ...causes],
    });
  };
  for (const player of players) {
    const profile = developmentProfileFor(world.development, player.personId);
    const playerAllocations = allocations.filter(
      (a) => a.playerId === player.personId,
    );
    const load = loads.get(player.personId) ?? 0;
    const prior = readinessFor(world.development, player.personId);
    const fatigue = prior?.acuteFatigueBp ?? 0;
    for (const capability of [...player.capabilities].sort((a, b) =>
      byText(a.key, b.key),
    )) {
      const family = familyOfCapability(rules, capability.key);
      if (family === undefined) continue;
      let teachingUnits = 0,
        teachingValue = 0;
      for (const a of playerAllocations) {
        if (!a.responsibilityKeys.includes(capability.key)) continue;
        const skill =
          world.development.teachingProfiles
            .find((t) => t.personId === a.teacherPersonId)
            ?.expertise.find((e) => e.responsibilityKey === capability.key)
            ?.teachingBp ?? 0;
        const share = Math.floor(a.units / a.responsibilityKeys.length);
        teachingUnits += share;
        teachingValue += share * skill;
      }
      const work = playerAllocations
        .filter(
          (a) =>
            a.resourceKey === 'first_team_reps' ||
            a.resourceKey === 'development_reps',
        )
        .reduce((n, a) => n + a.units, 0);
      const deltaBp = resolveCapabilityAdaptation({
        currentValueBp: capability.valueBp,
        family,
        ageDays: SimDate.parse(window.toDate).daysSince(
          SimDate.parse(player.birthDate),
        ),
        malleabilityBp:
          prior === undefined
            ? 0
            : (profile?.capabilityResponses.find(
                (r) => r.capabilityKey === capability.key,
              )?.malleabilityBp ?? 0),
        meaningfulUnits: work,
        loadUnits: load,
        maxLoadUnits: rules.maxPlayerLoadUnitsPerCheckpoint,
        teachingBp:
          teachingUnits > 0 ? Math.floor(teachingValue / teachingUnits) : 0,
        conditioningBp: prior?.conditioningBp ?? 0,
        acuteFatigueBp: fatigue,
        elapsedDays,
        rollU32: rng.nextU32(),
        includeAging: false,
      });
      deltas.push({
        playerId: player.personId,
        capabilityKey: capability.key,
        deltaBp,
      });
      addEvent(
        player.personId,
        'capability_adaptation',
        capability.valueBp,
        capability.valueBp + deltaBp,
        [capability.key],
        [],
        playerAllocations.map((a) => a.id),
      );
    }
    if (prior !== undefined) {
      const nextFatigue = bp(
        fatigue +
          Math.floor((load * 10000) / rules.maxPlayerLoadUnitsPerCheckpoint),
      );
      const conditioningDelta =
        load > 0
          ? Math.floor(
              (Math.min(load, rules.maxPlayerLoadUnitsPerCheckpoint) *
                rules.conditioningScaleBp) /
                rules.maxPlayerLoadUnitsPerCheckpoint,
            )
          : 0;
      const nextConditioning = bp(prior.conditioningBp + conditioningDelta);
      readiness = readiness.map((r) =>
        r.playerId !== player.personId
          ? r
          : {
              ...r,
              conditioningBp: nextConditioning,
              acuteFatigueBp: nextFatigue,
              accumulatedLoadUnits: r.accumulatedLoadUnits + load,
              updatedAt: window.toDate,
            },
      );
      addEvent(
        player.personId,
        'readiness_conditioning',
        prior.conditioningBp,
        nextConditioning,
        [],
        [],
        playerAllocations.map((a) => a.id),
      );
      addEvent(
        player.personId,
        'readiness_fatigue',
        prior.acuteFatigueBp,
        nextFatigue,
        [],
        [],
        playerAllocations.map((a) => a.id),
      );
    }
    for (const target of targets.filter(
      (t) => t.playerId === player.personId,
    )) {
      const profile = developmentProfileFor(world.development, target.playerId);
      const previous = roleKnowledge.find(
        (k) =>
          k.playerId === target.playerId &&
          k.schemeKey === target.schemeKey &&
          k.responsibilityKey === target.responsibilityKey,
      );
      // Missing profiles manufacture no responsiveness. Work/history can still be recorded.
      const learning = resolveRoleLearning({
        ...target,
        knowledge: roleKnowledge,
        allocations: allocations.map((a) => ({
          ...a,
          units: Math.floor(
            a.units /
              Math.max(
                1,
                targets.filter(
                  (t) =>
                    t.playerId === target.playerId &&
                    t.responsibilityKey === target.responsibilityKey,
                ).length,
              ),
          ),
        })),
        teachingProfiles: world.development.teachingProfiles,
        processingBp: profile?.processingBp ?? 0,
        adaptabilityBp: profile?.adaptabilityBp ?? 0,
        rules,
        occurredAt: window.toDate,
      });
      if (learning.lastMeaningfulRepAt !== null) {
        const record: RoleKnowledgeRecord = {
          ...target,
          familiarityBp: learning.afterBp,
          lastMeaningfulRepAt: learning.lastMeaningfulRepAt,
        };
        roleKnowledge = [
          ...roleKnowledge.filter(
            (k) =>
              !(
                k.playerId === target.playerId &&
                k.schemeKey === target.schemeKey &&
                k.responsibilityKey === target.responsibilityKey
              ),
          ),
          record,
        ];
      }
      addEvent(
        target.playerId,
        'role_learning',
        previous?.familiarityBp ?? 0,
        learning.afterBp,
        [],
        [target.responsibilityKey],
        learning.causalRecordIds,
      );
    }
  }
  const claims: ClaimRecord[] = teachingGroups.map((group) => {
    const first = group[0]!;
    return {
      id: minted.ids[cursor++]!,
      subject: { kind: 'entity', id: first.playerId },
      propositionType: 'practice_observation',
      proposition: {
        observation: 'completed_supervised_responsibility_work',
        windowId: window.id,
        responsibilityKeys: [
          ...new Set(group.flatMap((a) => a.responsibilityKeys)),
        ].sort(byText),
      },
      sourcePersonId: first.teacherPersonId!,
      sourceFamilyId: 'practice-' + checkpointId,
      observedAt: window.toDate,
      acquiredAt: window.toDate,
      visibility: 'organization',
      holderOrganizationIds: [window.organizationId],
      confidence: 'medium',
      possibleBias: null,
      corroboratesClaimIds: [],
      contradictsClaimIds: [],
      sharedFromClaimId: null,
    };
  });
  const checkpoint: DevelopmentCheckpointRecord = {
    id: checkpointId,
    organizationId: window.organizationId,
    windowId: window.id,
    fromDate: window.fromDate,
    toDate: window.toDate,
    resolvedAt: window.toDate,
    allocationIds: allocations.map((a) => a.id),
    rngDrawStart: drawStart,
    rngDrawCount: rng.snapshot().draws - drawStart,
    eventIds: events.map((e) => e.id),
  };
  return {
    world: {
      ...world,
      roster: applyCapabilityDeltas(world.roster, deltas),
      rng: rng.snapshot(),
      development: {
        ...world.development,
        readiness: readiness.sort((a, b) => byText(a.playerId, b.playerId)),
        roleKnowledge: roleKnowledge.sort(
          (a, b) =>
            byText(a.playerId, b.playerId) ||
            byText(a.schemeKey, b.schemeKey) ||
            byText(a.responsibilityKey, b.responsibilityKey),
        ),
        opportunityWindows: world.development.opportunityWindows.map((w) =>
          w.id === window.id ? { ...w, status: 'resolved' } : w,
        ),
        checkpoints: [...world.development.checkpoints, checkpoint].sort(byId),
        events: [...world.development.events, ...events].sort(byId),
      },
      information: {
        ...world.information,
        claims: [...world.information.claims, ...claims].sort(byId),
      },
      nextIds: { ...world.nextIds, record: minted.next },
    },
    eventSpecs: [
      ...passive.eventSpecs,
      spec('DevelopmentCheckpointResolved', {
        checkpointId,
        windowId: window.id,
        playerIds: players.map((p) => p.personId),
        developmentEventIds: events.map((e) => e.id),
        practiceClaimIds: claims.map((c) => c.id),
      }),
    ],
  };
};
