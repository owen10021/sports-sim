import type {
  OpportunityAllocation,
  RoleKnowledgeRecord,
  TeachingProfile,
} from './development';
import type { DevelopmentRulesV1 } from './developmentRules';
import type { EntityId, RecordId } from './ids';
import { holdsRoleAt } from './people';
import type { FootballWorld } from './world';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Contextual teaching legality; no player capability or responsiveness is consulted. */
export const teachingProblems = (
  world: Pick<FootballWorld, 'roster' | 'people' | 'development'>,
  allocations: readonly OpportunityAllocation[],
): readonly string[] => {
  const problems = new Set<string>();
  const spent = new Map<string, number>();
  for (const a of allocations) {
    const player = world.roster.players.find((p) => p.personId === a.playerId);
    if (
      player !== undefined &&
      player.primaryRole !== a.scopeKey &&
      !player.roleTags.includes(a.scopeKey)
    )
      problems.add('ALLOCATION_ROLE_MISMATCH');
    if (a.teacherPersonId === null) continue;
    const teacher = world.development.teachingProfiles.find(
      (t) => t.personId === a.teacherPersonId,
    );
    if (teacher === undefined) {
      problems.add('MISSING_TEACHING_PROFILE');
      continue;
    }
    if (
      !holdsRoleAt(
        world.people,
        a.organizationId,
        teacher.personId,
        a.committedAt,
      )
    )
      problems.add('TEACHER_NOT_IN_ORGANIZATION');
    for (const key of a.responsibilityKeys)
      if (!teacher.expertise.some((e) => e.responsibilityKey === key))
        problems.add('TEACHER_LACKS_RESPONSIBILITY_EXPERTISE');
    // Separate windows have separate budgets; within a window all resources/players share it.
    const key = a.windowId + '|' + teacher.personId;
    const total = (spent.get(key) ?? 0) + a.units;
    spent.set(key, total);
    if (!Number.isSafeInteger(total) || total > teacher.bandwidthUnits)
      problems.add('TEACHING_BANDWIDTH_EXCEEDED');
  }
  return [...problems].sort(byText);
};

/**
 * Read-only synthetic transfer projection for ONE person's existing knowledge.
 * Exact knowledge is retained. Analogous family credit uses the strongest source only,
 * discounted by half for new terminology; it never stacks or installs knowledge.
 */
export const projectTransferFamiliarity = (
  existingKnowledge: readonly RoleKnowledgeRecord[],
  targetSchemeKey: string,
  targetResponsibilityKey: string,
  transferFamilyKey: string,
): number => {
  if (new Set(existingKnowledge.map((k) => k.playerId)).size > 1)
    throw new Error('Transfer projection requires one person');
  let exact = 0,
    transferable = 0;
  for (const k of existingKnowledge) {
    if (k.transferFamilyKey !== transferFamilyKey) continue;
    if (
      k.schemeKey === targetSchemeKey &&
      k.responsibilityKey === targetResponsibilityKey
    )
      exact = Math.max(exact, k.familiarityBp);
    else transferable = Math.max(transferable, Math.floor(k.familiarityBp / 2));
  }
  return Math.max(exact, transferable);
};

/** Ephemeral checkpoint output, never a second authoritative knowledge ledger. */
export interface RoleKnowledgeDelta {
  readonly playerId: EntityId;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
  readonly beforeBp: number;
  readonly afterBp: number;
  readonly lastMeaningfulRepAt: string | null;
  readonly causalRecordIds: readonly RecordId[];
}
export interface RoleLearningInput {
  readonly playerId: EntityId;
  readonly schemeKey: string;
  readonly responsibilityKey: string;
  readonly transferFamilyKey: string;
  readonly knowledge: readonly RoleKnowledgeRecord[];
  readonly allocations: readonly OpportunityAllocation[];
  readonly teachingProfiles: readonly TeachingProfile[];
  readonly processingBp: number;
  readonly adaptabilityBp: number;
  readonly rules: DevelopmentRulesV1;
  readonly occurredAt: string;
}
const mulBp = (value: number, factor: number): number =>
  Math.floor((value * factor) / 10000);

/**
 * Only installed/development work can teach named responsibilities. Shared lesson units
 * are divided across those responsibilities; teaching quality is a weighted average,
 * not a sum of coach bonuses. Learning saturates toward actual responsibility mastery.
 */
export const resolveRoleLearning = (
  input: RoleLearningInput,
): RoleKnowledgeDelta => {
  const existing = input.knowledge.find(
    (k) =>
      k.playerId === input.playerId &&
      k.schemeKey === input.schemeKey &&
      k.responsibilityKey === input.responsibilityKey,
  );
  const beforeBp = existing?.familiarityBp ?? 0;
  const allocations = input.allocations
    .filter(
      (a) =>
        a.playerId === input.playerId &&
        (a.resourceKey === 'development_reps' ||
          a.resourceKey === 'installation_work') &&
        a.responsibilityKeys.includes(input.responsibilityKey),
    )
    .sort((a, b) => byText(a.id, b.id));
  let weightedTeaching = 0,
    units = 0;
  const causes: RecordId[] = [];
  for (const a of allocations) {
    const teacher = input.teachingProfiles.find(
      (t) => t.personId === a.teacherPersonId,
    );
    const skill =
      teacher?.expertise.find(
        (e) => e.responsibilityKey === input.responsibilityKey,
      )?.teachingBp ?? 0;
    const share = Math.floor(
      a.units / Math.max(1, a.responsibilityKeys.length),
    );
    if (share <= 0 || skill <= 0) continue;
    units += share;
    weightedTeaching += share * skill;
    causes.push(a.id);
  }
  const meaningfulUnits = Math.min(
    input.rules.maxPlayerLoadUnitsPerCheckpoint,
    units,
  );
  const unitBp = Math.floor(
    (meaningfulUnits * 10000) / input.rules.maxPlayerLoadUnitsPerCheckpoint,
  );
  const teachingBp = units > 0 ? Math.floor(weightedTeaching / units) : 0;
  let gain = mulBp(10000 - beforeBp, input.rules.roleLearningScaleBp);
  gain = mulBp(gain, unitBp);
  gain = mulBp(gain, teachingBp);
  gain = mulBp(gain, input.processingBp);
  gain = mulBp(gain, input.adaptabilityBp);
  return {
    playerId: input.playerId,
    schemeKey: input.schemeKey,
    responsibilityKey: input.responsibilityKey,
    transferFamilyKey: input.transferFamilyKey,
    beforeBp,
    afterBp: Math.min(10000, beforeBp + gain),
    lastMeaningfulRepAt:
      meaningfulUnits > 0
        ? input.occurredAt
        : (existing?.lastMeaningfulRepAt ?? null),
    causalRecordIds: causes,
  };
};
