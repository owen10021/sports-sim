import {
  ManifestFormatError,
  asRecord,
  requireExactKeys,
  type ValidationIssue,
} from './provenance';
import { parseSeedDate, parseSeedId } from './seedParsing';
import type { LeagueRulesetManifest } from './ruleset';

/**
 * Optional Package E seed block: the minimal synthetic FIXTURE SCHEDULE only. It does not
 * seed resolved games, latent calls, outcomes, plans, designations or any player truth;
 * every one of those is produced by commands. Plain-string ids here; the world builds
 * branded records from them. Absent in Package A-D seeds, whose content hashes therefore
 * never change.
 */
export type SeedFootballFixture = {
  readonly id: string;
  readonly fixtureDate: string;
  readonly homeOrganizationId: string;
  readonly awayOrganizationId: string;
  readonly rulesProfileKey: string;
};

export type PackageESubstrateSeed = {
  readonly fixtures: readonly SeedFootballFixture[];
};

const FIXTURE_KEYS = [
  'id',
  'fixtureDate',
  'homeOrganizationId',
  'awayOrganizationId',
  'rulesProfileKey',
] as const;

const parseFixture = (raw: unknown, what: string): SeedFootballFixture => {
  const rec = asRecord(raw, what);
  requireExactKeys(rec, FIXTURE_KEYS, [], what);
  return {
    id: parseSeedId(rec.id, `${what}.id`),
    fixtureDate: parseSeedDate(rec.fixtureDate, `${what}.fixtureDate`),
    homeOrganizationId: parseSeedId(
      rec.homeOrganizationId,
      `${what}.homeOrganizationId`,
    ),
    awayOrganizationId: parseSeedId(
      rec.awayOrganizationId,
      `${what}.awayOrganizationId`,
    ),
    rulesProfileKey: parseSeedId(
      rec.rulesProfileKey,
      `${what}.rulesProfileKey`,
    ),
  };
};

/** Structural parse of the untrusted Package E block. Cross references are checked later. */
export const parsePackageESubstrate = (
  value: unknown,
): PackageESubstrateSeed => {
  const what = 'seed.packageESubstrate';
  const rec = asRecord(value, what);
  requireExactKeys(rec, ['fixtures'], [], what);
  if (!Array.isArray(rec.fixtures))
    throw new ManifestFormatError(`${what}.fixtures must be an array`);
  return {
    fixtures: rec.fixtures.map((raw, i) =>
      parseFixture(raw, `${what}.fixtures[${i}]`),
    ),
  };
};

// ---------------------------------------------------------------------------
// Cross-reference validation
// ---------------------------------------------------------------------------

export type PackageEEntityRef = {
  readonly id: string;
  readonly kind: 'person' | 'organization';
};

/** The Package C player capability keys the football action bindings resolve against. */
export type PackageEPlayerRef = {
  readonly personId: string;
  readonly capabilityKeys: readonly string[];
};

/** The Package D role-knowledge vocabulary the football rules must be able to resolve. */
export type PackageERoleKnowledgeRef = {
  readonly playerId: string;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
};

const MINTED_RECORD_ID = /^rec-\d+$/;

/**
 * Cross-reference and consistency problems in the Package E block. Never throws.
 * `ruleset` is the (already validated) ruleset the seed will be created with, if any.
 */
export const packageEIssues = (
  sub: PackageESubstrateSeed,
  startDate: string,
  entities: readonly PackageEEntityRef[],
  players: readonly PackageEPlayerRef[],
  roleKnowledge: readonly PackageERoleKnowledgeRef[],
  ruleset: LeagueRulesetManifest | undefined,
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string): void => {
    issues.push({ code: `SEED_E_${code}`, message });
  };
  const kinds = new Map(entities.map((e) => [e.id, e.kind]));
  const football = ruleset?.rules.football;

  if (ruleset !== undefined && football === undefined)
    add(
      'MISSING_FOOTBALL_RULES',
      `the seed carries a Package E block but ruleset "${ruleset.rulesetId}" declares no football rules`,
    );

  const fixtureIds = new Set<string>();
  for (const f of sub.fixtures) {
    const where = `fixture "${f.id}"`;
    if (fixtureIds.has(f.id))
      add('DUPLICATE_FIXTURE', `${where} is duplicated`);
    fixtureIds.add(f.id);
    if (MINTED_RECORD_ID.test(f.id))
      add(
        'RESERVED_RECORD_ID',
        `${where} uses the id shape reserved for minted records`,
      );
    for (const [side, ref] of [
      ['home', f.homeOrganizationId],
      ['away', f.awayOrganizationId],
    ] as const) {
      const kind = kinds.get(ref);
      if (kind === undefined)
        add(
          'UNKNOWN_ENTITY',
          `${where} ${side} organization "${ref}" is unknown`,
        );
      else if (kind !== 'organization')
        add(
          'WRONG_ENTITY_KIND',
          `${where} ${side} organization "${ref}" is a ${kind}`,
        );
    }
    if (f.homeOrganizationId === f.awayOrganizationId)
      add(
        'SAME_ORGANIZATION',
        `${where} has the same organization as home and away`,
      );
    if (f.fixtureDate < startDate)
      add(
        'FIXTURE_BEFORE_START',
        `${where} is dated ${f.fixtureDate}, before the world starts on ${startDate}`,
      );
    if (football !== undefined && f.rulesProfileKey !== football.profileKey)
      add(
        'UNKNOWN_RULES_PROFILE',
        `${where} names rules profile "${f.rulesProfileKey}", but the ruleset provides "${football.profileKey}"`,
      );
  }

  if (football !== undefined) {
    const ecology = new Set(players.flatMap((p) => p.capabilityKeys));
    for (const action of football.actions)
      for (const b of action.capabilityBindings)
        if (!ecology.has(b.capabilityKey))
          add(
            'ACTION_UNKNOWN_CAPABILITY',
            `football action "${action.actionKey}" binds capability "${b.capabilityKey}", which no seeded player has`,
          );
    const schemes = new Set(football.schemes.map((s) => s.schemeKey));
    const families = new Map(
      football.responsibilities.map((r) => [
        r.responsibilityKey,
        r.transferFamilyKey,
      ]),
    );
    for (const k of roleKnowledge) {
      const where = `role knowledge "${k.playerId}/${k.schemeKey}/${k.responsibilityKey}"`;
      if (!schemes.has(k.schemeKey))
        add(
          'ROLE_UNKNOWN_SCHEME',
          `${where} uses a scheme the football rules do not define`,
        );
      const family = families.get(k.responsibilityKey);
      if (family === undefined)
        add(
          'ROLE_UNKNOWN_RESPONSIBILITY',
          `${where} uses a responsibility the football rules do not define`,
        );
      else if (family !== k.transferFamilyKey)
        add(
          'ROLE_TRANSFER_FAMILY_MISMATCH',
          `${where} has transfer family "${k.transferFamilyKey}", but the football rules say "${family}"`,
        );
    }
  }
  return issues;
};
