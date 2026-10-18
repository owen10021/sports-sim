import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_PACKAGE_D_RULESET,
  entityId,
  recordId,
  type FootballWorld,
} from '../src/index';
import {
  DEVELOPMENT_FINDING_CODES,
  auditDevelopmentWorld,
  collectDevelopmentMetrics,
} from '../src/developmentAudit';
import {
  COACH,
  D_TODAY,
  NF,
  SP,
  allocationTerms,
  commitAllocation,
  dRunner,
  dWorld,
  openWindow,
  submitAllocation,
} from './support/packageDHarness';
import { okResult } from './support/orgHarness';

const rules = SYNTHETIC_PACKAGE_D_RULESET.rules.development!;
const codes = (world: FootballWorld) =>
  auditDevelopmentWorld(world, rules).map((finding) => finding.code);

const allocated = (
  units = 40,
  supervised = false,
): { world: FootballWorld; windowId: string; allocationId: string } => {
  const r = dRunner();
  const windowId = openWindow(r);
  const terms = supervised
    ? {
        ...allocationTerms('player-nf-01', units),
        resourceKey: 'development_reps',
        teacherPersonId: COACH,
        responsibilityKeys: ['run_reads'],
      }
    : allocationTerms('player-nf-01', units);
  const proposalId = submitAllocation(r, windowId, [terms]);
  okResult(r.run(commitAllocation(proposalId)));
  return {
    world: r.kernel.world,
    windowId,
    allocationId: r.kernel.world.development.opportunityAllocations.at(-1)!.id,
  };
};

const resolvedWork = (): FootballWorld => {
  const r = dRunner();
  const windowId = openWindow(r);
  const proposalId = submitAllocation(r, windowId, [
    allocationTerms('player-nf-01', 40),
  ]);
  okResult(r.run(commitAllocation(proposalId)));
  okResult(r.run({ type: 'AdvanceDays', days: 7 }));
  return r.kernel.world;
};

const medicalRechecked = () => {
  const r = dRunner();
  okResult(
    r.run({
      type: 'CreateMedicalEpisode',
      playerId: 'player-nf-01',
      conditionKey: 'synthetic_knee',
      onsetAt: D_TODAY,
      sourceKind: 'synthetic_test',
      affectedActionKeys: ['burst'],
      initialStructuralSeverityBp: 6000,
      recoveryResponsivenessBp: 8500,
      baselineReinjuryRiskBp: 7500,
    }),
  );
  const episodeId = r.kernel.world.medical.episodes.at(-1)!.id;
  okResult(r.run({ type: 'AdvanceDays', days: 7 }));
  okResult(
    r.run({
      type: 'ReassessMedicalEpisode',
      episodeId,
      organizationId: NF.org,
      evaluatorPersonId: NF.owner,
    }),
  );
  return { r, episodeId };
};

const commitLimitedClearance = (
  r: ReturnType<typeof dRunner>,
  episodeId: string,
  maxLoadUnits: number,
) => {
  okResult(
    r.run({
      type: 'SubmitProposal',
      organizationId: NF.org,
      actingPersonId: NF.owner,
      category: 'medical_clearance',
      subjects: [{ kind: 'entity', id: 'player-nf-01' }],
      termsType: 'medical_clearance_v1',
      terms: {
        episodeId,
        playerId: 'player-nf-01',
        participation: 'limited',
        maxLoadUnits,
      },
      requiredApproverPersonIds: [],
      expiresAt: null,
      contingencies: {},
    }),
  );
  const proposalId = r.kernel.world.decisions.proposals.at(-1)!.id;
  okResult(
    r.run({
      type: 'CommitMedicalClearanceProposal',
      proposalId,
      actingPersonId: NF.owner,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'audit fixture clearance' },
    }),
  );
};

describe('development/medical audit finding matrix', () => {
  it('declares the complete required Package D finding-code surface', () => {
    expect(DEVELOPMENT_FINDING_CODES).toEqual([
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
    ]);
  });

  it('finds OPPORTUNITY_OVERALLOCATED in a deliberately corrupted committed allocation', () => {
    const { world, allocationId } = allocated();
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        opportunityAllocations: world.development.opportunityAllocations.map(
          (a) => (a.id === allocationId ? { ...a, units: 101 } : a),
        ),
      },
    };
    expect(codes(corrupt)).toContain('OPPORTUNITY_OVERALLOCATED');
  });

  it('finds ALLOCATION_WITHOUT_ROSTER_ACCESS at the allocation date', () => {
    const { world, allocationId } = allocated();
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        opportunityAllocations: world.development.opportunityAllocations.map(
          (a) => (a.id === allocationId ? { ...a, organizationId: SP.org } : a),
        ),
      },
    };
    expect(codes(corrupt)).toContain('ALLOCATION_WITHOUT_ROSTER_ACCESS');
  });

  it('finds TEACHING_BANDWIDTH_EXCEEDED in corrupted supervised work', () => {
    const { world, allocationId } = allocated(40, true);
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        opportunityAllocations: world.development.opportunityAllocations.map(
          (a) => (a.id === allocationId ? { ...a, units: 81 } : a),
        ),
      },
    };
    expect(codes(corrupt)).toContain('TEACHING_BANDWIDTH_EXCEEDED');
  });

  it('finds INVALID_ROLE_KNOWLEDGE', () => {
    const world = dWorld();
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        roleKnowledge: world.development.roleKnowledge.map((k, index) =>
          index === 0 ? { ...k, familiarityBp: 10001 } : k,
        ),
      },
    };
    expect(codes(corrupt)).toContain('INVALID_ROLE_KNOWLEDGE');
  });

  it('finds INVALID_READINESS_RANGE', () => {
    const world = dWorld();
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        readiness: world.development.readiness.map((x, index) =>
          index === 0 ? { ...x, acuteFatigueBp: -1 } : x,
        ),
      },
    };
    expect(codes(corrupt)).toContain('INVALID_READINESS_RANGE');
  });

  it('finds INVALID_CAPABILITY_RANGE', () => {
    const world = dWorld();
    const corrupt = {
      ...world,
      roster: {
        ...world.roster,
        players: world.roster.players.map((player, index) =>
          index === 0
            ? {
                ...player,
                capabilities: player.capabilities.map((capability, capIndex) =>
                  capIndex === 0
                    ? { ...capability, valueBp: 10001 }
                    : capability,
                ),
              }
            : player,
        ),
      },
    };
    expect(codes(corrupt)).toContain('INVALID_CAPABILITY_RANGE');
  });

  it('finds RESOLVED_WINDOW_WITHOUT_CHECKPOINT', () => {
    const { world, windowId } = allocated();
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        opportunityWindows: world.development.opportunityWindows.map(
          (window) =>
            window.id === windowId
              ? { ...window, status: 'resolved' as const }
              : window,
        ),
      },
    };
    expect(codes(corrupt)).toContain('RESOLVED_WINDOW_WITHOUT_CHECKPOINT');
  });

  it('finds CHECKPOINT_WITHOUT_ALLOCATIONS on a corrupted work checkpoint', () => {
    const world = resolvedWork();
    const checkpoint = world.development.checkpoints.find(
      (c) => c.windowId !== null,
    )!;
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        checkpoints: world.development.checkpoints.map((c) =>
          c.id === checkpoint.id ? { ...c, allocationIds: [] } : c,
        ),
      },
    };
    expect(codes(corrupt)).toContain('CHECKPOINT_WITHOUT_ALLOCATIONS');
  });

  it('finds MEDICAL_PROGRESS_WITHOUT_EPISODE', () => {
    const { r, episodeId } = medicalRechecked();
    const world = r.kernel.world;
    const corrupt = {
      ...world,
      medical: {
        ...world.medical,
        episodes: world.medical.episodes.filter(
          (episode) => episode.id !== episodeId,
        ),
      },
    };
    expect(codes(corrupt)).toContain('MEDICAL_PROGRESS_WITHOUT_EPISODE');
  });

  it('finds CLEARANCE_WITHOUT_EPISODE', () => {
    const world = dWorld();
    const corrupt = {
      ...world,
      medical: {
        ...world.medical,
        clearances: [
          ...world.medical.clearances,
          {
            id: recordId('corrupt-clearance'),
            episodeId: recordId('missing-episode'),
            organizationId: NF.org,
            playerId: entityId('player-nf-01'),
            participation: 'out' as const,
            maxLoadUnits: 0,
            sourceProposalId: recordId('missing-proposal'),
            committedAt: D_TODAY,
            supersedesClearanceId: null,
          },
        ],
      },
    };
    expect(codes(corrupt)).toContain('CLEARANCE_WITHOUT_EPISODE');
  });

  it('finds USAGE_EXCEEDS_CLEARANCE using the clearance that existed at work time', () => {
    const r = dRunner();
    okResult(
      r.run({
        type: 'CreateMedicalEpisode',
        playerId: 'player-nf-01',
        conditionKey: 'synthetic_hamstring',
        onsetAt: D_TODAY,
        sourceKind: 'synthetic_test',
        affectedActionKeys: ['burst'],
        initialStructuralSeverityBp: 5000,
        recoveryResponsivenessBp: 8000,
        baselineReinjuryRiskBp: 7000,
      }),
    );
    const episodeId = r.kernel.world.medical.episodes.at(-1)!.id;
    commitLimitedClearance(r, episodeId, 40);
    const windowId = openWindow(r);
    const proposalId = submitAllocation(r, windowId, [
      allocationTerms('player-nf-01', 40),
    ]);
    okResult(r.run(commitAllocation(proposalId)));
    const allocationId =
      r.kernel.world.development.opportunityAllocations.at(-1)!.id;
    const world = r.kernel.world;
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        opportunityAllocations: world.development.opportunityAllocations.map(
          (a) => (a.id === allocationId ? { ...a, units: 60 } : a),
        ),
      },
    };
    expect(codes(corrupt)).toContain('USAGE_EXCEEDS_CLEARANCE');
  });

  it('finds MEDICAL_REPORT_INACCESSIBLE_BASIS', () => {
    const { r } = medicalRechecked();
    const world = r.kernel.world;
    const report = world.medical.reports.at(-1)!;
    const claimId = report.evidenceClaimIds[0]!;
    const corrupt = {
      ...world,
      information: {
        ...world.information,
        claims: world.information.claims.map((claim) =>
          claim.id === claimId
            ? {
                ...claim,
                visibility: 'organization' as const,
                holderOrganizationIds: [SP.org],
              }
            : claim,
        ),
      },
    };
    expect(codes(corrupt)).toContain('MEDICAL_REPORT_INACCESSIBLE_BASIS');
  });

  it('finds DEVELOPMENT_EVENT_WITHOUT_CAUSE for work events but permits passive aging with no causal record', () => {
    const world = resolvedWork();
    const event = world.development.events.find(
      (entry) =>
        entry.kind !== 'passive_aging' && entry.causalRecordIds.length > 0,
    )!;
    const corrupt = {
      ...world,
      development: {
        ...world.development,
        events: world.development.events.map((entry) =>
          entry.id === event.id ? { ...entry, causalRecordIds: [] } : entry,
        ),
      },
    };
    expect(codes(corrupt)).toContain('DEVELOPMENT_EVENT_WITHOUT_CAUSE');
    expect(codes(world)).not.toContain('DEVELOPMENT_EVENT_WITHOUT_CAUSE');
  });

  it('is read-only, deterministic, sorted, and clean on the canonical D world', () => {
    const world = dWorld();
    const before = JSON.stringify(world);
    const a = auditDevelopmentWorld(world, rules);
    const b = auditDevelopmentWorld(world, rules);
    expect(a).toEqual(b);
    expect(JSON.stringify(world)).toBe(before);
    expect(a).toEqual([]);
    const sorted = [...a].sort((x, y) =>
      `${x.code}|${x.organizationId ?? ''}|${x.subjectIds.join(',')}|${x.detail}`.localeCompare(
        `${y.code}|${y.organizationId ?? ''}|${y.subjectIds.join(',')}|${y.detail}`,
      ),
    );
    expect(a).toEqual(sorted);
  });
});

describe('development metrics contract', () => {
  it('is deterministic and exposes opportunity, capability, age/capability, role-learning, workload and medical-duration slices', () => {
    const { r } = medicalRechecked();
    const metricsA = collectDevelopmentMetrics(r.kernel.world);
    const metricsB = collectDevelopmentMetrics(r.kernel.world);
    expect(metricsA).toEqual(metricsB);
    expect(metricsA).toMatchObject({
      opportunity: expect.any(Object),
      capabilityChange: expect.any(Object),
      ageCapabilitySlices: expect.any(Array),
      roleLearning: expect.any(Object),
      workload: expect.any(Object),
      medicalDuration: expect.any(Object),
    });
  });

  it('is knowledge-neutral: changing claims/beliefs does not change production ecology metrics', () => {
    const world = resolvedWork();
    const altered = {
      ...world,
      information: {
        ...world.information,
        claims: [
          ...world.information.claims,
          {
            id: recordId('metrics-claim'),
            subject: { kind: 'entity' as const, id: NF.org },
            propositionType: 'synthetic_metrics_noise',
            proposition: { note: 'must not affect metrics' },
            sourcePersonId: NF.scout,
            sourceFamilyId: 'metrics-noise',
            observedAt: world.simDate,
            acquiredAt: world.simDate,
            visibility: 'organization' as const,
            holderOrganizationIds: [NF.org],
            confidence: 'low' as const,
            possibleBias: null,
            corroboratesClaimIds: [],
            contradictsClaimIds: [],
            sharedFromClaimId: null,
          },
        ],
      },
    };
    expect(collectDevelopmentMetrics(altered)).toEqual(
      collectDevelopmentMetrics(world),
    );
  });
});
