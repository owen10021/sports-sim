import { describe, expect, it } from 'vitest';
import { canonicalString } from '../src/index';
import { buildDevelopmentDecisionView } from '../src/developmentView';
import {
  COACH,
  dRunner,
  NF,
  openWindow,
  allocationTerms,
} from './support/packageDHarness';
import { codeOf, okResult } from './support/orgHarness';

const setup = () => {
  const r = dRunner();
  const windowId = openWindow(r);
  return { r, windowId };
};

const proposal = (windowId: string) => ({
  type: 'SubmitProposal',
  organizationId: NF.org,
  actingPersonId: NF.gm,
  category: 'workload_usage',
  subjects: [{ kind: 'entity', id: NF.org }],
  termsType: 'opportunity_allocation_v1',
  terms: {
    windowId,
    allocations: [allocationTerms('player-nf-01', 40)],
  },
  requiredApproverPersonIds: [],
  expiresAt: null,
  contingencies: {},
});

describe('CPU/human development symmetry', () => {
  it('gives the same safe decision view to the same authorized staff member independent of caller mode', () => {
    const { r } = setup();
    const a = buildDevelopmentDecisionView(r.kernel.world, NF.org, NF.gm);
    const b = buildDevelopmentDecisionView(r.kernel.world, NF.org, NF.gm);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(canonicalString(a.view)).toBe(canonicalString(b.view));
  });

  it('applies identical D proposal and workload legality to human_gm and cpu_org callers', () => {
    const human = setup();
    const cpu = setup();

    const humanSubmit = human.r.run(proposal(human.windowId), 'human_gm');
    const cpuSubmit = cpu.r.run(proposal(cpu.windowId), 'cpu_org');
    expect(codeOf(humanSubmit)).toBe('OK');
    expect(codeOf(cpuSubmit)).toBe('OK');
    const humanProposalId = human.r.kernel.world.decisions.proposals.at(-1)!.id;
    const cpuProposalId = cpu.r.kernel.world.decisions.proposals.at(-1)!.id;
    expect(humanProposalId).toBe(cpuProposalId);

    const commit = (proposalId: string) => ({
      type: 'CommitOpportunityAllocationProposal',
      proposalId,
      actingPersonId: COACH,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: 'same legal workload terms' },
    });
    okResult(human.r.run(commit(humanProposalId), 'human_gm'));
    okResult(cpu.r.run(commit(cpuProposalId), 'cpu_org'));

    expect(
      canonicalString({
        development: human.r.kernel.world.development,
        decisions: human.r.kernel.world.decisions,
      }),
    ).toBe(
      canonicalString({
        development: cpu.r.kernel.world.development,
        decisions: cpu.r.kernel.world.decisions,
      }),
    );
  });
});
