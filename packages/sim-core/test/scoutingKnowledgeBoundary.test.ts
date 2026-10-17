import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildOrganizationKnowledgeView,
  buildScoutingView,
  entityId,
  fingerprintWorld,
  type FootballWorld,
} from '../src/index';
import {
  NF,
  newKernelWith,
  newPackageCKernel,
} from './support/packageCHarness';
import { runnerFor } from './support/orgHarness';
import {
  EB_SCOUT,
  NF_SCOUT,
  PROSPECT,
  recordObservation,
  scoutOnce,
} from './support/scoutingHarness';

const SRC = (name: string): string =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

describe('scouting cannot reach latent player truth', () => {
  it('the scouting modules never touch the capability data or its values', () => {
    for (const file of ['scouting.ts', 'scoutingCommands.ts']) {
      const text = SRC(file);
      expect(text, file).not.toMatch(/\.capabilities|PlayerCapability/);
      expect(text, file).not.toMatch(/valueBp/);
      expect(text, file).not.toMatch(/PlayerRecord/);
    }
  });

  it('interpretation takes claims and a lens, not a world', () => {
    // The interpreter's signature has no world parameter at all.
    const text = SRC('scouting.ts');
    const start = text.indexOf('export const interpretEvidence');
    const signature = text.slice(
      start,
      text.indexOf('): Interpretation', start),
    );
    expect(signature).toContain('dimensions: readonly string[]');
    expect(signature).toContain('claims: readonly ClaimRecord[]');
    expect(signature).toContain('lens: EvaluatorLens');
    expect(signature).not.toMatch(/world/i);
  });

  it('wildly different latent truth produces byte-identical scouting knowledge', () => {
    const run = (scale: number) => {
      const kernel = newKernelWith((w): FootballWorld => ({
        ...w,
        roster: {
          ...w.roster,
          players: w.roster.players.map((p) => ({
            ...p,
            capabilities: p.capabilities.map((c) => ({
              ...c,
              valueBp: Math.min(10_000, Math.round(c.valueBp * scale)),
            })),
          })),
        },
      }));
      const r = runnerFor(kernel);
      const a = recordObservation(r, {
        org: NF.org,
        by: NF_SCOUT,
        dimension: 'burst',
        signal: 'positive',
        family: 'f1',
      });
      const b = recordObservation(r, {
        org: NF.org,
        by: NF_SCOUT,
        dimension: 'processing',
        signal: 'negative',
        family: 'f2',
      });
      scoutOnce(r, NF.org, NF_SCOUT, [a, b]);
      return r.kernel.world;
    };
    const low = run(0.1);
    const high = run(1);
    expect(
      low.roster.players.find((p) => p.personId === PROSPECT)!.capabilities,
    ).not.toEqual(
      high.roster.players.find((p) => p.personId === PROSPECT)!.capabilities,
    );
    expect(JSON.stringify(low.scouting)).toBe(JSON.stringify(high.scouting));
    expect(JSON.stringify(low.information)).toBe(
      JSON.stringify(high.information),
    );
  });
});

describe('scouting knowledge stays inside the organization that formed it', () => {
  const world = () => {
    const r = runnerFor(newPackageCKernel());
    const mine = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'burst',
      signal: 'positive',
      family: 'f-private',
    });
    const shared = recordObservation(r, {
      org: NF.org,
      by: NF_SCOUT,
      dimension: 'processing',
      signal: 'positive',
      family: 'f-public',
      visibility: 'public',
    });
    scoutOnce(r, NF.org, NF_SCOUT, [mine, shared]);
    return { w: r.kernel.world, mine, shared };
  };

  it('a rival sees public claims but neither private claims, beliefs nor scouting work', () => {
    const { w, mine, shared } = world();
    const rival = buildOrganizationKnowledgeView(
      w,
      entityId('org-eastbrook'),
      entityId(EB_SCOUT),
    );
    expect(rival.claims.map((c) => c.id)).toEqual([shared]);
    expect(rival.claims.map((c) => c.id)).not.toContain(mine);
    expect(rival.beliefs).toHaveLength(0);
    const view = buildScoutingView(
      w,
      entityId('org-eastbrook'),
      entityId(EB_SCOUT),
    );
    expect(JSON.stringify(view)).not.toContain('f-private');
    expect(view.reports).toHaveLength(0);
  });

  it('a report only links knowledge; it does not copy the assessment', () => {
    const { w } = world();
    const report = w.scouting.reports[0]!;
    expect(Object.keys(report).sort()).toEqual([
      'assignmentId',
      'beliefId',
      'evaluatorPersonId',
      'evidenceClaimIds',
      'formedAt',
      'id',
      'organizationId',
      'playerId',
      'questionId',
      'unresolvedQuestionKeys',
    ]);
    expect(JSON.stringify(report)).not.toContain('reading');
    expect(JSON.stringify(report)).not.toContain('confidence');
  });

  it('is part of the world fingerprint and reproduces exactly', () => {
    expect(fingerprintWorld(world().w)).toBe(fingerprintWorld(world().w));
  });
});
