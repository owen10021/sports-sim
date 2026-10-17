import { describe, expect, it } from 'vitest';
import {
  buildOrganizationKnowledgeView,
  canonicalString,
  type ActorKind,
  type FootballWorld,
} from '../src/index';
import {
  NF,
  SP,
  TODAY,
  codeOf,
  newOrgKernel,
  okResult,
  runnerFor,
  snapshotOf,
} from './support/orgHarness';

const party = (kind: 'person' | 'organization', entityId: string) => ({
  kind,
  entityId,
});
const NF_ORG = party('organization', NF.org);
const SP_ORG = party('organization', SP.org);
const NF_GM = party('person', NF.gm);
const SP_GM = party('person', SP.gm);

const effect = (
  a: unknown,
  b: unknown,
  changes: { dimension: string; to: string }[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'RecordRelationshipEffect',
  partyA: a,
  partyB: b,
  causeType: 'test_scenario',
  causeId: 'cause-1',
  changes,
  ...extra,
});

const edges = (w: FootballWorld) => w.relationships.edges;

describe('relationship edges', () => {
  it('create on first effect with canonically ordered parties, all dimensions starting at none', () => {
    const r = runnerFor();
    const res = okResult(
      r.run(effect(SP_ORG, NF_ORG, [{ dimension: 'trust', to: 'high' }])),
    );
    expect(edges(res.world)).toEqual([
      {
        id: 'rec-000001',
        partyA: NF_ORG,
        partyB: SP_ORG,
        trust: 'high',
        professionalRespect: 'none',
        familiarity: 'none',
        alignment: 'none',
        access: 'none',
        tension: 'none',
        createdAt: TODAY,
        revision: 2,
      },
    ]);
    expect(res.events.map((e) => e.type)).toEqual([
      'RelationshipEdgeCreated',
      'RelationshipEffectRecorded',
    ]);
    expect(res.world.revision).toBe(1);
    expect(res.world.nextIds).toEqual({ event: 3, record: 3 });
    expect(res.world.rng.draws).toBe(0);
  });

  it('prevents duplicate edges whatever the argument order', () => {
    const r = runnerFor();
    okResult(
      r.run(effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }])),
    );
    const res = okResult(
      r.run(effect(SP_ORG, NF_ORG, [{ dimension: 'familiarity', to: 'high' }])),
    );
    expect(edges(res.world)).toHaveLength(1);
    expect(edges(res.world)[0]).toMatchObject({
      trust: 'low',
      familiarity: 'high',
      revision: 3,
    });
    expect(res.events.map((e) => e.type)).toEqual([
      'RelationshipEffectRecorded',
    ]);
  });

  it('keeps person and organization edges distinct, and orders parties by kind then id', () => {
    const r = runnerFor();
    const res = okResult(
      r.run(
        effect(NF_GM, NF_ORG, [{ dimension: 'alignment', to: 'moderate' }]),
      ),
    );
    expect(edges(res.world)[0]).toMatchObject({
      partyA: NF_ORG,
      partyB: NF_GM,
    });
  });

  it('has independent dimensions and no aggregate score', () => {
    const r = runnerFor();
    const res = okResult(
      r.run(
        effect(NF_GM, SP_GM, [
          { dimension: 'trust', to: 'very_high' },
          { dimension: 'tension', to: 'high' },
        ]),
      ),
    );
    const edge = edges(res.world)[0]!;
    expect(edge).toMatchObject({
      trust: 'very_high',
      tension: 'high',
      professionalRespect: 'none',
      familiarity: 'none',
      alignment: 'none',
      access: 'none',
    });
    for (const key of Object.keys(edge))
      expect(key).not.toMatch(/score|overall|rating|total|aggregate/i);
  });
});

describe('relationship effect history', () => {
  it('records the cause and the before/after of every change, append-only', () => {
    const r = runnerFor();
    const first = okResult(
      r.run(
        effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'moderate' }], {
          causeType: 'decision_receipt',
          causeId: 'rec-000042',
        }),
      ),
    );
    const original = canonicalString(first.world.relationships.effects[0]);
    expect(first.world.relationships.effects[0]).toEqual({
      id: 'rec-000002',
      relationshipId: 'rec-000001',
      causeType: 'decision_receipt',
      causeId: 'rec-000042',
      occurredAt: TODAY,
      changes: [{ dimension: 'trust', from: 'none', to: 'moderate' }],
    });
    const second = okResult(
      r.run(
        effect(NF_ORG, SP_ORG, [
          { dimension: 'trust', to: 'low' },
          { dimension: 'tension', to: 'moderate' },
        ]),
      ),
    );
    const effects = second.world.relationships.effects;
    expect(effects).toHaveLength(2);
    expect(canonicalString(effects[0])).toBe(original);
    expect(effects[1]!.changes).toEqual([
      { dimension: 'trust', from: 'moderate', to: 'low' },
      { dimension: 'tension', from: 'none', to: 'moderate' },
    ]);
    const ids = effects.map((e) => e.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('rejects malformed effects without changing anything', () => {
    const r = runnerFor();
    okResult(
      r.run(effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }])),
    );
    const before = snapshotOf(r.kernel);
    const bads: Record<string, unknown>[] = [
      effect(NF_ORG, NF_ORG, [{ dimension: 'trust', to: 'low' }]),
      effect(NF_ORG, party('organization', 'org-nowhere'), [
        { dimension: 'trust', to: 'low' },
      ]),
      effect(NF_ORG, party('person', SP.org), [
        { dimension: 'trust', to: 'low' },
      ]),
      effect(NF_ORG, SP_ORG, []),
      effect(NF_ORG, SP_ORG, [{ dimension: 'popularity', to: 'low' }]),
      effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'ecstatic' }]),
      effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }]), // no-op
      effect(NF_ORG, SP_ORG, [
        { dimension: 'access', to: 'low' },
        { dimension: 'access', to: 'high' },
      ]),
      effect(NF_ORG, SP_ORG, [{ dimension: 'access', to: 'low' }], {
        causeType: '',
      }),
      effect(NF_ORG, SP_ORG, [{ dimension: 'access', to: 'low' }], {
        causeId: 'has spaces',
      }),
    ];
    for (const bad of bads) expect(codeOf(r.run(bad))).toBe('INVALID_PAYLOAD');
    expect(snapshotOf(r.kernel)).toEqual(before);
  });

  it('only system-level actors may record effects; ordinary actors cannot farm relationships', () => {
    const allowed: ActorKind[] = ['system', 'commissioner', 'test_harness'];
    const denied: ActorKind[] = ['human_gm', 'cpu_org', 'delegate'];
    for (const kind of allowed) {
      const r = runnerFor();
      okResult(
        r.run(
          effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }]),
          kind,
        ),
      );
    }
    for (const kind of denied) {
      const r = runnerFor();
      const before = snapshotOf(r.kernel);
      expect(
        codeOf(
          r.run(
            effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }]),
            kind,
          ),
        ),
      ).toBe('UNAUTHORIZED_ACTOR');
      expect(snapshotOf(r.kernel)).toEqual(before);
    }
  });
});

describe('relationships never become knowledge or farmable value', () => {
  it('maximum access grants no hidden truth and no claim visibility', () => {
    const r = runnerFor();
    okResult(
      r.run({
        type: 'RecordClaim',
        organizationId: SP.org,
        actingPersonId: SP.scout,
        subject: { kind: 'entity', id: 'org-northfield' },
        propositionType: 'scouting_note',
        proposition: { note: 'private to Southport' },
        sourceFamilyId: 'family-sp',
        observedAt: TODAY,
        visibility: 'organization',
        confidence: 'high',
        possibleBias: null,
        corroboratesClaimIds: [],
        contradictsClaimIds: [],
      }),
    );
    const before = canonicalString(
      buildOrganizationKnowledgeView(r.kernel.world, NF.org, NF.owner),
    );
    okResult(
      r.run(
        effect(NF_ORG, SP_ORG, [
          { dimension: 'access', to: 'very_high' },
          { dimension: 'trust', to: 'very_high' },
          { dimension: 'familiarity', to: 'very_high' },
        ]),
      ),
    );
    okResult(
      r.run(effect(NF_GM, SP_GM, [{ dimension: 'access', to: 'very_high' }])),
    );
    expect(
      canonicalString(
        buildOrganizationKnowledgeView(r.kernel.world, NF.org, NF.owner),
      ),
    ).toBe(before);
    expect(
      buildOrganizationKnowledgeView(r.kernel.world, NF.org, NF.gm).claims,
    ).toEqual([]);
    // The claim also remains uncitable and unshareable by Northfield.
    expect(
      codeOf(
        r.run({
          type: 'ShareClaim',
          organizationId: NF.org,
          actingPersonId: NF.owner,
          claimId: 'rec-000001',
          toOrganizationId: SP.org,
        }),
      ),
    ).toBe('INVALID_PAYLOAD');
  });

  it('DC-14: repeating an action does not repeat its effect, and ordinary commands never touch relationships', () => {
    const r = runnerFor();
    okResult(
      r.run(effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }])),
    );
    const relationships = canonicalString(r.kernel.world.relationships);
    const repeat = effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }]);
    for (let i = 0; i < 3; i++)
      expect(codeOf(r.run(repeat))).toBe('INVALID_PAYLOAD');
    for (let i = 0; i < 3; i++)
      okResult(
        r.run({
          type: 'RecordClaim',
          organizationId: NF.org,
          actingPersonId: NF.scout,
          subject: { kind: 'entity', id: 'org-southport' },
          propositionType: 'scouting_note',
          proposition: { note: `look ${i}` },
          sourceFamilyId: 'family-nf',
          observedAt: TODAY,
          visibility: 'organization',
          confidence: 'medium',
          possibleBias: null,
          corroboratesClaimIds: [],
          contradictsClaimIds: [],
        }),
      );
    okResult(r.run({ type: 'AdvanceDays', days: 3 }));
    expect(canonicalString(r.kernel.world.relationships)).toBe(relationships);
  });
});

describe('invariants for RecordRelationshipEffect', () => {
  const command = effect(NF_ORG, SP_ORG, [{ dimension: 'trust', to: 'low' }]);

  it('stale and duplicate commands change nothing and draw no RNG', () => {
    const r = runnerFor();
    const before = snapshotOf(r.kernel);
    expect(codeOf(r.run(command, 'test_harness', 4))).toBe('STALE_REVISION');
    expect(snapshotOf(r.kernel)).toEqual(before);
    okResult(r.run(command));
    const after = snapshotOf(r.kernel);
    const dup = r.kernel.execute({
      commandId: 'cmd-000002',
      expectedRevision: 0,
      actor: { kind: 'test_harness', id: 'actor-1' },
      command,
    } as never);
    expect(dup.ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(after);
    expect(r.kernel.world.rng.draws).toBe(0);
  });

  it('a fault after resolution commits nothing, including the new edge', () => {
    let armed = true;
    const kernel = newOrgKernel({
      beforeCommit: () => {
        if (armed) throw new Error('injected fault');
      },
    });
    const r = runnerFor(kernel);
    const before = snapshotOf(kernel);
    expect(codeOf(r.run(command))).toBe('INTERNAL_ERROR');
    expect(snapshotOf(kernel)).toEqual(before);
    expect(kernel.world.relationships.edges).toEqual([]);
    armed = false;
    okResult(r.run(command));
  });

  it('identical histories produce identical worlds', () => {
    const a = runnerFor();
    const b = runnerFor();
    for (const r of [a, b]) {
      okResult(r.run(command));
      okResult(
        r.run(effect(SP_GM, NF_GM, [{ dimension: 'tension', to: 'high' }])),
      );
    }
    expect(snapshotOf(a.kernel).fingerprint).toBe(
      snapshotOf(b.kernel).fingerprint,
    );
  });
});
