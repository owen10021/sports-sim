import { describe, expect, it } from 'vitest';
import { buildOrganizationKnowledgeView, canonicalString } from '../src/index';
import { NF, SP, TODAY, okResult, runnerFor } from './support/orgHarness';

const claim = (
  by: string,
  org: string,
  extra: Record<string, unknown> = {},
) => ({
  type: 'RecordClaim',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  propositionType: 'scouting_note',
  proposition: { note: 'disciplined front office' },
  sourceFamilyId: 'family-alpha',
  observedAt: TODAY,
  visibility: 'organization',
  confidence: 'medium',
  possibleBias: null,
  corroboratesClaimIds: [],
  contradictsClaimIds: [],
  ...extra,
});

const belief = (
  by: string,
  org: string,
  evidence: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'FormBelief',
  organizationId: org,
  actingPersonId: by,
  subject: { kind: 'entity', id: 'org-southport' },
  assessmentType: 'organization_strength',
  assessment: { rating: 'solid' },
  confidence: 'medium',
  evidenceClaimIds: evidence,
  supersedesBeliefId: null,
  ...extra,
});

const viewOf = (
  r: ReturnType<typeof runnerFor>,
  org: typeof NF.org,
  person: typeof NF.owner,
) => buildOrganizationKnowledgeView(r.kernel.world, org, person);

describe('buildOrganizationKnowledgeView', () => {
  it('returns only provenance-carrying claims and beliefs, never raw world state', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    okResult(r.run(belief(NF.gm, NF.org, ['rec-000001'])));
    const view = viewOf(r, NF.org, NF.owner);
    expect(Object.keys(view).sort()).toEqual([
      'actorPersonId',
      'asOf',
      'beliefs',
      'claims',
      'organizationId',
    ]);
    expect(view.asOf).toBe(TODAY);
    expect(view.claims.map((c) => c.id)).toEqual(['rec-000001']);
    expect(view.claims[0]).toMatchObject({
      sourcePersonId: NF.scout,
      sourceFamilyId: 'family-alpha',
      confidence: 'medium',
      holderOrganizationIds: [NF.org],
    });
    expect(view.beliefs.map((b) => b.id)).toEqual(['rec-000002']);
    expect(view.beliefs[0]).toMatchObject({
      authorPersonId: NF.gm,
      evidenceClaimIds: ['rec-000001'],
      evidenceSourceFamilyIds: ['family-alpha'],
      supersededByBeliefId: null,
    });
  });

  it('DC-12: a rival-only private claim leaves no fact-revealing trace in another organization’s view', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    const before = canonicalString(viewOf(r, NF.org, NF.owner));
    const beforeGm = canonicalString(viewOf(r, NF.org, NF.gm));
    okResult(
      r.run(
        claim(SP.scout, SP.org, {
          subject: { kind: 'entity', id: 'org-northfield' },
          proposition: { note: 'Northfield is about to cut its quarterback' },
          visibility: 'restricted',
        }),
      ),
    );
    okResult(
      r.run(
        claim(SP.owner, SP.org, {
          proposition: { note: 'private organization claim' },
          visibility: 'organization',
        }),
      ),
    );
    okResult(r.run(belief(SP.gm, SP.org, ['rec-000003'])));
    // Byte-identical: no extra row, count, badge, reason or id gap.
    expect(canonicalString(viewOf(r, NF.org, NF.owner))).toBe(before);
    expect(canonicalString(viewOf(r, NF.org, NF.gm))).toBe(beforeGm);
    // The rival does see its own knowledge.
    expect(viewOf(r, SP.org, SP.owner).claims.map((c) => c.id)).toEqual([
      'rec-000002',
      'rec-000003',
    ]);
  });

  it('public claims are visible to everyone, with other organizations redacted from holders', () => {
    const r = runnerFor();
    okResult(r.run(claim(SP.scout, SP.org, { visibility: 'public' })));
    const nf = viewOf(r, NF.org, NF.owner);
    expect(nf.claims.map((c) => c.id)).toEqual(['rec-000001']);
    expect(nf.claims[0]!.holderOrganizationIds).toEqual([]);
    expect(
      viewOf(r, SP.org, SP.owner).claims[0]!.holderOrganizationIds,
    ).toEqual([SP.org]);
  });

  it('restricted claims are shown only to their source and to the organization authority holder', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org, { visibility: 'restricted' })));
    expect(viewOf(r, NF.org, NF.scout).claims).toHaveLength(1);
    expect(viewOf(r, NF.org, NF.owner).claims).toHaveLength(1);
    expect(viewOf(r, NF.org, NF.gm).claims).toHaveLength(0);
    expect(viewOf(r, SP.org, SP.owner).claims).toHaveLength(0);
  });

  it('a person with no role in the organization gets an empty view, even for their own organization’s data', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    const outsider = viewOf(r, NF.org, SP.owner);
    expect(outsider.claims).toEqual([]);
    expect(outsider.beliefs).toEqual([]);
    okResult(
      r.run({
        type: 'EndRoleEpisode',
        actingPersonId: NF.owner,
        episodeId: 'role-nf-scout',
      }),
    );
    expect(viewOf(r, NF.org, NF.scout).claims).toEqual([]);
  });

  it('links to claims the viewer cannot see are removed from what they can see', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org, { visibility: 'restricted' }))); // rec-000001
    okResult(
      r.run(
        claim(NF.owner, NF.org, {
          sourceFamilyId: 'family-beta',
          corroboratesClaimIds: ['rec-000001'],
          contradictsClaimIds: [],
        }),
      ),
    ); // rec-000002
    okResult(r.run(belief(NF.owner, NF.org, ['rec-000001', 'rec-000002']))); // rec-000003
    const owner = viewOf(r, NF.org, NF.owner);
    expect(owner.claims[1]!.corroboratesClaimIds).toEqual(['rec-000001']);
    const gm = viewOf(r, NF.org, NF.gm);
    expect(gm.claims.map((c) => c.id)).toEqual(['rec-000002']);
    expect(gm.claims[0]!.corroboratesClaimIds).toEqual([]);
    expect(gm.beliefs[0]!.evidenceClaimIds).toEqual(['rec-000002']);
    expect(gm.beliefs[0]!.evidenceSourceFamilyIds).toEqual(['family-beta']);
  });

  it('beliefs of another organization are never visible', () => {
    const r = runnerFor();
    okResult(r.run(claim(SP.scout, SP.org)));
    okResult(r.run(belief(SP.gm, SP.org, ['rec-000001'])));
    expect(viewOf(r, NF.org, NF.owner).beliefs).toEqual([]);
    expect(viewOf(r, SP.org, SP.owner).beliefs).toHaveLength(1);
  });

  it('DC-17: later evidence shows as a linked newer belief; the older belief is unchanged', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org))); // 1
    okResult(r.run(belief(NF.gm, NF.org, ['rec-000001']))); // 2
    const first = canonicalString(viewOf(r, NF.org, NF.owner).beliefs[0]);
    okResult(
      r.run(
        claim(NF.owner, NF.org, {
          sourceFamilyId: 'family-beta',
          contradictsClaimIds: ['rec-000001'],
        }),
      ),
    ); // 3
    okResult(
      r.run(
        belief(NF.gm, NF.org, ['rec-000003'], {
          supersedesBeliefId: 'rec-000002',
          assessment: { rating: 'shaky' },
        }),
      ),
    ); // 4
    const view = viewOf(r, NF.org, NF.owner);
    expect(view.beliefs.map((b) => b.id)).toEqual(['rec-000002', 'rec-000004']);
    // Only the derived link differs; every stored field of the old belief is intact.
    const { supersededByBeliefId, ...oldFields } = view.beliefs[0]!;
    expect(supersededByBeliefId).toBe('rec-000004');
    expect(canonicalString({ ...oldFields, supersededByBeliefId: null })).toBe(
      first,
    );
    expect(view.beliefs[1]!.supersededByBeliefId).toBeNull();
  });

  it('counts independent source families, so echoes are not mistaken for corroboration', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org))); // family-alpha
    okResult(r.run(claim(NF.owner, NF.org))); // family-alpha again
    okResult(r.run(claim(NF.owner, NF.org, { sourceFamilyId: 'family-beta' })));
    okResult(
      r.run(belief(NF.gm, NF.org, ['rec-000001', 'rec-000002', 'rec-000003'])),
    );
    expect(
      viewOf(r, NF.org, NF.owner).beliefs[0]!.evidenceSourceFamilyIds,
    ).toEqual(['family-alpha', 'family-beta']);
  });

  it('is a pure, deterministic read: repeated calls are identical and the world is untouched', () => {
    const r = runnerFor();
    okResult(r.run(claim(NF.scout, NF.org)));
    const world = canonicalString(r.kernel.world);
    const a = canonicalString(viewOf(r, NF.org, NF.owner));
    const b = canonicalString(viewOf(r, NF.org, NF.owner));
    expect(a).toBe(b);
    expect(canonicalString(r.kernel.world)).toBe(world);
  });
});
