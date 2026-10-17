/**
 * Deterministic canonical serialization.
 *
 * `canonicalBytes(value)` yields identical bytes on every runtime (Node, Hermes)
 * for the same logical value, so hashes/fingerprints agree across platforms.
 *
 * Accepted: null, booleans, strings (no lone surrogates), safe integers (no -0),
 * dense arrays, plain objects (keys sorted by UTF-16 code unit).
 * Rejected with TypeError: undefined, non-integer/NaN/Infinity numbers, bigint,
 * functions, symbols, class instances (Date, Map, ...), sparse arrays, cycles.
 * Floats are rejected on purpose: authoritative math is integer-only.
 */
const hasLoneSurrogate = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = s.charCodeAt(i + 1);
      if (n >= 0xdc00 && n <= 0xdfff) i++;
      else return true;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
};

const serialize = (value: unknown, ancestors: object[], path: string): string => {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      if (hasLoneSurrogate(value)) throw new TypeError(`Lone surrogate in string at ${path}`);
      return JSON.stringify(value);
    case 'number':
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
        throw new TypeError(`Non-canonical number at ${path}: only safe integers (no -0) allowed`);
      }
      return String(value);
    case 'object':
      break;
    default:
      throw new TypeError(`Unsupported type "${typeof value}" at ${path}`);
  }

  const obj = value as object;
  if (ancestors.includes(obj)) throw new TypeError(`Cycle detected at ${path}`);
  ancestors.push(obj);
  try {
    if (Array.isArray(obj)) {
      const parts: string[] = [];
      for (let i = 0; i < obj.length; i++) {
        if (!(i in obj)) throw new TypeError(`Sparse array at ${path}[${i}]`);
        parts.push(serialize(obj[i], ancestors, `${path}[${i}]`));
      }
      return `[${parts.join(',')}]`;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(`Non-plain object at ${path}`);
    }
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      if (hasLoneSurrogate(key)) throw new TypeError(`Lone surrogate in key at ${path}`);
      parts.push(`${JSON.stringify(key)}:${serialize(record[key], ancestors, `${path}.${key}`)}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    ancestors.pop();
  }
};

/** Manual UTF-8 encoder: no dependency on TextEncoder availability in any runtime. */
export const utf8Encode = (text: string): Uint8Array => {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let cp = text.charCodeAt(i);
    if (cp >= 0xd800 && cp <= 0xdbff) {
      const lo = text.charCodeAt(i + 1);
      if (lo >= 0xdc00 && lo <= 0xdfff) {
        cp = 0x10000 + ((cp - 0xd800) << 10) + (lo - 0xdc00);
        i++;
      } else {
        throw new TypeError('Lone surrogate cannot be UTF-8 encoded');
      }
    }
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
};

export const canonicalString = (value: unknown): string => serialize(value, [], '$');

export const canonicalBytes = (value: unknown): Uint8Array => utf8Encode(canonicalString(value));
