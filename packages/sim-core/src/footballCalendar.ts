import type { FootballFixture } from './football';
import type { FootballWorld } from './world';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The earliest unresolved fixture that time may not move past: a scheduled fixture dated
 * strictly before `targetDate`. Advancing exactly to a fixture's date is legal (the game is
 * then due); advancing beyond it is not until the game has been resolved. Pure; consumes no
 * randomness. Worlds without fixtures (Packages A-D) always return `null`.
 */
export const nextBlockingFootballFixture = (
  world: Pick<FootballWorld, 'football'>,
  targetDate: string,
): FootballFixture | null =>
  world.football.fixtures
    .filter((f) => f.status === 'scheduled' && f.fixtureDate < targetDate)
    .sort(
      (a, b) => byText(a.fixtureDate, b.fixtureDate) || byText(a.id, b.id),
    )[0] ?? null;

/**
 * Every reason this fixture cannot be resolved today. Takes the world and the fixture id
 * only, so actor identity can never influence the result. A due game needs the fixture to be
 * scheduled, dated today, and exactly one committed game plan for each club.
 */
export const scheduledGameProblems = (
  world: Pick<FootballWorld, 'football' | 'simDate'>,
  fixtureId: string,
): readonly string[] => {
  const fixture = world.football.fixtures.find((f) => f.id === fixtureId);
  if (fixture === undefined) return [`${fixtureId} is not a fixture`];
  const problems: string[] = [];
  if (fixture.status !== 'scheduled')
    problems.push(`fixture ${fixtureId} is already final`);
  else if (world.simDate < fixture.fixtureDate)
    problems.push(
      `fixture ${fixtureId} is not due until ${fixture.fixtureDate}`,
    );
  else if (world.simDate > fixture.fixtureDate)
    problems.push(
      `fixture ${fixtureId} is past its date ${fixture.fixtureDate}`,
    );
  for (const org of [fixture.homeOrganizationId, fixture.awayOrganizationId]) {
    const plans = world.football.gamePlans.filter(
      (g) => g.fixtureId === fixtureId && g.organizationId === org,
    );
    if (plans.length !== 1)
      problems.push(
        `${org} must have exactly one committed game plan for ${fixtureId}, has ${plans.length}`,
      );
  }
  return problems;
};
