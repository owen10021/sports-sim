import type { EventSpec } from './commandRouter';
import { byId, mintRecordIds, spec } from './commandSupport';
import type {
  DevelopmentEvent,
  PlayerReadinessRecord,
  RoleKnowledgeRecord,
} from './development';
import { developmentProfileFor, readinessAfterLoad } from './development';
import { requireDevelopmentRules } from './developmentRules';
import { requireFootballRules, type FootballRulesV1 } from './footballRules';
import { isValidId, type EntityId, type RecordId } from './ids';
import { roleLearningGainBp } from './roleLearning';
import { currentRosterMembership } from './roster';
import type { LeagueRulesetManifest } from './ruleset';
import { SimDate } from './simDate';
import type { FootballWorld } from './world';

/**
 * Package D's ONLY ingress for football usage (Package E).
 *
 * It records exposure that has ALREADY been legally resolved elsewhere: how much work a
 * player did in a resolved play and which responsibilities that rep meaningfully exercised.
 * It moves readiness through the single Package D workload formula and role familiarity
 * through the single Package D role-learning formula. It never touches the capability
 * ledger (there is no per-snap growth, XP or rating), never creates football history or
 * medical episodes, never decides whether the usage was allowed, and never draws randomness.
 */
export interface FootballUsageEvidence {
  readonly fixtureId: RecordId;
  readonly playId: RecordId;
  readonly organizationId: EntityId;
  readonly playerId: EntityId;
  readonly occurredAt: string;
  /** Ruleset-converted workload (see `footballWorkloadUnits`), a safe integer >= 0. */
  readonly workloadUnits: number;
  /** Ruleset-declared contact class of the exposure; consumed by injury resolution. */
  readonly contactClass: string;
  readonly responsibilityExposures: readonly {
    readonly schemeKey: string;
    readonly responsibilityKey: string;
    readonly meaningfulReps: number;
  }[];
  readonly actionExposures: readonly {
    readonly actionKey: string;
    readonly attempts: number;
  }[];
}

export class FootballUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballUsageError';
  }
}

const fail = (message: string): never => {
  throw new FootballUsageError(message);
};

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const EVIDENCE_KEYS = [
  'fixtureId',
  'playId',
  'organizationId',
  'playerId',
  'occurredAt',
  'workloadUnits',
  'contactClass',
  'responsibilityExposures',
  'actionExposures',
] as const;

/**
 * The ruleset's football-exposure -> Package D workload conversion: the one place action
 * attempts become workload units. Pure. Unknown actions are an error, never zero.
 */
export const footballWorkloadUnits = (
  rules: FootballRulesV1,
  actionExposures: readonly {
    readonly actionKey: string;
    readonly attempts: number;
  }[],
): number =>
  actionExposures.reduce((total, e) => {
    const conversion = rules.exposureConversion.find(
      (c) => c.actionKey === e.actionKey,
    );
    if (conversion === undefined)
      return fail(`unknown action "${e.actionKey}" has no workload conversion`);
    return total + conversion.loadUnitsPerExposure * e.attempts;
  }, 0);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const exactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  what: string,
): void => {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${what} has unsupported field "${key}"`);
  for (const key of allowed)
    if (!(key in value)) fail(`${what} is missing field "${key}"`);
};

const safeCount = (v: unknown, what: string): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > 1e9)
    return fail(`${what} must be a safe integer in [0, 1000000000]`);
  return v;
};

type Checked = {
  readonly item: FootballUsageEvidence;
  readonly responsibilityExposures: FootballUsageEvidence['responsibilityExposures'];
};

/** Validate one untrusted evidence item against the world and rules; never mutates. */
const checkItem = (
  raw: unknown,
  index: number,
  world: FootballWorld,
  football: FootballRulesV1,
): Checked => {
  const what = `evidence[${index}]`;
  if (!isRecord(raw)) return fail(`${what} must be an object`);
  exactKeys(raw, EVIDENCE_KEYS, what);
  const item = raw as unknown as FootballUsageEvidence;
  for (const k of [
    'fixtureId',
    'playId',
    'organizationId',
    'playerId',
  ] as const)
    if (typeof item[k] !== 'string' || !isValidId(item[k]))
      fail(`${what}.${k} must be a valid id`);
  const fixture = world.football.fixtures.find((f) => f.id === item.fixtureId);
  if (fixture === undefined)
    return fail(`${what} names unknown fixture "${item.fixtureId}"`);
  if (
    fixture.homeOrganizationId !== item.organizationId &&
    fixture.awayOrganizationId !== item.organizationId
  )
    fail(
      `${what} organization "${item.organizationId}" is not a participant in fixture "${fixture.id}"`,
    );
  if (!SimDate.isValidISO(item.occurredAt))
    fail(`${what}.occurredAt must be a valid YYYY-MM-DD date`);
  if (item.occurredAt !== fixture.fixtureDate)
    fail(
      `${what}.occurredAt ${item.occurredAt} is not the fixture's game day ${fixture.fixtureDate}`,
    );
  if (item.occurredAt > world.simDate)
    fail(`${what}.occurredAt ${item.occurredAt} is after the world date`);
  const player = world.roster.players.find((p) => p.personId === item.playerId);
  if (player === undefined)
    fail(`${what} names unknown player "${item.playerId}"`);
  const membership = currentRosterMembership(
    world.roster,
    item.playerId,
    item.occurredAt,
  );
  if (membership?.organizationId !== item.organizationId)
    fail(
      `${what} player "${item.playerId}" is not on the roster of "${item.organizationId}" on ${item.occurredAt}`,
    );
  const readiness = world.development.readiness.find(
    (r) => r.playerId === item.playerId,
  );
  if (readiness === undefined)
    fail(`${what} player "${item.playerId}" has no readiness record`);
  else if (item.occurredAt < readiness.updatedAt)
    fail(`${what}.occurredAt would rewind readiness for "${item.playerId}"`);
  safeCount(item.workloadUnits, `${what}.workloadUnits`);
  if (!football.injury.contactClasses.includes(item.contactClass))
    fail(`${what}.contactClass "${String(item.contactClass)}" is not declared`);

  if (!Array.isArray(item.actionExposures))
    fail(`${what}.actionExposures must be an array`);
  const seenActions = new Set<string>();
  item.actionExposures.forEach((e, i) => {
    const where = `${what}.actionExposures[${i}]`;
    if (!isRecord(e)) return fail(`${where} must be an object`);
    exactKeys(e, ['actionKey', 'attempts'], where);
    if (!football.actions.some((a) => a.actionKey === e.actionKey))
      fail(`${where} names unknown action "${String(e.actionKey)}"`);
    safeCount(e.attempts, `${where}.attempts`);
    if (seenActions.has(e.actionKey as string))
      fail(`${where} has a duplicate action "${String(e.actionKey)}"`);
    seenActions.add(e.actionKey as string);
  });
  if (
    footballWorkloadUnits(football, item.actionExposures) !== item.workloadUnits
  )
    fail(
      `${what}.workloadUnits does not match the ruleset exposure conversion of its action exposures`,
    );

  if (!Array.isArray(item.responsibilityExposures))
    fail(`${what}.responsibilityExposures must be an array`);
  const seenResponsibilities = new Set<string>();
  item.responsibilityExposures.forEach((e, i) => {
    const where = `${what}.responsibilityExposures[${i}]`;
    if (!isRecord(e)) return fail(`${where} must be an object`);
    exactKeys(e, ['schemeKey', 'responsibilityKey', 'meaningfulReps'], where);
    if (!football.schemes.some((s) => s.schemeKey === e.schemeKey))
      fail(`${where} names unknown scheme "${String(e.schemeKey)}"`);
    if (
      !football.responsibilities.some(
        (r) => r.responsibilityKey === e.responsibilityKey,
      )
    )
      fail(
        `${where} names unknown responsibility "${String(e.responsibilityKey)}"`,
      );
    safeCount(e.meaningfulReps, `${where}.meaningfulReps`);
    const key = `${String(e.schemeKey)}|${String(e.responsibilityKey)}`;
    if (seenResponsibilities.has(key))
      fail(`${where} has a duplicate responsibility "${key}"`);
    seenResponsibilities.add(key);
  });
  return {
    item,
    responsibilityExposures: [...item.responsibilityExposures].sort(
      (a, b) =>
        byText(a.schemeKey, b.schemeKey) ||
        byText(a.responsibilityKey, b.responsibilityKey),
    ),
  };
};

type ProposedEvent = Omit<DevelopmentEvent, 'id' | 'checkpointId'>;

/**
 * Apply already-resolved football exposure to Package D's private readiness and role
 * knowledge. Pure: validates ALL evidence before changing anything, applies it in canonical
 * (fixture, play, player) order whatever order it arrived in, records one `football_usage`
 * checkpoint with minted ids, and consumes no randomness. The complete-game resolver may
 * call it after each resolved play on its working world; the kernel commits once.
 */
export const applyFootballUsageEvidence = (
  world: FootballWorld,
  ruleset: LeagueRulesetManifest,
  evidence: readonly FootballUsageEvidence[],
): {
  readonly nextWorld: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
} => {
  const development = requireDevelopmentRules(ruleset);
  const football = requireFootballRules(ruleset);
  if (!Array.isArray(evidence)) return fail('evidence must be an array');
  if (evidence.length === 0) return { nextWorld: world, eventSpecs: [] };

  const checked = evidence.map((raw, i) => checkItem(raw, i, world, football));
  const days = new Set(checked.map((c) => c.item.occurredAt));
  if (days.size !== 1)
    fail('one call records exactly one game day of football usage');
  const occurredAt = checked[0]!.item.occurredAt;

  const seen = new Set<string>();
  for (const { item } of checked) {
    const key = `${item.fixtureId}|${item.playId}|${item.playerId}`;
    if (seen.has(key))
      fail(`duplicate evidence for fixture/play/player ${key}`);
    seen.add(key);
    if (
      world.development.events.some(
        (e) =>
          e.kind === 'football_usage' &&
          e.playerId === item.playerId &&
          e.causalRecordIds.includes(item.playId),
      )
    )
      fail(
        `football usage for play "${item.playId}" and player "${item.playerId}" is already recorded`,
      );
  }

  const ordered = [...checked].sort(
    (a, b) =>
      byText(a.item.fixtureId, b.item.fixtureId) ||
      byText(a.item.playId, b.item.playId) ||
      byText(a.item.playerId, b.item.playerId),
  );

  let readiness: PlayerReadinessRecord[] = [...world.development.readiness];
  let roleKnowledge: RoleKnowledgeRecord[] = [
    ...world.development.roleKnowledge,
  ];
  const proposed: ProposedEvent[] = [];
  const playerIds = new Set<string>();

  for (const { item, responsibilityExposures } of ordered) {
    playerIds.add(item.playerId);
    const causes = [item.fixtureId, item.playId];
    const prior = readiness.find((r) => r.playerId === item.playerId)!;
    const next = readinessAfterLoad(
      prior,
      item.workloadUnits,
      development,
      occurredAt,
    );
    readiness = readiness.map((r) => (r.playerId === item.playerId ? next : r));
    proposed.push({
      playerId: item.playerId,
      occurredAt,
      kind: 'football_usage',
      capabilityKeys: [],
      responsibilityKeys: [],
      beforeBp: prior.acuteFatigueBp,
      afterBp: next.acuteFatigueBp,
      causalRecordIds: causes,
    });
    proposed.push({
      playerId: item.playerId,
      occurredAt,
      kind: 'football_usage_conditioning',
      capabilityKeys: [],
      responsibilityKeys: [],
      beforeBp: prior.conditioningBp,
      afterBp: next.conditioningBp,
      causalRecordIds: causes,
    });
    const profile = developmentProfileFor(world.development, item.playerId);
    for (const exposure of responsibilityExposures) {
      if (exposure.meaningfulReps <= 0) continue;
      const existing = roleKnowledge.find(
        (k) =>
          k.playerId === item.playerId &&
          k.schemeKey === exposure.schemeKey &&
          k.responsibilityKey === exposure.responsibilityKey,
      );
      const beforeBp = existing?.familiarityBp ?? 0;
      const gain = roleLearningGainBp({
        beforeBp,
        meaningfulUnits: Math.min(
          development.maxPlayerLoadUnitsPerCheckpoint,
          exposure.meaningfulReps,
        ),
        // Experience in a game has no teacher: the neutral factor, not a second formula.
        teachingBp: 10000,
        processingBp: profile?.processingBp ?? 0,
        adaptabilityBp: profile?.adaptabilityBp ?? 0,
        rules: development,
      });
      const afterBp = Math.min(10000, beforeBp + gain);
      const transferFamilyKey =
        existing?.transferFamilyKey ??
        football.responsibilities.find(
          (r) => r.responsibilityKey === exposure.responsibilityKey,
        )!.transferFamilyKey;
      const record: RoleKnowledgeRecord = {
        playerId: item.playerId,
        schemeKey: exposure.schemeKey,
        responsibilityKey: exposure.responsibilityKey,
        transferFamilyKey,
        familiarityBp: afterBp,
        lastMeaningfulRepAt: occurredAt,
      };
      roleKnowledge = [
        ...roleKnowledge.filter((k) => k !== existing),
        record,
      ].sort(
        (a, b) =>
          byText(a.playerId, b.playerId) ||
          byText(a.schemeKey, b.schemeKey) ||
          byText(a.responsibilityKey, b.responsibilityKey),
      );
      proposed.push({
        playerId: item.playerId,
        occurredAt,
        kind: 'football_usage_role_familiarity',
        capabilityKeys: [],
        responsibilityKeys: [exposure.responsibilityKey],
        beforeBp,
        afterBp,
        causalRecordIds: causes,
      });
    }
  }

  const minted = mintRecordIds(world, proposed.length + 1);
  const checkpointId = minted.ids[0]!;
  const events: DevelopmentEvent[] = proposed.map((e, i) => ({
    ...e,
    id: minted.ids[i + 1]!,
    checkpointId,
  }));
  const nextWorld: FootballWorld = {
    ...world,
    nextIds: { ...world.nextIds, record: minted.next },
    development: {
      ...world.development,
      readiness,
      roleKnowledge,
      checkpoints: [
        ...world.development.checkpoints,
        {
          id: checkpointId,
          kind: 'football_usage' as const,
          organizationId: null,
          windowId: null,
          fromDate: occurredAt,
          toDate: occurredAt,
          resolvedAt: occurredAt,
          allocationIds: [],
          rngDrawStart: world.rng.draws,
          rngDrawCount: 0,
          eventIds: events.map((e) => e.id),
        },
      ].sort(byId),
      events: [...world.development.events, ...events].sort(byId),
    },
  };
  return {
    nextWorld,
    eventSpecs: [
      spec('FootballUsageRecorded', {
        checkpointId,
        occurredAt,
        playerIds: [...playerIds].sort(byText),
        developmentEventIds: events.map((e) => e.id),
      }),
    ],
  };
};
