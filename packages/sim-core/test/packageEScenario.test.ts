import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  PACKAGE_E_EXPECTED,
  PACKAGE_E_SCENARIO_RULESET,
  WorldKernel,
  canonicalString,
  diffPackageE,
} from '../src/index';
import { PACKAGE_E_STEPS } from '../src/packageEScenario';
import { runPackageEScenario } from '../src/packageEScenarioRun';

vi.setConfig({ testTimeout: 60_000 });

const reload = (_index: number, kernel: WorldKernel): WorldKernel =>
  WorldKernel.resume({
    world: JSON.parse(JSON.stringify(kernel.world)),
    ruleset: PACKAGE_E_SCENARIO_RULESET,
    chainHead: kernel.chainHead,
    eventCount: kernel.eventCount,
    knownCommandIds: [...kernel.knownCommandIds],
  });

describe('Package E integrated authoritative football scenario RED gate', () => {
  it('matches the frozen Package E fixture and recorded expectation', () => {
    const fixture = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          'fixtures',
          'golden',
          'package-e-golden-v1.json',
        ),
        'utf8',
      ),
    ) as unknown;
    expect(fixture).toEqual(JSON.parse(JSON.stringify(PACKAGE_E_EXPECTED)));
    expect(diffPackageE(runPackageEScenario(), PACKAGE_E_EXPECTED)).toEqual([]);
  });
  it('is deterministic and proves the integrated football obligations from authoritative evidence', () => {
    const a = runPackageEScenario();
    const b = runPackageEScenario();
    expect(canonicalString(a)).toBe(canonicalString(b));
    expect(a.steps.map((step) => step.outcome)).toEqual(
      PACKAGE_E_STEPS.map((step) => step.expect),
    );
    expect(a.auditErrorFindings).toEqual({
      football: 0,
      development: 0,
      acquisition: 0,
    });

    expect(a.evidence.gamePlanSnapshotIds).toHaveLength(2);
    expect(new Set(a.evidence.gamePlanSnapshotIds).size).toBe(2);
    expect(a.evidence.activeDesignationOrganizations).toEqual([
      'org-northfield',
      'org-southport',
    ]);
    expect(a.evidence.authorityReceiptIds.length).toBeGreaterThanOrEqual(4);

    expect(a.evidence.advanceReachedGameDate).toBe(true);
    expect(a.evidence.crossingRejectedAtomically).toBe(true);
    expect(a.evidence.duplicateResolutionRejectedAtomically).toBe(true);

    expect(a.game.playCount).toBeGreaterThan(0);
    expect(a.evidence.playCategories).toContain('run');
    expect(a.evidence.playCategories).toContain('pass');
    expect(
      a.evidence.playCategories.some((key) =>
        ['kickoff', 'punt', 'field_goal', 'extra_point'].includes(key),
      ),
    ).toBe(true);
    expect(a.evidence.allPlaysHaveTwoCommittedCalls).toBe(true);
    expect(a.evidence.reconciliationClean).toBe(true);

    expect(a.evidence.limitedUsage.workloadUnits).toBeGreaterThan(0);
    expect(a.evidence.limitedUsage.workloadUnits).toBeLessThanOrEqual(
      a.evidence.limitedUsage.capUnits,
    );
    expect(a.evidence.limitedUsage.backupWorkloadUnits).toBeGreaterThan(0);
    expect(a.evidence.footballUsageCheckpointCount).toBeGreaterThan(0);
    expect(a.evidence.capabilitiesUnchangedByGameResolution).toBe(true);

    expect(a.evidence.footballInjuryEpisodeIds.length).toBeGreaterThan(0);
    expect(a.evidence.postInjuryParticipationCount).toBeGreaterThan(0);
    expect(a.evidence.footballObservationClaimIds.length).toBeGreaterThan(0);
    expect(a.evidence.sundayProofLinkCount).toBeGreaterThan(0);
    expect(a.evidence.presentationEquivalent).toBe(true);
  });

  it('keeps every rejected E step byte-atomic and RNG-free', () => {
    const result = runPackageEScenario();
    const rejected = result.steps.filter(
      (step) => step.outcome !== 'committed',
    );
    expect(rejected.length).toBeGreaterThan(0);
    rejected.forEach((step) => {
      expect(step.stateUnchanged).toBe(true);
      expect(step.rngUnchanged).toBe(true);
    });
  });

  it('save/reload at every command boundary yields the identical final result', () => {
    const uninterrupted = runPackageEScenario();
    const everyBoundary = runPackageEScenario({ beforeStep: reload });
    expect(canonicalString(everyBoundary)).toBe(canonicalString(uninterrupted));
  });

  it('a legitimate alternate tactical plan changes football history without a hidden winner bonus', () => {
    const primary = runPackageEScenario();
    const alternate = runPackageEScenario({ variant: 'alternate' });
    expect(alternate.fingerprint).not.toBe(primary.fingerprint);
    expect(alternate.eventChainHead).not.toBe(primary.eventChainHead);
    expect(alternate.auditErrorFindings).toEqual({
      football: 0,
      development: 0,
      acquisition: 0,
    });
    expect(alternate.evidence.noTeamStrengthOrControlOracle).toBe(true);
    expect(alternate.game.ledgerHash).not.toBe(primary.game.ledgerHash);
  });
});
