import type { CanonicalValue } from './audit';
import { canonicalString } from './canonical';
import { entityId, recordId, type EntityId, type RecordId } from './ids';
import { holdsRoleAt } from './people';
import type { SeedAuthorityGrant } from './seed';
import type { FootballWorld } from './world';

/** Explicit decision rights. One right never implies another. */
export const DECISION_RIGHTS = [
  'propose',
  'advise',
  'approve',
  'veto',
  'execute',
  'communicate',
] as const;
export type DecisionRight = (typeof DECISION_RIGHTS)[number];

/**
 * Package B exercises the first three. The rest are reserved for later packages and have
 * no transaction implementation in Package B.
 */
export const DECISION_CATEGORIES = [
  'organizational_authority',
  'staff_role',
  'organizational_plan',
  'acquisition',
  'contract',
  'roster',
  'game_day_activation',
  'medical_clearance',
  'workload_usage',
  'major_trade',
  'staff_hiring',
  'scheme',
] as const;
export type DecisionCategory = (typeof DECISION_CATEGORIES)[number];

/** Rights held by a person in an organization for one category over an interval. */
export interface AuthorityGrant {
  readonly id: RecordId;
  readonly personId: EntityId;
  readonly organizationId: EntityId;
  readonly category: DecisionCategory;
  readonly rights: readonly DecisionRight[];
  readonly transferable: boolean;
  readonly effectiveFrom: string;
  /** Inclusive end date, or null while open-ended. */
  readonly effectiveUntil: string | null;
  readonly sourcePersonId: EntityId | null;
  readonly revision: number;
}

/** A narrowing delegation. It can never manufacture authority. */
export interface Mandate {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly delegatorPersonId: EntityId;
  readonly delegatePersonId: EntityId;
  readonly category: DecisionCategory;
  readonly scope: CanonicalValue;
  readonly hardConstraints: CanonicalValue;
  readonly preferences: CanonicalValue;
  readonly allowedRights: readonly DecisionRight[];
  readonly fallback: CanonicalValue;
  readonly escalationRules: CanonicalValue;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly revision: number;
  readonly active: boolean;
}

export interface ProtectedConstraint {
  readonly id: RecordId;
  readonly organizationId: EntityId;
  readonly subject: CanonicalValue;
  readonly prohibitedChange: CanonicalValue;
  readonly originRecordId: RecordId | null;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string | null;
  readonly amendableByPersonIds: readonly EntityId[];
  readonly revision: number;
  readonly active: boolean;
}

export interface AuthorityState {
  readonly grants: readonly AuthorityGrant[];
  readonly mandates: readonly Mandate[];
  readonly protectedConstraints: readonly ProtectedConstraint[];
}

export const emptyAuthorityState = (): AuthorityState => ({
  grants: [],
  mandates: [],
  protectedConstraints: [],
});

/**
 * Initial authority: seeded grants in stable id order, rights in canonical enum order.
 * Package B seeds no mandates or protected constraints.
 */
export const seededAuthorityState = (
  grants: readonly SeedAuthorityGrant[],
): AuthorityState => ({
  grants: grants
    .map((g): AuthorityGrant => ({
      id: recordId(g.id),
      personId: entityId(g.personId),
      organizationId: entityId(g.organizationId),
      category: g.category,
      rights: [...g.rights].sort(
        (a, b) => DECISION_RIGHTS.indexOf(a) - DECISION_RIGHTS.indexOf(b),
      ),
      transferable: g.transferable,
      effectiveFrom: g.effectiveFrom,
      effectiveUntil: g.effectiveUntil,
      sourcePersonId:
        g.sourcePersonId === null ? null : entityId(g.sourcePersonId),
      revision: g.revision,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  mandates: [],
  protectedConstraints: [],
});

// ---------------------------------------------------------------------------
// Pure authority derivation. Logical SimDate strings only; never a wall clock.
// ---------------------------------------------------------------------------

const withinInterval = (
  from: string,
  until: string | null,
  date: string,
): boolean => from <= date && (until === null || date <= until);

const inRightsOrder = (set: ReadonlySet<DecisionRight>): DecisionRight[] =>
  DECISION_RIGHTS.filter((r) => set.has(r));

export interface RightsView {
  readonly rights: readonly DecisionRight[];
  /** Subset of `rights` that arrived through transferable grants (never through mandates). */
  readonly transferableRights: readonly DecisionRight[];
}

const NO_RIGHTS: RightsView = { rights: [], transferableRights: [] };

/**
 * Rights a person holds from grants alone. Role-bound: with no active role in the
 * organization on `date`, every grant is dormant. Rights are independent; none implies another.
 */
export const activeRightsAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  organizationId: EntityId,
  personId: EntityId,
  category: DecisionCategory,
  date: string,
): RightsView => {
  if (!holdsRoleAt(world.people, organizationId, personId, date))
    return NO_RIGHTS;
  const all = new Set<DecisionRight>();
  const transferable = new Set<DecisionRight>();
  for (const g of world.authority.grants) {
    if (
      g.personId !== personId ||
      g.organizationId !== organizationId ||
      g.category !== category ||
      !withinInterval(g.effectiveFrom, g.effectiveUntil, date)
    )
      continue;
    for (const r of g.rights) {
      all.add(r);
      if (g.transferable) transferable.add(r);
    }
  }
  return {
    rights: inRightsOrder(all),
    transferableRights: inRightsOrder(transferable),
  };
};

export interface MandateUsage {
  readonly unit: string;
  readonly amount: number;
  readonly scopeKey: string;
}

export type MandateVerdict =
  | { readonly ok: true; readonly rights: readonly DecisionRight[] }
  | {
      readonly ok: false;
      readonly outcome: 'invalid' | 'escalate' | 'reject';
      readonly reasons: readonly string[];
    };

const asRecord = (
  v: CanonicalValue,
): { readonly [key: string]: CanonicalValue } | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as { readonly [key: string]: CanonicalValue })
    : null;

const invalid = (...reasons: string[]): MandateVerdict => ({
  ok: false,
  outcome: 'invalid',
  reasons,
});

/**
 * Whether a mandate can be used on `date`, and with which rights. A mandate only narrows:
 * its rights are `allowedRights` ∩ what the delegator can still transfer from grants.
 * With `usage`, scope and hard limits are enforced exactly.
 */
export const validateMandateAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  mandateId: string,
  date: string,
  usage?: MandateUsage,
): MandateVerdict => {
  const m = world.authority.mandates.find((x) => x.id === mandateId);
  if (m === undefined) return invalid(`mandate ${mandateId} does not exist`);
  if (!m.active) return invalid('mandate is revoked');
  if (!withinInterval(m.effectiveFrom, m.effectiveUntil, date))
    return invalid('mandate is outside its effective interval');
  if (!holdsRoleAt(world.people, m.organizationId, m.delegatorPersonId, date))
    return invalid('delegator no longer holds a role');
  if (!holdsRoleAt(world.people, m.organizationId, m.delegatePersonId, date))
    return invalid('delegate does not hold a role');
  const transferable = new Set(
    activeRightsAt(
      world,
      m.organizationId,
      m.delegatorPersonId,
      m.category,
      date,
    ).transferableRights,
  );
  const rights = m.allowedRights.filter((r) => transferable.has(r));
  if (rights.length === 0)
    return invalid('delegator no longer holds the transferable rights');
  if (usage !== undefined) {
    const scope = asRecord(m.scope);
    const keys = scope === null ? null : scope.scopeKeys;
    if (!Array.isArray(keys) || !keys.includes(usage.scopeKey))
      return {
        ok: false,
        outcome: 'reject',
        reasons: [`scope ${usage.scopeKey} is outside the mandate`],
      };
    const hard = asRecord(m.hardConstraints);
    if (hard !== null && typeof hard.maxAmount === 'number') {
      if (hard.unit !== usage.unit)
        return {
          ok: false,
          outcome: 'reject',
          reasons: [`unit ${usage.unit} does not match ${String(hard.unit)}`],
        };
      if (!Number.isSafeInteger(usage.amount) || usage.amount < 0)
        return {
          ok: false,
          outcome: 'reject',
          reasons: ['amount must be a non-negative integer'],
        };
      if (usage.amount > hard.maxAmount) {
        const rules = asRecord(m.escalationRules);
        const escalate =
          rules !== null && rules.onExceedsHardConstraint === 'escalate';
        return {
          ok: false,
          outcome: escalate ? 'escalate' : 'reject',
          reasons: [`amount ${usage.amount} exceeds ${hard.maxAmount}`],
        };
      }
    }
  }
  return { ok: true, rights };
};

/** Rights a person holds only because valid mandates delegate them. */
export const delegatedRightsAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  organizationId: EntityId,
  personId: EntityId,
  category: DecisionCategory,
  date: string,
): { readonly rights: readonly DecisionRight[] } => {
  const all = new Set<DecisionRight>();
  for (const m of world.authority.mandates) {
    if (
      m.organizationId !== organizationId ||
      m.delegatePersonId !== personId ||
      m.category !== category
    )
      continue;
    const v = validateMandateAt(world, m.id, date);
    if (v.ok) for (const r of v.rights) all.add(r);
  }
  return { rights: inRightsOrder(all) };
};

/** Grant rights plus mandate rights. Only grant rights can ever be transferred onward. */
export const effectiveRightsAt = (
  world: Pick<FootballWorld, 'people' | 'authority'>,
  organizationId: EntityId,
  personId: EntityId,
  category: DecisionCategory,
  date: string,
): RightsView => {
  const own = activeRightsAt(world, organizationId, personId, category, date);
  const delegated = delegatedRightsAt(
    world,
    organizationId,
    personId,
    category,
    date,
  );
  return {
    rights: inRightsOrder(new Set([...own.rights, ...delegated.rights])),
    transferableRights: own.transferableRights,
  };
};

/** Active protected constraints that forbid exactly this change to this subject on `date`. */
export const isProtectedAt = (
  world: Pick<FootballWorld, 'authority'>,
  organizationId: EntityId,
  subject: CanonicalValue,
  change: CanonicalValue,
  date: string,
): readonly ProtectedConstraint[] => {
  const s = canonicalString(subject);
  const c = canonicalString(change);
  return world.authority.protectedConstraints.filter(
    (p) =>
      p.active &&
      p.organizationId === organizationId &&
      withinInterval(p.effectiveFrom, p.effectiveUntil, date) &&
      canonicalString(p.subject) === s &&
      canonicalString(p.prohibitedChange) === c,
  );
};
