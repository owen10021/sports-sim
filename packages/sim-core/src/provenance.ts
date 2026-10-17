import { SimDate } from './simDate';

/** Authoritative on-disk/package schema version. Unsupported versions fail closed. */
export const SCHEMA_VERSION = 1 as const;

export type ValidationStatus =
  'synthetic' | 'verified' | 'unverified' | 'conflicted';
export const VALIDATION_STATUSES: readonly ValidationStatus[] = [
  'synthetic',
  'verified',
  'unverified',
  'conflicted',
];
/** Only these may seed a world: synthetic fixtures or reconciled/verified sources. */
export const ACCEPTED_FOR_WORLD_CREATION: readonly ValidationStatus[] = [
  'synthetic',
  'verified',
];

export type SourceKind = 'synthetic' | 'licensed' | 'public' | 'derived';
export const SOURCE_KINDS: readonly SourceKind[] = [
  'synthetic',
  'licensed',
  'public',
  'derived',
];

export interface SourceProvenance {
  readonly sourceId: string;
  readonly sourceKind: SourceKind;
  /** UTC instant the source was retrieved, `YYYY-MM-DDTHH:MM:SSZ` (data, not a clock read). */
  readonly retrievedAt: string;
  /** Simulation-calendar date the data is effective/as-of (`YYYY-MM-DD`). */
  readonly effectiveAsOf: string;
  readonly validationStatus: ValidationStatus;
  readonly note?: string;
}

export interface ValidationIssue {
  readonly code: string;
  readonly message: string;
}
export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

/** Package/manifest is structurally invalid. */
export class ManifestFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestFormatError';
  }
}

/** Embedded content hash does not match the canonical body: the manifest was altered. */
export class ManifestTamperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestTamperError';
  }
}

/** A newer (or unknown) schema version was found. We never guess; we fail explicitly. */
export class UnsupportedSchemaVersionError extends Error {
  readonly found: unknown;
  constructor(what: string, found: unknown) {
    super(
      `Unsupported ${what} schema version ${String(found)}; this build supports only version ${SCHEMA_VERSION}`,
    );
    this.name = 'UnsupportedSchemaVersionError';
    this.found = found;
  }
}

// ---------------------------------------------------------------- shape helpers

export const asRecord = (
  value: unknown,
  what: string,
): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ManifestFormatError(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const requireExactKeys = (
  rec: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  what: string,
): void => {
  for (const key of required) {
    if (!(key in rec) || rec[key] === undefined) {
      throw new ManifestFormatError(`${what}: missing field "${key}"`);
    }
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(rec)) {
    if (!allowed.has(key))
      throw new ManifestFormatError(`${what}: unexpected field "${key}"`);
  }
};

export const asString = (
  value: unknown,
  what: string,
  maxLen = 256,
): string => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLen
  ) {
    throw new ManifestFormatError(
      `${what} must be a non-empty string (max ${maxLen})`,
    );
  }
  return value;
};

export const asSafeInt = (
  value: unknown,
  what: string,
  min: number,
  max: number,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new ManifestFormatError(
      `${what} must be an integer in [${min}, ${max}]`,
    );
  }
  return value;
};

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const parseProvenance = (
  value: unknown,
  what = 'provenance',
): SourceProvenance => {
  const rec = asRecord(value, what);
  requireExactKeys(
    rec,
    [
      'sourceId',
      'sourceKind',
      'retrievedAt',
      'effectiveAsOf',
      'validationStatus',
    ],
    ['note'],
    what,
  );
  const sourceKind = rec.sourceKind;
  if (!(SOURCE_KINDS as readonly unknown[]).includes(sourceKind)) {
    throw new ManifestFormatError(`${what}.sourceKind is not recognized`);
  }
  const status = rec.validationStatus;
  if (!(VALIDATION_STATUSES as readonly unknown[]).includes(status)) {
    throw new ManifestFormatError(`${what}.validationStatus is not recognized`);
  }
  const retrievedAt = asString(rec.retrievedAt, `${what}.retrievedAt`, 20);
  if (!INSTANT.test(retrievedAt)) {
    throw new ManifestFormatError(
      `${what}.retrievedAt must be YYYY-MM-DDTHH:MM:SSZ`,
    );
  }
  const effectiveAsOf = asString(
    rec.effectiveAsOf,
    `${what}.effectiveAsOf`,
    10,
  );
  if (!SimDate.isValidISO(effectiveAsOf)) {
    throw new ManifestFormatError(
      `${what}.effectiveAsOf must be a valid YYYY-MM-DD date`,
    );
  }
  const out: {
    sourceId: string;
    sourceKind: SourceKind;
    retrievedAt: string;
    effectiveAsOf: string;
    validationStatus: ValidationStatus;
    note?: string;
  } = {
    sourceId: asString(rec.sourceId, `${what}.sourceId`),
    sourceKind: sourceKind as SourceKind,
    retrievedAt,
    effectiveAsOf,
    validationStatus: status as ValidationStatus,
  };
  if (rec.note !== undefined)
    out.note = asString(rec.note, `${what}.note`, 1024);
  return out;
};

export const parseProvenanceList = (
  value: unknown,
  what: string,
): SourceProvenance[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ManifestFormatError(`${what} must be a non-empty array`);
  }
  return value.map((p, i) => parseProvenance(p, `${what}[${i}]`));
};

export const unacceptableProvenance = (
  list: readonly SourceProvenance[],
  owner: string,
): ValidationIssue[] =>
  list
    .filter((p) => !ACCEPTED_FOR_WORLD_CREATION.includes(p.validationStatus))
    .map((p) => ({
      code: 'PROVENANCE_NOT_ACCEPTABLE',
      message: `${owner} source "${p.sourceId}" has status "${p.validationStatus}"; only synthetic or verified sources may create a world`,
    }));

/** Reads schemaVersion off an untrusted manifest and fails closed unless it equals 1. */
export const requireSupportedSchema = (
  rec: Record<string, unknown>,
  what: string,
): void => {
  const v = rec.schemaVersion;
  if (v === SCHEMA_VERSION) return;
  if (typeof v === 'number' && Number.isInteger(v))
    throw new UnsupportedSchemaVersionError(what, v);
  throw new ManifestFormatError(
    `${what}: schemaVersion missing or not an integer`,
  );
};
