import {
  ManifestFormatError,
  asRecord,
  asSafeInt,
  requireExactKeys,
  type ValidationIssue,
} from './provenance';
import { PREFERENCE_LEVELS, type PreferenceLevel } from './market';
import { DRAFT_PICK_STATUSES, type DraftPickStatus } from './draft';
import {
  RIGHTS_KINDS,
  ROSTER_STATUSES,
  type RightsKind,
  type RosterStatus,
} from './roster';
import { parseSeedDate, parseSeedId, parseSeedInterval } from './seedParsing';
import type { LeagueRulesetManifest } from './ruleset';

/**
 * Optional Package C seed block: roster/market/scouting/draft starting state. Person and
 * organization identity stays in `initialEntities`; players are person entities.
 * Plain-string ids here; the world builds branded records from them.
 */
export type SeedPlayerCapability = {
  readonly key: string;
  readonly valueBp: number;
};

export type SeedPlayer = {
  readonly personId: string;
  readonly birthDate: string;
  readonly primaryRole: string;
  readonly roleTags: readonly string[];
  readonly capabilities: readonly SeedPlayerCapability[];
};

export type SeedRight = {
  readonly id: string;
  readonly playerId: string;
  readonly holderOrganizationId: string;
  readonly kind: RightsKind;
  readonly sourceRecordId: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};

export type SeedMembership = {
  readonly id: string;
  readonly playerId: string;
  readonly organizationId: string;
  readonly status: RosterStatus;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly sourceRecordId: string;
};

export type SeedAgentClient = {
  readonly id: string;
  readonly agentPersonId: string;
  readonly playerPersonId: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};

export type SeedPlayerPreference = {
  readonly playerPersonId: string;
  readonly security: PreferenceLevel;
  readonly earlyCash: PreferenceLevel;
  readonly roleOpportunity: PreferenceLevel;
  readonly contenderPreference: PreferenceLevel;
  readonly flexibility: PreferenceLevel;
};

export type SeedEvaluator = {
  readonly personId: string;
  readonly strongDimensions: readonly string[];
  readonly weakDimensions: readonly string[];
  readonly riskTolerance: PreferenceLevel;
};

export type SeedDraftClass = {
  readonly id: string;
  readonly season: number;
  readonly eligiblePlayerIds: readonly string[];
};

export type SeedDraftPick = {
  readonly id: string;
  readonly season: number;
  readonly round: number;
  readonly slot: number | null;
  readonly originalOrganizationId: string;
  readonly ownerOrganizationId: string;
  readonly status: DraftPickStatus;
};

export type PackageCSubstrateSeed = {
  readonly players: readonly SeedPlayer[];
  readonly rights: readonly SeedRight[];
  readonly memberships: readonly SeedMembership[];
  readonly agentClients: readonly SeedAgentClient[];
  readonly playerPreferences: readonly SeedPlayerPreference[];
  readonly evaluatorProfiles: readonly SeedEvaluator[];
  readonly draftClasses: readonly SeedDraftClass[];
  readonly draftPicks: readonly SeedDraftPick[];
  /** One complete, unique order of every organization. */
  readonly waiverPriority: readonly string[];
};

const BLOCK_KEYS = [
  'players',
  'rights',
  'memberships',
  'agentClients',
  'playerPreferences',
  'evaluatorProfiles',
  'draftClasses',
  'draftPicks',
  'waiverPriority',
] as const;

/** Names that would smuggle a summary rating, ceiling, grade or value into player truth. */
const FORBIDDEN_DIMENSION_FRAGMENTS = [
  'overall',
  'ovr',
  'potential',
  'ceiling',
  'grade',
  'rating',
  'tradevalue',
  'destination',
] as const;

const forbiddenDimension = (key: string): boolean => {
  const flat = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return FORBIDDEN_DIMENSION_FRAGMENTS.some((f) => flat.includes(f));
};

const arrayOf = <T>(
  value: unknown,
  what: string,
  parse: (raw: unknown, where: string) => T,
): T[] => {
  if (!Array.isArray(value))
    throw new ManifestFormatError(`${what} must be an array`);
  return value.map((raw, i) => parse(raw, `${what}[${i}]`));
};

const level = (value: unknown, what: string): PreferenceLevel => {
  if (!(PREFERENCE_LEVELS as readonly unknown[]).includes(value))
    throw new ManifestFormatError(`${what} is not recognized`);
  return value as PreferenceLevel;
};

const idList = (value: unknown, what: string): string[] => {
  const ids = arrayOf(value, what, (raw, where) => parseSeedId(raw, where));
  if (new Set(ids).size !== ids.length)
    throw new ManifestFormatError(`${what} has duplicates`);
  return ids;
};

const parseCapability = (raw: unknown, what: string): SeedPlayerCapability => {
  const rec = asRecord(raw, what);
  requireExactKeys(rec, ['key', 'valueBp'], [], what);
  const key = parseSeedId(rec.key, `${what}.key`);
  if (forbiddenDimension(key))
    throw new ManifestFormatError(
      `${what}.key "${key}" looks like a summary rating; players carry specific dimensions only`,
    );
  return { key, valueBp: asSafeInt(rec.valueBp, `${what}.valueBp`, 0, 10000) };
};

const parsePlayer = (raw: unknown, what: string): SeedPlayer => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    ['personId', 'birthDate', 'primaryRole', 'roleTags', 'capabilities'],
    [],
    what,
  );
  const capabilities = arrayOf(
    rec.capabilities,
    `${what}.capabilities`,
    parseCapability,
  );
  if (new Set(capabilities.map((c) => c.key)).size !== capabilities.length)
    throw new ManifestFormatError(`${what}.capabilities has a duplicate key`);
  return {
    personId: parseSeedId(rec.personId, `${what}.personId`),
    birthDate: parseSeedDate(rec.birthDate, `${what}.birthDate`),
    primaryRole: parseSeedId(rec.primaryRole, `${what}.primaryRole`),
    roleTags: idList(rec.roleTags, `${what}.roleTags`),
    capabilities,
  };
};

const parseRight = (raw: unknown, what: string): SeedRight => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    [
      'id',
      'playerId',
      'holderOrganizationId',
      'kind',
      'sourceRecordId',
      'effectiveFrom',
      'effectiveUntil',
    ],
    [],
    what,
  );
  if (!(RIGHTS_KINDS as readonly unknown[]).includes(rec.kind))
    throw new ManifestFormatError(`${what}.kind is not recognized`);
  const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    playerId: parseSeedId(rec.playerId, `${what}.playerId`),
    holderOrganizationId: parseSeedId(
      rec.holderOrganizationId,
      `${what}.holderOrganizationId`,
    ),
    kind: rec.kind as RightsKind,
    sourceRecordId: parseSeedId(rec.sourceRecordId, `${what}.sourceRecordId`),
    effectiveFrom: span.from,
    effectiveUntil: span.until,
  };
};

const parseMembership = (raw: unknown, what: string): SeedMembership => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    [
      'id',
      'playerId',
      'organizationId',
      'status',
      'effectiveFrom',
      'effectiveUntil',
      'sourceRecordId',
    ],
    [],
    what,
  );
  if (!(ROSTER_STATUSES as readonly unknown[]).includes(rec.status))
    throw new ManifestFormatError(`${what}.status is not recognized`);
  const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    playerId: parseSeedId(rec.playerId, `${what}.playerId`),
    organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
    status: rec.status as RosterStatus,
    effectiveFrom: span.from,
    effectiveUntil: span.until,
    sourceRecordId: parseSeedId(rec.sourceRecordId, `${what}.sourceRecordId`),
  };
};

const parseAgentClient = (raw: unknown, what: string): SeedAgentClient => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    [
      'id',
      'agentPersonId',
      'playerPersonId',
      'effectiveFrom',
      'effectiveUntil',
    ],
    [],
    what,
  );
  const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    agentPersonId: parseSeedId(rec.agentPersonId, `${what}.agentPersonId`),
    playerPersonId: parseSeedId(rec.playerPersonId, `${what}.playerPersonId`),
    effectiveFrom: span.from,
    effectiveUntil: span.until,
  };
};

const parsePreference = (raw: unknown, what: string): SeedPlayerPreference => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    [
      'playerPersonId',
      'security',
      'earlyCash',
      'roleOpportunity',
      'contenderPreference',
      'flexibility',
    ],
    [],
    what,
  );
  return {
    playerPersonId: parseSeedId(rec.playerPersonId, `${what}.playerPersonId`),
    security: level(rec.security, `${what}.security`),
    earlyCash: level(rec.earlyCash, `${what}.earlyCash`),
    roleOpportunity: level(rec.roleOpportunity, `${what}.roleOpportunity`),
    contenderPreference: level(
      rec.contenderPreference,
      `${what}.contenderPreference`,
    ),
    flexibility: level(rec.flexibility, `${what}.flexibility`),
  };
};

const parseEvaluator = (raw: unknown, what: string): SeedEvaluator => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    ['personId', 'strongDimensions', 'weakDimensions', 'riskTolerance'],
    [],
    what,
  );
  const strong = idList(rec.strongDimensions, `${what}.strongDimensions`);
  const weak = idList(rec.weakDimensions, `${what}.weakDimensions`);
  if (strong.some((d) => weak.includes(d)))
    throw new ManifestFormatError(
      `${what}: a dimension cannot be both strong and weak`,
    );
  return {
    personId: parseSeedId(rec.personId, `${what}.personId`),
    strongDimensions: strong,
    weakDimensions: weak,
    riskTolerance: level(rec.riskTolerance, `${what}.riskTolerance`),
  };
};

const parseDraftClass = (raw: unknown, what: string): SeedDraftClass => {
  const rec = asRecord(raw, what);
  requireExactKeys(rec, ['id', 'season', 'eligiblePlayerIds'], [], what);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    season: asSafeInt(rec.season, `${what}.season`, 1900, 3000),
    eligiblePlayerIds: arrayOf(
      rec.eligiblePlayerIds,
      `${what}.eligiblePlayerIds`,
      (r, w) => parseSeedId(r, w),
    ),
  };
};

const parseDraftPick = (raw: unknown, what: string): SeedDraftPick => {
  const rec = asRecord(raw, what);
  requireExactKeys(
    rec,
    [
      'id',
      'season',
      'round',
      'slot',
      'originalOrganizationId',
      'ownerOrganizationId',
      'status',
    ],
    [],
    what,
  );
  if (!(DRAFT_PICK_STATUSES as readonly unknown[]).includes(rec.status))
    throw new ManifestFormatError(`${what}.status is not recognized`);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    season: asSafeInt(rec.season, `${what}.season`, 1900, 3000),
    round: asSafeInt(rec.round, `${what}.round`, 1, 100),
    slot:
      rec.slot === null ? null : asSafeInt(rec.slot, `${what}.slot`, 1, 1000),
    originalOrganizationId: parseSeedId(
      rec.originalOrganizationId,
      `${what}.originalOrganizationId`,
    ),
    ownerOrganizationId: parseSeedId(
      rec.ownerOrganizationId,
      `${what}.ownerOrganizationId`,
    ),
    status: rec.status as DraftPickStatus,
  };
};

/** Structural parse of the untrusted Package C block. Cross references are checked later. */
export const parsePackageCSubstrate = (
  value: unknown,
): PackageCSubstrateSeed => {
  const what = 'seed.packageCSubstrate';
  const rec = asRecord(value, what);
  requireExactKeys(rec, BLOCK_KEYS, [], what);
  return {
    players: arrayOf(rec.players, `${what}.players`, parsePlayer),
    rights: arrayOf(rec.rights, `${what}.rights`, parseRight),
    memberships: arrayOf(
      rec.memberships,
      `${what}.memberships`,
      parseMembership,
    ),
    agentClients: arrayOf(
      rec.agentClients,
      `${what}.agentClients`,
      parseAgentClient,
    ),
    playerPreferences: arrayOf(
      rec.playerPreferences,
      `${what}.playerPreferences`,
      parsePreference,
    ),
    evaluatorProfiles: arrayOf(
      rec.evaluatorProfiles,
      `${what}.evaluatorProfiles`,
      parseEvaluator,
    ),
    draftClasses: arrayOf(
      rec.draftClasses,
      `${what}.draftClasses`,
      parseDraftClass,
    ),
    draftPicks: arrayOf(rec.draftPicks, `${what}.draftPicks`, parseDraftPick),
    waiverPriority: arrayOf(
      rec.waiverPriority,
      `${what}.waiverPriority`,
      (r, w) => parseSeedId(r, w),
    ),
  };
};

// ---------------------------------------------------------------------------
// Cross-reference validation
// ---------------------------------------------------------------------------

const END_OF_TIME = '9999-12-31';

type Interval = {
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
};

const overlaps = (a: Interval, b: Interval): boolean =>
  a.effectiveFrom <= (b.effectiveUntil ?? END_OF_TIME) &&
  b.effectiveFrom <= (a.effectiveUntil ?? END_OF_TIME);

const covers = (outer: Interval, inner: Interval): boolean =>
  outer.effectiveFrom <= inner.effectiveFrom &&
  (outer.effectiveUntil === null ||
    (inner.effectiveUntil !== null &&
      inner.effectiveUntil <= outer.effectiveUntil));

export type PackageCEntityRef = {
  readonly id: string;
  readonly kind: 'person' | 'organization';
};

export type PackageCRoleRef = {
  readonly personId: string;
  readonly role: string;
};

/**
 * Cross-reference and consistency problems in the Package C block. Never throws.
 * `ruleset` is the (already validated) ruleset the seed will be created with, if any.
 */
export const packageCIssues = (
  sub: PackageCSubstrateSeed,
  entities: readonly PackageCEntityRef[],
  roles: readonly PackageCRoleRef[],
  ruleset: LeagueRulesetManifest | undefined,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string): void => {
    issues.push({ code: `SEED_C_${code}`, message });
  };
  const kinds = new Map(entities.map((e) => [e.id, e.kind]));
  const playerIds = new Set(sub.players.map((p) => p.personId));
  const requireKind = (
    ref: string,
    expected: 'person' | 'organization',
    where: string,
  ): boolean => {
    const kind = kinds.get(ref);
    if (kind === undefined) {
      add('UNKNOWN_ENTITY', `${where} references unknown entity "${ref}"`);
      return false;
    }
    if (kind !== expected) {
      add(
        'WRONG_ENTITY_KIND',
        `${where} references "${ref}" as a ${expected}, but it is a ${kind}`,
      );
      return false;
    }
    return true;
  };
  const requirePlayer = (ref: string, where: string): void => {
    if (!playerIds.has(ref))
      add(
        'UNKNOWN_PLAYER',
        `${where} references "${ref}", which is not a seeded player`,
      );
  };

  if (ruleset !== undefined && ruleset.rules.transactions === undefined)
    add(
      'REQUIRES_TRANSACTION_RULES',
      `the seed declares Package C state but ruleset "${ruleset.rulesetId}" has no transaction rules`,
    );
  const tx = ruleset?.rules.transactions;

  const seen = new Set<string>();
  const claim = (id: string, where: string): void => {
    if (seen.has(id)) add('DUPLICATE_ID', `${where} reuses record id "${id}"`);
    seen.add(id);
  };

  const seenPlayers = new Set<string>();
  for (const p of sub.players) {
    const where = `player "${p.personId}"`;
    if (seenPlayers.has(p.personId))
      add('DUPLICATE_ID', `${where} is listed twice`);
    seenPlayers.add(p.personId);
    requireKind(p.personId, 'person', where);
  }

  for (const r of sub.rights) {
    const where = `rights record "${r.id}"`;
    claim(r.id, where);
    requirePlayer(r.playerId, where);
    requireKind(r.holderOrganizationId, 'organization', where);
  }
  for (const m of sub.memberships) {
    const where = `roster membership "${m.id}"`;
    claim(m.id, where);
    requirePlayer(m.playerId, where);
    requireKind(m.organizationId, 'organization', where);
  }

  const byPlayer = <T extends { readonly playerId: string }>(
    xs: readonly T[],
  ): Map<string, T[]> => {
    const map = new Map<string, T[]>();
    for (const x of xs)
      map.set(x.playerId, [...(map.get(x.playerId) ?? []), x]);
    return map;
  };
  const rightsByPlayer = byPlayer(sub.rights);
  for (const [playerId, rights] of rightsByPlayer)
    for (let i = 0; i < rights.length; i += 1)
      for (let j = i + 1; j < rights.length; j += 1)
        if (overlaps(rights[i]!, rights[j]!))
          add(
            'RIGHTS_OVERLAP',
            `player "${playerId}" has overlapping rights "${rights[i]!.id}" and "${rights[j]!.id}" (duplicate ownership)`,
          );
  const membershipsByPlayer = byPlayer(sub.memberships);
  for (const [playerId, ms] of membershipsByPlayer)
    for (let i = 0; i < ms.length; i += 1)
      for (let j = i + 1; j < ms.length; j += 1)
        if (overlaps(ms[i]!, ms[j]!))
          add(
            'MEMBERSHIP_OVERLAP',
            `player "${playerId}" has overlapping roster memberships "${ms[i]!.id}" and "${ms[j]!.id}"`,
          );
  for (const m of sub.memberships) {
    const compatible = (rightsByPlayer.get(m.playerId) ?? []).some(
      (r) => r.holderOrganizationId === m.organizationId && covers(r, m),
    );
    if (!compatible)
      add(
        'MEMBERSHIP_WITHOUT_RIGHT',
        `roster membership "${m.id}" has no right held by "${m.organizationId}" covering it`,
      );
  }

  const scoutIds = new Set(
    roles.filter((r) => r.role === 'scout').map((r) => r.personId),
  );
  const capabilityKeys = new Set(
    sub.players.flatMap((p) => p.capabilities.map((c) => c.key)),
  );
  for (const a of sub.agentClients) {
    const where = `agent-client link "${a.id}"`;
    claim(a.id, where);
    if (
      requireKind(a.agentPersonId, 'person', where) &&
      playerIds.has(a.agentPersonId)
    )
      add(
        'INVALID_AGENT',
        `${where}: agent "${a.agentPersonId}" is itself a player`,
      );
    if (!playerIds.has(a.playerPersonId))
      add(
        'INVALID_AGENT',
        `${where}: client "${a.playerPersonId}" is not a seeded player`,
      );
  }
  const seenPreferences = new Set<string>();
  for (const pref of sub.playerPreferences) {
    const where = `market preference for "${pref.playerPersonId}"`;
    requirePlayer(pref.playerPersonId, where);
    if (seenPreferences.has(pref.playerPersonId))
      add('DUPLICATE_ID', `${where} is listed twice`);
    seenPreferences.add(pref.playerPersonId);
  }
  const seenEvaluators = new Set<string>();
  for (const e of sub.evaluatorProfiles) {
    const where = `evaluator profile "${e.personId}"`;
    if (seenEvaluators.has(e.personId))
      add('DUPLICATE_ID', `${where} is listed twice`);
    seenEvaluators.add(e.personId);
    if (requireKind(e.personId, 'person', where) && !scoutIds.has(e.personId))
      add(
        'EVALUATOR_NOT_SCOUT',
        `${where}: the person holds no scout role episode`,
      );
    for (const d of [...e.strongDimensions, ...e.weakDimensions])
      if (!capabilityKeys.has(d))
        add(
          'UNKNOWN_DIMENSION',
          `${where} references unknown capability dimension "${d}"`,
        );
  }

  const inClass = new Map<string, string>();
  for (const c of sub.draftClasses) {
    const where = `draft class "${c.id}"`;
    claim(c.id, where);
    for (const pid of c.eligiblePlayerIds) {
      requirePlayer(pid, where);
      const prior = inClass.get(pid);
      if (prior !== undefined && prior !== c.id)
        add(
          'PLAYER_IN_MULTIPLE_CLASSES',
          `${where}: "${pid}" is already eligible in "${prior}"`,
        );
      inClass.set(pid, c.id);
    }
    if (new Set(c.eligiblePlayerIds).size !== c.eligiblePlayerIds.length)
      add('DUPLICATE_ID', `${where} lists an eligible player twice`);
  }

  const claimedSlots = new Set<string>();
  const claimedOrigins = new Set<string>();
  for (const p of sub.draftPicks) {
    const where = `draft pick "${p.id}"`;
    claim(p.id, where);
    requireKind(p.originalOrganizationId, 'organization', where);
    requireKind(p.ownerOrganizationId, 'organization', where);
    if (p.status !== 'available')
      add(
        'USED_PICK',
        `${where} is seeded as used, but no selection exists to account for it`,
      );
    const origin = `${p.season}|${p.round}|${p.originalOrganizationId}`;
    if (claimedOrigins.has(origin))
      add(
        'DUPLICATE_PICK',
        `${where} duplicates season ${p.season} round ${p.round} of "${p.originalOrganizationId}"`,
      );
    claimedOrigins.add(origin);
    if (p.slot !== null) {
      const slot = `${p.season}|${p.round}|${p.slot}`;
      if (claimedSlots.has(slot))
        add(
          'DUPLICATE_PICK',
          `${where} reuses season ${p.season} round ${p.round} slot ${p.slot}`,
        );
      claimedSlots.add(slot);
    }
    if (tx !== undefined) {
      if (p.round > tx.draft.rounds)
        add(
          'PICK_OUT_OF_RULES',
          `${where} is round ${p.round}; the ruleset has ${tx.draft.rounds} rounds`,
        );
      if (!tx.seasonRules.some((s) => s.season === p.season))
        add(
          'PICK_OUT_OF_RULES',
          `${where} is for season ${p.season}, which the ruleset does not declare`,
        );
    }
  }

  const orgIds = entities
    .filter((e) => e.kind === 'organization')
    .map((e) => e.id);
  const priority = sub.waiverPriority;
  if (
    priority.length !== orgIds.length ||
    new Set(priority).size !== priority.length ||
    priority.some((o) => kinds.get(o) !== 'organization') ||
    orgIds.some((o) => !priority.includes(o))
  )
    add(
      'WAIVER_PRIORITY_INVALID',
      'waiverPriority must list every organization exactly once and nothing else',
    );
  return issues;
};
