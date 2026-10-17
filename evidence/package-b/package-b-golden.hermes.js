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
  var recordId = (value) => checkedId("RecordId", value);
  var isValidRevision = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
  var worldRevision = (value) => {
    if (!isValidRevision(value)) {
      throw new TypeError(
        "Invalid WorldRevision: must be a non-negative safe integer"
      );
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
      if (!match)
        throw new RangeError(
          `Invalid SimDate "${String(iso)}": expected YYYY-MM-DD`
        );
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        throw new RangeError(
          `Invalid SimDate "${iso}": not a real calendar date`
        );
      }
      return new _SimDate(daysFromCivil(year, month, day), year, month, day);
    }
    static fromEpochDay(epochDay) {
      if (!Number.isSafeInteger(epochDay))
        throw new RangeError("epochDay must be a safe integer");
      const [y, m, d] = civilFromDays(epochDay);
      if (y < 1 || y > 9999)
        throw new RangeError("SimDate out of supported range (years 1-9999)");
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
      if (!Number.isSafeInteger(n))
        throw new RangeError("addDays requires a safe integer");
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
        if (hasLoneSurrogate(value))
          throw new TypeError(`Lone surrogate in string at ${path}`);
        return JSON.stringify(value);
      case "number":
        if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
          throw new TypeError(
            `Non-canonical number at ${path}: only safe integers (no -0) allowed`
          );
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
        if (hasLoneSurrogate(key))
          throw new TypeError(`Lone surrogate in key at ${path}`);
        parts.push(
          `${JSON.stringify(key)}:${serialize(record[key], ancestors, `${path}.${key}`)}`
        );
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
        out.push(
          224 | cp >> 12,
          128 | cp >> 6 & 63,
          128 | cp & 63
        );
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
  var ACCEPTED_FOR_WORLD_CREATION = [
    "synthetic",
    "verified"
  ];
  var SOURCE_KINDS = [
    "synthetic",
    "licensed",
    "public",
    "derived"
  ];
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
      if (!allowed.has(key))
        throw new ManifestFormatError(`${what}: unexpected field "${key}"`);
    }
  };
  var asString = (value, what, maxLen = 256) => {
    if (typeof value !== "string" || value.length === 0 || value.length > maxLen) {
      throw new ManifestFormatError(
        `${what} must be a non-empty string (max ${maxLen})`
      );
    }
    return value;
  };
  var asSafeInt = (value, what, min, max) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new ManifestFormatError(
        `${what} must be an integer in [${min}, ${max}]`
      );
    }
    return value;
  };
  var INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  var parseProvenance = (value, what = "provenance") => {
    const rec = asRecord(value, what);
    requireExactKeys(
      rec,
      [
        "sourceId",
        "sourceKind",
        "retrievedAt",
        "effectiveAsOf",
        "validationStatus"
      ],
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
      throw new ManifestFormatError(
        `${what}.retrievedAt must be YYYY-MM-DDTHH:MM:SSZ`
      );
    }
    const effectiveAsOf = asString(
      rec.effectiveAsOf,
      `${what}.effectiveAsOf`,
      10
    );
    if (!SimDate.isValidISO(effectiveAsOf)) {
      throw new ManifestFormatError(
        `${what}.effectiveAsOf must be a valid YYYY-MM-DD date`
      );
    }
    const out = {
      sourceId: asString(rec.sourceId, `${what}.sourceId`),
      sourceKind,
      retrievedAt,
      effectiveAsOf,
      validationStatus: status
    };
    if (rec.note !== void 0)
      out.note = asString(rec.note, `${what}.note`, 1024);
    return out;
  };
  var parseProvenanceList = (value, what) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ManifestFormatError(`${what} must be a non-empty array`);
    }
    return value.map((p, i) => parseProvenance(p, `${what}[${i}]`));
  };
  var unacceptableProvenance = (list2, owner) => list2.filter((p) => !ACCEPTED_FOR_WORLD_CREATION.includes(p.validationStatus)).map((p) => ({
    code: "PROVENANCE_NOT_ACCEPTABLE",
    message: `${owner} source "${p.sourceId}" has status "${p.validationStatus}"; only synthetic or verified sources may create a world`
  }));
  var requireSupportedSchema = (rec, what) => {
    const v = rec.schemaVersion;
    if (v === SCHEMA_VERSION) return;
    if (typeof v === "number" && Number.isInteger(v))
      throw new UnsupportedSchemaVersionError(what, v);
    throw new ManifestFormatError(
      `${what}: schemaVersion missing or not an integer`
    );
  };

  // packages/sim-core/src/ruleset.ts
  var BODY_KEYS = [
    "schemaVersion",
    "rulesetId",
    "rulesetVersion",
    "displayName",
    "provenance",
    "rules"
  ];
  var parseBody = (rec) => {
    const rulesId = asString(rec.rulesetId, "ruleset.rulesetId", 128);
    if (!isValidId(rulesId))
      throw new ManifestFormatError("ruleset.rulesetId is not a valid id");
    const rules = asRecord(rec.rules, "ruleset.rules");
    requireExactKeys(rules, ["maxAdvanceDaysPerCommand"], [], "ruleset.rules");
    return {
      schemaVersion: SCHEMA_VERSION,
      rulesetId: rulesId,
      rulesetVersion: asSafeInt(
        rec.rulesetVersion,
        "ruleset.rulesetVersion",
        1,
        1e6
      ),
      displayName: asString(rec.displayName, "ruleset.displayName", 200),
      provenance: parseProvenanceList(rec.provenance, "ruleset.provenance"),
      rules: {
        maxAdvanceDaysPerCommand: asSafeInt(
          rules.maxAdvanceDaysPerCommand,
          "rules.maxAdvanceDaysPerCommand",
          1,
          3650
        )
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
    if (!isHash(stored))
      throw new ManifestFormatError(
        "ruleset.contentHash must be 64 lowercase hex chars"
      );
    const parsed = parseBody(rec);
    if (hashCanonical(bodyOf(parsed)) !== stored) {
      throw new ManifestTamperError(
        `ruleset "${parsed.rulesetId}" v${parsed.rulesetVersion}: content hash mismatch`
      );
    }
    return __spreadProps(__spreadValues({}, parsed), { contentHash: stored });
  };
  var rulesetRefOf = (m) => ({
    rulesetId: m.rulesetId,
    rulesetVersion: m.rulesetVersion,
    contentHash: m.contentHash
  });

  // packages/sim-core/src/people.ts
  var PERSON_ROLES = [
    "owner",
    "general_manager",
    "head_coach",
    "offensive_coordinator",
    "defensive_coordinator",
    "scout",
    "personnel_executive",
    "cap_executive",
    "medical_lead",
    "agent",
    "player",
    "other"
  ];
  var emptyPeopleState = () => ({
    persons: [],
    roleEpisodes: []
  });
  var byText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededPeopleState = (entities, episodes) => ({
    persons: entities.filter((e) => e.kind === "person").map((e) => ({ entityId: e.id, active: true })).sort((a, b) => byText(a.entityId, b.entityId)),
    roleEpisodes: episodes.map((r) => ({
      id: recordId(r.id),
      personId: entityId(r.personId),
      organizationId: entityId(r.organizationId),
      role: r.role,
      title: r.title,
      startDate: r.startDate,
      endDate: r.endDate
    })).sort((a, b) => byText(a.id, b.id))
  });
  var holdsRoleAt = (people, organizationId, personId, date) => people.roleEpisodes.some(
    (e) => e.personId === personId && e.organizationId === organizationId && e.startDate <= date && (e.endDate === null || date <= e.endDate)
  );

  // packages/sim-core/src/authority.ts
  var DECISION_RIGHTS = [
    "propose",
    "advise",
    "approve",
    "veto",
    "execute",
    "communicate"
  ];
  var DECISION_CATEGORIES = [
    "organizational_authority",
    "staff_role",
    "organizational_plan",
    "acquisition",
    "contract",
    "roster",
    "game_day_activation",
    "medical_clearance",
    "workload_usage",
    "major_trade",
    "staff_hiring",
    "scheme"
  ];
  var emptyAuthorityState = () => ({
    grants: [],
    mandates: [],
    protectedConstraints: []
  });
  var seededAuthorityState = (grants) => ({
    grants: grants.map((g) => ({
      id: recordId(g.id),
      personId: entityId(g.personId),
      organizationId: entityId(g.organizationId),
      category: g.category,
      rights: [...g.rights].sort(
        (a, b) => DECISION_RIGHTS.indexOf(a) - DECISION_RIGHTS.indexOf(b)
      ),
      transferable: g.transferable,
      effectiveFrom: g.effectiveFrom,
      effectiveUntil: g.effectiveUntil,
      sourcePersonId: g.sourcePersonId === null ? null : entityId(g.sourcePersonId),
      revision: g.revision
    })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    mandates: [],
    protectedConstraints: []
  });
  var withinInterval = (from, until, date) => from <= date && (until === null || date <= until);
  var inRightsOrder = (set) => DECISION_RIGHTS.filter((r) => set.has(r));
  var NO_RIGHTS = { rights: [], transferableRights: [] };
  var activeRightsAt = (world, organizationId, personId, category, date) => {
    if (!holdsRoleAt(world.people, organizationId, personId, date))
      return NO_RIGHTS;
    const all = /* @__PURE__ */ new Set();
    const transferable = /* @__PURE__ */ new Set();
    for (const g of world.authority.grants) {
      if (g.personId !== personId || g.organizationId !== organizationId || g.category !== category || !withinInterval(g.effectiveFrom, g.effectiveUntil, date))
        continue;
      for (const r of g.rights) {
        all.add(r);
        if (g.transferable) transferable.add(r);
      }
    }
    return {
      rights: inRightsOrder(all),
      transferableRights: inRightsOrder(transferable)
    };
  };
  var asRecord2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v) ? v : null;
  var invalid = (...reasons) => ({
    ok: false,
    outcome: "invalid",
    reasons
  });
  var validateMandateAt = (world, mandateId, date, usage) => {
    const m = world.authority.mandates.find((x) => x.id === mandateId);
    if (m === void 0) return invalid(`mandate ${mandateId} does not exist`);
    if (!m.active) return invalid("mandate is revoked");
    if (!withinInterval(m.effectiveFrom, m.effectiveUntil, date))
      return invalid("mandate is outside its effective interval");
    if (!holdsRoleAt(world.people, m.organizationId, m.delegatorPersonId, date))
      return invalid("delegator no longer holds a role");
    if (!holdsRoleAt(world.people, m.organizationId, m.delegatePersonId, date))
      return invalid("delegate does not hold a role");
    const transferable = new Set(
      activeRightsAt(
        world,
        m.organizationId,
        m.delegatorPersonId,
        m.category,
        date
      ).transferableRights
    );
    const rights = m.allowedRights.filter((r) => transferable.has(r));
    if (rights.length === 0)
      return invalid("delegator no longer holds the transferable rights");
    if (usage !== void 0) {
      const scope = asRecord2(m.scope);
      const keys = scope === null ? null : scope.scopeKeys;
      if (!Array.isArray(keys) || !keys.includes(usage.scopeKey))
        return {
          ok: false,
          outcome: "reject",
          reasons: [`scope ${usage.scopeKey} is outside the mandate`]
        };
      const hard = asRecord2(m.hardConstraints);
      if (hard !== null && typeof hard.maxAmount === "number") {
        if (hard.unit !== usage.unit)
          return {
            ok: false,
            outcome: "reject",
            reasons: [`unit ${usage.unit} does not match ${String(hard.unit)}`]
          };
        if (!Number.isSafeInteger(usage.amount) || usage.amount < 0)
          return {
            ok: false,
            outcome: "reject",
            reasons: ["amount must be a non-negative integer"]
          };
        if (usage.amount > hard.maxAmount) {
          const rules = asRecord2(m.escalationRules);
          const escalate = rules !== null && rules.onExceedsHardConstraint === "escalate";
          return {
            ok: false,
            outcome: escalate ? "escalate" : "reject",
            reasons: [`amount ${usage.amount} exceeds ${hard.maxAmount}`]
          };
        }
      }
    }
    return { ok: true, rights };
  };
  var delegatedRightsAt = (world, organizationId, personId, category, date) => {
    const all = /* @__PURE__ */ new Set();
    for (const m of world.authority.mandates) {
      if (m.organizationId !== organizationId || m.delegatePersonId !== personId || m.category !== category)
        continue;
      const v = validateMandateAt(world, m.id, date);
      if (v.ok) for (const r of v.rights) all.add(r);
    }
    return { rights: inRightsOrder(all) };
  };
  var effectiveRightsAt = (world, organizationId, personId, category, date) => {
    const own = activeRightsAt(world, organizationId, personId, category, date);
    const delegated = delegatedRightsAt(
      world,
      organizationId,
      personId,
      category,
      date
    );
    return {
      rights: inRightsOrder(/* @__PURE__ */ new Set([...own.rights, ...delegated.rights])),
      transferableRights: own.transferableRights
    };
  };
  var isProtectedAt = (world, organizationId, subject, change, date) => {
    const s = canonicalString(subject);
    const c = canonicalString(change);
    return world.authority.protectedConstraints.filter(
      (p) => p.active && p.organizationId === organizationId && withinInterval(p.effectiveFrom, p.effectiveUntil, date) && canonicalString(p.subject) === s && canonicalString(p.prohibitedChange) === c
    );
  };

  // packages/sim-core/src/seed.ts
  var SEED_ENTITY_KINDS = [
    "person",
    "organization"
  ];
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
    requireExactKeys(
      rec,
      ["rulesetId", "rulesetVersion", "contentHash"],
      [],
      "seed.ruleset"
    );
    if (!isHash(rec.contentHash))
      throw new ManifestFormatError(
        "seed.ruleset.contentHash must be a sha256 hex"
      );
    return {
      rulesetId: asString(rec.rulesetId, "seed.ruleset.rulesetId", 128),
      rulesetVersion: asSafeInt(
        rec.rulesetVersion,
        "seed.ruleset.rulesetVersion",
        1,
        1e6
      ),
      contentHash: rec.contentHash
    };
  };
  var parseEntities = (value) => {
    if (!Array.isArray(value))
      throw new ManifestFormatError("seed.initialEntities must be an array");
    return value.map((raw, i) => {
      const rec = asRecord(raw, `seed.initialEntities[${i}]`);
      requireExactKeys(
        rec,
        ["id", "kind", "name"],
        [],
        `seed.initialEntities[${i}]`
      );
      const id = asString(rec.id, `seed.initialEntities[${i}].id`, 128);
      if (!isValidId(id))
        throw new ManifestFormatError(
          `seed.initialEntities[${i}].id is not a valid id`
        );
      if (!SEED_ENTITY_KINDS.includes(rec.kind)) {
        throw new ManifestFormatError(
          `seed.initialEntities[${i}].kind is not recognized`
        );
      }
      return {
        id,
        kind: rec.kind,
        name: asString(rec.name, `seed.initialEntities[${i}].name`, 200)
      };
    });
  };
  var parseSeedId = (value, what) => {
    const id = asString(value, what, 128);
    if (!isValidId(id))
      throw new ManifestFormatError(`${what} is not a valid id`);
    return id;
  };
  var parseSeedDate = (value, what) => {
    const date = asString(value, what, 10);
    if (!SimDate.isValidISO(date))
      throw new ManifestFormatError(`${what} must be a valid YYYY-MM-DD date`);
    return date;
  };
  var parseSeedInterval = (from, until, what) => {
    const start = parseSeedDate(from, `${what} start`);
    const end = until === null ? null : parseSeedDate(until, `${what} end`);
    if (end !== null && end < start)
      throw new ManifestFormatError(`${what}: end date precedes start date`);
    return { from: start, until: end };
  };
  var parseRoleEpisodes = (value) => {
    if (!Array.isArray(value))
      throw new ManifestFormatError(
        "seed.organizationSubstrate.roleEpisodes must be an array"
      );
    return value.map((raw, i) => {
      const what = `seed.organizationSubstrate.roleEpisodes[${i}]`;
      const rec = asRecord(raw, what);
      requireExactKeys(
        rec,
        [
          "id",
          "personId",
          "organizationId",
          "role",
          "title",
          "startDate",
          "endDate"
        ],
        [],
        what
      );
      if (!PERSON_ROLES.includes(rec.role))
        throw new ManifestFormatError(`${what}.role is not recognized`);
      const span = parseSeedInterval(rec.startDate, rec.endDate, what);
      return {
        id: parseSeedId(rec.id, `${what}.id`),
        personId: parseSeedId(rec.personId, `${what}.personId`),
        organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
        role: rec.role,
        title: asString(rec.title, `${what}.title`, 200),
        startDate: span.from,
        endDate: span.until
      };
    });
  };
  var parseAuthorityGrants = (value) => {
    if (!Array.isArray(value))
      throw new ManifestFormatError(
        "seed.organizationSubstrate.authorityGrants must be an array"
      );
    return value.map((raw, i) => {
      const what = `seed.organizationSubstrate.authorityGrants[${i}]`;
      const rec = asRecord(raw, what);
      requireExactKeys(
        rec,
        [
          "id",
          "personId",
          "organizationId",
          "category",
          "rights",
          "transferable",
          "effectiveFrom",
          "effectiveUntil",
          "sourcePersonId",
          "revision"
        ],
        [],
        what
      );
      if (!DECISION_CATEGORIES.includes(rec.category))
        throw new ManifestFormatError(`${what}.category is not recognized`);
      if (!Array.isArray(rec.rights) || rec.rights.length === 0)
        throw new ManifestFormatError(`${what}.rights must be a non-empty array`);
      const rights = rec.rights.map((r) => {
        if (!DECISION_RIGHTS.includes(r))
          throw new ManifestFormatError(`${what}.rights has an unknown right`);
        return r;
      });
      if (new Set(rights).size !== rights.length)
        throw new ManifestFormatError(`${what}.rights has duplicates`);
      if (typeof rec.transferable !== "boolean")
        throw new ManifestFormatError(`${what}.transferable must be a boolean`);
      const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
      return {
        id: parseSeedId(rec.id, `${what}.id`),
        personId: parseSeedId(rec.personId, `${what}.personId`),
        organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
        category: rec.category,
        rights,
        transferable: rec.transferable,
        effectiveFrom: span.from,
        effectiveUntil: span.until,
        sourcePersonId: rec.sourcePersonId === null ? null : parseSeedId(rec.sourcePersonId, `${what}.sourcePersonId`),
        revision: asSafeInt(rec.revision, `${what}.revision`, 1, 1e6)
      };
    });
  };
  var parseSubstrate = (value) => {
    const rec = asRecord(value, "seed.organizationSubstrate");
    requireExactKeys(
      rec,
      ["roleEpisodes", "authorityGrants"],
      [],
      "seed.organizationSubstrate"
    );
    return {
      roleEpisodes: parseRoleEpisodes(rec.roleEpisodes),
      authorityGrants: parseAuthorityGrants(rec.authorityGrants)
    };
  };
  var parseBody2 = (rec) => {
    const seedId = asString(rec.seedId, "seed.seedId", 128);
    if (!isValidId(seedId))
      throw new ManifestFormatError("seed.seedId is not a valid id");
    const startDate = asString(rec.startDate, "seed.startDate", 10);
    if (!SimDate.isValidISO(startDate))
      throw new ManifestFormatError("seed.startDate must be a valid YYYY-MM-DD");
    const substrate = rec.organizationSubstrate === void 0 ? {} : { organizationSubstrate: parseSubstrate(rec.organizationSubstrate) };
    return __spreadProps(__spreadValues({}, substrate), {
      schemaVersion: SCHEMA_VERSION,
      seedId,
      seedVersion: asSafeInt(rec.seedVersion, "seed.seedVersion", 1, 1e6),
      ruleset: parseRulesetRef(rec.ruleset),
      rngSeed32: asSafeInt(rec.rngSeed32, "seed.rngSeed32", 0, 4294967295),
      startDate,
      provenance: parseProvenanceList(rec.provenance, "seed.provenance"),
      initialEntities: parseEntities(rec.initialEntities)
    });
  };
  var bodyOf2 = (m) => __spreadValues({
    schemaVersion: m.schemaVersion,
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    ruleset: m.ruleset,
    rngSeed32: m.rngSeed32,
    startDate: m.startDate,
    provenance: m.provenance,
    initialEntities: m.initialEntities
  }, m.organizationSubstrate === void 0 ? {} : { organizationSubstrate: m.organizationSubstrate });
  var sealSeed = (body) => {
    const rec = asRecord(body, "seed body");
    requireExactKeys(rec, BODY_KEYS2, ["organizationSubstrate"], "seed body");
    requireSupportedSchema(rec, "seed");
    const parsed = parseBody2(rec);
    return __spreadProps(__spreadValues({}, parsed), { contentHash: hashCanonical(bodyOf2(parsed)) });
  };
  var validateSeedManifest = (value) => {
    const rec = asRecord(value, "seed manifest");
    requireSupportedSchema(rec, "seed");
    requireExactKeys(
      rec,
      [...BODY_KEYS2, "contentHash"],
      ["organizationSubstrate"],
      "seed manifest"
    );
    const stored = rec.contentHash;
    if (!isHash(stored))
      throw new ManifestFormatError(
        "seed.contentHash must be 64 lowercase hex chars"
      );
    const parsed = parseBody2(rec);
    if (hashCanonical(bodyOf2(parsed)) !== stored) {
      throw new ManifestTamperError(
        `seed "${parsed.seedId}" v${parsed.seedVersion}: content hash mismatch`
      );
    }
    return __spreadProps(__spreadValues({}, parsed), { contentHash: stored });
  };
  var seedRefOf = (m) => ({
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    contentHash: m.contentHash
  });
  var END_OF_TIME = "9999-12-31";
  var substrateIssues = (seed) => {
    var _a, _b, _c;
    const sub = seed.organizationSubstrate;
    if (sub === void 0) return [];
    const issues = [];
    const kinds = new Map(seed.initialEntities.map((e) => [e.id, e.kind]));
    const requireKind = (ref, expected, where) => {
      const kind = kinds.get(ref);
      if (kind === void 0)
        issues.push({
          code: "SEED_SUBSTRATE_UNKNOWN_ENTITY",
          message: `${where} references unknown entity "${ref}"`
        });
      else if (kind !== expected)
        issues.push({
          code: "SEED_SUBSTRATE_WRONG_ENTITY_KIND",
          message: `${where} references "${ref}" as a ${expected}, but it is a ${kind}`
        });
    };
    const seenIds = /* @__PURE__ */ new Set();
    const claimId = (id, where) => {
      if (seenIds.has(id))
        issues.push({
          code: "SEED_SUBSTRATE_DUPLICATE_ID",
          message: `${where} reuses record id "${id}"`
        });
      seenIds.add(id);
    };
    for (const r of sub.roleEpisodes) {
      const where = `role episode "${r.id}"`;
      claimId(r.id, where);
      requireKind(r.personId, "person", where);
      requireKind(r.organizationId, "organization", where);
    }
    for (const g of sub.authorityGrants) {
      const where = `authority grant "${g.id}"`;
      claimId(g.id, where);
      requireKind(g.personId, "person", where);
      requireKind(g.organizationId, "organization", where);
      if (g.sourcePersonId !== null)
        requireKind(g.sourcePersonId, "person", where);
    }
    const groups = /* @__PURE__ */ new Map();
    for (const r of sub.roleEpisodes) {
      const key = `${r.personId}|${r.organizationId}|${r.role}`;
      groups.set(key, [...(_a = groups.get(key)) != null ? _a : [], r]);
    }
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (a.startDate <= ((_b = b.endDate) != null ? _b : END_OF_TIME) && b.startDate <= ((_c = a.endDate) != null ? _c : END_OF_TIME))
            issues.push({
              code: "SEED_SUBSTRATE_OVERLAPPING_ROLE",
              message: `role episodes "${a.id}" and "${b.id}" overlap for ${a.personId} as ${a.role} in ${a.organizationId}`
            });
        }
      }
    }
    return issues;
  };
  var classify = (e, prefix, hashCode) => {
    if (e instanceof UnsupportedSchemaVersionError) {
      return { code: `${prefix}_UNSUPPORTED_SCHEMA`, message: e.message };
    }
    if (e instanceof ManifestTamperError)
      return { code: hashCode, message: e.message };
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
    if (ruleset)
      issues.push(...unacceptableProvenance(ruleset.provenance, "ruleset"));
    if (seed) {
      issues.push(...unacceptableProvenance(seed.provenance, "seed"));
      const seen = /* @__PURE__ */ new Set();
      for (const entity of seed.initialEntities) {
        if (seen.has(entity.id)) {
          issues.push({
            code: "SEED_DUPLICATE_ENTITY",
            message: `duplicate initial entity id "${entity.id}"`
          });
        }
        seen.add(entity.id);
      }
      issues.push(...substrateIssues(seed));
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
      throw new RangeError(
        `Unsupported RNG algorithm; expected ${RNG_ALGORITHM}`
      );
    }
    if (!isU32(state.s0) || !isU32(state.s1) || !isU32(state.s2) || !isU32(state.s3)) {
      throw new RangeError("RNG state words must be uint32 integers");
    }
    if (state.s0 === 0 && state.s1 === 0 && state.s2 === 0 && state.s3 === 0) {
      throw new RangeError("RNG state must not be all zero");
    }
    if (!Number.isSafeInteger(state.draws) || state.draws < 0) {
      throw new RangeError(
        "RNG draw counter must be a non-negative safe integer"
      );
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
      if (!isU32(seed32))
        throw new RangeError("RNG seed must be a uint32 integer");
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

  // packages/sim-core/src/freeze.ts
  var deepFreeze = (value) => {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (const key of Object.keys(value))
        deepFreeze(value[key]);
    }
    return value;
  };

  // packages/sim-core/src/decisions.ts
  var TERMINAL_PROPOSAL_STATES = [
    "committed",
    "rejected",
    "withdrawn",
    "expired"
  ];
  var isTerminalProposalState = (state) => TERMINAL_PROPOSAL_STATES.includes(state);
  var emptyDecisionsState = () => ({
    proposals: [],
    approvals: [],
    receipts: []
  });
  var latestProposal = (decisions, id) => {
    let best;
    for (const p of decisions.proposals)
      if (p.id === id && (best === void 0 || p.revision > best.revision))
        best = p;
    return best;
  };
  var proposalTermsHash = (p) => hashCanonical({
    category: p.category,
    subjects: p.subjects,
    termsType: p.termsType,
    terms: p.terms
  });
  var isProposalLiveAt = (p, date) => p.expiresAt === null || date < p.expiresAt;
  var byText2 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var rightBackingAt = (world, organizationId, personId, category, right, date) => {
    const grantsFor = (holder, transferableOnly) => holdsRoleAt(world.people, organizationId, holder, date) ? world.authority.grants.filter(
      (g) => g.personId === holder && g.organizationId === organizationId && g.category === category && g.rights.includes(right) && (!transferableOnly || g.transferable) && g.effectiveFrom <= date && (g.effectiveUntil === null || date <= g.effectiveUntil)
    ).map((g) => g.id).sort(byText2) : [];
    const own = grantsFor(personId, false);
    if (own.length > 0) return { grantIds: own, mandateId: null };
    const mandates = [...world.authority.mandates].sort(
      (a, b) => byText2(a.id, b.id)
    );
    for (const m of mandates) {
      if (m.organizationId !== organizationId || m.delegatePersonId !== personId || m.category !== category)
        continue;
      const verdict = validateMandateAt(world, m.id, date);
      if (!verdict.ok || !verdict.rights.includes(right)) continue;
      const backing = grantsFor(m.delegatorPersonId, true);
      if (backing.length > 0) return { grantIds: backing, mandateId: m.id };
    }
    return null;
  };
  var evaluateProposalAuthority = (world, proposal, date) => {
    const valid = world.decisions.approvals.filter(
      (a) => a.proposalId === proposal.id && a.active && a.right === "approve" && a.termsHash === proposal.termsHash
    ).map((a) => ({
      approval: a,
      backing: rightBackingAt(
        world,
        proposal.organizationId,
        a.approverPersonId,
        proposal.category,
        "approve",
        date
      )
    }));
    const counting = valid.filter((v) => v.backing !== null);
    const countedIds = counting.map((v) => v.approval.id).sort(byText2);
    const grantsOf = (items) => [...new Set(items.flatMap((v) => v.backing.grantIds))].sort(byText2);
    if (proposal.requiredApproverPersonIds.length > 0) {
      const missing = proposal.requiredApproverPersonIds.filter(
        (p) => !counting.some((v) => v.approval.approverPersonId === p)
      );
      if (missing.length > 0)
        return {
          satisfied: false,
          basis: null,
          approvalIds: countedIds,
          grantIds: [],
          reasons: missing.map(
            (p) => `${p} has no current approval of this revision`
          )
        };
      return {
        satisfied: true,
        basis: "approvals",
        approvalIds: countedIds,
        grantIds: grantsOf(counting),
        reasons: []
      };
    }
    const own = rightBackingAt(
      world,
      proposal.organizationId,
      proposal.authorPersonId,
      proposal.category,
      "approve",
      date
    );
    if (own !== null)
      return {
        satisfied: true,
        basis: "author_rights",
        approvalIds: [],
        grantIds: [...own.grantIds],
        reasons: []
      };
    if (counting.length > 0)
      return {
        satisfied: true,
        basis: "approvals",
        approvalIds: countedIds,
        grantIds: grantsOf(counting),
        reasons: []
      };
    return {
      satisfied: false,
      basis: null,
      approvalIds: [],
      grantIds: [],
      reasons: [
        "no approver currently holds the approve right for this revision"
      ]
    };
  };

  // packages/sim-core/src/information.ts
  var emptyInformationState = () => ({
    claims: [],
    beliefs: []
  });

  // packages/sim-core/src/organizations.ts
  var emptyOrganizationsState = () => ({
    organizations: []
  });
  var seededOrganizationsState = (entities) => ({
    organizations: entities.filter((e) => e.kind === "organization").map((e) => ({ entityId: e.id, active: true })).sort(
      (a, b) => a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0
    )
  });

  // packages/sim-core/src/plans.ts
  var PLAN_KINDS = [
    "strategy",
    "roster_group",
    "succession",
    "acquisition",
    "staff"
  ];
  var emptyPlansState = () => ({ plans: [] });

  // packages/sim-core/src/relationships.ts
  var RELATIONSHIP_LEVELS = [
    "none",
    "low",
    "moderate",
    "high",
    "very_high"
  ];
  var RELATIONSHIP_DIMENSIONS = [
    "trust",
    "professionalRespect",
    "familiarity",
    "alignment",
    "access",
    "tension"
  ];
  var emptyRelationshipsState = () => ({
    edges: [],
    effects: []
  });
  var compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var orderParties = (a, b) => (compareText(a.kind, b.kind) || compareText(a.entityId, b.entityId)) <= 0 ? [a, b] : [b, a];
  var findRelationshipEdge = (state, a, b) => {
    const [first, second] = orderParties(a, b);
    return state.edges.find(
      (e) => e.partyA.kind === first.kind && e.partyA.entityId === first.entityId && e.partyB.kind === second.kind && e.partyB.entityId === second.entityId
    );
  };

  // packages/sim-core/src/worldModel.ts
  var WORLD_MODEL_VERSION = 2;
  var DOMAIN_STATE_KEYS = {
    people: ["persons", "roleEpisodes"],
    organizations: ["organizations"],
    authority: ["grants", "mandates", "protectedConstraints"],
    information: ["claims", "beliefs"],
    relationships: ["edges", "effects"],
    plans: ["plans"],
    decisions: ["proposals", "approvals", "receipts"]
  };
  var DOMAIN_NAMES = Object.keys(DOMAIN_STATE_KEYS);
  var LEGACY_KEYS = [
    "schemaVersion",
    "worldId",
    "ruleset",
    "seed",
    "simDate",
    "revision",
    "rng",
    "nextIds",
    "entities"
  ];
  var CURRENT_KEYS = [
    "schemaVersion",
    "worldModelVersion",
    "worldId",
    "ruleset",
    "seed",
    "simDate",
    "revision",
    "rng",
    "nextIds",
    "entities",
    ...DOMAIN_NAMES
  ];
  var UnsupportedWorldModelVersionError = class extends Error {
    constructor(what, found) {
      super(
        `Unsupported ${what} world model version ${String(found)}; this build supports only world model ${WORLD_MODEL_VERSION} (and migrates Package A world model 1)`
      );
      __publicField(this, "found");
      this.name = "UnsupportedWorldModelVersionError";
      this.found = found;
    }
  };
  var InvalidWorldModelError = class extends Error {
    constructor(problems) {
      super(`Invalid world model: ${problems.join("; ")}`);
      __publicField(this, "problems");
      this.name = "InvalidWorldModelError";
      this.problems = problems;
    }
  };
  var isPlain = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  var isCount = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 1;
  var keyProblems = (value, expected, what) => {
    const out = [];
    for (const k of expected)
      if (!(k in value) || value[k] === void 0)
        out.push(`${what}: missing "${k}"`);
    for (const k of Object.keys(value))
      if (!expected.includes(k)) out.push(`${what}: unexpected "${k}"`);
    return out;
  };
  var isLegacyPackageAWorld = (value) => {
    if (!isPlain(value)) return false;
    if (keyProblems(value, LEGACY_KEYS, "world").length > 0) return false;
    if (value.schemaVersion !== SCHEMA_VERSION) return false;
    const ids = value.nextIds;
    if (!isPlain(ids) || keyProblems(ids, ["event"], "nextIds").length > 0)
      return false;
    return isCount(ids.event) && typeof value.simDate === "string" && Array.isArray(value.entities) && isPlain(value.rng) && isPlain(value.ruleset) && isPlain(value.seed);
  };
  var futureWorldModelVersion = (value) => {
    if (!isPlain(value)) return null;
    const v = value.worldModelVersion;
    return typeof v === "number" && Number.isInteger(v) && v > WORLD_MODEL_VERSION ? v : null;
  };
  var worldModelProblems = (value) => {
    if (!isPlain(value)) return ["world is not an object"];
    if (!("worldModelVersion" in value))
      return ["worldModelVersion missing: not a current-model world"];
    const problems = [];
    if (value.worldModelVersion !== WORLD_MODEL_VERSION)
      problems.push(`worldModelVersion must be ${WORLD_MODEL_VERSION}`);
    problems.push(...keyProblems(value, CURRENT_KEYS, "world"));
    if (value.schemaVersion !== SCHEMA_VERSION)
      problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
    const ids = value.nextIds;
    if (!isPlain(ids)) problems.push("nextIds missing");
    else {
      problems.push(...keyProblems(ids, ["event", "record"], "nextIds"));
      if (!isCount(ids.event)) problems.push("nextIds.event invalid");
      if (!isCount(ids.record)) problems.push("nextIds.record invalid");
    }
    for (const domain of DOMAIN_NAMES) {
      const state = value[domain];
      const collections = DOMAIN_STATE_KEYS[domain];
      if (!isPlain(state)) {
        problems.push(`${domain}: state missing`);
        continue;
      }
      problems.push(...keyProblems(state, collections, domain));
      for (const c of collections)
        if (c in state && !Array.isArray(state[c]))
          problems.push(`${domain}.${c} must be an array`);
    }
    return problems;
  };
  var assertCurrentWorld = (value) => {
    const future = futureWorldModelVersion(value);
    if (future !== null)
      throw new UnsupportedWorldModelVersionError("world", future);
    const problems = worldModelProblems(value);
    if (problems.length > 0) throw new InvalidWorldModelError(problems);
    return value;
  };
  var migrateLegacyPackageAWorld = (world) => {
    if (!isLegacyPackageAWorld(world))
      throw new InvalidWorldModelError([
        "only a genuine Package A world model 1 can be migrated"
      ]);
    const w = JSON.parse(canonicalString(world));
    return deepFreeze({
      schemaVersion: w.schemaVersion,
      worldModelVersion: WORLD_MODEL_VERSION,
      worldId: w.worldId,
      ruleset: w.ruleset,
      seed: w.seed,
      simDate: w.simDate,
      revision: w.revision,
      rng: w.rng,
      nextIds: { event: w.nextIds.event, record: 1 },
      entities: w.entities,
      people: emptyPeopleState(),
      organizations: emptyOrganizationsState(),
      authority: emptyAuthorityState(),
      information: emptyInformationState(),
      relationships: emptyRelationshipsState(),
      plans: emptyPlansState(),
      decisions: emptyDecisionsState()
    });
  };
  var requireCurrentWorld = (value) => isLegacyPackageAWorld(value) ? migrateLegacyPackageAWorld(value) : assertCurrentWorld(value);

  // packages/sim-core/src/world.ts
  var WorldCreationError = class extends Error {
    constructor(issues) {
      super(
        `Cannot create world: ${issues.map((i) => `${i.code} (${i.message})`).join("; ")}`
      );
      __publicField(this, "issues");
      this.name = "WorldCreationError";
      this.issues = issues;
    }
  };
  var createWorld = (seedIn, rulesetIn, idSource) => {
    var _a;
    const verdict = validateForWorldCreation(seedIn, rulesetIn);
    if (!verdict.ok) throw new WorldCreationError(verdict.issues);
    const ruleset = validateRulesetManifest(rulesetIn);
    const seed = validateSeedManifest(seedIn);
    const entities = seed.initialEntities.map((e) => ({ id: entityId(e.id), kind: e.kind, name: e.name })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const substrate = (_a = seed.organizationSubstrate) != null ? _a : {
      roleEpisodes: [],
      authorityGrants: []
    };
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      worldModelVersion: WORLD_MODEL_VERSION,
      worldId: worldId(idSource.newWorldId()),
      ruleset: rulesetRefOf(ruleset),
      seed: seedRefOf(seed),
      simDate: seed.startDate,
      revision: worldRevision(0),
      rng: DeterministicRng.fromSeed(seed.rngSeed32).snapshot(),
      nextIds: { event: 1, record: 1 },
      entities,
      people: seededPeopleState(entities, substrate.roleEpisodes),
      organizations: seededOrganizationsState(entities),
      authority: seededAuthorityState(substrate.authorityGrants),
      information: emptyInformationState(),
      relationships: emptyRelationshipsState(),
      plans: emptyPlansState(),
      decisions: emptyDecisionsState()
    });
  };
  var fingerprintWorld = (world) => hashCanonical({ domain: "sport-sim/world-fingerprint", version: 2, world });

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
    if (!isHash(previousHash))
      throw new TypeError("previousHash must be 64 lowercase hex chars");
    if (!isBodyShaped(body)) throw new TypeError("malformed event body");
    return deepFreeze(__spreadProps(__spreadValues({}, bodyOf3(body)), {
      previousHash,
      hash: hashEvent(previousHash, body)
    }));
  };
  var chainEvents = (previousHash, bodies) => {
    const out = [];
    let link = previousHash;
    for (const body of bodies) {
      const event = chainEvent(link, body);
      out.push(event);
      link = event.hash;
    }
    return out;
  };

  // packages/sim-core/src/commandSupport.ts
  var bad = (message) => ({
    ok: false,
    stage: "validation",
    code: "INVALID_PAYLOAD",
    message
  });
  var denied = (message) => ({
    ok: false,
    stage: "authorization",
    code: "INSUFFICIENT_AUTHORITY",
    message
  });
  var protectedBy = (message) => ({
    ok: false,
    stage: "authorization",
    code: "PROTECTED_CONSTRAINT",
    message
  });
  var isFailure = (v) => typeof v === "object" && v !== null && "ok" in v;
  var byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var dayBefore = (date) => SimDate.parse(date).addDays(-1).toISO();
  var dayAfter = (date) => SimDate.parse(date).addDays(1).toISO();
  var isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
  var nonEmptyText = (v, max = 200) => typeof v === "string" && v.length > 0 && v.length <= max;
  var hasKind = (world, id, kind) => world.entities.some((e) => e.id === id && e.kind === kind);
  var parseDate = (v, label) => SimDate.isValidISO(v) ? v : bad(`${label} must be a YYYY-MM-DD date`);
  var parseActingPerson = (ctx, c) => isValidId(c.actingPersonId) && hasKind(ctx.world, c.actingPersonId, "person") ? entityId(c.actingPersonId) : bad("actingPersonId must name an existing person");
  var parseOrganization = (ctx, value) => isValidId(value) && hasKind(ctx.world, value, "organization") ? entityId(value) : bad("organizationId must name an existing organization");
  var requireExecute = (world, organizationId, personId) => effectiveRightsAt(
    world,
    organizationId,
    personId,
    "organizational_authority",
    world.simDate
  ).rights.includes("execute") ? null : denied(
    `${personId} lacks execute on organizational_authority in ${organizationId}`
  );
  var takenRecordIds = (world) => /* @__PURE__ */ new Set([
    ...world.people.roleEpisodes.map((x) => x.id),
    ...world.authority.grants.map((x) => x.id),
    ...world.authority.mandates.map((x) => x.id),
    ...world.authority.protectedConstraints.map((x) => x.id),
    ...world.information.claims.map((x) => x.id),
    ...world.information.beliefs.map((x) => x.id),
    ...world.relationships.edges.map((x) => x.id),
    ...world.relationships.effects.map((x) => x.id),
    ...world.plans.plans.map((x) => x.id),
    ...world.decisions.proposals.map((x) => x.id),
    ...world.decisions.approvals.map((x) => x.id),
    ...world.decisions.receipts.map((x) => x.id)
  ]);
  var mintRecordIds = (world, count) => {
    const taken = takenRecordIds(world);
    const ids = [];
    let n = world.nextIds.record;
    while (ids.length < count) {
      const id = `rec-${String(n).padStart(6, "0")}`;
      n += 1;
      if (!taken.has(id)) ids.push(recordId(id));
    }
    return { ids, next: n };
  };
  var mintRecordId = (world) => {
    const minted = mintRecordIds(world, 1);
    return { id: minted.ids[0], next: minted.next };
  };
  var finish = (ctx, changes, eventSpecs, detail, authorizationDetail) => {
    var _a, _b, _c, _d, _e, _f;
    return {
      ok: true,
      authorizationDetail,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, ctx.world), {
          people: (_a = changes.people) != null ? _a : ctx.world.people,
          authority: (_b = changes.authority) != null ? _b : ctx.world.authority,
          information: (_c = changes.information) != null ? _c : ctx.world.information,
          relationships: (_d = changes.relationships) != null ? _d : ctx.world.relationships,
          decisions: (_e = changes.decisions) != null ? _e : ctx.world.decisions,
          nextIds: __spreadProps(__spreadValues({}, ctx.world.nextIds), {
            record: (_f = changes.nextRecord) != null ? _f : ctx.world.nextIds.record
          })
        }),
        eventSpecs,
        detail
      }
    };
  };
  var spec = (type, payload) => ({
    type,
    payload
  });

  // packages/sim-core/src/authorityCommands.ts
  var parseRights = (v, label) => {
    if (!Array.isArray(v) || v.length === 0)
      return bad(`${label} must be a non-empty array of rights`);
    const seen = /* @__PURE__ */ new Set();
    for (const r of v) {
      if (!DECISION_RIGHTS.includes(r))
        return bad(`${label} contains an unknown right`);
      if (seen.has(r))
        return bad(`${label} contains a duplicate right`);
      seen.add(r);
    }
    return DECISION_RIGHTS.filter((r) => seen.has(r));
  };
  var parseCategory = (v) => DECISION_CATEGORIES.includes(v) ? v : bad("category is not a known decision category");
  var routeStartRole = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.personId) || !hasKind(world, c.personId, "person"))
      return bad("personId must name an existing person");
    const person = entityId(c.personId);
    if (!PERSON_ROLES.includes(c.role))
      return bad("role is not a known role");
    const role = c.role;
    if (!nonEmptyText(c.title, 120)) return bad("title must be 1-120 characters");
    let startDate = today;
    if (c.startDate !== void 0) {
      const d = parseDate(c.startDate, "startDate");
      if (isFailure(d)) return d;
      if (d < today) return bad("a role cannot start in the past");
      startDate = d;
    }
    const overlaps = world.people.roleEpisodes.some(
      (e) => e.personId === person && e.organizationId === org && e.role === role && (e.endDate === null || e.endDate >= startDate)
    );
    if (overlaps) return bad("the person already holds or will hold that role");
    const noRight = requireExecute(world, org, by);
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const episode = {
      id: minted.id,
      personId: person,
      organizationId: org,
      role,
      title: c.title,
      startDate,
      endDate: null
    };
    const roleEpisodes = [...world.people.roleEpisodes, episode].sort(byId);
    return finish(
      ctx,
      { people: __spreadProps(__spreadValues({}, world.people), { roleEpisodes }), nextRecord: minted.next },
      [
        spec("RoleEpisodeStarted", {
          actingPersonId: by,
          episode: __spreadValues({}, episode)
        })
      ],
      `${person} starts ${role} in ${org}`,
      `${by} may execute organizational_authority`
    );
  };
  var routeEndRole = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const episode = world.people.roleEpisodes.find((e) => e.id === c.episodeId);
    if (episode === void 0)
      return bad("episodeId does not name a role episode");
    if (episode.endDate !== null && episode.endDate < today)
      return bad("the role episode has already ended");
    let endDate = dayBefore(today);
    if (c.lastDay !== void 0) {
      const d = parseDate(c.lastDay, "lastDay");
      if (isFailure(d)) return d;
      if (d < endDate) return bad("lastDay cannot be before yesterday");
      endDate = d;
    }
    if (episode.endDate !== null && endDate >= episode.endDate)
      return bad("the role episode already ends on or before that day");
    const noRight = requireExecute(world, episode.organizationId, by);
    if (noRight !== null) return noRight;
    if (isProtectedAt(
      world,
      episode.organizationId,
      { kind: "role_episode", id: episode.id },
      { action: "end" },
      today
    ).length > 0)
      return protectedBy(`role episode ${episode.id} is protected from ending`);
    const ended = __spreadProps(__spreadValues({}, episode), { endDate });
    const roleEpisodes = world.people.roleEpisodes.map(
      (e) => e.id === episode.id ? ended : e
    );
    const specs = [
      spec("RoleEpisodeEnded", { actingPersonId: by, episode: __spreadValues({}, ended) })
    ];
    const next = dayAfter(endDate);
    const stillHolds = world.people.roleEpisodes.some(
      (e) => e.id !== episode.id && e.personId === episode.personId && e.organizationId === episode.organizationId && e.startDate <= next && (e.endDate === null || e.endDate >= next)
    );
    let authority = world.authority;
    if (!stillHolds) {
      const grants = world.authority.grants.map((g) => {
        if (g.personId !== episode.personId || g.organizationId !== episode.organizationId || g.effectiveUntil !== null && g.effectiveUntil <= endDate)
          return g;
        const updated = __spreadProps(__spreadValues({}, g), {
          effectiveUntil: endDate,
          revision: g.revision + 1
        });
        specs.push(
          spec("AuthorityRevoked", {
            cause: "role_ended",
            roleEpisodeId: episode.id,
            grant: __spreadValues({}, updated)
          })
        );
        return updated;
      });
      const mandates = world.authority.mandates.map((m) => {
        const involved = m.delegatorPersonId === episode.personId || m.delegatePersonId === episode.personId;
        if (m.organizationId !== episode.organizationId || !involved || !m.active || m.effectiveUntil !== null && m.effectiveUntil <= endDate)
          return m;
        const updated = endDate < today ? __spreadProps(__spreadValues({}, m), { active: false, revision: m.revision + 1 }) : __spreadProps(__spreadValues({}, m), { effectiveUntil: endDate, revision: m.revision + 1 });
        specs.push(
          spec("MandateRevoked", {
            cause: "role_ended",
            roleEpisodeId: episode.id,
            mandate: __spreadValues({}, updated)
          })
        );
        return updated;
      });
      authority = __spreadProps(__spreadValues({}, world.authority), { grants, mandates });
    }
    return finish(
      ctx,
      { people: __spreadProps(__spreadValues({}, world.people), { roleEpisodes }), authority },
      specs,
      `${episode.personId} role ${episode.id} ends ${endDate}`,
      `${by} may execute organizational_authority`
    );
  };
  var parseValidity = (c, today) => {
    let from = today;
    if (c.effectiveFrom !== void 0) {
      const d = parseDate(c.effectiveFrom, "effectiveFrom");
      if (isFailure(d)) return d;
      if (d < today) return bad("authority cannot start in the past");
      from = d;
    }
    let until = null;
    if (c.effectiveUntil !== void 0 && c.effectiveUntil !== null) {
      const d = parseDate(c.effectiveUntil, "effectiveUntil");
      if (isFailure(d)) return d;
      if (d < from) return bad("effectiveUntil cannot precede effectiveFrom");
      until = d;
    }
    return { from, until };
  };
  var routeGrant = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.personId) || !hasKind(world, c.personId, "person"))
      return bad("personId must name an existing person");
    const category = parseCategory(c.category);
    if (isFailure(category)) return category;
    const rights = parseRights(c.rights, "rights");
    if (isFailure(rights)) return rights;
    if (c.transferable !== void 0 && typeof c.transferable !== "boolean")
      return bad("transferable must be a boolean");
    const validity = parseValidity(c, world.simDate);
    if (isFailure(validity)) return validity;
    const noRight = requireExecute(world, org, by);
    if (noRight !== null) return noRight;
    const mine = activeRightsAt(world, org, by, category, world.simDate);
    const missing = rights.filter((r) => !mine.transferableRights.includes(r));
    if (missing.length > 0)
      return denied(
        `${by} cannot transfer ${missing.join(", ")} on ${category}: only transferable rights can be granted`
      );
    const minted = mintRecordId(world);
    const grant = {
      id: minted.id,
      personId: entityId(c.personId),
      organizationId: org,
      category,
      rights,
      transferable: c.transferable === true,
      effectiveFrom: validity.from,
      effectiveUntil: validity.until,
      sourcePersonId: by,
      revision: 1
    };
    const grants = [...world.authority.grants, grant].sort(byId);
    return finish(
      ctx,
      { authority: __spreadProps(__spreadValues({}, world.authority), { grants }), nextRecord: minted.next },
      [spec("AuthorityGranted", { actingPersonId: by, grant: __spreadValues({}, grant) })],
      `${by} grants ${rights.join(",")} on ${category} to ${grant.personId}`,
      `${by} may execute organizational_authority and transfer the granted rights`
    );
  };
  var routeRevokeGrant = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const grant = world.authority.grants.find((g) => g.id === c.grantId);
    if (grant === void 0) return bad("grantId does not name a grant");
    if (grant.effectiveUntil !== null && grant.effectiveUntil < today)
      return bad("the grant has already ended");
    const noRight = requireExecute(world, grant.organizationId, by);
    if (noRight !== null) return noRight;
    if (isProtectedAt(
      world,
      grant.organizationId,
      { kind: "authority_grant", id: grant.id },
      { action: "revoke" },
      today
    ).length > 0)
      return protectedBy(`grant ${grant.id} is protected from revocation`);
    const updated = __spreadProps(__spreadValues({}, grant), {
      effectiveUntil: dayBefore(today),
      revision: grant.revision + 1
    });
    const grants = world.authority.grants.map(
      (g) => g.id === grant.id ? updated : g
    );
    return finish(
      ctx,
      { authority: __spreadProps(__spreadValues({}, world.authority), { grants }) },
      [
        spec("AuthorityRevoked", {
          cause: "revoked",
          actingPersonId: by,
          grant: __spreadValues({}, updated)
        })
      ],
      `${by} revokes grant ${grant.id}`,
      `${by} may execute organizational_authority`
    );
  };
  var parseMandateBody = (c) => {
    const scope = c.scope;
    if (!isPlainObject(scope) || !Array.isArray(scope.scopeKeys) || scope.scopeKeys.length === 0 || !scope.scopeKeys.every((k) => nonEmptyText(k, 64)) || new Set(scope.scopeKeys).size !== scope.scopeKeys.length)
      return bad("scope must be an object with unique non-empty scopeKeys");
    const hard = c.hardConstraints;
    if (!isPlainObject(hard)) return bad("hardConstraints must be an object");
    if (Object.keys(hard).length > 0) {
      if (!nonEmptyText(hard.unit, 64) || typeof hard.maxAmount !== "number" || !Number.isSafeInteger(hard.maxAmount) || hard.maxAmount < 0)
        return bad(
          "hardConstraints needs a unit and a non-negative integer maxAmount"
        );
    }
    const { preferences, fallback, escalationRules } = c;
    if (!isPlainObject(preferences)) return bad("preferences must be an object");
    if (!isPlainObject(fallback)) return bad("fallback must be an object");
    if (!isPlainObject(escalationRules))
      return bad("escalationRules must be an object");
    const rule = escalationRules.onExceedsHardConstraint;
    if (rule !== void 0 && rule !== "escalate" && rule !== "reject")
      return bad("onExceedsHardConstraint must be escalate or reject");
    return {
      scope,
      hard,
      preferences,
      fallback,
      escalation: escalationRules
    };
  };
  var routeCreateMandate = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.delegatePersonId) || !hasKind(world, c.delegatePersonId, "person") || c.delegatePersonId === by || !holdsRoleAt(world.people, org, entityId(c.delegatePersonId), world.simDate))
      return bad("delegatePersonId must name another person who holds a role");
    const category = parseCategory(c.category);
    if (isFailure(category)) return category;
    const rights = parseRights(c.allowedRights, "allowedRights");
    if (isFailure(rights)) return rights;
    const body = parseMandateBody(c);
    if (isFailure(body)) return body;
    const validity = parseValidity(c, world.simDate);
    if (isFailure(validity)) return validity;
    const mine = activeRightsAt(world, org, by, category, world.simDate);
    const missing = rights.filter((r) => !mine.transferableRights.includes(r));
    if (missing.length > 0)
      return denied(
        `${by} cannot delegate ${missing.join(", ")} on ${category}: not held transferably through a grant`
      );
    const minted = mintRecordId(world);
    const mandate = {
      id: minted.id,
      organizationId: org,
      delegatorPersonId: by,
      delegatePersonId: entityId(c.delegatePersonId),
      category,
      scope: body.scope,
      hardConstraints: body.hard,
      preferences: body.preferences,
      allowedRights: rights,
      fallback: body.fallback,
      escalationRules: body.escalation,
      effectiveFrom: validity.from,
      effectiveUntil: validity.until,
      revision: 1,
      active: true
    };
    const mandates = [...world.authority.mandates, mandate].sort(byId);
    return finish(
      ctx,
      { authority: __spreadProps(__spreadValues({}, world.authority), { mandates }), nextRecord: minted.next },
      [spec("MandateCreated", { actingPersonId: by, mandate: __spreadValues({}, mandate) })],
      `${by} delegates ${rights.join(",")} on ${category} to ${mandate.delegatePersonId}`,
      `${by} holds the delegated rights transferably`
    );
  };
  var routeRevokeMandate = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const mandate = world.authority.mandates.find((m) => m.id === c.mandateId);
    if (mandate === void 0) return bad("mandateId does not name a mandate");
    if (!mandate.active) return bad("the mandate is already revoked");
    const asDelegator = mandate.delegatorPersonId === by && holdsRoleAt(world.people, mandate.organizationId, by, today);
    if (!asDelegator) {
      const noRight = requireExecute(world, mandate.organizationId, by);
      if (noRight !== null) return noRight;
    }
    if (isProtectedAt(
      world,
      mandate.organizationId,
      { kind: "mandate", id: mandate.id },
      { action: "revoke" },
      today
    ).length > 0)
      return protectedBy(`mandate ${mandate.id} is protected from revocation`);
    const updated = __spreadProps(__spreadValues({}, mandate), {
      active: false,
      revision: mandate.revision + 1
    });
    const mandates = world.authority.mandates.map(
      (m) => m.id === mandate.id ? updated : m
    );
    return finish(
      ctx,
      { authority: __spreadProps(__spreadValues({}, world.authority), { mandates }) },
      [
        spec("MandateRevoked", {
          cause: "revoked",
          actingPersonId: by,
          mandate: __spreadValues({}, updated)
        })
      ],
      `${by} revokes mandate ${mandate.id}`,
      asDelegator ? `${by} is the delegator` : `${by} may execute organizational_authority`
    );
  };
  var routeCreateConstraint = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isPlainObject(c.subject) || Object.keys(c.subject).length === 0)
      return bad("subject must be a non-empty object");
    if (!isPlainObject(c.prohibitedChange) || Object.keys(c.prohibitedChange).length === 0)
      return bad("prohibitedChange must be a non-empty object");
    const amenders = c.amendableByPersonIds;
    if (!Array.isArray(amenders) || !amenders.every((p) => isValidId(p) && hasKind(world, p, "person")) || new Set(amenders).size !== amenders.length)
      return bad("amendableByPersonIds must be unique existing persons");
    const validity = parseValidity(c, world.simDate);
    if (isFailure(validity)) return validity;
    const noRight = requireExecute(world, org, by);
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const constraint = {
      id: minted.id,
      organizationId: org,
      subject: c.subject,
      prohibitedChange: c.prohibitedChange,
      originRecordId: null,
      effectiveFrom: validity.from,
      effectiveUntil: validity.until,
      amendableByPersonIds: amenders.map(entityId).sort(),
      revision: 1,
      active: true
    };
    const protectedConstraints = [
      ...world.authority.protectedConstraints,
      constraint
    ].sort(byId);
    return finish(
      ctx,
      {
        authority: __spreadProps(__spreadValues({}, world.authority), { protectedConstraints }),
        nextRecord: minted.next
      },
      [
        spec("ProtectedConstraintCreated", {
          actingPersonId: by,
          constraint: __spreadValues({}, constraint)
        })
      ],
      `${by} protects ${minted.id}`,
      `${by} may execute organizational_authority`
    );
  };
  var routeAmendConstraint = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const constraint = world.authority.protectedConstraints.find(
      (p) => p.id === c.constraintId
    );
    if (constraint === void 0)
      return bad("constraintId does not name a protected constraint");
    let active = constraint.active;
    let until = constraint.effectiveUntil;
    if (c.active !== void 0) {
      if (typeof c.active !== "boolean") return bad("active must be a boolean");
      active = c.active;
    }
    if (c.effectiveUntil !== void 0) {
      if (c.effectiveUntil === null) until = null;
      else {
        const d = parseDate(c.effectiveUntil, "effectiveUntil");
        if (isFailure(d)) return d;
        if (d < dayBefore(today))
          return bad("effectiveUntil cannot be before yesterday");
        until = d;
      }
    }
    if (active === constraint.active && until === constraint.effectiveUntil)
      return bad("the amendment changes nothing");
    if (!constraint.amendableByPersonIds.includes(by) || !holdsRoleAt(world.people, constraint.organizationId, by, today))
      return denied(`${by} may not amend protected constraint ${constraint.id}`);
    const updated = __spreadProps(__spreadValues({}, constraint), {
      active,
      effectiveUntil: until,
      revision: constraint.revision + 1
    });
    const protectedConstraints = world.authority.protectedConstraints.map(
      (p) => p.id === constraint.id ? updated : p
    );
    return finish(
      ctx,
      { authority: __spreadProps(__spreadValues({}, world.authority), { protectedConstraints }) },
      [
        spec("ProtectedConstraintAmended", {
          actingPersonId: by,
          constraint: __spreadValues({}, updated)
        })
      ],
      `${by} amends ${constraint.id}`,
      `${by} is an authorized amender with an active role`
    );
  };
  var routeAuthorityCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "StartRoleEpisode":
        return routeStartRole(ctx, c);
      case "EndRoleEpisode":
        return routeEndRole(ctx, c);
      case "GrantAuthority":
        return routeGrant(ctx, c);
      case "RevokeAuthority":
        return routeRevokeGrant(ctx, c);
      case "CreateMandate":
        return routeCreateMandate(ctx, c);
      case "RevokeMandate":
        return routeRevokeMandate(ctx, c);
      case "CreateProtectedConstraint":
        return routeCreateConstraint(ctx, c);
      case "AmendProtectedConstraint":
        return routeAmendConstraint(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable authority command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/knowledgeView.ts
  var isClaimVisibleTo = (world, organizationId, actorPersonId, claim2) => {
    const today = world.simDate;
    if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
      return false;
    if (claim2.visibility === "public") return true;
    if (!claim2.holderOrganizationIds.includes(organizationId)) return false;
    if (claim2.visibility === "organization") return true;
    return claim2.sourcePersonId === actorPersonId || effectiveRightsAt(
      world,
      organizationId,
      actorPersonId,
      "organizational_authority",
      today
    ).rights.includes("execute");
  };
  var findVisibleClaim = (world, organizationId, actorPersonId, claimId) => {
    const claim2 = world.information.claims.find((c) => c.id === claimId);
    return claim2 !== void 0 && isClaimVisibleTo(world, organizationId, actorPersonId, claim2) ? claim2 : void 0;
  };
  var isBeliefVisibleTo = (world, organizationId, actorPersonId, belief2) => belief2.organizationId === organizationId && holdsRoleAt(world.people, organizationId, actorPersonId, world.simDate);

  // packages/sim-core/src/informationCommands.ts
  var VISIBILITIES = [
    "restricted",
    "organization",
    "public"
  ];
  var CONFIDENCE_BANDS = [
    "very_low",
    "low",
    "medium",
    "high",
    "very_high"
  ];
  var SUBJECT_KINDS = [
    "entity",
    "plan",
    "proposal",
    "world"
  ];
  var requireRight = (world, organizationId, personId, right) => effectiveRightsAt(
    world,
    organizationId,
    personId,
    "organizational_plan",
    world.simDate
  ).rights.includes(right) ? null : denied(
    `${personId} lacks ${right} on organizational_plan in ${organizationId}`
  );
  var parseSubject = (world, v) => {
    if (!isPlainObject(v)) return bad("subject must be an object");
    const { kind, id } = v;
    if (!SUBJECT_KINDS.includes(kind))
      return bad("subject.kind is not recognized");
    if (!isValidId(id)) return bad("subject.id is not a valid id");
    if (kind === "entity" && !world.entities.some((e) => e.id === id))
      return bad("subject does not name a known entity");
    return { kind, id };
  };
  var parseEnum = (v, allowed, label) => allowed.includes(v) ? v : bad(`${label} is not recognized`);
  var unavailable = (id) => bad(`claim ${String(id)} is not available to this organization`);
  var parseVisibleClaimIds = (ctx, org, by, v, label) => {
    if (!Array.isArray(v)) return bad(`${label} must be an array`);
    const seen = /* @__PURE__ */ new Set();
    for (const id of v) {
      if (!isValidId(id)) return bad(`${label} contains an invalid id`);
      if (seen.has(id)) return bad(`${label} contains a duplicate id`);
      seen.add(id);
      if (findVisibleClaim(ctx.world, org, by, id) === void 0)
        return unavailable(id);
    }
    return v.map(recordId);
  };
  var sameSubject = (a, b) => a.kind === b.kind && a.id === b.id;
  var routeRecordClaim = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (c.sourcePersonId !== void 0)
      return bad(
        "the recorder is always the source; sourcePersonId is not accepted"
      );
    const subject = parseSubject(world, c.subject);
    if (isFailure(subject)) return subject;
    if (!nonEmptyText(c.propositionType, 64))
      return bad("propositionType must be 1-64 characters");
    if (!isPlainObject(c.proposition))
      return bad("proposition must be an object");
    if (!isValidId(c.sourceFamilyId))
      return bad("sourceFamilyId must be a valid id");
    const observedAt = parseDate(c.observedAt, "observedAt");
    if (isFailure(observedAt)) return observedAt;
    if (observedAt > today)
      return bad("a claim cannot be observed in the future");
    const visibility = parseEnum(c.visibility, VISIBILITIES, "visibility");
    if (isFailure(visibility)) return visibility;
    const confidence = parseEnum(c.confidence, CONFIDENCE_BANDS, "confidence");
    if (isFailure(confidence)) return confidence;
    const bias = c.possibleBias;
    if (bias !== null && !nonEmptyText(bias, 200))
      return bad("possibleBias must be null or 1-200 characters");
    const corroborates = parseVisibleClaimIds(
      ctx,
      org,
      by,
      c.corroboratesClaimIds,
      "corroboratesClaimIds"
    );
    if (isFailure(corroborates)) return corroborates;
    const contradicts = parseVisibleClaimIds(
      ctx,
      org,
      by,
      c.contradictsClaimIds,
      "contradictsClaimIds"
    );
    if (isFailure(contradicts)) return contradicts;
    if (corroborates.some((id) => contradicts.includes(id)))
      return bad("a claim cannot both corroborate and contradict the same claim");
    const noRight = requireRight(world, org, by, "advise");
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const claim2 = {
      id: minted.id,
      subject,
      propositionType: c.propositionType,
      proposition: c.proposition,
      sourcePersonId: by,
      sourceFamilyId: c.sourceFamilyId,
      observedAt,
      acquiredAt: today,
      visibility,
      holderOrganizationIds: [org],
      confidence,
      possibleBias: bias,
      corroboratesClaimIds: corroborates,
      contradictsClaimIds: contradicts,
      sharedFromClaimId: null
    };
    const claims = [...world.information.claims, claim2].sort(byId);
    return finish(
      ctx,
      {
        information: __spreadProps(__spreadValues({}, world.information), { claims }),
        nextRecord: minted.next
      },
      [
        spec("ClaimRecorded", {
          actingPersonId: by,
          organizationId: org,
          claim: __spreadValues({}, claim2)
        })
      ],
      `${by} records ${claim2.propositionType} for ${org}`,
      `${by} may advise on organizational_plan`
    );
  };
  var routeShareClaim = (ctx, c) => {
    const { world } = ctx;
    const today = world.simDate;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const claim2 = findVisibleClaim(world, org, by, String(c.claimId));
    if (claim2 === void 0) return unavailable(c.claimId);
    const to = parseOrganization(ctx, c.toOrganizationId);
    if (isFailure(to)) return to;
    if (to === org) return bad("a claim is shared with another organization");
    if (claim2.visibility === "public")
      return bad("a public claim needs no sharing");
    let visibility = claim2.visibility;
    if (c.visibility !== void 0) {
      const v = parseEnum(c.visibility, VISIBILITIES, "visibility");
      if (isFailure(v)) return v;
      if (VISIBILITIES.indexOf(v) > VISIBILITIES.indexOf(claim2.visibility))
        return bad("sharing cannot widen the visibility of a claim");
      visibility = v;
    }
    if (world.information.claims.some(
      (x) => x.sharedFromClaimId === claim2.id && x.holderOrganizationIds.includes(to)
    ))
      return bad("the claim has already been shared with that organization");
    const noRight = requireRight(world, org, by, "communicate");
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const copy = __spreadProps(__spreadValues({}, claim2), {
      id: minted.id,
      acquiredAt: today,
      visibility,
      holderOrganizationIds: [to],
      corroboratesClaimIds: [],
      contradictsClaimIds: [],
      sharedFromClaimId: claim2.id
    });
    const claims = [...world.information.claims, copy].sort(byId);
    return finish(
      ctx,
      {
        information: __spreadProps(__spreadValues({}, world.information), { claims }),
        nextRecord: minted.next
      },
      [
        spec("ClaimShared", {
          actingPersonId: by,
          fromOrganizationId: org,
          toOrganizationId: to,
          claim: __spreadValues({}, copy)
        })
      ],
      `${by} shares ${claim2.id} with ${to}`,
      `${by} may communicate on organizational_plan and can see the claim`
    );
  };
  var routeFormBelief = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const subject = parseSubject(world, c.subject);
    if (isFailure(subject)) return subject;
    if (!nonEmptyText(c.assessmentType, 64))
      return bad("assessmentType must be 1-64 characters");
    if (!isPlainObject(c.assessment)) return bad("assessment must be an object");
    const confidence = parseEnum(c.confidence, CONFIDENCE_BANDS, "confidence");
    if (isFailure(confidence)) return confidence;
    const evidence = parseVisibleClaimIds(
      ctx,
      org,
      by,
      c.evidenceClaimIds,
      "evidenceClaimIds"
    );
    if (isFailure(evidence)) return evidence;
    if (evidence.length === 0)
      return bad("a belief needs at least one piece of evidence");
    let supersedes = null;
    if (c.supersedesBeliefId !== void 0 && c.supersedesBeliefId !== null) {
      const prior = world.information.beliefs.find(
        (b) => b.id === c.supersedesBeliefId && b.organizationId === org
      );
      if (prior === void 0) return bad("supersedesBeliefId is not available");
      if (!sameSubject(prior.subject, subject))
        return bad("a belief chain stays about one subject");
      if (world.information.beliefs.some((b) => b.supersedesBeliefId === prior.id))
        return bad("that belief has already been superseded");
      supersedes = prior.id;
    }
    const noRight = requireRight(world, org, by, "advise");
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const belief2 = {
      id: minted.id,
      organizationId: org,
      authorPersonId: by,
      subject,
      assessmentType: c.assessmentType,
      assessment: c.assessment,
      confidence,
      evidenceClaimIds: evidence,
      formedAt: world.simDate,
      supersedesBeliefId: supersedes
    };
    const beliefs = [...world.information.beliefs, belief2].sort(byId);
    return finish(
      ctx,
      {
        information: __spreadProps(__spreadValues({}, world.information), { beliefs }),
        nextRecord: minted.next
      },
      [spec("BeliefFormed", { actingPersonId: by, belief: __spreadValues({}, belief2) })],
      `${by} forms ${belief2.assessmentType} for ${org}`,
      `${by} may advise on organizational_plan`
    );
  };
  var routeInformationCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "RecordClaim":
        return routeRecordClaim(ctx, c);
      case "ShareClaim":
        return routeShareClaim(ctx, c);
      case "FormBelief":
        return routeFormBelief(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable information command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/decisionCommands.ts
  var PROPOSAL_CATEGORIES = DECISION_CATEGORIES.slice(0, 3);
  var MAX_SUBJECTS = 8;
  var compareProposals = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.revision - b.revision;
  var compareById = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var pad2 = (n) => String(n).padStart(6, "0");
  var parseSubjects = (world, v) => {
    if (!Array.isArray(v) || v.length === 0 || v.length > MAX_SUBJECTS)
      return bad(`subjects must list 1-${MAX_SUBJECTS} subjects`);
    const out = [];
    for (const item of v) {
      const s = parseSubject(world, item);
      if (isFailure(s)) return s;
      out.push(s);
    }
    return out;
  };
  var parseRequiredApprovers = (world, organizationId, v) => {
    if (!Array.isArray(v))
      return bad("requiredApproverPersonIds must be an array");
    if (new Set(v).size !== v.length)
      return bad("requiredApproverPersonIds contains a duplicate");
    for (const p of v)
      if (!isValidId(p) || !hasKind(world, p, "person") || !holdsRoleAt(world.people, organizationId, entityId(p), world.simDate))
        return bad("each required approver must be a person with a role here");
    return v.map(entityId).sort();
  };
  var parseDeadline = (world, v) => {
    if (v === null) return null;
    const d = parseDate(v, "expiresAt");
    if (isFailure(d)) return d;
    return d > world.simDate ? d : bad("expiresAt must be after today");
  };
  var parseObject = (v, label) => isPlainObject(v) ? v : bad(`${label} must be an object`);
  var parseFields = (world, organizationId, c, base) => {
    const pick = (key, parse, fallback) => c[key] !== void 0 ? parse(c[key]) : fallback;
    const subjects = pick(
      "subjects",
      (v) => parseSubjects(world, v),
      base == null ? void 0 : base.subjects
    );
    if (subjects === void 0) return bad("subjects is required");
    if (isFailure(subjects)) return subjects;
    const termsType = pick(
      "termsType",
      (v) => nonEmptyText(v, 64) ? v : bad("termsType must be 1-64 characters"),
      base == null ? void 0 : base.termsType
    );
    if (termsType === void 0) return bad("termsType is required");
    if (isFailure(termsType)) return termsType;
    const terms = pick(
      "terms",
      (v) => parseObject(v, "terms"),
      base == null ? void 0 : base.terms
    );
    if (terms === void 0) return bad("terms is required");
    if (isFailure(terms)) return terms;
    const required = pick(
      "requiredApproverPersonIds",
      (v) => parseRequiredApprovers(world, organizationId, v),
      base == null ? void 0 : base.requiredApproverPersonIds
    );
    if (required === void 0)
      return bad("requiredApproverPersonIds is required");
    if (isFailure(required)) return required;
    let expiresAt;
    if (c.expiresAt !== void 0) {
      const d = parseDeadline(world, c.expiresAt);
      if (isFailure(d)) return d;
      expiresAt = d;
    } else if (base !== null) expiresAt = base.expiresAt;
    else return bad("expiresAt is required (use null for none)");
    const contingencies = pick(
      "contingencies",
      (v) => parseObject(v, "contingencies"),
      base == null ? void 0 : base.contingencies
    );
    if (contingencies === void 0) return bad("contingencies is required");
    if (isFailure(contingencies)) return contingencies;
    return {
      subjects,
      termsType,
      terms,
      requiredApproverPersonIds: required,
      expiresAt,
      contingencies
    };
  };
  var withDecisions = (world, decisions) => __spreadProps(__spreadValues({}, world), { decisions });
  var settle = (world, decisions, proposal) => {
    const evaluation = evaluateProposalAuthority(
      withDecisions(world, decisions),
      proposal,
      world.simDate
    );
    return evaluation.satisfied ? { state: "authorized", basis: evaluation.basis } : { state: "awaiting_approval", basis: null };
  };
  var replaceProposal = (decisions, next) => __spreadProps(__spreadValues({}, decisions), {
    proposals: decisions.proposals.map((p) => p.id === next.id && p.revision === next.revision ? next : p).sort(compareProposals)
  });
  var authorizedEvent = (proposal, basis) => spec("ProposalAuthorized", {
    proposalId: proposal.id,
    revision: proposal.revision,
    basis
  });
  var locate = (ctx, c) => {
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(ctx.world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (c.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${String(c.expectedRevision)}, latest is ${proposal.revision}`
      );
    return { by, proposal };
  };
  var requireOpen = (world, p) => {
    if (isTerminalProposalState(p.state))
      return bad(`proposal is already ${p.state}`);
    if (!isProposalLiveAt(p, world.simDate)) return bad("proposal has expired");
    return null;
  };
  var routeSubmit = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!PROPOSAL_CATEGORIES.includes(c.category))
      return bad("category is not available in this package");
    const category = c.category;
    const fields = parseFields(world, org, c, null);
    if (isFailure(fields)) return fields;
    if (rightBackingAt(world, org, by, category, "propose", world.simDate) === null)
      return denied(`${by} lacks propose on ${category} in ${org}`);
    const minted = mintRecordIds(world, 1);
    const submitted = {
      id: minted.ids[0],
      revision: 1,
      organizationId: org,
      authorPersonId: by,
      category,
      subjects: fields.subjects,
      termsType: fields.termsType,
      terms: fields.terms,
      termsHash: proposalTermsHash({
        category,
        subjects: fields.subjects,
        termsType: fields.termsType,
        terms: fields.terms
      }),
      relevantWorldRevision: Number(world.revision),
      requiredApproverPersonIds: fields.requiredApproverPersonIds,
      expiresAt: fields.expiresAt,
      contingencies: fields.contingencies,
      state: "submitted",
      createdAt: world.simDate,
      supersedesRevision: null
    };
    const draft = __spreadProps(__spreadValues({}, world.decisions), {
      proposals: [...world.decisions.proposals, submitted].sort(compareProposals)
    });
    const outcome = settle(world, draft, submitted);
    const stored = __spreadProps(__spreadValues({}, submitted), { state: outcome.state });
    const specs = [
      spec("ProposalSubmitted", {
        actingPersonId: by,
        proposal: __spreadValues({}, submitted)
      })
    ];
    if (outcome.state === "authorized")
      specs.push(authorizedEvent(stored, outcome.basis));
    return finish(
      ctx,
      { decisions: replaceProposal(draft, stored), nextRecord: minted.next },
      specs,
      `${by} submits ${stored.id} (${outcome.state})`,
      `${by} may propose on ${category}`
    );
  };
  var routeApprove = (ctx, c) => {
    const { world } = ctx;
    const located = locate(ctx, c);
    if (isFailure(located)) return located;
    const { by, proposal } = located;
    const open = requireOpen(world, proposal);
    if (open !== null) return open;
    if (proposal.state !== "awaiting_approval")
      return bad(`proposal is ${proposal.state}; it is not awaiting approval`);
    if (world.decisions.approvals.some(
      (a) => a.proposalId === proposal.id && a.active && a.right === "approve" && a.approverPersonId === by && a.termsHash === proposal.termsHash
    ))
      return bad(`${by} has already approved this revision`);
    const backing = rightBackingAt(
      world,
      proposal.organizationId,
      by,
      proposal.category,
      "approve",
      world.simDate
    );
    if (backing === null)
      return denied(`${by} lacks approve on ${proposal.category}`);
    if (proposal.requiredApproverPersonIds.length > 0 && !proposal.requiredApproverPersonIds.includes(by))
      return bad(`${by} is not a required approver of this proposal`);
    const minted = mintRecordIds(world, 1);
    const approval = {
      id: minted.ids[0],
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      approverPersonId: by,
      right: "approve",
      authorityGrantId: backing.grantIds[0],
      mandateId: backing.mandateId,
      termsHash: proposal.termsHash,
      decidedAt: world.simDate,
      active: true
    };
    const withApproval = __spreadProps(__spreadValues({}, world.decisions), {
      approvals: [...world.decisions.approvals, approval].sort(compareById)
    });
    const outcome = settle(world, withApproval, proposal);
    const stored = __spreadProps(__spreadValues({}, proposal), { state: outcome.state });
    const specs = [
      spec("ProposalApproved", { actingPersonId: by, approval: __spreadValues({}, approval) })
    ];
    if (outcome.state === "authorized")
      specs.push(authorizedEvent(stored, outcome.basis));
    return finish(
      ctx,
      {
        decisions: replaceProposal(withApproval, stored),
        nextRecord: minted.next
      },
      specs,
      `${by} approves ${proposal.id}/${proposal.revision}`,
      `${by} holds approve on ${proposal.category}`
    );
  };
  var routeVeto = (ctx, c) => {
    const { world } = ctx;
    const located = locate(ctx, c);
    if (isFailure(located)) return located;
    const { by, proposal } = located;
    const open = requireOpen(world, proposal);
    if (open !== null) return open;
    const backing = rightBackingAt(
      world,
      proposal.organizationId,
      by,
      proposal.category,
      "veto",
      world.simDate
    );
    if (backing === null)
      return denied(`${by} lacks veto on ${proposal.category}`);
    const minted = mintRecordIds(world, 1);
    const veto = {
      id: minted.ids[0],
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      approverPersonId: by,
      right: "veto",
      authorityGrantId: backing.grantIds[0],
      mandateId: backing.mandateId,
      termsHash: proposal.termsHash,
      decidedAt: world.simDate,
      active: true
    };
    const decisions = replaceProposal(
      __spreadProps(__spreadValues({}, world.decisions), {
        approvals: [...world.decisions.approvals, veto].sort(compareById)
      }),
      __spreadProps(__spreadValues({}, proposal), { state: "rejected" })
    );
    return finish(
      ctx,
      { decisions, nextRecord: minted.next },
      [
        spec("ProposalVetoed", {
          actingPersonId: by,
          proposalId: proposal.id,
          revision: proposal.revision,
          approval: __spreadValues({}, veto)
        })
      ],
      `${by} vetoes ${proposal.id}/${proposal.revision}`,
      `${by} holds veto on ${proposal.category}`
    );
  };
  var routeSimpleTransition = (ctx, c, kind) => {
    const { world } = ctx;
    const located = locate(ctx, c);
    if (isFailure(located)) return located;
    const { by, proposal } = located;
    if (isTerminalProposalState(proposal.state))
      return bad(`proposal is already ${proposal.state}`);
    if (kind === "expire" && (proposal.expiresAt === null || world.simDate < proposal.expiresAt))
      return bad("proposal has not reached its deadline");
    if (kind === "withdraw") {
      if (proposal.authorPersonId !== by)
        return denied(`${by} is not the author of ${proposal.id}`);
    } else if (!holdsRoleAt(world.people, proposal.organizationId, by, world.simDate)) {
      return denied(`${by} holds no role in ${proposal.organizationId}`);
    }
    const state = kind === "withdraw" ? "withdrawn" : "expired";
    return finish(
      ctx,
      { decisions: replaceProposal(world.decisions, __spreadProps(__spreadValues({}, proposal), { state })) },
      [
        spec(kind === "withdraw" ? "ProposalWithdrawn" : "ProposalExpired", {
          actingPersonId: by,
          proposalId: proposal.id,
          revision: proposal.revision
        })
      ],
      `${by} ${kind}s ${proposal.id}/${proposal.revision}`,
      kind === "withdraw" ? `${by} is the author` : `${by} holds a role here`
    );
  };
  var routeRevise = (ctx, c) => {
    const { world } = ctx;
    const located = locate(ctx, c);
    if (isFailure(located)) return located;
    const { by, proposal } = located;
    if (proposal.state === "committed")
      return bad("a committed proposal cannot change");
    if (c.category !== void 0)
      return bad("category cannot change in a revision");
    const fields = parseFields(world, proposal.organizationId, c, proposal);
    if (isFailure(fields)) return fields;
    const termsHash = proposalTermsHash({
      category: proposal.category,
      subjects: fields.subjects,
      termsType: fields.termsType,
      terms: fields.terms
    });
    const unchanged = termsHash === proposal.termsHash && canonicalString(fields.requiredApproverPersonIds) === canonicalString(proposal.requiredApproverPersonIds) && fields.expiresAt === proposal.expiresAt && canonicalString(fields.contingencies) === canonicalString(proposal.contingencies);
    if (unchanged) return bad("the revision changes nothing");
    if (proposal.authorPersonId !== by)
      return denied(`${by} is not the author of ${proposal.id}`);
    if (rightBackingAt(
      world,
      proposal.organizationId,
      by,
      proposal.category,
      "propose",
      world.simDate
    ) === null)
      return denied(`${by} lacks propose on ${proposal.category}`);
    const wasTerminal = isTerminalProposalState(proposal.state);
    const material = termsHash !== proposal.termsHash;
    const invalidate = wasTerminal || material;
    const specs = [];
    const revised = __spreadProps(__spreadValues({}, proposal), {
      revision: proposal.revision + 1,
      subjects: fields.subjects,
      termsType: fields.termsType,
      terms: fields.terms,
      termsHash,
      relevantWorldRevision: Number(world.revision),
      requiredApproverPersonIds: fields.requiredApproverPersonIds,
      expiresAt: fields.expiresAt,
      contingencies: fields.contingencies,
      state: "submitted",
      createdAt: world.simDate,
      supersedesRevision: proposal.revision
    });
    specs.push(
      spec("ProposalRevised", {
        actingPersonId: by,
        supersededRevision: proposal.revision,
        proposal: __spreadValues({}, revised)
      })
    );
    let approvals = world.decisions.approvals;
    if (invalidate) {
      approvals = approvals.map((a) => {
        if (a.proposalId !== proposal.id || !a.active) return a;
        const off = __spreadProps(__spreadValues({}, a), { active: false });
        specs.push(
          spec("ApprovalInvalidated", {
            approvalId: a.id,
            proposalId: proposal.id,
            reason: wasTerminal ? "retry" : "material_revision"
          })
        );
        return off;
      });
    }
    const closed = isTerminalProposalState(proposal.state) ? proposal : __spreadProps(__spreadValues({}, proposal), { state: "withdrawn" });
    const draft = __spreadProps(__spreadValues({}, world.decisions), {
      approvals,
      proposals: [
        ...world.decisions.proposals.map(
          (p) => p.id === proposal.id && p.revision === proposal.revision ? closed : p
        ),
        revised
      ].sort(compareProposals)
    });
    const outcome = settle(world, draft, revised);
    const stored = __spreadProps(__spreadValues({}, revised), { state: outcome.state });
    if (outcome.state === "authorized")
      specs.push(authorizedEvent(stored, outcome.basis));
    return finish(
      ctx,
      { decisions: replaceProposal(draft, stored) },
      specs,
      `${by} revises ${proposal.id} to revision ${stored.revision}`,
      `${by} is the author and may propose on ${proposal.category}`
    );
  };
  var checkedIds = (v, label, exists) => {
    if (new Set(v).size !== v.length) return bad(`${label} contains a duplicate`);
    for (const id of v)
      if (!isValidId(id) || !exists(id))
        return bad(`${label} contains an id that is not available`);
    return v.map(recordId);
  };
  var commitProposal = (ctx, input) => {
    const { world } = ctx;
    const today = world.simDate;
    const proposal = latestProposal(world.decisions, input.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (input.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${input.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    if (!isProposalLiveAt(proposal, today)) return bad("proposal has expired");
    if (proposalTermsHash(proposal) !== proposal.termsHash)
      return bad("proposal terms no longer match their hash");
    const beliefs = checkedIds(
      input.beliefIds,
      "beliefIds",
      (id) => world.information.beliefs.some(
        (b) => b.id === id && b.organizationId === proposal.organizationId && isBeliefVisibleTo(
          world,
          proposal.organizationId,
          input.actorPersonId,
          b
        )
      )
    );
    if (isFailure(beliefs)) return beliefs;
    const evidence = checkedIds(
      input.evidenceClaimIds,
      "evidenceClaimIds",
      (id) => findVisibleClaim(
        world,
        proposal.organizationId,
        input.actorPersonId,
        id
      ) !== void 0
    );
    if (isFailure(evidence)) return evidence;
    const execute = rightBackingAt(
      world,
      proposal.organizationId,
      input.actorPersonId,
      proposal.category,
      "execute",
      today
    );
    if (execute === null)
      return denied(
        `${input.actorPersonId} lacks execute on ${proposal.category} in ${proposal.organizationId}`
      );
    const authorization = evaluateProposalAuthority(world, proposal, today);
    if (!authorization.satisfied)
      return denied(
        `authorization no longer holds: ${authorization.reasons.join("; ")}`
      );
    const minted = mintRecordIds(input.nextWorld, 1);
    const firstEvent = world.nextIds.event;
    const total = input.domainEvents.length + 2;
    const outcomeEventIds = Array.from(
      { length: total },
      (_, i) => eventId(`evt-${pad2(firstEvent + i)}`)
    );
    const receipt = {
      id: minted.ids[0],
      proposalId: proposal.id,
      proposalRevision: proposal.revision,
      commandId: ctx.commandId,
      actorPersonId: input.actorPersonId,
      authorityGrantIds: [
        .../* @__PURE__ */ new Set([...execute.grantIds, ...authorization.grantIds])
      ].sort(),
      evidenceClaimIds: evidence,
      beliefIds: beliefs,
      approvalIds: authorization.approvalIds,
      mandateId: execute.mandateId,
      executedTermsHash: proposal.termsHash,
      committedAt: today,
      outcomeEventIds,
      originalRationale: input.rationale
    };
    const committed = __spreadProps(__spreadValues({}, proposal), { state: "committed" });
    const decisions = __spreadProps(__spreadValues({}, replaceProposal(input.nextWorld.decisions, committed)), {
      receipts: [...input.nextWorld.decisions.receipts, receipt].sort(
        compareById
      )
    });
    return {
      ok: true,
      authorizationDetail: `${input.actorPersonId} holds execute; authorization re-derived`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, input.nextWorld), {
          decisions,
          nextIds: __spreadProps(__spreadValues({}, input.nextWorld.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          ...input.domainEvents,
          spec("ProposalCommitted", {
            proposalId: proposal.id,
            revision: proposal.revision,
            actingPersonId: input.actorPersonId
          }),
          spec("DecisionReceiptRecorded", { receipt: __spreadValues({}, receipt) })
        ],
        detail: `committed ${proposal.id}/${proposal.revision}`
      }
    };
  };
  var routeDecisionCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "SubmitProposal":
        return routeSubmit(ctx, c);
      case "ReviseProposal":
        return routeRevise(ctx, c);
      case "ApproveProposal":
        return routeApprove(ctx, c);
      case "VetoProposal":
        return routeVeto(ctx, c);
      case "WithdrawProposal":
        return routeSimpleTransition(ctx, c, "withdraw");
      case "ExpireProposal":
        return routeSimpleTransition(ctx, c, "expire");
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable decision command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/planCommands.ts
  var ORGANIZATION_PLAN_TERMS_TYPE = "organization_plan_v1";
  var PRIORITIES = [
    "low",
    "medium",
    "high",
    "critical"
  ];
  var TRIGGER_KINDS = [
    "date",
    "claim",
    "event",
    "manual_review"
  ];
  var MAX_ITEMS = 32;
  var byKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  var byPlanId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var list = (v, label) => Array.isArray(v) && v.length <= MAX_ITEMS ? v : bad(`${label} must be an array of at most ${MAX_ITEMS} items`);
  var parseObjectives = (v) => {
    const items = list(v, "objectives");
    if (isFailure(items)) return items;
    const out = [];
    for (const o of items) {
      if (!isPlainObject(o) || !nonEmptyText(o.key, 64) || !PRIORITIES.includes(o.priority) || o.target === void 0)
        return bad("each objective needs a key, a priority and a target");
      out.push({
        key: o.key,
        priority: o.priority,
        target: o.target
      });
    }
    if (new Set(out.map((o) => o.key)).size !== out.length)
      return bad("objective keys must be unique");
    return out.sort(byKey);
  };
  var parseConstraints = (v) => {
    const items = list(v, "constraints");
    if (isFailure(items)) return items;
    const out = [];
    for (const c of items) {
      if (!isPlainObject(c) || !nonEmptyText(c.key, 64) || c.kind !== "hard" && c.kind !== "preference" || c.value === void 0)
        return bad(
          "each constraint needs a key, a kind (hard|preference) and a value"
        );
      out.push({ key: c.key, kind: c.kind, value: c.value });
    }
    if (new Set(out.map((c) => c.key)).size !== out.length)
      return bad("constraint keys must be unique");
    return out.sort(byKey);
  };
  var parseTriggers = (v) => {
    const items = list(v, "triggerRefs");
    if (isFailure(items)) return items;
    const out = [];
    for (const t of items) {
      if (!isPlainObject(t) || !TRIGGER_KINDS.includes(t.kind) || !nonEmptyText(t.refId, 64) || !nonEmptyText(t.note, 200))
        return bad("each trigger needs a kind, a refId and a note");
      out.push({
        kind: t.kind,
        refId: t.refId,
        note: t.note
      });
    }
    return out;
  };
  var parseRecordIds = (v, label) => {
    const items = list(v, label);
    if (isFailure(items)) return items;
    if (new Set(items).size !== items.length)
      return bad(`${label} contains a duplicate`);
    if (!items.every((i) => isValidId(i)))
      return bad(`${label} must hold valid ids`);
    return items.map(recordId);
  };
  var parseTerms = (world, organizationId, terms) => {
    if (!isPlainObject(terms)) return bad("plan terms must be an object");
    if (terms.planId !== null && !isValidId(terms.planId))
      return bad("planId must be null (a new plan) or a plan id");
    if (!PLAN_KINDS.includes(terms.kind))
      return bad("plan kind is not recognised");
    if (!nonEmptyText(terms.scopeKey, 64))
      return bad("scopeKey must be 1-64 characters");
    if (!isValidId(terms.ownerPersonId) || !hasKind(world, terms.ownerPersonId, "person") || !holdsRoleAt(
      world.people,
      organizationId,
      entityId(terms.ownerPersonId),
      world.simDate
    ))
      return bad(
        "the plan owner must be a person with a role in the organization"
      );
    const effectiveAt = parseDate(terms.effectiveAt, "effectiveAt");
    if (isFailure(effectiveAt)) return effectiveAt;
    if (effectiveAt < world.simDate)
      return bad("effectiveAt cannot be in the past");
    if (terms.horizon === void 0) return bad("horizon is required");
    const objectives = parseObjectives(terms.objectives);
    if (isFailure(objectives)) return objectives;
    const constraints = parseConstraints(terms.constraints);
    if (isFailure(constraints)) return constraints;
    const triggers = parseTriggers(terms.triggerRefs);
    if (isFailure(triggers)) return triggers;
    const fallbacks = parseRecordIds(terms.fallbackPlanIds, "fallbackPlanIds");
    if (isFailure(fallbacks)) return fallbacks;
    const reasons = parseRecordIds(terms.changeReasonRefs, "changeReasonRefs");
    if (isFailure(reasons)) return reasons;
    return {
      planId: terms.planId === null ? null : recordId(String(terms.planId)),
      kind: terms.kind,
      scopeKey: terms.scopeKey,
      ownerPersonId: entityId(terms.ownerPersonId),
      effectiveAt,
      horizon: terms.horizon,
      objectives,
      constraints,
      triggerRefs: triggers,
      fallbackPlanIds: fallbacks,
      changeReasonRefs: reasons
    };
  };
  var reversesPrior = (prior, terms) => {
    const sameObjective = (o) => terms.objectives.some((n) => canonicalString(n) === canonicalString(o));
    const sameHard = (c) => terms.constraints.some((n) => canonicalString(n) === canonicalString(c));
    return !prior.objectives.every(sameObjective) || !prior.constraints.filter((c) => c.kind === "hard").every(sameHard);
  };
  var routePlanCommand = (ctx, command) => {
    var _a, _b, _c, _d;
    const { world } = ctx;
    const c = command;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be the proposal revision");
    if (proposal.termsType !== ORGANIZATION_PLAN_TERMS_TYPE)
      return bad(
        `only ${ORGANIZATION_PLAN_TERMS_TYPE} proposals commit as plans`
      );
    if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
      return bad("beliefIds and evidenceClaimIds must be arrays");
    if (!isPlainObject(c.rationale)) return bad("rationale must be an object");
    if (!c.beliefIds.every((b) => isValidId(b)))
      return bad("beliefIds must hold valid ids");
    const organizationId = proposal.organizationId;
    const terms = parseTerms(world, organizationId, proposal.terms);
    if (isFailure(terms)) return terms;
    const plans = world.plans.plans;
    const existing = terms.planId === null ? void 0 : plans.find(
      (p) => p.id === terms.planId && p.organizationId === organizationId
    );
    if (terms.planId !== null && existing === void 0)
      return bad("planId does not name a plan of this organization");
    if (existing !== void 0) {
      if (existing.status !== "active")
        return bad(`plan is ${existing.status}, not active`);
      if (existing.kind !== terms.kind || existing.scopeKey !== terms.scopeKey)
        return bad("a revision cannot change the plan kind or scope");
    }
    const occupant = existing === void 0 ? plans.find(
      (p) => p.organizationId === organizationId && p.status === "active" && p.kind === terms.kind && p.scopeKey === terms.scopeKey
    ) : void 0;
    const priorRevision = existing == null ? void 0 : existing.revisions.find(
      (r) => r.revision === existing.currentRevision
    );
    const reversal = occupant !== void 0 || priorRevision !== void 0 && reversesPrior(priorRevision, terms);
    if (reversal && terms.changeReasonRefs.length === 0)
      return bad(
        "reversing an active plan requires at least one changeReasonRef"
      );
    for (const ref of terms.changeReasonRefs) {
      const visibleClaim = findVisibleClaim(world, organizationId, by, ref) !== void 0;
      const visibleBelief = world.information.beliefs.some(
        (b) => b.id === ref && isBeliefVisibleTo(world, organizationId, by, b)
      );
      if (!visibleClaim && !visibleBelief)
        return bad("changeReasonRefs contains a reference that is not available");
    }
    const selfId = (_a = existing == null ? void 0 : existing.id) != null ? _a : null;
    for (const fb of terms.fallbackPlanIds) {
      const target = plans.find((p) => p.id === fb);
      if (target === void 0 || target.organizationId !== organizationId || target.status !== "active" || fb === selfId || fb === (occupant == null ? void 0 : occupant.id))
        return bad(
          "fallbackPlanIds must name other active plans of this organization"
        );
    }
    const minted = existing === void 0 ? mintRecordIds(world, 1) : null;
    const planId = (_b = existing == null ? void 0 : existing.id) != null ? _b : minted.ids[0];
    const revision = {
      revision: ((_c = existing == null ? void 0 : existing.currentRevision) != null ? _c : 0) + 1,
      ownerPersonId: terms.ownerPersonId,
      effectiveAt: terms.effectiveAt,
      horizon: terms.horizon,
      objectives: terms.objectives,
      constraints: terms.constraints,
      triggerRefs: terms.triggerRefs,
      fallbackPlanIds: terms.fallbackPlanIds,
      basisBeliefIds: c.beliefIds.map(recordId),
      changeReasonRefs: terms.changeReasonRefs
    };
    const nextPlan = existing === void 0 ? {
      id: planId,
      organizationId,
      kind: terms.kind,
      scopeKey: terms.scopeKey,
      status: "active",
      currentRevision: 1,
      revisions: [revision]
    } : __spreadProps(__spreadValues({}, existing), {
      currentRevision: revision.revision,
      revisions: [...existing.revisions, revision]
    });
    const events = [
      spec(existing === void 0 ? "PlanCreated" : "PlanRevised", {
        planId,
        organizationId,
        kind: terms.kind,
        scopeKey: terms.scopeKey,
        proposalId: proposal.id,
        proposalRevision: proposal.revision,
        revision: __spreadValues({}, revision)
      })
    ];
    const nextPlans = plans.filter((p) => p.id !== planId).map((p) => {
      if (p.id !== (occupant == null ? void 0 : occupant.id)) return p;
      events.push(
        spec("PlanSuperseded", {
          planId: p.id,
          supersededByPlanId: planId,
          proposalId: proposal.id
        })
      );
      return __spreadProps(__spreadValues({}, p), { status: "superseded" });
    });
    nextPlans.push(nextPlan);
    return commitProposal(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        plans: { plans: nextPlans.sort(byPlanId) },
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), {
          record: (_d = minted == null ? void 0 : minted.next) != null ? _d : world.nextIds.record
        })
      }),
      proposalId: proposal.id,
      expectedRevision: c.expectedRevision,
      actorPersonId: by,
      beliefIds: c.beliefIds,
      evidenceClaimIds: c.evidenceClaimIds,
      rationale: c.rationale,
      domainEvents: events
    });
  };

  // packages/sim-core/src/relationshipCommands.ts
  var RELATIONSHIP_EFFECT_ACTORS = /* @__PURE__ */ new Set([
    "system",
    "commissioner",
    "test_harness"
  ]);
  var parseParty = (ctx, v, label) => {
    if (!isPlainObject(v)) return bad(`${label} must be an object`);
    const { kind, entityId: id } = v;
    if (kind !== "person" && kind !== "organization")
      return bad(`${label}.kind must be person or organization`);
    if (!isValidId(id) || !hasKind(ctx.world, id, kind))
      return bad(`${label} must name an existing ${kind}`);
    return { kind, entityId: entityId(id) };
  };
  var parseChanges = (v) => {
    if (!Array.isArray(v) || v.length === 0)
      return bad("changes must be a non-empty array");
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of v) {
      if (!isPlainObject(item)) return bad("each change must be an object");
      const { dimension, to } = item;
      if (!RELATIONSHIP_DIMENSIONS.includes(dimension))
        return bad("change.dimension is not a relationship dimension");
      if (!RELATIONSHIP_LEVELS.includes(to))
        return bad("change.to is not a relationship level");
      if (seen.has(dimension))
        return bad("a dimension may change once per effect");
      seen.add(dimension);
      out.push({
        dimension,
        to
      });
    }
    return out;
  };
  var routeRecordEffect = (ctx, c) => {
    const { world } = ctx;
    const a = parseParty(ctx, c.partyA, "partyA");
    if (isFailure(a)) return a;
    const b = parseParty(ctx, c.partyB, "partyB");
    if (isFailure(b)) return b;
    if (a.kind === b.kind && a.entityId === b.entityId)
      return bad("a relationship needs two different parties");
    if (!nonEmptyText(c.causeType, 64))
      return bad("causeType must be 1-64 characters");
    if (!isValidId(c.causeId)) return bad("causeId must be a valid id");
    const changes = parseChanges(c.changes);
    if (isFailure(changes)) return changes;
    const [partyA, partyB] = orderParties(a, b);
    const existing = findRelationshipEdge(world.relationships, partyA, partyB);
    const changed = [];
    for (const change of changes) {
      const from = existing === void 0 ? "none" : existing[change.dimension];
      if (from === change.to)
        return bad(
          `${change.dimension} is already ${change.to}; nothing to record`
        );
      changed.push({ dimension: change.dimension, from, to: change.to });
    }
    if (!RELATIONSHIP_EFFECT_ACTORS.has(ctx.actor.kind))
      return {
        ok: false,
        stage: "authorization",
        code: "UNAUTHORIZED_ACTOR",
        message: `${ctx.actor.kind} cannot record relationship effects directly`
      };
    const specs = [];
    const minted = mintRecordIds(world, existing === void 0 ? 2 : 1);
    const effectId = minted.ids[minted.ids.length - 1];
    let edge;
    let edges = world.relationships.edges;
    if (existing === void 0) {
      edge = {
        id: minted.ids[0],
        partyA,
        partyB,
        trust: "none",
        professionalRespect: "none",
        familiarity: "none",
        alignment: "none",
        access: "none",
        tension: "none",
        createdAt: world.simDate,
        revision: 1
      };
      specs.push(spec("RelationshipEdgeCreated", { edge: __spreadValues({}, edge) }));
    } else {
      edge = existing;
      edges = edges.filter((e) => e.id !== edge.id);
    }
    const updated = changes.reduce(
      (acc, change) => __spreadProps(__spreadValues({}, acc), { [change.dimension]: change.to }),
      __spreadProps(__spreadValues({}, edge), { revision: edge.revision + 1 })
    );
    const effect = {
      id: effectId,
      relationshipId: edge.id,
      causeType: c.causeType,
      causeId: c.causeId,
      occurredAt: world.simDate,
      changes: changed
    };
    specs.push(
      spec("RelationshipEffectRecorded", {
        effect: __spreadValues({}, effect),
        relationship: __spreadValues({}, updated)
      })
    );
    return finish(
      ctx,
      {
        relationships: {
          edges: [...edges, updated].sort(byId),
          effects: [...world.relationships.effects, effect].sort(byId)
        },
        nextRecord: minted.next
      },
      specs,
      `${ctx.actor.kind} records ${changes.length} relationship change(s) on ${updated.id}`,
      `${ctx.actor.kind} may record relationship effects`
    );
  };
  var routeRelationshipCommand = (ctx, command) => {
    switch (command.type) {
      case "RecordRelationshipEffect":
        return routeRecordEffect(ctx, command);
      default: {
        const unreachable = command.type;
        throw new Error(
          `unroutable relationship command: ${String(unreachable)}`
        );
      }
    }
  };

  // packages/sim-core/src/commandRouter.ts
  var ROUTABLE_TYPES = {
    AdvanceDays: true,
    StartRoleEpisode: true,
    EndRoleEpisode: true,
    GrantAuthority: true,
    RevokeAuthority: true,
    CreateMandate: true,
    RevokeMandate: true,
    CreateProtectedConstraint: true,
    AmendProtectedConstraint: true,
    RecordClaim: true,
    ShareClaim: true,
    FormBelief: true,
    RecordRelationshipEffect: true,
    SubmitProposal: true,
    ReviseProposal: true,
    ApproveProposal: true,
    VetoProposal: true,
    WithdrawProposal: true,
    ExpireProposal: true,
    CommitPlanProposal: true
  };
  var isRoutableCommandType = (type) => Object.prototype.hasOwnProperty.call(ROUTABLE_TYPES, type);
  var CALENDAR_AUTHORITY = /* @__PURE__ */ new Set([
    "human_gm",
    "commissioner",
    "system",
    "test_harness"
  ]);
  var routeAdvanceDays = (ctx, command) => {
    const max = ctx.ruleset.rules.maxAdvanceDaysPerCommand;
    const days = command.days;
    if (typeof days !== "number" || !Number.isSafeInteger(days) || days < 1 || days > max) {
      return {
        ok: false,
        stage: "validation",
        code: "INVALID_PAYLOAD",
        message: `days must be an integer in 1..${max}`
      };
    }
    if (!CALENDAR_AUTHORITY.has(ctx.actor.kind)) {
      return {
        ok: false,
        stage: "authorization",
        code: "UNAUTHORIZED_ACTOR",
        message: `${ctx.actor.kind} cannot advance the calendar`
      };
    }
    const world = ctx.world;
    const rng = DeterministicRng.fromState(world.rng);
    const start = SimDate.parse(world.simDate);
    const dayRolls = [];
    for (let i = 1; i <= days; i++) {
      dayRolls.push({ date: start.addDays(i).toISO(), roll: rng.nextU32() });
    }
    const toDate = start.addDays(days).toISO();
    return {
      ok: true,
      authorizationDetail: `${ctx.actor.kind} may advance the calendar`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), { simDate: toDate, rng: rng.snapshot() }),
        eventSpecs: [
          {
            type: "DaysAdvanced",
            payload: { fromDate: world.simDate, toDate, days, dayRolls }
          }
        ],
        detail: `advanced ${days} day(s) to ${toDate}`
      }
    };
  };
  var routeCommand = (ctx) => {
    const command = ctx.command;
    switch (command.type) {
      case "AdvanceDays":
        return routeAdvanceDays(ctx, command);
      case "StartRoleEpisode":
      case "EndRoleEpisode":
      case "GrantAuthority":
      case "RevokeAuthority":
      case "CreateMandate":
      case "RevokeMandate":
      case "CreateProtectedConstraint":
      case "AmendProtectedConstraint":
        return routeAuthorityCommand(ctx, command);
      case "RecordClaim":
      case "ShareClaim":
      case "FormBelief":
        return routeInformationCommand(ctx, command);
      case "RecordRelationshipEffect":
        return routeRelationshipCommand(ctx, command);
      case "SubmitProposal":
      case "ReviseProposal":
      case "ApproveProposal":
      case "VetoProposal":
      case "WithdrawProposal":
      case "ExpireProposal":
        return routeDecisionCommand(ctx, command);
      case "CommitPlanProposal":
        return routePlanCommand(ctx, command);
      default: {
        const unreachable = command;
        throw new Error(
          `unroutable command type: ${String(unreachable.type)}`
        );
      }
    }
  };

  // packages/sim-core/src/kernel.ts
  var eventIdFor = (ordinal) => eventId(`evt-${String(ordinal).padStart(6, "0")}`);
  var _world, _ruleset, _chainHead, _eventCount, _events, _known, _beforeCommit, _route;
  var _WorldKernel = class _WorldKernel {
    constructor(world, ruleset, chainHead, eventCount, known, options) {
      __privateAdd(this, _world);
      __privateAdd(this, _ruleset);
      __privateAdd(this, _chainHead);
      __privateAdd(this, _eventCount);
      __privateAdd(this, _events, []);
      __privateAdd(this, _known);
      __privateAdd(this, _beforeCommit);
      __privateAdd(this, _route);
      var _a;
      const validated = validateRulesetManifest(ruleset);
      const ref = rulesetRefOf(validated);
      if (ref.rulesetId !== world.ruleset.rulesetId || ref.rulesetVersion !== world.ruleset.rulesetVersion || ref.contentHash !== world.ruleset.contentHash) {
        throw new Error("ruleset does not match the world ruleset reference");
      }
      if (!isHash(chainHead))
        throw new Error("chainHead must be a 64-char lowercase hex hash");
      if (!Number.isSafeInteger(eventCount) || eventCount < 0)
        throw new Error("invalid eventCount");
      __privateSet(this, _world, world);
      __privateSet(this, _ruleset, validated);
      __privateSet(this, _chainHead, chainHead);
      __privateSet(this, _eventCount, eventCount);
      __privateSet(this, _known, new Set(known));
      __privateSet(this, _beforeCommit, options.beforeCommit);
      __privateSet(this, _route, (_a = options.testRouter) != null ? _a : routeCommand);
    }
    static fromGenesis(world, ruleset, options = {}) {
      assertCurrentWorld(world);
      if (world.revision !== 0 || world.nextIds.event !== 1) {
        throw new Error("fromGenesis requires an untouched genesis world");
      }
      return new _WorldKernel(world, ruleset, GENESIS_HASH, 0, [], options);
    }
    static resume(state, options = {}) {
      const world = requireCurrentWorld(state.world);
      if (state.eventCount + 1 !== world.nextIds.event) {
        throw new Error("eventCount does not agree with world.nextIds.event");
      }
      return new _WorldKernel(
        world,
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
        return {
          ok: false,
          rejection: { code, message },
          trace: deepFreeze({ commandId: commandId2, steps })
        };
      };
      const env = input;
      if (typeof env !== "object" || env === null || !isValidId(env.commandId) || !isValidRevision(env.expectedRevision) || !isActorRef(env.actor) || typeof env.command !== "object" || env.command === null) {
        return reject(
          "validation",
          "SCHEMA_INVALID",
          "malformed command envelope",
          null
        );
      }
      const cid = env.commandId;
      const command = env.command;
      if (typeof command.type !== "string" || !isRoutableCommandType(command.type)) {
        return reject(
          "validation",
          "SCHEMA_INVALID",
          "unknown command type",
          cid
        );
      }
      if (__privateGet(this, _known).has(cid)) {
        return reject(
          "validation",
          "DUPLICATE_COMMAND",
          `command ${cid} was already committed`,
          cid
        );
      }
      if (env.expectedRevision !== __privateGet(this, _world).revision) {
        return reject(
          "validation",
          "STALE_REVISION",
          `expected revision ${String(env.expectedRevision)} but world is at ${__privateGet(this, _world).revision}`,
          cid
        );
      }
      const routed = __privateGet(this, _route).call(this, {
        world: __privateGet(this, _world),
        ruleset: __privateGet(this, _ruleset),
        actor: env.actor,
        commandId: env.commandId,
        command
      });
      if (!routed.ok) {
        if (routed.stage === "authorization") {
          steps.push({
            stage: "validation",
            outcome: "pass",
            detail: "envelope, revision and payload valid"
          });
        }
        return reject(routed.stage, routed.code, routed.message, cid);
      }
      steps.push({
        stage: "validation",
        outcome: "pass",
        detail: "envelope, revision and payload valid"
      });
      steps.push({
        stage: "authorization",
        outcome: "pass",
        detail: routed.authorizationDetail
      });
      try {
        const { nextWorld: resolved, eventSpecs, detail } = routed.resolution;
        if (eventSpecs.length < 1) {
          throw new Error("an accepted command must emit at least one event");
        }
        steps.push({ stage: "resolution", outcome: "pass", detail });
        const world = __privateGet(this, _world);
        const revision = worldRevision(Number(world.revision) + 1);
        const events = chainEvents(
          __privateGet(this, _chainHead),
          eventSpecs.map((spec2, index) => ({
            eventId: eventIdFor(world.nextIds.event + index),
            revision,
            simDate: resolved.simDate,
            actor: env.actor,
            commandId: env.commandId,
            type: spec2.type,
            payload: spec2.payload
          }))
        );
        const nextWorld = deepFreeze(__spreadProps(__spreadValues({}, resolved), {
          revision,
          nextIds: __spreadProps(__spreadValues({}, resolved.nextIds), {
            event: world.nextIds.event + events.length
          })
        }));
        (_a = __privateGet(this, _beforeCommit)) == null ? void 0 : _a.call(this);
        steps.push({
          stage: "commit",
          outcome: "pass",
          detail: `committed revision ${revision}`
        });
        __privateSet(this, _world, nextWorld);
        __privateSet(this, _chainHead, events[events.length - 1].hash);
        __privateSet(this, _eventCount, __privateGet(this, _eventCount) + events.length);
        __privateGet(this, _events).push(...events);
        __privateGet(this, _known).add(cid);
        return {
          ok: true,
          world: nextWorld,
          events,
          trace: deepFreeze({ commandId: cid, steps })
        };
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
  _route = new WeakMap();
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
  var hashSnapshotBody = (s) => hashCanonical({
    domain: "sport-sim/career-snapshot",
    version: 1,
    body: snapshotBody(s)
  });
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

  // packages/sim-core/src/orgSubstrateSeed.ts
  var ORG_SUBSTRATE_SEED_JSON = {
    contentHash: "6dd9a1e3df23be4aa7de5c352dd93c295fa38b5420ed4e14ae3e40766f821f56",
    initialEntities: [
      {
        id: "org-northfield",
        kind: "organization",
        name: "Northfield Ironmen (synthetic)"
      },
      {
        id: "person-nf-owner",
        kind: "person",
        name: "Avery Holt (synthetic)"
      },
      {
        id: "person-nf-gm",
        kind: "person",
        name: "Jordan Pike (synthetic)"
      },
      {
        id: "person-nf-scout",
        kind: "person",
        name: "Casey Dunn (synthetic)"
      },
      {
        id: "org-southport",
        kind: "organization",
        name: "Southport Gulls (synthetic)"
      },
      {
        id: "person-sp-owner",
        kind: "person",
        name: "Quinn Marlow (synthetic)"
      },
      {
        id: "person-sp-gm",
        kind: "person",
        name: "Riley Strand (synthetic)"
      },
      {
        id: "person-sp-scout",
        kind: "person",
        name: "Morgan Vale (synthetic)"
      }
    ],
    organizationSubstrate: {
      authorityGrants: [
        {
          category: "organizational_authority",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-nf-owner-authority",
          organizationId: "org-northfield",
          personId: "person-nf-owner",
          revision: 1,
          rights: [
            "propose",
            "advise",
            "approve",
            "veto",
            "execute",
            "communicate"
          ],
          sourcePersonId: null,
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-nf-owner-plan",
          organizationId: "org-northfield",
          personId: "person-nf-owner",
          revision: 1,
          rights: [
            "propose",
            "advise",
            "approve",
            "veto",
            "execute",
            "communicate"
          ],
          sourcePersonId: null,
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-nf-gm-plan",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-nf-scout-plan",
          organizationId: "org-northfield",
          personId: "person-nf-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-nf-gm",
          transferable: false
        },
        {
          category: "organizational_authority",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-sp-owner-authority",
          organizationId: "org-southport",
          personId: "person-sp-owner",
          revision: 1,
          rights: [
            "propose",
            "advise",
            "approve",
            "veto",
            "execute",
            "communicate"
          ],
          sourcePersonId: null,
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-sp-owner-plan",
          organizationId: "org-southport",
          personId: "person-sp-owner",
          revision: 1,
          rights: [
            "propose",
            "advise",
            "approve",
            "veto",
            "execute",
            "communicate"
          ],
          sourcePersonId: null,
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-sp-gm-plan",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2026-10-16",
          effectiveUntil: null,
          id: "grant-sp-scout-plan",
          organizationId: "org-southport",
          personId: "person-sp-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-sp-gm",
          transferable: false
        }
      ],
      roleEpisodes: [
        {
          endDate: null,
          id: "role-nf-owner",
          organizationId: "org-northfield",
          personId: "person-nf-owner",
          role: "owner",
          startDate: "2020-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-nf-gm",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          role: "general_manager",
          startDate: "2024-02-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-nf-scout",
          organizationId: "org-northfield",
          personId: "person-nf-scout",
          role: "scout",
          startDate: "2025-03-01",
          title: "Area Scout"
        },
        {
          endDate: null,
          id: "role-sp-owner",
          organizationId: "org-southport",
          personId: "person-sp-owner",
          role: "owner",
          startDate: "2020-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-sp-gm",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          role: "general_manager",
          startDate: "2024-02-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-sp-scout",
          organizationId: "org-southport",
          personId: "person-sp-scout",
          role: "scout",
          startDate: "2025-03-01",
          title: "Area Scout"
        }
      ]
    },
    provenance: [
      {
        effectiveAsOf: "2026-10-16",
        note: "Synthetic Package B organization substrate fixture. Contains no real league data.",
        retrievedAt: "2026-10-17T00:00:00Z",
        sourceId: "sport-sim-synthetic-package-b",
        sourceKind: "synthetic",
        validationStatus: "synthetic"
      }
    ],
    rngSeed32: 20261017,
    ruleset: {
      contentHash: "0776311417c64397f948efe719cbf0ad6648b2011e5c227a62158ee6cb3712ae",
      rulesetId: "synthetic-minimal",
      rulesetVersion: 1
    },
    schemaVersion: 1,
    seedId: "synthetic-org-substrate",
    seedVersion: 1,
    startDate: "2026-10-16"
  };
  var ORG_SUBSTRATE_SEED = validateSeedManifest(ORG_SUBSTRATE_SEED_JSON);

  // packages/sim-core/src/packageBScenario.ts
  var PACKAGE_B_SCENARIO_ID = "package-b-golden-v1";
  var PACKAGE_B_WORLD_ID = "world-package-b-1";
  var NF = {
    org: "org-northfield",
    owner: "person-nf-owner",
    gm: "person-nf-gm",
    scout: "person-nf-scout"
  };
  var SP = {
    org: "org-southport",
    owner: "person-sp-owner",
    gm: "person-sp-gm",
    scout: "person-sp-scout"
  };
  var harness = {
    kind: "test_harness",
    id: entityId("package-b-harness")
  };
  var PackageBScenarioError = class extends Error {
    constructor(message) {
      super(`Package B scenario violated: ${message}`);
      this.name = "PackageBScenarioError";
    }
  };
  var lastOf = (xs) => xs[xs.length - 1].id;
  var lastClaim = (k) => lastOf(k.world.information.claims);
  var lastBelief = (k) => lastOf(k.world.information.beliefs);
  var lastProposal = (k) => lastOf(k.world.decisions.proposals);
  var lastReceipt = (k) => lastOf(k.world.decisions.receipts);
  var planOf = (k, org) => k.world.plans.plans.find(
    (p) => p.organizationId === org && p.status === "active"
  ).id;
  var claim = (by, org, proposition, extra = {}) => __spreadValues({
    type: "RecordClaim",
    organizationId: org,
    actingPersonId: by,
    subject: { kind: "entity", id: SP.org },
    propositionType: "option_note",
    proposition,
    sourceFamilyId: `family-${by}`,
    observedAt: "2026-10-16",
    visibility: "organization",
    confidence: "medium",
    possibleBias: null,
    corroboratesClaimIds: [],
    contradictsClaimIds: []
  }, extra);
  var belief = (by, org, evidence, extra = {}) => __spreadValues({
    type: "FormBelief",
    organizationId: org,
    actingPersonId: by,
    subject: { kind: "entity", id: SP.org },
    assessmentType: "option_assessment",
    assessment: { stance: "leaning" },
    confidence: "medium",
    evidenceClaimIds: evidence,
    supersedesBeliefId: null
  }, extra);
  var planTerms = (owner, prefer, extra = {}) => __spreadValues({
    planId: null,
    kind: "strategy",
    scopeKey: "direction",
    ownerPersonId: owner,
    effectiveAt: "2026-10-16",
    horizon: { seasons: 2 },
    objectives: [{ key: "direction", priority: "high", target: { prefer } }],
    constraints: [],
    triggerRefs: [],
    fallbackPlanIds: [],
    changeReasonRefs: []
  }, extra);
  var submit = (by, org, terms, extra = {}) => __spreadValues({
    type: "SubmitProposal",
    organizationId: org,
    actingPersonId: by,
    category: "organizational_plan",
    subjects: [{ kind: "entity", id: org }],
    termsType: "organization_plan_v1",
    terms,
    requiredApproverPersonIds: [],
    expiresAt: null,
    contingencies: {}
  }, extra);
  var commit = (by, proposalId, beliefIds, evidenceClaimIds) => ({
    type: "CommitPlanProposal",
    actingPersonId: by,
    proposalId,
    expectedRevision: 1,
    beliefIds,
    evidenceClaimIds,
    rationale: { note: "adopt the plan" }
  });
  var require_ = (ok, message) => {
    if (!ok) throw new PackageBScenarioError(message);
  };
  var PACKAGE_B_STEPS = [
    {
      label: "public-fact",
      expect: "committed",
      command: () => claim(
        NF.scout,
        NF.org,
        { fact: "rival_front_office_in_flux" },
        {
          propositionType: "public_situation",
          visibility: "public",
          sourceFamilyId: "family-public-report"
        }
      ),
      after: (k, m) => {
        m.publicClaim = lastClaim(k);
      }
    },
    {
      label: "nf-private-claim",
      expect: "committed",
      command: () => claim(NF.scout, NF.org, { favors: "opt-a" }),
      after: (k, m) => {
        m.nfClaim = lastClaim(k);
      }
    },
    {
      label: "sp-private-claim",
      expect: "committed",
      command: () => claim(SP.scout, SP.org, { favors: "opt-b" }),
      after: (k, m) => {
        m.spClaim = lastClaim(k);
      }
    },
    {
      label: "nf-belief",
      expect: "committed",
      command: (_k, m) => belief(NF.gm, NF.org, [m.publicClaim, m.nfClaim]),
      after: (k, m) => {
        m.nfBelief = lastBelief(k);
      }
    },
    {
      label: "sp-belief",
      expect: "committed",
      command: (_k, m) => belief(SP.gm, SP.org, [m.publicClaim, m.spClaim]),
      after: (k, m) => {
        m.spBelief = lastBelief(k);
        m.spBeliefCanon = canonicalString(
          k.world.information.beliefs.find((b) => b.id === m.spBelief)
        );
      }
    },
    {
      label: "nf-plan-proposed-needs-owner",
      expect: "committed",
      command: () => submit(NF.gm, NF.org, planTerms(NF.gm, "opt-a"), {
        requiredApproverPersonIds: [NF.owner]
      }),
      after: (k, m) => {
        m.nfProposal = lastProposal(k);
        require_(
          k.world.decisions.proposals.at(-1).state === "awaiting_approval",
          "a plan that needs the owner must wait for approval"
        );
      }
    },
    {
      label: "nf-owner-approves",
      expect: "committed",
      command: (_k, m) => ({
        type: "ApproveProposal",
        actingPersonId: NF.owner,
        proposalId: m.nfProposal,
        expectedRevision: 1
      })
    },
    {
      label: "nf-plan-committed",
      expect: "committed",
      command: (_k, m) => commit(NF.gm, m.nfProposal, [m.nfBelief], [m.nfClaim]),
      after: (k, m) => {
        m.nfPlan = planOf(k, NF.org);
        m.nfReceipt = lastReceipt(k);
      }
    },
    {
      label: "sp-plan-proposed",
      expect: "committed",
      command: () => submit(SP.gm, SP.org, planTerms(SP.gm, "opt-b")),
      after: (k, m) => {
        m.spProposal = lastProposal(k);
        require_(
          k.world.decisions.proposals.at(-1).state === "authorized",
          "a GM with approve rights authorizes directly"
        );
      }
    },
    {
      label: "sp-plan-committed",
      expect: "committed",
      command: (_k, m) => commit(SP.gm, m.spProposal, [m.spBelief], [m.spClaim]),
      after: (k, m) => {
        m.spPlan = planOf(k, SP.org);
        m.spReceipt = lastReceipt(k);
        m.spReceiptCanon = canonicalString(
          k.world.decisions.receipts.find((r) => r.id === m.spReceipt)
        );
        require_(
          planOf(k, NF.org) !== m.spPlan,
          "each organization holds its own plan"
        );
      }
    },
    {
      label: "advance-3",
      expect: "committed",
      command: () => ({ type: "AdvanceDays", days: 3 })
    },
    {
      label: "duplicate-command",
      expect: "DUPLICATE_COMMAND",
      duplicate: true,
      command: () => ({ type: "AdvanceDays", days: 3 })
    },
    {
      label: "stale-revision",
      expect: "STALE_REVISION",
      staleRevision: true,
      command: () => ({ type: "AdvanceDays", days: 1 })
    },
    {
      label: "sp-contradicting-claim",
      expect: "committed",
      command: (k, m) => claim(
        SP.scout,
        SP.org,
        { opposes: "opt-b", favors: "opt-c" },
        { observedAt: k.world.simDate, contradictsClaimIds: [m.spClaim] }
      ),
      after: (k, m) => {
        m.spNewClaim = lastClaim(k);
      }
    },
    {
      label: "sp-belief-superseded",
      expect: "committed",
      command: (_k, m) => belief(SP.gm, SP.org, [m.spNewClaim, m.spClaim], {
        supersedesBeliefId: m.spBelief,
        assessment: { stance: "reversed" }
      }),
      after: (k, m) => {
        m.spNewBelief = lastBelief(k);
      }
    },
    {
      label: "sp-revision-proposed",
      expect: "committed",
      command: (k, m) => submit(
        SP.gm,
        SP.org,
        planTerms(SP.gm, "opt-c", {
          planId: m.spPlan,
          effectiveAt: k.world.simDate,
          changeReasonRefs: [m.spNewClaim]
        })
      ),
      after: (k, m) => {
        m.spRevisionProposal = lastProposal(k);
      }
    },
    {
      label: "sp-revision-committed",
      expect: "committed",
      command: (_k, m) => commit(SP.gm, m.spRevisionProposal, [m.spNewBelief], [m.spNewClaim]),
      after: (k, m) => {
        m.spRevisionReceipt = lastReceipt(k);
        const plan = k.world.plans.plans.find((p) => p.id === m.spPlan);
        require_(plan.currentRevision === 2, "the plan gained a second revision");
        require_(
          plan.revisions[1].changeReasonRefs[0] === m.spNewClaim,
          "the revision cites its cause"
        );
        require_(
          canonicalString(
            k.world.information.beliefs.find((b) => b.id === m.spBelief)
          ) === m.spBeliefCanon,
          "the original belief must not change"
        );
        require_(
          canonicalString(
            k.world.decisions.receipts.find((r) => r.id === m.spReceipt)
          ) === m.spReceiptCanon,
          "the original receipt must not change"
        );
      }
    },
    {
      label: "nf-reversal-proposed-without-cause",
      expect: "committed",
      command: (k, m) => submit(
        NF.gm,
        NF.org,
        planTerms(NF.gm, "opt-b", {
          planId: m.nfPlan,
          effectiveAt: k.world.simDate
        })
      ),
      after: (k, m) => {
        m.nfReversalProposal = lastProposal(k);
      }
    },
    {
      label: "nf-unexplained-reversal-refused",
      expect: "INVALID_PAYLOAD",
      command: (_k, m) => commit(NF.gm, m.nfReversalProposal, [], [])
    },
    {
      label: "nf-pending-proposal",
      expect: "committed",
      command: (k) => submit(
        NF.gm,
        NF.org,
        planTerms(NF.gm, "opt-a", {
          scopeKey: "cap-contingency",
          effectiveAt: k.world.simDate
        })
      ),
      after: (k, m) => {
        m.nfPending = lastProposal(k);
      }
    },
    {
      label: "sp-delegates-to-scout",
      expect: "committed",
      command: (k) => ({
        type: "CreateMandate",
        organizationId: SP.org,
        actingPersonId: SP.gm,
        delegatePersonId: SP.scout,
        category: "organizational_plan",
        scope: { scopeKeys: ["strategy"] },
        hardConstraints: { unit: "synthetic_units", maxAmount: 100 },
        preferences: {},
        allowedRights: ["propose"],
        fallback: {},
        escalationRules: { onExceedsHardConstraint: "escalate" },
        effectiveFrom: k.world.simDate,
        effectiveUntil: null
      }),
      after: (k, m) => {
        m.spMandate = lastOf(k.world.authority.mandates);
        require_(
          validateMandateAt(k.world, m.spMandate, k.world.simDate).ok,
          "a fresh mandate is valid"
        );
      }
    },
    {
      label: "sp-scout-role-ends",
      expect: "committed",
      command: () => ({
        type: "EndRoleEpisode",
        actingPersonId: SP.owner,
        episodeId: "role-sp-scout"
      }),
      after: (k, m) => {
        const mandate = k.world.authority.mandates.find(
          (x) => x.id === m.spMandate
        );
        require_(mandate !== void 0, "mandate history is preserved");
        require_(
          !validateMandateAt(k.world, m.spMandate, k.world.simDate).ok,
          "a mandate cannot outlive the role behind it"
        );
      }
    },
    {
      label: "nf-gm-grant-revoked",
      expect: "committed",
      command: () => ({
        type: "RevokeAuthority",
        actingPersonId: NF.owner,
        grantId: "grant-nf-gm-plan"
      })
    },
    {
      label: "nf-pending-commit-fails",
      expect: "INSUFFICIENT_AUTHORITY",
      command: (_k, m) => commit(NF.gm, m.nfPending, [], [])
    }
  ];
  var stateOf = (k) => ({
    fingerprint: fingerprintWorld(k.world),
    rngDraws: k.world.rng.draws,
    chainHead: k.chainHead,
    events: k.eventCount
  });
  var createPackageBGenesisKernel = () => WorldKernel.fromGenesis(
    createWorld(ORG_SUBSTRATE_SEED, SYNTHETIC_RULESET, {
      newWorldId: () => worldId(PACKAGE_B_WORLD_ID)
    }),
    SYNTHETIC_RULESET
  );
  var runPackageBScenario = (options = {}) => {
    let kernel = createPackageBGenesisKernel();
    const memo = {};
    const steps = [];
    PACKAGE_B_STEPS.forEach((spec2, index) => {
      var _a, _b, _c, _d;
      kernel = (_b = (_a = options.beforeStep) == null ? void 0 : _a.call(options, index, kernel)) != null ? _b : kernel;
      const known = kernel.knownCommandIds;
      const n = spec2.duplicate === true ? known.length : known.length + 1;
      const envelope = {
        commandId: commandId(`cmd-${String(n).padStart(6, "0")}`),
        expectedRevision: worldRevision(
          spec2.staleRevision === true ? 0 : Number(kernel.world.revision)
        ),
        actor: harness,
        command: spec2.command(kernel, memo)
      };
      const before = stateOf(kernel);
      const result2 = kernel.execute(envelope);
      if (spec2.expect === "committed") {
        if (!result2.ok)
          throw new PackageBScenarioError(
            `${spec2.label} should commit but was rejected: ${result2.rejection.code}: ${result2.rejection.message}`
          );
        (_c = options.onCommit) == null ? void 0 : _c.call(options, {
          snapshot: sealSnapshot({
            world: kernel.world,
            chainHead: kernel.chainHead,
            eventCount: kernel.eventCount,
            knownCommandIds: kernel.knownCommandIds
          }),
          commands: [{ envelope, resultRevision: Number(result2.world.revision) }],
          events: result2.events
        });
        (_d = spec2.after) == null ? void 0 : _d.call(spec2, kernel, memo);
      } else {
        if (result2.ok)
          throw new PackageBScenarioError(
            `${spec2.label} should be rejected as ${spec2.expect} but committed`
          );
        if (result2.rejection.code !== spec2.expect)
          throw new PackageBScenarioError(
            `${spec2.label} rejected as ${result2.rejection.code}, expected ${spec2.expect}`
          );
        const after = stateOf(kernel);
        if (after.fingerprint !== before.fingerprint || after.rngDraws !== before.rngDraws || after.chainHead !== before.chainHead || after.events !== before.events)
          throw new PackageBScenarioError(
            `${spec2.label} changed state or consumed randomness`
          );
      }
      steps.push({
        label: spec2.label,
        outcome: spec2.expect,
        revision: Number(kernel.world.revision),
        rngDraws: kernel.world.rng.draws,
        fingerprint: fingerprintWorld(kernel.world),
        chainHead: kernel.chainHead
      });
    });
    const keys = [
      "publicClaim",
      "nfClaim",
      "spClaim",
      "nfBelief",
      "spBelief",
      "nfProposal",
      "nfPlan",
      "nfReceipt",
      "spProposal",
      "spPlan",
      "spReceipt",
      "spNewClaim",
      "spNewBelief",
      "spRevisionProposal",
      "spRevisionReceipt",
      "nfPending",
      "spMandate"
    ];
    return {
      scenario: PACKAGE_B_SCENARIO_ID,
      worldId: kernel.world.worldId,
      finalSimDate: kernel.world.simDate,
      revision: Number(kernel.world.revision),
      eventCount: kernel.eventCount,
      rngDraws: kernel.world.rng.draws,
      fingerprint: fingerprintWorld(kernel.world),
      eventChainHead: kernel.chainHead,
      keyRecordIds: Object.fromEntries(keys.map((key) => [key, memo[key]])),
      steps
    };
  };
  var diffPackageB = (actual, expected) => {
    const diffs2 = [];
    const keys = [
      "scenario",
      "worldId",
      "finalSimDate",
      "revision",
      "eventCount",
      "rngDraws",
      "fingerprint",
      "eventChainHead"
    ];
    for (const k of keys)
      if (actual[k] !== expected[k])
        diffs2.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
    if (JSON.stringify(actual.keyRecordIds) !== JSON.stringify(expected.keyRecordIds))
      diffs2.push("keyRecordIds differ");
    if (JSON.stringify(actual.steps) !== JSON.stringify(expected.steps))
      diffs2.push("per-step results differ");
    return diffs2;
  };

  // packages/sim-core/src/packageBGoldenExpected.ts
  var PACKAGE_B_EXPECTED = {
    scenario: PACKAGE_B_SCENARIO_ID,
    worldId: PACKAGE_B_WORLD_ID,
    finalSimDate: "2026-10-19",
    revision: 20,
    eventCount: 33,
    rngDraws: 3,
    fingerprint: "fc1163b8df89db98d951a6393341986c72992853eea4198bb678c941a36c064c",
    eventChainHead: "934b6d86fe79af00c6de40da67e64e1b4bdb7039701c7c45af1598a61ed4f9d0",
    keyRecordIds: {
      publicClaim: "rec-000001",
      nfClaim: "rec-000002",
      spClaim: "rec-000003",
      nfBelief: "rec-000004",
      spBelief: "rec-000005",
      nfProposal: "rec-000006",
      nfPlan: "rec-000008",
      nfReceipt: "rec-000009",
      spProposal: "rec-000010",
      spPlan: "rec-000011",
      spReceipt: "rec-000012",
      spNewClaim: "rec-000013",
      spNewBelief: "rec-000014",
      spRevisionProposal: "rec-000015",
      spRevisionReceipt: "rec-000016",
      nfPending: "rec-000018",
      spMandate: "rec-000019"
    },
    steps: [
      {
        label: "public-fact",
        outcome: "committed",
        revision: 1,
        rngDraws: 0,
        fingerprint: "d23eebceb977636da1a5aaa5c8b579c99b5fc38c62fa4235da6e7b23c01ca9e3",
        chainHead: "97bb1ecc29b5d8e2d4521f1d52f7fa2bfe454a79b34046c670cc423949ef8b2f"
      },
      {
        label: "nf-private-claim",
        outcome: "committed",
        revision: 2,
        rngDraws: 0,
        fingerprint: "41f3a0bef4fad399a4406cbc798bcb155c1ca98c824804da4e3a2d4ed3cb4c90",
        chainHead: "53e568ef5d2bdc3efb9a7373767c73c11657878369478973e429958e5276e239"
      },
      {
        label: "sp-private-claim",
        outcome: "committed",
        revision: 3,
        rngDraws: 0,
        fingerprint: "d48615d0b2f81971acf66c97ab577b0a3a0dac66b1cf5b20f027609fcfc34221",
        chainHead: "e1842ca2e28aa550dbcc7253473a50a4b84c8054e76482781a815f28254ab3b1"
      },
      {
        label: "nf-belief",
        outcome: "committed",
        revision: 4,
        rngDraws: 0,
        fingerprint: "3cc2e7e8f17d66ab8db1e150d8383e52dd3805f4ea6efec070bceeed5113c2db",
        chainHead: "165cb07ccbf67b82d6c38e1db0f40bfb91d053e5e1e4d11657ececbdbfc6a8dd"
      },
      {
        label: "sp-belief",
        outcome: "committed",
        revision: 5,
        rngDraws: 0,
        fingerprint: "00e0ead1e4168e03de80499205783247b7331b2cec826e5214864d77243aabf8",
        chainHead: "5ee8562d5fc41ba2880407b0e728bdc6b52727e7593162736dc53eb983ac6d34"
      },
      {
        label: "nf-plan-proposed-needs-owner",
        outcome: "committed",
        revision: 6,
        rngDraws: 0,
        fingerprint: "35711d9f3ae0d655fbcd3e38e9e38364f5382b751cd98017fe138aed2a759657",
        chainHead: "a6690dc885dd3e29c8a2abfc44594431a8be1374502e64f11162a9b1b32fa6b8"
      },
      {
        label: "nf-owner-approves",
        outcome: "committed",
        revision: 7,
        rngDraws: 0,
        fingerprint: "a11e51bf18710fe92a010e0992e93ce512adcdd4cefd35e7c349af5ec5250e07",
        chainHead: "006ba7d20d2213a7a212fb7bd03142c617bbdb262322e767d5ee6a9dfe98a3af"
      },
      {
        label: "nf-plan-committed",
        outcome: "committed",
        revision: 8,
        rngDraws: 0,
        fingerprint: "3b038056051ffcce2ef7d2059ccc841130e6903474b83c88de7601378df34e11",
        chainHead: "814d6c646e9753eeaa8f5453d94b399154a0dbc607c63a2ab8dd0f8ce8c8cd02"
      },
      {
        label: "sp-plan-proposed",
        outcome: "committed",
        revision: 9,
        rngDraws: 0,
        fingerprint: "49db0ca7d065f8ad8edf53a79bda8f4dd09dc7271970c45545d857e9044fb9f1",
        chainHead: "22121ea0a057436a34dbe73104d2abeb2dd4dce4c8412f8ae34709442e2fead6"
      },
      {
        label: "sp-plan-committed",
        outcome: "committed",
        revision: 10,
        rngDraws: 0,
        fingerprint: "484a9d3cf93e5c0f56386657a8126f436d014bf5003dc471180e94d211b9fdfe",
        chainHead: "9f0d40c6678e86eed18f0dbb0fa67c674184739dfc5c2497e4302ee960e64730"
      },
      {
        label: "advance-3",
        outcome: "committed",
        revision: 11,
        rngDraws: 3,
        fingerprint: "237f3a7c40227d988e95fa95e8709639ae935a96352237d72d6cd9a1a4b9d957",
        chainHead: "ab120e1df67107793881fb32b951c0325073c93b9d72030a9bc805733a2c4844"
      },
      {
        label: "duplicate-command",
        outcome: "DUPLICATE_COMMAND",
        revision: 11,
        rngDraws: 3,
        fingerprint: "237f3a7c40227d988e95fa95e8709639ae935a96352237d72d6cd9a1a4b9d957",
        chainHead: "ab120e1df67107793881fb32b951c0325073c93b9d72030a9bc805733a2c4844"
      },
      {
        label: "stale-revision",
        outcome: "STALE_REVISION",
        revision: 11,
        rngDraws: 3,
        fingerprint: "237f3a7c40227d988e95fa95e8709639ae935a96352237d72d6cd9a1a4b9d957",
        chainHead: "ab120e1df67107793881fb32b951c0325073c93b9d72030a9bc805733a2c4844"
      },
      {
        label: "sp-contradicting-claim",
        outcome: "committed",
        revision: 12,
        rngDraws: 3,
        fingerprint: "23e389bab260ae5fff484b75897425dcd565c4c187ed7fa837aa758db0773400",
        chainHead: "37b8c703ac94ba87ffc82c731f8b6b46d3a3b7534799aa3c8da28b56a65ee558"
      },
      {
        label: "sp-belief-superseded",
        outcome: "committed",
        revision: 13,
        rngDraws: 3,
        fingerprint: "2a67203fc35fe66a39841d4f1efe195997872b2aa81bf8168189cc887341bd29",
        chainHead: "c4f88ce8da78ea8e6eea161e021f40dfebe2b8c12534177ea82a29811369f66f"
      },
      {
        label: "sp-revision-proposed",
        outcome: "committed",
        revision: 14,
        rngDraws: 3,
        fingerprint: "e38bad20f6853911978d18baec19036608d1d49b35c59ada1ab3b99519808b3c",
        chainHead: "baca23d11d96e92a6bc8b16e408bf346e175430faf59ceba1d44a93e8dd22994"
      },
      {
        label: "sp-revision-committed",
        outcome: "committed",
        revision: 15,
        rngDraws: 3,
        fingerprint: "b22aafe10093c2af2dcbbb5041cbba6bd16f39e338cd11ac57c1649f6a6ff51d",
        chainHead: "141769d6b372c6ea08dc5d0c3ff91ae60b63016466b203e5589bee632ec4c4ed"
      },
      {
        label: "nf-reversal-proposed-without-cause",
        outcome: "committed",
        revision: 16,
        rngDraws: 3,
        fingerprint: "b037765dfab6c0e400ea18ee2257d7bdab79b9b678532804603889aea9053989",
        chainHead: "0066c05c8fce685c147c4f13aa1ff3bd966b2a53dc203d125927b14a905951d5"
      },
      {
        label: "nf-unexplained-reversal-refused",
        outcome: "INVALID_PAYLOAD",
        revision: 16,
        rngDraws: 3,
        fingerprint: "b037765dfab6c0e400ea18ee2257d7bdab79b9b678532804603889aea9053989",
        chainHead: "0066c05c8fce685c147c4f13aa1ff3bd966b2a53dc203d125927b14a905951d5"
      },
      {
        label: "nf-pending-proposal",
        outcome: "committed",
        revision: 17,
        rngDraws: 3,
        fingerprint: "e240337fab10288af801c5a3ea95eab923291c28b4383972dc9ddca758851a8b",
        chainHead: "e1e4dce5658c436a8dbeb63a35b396da3343fe33949b107203e5c6ef192884d3"
      },
      {
        label: "sp-delegates-to-scout",
        outcome: "committed",
        revision: 18,
        rngDraws: 3,
        fingerprint: "c1fb73226f828d83d689e4cbebf335f2c427abd7d7bc85fa37fe0524723acdc2",
        chainHead: "b23341a80625da1ba24e0fdad422023d559b61161f265e529e9dbaf748900ff2"
      },
      {
        label: "sp-scout-role-ends",
        outcome: "committed",
        revision: 19,
        rngDraws: 3,
        fingerprint: "bb788b36a19abac7eb18fb0abb8ce394f6cd9ab6f0981ad2f8744c68173b9fda",
        chainHead: "8538c862a79ba3c99b6f0421bcc59d05ff83cceb8a51b6272d57096a6b9d8838"
      },
      {
        label: "nf-gm-grant-revoked",
        outcome: "committed",
        revision: 20,
        rngDraws: 3,
        fingerprint: "fc1163b8df89db98d951a6393341986c72992853eea4198bb678c941a36c064c",
        chainHead: "934b6d86fe79af00c6de40da67e64e1b4bdb7039701c7c45af1598a61ed4f9d0"
      },
      {
        label: "nf-pending-commit-fails",
        outcome: "INSUFFICIENT_AUTHORITY",
        revision: 20,
        rngDraws: 3,
        fingerprint: "fc1163b8df89db98d951a6393341986c72992853eea4198bb678c941a36c064c",
        chainHead: "934b6d86fe79af00c6de40da67e64e1b4bdb7039701c7c45af1598a61ed4f9d0"
      }
    ]
  };

  // scripts/hermes/entryPackageB.ts
  var result = runPackageBScenario();
  var diffs = diffPackageB(result, PACKAGE_B_EXPECTED);
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
      keyRecordIds: result.keyRecordIds
    })
  );
})();
