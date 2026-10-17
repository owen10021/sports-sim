import type { EntityId, RecordId } from './ids';

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
