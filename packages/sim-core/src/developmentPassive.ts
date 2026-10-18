import { mintRecordIds, byId, spec } from './commandSupport';
import type { EventSpec } from './commandRouter';
import type { DevelopmentEvent } from './development';
import { developmentProfileFor } from './development';
import {
  familyOfCapability,
  requireDevelopmentRules,
  type CapabilityFamilyRule,
} from './developmentRules';
import { applyCapabilityDeltas, type CapabilityDelta } from './roster';
import type { FootballWorld } from './world';
import type { LeagueRulesetManifest } from './ruleset';
import { SimDate } from './simDate';

const bounded = (n: number): number => Math.max(0, Math.min(10000, n));
/** Synthetic integrated family decline. Differences conserve fractional daily aging. */
const cumulativeDecline = (
  ageDays: number,
  family: CapabilityFamilyRule,
): number => {
  const over = Math.max(0, ageDays - family.declineOnsetAgeDays);
  return Math.floor(
    (family.declineScaleBpPerYear * over) / 365 +
      (family.declineScaleBpPerYear * over * over) / (365 * 7300),
  );
};

/**
 * Pure biological time, independent of employment, opportunity, teachers and RNG.
 * Iterating logical days yields the same private history for coarse and fine calls.
 * Clock records live in the existing private checkpoint ledger; empty legacy D domains
 * and accepted A/B/C fingerprints keep their existing shape.
 */
export const resolvePassiveDevelopment = (
  input: FootballWorld,
  ruleset: LeagueRulesetManifest,
  fromDate: string,
  toDate: string,
): {
  readonly world: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
} => {
  const rules = requireDevelopmentRules(ruleset);
  const last = input.development.checkpoints
    .filter((c) => c.kind === 'passive')
    .map((c) => c.toDate)
    .sort()
    .at(-1);
  if (last !== undefined && toDate < last)
    throw new Error('passive development time cannot rewind');
  if (last !== undefined && fromDate > last)
    throw new Error('passive development interval has a gap');
  let world = input;
  let date = last ?? fromDate;
  const specs: EventSpec[] = [];
  while (date < toDate) {
    const next = SimDate.parse(date).addDays(1).toISO();
    const proposed: Omit<DevelopmentEvent, 'id' | 'checkpointId'>[] = [];
    const deltas: CapabilityDelta[] = [];
    for (const player of [...world.roster.players].sort((a, b) =>
      a.personId < b.personId ? -1 : 1,
    )) {
      for (const cap of [...player.capabilities].sort((a, b) =>
        a.key < b.key ? -1 : 1,
      )) {
        const family = familyOfCapability(rules, cap.key);
        if (family === undefined) continue;
        const birth = SimDate.parse(player.birthDate);
        const decline =
          cumulativeDecline(SimDate.parse(next).daysSince(birth), family) -
          cumulativeDecline(SimDate.parse(date).daysSince(birth), family);
        const after = Math.max(0, cap.valueBp - decline);
        if (after === cap.valueBp) continue;
        deltas.push({
          playerId: player.personId,
          capabilityKey: cap.key,
          deltaBp: after - cap.valueBp,
        });
        proposed.push({
          playerId: player.personId,
          occurredAt: next,
          kind: 'passive_aging',
          capabilityKeys: [cap.key],
          responsibilityKeys: [],
          beforeBp: cap.valueBp,
          afterBp: after,
          causalRecordIds: [],
        });
      }
    }
    const readiness = world.development.readiness.map((r) => {
      if (r.updatedAt > next) throw new Error('readiness time cannot rewind');
      const recoveryBp =
        developmentProfileFor(world.development, r.playerId)?.recoveryBp ?? 0;
      const recovery = Math.floor(
        (((rules.recoveryUnitsPerDay * 10000) /
          rules.maxPlayerLoadUnitsPerCheckpoint) *
          recoveryBp) /
          10000,
      );
      const fatigue = bounded(r.acuteFatigueBp - recovery);
      const day = SimDate.parse(next).epochDay;
      const decay =
        Math.floor((rules.conditioningScaleBp * day) / 365) -
        Math.floor((rules.conditioningScaleBp * (day - 1)) / 365);
      const conditioning = bounded(r.conditioningBp - decay);
      proposed.push({
        playerId: r.playerId,
        occurredAt: next,
        kind: 'passive_fatigue',
        capabilityKeys: [],
        responsibilityKeys: [],
        beforeBp: r.acuteFatigueBp,
        afterBp: fatigue,
        causalRecordIds: [],
      });
      proposed.push({
        playerId: r.playerId,
        occurredAt: next,
        kind: 'passive_conditioning',
        capabilityKeys: [],
        responsibilityKeys: [],
        beforeBp: r.conditioningBp,
        afterBp: conditioning,
        causalRecordIds: [],
      });
      return {
        ...r,
        conditioningBp: conditioning,
        acuteFatigueBp: fatigue,
        accumulatedLoadUnits: Math.max(
          0,
          r.accumulatedLoadUnits -
            Math.floor((rules.recoveryUnitsPerDay * recoveryBp) / 10000),
        ),
        updatedAt: next,
      };
    });
    const minted = mintRecordIds(world, proposed.length + 1);
    const checkpointId = minted.ids[0]!;
    const events = proposed.map((e, i) => ({
      ...e,
      id: minted.ids[i + 1]!,
      checkpointId,
    }));
    world = {
      ...world,
      roster: applyCapabilityDeltas(world.roster, deltas),
      nextIds: { ...world.nextIds, record: minted.next },
      development: {
        ...world.development,
        readiness,
        checkpoints: [
          ...world.development.checkpoints,
          {
            id: checkpointId,
            kind: 'passive' as const,
            organizationId: null,
            windowId: null,
            fromDate: date,
            toDate: next,
            resolvedAt: next,
            allocationIds: [],
            rngDrawStart: world.rng.draws,
            rngDrawCount: 0,
            eventIds: events.map((e) => e.id),
          },
        ].sort(byId),
        events: [...world.development.events, ...events].sort(byId),
      },
    };
    specs.push(
      spec('PassiveDevelopmentAdvanced', {
        checkpointId,
        fromDate: date,
        toDate: next,
        developmentEventIds: events.map((e) => e.id),
      }),
    );
    date = next;
  }
  return { world, eventSpecs: specs };
};
