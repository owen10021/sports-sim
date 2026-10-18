import type { CommandPayloadBase } from './audit';
import type { RouteContext, RouteOutcome } from './commandRouter';
import {
  bad,
  byId,
  isFailure,
  isPlainObject,
  mintRecordIds,
  parseActingPerson,
  spec,
  type Cmd,
} from './commandSupport';
import { latestProposal } from './decisions';
import type { GameDayDesignation } from './football';
import {
  MissingFootballRulesError,
  requireFootballRules,
} from './footballRules';
import {
  GAME_DAY_ACTIVATION_TERMS_TYPE,
  gameDayProblems,
  parseGameDayTerms,
} from './gameDay';
import { entityId, isValidId, recordId } from './ids';
import { commitAuthorizedDomainChange } from './transactionCommit';

export const FOOTBALL_COMMAND_TYPES = [
  'CommitGameDayActivationProposal',
] as const;
export type FootballCommandType = (typeof FOOTBALL_COMMAND_TYPES)[number];

/**
 * Commits an authorized game-day activation proposal: each named player becomes an `active`
 * or `inactive` designation for one fixture. Roster membership, rights and contracts are only
 * read. The shared Package B/C gate re-derives the proposal, exact revision, terms hash and
 * the actor's execute right; the actor kind confers nothing.
 */
const routeCommitActivation = (ctx: RouteContext, c: Cmd): RouteOutcome => {
  let rules;
  try {
    rules = requireFootballRules(ctx.ruleset);
  } catch (e) {
    if (e instanceof MissingFootballRulesError)
      return bad('the ruleset has no football rules');
    throw e;
  }
  const actor = parseActingPerson(ctx, c);
  if (isFailure(actor)) return actor;
  if (!isValidId(c.proposalId)) return bad('proposalId must be valid');
  const p = latestProposal(ctx.world.decisions, c.proposalId);
  if (p === undefined || p.state !== 'authorized')
    return bad('proposal must exist and be authorized');
  if (
    p.category !== 'game_day_activation' ||
    p.termsType !== GAME_DAY_ACTIVATION_TERMS_TYPE
  )
    return bad(
      `proposal must be game_day_activation ${GAME_DAY_ACTIVATION_TERMS_TYPE}`,
    );
  if (c.expectedRevision !== p.revision)
    return bad('proposal revision is stale');
  if (
    !Array.isArray(c.beliefIds) ||
    !Array.isArray(c.evidenceClaimIds) ||
    !isPlainObject(c.rationale)
  )
    return bad('beliefIds, evidenceClaimIds and rationale are required');

  const parsed = parseGameDayTerms(p.terms);
  if (typeof parsed === 'string') return bad(parsed);
  if (parsed.organizationId !== p.organizationId)
    return bad('proposal belongs to a different organization');
  const fixture = ctx.world.football.fixtures.find(
    (f) => f.id === parsed.fixtureId,
  );
  if (fixture === undefined) return bad('fixtureId does not name a fixture');
  const problems = gameDayProblems(
    ctx.world,
    rules,
    fixture,
    parsed.organizationId,
    parsed.designations,
  );
  if (problems.length > 0) return bad(problems.join('; '));

  const minted = mintRecordIds(ctx.world, parsed.designations.length);
  const designations: GameDayDesignation[] = parsed.designations.map(
    (d, i) => ({
      id: minted.ids[i]!,
      fixtureId: fixture.id,
      organizationId: p.organizationId,
      playerId: entityId(d.playerId),
      status: d.status,
      unitKey: d.unitKey,
      roleKey: d.roleKey,
      depthOrder: d.depthOrder,
      sourceProposalId: recordId(p.id),
      committedAt: ctx.world.simDate,
    }),
  );
  return commitAuthorizedDomainChange(ctx, {
    nextWorld: {
      ...ctx.world,
      football: {
        ...ctx.world.football,
        designations: [
          ...ctx.world.football.designations,
          ...designations,
        ].sort(byId),
      },
      nextIds: { ...ctx.world.nextIds, record: minted.next },
    },
    domainEvents: [
      spec('GameDayActivationCommitted', {
        fixtureId: fixture.id,
        organizationId: p.organizationId,
        designationIds: designations.map((d) => d.id),
        sourceProposalId: p.id,
      }),
    ],
    requests: [
      {
        organizationId: p.organizationId,
        actorPersonId: actor,
        proposalId: p.id,
        expectedRevision: p.revision,
        expectedCategory: 'game_day_activation',
        executedTerms: {
          termsType: GAME_DAY_ACTIVATION_TERMS_TYPE,
          terms: p.terms,
        },
        beliefIds: c.beliefIds as string[],
        evidenceClaimIds: c.evidenceClaimIds as string[],
        rationale: c.rationale,
        protectedChange: {
          subject: { kind: 'entity', id: p.organizationId },
          change: { kind: 'game_day_activation', fixtureId: fixture.id },
        },
      },
    ],
  });
};

export const routeFootballCommand = (
  ctx: RouteContext,
  command: CommandPayloadBase & { readonly type: FootballCommandType },
): RouteOutcome => {
  switch (command.type) {
    case 'CommitGameDayActivationProposal':
      return routeCommitActivation(ctx, command as Cmd);
    default: {
      const unreachable: never = command.type;
      throw new Error(`unroutable football command: ${String(unreachable)}`);
    }
  }
};
