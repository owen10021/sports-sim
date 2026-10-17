import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DRAFT_BOARD_TERMS_TYPE,
  buildDraftBoardView,
  describeBoardChange,
  entityId,
} from '../src/index';
import {
  codeOf,
  messageOf,
  okResult,
  runnerFor,
  snapshotOf,
  type Runner,
} from './support/orgHarness';
import { NF, newPackageCKernel } from './support/packageCHarness';
import {
  EB_PICK,
  EB_SCOUT,
  NF_SCOUT,
  PROSPECT,
  recordObservation,
  scoutOnce,
} from './support/scoutingHarness';

const EB = {
  org: 'org-eastbrook',
  gm: 'person-eb-gm',
  owner: 'person-eb-owner',
};
const SECOND = 'player-pr-02';

type EntrySpec = Partial<{
  playerId: string;
  beliefIds: string[];
  roleProjection: string | null;
  withinTierOrder: number | null;
  needPriority: string;
  planIds: string[];
  noteClaimIds: string[];
}> &
  Record<string, unknown>;

const entry = (
  playerId: string,
  beliefIds: string[],
  extra: EntrySpec = {},
) => ({
  playerId,
  beliefIds,
  roleProjection: 'edge',
  withinTierOrder: null,
  needPriority: 'normal',
  planIds: [],
  noteClaimIds: [],
  ...extra,
});

const classId = (r: Runner): string => r.kernel.world.draft.classes[0]!.id;

const board = (r: Runner, tiers: unknown[]) => ({
  draftClassId: classId(r),
  tiers,
});

const propose = (
  r: Runner,
  org: string,
  by: string,
  terms: unknown,
  approvers: string[] = [],
): string => {
  const res = r.run({
    type: 'SubmitProposal',
    organizationId: org,
    actingPersonId: by,
    category: 'acquisition',
    subjects: [{ kind: 'entity', id: org }],
    termsType: DRAFT_BOARD_TERMS_TYPE,
    terms,
    requiredApproverPersonIds: approvers,
    expiresAt: null,
    contingencies: {},
  });
  if (!res.ok) throw new Error(`proposal refused: ${res.rejection.message}`);
  return r.kernel.world.decisions.proposals.at(-1)!.id;
};

const commit = (
  r: Runner,
  by: string,
  proposalId: string,
  extra: Record<string, unknown> = {},
) =>
  r.run({
    type: 'CommitDraftBoardProposal',
    actingPersonId: by,
    proposalId,
    expectedRevision: 1,
    rationale: { note: 'board' },
    ...extra,
  });

/** Gets a belief into the world by actually scouting: claim, question, work, report. */
const beliefAbout = (
  r: Runner,
  org: string,
  scout: string,
  player: string,
  pick: string,
): string => {
  const a = recordObservation(r, {
    org,
    by: scout,
    player,
    dimension: 'burst',
    signal: 'positive',
    family: `f-${org}-${player}-1`,
  });
  const b = recordObservation(r, {
    org,
    by: scout,
    player,
    dimension: 'processing',
    signal: 'positive',
    family: `f-${org}-${player}-2`,
  });
  const report = scoutOnce(r, org, scout, [a, b], {
    playerId: player,
    questionKey: `board_${player}`,
    decisionContext: { kind: 'draft_selection', pickId: pick },
  });
  return report.beliefId;
};

const world = () => {
  const r = runnerFor(newPackageCKernel());
  const nf1 = beliefAbout(r, NF.org, NF_SCOUT, PROSPECT, 'pick-2027-r1-s4');
  const nf2 = beliefAbout(r, NF.org, NF_SCOUT, SECOND, 'pick-2027-r1-s4');
  return { r, nf1, nf2 };
};

describe('committing a draft board', () => {
  it('records tiers, ties and need as an immutable revision through the shared gate', () => {
    const { r, nf1, nf2 } = world();
    const terms = board(r, [
      {
        tier: 2,
        entries: [entry(SECOND, [nf2], { needPriority: 'high' })],
      },
      {
        tier: 1,
        entries: [
          entry(PROSPECT, [nf1], {
            withinTierOrder: 1,
            roleProjection: 'slot corner',
          }),
        ],
      },
    ]);
    const id = propose(r, NF.org, NF.gm, terms);
    const res = okResult(commit(r, NF.gm, id));
    expect(res.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['DraftBoardCommitted']),
    );
    const w = r.kernel.world;
    const b = w.draft.boards[0]!;
    expect(b).toMatchObject({
      organizationId: NF.org,
      revision: 1,
      supersedesBoardRevisionId: null,
      organizationProposalId: id,
    });
    // Normalized: tiers ascending, whatever order they were proposed in.
    expect(b.tiers.map((t) => t.tier)).toEqual([1, 2]);
    expect(b.tiers[0]!.entries[0]).toMatchObject({
      playerId: PROSPECT,
      withinTierOrder: 1,
      needPriority: 'normal',
    });
    expect(w.decisions.receipts.length).toBeGreaterThan(0);
  });

  it('is blocked atomically until the proposal is authorized', () => {
    const { r, nf1 } = world();
    const id = propose(
      r,
      NF.org,
      NF.gm,
      board(r, [{ tier: 1, entries: [entry(PROSPECT, [nf1])] }]),
      [NF.owner],
    );
    const before = snapshotOf(r.kernel);
    expect(commit(r, NF.gm, id).ok).toBe(false);
    expect(snapshotOf(r.kernel)).toEqual(before);
    expect(r.kernel.world.draft.boards).toHaveLength(0);
  });

  it('allows genuine ties but not a repeated order, a repeated prospect or a bad tier', () => {
    const { r, nf1, nf2 } = world();
    const tryBoard = (tiers: unknown[]) =>
      commit(r, NF.gm, propose(r, NF.org, NF.gm, board(r, tiers)));
    expect(
      messageOf(
        tryBoard([
          {
            tier: 1,
            entries: [
              entry(PROSPECT, [nf1], { withinTierOrder: 1 }),
              entry(SECOND, [nf2], { withinTierOrder: 1 }),
            ],
          },
        ]),
      ),
    ).toContain('use null for a tie');
    expect(
      messageOf(
        tryBoard([
          { tier: 1, entries: [entry(PROSPECT, [nf1])] },
          { tier: 2, entries: [entry(PROSPECT, [nf1])] },
        ]),
      ),
    ).toContain('twice');
    expect(
      messageOf(tryBoard([{ tier: 0, entries: [entry(PROSPECT, [nf1])] }])),
    ).toContain('tier must be');
    expect(
      messageOf(
        tryBoard([
          { tier: 1, entries: [entry(PROSPECT, [nf1])] },
          { tier: 1, entries: [entry(SECOND, [nf2])] },
        ]),
      ),
    ).toContain('appears twice');
    expect(r.kernel.world.draft.boards).toHaveLength(0);
    // A real tie: both unordered.
    okResult(
      tryBoard([
        { tier: 1, entries: [entry(PROSPECT, [nf1]), entry(SECOND, [nf2])] },
      ]),
    );
    expect(
      r.kernel.world.draft.boards[0]!.tiers[0]!.entries.map(
        (e) => e.withinTierOrder,
      ),
    ).toEqual([null, null]);
  });

  it('refuses ineligible prospects and entries with no basis', () => {
    const { r, nf1 } = world();
    const tryBoard = (tiers: unknown[]) =>
      messageOf(commit(r, NF.gm, propose(r, NF.org, NF.gm, board(r, tiers))));
    expect(
      tryBoard([{ tier: 1, entries: [entry('player-fa-01', [nf1])] }]),
    ).toContain('not eligible');
    expect(tryBoard([{ tier: 1, entries: [entry(PROSPECT, [])] }])).toContain(
      'needs a belief or a noted claim',
    );
  });

  it('accepts only fields that are part of a board: no rating, grade or capabilities', () => {
    const { r, nf1 } = world();
    for (const extra of [
      { overall: 91 },
      { capabilities: [{ key: 'burst', valueBp: 9000 }] },
      { grade: 'A' },
    ]) {
      const res = commit(
        r,
        NF.gm,
        propose(
          r,
          NF.org,
          NF.gm,
          board(r, [{ tier: 1, entries: [entry(PROSPECT, [nf1], extra)] }]),
        ),
      );
      expect(messageOf(res)).toContain('no other field');
    }
    expect(r.kernel.world.draft.boards).toHaveLength(0);
  });
});

describe('knowledge the board may cite', () => {
  it('refuses another organization’s belief, a hidden claim or a belief about someone else', () => {
    const { r, nf1, nf2 } = world();
    const ebBelief = beliefAbout(r, EB.org, EB_SCOUT, PROSPECT, EB_PICK);
    const tryBoard = (e: ReturnType<typeof entry>) =>
      messageOf(
        commit(
          r,
          NF.gm,
          propose(r, NF.org, NF.gm, board(r, [{ tier: 1, entries: [e] }])),
        ),
      );
    expect(tryBoard(entry(PROSPECT, [ebBelief]))).toContain('not available');
    expect(tryBoard(entry(PROSPECT, [nf2]))).toContain('is not about');
    const hidden = recordObservation(r, {
      org: EB.org,
      by: EB_SCOUT,
      dimension: 'hands',
      signal: 'positive',
      family: 'f-eb-secret',
    });
    expect(
      tryBoard(entry(PROSPECT, [nf1], { noteClaimIds: [hidden] })),
    ).toContain('not available');
    expect(r.kernel.world.draft.boards).toHaveLength(0);
  });
});

describe('revisions link and never overwrite', () => {
  const first = () => {
    const { r, nf1, nf2 } = world();
    const terms = board(r, [
      { tier: 1, entries: [entry(PROSPECT, [nf1])] },
      { tier: 2, entries: [entry(SECOND, [nf2])] },
    ]);
    okResult(commit(r, NF.gm, propose(r, NF.org, NF.gm, terms)));
    return { r, nf1, nf2 };
  };

  it('needs the revision it replaces to be named', () => {
    const { r, nf1, nf2 } = first();
    const next = board(r, [
      { tier: 1, entries: [entry(PROSPECT, [nf1]), entry(SECOND, [nf2])] },
    ]);
    const id = propose(r, NF.org, NF.gm, next);
    expect(messageOf(commit(r, NF.gm, id))).toContain('revise');
    expect(
      messageOf(
        commit(r, NF.gm, id, { supersedesBoardRevisionId: 'rec-000001' }),
      ),
    ).toContain('revise');
    const prior = r.kernel.world.draft.boards[0]!;
    okResult(commit(r, NF.gm, id, { supersedesBoardRevisionId: prior.id }));
    const boards = r.kernel.world.draft.boards;
    expect(boards).toHaveLength(2);
    const revised = boards.find((b) => b.revision === 2)!;
    expect(revised.supersedesBoardRevisionId).toBe(prior.id);
    // The earlier revision is untouched.
    expect(boards.find((b) => b.id === prior.id)).toEqual(prior);
  });

  it('changes need without rewriting the tier, the belief or the evaluation', () => {
    const { r, nf1, nf2 } = first();
    const beliefsBefore = JSON.stringify(r.kernel.world.information.beliefs);
    const next = board(r, [
      {
        tier: 1,
        entries: [entry(PROSPECT, [nf1], { needPriority: 'must_address' })],
      },
      { tier: 2, entries: [entry(SECOND, [nf2])] },
    ]);
    const prior = r.kernel.world.draft.boards[0]!;
    okResult(
      commit(r, NF.gm, propose(r, NF.org, NF.gm, next), {
        supersedesBoardRevisionId: prior.id,
      }),
    );
    const revised = r.kernel.world.draft.boards.find((b) => b.revision === 2)!;
    const change = describeBoardChange(prior, revised);
    expect(change).toEqual({
      added: [],
      removed: [],
      tierChanged: [],
      orderChanged: [],
      needChanged: [PROSPECT],
      basisChanged: [],
    });
    expect(revised.tiers[0]!.entries[0]!.beliefIds).toEqual(
      prior.tiers[0]!.entries[0]!.beliefIds,
    );
    expect(JSON.stringify(r.kernel.world.information.beliefs)).toBe(
      beliefsBefore,
    );
  });

  it('reports a genuine re-evaluation as a tier change, separately from need', () => {
    const { r, nf1, nf2 } = first();
    const next = board(r, [
      { tier: 1, entries: [entry(SECOND, [nf2])] },
      { tier: 3, entries: [entry(PROSPECT, [nf1])] },
    ]);
    const prior = r.kernel.world.draft.boards[0]!;
    okResult(
      commit(r, NF.gm, propose(r, NF.org, NF.gm, next), {
        supersedesBoardRevisionId: prior.id,
      }),
    );
    const change = describeBoardChange(
      prior,
      r.kernel.world.draft.boards.find((b) => b.revision === 2)!,
    );
    expect(change.tierChanged).toEqual([PROSPECT, SECOND].sort());
    expect(change.needChanged).toEqual([]);
  });
});

describe('boards are organizational beliefs, not universal truth', () => {
  it('two clubs board the same prospect differently from their own evidence, privately', () => {
    const { r, nf1 } = world();
    const ebBelief = beliefAbout(r, EB.org, EB_SCOUT, PROSPECT, EB_PICK);
    okResult(
      commit(
        r,
        NF.gm,
        propose(
          r,
          NF.org,
          NF.gm,
          board(r, [{ tier: 1, entries: [entry(PROSPECT, [nf1])] }]),
        ),
      ),
    );
    okResult(
      commit(
        r,
        EB.gm,
        propose(
          r,
          EB.org,
          EB.gm,
          board(r, [
            {
              tier: 4,
              entries: [entry(PROSPECT, [ebBelief], { needPriority: 'low' })],
            },
          ]),
        ),
      ),
    );
    const w = r.kernel.world;
    const nf = w.draft.boards.find((b) => b.organizationId === NF.org)!;
    const eb = w.draft.boards.find((b) => b.organizationId === EB.org)!;
    expect(nf.tiers[0]!.tier).toBe(1);
    expect(eb.tiers[0]!.tier).toBe(4);
    expect(nf.revision).toBe(1);
    expect(eb.revision).toBe(1);
    // Each sees only its own.
    const nfView = buildDraftBoardView(w, entityId(NF.org), entityId(NF_SCOUT));
    expect(nfView.boards.map((b) => b.id)).toEqual([nf.id]);
    const rival = buildDraftBoardView(w, entityId(EB.org), entityId(NF_SCOUT));
    expect(rival.boards).toHaveLength(0);
    expect(codeOf(commit(r, NF.gm, 'rec-999999'))).toBe('INVALID_PAYLOAD');
  });
});

describe('boards never reach latent player truth', () => {
  it('the board module does not touch capability data', () => {
    const text = readFileSync(
      new URL('../src/draftBoardCommands.ts', import.meta.url),
      'utf8',
    );
    expect(text).not.toMatch(
      /\.capabilities|PlayerCapability|valueBp|PlayerRecord/,
    );
  });
});
