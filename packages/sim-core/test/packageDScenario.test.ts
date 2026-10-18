import { describe, expect, it, vi } from 'vitest';
import {
  PACKAGE_D_EXPECTED,
  SYNTHETIC_PACKAGE_D_RULESET,
  WorldKernel,
  canonicalString,
  diffPackageD,
} from '../src/index';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACKAGE_D_STEPS } from '../src/packageDScenario';
import { runPackageDScenario } from '../src/packageDScenarioRun';

vi.setConfig({ testTimeout: 180_000 });

const reload = (_i: number, k: WorldKernel): WorldKernel =>
  WorldKernel.resume({
    world: JSON.parse(JSON.stringify(k.world)),
    ruleset: SYNTHETIC_PACKAGE_D_RULESET,
    chainHead: k.chainHead,
    eventCount: k.eventCount,
    knownCommandIds: [...k.knownCommandIds],
  });

describe('Package D integrated scenario RED gate', () => {
  it('matches the frozen fixture file and the recorded expectation', () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          'fixtures',
          'golden',
          'package-d-golden-v2.json',
        ),
        'utf8',
      ),
    ) as unknown;
    expect(fixture).toEqual(JSON.parse(JSON.stringify(PACKAGE_D_EXPECTED)));
    expect(diffPackageD(runPackageDScenario(), PACKAGE_D_EXPECTED)).toEqual([]);
  });

  it('is deterministic and proves all six named Package D obligations from authoritative evidence', () => {
    const a = runPackageDScenario();
    const b = runPackageDScenario();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(a.steps.map((step) => step.outcome)).toEqual(
      PACKAGE_D_STEPS.map((step) => step.expect),
    );
    expect(a.auditErrorFindings).toEqual({ acquisition: 0, development: 0 });

    expect(a.evidence.qbSuccession.veteranFirstTeamUnits).toBeGreaterThan(0);
    expect(
      a.evidence.qbSuccession.developmentalDevelopmentUnits,
    ).toBeGreaterThan(0);
    expect(
      a.evidence.qbSuccession.veteranFirstTeamUnits +
        a.evidence.qbSuccession.developmentalFirstTeamUnits,
    ).toBeLessThanOrEqual(a.evidence.qbSuccession.firstTeamCapacityUnits);

    expect(a.evidence.schemeTransition.capabilityUnchangedAtTransition).toBe(
      true,
    );
    expect(
      a.evidence.schemeTransition.targetFamiliarityBeforeWorkBp,
    ).toBeLessThan(a.evidence.schemeTransition.sourceFamiliarityBp);
    expect(
      a.evidence.schemeTransition.targetFamiliarityAfterWorkBp,
    ).toBeGreaterThan(
      a.evidence.schemeTransition.targetFamiliarityBeforeWorkBp,
    );

    expect(a.evidence.roleTransition.roleLabelChanged).toBe(true);
    expect(a.evidence.roleTransition.capabilityUnchangedAtTransition).toBe(
      true,
    );
    expect(a.evidence.roleTransition.knowledgeCreatedAtTransition).toBe(false);

    expect(a.evidence.medical.preference).not.toBe(
      a.evidence.medical.recommendationParticipation,
    );
    expect(a.evidence.medical.recommendationParticipation).not.toBe(
      a.evidence.medical.clearanceParticipation,
    );
    expect(a.evidence.medical.usageUnits).toBeGreaterThan(
      a.evidence.medical.recommendationMaxLoadUnits ?? 0,
    );
    expect(a.evidence.medical.structuralHealingBp).not.toBe(
      a.evidence.medical.functionalReadinessBp,
    );
    expect(a.evidence.medical.conditioningBp).not.toBe(
      a.evidence.medical.functionalReadinessBp,
    );

    expect(a.evidence.lateBloomer.initialBeliefParity).toBe(true);
    expect(a.evidence.lateBloomer.playerANetCapabilityDeltaBp).not.toBe(
      a.evidence.lateBloomer.playerBNetCapabilityDeltaBp,
    );

    expect(a.evidence.acquisitionSqueeze.crowdingBand).not.toBe('none');
    expect(a.evidence.acquisitionSqueeze.planRevisionAfter).toBeGreaterThan(
      a.evidence.acquisitionSqueeze.planRevisionBefore,
    );
    expect(a.evidence.acquisitionSqueeze.incomingPlayerId).toBe(
      a.evidence.qbSuccession.veteranPlayerId,
    );

    expect(a.zeroGrowthCheckpointIds.length).toBeGreaterThan(0);
  });

  it('has at least one rejected stale/unauthorized D step that is byte-atomic and consumes no RNG', () => {
    const result = runPackageDScenario();
    const rejected = result.steps.filter(
      (step) => step.outcome !== 'committed',
    );
    expect(rejected.length).toBeGreaterThan(0);
    rejected.forEach((step) => {
      expect(step.stateUnchanged).toBe(true);
      expect(step.rngUnchanged).toBe(true);
    });
  });

  it('diverges under an alternate finite-rep allocation while remaining audit-clean', () => {
    const primary = runPackageDScenario();
    const alternate = runPackageDScenario({ variant: 'alternate' });
    expect(alternate.fingerprint).not.toBe(primary.fingerprint);
    expect(alternate.eventChainHead).not.toBe(primary.eventChainHead);
    expect(alternate.auditErrorFindings).toEqual({
      acquisition: 0,
      development: 0,
    });
    expect(alternate.rngDraws).toBe(primary.rngDraws);
  });

  it('save/reload at every command boundary yields the identical final result', () => {
    const uninterrupted = runPackageDScenario();
    const everyBoundary = runPackageDScenario({ beforeStep: reload });
    expect(canonicalString(everyBoundary)).toBe(canonicalString(uninterrupted));
    [3, 12, 24, 36].forEach((at) => {
      if (at >= PACKAGE_D_STEPS.length) return;
      const once = runPackageDScenario({
        beforeStep: (index, kernel) =>
          index === at ? reload(index, kernel) : undefined,
      });
      expect(once.fingerprint).toBe(uninterrupted.fingerprint);
      expect(once.eventChainHead).toBe(uninterrupted.eventChainHead);
      expect(once.rngState).toEqual(uninterrupted.rngState);
    });
  });
});
