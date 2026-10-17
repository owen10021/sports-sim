import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SYNTHETIC_RULESET,
  WorldKernel,
  commandId,
  createWorld,
  entityId,
  fingerprintWorld,
  validateSeedManifest,
  worldId,
  worldRevision,
  type ActorKind,
  type CommandEnvelope,
  type ExecuteResult,
  type KernelOptions,
} from '../../src/index';

/** Shared two-organization world for Package B command tests. */
const seedJson = JSON.parse(
  readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'fixtures',
      'seeds',
      'synthetic-org-substrate-v1.json',
    ),
    'utf8',
  ),
) as unknown;
export const ORG_SEED = validateSeedManifest(seedJson);

export const NF = {
  org: entityId('org-northfield'),
  owner: entityId('person-nf-owner'),
  gm: entityId('person-nf-gm'),
  scout: entityId('person-nf-scout'),
};
export const SP = {
  org: entityId('org-southport'),
  owner: entityId('person-sp-owner'),
  gm: entityId('person-sp-gm'),
  scout: entityId('person-sp-scout'),
};
export const TODAY = '2026-10-16';

export const newOrgKernel = (options?: KernelOptions): WorldKernel =>
  WorldKernel.fromGenesis(
    createWorld(ORG_SEED, SYNTHETIC_RULESET, {
      newWorldId: () => worldId('world-org-1'),
    }),
    SYNTHETIC_RULESET,
    options,
  );

export interface Runner {
  readonly kernel: WorldKernel;
  run(
    command: Record<string, unknown>,
    kind?: ActorKind,
    expectedRevision?: number,
  ): ExecuteResult;
}

export const runnerFor = (kernel: WorldKernel = newOrgKernel()): Runner => {
  let n = 0;
  return {
    kernel,
    run: (command, kind = 'test_harness', expectedRevision) => {
      n += 1;
      return kernel.execute({
        commandId: commandId(`cmd-${String(n).padStart(6, '0')}`),
        expectedRevision: worldRevision(
          expectedRevision ?? Number(kernel.world.revision),
        ),
        actor: { kind, id: entityId('actor-1') },
        command,
      } as unknown as CommandEnvelope);
    },
  };
};

export const okResult = (res: ExecuteResult) => {
  if (!res.ok) throw new Error(`expected success: ${res.rejection.message}`);
  return res;
};
export const codeOf = (res: ExecuteResult): string =>
  res.ok ? 'OK' : res.rejection.code;
export const messageOf = (res: ExecuteResult): string =>
  res.ok ? '' : res.rejection.message;

/** Everything a rejected command must leave untouched. */
export const snapshotOf = (k: WorldKernel) => ({
  fingerprint: fingerprintWorld(k.world),
  draws: k.world.rng.draws,
  head: k.chainHead,
  events: k.eventCount,
  revision: k.world.revision,
  known: k.knownCommandIds,
});
