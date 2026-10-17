import { GENESIS_HASH, type EventEnvelope } from './audit';
import { canonicalString } from './canonical';
import type { CareerSnapshot } from './persistence';
import { rulesetRefOf, type LeagueRulesetManifest } from './ruleset';
import { seedRefOf, type WorldSeedManifest } from './seed';

export type CareerLoadErrorCode = 'RULESET_MISMATCH' | 'SEED_MISMATCH';

/** The stored career is intact but belongs to a different ruleset/seed than the caller supplied. */
export class CareerLoadError extends Error {
  readonly code: CareerLoadErrorCode;
  constructor(code: CareerLoadErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'CareerLoadError';
    this.code = code;
  }
}

export interface LoadOptions {
  /** The ruleset manifest the career must have been created with. */
  readonly ruleset: LeagueRulesetManifest;
  /** Optional: also pin the world seed the career must descend from. */
  readonly seed?: WorldSeedManifest;
  /**
   * When the newest snapshot cannot be trusted, rebuild it by deterministically replaying
   * verified immutable history (see repairLatestFromHistory). Off by default.
   */
  readonly repair?: boolean;
}

/** Check a snapshot belongs to the supplied ruleset (and seed, when given). Throws if not. */
export const requireMatchingRefs = (
  snapshot: CareerSnapshot,
  options: LoadOptions,
): void => {
  const want = rulesetRefOf(options.ruleset);
  const have = snapshot.world.ruleset;
  if (
    have.rulesetId !== want.rulesetId ||
    have.rulesetVersion !== want.rulesetVersion ||
    have.contentHash !== want.contentHash
  ) {
    throw new CareerLoadError(
      'RULESET_MISMATCH',
      `career uses ${have.rulesetId} v${have.rulesetVersion}, caller supplied ${want.rulesetId} v${want.rulesetVersion}`,
    );
  }
  if (options.seed !== undefined) {
    const wantSeed = seedRefOf(options.seed);
    if (canonicalString(snapshot.world.seed) !== canonicalString(wantSeed)) {
      throw new CareerLoadError(
        'SEED_MISMATCH',
        'career descends from a different world seed',
      );
    }
  }
};

/** Does the verified event prefix support `snapshot` (its count and audit head)? */
export const historySupports = (
  snapshot: CareerSnapshot,
  events: readonly EventEnvelope[],
  verifiedPrefix: number,
): boolean => {
  if (snapshot.eventCount > verifiedPrefix) return false;
  if (snapshot.eventCount === 0) return snapshot.chainHead === GENESIS_HASH;
  return events[snapshot.eventCount - 1]?.hash === snapshot.chainHead;
};
