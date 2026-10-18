import type { EventSpec } from './commandRouter';
import { resolvePassiveDevelopment } from './developmentPassive';
import {
  DevelopmentResolutionError,
  resolveDevelopmentWindow,
} from './developmentResolution';
import type { DeterministicRng } from './rng';
import type { FootballWorld } from './world';
import type { LeagueRulesetManifest } from './ruleset';
import { SimDate } from './simDate';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** One logical day, called after its legacy day roll. Never creates opportunity or intent. */
export const advanceDevelopmentForDay = (
  input: FootballWorld,
  ruleset: LeagueRulesetManifest,
  date: string,
  rng: DeterministicRng,
): {
  readonly world: FootballWorld;
  readonly eventSpecs: readonly EventSpec[];
  readonly rng: DeterministicRng;
} => {
  if (ruleset.rules.development === undefined)
    return { world: input, eventSpecs: [], rng };
  if (SimDate.parse(date).daysSince(SimDate.parse(input.simDate)) !== 1)
    throw new DevelopmentResolutionError(
      'development calendar requires the next logical day',
    );
  const passive = resolvePassiveDevelopment(
    { ...input, rng: rng.snapshot() },
    ruleset,
    input.simDate,
    date,
  );
  let world = { ...passive.world, simDate: date };
  const events: EventSpec[] = [...passive.eventSpecs];
  const due = world.development.opportunityWindows
    .filter(
      (w) =>
        w.status === 'open' &&
        w.toDate <= date &&
        world.development.opportunityAllocations.some(
          (a) => a.windowId === w.id,
        ),
    )
    .sort(
      (a, b) =>
        byText(a.toDate, b.toDate) ||
        byText(a.organizationId, b.organizationId) ||
        byText(a.id, b.id),
    );
  for (const window of due) {
    const resolved = resolveDevelopmentWindow(world, ruleset, window.id, rng);
    world = resolved.world;
    events.push(...resolved.eventSpecs);
  }
  return { world, eventSpecs: events, rng };
};
