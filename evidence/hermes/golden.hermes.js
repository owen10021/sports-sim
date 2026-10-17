(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __typeError = (msg) => {
    throw TypeError(msg);
  };
  var __pow = Math.pow;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
  var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
  var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
  var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);

  // packages/sim-core/src/ids.ts
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var isValidId = (value) => typeof value === "string" && ID_PATTERN.test(value);
  var checkedId = (kind, value) => {
    if (!isValidId(value)) {
      throw new TypeError(`Invalid ${kind}: must match ${ID_PATTERN.source}`);
    }
    return value;
  };
  var worldId = (value) => checkedId("WorldId", value);
  var entityId = (value) => checkedId("EntityId", value);
  var commandId = (value) => checkedId("CommandId", value);
  var eventId = (value) => checkedId("EventId", value);
  var isValidRevision = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
  var worldRevision = (value) => {
    if (!isValidRevision(value)) {
      throw new TypeError("Invalid WorldRevision: must be a non-negative safe integer");
    }
    return value;
  };
  var ACTOR_KINDS = [
    "human_gm",
    "cpu_org",
    "delegate",
    "commissioner",
    "system",
    "test_harness"
  ];
  var isActorRef = (value) => {
    if (typeof value !== "object" || value === null) return false;
    const v = value;
    return typeof v.kind === "string" && ACTOR_KINDS.includes(v.kind) && isValidId(v.id);
  };

  // packages/sim-core/src/simDate.ts
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var isLeap = (y) => y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
  var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var daysInMonth = (y, m) => m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1];
  var daysFromCivil = (yIn, m, d) => {
    const y = m <= 2 ? yIn - 1 : yIn;
    const era = Math.floor(y / 400);
    const yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  };
  var civilFromDays = (zIn) => {
    const z = zIn + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor(
      (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
    );
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp < 10 ? mp + 3 : mp - 9;
    const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    return [y, m, d];
  };
  var pad = (n, width) => String(n).padStart(width, "0");
  var SimDate = class _SimDate {
    constructor(epochDay, year, month, day) {
      /** Days since 1970-01-01 (proleptic Gregorian). */
      __publicField(this, "epochDay");
      __publicField(this, "year");
      __publicField(this, "month");
      __publicField(this, "day");
      this.epochDay = epochDay;
      this.year = year;
      this.month = month;
      this.day = day;
      Object.freeze(this);
    }
    /** Parse strict `YYYY-MM-DD`. Anything else (times, zones, short forms) throws. */
    static parse(iso) {
      const match = typeof iso === "string" ? ISO_DATE.exec(iso) : null;
      if (!match) throw new RangeError(`Invalid SimDate "${String(iso)}": expected YYYY-MM-DD`);
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        throw new RangeError(`Invalid SimDate "${iso}": not a real calendar date`);
      }
      return new _SimDate(daysFromCivil(year, month, day), year, month, day);
    }
    static fromEpochDay(epochDay) {
      if (!Number.isSafeInteger(epochDay)) throw new RangeError("epochDay must be a safe integer");
      const [y, m, d] = civilFromDays(epochDay);
      if (y < 1 || y > 9999) throw new RangeError("SimDate out of supported range (years 1-9999)");
      return new _SimDate(epochDay, y, m, d);
    }
    static isValidISO(iso) {
      try {
        _SimDate.parse(iso);
        return true;
      } catch (e) {
        return false;
      }
    }
    addDays(n) {
      if (!Number.isSafeInteger(n)) throw new RangeError("addDays requires a safe integer");
      return _SimDate.fromEpochDay(this.epochDay + n);
    }
    daysSince(other) {
      return this.epochDay - other.epochDay;
    }
    compare(other) {
      return this.epochDay - other.epochDay;
    }
    equals(other) {
      return this.epochDay === other.epochDay;
    }
    toISO() {
      return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
    }
    toString() {
      return this.toISO();
    }
  };

  // packages/sim-core/src/canonical.ts
  var hasLoneSurrogate = (s) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 55296 && c <= 56319) {
        const n = s.charCodeAt(i + 1);
        if (n >= 56320 && n <= 57343) i++;
        else return true;
      } else if (c >= 56320 && c <= 57343) {
        return true;
      }
    }
    return false;
  };
  var serialize = (value, ancestors, path) => {
    if (value === null) return "null";
    switch (typeof value) {
      case "boolean":
        return value ? "true" : "false";
      case "string":
        if (hasLoneSurrogate(value)) throw new TypeError(`Lone surrogate in string at ${path}`);
        return JSON.stringify(value);
      case "number":
        if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
          throw new TypeError(`Non-canonical number at ${path}: only safe integers (no -0) allowed`);
        }
        return String(value);
      case "object":
        break;
      default:
        throw new TypeError(`Unsupported type "${typeof value}" at ${path}`);
    }
    const obj = value;
    if (ancestors.includes(obj)) throw new TypeError(`Cycle detected at ${path}`);
    ancestors.push(obj);
    try {
      if (Array.isArray(obj)) {
        const parts2 = [];
        for (let i = 0; i < obj.length; i++) {
          if (!(i in obj)) throw new TypeError(`Sparse array at ${path}[${i}]`);
          parts2.push(serialize(obj[i], ancestors, `${path}[${i}]`));
        }
        return `[${parts2.join(",")}]`;
      }
      const proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`Non-plain object at ${path}`);
      }
      const record = obj;
      const keys = Object.keys(record).sort();
      const parts = [];
      for (const key of keys) {
        if (hasLoneSurrogate(key)) throw new TypeError(`Lone surrogate in key at ${path}`);
        parts.push(`${JSON.stringify(key)}:${serialize(record[key], ancestors, `${path}.${key}`)}`);
      }
      return `{${parts.join(",")}}`;
    } finally {
      ancestors.pop();
    }
  };
  var utf8Encode = (text) => {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      let cp = text.charCodeAt(i);
      if (cp >= 55296 && cp <= 56319) {
        const lo = text.charCodeAt(i + 1);
        if (lo >= 56320 && lo <= 57343) {
          cp = 65536 + (cp - 55296 << 10) + (lo - 56320);
          i++;
        } else {
          throw new TypeError("Lone surrogate cannot be UTF-8 encoded");
        }
      }
      if (cp < 128) {
        out.push(cp);
      } else if (cp < 2048) {
        out.push(192 | cp >> 6, 128 | cp & 63);
      } else if (cp < 65536) {
        out.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63);
      } else {
        out.push(
          240 | cp >> 18,
          128 | cp >> 12 & 63,
          128 | cp >> 6 & 63,
          128 | cp & 63
        );
      }
    }
    return Uint8Array.from(out);
  };
  var canonicalString = (value) => serialize(value, [], "$");
  var canonicalBytes = (value) => utf8Encode(canonicalString(value));

  // node_modules/@noble/hashes/_u64.js
  var fromNumH = (n) => n / __pow(2, 32) | 0;
  var fromNumL = (n) => n >>> 0;
  function setU64FromNum(view, byteOffset, n, isLE) {
    const h = fromNumH(n);
    const l = fromNumL(n);
    view.setUint32(byteOffset, isLE ? l : h, isLE);
    view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
  }

  // node_modules/@noble/hashes/utils.js
  function isBytes(a) {
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array" && "BYTES_PER_ELEMENT" in a && a.BYTES_PER_ELEMENT === 1;
  }
  var atitle = (title) => title ? `"${title}" ` : "";
  function anumber(n, title = "") {
    if (typeof n !== "number")
      throw new TypeError(atitle(title) + "expected number, got " + typeof n);
    if (!Number.isSafeInteger(n) || n < 0)
      throw new RangeError(atitle(title) + "expected integer >= 0, got " + n);
    return n;
  }
  function abytes(value, length, title = "") {
    if (isBytes(value) && (length === void 0 || value.length === length))
      return value;
    if (length !== void 0)
      anumber(length, "length");
    const bytes = isBytes(value);
    const ofLen = length !== void 0 ? ` of length ${length}` : "";
    const got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    const message = atitle(title) + "expected Uint8Array" + ofLen + ", got " + got;
    if (!bytes)
      throw new TypeError(message);
    throw new RangeError(message);
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new TypeError((label === "object" ? "" : `"${label}" `) + "expected object, got type=" + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
      throw new TypeError(`"${label}" expected plain object`);
    if (Object.hasOwn(value, "__proto__"))
      throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  function aexists(instance, checkFinished = true) {
    if (instance.destroyed)
      throw new Error("hash was destroyed");
    if (checkFinished && instance.finished)
      throw new Error("digest() was already called");
  }
  function aoutput(out, instance) {
    abytes(out, void 0, "output");
    const min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  function clean(...arrays) {
    for (let i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  var hasHexBuiltin = /* @__PURE__ */ (() => (
    // @ts-ignore
    typeof Uint8Array.from([]).toHex === "function" && typeof Uint8Array.fromHex === "function"
  ))();
  var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
  function bytesToHex(bytes) {
    abytes(bytes);
    if (hasHexBuiltin)
      return bytes.toHex();
    let hex = "";
    for (let i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  function checkOpts(defaults, opts, title = "opts") {
    aopts(defaults, "defaults");
    if (opts !== void 0)
      aopts(opts, title);
    const merged = Object.assign(/* @__PURE__ */ Object.create(null), defaults, opts);
    return merged;
  }
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== "function")
      throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, "info");
    const hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    const tmp = hashCons(void 0);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = (opts) => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  var oidNist = (suffix) => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([6, 9, 96, 134, 72, 1, 101, 3, 4, 2, suffix])
  });

  // node_modules/@noble/hashes/_md.js
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  var HashMD = class {
    constructor(blockLen, outputLen, padOffset, isLE) {
      __publicField(this, "blockLen");
      __publicField(this, "outputLen");
      __publicField(this, "canXOF", false);
      __publicField(this, "padOffset");
      __publicField(this, "isLE");
      // For partial updates less than block size
      __publicField(this, "buffer");
      __publicField(this, "view");
      __publicField(this, "finished", false);
      __publicField(this, "length", 0);
      __publicField(this, "pos", 0);
      __publicField(this, "destroyed", false);
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE;
      this.buffer = new Uint8Array(blockLen);
      this.view = createView(this.buffer);
    }
    update(data) {
      aexists(this);
      abytes(data);
      const { view, buffer, blockLen } = this;
      const len = data.length;
      let processed = false;
      for (let pos = 0; pos < len; ) {
        const take = Math.min(blockLen - this.pos, len - pos);
        if (take === blockLen) {
          const dataView = createView(data);
          for (; blockLen <= len - pos; pos += blockLen)
            this.process(dataView, pos);
          processed = true;
          continue;
        }
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      if (processed)
        this.roundClean();
      return this;
    }
    digestInto(out) {
      aexists(this);
      aoutput(out, this);
      this.finished = true;
      const { buffer, view, blockLen, isLE } = this;
      let { pos } = this;
      buffer[pos++] = 128;
      buffer.fill(0, pos);
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      setU64FromNum(view, blockLen - 8, this.length * 8, isLE);
      this.process(view, 0);
      this.roundClean();
      const oview = out === buffer ? view : createView(out);
      const len = this.outputLen;
      const outLen = len / 4;
      const state = this.get();
      if (len % 4 || outLen > state.length)
        throw new Error("invalid outputLen");
      for (let i = 0; i < outLen; i++)
        oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
      const { buffer, outputLen } = this;
      this.digestInto(buffer);
      const res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      const { buffer, length, finished, destroyed, pos } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      if (pos)
        to.buffer.set(buffer);
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  };
  var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);

  // node_modules/@noble/hashes/sha2.js
  var SHA256_K = /* @__PURE__ */ Uint32Array.from([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  var SHA256_W = /* @__PURE__ */ new Uint32Array(64);
  var SHA2_32B = class extends HashMD {
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      // We cannot use array here since array allows indexing by variable
      // which means optimizer/compiler cannot use registers.
      // Numeric initializers matter: starting the fields as `undefined` changes
      // V8's field representation and makes sha256 3x slower (measured).
      __publicField(this, "A", 0);
      __publicField(this, "B", 0);
      __publicField(this, "C", 0);
      __publicField(this, "D", 0);
      __publicField(this, "E", 0);
      __publicField(this, "F", 0);
      __publicField(this, "G", 0);
      __publicField(this, "H", 0);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      const { A, B, C, D, E, F, G, H } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to || (to = new this.constructor())).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      for (let i = 0; i < 16; i++, offset += 4)
        SHA256_W[i] = view.getUint32(offset, false);
      for (let i = 16; i < 64; i++) {
        const W15 = SHA256_W[i - 15];
        const W2 = SHA256_W[i - 2];
        const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
        const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
        SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
      }
      let { A, B, C, D, E, F, G, H } = this;
      for (let i = 0; i < 64; i++) {
        const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
        const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
        const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
        const T2 = sigma0 + Maj(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      clean(SHA256_W);
    }
    destroy() {
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      clean(this.buffer);
    }
  };
  var _SHA256 = class extends SHA2_32B {
    constructor() {
      super(32, SHA256_IV);
    }
  };
  var sha256 = /* @__PURE__ */ createHasher(
    () => new _SHA256(),
    /* @__PURE__ */ oidNist(1)
  );

  // packages/sim-core/src/hash.ts
  var HASH_PATTERN = /^[0-9a-f]{64}$/;
  var isHash = (value) => typeof value === "string" && HASH_PATTERN.test(value);
  var Hash32 = {
    /** SHA-256 over raw bytes, returned as 64 lowercase hex characters. */
    sha256(bytes) {
      return bytesToHex(sha256(bytes));
    }
  };
  var hashCanonical = (value) => Hash32.sha256(canonicalBytes(value));

  // packages/sim-core/src/provenance.ts
  var SCHEMA_VERSION = 1;
  var VALIDATION_STATUSES = [
    "synthetic",
    "verified",
    "unverified",
    "conflicted"
  ];
  var ACCEPTED_FOR_WORLD_CREATION = ["synthetic", "verified"];
  var SOURCE_KINDS = ["synthetic", "licensed", "public", "derived"];
  var ManifestFormatError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ManifestFormatError";
    }
  };
  var ManifestTamperError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "ManifestTamperError";
    }
  };
  var UnsupportedSchemaVersionError = class extends Error {
    constructor(what, found) {
      super(
        `Unsupported ${what} schema version ${String(found)}; this build supports only version ${SCHEMA_VERSION}`
      );
      __publicField(this, "found");
      this.name = "UnsupportedSchemaVersionError";
      this.found = found;
    }
  };
  var asRecord = (value, what) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ManifestFormatError(`${what} must be an object`);
    }
    return value;
  };
  var requireExactKeys = (rec, required, optional, what) => {
    for (const key of required) {
      if (!(key in rec) || rec[key] === void 0) {
        throw new ManifestFormatError(`${what}: missing field "${key}"`);
      }
    }
    const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
    for (const key of Object.keys(rec)) {
      if (!allowed.has(key)) throw new ManifestFormatError(`${what}: unexpected field "${key}"`);
    }
  };
  var asString = (value, what, maxLen = 256) => {
    if (typeof value !== "string" || value.length === 0 || value.length > maxLen) {
      throw new ManifestFormatError(`${what} must be a non-empty string (max ${maxLen})`);
    }
    return value;
  };
  var asSafeInt = (value, what, min, max) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new ManifestFormatError(`${what} must be an integer in [${min}, ${max}]`);
    }
    return value;
  };
  var INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  var parseProvenance = (value, what = "provenance") => {
    const rec = asRecord(value, what);
    requireExactKeys(
      rec,
      ["sourceId", "sourceKind", "retrievedAt", "effectiveAsOf", "validationStatus"],
      ["note"],
      what
    );
    const sourceKind = rec.sourceKind;
    if (!SOURCE_KINDS.includes(sourceKind)) {
      throw new ManifestFormatError(`${what}.sourceKind is not recognized`);
    }
    const status = rec.validationStatus;
    if (!VALIDATION_STATUSES.includes(status)) {
      throw new ManifestFormatError(`${what}.validationStatus is not recognized`);
    }
    const retrievedAt = asString(rec.retrievedAt, `${what}.retrievedAt`, 20);
    if (!INSTANT.test(retrievedAt)) {
      throw new ManifestFormatError(`${what}.retrievedAt must be YYYY-MM-DDTHH:MM:SSZ`);
    }
    const effectiveAsOf = asString(rec.effectiveAsOf, `${what}.effectiveAsOf`, 10);
    if (!SimDate.isValidISO(effectiveAsOf)) {
      throw new ManifestFormatError(`${what}.effectiveAsOf must be a valid YYYY-MM-DD date`);
    }
    const out = {
      sourceId: asString(rec.sourceId, `${what}.sourceId`),
      sourceKind,
      retrievedAt,
      effectiveAsOf,
      validationStatus: status
    };
    if (rec.note !== void 0) out.note = asString(rec.note, `${what}.note`, 1024);
    return out;
  };
  var parseProvenanceList = (value, what) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ManifestFormatError(`${what} must be a non-empty array`);
    }
    return value.map((p, i) => parseProvenance(p, `${what}[${i}]`));
  };
  var unacceptableProvenance = (list, owner) => list.filter((p) => !ACCEPTED_FOR_WORLD_CREATION.includes(p.validationStatus)).map((p) => ({
    code: "PROVENANCE_NOT_ACCEPTABLE",
    message: `${owner} source "${p.sourceId}" has status "${p.validationStatus}"; only synthetic or verified sources may create a world`
  }));
  var requireSupportedSchema = (rec, what) => {
    const v = rec.schemaVersion;
    if (v === SCHEMA_VERSION) return;
    if (typeof v === "number" && Number.isInteger(v)) throw new UnsupportedSchemaVersionError(what, v);
    throw new ManifestFormatError(`${what}: schemaVersion missing or not an integer`);
  };

  // packages/sim-core/src/ruleset.ts
  var BODY_KEYS = ["schemaVersion", "rulesetId", "rulesetVersion", "displayName", "provenance", "rules"];
  var parseBody = (rec) => {
    const rulesId = asString(rec.rulesetId, "ruleset.rulesetId", 128);
    if (!isValidId(rulesId)) throw new ManifestFormatError("ruleset.rulesetId is not a valid id");
    const rules = asRecord(rec.rules, "ruleset.rules");
    requireExactKeys(rules, ["maxAdvanceDaysPerCommand"], [], "ruleset.rules");
    return {
      schemaVersion: SCHEMA_VERSION,
      rulesetId: rulesId,
      rulesetVersion: asSafeInt(rec.rulesetVersion, "ruleset.rulesetVersion", 1, 1e6),
      displayName: asString(rec.displayName, "ruleset.displayName", 200),
      provenance: parseProvenanceList(rec.provenance, "ruleset.provenance"),
      rules: {
        maxAdvanceDaysPerCommand: asSafeInt(rules.maxAdvanceDaysPerCommand, "rules.maxAdvanceDaysPerCommand", 1, 3650)
      }
    };
  };
  var bodyOf = (m) => ({
    schemaVersion: m.schemaVersion,
    rulesetId: m.rulesetId,
    rulesetVersion: m.rulesetVersion,
    displayName: m.displayName,
    provenance: m.provenance,
    rules: m.rules
  });
  var sealRuleset = (body) => {
    const rec = asRecord(body, "ruleset body");
    requireExactKeys(rec, BODY_KEYS, [], "ruleset body");
    requireSupportedSchema(rec, "ruleset");
    const parsed = parseBody(rec);
    return __spreadProps(__spreadValues({}, parsed), { contentHash: hashCanonical(bodyOf(parsed)) });
  };
  var validateRulesetManifest = (value) => {
    const rec = asRecord(value, "ruleset manifest");
    requireSupportedSchema(rec, "ruleset");
    requireExactKeys(rec, [...BODY_KEYS, "contentHash"], [], "ruleset manifest");
    const stored = rec.contentHash;
    if (!isHash(stored)) throw new ManifestFormatError("ruleset.contentHash must be 64 lowercase hex chars");
    const parsed = parseBody(rec);
    if (hashCanonical(bodyOf(parsed)) !== stored) {
      throw new ManifestTamperError(`ruleset "${parsed.rulesetId}" v${parsed.rulesetVersion}: content hash mismatch`);
    }
    return __spreadProps(__spreadValues({}, parsed), { contentHash: stored });
  };
  var rulesetRefOf = (m) => ({
    rulesetId: m.rulesetId,
    rulesetVersion: m.rulesetVersion,
    contentHash: m.contentHash
  });

  // packages/sim-core/src/seed.ts
  var SEED_ENTITY_KINDS = ["person", "organization"];
  var BODY_KEYS2 = [
    "schemaVersion",
    "seedId",
    "seedVersion",
    "ruleset",
    "rngSeed32",
    "startDate",
    "provenance",
    "initialEntities"
  ];
  var parseRulesetRef = (value) => {
    const rec = asRecord(value, "seed.ruleset");
    requireExactKeys(rec, ["rulesetId", "rulesetVersion", "contentHash"], [], "seed.ruleset");
    if (!isHash(rec.contentHash)) throw new ManifestFormatError("seed.ruleset.contentHash must be a sha256 hex");
    return {
      rulesetId: asString(rec.rulesetId, "seed.ruleset.rulesetId", 128),
      rulesetVersion: asSafeInt(rec.rulesetVersion, "seed.ruleset.rulesetVersion", 1, 1e6),
      contentHash: rec.contentHash
    };
  };
  var parseEntities = (value) => {
    if (!Array.isArray(value)) throw new ManifestFormatError("seed.initialEntities must be an array");
    return value.map((raw, i) => {
      const rec = asRecord(raw, `seed.initialEntities[${i}]`);
      requireExactKeys(rec, ["id", "kind", "name"], [], `seed.initialEntities[${i}]`);
      const id = asString(rec.id, `seed.initialEntities[${i}].id`, 128);
      if (!isValidId(id)) throw new ManifestFormatError(`seed.initialEntities[${i}].id is not a valid id`);
      if (!SEED_ENTITY_KINDS.includes(rec.kind)) {
        throw new ManifestFormatError(`seed.initialEntities[${i}].kind is not recognized`);
      }
      return { id, kind: rec.kind, name: asString(rec.name, `seed.initialEntities[${i}].name`, 200) };
    });
  };
  var parseBody2 = (rec) => {
    const seedId = asString(rec.seedId, "seed.seedId", 128);
    if (!isValidId(seedId)) throw new ManifestFormatError("seed.seedId is not a valid id");
    const startDate = asString(rec.startDate, "seed.startDate", 10);
    if (!SimDate.isValidISO(startDate)) throw new ManifestFormatError("seed.startDate must be a valid YYYY-MM-DD");
    return {
      schemaVersion: SCHEMA_VERSION,
      seedId,
      seedVersion: asSafeInt(rec.seedVersion, "seed.seedVersion", 1, 1e6),
      ruleset: parseRulesetRef(rec.ruleset),
      rngSeed32: asSafeInt(rec.rngSeed32, "seed.rngSeed32", 0, 4294967295),
      startDate,
      provenance: parseProvenanceList(rec.provenance, "seed.provenance"),
      initialEntities: parseEntities(rec.initialEntities)
    };
  };
  var bodyOf2 = (m) => ({
    schemaVersion: m.schemaVersion,
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    ruleset: m.ruleset,
    rngSeed32: m.rngSeed32,
    startDate: m.startDate,
    provenance: m.provenance,
    initialEntities: m.initialEntities
  });
  var sealSeed = (body) => {
    const rec = asRecord(body, "seed body");
    requireExactKeys(rec, BODY_KEYS2, [], "seed body");
    requireSupportedSchema(rec, "seed");
    const parsed = parseBody2(rec);
    return __spreadProps(__spreadValues({}, parsed), { contentHash: hashCanonical(bodyOf2(parsed)) });
  };
  var validateSeedManifest = (value) => {
    const rec = asRecord(value, "seed manifest");
    requireSupportedSchema(rec, "seed");
    requireExactKeys(rec, [...BODY_KEYS2, "contentHash"], [], "seed manifest");
    const stored = rec.contentHash;
    if (!isHash(stored)) throw new ManifestFormatError("seed.contentHash must be 64 lowercase hex chars");
    const parsed = parseBody2(rec);
    if (hashCanonical(bodyOf2(parsed)) !== stored) {
      throw new ManifestTamperError(`seed "${parsed.seedId}" v${parsed.seedVersion}: content hash mismatch`);
    }
    return __spreadProps(__spreadValues({}, parsed), { contentHash: stored });
  };
  var seedRefOf = (m) => ({
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    contentHash: m.contentHash
  });
  var classify = (e, prefix, hashCode) => {
    if (e instanceof UnsupportedSchemaVersionError) {
      return { code: `${prefix}_UNSUPPORTED_SCHEMA`, message: e.message };
    }
    if (e instanceof ManifestTamperError) return { code: hashCode, message: e.message };
    const message = e instanceof Error ? e.message : String(e);
    return { code: `${prefix}_MALFORMED`, message };
  };
  var validateForWorldCreation = (seedIn, rulesetIn) => {
    const issues = [];
    let ruleset;
    let seed;
    try {
      ruleset = validateRulesetManifest(rulesetIn);
    } catch (e) {
      issues.push(classify(e, "RULESET", "RULESET_HASH_MISMATCH"));
    }
    try {
      seed = validateSeedManifest(seedIn);
    } catch (e) {
      issues.push(classify(e, "SEED", "SEED_HASH_MISMATCH"));
    }
    if (ruleset) issues.push(...unacceptableProvenance(ruleset.provenance, "ruleset"));
    if (seed) {
      issues.push(...unacceptableProvenance(seed.provenance, "seed"));
      const seen = /* @__PURE__ */ new Set();
      for (const entity of seed.initialEntities) {
        if (seen.has(entity.id)) {
          issues.push({ code: "SEED_DUPLICATE_ENTITY", message: `duplicate initial entity id "${entity.id}"` });
        }
        seen.add(entity.id);
      }
    }
    if (ruleset && seed) {
      const ref = seed.ruleset;
      if (ref.rulesetId !== ruleset.rulesetId || ref.rulesetVersion !== ruleset.rulesetVersion || ref.contentHash !== ruleset.contentHash) {
        issues.push({
          code: "SEED_RULESET_MISMATCH",
          message: `seed targets ruleset ${ref.rulesetId} v${ref.rulesetVersion} (${ref.contentHash.slice(0, 12)}), but ${ruleset.rulesetId} v${ruleset.rulesetVersion} (${ruleset.contentHash.slice(0, 12)}) was supplied`
        });
      }
    }
    return issues.length === 0 ? { ok: true } : { ok: false, issues };
  };

  // packages/sim-core/src/rng.ts
  var RNG_ALGORITHM = "xoshiro128ss-v1";
  var TWO_32 = 4294967296;
  var isU32 = (n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 4294967295 && !Object.is(n, -0);
  var rotl = (x, k) => x << k | x >>> 32 - k;
  var splitmix32Next = (state) => {
    const a = state + 2654435769 >>> 0;
    let t = a ^ a >>> 16;
    t = Math.imul(t, 569420461);
    t = t ^ t >>> 15;
    t = Math.imul(t, 1935289751);
    return { state: a, value: (t ^ t >>> 15) >>> 0 };
  };
  var validateState = (state) => {
    if (typeof state !== "object" || state === null || state.algorithm !== RNG_ALGORITHM) {
      throw new RangeError(`Unsupported RNG algorithm; expected ${RNG_ALGORITHM}`);
    }
    if (!isU32(state.s0) || !isU32(state.s1) || !isU32(state.s2) || !isU32(state.s3)) {
      throw new RangeError("RNG state words must be uint32 integers");
    }
    if (state.s0 === 0 && state.s1 === 0 && state.s2 === 0 && state.s3 === 0) {
      throw new RangeError("RNG state must not be all zero");
    }
    if (!Number.isSafeInteger(state.draws) || state.draws < 0) {
      throw new RangeError("RNG draw counter must be a non-negative safe integer");
    }
  };
  var DeterministicRng = class _DeterministicRng {
    constructor(state) {
      __publicField(this, "s0");
      __publicField(this, "s1");
      __publicField(this, "s2");
      __publicField(this, "s3");
      __publicField(this, "draws");
      this.s0 = state.s0;
      this.s1 = state.s1;
      this.s2 = state.s2;
      this.s3 = state.s3;
      this.draws = state.draws;
    }
    static fromSeed(seed32) {
      if (!isU32(seed32)) throw new RangeError("RNG seed must be a uint32 integer");
      let cursor = seed32;
      const words = [];
      for (let i = 0; i < 4; i++) {
        const step = splitmix32Next(cursor);
        cursor = step.state;
        words.push(step.value);
      }
      if (!words.some((w) => w !== 0)) words[0] = 1;
      return new _DeterministicRng({
        algorithm: RNG_ALGORITHM,
        s0: words[0],
        s1: words[1],
        s2: words[2],
        s3: words[3],
        draws: 0
      });
    }
    static fromState(state) {
      validateState(state);
      return new _DeterministicRng(state);
    }
    /** Next uint32 (0 .. 2^32-1). */
    nextU32() {
      const result2 = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
      const t = this.s1 << 9;
      let s0 = this.s0;
      let s1 = this.s1;
      let s2 = this.s2;
      let s3 = this.s3;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = rotl(s3, 11);
      this.s0 = s0 >>> 0;
      this.s1 = s1 >>> 0;
      this.s2 = s2 >>> 0;
      this.s3 = s3 >>> 0;
      this.draws += 1;
      return result2;
    }
    /**
     * Unbiased integer in [0, maxExclusive) via rejection sampling. Bounds are validated
     * BEFORE any draw, so invalid input consumes no RNG state. 1 <= maxExclusive <= 2^32.
     */
    nextInt(maxExclusive) {
      if (typeof maxExclusive !== "number" || !Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO_32) {
        throw new RangeError("nextInt bound must be an integer in [1, 2^32]");
      }
      const limit = Math.floor(TWO_32 / maxExclusive) * maxExclusive;
      for (; ; ) {
        const x = this.nextU32();
        if (x < limit) return x % maxExclusive;
      }
    }
    snapshot() {
      return {
        algorithm: RNG_ALGORITHM,
        s0: this.s0,
        s1: this.s1,
        s2: this.s2,
        s3: this.s3,
        draws: this.draws
      };
    }
    /** Replace internal state. Validates first; on failure the generator is unchanged. */
    restore(state) {
      validateState(state);
      this.s0 = state.s0;
      this.s1 = state.s1;
      this.s2 = state.s2;
      this.s3 = state.s3;
      this.draws = state.draws;
    }
  };

  // packages/sim-core/src/world.ts
  var WorldCreationError = class extends Error {
    constructor(issues) {
      super(`Cannot create world: ${issues.map((i) => `${i.code} (${i.message})`).join("; ")}`);
      __publicField(this, "issues");
      this.name = "WorldCreationError";
      this.issues = issues;
    }
  };
  var deepFreeze = (value) => {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  };
  var createWorld = (seedIn, rulesetIn, idSource) => {
    const verdict = validateForWorldCreation(seedIn, rulesetIn);
    if (!verdict.ok) throw new WorldCreationError(verdict.issues);
    const ruleset = validateRulesetManifest(rulesetIn);
    const seed = validateSeedManifest(seedIn);
    const entities = seed.initialEntities.map((e) => ({ id: entityId(e.id), kind: e.kind, name: e.name })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      worldId: worldId(idSource.newWorldId()),
      ruleset: rulesetRefOf(ruleset),
      seed: seedRefOf(seed),
      simDate: seed.startDate,
      revision: worldRevision(0),
      rng: DeterministicRng.fromSeed(seed.rngSeed32).snapshot(),
      nextIds: { event: 1 },
      entities
    });
  };
  var fingerprintWorld = (world) => hashCanonical({ domain: "sport-sim/world-fingerprint", version: 1, world });

  // packages/sim-core/src/audit.ts
  var GENESIS_HASH = "0".repeat(64);
  var bodyOf3 = (e) => ({
    eventId: e.eventId,
    revision: e.revision,
    simDate: e.simDate,
    actor: e.actor,
    commandId: e.commandId,
    type: e.type,
    payload: e.payload
  });
  var hashEvent = (previousHash, body) => hashCanonical({ previousHash, body: bodyOf3(body) });
  var isBodyShaped = (e) => {
    if (typeof e !== "object" || e === null) return false;
    const v = e;
    return isValidId(v.eventId) && isValidRevision(v.revision) && SimDate.isValidISO(v.simDate) && isActorRef(v.actor) && isValidId(v.commandId) && typeof v.type === "string" && v.type.length > 0 && v.payload !== void 0;
  };
  var chainEvent = (previousHash, body) => {
    if (!isHash(previousHash)) throw new TypeError("previousHash must be 64 lowercase hex chars");
    if (!isBodyShaped(body)) throw new TypeError("malformed event body");
    return deepFreeze(__spreadProps(__spreadValues({}, bodyOf3(body)), { previousHash, hash: hashEvent(previousHash, body) }));
  };

  // packages/sim-core/src/kernel.ts
  var CALENDAR_AUTHORITY = /* @__PURE__ */ new Set([
    "human_gm",
    "commissioner",
    "system",
    "test_harness"
  ]);
  var KNOWN_COMMANDS = /* @__PURE__ */ new Set(["AdvanceDays"]);
  var eventIdFor = (ordinal) => eventId(`evt-${String(ordinal).padStart(6, "0")}`);
  var _world, _ruleset, _chainHead, _eventCount, _events, _known, _beforeCommit;
  var _WorldKernel = class _WorldKernel {
    constructor(world, ruleset, chainHead, eventCount, known, options) {
      __privateAdd(this, _world);
      __privateAdd(this, _ruleset);
      __privateAdd(this, _chainHead);
      __privateAdd(this, _eventCount);
      __privateAdd(this, _events, []);
      __privateAdd(this, _known);
      __privateAdd(this, _beforeCommit);
      const validated = validateRulesetManifest(ruleset);
      const ref = rulesetRefOf(validated);
      if (ref.rulesetId !== world.ruleset.rulesetId || ref.rulesetVersion !== world.ruleset.rulesetVersion || ref.contentHash !== world.ruleset.contentHash) {
        throw new Error("ruleset does not match the world ruleset reference");
      }
      if (!isHash(chainHead)) throw new Error("chainHead must be a 64-char lowercase hex hash");
      if (!Number.isSafeInteger(eventCount) || eventCount < 0) throw new Error("invalid eventCount");
      __privateSet(this, _world, world);
      __privateSet(this, _ruleset, validated);
      __privateSet(this, _chainHead, chainHead);
      __privateSet(this, _eventCount, eventCount);
      __privateSet(this, _known, new Set(known));
      __privateSet(this, _beforeCommit, options.beforeCommit);
    }
    static fromGenesis(world, ruleset, options = {}) {
      if (world.revision !== 0 || world.nextIds.event !== 1) {
        throw new Error("fromGenesis requires an untouched genesis world");
      }
      return new _WorldKernel(world, ruleset, GENESIS_HASH, 0, [], options);
    }
    static resume(state, options = {}) {
      if (state.eventCount + 1 !== state.world.nextIds.event) {
        throw new Error("eventCount does not agree with world.nextIds.event");
      }
      return new _WorldKernel(
        state.world,
        state.ruleset,
        state.chainHead,
        state.eventCount,
        state.knownCommandIds,
        options
      );
    }
    get world() {
      return __privateGet(this, _world);
    }
    get chainHead() {
      return __privateGet(this, _chainHead);
    }
    /** Total events ever committed for this career (not just those since resume). */
    get eventCount() {
      return __privateGet(this, _eventCount);
    }
    /** Events committed by this kernel instance, in order. */
    get events() {
      return __privateGet(this, _events);
    }
    get knownCommandIds() {
      return [...__privateGet(this, _known)].sort();
    }
    execute(input) {
      var _a;
      const steps = [];
      const reject = (stage, code, message, commandId2) => {
        steps.push({ stage, outcome: "fail", detail: `${code}: ${message}` });
        return { ok: false, rejection: { code, message }, trace: deepFreeze({ commandId: commandId2, steps }) };
      };
      const env = input;
      if (typeof env !== "object" || env === null || !isValidId(env.commandId) || !isValidRevision(env.expectedRevision) || !isActorRef(env.actor) || typeof env.command !== "object" || env.command === null) {
        return reject("validation", "SCHEMA_INVALID", "malformed command envelope", null);
      }
      const cid = env.commandId;
      const command = env.command;
      if (typeof command.type !== "string" || !KNOWN_COMMANDS.has(command.type)) {
        return reject("validation", "SCHEMA_INVALID", "unknown command type", cid);
      }
      if (__privateGet(this, _known).has(cid)) {
        return reject("validation", "DUPLICATE_COMMAND", `command ${cid} was already committed`, cid);
      }
      if (env.expectedRevision !== __privateGet(this, _world).revision) {
        return reject(
          "validation",
          "STALE_REVISION",
          `expected revision ${String(env.expectedRevision)} but world is at ${__privateGet(this, _world).revision}`,
          cid
        );
      }
      const max = __privateGet(this, _ruleset).rules.maxAdvanceDaysPerCommand;
      const days = command.days;
      if (typeof days !== "number" || !Number.isSafeInteger(days) || days < 1 || days > max) {
        return reject("validation", "INVALID_PAYLOAD", `days must be an integer in 1..${max}`, cid);
      }
      steps.push({ stage: "validation", outcome: "pass", detail: "envelope, revision and payload valid" });
      const actor = env.actor;
      if (!CALENDAR_AUTHORITY.has(actor.kind)) {
        return reject("authorization", "UNAUTHORIZED_ACTOR", `${actor.kind} cannot advance the calendar`, cid);
      }
      steps.push({ stage: "authorization", outcome: "pass", detail: `${actor.kind} may advance the calendar` });
      try {
        const world = __privateGet(this, _world);
        const rng = DeterministicRng.fromState(world.rng);
        const start = SimDate.parse(world.simDate);
        const dayRolls = [];
        for (let i = 1; i <= days; i++) {
          dayRolls.push({ date: start.addDays(i).toISO(), roll: rng.nextU32() });
        }
        const toDate = start.addDays(days).toISO();
        steps.push({ stage: "resolution", outcome: "pass", detail: `advanced ${days} day(s) to ${toDate}` });
        const revision = worldRevision(Number(world.revision) + 1);
        const event = chainEvent(__privateGet(this, _chainHead), {
          eventId: eventIdFor(world.nextIds.event),
          revision,
          simDate: toDate,
          actor,
          commandId: env.commandId,
          type: "DaysAdvanced",
          payload: { fromDate: world.simDate, toDate, days, dayRolls }
        });
        const nextWorld = deepFreeze(__spreadProps(__spreadValues({}, world), {
          simDate: toDate,
          revision,
          rng: rng.snapshot(),
          nextIds: { event: world.nextIds.event + 1 }
        }));
        (_a = __privateGet(this, _beforeCommit)) == null ? void 0 : _a.call(this);
        steps.push({ stage: "commit", outcome: "pass", detail: `committed revision ${revision}` });
        __privateSet(this, _world, nextWorld);
        __privateSet(this, _chainHead, event.hash);
        __privateSet(this, _eventCount, __privateGet(this, _eventCount) + 1);
        __privateGet(this, _events).push(event);
        __privateGet(this, _known).add(cid);
        return { ok: true, world: nextWorld, events: [event], trace: deepFreeze({ commandId: cid, steps }) };
      } catch (error) {
        steps.length = 2;
        return reject(
          "commit",
          "INTERNAL_ERROR",
          error instanceof Error ? error.message : "unexpected failure",
          cid
        );
      }
    }
  };
  _world = new WeakMap();
  _ruleset = new WeakMap();
  _chainHead = new WeakMap();
  _eventCount = new WeakMap();
  _events = new WeakMap();
  _known = new WeakMap();
  _beforeCommit = new WeakMap();
  var WorldKernel = _WorldKernel;

  // packages/sim-core/src/persistence.ts
  var snapshotBody = (s) => ({
    schemaVersion: s.schemaVersion,
    worldId: s.worldId,
    revision: s.revision,
    eventCount: s.eventCount,
    chainHead: s.chainHead,
    worldFingerprint: s.worldFingerprint,
    knownCommandIds: s.knownCommandIds,
    world: s.world
  });
  var hashSnapshotBody = (s) => hashCanonical({ domain: "sport-sim/career-snapshot", version: 1, body: snapshotBody(s) });
  var sealSnapshot = (input) => {
    const body = {
      schemaVersion: SCHEMA_VERSION,
      worldId: input.world.worldId,
      revision: input.world.revision,
      eventCount: input.eventCount,
      chainHead: input.chainHead,
      worldFingerprint: fingerprintWorld(input.world),
      knownCommandIds: [...input.knownCommandIds].sort(),
      world: input.world
    };
    return deepFreeze(__spreadProps(__spreadValues({}, body), { contentHash: hashSnapshotBody(body) }));
  };

  // packages/sim-core/src/syntheticFixtures.ts
  var provenance = {
    sourceId: "sport-sim-synthetic-package-a",
    sourceKind: "synthetic",
    retrievedAt: "2026-10-16T00:00:00Z",
    effectiveAsOf: "2026-10-16",
    validationStatus: "synthetic",
    note: "Synthetic Package A fixture. Contains no real league data."
  };
  var SYNTHETIC_RULESET = sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: "synthetic-minimal",
    rulesetVersion: 1,
    displayName: "Synthetic Minimal Ruleset (Package A)",
    provenance: [provenance],
    rules: { maxAdvanceDaysPerCommand: 30 }
  });
  var SYNTHETIC_SEED = sealSeed({
    schemaVersion: SCHEMA_VERSION,
    seedId: "synthetic-empty",
    seedVersion: 1,
    ruleset: rulesetRefOf(SYNTHETIC_RULESET),
    rngSeed32: 20261016,
    startDate: "2026-10-16",
    provenance: [provenance],
    initialEntities: []
  });

  // packages/sim-core/src/golden.ts
  var GOLDEN_SCENARIO_ID = "package-a-golden-v1";
  var GOLDEN_WORLD_ID = "world-golden-1";
  var harness = { kind: "test_harness", id: entityId("golden-harness") };
  var cpu = { kind: "cpu_org", id: entityId("golden-cpu") };
  var envelope = (n, days, revision, actor = harness) => ({
    commandId: commandId(`cmd-${String(n).padStart(6, "0")}`),
    expectedRevision: worldRevision(revision),
    actor,
    command: { type: "AdvanceDays", days }
  });
  var rev = (k) => Number(k.world.revision);
  var GOLDEN_STEPS = [
    { label: "advance-1", expect: "committed", build: (k) => envelope(1, 1, rev(k)) },
    { label: "advance-6", expect: "committed", build: (k) => envelope(2, 6, rev(k)) },
    { label: "duplicate-command", expect: "DUPLICATE_COMMAND", build: (k) => envelope(2, 6, rev(k)) },
    { label: "stale-revision", expect: "STALE_REVISION", build: () => envelope(3, 1, 0) },
    { label: "invalid-days", expect: "INVALID_PAYLOAD", build: (k) => envelope(3, 0, rev(k)) },
    { label: "unauthorized-actor", expect: "UNAUTHORIZED_ACTOR", build: (k) => envelope(3, 1, rev(k), cpu) },
    { label: "advance-7", expect: "committed", build: (k) => envelope(3, 7, rev(k)) }
  ];
  var GoldenScenarioError = class extends Error {
    constructor(message) {
      super(`Golden scenario violated: ${message}`);
      this.name = "GoldenScenarioError";
    }
  };
  var stateOf = (k) => ({
    fingerprint: fingerprintWorld(k.world),
    rngDraws: k.world.rng.draws,
    chainHead: k.chainHead,
    events: k.eventCount
  });
  var runGoldenScenario = (onCommit) => {
    const world = createWorld(SYNTHETIC_SEED, SYNTHETIC_RULESET, { newWorldId: () => worldId(GOLDEN_WORLD_ID) });
    const kernel = WorldKernel.fromGenesis(world, SYNTHETIC_RULESET);
    const steps = [];
    const commandDays = [];
    for (const spec of GOLDEN_STEPS) {
      const env = spec.build(kernel);
      const before = stateOf(kernel);
      const result2 = kernel.execute(env);
      if (spec.expect === "committed") {
        if (!result2.ok) throw new GoldenScenarioError(`${spec.label} should commit but was rejected: ${result2.rejection.code}`);
        commandDays.push(env.command.days);
        onCommit == null ? void 0 : onCommit({
          snapshot: sealSnapshot({
            world: kernel.world,
            chainHead: kernel.chainHead,
            eventCount: kernel.eventCount,
            knownCommandIds: kernel.knownCommandIds
          }),
          commands: [{ envelope: env, resultRevision: Number(result2.world.revision) }],
          events: result2.events
        });
      } else {
        if (result2.ok) throw new GoldenScenarioError(`${spec.label} should be rejected as ${spec.expect} but committed`);
        if (result2.rejection.code !== spec.expect) {
          throw new GoldenScenarioError(`${spec.label} rejected as ${result2.rejection.code}, expected ${spec.expect}`);
        }
        const after = stateOf(kernel);
        if (after.fingerprint !== before.fingerprint || after.rngDraws !== before.rngDraws || after.chainHead !== before.chainHead) {
          throw new GoldenScenarioError(`${spec.label} changed state or consumed randomness`);
        }
      }
      steps.push({
        label: spec.label,
        outcome: spec.expect,
        revision: Number(kernel.world.revision),
        rngDraws: kernel.world.rng.draws,
        fingerprint: fingerprintWorld(kernel.world),
        chainHead: kernel.chainHead
      });
    }
    return {
      scenario: GOLDEN_SCENARIO_ID,
      worldId: kernel.world.worldId,
      finalSimDate: kernel.world.simDate,
      revision: Number(kernel.world.revision),
      eventCount: kernel.eventCount,
      rngDraws: kernel.world.rng.draws,
      commandDays,
      fingerprint: fingerprintWorld(kernel.world),
      eventChainHead: kernel.chainHead,
      steps
    };
  };
  var diffGolden = (actual, expected) => {
    const diffs2 = [];
    const keys = ["scenario", "worldId", "finalSimDate", "revision", "eventCount", "rngDraws", "fingerprint", "eventChainHead"];
    for (const k of keys) if (actual[k] !== expected[k]) diffs2.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
    if (JSON.stringify(actual.commandDays) !== JSON.stringify(expected.commandDays)) diffs2.push("commandDays differ");
    if (JSON.stringify(actual.steps) !== JSON.stringify(expected.steps)) diffs2.push("per-step results differ");
    return diffs2;
  };

  // packages/sim-core/src/goldenExpected.ts
  var GOLDEN_EXPECTED = {
    "scenario": GOLDEN_SCENARIO_ID,
    "worldId": GOLDEN_WORLD_ID,
    "finalSimDate": "2026-10-30",
    "revision": 3,
    "eventCount": 3,
    "rngDraws": 14,
    "commandDays": [
      1,
      6,
      7
    ],
    "fingerprint": "fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda",
    "eventChainHead": "d9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a",
    "steps": [
      {
        "label": "advance-1",
        "outcome": "committed",
        "revision": 1,
        "rngDraws": 1,
        "fingerprint": "dde4d6daa87ca7f85a513fd101437d826b9665d975cd579de006d6bc1f612335",
        "chainHead": "88527b7579aff9d4dead44d04099536268aacbbbf42a1d0fd256964f5d6078d1"
      },
      {
        "label": "advance-6",
        "outcome": "committed",
        "revision": 2,
        "rngDraws": 7,
        "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
        "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
      },
      {
        "label": "duplicate-command",
        "outcome": "DUPLICATE_COMMAND",
        "revision": 2,
        "rngDraws": 7,
        "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
        "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
      },
      {
        "label": "stale-revision",
        "outcome": "STALE_REVISION",
        "revision": 2,
        "rngDraws": 7,
        "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
        "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
      },
      {
        "label": "invalid-days",
        "outcome": "INVALID_PAYLOAD",
        "revision": 2,
        "rngDraws": 7,
        "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
        "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
      },
      {
        "label": "unauthorized-actor",
        "outcome": "UNAUTHORIZED_ACTOR",
        "revision": 2,
        "rngDraws": 7,
        "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
        "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
      },
      {
        "label": "advance-7",
        "outcome": "committed",
        "revision": 3,
        "rngDraws": 14,
        "fingerprint": "fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda",
        "chainHead": "d9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a"
      }
    ]
  };

  // scripts/hermes/entry.ts
  var result = runGoldenScenario();
  var diffs = diffGolden(result, GOLDEN_EXPECTED);
  var properties = typeof HermesInternal !== "undefined" && HermesInternal !== void 0 && HermesInternal.getRuntimeProperties ? HermesInternal.getRuntimeProperties() : null;
  print(
    JSON.stringify({
      engine: properties === null ? "unknown (no HermesInternal)" : "hermes",
      runtime: properties,
      match: diffs.length === 0,
      diffs,
      fingerprint: result.fingerprint,
      eventChainHead: result.eventChainHead,
      finalSimDate: result.finalSimDate,
      revision: result.revision,
      eventCount: result.eventCount,
      rngDraws: result.rngDraws,
      commandDays: result.commandDays
    })
  );
})();
