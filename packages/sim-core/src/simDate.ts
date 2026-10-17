/**
 * Timezone-free calendar date value object.
 *
 * Simulation time never touches the device clock or `Date`. Dates are proleptic
 * Gregorian days; arithmetic uses integer civil-calendar algorithms
 * (H. Hinnant, "days_from_civil" / "civil_from_days") so every runtime agrees.
 */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeap = (y: number): boolean =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const daysInMonth = (y: number, m: number): number =>
  m === 2 && isLeap(y) ? 29 : (DAYS_IN_MONTH[m - 1] as number);

const daysFromCivil = (yIn: number, m: number, d: number): number => {
  const y = m <= 2 ? yIn - 1 : yIn;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
};

const civilFromDays = (zIn: number): [number, number, number] => {
  const z = zIn + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe -
      Math.floor(doe / 1460) +
      Math.floor(doe / 36524) -
      Math.floor(doe / 146096)) /
      365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return [y, m, d];
};

const pad = (n: number, width: number): string =>
  String(n).padStart(width, '0');

export class SimDate {
  /** Days since 1970-01-01 (proleptic Gregorian). */
  readonly epochDay: number;
  readonly year: number;
  readonly month: number;
  readonly day: number;

  private constructor(
    epochDay: number,
    year: number,
    month: number,
    day: number,
  ) {
    this.epochDay = epochDay;
    this.year = year;
    this.month = month;
    this.day = day;
    Object.freeze(this);
  }

  /** Parse strict `YYYY-MM-DD`. Anything else (times, zones, short forms) throws. */
  static parse(iso: string): SimDate {
    const match = typeof iso === 'string' ? ISO_DATE.exec(iso) : null;
    if (!match)
      throw new RangeError(
        `Invalid SimDate "${String(iso)}": expected YYYY-MM-DD`,
      );
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > daysInMonth(year, month)
    ) {
      throw new RangeError(
        `Invalid SimDate "${iso}": not a real calendar date`,
      );
    }
    return new SimDate(daysFromCivil(year, month, day), year, month, day);
  }

  static fromEpochDay(epochDay: number): SimDate {
    if (!Number.isSafeInteger(epochDay))
      throw new RangeError('epochDay must be a safe integer');
    const [y, m, d] = civilFromDays(epochDay);
    if (y < 1 || y > 9999)
      throw new RangeError('SimDate out of supported range (years 1-9999)');
    return new SimDate(epochDay, y, m, d);
  }

  static isValidISO(iso: unknown): iso is string {
    try {
      SimDate.parse(iso as string);
      return true;
    } catch {
      return false;
    }
  }

  addDays(n: number): SimDate {
    if (!Number.isSafeInteger(n))
      throw new RangeError('addDays requires a safe integer');
    return SimDate.fromEpochDay(this.epochDay + n);
  }

  daysSince(other: SimDate): number {
    return this.epochDay - other.epochDay;
  }

  compare(other: SimDate): number {
    return this.epochDay - other.epochDay;
  }

  equals(other: SimDate): boolean {
    return this.epochDay === other.epochDay;
  }

  toISO(): string {
    return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
  }

  toString(): string {
    return this.toISO();
  }
}
