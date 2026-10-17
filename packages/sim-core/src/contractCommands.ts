import type { CommandPayloadBase } from './audit';
import type { EventSpec, RouteContext, RouteOutcome } from './commandRouter';
import { bad, isFailure, mintRecordId, spec, type Cmd } from './commandSupport';
import { parseReleaseCommand, terminateAgreement } from './contractLifecycle';
import { openWaiver } from './waiverCommands';
import { commitAuthorizedDomainChange } from './transactionCommit';

export const CONTRACT_COMMAND_TYPES = ['CommitReleaseProposal'] as const;
export type ContractCommandType = (typeof CONTRACT_COMMAND_TYPES)[number];

export const RELEASE_TERMS_TYPE = 'release_player_v1';

/**
 * Releases a player. Under a ruleset that waives every released player, an active or
 * reserve player enters the waiver path (the contract and rights stay with the club until
 * the waiver resolves). A practice-squad player, or any player under a no-waiver ruleset,
 * has the contract terminated immediately and becomes a free agent once the right ends.
 */
const routeRelease = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  const target = parseReleaseCommand(ctx, c, RELEASE_TERMS_TYPE, 'releases');
  if (isFailure(target)) return target;
  const { world } = ctx;
  const { proposal, by, tx, membership, agreement, today } = target;

  const needsWaivers =
    tx.waivers.releasedPlayerWaiverPolicy === 'all' &&
    membership.status !== 'practice_squad';
  if (needsWaivers) return openWaiver(ctx, target, RELEASE_TERMS_TYPE);

  const minted = mintRecordId(world);
  const result = terminateAgreement({
    world,
    agreement,
    date: today,
    reason: 'release',
    tx,
    endMembershipId: membership.id,
    terminationId: minted.id,
  });
  const termination = result.termination;
  const events: EventSpec[] = [
    spec('ContractTerminated', {
      terminationId: termination.id,
      agreementId: agreement.id,
      organizationId: target.organizationId,
      playerId: target.playerId,
      reason: 'release',
      terminatedAt: today,
      deadCapBySeason: termination.deadCapBySeason.map((x) => ({ ...x })),
      guaranteedCashDue: termination.guaranteedCashDue,
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
    }),
    spec('PlayerReleased', {
      organizationId: target.organizationId,
      playerId: target.playerId,
      endedMembershipId: membership.id,
      endedRightsId: result.endedRightsId,
      terminationId: termination.id,
    }),
  ];
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...world,
      contracts: result.contracts,
      roster: result.roster,
      nextIds: { ...world.nextIds, record: minted.next },
    },
    domainEvents: events,
    requests: [
      {
        organizationId: target.organizationId,
        actorPersonId: by,
        proposalId: proposal.id,
        expectedRevision: proposal.revision,
        expectedCategory: 'roster',
        executedTerms: {
          termsType: RELEASE_TERMS_TYPE,
          terms: { playerId: target.playerId },
        },
        beliefIds: c.beliefIds as string[],
        evidenceClaimIds: c.evidenceClaimIds as string[],
        rationale: c.rationale as string,
        protectedChange: {
          subject: { playerId: target.playerId },
          change: { kind: 'release' },
        },
      },
    ],
  });
};

export const routeContractCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: ContractCommandType },
): RouteOutcome => {
  const c = command as Cmd;
  switch (command.type) {
    case 'CommitReleaseProposal':
      return routeRelease(ctx, c);
    default: {
      const unreachable: never = command.type;
      void bad;
      throw new Error(`unroutable contract command: ${String(unreachable)}`);
    }
  }
};
