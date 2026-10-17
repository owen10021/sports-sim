import { isValidId } from './ids';
import { ManifestFormatError, asString } from './provenance';
import { SimDate } from './simDate';

/** Shared, pure seed-field parsers (used by the organization and Package C seed blocks). */

export const parseSeedId = (value: unknown, what: string): string => {
  const id = asString(value, what, 128);
  if (!isValidId(id))
    throw new ManifestFormatError(`${what} is not a valid id`);
  return id;
};

export const parseSeedDate = (value: unknown, what: string): string => {
  const date = asString(value, what, 10);
  if (!SimDate.isValidISO(date))
    throw new ManifestFormatError(`${what} must be a valid YYYY-MM-DD date`);
  return date;
};

export const parseSeedInterval = (
  from: unknown,
  until: unknown,
  what: string,
): { from: string; until: string | null } => {
  const start = parseSeedDate(from, `${what} start`);
  const end = until === null ? null : parseSeedDate(until, `${what} end`);
  if (end !== null && end < start)
    throw new ManifestFormatError(`${what}: end date precedes start date`);
  return { from: start, until: end };
};
