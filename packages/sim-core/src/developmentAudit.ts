import type { EntityId } from './ids';
import { isValidId } from './ids';
import { currentRosterMembership } from './roster';
import { SimDate } from './simDate';
import { teachingProblems } from './roleLearning';
import type { DevelopmentRulesV1 } from './developmentRules';
import type { FootballWorld } from './world';

export const DEVELOPMENT_FINDING_CODES = [
  'OPPORTUNITY_OVERALLOCATED',
  'ALLOCATION_WITHOUT_ROSTER_ACCESS',
  'TEACHING_BANDWIDTH_EXCEEDED',
  'INVALID_ROLE_KNOWLEDGE',
  'INVALID_READINESS_RANGE',
  'INVALID_CAPABILITY_RANGE',
  'RESOLVED_WINDOW_WITHOUT_CHECKPOINT',
  'CHECKPOINT_WITHOUT_ALLOCATIONS',
  'MEDICAL_PROGRESS_WITHOUT_EPISODE',
  'CLEARANCE_WITHOUT_EPISODE',
  'USAGE_EXCEEDS_CLEARANCE',
  'MEDICAL_REPORT_INACCESSIBLE_BASIS',
  'DEVELOPMENT_EVENT_WITHOUT_CAUSE',
] as const;
export type DevelopmentFindingCode = (typeof DEVELOPMENT_FINDING_CODES)[number];
export type DevelopmentFindingSeverity = 'error' | 'warning';

export interface DevelopmentFinding {
  readonly code: DevelopmentFindingCode;
  readonly severity: DevelopmentFindingSeverity;
  readonly organizationId?: EntityId;
  readonly subjectIds: readonly string[];
  readonly detail: string;
}

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const validBp = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value <= 10000;

const historicalMedicalCap = (
  world: FootballWorld,
  organizationId: EntityId,
  playerId: EntityId,
  at: string,
): number | null => {
  let cap: number | null = null;
  for (const episode of world.medical.episodes) {
    if (episode.playerId !== playerId || episode.onsetAt > at) continue;
    const latest = world.medical.clearances
      .filter(
        (clearance) =>
          clearance.episodeId === episode.id &&
          clearance.organizationId === organizationId &&
          clearance.playerId === playerId &&
          clearance.committedAt <= at,
      )
      .sort((a, b) =>
        a.committedAt === b.committedAt
          ? byText(a.id, b.id)
          : byText(a.committedAt, b.committedAt),
      )
      .at(-1);
    if (latest === undefined || latest.participation === 'full') continue;
    const episodeCap = latest.participation === 'out' ? 0 : latest.maxLoadUnits;
    if (episodeCap === null) continue;
    cap = cap === null ? episodeCap : Math.min(cap, episodeCap);
  }
  return cap;
};

/** Read-only Package D integrity audit. It reports corruption; it never repairs it. */
export const auditDevelopmentWorld = (
  world: FootballWorld,
  rules: DevelopmentRulesV1,
): readonly DevelopmentFinding[] => {
  const findings: DevelopmentFinding[] = [];
  const add = (
    code: DevelopmentFindingCode,
    detail: string,
    subjectIds: readonly string[],
    organizationId?: EntityId,
    severity: DevelopmentFindingSeverity = 'error',
  ) =>
    findings.push({
      code,
      severity,
      ...(organizationId === undefined ? {} : { organizationId }),
      subjectIds: [...subjectIds].sort(byText),
      detail,
    });

  const windowsById = new Map(
    world.development.opportunityWindows.map((window) => [window.id, window]),
  );
  const allocationsById = new Map(
    world.development.opportunityAllocations.map((allocation) => [
      allocation.id,
      allocation,
    ]),
  );
  const checkpointsById = new Map(
    world.development.checkpoints.map((checkpoint) => [
      checkpoint.id,
      checkpoint,
    ]),
  );
  const episodesById = new Map(
    world.medical.episodes.map((episode) => [episode.id, episode]),
  );

  for (const window of world.development.opportunityWindows) {
    const allocations = world.development.opportunityAllocations.filter(
      (allocation) => allocation.windowId === window.id,
    );
    for (const pool of window.pools) {
      const used = allocations
        .filter(
          (allocation) =>
            allocation.resourceKey === pool.resourceKey &&
            allocation.scopeKey === pool.scopeKey,
        )
        .reduce((sum, allocation) => sum + allocation.units, 0);
      if (!Number.isSafeInteger(used) || used > pool.capacityUnits)
        add(
          'OPPORTUNITY_OVERALLOCATED',
          `${pool.resourceKey}/${pool.scopeKey} uses ${used} of ${pool.capacityUnits}`,
          [window.id],
          window.organizationId,
        );
    }
    if (
      window.status === 'resolved' &&
      !world.development.checkpoints.some(
        (checkpoint) => checkpoint.windowId === window.id,
      )
    )
      add(
        'RESOLVED_WINDOW_WITHOUT_CHECKPOINT',
        'resolved opportunity window has no development checkpoint',
        [window.id],
        window.organizationId,
      );
  }

  for (const allocation of world.development.opportunityAllocations) {
    const membership = currentRosterMembership(
      world.roster,
      allocation.playerId,
      allocation.committedAt,
    );
    if (membership?.organizationId !== allocation.organizationId)
      add(
        'ALLOCATION_WITHOUT_ROSTER_ACCESS',
        `player ${allocation.playerId} was not on ${allocation.organizationId} at ${allocation.committedAt}`,
        [allocation.id, allocation.playerId],
        allocation.organizationId,
      );
    if (
      allocation.teacherPersonId !== null &&
      teachingProblems(world, [allocation], {
        committedHistory: true,
      }).includes('TEACHING_BANDWIDTH_EXCEEDED')
    )
      add(
        'TEACHING_BANDWIDTH_EXCEEDED',
        `teacher ${allocation.teacherPersonId} exceeds historical bandwidth`,
        [allocation.id, allocation.teacherPersonId],
        allocation.organizationId,
      );
  }

  const roleKnowledgeKeys = new Set<string>();
  for (const knowledge of world.development.roleKnowledge) {
    const knowledgeKey = `${knowledge.playerId}|${knowledge.schemeKey}|${knowledge.responsibilityKey}`;
    const duplicateKnowledge = roleKnowledgeKeys.has(knowledgeKey);
    roleKnowledgeKeys.add(knowledgeKey);
    if (
      !world.roster.players.some(
        (player) => player.personId === knowledge.playerId,
      ) ||
      !isValidId(knowledge.schemeKey) ||
      !isValidId(knowledge.responsibilityKey) ||
      !isValidId(knowledge.transferFamilyKey) ||
      duplicateKnowledge ||
      !validBp(knowledge.familiarityBp) ||
      (knowledge.lastMeaningfulRepAt !== null &&
        (!SimDate.isValidISO(knowledge.lastMeaningfulRepAt) ||
          knowledge.lastMeaningfulRepAt > world.simDate))
    )
      add(
        'INVALID_ROLE_KNOWLEDGE',
        'role knowledge has an invalid player, key, range or meaningful-rep date',
        [knowledge.playerId, knowledge.schemeKey, knowledge.responsibilityKey],
      );
  }

  for (const readiness of world.development.readiness) {
    if (
      !world.roster.players.some(
        (player) => player.personId === readiness.playerId,
      ) ||
      !validBp(readiness.conditioningBp) ||
      !validBp(readiness.acuteFatigueBp) ||
      !Number.isSafeInteger(readiness.accumulatedLoadUnits) ||
      readiness.accumulatedLoadUnits < 0 ||
      !SimDate.isValidISO(readiness.updatedAt) ||
      readiness.updatedAt > world.simDate
    )
      add(
        'INVALID_READINESS_RANGE',
        'readiness has an invalid player, basis-point field, load or date',
        [readiness.playerId],
      );
  }

  const allowedCapabilities = new Set(
    rules.capabilityFamilies.flatMap((family) => [...family.capabilityKeys]),
  );
  for (const player of world.roster.players) {
    const seenCapabilities = new Set<string>();
    for (const capability of player.capabilities) {
      const duplicateCapability = seenCapabilities.has(capability.key);
      seenCapabilities.add(capability.key);
      if (
        !isValidId(capability.key) ||
        !allowedCapabilities.has(capability.key) ||
        duplicateCapability ||
        !validBp(capability.valueBp)
      )
        add(
          'INVALID_CAPABILITY_RANGE',
          `capability ${capability.key} is outside 0..10000 or has an invalid key`,
          [player.personId, capability.key],
        );
    }
  }

  for (const checkpoint of world.development.checkpoints) {
    if (checkpoint.kind === 'passive') continue;
    const missingAllocation = checkpoint.allocationIds.some(
      (id) =>
        !allocationsById.has(id) ||
        allocationsById.get(id)!.windowId !== checkpoint.windowId,
    );
    if (
      checkpoint.windowId === null ||
      !windowsById.has(checkpoint.windowId) ||
      checkpoint.allocationIds.length === 0 ||
      missingAllocation
    )
      add(
        'CHECKPOINT_WITHOUT_ALLOCATIONS',
        'work checkpoint has no valid allocation set/window linkage',
        [
          checkpoint.id,
          ...(checkpoint.windowId === null ? [] : [checkpoint.windowId]),
        ],
        checkpoint.organizationId ?? undefined,
      );
  }

  for (const progress of world.medical.progress)
    if (!episodesById.has(progress.episodeId))
      add(
        'MEDICAL_PROGRESS_WITHOUT_EPISODE',
        'medical progress references a missing episode',
        [progress.id, progress.episodeId],
      );

  for (const clearance of world.medical.clearances) {
    const episode = episodesById.get(clearance.episodeId);
    if (episode === undefined || episode.playerId !== clearance.playerId)
      add(
        'CLEARANCE_WITHOUT_EPISODE',
        'medical clearance references a missing or mismatched episode',
        [clearance.id, clearance.episodeId, clearance.playerId],
        clearance.organizationId,
      );
  }

  for (const window of world.development.opportunityWindows) {
    const perPlayer = new Map<EntityId, number>();
    for (const allocation of world.development.opportunityAllocations) {
      if (allocation.windowId !== window.id) continue;
      perPlayer.set(
        allocation.playerId,
        (perPlayer.get(allocation.playerId) ?? 0) + allocation.units,
      );
    }
    for (const [playerId, units] of perPlayer)
      if (units > rules.maxPlayerLoadUnitsPerCheckpoint)
        add(
          'OPPORTUNITY_OVERALLOCATED',
          `player ${playerId} workload ${units} exceeds ruleset max ${rules.maxPlayerLoadUnitsPerCheckpoint}`,
          [window.id, playerId],
          window.organizationId,
        );
  }
  const usageGroups = new Map<
    string,
    {
      organizationId: EntityId;
      playerId: EntityId;
      windowId: string;
      committedAt: string;
      units: number;
      allocationIds: string[];
    }
  >();
  for (const allocation of world.development.opportunityAllocations) {
    const key = `${allocation.organizationId}|${allocation.windowId}|${allocation.playerId}`;
    const existing = usageGroups.get(key);
    if (existing === undefined)
      usageGroups.set(key, {
        organizationId: allocation.organizationId,
        playerId: allocation.playerId,
        windowId: allocation.windowId,
        committedAt: allocation.committedAt,
        units: allocation.units,
        allocationIds: [allocation.id],
      });
    else {
      existing.units += allocation.units;
      existing.committedAt =
        existing.committedAt < allocation.committedAt
          ? allocation.committedAt
          : existing.committedAt;
      existing.allocationIds.push(allocation.id);
    }
  }
  for (const group of usageGroups.values()) {
    const cap = historicalMedicalCap(
      world,
      group.organizationId,
      group.playerId,
      group.committedAt,
    );
    if (cap !== null && group.units > cap)
      add(
        'USAGE_EXCEEDS_CLEARANCE',
        `workload ${group.units} exceeds historical medical cap ${cap}`,
        [...group.allocationIds, group.playerId, group.windowId],
        group.organizationId,
      );
  }

  for (const report of world.medical.reports) {
    const belief = world.information.beliefs.find(
      (entry) => entry.id === report.beliefId,
    );
    const claims = report.evidenceClaimIds.map((id) =>
      world.information.claims.find((entry) => entry.id === id),
    );
    if (
      belief === undefined ||
      belief.organizationId !== report.organizationId ||
      claims.some(
        (claim) =>
          claim === undefined ||
          (claim.visibility !== 'public' &&
            !claim.holderOrganizationIds.includes(report.organizationId)),
      )
    )
      add(
        'MEDICAL_REPORT_INACCESSIBLE_BASIS',
        'medical report cites a missing or organization-inaccessible belief/claim basis',
        [report.id, report.beliefId, ...report.evidenceClaimIds],
        report.organizationId,
      );
  }

  const knownCausalIds = new Set<string>([
    ...world.development.opportunityWindows.map((entry) => entry.id),
    ...world.development.opportunityAllocations.map((entry) => entry.id),
    ...world.plans.plans.map((entry) => entry.id),
    ...world.medical.episodes.map((entry) => entry.id),
    ...world.medical.reports.map((entry) => entry.id),
    ...world.medical.recommendations.map((entry) => entry.id),
    ...world.medical.clearances.map((entry) => entry.id),
  ]);
  for (const event of world.development.events) {
    const checkpoint = checkpointsById.get(event.checkpointId);
    const passive = checkpoint?.kind === 'passive';
    if (
      checkpoint === undefined ||
      !checkpoint.eventIds.includes(event.id) ||
      (!passive &&
        (event.causalRecordIds.length === 0 ||
          event.causalRecordIds.some((id) => !knownCausalIds.has(id))))
    )
      add(
        'DEVELOPMENT_EVENT_WITHOUT_CAUSE',
        'development event lacks a valid checkpoint/cause linkage',
        [event.id, event.checkpointId, ...event.causalRecordIds],
        checkpoint?.organizationId ?? undefined,
      );
  }

  return findings.sort(
    (a, b) =>
      byText(a.code, b.code) ||
      byText(a.organizationId ?? '', b.organizationId ?? '') ||
      byText(a.subjectIds.join(','), b.subjectIds.join(',')) ||
      byText(a.detail, b.detail),
  );
};

export interface DevelopmentMetrics {
  readonly opportunity: {
    readonly windows: number;
    readonly resolvedWindows: number;
    readonly allocations: number;
    readonly allocatedUnits: number;
    readonly byResourceScope: readonly {
      readonly resourceKey: string;
      readonly scopeKey: string;
      readonly allocations: number;
      readonly units: number;
    }[];
  };
  readonly capabilityChange: {
    readonly events: number;
    readonly changedEvents: number;
    readonly positiveBp: number;
    readonly negativeBp: number;
    readonly netDeltaBp: number;
    readonly absoluteDeltaBp: number;
    readonly byCapability: readonly {
      readonly capabilityKey: string;
      readonly events: number;
      readonly netDeltaBp: number;
      readonly absoluteDeltaBp: number;
    }[];
  };
  /** Exact age + capability-key slices; Package G may map capability keys to ruleset families. */
  readonly ageCapabilitySlices: readonly {
    readonly ageDays: number;
    readonly capabilityKey: string;
    readonly eventKind: string;
    readonly events: number;
    readonly netDeltaBp: number;
  }[];
  readonly roleLearning: {
    readonly records: number;
    readonly familiarityTotalBp: number;
    readonly byTransferFamily: readonly {
      readonly transferFamilyKey: string;
      readonly records: number;
      readonly familiarityTotalBp: number;
    }[];
  };
  readonly workload: {
    readonly allocations: number;
    readonly totalUnits: number;
    readonly maxPlayerWindowUnits: number;
    readonly byPlayer: readonly {
      readonly playerId: EntityId;
      readonly allocations: number;
      readonly totalUnits: number;
    }[];
  };
  readonly medicalDuration: {
    readonly episodes: number;
    readonly openEpisodes: number;
    readonly resolvedEpisodes: number;
    readonly progressRecords: number;
    readonly reports: number;
    readonly clearances: number;
    readonly totalEpisodeDays: number;
    readonly byCondition: readonly {
      readonly conditionKey: string;
      readonly episodes: number;
      readonly resolvedEpisodes: number;
      readonly totalDays: number;
    }[];
  };
}

/** Deterministic Package G-facing ecology counters; no balancing or knowledge interpretation. */
export const collectDevelopmentMetrics = (
  world: FootballWorld,
): DevelopmentMetrics => {
  const byResourceScope = new Map<
    string,
    { allocations: number; units: number }
  >();
  const workloadByPlayer = new Map<
    EntityId,
    { allocations: number; totalUnits: number }
  >();
  const playerWindowLoads = new Map<string, number>();
  for (const allocation of world.development.opportunityAllocations) {
    const resourceKey = `${allocation.resourceKey}|${allocation.scopeKey}`;
    const resource = byResourceScope.get(resourceKey) ?? {
      allocations: 0,
      units: 0,
    };
    resource.allocations += 1;
    resource.units += allocation.units;
    byResourceScope.set(resourceKey, resource);

    const player = workloadByPlayer.get(allocation.playerId) ?? {
      allocations: 0,
      totalUnits: 0,
    };
    player.allocations += 1;
    player.totalUnits += allocation.units;
    workloadByPlayer.set(allocation.playerId, player);
    const playerWindowKey = `${allocation.windowId}|${allocation.playerId}`;
    playerWindowLoads.set(
      playerWindowKey,
      (playerWindowLoads.get(playerWindowKey) ?? 0) + allocation.units,
    );
  }

  const capabilityByKey = new Map<
    string,
    { events: number; netDeltaBp: number; absoluteDeltaBp: number }
  >();
  const ageSlices = new Map<
    string,
    {
      ageDays: number;
      capabilityKey: string;
      eventKind: string;
      events: number;
      netDeltaBp: number;
    }
  >();
  let capabilityEvents = 0;
  let changedEvents = 0;
  let positiveBp = 0;
  let negativeBp = 0;
  let netDeltaBp = 0;
  let absoluteDeltaBp = 0;
  for (const event of world.development.events) {
    if (event.beforeBp === null || event.afterBp === null) continue;
    const delta = event.afterBp - event.beforeBp;
    if (event.capabilityKeys.length === 0) continue;
    capabilityEvents += 1;
    if (delta !== 0) changedEvents += 1;
    if (delta > 0) positiveBp += delta;
    if (delta < 0) negativeBp += -delta;
    netDeltaBp += delta;
    absoluteDeltaBp += Math.abs(delta);
    const player = world.roster.players.find(
      (entry) => entry.personId === event.playerId,
    );
    const ageDays =
      player === undefined
        ? -1
        : SimDate.parse(event.occurredAt).daysSince(
            SimDate.parse(player.birthDate),
          );
    for (const capabilityKey of event.capabilityKeys) {
      const capability = capabilityByKey.get(capabilityKey) ?? {
        events: 0,
        netDeltaBp: 0,
        absoluteDeltaBp: 0,
      };
      capability.events += 1;
      capability.netDeltaBp += delta;
      capability.absoluteDeltaBp += Math.abs(delta);
      capabilityByKey.set(capabilityKey, capability);

      const ageKey = `${ageDays}|${capabilityKey}|${event.kind}`;
      const slice = ageSlices.get(ageKey) ?? {
        ageDays,
        capabilityKey,
        eventKind: event.kind,
        events: 0,
        netDeltaBp: 0,
      };
      slice.events += 1;
      slice.netDeltaBp += delta;
      ageSlices.set(ageKey, slice);
    }
  }

  const roleByFamily = new Map<
    string,
    { records: number; familiarityTotalBp: number }
  >();
  for (const knowledge of world.development.roleKnowledge) {
    const family = roleByFamily.get(knowledge.transferFamilyKey) ?? {
      records: 0,
      familiarityTotalBp: 0,
    };
    family.records += 1;
    family.familiarityTotalBp += knowledge.familiarityBp;
    roleByFamily.set(knowledge.transferFamilyKey, family);
  }

  const medicalByCondition = new Map<
    string,
    { episodes: number; resolvedEpisodes: number; totalDays: number }
  >();
  let totalEpisodeDays = 0;
  for (const episode of world.medical.episodes) {
    const end =
      episode.status === 'resolved'
        ? (world.medical.progress
            .filter((progress) => progress.episodeId === episode.id)
            .sort((a, b) => byText(a.assessedAt, b.assessedAt))
            .at(-1)?.assessedAt ?? world.simDate)
        : world.simDate;
    const days = Math.max(
      0,
      SimDate.parse(end).daysSince(SimDate.parse(episode.onsetAt)),
    );
    totalEpisodeDays += days;
    const condition = medicalByCondition.get(episode.conditionKey) ?? {
      episodes: 0,
      resolvedEpisodes: 0,
      totalDays: 0,
    };
    condition.episodes += 1;
    if (episode.status === 'resolved') condition.resolvedEpisodes += 1;
    condition.totalDays += days;
    medicalByCondition.set(episode.conditionKey, condition);
  }

  return {
    opportunity: {
      windows: world.development.opportunityWindows.length,
      resolvedWindows: world.development.opportunityWindows.filter(
        (window) => window.status === 'resolved',
      ).length,
      allocations: world.development.opportunityAllocations.length,
      allocatedUnits: world.development.opportunityAllocations.reduce(
        (sum, allocation) => sum + allocation.units,
        0,
      ),
      byResourceScope: [...byResourceScope.entries()]
        .map(([key, value]) => {
          const [resourceKey, scopeKey] = key.split('|');
          return {
            resourceKey: resourceKey!,
            scopeKey: scopeKey!,
            ...value,
          };
        })
        .sort(
          (a, b) =>
            byText(a.resourceKey, b.resourceKey) ||
            byText(a.scopeKey, b.scopeKey),
        ),
    },
    capabilityChange: {
      events: capabilityEvents,
      changedEvents,
      positiveBp,
      negativeBp,
      netDeltaBp,
      absoluteDeltaBp,
      byCapability: [...capabilityByKey.entries()]
        .map(([capabilityKey, value]) => ({ capabilityKey, ...value }))
        .sort((a, b) => byText(a.capabilityKey, b.capabilityKey)),
    },
    ageCapabilitySlices: [...ageSlices.values()].sort(
      (a, b) =>
        a.ageDays - b.ageDays ||
        byText(a.capabilityKey, b.capabilityKey) ||
        byText(a.eventKind, b.eventKind),
    ),
    roleLearning: {
      records: world.development.roleKnowledge.length,
      familiarityTotalBp: world.development.roleKnowledge.reduce(
        (sum, knowledge) => sum + knowledge.familiarityBp,
        0,
      ),
      byTransferFamily: [...roleByFamily.entries()]
        .map(([transferFamilyKey, value]) => ({ transferFamilyKey, ...value }))
        .sort((a, b) => byText(a.transferFamilyKey, b.transferFamilyKey)),
    },
    workload: {
      allocations: world.development.opportunityAllocations.length,
      totalUnits: world.development.opportunityAllocations.reduce(
        (sum, allocation) => sum + allocation.units,
        0,
      ),
      maxPlayerWindowUnits: Math.max(0, ...playerWindowLoads.values()),
      byPlayer: [...workloadByPlayer.entries()]
        .map(([playerId, value]) => ({ playerId, ...value }))
        .sort((a, b) => byText(a.playerId, b.playerId)),
    },
    medicalDuration: {
      episodes: world.medical.episodes.length,
      openEpisodes: world.medical.episodes.filter(
        (episode) => episode.status === 'open',
      ).length,
      resolvedEpisodes: world.medical.episodes.filter(
        (episode) => episode.status === 'resolved',
      ).length,
      progressRecords: world.medical.progress.length,
      reports: world.medical.reports.length,
      clearances: world.medical.clearances.length,
      totalEpisodeDays,
      byCondition: [...medicalByCondition.entries()]
        .map(([conditionKey, value]) => ({ conditionKey, ...value }))
        .sort((a, b) => byText(a.conditionKey, b.conditionKey)),
    },
  };
};
