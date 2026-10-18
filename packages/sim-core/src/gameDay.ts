import type { CanonicalValue } from './audit';
import { canonicalString } from './canonical';
import { isPlainObject } from './commandSupport';
import {
  FOOTBALL_SIDES,
  type FootballRulesV1,
  type FootballSide,
} from './footballRules';
import type { FootballFixture } from './football';
import { isValidId } from './ids';
import { medicalWorkloadCap } from './medical';
import { activeRightsFor, currentRosterMembership } from './roster';
import type { FootballWorld } from './world';

/** Terms type of a `game_day_activation` proposal and of its domain commit. */
export const GAME_DAY_ACTIVATION_TERMS_TYPE = 'game_day_activation_v1';

const TERMS_KEYS = 'designations,fixtureId,organizationId';
const DESIGNATION_KEYS = 'depthOrder,playerId,roleKey,status,unitKey';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Order-insensitive designation terms are put in one canonical order before approval and
 * hashing: by player, then unit, then role, then depth. Malformed terms are returned as they
 * are, because the strict parse at commit time is what rejects them.
 */
export const canonicalGameDayTerms = (terms: {
  readonly [key: string]: CanonicalValue;
}): { readonly [key: string]: CanonicalValue } => {
  if (!Array.isArray(terms.designations)) return terms;
  return {
    ...terms,
    designations: [...terms.designations].sort((a, b) =>
      byText(canonicalString(a), canonicalString(b)),
    ),
  };
};

export interface ParsedDesignation {
  readonly playerId: string;
  readonly status: 'active' | 'inactive';
  readonly unitKey: string | null;
  readonly roleKey: string | null;
  readonly depthOrder: number | null;
}

export interface ParsedGameDayTerms {
  readonly fixtureId: string;
  readonly organizationId: string;
  readonly designations: readonly ParsedDesignation[];
}

/** Exact-key parse of the executed terms; anything extra, missing or mistyped is rejected. */
export const parseGameDayTerms = (
  terms: unknown,
): ParsedGameDayTerms | string => {
  if (!isPlainObject(terms)) return 'terms must be an object';
  if (Object.keys(terms).sort().join(',') !== TERMS_KEYS)
    return `terms must have exactly the keys ${TERMS_KEYS}`;
  if (!isValidId(terms.fixtureId)) return 'fixtureId must be a valid id';
  if (!isValidId(terms.organizationId))
    return 'organizationId must be a valid id';
  if (!Array.isArray(terms.designations) || terms.designations.length === 0)
    return 'designations must be a non-empty array';
  const designations: ParsedDesignation[] = [];
  for (const d of terms.designations) {
    if (
      !isPlainObject(d) ||
      Object.keys(d).sort().join(',') !== DESIGNATION_KEYS
    )
      return `each designation must have exactly the keys ${DESIGNATION_KEYS}`;
    if (!isValidId(d.playerId))
      return 'designation playerId must be a valid id';
    if (d.status === 'active') {
      if (
        typeof d.unitKey !== 'string' ||
        typeof d.roleKey !== 'string' ||
        typeof d.depthOrder !== 'number' ||
        !Number.isSafeInteger(d.depthOrder) ||
        d.depthOrder < 1
      )
        return 'an active designation needs a unitKey, a roleKey and a positive integer depthOrder';
    } else if (d.status === 'inactive') {
      if (d.unitKey !== null || d.roleKey !== null || d.depthOrder !== null)
        return 'an inactive designation must have a null unitKey, roleKey and depthOrder';
    } else return 'designation status must be active or inactive';
    designations.push({
      playerId: d.playerId,
      status: d.status,
      unitKey: d.unitKey as string | null,
      roleKey: d.roleKey as string | null,
      depthOrder: d.depthOrder as number | null,
    });
  }
  return {
    fixtureId: terms.fixtureId,
    organizationId: terms.organizationId,
    designations,
  };
};

/** The roles any formation of this side can field, from the ruleset only. */
export const eligibleRolesForUnit = (
  rules: FootballRulesV1,
  unitKey: string,
): ReadonlySet<string> => {
  const roles = new Set<string>();
  for (const f of rules.formations)
    if (f.side === unitKey)
      for (const slot of f.slots)
        for (const r of slot.eligibleRoles) roles.add(r);
  return roles;
};

/**
 * Every reason these designations cannot be committed for this club and fixture today.
 * Pure and RNG-free. Reads Package C roster truth and the Package D medical cap but never
 * changes either.
 */
export const gameDayProblems = (
  world: Pick<FootballWorld, 'roster' | 'medical' | 'football' | 'simDate'>,
  rules: FootballRulesV1,
  fixture: FootballFixture,
  organizationId: string,
  designations: readonly ParsedDesignation[],
): readonly string[] => {
  const problems: string[] = [];
  if (fixture.status !== 'scheduled')
    problems.push(`fixture ${fixture.id} is already final`);
  else if (world.simDate > fixture.fixtureDate)
    problems.push(`fixture ${fixture.id} is past its date`);
  if (
    fixture.homeOrganizationId !== organizationId &&
    fixture.awayOrganizationId !== organizationId
  )
    problems.push(`${organizationId} does not play in fixture ${fixture.id}`);

  const existing = world.football.designations.filter(
    (d) => d.fixtureId === fixture.id && d.organizationId === organizationId,
  );
  const seenPlayers = new Set<string>();
  const slots = new Set<string>();
  for (const d of existing)
    if (d.unitKey !== null && d.roleKey !== null && d.depthOrder !== null)
      slots.add(`${d.unitKey}/${d.roleKey}/${d.depthOrder}`);
  const unitSeen = new Set<string>(
    existing
      .filter((d) => d.status === 'active')
      .map((d) => `${d.playerId}/${d.unitKey}`),
  );
  const activePlayers = new Set<string>(
    existing.filter((d) => d.status === 'active').map((d) => d.playerId),
  );
  const inactivePlayers = new Set<string>(
    existing.filter((d) => d.status === 'inactive').map((d) => d.playerId),
  );

  for (const d of designations) {
    const who = d.playerId;
    const membership = currentRosterMembership(
      world.roster,
      d.playerId as never,
      world.simDate,
    );
    if (
      membership === undefined ||
      membership.organizationId !== organizationId ||
      !activeRightsFor(world.roster, d.playerId as never, world.simDate).some(
        (r) => r.holderOrganizationId === organizationId,
      )
    ) {
      problems.push(`${who} is not rostered with ${organizationId}`);
      continue;
    }
    if (d.status === 'active') {
      if (membership.status !== 'active')
        problems.push(
          `${who} is ${membership.status}, not on the active roster`,
        );
      if (inactivePlayers.has(who))
        problems.push(`${who} is already designated inactive for this game`);
      const cap = medicalWorkloadCap(
        world,
        organizationId as never,
        d.playerId as never,
      );
      if (cap === 0)
        problems.push(
          `${who} has a hard medical cap of 0 and cannot be active`,
        );
      if (!(FOOTBALL_SIDES as readonly string[]).includes(d.unitKey!)) {
        problems.push(`unit ${d.unitKey} is not a football unit`);
        continue;
      }
      if (
        !eligibleRolesForUnit(rules, d.unitKey as FootballSide).has(d.roleKey!)
      )
        problems.push(`role ${d.roleKey} is not fielded by unit ${d.unitKey}`);
      const slot = `${d.unitKey}/${d.roleKey}/${d.depthOrder}`;
      if (slots.has(slot))
        problems.push(`depth ${slot} is designated more than once`);
      slots.add(slot);
      const unit = `${who}/${d.unitKey}`;
      if (unitSeen.has(unit))
        problems.push(`${who} is designated twice in unit ${d.unitKey}`);
      unitSeen.add(unit);
      activePlayers.add(who);
    } else {
      if (activePlayers.has(who))
        problems.push(`${who} is already designated active for this game`);
      if (seenPlayers.has(who) || inactivePlayers.has(who))
        problems.push(`${who} is designated inactive more than once`);
      inactivePlayers.add(who);
    }
    seenPlayers.add(who);
  }
  if (activePlayers.size > rules.substitution.maxActiveGameDayPlayers)
    problems.push(
      `${activePlayers.size} active players exceed the game-day limit of ${rules.substitution.maxActiveGameDayPlayers}`,
    );
  return problems;
};
