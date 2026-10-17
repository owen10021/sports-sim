import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  validateForWorldCreation,
} from '../src/index';

const root = join(__dirname, '..', '..', '..');
const readJson = (rel: string): unknown =>
  JSON.parse(readFileSync(join(root, rel), 'utf8'));

describe('synthetic fixtures', () => {
  it('committed JSON equals the production module exactly', () => {
    expect(readJson('fixtures/rulesets/synthetic-minimal-v1.json')).toEqual(
      JSON.parse(JSON.stringify(SYNTHETIC_RULESET)),
    );
    expect(readJson('fixtures/seeds/synthetic-empty-v1.json')).toEqual(
      JSON.parse(JSON.stringify(SYNTHETIC_SEED)),
    );
  });

  it('pins the known content hashes', () => {
    expect(SYNTHETIC_RULESET.contentHash).toBe(
      '0776311417c64397f948efe719cbf0ad6648b2011e5c227a62158ee6cb3712ae',
    );
    expect(SYNTHETIC_SEED.contentHash).toBe(
      '95b75c540916552ad18c05fd50e158b218254ac909edf8a84d82e26ecc4bf98f',
    );
  });

  it('the pair is accepted for world creation', () => {
    expect(validateForWorldCreation(SYNTHETIC_SEED, SYNTHETIC_RULESET).ok).toBe(
      true,
    );
  });
});
