import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PACKAGE_C_SEED,
  SYNTHETIC_PACKAGE_C_RULESET,
  buildOrganizationDecisionView,
  buildOrganizationKnowledgeView,
  canonicalString,
  createWorld,
  worldId,
  type FootballWorld,
} from '../src/index';

const world = (): FootballWorld =>
  createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, {
    newWorldId: () => worldId('world-truth-boundary'),
  });

/** Every field name and value that would reveal latent player truth or private preference. */
const secretsOf = (w: FootballWorld): string[] => {
  const keys = new Set<string>();
  for (const p of w.roster.players)
    for (const c of p.capabilities) keys.add(c.key);
  return [
    ...keys,
    'capabilities',
    'valueBp',
    'playerPreferences',
    'roleOpportunity',
    'earlyCash',
    'contenderPreference',
  ];
};

describe('ordinary organization views never contain latent player truth', () => {
  it('knowledge views for every organization member omit capabilities, preferences and players', () => {
    const w = world();
    const secrets = secretsOf(w);
    const playerIds = w.roster.players.map((p) => p.personId);
    expect(w.roster.players.length).toBeGreaterThan(0);
    let viewed = 0;
    for (const episode of w.people.roleEpisodes) {
      const view = buildOrganizationKnowledgeView(
        w,
        episode.organizationId,
        episode.personId,
      );
      const text = canonicalString(view);
      for (const secret of secrets) expect(text).not.toContain(secret);
      for (const id of playerIds) expect(text).not.toContain(id);
      viewed += 1;
    }
    expect(viewed).toBeGreaterThan(0);
  });

  it('decision views for every organization omit capabilities, preferences and the roster domain', () => {
    const w = world();
    const secrets = secretsOf(w);
    let viewed = 0;
    for (const episode of w.people.roleEpisodes) {
      const res = buildOrganizationDecisionView(w, {
        organizationId: episode.organizationId,
        actorPersonId: episode.personId,
        category: 'organizational_plan',
        optionIds: ['opt-a'],
      } as never);
      if (!res.ok) continue;
      const text = JSON.stringify(res.view);
      for (const secret of secrets) expect(text).not.toContain(secret);
      for (const key of ['roster', 'market', 'scouting', 'draft', 'contracts'])
        expect(text).not.toContain(`"${key}"`);
      viewed += 1;
    }
    expect(viewed).toBeGreaterThan(0);
  });

  it('adds no fields that Package B reasoning views did not already have', () => {
    const w = world();
    const episode = w.people.roleEpisodes.find(
      (e) => e.role === 'general_manager',
    )!;
    const res = buildOrganizationDecisionView(w, {
      organizationId: episode.organizationId,
      actorPersonId: episode.personId,
      category: 'organizational_plan',
      optionIds: ['opt-a'],
    } as never);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.view).sort()).toEqual([
      'actorPersonId',
      'asOf',
      'authority',
      'category',
      'deadline',
      'knowledge',
      'optionIds',
      'organizationId',
      'plans',
      'publicFacts',
      'relationships',
    ]);
  });
});

describe('structural guard: knowledge and reasoning modules cannot reach player truth', () => {
  const src = (name: string): string =>
    readFileSync(join(__dirname, '..', 'src', name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('never import the roster, market, scouting or draft domains or read their state', () => {
    for (const file of [
      'knowledgeView.ts',
      'reasoning.ts',
      'coherenceAudit.ts',
      'information.ts',
    ]) {
      const text = src(file);
      expect(text, file).not.toMatch(
        /from '\.\/(roster|market|scouting|draft|contracts)'/,
      );
      expect(text, file).not.toMatch(
        /\.roster\b|\.market\b|\.scouting\b|\.draft\b/,
      );
      expect(text, file).not.toMatch(/capabilit/i);
    }
  });

  it('the world model type carries no overall/potential/value field on players', () => {
    const roster = src('roster.ts');
    for (const banned of [
      /\boverall\b/i,
      /\bovr\b/i,
      /\bpotential\b/i,
      /\bceiling\b/i,
      /tradeValue/i,
    ])
      expect(roster).not.toMatch(banned);
  });
});
