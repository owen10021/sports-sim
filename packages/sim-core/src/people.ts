import { entityId, recordId, type EntityId, type RecordId } from './ids';
import type { SeedRoleEpisode } from './seed';
import type { Entity } from './world';

export const PERSON_ROLES = [
  'owner',
  'general_manager',
  'head_coach',
  'offensive_coordinator',
  'defensive_coordinator',
  'scout',
  'personnel_executive',
  'cap_executive',
  'medical_lead',
  'agent',
  'player',
  'other',
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** A persistent person. Identity and name live in the generic entity registry. */
export interface PersonRecord {
  readonly entityId: EntityId;
  readonly active: boolean;
}

/** One interval during which a person holds a role in an organization. */
export interface RoleEpisode {
  readonly id: RecordId;
  readonly personId: EntityId;
  readonly organizationId: EntityId;
  readonly role: PersonRole;
  readonly title: string;
  /** Inclusive simulation date `YYYY-MM-DD`. */
  readonly startDate: string;
  /** Inclusive end date, or null while the role is still held. */
  readonly endDate: string | null;
}

export interface PeopleState {
  readonly persons: readonly PersonRecord[];
  readonly roleEpisodes: readonly RoleEpisode[];
}

export const emptyPeopleState = (): PeopleState => ({
  persons: [],
  roleEpisodes: [],
});

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Initial people: one record per `person` entity, plus the seeded role episodes, both in
 * canonical (stable id) order. Names stay in the entity registry, never duplicated here.
 */
export const seededPeopleState = (
  entities: readonly Entity[],
  episodes: readonly SeedRoleEpisode[],
): PeopleState => ({
  persons: entities
    .filter((e) => e.kind === 'person')
    .map((e) => ({ entityId: e.id, active: true }))
    .sort((a, b) => byText(a.entityId, b.entityId)),
  roleEpisodes: episodes
    .map((r): RoleEpisode => ({
      id: recordId(r.id),
      personId: entityId(r.personId),
      organizationId: entityId(r.organizationId),
      role: r.role,
      title: r.title,
      startDate: r.startDate,
      endDate: r.endDate,
    }))
    .sort((a, b) => byText(a.id, b.id)),
});

/** True when the person holds any role episode in the organization on `date` (inclusive). */
export const holdsRoleAt = (
  people: PeopleState,
  organizationId: EntityId,
  personId: EntityId,
  date: string,
): boolean =>
  people.roleEpisodes.some(
    (e) =>
      e.personId === personId &&
      e.organizationId === organizationId &&
      e.startDate <= date &&
      (e.endDate === null || date <= e.endDate),
  );
