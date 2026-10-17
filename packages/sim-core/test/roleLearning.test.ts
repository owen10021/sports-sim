import { describe, expect, it } from 'vitest';
import {
  resolveRoleLearning,
  projectTransferFamiliarity,
  entityId,
  recordId,
  requireDevelopmentRules,
  SYNTHETIC_PACKAGE_D_RULESET,
  type OpportunityAllocation,
  type RoleKnowledgeRecord,
  type TeachingProfile,
} from '../src/index';
import { COACH, NF, D_TODAY } from './support/packageDHarness';

const playerId = entityId('player-nf-01');
const rules = requireDevelopmentRules(SYNTHETIC_PACKAGE_D_RULESET);
const known = (
  responsibilityKey = 'run_reads',
  familiarityBp = 8000,
): RoleKnowledgeRecord => ({
  playerId,
  schemeKey: 'base_offense',
  responsibilityKey,
  transferFamilyKey: 'ball_carrier',
  familiarityBp,
  lastMeaningfulRepAt: null,
});
const lesson = (units = 40): OpportunityAllocation => ({
  id: recordId('lesson-a'),
  playerId,
  organizationId: NF.org,
  windowId: recordId('window-a'),
  resourceKey: 'development_reps',
  scopeKey: 'running_back',
  units,
  teacherPersonId: COACH,
  responsibilityKeys: ['run_reads'],
  basisPlanIds: [],
  sourceProposalId: recordId('proposal-a'),
  committedAt: D_TODAY,
});
const teacher = (personId = COACH): TeachingProfile => ({
  personId,
  bandwidthUnits: 80,
  expertise: [{ responsibilityKey: 'run_reads', teachingBp: 10000 }],
});
const input = () => ({
  playerId,
  schemeKey: 'base_offense',
  responsibilityKey: 'run_reads',
  transferFamilyKey: 'ball_carrier',
  knowledge: [known(), known('pass_block', 1000)],
  allocations: [lesson()],
  teachingProfiles: [teacher()],
  processingBp: 10000,
  adaptabilityBp: 10000,
  rules,
  occurredAt: '2027-03-01',
});

describe('responsibility-specific role learning', () => {
  it('improves the taught responsibility without awarding aggregate scheme or capability points', () => {
    const i = input(),
      before = JSON.stringify(i);
    const learned = resolveRoleLearning(i);
    // 2000 missing * 2500bp scale * 40/100 load = 200 familiarization.
    expect(learned.beforeBp).toBe(8000);
    expect(learned.afterBp).toBe(8200);
    expect(learned.responsibilityKey).toBe('run_reads');
    expect(learned.causalRecordIds).toEqual(['lesson-a']);
    expect(JSON.stringify(i)).toBe(before);
    const other = resolveRoleLearning({
      ...i,
      responsibilityKey: 'pass_block',
    });
    expect(other.beforeBp).toBe(1000);
    expect(other.afterBp).toBe(1000);
  });
  it('returns zero change with no meaningful work, unrelated expertise or a fully learned responsibility', () => {
    const i = input();
    expect(resolveRoleLearning({ ...i, allocations: [] }).afterBp).toBe(8000);
    expect(
      resolveRoleLearning({
        ...i,
        teachingProfiles: [
          {
            ...teacher(),
            expertise: [
              { responsibilityKey: 'coverage_rules', teachingBp: 10000 },
            ],
          },
        ],
      }).afterBp,
    ).toBe(8000);
    expect(
      resolveRoleLearning({ ...i, knowledge: [known('run_reads', 10000)] })
        .afterBp,
    ).toBe(10000);
    expect(
      resolveRoleLearning({
        ...i,
        allocations: [{ ...lesson(), resourceKey: 'first_team_reps' }],
      }).afterBp,
    ).toBe(8000);
  });
  it('splitting a fixed teaching budget across teachers grants no stacking bonus and input order is irrelevant', () => {
    const i = input();
    const second = entityId('person-second-coach');
    const allocations = [
      { ...lesson(20) },
      { ...lesson(20), id: recordId('lesson-b'), teacherPersonId: second },
    ];
    const split = resolveRoleLearning({
      ...i,
      allocations,
      teachingProfiles: [teacher(), teacher(second)],
    });
    expect(split.afterBp).toBe(8200);
    expect(
      resolveRoleLearning({
        ...i,
        allocations: [...allocations].reverse(),
        teachingProfiles: [teacher(second), teacher()],
      }),
    ).toEqual(split);
  });
  it('divides shared teaching units among named responsibilities instead of duplicating them', () => {
    const i = input();
    const learned = resolveRoleLearning({
      ...i,
      allocations: [
        { ...lesson(), responsibilityKeys: ['run_reads', 'pass_block'] },
      ],
    });
    expect(learned.afterBp).toBe(8100);
  });
  it('projects person-owned family credit without mutating existing knowledge or granting new mastery', () => {
    const knowledge = [known()];
    const before = JSON.stringify(knowledge);
    expect(
      projectTransferFamiliarity(
        knowledge,
        'new_offense',
        'run_reads',
        'ball_carrier',
      ),
    ).toBe(4000);
    expect(
      projectTransferFamiliarity(
        knowledge,
        'base_offense',
        'run_reads',
        'ball_carrier',
      ),
    ).toBe(8000);
    expect(
      projectTransferFamiliarity(
        knowledge,
        'new_defense',
        'coverage_rules',
        'coverage',
      ),
    ).toBe(0);
    expect(
      projectTransferFamiliarity(
        [...knowledge, known('another_read', 6000)],
        'new_offense',
        'run_reads',
        'ball_carrier',
      ),
    ).toBe(4000);
    expect(JSON.stringify(knowledge)).toBe(before);
  });
});
