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
  var __objRest = (source, exclude) => {
    var target = {};
    for (var prop in source)
      if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
        target[prop] = source[prop];
    if (source != null && __getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(source)) {
        if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
          target[prop] = source[prop];
      }
    return target;
  };
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
  var utf8Encode = (text3) => {
    const out = [];
    for (let i = 0; i < text3.length; i++) {
      let cp = text3.charCodeAt(i);
      if (cp >= 55296 && cp <= 56319) {
        const lo = text3.charCodeAt(i + 1);
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

  // packages/sim-core/src/economy.ts
  var MoneyError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "MoneyError";
    }
  };
  var isMoneyAmount = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  var moneyAmount = (v) => {
    if (!isMoneyAmount(v))
      throw new MoneyError(
        `money must be a non-negative safe integer, got ${String(v)}`
      );
    return v;
  };
  var addMoney = (a, b) => moneyAmount(a + b);
  var sumMoney = (xs) => xs.reduce((acc, x) => addMoney(acc, x), 0);
  var ZERO_MONEY = 0;
  var fail = (path, message) => {
    throw new ManifestFormatError(`${path}: ${message}`);
  };
  var asMoney = (v, path) => {
    if (!isMoneyAmount(v))
      return fail(
        path,
        "must be a non-negative safe integer (no floats, no negatives)"
      );
    return v;
  };
  var asBool = (v, path) => {
    if (typeof v !== "boolean") return fail(path, "must be a boolean");
    return v;
  };
  var asDate = (v, path) => {
    if (!SimDate.isValidISO(v))
      return fail(path, "must be a valid YYYY-MM-DD logical date");
    return v;
  };
  var asArray = (v, path) => {
    if (!Array.isArray(v)) return fail(path, "must be an array");
    return v;
  };
  var dateIndex = (iso) => SimDate.parse(iso).epochDay;
  var parseSeason = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      [
        "season",
        "salaryCap",
        "activeRosterLimit",
        "reserveRosterLimit",
        "practiceSquadLimit",
        "freeAgencyOpen",
        "freeAgencyClose",
        "tradeDeadline",
        "draftDate"
      ],
      [],
      path
    );
    const out = {
      season: asSafeInt(r.season, `${path}.season`, 1900, 3e3),
      salaryCap: asMoney(r.salaryCap, `${path}.salaryCap`),
      activeRosterLimit: asSafeInt(
        r.activeRosterLimit,
        `${path}.activeRosterLimit`,
        1,
        1e3
      ),
      reserveRosterLimit: asSafeInt(
        r.reserveRosterLimit,
        `${path}.reserveRosterLimit`,
        0,
        1e3
      ),
      practiceSquadLimit: asSafeInt(
        r.practiceSquadLimit,
        `${path}.practiceSquadLimit`,
        0,
        1e3
      ),
      freeAgencyOpen: asDate(r.freeAgencyOpen, `${path}.freeAgencyOpen`),
      freeAgencyClose: asDate(r.freeAgencyClose, `${path}.freeAgencyClose`),
      tradeDeadline: asDate(r.tradeDeadline, `${path}.tradeDeadline`),
      draftDate: asDate(r.draftDate, `${path}.draftDate`)
    };
    if (dateIndex(out.freeAgencyOpen) > dateIndex(out.freeAgencyClose))
      fail(path, "freeAgencyOpen must not be after freeAgencyClose");
    return out;
  };
  var parseContracts = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      [
        "minYears",
        "maxYears",
        "signingBonusProrationMaxYears",
        "minimumBaseSalary",
        "guaranteedFutureBaseOnRelease",
        "signingBonusStaysWithOriginalClubOnTrade"
      ],
      [],
      path
    );
    const out = {
      minYears: asSafeInt(r.minYears, `${path}.minYears`, 1, 30),
      maxYears: asSafeInt(r.maxYears, `${path}.maxYears`, 1, 30),
      signingBonusProrationMaxYears: asSafeInt(
        r.signingBonusProrationMaxYears,
        `${path}.signingBonusProrationMaxYears`,
        1,
        30
      ),
      minimumBaseSalary: asMoney(
        r.minimumBaseSalary,
        `${path}.minimumBaseSalary`
      ),
      guaranteedFutureBaseOnRelease: asBool(
        r.guaranteedFutureBaseOnRelease,
        `${path}.guaranteedFutureBaseOnRelease`
      ),
      signingBonusStaysWithOriginalClubOnTrade: asBool(
        r.signingBonusStaysWithOriginalClubOnTrade,
        `${path}.signingBonusStaysWithOriginalClubOnTrade`
      )
    };
    if (out.minYears > out.maxYears)
      fail(path, "minYears must not exceed maxYears");
    return out;
  };
  var parseMarket = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      [
        "defaultOfferValidityDays",
        "futurePickTradeHorizonSeasons",
        "resolutionPolicy"
      ],
      [],
      path
    );
    if (r.resolutionPolicy !== "checkpoint")
      fail(`${path}.resolutionPolicy`, 'unsupported policy (only "checkpoint")');
    return {
      defaultOfferValidityDays: asSafeInt(
        r.defaultOfferValidityDays,
        `${path}.defaultOfferValidityDays`,
        1,
        3650
      ),
      futurePickTradeHorizonSeasons: asSafeInt(
        r.futurePickTradeHorizonSeasons,
        `${path}.futurePickTradeHorizonSeasons`,
        0,
        20
      ),
      resolutionPolicy: "checkpoint"
    };
  };
  var parseWaivers = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      ["claimWindowDays", "releasedPlayerWaiverPolicy", "claimWinnerMovesToEnd"],
      [],
      path
    );
    const policy = r.releasedPlayerWaiverPolicy;
    if (policy !== "all" && policy !== "none")
      fail(
        `${path}.releasedPlayerWaiverPolicy`,
        'unsupported policy (only "all" or "none")'
      );
    return {
      claimWindowDays: asSafeInt(
        r.claimWindowDays,
        `${path}.claimWindowDays`,
        1,
        365
      ),
      releasedPlayerWaiverPolicy: policy,
      claimWinnerMovesToEnd: asBool(
        r.claimWinnerMovesToEnd,
        `${path}.claimWinnerMovesToEnd`
      )
    };
  };
  var parseRookie = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      ["round", "years", "baseSalaryBySeason", "signingBonus"],
      [],
      path
    );
    const years = asSafeInt(r.years, `${path}.years`, 1, 30);
    const salaries = asArray(
      r.baseSalaryBySeason,
      `${path}.baseSalaryBySeason`
    ).map((m, i) => asMoney(m, `${path}.baseSalaryBySeason[${i}]`));
    if (salaries.length !== years)
      fail(
        path,
        "baseSalaryBySeason must have exactly one amount per contract year"
      );
    return {
      round: asSafeInt(r.round, `${path}.round`, 1, 100),
      years,
      baseSalaryBySeason: salaries,
      signingBonus: asMoney(r.signingBonus, `${path}.signingBonus`)
    };
  };
  var parseDraft = (v, path, contracts) => {
    const r = asRecord(v, path);
    requireExactKeys(r, ["rounds", "rookieContractByRound"], [], path);
    const rounds = asSafeInt(r.rounds, `${path}.rounds`, 1, 100);
    const rules = asArray(
      r.rookieContractByRound,
      `${path}.rookieContractByRound`
    ).map((x, i) => parseRookie(x, `${path}.rookieContractByRound[${i}]`));
    const seen = /* @__PURE__ */ new Set();
    for (const rule of rules) {
      if (seen.has(rule.round))
        fail(path, `duplicate rookie contract rule for round ${rule.round}`);
      seen.add(rule.round);
      if (rule.round > rounds)
        fail(path, `rookie contract rule for round ${rule.round} exceeds rounds`);
      if (rule.years < contracts.minYears || rule.years > contracts.maxYears)
        fail(
          path,
          `round ${rule.round} rookie years violate contract term bounds`
        );
      if (rule.baseSalaryBySeason.some((m) => m < contracts.minimumBaseSalary))
        fail(
          path,
          `round ${rule.round} rookie base salary below the contract minimum`
        );
    }
    for (let round = 1; round <= rounds; round += 1)
      if (!seen.has(round))
        fail(path, `missing rookie contract rule for round ${round}`);
    rules.forEach((rule, i) => {
      if (rule.round !== i + 1)
        fail(
          path,
          "rookieContractByRound must be listed in ascending round order"
        );
    });
    return { rounds, rookieContractByRound: rules };
  };
  var parseTransactionRulesV1 = (v, path) => {
    const r = asRecord(v, path);
    requireExactKeys(
      r,
      ["moneyUnit", "seasonRules", "contracts", "market", "waivers", "draft"],
      [],
      path
    );
    if (r.moneyUnit !== "synthetic-unit")
      fail(`${path}.moneyUnit`, 'unsupported money unit (only "synthetic-unit")');
    const seasonRules2 = asArray(r.seasonRules, `${path}.seasonRules`).map(
      (s, i) => parseSeason(s, `${path}.seasonRules[${i}]`)
    );
    if (seasonRules2.length === 0)
      fail(`${path}.seasonRules`, "at least one season is required");
    for (let i = 1; i < seasonRules2.length; i += 1) {
      const prev = seasonRules2[i - 1].season;
      const cur = seasonRules2[i].season;
      if (cur === prev) fail(`${path}.seasonRules`, `duplicate season ${cur}`);
      if (cur < prev)
        fail(`${path}.seasonRules`, "seasons must be listed in ascending order");
    }
    const contracts = parseContracts(r.contracts, `${path}.contracts`);
    return {
      moneyUnit: "synthetic-unit",
      seasonRules: seasonRules2,
      contracts,
      market: parseMarket(r.market, `${path}.market`),
      waivers: parseWaivers(r.waivers, `${path}.waivers`),
      draft: parseDraft(r.draft, `${path}.draft`, contracts)
    };
  };
  var MissingTransactionRulesError = class extends Error {
    constructor(rulesetId) {
      super(
        `Ruleset "${rulesetId}" declares no transaction rules; Package C transaction actions fail closed`
      );
      this.name = "MissingTransactionRulesError";
    }
  };
  var UnknownTransactionSeasonError = class extends Error {
    constructor(season) {
      super(
        `The active ruleset declares no transaction rules for season ${season}`
      );
      this.name = "UnknownTransactionSeasonError";
    }
  };
  var requireTransactionRules = (ruleset) => {
    const tx2 = ruleset.rules.transactions;
    if (tx2 === void 0)
      throw new MissingTransactionRulesError(ruleset.rulesetId);
    return tx2;
  };
  var transactionSeasonRules = (tx2, season) => {
    const found = tx2.seasonRules.find((s) => s.season === season);
    if (found === void 0) throw new UnknownTransactionSeasonError(season);
    return found;
  };
  var prorateSigningBonus = (contracts, signingBonus, years) => {
    if (!Number.isSafeInteger(years) || years < 1)
      throw new MoneyError(
        `contract years must be a positive integer, got ${String(years)}`
      );
    const window2 = Math.min(years, contracts.signingBonusProrationMaxYears);
    const base = Math.floor(signingBonus / window2);
    const remainder = signingBonus - base * window2;
    const out = [];
    for (let i = 0; i < years; i += 1)
      out.push(
        i < window2 ? moneyAmount(base + (i < remainder ? 1 : 0)) : ZERO_MONEY
      );
    return out;
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
    requireExactKeys(
      rules,
      ["maxAdvanceDaysPerCommand"],
      ["transactions"],
      "ruleset.rules"
    );
    const transactions = rules.transactions === void 0 ? void 0 : parseTransactionRulesV1(
      rules.transactions,
      "ruleset.rules.transactions"
    );
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
      rules: __spreadValues({
        maxAdvanceDaysPerCommand: asSafeInt(
          rules.maxAdvanceDaysPerCommand,
          "rules.maxAdvanceDaysPerCommand",
          1,
          3650
        )
      }, transactions === void 0 ? {} : { transactions })
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
    const rights2 = m.allowedRights.filter((r) => transferable.has(r));
    if (rights2.length === 0)
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
    return { ok: true, rights: rights2 };
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

  // packages/sim-core/src/market.ts
  var PREFERENCE_LEVELS = ["low", "medium", "high"];
  var ROLE_COMMITMENTS = [
    "starter",
    "rotation",
    "depth",
    "developmental"
  ];
  var INQUIRY_DIRECTIONS = ["seek", "shop"];
  var emptyMarketState = () => ({
    agentClients: [],
    playerPreferences: [],
    inquiries: [],
    tradeOffers: [],
    contractOffers: [],
    reservations: [],
    responses: []
  });
  var byText2 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededMarketState = (sub) => {
    if (sub === void 0) return emptyMarketState();
    return __spreadProps(__spreadValues({}, emptyMarketState()), {
      agentClients: sub.agentClients.map((a) => ({
        id: recordId(a.id),
        agentPersonId: entityId(a.agentPersonId),
        playerPersonId: entityId(a.playerPersonId),
        effectiveFrom: a.effectiveFrom,
        effectiveUntil: a.effectiveUntil
      })).sort((a, b) => byText2(a.id, b.id)),
      playerPreferences: sub.playerPreferences.map((p) => ({
        playerPersonId: entityId(p.playerPersonId),
        security: p.security,
        earlyCash: p.earlyCash,
        roleOpportunity: p.roleOpportunity,
        contenderPreference: p.contenderPreference,
        flexibility: p.flexibility
      })).sort((a, b) => byText2(a.playerPersonId, b.playerPersonId))
    });
  };
  var reservedCap = (market, organizationId, season) => {
    var _a;
    const alone = (r) => {
      var _a2, _b;
      return (_b = (_a2 = r.capBySeason.find((x) => x.season === season)) == null ? void 0 : _a2.amount) != null ? _b : 0;
    };
    let total = 0;
    const groupMax = /* @__PURE__ */ new Map();
    for (const r of market.reservations) {
      if (r.organizationId !== organizationId || r.status !== "active") continue;
      if (r.contingencyGroupId === null) total += alone(r);
      else
        groupMax.set(
          r.contingencyGroupId,
          Math.max((_a = groupMax.get(r.contingencyGroupId)) != null ? _a : 0, alone(r))
        );
    }
    for (const v of groupMax.values()) total += v;
    return total;
  };
  var reservedSlots = (market, organizationId, status) => {
    let total = 0;
    const groups = /* @__PURE__ */ new Set();
    for (const r of market.reservations) {
      if (r.organizationId !== organizationId || r.status !== "active" || r.rosterSlotStatus !== status)
        continue;
      if (r.contingencyGroupId === null) total += 1;
      else groups.add(r.contingencyGroupId);
    }
    return total + groups.size;
  };

  // packages/sim-core/src/contractMath.ts
  var nonZero = (xs) => xs.filter((x) => x.amount > 0);
  var contractTermsProblems = (tx2, terms) => {
    const problems = [];
    const rules = tx2.contracts;
    const n = terms.years.length;
    if (n < rules.minYears || n > rules.maxYears)
      problems.push(
        `contract length ${n} is outside ${rules.minYears}..${rules.maxYears} years`
      );
    terms.years.forEach((y, i) => {
      if (y.season !== terms.startSeason + i)
        problems.push(
          `year ${i + 1} is season ${y.season}, expected ${terms.startSeason + i} (seasons must be contiguous)`
        );
      if (y.baseSalary < rules.minimumBaseSalary)
        problems.push(
          `season ${y.season} base salary ${y.baseSalary} is below the minimum ${rules.minimumBaseSalary}`
        );
      if (y.guaranteedBase > y.baseSalary)
        problems.push(
          `season ${y.season} guaranteed base ${y.guaranteedBase} exceeds base salary ${y.baseSalary}`
        );
    });
    return problems;
  };
  var bonusProration = (rules, terms) => prorateSigningBonus(rules, terms.signingBonus, terms.years.length);
  var extensionRetainedBonus = (rules, oldTerms, fromSeason) => {
    const bonus = bonusProration(rules, oldTerms);
    return nonZero(
      oldTerms.years.map((y, i) => ({ season: y.season, amount: bonus[i] })).filter((x) => x.season >= fromSeason)
    );
  };
  var capChargeBySeason = (rules, terms) => {
    const bonus = bonusProration(rules, terms);
    return terms.years.map((y, i) => ({
      season: y.season,
      amount: sumMoney([y.baseSalary, y.rosterBonus, bonus[i]])
    }));
  };
  var releaseImpact = (rules, terms, releaseSeason) => {
    const bonus = bonusProration(rules, terms);
    const dead = [];
    const cash = [];
    terms.years.forEach((y, i) => {
      if (y.season < releaseSeason) return;
      const owed = y.season === releaseSeason || rules.guaranteedFutureBaseOnRelease ? y.guaranteedBase : ZERO_MONEY;
      cash.push(owed);
      dead.push({ season: y.season, amount: addMoney(bonus[i], owed) });
    });
    return { deadCapBySeason: nonZero(dead), guaranteedCashDue: sumMoney(cash) };
  };
  var tradeImpact = (rules, terms, tradeSeason) => {
    const bonus = bonusProration(rules, terms);
    const receiver = [];
    const sender = [];
    terms.years.forEach((y, i) => {
      if (y.season < tradeSeason) return;
      const stays = rules.signingBonusStaysWithOriginalClubOnTrade;
      receiver.push({
        season: y.season,
        amount: sumMoney([
          y.baseSalary,
          y.rosterBonus,
          stays ? ZERO_MONEY : bonus[i]
        ])
      });
      sender.push({ season: y.season, amount: stays ? bonus[i] : ZERO_MONEY });
    });
    return {
      receiverCapBySeason: receiver,
      senderDeadCapBySeason: nonZero(sender)
    };
  };
  var amountIn = (xs, season) => {
    var _a, _b;
    return (_b = (_a = xs.find((x) => x.season === season)) == null ? void 0 : _a.amount) != null ? _b : ZERO_MONEY;
  };
  var agreementCapCharge = (rules, agreement, season) => amountIn(capChargeBySeason(rules, agreement.terms), season);
  var organizationCommitments = (rules, contracts, organizationId, season) => sumMoney([
    ...contracts.agreements.filter(
      (a) => a.organizationId === organizationId && a.status === "active"
    ).map((a) => agreementCapCharge(rules, a, season)),
    ...contracts.terminations.filter((t) => t.organizationId === organizationId).map((t) => amountIn(t.deadCapBySeason, season))
  ]);
  var capPosition = (tx2, contracts, organizationId, season) => {
    const cap = transactionSeasonRules(tx2, season).salaryCap;
    const committed = organizationCommitments(
      tx2.contracts,
      contracts,
      organizationId,
      season
    );
    return { season, cap, committed, space: cap - committed };
  };

  // packages/sim-core/src/contracts.ts
  var emptyContractsState = () => ({
    agreements: [],
    terminations: []
  });
  var byText3 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededContractsState = (sub) => {
    if (sub === void 0) return emptyContractsState();
    return {
      agreements: sub.contracts.map((c) => ({
        id: recordId(c.id),
        playerId: entityId(c.playerId),
        organizationId: entityId(c.organizationId),
        terms: {
          startSeason: c.startSeason,
          signingBonus: moneyAmount(c.signingBonus),
          years: c.years.map((y) => ({
            season: y.season,
            baseSalary: moneyAmount(y.baseSalary),
            rosterBonus: moneyAmount(y.rosterBonus),
            guaranteedBase: moneyAmount(y.guaranteedBase)
          }))
        },
        signedAt: c.signedAt,
        sourceOfferId: null,
        sourceProposalId: null,
        supersedesAgreementId: null,
        status: "active"
      })).sort((a, b) => byText3(a.id, b.id)),
      terminations: []
    };
  };
  var activeAgreementFor = (contracts, playerId, organizationId) => contracts.agreements.find(
    (a) => a.playerId === playerId && a.status === "active" && (organizationId === void 0 || a.organizationId === organizationId)
  );

  // packages/sim-core/src/draft.ts
  var DRAFT_PICK_STATUSES = ["available", "used"];
  var NEED_PRIORITIES = [
    "low",
    "normal",
    "high",
    "must_address"
  ];
  var MIN_BOARD_TIER = 1;
  var MAX_BOARD_TIER = 8;
  var isUndraftedProspect = (draft, playerId) => draft.classes.some(
    (c) => c.eligiblePlayerIds.includes(playerId) && !draft.sessions.some(
      (s) => s.draftClassId === c.id && s.status === "complete"
    )
  );
  var emptyDraftState = () => ({
    classes: [],
    picks: [],
    boards: [],
    sessions: [],
    selections: []
  });
  var byText4 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededDraftState = (sub) => {
    if (sub === void 0) return emptyDraftState();
    return __spreadProps(__spreadValues({}, emptyDraftState()), {
      classes: sub.draftClasses.map((c) => ({
        id: recordId(c.id),
        season: c.season,
        eligiblePlayerIds: c.eligiblePlayerIds.map((p) => entityId(p)).sort(byText4)
      })).sort((a, b) => byText4(a.id, b.id)),
      picks: sub.draftPicks.map((p) => ({
        id: recordId(p.id),
        season: p.season,
        round: p.round,
        slot: p.slot,
        originalOrganizationId: entityId(p.originalOrganizationId),
        ownerOrganizationId: entityId(p.ownerOrganizationId),
        status: p.status
      })).sort((a, b) => byText4(a.id, b.id))
    });
  };

  // packages/sim-core/src/roster.ts
  var RIGHTS_KINDS = ["contract", "draft", "exclusive"];
  var ROSTER_STATUSES = ["active", "reserve", "practice_squad"];
  var emptyRosterState = () => ({
    players: [],
    rights: [],
    memberships: [],
    waivers: [],
    waiverClaims: [],
    waiverPriority: []
  });
  var byText5 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededRosterState = (sub) => {
    if (sub === void 0) return emptyRosterState();
    return {
      players: sub.players.map((p) => ({
        personId: entityId(p.personId),
        birthDate: p.birthDate,
        primaryRole: p.primaryRole,
        roleTags: [...p.roleTags].sort(byText5),
        capabilities: p.capabilities.map((c) => ({ key: c.key, valueBp: c.valueBp })).sort((a, b) => byText5(a.key, b.key))
      })).sort((a, b) => byText5(a.personId, b.personId)),
      rights: sub.rights.map((r) => ({
        id: recordId(r.id),
        playerId: entityId(r.playerId),
        holderOrganizationId: entityId(r.holderOrganizationId),
        kind: r.kind,
        sourceRecordId: recordId(r.sourceRecordId),
        effectiveFrom: r.effectiveFrom,
        effectiveUntil: r.effectiveUntil
      })).sort((a, b) => byText5(a.id, b.id)),
      memberships: sub.memberships.map((m) => ({
        id: recordId(m.id),
        playerId: entityId(m.playerId),
        organizationId: entityId(m.organizationId),
        status: m.status,
        effectiveFrom: m.effectiveFrom,
        effectiveUntil: m.effectiveUntil,
        sourceRecordId: recordId(m.sourceRecordId)
      })).sort((a, b) => byText5(a.id, b.id)),
      waivers: [],
      waiverClaims: [],
      waiverPriority: sub.waiverPriority.map((o) => entityId(o))
    };
  };
  var seasonOfDate = (date) => Number(date.slice(0, 4));
  var isEffectiveOn = (r, date) => r.effectiveFrom <= date && (r.effectiveUntil === null || date <= r.effectiveUntil);
  var activeRightsFor = (roster, playerId, date) => roster.rights.filter((r) => r.playerId === playerId && isEffectiveOn(r, date)).sort((a, b) => byText5(a.id, b.id));
  var activeMembershipsFor = (roster, playerId, date) => roster.memberships.filter((m) => m.playerId === playerId && isEffectiveOn(m, date)).sort((a, b) => byText5(a.id, b.id));
  var currentRosterMembership = (roster, playerId, date) => activeMembershipsFor(roster, playerId, date)[0];
  var organizationRoster = (roster, organizationId, date) => {
    const mine = roster.memberships.filter(
      (m) => m.organizationId === organizationId && isEffectiveOn(m, date)
    ).sort((a, b) => byText5(a.playerId, b.playerId) || byText5(a.id, b.id));
    return {
      active: mine.filter((m) => m.status === "active"),
      reserve: mine.filter((m) => m.status === "reserve"),
      practice_squad: mine.filter((m) => m.status === "practice_squad")
    };
  };
  var limitFor = (seasonRules2, status) => status === "active" ? seasonRules2.activeRosterLimit : status === "reserve" ? seasonRules2.reserveRosterLimit : seasonRules2.practiceSquadLimit;
  var rosterCapacity = (roster, tx2, organizationId, date) => {
    const rules = transactionSeasonRules(tx2, seasonOfDate(date));
    const grouped = organizationRoster(roster, organizationId, date);
    const one = (status) => {
      const count = grouped[status].length;
      const limit = limitFor(rules, status);
      return { count, limit, room: Math.max(0, limit - count) };
    };
    return {
      active: one("active"),
      reserve: one("reserve"),
      practice_squad: one("practice_squad")
    };
  };
  var holdsContractRight = (roster, playerId, organizationId, date) => activeRightsFor(roster, playerId, date).some(
    (r) => r.holderOrganizationId === organizationId && r.kind === "contract"
  );
  var bySubject = (a, b) => {
    var _a, _b, _c, _d;
    return byText5(a.code, b.code) || byText5((_a = a.organizationId) != null ? _a : "", (_b = b.organizationId) != null ? _b : "") || byText5((_c = a.playerId) != null ? _c : "", (_d = b.playerId) != null ? _d : "");
  };
  var rosterInvariantFindings = (roster, tx2, date) => {
    var _a, _b;
    const findings = [];
    const rightsBy = /* @__PURE__ */ new Map();
    for (const r of roster.rights)
      if (isEffectiveOn(r, date))
        rightsBy.set(r.playerId, ((_a = rightsBy.get(r.playerId)) != null ? _a : 0) + 1);
    for (const [playerId, n] of rightsBy)
      if (n > 1)
        findings.push({
          code: "DUPLICATE_ACTIVE_RIGHTS",
          organizationId: null,
          playerId,
          detail: `${playerId} has ${n} active rights records`
        });
    const membershipsBy = /* @__PURE__ */ new Map();
    const orgs = /* @__PURE__ */ new Set();
    for (const m of roster.memberships) {
      if (!isEffectiveOn(m, date)) continue;
      orgs.add(m.organizationId);
      membershipsBy.set(m.playerId, ((_b = membershipsBy.get(m.playerId)) != null ? _b : 0) + 1);
      if (!holdsContractRight(roster, m.playerId, m.organizationId, date))
        findings.push({
          code: "MEMBERSHIP_WITHOUT_RIGHTS",
          organizationId: m.organizationId,
          playerId: m.playerId,
          detail: `${m.playerId} is on ${m.organizationId} without a contract right held by it`
        });
    }
    for (const [playerId, n] of membershipsBy)
      if (n > 1)
        findings.push({
          code: "DUPLICATE_ACTIVE_MEMBERSHIP",
          organizationId: null,
          playerId,
          detail: `${playerId} has ${n} active memberships`
        });
    const overCode = {
      active: "ACTIVE_OVER_LIMIT",
      reserve: "RESERVE_OVER_LIMIT",
      practice_squad: "PRACTICE_SQUAD_OVER_LIMIT"
    };
    for (const organizationId of orgs) {
      const cap = rosterCapacity(roster, tx2, organizationId, date);
      for (const status of ROSTER_STATUSES)
        if (cap[status].count > cap[status].limit)
          findings.push({
            code: overCode[status],
            organizationId,
            playerId: null,
            detail: `${organizationId} has ${cap[status].count} ${status} players, limit ${cap[status].limit}`
          });
    }
    return findings.sort(bySubject);
  };

  // packages/sim-core/src/seedParsing.ts
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

  // packages/sim-core/src/packageCSeedParse.ts
  var BLOCK_KEYS = [
    "players",
    "rights",
    "memberships",
    "contracts",
    "agentClients",
    "playerPreferences",
    "evaluatorProfiles",
    "draftClasses",
    "draftPicks",
    "waiverPriority"
  ];
  var FORBIDDEN_DIMENSION_FRAGMENTS = [
    "overall",
    "ovr",
    "potential",
    "ceiling",
    "grade",
    "rating",
    "tradevalue",
    "destination"
  ];
  var forbiddenDimension = (key) => {
    const flat2 = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return FORBIDDEN_DIMENSION_FRAGMENTS.some((f) => flat2.includes(f));
  };
  var arrayOf = (value, what, parse) => {
    if (!Array.isArray(value))
      throw new ManifestFormatError(`${what} must be an array`);
    return value.map((raw, i) => parse(raw, `${what}[${i}]`));
  };
  var level = (value, what) => {
    if (!PREFERENCE_LEVELS.includes(value))
      throw new ManifestFormatError(`${what} is not recognized`);
    return value;
  };
  var idList = (value, what) => {
    const ids = arrayOf(value, what, (raw, where) => parseSeedId(raw, where));
    if (new Set(ids).size !== ids.length)
      throw new ManifestFormatError(`${what} has duplicates`);
    return ids;
  };
  var parseCapability = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(rec, ["key", "valueBp"], [], what);
    const key = parseSeedId(rec.key, `${what}.key`);
    if (forbiddenDimension(key))
      throw new ManifestFormatError(
        `${what}.key "${key}" looks like a summary rating; players carry specific dimensions only`
      );
    return { key, valueBp: asSafeInt(rec.valueBp, `${what}.valueBp`, 0, 1e4) };
  };
  var parsePlayer = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      ["personId", "birthDate", "primaryRole", "roleTags", "capabilities"],
      [],
      what
    );
    const capabilities = arrayOf(
      rec.capabilities,
      `${what}.capabilities`,
      parseCapability
    );
    if (new Set(capabilities.map((c) => c.key)).size !== capabilities.length)
      throw new ManifestFormatError(`${what}.capabilities has a duplicate key`);
    return {
      personId: parseSeedId(rec.personId, `${what}.personId`),
      birthDate: parseSeedDate(rec.birthDate, `${what}.birthDate`),
      primaryRole: parseSeedId(rec.primaryRole, `${what}.primaryRole`),
      roleTags: idList(rec.roleTags, `${what}.roleTags`),
      capabilities
    };
  };
  var parseRight = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "id",
        "playerId",
        "holderOrganizationId",
        "kind",
        "sourceRecordId",
        "effectiveFrom",
        "effectiveUntil"
      ],
      [],
      what
    );
    if (!RIGHTS_KINDS.includes(rec.kind))
      throw new ManifestFormatError(`${what}.kind is not recognized`);
    const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      playerId: parseSeedId(rec.playerId, `${what}.playerId`),
      holderOrganizationId: parseSeedId(
        rec.holderOrganizationId,
        `${what}.holderOrganizationId`
      ),
      kind: rec.kind,
      sourceRecordId: parseSeedId(rec.sourceRecordId, `${what}.sourceRecordId`),
      effectiveFrom: span.from,
      effectiveUntil: span.until
    };
  };
  var parseMembership = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "id",
        "playerId",
        "organizationId",
        "status",
        "effectiveFrom",
        "effectiveUntil",
        "sourceRecordId"
      ],
      [],
      what
    );
    if (!ROSTER_STATUSES.includes(rec.status))
      throw new ManifestFormatError(`${what}.status is not recognized`);
    const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      playerId: parseSeedId(rec.playerId, `${what}.playerId`),
      organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
      status: rec.status,
      effectiveFrom: span.from,
      effectiveUntil: span.until,
      sourceRecordId: parseSeedId(rec.sourceRecordId, `${what}.sourceRecordId`)
    };
  };
  var money = (value, what) => asSafeInt(value, what, 0, Number.MAX_SAFE_INTEGER);
  var parseContractYear = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      ["season", "baseSalary", "rosterBonus", "guaranteedBase"],
      [],
      what
    );
    return {
      season: asSafeInt(rec.season, `${what}.season`, 1900, 3e3),
      baseSalary: money(rec.baseSalary, `${what}.baseSalary`),
      rosterBonus: money(rec.rosterBonus, `${what}.rosterBonus`),
      guaranteedBase: money(rec.guaranteedBase, `${what}.guaranteedBase`)
    };
  };
  var parseContract = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "id",
        "playerId",
        "organizationId",
        "signedAt",
        "startSeason",
        "signingBonus",
        "years"
      ],
      [],
      what
    );
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      playerId: parseSeedId(rec.playerId, `${what}.playerId`),
      organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
      signedAt: parseSeedDate(rec.signedAt, `${what}.signedAt`),
      startSeason: asSafeInt(rec.startSeason, `${what}.startSeason`, 1900, 3e3),
      signingBonus: money(rec.signingBonus, `${what}.signingBonus`),
      years: arrayOf(rec.years, `${what}.years`, parseContractYear)
    };
  };
  var parseAgentClient = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "id",
        "agentPersonId",
        "playerPersonId",
        "effectiveFrom",
        "effectiveUntil"
      ],
      [],
      what
    );
    const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      agentPersonId: parseSeedId(rec.agentPersonId, `${what}.agentPersonId`),
      playerPersonId: parseSeedId(rec.playerPersonId, `${what}.playerPersonId`),
      effectiveFrom: span.from,
      effectiveUntil: span.until
    };
  };
  var parsePreference = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "playerPersonId",
        "security",
        "earlyCash",
        "roleOpportunity",
        "contenderPreference",
        "flexibility"
      ],
      [],
      what
    );
    return {
      playerPersonId: parseSeedId(rec.playerPersonId, `${what}.playerPersonId`),
      security: level(rec.security, `${what}.security`),
      earlyCash: level(rec.earlyCash, `${what}.earlyCash`),
      roleOpportunity: level(rec.roleOpportunity, `${what}.roleOpportunity`),
      contenderPreference: level(
        rec.contenderPreference,
        `${what}.contenderPreference`
      ),
      flexibility: level(rec.flexibility, `${what}.flexibility`)
    };
  };
  var parseEvaluator = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      ["personId", "strongDimensions", "weakDimensions", "riskTolerance"],
      [],
      what
    );
    const strong = idList(rec.strongDimensions, `${what}.strongDimensions`);
    const weak = idList(rec.weakDimensions, `${what}.weakDimensions`);
    if (strong.some((d) => weak.includes(d)))
      throw new ManifestFormatError(
        `${what}: a dimension cannot be both strong and weak`
      );
    return {
      personId: parseSeedId(rec.personId, `${what}.personId`),
      strongDimensions: strong,
      weakDimensions: weak,
      riskTolerance: level(rec.riskTolerance, `${what}.riskTolerance`)
    };
  };
  var parseDraftClass = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(rec, ["id", "season", "eligiblePlayerIds"], [], what);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      season: asSafeInt(rec.season, `${what}.season`, 1900, 3e3),
      eligiblePlayerIds: arrayOf(
        rec.eligiblePlayerIds,
        `${what}.eligiblePlayerIds`,
        (r, w) => parseSeedId(r, w)
      )
    };
  };
  var parseDraftPick = (raw, what) => {
    const rec = asRecord(raw, what);
    requireExactKeys(
      rec,
      [
        "id",
        "season",
        "round",
        "slot",
        "originalOrganizationId",
        "ownerOrganizationId",
        "status"
      ],
      [],
      what
    );
    if (!DRAFT_PICK_STATUSES.includes(rec.status))
      throw new ManifestFormatError(`${what}.status is not recognized`);
    return {
      id: parseSeedId(rec.id, `${what}.id`),
      season: asSafeInt(rec.season, `${what}.season`, 1900, 3e3),
      round: asSafeInt(rec.round, `${what}.round`, 1, 100),
      slot: rec.slot === null ? null : asSafeInt(rec.slot, `${what}.slot`, 1, 1e3),
      originalOrganizationId: parseSeedId(
        rec.originalOrganizationId,
        `${what}.originalOrganizationId`
      ),
      ownerOrganizationId: parseSeedId(
        rec.ownerOrganizationId,
        `${what}.ownerOrganizationId`
      ),
      status: rec.status
    };
  };
  var parsePackageCSubstrate = (value) => {
    const what = "seed.packageCSubstrate";
    const rec = asRecord(value, what);
    requireExactKeys(rec, BLOCK_KEYS, [], what);
    return {
      players: arrayOf(rec.players, `${what}.players`, parsePlayer),
      rights: arrayOf(rec.rights, `${what}.rights`, parseRight),
      memberships: arrayOf(
        rec.memberships,
        `${what}.memberships`,
        parseMembership
      ),
      contracts: arrayOf(rec.contracts, `${what}.contracts`, parseContract),
      agentClients: arrayOf(
        rec.agentClients,
        `${what}.agentClients`,
        parseAgentClient
      ),
      playerPreferences: arrayOf(
        rec.playerPreferences,
        `${what}.playerPreferences`,
        parsePreference
      ),
      evaluatorProfiles: arrayOf(
        rec.evaluatorProfiles,
        `${what}.evaluatorProfiles`,
        parseEvaluator
      ),
      draftClasses: arrayOf(
        rec.draftClasses,
        `${what}.draftClasses`,
        parseDraftClass
      ),
      draftPicks: arrayOf(rec.draftPicks, `${what}.draftPicks`, parseDraftPick),
      waiverPriority: arrayOf(
        rec.waiverPriority,
        `${what}.waiverPriority`,
        (r, w) => parseSeedId(r, w)
      )
    };
  };
  var END_OF_TIME = "9999-12-31";
  var overlaps = (a, b) => {
    var _a, _b;
    return a.effectiveFrom <= ((_a = b.effectiveUntil) != null ? _a : END_OF_TIME) && b.effectiveFrom <= ((_b = a.effectiveUntil) != null ? _b : END_OF_TIME);
  };
  var covers = (outer, inner) => outer.effectiveFrom <= inner.effectiveFrom && (outer.effectiveUntil === null || inner.effectiveUntil !== null && inner.effectiveUntil <= outer.effectiveUntil);
  var packageCIssues = (sub, entities, roles, ruleset) => {
    var _a, _b;
    const issues = [];
    const add2 = (code, message) => {
      issues.push({ code: `SEED_C_${code}`, message });
    };
    const kinds = new Map(entities.map((e) => [e.id, e.kind]));
    const playerIds = new Set(sub.players.map((p) => p.personId));
    const requireKind = (ref, expected, where) => {
      const kind = kinds.get(ref);
      if (kind === void 0) {
        add2("UNKNOWN_ENTITY", `${where} references unknown entity "${ref}"`);
        return false;
      }
      if (kind !== expected) {
        add2(
          "WRONG_ENTITY_KIND",
          `${where} references "${ref}" as a ${expected}, but it is a ${kind}`
        );
        return false;
      }
      return true;
    };
    const requirePlayer = (ref, where) => {
      if (!playerIds.has(ref))
        add2(
          "UNKNOWN_PLAYER",
          `${where} references "${ref}", which is not a seeded player`
        );
    };
    if (ruleset !== void 0 && ruleset.rules.transactions === void 0)
      add2(
        "REQUIRES_TRANSACTION_RULES",
        `the seed declares Package C state but ruleset "${ruleset.rulesetId}" has no transaction rules`
      );
    const tx2 = ruleset == null ? void 0 : ruleset.rules.transactions;
    const seen = /* @__PURE__ */ new Set();
    const claim = (id, where) => {
      if (seen.has(id)) add2("DUPLICATE_ID", `${where} reuses record id "${id}"`);
      seen.add(id);
    };
    const seenPlayers = /* @__PURE__ */ new Set();
    for (const p of sub.players) {
      const where = `player "${p.personId}"`;
      if (seenPlayers.has(p.personId))
        add2("DUPLICATE_ID", `${where} is listed twice`);
      seenPlayers.add(p.personId);
      requireKind(p.personId, "person", where);
    }
    for (const r of sub.rights) {
      const where = `rights record "${r.id}"`;
      claim(r.id, where);
      requirePlayer(r.playerId, where);
      requireKind(r.holderOrganizationId, "organization", where);
    }
    for (const m of sub.memberships) {
      const where = `roster membership "${m.id}"`;
      claim(m.id, where);
      requirePlayer(m.playerId, where);
      requireKind(m.organizationId, "organization", where);
    }
    const byPlayer = (xs) => {
      var _a2;
      const map = /* @__PURE__ */ new Map();
      for (const x of xs)
        map.set(x.playerId, [...(_a2 = map.get(x.playerId)) != null ? _a2 : [], x]);
      return map;
    };
    const rightsByPlayer = byPlayer(sub.rights);
    for (const [playerId, rights2] of rightsByPlayer)
      for (let i = 0; i < rights2.length; i += 1)
        for (let j = i + 1; j < rights2.length; j += 1)
          if (overlaps(rights2[i], rights2[j]))
            add2(
              "RIGHTS_OVERLAP",
              `player "${playerId}" has overlapping rights "${rights2[i].id}" and "${rights2[j].id}" (duplicate ownership)`
            );
    const membershipsByPlayer = byPlayer(sub.memberships);
    for (const [playerId, ms] of membershipsByPlayer)
      for (let i = 0; i < ms.length; i += 1)
        for (let j = i + 1; j < ms.length; j += 1)
          if (overlaps(ms[i], ms[j]))
            add2(
              "MEMBERSHIP_OVERLAP",
              `player "${playerId}" has overlapping roster memberships "${ms[i].id}" and "${ms[j].id}"`
            );
    for (const m of sub.memberships) {
      const compatible = ((_a = rightsByPlayer.get(m.playerId)) != null ? _a : []).some(
        (r) => r.holderOrganizationId === m.organizationId && covers(r, m)
      );
      if (!compatible)
        add2(
          "MEMBERSHIP_WITHOUT_RIGHT",
          `roster membership "${m.id}" has no right held by "${m.organizationId}" covering it`
        );
    }
    const scoutIds = new Set(
      roles.filter((r) => r.role === "scout").map((r) => r.personId)
    );
    const capabilityKeys = new Set(
      sub.players.flatMap((p) => p.capabilities.map((c) => c.key))
    );
    for (const a of sub.agentClients) {
      const where = `agent-client link "${a.id}"`;
      claim(a.id, where);
      if (requireKind(a.agentPersonId, "person", where) && playerIds.has(a.agentPersonId))
        add2(
          "INVALID_AGENT",
          `${where}: agent "${a.agentPersonId}" is itself a player`
        );
      if (!playerIds.has(a.playerPersonId))
        add2(
          "INVALID_AGENT",
          `${where}: client "${a.playerPersonId}" is not a seeded player`
        );
    }
    const seenPreferences = /* @__PURE__ */ new Set();
    for (const pref of sub.playerPreferences) {
      const where = `market preference for "${pref.playerPersonId}"`;
      requirePlayer(pref.playerPersonId, where);
      if (seenPreferences.has(pref.playerPersonId))
        add2("DUPLICATE_ID", `${where} is listed twice`);
      seenPreferences.add(pref.playerPersonId);
    }
    const seenEvaluators = /* @__PURE__ */ new Set();
    for (const e of sub.evaluatorProfiles) {
      const where = `evaluator profile "${e.personId}"`;
      if (seenEvaluators.has(e.personId))
        add2("DUPLICATE_ID", `${where} is listed twice`);
      seenEvaluators.add(e.personId);
      if (requireKind(e.personId, "person", where) && !scoutIds.has(e.personId))
        add2(
          "EVALUATOR_NOT_SCOUT",
          `${where}: the person holds no scout role episode`
        );
      for (const d of [...e.strongDimensions, ...e.weakDimensions])
        if (!capabilityKeys.has(d))
          add2(
            "UNKNOWN_DIMENSION",
            `${where} references unknown capability dimension "${d}"`
          );
    }
    const inClass = /* @__PURE__ */ new Map();
    for (const c of sub.draftClasses) {
      const where = `draft class "${c.id}"`;
      claim(c.id, where);
      for (const pid of c.eligiblePlayerIds) {
        requirePlayer(pid, where);
        const prior = inClass.get(pid);
        if (prior !== void 0 && prior !== c.id)
          add2(
            "PLAYER_IN_MULTIPLE_CLASSES",
            `${where}: "${pid}" is already eligible in "${prior}"`
          );
        inClass.set(pid, c.id);
      }
      if (new Set(c.eligiblePlayerIds).size !== c.eligiblePlayerIds.length)
        add2("DUPLICATE_ID", `${where} lists an eligible player twice`);
    }
    const claimedSlots = /* @__PURE__ */ new Set();
    const claimedOrigins = /* @__PURE__ */ new Set();
    for (const p of sub.draftPicks) {
      const where = `draft pick "${p.id}"`;
      claim(p.id, where);
      requireKind(p.originalOrganizationId, "organization", where);
      requireKind(p.ownerOrganizationId, "organization", where);
      if (p.status !== "available")
        add2(
          "USED_PICK",
          `${where} is seeded as used, but no selection exists to account for it`
        );
      const origin = `${p.season}|${p.round}|${p.originalOrganizationId}`;
      if (claimedOrigins.has(origin))
        add2(
          "DUPLICATE_PICK",
          `${where} duplicates season ${p.season} round ${p.round} of "${p.originalOrganizationId}"`
        );
      claimedOrigins.add(origin);
      if (p.slot !== null) {
        const slot = `${p.season}|${p.round}|${p.slot}`;
        if (claimedSlots.has(slot))
          add2(
            "DUPLICATE_PICK",
            `${where} reuses season ${p.season} round ${p.round} slot ${p.slot}`
          );
        claimedSlots.add(slot);
      }
      if (tx2 !== void 0) {
        if (p.round > tx2.draft.rounds)
          add2(
            "PICK_OUT_OF_RULES",
            `${where} is round ${p.round}; the ruleset has ${tx2.draft.rounds} rounds`
          );
        if (!tx2.seasonRules.some((s) => s.season === p.season))
          add2(
            "PICK_OUT_OF_RULES",
            `${where} is for season ${p.season}, which the ruleset does not declare`
          );
      }
    }
    const contractById = /* @__PURE__ */ new Map();
    const contractsByPlayer = /* @__PURE__ */ new Map();
    for (const c of sub.contracts) {
      const where = `contract "${c.id}"`;
      claim(c.id, where);
      contractById.set(c.id, c);
      contractsByPlayer.set(c.playerId, [
        ...(_b = contractsByPlayer.get(c.playerId)) != null ? _b : [],
        c
      ]);
      requirePlayer(c.playerId, where);
      requireKind(c.organizationId, "organization", where);
      if (tx2 !== void 0)
        for (const problem of contractTermsProblems(tx2, {
          startSeason: c.startSeason,
          signingBonus: moneyAmount(c.signingBonus),
          years: c.years.map((y) => ({
            season: y.season,
            baseSalary: moneyAmount(y.baseSalary),
            rosterBonus: moneyAmount(y.rosterBonus),
            guaranteedBase: moneyAmount(y.guaranteedBase)
          }))
        }))
          add2("CONTRACT_TERMS", `${where}: ${problem}`);
    }
    for (const [playerId, cs] of contractsByPlayer)
      if (cs.length > 1)
        add2(
          "DUPLICATE_CONTRACT",
          `player "${playerId}" has ${cs.length} active contracts`
        );
    for (const r of sub.rights) {
      if (r.kind !== "contract") continue;
      const c = contractById.get(r.sourceRecordId);
      if (c === void 0 || c.playerId !== r.playerId || c.organizationId !== r.holderOrganizationId)
        add2(
          "RIGHT_WITHOUT_CONTRACT",
          `contract right "${r.id}" names no matching contract as its source`
        );
    }
    for (const c of sub.contracts)
      if (!sub.rights.some(
        (r) => r.kind === "contract" && r.sourceRecordId === c.id && r.playerId === c.playerId && r.holderOrganizationId === c.organizationId
      ))
        add2(
          "CONTRACT_WITHOUT_RIGHT",
          `contract "${c.id}" has no contract right held by "${c.organizationId}"`
        );
    for (const m of sub.memberships)
      if (!sub.contracts.some(
        (c) => c.playerId === m.playerId && c.organizationId === m.organizationId
      ))
        add2(
          "MEMBERSHIP_WITHOUT_CONTRACT",
          `roster membership "${m.id}" has no contract with "${m.organizationId}"`
        );
    if (tx2 !== void 0 && issues.length === 0) {
      const state = seededContractsState(sub);
      for (const org of entities.filter((e) => e.kind === "organization"))
        for (const season of tx2.seasonRules) {
          const position = capPosition(tx2, state, org.id, season.season);
          if (position.space < 0)
            add2(
              "CAP_EXCEEDED",
              `"${org.id}" is ${-position.space} over the cap in season ${season.season}`
            );
        }
    }
    const orgIds = entities.filter((e) => e.kind === "organization").map((e) => e.id);
    const priority = sub.waiverPriority;
    if (priority.length !== orgIds.length || new Set(priority).size !== priority.length || priority.some((o) => kinds.get(o) !== "organization") || orgIds.some((o) => !priority.includes(o)))
      add2(
        "WAIVER_PRIORITY_INVALID",
        "waiverPriority must list every organization exactly once and nothing else"
      );
    return issues;
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
      const rights2 = rec.rights.map((r) => {
        if (!DECISION_RIGHTS.includes(r))
          throw new ManifestFormatError(`${what}.rights has an unknown right`);
        return r;
      });
      if (new Set(rights2).size !== rights2.length)
        throw new ManifestFormatError(`${what}.rights has duplicates`);
      if (typeof rec.transferable !== "boolean")
        throw new ManifestFormatError(`${what}.transferable must be a boolean`);
      const span = parseSeedInterval(rec.effectiveFrom, rec.effectiveUntil, what);
      return {
        id: parseSeedId(rec.id, `${what}.id`),
        personId: parseSeedId(rec.personId, `${what}.personId`),
        organizationId: parseSeedId(rec.organizationId, `${what}.organizationId`),
        category: rec.category,
        rights: rights2,
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
    const packageC = rec.packageCSubstrate === void 0 ? {} : { packageCSubstrate: parsePackageCSubstrate(rec.packageCSubstrate) };
    return __spreadProps(__spreadValues(__spreadValues({}, substrate), packageC), {
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
  var bodyOf2 = (m) => __spreadValues(__spreadValues({
    schemaVersion: m.schemaVersion,
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    ruleset: m.ruleset,
    rngSeed32: m.rngSeed32,
    startDate: m.startDate,
    provenance: m.provenance,
    initialEntities: m.initialEntities
  }, m.organizationSubstrate === void 0 ? {} : { organizationSubstrate: m.organizationSubstrate }), m.packageCSubstrate === void 0 ? {} : { packageCSubstrate: m.packageCSubstrate });
  var sealSeed = (body) => {
    const rec = asRecord(body, "seed body");
    requireExactKeys(
      rec,
      BODY_KEYS2,
      ["organizationSubstrate", "packageCSubstrate"],
      "seed body"
    );
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
      ["organizationSubstrate", "packageCSubstrate"],
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
  var END_OF_TIME2 = "9999-12-31";
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
          if (a.startDate <= ((_b = b.endDate) != null ? _b : END_OF_TIME2) && b.startDate <= ((_c = a.endDate) != null ? _c : END_OF_TIME2))
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
    var _a, _b;
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
      if (seed.packageCSubstrate !== void 0)
        issues.push(
          ...packageCIssues(
            seed.packageCSubstrate,
            seed.initialEntities,
            (_b = (_a = seed.organizationSubstrate) == null ? void 0 : _a.roleEpisodes) != null ? _b : [],
            ruleset
          )
        );
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
      const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
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
      return result;
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
  var byText6 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var rightBackingAt = (world, organizationId, personId, category, right, date) => {
    const grantsFor = (holder, transferableOnly) => holdsRoleAt(world.people, organizationId, holder, date) ? world.authority.grants.filter(
      (g) => g.personId === holder && g.organizationId === organizationId && g.category === category && g.rights.includes(right) && (!transferableOnly || g.transferable) && g.effectiveFrom <= date && (g.effectiveUntil === null || date <= g.effectiveUntil)
    ).map((g) => g.id).sort(byText6) : [];
    const own = grantsFor(personId, false);
    if (own.length > 0) return { grantIds: own, mandateId: null };
    const mandates = [...world.authority.mandates].sort(
      (a, b) => byText6(a.id, b.id)
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
    const countedIds = counting.map((v) => v.approval.id).sort(byText6);
    const grantsOf = (items) => [...new Set(items.flatMap((v) => v.backing.grantIds))].sort(byText6);
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

  // packages/sim-core/src/scouting.ts
  var SCOUTING_CONTEXT_KINDS = [
    "draft_selection",
    "free_agent_signing",
    "trade_target",
    "roster_decision"
  ];
  var emptyScoutingState = () => ({
    evaluatorProfiles: [],
    questions: [],
    assignments: [],
    reports: []
  });
  var byText7 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var seededScoutingState = (sub) => {
    if (sub === void 0) return emptyScoutingState();
    return __spreadProps(__spreadValues({}, emptyScoutingState()), {
      evaluatorProfiles: sub.evaluatorProfiles.map((e) => ({
        personId: entityId(e.personId),
        strongDimensions: [...e.strongDimensions].sort(byText7),
        weakDimensions: [...e.weakDimensions].sort(byText7),
        riskTolerance: e.riskTolerance
      })).sort((a, b) => byText7(a.personId, b.personId))
    });
  };
  var SCOUTING_ASSESSMENT = "scouting_assessment";
  var OBSERVATION_SIGNALS = ["positive", "negative", "mixed"];
  var NEUTRAL_LENS = {
    strongDimensions: [],
    weakDimensions: [],
    riskTolerance: "medium"
  };
  var BANDS = [
    "very_low",
    "low",
    "medium",
    "high",
    "very_high"
  ];
  var bandIndex = (b) => BANDS.indexOf(b);
  var bandAt = (i) => BANDS[Math.max(0, Math.min(BANDS.length - 1, i))];
  var familyCap = (families) => families >= 3 ? 4 : families === 2 ? 3 : 2;
  var observationOf = (claim, dimension) => {
    const p = claim.proposition;
    if (p === null || typeof p !== "object" || Array.isArray(p)) return null;
    const rec = p;
    if (rec.dimension !== dimension) return null;
    return OBSERVATION_SIGNALS.includes(rec.signal) ? { signal: rec.signal } : null;
  };
  var interpretEvidence = (dimensions, claims, lens) => {
    var _a;
    const readings = [];
    const countedFamilies = /* @__PURE__ */ new Set();
    for (const dimension of [...dimensions].sort(byText7)) {
      const relevant = claims.filter((c) => observationOf(c, dimension) !== null);
      if (relevant.length === 0) {
        readings.push({
          dimension,
          status: "no_evidence",
          independentFamilies: 0,
          confidence: null
        });
        continue;
      }
      const families = /* @__PURE__ */ new Map();
      for (const c of relevant) {
        const f = (_a = families.get(c.sourceFamilyId)) != null ? _a : {
          signals: /* @__PURE__ */ new Set(),
          best: 0
        };
        f.signals.add(observationOf(c, dimension).signal);
        f.best = Math.max(f.best, bandIndex(c.confidence));
        families.set(c.sourceFamilyId, f);
      }
      const n = families.size;
      const needed = lens.weakDimensions.includes(dimension) ? 2 : 1;
      if (n < needed) {
        readings.push({
          dimension,
          status: "discounted",
          independentFamilies: n,
          confidence: null
        });
        continue;
      }
      const signals = /* @__PURE__ */ new Set();
      for (const f of families.values())
        for (const s of f.signals) signals.add(s);
      const best = Math.max(...[...families.values()].map((f) => f.best));
      const confidence = bandAt(Math.min(best, familyCap(n)));
      if (signals.size !== 1 || signals.has("mixed")) {
        readings.push({
          dimension,
          status: "conflict",
          independentFamilies: n,
          confidence
        });
        continue;
      }
      for (const id of families.keys()) countedFamilies.add(id);
      readings.push({
        dimension,
        status: signals.has("positive") ? "positive" : "negative",
        independentFamilies: n,
        confidence
      });
    }
    const counted = readings.filter(
      (r) => r.status === "positive" || r.status === "negative"
    );
    const unresolved = readings.filter(
      (r) => r.status === "no_evidence" || r.status === "discounted"
    );
    const conflicts = readings.filter((r) => r.status === "conflict");
    const positives = counted.filter((r) => r.status === "positive").length;
    const negatives = counted.length - positives;
    let reading;
    if (conflicts.length > 0 || positives > 0 && negatives > 0)
      reading = "mixed";
    else if (counted.length === 0) reading = "insufficient";
    else if (unresolved.length > 0 && (lens.riskTolerance === "low" || lens.riskTolerance === "medium" && unresolved.length > counted.length))
      reading = "insufficient";
    else reading = negatives > 0 ? "against" : "supports";
    let confidenceIndex = counted.length === 0 ? 0 : Math.min(...counted.map((r) => bandIndex(r.confidence)));
    if (unresolved.length > 0 || conflicts.length > 0)
      confidenceIndex = Math.min(confidenceIndex, 2);
    if (reading === "mixed" || reading === "insufficient")
      confidenceIndex = Math.min(confidenceIndex, 1);
    return {
      reading,
      confidence: bandAt(confidenceIndex),
      dimensions: readings,
      unresolvedQuestionKeys: [
        ...unresolved.map((r) => `dimension:${r.dimension}`),
        ...conflicts.map((r) => `conflict:${r.dimension}`)
      ].sort(byText7),
      independentFamilyCount: countedFamilies.size
    };
  };

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
  var WORLD_MODEL_VERSION = 3;
  var PACKAGE_B_DOMAIN_STATE_KEYS = {
    people: ["persons", "roleEpisodes"],
    organizations: ["organizations"],
    authority: ["grants", "mandates", "protectedConstraints"],
    information: ["claims", "beliefs"],
    relationships: ["edges", "effects"],
    plans: ["plans"],
    decisions: ["proposals", "approvals", "receipts"]
  };
  var DOMAIN_STATE_KEYS = __spreadProps(__spreadValues({}, PACKAGE_B_DOMAIN_STATE_KEYS), {
    roster: [
      "players",
      "rights",
      "memberships",
      "waivers",
      "waiverClaims",
      "waiverPriority"
    ],
    contracts: ["agreements", "terminations"],
    market: [
      "agentClients",
      "playerPreferences",
      "inquiries",
      "tradeOffers",
      "contractOffers",
      "reservations",
      "responses"
    ],
    scouting: ["evaluatorProfiles", "questions", "assignments", "reports"],
    draft: ["classes", "picks", "boards", "sessions", "selections"]
  });
  var DOMAIN_NAMES = Object.keys(DOMAIN_STATE_KEYS);
  var PACKAGE_B_DOMAIN_NAMES = Object.keys(
    PACKAGE_B_DOMAIN_STATE_KEYS
  );
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
  var MODEL_KEYS = [
    "schemaVersion",
    "worldModelVersion",
    "worldId",
    "ruleset",
    "seed",
    "simDate",
    "revision",
    "rng",
    "nextIds",
    "entities"
  ];
  var LEGACY_B_KEYS = [
    ...MODEL_KEYS,
    ...PACKAGE_B_DOMAIN_NAMES
  ];
  var CURRENT_KEYS = [...MODEL_KEYS, ...DOMAIN_NAMES];
  var UnsupportedWorldModelVersionError = class extends Error {
    constructor(what, found) {
      super(
        `Unsupported ${what} world model version ${String(found)}; this build supports only world model ${WORLD_MODEL_VERSION} (and migrates Package A world model 1 and Package B world model 2)`
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
  var shapeProblems = (value, version, topKeys, domainKeys) => {
    const problems = [];
    if (value.worldModelVersion !== version)
      problems.push(`worldModelVersion must be ${version}`);
    problems.push(...keyProblems(value, topKeys, "world"));
    if (value.schemaVersion !== SCHEMA_VERSION)
      problems.push(`schemaVersion must be ${SCHEMA_VERSION}`);
    const ids = value.nextIds;
    if (!isPlain(ids)) problems.push("nextIds missing");
    else {
      problems.push(...keyProblems(ids, ["event", "record"], "nextIds"));
      if (!isCount(ids.event)) problems.push("nextIds.event invalid");
      if (!isCount(ids.record)) problems.push("nextIds.record invalid");
    }
    for (const [domain, collections] of Object.entries(domainKeys)) {
      const state = value[domain];
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
  var isLegacyPackageBWorld = (value) => isPlain(value) && value.worldModelVersion === 2 && shapeProblems(value, 2, LEGACY_B_KEYS, PACKAGE_B_DOMAIN_STATE_KEYS).length === 0;
  var worldModelProblems = (value) => {
    if (!isPlain(value)) return ["world is not an object"];
    if (!("worldModelVersion" in value))
      return ["worldModelVersion missing: not a current-model world"];
    return shapeProblems(
      value,
      WORLD_MODEL_VERSION,
      CURRENT_KEYS,
      DOMAIN_STATE_KEYS
    );
  };
  var assertCurrentWorld = (value) => {
    const future = futureWorldModelVersion(value);
    if (future !== null)
      throw new UnsupportedWorldModelVersionError("world", future);
    const problems = worldModelProblems(value);
    if (problems.length > 0) throw new InvalidWorldModelError(problems);
    return value;
  };
  var migrateLegacyPackageAWorldToModel2 = (world) => {
    if (!isLegacyPackageAWorld(world))
      throw new InvalidWorldModelError([
        "only a genuine Package A world model 1 can be migrated"
      ]);
    const w = JSON.parse(canonicalString(world));
    return deepFreeze({
      schemaVersion: w.schemaVersion,
      worldModelVersion: 2,
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
  var migrateLegacyPackageBWorld = (world) => {
    if (!isLegacyPackageBWorld(world))
      throw new InvalidWorldModelError([
        "only a genuine Package B world model 2 can be migrated"
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
      nextIds: { event: w.nextIds.event, record: w.nextIds.record },
      entities: w.entities,
      people: w.people,
      organizations: w.organizations,
      authority: w.authority,
      information: w.information,
      relationships: w.relationships,
      plans: w.plans,
      decisions: w.decisions,
      roster: emptyRosterState(),
      contracts: emptyContractsState(),
      market: emptyMarketState(),
      scouting: emptyScoutingState(),
      draft: emptyDraftState()
    });
  };
  var migrateLegacyPackageAWorld = (world) => migrateLegacyPackageBWorld(migrateLegacyPackageAWorldToModel2(world));
  var requireCurrentWorld = (value) => {
    if (isLegacyPackageAWorld(value)) return migrateLegacyPackageAWorld(value);
    if (isLegacyPackageBWorld(value)) return migrateLegacyPackageBWorld(value);
    return assertCurrentWorld(value);
  };

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
      decisions: emptyDecisionsState(),
      roster: seededRosterState(seed.packageCSubstrate),
      contracts: seededContractsState(seed.packageCSubstrate),
      market: seededMarketState(seed.packageCSubstrate),
      scouting: seededScoutingState(seed.packageCSubstrate),
      draft: seededDraftState(seed.packageCSubstrate)
    });
  };
  var fingerprintWorld = (world) => hashCanonical({ domain: "sport-sim/world-fingerprint", version: 3, world });

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
    ...world.decisions.receipts.map((x) => x.id),
    ...world.roster.rights.map((x) => x.id),
    ...world.roster.memberships.map((x) => x.id),
    ...world.contracts.agreements.map((x) => x.id),
    ...world.contracts.terminations.map((x) => x.id),
    ...world.roster.waivers.map((x) => x.id),
    ...world.roster.waiverClaims.map((x) => x.id),
    ...world.market.reservations.map((x) => x.id),
    ...world.market.inquiries.map((x) => x.id),
    ...world.market.tradeOffers.map((x) => x.id),
    ...world.market.contractOffers.map((x) => x.id),
    ...world.market.responses.map((x) => x.id),
    ...world.scouting.questions.map((x) => x.id),
    ...world.scouting.assignments.map((x) => x.id),
    ...world.scouting.reports.map((x) => x.id),
    ...world.draft.boards.map((x) => x.id),
    ...world.draft.sessions.map((x) => x.id),
    ...world.draft.selections.map((x) => x.id)
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
    const overlaps2 = world.people.roleEpisodes.some(
      (e) => e.personId === person && e.organizationId === org && e.role === role && (e.endDate === null || e.endDate >= startDate)
    );
    if (overlaps2) return bad("the person already holds or will hold that role");
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
    const rights2 = parseRights(c.rights, "rights");
    if (isFailure(rights2)) return rights2;
    if (c.transferable !== void 0 && typeof c.transferable !== "boolean")
      return bad("transferable must be a boolean");
    const validity = parseValidity(c, world.simDate);
    if (isFailure(validity)) return validity;
    const noRight = requireExecute(world, org, by);
    if (noRight !== null) return noRight;
    const mine = activeRightsAt(world, org, by, category, world.simDate);
    const missing = rights2.filter((r) => !mine.transferableRights.includes(r));
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
      rights: rights2,
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
      `${by} grants ${rights2.join(",")} on ${category} to ${grant.personId}`,
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
    const rights2 = parseRights(c.allowedRights, "allowedRights");
    if (isFailure(rights2)) return rights2;
    const body = parseMandateBody(c);
    if (isFailure(body)) return body;
    const validity = parseValidity(c, world.simDate);
    if (isFailure(validity)) return validity;
    const mine = activeRightsAt(world, org, by, category, world.simDate);
    const missing = rights2.filter((r) => !mine.transferableRights.includes(r));
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
      allowedRights: rights2,
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
      `${by} delegates ${rights2.join(",")} on ${category} to ${mandate.delegatePersonId}`,
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
  var isClaimVisibleTo = (world, organizationId, actorPersonId, claim) => {
    const today = world.simDate;
    if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
      return false;
    if (claim.visibility === "public") return true;
    if (!claim.holderOrganizationIds.includes(organizationId)) return false;
    if (claim.visibility === "organization") return true;
    return claim.sourcePersonId === actorPersonId || effectiveRightsAt(
      world,
      organizationId,
      actorPersonId,
      "organizational_authority",
      today
    ).rights.includes("execute");
  };
  var findVisibleClaim = (world, organizationId, actorPersonId, claimId) => {
    const claim = world.information.claims.find((c) => c.id === claimId);
    return claim !== void 0 && isClaimVisibleTo(world, organizationId, actorPersonId, claim) ? claim : void 0;
  };
  var isBeliefVisibleTo = (world, organizationId, actorPersonId, belief) => belief.organizationId === organizationId && holdsRoleAt(world.people, organizationId, actorPersonId, world.simDate);
  var buildOrganizationKnowledgeView = (world, organizationId, actorPersonId) => {
    const visible = world.information.claims.filter(
      (c) => isClaimVisibleTo(world, organizationId, actorPersonId, c)
    );
    const visibleIds = new Set(visible.map((c) => c.id));
    const familyById = new Map(visible.map((c) => [c.id, c.sourceFamilyId]));
    const claims = visible.map((c) => __spreadProps(__spreadValues({}, c), {
      holderOrganizationIds: c.holderOrganizationIds.filter(
        (h) => h === organizationId
      ),
      corroboratesClaimIds: c.corroboratesClaimIds.filter(
        (id) => visibleIds.has(id)
      ),
      contradictsClaimIds: c.contradictsClaimIds.filter(
        (id) => visibleIds.has(id)
      ),
      sharedFromClaimId: c.sharedFromClaimId !== null && visibleIds.has(c.sharedFromClaimId) ? c.sharedFromClaimId : null
    }));
    const beliefs = world.information.beliefs.filter((b) => isBeliefVisibleTo(world, organizationId, actorPersonId, b)).map((b) => {
      const evidenceClaimIds = b.evidenceClaimIds.filter(
        (id) => visibleIds.has(id)
      );
      const families = /* @__PURE__ */ new Set();
      for (const id of evidenceClaimIds) families.add(familyById.get(id));
      const newer = world.information.beliefs.find(
        (x) => x.organizationId === organizationId && x.supersedesBeliefId === b.id
      );
      return __spreadProps(__spreadValues({}, b), {
        evidenceClaimIds,
        evidenceSourceFamilyIds: [...families].sort(),
        supersededByBeliefId: newer === void 0 ? null : newer.id
      });
    });
    return {
      organizationId,
      actorPersonId,
      asOf: world.simDate,
      claims,
      beliefs
    };
  };

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
    const claim = {
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
    const claims = [...world.information.claims, claim].sort(byId);
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
          claim: __spreadValues({}, claim)
        })
      ],
      `${by} records ${claim.propositionType} for ${org}`,
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
    const claim = findVisibleClaim(world, org, by, String(c.claimId));
    if (claim === void 0) return unavailable(c.claimId);
    const to = parseOrganization(ctx, c.toOrganizationId);
    if (isFailure(to)) return to;
    if (to === org) return bad("a claim is shared with another organization");
    if (claim.visibility === "public")
      return bad("a public claim needs no sharing");
    let visibility = claim.visibility;
    if (c.visibility !== void 0) {
      const v = parseEnum(c.visibility, VISIBILITIES, "visibility");
      if (isFailure(v)) return v;
      if (VISIBILITIES.indexOf(v) > VISIBILITIES.indexOf(claim.visibility))
        return bad("sharing cannot widen the visibility of a claim");
      visibility = v;
    }
    if (world.information.claims.some(
      (x) => x.sharedFromClaimId === claim.id && x.holderOrganizationIds.includes(to)
    ))
      return bad("the claim has already been shared with that organization");
    const noRight = requireRight(world, org, by, "communicate");
    if (noRight !== null) return noRight;
    const minted = mintRecordId(world);
    const copy = __spreadProps(__spreadValues({}, claim), {
      id: minted.id,
      acquiredAt: today,
      visibility,
      holderOrganizationIds: [to],
      corroboratesClaimIds: [],
      contradictsClaimIds: [],
      sharedFromClaimId: claim.id
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
      `${by} shares ${claim.id} with ${to}`,
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
    const belief = {
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
    const beliefs = [...world.information.beliefs, belief].sort(byId);
    return finish(
      ctx,
      {
        information: __spreadProps(__spreadValues({}, world.information), { beliefs }),
        nextRecord: minted.next
      },
      [spec("BeliefFormed", { actingPersonId: by, belief: __spreadValues({}, belief) })],
      `${by} forms ${belief.assessmentType} for ${org}`,
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
  var PACKAGE_C_PROPOSAL_CATEGORIES = [
    "acquisition",
    "contract",
    "roster",
    "major_trade"
  ];
  var PROPOSAL_CATEGORIES = [
    ...DECISION_CATEGORIES.slice(0, 3),
    ...PACKAGE_C_PROPOSAL_CATEGORIES
  ];
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
  var validatePart = (world, part) => {
    const today = world.simDate;
    const proposal = latestProposal(world.decisions, part.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (part.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${part.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    if (!isProposalLiveAt(proposal, today)) return bad("proposal has expired");
    if (proposalTermsHash(proposal) !== proposal.termsHash)
      return bad("proposal terms no longer match their hash");
    const beliefs = checkedIds(
      part.beliefIds,
      "beliefIds",
      (id) => world.information.beliefs.some(
        (b) => b.id === id && b.organizationId === proposal.organizationId && isBeliefVisibleTo(
          world,
          proposal.organizationId,
          part.actorPersonId,
          b
        )
      )
    );
    if (isFailure(beliefs)) return beliefs;
    const evidence = checkedIds(
      part.evidenceClaimIds,
      "evidenceClaimIds",
      (id) => findVisibleClaim(
        world,
        proposal.organizationId,
        part.actorPersonId,
        id
      ) !== void 0
    );
    if (isFailure(evidence)) return evidence;
    const execute = rightBackingAt(
      world,
      proposal.organizationId,
      part.actorPersonId,
      proposal.category,
      "execute",
      today
    );
    if (execute === null)
      return denied(
        `${part.actorPersonId} lacks execute on ${proposal.category} in ${proposal.organizationId}`
      );
    const authorization = evaluateProposalAuthority(world, proposal, today);
    if (!authorization.satisfied)
      return denied(
        `authorization no longer holds: ${authorization.reasons.join("; ")}`
      );
    return { part, proposal, beliefs, evidence, execute, authorization };
  };
  var commitProposals = (ctx, input) => {
    const { world } = ctx;
    const today = world.simDate;
    if (input.parts.length === 0) return bad("at least one proposal must commit");
    if (new Set(input.parts.map((p) => p.proposalId)).size !== input.parts.length)
      return bad("the same proposal cannot commit twice in one resolution");
    const ordered = [...input.parts].sort(
      (a, b) => a.proposalId < b.proposalId ? -1 : a.proposalId > b.proposalId ? 1 : 0
    );
    const validated = [];
    for (const part of ordered) {
      const v = validatePart(world, part);
      if (isFailure(v)) return v;
      validated.push(v);
    }
    const minted = mintRecordIds(input.nextWorld, validated.length);
    const firstEvent = world.nextIds.event;
    const total = input.domainEvents.length + 2 * validated.length;
    const outcomeEventIds = Array.from(
      { length: total },
      (_, i) => eventId(`evt-${pad2(firstEvent + i)}`)
    );
    const receipts = validated.map((v, i) => ({
      id: minted.ids[i],
      proposalId: v.proposal.id,
      proposalRevision: v.proposal.revision,
      commandId: ctx.commandId,
      actorPersonId: v.part.actorPersonId,
      authorityGrantIds: [
        .../* @__PURE__ */ new Set([...v.execute.grantIds, ...v.authorization.grantIds])
      ].sort(),
      evidenceClaimIds: v.evidence,
      beliefIds: v.beliefs,
      approvalIds: v.authorization.approvalIds,
      mandateId: v.execute.mandateId,
      executedTermsHash: v.proposal.termsHash,
      committedAt: today,
      outcomeEventIds,
      originalRationale: v.part.rationale
    }));
    let decisions = input.nextWorld.decisions;
    for (const v of validated)
      decisions = replaceProposal(decisions, __spreadProps(__spreadValues({}, v.proposal), {
        state: "committed"
      }));
    decisions = __spreadProps(__spreadValues({}, decisions), {
      receipts: [...decisions.receipts, ...receipts].sort(compareById)
    });
    const commitSpecs = [];
    validated.forEach((v, i) => {
      commitSpecs.push(
        spec("ProposalCommitted", {
          proposalId: v.proposal.id,
          revision: v.proposal.revision,
          actingPersonId: v.part.actorPersonId
        }),
        spec("DecisionReceiptRecorded", { receipt: __spreadValues({}, receipts[i]) })
      );
    });
    return {
      ok: true,
      authorizationDetail: validated.length === 1 ? `${validated[0].part.actorPersonId} holds execute; authorization re-derived` : validated.map(
        (v) => `${v.part.actorPersonId} holds execute on ${v.proposal.id}; authorization re-derived`
      ).join("; "),
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, input.nextWorld), {
          decisions,
          nextIds: __spreadProps(__spreadValues({}, input.nextWorld.nextIds), { record: minted.next })
        }),
        eventSpecs: [...input.domainEvents, ...commitSpecs],
        detail: validated.map((v) => `committed ${v.proposal.id}/${v.proposal.revision}`).join("; ")
      }
    };
  };
  var commitProposal = (ctx, input) => commitProposals(ctx, {
    nextWorld: input.nextWorld,
    domainEvents: input.domainEvents,
    parts: [
      {
        proposalId: input.proposalId,
        expectedRevision: input.expectedRevision,
        actorPersonId: input.actorPersonId,
        beliefIds: input.beliefIds,
        evidenceClaimIds: input.evidenceClaimIds,
        rationale: input.rationale
      }
    ]
  });
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

  // packages/sim-core/src/contractLifecycle.ts
  var parsePlayerTerms = (ctx, terms, termsType) => {
    if (!isPlainObject(terms)) return bad("terms must be an object");
    if (Object.keys(terms).join(",") !== "playerId")
      return bad(`${termsType} terms must be exactly { playerId }`);
    if (!isValidId(terms.playerId) || !ctx.world.roster.players.some((p) => p.personId === terms.playerId))
      return bad("playerId must name a player");
    return entityId(terms.playerId);
  };
  var parseReleaseCommand = (ctx, c, termsType, what) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be the proposal revision");
    if (c.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.termsType !== termsType)
      return bad(`only ${termsType} proposals commit as ${what}`);
    if (proposal.category !== "roster")
      return bad(`${what} commit under the roster category`);
    if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
      return bad("beliefIds and evidenceClaimIds must be arrays");
    if (!isPlainObject(c.rationale)) return bad("rationale must be an object");
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    const playerId = parsePlayerTerms(ctx, proposal.terms, termsType);
    if (isFailure(playerId)) return playerId;
    const organizationId = proposal.organizationId;
    const today = world.simDate;
    let tx2;
    try {
      tx2 = requireTransactionRules(ctx.ruleset);
    } catch (e) {
      if (e instanceof MissingTransactionRulesError) return bad(e.message);
      throw e;
    }
    const membership = currentRosterMembership(world.roster, playerId, today);
    if (membership === void 0 || membership.organizationId !== organizationId)
      return bad(`${playerId} is not on the roster of ${organizationId}`);
    if (membership.effectiveFrom >= today)
      return bad(`${playerId} membership began today; it can end from tomorrow`);
    const agreement = activeAgreementFor(
      world.contracts,
      playerId,
      organizationId
    );
    if (agreement === void 0)
      return bad(`${organizationId} has no active contract with ${playerId}`);
    const right = activeRightsFor(world.roster, playerId, today).find(
      (r) => r.holderOrganizationId === organizationId && r.kind === "contract"
    );
    if (right === void 0)
      return bad(`${organizationId} holds no contract right to ${playerId}`);
    if (right.effectiveFrom >= today)
      return bad(
        `${playerId} contract right began today; it can end from tomorrow`
      );
    return {
      by,
      c,
      proposal,
      playerId,
      organizationId,
      today,
      tx: tx2,
      membership,
      agreement,
      right
    };
  };
  var byId2 = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var terminateAgreement = (input) => {
    const { world, agreement, date } = input;
    const impact = releaseImpact(
      input.tx.contracts,
      agreement.terms,
      seasonOfDate(date)
    );
    const right = activeRightsFor(world.roster, agreement.playerId, date).find(
      (r) => r.holderOrganizationId === agreement.organizationId && r.kind === "contract"
    );
    if (right === void 0)
      throw new Error(`no contract right to end for ${agreement.id}`);
    const ended = dayBefore(date);
    const termination = {
      id: input.terminationId,
      agreementId: agreement.id,
      organizationId: agreement.organizationId,
      playerId: agreement.playerId,
      terminatedAt: date,
      reason: input.reason,
      deadCapBySeason: impact.deadCapBySeason,
      guaranteedCashDue: impact.guaranteedCashDue
    };
    return {
      contracts: {
        agreements: world.contracts.agreements.map(
          (a) => a.id === agreement.id ? __spreadProps(__spreadValues({}, a), { status: "terminated" }) : a
        ),
        terminations: [...world.contracts.terminations, termination].sort(byId2)
      },
      roster: __spreadProps(__spreadValues({}, world.roster), {
        memberships: world.roster.memberships.map(
          (m) => m.id === input.endMembershipId ? __spreadProps(__spreadValues({}, m), { effectiveUntil: ended }) : m
        ),
        rights: world.roster.rights.map(
          (r) => r.id === right.id ? __spreadProps(__spreadValues({}, r), { effectiveUntil: ended }) : r
        )
      }),
      termination,
      endedRightsId: right.id
    };
  };

  // packages/sim-core/src/transactionCommit.ts
  var isDomainCommitCategory = (category) => PACKAGE_C_PROPOSAL_CATEGORIES.includes(category);
  var prepareAuthorizedDomainCommit = (ctx, request) => {
    const world = ctx.world;
    const today = world.simDate;
    if (!isDomainCommitCategory(request.expectedCategory))
      return bad(
        `category ${request.expectedCategory} is not a domain transaction category`
      );
    const proposal = latestProposal(world.decisions, request.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (request.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${request.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.organizationId !== request.organizationId)
      return bad(`proposal belongs to ${proposal.organizationId}`);
    if (proposal.category !== request.expectedCategory)
      return bad(
        `proposal category is ${proposal.category}, not ${request.expectedCategory}`
      );
    if (proposal.termsType !== request.executedTerms.termsType)
      return bad(
        `executed termsType ${request.executedTerms.termsType} differs from the authorized ${proposal.termsType}`
      );
    const executedHash = proposalTermsHash({
      category: proposal.category,
      subjects: proposal.subjects,
      termsType: proposal.termsType,
      terms: request.executedTerms.terms
    });
    if (executedHash !== proposal.termsHash)
      return bad("executed terms differ from the authorized terms");
    if (request.protectedChange !== void 0) {
      const hits = isProtectedAt(
        world,
        request.organizationId,
        request.protectedChange.subject,
        request.protectedChange.change,
        today
      );
      if (hits.length > 0)
        return protectedBy(
          `protected constraint ${hits[0].id} forbids this change`
        );
    }
    const backing = rightBackingAt(
      world,
      request.organizationId,
      request.actorPersonId,
      proposal.category,
      "execute",
      today
    );
    if (backing === null)
      return denied(
        `${request.actorPersonId} lacks execute on ${proposal.category} in ${request.organizationId}`
      );
    if (backing.mandateId !== null) {
      if (request.mandateUsage === void 0)
        return bad("mandateUsage is required when executing under a mandate");
      const verdict = validateMandateAt(
        world,
        backing.mandateId,
        today,
        request.mandateUsage
      );
      if (!verdict.ok)
        return denied(
          `${verdict.outcome === "escalate" ? "escalation required: " : ""}${verdict.reasons.join("; ")}`
        );
    }
    return {
      proposalId: request.proposalId,
      expectedRevision: request.expectedRevision,
      actorPersonId: request.actorPersonId,
      beliefIds: request.beliefIds,
      evidenceClaimIds: request.evidenceClaimIds,
      rationale: request.rationale
    };
  };
  var commitAuthorizedDomainChange = (ctx, change) => {
    if (change.requests.length === 0)
      return bad("a domain commit needs at least one request");
    const parts = [];
    for (const request of change.requests) {
      const part = prepareAuthorizedDomainCommit(ctx, request);
      if (isFailure(part)) return part;
      parts.push(part);
    }
    return commitProposals(ctx, {
      nextWorld: change.nextWorld,
      parts,
      domainEvents: change.domainEvents
    });
  };

  // packages/sim-core/src/waiverCommands.ts
  var WAIVE_TERMS_TYPE = "waive_player_v1";
  var RESOLVERS = /* @__PURE__ */ new Set([
    "human_gm",
    "commissioner",
    "system",
    "test_harness"
  ]);
  var byId3 = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var openWaiver = (ctx, target, termsType) => {
    const { world } = ctx;
    const { proposal, by, tx: tx2, membership, agreement, today, playerId } = target;
    const minted = mintRecordId(world);
    const waiver = {
      id: minted.id,
      playerId,
      waivingOrganizationId: target.organizationId,
      contractAgreementId: agreement.id,
      openedAt: today,
      claimDeadline: SimDate.parse(today).addDays(tx2.waivers.claimWindowDays).toISO(),
      status: "open",
      winnerOrganizationId: null,
      resolvedAt: null
    };
    const memberships = world.roster.memberships.map(
      (m) => m.id === membership.id ? __spreadProps(__spreadValues({}, m), { effectiveUntil: dayBefore(today) }) : m
    );
    const events = [
      spec("WaiverOpened", {
        waiverId: waiver.id,
        playerId,
        waivingOrganizationId: waiver.waivingOrganizationId,
        contractAgreementId: agreement.id,
        openedAt: waiver.openedAt,
        claimDeadline: waiver.claimDeadline,
        endedMembershipId: membership.id,
        proposalId: proposal.id,
        proposalRevision: proposal.revision
      })
    ];
    return commitAuthorizedDomainChange(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        roster: __spreadProps(__spreadValues({}, world.roster), {
          memberships,
          waivers: [...world.roster.waivers, waiver].sort(byId3)
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      domainEvents: events,
      requests: [
        {
          organizationId: target.organizationId,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          expectedCategory: "roster",
          executedTerms: { termsType, terms: { playerId } },
          beliefIds: target.c.beliefIds,
          evidenceClaimIds: target.c.evidenceClaimIds,
          rationale: target.c.rationale,
          protectedChange: {
            subject: { playerId },
            change: { kind: "release" }
          }
        }
      ]
    });
  };
  var routeWaive = (ctx, c) => {
    const target = parseReleaseCommand(ctx, c, WAIVE_TERMS_TYPE, "waivers");
    if (isFailure(target)) return target;
    if (target.tx.waivers.releasedPlayerWaiverPolicy !== "all")
      return bad("this ruleset does not waive released players");
    if (target.membership.status === "practice_squad")
      return bad("practice-squad players are released, not waived");
    return openWaiver(ctx, target, WAIVE_TERMS_TYPE);
  };
  var claimCharges = (tx2, agreement, today) => capChargeBySeason(tx2.contracts, agreement.terms).filter(
    (x) => x.season >= seasonOfDate(today)
  );
  var claimObstacle = (world, tx2, organizationId, status, charges, withReservations) => {
    const today = world.simDate;
    try {
      for (const charge of charges) {
        const position = capPosition(
          tx2,
          world.contracts,
          organizationId,
          charge.season
        );
        const held = withReservations ? reservedCap(world.market, organizationId, charge.season) : 0;
        if (position.committed + held + charge.amount > position.cap)
          return `cap: season ${charge.season} would exceed ${position.cap} (committed ${position.committed}, reserved ${held}, incoming ${charge.amount})`;
      }
      if (status !== null) {
        const capacity = rosterCapacity(world.roster, tx2, organizationId, today)[status];
        const held = withReservations ? reservedSlots(world.market, organizationId, status) : 0;
        if (capacity.count + held + 1 > capacity.limit)
          return `roster capacity: ${status} has ${capacity.count} players and ${held} reserved of ${capacity.limit}`;
      }
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return e.message;
      throw e;
    }
    return null;
  };
  var CLAIM_STATUSES = ["active", "reserve"];
  var routeClaim = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const organizationId = parseOrganization(ctx, c.organizationId);
    if (isFailure(organizationId)) return organizationId;
    if (!isValidId(c.waiverId)) return bad("waiverId must be a valid id");
    const waiver = world.roster.waivers.find((w) => w.id === c.waiverId);
    if (waiver === void 0) return bad("waiverId does not name a waiver");
    if (!CLAIM_STATUSES.includes(c.rosterStatus) || typeof c.rosterStatus !== "string")
      return bad("rosterStatus must be active or reserve");
    const status = c.rosterStatus;
    const today = world.simDate;
    if (waiver.status !== "open") return bad(`waiver is ${waiver.status}`);
    if (today > waiver.claimDeadline)
      return bad(`the claim window closed on ${waiver.claimDeadline}`);
    if (organizationId === waiver.waivingOrganizationId)
      return bad("an organization cannot claim a player it waived");
    if (world.roster.waiverClaims.some(
      (x) => x.waiverId === waiver.id && x.claimingOrganizationId === organizationId && x.active
    ))
      return bad("this organization already has an active claim on the waiver");
    if (!effectiveRightsAt(
      world,
      organizationId,
      by,
      "acquisition",
      today
    ).rights.includes("execute"))
      return denied(`${by} lacks execute on acquisition in ${organizationId}`);
    const agreement = world.contracts.agreements.find(
      (a) => a.id === waiver.contractAgreementId && a.status === "active"
    );
    if (agreement === void 0) return bad("the waived contract is not active");
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const charges = claimCharges(tx2, agreement, today);
    const obstacle = claimObstacle(
      world,
      tx2,
      organizationId,
      status,
      charges,
      true
    );
    if (obstacle !== null) return bad(obstacle);
    const minted = mintRecordIds(world, 2);
    const claimId = minted.ids[0];
    const reservationId = minted.ids[1];
    const reservation = {
      id: reservationId,
      organizationId,
      sourceKind: "waiver_claim",
      sourceRecordId: claimId,
      capBySeason: charges,
      rosterSlotStatus: status,
      contingencyGroupId: null,
      createdAt: today,
      status: "active"
    };
    const claim = {
      id: claimId,
      waiverId: waiver.id,
      claimingOrganizationId: organizationId,
      submittedBy: by,
      submittedAt: today,
      rosterStatus: status,
      reservationId,
      active: true
    };
    return {
      ok: true,
      authorizationDetail: `${by} holds execute on acquisition in ${organizationId}`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), {
          roster: __spreadProps(__spreadValues({}, world.roster), {
            waiverClaims: [...world.roster.waiverClaims, claim].sort(byId3)
          }),
          market: __spreadProps(__spreadValues({}, world.market), {
            reservations: [...world.market.reservations, reservation].sort(byId3)
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          spec("WaiverClaimSubmitted", {
            claimId,
            waiverId: waiver.id,
            playerId: waiver.playerId,
            claimingOrganizationId: organizationId,
            submittedBy: by,
            rosterStatus: status,
            reservationId,
            reservedCapBySeason: charges.map((x) => __spreadValues({}, x))
          })
        ],
        detail: `${organizationId} claims ${waiver.playerId}`
      }
    };
  };
  var setReservations = (world, ids) => __spreadProps(__spreadValues({}, world), {
    market: __spreadProps(__spreadValues({}, world.market), {
      reservations: world.market.reservations.map((r) => {
        const next = ids.get(r.id);
        return next === void 0 ? r : __spreadProps(__spreadValues({}, r), { status: next });
      })
    })
  });
  var resolveOne = (start, waiver, tx2) => {
    let world = start;
    const today = world.simDate;
    const agreement = world.contracts.agreements.find(
      (a) => a.id === waiver.contractAgreementId
    );
    const priority = world.roster.waiverPriority;
    const rank = (org) => priority.indexOf(org);
    const claims = world.roster.waiverClaims.filter((x) => x.waiverId === waiver.id && x.active).sort(
      (a, b) => rank(a.claimingOrganizationId) - rank(b.claimingOrganizationId) || (a.id < b.id ? -1 : 1)
    );
    const charges = claimCharges(tx2, agreement, today);
    const winning = claims.find(
      (x) => claimObstacle(
        world,
        tx2,
        x.claimingOrganizationId,
        x.rosterStatus,
        charges,
        false
      ) === null
    );
    const reservationFate = /* @__PURE__ */ new Map();
    for (const x of claims)
      reservationFate.set(
        x.reservationId,
        x === winning ? "consumed" : "released"
      );
    const closedClaims = world.roster.waiverClaims.map(
      (x) => x.waiverId === waiver.id && x.active ? __spreadProps(__spreadValues({}, x), { active: false }) : x
    );
    const events = [];
    if (winning !== void 0) {
      const minted2 = mintRecordIds(world, 3);
      const [agreementId, rightId, membershipId] = minted2.ids;
      const oldRight = activeRightsFor(world.roster, waiver.playerId, today).find(
        (r) => r.holderOrganizationId === waiver.waivingOrganizationId && r.kind === "contract"
      );
      const winner = winning.claimingOrganizationId;
      const assumed = {
        id: agreementId,
        playerId: waiver.playerId,
        organizationId: winner,
        terms: agreement.terms,
        signedAt: agreement.signedAt,
        sourceOfferId: null,
        sourceProposalId: null,
        supersedesAgreementId: agreement.id,
        status: "active"
      };
      const membership = {
        id: membershipId,
        playerId: waiver.playerId,
        organizationId: winner,
        status: winning.rosterStatus,
        effectiveFrom: today,
        effectiveUntil: null,
        sourceRecordId: agreementId
      };
      const roster = __spreadProps(__spreadValues({}, world.roster), {
        rights: [
          ...world.roster.rights.map(
            (r) => r.id === oldRight.id ? __spreadProps(__spreadValues({}, r), { effectiveUntil: dayBefore(today) }) : r
          ),
          {
            id: rightId,
            playerId: waiver.playerId,
            holderOrganizationId: winner,
            kind: "contract",
            sourceRecordId: agreementId,
            effectiveFrom: today,
            effectiveUntil: null
          }
        ].sort(byId3),
        memberships: [...world.roster.memberships, membership].sort(byId3),
        waivers: world.roster.waivers.map(
          (w) => w.id === waiver.id ? __spreadProps(__spreadValues({}, w), {
            status: "awarded",
            winnerOrganizationId: winner,
            resolvedAt: today
          }) : w
        ),
        waiverClaims: closedClaims,
        waiverPriority: tx2.waivers.claimWinnerMovesToEnd ? [...priority.filter((o) => o !== winner), winner] : priority
      });
      world = setReservations(
        __spreadProps(__spreadValues({}, world), {
          roster,
          contracts: __spreadProps(__spreadValues({}, world.contracts), {
            agreements: [
              ...world.contracts.agreements.map(
                (a) => a.id === agreement.id ? __spreadProps(__spreadValues({}, a), { status: "superseded" }) : a
              ),
              assumed
            ].sort(byId3)
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted2.next })
        }),
        reservationFate
      );
      events.push(
        spec("WaiverAwarded", {
          waiverId: waiver.id,
          playerId: waiver.playerId,
          fromOrganizationId: waiver.waivingOrganizationId,
          winnerOrganizationId: winner,
          claimId: winning.id,
          supersededAgreementId: agreement.id,
          assumedAgreementId: agreementId,
          endedRightsId: oldRight.id,
          newRightsId: rightId,
          membershipId,
          rosterStatus: winning.rosterStatus,
          resolvedAt: today,
          competingClaimIds: claims.filter((x) => x !== winning).map((x) => x.id)
        })
      );
      return { world, events };
    }
    const minted = mintRecordId(world);
    const result = terminateAgreement({
      world,
      agreement,
      date: today,
      reason: "waiver_unclaimed",
      tx: tx2,
      endMembershipId: null,
      terminationId: minted.id
    });
    world = setReservations(
      __spreadProps(__spreadValues({}, world), {
        contracts: result.contracts,
        roster: __spreadProps(__spreadValues({}, result.roster), {
          waivers: result.roster.waivers.map(
            (w) => w.id === waiver.id ? __spreadProps(__spreadValues({}, w), { status: "unclaimed", resolvedAt: today }) : w
          ),
          waiverClaims: closedClaims
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      reservationFate
    );
    const t = result.termination;
    events.push(
      spec("WaiverUnclaimed", {
        waiverId: waiver.id,
        playerId: waiver.playerId,
        waivingOrganizationId: waiver.waivingOrganizationId,
        resolvedAt: today,
        releasedClaimIds: claims.map((x) => x.id)
      }),
      spec("ContractTerminated", {
        terminationId: t.id,
        agreementId: agreement.id,
        organizationId: t.organizationId,
        playerId: t.playerId,
        reason: "waiver_unclaimed",
        terminatedAt: today,
        deadCapBySeason: t.deadCapBySeason.map((x) => __spreadValues({}, x)),
        guaranteedCashDue: t.guaranteedCashDue,
        endedRightsId: result.endedRightsId
      })
    );
    return { world, events };
  };
  var routeResolve = (ctx) => {
    if (!RESOLVERS.has(ctx.actor.kind))
      return denied(`${ctx.actor.kind} cannot resolve waivers`);
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const today = ctx.world.simDate;
    const due = ctx.world.roster.waivers.filter((w) => w.status === "open" && today >= w.claimDeadline).sort(byId3);
    if (due.length === 0) return bad("no waiver is due");
    let world = ctx.world;
    const events = [];
    for (const waiver of due) {
      const step = resolveOne(world, waiver, tx2);
      world = step.world;
      events.push(...step.events);
    }
    return {
      ok: true,
      authorizationDetail: `${ctx.actor.kind} may resolve waivers`,
      resolution: {
        nextWorld: world,
        eventSpecs: events,
        detail: `resolved ${due.length} waiver(s) on ${today}`
      }
    };
  };
  var routeWaiverCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "CommitWaivePlayerProposal":
        return routeWaive(ctx, c);
      case "SubmitWaiverClaim":
        return routeClaim(ctx, c);
      case "ResolveWaivers":
        return routeResolve(ctx);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable waiver command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/contractCommands.ts
  var RELEASE_TERMS_TYPE = "release_player_v1";
  var routeRelease = (ctx, c) => {
    const target = parseReleaseCommand(ctx, c, RELEASE_TERMS_TYPE, "releases");
    if (isFailure(target)) return target;
    const { world } = ctx;
    const { proposal, by, tx: tx2, membership, agreement, today } = target;
    const needsWaivers = tx2.waivers.releasedPlayerWaiverPolicy === "all" && membership.status !== "practice_squad";
    if (needsWaivers) return openWaiver(ctx, target, RELEASE_TERMS_TYPE);
    const minted = mintRecordId(world);
    const result = terminateAgreement({
      world,
      agreement,
      date: today,
      reason: "release",
      tx: tx2,
      endMembershipId: membership.id,
      terminationId: minted.id
    });
    const termination = result.termination;
    const events = [
      spec("ContractTerminated", {
        terminationId: termination.id,
        agreementId: agreement.id,
        organizationId: target.organizationId,
        playerId: target.playerId,
        reason: "release",
        terminatedAt: today,
        deadCapBySeason: termination.deadCapBySeason.map((x) => __spreadValues({}, x)),
        guaranteedCashDue: termination.guaranteedCashDue,
        proposalId: proposal.id,
        proposalRevision: proposal.revision
      }),
      spec("PlayerReleased", {
        organizationId: target.organizationId,
        playerId: target.playerId,
        endedMembershipId: membership.id,
        endedRightsId: result.endedRightsId,
        terminationId: termination.id
      })
    ];
    return commitAuthorizedDomainChange(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        contracts: result.contracts,
        roster: result.roster,
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      domainEvents: events,
      requests: [
        {
          organizationId: target.organizationId,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          expectedCategory: "roster",
          executedTerms: {
            termsType: RELEASE_TERMS_TYPE,
            terms: { playerId: target.playerId }
          },
          beliefIds: c.beliefIds,
          evidenceClaimIds: c.evidenceClaimIds,
          rationale: c.rationale,
          protectedChange: {
            subject: { playerId: target.playerId },
            change: { kind: "release" }
          }
        }
      ]
    });
  };
  var routeContractCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "CommitReleaseProposal":
        return routeRelease(ctx, c);
      default: {
        const unreachable = command.type;
        void bad;
        throw new Error(`unroutable contract command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/rosterCommands.ts
  var ROSTER_STATUS_TERMS_TYPE = "roster_status_v1";
  var ROSTER_STATUS_ACTIONS = {
    active_to_reserve: { from: "active", to: "reserve" },
    reserve_to_active: { from: "reserve", to: "active" },
    practice_squad_to_active: { from: "practice_squad", to: "active" },
    practice_squad_to_reserve: { from: "practice_squad", to: "reserve" }
  };
  var isAction = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(ROSTER_STATUS_ACTIONS, v);
  var parseTerms2 = (ctx, terms) => {
    if (!isPlainObject(terms)) return bad("terms must be an object");
    const keys = Object.keys(terms).sort();
    if (keys.join(",") !== "action,playerId")
      return bad("roster_status_v1 terms must be exactly { playerId, action }");
    if (!isAction(terms.action))
      return bad(
        `action must be one of ${Object.keys(ROSTER_STATUS_ACTIONS).join(", ")}`
      );
    if (!isValidId(terms.playerId) || !ctx.world.roster.players.some((p) => p.personId === terms.playerId))
      return bad("playerId must name a player");
    return { playerId: entityId(terms.playerId), action: terms.action };
  };
  var routeCommitStatus = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be the proposal revision");
    if (c.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.termsType !== ROSTER_STATUS_TERMS_TYPE)
      return bad(
        `only ${ROSTER_STATUS_TERMS_TYPE} proposals commit as roster status changes`
      );
    if (proposal.category !== "roster")
      return bad("roster status changes commit under the roster category");
    if (!Array.isArray(c.beliefIds) || !Array.isArray(c.evidenceClaimIds))
      return bad("beliefIds and evidenceClaimIds must be arrays");
    if (!isPlainObject(c.rationale)) return bad("rationale must be an object");
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    const terms = parseTerms2(ctx, proposal.terms);
    if (isFailure(terms)) return terms;
    const { from, to } = ROSTER_STATUS_ACTIONS[terms.action];
    const organizationId = proposal.organizationId;
    const today = world.simDate;
    const membership = currentRosterMembership(
      world.roster,
      terms.playerId,
      today
    );
    if (membership === void 0 || membership.organizationId !== organizationId)
      return bad(`${terms.playerId} is not on the roster of ${organizationId}`);
    if (membership.status !== from)
      return bad(
        `${terms.playerId} has status ${membership.status}, not ${from}`
      );
    if (membership.effectiveFrom >= today)
      return bad(
        `${terms.playerId} membership began today; its status can change from tomorrow`
      );
    if (!holdsContractRight(world.roster, terms.playerId, organizationId, today))
      return bad(
        `${organizationId} holds no contract right to ${terms.playerId}`
      );
    let room;
    try {
      const tx2 = requireTransactionRules(ctx.ruleset);
      const capacity = rosterCapacity(world.roster, tx2, organizationId, today);
      room = capacity[to].room;
      if (room < 1)
        return bad(
          `${to} capacity is full (${capacity[to].count}/${capacity[to].limit})`
        );
    } catch (e) {
      if (e instanceof MissingTransactionRulesError || e instanceof UnknownTransactionSeasonError)
        return bad(e.message);
      throw e;
    }
    const minted = mintRecordId(world);
    const next = {
      id: minted.id,
      playerId: terms.playerId,
      organizationId,
      status: to,
      effectiveFrom: today,
      effectiveUntil: null,
      sourceRecordId: proposal.id
    };
    const memberships = [
      ...world.roster.memberships.map(
        (m) => m.id === membership.id ? __spreadProps(__spreadValues({}, m), { effectiveUntil: dayBefore(today) }) : m
      ),
      next
    ].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const events = [
      spec("RosterStatusChanged", {
        organizationId,
        playerId: terms.playerId,
        action: terms.action,
        from,
        to,
        supersededMembershipId: membership.id,
        membershipId: next.id,
        proposalId: proposal.id,
        proposalRevision: proposal.revision
      })
    ];
    return commitAuthorizedDomainChange(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        roster: __spreadProps(__spreadValues({}, world.roster), { memberships }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      domainEvents: events,
      requests: [
        {
          organizationId,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          expectedCategory: "roster",
          executedTerms: {
            termsType: ROSTER_STATUS_TERMS_TYPE,
            terms: { playerId: terms.playerId, action: terms.action }
          },
          beliefIds: c.beliefIds,
          evidenceClaimIds: c.evidenceClaimIds,
          rationale: c.rationale,
          protectedChange: {
            subject: { playerId: terms.playerId },
            change: { kind: "roster_status", action: terms.action }
          }
        }
      ]
    });
  };
  var routeRosterCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "CommitRosterStatusProposal":
        return routeCommitStatus(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable roster command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/playerMarketView.ts
  var MARKET_DIMENSIONS = [
    "security",
    "earlyCash",
    "roleOpportunity"
  ];
  var levelIndex = (l) => PREFERENCE_LEVELS.indexOf(l);
  var agentFor = (world, playerId, date) => {
    var _a;
    const link = world.market.agentClients.filter(
      (a) => a.playerPersonId === playerId && a.effectiveFrom <= date && (a.effectiveUntil === null || date <= a.effectiveUntil)
    ).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)[0];
    return (_a = link == null ? void 0 : link.agentPersonId) != null ? _a : null;
  };
  var cashOfYear = (terms, i) => {
    const y = terms.years[i];
    return y.baseSalary + y.rosterBonus;
  };
  var totalCashOf = (terms) => terms.signingBonus + terms.years.reduce((sum, _y, i) => sum + cashOfYear(terms, i), 0);
  var guaranteedCashOf = (terms) => terms.signingBonus + terms.years.reduce((sum, y) => sum + y.guaranteedBase, 0);
  var ROLE_BAND = {
    starter: "high",
    rotation: "medium",
    depth: "low",
    developmental: "low"
  };
  var bandsOf = (terms, role) => {
    const total = totalCashOf(terms);
    const guaranteed = guaranteedCashOf(terms);
    const security = guaranteed * 3 < total ? "low" : guaranteed * 3 < total * 2 ? "medium" : "high";
    const first = terms.signingBonus + cashOfYear(terms, 0);
    const n = terms.years.length;
    const earlyCash = first * n * 10 >= total * 13 ? "high" : first * n >= total ? "medium" : "low";
    return { security, earlyCash, roleOpportunity: ROLE_BAND[role] };
  };
  var buildPlayerMarketDecisionView = (world, playerId) => {
    var _a;
    const today = world.simDate;
    const agent = agentFor(world, playerId, today);
    const preferences = (_a = world.market.playerPreferences.find((p) => p.playerPersonId === playerId)) != null ? _a : null;
    const offers = world.market.contractOffers.filter(
      (o) => o.playerId === playerId && o.status === "communicated" && o.agentPersonId === agent && (o.expiresAt === null || today < o.expiresAt)
    ).map((o) => ({
      offerId: o.id,
      revision: o.revision,
      organizationId: o.organizationId,
      terms: o.terms,
      roleCommitment: o.roleCommitment,
      targetRosterStatus: o.targetRosterStatus,
      extension: o.extension,
      rookieSlot: activeRightsFor(world.roster, playerId, today).some(
        (r) => r.kind === "draft" && r.holderOrganizationId === o.organizationId
      ),
      expiresAt: o.expiresAt,
      totalCash: totalCashOf(o.terms),
      bands: bandsOf(o.terms, o.roleCommitment)
    })).sort(
      (a, b) => a.organizationId < b.organizationId ? -1 : a.organizationId > b.organizationId ? 1 : a.revision - b.revision
    );
    const uncertainties = [
      // Contender preference needs team-results data, which this world does not have yet.
      "contender_preference_not_applied: no team-results data exists yet",
      ...preferences === null ? ["no_preference_profile: defaults of medium were used"] : []
    ];
    return {
      asOf: today,
      playerId,
      agentPersonId: agent,
      preferences,
      offers,
      uncertainties
    };
  };
  var DEFAULT_PROFILE = (playerId) => ({
    playerPersonId: playerId,
    security: "medium",
    earlyCash: "medium",
    roleOpportunity: "medium",
    contenderPreference: "medium",
    flexibility: "medium"
  });
  var requirementFor = (profile, dimension) => {
    const want = levelIndex(profile[dimension]);
    const eased = profile.flexibility === "high" ? Math.max(0, want - 1) : want;
    return PREFERENCE_LEVELS[eased];
  };
  var dimensionsByImportance = (profile) => [...MARKET_DIMENSIONS].sort(
    (a, b) => levelIndex(profile[b]) - levelIndex(profile[a]) || MARKET_DIMENSIONS.indexOf(a) - MARKET_DIMENSIONS.indexOf(b)
  );
  var unmetDimensions = (profile, bands) => MARKET_DIMENSIONS.filter(
    (d) => levelIndex(bands[d]) < levelIndex(requirementFor(profile, d))
  );
  var unmetFor = (profile, o) => o.rookieSlot ? [] : unmetDimensions(profile, o.bands);
  var compareOffers = (profile, a, b) => {
    for (const d of dimensionsByImportance(profile)) {
      const diff = levelIndex(b.bands[d]) - levelIndex(a.bands[d]);
      if (diff !== 0) return diff;
    }
    if (a.totalCash !== b.totalCash) return b.totalCash - a.totalCash;
    return a.organizationId < b.organizationId ? -1 : a.organizationId > b.organizationId ? 1 : 0;
  };
  var rankAcceptableOffers = (profile, playerId, offers) => {
    const p = profile != null ? profile : DEFAULT_PROFILE(playerId);
    return offers.filter((o) => unmetFor(p, o).length === 0).sort((a, b) => compareOffers(p, a, b));
  };
  var COMMUNICATED_DIMENSION = {
    security: "security",
    earlyCash: "cash_timing",
    roleOpportunity: "role"
  };
  var evaluatePlayerOfferSet = (view) => {
    var _a, _b;
    const profile = (_a = view.preferences) != null ? _a : DEFAULT_PROFILE(view.playerId);
    const ranked = rankAcceptableOffers(
      view.preferences,
      view.playerId,
      view.offers
    );
    const best = (_b = ranked[0]) == null ? void 0 : _b.offerId;
    return view.offers.map((o) => {
      const unmet = unmetFor(profile, o);
      const base = {
        offerId: o.offerId,
        revision: o.revision,
        organizationId: o.organizationId,
        unmet
      };
      const detail = MARKET_DIMENSIONS.map(
        (d) => unmet.includes(d) ? `requirement_unmet:${d}(needs ${requirementFor(profile, d)}, offer ${o.bands[d]})` : `requirement_met:${d}(needs ${requirementFor(profile, d)}, offer ${o.bands[d]})`
      );
      if (unmet.length === 0) {
        if (o.offerId === best)
          return __spreadProps(__spreadValues({}, base), {
            disposition: "accept",
            reasons: [...detail, "best_acceptable_offer"],
            communicated: ["interested"]
          });
        return __spreadProps(__spreadValues({}, base), {
          disposition: "defer",
          reasons: [...detail, "acceptable_but_another_offer_ranks_higher"],
          communicated: ["considering"]
        });
      }
      if (unmet.length === 1)
        return __spreadProps(__spreadValues({}, base), {
          disposition: "counter",
          reasons: detail,
          communicated: [`wants_more_${COMMUNICATED_DIMENSION[unmet[0]]}`]
        });
      return __spreadProps(__spreadValues({}, base), {
        disposition: "reject",
        reasons: detail,
        communicated: ["not_a_fit"]
      });
    });
  };

  // packages/sim-core/src/freeAgency.ts
  var offerCharges = (world, tx2, offer) => {
    const next = capChargeBySeason(tx2.contracts, offer.terms);
    if (!offer.extension) return next.filter((x) => x.amount > 0);
    const old = world.contracts.agreements.find(
      (a) => a.playerId === offer.playerId && a.organizationId === offer.organizationId && a.status === "active"
    );
    const before = old === void 0 ? [] : old.terms.years.map((y) => ({
      season: y.season,
      amount: addMoney(y.baseSalary, y.rosterBonus)
    }));
    return next.map((x) => {
      var _a, _b;
      return {
        season: x.season,
        amount: Math.max(
          0,
          x.amount - ((_b = (_a = before.find((b) => b.season === x.season)) == null ? void 0 : _a.amount) != null ? _b : 0)
        )
      };
    }).filter((x) => x.amount > 0);
  };
  var offerSlot = (offer) => offer.extension ? null : offer.targetRosterStatus;
  var fitProblem = (world, tx2, chosen, candidate) => {
    const all = [...chosen, candidate];
    try {
      for (const charge of offerCharges(world, tx2, candidate)) {
        const position = capPosition(
          tx2,
          world.contracts,
          candidate.organizationId,
          charge.season
        );
        const incoming = all.reduce(
          (sum, o) => {
            var _a, _b;
            return sum + ((_b = (_a = offerCharges(world, tx2, o).find((x) => x.season === charge.season)) == null ? void 0 : _a.amount) != null ? _b : 0);
          },
          0
        );
        if (position.committed + incoming > position.cap)
          return `cap: season ${charge.season} would exceed ${position.cap}`;
      }
      const slot = offerSlot(candidate);
      if (slot !== null) {
        const capacity = rosterCapacity(
          world.roster,
          tx2,
          candidate.organizationId,
          world.simDate
        )[slot];
        const wanted = all.filter((o) => offerSlot(o) === slot).length;
        if (capacity.count + wanted > capacity.limit)
          return `roster capacity: ${slot} is full`;
      }
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return e.message;
      throw e;
    }
    return null;
  };
  var text = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var byClubOrder = (a, b) => a.priority - b.priority || text(a.playerId, b.playerId);
  var livePlayers = (offers) => [...new Set(offers.map((o) => o.playerId))].sort(text);
  var resolveFreeAgencyRound = (world, tx2) => {
    const today = world.simDate;
    const live = world.market.contractOffers.filter(
      (o) => o.status === "communicated" && (o.expiresAt === null || today < o.expiresAt)
    ).sort(
      (a, b) => text(a.organizationId, b.organizationId) || text(a.playerId, b.playerId)
    );
    const outcomes = /* @__PURE__ */ new Map();
    const record = (offer, status, disposition, reasons, communicated) => {
      outcomes.set(offer, { offer, status, disposition, reasons, communicated });
    };
    const ranking = /* @__PURE__ */ new Map();
    const evaluations = /* @__PURE__ */ new Map();
    for (const playerId of livePlayers(live)) {
      const view = buildPlayerMarketDecisionView(world, playerId);
      for (const e of evaluatePlayerOfferSet(view))
        evaluations.set(`${e.organizationId}|${playerId}`, e);
      const seen = new Set(view.offers.map((o) => o.offerId));
      const mine = live.filter((o) => o.playerId === playerId);
      for (const o of mine)
        if (!seen.has(o.id))
          record(
            o,
            "rejected",
            "reject",
            ["offer_not_made_through_current_agent"],
            ["not_a_fit"]
          );
      const offerOf = (s) => mine.find((o) => o.id === s.offerId);
      ranking.set(
        playerId,
        rankAcceptableOffers(view.preferences, playerId, view.offers).map(
          offerOf
        )
      );
    }
    const pointer = /* @__PURE__ */ new Map();
    for (const p of ranking.keys()) pointer.set(p, 0);
    const droppedByClub = /* @__PURE__ */ new Map();
    const pick = (p) => ranking.get(p)[pointer.get(p)];
    let held = /* @__PURE__ */ new Map();
    for (; ; ) {
      const proposals = [...ranking.keys()].map((p) => pick(p)).filter((o) => o !== void 0);
      const orgs = [...new Set(proposals.map((o) => o.organizationId))].sort(
        text
      );
      const kept = [];
      let turnedAway = false;
      for (const org of orgs) {
        const mine = proposals.filter((o) => o.organizationId === org).sort(byClubOrder);
        const chosen = [];
        const groups = /* @__PURE__ */ new Set();
        for (const o of mine) {
          let why = null;
          if (o.contingencyGroupId !== null && groups.has(o.contingencyGroupId))
            why = "club_group_already_filled";
          else
            why = fitProblem(world, tx2, chosen, o) === null ? null : "club_could_not_fit";
          if (why === null) {
            chosen.push(o);
            if (o.contingencyGroupId !== null) groups.add(o.contingencyGroupId);
          } else {
            droppedByClub.set(o, why);
            pointer.set(o.playerId, pointer.get(o.playerId) + 1);
            turnedAway = true;
          }
        }
        kept.push(...chosen);
      }
      held = new Map(kept.map((o) => [o.playerId, o]));
      if (!turnedAway) break;
    }
    for (const o of live) {
      if (outcomes.has(o)) continue;
      const evaluation = evaluations.get(`${o.organizationId}|${o.playerId}`);
      const winner = held.get(o.playerId);
      if (winner === o) {
        record(o, "accepted_pending_commit", "accept", evaluation.reasons, [
          "interested"
        ]);
      } else if (droppedByClub.has(o)) {
        record(
          o,
          "withdrawn",
          "reject",
          [...evaluation.reasons, `club_side:${droppedByClub.get(o)}`],
          ["club_withdrew"]
        );
      } else if (evaluation.disposition === "counter") {
        record(
          o,
          "countered",
          "counter",
          evaluation.reasons,
          evaluation.communicated
        );
      } else if (evaluation.disposition === "reject") {
        record(
          o,
          "rejected",
          "reject",
          evaluation.reasons,
          evaluation.communicated
        );
      } else {
        record(
          o,
          "rejected",
          "reject",
          [...evaluation.reasons, "player_chose_another_offer"],
          ["not_selected"]
        );
      }
    }
    return [...outcomes.values()].sort(
      (a, b) => text(a.offer.organizationId, b.offer.organizationId) || text(a.offer.playerId, b.offer.playerId)
    );
  };

  // packages/sim-core/src/rookieContracts.ts
  var rookieScaleTerms = (rule, startSeason) => ({
    startSeason,
    signingBonus: rule.signingBonus,
    years: rule.baseSalaryBySeason.map((base, i) => ({
      season: startSeason + i,
      baseSalary: base,
      rosterBonus: moneyAmount(0),
      guaranteedBase: moneyAmount(0)
    }))
  });
  var roundOfDraftRight = (world, right) => {
    var _a;
    const selection = world.draft.selections.find(
      (s) => s.id === right.sourceRecordId
    );
    if (selection === void 0) return void 0;
    return (_a = world.draft.picks.find((p) => p.id === selection.pickId)) == null ? void 0 : _a.round;
  };
  var sameTerms = (a, b) => a.startSeason === b.startSeason && a.signingBonus === b.signingBonus && a.years.length === b.years.length && a.years.every((y, i) => {
    const o = b.years[i];
    return y.season === o.season && y.baseSalary === o.baseSalary && y.rosterBonus === o.rosterBonus && y.guaranteedBase === o.guaranteedBase;
  });
  var rookieScaleProblem = (world, tx2, right, terms) => {
    const round = roundOfDraftRight(world, right);
    if (round === void 0)
      return "this draft right has no recorded selection, so no rookie scale applies";
    const rule = tx2.draft.rookieContractByRound.find((r) => r.round === round);
    if (rule === void 0)
      return `the ruleset has no rookie contract for round ${round}`;
    const expected = rookieScaleTerms(rule, terms.startSeason);
    return sameTerms(terms, expected) ? null : `a round ${round} draft pick signs the ruleset rookie contract, not negotiated terms`;
  };

  // packages/sim-core/src/freeAgencyCommands.ts
  var CONTRACT_OFFER_TERMS_TYPE = "contract_offer_v1";
  var RESOLVERS2 = /* @__PURE__ */ new Set([
    "human_gm",
    "commissioner",
    "system",
    "test_harness"
  ]);
  var LIVE = /* @__PURE__ */ new Set([
    "communicated",
    "countered",
    "accepted_pending_commit"
  ]);
  var text2 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var byId4 = (a, b) => text2(a.id, b.id);
  var expired = (expiresAt, today) => expiresAt !== null && today >= expiresAt;
  var contractTermsPayload = (t) => ({
    startSeason: t.startSeason,
    signingBonus: t.signingBonus,
    years: t.years.map((y) => ({
      season: y.season,
      baseSalary: y.baseSalary,
      rosterBonus: y.rosterBonus,
      guaranteedBase: y.guaranteedBase
    }))
  });
  var contractOfferProposalTerms = (o) => ({
    playerId: o.playerId,
    targetRosterStatus: o.targetRosterStatus,
    roleCommitment: o.roleCommitment,
    terms: contractTermsPayload(o.terms)
  });
  var parseTerms3 = (v) => {
    if (!isPlainObject(v)) return "terms must be an object";
    try {
      if (!Number.isSafeInteger(v.startSeason))
        return "terms.startSeason must be an integer";
      if (!Array.isArray(v.years) || v.years.length === 0)
        return "terms.years must be a non-empty list";
      const years = v.years.map((y) => {
        if (!isPlainObject(y)) throw new Error("each year must be an object");
        if (!Number.isSafeInteger(y.season))
          throw new Error("year.season must be an integer");
        return {
          season: y.season,
          baseSalary: moneyAmount(y.baseSalary),
          rosterBonus: moneyAmount(y.rosterBonus),
          guaranteedBase: moneyAmount(y.guaranteedBase)
        };
      });
      return {
        startSeason: v.startSeason,
        years,
        signingBonus: moneyAmount(v.signingBonus)
      };
    } catch (e) {
      return e instanceof Error ? e.message : "terms are malformed";
    }
  };
  var eligibility = (world, org, playerId, today) => {
    const rights2 = activeRightsFor(world.roster, playerId, today);
    const right = rights2[0];
    if (right === void 0) {
      if (isUndraftedProspect(world.draft, playerId))
        return ` is a draft prospect until the draft completes, then an undrafted free agent`;
      return {
        extension: false,
        right: void 0,
        membership: void 0,
        agreement: void 0
      };
    }
    if (right.holderOrganizationId !== org)
      return `${playerId} is under ${right.holderOrganizationId}'s rights`;
    if (right.kind === "draft" || right.kind === "exclusive")
      return {
        extension: false,
        right,
        membership: void 0,
        agreement: void 0
      };
    const membership = currentRosterMembership(world.roster, playerId, today);
    if (membership === void 0 || membership.organizationId !== org)
      return `${playerId} is not on ${org}'s roster, so there is nothing to extend`;
    const agreement = world.contracts.agreements.find(
      (a) => a.playerId === playerId && a.organizationId === org && a.status === "active"
    );
    if (agreement === void 0)
      return `${playerId} has no active contract to extend`;
    return { extension: true, right, membership, agreement };
  };
  var releaseReservation = (reservations, id, to = "released") => id === null ? reservations : reservations.map(
    (r) => r.id === id && r.status === "active" ? __spreadProps(__spreadValues({}, r), { status: to }) : r
  );
  var latestOffers = (world) => {
    const latest = /* @__PURE__ */ new Map();
    for (const o of world.market.contractOffers) {
      const have = latest.get(o.id);
      if (have === void 0 || o.revision > have.revision) latest.set(o.id, o);
    }
    return [...latest.values()].sort(byId4);
  };
  var latestOffer = (world, id) => latestOffers(world).find((o) => o.id === id);
  var replaceOffer = (offers, next) => offers.map((o) => o.id === next.id && o.revision === next.revision ? next : o).sort((a, b) => text2(a.id, b.id) || a.revision - b.revision);
  var contractRights = (world, org, person) => effectiveRightsAt(world, org, person, "contract", world.simDate).rights;
  var window = (tx2, today) => {
    try {
      const r = transactionSeasonRules(tx2, seasonOfDate(today));
      return { open: r.freeAgencyOpen, close: r.freeAgencyClose };
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return e.message;
      throw e;
    }
  };
  var ok = (detail, authorizationDetail, nextWorld, eventSpecs) => ({
    ok: true,
    authorizationDetail,
    resolution: { nextWorld, eventSpecs, detail }
  });
  var routeSubmit2 = (ctx, c) => {
    var _a, _b, _c;
    const { world } = ctx;
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    if (!isValidId(c.playerId) || !world.roster.players.some((p) => p.personId === c.playerId))
      return bad("playerId must name an existing player");
    const playerId = entityId(c.playerId);
    const today = world.simDate;
    const win = window(tx2, today);
    if (typeof win === "string") return bad(win);
    if (today < win.open) return bad(`free agency opens on ${win.open}`);
    if (today > win.close) return bad(`free agency closed on ${win.close}`);
    if (!contractRights(world, org, by).includes("communicate"))
      return denied(`${by} lacks communicate on contract in ${org}`);
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (c.expectedRevision !== proposal.revision)
      return bad(`proposal revision is stale: latest is ${proposal.revision}`);
    if (proposal.category !== "contract" || proposal.termsType !== CONTRACT_OFFER_TERMS_TYPE)
      return bad(`the proposal is not a ${CONTRACT_OFFER_TERMS_TYPE} contract`);
    if (proposal.organizationId !== org)
      return bad("the proposal belongs to another organization");
    const terms = parseTerms3(c.terms);
    if (typeof terms === "string") return bad(terms);
    const problems = contractTermsProblems(tx2, terms);
    if (problems.length > 0) return bad(`illegal terms: ${problems[0]}`);
    if (terms.startSeason < seasonOfDate(today))
      return bad("the contract cannot start before the current season");
    if (typeof c.roleCommitment !== "string" || !ROLE_COMMITMENTS.includes(c.roleCommitment))
      return bad(`roleCommitment must be one of ${ROLE_COMMITMENTS.join(", ")}`);
    const role = c.roleCommitment;
    if (typeof c.targetRosterStatus !== "string" || !ROSTER_STATUSES.includes(c.targetRosterStatus))
      return bad(
        `targetRosterStatus must be one of ${ROSTER_STATUSES.join(", ")}`
      );
    const target = c.targetRosterStatus;
    if (typeof c.priority !== "number" || !Number.isInteger(c.priority) || c.priority < 0 || c.priority > 1e3)
      return bad("priority must be an integer 0..1000");
    let group = null;
    if (c.contingencyGroupId !== void 0 && c.contingencyGroupId !== null) {
      if (typeof c.contingencyGroupId !== "string" || !isValidId(c.contingencyGroupId))
        return bad("contingencyGroupId must be a valid id");
      group = c.contingencyGroupId;
    }
    let expiresAt;
    if (c.expiresAt === void 0 || c.expiresAt === null)
      expiresAt = SimDate.parse(today).addDays(tx2.market.defaultOfferValidityDays).toISO();
    else if (typeof c.expiresAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.expiresAt))
      expiresAt = c.expiresAt;
    else return bad("expiresAt must be a YYYY-MM-DD date");
    if (expiresAt <= today) return bad("the offer would already be expired");
    const elig = eligibility(world, org, playerId, today);
    if (typeof elig === "string") return bad(elig);
    if (((_a = elig.right) == null ? void 0 : _a.kind) === "draft") {
      const scale = rookieScaleProblem(world, tx2, elig.right, terms);
      if (scale !== null) return bad(scale);
    }
    if (elig.extension && target !== elig.membership.status)
      return bad(
        `an extension keeps the player on the ${elig.membership.status} list`
      );
    const agent = agentFor(world, playerId, today);
    const named = c.agentPersonId === void 0 || c.agentPersonId === null ? null : c.agentPersonId;
    if (named !== agent)
      return bad(
        agent === null ? `${playerId} is not represented; the offer must not name an agent` : `${playerId} is represented by ${agent}; the offer must go through that agent`
      );
    const proposalTerms = contractOfferProposalTerms({
      playerId,
      targetRosterStatus: target,
      roleCommitment: role,
      terms
    });
    if (canonicalString(proposal.terms) !== canonicalString(proposalTerms))
      return bad("the proposal does not authorize these offer terms");
    let supersedes;
    if (c.supersedesOfferId !== void 0 && c.supersedesOfferId !== null) {
      if (!isValidId(c.supersedesOfferId))
        return bad("supersedesOfferId must be a valid id");
      supersedes = latestOffer(world, c.supersedesOfferId);
      if (supersedes === void 0)
        return bad("supersedesOfferId does not name an offer");
      if (supersedes.organizationId !== org)
        return bad("only the offering organization can revise an offer");
      if (supersedes.status !== "communicated" && supersedes.status !== "countered")
        return bad(
          `offer ${supersedes.id} is ${supersedes.status} and cannot be revised`
        );
      if (supersedes.playerId !== playerId)
        return bad("a revision must be for the same player");
    }
    const clash = latestOffers(world).find(
      (o) => o.organizationId === org && o.playerId === playerId && LIVE.has(o.status) && o.id !== (supersedes == null ? void 0 : supersedes.id)
    );
    if (clash !== void 0)
      return bad(
        `${org} already has a live offer (${clash.id}) to ${playerId}; revise it instead`
      );
    const minted = mintRecordIds(world, supersedes === void 0 ? 2 : 1);
    const offerId = (_b = supersedes == null ? void 0 : supersedes.id) != null ? _b : minted.ids[0];
    const reservationId = minted.ids[supersedes === void 0 ? 1 : 0];
    const draft = {
      id: offerId,
      revision: supersedes === void 0 ? 1 : supersedes.revision + 1,
      organizationId: org,
      playerId,
      agentPersonId: agent,
      submittedBy: by,
      organizationProposalId: proposal.id,
      terms,
      roleCommitment: role,
      targetRosterStatus: target,
      extension: elig.extension,
      contingencyGroupId: group,
      priority: c.priority,
      submittedAt: today,
      expiresAt,
      status: "communicated",
      supersedesRevision: (_c = supersedes == null ? void 0 : supersedes.revision) != null ? _c : null,
      reservationId,
      communicated: []
    };
    const charges = offerCharges(world, tx2, draft);
    const reservation = {
      id: reservationId,
      organizationId: org,
      sourceKind: "contract_offer",
      sourceRecordId: offerId,
      capBySeason: charges,
      rosterSlotStatus: offerSlot(draft),
      contingencyGroupId: group,
      createdAt: today,
      status: "active"
    };
    const freed = supersedes === void 0 ? world.market.reservations : releaseReservation(world.market.reservations, supersedes.reservationId);
    const hypothetical = { reservations: [...freed, reservation] };
    try {
      for (const charge of charges) {
        const position = capPosition(tx2, world.contracts, org, charge.season);
        const held = reservedCap(hypothetical, org, charge.season);
        if (position.committed + held > position.cap)
          return bad(
            `cap: season ${charge.season} would exceed ${position.cap} (committed ${position.committed}, reserved with this offer ${held})`
          );
      }
      const slot = offerSlot(draft);
      if (slot !== null) {
        const capacity = rosterCapacity(world.roster, tx2, org, today)[slot];
        const held = reservedSlots(hypothetical, org, slot);
        if (capacity.count + held > capacity.limit)
          return bad(
            `roster capacity: ${slot} has ${capacity.count} players and ${held} reserved of ${capacity.limit}`
          );
      }
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
      throw e;
    }
    const offers = supersedes === void 0 ? world.market.contractOffers : replaceOffer(world.market.contractOffers, __spreadProps(__spreadValues({}, supersedes), {
      status: "superseded"
    }));
    return ok(
      `${org} offers ${playerId} a contract`,
      `${by} holds communicate on contract in ${org}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          contractOffers: [...offers, draft].sort(
            (a, b) => text2(a.id, b.id) || a.revision - b.revision
          ),
          reservations: [...freed, reservation].sort(byId4)
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      [
        spec("ContractOfferSubmitted", {
          offerId,
          revision: draft.revision,
          organizationId: org,
          playerId,
          agentPersonId: agent,
          extension: elig.extension,
          targetRosterStatus: target,
          roleCommitment: role,
          expiresAt,
          reservationId,
          reservedCapBySeason: charges.map((x) => __spreadValues({}, x))
        })
      ]
    );
  };
  var routeWithdraw = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.offerId)) return bad("offerId must be a valid id");
    const offer = latestOffer(world, c.offerId);
    if (offer === void 0) return bad("offerId does not name an offer");
    if (c.offerRevision !== offer.revision)
      return bad(`offer revision is stale: latest is ${offer.revision}`);
    if (offer.status !== "communicated" && offer.status !== "countered")
      return bad(`offer is ${offer.status} and cannot be withdrawn`);
    if (!contractRights(world, offer.organizationId, by).includes("communicate"))
      return denied(
        `${by} lacks communicate on contract in ${offer.organizationId}`
      );
    return ok(
      `${offer.organizationId} withdraws offer ${offer.id}`,
      `${by} holds communicate on contract in ${offer.organizationId}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          contractOffers: replaceOffer(world.market.contractOffers, __spreadProps(__spreadValues({}, offer), {
            status: "withdrawn"
          })),
          reservations: releaseReservation(
            world.market.reservations,
            offer.reservationId
          )
        })
      }),
      [
        spec("ContractOfferWithdrawn", {
          offerId: offer.id,
          revision: offer.revision,
          organizationId: offer.organizationId,
          playerId: offer.playerId
        })
      ]
    );
  };
  var routeResolve2 = (ctx) => {
    if (!RESOLVERS2.has(ctx.actor.kind))
      return denied(`${ctx.actor.kind} cannot resolve the free-agency market`);
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    let world = ctx.world;
    const today = world.simDate;
    const win = window(tx2, today);
    if (typeof win === "string") return bad(win);
    if (today < win.open || today > win.close)
      return bad(`the free-agency window is ${win.open}..${win.close}`);
    const events = [];
    const lapsed = latestOffers(world).filter(
      (o) => LIVE.has(o.status) && expired(o.expiresAt, today)
    );
    let offers = world.market.contractOffers;
    let reservations = world.market.reservations;
    for (const o of lapsed) {
      offers = replaceOffer(offers, __spreadProps(__spreadValues({}, o), { status: "expired" }));
      reservations = releaseReservation(reservations, o.reservationId);
      events.push(
        spec("ContractOfferExpired", {
          offerId: o.id,
          revision: o.revision,
          organizationId: o.organizationId,
          playerId: o.playerId
        })
      );
    }
    world = __spreadProps(__spreadValues({}, world), {
      market: __spreadProps(__spreadValues({}, world.market), { contractOffers: offers, reservations })
    });
    const outcomes = resolveFreeAgencyRound(world, tx2);
    if (outcomes.length === 0 && lapsed.length === 0)
      return bad("no live contract offer to resolve");
    const minted = mintRecordIds(world, outcomes.length);
    const responses = [];
    outcomes.forEach((out, i) => {
      offers = replaceOffer(offers, __spreadProps(__spreadValues({}, out.offer), {
        status: out.status,
        communicated: out.communicated
      }));
      if (out.status !== "accepted_pending_commit")
        reservations = releaseReservation(reservations, out.offer.reservationId);
      responses.push({
        kind: "contract_response",
        id: minted.ids[i],
        offerId: out.offer.id,
        offerRevision: out.offer.revision,
        playerId: out.offer.playerId,
        disposition: out.disposition,
        reasons: out.reasons,
        communicated: out.communicated,
        createdAt: today
      });
      events.push(
        spec("ContractOfferAnswered", {
          offerId: out.offer.id,
          revision: out.offer.revision,
          organizationId: out.offer.organizationId,
          playerId: out.offer.playerId,
          status: out.status,
          communicated: [...out.communicated]
        })
      );
    });
    return ok(
      `resolved ${outcomes.length} contract offer(s) on ${today}`,
      `${ctx.actor.kind} may resolve the free-agency market`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          contractOffers: offers,
          reservations: [...reservations].sort(byId4),
          responses: [...world.market.responses, ...responses].sort(byId4)
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      events
    );
  };
  var routeCommit = (ctx, c) => {
    var _a, _b, _c;
    const { world } = ctx;
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.offerId)) return bad("offerId must be a valid id");
    const offer = latestOffer(world, c.offerId);
    if (offer === void 0) return bad("offerId does not name an offer");
    if (c.offerRevision !== offer.revision)
      return bad(`offer revision is stale: latest is ${offer.revision}`);
    if (offer.status === "committed")
      return bad("this offer has already been committed");
    if (offer.status !== "accepted_pending_commit")
      return bad(`offer is ${offer.status}, not accepted by the player`);
    const today = world.simDate;
    if (expired(offer.expiresAt, today)) return bad("the offer has expired");
    const win = window(tx2, today);
    if (typeof win === "string") return bad(win);
    if (today > win.close) return bad(`free agency closed on ${win.close}`);
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be a number");
    const ids = (x) => Array.isArray(x) && x.every((i) => typeof i === "string") ? x : null;
    const beliefIds = ids(c.beliefIds);
    const evidenceClaimIds = ids(c.evidenceClaimIds);
    if (beliefIds === null || evidenceClaimIds === null)
      return bad("beliefIds and evidenceClaimIds must be id lists");
    const proposal = latestProposal(
      world.decisions,
      offer.organizationProposalId
    );
    if (proposal === void 0)
      return bad("the authorizing proposal no longer exists");
    const proposalTerms = contractOfferProposalTerms(offer);
    if (proposal.category !== "contract" || proposal.termsType !== CONTRACT_OFFER_TERMS_TYPE || canonicalString(proposal.terms) !== canonicalString(proposalTerms))
      return bad("the authorizing proposal no longer matches the offered terms");
    const org = offer.organizationId;
    const elig = eligibility(world, org, offer.playerId, today);
    if (typeof elig === "string") return bad(`stale offer: ${elig}`);
    if (((_a = elig.right) == null ? void 0 : _a.kind) === "draft") {
      const scale = rookieScaleProblem(world, tx2, elig.right, offer.terms);
      if (scale !== null) return bad(`stale offer: ${scale}`);
    }
    if (elig.extension !== offer.extension)
      return bad("stale offer: the player changed status since the offer");
    if (agentFor(world, offer.playerId, today) !== offer.agentPersonId)
      return bad("stale offer: the player changed agent since the offer");
    const reservation = world.market.reservations.find(
      (r) => r.id === offer.reservationId
    );
    if (reservation === void 0 || reservation.status !== "active")
      return bad("the reservation behind this offer is no longer active");
    const blocked = fitProblem(world, tx2, [], offer);
    if (blocked !== null) return bad(`stale offer: ${blocked}`);
    const extraIds = 3;
    const minted = mintRecordIds(world, extraIds);
    const agreementId = minted.ids[0];
    const rightId = minted.ids[1];
    const agreement = {
      id: agreementId,
      playerId: offer.playerId,
      organizationId: org,
      terms: offer.terms,
      signedAt: today,
      sourceOfferId: offer.id,
      sourceProposalId: proposal.id,
      supersedesAgreementId: (_c = (_b = elig.agreement) == null ? void 0 : _b.id) != null ? _c : null,
      status: "active"
    };
    const newRight = {
      id: rightId,
      playerId: offer.playerId,
      holderOrganizationId: org,
      kind: "contract",
      sourceRecordId: agreementId,
      effectiveFrom: today,
      effectiveUntil: null
    };
    const retained = elig.extension && elig.agreement !== void 0 ? extensionRetainedBonus(
      tx2.contracts,
      elig.agreement.terms,
      seasonOfDate(today)
    ) : [];
    const termination = elig.agreement !== void 0 && retained.length > 0 ? [
      {
        id: minted.ids[2],
        agreementId: elig.agreement.id,
        organizationId: org,
        playerId: offer.playerId,
        terminatedAt: today,
        reason: "extension_retained_bonus",
        deadCapBySeason: retained,
        guaranteedCashDue: 0
      }
    ] : [];
    const memberships = elig.extension ? world.roster.memberships : [
      ...world.roster.memberships,
      {
        id: minted.ids[2],
        playerId: offer.playerId,
        organizationId: org,
        status: offer.targetRosterStatus,
        effectiveFrom: today,
        effectiveUntil: null,
        sourceRecordId: agreementId
      }
    ];
    const rights2 = [
      ...world.roster.rights.map(
        (r) => elig.right !== void 0 && r.id === elig.right.id ? __spreadProps(__spreadValues({}, r), { effectiveUntil: dayBefore(today) }) : r
      ),
      newRight
    ].sort(byId4);
    let offers = replaceOffer(world.market.contractOffers, __spreadProps(__spreadValues({}, offer), {
      status: "committed"
    }));
    let reservations = releaseReservation(
      world.market.reservations,
      offer.reservationId,
      "consumed"
    );
    for (const o of latestOffers(world)) {
      if (o.id === offer.id || !LIVE.has(o.status)) continue;
      const sameGroup = o.organizationId === org && offer.contingencyGroupId !== null && o.contingencyGroupId === offer.contingencyGroupId;
      if (o.playerId !== offer.playerId && !sameGroup) continue;
      offers = replaceOffer(offers, __spreadProps(__spreadValues({}, o), {
        status: sameGroup ? "withdrawn" : "rejected",
        communicated: sameGroup ? ["club_withdrew"] : ["not_selected"]
      }));
      reservations = releaseReservation(reservations, o.reservationId);
    }
    const nextWorld = __spreadProps(__spreadValues({}, world), {
      roster: __spreadProps(__spreadValues({}, world.roster), {
        rights: rights2,
        memberships: memberships.slice().sort(byId4)
      }),
      contracts: __spreadProps(__spreadValues({}, world.contracts), {
        agreements: [
          ...world.contracts.agreements.map(
            (a) => elig.agreement !== void 0 && a.id === elig.agreement.id ? __spreadProps(__spreadValues({}, a), { status: "superseded" }) : a
          ),
          agreement
        ].sort(byId4),
        terminations: [...world.contracts.terminations, ...termination].sort(
          byId4
        )
      }),
      market: __spreadProps(__spreadValues({}, world.market), {
        contractOffers: offers,
        reservations: [...reservations].sort(byId4)
      }),
      nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
    });
    return commitAuthorizedDomainChange(ctx, {
      nextWorld,
      domainEvents: [
        spec("ContractSigned", {
          offerId: offer.id,
          offerRevision: offer.revision,
          agreementId,
          organizationId: org,
          playerId: offer.playerId,
          extension: elig.extension,
          targetRosterStatus: offer.targetRosterStatus,
          proposalId: proposal.id,
          signedOn: today
        })
      ],
      requests: [
        {
          organizationId: org,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: c.expectedRevision,
          expectedCategory: "contract",
          executedTerms: {
            termsType: CONTRACT_OFFER_TERMS_TYPE,
            terms: proposalTerms
          },
          beliefIds,
          evidenceClaimIds,
          rationale: c.rationale
        }
      ]
    });
  };
  var routeFreeAgencyCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "SubmitContractOffer":
        return routeSubmit2(ctx, c);
      case "WithdrawContractOffer":
        return routeWithdraw(ctx, c);
      case "ResolveFreeAgencyMarket":
        return routeResolve2(ctx);
      case "CommitContractSigning":
        return routeCommit(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable free-agency command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/draftBoardCommands.ts
  var DRAFT_BOARD_TERMS_TYPE = "draft_board_v1";
  var MAX_ENTRIES = 400;
  var MAX_REFS = 16;
  var byText8 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var ENTRY_KEYS = [
    "beliefIds",
    "needPriority",
    "noteClaimIds",
    "planIds",
    "playerId",
    "roleProjection",
    "withinTierOrder"
  ];
  var exactKeys = (v, keys) => Object.keys(v).sort().join(",") === [...keys].sort().join(",");
  var idList2 = (v, label) => {
    if (!Array.isArray(v) || v.length > MAX_REFS || v.some((x) => !isValidId(x)))
      return `${label} must be a list of up to ${MAX_REFS} ids`;
    return [...new Set(v)].sort(byText8);
  };
  var entryOrder = (a, b) => {
    var _a, _b;
    return ((_a = a.withinTierOrder) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = b.withinTierOrder) != null ? _b : Number.MAX_SAFE_INTEGER) || byText8(a.playerId, b.playerId);
  };
  var parseDraftBoardTerms = (world, organizationId, actorPersonId, terms) => {
    if (!isPlainObject(terms) || !exactKeys(terms, ["draftClassId", "tiers"]))
      return "board terms must be exactly { draftClassId, tiers }";
    const draftClass = world.draft.classes.find(
      (c) => c.id === terms.draftClassId
    );
    if (draftClass === void 0)
      return "draftClassId does not name a draft class";
    if (!Array.isArray(terms.tiers) || terms.tiers.length === 0)
      return "a board needs at least one tier";
    const seenTiers = /* @__PURE__ */ new Set();
    const seenPlayers = /* @__PURE__ */ new Set();
    let entries = 0;
    const tiers = [];
    for (const rawTier of terms.tiers) {
      if (!isPlainObject(rawTier) || !exactKeys(rawTier, ["entries", "tier"]))
        return "each tier must be exactly { tier, entries }";
      const tier = rawTier.tier;
      if (typeof tier !== "number" || !Number.isInteger(tier) || tier < MIN_BOARD_TIER || tier > MAX_BOARD_TIER)
        return `tier must be an integer ${MIN_BOARD_TIER}..${MAX_BOARD_TIER}`;
      if (seenTiers.has(tier)) return `tier ${tier} appears twice`;
      seenTiers.add(tier);
      if (!Array.isArray(rawTier.entries) || rawTier.entries.length === 0)
        return `tier ${tier} needs at least one entry`;
      const usedOrders = /* @__PURE__ */ new Set();
      const parsed = [];
      for (const raw of rawTier.entries) {
        if (!isPlainObject(raw)) return "each entry must be an object";
        if (!exactKeys(raw, ENTRY_KEYS))
          return `an entry is exactly ${ENTRY_KEYS.join(", ")}: no other field (such as a rating or capabilities) is accepted`;
        entries += 1;
        if (entries > MAX_ENTRIES)
          return `a board holds at most ${MAX_ENTRIES} prospects`;
        if (!isValidId(raw.playerId)) return "entry.playerId must be a valid id";
        const playerId = raw.playerId;
        if (!draftClass.eligiblePlayerIds.includes(playerId))
          return `${playerId} is not eligible in this draft class`;
        if (seenPlayers.has(playerId)) return `${playerId} is on the board twice`;
        seenPlayers.add(playerId);
        if (typeof raw.needPriority !== "string" || !NEED_PRIORITIES.includes(raw.needPriority))
          return `needPriority must be one of ${NEED_PRIORITIES.join(", ")}`;
        const role = raw.roleProjection;
        if (role !== null && (typeof role !== "string" || role.length === 0 || role.length > 48))
          return "roleProjection must be null or 1-48 characters";
        const order = raw.withinTierOrder;
        if (order !== null) {
          if (typeof order !== "number" || !Number.isInteger(order) || order < 1)
            return "withinTierOrder must be null or a positive integer";
          if (usedOrders.has(order))
            return `tier ${tier} gives order ${order} to two prospects; use null for a tie`;
          usedOrders.add(order);
        }
        const beliefIds = idList2(raw.beliefIds, "beliefIds");
        if (typeof beliefIds === "string") return beliefIds;
        const planIds = idList2(raw.planIds, "planIds");
        if (typeof planIds === "string") return planIds;
        const noteClaimIds = idList2(raw.noteClaimIds, "noteClaimIds");
        if (typeof noteClaimIds === "string") return noteClaimIds;
        if (beliefIds.length === 0 && noteClaimIds.length === 0)
          return `${playerId} needs a belief or a noted claim behind its place on the board`;
        for (const id of beliefIds) {
          const belief = world.information.beliefs.find((b) => b.id === id);
          if (belief === void 0 || !isBeliefVisibleTo(world, organizationId, actorPersonId, belief))
            return `beliefIds: ${id} is not available to this organization`;
          if (belief.subject.kind !== "entity" || belief.subject.id !== playerId)
            return `beliefIds: ${id} is not about ${playerId}`;
        }
        for (const id of noteClaimIds) {
          const claim = world.information.claims.find((x) => x.id === id);
          if (claim === void 0 || !isClaimVisibleTo(world, organizationId, actorPersonId, claim))
            return `noteClaimIds: ${id} is not available to this organization`;
          if (claim.subject.kind !== "entity" || claim.subject.id !== playerId)
            return `noteClaimIds: ${id} is not about ${playerId}`;
        }
        for (const id of planIds) {
          const plan = world.plans.plans.find((p) => p.id === id);
          if (plan === void 0 || plan.organizationId !== organizationId)
            return `planIds: ${id} is not a plan of this organization`;
        }
        parsed.push({
          playerId,
          beliefIds,
          roleProjection: role,
          withinTierOrder: order,
          needPriority: raw.needPriority,
          planIds,
          noteClaimIds
        });
      }
      tiers.push({ tier, entries: parsed.sort(entryOrder) });
    }
    return {
      draftClassId: draftClass.id,
      tiers: tiers.sort((a, b) => a.tier - b.tier)
    };
  };
  var latestBoard = (world, organizationId, draftClassId) => world.draft.boards.filter(
    (b) => b.organizationId === organizationId && b.draftClassId === draftClassId
  ).sort((a, b) => a.revision - b.revision).at(-1);
  var flat = (b) => {
    var _a;
    return new Map(
      ((_a = b == null ? void 0 : b.tiers) != null ? _a : []).flatMap(
        (t) => t.entries.map(
          (e) => [e.playerId, { tier: t.tier, entry: e }]
        )
      )
    );
  };
  var describeBoardChange = (previous, next) => {
    const before = flat(previous);
    const after = flat(next);
    const added = [];
    const removed = [];
    const tierChanged = [];
    const orderChanged = [];
    const needChanged = [];
    const basisChanged = [];
    for (const [id, now] of after) {
      const was = before.get(id);
      if (was === void 0) {
        added.push(id);
        continue;
      }
      if (was.tier !== now.tier) tierChanged.push(id);
      if (was.entry.withinTierOrder !== now.entry.withinTierOrder)
        orderChanged.push(id);
      if (was.entry.needPriority !== now.entry.needPriority) needChanged.push(id);
      if (was.entry.beliefIds.join() !== now.entry.beliefIds.join() || was.entry.noteClaimIds.join() !== now.entry.noteClaimIds.join() || was.entry.planIds.join() !== now.entry.planIds.join() || was.entry.roleProjection !== now.entry.roleProjection)
        basisChanged.push(id);
    }
    for (const id of before.keys()) if (!after.has(id)) removed.push(id);
    const sorted = (xs) => xs.sort(byText8);
    return {
      added: sorted(added),
      removed: sorted(removed),
      tierChanged: sorted(tierChanged),
      orderChanged: sorted(orderChanged),
      needChanged: sorted(needChanged),
      basisChanged: sorted(basisChanged)
    };
  };
  var routeCommitBoard = (ctx, c) => {
    var _a, _b, _c;
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be the proposal revision");
    if (c.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.termsType !== DRAFT_BOARD_TERMS_TYPE || proposal.category !== "acquisition")
      return bad(
        `only ${DRAFT_BOARD_TERMS_TYPE} acquisition proposals commit as boards`
      );
    if (!isPlainObject(c.rationale)) return bad("rationale must be an object");
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    const org = proposal.organizationId;
    if (!holdsRoleAt(world.people, org, by, world.simDate))
      return bad(`${by} holds no role in ${org}`);
    const parsed = parseDraftBoardTerms(world, org, by, proposal.terms);
    if (typeof parsed === "string") return bad(parsed);
    const previous = latestBoard(world, org, parsed.draftClassId);
    const named = (_a = c.supersedesBoardRevisionId) != null ? _a : null;
    if (previous === void 0) {
      if (named !== null)
        return bad("there is no earlier board revision to supersede");
    } else if (named !== previous.id) {
      return bad(
        `${org} already has a board for this class: revise ${previous.id} (revisions link, they never overwrite)`
      );
    }
    const minted = mintRecordIds(world, 1);
    const board = {
      id: minted.ids[0],
      organizationId: org,
      draftClassId: parsed.draftClassId,
      revision: ((_b = previous == null ? void 0 : previous.revision) != null ? _b : 0) + 1,
      tiers: parsed.tiers,
      createdAt: world.simDate,
      supersedesBoardRevisionId: (_c = previous == null ? void 0 : previous.id) != null ? _c : null,
      organizationProposalId: proposal.id,
      createdByPersonId: by
    };
    const change = describeBoardChange(previous != null ? previous : null, board);
    const entries = board.tiers.flatMap((t) => t.entries);
    const beliefIds = [...new Set(entries.flatMap((e) => e.beliefIds))].sort(
      byText8
    );
    const claimIds = [...new Set(entries.flatMap((e) => e.noteClaimIds))].sort(
      byText8
    );
    return commitAuthorizedDomainChange(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        draft: __spreadProps(__spreadValues({}, world.draft), {
          boards: [...world.draft.boards, board].sort(
            (a, b) => byText8(a.id, b.id)
          )
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      domainEvents: [
        spec("DraftBoardCommitted", {
          boardId: board.id,
          organizationId: org,
          draftClassId: board.draftClassId,
          revision: board.revision,
          supersedesBoardRevisionId: board.supersedesBoardRevisionId,
          prospects: entries.length,
          tiers: board.tiers.length,
          change: {
            added: [...change.added],
            removed: [...change.removed],
            tierChanged: [...change.tierChanged],
            orderChanged: [...change.orderChanged],
            needChanged: [...change.needChanged],
            basisChanged: [...change.basisChanged]
          }
        })
      ],
      requests: [
        {
          organizationId: org,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          expectedCategory: "acquisition",
          executedTerms: {
            termsType: DRAFT_BOARD_TERMS_TYPE,
            terms: proposal.terms
          },
          beliefIds,
          evidenceClaimIds: claimIds,
          rationale: c.rationale
        }
      ]
    });
  };
  var routeDraftBoardCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "CommitDraftBoardProposal":
        return routeCommitBoard(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable draft board command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/draftCommands.ts
  var DRAFT_SELECTION_TERMS_TYPE = "draft_selection_v1";
  var OPENERS = /* @__PURE__ */ new Set([
    "human_gm",
    "commissioner",
    "system",
    "test_harness"
  ]);
  var byText9 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var pickOrder = (a, b) => {
    var _a, _b;
    return a.round - b.round || ((_a = a.slot) != null ? _a : Number.MAX_SAFE_INTEGER) - ((_b = b.slot) != null ? _b : Number.MAX_SAFE_INTEGER) || byText9(a.id, b.id);
  };
  var sessionForClass = (world, draftClassId) => world.draft.sessions.find((s) => s.draftClassId === draftClassId);
  var replaceSession = (sessions, next) => sessions.map((s) => s.id === next.id ? next : s);
  var routeOpen = (ctx, c) => {
    if (!OPENERS.has(ctx.actor.kind))
      return denied(`${ctx.actor.kind} cannot open the draft`);
    const { world } = ctx;
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    if (!isValidId(c.draftClassId)) return bad("draftClassId must be a valid id");
    const klass = world.draft.classes.find((x) => x.id === c.draftClassId);
    if (klass === void 0) return bad("draftClassId does not name a class");
    if (sessionForClass(world, klass.id) !== void 0)
      return bad("this draft class already has a session");
    let draftDate;
    try {
      draftDate = transactionSeasonRules(tx2, klass.season).draftDate;
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
      throw e;
    }
    const today = world.simDate;
    if (today < draftDate)
      return bad(`the ${klass.season} draft opens on ${draftDate}`);
    const picks = world.draft.picks.filter((p) => p.season === klass.season && p.status === "available").sort(pickOrder);
    if (picks.length === 0)
      return bad("there are no unused picks for this draft");
    if (picks.some((p) => p.slot === null))
      return bad("the pick order is not set: every pick needs a slot");
    const minted = mintRecordIds(world, 1);
    const session = {
      id: minted.ids[0],
      draftClassId: klass.id,
      status: "open",
      orderedPickIds: picks.map((p) => p.id),
      currentIndex: 0,
      selectionIds: [],
      openedAt: today,
      completedAt: null
    };
    return {
      ok: true,
      authorizationDetail: `${ctx.actor.kind} may open the draft`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), {
          draft: __spreadProps(__spreadValues({}, world.draft), {
            sessions: [...world.draft.sessions, session].sort(
              (a, b) => byText9(a.id, b.id)
            )
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          spec("DraftOpened", {
            sessionId: session.id,
            draftClassId: klass.id,
            picks: session.orderedPickIds.length
          })
        ],
        detail: `the ${klass.season} draft is open with ${picks.length} picks`
      }
    };
  };
  var TERM_KEYS = "pickId,playerId,sessionId";
  var routeSelect = (ctx, c) => {
    var _a, _b;
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (typeof c.expectedRevision !== "number")
      return bad("expectedRevision must be the proposal revision");
    if (c.expectedRevision !== proposal.revision)
      return bad(
        `proposal revision is stale: expected ${c.expectedRevision}, latest is ${proposal.revision}`
      );
    if (proposal.termsType !== DRAFT_SELECTION_TERMS_TYPE || proposal.category !== "acquisition")
      return bad(
        `only ${DRAFT_SELECTION_TERMS_TYPE} acquisition proposals make selections`
      );
    if (!isPlainObject(c.rationale)) return bad("rationale must be an object");
    if (proposal.state !== "authorized")
      return bad(
        `proposal is ${proposal.state}; only an authorized proposal commits`
      );
    const org = proposal.organizationId;
    if (!holdsRoleAt(world.people, org, by, world.simDate))
      return bad(`${by} holds no role in ${org}`);
    const t = proposal.terms;
    if (!isPlainObject(t) || Object.keys(t).sort().join(",") !== TERM_KEYS || !isValidId(t.sessionId) || !isValidId(t.pickId) || !isValidId(t.playerId))
      return bad(`selection terms must be exactly {${TERM_KEYS}}`);
    const session = world.draft.sessions.find((s) => s.id === t.sessionId);
    if (session === void 0) return bad("the draft session does not exist");
    if (session.status !== "open")
      return bad(`the draft is ${session.status}; no selections can be made`);
    const onClock2 = session.orderedPickIds[session.currentIndex];
    if (onClock2 === void 0) return bad("the draft has no pick on the clock");
    if (t.pickId !== onClock2)
      return bad(
        `stale selection: ${String(t.pickId)} is not on the clock (${onClock2} is)`
      );
    const pick = world.draft.picks.find((p) => p.id === onClock2);
    if (pick === void 0) return bad("the pick on the clock does not exist");
    if (pick.status !== "available")
      return bad(`${pick.id} has already been used`);
    if (pick.ownerOrganizationId !== org)
      return bad(
        `${pick.id} is owned by ${pick.ownerOrganizationId}, not ${org}; only the current owner selects`
      );
    const klass = world.draft.classes.find((x) => x.id === session.draftClassId);
    if (klass === void 0) return bad("the draft class does not exist");
    const playerId = t.playerId;
    if (!klass.eligiblePlayerIds.includes(playerId) || !world.roster.players.some((p) => p.personId === playerId))
      return bad(`${playerId} is not eligible in this draft`);
    if (world.draft.selections.some((s) => s.playerId === playerId))
      return bad(`${playerId} has already been drafted`);
    if (activeRightsFor(world.roster, playerId, world.simDate).length > 0)
      return bad(`${playerId} is already under another right`);
    let board;
    let beliefIds = [];
    let claimIds = [];
    if (c.boardRevisionId !== void 0 && c.boardRevisionId !== null) {
      if (!isValidId(c.boardRevisionId))
        return bad("boardRevisionId must be a valid id");
      board = world.draft.boards.find((b) => b.id === c.boardRevisionId);
      if (board === void 0 || board.organizationId !== org)
        return bad("boardRevisionId is not one of this organization\u2019s boards");
      if (((_a = latestBoard(world, org, klass.id)) == null ? void 0 : _a.id) !== board.id)
        return bad("boardRevisionId is not the latest board revision");
      const entry = board.tiers.flatMap((x) => x.entries).find((e) => e.playerId === playerId);
      if (entry === void 0) return bad(`${playerId} is not on that board`);
      beliefIds = [...entry.beliefIds];
      claimIds = [...entry.noteClaimIds];
    }
    const minted = mintRecordIds(world, 2);
    const selection = {
      id: minted.ids[0],
      sessionId: session.id,
      pickId: pick.id,
      organizationId: org,
      playerId,
      organizationProposalId: proposal.id,
      selectedAt: world.simDate,
      boardRevisionId: (_b = board == null ? void 0 : board.id) != null ? _b : null
    };
    const right = {
      id: minted.ids[1],
      playerId,
      holderOrganizationId: org,
      kind: "draft",
      sourceRecordId: selection.id,
      effectiveFrom: world.simDate,
      effectiveUntil: null
    };
    const nextIndex = session.currentIndex + 1;
    const done = nextIndex >= session.orderedPickIds.length;
    const nextSession = __spreadProps(__spreadValues({}, session), {
      currentIndex: nextIndex,
      selectionIds: [...session.selectionIds, selection.id],
      status: done ? "complete" : "open",
      completedAt: done ? world.simDate : null
    });
    const events = [
      spec("DraftSelectionMade", {
        selectionId: selection.id,
        sessionId: session.id,
        pickId: pick.id,
        round: pick.round,
        slot: pick.slot,
        organizationId: org,
        playerId,
        boardRevisionId: selection.boardRevisionId
      }),
      ...done ? [
        spec("DraftCompleted", {
          sessionId: session.id,
          selections: nextSession.selectionIds.length
        })
      ] : []
    ];
    return commitAuthorizedDomainChange(ctx, {
      nextWorld: __spreadProps(__spreadValues({}, world), {
        roster: __spreadProps(__spreadValues({}, world.roster), {
          rights: [...world.roster.rights, right].sort(
            (a, b) => byText9(a.id, b.id)
          )
        }),
        draft: __spreadProps(__spreadValues({}, world.draft), {
          picks: world.draft.picks.map(
            (p) => p.id === pick.id ? __spreadProps(__spreadValues({}, p), { status: "used" }) : p
          ),
          sessions: replaceSession(world.draft.sessions, nextSession),
          selections: [...world.draft.selections, selection].sort(
            (a, b) => byText9(a.id, b.id)
          )
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      domainEvents: events,
      requests: [
        {
          organizationId: org,
          actorPersonId: by,
          proposalId: proposal.id,
          expectedRevision: proposal.revision,
          expectedCategory: "acquisition",
          executedTerms: {
            termsType: DRAFT_SELECTION_TERMS_TYPE,
            terms: proposal.terms
          },
          beliefIds: [...new Set(beliefIds)].sort(byText9),
          evidenceClaimIds: [...new Set(claimIds)].sort(byText9),
          rationale: c.rationale
        }
      ]
    });
  };
  var routeDraftCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "OpenDraft":
        return routeOpen(ctx, c);
      case "MakeDraftSelection":
        return routeSelect(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable draft command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/scoutingCommands.ts
  var byId5 = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var MAX_DIMENSIONS = 8;
  var mayScout = (world, org, person) => !holdsRoleAt(world.people, org, person, world.simDate) ? denied(`${person} holds no role in ${org}`) : effectiveRightsAt(
    world,
    org,
    person,
    "acquisition",
    world.simDate
  ).rights.includes("advise") ? null : denied(`${person} lacks advise on acquisition in ${org}`);
  var isScoutingBelief = (b, key) => b.assessmentType === SCOUTING_ASSESSMENT && isPlainObject(b.assessment) && b.assessment.questionKey === key;
  var latestScoutingBelief = (world, org, playerId, questionKey) => {
    const mine = world.information.beliefs.filter(
      (b) => b.organizationId === org && b.subject.kind === "entity" && b.subject.id === playerId && isScoutingBelief(b, questionKey)
    );
    const superseded = new Set(mine.map((b) => b.supersedesBeliefId));
    return mine.filter((b) => !superseded.has(b.id)).sort(byId5).at(-1);
  };
  var claimsAbout = (world, org, viewer, playerId) => world.information.claims.filter(
    (c) => c.subject.kind === "entity" && c.subject.id === playerId && isClaimVisibleTo(world, org, viewer, c)
  );
  var speaksTo = (c, dimensions) => isPlainObject(c.proposition) && dimensions.includes(
    String(c.proposition.dimension)
  ) && ["positive", "negative", "mixed"].includes(
    String(c.proposition.signal)
  );
  var SETTLED_READINGS = ["supports", "against"];
  var settled = (b) => (b.confidence === "medium" || b.confidence === "high" || b.confidence === "very_high") && isPlainObject(b.assessment) && SETTLED_READINGS.includes(
    String(b.assessment.reading)
  );
  var evidenceKey = (ids) => [...ids].sort().join("|");
  var parseContext = (world, org, playerId, v) => {
    if (!isPlainObject(v)) return bad("decisionContext must be an object");
    if (!SCOUTING_CONTEXT_KINDS.includes(v.kind))
      return bad(
        `decisionContext.kind must be one of ${SCOUTING_CONTEXT_KINDS.join(", ")}`
      );
    const kind = v.kind;
    const today = world.simDate;
    const rights2 = activeRightsFor(world.roster, playerId, today);
    switch (kind) {
      case "draft_selection": {
        if (!isValidId(v.pickId))
          return bad("a draft_selection names the pick it serves");
        const pick = world.draft.picks.find((p) => p.id === v.pickId);
        if (pick === void 0) return bad("pickId does not name a draft pick");
        if (pick.ownerOrganizationId !== org || pick.status !== "available")
          return bad("the pick is not an unused pick this organization owns");
        const inClass = world.draft.classes.some(
          (c) => c.season === pick.season && c.eligiblePlayerIds.includes(playerId)
        );
        if (!inClass)
          return bad(`${playerId} is not eligible in the ${pick.season} draft`);
        return { kind, pickId: pick.id };
      }
      case "free_agent_signing":
        if (rights2.length > 0)
          return bad(
            `${playerId} is not a free agent: he is under someone's rights`
          );
        if (isUndraftedProspect(world.draft, playerId))
          return bad(`${playerId} is a draft prospect, not a free agent`);
        return { kind, pickId: null };
      case "trade_target":
        if (rights2.length === 0 || rights2[0].holderOrganizationId === org)
          return bad(`${playerId} is not held by another organization`);
        return { kind, pickId: null };
      case "roster_decision":
        if (!holdsContractRight(world.roster, playerId, org, today))
          return bad(`${playerId} is not under ${org}'s contract`);
        return { kind, pickId: null };
    }
  };
  var questionOf = (world, id) => world.scouting.questions.find((q) => q.id === id);
  var routeAsk = (ctx, c) => {
    const { world } = ctx;
    const org = parseOrganization(ctx, c.organizationId);
    if (isFailure(org)) return org;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const noRight = mayScout(world, org, by);
    if (noRight !== null) return noRight;
    if (!isValidId(c.playerId) || !world.roster.players.some((p) => p.personId === c.playerId))
      return bad("playerId must name an existing player");
    const playerId = entityId(c.playerId);
    if (!nonEmptyText(c.questionKey, 64))
      return bad("questionKey must be 1-64 characters");
    if (!Array.isArray(c.dimensions) || c.dimensions.length === 0 || c.dimensions.length > MAX_DIMENSIONS || c.dimensions.some((d) => !nonEmptyText(d, 48)) || new Set(c.dimensions).size !== c.dimensions.length)
      return bad(`dimensions must list 1-${MAX_DIMENSIONS} distinct names`);
    const dimensions = [...c.dimensions].sort();
    const context = parseContext(world, org, playerId, c.decisionContext);
    if (isFailure(context)) return context;
    const open = world.scouting.questions.find(
      (q) => q.organizationId === org && q.playerId === playerId && q.questionKey === c.questionKey && q.status === "open"
    );
    if (open !== void 0)
      return bad(`question ${open.id} is already open for this player`);
    const latest = latestScoutingBelief(world, org, playerId, c.questionKey);
    if (latest !== void 0 && settled(latest)) {
      const known = new Set(latest.evidenceClaimIds);
      const fresh = claimsAbout(world, org, by, playerId).filter(
        (x) => speaksTo(x, dimensions) && !known.has(x.id)
      );
      if (fresh.length === 0)
        return bad(
          "this question is already answered with confidence and no new evidence has arrived; asking again would learn nothing"
        );
    }
    const minted = mintRecordIds(world, 1);
    const question = {
      id: minted.ids[0],
      organizationId: org,
      playerId,
      questionKey: c.questionKey,
      dimensions,
      decisionContext: context,
      createdByPersonId: by,
      createdAt: world.simDate,
      status: "open"
    };
    return {
      ok: true,
      authorizationDetail: `${by} holds advise on acquisition in ${org}`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), {
          scouting: __spreadProps(__spreadValues({}, world.scouting), {
            questions: [...world.scouting.questions, question].sort(byId5)
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          spec("ScoutingQuestionAsked", {
            questionId: question.id,
            organizationId: org,
            playerId,
            questionKey: question.questionKey,
            dimensions,
            decisionContext: {
              kind: context.kind,
              pickId: context.pickId
            },
            askedBy: by
          })
        ],
        detail: `${org} asks ${question.questionKey} about ${playerId}`
      }
    };
  };
  var routeAssign = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const question = questionOf(world, c.questionId);
    if (question === void 0) return bad("questionId does not name a question");
    const org = question.organizationId;
    const noRight = mayScout(world, org, by);
    if (noRight !== null) return noRight;
    if (!isValidId(c.evaluatorPersonId))
      return bad("evaluatorPersonId must be a valid id");
    const evaluator = entityId(c.evaluatorPersonId);
    if (!holdsRoleAt(world.people, org, evaluator, world.simDate))
      return bad(`${evaluator} holds no role in ${org}`);
    if (!Array.isArray(c.evidenceClaimIds) || c.evidenceClaimIds.length === 0 || c.evidenceClaimIds.some((i) => !isValidId(i)))
      return bad("evidenceClaimIds must list at least one claim id");
    const ids = [...new Set(c.evidenceClaimIds)].sort();
    const claims = [];
    for (const id of ids) {
      const claim = world.information.claims.find(
        (x) => x.id === id && isClaimVisibleTo(world, org, evaluator, x)
      );
      if (claim === void 0)
        return bad(`evidenceClaimIds: ${id} is not available to ${evaluator}`);
      if (claim.subject.kind !== "entity" || claim.subject.id !== question.playerId)
        return bad(`evidenceClaimIds: ${id} is not about ${question.playerId}`);
      claims.push(claim);
    }
    if (!claims.some((x) => speaksTo(x, question.dimensions)))
      return bad(
        `the evidence says nothing about ${question.dimensions.join(", ")}`
      );
    const key = evidenceKey(ids);
    const repeat = world.scouting.assignments.find(
      (a) => a.questionId === question.id && a.evaluatorPersonId === evaluator && evidenceKey(a.evidenceClaimIds) === key
    );
    if (repeat !== void 0)
      return bad(
        `${evaluator} already has this exact work (${repeat.id}): reading the same evidence again cannot change the answer`
      );
    const latest = latestScoutingBelief(
      world,
      org,
      question.playerId,
      question.questionKey
    );
    if (latest !== void 0 && settled(latest)) {
      const known = new Set(latest.evidenceClaimIds);
      if (ids.every((i) => known.has(i)))
        return bad(
          "the current answer already rests on all of this evidence; nothing new would be learned"
        );
    }
    let workDays = 1;
    if (c.workDays !== void 0) {
      if (!Number.isInteger(c.workDays) || c.workDays < 1 || c.workDays > 14)
        return bad("workDays must be an integer 1..14");
      workDays = c.workDays;
    }
    const minted = mintRecordIds(world, 1);
    const assignment = {
      id: minted.ids[0],
      questionId: question.id,
      organizationId: org,
      playerId: question.playerId,
      evaluatorPersonId: evaluator,
      evidenceClaimIds: ids,
      requestedAt: world.simDate,
      dueAt: SimDate.parse(world.simDate).addDays(workDays).toISO(),
      status: "assigned",
      resolvedReportId: null
    };
    return {
      ok: true,
      authorizationDetail: `${by} holds advise on acquisition in ${org}`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), {
          scouting: __spreadProps(__spreadValues({}, world.scouting), {
            assignments: [...world.scouting.assignments, assignment].sort(byId5)
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          spec("ScoutingEvaluationAssigned", {
            assignmentId: assignment.id,
            questionId: question.id,
            organizationId: org,
            evaluatorPersonId: evaluator,
            evidenceClaimIds: ids,
            dueAt: assignment.dueAt
          })
        ],
        detail: `${evaluator} is asked to read ${ids.length} claim(s)`
      }
    };
  };
  var routeResolve3 = (ctx, c) => {
    var _a;
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const assignment = world.scouting.assignments.find(
      (a) => a.id === c.assignmentId
    );
    if (assignment === void 0)
      return bad("assignmentId does not name an assignment");
    const org = assignment.organizationId;
    const noRight = mayScout(world, org, by);
    if (noRight !== null) return noRight;
    if (assignment.status !== "assigned")
      return bad(`assignment is already ${assignment.status}`);
    const today = world.simDate;
    if (today < assignment.dueAt)
      return bad(`the work is not due until ${assignment.dueAt}`);
    const question = questionOf(world, assignment.questionId);
    const claims = [];
    for (const id of assignment.evidenceClaimIds) {
      const claim = world.information.claims.find(
        (x) => x.id === id && isClaimVisibleTo(world, org, assignment.evaluatorPersonId, x)
      );
      if (claim === void 0)
        return bad(`evidence ${id} is no longer available to the evaluator`);
      claims.push(claim);
    }
    const profile = world.scouting.evaluatorProfiles.find(
      (p) => p.personId === assignment.evaluatorPersonId
    );
    const lens = profile != null ? profile : NEUTRAL_LENS;
    const result = interpretEvidence(question.dimensions, claims, lens);
    const minted = mintRecordIds(world, 2);
    const beliefId = minted.ids[0];
    const reportId = minted.ids[1];
    const prior = latestScoutingBelief(
      world,
      org,
      question.playerId,
      question.questionKey
    );
    const belief = {
      id: beliefId,
      organizationId: org,
      authorPersonId: assignment.evaluatorPersonId,
      subject: { kind: "entity", id: question.playerId },
      assessmentType: SCOUTING_ASSESSMENT,
      assessment: {
        questionId: question.id,
        questionKey: question.questionKey,
        reading: result.reading,
        dimensions: result.dimensions.map((d) => ({
          dimension: d.dimension,
          status: d.status,
          independentFamilies: d.independentFamilies,
          confidence: d.confidence
        })),
        unresolvedQuestionKeys: [...result.unresolvedQuestionKeys],
        independentFamilyCount: result.independentFamilyCount,
        strongDimensions: [...lens.strongDimensions],
        weakDimensions: [...lens.weakDimensions],
        riskTolerance: lens.riskTolerance
      },
      confidence: result.confidence,
      evidenceClaimIds: [...assignment.evidenceClaimIds],
      formedAt: today,
      supersedesBeliefId: (_a = prior == null ? void 0 : prior.id) != null ? _a : null
    };
    const report = {
      id: reportId,
      assignmentId: assignment.id,
      organizationId: org,
      playerId: question.playerId,
      evaluatorPersonId: assignment.evaluatorPersonId,
      questionId: question.id,
      evidenceClaimIds: assignment.evidenceClaimIds,
      beliefId,
      unresolvedQuestionKeys: result.unresolvedQuestionKeys,
      formedAt: today
    };
    return {
      ok: true,
      authorizationDetail: `${by} holds advise on acquisition in ${org}`,
      resolution: {
        nextWorld: __spreadProps(__spreadValues({}, world), {
          information: __spreadProps(__spreadValues({}, world.information), {
            beliefs: [...world.information.beliefs, belief].sort(byId5)
          }),
          scouting: __spreadProps(__spreadValues({}, world.scouting), {
            assignments: world.scouting.assignments.map(
              (a) => a.id === assignment.id ? __spreadProps(__spreadValues({}, a), {
                status: "resolved",
                resolvedReportId: reportId
              }) : a
            ),
            questions: world.scouting.questions.map(
              (q) => q.id === question.id ? __spreadProps(__spreadValues({}, q), { status: "answered" }) : q
            ),
            reports: [...world.scouting.reports, report].sort(byId5)
          }),
          nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
        }),
        eventSpecs: [
          spec("ScoutingReportFiled", {
            reportId,
            assignmentId: assignment.id,
            questionId: question.id,
            organizationId: org,
            playerId: question.playerId,
            evaluatorPersonId: assignment.evaluatorPersonId,
            beliefId,
            reading: result.reading,
            confidence: result.confidence,
            unresolvedQuestionKeys: [...result.unresolvedQuestionKeys]
          })
        ],
        detail: `${assignment.evaluatorPersonId} files a ${result.reading} read`
      }
    };
  };
  var routeScoutingCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "AskScoutingQuestion":
        return routeAsk(ctx, c);
      case "AssignScoutingEvaluation":
        return routeAssign(ctx, c);
      case "ResolveScoutingAssignment":
        return routeResolve3(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable scouting command: ${String(unreachable)}`);
      }
    }
  };

  // packages/sim-core/src/acquisitionView.ts
  var ACQUISITION_TIER_ASSESSMENT = "acquisition_tier";
  var ACQUISITION_TIERS = [
    "priority",
    "target",
    "depth",
    "avoid"
  ];
  var COMPETITIVE_WINDOW_KEY = "competitive_window";
  var COMPETITIVE_WINDOWS = ["contend", "rebuild"];
  var byText10 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var pickFact = (p) => ({
    pickId: p.id,
    season: p.season,
    round: p.round,
    slot: p.slot,
    originalOrganizationId: p.originalOrganizationId,
    ownerOrganizationId: p.ownerOrganizationId,
    status: p.status
  });
  var buildAcquisitionDecisionView = (world, organizationId, actorPersonId, tx2) => {
    const today = world.simDate;
    if (!holdsRoleAt(world.people, organizationId, actorPersonId, today))
      return {
        ok: false,
        reason: `${actorPersonId} holds no role in ${organizationId}`
      };
    const season = seasonOfDate(today);
    const players = world.roster.players.map((p) => {
      var _a, _b, _c, _d, _e;
      const rights2 = activeRightsFor(world.roster, p.personId, today);
      const membership = currentRosterMembership(
        world.roster,
        p.personId,
        today
      );
      return {
        playerId: p.personId,
        primaryRole: p.primaryRole,
        birthDate: p.birthDate,
        holderOrganizationId: (_d = (_c = (_a = rights2.find((r) => r.kind === "contract")) == null ? void 0 : _a.holderOrganizationId) != null ? _c : (_b = rights2[0]) == null ? void 0 : _b.holderOrganizationId) != null ? _d : null,
        rosterStatus: (_e = membership == null ? void 0 : membership.status) != null ? _e : null
      };
    }).sort((a, b) => byText10(a.playerId, b.playerId));
    const contracts = world.contracts.agreements.filter((a) => a.status === "active").map((a) => ({
      playerId: a.playerId,
      organizationId: a.organizationId,
      agreementId: a.id,
      finalSeason: a.terms.years[a.terms.years.length - 1].season,
      capChargeBySeason: a.terms.years.filter((y) => y.season >= season).map((y) => ({
        season: y.season,
        amount: agreementCapCharge(tx2.contracts, a, y.season)
      })),
      receiverChargeBySeason: tradeImpact(tx2.contracts, a.terms, season).receiverCapBySeason,
      retainedDeadCapBySeason: tradeImpact(tx2.contracts, a.terms, season).senderDeadCapBySeason
    })).sort((a, b) => byText10(a.agreementId, b.agreementId));
    const capBySeason = [];
    for (let s = season; s < season + 4; s += 1) {
      try {
        capBySeason.push(capPosition(tx2, world.contracts, organizationId, s));
      } catch (e) {
        if (!(e instanceof UnknownTransactionSeasonError)) throw e;
      }
    }
    const picks = world.draft.picks.map(pickFact).sort((a, b) => byText10(a.pickId, b.pickId));
    const mine = (id) => id === organizationId;
    const offers = world.market.tradeOffers.filter(
      (o) => mine(o.proposerOrganizationId) || mine(o.counterpartyOrganizationId)
    ).sort((a, b) => byText10(a.id, b.id) || a.revision - b.revision);
    const ownInquiryIds = new Set(
      world.market.inquiries.filter((i) => mine(i.askingOrganizationId)).map((i) => i.id)
    );
    const responses = world.market.responses;
    return {
      ok: true,
      view: {
        organizationId,
        actorPersonId,
        asOf: today,
        authority: {
          acquisition: [
            ...effectiveRightsAt(
              world,
              organizationId,
              actorPersonId,
              "acquisition",
              today
            ).rights
          ],
          roster: [
            ...effectiveRightsAt(
              world,
              organizationId,
              actorPersonId,
              "roster",
              today
            ).rights
          ]
        },
        own: {
          roster: players.filter(
            (p) => p.holderOrganizationId === organizationId
          ),
          capBySeason,
          capacity: rosterCapacity(world.roster, tx2, organizationId, today),
          picks: picks.filter((p) => p.ownerOrganizationId === organizationId),
          reserved: {
            capBySeason: capBySeason.map((c) => ({
              season: c.season,
              amount: reservedCap(
                world.market,
                organizationId,
                c.season
              )
            })),
            slots: {
              active: reservedSlots(world.market, organizationId, "active"),
              reserve: reservedSlots(world.market, organizationId, "reserve"),
              practice_squad: reservedSlots(
                world.market,
                organizationId,
                "practice_squad"
              )
            }
          },
          reservationIds: world.market.reservations.filter(
            (r) => r.organizationId === organizationId && r.status === "active"
          ).map((r) => r.id).sort(byText10)
        },
        plans: world.plans.plans.filter(
          (p) => p.organizationId === organizationId && p.status === "active"
        ).map((p) => {
          const rev = p.revisions.find(
            (r) => r.revision === p.currentRevision
          );
          return {
            planId: p.id,
            kind: p.kind,
            scopeKey: p.scopeKey,
            objectives: rev.objectives,
            constraints: rev.constraints
          };
        }).sort((a, b) => byText10(a.planId, b.planId)),
        knowledge: buildOrganizationKnowledgeView(
          world,
          organizationId,
          actorPersonId
        ),
        market: {
          inquiries: world.market.inquiries.filter(
            (i) => mine(i.askingOrganizationId)
          ),
          receivedInquiries: world.market.inquiries.filter(
            (i) => mine(i.contactedOrganizationId)
          ),
          inquiryResponses: responses.filter(
            (r) => r.kind === "inquiry_response" && ownInquiryIds.has(r.inquiryId)
          ).map((r) => __spreadProps(__spreadValues({}, r), { basisHash: "" })),
          offers,
          offerResponses: responses.filter(
            (r) => r.kind === "trade_response" && offers.some((o) => o.id === r.offerId)
          ).map(
            (r) => r.respondingOrganizationId === organizationId ? r : __spreadProps(__spreadValues({}, r), { reasons: [], uncertainties: [], basisHash: "" })
          )
        },
        publicContext: { players, contracts, picks },
        candidateIds: {
          playerIds: players.filter(
            (p) => p.holderOrganizationId !== null && p.holderOrganizationId !== organizationId
          ).map((p) => p.playerId),
          pickIds: picks.filter(
            (p) => p.ownerOrganizationId !== organizationId && p.status === "available"
          ).map((p) => p.pickId)
        }
      }
    };
  };

  // packages/sim-core/src/assets.ts
  var assetKey = (a) => a.kind === "player_rights" ? `player_rights:${a.playerId}:${a.rightsId}` : `draft_pick:${a.pickId}`;
  var rightOf = (world, a, date) => activeRightsFor(world.roster, a.playerId, date).find(
    (r) => r.id === a.rightsId
  );
  var assetOwner = (world, asset, date) => {
    var _a, _b;
    if (asset.kind === "player_rights")
      return (_a = rightOf(world, asset, date)) == null ? void 0 : _a.holderOrganizationId;
    return (_b = world.draft.picks.find((p) => p.id === asset.pickId)) == null ? void 0 : _b.ownerOrganizationId;
  };
  var tradePackageProblems = (world, tx2, pkg2, date) => {
    const out = [];
    const add2 = (code, message, asset) => out.push({ code, message, asset: asset != null ? asset : null });
    if (pkg2.organizationAId === pkg2.organizationBId)
      add2("SELF_TRADE", "an organization cannot trade with itself");
    if (pkg2.assetsFromA.length + pkg2.assetsFromB.length === 0)
      add2("EMPTY_PACKAGE", "a trade must move at least one asset");
    const horizon = seasonOfDate(date) + tx2.market.futurePickTradeHorizonSeasons;
    const seen = /* @__PURE__ */ new Set();
    const check = (assets, from) => {
      for (const a of assets) {
        const key = assetKey(a);
        const identity = a.kind === "player_rights" ? `rights:${a.rightsId}` : key;
        if (seen.has(identity)) {
          add2("DUPLICATE_ASSET", `${key} appears more than once`, key);
          continue;
        }
        seen.add(identity);
        if (a.kind === "draft_pick") {
          const pick = world.draft.picks.find((p) => p.id === a.pickId);
          if (pick === void 0) {
            add2("UNKNOWN_ASSET", `${key} is not a draft pick`, key);
            continue;
          }
          if (pick.status === "used")
            add2("USED_PICK", `${key} has already been used`, key);
          if (pick.season > horizon)
            add2(
              "PICK_BEYOND_HORIZON",
              `${key} is for ${pick.season}; only picks through ${horizon} may be traded`,
              key
            );
          if (pick.ownerOrganizationId !== from)
            add2("WRONG_OWNER", `${key} is not owned by ${from}`, key);
          continue;
        }
        const right = world.roster.rights.find((r) => r.id === a.rightsId);
        if (right === void 0 || right.playerId !== a.playerId) {
          add2("UNKNOWN_ASSET", `${key} is not a rights record`, key);
          continue;
        }
        if (assetOwner(world, a, date) !== from)
          add2("WRONG_OWNER", `${key} is not currently held by ${from}`, key);
        if (world.roster.waivers.some(
          (w) => w.playerId === a.playerId && w.status === "open"
        ))
          add2("PLAYER_ON_WAIVERS", `${a.playerId} is on waivers`, key);
      }
    };
    check(pkg2.assetsFromA, pkg2.organizationAId);
    check(pkg2.assetsFromB, pkg2.organizationBId);
    return out;
  };
  var successorTerms = (tx2, terms, tradeSeason) => {
    var _a, _b;
    if (!tx2.contracts.signingBonusStaysWithOriginalClubOnTrade) return terms;
    const years = terms.years.filter((y) => y.season >= tradeSeason);
    return {
      startSeason: (_b = (_a = years[0]) == null ? void 0 : _a.season) != null ? _b : terms.startSeason,
      years,
      signingBonus: 0
    };
  };
  var byId6 = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  var applyTradePackage = (world, tx2, pkg2, date) => {
    const moves = [
      ...pkg2.assetsFromA.map((asset) => ({
        asset,
        from: pkg2.organizationAId,
        to: pkg2.organizationBId
      })),
      ...pkg2.assetsFromB.map((asset) => ({
        asset,
        from: pkg2.organizationBId,
        to: pkg2.organizationAId
      }))
    ];
    const tradeSeason = seasonOfDate(date);
    const rightMoves = moves.filter(
      (m) => m.asset.kind === "player_rights"
    );
    const pickIds = new Map(
      moves.filter((m) => m.asset.kind === "draft_pick").map((m) => [m.asset.pickId, m.to])
    );
    let rights2 = [...world.roster.rights];
    let memberships = [...world.roster.memberships];
    let agreements = [...world.contracts.agreements];
    const terminations = [...world.contracts.terminations];
    const perMove = rightMoves.map((m) => {
      const right = rightOf(world, m.asset, date);
      const agreement = right.kind === "contract" ? agreements.find(
        (a) => a.id === right.sourceRecordId && a.status === "active"
      ) : void 0;
      const membership = currentRosterMembership(
        world.roster,
        m.asset.playerId,
        date
      );
      return { m, right, agreement, membership };
    });
    const needed = perMove.reduce(
      (n, x) => n + 1 + (x.agreement !== void 0 ? 1 : 0) + (x.membership !== void 0 ? 1 : 0) + (x.agreement !== void 0 && tradeImpact(tx2.contracts, x.agreement.terms, tradeSeason).senderDeadCapBySeason.length > 0 ? 1 : 0),
      0
    );
    const minted = mintRecordIds(world, needed);
    let cursor = 0;
    const next = () => minted.ids[cursor++];
    for (const { m, right, agreement, membership } of perMove) {
      const newAgreementId = agreement !== void 0 ? next() : void 0;
      const newRightId = next();
      rights2 = rights2.map(
        (r) => r.id === right.id ? __spreadProps(__spreadValues({}, r), { effectiveUntil: dayBefore(date) }) : r
      );
      rights2.push({
        id: newRightId,
        playerId: right.playerId,
        holderOrganizationId: m.to,
        kind: right.kind,
        sourceRecordId: newAgreementId != null ? newAgreementId : right.sourceRecordId,
        effectiveFrom: date,
        effectiveUntil: null
      });
      if (agreement !== void 0 && newAgreementId !== void 0) {
        const successor = {
          id: newAgreementId,
          playerId: agreement.playerId,
          organizationId: m.to,
          terms: successorTerms(tx2, agreement.terms, tradeSeason),
          signedAt: agreement.signedAt,
          sourceOfferId: null,
          sourceProposalId: null,
          supersedesAgreementId: agreement.id,
          status: "active"
        };
        agreements = agreements.map(
          (a) => a.id === agreement.id ? __spreadProps(__spreadValues({}, a), { status: "superseded" }) : a
        );
        agreements.push(successor);
        const impact = tradeImpact(tx2.contracts, agreement.terms, tradeSeason);
        if (impact.senderDeadCapBySeason.length > 0)
          terminations.push({
            id: next(),
            agreementId: agreement.id,
            organizationId: m.from,
            playerId: agreement.playerId,
            terminatedAt: date,
            reason: "trade_retained_bonus",
            deadCapBySeason: impact.senderDeadCapBySeason,
            guaranteedCashDue: 0
          });
      }
      if (membership !== void 0) {
        const moved = {
          id: next(),
          playerId: membership.playerId,
          organizationId: m.to,
          status: membership.status,
          effectiveFrom: date,
          effectiveUntil: null,
          sourceRecordId: newAgreementId != null ? newAgreementId : newRightId
        };
        memberships = [
          ...memberships.map(
            (x) => x.id === membership.id ? __spreadProps(__spreadValues({}, x), { effectiveUntil: dayBefore(date) }) : x
          ),
          moved
        ];
      }
    }
    return __spreadProps(__spreadValues({}, world), {
      roster: __spreadProps(__spreadValues({}, world.roster), {
        rights: rights2.sort(byId6),
        memberships: memberships.sort(byId6)
      }),
      contracts: __spreadProps(__spreadValues({}, world.contracts), {
        agreements: agreements.sort(byId6),
        terminations: terminations.sort(byId6)
      }),
      draft: __spreadProps(__spreadValues({}, world.draft), {
        picks: world.draft.picks.map(
          (p) => pickIds.has(p.id) ? __spreadProps(__spreadValues({}, p), { ownerOrganizationId: pickIds.get(p.id) }) : p
        )
      }),
      nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
    });
  };

  // packages/sim-core/src/acquisitionImpact.ts
  var incomingCharges = (world, tx2, asset, date, receiving) => {
    var _a;
    if (asset.kind !== "player_rights") return { charges: [], status: null };
    const right = world.roster.rights.find((r) => r.id === asset.rightsId);
    const agreement = (right == null ? void 0 : right.kind) === "contract" ? world.contracts.agreements.find(
      (a) => a.id === right.sourceRecordId && a.status === "active"
    ) : void 0;
    const membership = currentRosterMembership(
      world.roster,
      asset.playerId,
      date
    );
    const status = (_a = membership == null ? void 0 : membership.status) != null ? _a : null;
    if (agreement === void 0) return { charges: [], status };
    const season = seasonOfDate(date);
    const impact = tradeImpact(tx2.contracts, agreement.terms, season);
    if (receiving) return { charges: [...impact.receiverCapBySeason], status };
    const shed = agreement.terms.years.map((y) => y.season).filter((s) => s >= season).map((s) => ({
      season: s,
      amount: agreementCapCharge(tx2.contracts, agreement, s)
    }));
    const kept = impact.senderDeadCapBySeason;
    const seasons = [
      .../* @__PURE__ */ new Set([...shed.map((x) => x.season), ...kept.map((x) => x.season)])
    ];
    return {
      charges: seasons.map((s) => {
        var _a2, _b, _c, _d;
        return {
          season: s,
          amount: ((_b = (_a2 = kept.find((k) => k.season === s)) == null ? void 0 : _a2.amount) != null ? _b : 0) - ((_d = (_c = shed.find((x) => x.season === s)) == null ? void 0 : _c.amount) != null ? _d : 0)
        };
      }),
      status
    };
  };
  var previewAcquisitionImpact = (world, tx2, pkg2, date, organizationId) => {
    const gaining = organizationId === pkg2.organizationBId;
    const incoming = gaining ? pkg2.assetsFromA : pkg2.assetsFromB;
    const outgoing = gaining ? pkg2.assetsFromB : pkg2.assetsFromA;
    const delta = /* @__PURE__ */ new Map();
    const bump = (season, by) => {
      var _a;
      return delta.set(season, ((_a = delta.get(season)) != null ? _a : 0) + by);
    };
    const slots = { active: 0, reserve: 0, practice_squad: 0 };
    for (const a of incoming) {
      const x = incomingCharges(world, tx2, a, date, true);
      for (const c of x.charges) bump(c.season, c.amount);
      if (x.status !== null) slots[x.status] += 1;
    }
    for (const a of outgoing) {
      const x = incomingCharges(world, tx2, a, date, false);
      for (const c of x.charges) bump(c.season, c.amount);
      if (x.status !== null) slots[x.status] -= 1;
    }
    const before = rosterCapacity(world.roster, tx2, organizationId, date);
    const pickIds = (assets) => assets.filter(
      (a) => a.kind === "draft_pick"
    ).map((a) => a.pickId).sort();
    return {
      organizationId,
      capDeltaBySeason: [...delta.entries()].filter(([, d]) => d !== 0).sort(([a], [b]) => a - b).map(([season, d]) => ({ season, delta: d })),
      activeSlotsBefore: before.active.count,
      activeSlotsAfter: before.active.count + slots.active,
      reserveSlotsBefore: before.reserve.count,
      reserveSlotsAfter: before.reserve.count + slots.reserve,
      practiceSquadSlotsBefore: before.practice_squad.count,
      practiceSquadSlotsAfter: before.practice_squad.count + slots.practice_squad,
      incomingAssets: incoming.map(assetKey).sort(),
      outgoingAssets: outgoing.map(assetKey).sort(),
      draftPickIdsGained: pickIds(incoming),
      draftPickIdsLost: pickIds(outgoing),
      reservationIdsAffected: world.market.reservations.filter(
        (r) => r.organizationId === organizationId && r.status === "active"
      ).map((r) => r.id).sort()
    };
  };
  var tradeCapacityProblems = (world, tx2, pkg2, date) => {
    const out = [];
    for (const org of [pkg2.organizationAId, pkg2.organizationBId]) {
      const p = previewAcquisitionImpact(world, tx2, pkg2, date, org);
      try {
        for (const d of p.capDeltaBySeason) {
          if (d.delta <= 0) continue;
          const pos = capPosition(tx2, world.contracts, org, d.season);
          const held = reservedCap(world.market, org, d.season);
          if (pos.committed + held + d.delta > pos.cap)
            out.push({
              organizationId: org,
              message: `cap: season ${d.season} would exceed ${pos.cap} (committed ${pos.committed}, reserved ${held}, incoming ${d.delta})`
            });
        }
        const cap = rosterCapacity(world.roster, tx2, org, date);
        const after = {
          active: p.activeSlotsAfter,
          reserve: p.reserveSlotsAfter,
          practice_squad: p.practiceSquadSlotsAfter
        };
        for (const s of ["active", "reserve", "practice_squad"]) {
          const grew = after[s] > cap[s].count;
          const held = grew ? reservedSlots(world.market, org, s) : 0;
          if (grew && after[s] + held > cap[s].limit)
            out.push({
              organizationId: org,
              message: `roster capacity: ${s} would hold ${after[s]} plus ${held} reserved of ${cap[s].limit}`
            });
        }
      } catch (e) {
        if (e instanceof UnknownTransactionSeasonError)
          out.push({ organizationId: org, message: e.message });
        else throw e;
      }
    }
    return out;
  };

  // packages/sim-core/src/tradeReasoning.ts
  var ageOn = (birthDate, date) => {
    const b = SimDate.parse(birthDate).toISO();
    const d = SimDate.parse(date).toISO();
    let age = Number(d.slice(0, 4)) - Number(b.slice(0, 4));
    if (d.slice(5) < b.slice(5)) age -= 1;
    return age;
  };
  var AGING_FROM = 29;
  var PREMIUM_ROUND_MAX = 2;
  var competitiveWindowOf = (view) => {
    for (const plan of view.plans) {
      if (plan.kind !== "strategy") continue;
      for (const o of plan.objectives)
        if (o.key === COMPETITIVE_WINDOW_KEY && typeof o.target === "string" && COMPETITIVE_WINDOWS.includes(o.target))
          return o.target;
    }
    return null;
  };
  var ownTierFor = (view, playerId) => {
    const latest = view.knowledge.beliefs.find(
      (b) => b.assessmentType === ACQUISITION_TIER_ASSESSMENT && b.subject.id === playerId && b.supersededByBeliefId === null
    );
    const tier = latest !== void 0 && typeof latest.assessment === "object" && latest.assessment !== null && !Array.isArray(latest.assessment) ? latest.assessment.tier : void 0;
    return ACQUISITION_TIERS.includes(tier) ? tier : null;
  };
  var playerFact = (view, id) => view.publicContext.players.find((p) => p.playerId === id);
  var contractFact = (view, id) => view.publicContext.contracts.find((c) => c.playerId === id);
  var pickFact2 = (view, id) => view.publicContext.picks.find((p) => p.pickId === id);
  var sumAt = (xs, s) => {
    var _a, _b;
    return (_b = (_a = xs.find((x) => x.season === s)) == null ? void 0 : _a.amount) != null ? _b : 0;
  };
  var feasibilityReasons = (view, incoming, outgoing) => {
    var _a, _b, _c, _d, _e, _f;
    const out = [];
    const delta = /* @__PURE__ */ new Map();
    const bump = (s, n) => {
      var _a2;
      return delta.set(s, ((_a2 = delta.get(s)) != null ? _a2 : 0) + n);
    };
    const slots = {
      active: 0,
      reserve: 0,
      practice_squad: 0
    };
    for (const a of incoming) {
      if (a.kind !== "player_rights") continue;
      const c = contractFact(view, a.playerId);
      for (const x of (_a = c == null ? void 0 : c.receiverChargeBySeason) != null ? _a : []) bump(x.season, x.amount);
      const st = (_b = playerFact(view, a.playerId)) == null ? void 0 : _b.rosterStatus;
      if (st) slots[st] += 1;
    }
    for (const a of outgoing) {
      if (a.kind !== "player_rights") continue;
      const c = contractFact(view, a.playerId);
      for (const x of (_c = c == null ? void 0 : c.capChargeBySeason) != null ? _c : [])
        bump(
          x.season,
          -(x.amount - sumAt((_d = c == null ? void 0 : c.retainedDeadCapBySeason) != null ? _d : [], x.season))
        );
      const st = (_e = playerFact(view, a.playerId)) == null ? void 0 : _e.rosterStatus;
      if (st) slots[st] -= 1;
    }
    for (const pos of view.own.capBySeason) {
      const d = (_f = delta.get(pos.season)) != null ? _f : 0;
      const held = sumAt(view.own.reserved.capBySeason, pos.season);
      if (d > 0 && pos.committed + held + d > pos.cap)
        out.push({
          code: "CAP_INFEASIBLE",
          source: "own_cap",
          detail: `season ${pos.season}: committed ${pos.committed} plus ${held} held plus ${d} incoming exceeds ${pos.cap}`
        });
    }
    for (const s of ["active", "reserve", "practice_squad"]) {
      const cap = view.own.capacity[s];
      const held = view.own.reserved.slots[s];
      if (slots[s] > 0 && cap.count + held + slots[s] > cap.limit)
        out.push({
          code: "ROSTER_INFEASIBLE",
          source: "own_roster",
          detail: `${s} list would hold ${cap.count + held + slots[s]} of ${cap.limit}`
        });
    }
    return out;
  };
  var isPremium = (p) => p !== void 0 && p.round <= PREMIUM_ROUND_MAX;
  var evaluateTradeForOrganization = (view, pkg2) => {
    const me = view.organizationId;
    const isA = me === pkg2.organizationAId;
    const isB = me === pkg2.organizationBId;
    if (!isA && !isB)
      return {
        disposition: "reject",
        reasons: [
          {
            code: "NOT_A_PARTY",
            source: "public",
            detail: `${me} is not a party to this package`
          }
        ],
        uncertainties: []
      };
    const incoming = isA ? pkg2.assetsFromB : pkg2.assetsFromA;
    const outgoing = isA ? pkg2.assetsFromA : pkg2.assetsFromB;
    const window2 = competitiveWindowOf(view);
    const reasons = [];
    const uncertainties = [];
    const favorable = [];
    const unfavorable = [];
    const hard = feasibilityReasons(view, incoming, outgoing);
    for (const plan of view.plans)
      for (const c of plan.constraints)
        if (c.kind === "hard" && c.key === "keep_player" && outgoing.some(
          (a) => a.kind === "player_rights" && a.playerId === c.value
        ))
          hard.push({
            code: "PLAN_HARD_CONSTRAINT",
            source: "own_plan",
            detail: `plan ${plan.planId} requires keeping ${String(c.value)}`
          });
    if (hard.length > 0)
      return { disposition: "reject", reasons: hard, uncertainties };
    for (const a of outgoing) {
      if (a.kind !== "player_rights") continue;
      const tier = ownTierFor(view, a.playerId);
      const fact = playerFact(view, a.playerId);
      if (tier === "priority" || tier === "target")
        unfavorable.push({
          code: "KEEP_CORE_PLAYER",
          source: "own_belief",
          detail: `our own evaluation lists ${a.playerId} as ${tier}`
        });
      else if (tier === "avoid")
        favorable.push({
          code: "GLAD_TO_MOVE",
          source: "own_belief",
          detail: `our own evaluation lists ${a.playerId} as avoid`
        });
      if (fact !== void 0 && window2 === "rebuild" && ageOn(fact.birthDate, view.asOf) >= AGING_FROM)
        favorable.push({
          code: "MOVES_AGING_PLAYER",
          source: "own_plan",
          detail: `a rebuilding plan; ${a.playerId} is ${ageOn(fact.birthDate, view.asOf)}`
        });
      if (window2 === "contend" && (fact == null ? void 0 : fact.rosterStatus) === "active") {
        const replaced = incoming.some(
          (i) => {
            var _a, _b;
            return i.kind === "player_rights" && ((_a = playerFact(view, i.playerId)) == null ? void 0 : _a.primaryRole) === fact.primaryRole && ((_b = playerFact(view, i.playerId)) == null ? void 0 : _b.rosterStatus) === "active";
          }
        );
        if (!replaced)
          unfavorable.push({
            code: "WEAKENS_CURRENT_ROSTER",
            source: "own_plan",
            detail: `a contending plan; ${a.playerId} is an active ${fact.primaryRole} with no active replacement coming back`
          });
      }
    }
    for (const a of incoming) {
      if (a.kind !== "player_rights") continue;
      const tier = ownTierFor(view, a.playerId);
      const fact = playerFact(view, a.playerId);
      if (tier === null) {
        uncertainties.push(`NO_EVALUATION:${a.playerId}`);
        continue;
      }
      if (tier === "avoid")
        unfavorable.push({
          code: "UNWANTED_PLAYER",
          source: "own_belief",
          detail: `our own evaluation lists ${a.playerId} as avoid`
        });
      else if (tier === "priority" || tier === "target")
        favorable.push({
          code: "WANTED_PLAYER",
          source: "own_belief",
          detail: `our own evaluation lists ${a.playerId} as ${tier}`
        });
      if (fact !== void 0 && window2 === "rebuild" && ageOn(fact.birthDate, view.asOf) >= AGING_FROM)
        unfavorable.push({
          code: "AGING_ACQUISITION",
          source: "own_plan",
          detail: `a rebuilding plan; ${a.playerId} is ${ageOn(fact.birthDate, view.asOf)}`
        });
    }
    if (window2 === "rebuild") {
      const premiumIn = incoming.filter(
        (a) => a.kind === "draft_pick" && isPremium(pickFact2(view, a.pickId))
      ).length;
      const premiumOut = outgoing.filter(
        (a) => a.kind === "draft_pick" && isPremium(pickFact2(view, a.pickId))
      ).length;
      if (premiumIn > premiumOut)
        favorable.push({
          code: "ADDS_PREMIUM_CAPITAL",
          source: "own_picks",
          detail: `a rebuilding plan; ${premiumIn} premium picks in, ${premiumOut} out`
        });
      else if (premiumOut > premiumIn)
        unfavorable.push({
          code: "SPENDS_PREMIUM_CAPITAL",
          source: "own_picks",
          detail: `a rebuilding plan; ${premiumOut} premium picks out, ${premiumIn} in`
        });
    }
    if (window2 === null)
      uncertainties.push(
        "NO_COMPETITIVE_WINDOW: no strategy plan states a posture"
      );
    reasons.push(...unfavorable, ...favorable);
    const blocking = uncertainties.filter((u) => u.startsWith("NO_EVALUATION:"));
    let disposition;
    if (unfavorable.length === 0 && favorable.length > 0) disposition = "accept";
    else if (unfavorable.length > 0 && favorable.length > 0)
      disposition = "counter";
    else if (unfavorable.length > 0) disposition = "reject";
    else if (blocking.length > 0) disposition = "defer";
    else {
      disposition = "reject";
      reasons.push({
        code: "NOTHING_FOR_PLAN",
        source: "own_plan",
        detail: "the package advances none of our own stated aims"
      });
    }
    return { disposition, reasons, uncertainties };
  };
  var inquiryBandFor = (view, asset, direction) => {
    const window2 = competitiveWindowOf(view);
    if (asset.kind === "player_rights") {
      const tier = ownTierFor(view, asset.playerId);
      if (direction === "shop") {
        if (tier === "priority") return "priority";
        if (tier === "target") return "interested";
        if (tier === "depth") return "open";
        return "none";
      }
      if (tier === "priority" || tier === "target") return "none";
      if (tier === "avoid") return "interested";
      if (tier === "depth") return "open";
      return "none";
    }
    const pick = pickFact2(view, asset.pickId);
    if (direction === "shop")
      return window2 === "rebuild" && isPremium(pick) ? "interested" : window2 === null ? "none" : "open";
    return window2 === "contend" ? "open" : window2 === "rebuild" && !isPremium(pick) ? "open" : "none";
  };
  var responseBasisHash = (view, subject) => {
    const _a = view, { asOf: _asOf, market: _market } = _a, rest = __objRest(_a, ["asOf", "market"]);
    void _asOf;
    void _market;
    const subjectKey = "kind" in subject ? assetKey(subject) : hashCanonical(subject);
    return hashCanonical({
      view: __spreadProps(__spreadValues({}, rest), { knowledge: __spreadProps(__spreadValues({}, rest.knowledge), { asOf: "" }) }),
      subject: subjectKey,
      window: competitiveWindowOf(view)
    });
  };

  // packages/sim-core/src/tradeCommands.ts
  var TRADE_TERMS_TYPE = "trade_package_v1";
  var assetTerms = (a) => a.kind === "player_rights" ? { kind: a.kind, playerId: a.playerId, rightsId: a.rightsId } : { kind: a.kind, pickId: a.pickId };
  var sortedAssets = (xs) => [...xs].sort(
    (a, b) => assetKey(a) < assetKey(b) ? -1 : assetKey(a) > assetKey(b) ? 1 : 0
  );
  var tradePackageTerms = (pkg2) => ({
    organizationAId: pkg2.organizationAId,
    organizationBId: pkg2.organizationBId,
    assetsFromA: sortedAssets(pkg2.assetsFromA).map(assetTerms),
    assetsFromB: sortedAssets(pkg2.assetsFromB).map(assetTerms),
    validity: { expiresAt: pkg2.validity.expiresAt },
    contingencies: __spreadValues({}, pkg2.contingencies)
  });
  var parseAsset = (v) => {
    if (!isPlainObject(v)) return null;
    if (v.kind === "player_rights" && isValidId(v.playerId) && isValidId(v.rightsId))
      return {
        kind: "player_rights",
        playerId: entityId(v.playerId),
        rightsId: v.rightsId
      };
    if (v.kind === "draft_pick" && isValidId(v.pickId))
      return { kind: "draft_pick", pickId: v.pickId };
    return null;
  };
  var parseTradePackage = (v) => {
    if (!isPlainObject(v)) return "a trade package must be an object";
    if (!isValidId(v.organizationAId) || !isValidId(v.organizationBId))
      return "a trade package names two organizations";
    const side = (x) => {
      if (!Array.isArray(x)) return null;
      const out = x.map(parseAsset);
      return out.some((a2) => a2 === null) ? null : out;
    };
    const a = side(v.assetsFromA);
    const b = side(v.assetsFromB);
    if (a === null || b === null)
      return "every asset must be player_rights or draft_pick by id";
    if (!isPlainObject(v.validity)) return "validity must be an object";
    const expiresAt = v.validity.expiresAt;
    if (expiresAt !== null && typeof expiresAt !== "string")
      return "validity.expiresAt must be a date or null";
    if (!isPlainObject(v.contingencies)) return "contingencies must be an object";
    const pkg2 = {
      organizationAId: entityId(v.organizationAId),
      organizationBId: entityId(v.organizationBId),
      assetsFromA: a,
      assetsFromB: b,
      validity: { expiresAt },
      contingencies: v.contingencies
    };
    if (canonicalString(tradePackageTerms(pkg2)) !== canonicalString(v))
      return "the package is not in canonical form (use tradePackageTerms)";
    return pkg2;
  };
  var rights = (world, org, person) => effectiveRightsAt(world, org, person, "acquisition", world.simDate).rights;
  var decisionMaker = (world, org) => {
    for (const e of world.people.roleEpisodes)
      if (e.organizationId === org && e.role === "general_manager" && holdsRoleAt(world.people, org, e.personId, world.simDate))
        return e.personId;
    return null;
  };
  var viewOf = (ctx, org) => {
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const gm = decisionMaker(ctx.world, org);
    if (gm === null) return bad(`${org} has no decision-maker to answer`);
    const built = buildAcquisitionDecisionView(ctx.world, org, gm, tx2);
    return built.ok ? built.view : bad(built.reason);
  };
  var communicatedOf = (reasons) => {
    const out = /* @__PURE__ */ new Set();
    for (const r of reasons)
      switch (r.code) {
        case "CAP_INFEASIBLE":
        case "ROSTER_INFEASIBLE":
          out.add("cannot_fit");
          break;
        case "KEEP_CORE_PLAYER":
        case "WEAKENS_CURRENT_ROSTER":
        case "PLAN_HARD_CONSTRAINT":
          out.add("player_not_available");
          break;
        case "SPENDS_PREMIUM_CAPITAL":
        case "AGING_ACQUISITION":
        case "UNWANTED_PLAYER":
        case "NOTHING_FOR_PLAN":
          out.add("package_not_right");
          break;
        default:
          break;
      }
    return [...out].sort();
  };
  var latestOffer2 = (world, offerId) => world.market.tradeOffers.filter((o) => o.id === offerId).sort((a, b) => b.revision - a.revision)[0];
  var withOffer = (world, offer) => world.market.tradeOffers.map(
    (o) => o.id === offer.id && o.revision === offer.revision ? offer : o
  );
  var expired2 = (expiresAt, today) => expiresAt !== null && today >= expiresAt;
  var sortById = (xs) => [...xs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  var ok2 = (detail, authorizationDetail, nextWorld, eventSpecs) => ({
    ok: true,
    authorizationDetail,
    resolution: { nextWorld, eventSpecs, detail }
  });
  var routeInquiry = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    const asking = parseOrganization(ctx, c.organizationId);
    if (isFailure(asking)) return asking;
    const contacted = parseOrganization(ctx, c.contactedOrganizationId);
    if (isFailure(contacted)) return contacted;
    if (asking === contacted)
      return bad("an organization cannot inquire of itself");
    const asset = parseAsset(c.asset);
    if (asset === null)
      return bad("asset must be player_rights or draft_pick by id");
    if (!INQUIRY_DIRECTIONS.includes(c.direction))
      return bad("direction must be seek or shop");
    const direction = c.direction;
    if (!rights(world, asking, by).includes("communicate"))
      return denied(`${by} lacks communicate on acquisition in ${asking}`);
    const owner = direction === "seek" ? contacted : asking;
    const problems = tradePackageProblems(
      world,
      ctx.ruleset.rules.transactions,
      {
        organizationAId: owner,
        organizationBId: owner === asking ? contacted : asking,
        assetsFromA: [asset],
        assetsFromB: [],
        validity: { expiresAt: null },
        contingencies: {}
      },
      world.simDate
    ).filter((p) => p.code !== "PLAYER_ON_WAIVERS");
    if (problems.length > 0) return bad(problems[0].message);
    const view = viewOf(ctx, contacted);
    if (isFailure(view)) return view;
    const basisHash = responseBasisHash(view, asset);
    const previous = world.market.inquiries.find(
      (i) => i.askingOrganizationId === asking && i.contactedOrganizationId === contacted && i.direction === direction && assetKey(i.asset) === assetKey(asset) && world.market.responses.some(
        (r) => r.kind === "inquiry_response" && r.inquiryId === i.id && (r.basisHash === basisHash || r.createdAt === world.simDate)
      )
    );
    if (previous !== void 0)
      return bad(
        `the question stands unchanged for now: the recorded answer to inquiry ${previous.id} stands`
      );
    const minted = mintRecordIds(world, 2);
    const inquiry = {
      id: minted.ids[0],
      askingOrganizationId: asking,
      askedBy: by,
      contactedOrganizationId: contacted,
      asset,
      direction,
      createdAt: world.simDate
    };
    const response = {
      kind: "inquiry_response",
      id: minted.ids[1],
      inquiryId: inquiry.id,
      respondingOrganizationId: contacted,
      band: inquiryBandFor(view, asset, direction),
      basisHash,
      createdAt: world.simDate
    };
    return ok2(
      `${asking} asks ${contacted} about ${assetKey(asset)}`,
      `${by} holds communicate on acquisition in ${asking}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          inquiries: sortById([...world.market.inquiries, inquiry]),
          responses: sortById([...world.market.responses, response])
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      [
        spec("MarketInquirySent", {
          inquiryId: inquiry.id,
          askingOrganizationId: asking,
          contactedOrganizationId: contacted,
          asset: assetTerms(asset),
          direction
        }),
        spec("MarketInquiryAnswered", {
          responseId: response.id,
          inquiryId: inquiry.id,
          respondingOrganizationId: contacted,
          band: response.band
        })
      ]
    );
  };
  var routePost = (ctx, c) => {
    var _a, _b;
    const { world } = ctx;
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.proposalId)) return bad("proposalId must be a valid id");
    const proposal = latestProposal(world.decisions, c.proposalId);
    if (proposal === void 0) return bad("proposalId does not name a proposal");
    if (c.expectedRevision !== proposal.revision)
      return bad(`proposal revision is stale: latest is ${proposal.revision}`);
    if (proposal.category !== "acquisition" || proposal.termsType !== TRADE_TERMS_TYPE)
      return bad(`the proposal is not a ${TRADE_TERMS_TYPE} acquisition`);
    const pkg2 = parseTradePackage(proposal.terms);
    if (typeof pkg2 === "string") return bad(pkg2);
    const proposer = proposal.organizationId;
    if (proposer !== pkg2.organizationAId && proposer !== pkg2.organizationBId)
      return bad("the proposing organization is not a party to the package");
    const counterparty = proposer === pkg2.organizationAId ? pkg2.organizationBId : pkg2.organizationAId;
    if (!rights(world, proposer, by).includes("communicate"))
      return denied(`${by} lacks communicate on acquisition in ${proposer}`);
    const today = world.simDate;
    const problems = tradePackageProblems(world, tx2, pkg2, today);
    if (problems.length > 0)
      return bad(`illegal package: ${problems[0].message}`);
    if (expired2(pkg2.validity.expiresAt, today))
      return bad("the package has already expired");
    let supersedes;
    if (c.supersedesOfferId !== void 0) {
      if (!isValidId(c.supersedesOfferId))
        return bad("supersedesOfferId must be a valid id");
      supersedes = latestOffer2(world, c.supersedesOfferId);
      if (supersedes === void 0)
        return bad("supersedesOfferId does not name an offer");
      if (supersedes.status !== "open")
        return bad(
          `offer ${supersedes.id} is ${supersedes.status} and cannot be revised`
        );
      if (supersedes.proposerOrganizationId !== proposer && supersedes.counterpartyOrganizationId !== proposer)
        return bad("only a party to the offer can revise it");
    }
    const minted = mintRecordIds(world, supersedes === void 0 ? 1 : 0);
    const offer = {
      id: (_a = supersedes == null ? void 0 : supersedes.id) != null ? _a : minted.ids[0],
      revision: supersedes === void 0 ? 1 : supersedes.revision + 1,
      proposerOrganizationId: proposer,
      counterpartyOrganizationId: counterparty,
      package: pkg2,
      proposerProposalId: proposal.id,
      counterpartyProposalId: null,
      termsHash: proposal.termsHash,
      status: "open",
      createdAt: today,
      expiresAt: pkg2.validity.expiresAt,
      supersedesRevision: (_b = supersedes == null ? void 0 : supersedes.revision) != null ? _b : null
    };
    const prior = supersedes === void 0 ? world.market.tradeOffers : withOffer(world, __spreadProps(__spreadValues({}, supersedes), { status: "countered" }));
    return ok2(
      `${proposer} offers ${counterparty} a trade`,
      `${by} holds communicate on acquisition in ${proposer}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), { tradeOffers: [...prior, offer] }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      [
        spec("TradeOfferPosted", {
          offerId: offer.id,
          revision: offer.revision,
          proposerOrganizationId: proposer,
          counterpartyOrganizationId: counterparty,
          proposerProposalId: proposal.id,
          termsHash: offer.termsHash,
          supersedesRevision: offer.supersedesRevision
        })
      ]
    );
  };
  var routeRequestResponse = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.offerId)) return bad("offerId must be a valid id");
    const offer = latestOffer2(world, c.offerId);
    if (offer === void 0) return bad("offerId does not name an offer");
    if (c.offerRevision !== offer.revision)
      return bad(`offer revision is stale: latest is ${offer.revision}`);
    if (offer.status !== "open") return bad(`offer is ${offer.status}`);
    if (!rights(world, offer.proposerOrganizationId, by).includes("communicate"))
      return denied(
        `${by} lacks communicate on acquisition in ${offer.proposerOrganizationId}`
      );
    if (expired2(offer.expiresAt, world.simDate))
      return bad("the offer has expired");
    const view = viewOf(ctx, offer.counterpartyOrganizationId);
    if (isFailure(view)) return view;
    const basisHash = responseBasisHash(view, offer.package);
    const recorded = world.market.responses.find(
      (r) => r.kind === "trade_response" && r.offerId === offer.id && r.offerRevision === offer.revision && (r.basisHash === basisHash || r.createdAt === world.simDate)
    );
    if (recorded !== void 0)
      return bad(
        `unchanged offer or same day: the recorded response ${recorded.id} stands`
      );
    const evaluation = evaluateTradeForOrganization(view, offer.package);
    const minted = mintRecordIds(world, 1);
    const response = {
      kind: "trade_response",
      id: minted.ids[0],
      offerId: offer.id,
      offerRevision: offer.revision,
      respondingOrganizationId: offer.counterpartyOrganizationId,
      disposition: evaluation.disposition,
      reasons: evaluation.reasons,
      communicated: communicatedOf(evaluation.reasons),
      uncertainties: evaluation.uncertainties,
      basisHash,
      createdAt: world.simDate
    };
    const status = evaluation.disposition === "accept" ? "accepted" : evaluation.disposition === "reject" ? "declined" : "open";
    return ok2(
      `${offer.counterpartyOrganizationId} responds ${evaluation.disposition}`,
      `${by} holds communicate on acquisition in ${offer.proposerOrganizationId}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          tradeOffers: withOffer(world, __spreadProps(__spreadValues({}, offer), { status })),
          responses: sortById([...world.market.responses, response])
        }),
        nextIds: __spreadProps(__spreadValues({}, world.nextIds), { record: minted.next })
      }),
      [
        spec("TradeResponseRecorded", {
          responseId: response.id,
          offerId: offer.id,
          offerRevision: offer.revision,
          respondingOrganizationId: response.respondingOrganizationId,
          disposition: response.disposition,
          communicated: response.communicated
        })
      ]
    );
  };
  var ANSWERS = ["accept", "decline"];
  var routeAnswer = (ctx, c) => {
    const { world } = ctx;
    const by = parseActingPerson(ctx, c);
    if (isFailure(by)) return by;
    if (!isValidId(c.offerId)) return bad("offerId must be a valid id");
    const offer = latestOffer2(world, c.offerId);
    if (offer === void 0) return bad("offerId does not name an offer");
    if (c.offerRevision !== offer.revision)
      return bad(`offer revision is stale: latest is ${offer.revision}`);
    if (offer.status !== "open") return bad(`offer is ${offer.status}`);
    if (!ANSWERS.includes(c.answer))
      return bad("answer must be accept or decline");
    const org = offer.counterpartyOrganizationId;
    if (!rights(world, org, by).includes("communicate"))
      return denied(`${by} lacks communicate on acquisition in ${org}`);
    if (expired2(offer.expiresAt, world.simDate))
      return bad("the offer has expired");
    const status = c.answer === "accept" ? "accepted" : "declined";
    return ok2(
      `${org} answers ${c.answer}`,
      `${by} holds communicate on acquisition in ${org}`,
      __spreadProps(__spreadValues({}, world), {
        market: __spreadProps(__spreadValues({}, world.market), {
          tradeOffers: withOffer(world, __spreadProps(__spreadValues({}, offer), { status }))
        })
      }),
      [
        spec("TradeOfferAnswered", {
          offerId: offer.id,
          offerRevision: offer.revision,
          answeringOrganizationId: org,
          answer: c.answer,
          answeredBy: by
        })
      ]
    );
  };
  var parseSide = (ctx, v, label) => {
    if (!isPlainObject(v)) return bad(`${label} must be an object`);
    const person = parseActingPerson(ctx, v);
    if (isFailure(person))
      return bad(`${label}.actingPersonId must name an existing person`);
    if (typeof v.expectedRevision !== "number")
      return bad(`${label}.expectedRevision must be a number`);
    const ids = (x) => Array.isArray(x) && x.every((i) => typeof i === "string") ? x : null;
    const beliefIds = ids(v.beliefIds);
    const evidenceClaimIds = ids(v.evidenceClaimIds);
    if (beliefIds === null || evidenceClaimIds === null)
      return bad(`${label} beliefIds and evidenceClaimIds must be id lists`);
    return {
      actingPersonId: person,
      expectedRevision: v.expectedRevision,
      beliefIds,
      evidenceClaimIds,
      rationale: v.rationale
    };
  };
  var routeCommit2 = (ctx, c) => {
    const { world } = ctx;
    const tx2 = ctx.ruleset.rules.transactions;
    if (tx2 === void 0) return bad("the ruleset has no transaction rules");
    const submitter = parseActingPerson(ctx, c);
    if (isFailure(submitter)) return submitter;
    if (!isValidId(c.offerId)) return bad("offerId must be a valid id");
    const offer = latestOffer2(world, c.offerId);
    if (offer === void 0) return bad("offerId does not name an offer");
    if (c.offerRevision !== offer.revision)
      return bad(`offer revision is stale: latest is ${offer.revision}`);
    if (offer.status === "executed")
      return bad("this offer has already been executed");
    if (offer.status !== "accepted")
      return bad(`offer is ${offer.status}, not accepted`);
    const today = world.simDate;
    if (expired2(offer.expiresAt, today)) return bad("the offer has expired");
    if (!isValidId(c.counterpartyProposalId))
      return bad("counterpartyProposalId must be a valid id");
    const proposerSide = parseSide(ctx, c.proposerSide, "proposerSide");
    if (isFailure(proposerSide)) return proposerSide;
    const counterpartySide = parseSide(
      ctx,
      c.counterpartySide,
      "counterpartySide"
    );
    if (isFailure(counterpartySide)) return counterpartySide;
    const counterProposal = latestProposal(
      world.decisions,
      c.counterpartyProposalId
    );
    if (counterProposal === void 0)
      return bad("counterpartyProposalId does not name a proposal");
    if (counterProposal.organizationId !== offer.counterpartyOrganizationId)
      return bad("the counterparty proposal belongs to another organization");
    if (counterProposal.category !== "acquisition" || counterProposal.termsType !== TRADE_TERMS_TYPE || canonicalString(counterProposal.terms) !== canonicalString(tradePackageTerms(offer.package)))
      return bad(
        "the counterparty proposal does not authorize the offered terms"
      );
    const pkg2 = offer.package;
    try {
      const rules = transactionSeasonRules(tx2, seasonOfDate(today));
      if (today > rules.tradeDeadline)
        return bad(`the trade deadline ${rules.tradeDeadline} has passed`);
    } catch (e) {
      if (e instanceof UnknownTransactionSeasonError) return bad(e.message);
      throw e;
    }
    const problems = tradePackageProblems(world, tx2, pkg2, today);
    if (problems.length > 0) return bad(`stale package: ${problems[0].message}`);
    const capacity = tradeCapacityProblems(world, tx2, pkg2, today);
    if (capacity.length > 0)
      return bad(`${capacity[0].organizationId}: ${capacity[0].message}`);
    for (const [org, assets] of [
      [pkg2.organizationAId, pkg2.assetsFromA],
      [pkg2.organizationBId, pkg2.assetsFromB]
    ])
      for (const a of assets)
        if (a.kind === "player_rights" && isProtectedAt(
          world,
          org,
          { playerId: a.playerId },
          { kind: "trade" },
          today
        ).length > 0)
          return protectedBy(
            `${a.playerId} is protected from being traded by ${org}`
          );
    const traded = applyTradePackage(world, tx2, pkg2, today);
    const executedOffer = __spreadProps(__spreadValues({}, offer), {
      counterpartyProposalId: counterProposal.id,
      status: "executed"
    });
    const nextWorld = __spreadProps(__spreadValues({}, traded), {
      market: __spreadProps(__spreadValues({}, traded.market), { tradeOffers: withOffer(traded, executedOffer) })
    });
    const request = (org, proposalId, side) => ({
      organizationId: org,
      actorPersonId: side.actingPersonId,
      proposalId,
      expectedRevision: side.expectedRevision,
      expectedCategory: "acquisition",
      executedTerms: {
        termsType: TRADE_TERMS_TYPE,
        terms: tradePackageTerms(pkg2)
      },
      beliefIds: side.beliefIds,
      evidenceClaimIds: side.evidenceClaimIds,
      rationale: side.rationale
    });
    return commitAuthorizedDomainChange(ctx, {
      nextWorld,
      domainEvents: [
        spec("TradeExecuted", {
          offerId: offer.id,
          offerRevision: offer.revision,
          organizationAId: pkg2.organizationAId,
          organizationBId: pkg2.organizationBId,
          assetsFromA: sortedAssets(pkg2.assetsFromA).map(assetTerms),
          assetsFromB: sortedAssets(pkg2.assetsFromB).map(assetTerms),
          proposerProposalId: offer.proposerProposalId,
          counterpartyProposalId: counterProposal.id,
          executedOn: today
        })
      ],
      requests: [
        request(
          offer.proposerOrganizationId,
          offer.proposerProposalId,
          proposerSide
        ),
        request(
          offer.counterpartyOrganizationId,
          counterProposal.id,
          counterpartySide
        )
      ]
    });
  };
  var routeTradeCommand = (ctx, command) => {
    const c = command;
    switch (command.type) {
      case "SubmitMarketInquiry":
        return routeInquiry(ctx, c);
      case "PostTradeOffer":
        return routePost(ctx, c);
      case "RequestTradeResponse":
        return routeRequestResponse(ctx, c);
      case "AnswerTradeOffer":
        return routeAnswer(ctx, c);
      case "CommitTradeAgreement":
        return routeCommit2(ctx, c);
      default: {
        const unreachable = command.type;
        throw new Error(`unroutable trade command: ${String(unreachable)}`);
      }
    }
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
    CommitPlanProposal: true,
    CommitRosterStatusProposal: true,
    CommitReleaseProposal: true,
    CommitWaivePlayerProposal: true,
    SubmitWaiverClaim: true,
    ResolveWaivers: true,
    SubmitMarketInquiry: true,
    PostTradeOffer: true,
    RequestTradeResponse: true,
    AnswerTradeOffer: true,
    CommitTradeAgreement: true,
    SubmitContractOffer: true,
    WithdrawContractOffer: true,
    ResolveFreeAgencyMarket: true,
    CommitContractSigning: true,
    AskScoutingQuestion: true,
    AssignScoutingEvaluation: true,
    ResolveScoutingAssignment: true,
    CommitDraftBoardProposal: true,
    OpenDraft: true,
    MakeDraftSelection: true
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
      case "CommitRosterStatusProposal":
        return routeRosterCommand(ctx, command);
      case "CommitReleaseProposal":
        return routeContractCommand(ctx, command);
      case "CommitWaivePlayerProposal":
      case "SubmitWaiverClaim":
      case "ResolveWaivers":
        return routeWaiverCommand(ctx, command);
      case "SubmitMarketInquiry":
      case "PostTradeOffer":
      case "RequestTradeResponse":
      case "AnswerTradeOffer":
      case "CommitTradeAgreement":
        return routeTradeCommand(ctx, command);
      case "SubmitContractOffer":
      case "WithdrawContractOffer":
      case "ResolveFreeAgencyMarket":
      case "CommitContractSigning":
        return routeFreeAgencyCommand(ctx, command);
      case "AskScoutingQuestion":
      case "AssignScoutingEvaluation":
      case "ResolveScoutingAssignment":
        return routeScoutingCommand(ctx, command);
      case "CommitDraftBoardProposal":
        return routeDraftBoardCommand(ctx, command);
      case "OpenDraft":
      case "MakeDraftSelection":
        return routeDraftCommand(ctx, command);
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
      const steps2 = [];
      const reject = (stage, code, message, commandId3) => {
        steps2.push({ stage, outcome: "fail", detail: `${code}: ${message}` });
        return {
          ok: false,
          rejection: { code, message },
          trace: deepFreeze({ commandId: commandId3, steps: steps2 })
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
          steps2.push({
            stage: "validation",
            outcome: "pass",
            detail: "envelope, revision and payload valid"
          });
        }
        return reject(routed.stage, routed.code, routed.message, cid);
      }
      steps2.push({
        stage: "validation",
        outcome: "pass",
        detail: "envelope, revision and payload valid"
      });
      steps2.push({
        stage: "authorization",
        outcome: "pass",
        detail: routed.authorizationDetail
      });
      try {
        const { nextWorld: resolved, eventSpecs, detail } = routed.resolution;
        if (eventSpecs.length < 1) {
          throw new Error("an accepted command must emit at least one event");
        }
        steps2.push({ stage: "resolution", outcome: "pass", detail });
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
        steps2.push({
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
          trace: deepFreeze({ commandId: cid, steps: steps2 })
        };
      } catch (error) {
        steps2.length = 2;
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
  var packageCProvenance = {
    sourceId: "sport-sim-synthetic-package-c-rules",
    sourceKind: "synthetic",
    retrievedAt: "2026-10-17T00:00:00Z",
    effectiveAsOf: "2026-10-17",
    validationStatus: "synthetic",
    note: "Synthetic Package C acceptance profile. Values are test boundaries, not claims about current NFL rules or economics."
  };
  var seasonRules = (season) => ({
    season,
    salaryCap: moneyAmount(2e6),
    activeRosterLimit: 10,
    reserveRosterLimit: 4,
    practiceSquadLimit: 4,
    freeAgencyOpen: `${season}-03-10`,
    freeAgencyClose: `${season}-07-15`,
    tradeDeadline: `${season}-11-03`,
    draftDate: `${season}-04-25`
  });
  var SYNTHETIC_PACKAGE_C_RULESET = sealRuleset({
    schemaVersion: SCHEMA_VERSION,
    rulesetId: "synthetic-package-c-rules",
    rulesetVersion: 1,
    displayName: "Synthetic Package C Transaction Rules",
    provenance: [packageCProvenance],
    rules: {
      maxAdvanceDaysPerCommand: 30,
      transactions: {
        moneyUnit: "synthetic-unit",
        seasonRules: [2026, 2027, 2028, 2029, 2030].map(seasonRules),
        contracts: {
          minYears: 1,
          maxYears: 5,
          signingBonusProrationMaxYears: 5,
          minimumBaseSalary: moneyAmount(1e4),
          guaranteedFutureBaseOnRelease: true,
          signingBonusStaysWithOriginalClubOnTrade: true
        },
        market: {
          defaultOfferValidityDays: 7,
          futurePickTradeHorizonSeasons: 2,
          resolutionPolicy: "checkpoint"
        },
        waivers: {
          claimWindowDays: 1,
          releasedPlayerWaiverPolicy: "all",
          claimWinnerMovesToEnd: true
        },
        draft: {
          rounds: 3,
          rookieContractByRound: [
            {
              round: 1,
              years: 4,
              baseSalaryBySeason: [moneyAmount(6e4), moneyAmount(7e4), moneyAmount(8e4), moneyAmount(9e4)],
              signingBonus: moneyAmount(1e5)
            },
            {
              round: 2,
              years: 4,
              baseSalaryBySeason: [moneyAmount(4e4), moneyAmount(45e3), moneyAmount(5e4), moneyAmount(55e3)],
              signingBonus: moneyAmount(4e4)
            },
            {
              round: 3,
              years: 3,
              baseSalaryBySeason: [moneyAmount(2e4), moneyAmount(22e3), moneyAmount(24e3)],
              signingBonus: moneyAmount(1e4)
            }
          ]
        }
      }
    }
  });

  // packages/sim-core/src/packageCWorldSeed.ts
  var PACKAGE_C_SEED_JSON = {
    contentHash: "5411c810e442eafdc886698d4840600ea367a124041680e06668d8c17ede1b4a",
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
      },
      {
        id: "org-eastbrook",
        kind: "organization",
        name: "Eastbrook Herons (synthetic)"
      },
      {
        id: "person-eb-owner",
        kind: "person",
        name: "Sloane Reid (synthetic)"
      },
      {
        id: "person-eb-gm",
        kind: "person",
        name: "Devon Hale (synthetic)"
      },
      {
        id: "person-eb-scout",
        kind: "person",
        name: "Parker Lind (synthetic)"
      },
      {
        id: "org-westlake",
        kind: "organization",
        name: "Westlake Foxes (synthetic)"
      },
      {
        id: "person-wl-owner",
        kind: "person",
        name: "Rowan Cade (synthetic)"
      },
      {
        id: "person-wl-gm",
        kind: "person",
        name: "Elliot Frost (synthetic)"
      },
      {
        id: "person-wl-scout",
        kind: "person",
        name: "Sam Okoro (synthetic)"
      },
      {
        id: "person-agent-ashby",
        kind: "person",
        name: "Taylor Ashby (synthetic)"
      },
      {
        id: "person-agent-brandt",
        kind: "person",
        name: "Jules Brandt (synthetic)"
      },
      {
        id: "player-nf-01",
        kind: "person",
        name: "Devin Keller (synthetic)"
      },
      {
        id: "player-nf-02",
        kind: "person",
        name: "Tyrell Rankin (synthetic)"
      },
      {
        id: "player-nf-03",
        kind: "person",
        name: "Cole Everett (synthetic)"
      },
      {
        id: "player-nf-04",
        kind: "person",
        name: "Isaiah Lowell (synthetic)"
      },
      {
        id: "player-nf-05",
        kind: "person",
        name: "Mateo Sutton (synthetic)"
      },
      {
        id: "player-sp-01",
        kind: "person",
        name: "Jamal Fisk (synthetic)"
      },
      {
        id: "player-sp-02",
        kind: "person",
        name: "Eli Mercer (synthetic)"
      },
      {
        id: "player-sp-03",
        kind: "person",
        name: "Zane Thorne (synthetic)"
      },
      {
        id: "player-sp-04",
        kind: "person",
        name: "Kai Garrison (synthetic)"
      },
      {
        id: "player-sp-05",
        kind: "person",
        name: "Andre Noble (synthetic)"
      },
      {
        id: "player-eb-01",
        kind: "person",
        name: "Rhett Archer (synthetic)"
      },
      {
        id: "player-eb-02",
        kind: "person",
        name: "Luca Hollis (synthetic)"
      },
      {
        id: "player-eb-03",
        kind: "person",
        name: "Omar Osborne (synthetic)"
      },
      {
        id: "player-eb-04",
        kind: "person",
        name: "Dante Bishop (synthetic)"
      },
      {
        id: "player-wl-01",
        kind: "person",
        name: "Nico Ingram (synthetic)"
      },
      {
        id: "player-wl-02",
        kind: "person",
        name: "Silas Prescott (synthetic)"
      },
      {
        id: "player-wl-03",
        kind: "person",
        name: "Jonah Calloway (synthetic)"
      },
      {
        id: "player-wl-04",
        kind: "person",
        name: "Bram Jarvis (synthetic)"
      },
      {
        id: "player-eb-draftee",
        kind: "person",
        name: "Ty Quade (synthetic)"
      },
      {
        id: "player-wl-exclusive",
        kind: "person",
        name: "Marcus Dalton (synthetic)"
      },
      {
        id: "player-fa-01",
        kind: "person",
        name: "Devin Keller (synthetic)"
      },
      {
        id: "player-fa-02",
        kind: "person",
        name: "Tyrell Rankin (synthetic)"
      },
      {
        id: "player-fa-03",
        kind: "person",
        name: "Cole Everett (synthetic)"
      },
      {
        id: "player-fa-04",
        kind: "person",
        name: "Isaiah Lowell (synthetic)"
      },
      {
        id: "player-fa-05",
        kind: "person",
        name: "Mateo Sutton (synthetic)"
      },
      {
        id: "player-pr-01",
        kind: "person",
        name: "Jamal Fisk (synthetic)"
      },
      {
        id: "player-pr-02",
        kind: "person",
        name: "Eli Mercer (synthetic)"
      },
      {
        id: "player-pr-03",
        kind: "person",
        name: "Zane Thorne (synthetic)"
      },
      {
        id: "player-pr-04",
        kind: "person",
        name: "Kai Garrison (synthetic)"
      },
      {
        id: "player-pr-05",
        kind: "person",
        name: "Andre Noble (synthetic)"
      },
      {
        id: "player-pr-06",
        kind: "person",
        name: "Rhett Archer (synthetic)"
      },
      {
        id: "player-pr-07",
        kind: "person",
        name: "Luca Hollis (synthetic)"
      },
      {
        id: "player-pr-08",
        kind: "person",
        name: "Omar Osborne (synthetic)"
      },
      {
        id: "player-pr-09",
        kind: "person",
        name: "Dante Bishop (synthetic)"
      },
      {
        id: "player-pr-10",
        kind: "person",
        name: "Nico Ingram (synthetic)"
      },
      {
        id: "player-pr-11",
        kind: "person",
        name: "Silas Prescott (synthetic)"
      },
      {
        id: "player-pr-12",
        kind: "person",
        name: "Jonah Calloway (synthetic)"
      },
      {
        id: "player-pr-13",
        kind: "person",
        name: "Bram Jarvis (synthetic)"
      },
      {
        id: "player-pr-14",
        kind: "person",
        name: "Ty Quade (synthetic)"
      }
    ],
    organizationSubstrate: {
      authorityGrants: [
        {
          category: "organizational_authority",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-organizational_authority",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-organizational_plan",
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
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-acquisition",
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
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-contract",
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
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-roster",
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
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-owner-major_trade",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-gm-organizational_plan",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-gm-acquisition",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-gm-contract",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-gm-roster",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-gm-major_trade",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-nf-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-scout-organizational_plan",
          organizationId: "org-northfield",
          personId: "person-nf-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-nf-gm",
          transferable: false
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-nf-scout-acquisition",
          organizationId: "org-northfield",
          personId: "person-nf-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-nf-gm",
          transferable: false
        },
        {
          category: "organizational_authority",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-organizational_authority",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-organizational_plan",
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
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-acquisition",
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
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-contract",
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
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-roster",
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
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-owner-major_trade",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-gm-organizational_plan",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-gm-acquisition",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-gm-contract",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-gm-roster",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-gm-major_trade",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-sp-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-scout-organizational_plan",
          organizationId: "org-southport",
          personId: "person-sp-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-sp-gm",
          transferable: false
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-sp-scout-acquisition",
          organizationId: "org-southport",
          personId: "person-sp-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-sp-gm",
          transferable: false
        },
        {
          category: "organizational_authority",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-organizational_authority",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-organizational_plan",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-acquisition",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-contract",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-roster",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-owner-major_trade",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-gm-organizational_plan",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-eb-owner",
          transferable: true
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-gm-acquisition",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-eb-owner",
          transferable: true
        },
        {
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-gm-contract",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-eb-owner",
          transferable: true
        },
        {
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-gm-roster",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-eb-owner",
          transferable: true
        },
        {
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-gm-major_trade",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-eb-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-scout-organizational_plan",
          organizationId: "org-eastbrook",
          personId: "person-eb-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-eb-gm",
          transferable: false
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-eb-scout-acquisition",
          organizationId: "org-eastbrook",
          personId: "person-eb-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-eb-gm",
          transferable: false
        },
        {
          category: "organizational_authority",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-organizational_authority",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-organizational_plan",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-acquisition",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-contract",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-roster",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-owner-major_trade",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
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
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-gm-organizational_plan",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-wl-owner",
          transferable: true
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-gm-acquisition",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-wl-owner",
          transferable: true
        },
        {
          category: "contract",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-gm-contract",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-wl-owner",
          transferable: true
        },
        {
          category: "roster",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-gm-roster",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-wl-owner",
          transferable: true
        },
        {
          category: "major_trade",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-gm-major_trade",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          revision: 1,
          rights: ["propose", "advise", "approve", "execute", "communicate"],
          sourcePersonId: "person-wl-owner",
          transferable: true
        },
        {
          category: "organizational_plan",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-scout-organizational_plan",
          organizationId: "org-westlake",
          personId: "person-wl-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-wl-gm",
          transferable: false
        },
        {
          category: "acquisition",
          effectiveFrom: "2027-01-01",
          effectiveUntil: null,
          id: "grant-wl-scout-acquisition",
          organizationId: "org-westlake",
          personId: "person-wl-scout",
          revision: 1,
          rights: ["propose", "advise", "communicate"],
          sourcePersonId: "person-wl-gm",
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
          startDate: "2027-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-nf-gm",
          organizationId: "org-northfield",
          personId: "person-nf-gm",
          role: "general_manager",
          startDate: "2027-01-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-nf-scout",
          organizationId: "org-northfield",
          personId: "person-nf-scout",
          role: "scout",
          startDate: "2027-01-01",
          title: "Scout"
        },
        {
          endDate: null,
          id: "role-sp-owner",
          organizationId: "org-southport",
          personId: "person-sp-owner",
          role: "owner",
          startDate: "2027-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-sp-gm",
          organizationId: "org-southport",
          personId: "person-sp-gm",
          role: "general_manager",
          startDate: "2027-01-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-sp-scout",
          organizationId: "org-southport",
          personId: "person-sp-scout",
          role: "scout",
          startDate: "2027-01-01",
          title: "Scout"
        },
        {
          endDate: null,
          id: "role-eb-owner",
          organizationId: "org-eastbrook",
          personId: "person-eb-owner",
          role: "owner",
          startDate: "2027-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-eb-gm",
          organizationId: "org-eastbrook",
          personId: "person-eb-gm",
          role: "general_manager",
          startDate: "2027-01-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-eb-scout",
          organizationId: "org-eastbrook",
          personId: "person-eb-scout",
          role: "scout",
          startDate: "2027-01-01",
          title: "Scout"
        },
        {
          endDate: null,
          id: "role-wl-owner",
          organizationId: "org-westlake",
          personId: "person-wl-owner",
          role: "owner",
          startDate: "2027-01-01",
          title: "Owner"
        },
        {
          endDate: null,
          id: "role-wl-gm",
          organizationId: "org-westlake",
          personId: "person-wl-gm",
          role: "general_manager",
          startDate: "2027-01-01",
          title: "General Manager"
        },
        {
          endDate: null,
          id: "role-wl-scout",
          organizationId: "org-westlake",
          personId: "person-wl-scout",
          role: "scout",
          startDate: "2027-01-01",
          title: "Scout"
        }
      ]
    },
    packageCSubstrate: {
      agentClients: [
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-fa-01",
          playerPersonId: "player-fa-01"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-fa-02",
          playerPersonId: "player-fa-02"
        },
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-fa-03",
          playerPersonId: "player-fa-03"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-fa-04",
          playerPersonId: "player-fa-04"
        },
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-fa-05",
          playerPersonId: "player-fa-05"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-nf-01",
          playerPersonId: "player-nf-01"
        },
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-sp-01",
          playerPersonId: "player-sp-01"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-eb-01",
          playerPersonId: "player-eb-01"
        },
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-pr-01",
          playerPersonId: "player-pr-01"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-pr-02",
          playerPersonId: "player-pr-02"
        },
        {
          agentPersonId: "person-agent-ashby",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-pr-03",
          playerPersonId: "player-pr-03"
        },
        {
          agentPersonId: "person-agent-brandt",
          effectiveFrom: "2026-01-01",
          effectiveUntil: null,
          id: "client-player-pr-04",
          playerPersonId: "player-pr-04"
        }
      ],
      contracts: [
        {
          id: "contract-seed-player-eb-01",
          organizationId: "org-eastbrook",
          playerId: "player-eb-01",
          signedAt: "2026-03-01",
          signingBonus: 15e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 175e3,
              guaranteedBase: 175e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 185e3,
              guaranteedBase: 92500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 195e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-eb-02",
          organizationId: "org-eastbrook",
          playerId: "player-eb-02",
          signedAt: "2026-03-01",
          signingBonus: 12e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e5,
              guaranteedBase: 2e5,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 21e4,
              guaranteedBase: 105e3,
              rosterBonus: 0,
              season: 2027
            },
            {
              baseSalary: 22e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-eb-03",
          organizationId: "org-eastbrook",
          playerId: "player-eb-03",
          signedAt: "2026-03-01",
          signingBonus: 9e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 225e3,
              guaranteedBase: 225e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 235e3,
              guaranteedBase: 117500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 245e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-eb-04",
          organizationId: "org-eastbrook",
          playerId: "player-eb-04",
          signedAt: "2026-03-01",
          signingBonus: 6e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 25e4,
              guaranteedBase: 25e4,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 26e4,
              guaranteedBase: 13e4,
              rosterBonus: 0,
              season: 2027
            }
          ]
        },
        {
          id: "contract-seed-player-nf-01",
          organizationId: "org-northfield",
          playerId: "player-nf-01",
          signedAt: "2026-03-01",
          signingBonus: 15e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 175e3,
              guaranteedBase: 175e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 185e3,
              guaranteedBase: 92500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 195e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-nf-02",
          organizationId: "org-northfield",
          playerId: "player-nf-02",
          signedAt: "2026-03-01",
          signingBonus: 12e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e5,
              guaranteedBase: 2e5,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 21e4,
              guaranteedBase: 105e3,
              rosterBonus: 0,
              season: 2027
            },
            {
              baseSalary: 22e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-nf-03",
          organizationId: "org-northfield",
          playerId: "player-nf-03",
          signedAt: "2026-03-01",
          signingBonus: 9e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 225e3,
              guaranteedBase: 225e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 235e3,
              guaranteedBase: 117500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 245e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-nf-04",
          organizationId: "org-northfield",
          playerId: "player-nf-04",
          signedAt: "2026-03-01",
          signingBonus: 6e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 25e4,
              guaranteedBase: 25e4,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 26e4,
              guaranteedBase: 13e4,
              rosterBonus: 0,
              season: 2027
            }
          ]
        },
        {
          id: "contract-seed-player-nf-05",
          organizationId: "org-northfield",
          playerId: "player-nf-05",
          signedAt: "2026-03-01",
          signingBonus: 0,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 25e3,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2027
            }
          ]
        },
        {
          id: "contract-seed-player-sp-01",
          organizationId: "org-southport",
          playerId: "player-sp-01",
          signedAt: "2026-03-01",
          signingBonus: 15e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 175e3,
              guaranteedBase: 175e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 185e3,
              guaranteedBase: 92500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 195e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-sp-02",
          organizationId: "org-southport",
          playerId: "player-sp-02",
          signedAt: "2026-03-01",
          signingBonus: 12e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e5,
              guaranteedBase: 2e5,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 21e4,
              guaranteedBase: 105e3,
              rosterBonus: 0,
              season: 2027
            },
            {
              baseSalary: 22e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-sp-03",
          organizationId: "org-southport",
          playerId: "player-sp-03",
          signedAt: "2026-03-01",
          signingBonus: 9e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 225e3,
              guaranteedBase: 225e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 235e3,
              guaranteedBase: 117500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 245e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-sp-04",
          organizationId: "org-southport",
          playerId: "player-sp-04",
          signedAt: "2026-03-01",
          signingBonus: 6e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 25e4,
              guaranteedBase: 25e4,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 26e4,
              guaranteedBase: 13e4,
              rosterBonus: 0,
              season: 2027
            }
          ]
        },
        {
          id: "contract-seed-player-sp-05",
          organizationId: "org-southport",
          playerId: "player-sp-05",
          signedAt: "2026-03-01",
          signingBonus: 0,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 25e3,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2027
            }
          ]
        },
        {
          id: "contract-seed-player-wl-01",
          organizationId: "org-westlake",
          playerId: "player-wl-01",
          signedAt: "2026-03-01",
          signingBonus: 15e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 175e3,
              guaranteedBase: 175e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 185e3,
              guaranteedBase: 92500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 195e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-wl-02",
          organizationId: "org-westlake",
          playerId: "player-wl-02",
          signedAt: "2026-03-01",
          signingBonus: 12e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 2e5,
              guaranteedBase: 2e5,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 21e4,
              guaranteedBase: 105e3,
              rosterBonus: 0,
              season: 2027
            },
            {
              baseSalary: 22e4,
              guaranteedBase: 0,
              rosterBonus: 0,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-wl-03",
          organizationId: "org-westlake",
          playerId: "player-wl-03",
          signedAt: "2026-03-01",
          signingBonus: 9e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 225e3,
              guaranteedBase: 225e3,
              rosterBonus: 1e4,
              season: 2026
            },
            {
              baseSalary: 235e3,
              guaranteedBase: 117500,
              rosterBonus: 1e4,
              season: 2027
            },
            {
              baseSalary: 245e3,
              guaranteedBase: 0,
              rosterBonus: 1e4,
              season: 2028
            }
          ]
        },
        {
          id: "contract-seed-player-wl-04",
          organizationId: "org-westlake",
          playerId: "player-wl-04",
          signedAt: "2026-03-01",
          signingBonus: 6e4,
          startSeason: 2026,
          years: [
            {
              baseSalary: 25e4,
              guaranteedBase: 25e4,
              rosterBonus: 0,
              season: 2026
            },
            {
              baseSalary: 26e4,
              guaranteedBase: 13e4,
              rosterBonus: 0,
              season: 2027
            }
          ]
        }
      ],
      draftClasses: [
        {
          eligiblePlayerIds: [
            "player-pr-01",
            "player-pr-02",
            "player-pr-03",
            "player-pr-04",
            "player-pr-05",
            "player-pr-06",
            "player-pr-07",
            "player-pr-08",
            "player-pr-09",
            "player-pr-10",
            "player-pr-11",
            "player-pr-12",
            "player-pr-13",
            "player-pr-14"
          ],
          id: "class-2027",
          season: 2027
        }
      ],
      draftPicks: [
        {
          id: "pick-2027-r1-s1",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 1,
          season: 2027,
          slot: 1,
          status: "available"
        },
        {
          id: "pick-2027-r1-s2",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 1,
          season: 2027,
          slot: 2,
          status: "available"
        },
        {
          id: "pick-2027-r1-s3",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 1,
          season: 2027,
          slot: 3,
          status: "available"
        },
        {
          id: "pick-2027-r1-s4",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 1,
          season: 2027,
          slot: 4,
          status: "available"
        },
        {
          id: "pick-2027-r2-s1",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-northfield",
          round: 2,
          season: 2027,
          slot: 1,
          status: "available"
        },
        {
          id: "pick-2027-r2-s2",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 2,
          season: 2027,
          slot: 2,
          status: "available"
        },
        {
          id: "pick-2027-r2-s3",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 2,
          season: 2027,
          slot: 3,
          status: "available"
        },
        {
          id: "pick-2027-r2-s4",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 2,
          season: 2027,
          slot: 4,
          status: "available"
        },
        {
          id: "pick-2027-r3-s1",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 3,
          season: 2027,
          slot: 1,
          status: "available"
        },
        {
          id: "pick-2027-r3-s2",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-westlake",
          round: 3,
          season: 2027,
          slot: 2,
          status: "available"
        },
        {
          id: "pick-2027-r3-s3",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 3,
          season: 2027,
          slot: 3,
          status: "available"
        },
        {
          id: "pick-2027-r3-s4",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 3,
          season: 2027,
          slot: 4,
          status: "available"
        },
        {
          id: "pick-2028-r1-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 1,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r1-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 1,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r1-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-eastbrook",
          round: 1,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r1-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 1,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r2-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 2,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r2-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 2,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r2-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 2,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r2-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 2,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r3-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 3,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r3-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 3,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r3-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 3,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2028-r3-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 3,
          season: 2028,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r1-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 1,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r1-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 1,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r1-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 1,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r1-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 1,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r2-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 2,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r2-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 2,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r2-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 2,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r2-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 2,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r3-wl",
          originalOrganizationId: "org-westlake",
          ownerOrganizationId: "org-westlake",
          round: 3,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r3-eb",
          originalOrganizationId: "org-eastbrook",
          ownerOrganizationId: "org-eastbrook",
          round: 3,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r3-sp",
          originalOrganizationId: "org-southport",
          ownerOrganizationId: "org-southport",
          round: 3,
          season: 2029,
          slot: null,
          status: "available"
        },
        {
          id: "pick-2029-r3-nf",
          originalOrganizationId: "org-northfield",
          ownerOrganizationId: "org-northfield",
          round: 3,
          season: 2029,
          slot: null,
          status: "available"
        }
      ],
      evaluatorProfiles: [
        {
          personId: "person-nf-scout",
          riskTolerance: "medium",
          strongDimensions: ["processing", "anticipation", "coverage_instincts"],
          weakDimensions: ["burst", "agility", "route_craft"]
        },
        {
          personId: "person-sp-scout",
          riskTolerance: "high",
          strongDimensions: ["strength", "block_technique", "run_stopping"],
          weakDimensions: ["accuracy", "arm_power", "hands"]
        },
        {
          personId: "person-eb-scout",
          riskTolerance: "low",
          strongDimensions: ["burst", "agility", "route_craft"],
          weakDimensions: ["processing", "anticipation", "coverage_instincts"]
        },
        {
          personId: "person-wl-scout",
          riskTolerance: "medium",
          strongDimensions: ["accuracy", "arm_power", "hands"],
          weakDimensions: ["strength", "block_technique", "run_stopping"]
        }
      ],
      memberships: [
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-nf-01",
          organizationId: "org-northfield",
          playerId: "player-nf-01",
          sourceRecordId: "contract-seed-player-nf-01",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-nf-02",
          organizationId: "org-northfield",
          playerId: "player-nf-02",
          sourceRecordId: "contract-seed-player-nf-02",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-nf-03",
          organizationId: "org-northfield",
          playerId: "player-nf-03",
          sourceRecordId: "contract-seed-player-nf-03",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-nf-04",
          organizationId: "org-northfield",
          playerId: "player-nf-04",
          sourceRecordId: "contract-seed-player-nf-04",
          status: "reserve"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-nf-05",
          organizationId: "org-northfield",
          playerId: "player-nf-05",
          sourceRecordId: "contract-seed-player-nf-05",
          status: "practice_squad"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-sp-01",
          organizationId: "org-southport",
          playerId: "player-sp-01",
          sourceRecordId: "contract-seed-player-sp-01",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-sp-02",
          organizationId: "org-southport",
          playerId: "player-sp-02",
          sourceRecordId: "contract-seed-player-sp-02",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-sp-03",
          organizationId: "org-southport",
          playerId: "player-sp-03",
          sourceRecordId: "contract-seed-player-sp-03",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-sp-04",
          organizationId: "org-southport",
          playerId: "player-sp-04",
          sourceRecordId: "contract-seed-player-sp-04",
          status: "reserve"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-sp-05",
          organizationId: "org-southport",
          playerId: "player-sp-05",
          sourceRecordId: "contract-seed-player-sp-05",
          status: "practice_squad"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-eb-01",
          organizationId: "org-eastbrook",
          playerId: "player-eb-01",
          sourceRecordId: "contract-seed-player-eb-01",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-eb-02",
          organizationId: "org-eastbrook",
          playerId: "player-eb-02",
          sourceRecordId: "contract-seed-player-eb-02",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-eb-03",
          organizationId: "org-eastbrook",
          playerId: "player-eb-03",
          sourceRecordId: "contract-seed-player-eb-03",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-eb-04",
          organizationId: "org-eastbrook",
          playerId: "player-eb-04",
          sourceRecordId: "contract-seed-player-eb-04",
          status: "reserve"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-wl-01",
          organizationId: "org-westlake",
          playerId: "player-wl-01",
          sourceRecordId: "contract-seed-player-wl-01",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-wl-02",
          organizationId: "org-westlake",
          playerId: "player-wl-02",
          sourceRecordId: "contract-seed-player-wl-02",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-wl-03",
          organizationId: "org-westlake",
          playerId: "player-wl-03",
          sourceRecordId: "contract-seed-player-wl-03",
          status: "active"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          id: "mem-player-wl-04",
          organizationId: "org-westlake",
          playerId: "player-wl-04",
          sourceRecordId: "contract-seed-player-wl-04",
          status: "reserve"
        }
      ],
      playerPreferences: [
        {
          contenderPreference: "low",
          earlyCash: "medium",
          flexibility: "medium",
          playerPersonId: "player-fa-01",
          roleOpportunity: "high",
          security: "low"
        },
        {
          contenderPreference: "high",
          earlyCash: "high",
          flexibility: "high",
          playerPersonId: "player-fa-02",
          roleOpportunity: "low",
          security: "medium"
        },
        {
          contenderPreference: "medium",
          earlyCash: "low",
          flexibility: "low",
          playerPersonId: "player-fa-03",
          roleOpportunity: "medium",
          security: "high"
        },
        {
          contenderPreference: "low",
          earlyCash: "medium",
          flexibility: "medium",
          playerPersonId: "player-fa-04",
          roleOpportunity: "high",
          security: "low"
        },
        {
          contenderPreference: "high",
          earlyCash: "high",
          flexibility: "high",
          playerPersonId: "player-fa-05",
          roleOpportunity: "low",
          security: "medium"
        },
        {
          contenderPreference: "medium",
          earlyCash: "low",
          flexibility: "low",
          playerPersonId: "player-nf-01",
          roleOpportunity: "medium",
          security: "high"
        },
        {
          contenderPreference: "low",
          earlyCash: "medium",
          flexibility: "medium",
          playerPersonId: "player-sp-01",
          roleOpportunity: "high",
          security: "low"
        },
        {
          contenderPreference: "high",
          earlyCash: "high",
          flexibility: "high",
          playerPersonId: "player-eb-01",
          roleOpportunity: "low",
          security: "medium"
        },
        {
          contenderPreference: "medium",
          earlyCash: "low",
          flexibility: "low",
          playerPersonId: "player-pr-01",
          roleOpportunity: "medium",
          security: "high"
        },
        {
          contenderPreference: "low",
          earlyCash: "medium",
          flexibility: "medium",
          playerPersonId: "player-pr-02",
          roleOpportunity: "high",
          security: "low"
        },
        {
          contenderPreference: "high",
          earlyCash: "high",
          flexibility: "high",
          playerPersonId: "player-pr-03",
          roleOpportunity: "low",
          security: "medium"
        },
        {
          contenderPreference: "medium",
          earlyCash: "low",
          flexibility: "low",
          playerPersonId: "player-pr-04",
          roleOpportunity: "medium",
          security: "high"
        }
      ],
      players: [
        {
          birthDate: "1996-02-02",
          capabilities: [
            {
              key: "burst",
              valueBp: 8148
            },
            {
              key: "agility",
              valueBp: 4877
            },
            {
              key: "strength",
              valueBp: 7606
            },
            {
              key: "hands",
              valueBp: 4335
            },
            {
              key: "vision",
              valueBp: 7064
            }
          ],
          personId: "player-nf-01",
          primaryRole: "running_back",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1997-03-03",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 4067
            },
            {
              key: "strength",
              valueBp: 6796
            },
            {
              key: "processing",
              valueBp: 3525
            },
            {
              key: "agility",
              valueBp: 6254
            }
          ],
          personId: "player-nf-02",
          primaryRole: "offensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1998-04-04",
          capabilities: [
            {
              key: "tackling",
              valueBp: 5986
            },
            {
              key: "processing",
              valueBp: 8715
            },
            {
              key: "run_stopping",
              valueBp: 5444
            },
            {
              key: "coverage_instincts",
              valueBp: 8173
            },
            {
              key: "burst",
              valueBp: 4902
            }
          ],
          personId: "player-nf-03",
          primaryRole: "linebacker",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1999-05-05",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 7905
            },
            {
              key: "tackling",
              valueBp: 4634
            },
            {
              key: "processing",
              valueBp: 7363
            },
            {
              key: "anticipation",
              valueBp: 4092
            }
          ],
          personId: "player-nf-04",
          primaryRole: "safety",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "2000-06-06",
          capabilities: [
            {
              key: "burst",
              valueBp: 3824
            },
            {
              key: "agility",
              valueBp: 6553
            },
            {
              key: "strength",
              valueBp: 9282
            },
            {
              key: "hands",
              valueBp: 6011
            },
            {
              key: "vision",
              valueBp: 8740
            }
          ],
          personId: "player-nf-05",
          primaryRole: "running_back",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2001-07-07",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 5743
            },
            {
              key: "burst",
              valueBp: 8472
            },
            {
              key: "agility",
              valueBp: 5201
            },
            {
              key: "anticipation",
              valueBp: 7930
            },
            {
              key: "tackling",
              valueBp: 4659
            }
          ],
          personId: "player-sp-01",
          primaryRole: "cornerback",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1995-08-08",
          capabilities: [
            {
              key: "processing",
              valueBp: 7662
            },
            {
              key: "accuracy",
              valueBp: 4391
            },
            {
              key: "arm_power",
              valueBp: 7120
            },
            {
              key: "agility",
              valueBp: 3849
            },
            {
              key: "anticipation",
              valueBp: 6578
            }
          ],
          personId: "player-sp-02",
          primaryRole: "quarterback",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1996-09-09",
          capabilities: [
            {
              key: "route_craft",
              valueBp: 3581
            },
            {
              key: "hands",
              valueBp: 6310
            },
            {
              key: "burst",
              valueBp: 9039
            },
            {
              key: "agility",
              valueBp: 5768
            },
            {
              key: "anticipation",
              valueBp: 8497
            }
          ],
          personId: "player-sp-03",
          primaryRole: "wide_receiver",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "1997-10-10",
          capabilities: [
            {
              key: "pass_rush",
              valueBp: 5500
            },
            {
              key: "run_stopping",
              valueBp: 8229
            },
            {
              key: "strength",
              valueBp: 4958
            },
            {
              key: "burst",
              valueBp: 7687
            }
          ],
          personId: "player-sp-04",
          primaryRole: "defensive_line",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1998-11-11",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 7419
            },
            {
              key: "burst",
              valueBp: 4148
            },
            {
              key: "agility",
              valueBp: 6877
            },
            {
              key: "anticipation",
              valueBp: 3606
            },
            {
              key: "tackling",
              valueBp: 6335
            }
          ],
          personId: "player-sp-05",
          primaryRole: "cornerback",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1999-12-12",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 9338
            },
            {
              key: "strength",
              valueBp: 6067
            },
            {
              key: "processing",
              valueBp: 8796
            },
            {
              key: "agility",
              valueBp: 5525
            }
          ],
          personId: "player-eb-01",
          primaryRole: "offensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2000-01-13",
          capabilities: [
            {
              key: "tackling",
              valueBp: 5257
            },
            {
              key: "processing",
              valueBp: 7986
            },
            {
              key: "run_stopping",
              valueBp: 4715
            },
            {
              key: "coverage_instincts",
              valueBp: 7444
            },
            {
              key: "burst",
              valueBp: 4173
            }
          ],
          personId: "player-eb-02",
          primaryRole: "linebacker",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2001-02-14",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 7176
            },
            {
              key: "tackling",
              valueBp: 3905
            },
            {
              key: "processing",
              valueBp: 6634
            },
            {
              key: "anticipation",
              valueBp: 9363
            }
          ],
          personId: "player-eb-03",
          primaryRole: "safety",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1995-03-15",
          capabilities: [
            {
              key: "burst",
              valueBp: 9095
            },
            {
              key: "agility",
              valueBp: 5824
            },
            {
              key: "strength",
              valueBp: 8553
            },
            {
              key: "hands",
              valueBp: 5282
            },
            {
              key: "vision",
              valueBp: 8011
            }
          ],
          personId: "player-eb-04",
          primaryRole: "running_back",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1996-04-16",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 5014
            },
            {
              key: "tackling",
              valueBp: 7743
            },
            {
              key: "processing",
              valueBp: 4472
            },
            {
              key: "anticipation",
              valueBp: 7201
            }
          ],
          personId: "player-wl-01",
          primaryRole: "safety",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1997-05-17",
          capabilities: [
            {
              key: "burst",
              valueBp: 6933
            },
            {
              key: "agility",
              valueBp: 3662
            },
            {
              key: "strength",
              valueBp: 6391
            },
            {
              key: "hands",
              valueBp: 9120
            },
            {
              key: "vision",
              valueBp: 5849
            }
          ],
          personId: "player-wl-02",
          primaryRole: "running_back",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "1998-06-18",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 8852
            },
            {
              key: "strength",
              valueBp: 5581
            },
            {
              key: "processing",
              valueBp: 8310
            },
            {
              key: "agility",
              valueBp: 5039
            }
          ],
          personId: "player-wl-03",
          primaryRole: "offensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1999-07-19",
          capabilities: [
            {
              key: "tackling",
              valueBp: 4771
            },
            {
              key: "processing",
              valueBp: 7500
            },
            {
              key: "run_stopping",
              valueBp: 4229
            },
            {
              key: "coverage_instincts",
              valueBp: 6958
            },
            {
              key: "burst",
              valueBp: 3687
            }
          ],
          personId: "player-wl-04",
          primaryRole: "linebacker",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2003-08-20",
          capabilities: [
            {
              key: "pass_rush",
              valueBp: 6690
            },
            {
              key: "run_stopping",
              valueBp: 9419
            },
            {
              key: "strength",
              valueBp: 6148
            },
            {
              key: "burst",
              valueBp: 8877
            }
          ],
          personId: "player-eb-draftee",
          primaryRole: "defensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1999-09-21",
          capabilities: [
            {
              key: "route_craft",
              valueBp: 8609
            },
            {
              key: "hands",
              valueBp: 5338
            },
            {
              key: "burst",
              valueBp: 8067
            },
            {
              key: "agility",
              valueBp: 4796
            },
            {
              key: "anticipation",
              valueBp: 7525
            }
          ],
          personId: "player-wl-exclusive",
          primaryRole: "wide_receiver",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "1998-10-22",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 4528
            },
            {
              key: "tackling",
              valueBp: 7257
            },
            {
              key: "processing",
              valueBp: 3986
            },
            {
              key: "anticipation",
              valueBp: 6715
            }
          ],
          personId: "player-fa-01",
          primaryRole: "safety",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1999-11-23",
          capabilities: [
            {
              key: "route_craft",
              valueBp: 6447
            },
            {
              key: "hands",
              valueBp: 9176
            },
            {
              key: "burst",
              valueBp: 5905
            },
            {
              key: "agility",
              valueBp: 8634
            },
            {
              key: "anticipation",
              valueBp: 5363
            }
          ],
          personId: "player-fa-02",
          primaryRole: "wide_receiver",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2000-12-24",
          capabilities: [
            {
              key: "tackling",
              valueBp: 8366
            },
            {
              key: "processing",
              valueBp: 5095
            },
            {
              key: "run_stopping",
              valueBp: 7824
            },
            {
              key: "coverage_instincts",
              valueBp: 4553
            },
            {
              key: "burst",
              valueBp: 7282
            }
          ],
          personId: "player-fa-03",
          primaryRole: "linebacker",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "1993-01-25",
          capabilities: [
            {
              key: "processing",
              valueBp: 4285
            },
            {
              key: "accuracy",
              valueBp: 7014
            },
            {
              key: "arm_power",
              valueBp: 3743
            },
            {
              key: "agility",
              valueBp: 6472
            },
            {
              key: "anticipation",
              valueBp: 9201
            }
          ],
          personId: "player-fa-04",
          primaryRole: "quarterback",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "1994-02-26",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 6204
            },
            {
              key: "strength",
              valueBp: 8933
            },
            {
              key: "processing",
              valueBp: 5662
            },
            {
              key: "agility",
              valueBp: 8391
            }
          ],
          personId: "player-fa-05",
          primaryRole: "offensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2004-03-27",
          capabilities: [
            {
              key: "route_craft",
              valueBp: 8123
            },
            {
              key: "hands",
              valueBp: 4852
            },
            {
              key: "burst",
              valueBp: 7581
            },
            {
              key: "agility",
              valueBp: 4310
            },
            {
              key: "anticipation",
              valueBp: 7039
            }
          ],
          personId: "player-pr-01",
          primaryRole: "wide_receiver",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2005-04-01",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 4042
            },
            {
              key: "tackling",
              valueBp: 6771
            },
            {
              key: "processing",
              valueBp: 3500
            },
            {
              key: "anticipation",
              valueBp: 6229
            }
          ],
          personId: "player-pr-02",
          primaryRole: "safety",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2004-05-02",
          capabilities: [
            {
              key: "pass_rush",
              valueBp: 5961
            },
            {
              key: "run_stopping",
              valueBp: 8690
            },
            {
              key: "strength",
              valueBp: 5419
            },
            {
              key: "burst",
              valueBp: 8148
            }
          ],
          personId: "player-pr-03",
          primaryRole: "defensive_line",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "2005-06-03",
          capabilities: [
            {
              key: "burst",
              valueBp: 7880
            },
            {
              key: "agility",
              valueBp: 4609
            },
            {
              key: "strength",
              valueBp: 7338
            },
            {
              key: "hands",
              valueBp: 4067
            },
            {
              key: "vision",
              valueBp: 6796
            }
          ],
          personId: "player-pr-04",
          primaryRole: "running_back",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2004-07-04",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 3799
            },
            {
              key: "burst",
              valueBp: 6528
            },
            {
              key: "agility",
              valueBp: 9257
            },
            {
              key: "anticipation",
              valueBp: 5986
            },
            {
              key: "tackling",
              valueBp: 8715
            }
          ],
          personId: "player-pr-05",
          primaryRole: "cornerback",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2005-08-05",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 5718
            },
            {
              key: "strength",
              valueBp: 8447
            },
            {
              key: "processing",
              valueBp: 5176
            },
            {
              key: "agility",
              valueBp: 7905
            }
          ],
          personId: "player-pr-06",
          primaryRole: "offensive_line",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2004-09-06",
          capabilities: [
            {
              key: "processing",
              valueBp: 7637
            },
            {
              key: "accuracy",
              valueBp: 4366
            },
            {
              key: "arm_power",
              valueBp: 7095
            },
            {
              key: "agility",
              valueBp: 3824
            },
            {
              key: "anticipation",
              valueBp: 6553
            }
          ],
          personId: "player-pr-07",
          primaryRole: "quarterback",
          roleTags: ["rotational", "special_teams"]
        },
        {
          birthDate: "2005-10-07",
          capabilities: [
            {
              key: "tackling",
              valueBp: 3556
            },
            {
              key: "processing",
              valueBp: 6285
            },
            {
              key: "run_stopping",
              valueBp: 9014
            },
            {
              key: "coverage_instincts",
              valueBp: 5743
            },
            {
              key: "burst",
              valueBp: 8472
            }
          ],
          personId: "player-pr-08",
          primaryRole: "linebacker",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2004-11-08",
          capabilities: [
            {
              key: "route_craft",
              valueBp: 5475
            },
            {
              key: "hands",
              valueBp: 8204
            },
            {
              key: "burst",
              valueBp: 4933
            },
            {
              key: "agility",
              valueBp: 7662
            },
            {
              key: "anticipation",
              valueBp: 4391
            }
          ],
          personId: "player-pr-09",
          primaryRole: "wide_receiver",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2005-12-09",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 7394
            },
            {
              key: "tackling",
              valueBp: 4123
            },
            {
              key: "processing",
              valueBp: 6852
            },
            {
              key: "anticipation",
              valueBp: 3581
            }
          ],
          personId: "player-pr-10",
          primaryRole: "safety",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2004-01-10",
          capabilities: [
            {
              key: "pass_rush",
              valueBp: 9313
            },
            {
              key: "run_stopping",
              valueBp: 6042
            },
            {
              key: "strength",
              valueBp: 8771
            },
            {
              key: "burst",
              valueBp: 5500
            }
          ],
          personId: "player-pr-11",
          primaryRole: "defensive_line",
          roleTags: ["special_teams"]
        },
        {
          birthDate: "2005-02-11",
          capabilities: [
            {
              key: "burst",
              valueBp: 5232
            },
            {
              key: "agility",
              valueBp: 7961
            },
            {
              key: "strength",
              valueBp: 4690
            },
            {
              key: "hands",
              valueBp: 7419
            },
            {
              key: "vision",
              valueBp: 4148
            }
          ],
          personId: "player-pr-12",
          primaryRole: "running_back",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2004-03-12",
          capabilities: [
            {
              key: "coverage_instincts",
              valueBp: 7151
            },
            {
              key: "burst",
              valueBp: 3880
            },
            {
              key: "agility",
              valueBp: 6609
            },
            {
              key: "anticipation",
              valueBp: 9338
            },
            {
              key: "tackling",
              valueBp: 6067
            }
          ],
          personId: "player-pr-13",
          primaryRole: "cornerback",
          roleTags: ["starter_profile"]
        },
        {
          birthDate: "2005-04-13",
          capabilities: [
            {
              key: "block_technique",
              valueBp: 9070
            },
            {
              key: "strength",
              valueBp: 5799
            },
            {
              key: "processing",
              valueBp: 8528
            },
            {
              key: "agility",
              valueBp: 5257
            }
          ],
          personId: "player-pr-14",
          primaryRole: "offensive_line",
          roleTags: ["special_teams"]
        }
      ],
      rights: [
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-northfield",
          id: "right-player-nf-01",
          kind: "contract",
          playerId: "player-nf-01",
          sourceRecordId: "contract-seed-player-nf-01"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-northfield",
          id: "right-player-nf-02",
          kind: "contract",
          playerId: "player-nf-02",
          sourceRecordId: "contract-seed-player-nf-02"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-northfield",
          id: "right-player-nf-03",
          kind: "contract",
          playerId: "player-nf-03",
          sourceRecordId: "contract-seed-player-nf-03"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-northfield",
          id: "right-player-nf-04",
          kind: "contract",
          playerId: "player-nf-04",
          sourceRecordId: "contract-seed-player-nf-04"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-northfield",
          id: "right-player-nf-05",
          kind: "contract",
          playerId: "player-nf-05",
          sourceRecordId: "contract-seed-player-nf-05"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-southport",
          id: "right-player-sp-01",
          kind: "contract",
          playerId: "player-sp-01",
          sourceRecordId: "contract-seed-player-sp-01"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-southport",
          id: "right-player-sp-02",
          kind: "contract",
          playerId: "player-sp-02",
          sourceRecordId: "contract-seed-player-sp-02"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-southport",
          id: "right-player-sp-03",
          kind: "contract",
          playerId: "player-sp-03",
          sourceRecordId: "contract-seed-player-sp-03"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-southport",
          id: "right-player-sp-04",
          kind: "contract",
          playerId: "player-sp-04",
          sourceRecordId: "contract-seed-player-sp-04"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-southport",
          id: "right-player-sp-05",
          kind: "contract",
          playerId: "player-sp-05",
          sourceRecordId: "contract-seed-player-sp-05"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-eastbrook",
          id: "right-player-eb-01",
          kind: "contract",
          playerId: "player-eb-01",
          sourceRecordId: "contract-seed-player-eb-01"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-eastbrook",
          id: "right-player-eb-02",
          kind: "contract",
          playerId: "player-eb-02",
          sourceRecordId: "contract-seed-player-eb-02"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-eastbrook",
          id: "right-player-eb-03",
          kind: "contract",
          playerId: "player-eb-03",
          sourceRecordId: "contract-seed-player-eb-03"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-eastbrook",
          id: "right-player-eb-04",
          kind: "contract",
          playerId: "player-eb-04",
          sourceRecordId: "contract-seed-player-eb-04"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-westlake",
          id: "right-player-wl-01",
          kind: "contract",
          playerId: "player-wl-01",
          sourceRecordId: "contract-seed-player-wl-01"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-westlake",
          id: "right-player-wl-02",
          kind: "contract",
          playerId: "player-wl-02",
          sourceRecordId: "contract-seed-player-wl-02"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-westlake",
          id: "right-player-wl-03",
          kind: "contract",
          playerId: "player-wl-03",
          sourceRecordId: "contract-seed-player-wl-03"
        },
        {
          effectiveFrom: "2026-03-01",
          effectiveUntil: null,
          holderOrganizationId: "org-westlake",
          id: "right-player-wl-04",
          kind: "contract",
          playerId: "player-wl-04",
          sourceRecordId: "contract-seed-player-wl-04"
        },
        {
          effectiveFrom: "2026-04-25",
          effectiveUntil: null,
          holderOrganizationId: "org-eastbrook",
          id: "right-player-eb-draftee",
          kind: "draft",
          playerId: "player-eb-draftee",
          sourceRecordId: "seed-draft-2026-eb"
        },
        {
          effectiveFrom: "2026-03-15",
          effectiveUntil: null,
          holderOrganizationId: "org-westlake",
          id: "right-player-wl-exclusive",
          kind: "exclusive",
          playerId: "player-wl-exclusive",
          sourceRecordId: "seed-exclusive-wl"
        }
      ],
      waiverPriority: [
        "org-westlake",
        "org-eastbrook",
        "org-southport",
        "org-northfield"
      ]
    },
    provenance: [
      {
        effectiveAsOf: "2027-02-15",
        note: "Synthetic Package C world fixture. Contains no real league data or real people.",
        retrievedAt: "2026-10-17T00:00:00Z",
        sourceId: "sport-sim-synthetic-package-c-world",
        sourceKind: "synthetic",
        validationStatus: "synthetic"
      }
    ],
    rngSeed32: 20261018,
    ruleset: {
      contentHash: "2f1affed310f6764f746395924f68d6648e8e2ccf211a6e410f9e8f3f8c75f23",
      rulesetId: "synthetic-package-c-rules",
      rulesetVersion: 1
    },
    schemaVersion: 1,
    seedId: "synthetic-package-c-world",
    seedVersion: 1,
    startDate: "2027-02-15"
  };
  var PACKAGE_C_SEED = validateSeedManifest(PACKAGE_C_SEED_JSON);

  // packages/sim-core/src/acquisitionAudit.ts
  var byText11 = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  var LIVE_OFFER = /* @__PURE__ */ new Set([
    "communicated",
    "countered",
    "accepted_pending_commit"
  ]);
  var latestOffers2 = (offers) => {
    const latest = /* @__PURE__ */ new Map();
    for (const o of offers) {
      const have = latest.get(o.id);
      if (have === void 0 || o.revision > have.revision) latest.set(o.id, o);
    }
    return [...latest.values()];
  };
  var auditAcquisitionWorld = (world, tx2) => {
    var _a, _b, _c, _d, _e, _f;
    const out = [];
    const today = world.simDate;
    const add2 = (code, detail, subjectIds, organizationId, severity = "error") => {
      out.push(__spreadProps(__spreadValues({
        code,
        severity
      }, organizationId === void 0 ? {} : { organizationId }), {
        subjectIds: [...subjectIds].sort(byText11),
        detail
      }));
    };
    for (const f of rosterInvariantFindings(world.roster, tx2, today))
      add2(
        f.code,
        f.detail,
        f.playerId === null ? [] : [f.playerId],
        (_a = f.organizationId) != null ? _a : void 0
      );
    const activeAgreements = world.contracts.agreements.filter(
      (a) => a.status === "active"
    );
    const perPlayer = /* @__PURE__ */ new Map();
    for (const a of activeAgreements) {
      perPlayer.set(a.playerId, ((_b = perPlayer.get(a.playerId)) != null ? _b : 0) + 1);
      const rights2 = activeRightsFor(world.roster, a.playerId, today);
      if (!rights2.some(
        (r) => r.kind === "contract" && r.holderOrganizationId === a.organizationId
      ))
        add2(
          "CONTRACT_WITHOUT_RIGHT",
          `${a.id} is active for ${a.playerId} but ${a.organizationId} holds no contract right`,
          [a.id, a.playerId],
          a.organizationId
        );
      const problems = contractTermsProblems(tx2, a.terms);
      if (problems.length > 0)
        add2(
          "ILLEGAL_ACTIVE_CONTRACT",
          `${a.id} breaks the ruleset: ${problems[0]}`,
          [a.id, a.playerId],
          a.organizationId
        );
    }
    for (const [playerId, n] of perPlayer)
      if (n > 1)
        add2(
          "DUPLICATE_ACTIVE_CONTRACT",
          `${playerId} has ${n} active contract agreements`,
          [playerId]
        );
    for (const r of world.roster.rights) {
      if (r.kind !== "contract") continue;
      if (!activeRightsFor(world.roster, r.playerId, today).some(
        (x) => x.id === r.id
      ))
        continue;
      if (!activeAgreements.some(
        (a) => a.playerId === r.playerId && a.organizationId === r.holderOrganizationId
      ))
        add2(
          "CONTRACT_RIGHT_WITHOUT_CONTRACT",
          `${r.id} is an active contract right with no active agreement`,
          [r.id, r.playerId],
          r.holderOrganizationId
        );
    }
    const pickIds = /* @__PURE__ */ new Map();
    for (const p of world.draft.picks)
      pickIds.set(p.id, ((_c = pickIds.get(p.id)) != null ? _c : 0) + 1);
    for (const [id, n] of pickIds)
      if (n > 1) add2("DUPLICATE_PICK", `${id} appears ${n} times`, [id]);
    const selectionsByPick = /* @__PURE__ */ new Map();
    const selectionsByPlayer = /* @__PURE__ */ new Map();
    for (const s of world.draft.selections) {
      selectionsByPick.set(s.pickId, ((_d = selectionsByPick.get(s.pickId)) != null ? _d : 0) + 1);
      selectionsByPlayer.set(
        s.playerId,
        ((_e = selectionsByPlayer.get(s.playerId)) != null ? _e : 0) + 1
      );
      const pick = world.draft.picks.find((p) => p.id === s.pickId);
      if (pick === void 0 || pick.status !== "used")
        add2(
          "SELECTION_PICK_NOT_USED",
          `${s.id} used ${s.pickId}, which is not marked used`,
          [s.id, s.pickId],
          s.organizationId
        );
      else if (pick.ownerOrganizationId !== s.organizationId)
        add2(
          "SELECTION_OWNER_MISMATCH",
          `${s.id} was made by ${s.organizationId} but ${s.pickId} is owned by ${pick.ownerOrganizationId}`,
          [s.id, s.pickId],
          s.organizationId
        );
      if (!world.roster.rights.some((r) => r.sourceRecordId === s.id))
        add2(
          "SELECTION_WITHOUT_RIGHT",
          `${s.id} granted no draft right to ${s.playerId}`,
          [s.id, s.playerId],
          s.organizationId
        );
    }
    for (const [id, n] of selectionsByPick)
      if (n > 1)
        add2("DUPLICATE_PICK_SELECTION", `${id} was used ${n} times`, [id]);
    for (const [id, n] of selectionsByPlayer)
      if (n > 1)
        add2("DUPLICATE_PLAYER_SELECTION", `${id} was drafted ${n} times`, [id]);
    if (world.draft.sessions.length > 0) {
      for (const p of world.draft.picks)
        if (p.status === "used" && ((_f = selectionsByPick.get(p.id)) != null ? _f : 0) === 0 && world.draft.sessions.some((s) => s.orderedPickIds.includes(p.id)))
          add2(
            "PICK_USED_WITHOUT_SELECTION",
            `${p.id} is marked used with no selection`,
            [p.id],
            p.ownerOrganizationId
          );
    }
    const orgs = /* @__PURE__ */ new Set([
      ...world.contracts.agreements.map((a) => a.organizationId),
      ...world.market.reservations.map((r) => r.organizationId)
    ]);
    for (const org of [...orgs].sort(byText11)) {
      const seasons = /* @__PURE__ */ new Set();
      for (const a of activeAgreements)
        if (a.organizationId === org)
          for (const y of a.terms.years) seasons.add(y.season);
      for (const r of world.market.reservations)
        if (r.organizationId === org && r.status === "active")
          for (const c of r.capBySeason) seasons.add(c.season);
      for (const season of [...seasons].sort((a, b) => a - b)) {
        try {
          const position = capPosition(tx2, world.contracts, org, season);
          if (position.committed > position.cap)
            add2(
              "CAP_EXCEEDED",
              `${org} has ${position.committed} committed in ${season}, cap ${position.cap}`,
              [org, String(season)],
              org
            );
          const held = reservedCap(world.market, org, season);
          if (position.committed + held > position.cap)
            add2(
              "RESERVATION_CAP_OVERCOMMIT",
              `${org} has ${position.committed} committed and ${held} reserved in ${season}, cap ${position.cap}`,
              [org, String(season)],
              org
            );
        } catch (e) {
          if (!(e instanceof UnknownTransactionSeasonError)) throw e;
        }
      }
      const capacity = rosterCapacity(world.roster, tx2, org, today);
      for (const status of ROSTER_STATUSES) {
        const held = reservedSlots(world.market, org, status);
        if (capacity[status].count + held > capacity[status].limit)
          add2(
            "RESERVATION_SLOT_OVERCOMMIT",
            `${org} has ${capacity[status].count} ${status} players and ${held} reserved, limit ${capacity[status].limit}`,
            [org, status],
            org
          );
      }
    }
    const offers = latestOffers2(world.market.contractOffers);
    const reservationOf = (id) => id === null ? void 0 : world.market.reservations.find((r) => r.id === id);
    for (const o of offers) {
      const res = reservationOf(o.reservationId);
      if (LIVE_OFFER.has(o.status) && (res === void 0 || res.status !== "active"))
        add2(
          "LIVE_OFFER_WITHOUT_RESERVATION",
          `${o.id} is ${o.status} but its reservation is not active`,
          [o.id, ...o.reservationId === null ? [] : [o.reservationId]],
          o.organizationId
        );
      if (o.status === "committed") {
        if (res !== void 0 && res.status === "active")
          add2(
            "COMMITTED_OFFER_STILL_RESERVED",
            `${o.id} is committed but still holds an active reservation`,
            [o.id, ...o.reservationId === null ? [] : [o.reservationId]],
            o.organizationId
          );
        if (!world.contracts.agreements.some((a) => a.sourceOfferId === o.id))
          add2(
            "COMMITTED_OFFER_WITHOUT_AGREEMENT",
            `${o.id} is committed with no agreement`,
            [o.id],
            o.organizationId
          );
      }
    }
    for (const r of world.market.reservations) {
      if (r.status !== "active") continue;
      if (r.sourceKind === "contract_offer") {
        const o = offers.find((x) => x.id === r.sourceRecordId);
        if (o === void 0 || !LIVE_OFFER.has(o.status))
          add2(
            "ORPHAN_RESERVATION",
            `${r.id} is active but its offer is not live`,
            [r.id, r.sourceRecordId],
            r.organizationId,
            "warning"
          );
      } else if (r.sourceKind === "waiver_claim") {
        const c = world.roster.waiverClaims.find(
          (x) => x.id === r.sourceRecordId
        );
        if (c === void 0 || !c.active)
          add2(
            "ORPHAN_RESERVATION",
            `${r.id} is active but its waiver claim is not`,
            [r.id, r.sourceRecordId],
            r.organizationId,
            "warning"
          );
      }
    }
    for (const t of world.market.tradeOffers) {
      if (t.status !== "open" && t.status !== "accepted") continue;
      for (const a of [...t.package.assetsFromA, ...t.package.assetsFromB]) {
        if (a.kind !== "draft_pick") continue;
        const pick = world.draft.picks.find((p) => p.id === a.pickId);
        if ((pick == null ? void 0 : pick.status) === "used")
          add2(
            "USED_PICK_IN_LIVE_TRADE",
            `${t.id} still offers ${assetKey(a)}, which has been used`,
            [t.id, a.pickId],
            t.proposerOrganizationId
          );
      }
    }
    for (const w of world.roster.waivers) {
      if (w.status !== "open") continue;
      const agreement = world.contracts.agreements.find(
        (a) => a.id === w.contractAgreementId
      );
      const holds = activeRightsFor(world.roster, w.playerId, today).some(
        (r) => r.kind === "contract" && r.holderOrganizationId === w.waivingOrganizationId
      );
      if (agreement === void 0 || agreement.status !== "active" || agreement.playerId !== w.playerId || agreement.organizationId !== w.waivingOrganizationId || !holds)
        add2(
          "WAIVER_CONTRACT_RIGHT_MISMATCH",
          `${w.id}: the waiving club's contract and right for ${w.playerId} do not line up`,
          [w.id, w.playerId],
          w.waivingOrganizationId
        );
      if (currentRosterMembership(world.roster, w.playerId, today) !== void 0)
        add2(
          "WAIVER_PLAYER_STILL_ROSTERED",
          `${w.playerId} is on a roster while waiver ${w.id} is open`,
          [w.id, w.playerId],
          w.waivingOrganizationId
        );
    }
    const claimHeldBy = (claimId, org) => {
      const c = world.information.claims.find((x) => x.id === claimId);
      return c !== void 0 && (c.visibility === "public" || c.holderOrganizationIds.includes(org));
    };
    const beliefOf = (beliefId, org) => world.information.beliefs.some(
      (b) => b.id === beliefId && b.organizationId === org
    );
    for (const b of world.draft.boards)
      for (const e of b.tiers.flatMap((t) => t.entries)) {
        for (const id of e.beliefIds)
          if (!beliefOf(id, b.organizationId))
            add2(
              "INACCESSIBLE_BOARD_REFERENCE",
              `${b.id} cites belief ${id}, which ${b.organizationId} does not own`,
              [b.id, id],
              b.organizationId
            );
        for (const id of e.noteClaimIds)
          if (!claimHeldBy(id, b.organizationId))
            add2(
              "INACCESSIBLE_BOARD_REFERENCE",
              `${b.id} cites claim ${id}, which ${b.organizationId} cannot see`,
              [b.id, id],
              b.organizationId
            );
      }
    for (const r of world.scouting.reports) {
      const org = r.organizationId;
      for (const id of r.evidenceClaimIds)
        if (!claimHeldBy(id, org))
          add2(
            "INACCESSIBLE_SCOUTING_REFERENCE",
            `${r.id} cites claim ${id}, which ${org} cannot see`,
            [r.id, id],
            org
          );
    }
    const hasReceipt = (proposalId) => proposalId !== null && world.decisions.receipts.some((x) => x.proposalId === proposalId);
    for (const a of world.contracts.agreements)
      if (a.sourceProposalId !== null && !hasReceipt(a.sourceProposalId))
        add2(
          "MISSING_RECEIPT",
          `${a.id} executed proposal ${a.sourceProposalId} with no receipt`,
          [a.id, a.sourceProposalId],
          a.organizationId
        );
    for (const s of world.draft.selections)
      if (!hasReceipt(s.organizationProposalId))
        add2(
          "MISSING_RECEIPT",
          `${s.id} executed proposal ${s.organizationProposalId} with no receipt`,
          [s.id, s.organizationProposalId],
          s.organizationId
        );
    for (const b of world.draft.boards)
      if (!hasReceipt(b.organizationProposalId))
        add2(
          "MISSING_RECEIPT",
          `${b.id} executed proposal ${b.organizationProposalId} with no receipt`,
          [b.id, b.organizationProposalId],
          b.organizationId
        );
    for (const r of world.decisions.receipts)
      if (r.outcomeEventIds.length === 0)
        add2("RECEIPT_WITHOUT_OUTCOME", `${r.id} records no outcome event`, [
          r.id,
          r.proposalId
        ]);
    return out.sort(
      (a, b) => {
        var _a2, _b2;
        return byText11(a.code, b.code) || byText11((_a2 = a.organizationId) != null ? _a2 : "", (_b2 = b.organizationId) != null ? _b2 : "") || byText11(a.subjectIds.join(","), b.subjectIds.join(",")) || byText11(a.detail, b.detail);
      }
    );
  };

  // packages/sim-core/src/packageCScenario.ts
  var PACKAGE_C_SCENARIO_ID = "package-c-golden-v1";
  var PACKAGE_C_WORLD_ID = "world-package-c-1";
  var ORGS = {
    nf: { org: "org-northfield", gm: "person-nf-gm", scout: "person-nf-scout" },
    sp: { org: "org-southport", gm: "person-sp-gm", scout: "person-sp-scout" },
    eb: { org: "org-eastbrook", gm: "person-eb-gm", scout: "person-eb-scout" },
    wl: { org: "org-westlake", gm: "person-wl-gm", scout: "person-wl-scout" }
  };
  var NF = ORGS.nf;
  var SP = ORGS.sp;
  var EB = ORGS.eb;
  var WL = ORGS.wl;
  var GM_OF = {
    [NF.org]: NF.gm,
    [SP.org]: SP.gm,
    [EB.org]: EB.gm,
    [WL.org]: WL.gm
  };
  var PROSPECT = "player-pr-01";
  var NF_PICK = "pick-2027-r1-s4";
  var EB_PICK = "pick-2027-r2-s2";
  var harness = {
    kind: "test_harness",
    id: entityId("package-c-harness")
  };
  var PackageCScenarioError = class extends Error {
    constructor(message) {
      super(`Package C scenario violated: ${message}`);
      this.name = "PackageCScenarioError";
    }
  };
  var require_ = (ok3, message) => {
    if (!ok3) throw new PackageCScenarioError(message);
  };
  var tx = requireTransactionRules(SYNTHETIC_PACKAGE_C_RULESET);
  var lastOf = (xs) => xs[xs.length - 1].id;
  var lastClaim = (k) => lastOf(k.world.information.claims);
  var lastBelief = (k) => lastOf(k.world.information.beliefs);
  var lastProposal = (k) => lastOf(k.world.decisions.proposals);
  var rightsAsset = (k, playerId) => {
    const r = activeRightsFor(
      k.world.roster,
      entityId(playerId),
      k.world.simDate
    )[0];
    return { kind: "player_rights", playerId: r.playerId, rightsId: r.id };
  };
  var pickAsset = (id) => ({
    kind: "draft_pick",
    pickId: id
  });
  var pkg = (a, b, from, to) => ({
    organizationAId: entityId(a),
    organizationBId: entityId(b),
    assetsFromA: from,
    assetsFromB: to,
    validity: { expiresAt: null },
    contingencies: {}
  });
  var daysTo = (k, date) => Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${k.world.simDate}T00:00:00Z`)) / 864e5
  );
  var claimCmd = (org, by, player, propositionType, proposition, family, k) => ({
    type: "RecordClaim",
    organizationId: org,
    actingPersonId: by,
    subject: { kind: "entity", id: player },
    propositionType,
    proposition,
    sourceFamilyId: family,
    observedAt: k.world.simDate,
    visibility: "organization",
    confidence: "medium",
    possibleBias: null,
    corroboratesClaimIds: [],
    contradictsClaimIds: []
  });
  var observation = (org, by, dimension, family, signal = "positive", player = PROSPECT) => (c) => claimCmd(
    org,
    by,
    player,
    "prospect_observation",
    { dimension, signal },
    family,
    c.k
  );
  var proposalCmd = (org, by, category, subjects, termsType, terms, approvers = []) => ({
    type: "SubmitProposal",
    organizationId: org,
    actingPersonId: by,
    category,
    subjects,
    termsType,
    terms,
    requiredApproverPersonIds: approvers,
    expiresAt: null,
    contingencies: {}
  });
  var planTermsFor = (owner, window2) => ({
    planId: null,
    kind: "strategy",
    scopeKey: "franchise",
    ownerPersonId: owner,
    effectiveAt: "2027-02-15",
    horizon: { seasons: 3 },
    objectives: [{ key: "competitive_window", priority: "high", target: window2 }],
    constraints: [],
    triggerRefs: [],
    fallbackPlanIds: [],
    changeReasonRefs: []
  });
  var steps = [];
  var add = (label, command, extra = {}) => {
    steps.push(__spreadValues({
      label,
      expect: "committed",
      command: typeof command === "function" ? command : () => command
    }, extra));
  };
  var adoptPlan = (key, org, gm, window2) => {
    add(
      `plan-propose-${key}`,
      proposalCmd(
        org,
        gm,
        "organizational_plan",
        [{ kind: "entity", id: org }],
        "organization_plan_v1",
        planTermsFor(gm, window2)
      ),
      {
        after: (c) => {
          c.m[`${key}PlanProposal`] = lastProposal(c.k);
        }
      }
    );
    add(`plan-commit-${key}`, (c) => ({
      type: "CommitPlanProposal",
      actingPersonId: gm,
      proposalId: c.m[`${key}PlanProposal`],
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: "adopt the plan" }
    }));
  };
  adoptPlan("nf", NF.org, NF.gm, "contend");
  adoptPlan("sp", SP.org, SP.gm, "contend");
  adoptPlan("eb", EB.org, EB.gm, "rebuild");
  adoptPlan("wl", WL.org, WL.gm, "rebuild");
  add(
    "nf-observe-processing",
    observation(NF.org, NF.scout, "processing", "nf-camp"),
    {
      after: (c) => {
        c.m.nfClaimA = lastClaim(c.k);
      }
    }
  );
  add(
    "nf-observe-coverage",
    observation(NF.org, NF.scout, "coverage_instincts", "nf-film"),
    {
      after: (c) => {
        c.m.nfClaimB = lastClaim(c.k);
      }
    }
  );
  add("eb-observe-burst", observation(EB.org, EB.scout, "burst", "eb-camp"), {
    after: (c) => {
      c.m.ebClaimA = lastClaim(c.k);
    }
  });
  add(
    "eb-observe-route",
    observation(EB.org, EB.scout, "route_craft", "eb-film", "mixed"),
    {
      after: (c) => {
        c.m.ebClaimB = lastClaim(c.k);
      }
    }
  );
  var scoutQuestion = (key, org, scout, pick, dims) => {
    add(
      `${key}-ask`,
      {
        type: "AskScoutingQuestion",
        organizationId: org,
        actingPersonId: scout,
        playerId: PROSPECT,
        questionKey: "can_start_in_year_one",
        dimensions: dims,
        decisionContext: { kind: "draft_selection", pickId: pick }
      },
      {
        after: (c) => {
          c.m[`${key}Question`] = lastOf(c.k.world.scouting.questions);
        }
      }
    );
    add(
      `${key}-assign`,
      (c) => ({
        type: "AssignScoutingEvaluation",
        actingPersonId: scout,
        questionId: c.m[`${key}Question`],
        evaluatorPersonId: scout,
        evidenceClaimIds: [c.m[`${key}ClaimA`], c.m[`${key}ClaimB`]]
      }),
      {
        after: (c) => {
          c.m[`${key}Assignment`] = lastOf(c.k.world.scouting.assignments);
        }
      }
    );
  };
  scoutQuestion("nf", NF.org, NF.scout, NF_PICK, [
    "processing",
    "coverage_instincts"
  ]);
  scoutQuestion("eb", EB.org, EB.scout, EB_PICK, ["burst", "route_craft"]);
  add("advance-scouting-day", { type: "AdvanceDays", days: 1 });
  for (const key of ["nf", "eb"]) {
    const who = key === "nf" ? NF : EB;
    add(
      `${key}-resolve`,
      (c) => ({
        type: "ResolveScoutingAssignment",
        actingPersonId: who.scout,
        assignmentId: c.m[`${key}Assignment`]
      }),
      {
        after: (c) => {
          const report = c.k.world.scouting.reports.at(-1);
          c.m[`${key}Report`] = report.id;
          c.m[`${key}Belief`] = report.beliefId;
        }
      }
    );
  }
  var boardTerms = (c, key, need) => ({
    draftClassId: c.k.world.draft.classes[0].id,
    tiers: [
      {
        tier: key === "nf" ? 1 : 2,
        entries: [
          {
            playerId: PROSPECT,
            beliefIds: [c.m[`${key}Belief`]],
            roleProjection: key === "nf" ? "coverage" : "receiver",
            withinTierOrder: null,
            needPriority: need,
            planIds: [],
            noteClaimIds: []
          }
        ]
      }
    ]
  });
  for (const key of ["nf", "eb"]) {
    const who = key === "nf" ? NF : EB;
    add(
      `${key}-board-propose`,
      (c) => proposalCmd(
        who.org,
        who.gm,
        "acquisition",
        [{ kind: "entity", id: who.org }],
        DRAFT_BOARD_TERMS_TYPE,
        boardTerms(c, key, "normal")
      ),
      {
        after: (c) => {
          c.m[`${key}BoardProposal`] = lastProposal(c.k);
        }
      }
    );
    add(
      `${key}-board-commit`,
      (c) => ({
        type: "CommitDraftBoardProposal",
        actingPersonId: who.gm,
        proposalId: c.m[`${key}BoardProposal`],
        expectedRevision: 1,
        rationale: { note: "first board" }
      }),
      {
        after: (c) => {
          c.m[`${key}Board1`] = lastOf(c.k.world.draft.boards);
        }
      }
    );
  }
  add(
    "nf-board-need-propose",
    (c) => proposalCmd(
      NF.org,
      NF.gm,
      "acquisition",
      [{ kind: "entity", id: NF.org }],
      DRAFT_BOARD_TERMS_TYPE,
      boardTerms(c, "nf", "must_address")
    ),
    {
      after: (c) => {
        c.m.nfBoardProposal2 = lastProposal(c.k);
      }
    }
  );
  add(
    "nf-board-need-commit",
    (c) => ({
      type: "CommitDraftBoardProposal",
      actingPersonId: NF.gm,
      proposalId: c.m.nfBoardProposal2,
      expectedRevision: 1,
      supersedesBoardRevisionId: c.m.nfBoard1,
      rationale: { note: "need changed" }
    }),
    {
      after: (c) => {
        var _a;
        c.m.nfBoard2 = lastOf(c.k.world.draft.boards);
        const first = c.k.world.draft.boards.find((b) => b.id === c.m.nfBoard1);
        const second = c.k.world.draft.boards.find((b) => b.id === c.m.nfBoard2);
        require_(
          canonicalString(first.tiers.map((t) => t.tier)) === canonicalString(second.tiers.map((t) => t.tier)),
          "a need change must not move the prospect between tiers"
        );
        require_(
          ((_a = latestBoard(c.k.world, entityId(NF.org), first.draftClassId)) == null ? void 0 : _a.id) === second.id,
          "latest board is the revision"
        );
      }
    }
  );
  var capNow = (k, org, season) => capPosition(tx, k.world.contracts, entityId(org), season).committed;
  var tradeFlow = (key, a, b, build, opts) => {
    add(
      `${key}-propose-a`,
      (c) => proposalCmd(
        a.org,
        a.gm,
        "acquisition",
        [{ kind: "entity", id: b.org }],
        "trade_package_v1",
        tradePackageTerms(build(c.k))
      ),
      {
        after: (c) => {
          c.m[`${key}ProposalA`] = lastProposal(c.k);
        }
      }
    );
    add(
      `${key}-post`,
      (c) => ({
        type: "PostTradeOffer",
        actingPersonId: a.gm,
        proposalId: c.m[`${key}ProposalA`],
        expectedRevision: 1
      }),
      {
        after: (c) => {
          c.m[`${key}Offer`] = lastOf(c.k.world.market.tradeOffers);
        }
      }
    );
    if (opts.ask === true)
      add(
        `${key}-ask`,
        (c) => ({
          type: "RequestTradeResponse",
          actingPersonId: a.gm,
          offerId: c.m[`${key}Offer`],
          offerRevision: 1
        }),
        {
          after: (c) => {
            const r = c.k.world.market.responses.at(-1);
            c.m[`${key}Disposition`] = r.disposition;
            require_(
              r.disposition !== "accept",
              "a club with its own reasons must not simply accept this package"
            );
          }
        }
      );
    if (opts.commit !== true) return;
    add(
      `${key}-propose-b`,
      (c) => proposalCmd(
        b.org,
        b.gm,
        "acquisition",
        [{ kind: "entity", id: a.org }],
        "trade_package_v1",
        tradePackageTerms(build(c.k))
      ),
      {
        after: (c) => {
          c.m[`${key}ProposalB`] = lastProposal(c.k);
        }
      }
    );
    add(`${key}-answer`, (c) => ({
      type: "AnswerTradeOffer",
      actingPersonId: b.gm,
      offerId: c.m[`${key}Offer`],
      offerRevision: 1,
      answer: "accept"
    }));
    const side = (by) => ({
      actingPersonId: by,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: "trade" }
    });
    add(
      `${key}-commit`,
      (c) => ({
        type: "CommitTradeAgreement",
        actingPersonId: a.gm,
        offerId: c.m[`${key}Offer`],
        offerRevision: 1,
        counterpartyProposalId: c.m[`${key}ProposalB`],
        proposerSide: side(a.gm),
        counterpartySide: side(b.gm)
      }),
      {
        before: (c) => {
          if (opts.preview !== true) return;
          const p = build(c.k);
          const view = (o) => ({
            preview: previewAcquisitionImpact(
              c.k.world,
              tx,
              p,
              c.k.world.simDate,
              entityId(o.org)
            ),
            cap: [2027, 2028, 2029, 2030].map((s) => capNow(c.k, o.org, s)),
            slots: rosterCapacity(
              c.k.world.roster,
              tx,
              entityId(o.org),
              c.k.world.simDate
            ).active.count
          });
          c.m[`${key}PreviewA`] = JSON.stringify(view(a));
          c.m[`${key}PreviewB`] = JSON.stringify(view(b));
        },
        after: (c) => {
          if (opts.preview !== true) return;
          for (const [o, tag] of [
            [a, "A"],
            [b, "B"]
          ]) {
            const before = JSON.parse(c.m[`${key}Preview${tag}`]);
            [2027, 2028, 2029, 2030].forEach((season, i) => {
              var _a, _b;
              const promised = (_b = (_a = before.preview.capDeltaBySeason.find((d) => d.season === season)) == null ? void 0 : _a.delta) != null ? _b : 0;
              const actual = capNow(c.k, o.org, season) - before.cap[i];
              require_(
                promised === actual,
                `${key}: the preview promised ${promised} for ${o.org} in ${season} but the trade changed it by ${actual}`
              );
            });
            const active = rosterCapacity(
              c.k.world.roster,
              tx,
              entityId(o.org),
              c.k.world.simDate
            ).active.count;
            require_(
              active === before.preview.activeSlotsAfter,
              `${key}: the preview promised ${before.preview.activeSlotsAfter} active slots for ${o.org}, found ${active}`
            );
          }
        }
      }
    );
  };
  add(
    "eb-note-nf02",
    (c) => claimCmd(
      EB.org,
      EB.scout,
      "player-nf-02",
      "player_note",
      { note: "skill set does not fit our plan" },
      "eb-pro-dept",
      c.k
    ),
    {
      after: (c) => {
        c.m.ebNoteClaim = lastClaim(c.k);
      }
    }
  );
  add(
    "eb-avoid-nf02",
    (c) => ({
      type: "FormBelief",
      organizationId: EB.org,
      actingPersonId: EB.gm,
      subject: { kind: "entity", id: "player-nf-02" },
      assessmentType: "acquisition_tier",
      assessment: { tier: "avoid" },
      confidence: "medium",
      evidenceClaimIds: [c.m.ebNoteClaim],
      supersedesBeliefId: null
    }),
    {
      after: (c) => {
        c.m.ebAvoidBelief = lastBelief(c.k);
      }
    }
  );
  for (const target of [EB, WL]) {
    add(
      `nf-shop-nf01-${target === EB ? "eb" : "wl"}`,
      (c) => ({
        type: "SubmitMarketInquiry",
        organizationId: NF.org,
        actingPersonId: NF.gm,
        contactedOrganizationId: target.org,
        asset: rightsAsset(c.k, "player-nf-01"),
        direction: "shop"
      }),
      {
        after: (c) => {
          c.m[`shop${target === EB ? "Eb" : "Wl"}`] = lastOf(
            c.k.world.market.inquiries
          );
        }
      }
    );
  }
  tradeFlow(
    "dump",
    NF,
    EB,
    (k) => pkg(
      NF.org,
      EB.org,
      [rightsAsset(k, "player-nf-02")],
      [rightsAsset(k, "player-eb-03")]
    ),
    { ask: true }
  );
  tradeFlow(
    "swap",
    NF,
    EB,
    (k) => pkg(
      NF.org,
      EB.org,
      [rightsAsset(k, "player-nf-01")],
      [rightsAsset(k, "player-eb-04")]
    ),
    { commit: true, preview: true }
  );
  add(
    "nf-release-propose",
    proposalCmd(
      NF.org,
      NF.gm,
      "roster",
      [{ kind: "entity", id: "player-nf-04" }],
      "release_player_v1",
      { playerId: "player-nf-04" }
    ),
    {
      after: (c) => {
        c.m.releaseProposal = lastProposal(c.k);
      },
      before: (c) => {
        c.m["cap:nf2027BeforeRelease"] = String(capNow(c.k, NF.org, 2027));
        c.m["cap:nf2028BeforeRelease"] = String(capNow(c.k, NF.org, 2028));
      }
    }
  );
  add(
    "nf-release-commit",
    (c) => ({
      type: "CommitReleaseProposal",
      actingPersonId: NF.gm,
      proposalId: c.m.releaseProposal,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: "cut down" }
    }),
    {
      after: (c) => {
        c.m.waiver = lastOf(c.k.world.roster.waivers);
        c.m["cap:nf2027AfterRelease"] = String(capNow(c.k, NF.org, 2027));
        c.m["cap:nf2028AfterRelease"] = String(capNow(c.k, NF.org, 2028));
      }
    }
  );
  for (const o of [SP, EB, WL])
    add(`waiver-claim-${o.org.slice(4, 6)}`, (c) => ({
      type: "SubmitWaiverClaim",
      organizationId: o.org,
      actingPersonId: o.gm,
      waiverId: c.m.waiver,
      rosterStatus: "active"
    }));
  add("advance-waiver-day", { type: "AdvanceDays", days: 1 });
  add(
    "resolve-waivers",
    { type: "ResolveWaivers" },
    {
      after: (c) => {
        const w = c.k.world.roster.waivers.find((x) => x.id === c.m.waiver);
        require_(
          w.status === "awarded" && w.winnerOrganizationId !== null,
          "the waiver should be awarded to a claimant"
        );
        c.m.waiverWinner = String(w.winnerOrganizationId);
      }
    }
  );
  var termsOf = (s) => {
    var _a, _b;
    const start = (_a = s.start) != null ? _a : 2027;
    return {
      startSeason: start,
      signingBonus: moneyAmount((_b = s.signing) != null ? _b : 0),
      years: Array.from({ length: s.years }, (_, i) => {
        var _a2;
        return {
          season: start + i,
          baseSalary: moneyAmount(s.base),
          rosterBonus: moneyAmount(0),
          guaranteedBase: moneyAmount((_a2 = s.guaranteed) != null ? _a2 : 0)
        };
      })
    };
  };
  var SECURE = { years: 2, base: 1e5, guaranteed: 1e5 };
  var FRONT = { years: 2, base: 6e4, signing: 1e5 };
  var offerFor = (key, o, playerId, opts) => {
    var _a, _b;
    const role = (_a = opts.role) != null ? _a : "starter";
    const target = (_b = opts.target) != null ? _b : "active";
    add(
      `${key}-contract-propose`,
      proposalCmd(
        o.org,
        o.gm,
        "contract",
        [{ kind: "entity", id: playerId }],
        CONTRACT_OFFER_TERMS_TYPE,
        contractOfferProposalTerms({
          playerId: entityId(playerId),
          targetRosterStatus: target,
          roleCommitment: role,
          terms: opts.terms
        })
      ),
      {
        after: (c) => {
          c.m[`${key}ContractProposal`] = lastProposal(c.k);
        }
      }
    );
    add(
      `${key}-offer`,
      (c) => {
        var _a2, _b2;
        return {
          type: "SubmitContractOffer",
          organizationId: o.org,
          actingPersonId: o.gm,
          proposalId: c.m[`${key}ContractProposal`],
          expectedRevision: 1,
          playerId,
          agentPersonId: agentFor(c.k.world, entityId(playerId), c.k.world.simDate),
          terms: opts.terms,
          roleCommitment: role,
          targetRosterStatus: target,
          priority: (_a2 = opts.priority) != null ? _a2 : 0,
          contingencyGroupId: (_b2 = opts.group) != null ? _b2 : null
        };
      },
      {
        after: (c) => {
          c.m[`${key}Offer`] = lastOf(c.k.world.market.contractOffers);
        }
      }
    );
  };
  var offerRecord = (c, key) => {
    const id = c.m[`${key}Offer`];
    return c.k.world.market.contractOffers.filter((x) => x.id === id).sort((a, b) => a.revision - b.revision).at(-1);
  };
  var signStep = (key, o, expectStatus) => {
    add(
      `${key}-sign`,
      (c) => {
        const offer = offerRecord(c, key);
        require_(
          offer.status === expectStatus,
          `${key}: offer is ${offer.status} (${offer.communicated.join(",")}), expected ${expectStatus}`
        );
        return {
          type: "CommitContractSigning",
          actingPersonId: o.gm,
          offerId: offer.id,
          offerRevision: offer.revision,
          expectedRevision: 1,
          beliefIds: [],
          evidenceClaimIds: [],
          rationale: { note: "sign" }
        };
      },
      {
        before: (c) => {
          c.m[`cap:${key}SigningBefore2028`] = String(capNow(c.k, o.org, 2028));
        },
        after: (c) => {
          c.m[`cap:${key}SigningAfter2028`] = String(capNow(c.k, o.org, 2028));
        }
      }
    );
  };
  add("advance-to-free-agency", (c) => ({
    type: "AdvanceDays",
    days: daysTo(c.k, "2027-03-10")
  }));
  offerFor("eb-fa01", EB, "player-fa-01", {
    terms: termsOf(SECURE),
    priority: 0,
    group: "eb-receiver"
  });
  offerFor("eb-fa02", EB, "player-fa-02", {
    terms: termsOf(FRONT),
    priority: 5,
    group: "eb-receiver"
  });
  offerFor("wl-fa01", WL, "player-fa-01", {
    terms: termsOf(__spreadProps(__spreadValues({}, SECURE), { signing: 4e4 })),
    priority: 0
  });
  add(
    "resolve-free-agency-1",
    { type: "ResolveFreeAgencyMarket" },
    {
      after: (c) => {
        for (const key of ["eb-fa01", "eb-fa02", "wl-fa01"])
          c.m[`status:${key}`] = offerRecord(c, key).status;
      }
    }
  );
  signStep("wl-fa01", WL, "accepted_pending_commit");
  signStep("eb-fa02", EB, "accepted_pending_commit");
  offerFor("eb-ext02", EB, "player-eb-02", {
    terms: termsOf({ years: 4, base: 2e5, guaranteed: 1e5 }),
    priority: 0
  });
  offerFor("sp-ps04", SP, "player-fa-04", {
    terms: termsOf({ years: 1, base: 2e4 }),
    role: "starter",
    target: "practice_squad",
    priority: 0
  });
  add("resolve-free-agency-2", { type: "ResolveFreeAgencyMarket" });
  signStep("eb-ext02", EB, "accepted_pending_commit");
  signStep("sp-ps04", SP, "accepted_pending_commit");
  add("advance-toward-draft", (c) => ({
    type: "AdvanceDays",
    days: Math.min(30, daysTo(c.k, "2027-04-25"))
  }));
  add("advance-to-draft-day", (c) => ({
    type: "AdvanceDays",
    days: daysTo(c.k, "2027-04-25")
  }));
  add(
    "open-draft",
    (c) => ({
      type: "OpenDraft",
      draftClassId: c.k.world.draft.classes[0].id
    }),
    {
      after: (c) => {
        c.m.draftSession = c.k.world.draft.sessions[0].id;
      }
    }
  );
  tradeFlow(
    "picktrade",
    NF,
    EB,
    () => pkg(NF.org, EB.org, [pickAsset(NF_PICK)], [pickAsset(EB_PICK)]),
    { commit: true, preview: true }
  );
  var onClock = (k) => {
    const s = k.world.draft.sessions[0];
    return k.world.draft.picks.find(
      (p) => p.id === s.orderedPickIds[s.currentIndex]
    );
  };
  var choose = (c, org) => {
    const klass = c.k.world.draft.classes[0];
    const taken = new Set(c.k.world.draft.selections.map((s) => s.playerId));
    const free = klass.eligiblePlayerIds.filter((p) => !taken.has(p));
    if (c.variant === "alternate") return { playerId: free[0], boardId: null };
    const board = latestBoard(c.k.world, entityId(org), klass.id);
    const entry = board == null ? void 0 : board.tiers.flatMap((t) => t.entries).find((e) => free.includes(e.playerId));
    if (board !== void 0 && entry !== void 0)
      return { playerId: entry.playerId, boardId: board.id };
    return { playerId: free[free.length - 1], boardId: null };
  };
  for (let i = 0; i < 12; i += 1) {
    const slot = String(i + 1).padStart(2, "0");
    add(
      `draft-${slot}-propose`,
      (c) => {
        const pick = onClock(c.k);
        const org = pick.ownerOrganizationId;
        const { playerId } = choose(c, org);
        return proposalCmd(
          org,
          GM_OF[org],
          "acquisition",
          [{ kind: "entity", id: org }],
          DRAFT_SELECTION_TERMS_TYPE,
          { sessionId: c.m.draftSession, pickId: pick.id, playerId }
        );
      },
      {
        after: (c) => {
          c.m[`draftProposal${slot}`] = lastProposal(c.k);
        }
      }
    );
    add(
      `draft-${slot}-select`,
      (c) => {
        const pick = onClock(c.k);
        const org = pick.ownerOrganizationId;
        const { boardId } = choose(c, org);
        return __spreadValues({
          type: "MakeDraftSelection",
          actingPersonId: GM_OF[org],
          proposalId: c.m[`draftProposal${slot}`],
          expectedRevision: 1,
          rationale: { note: "draft" }
        }, boardId === null ? {} : { boardRevisionId: boardId });
      },
      {
        after: (c) => {
          const sel = c.k.world.draft.selections.at(-1);
          if (sel.pickId === NF_PICK)
            require_(
              sel.organizationId === EB.org,
              "the traded pick must be used by its new owner"
            );
          c.m[`selection${slot}`] = sel.id;
        }
      }
    );
  }
  var rookieOwner = (k) => {
    const sel = k.world.draft.selections.find((s) => s.playerId === PROSPECT);
    return sel === void 0 ? void 0 : { sel, org: sel.organizationId };
  };
  add(
    "rookie-contract-propose",
    (c) => {
      var _a;
      const { sel, org } = (_a = rookieOwner(c.k)) != null ? _a : { sel: void 0, org: "" };
      require_(sel !== void 0, "the board prospect should have been drafted");
      const round = c.k.world.draft.picks.find(
        (p) => p.id === sel.pickId
      ).round;
      const rule = tx.draft.rookieContractByRound.find((r) => r.round === round);
      return proposalCmd(
        org,
        GM_OF[org],
        "contract",
        [{ kind: "entity", id: PROSPECT }],
        CONTRACT_OFFER_TERMS_TYPE,
        contractOfferProposalTerms({
          playerId: entityId(PROSPECT),
          targetRosterStatus: "active",
          roleCommitment: "starter",
          terms: rookieScaleTerms(rule, 2027)
        })
      );
    },
    {
      after: (c) => {
        c.m.rookieContractProposal = lastProposal(c.k);
      }
    }
  );
  add(
    "rookie-offer",
    (c) => {
      const { sel, org } = rookieOwner(c.k);
      const round = c.k.world.draft.picks.find((p) => p.id === sel.pickId).round;
      const rule = tx.draft.rookieContractByRound.find((r) => r.round === round);
      return {
        type: "SubmitContractOffer",
        organizationId: org,
        actingPersonId: GM_OF[org],
        proposalId: c.m.rookieContractProposal,
        expectedRevision: 1,
        playerId: PROSPECT,
        agentPersonId: agentFor(c.k.world, entityId(PROSPECT), c.k.world.simDate),
        terms: rookieScaleTerms(rule, 2027),
        roleCommitment: "starter",
        targetRosterStatus: "active",
        priority: 0,
        contingencyGroupId: null
      };
    },
    {
      after: (c) => {
        c.m.rookieOffer = lastOf(c.k.world.market.contractOffers);
      }
    }
  );
  var undrafted = (k) => {
    const taken = new Set(k.world.draft.selections.map((s) => s.playerId));
    return k.world.draft.classes[0].eligiblePlayerIds.find(
      (p) => !taken.has(p)
    );
  };
  add(
    "udfa-contract-propose",
    (c) => {
      const player = undrafted(c.k);
      c.m.udfaPlayer = player;
      return proposalCmd(
        SP.org,
        SP.gm,
        "contract",
        [{ kind: "entity", id: player }],
        CONTRACT_OFFER_TERMS_TYPE,
        contractOfferProposalTerms({
          playerId: entityId(player),
          targetRosterStatus: "active",
          roleCommitment: "starter",
          terms: termsOf(SECURE)
        })
      );
    },
    {
      after: (c) => {
        c.m.udfaContractProposal = lastProposal(c.k);
      }
    }
  );
  add(
    "udfa-offer",
    (c) => ({
      type: "SubmitContractOffer",
      organizationId: SP.org,
      actingPersonId: SP.gm,
      proposalId: c.m.udfaContractProposal,
      expectedRevision: 1,
      playerId: c.m.udfaPlayer,
      agentPersonId: agentFor(
        c.k.world,
        entityId(c.m.udfaPlayer),
        c.k.world.simDate
      ),
      terms: termsOf(SECURE),
      roleCommitment: "starter",
      targetRosterStatus: "active",
      priority: 0,
      contingencyGroupId: null
    }),
    {
      after: (c) => {
        c.m.udfaOffer = lastOf(c.k.world.market.contractOffers);
      }
    }
  );
  add("resolve-free-agency-3", { type: "ResolveFreeAgencyMarket" });
  var commitById = (c, offerKey, by) => {
    const offer = offerRecord(c, offerKey);
    require_(
      offer.status === "accepted_pending_commit",
      `${offerKey}: offer is ${offer.status}`
    );
    return {
      type: "CommitContractSigning",
      actingPersonId: by,
      offerId: offer.id,
      offerRevision: offer.revision,
      expectedRevision: 1,
      beliefIds: [],
      evidenceClaimIds: [],
      rationale: { note: "sign" }
    };
  };
  add(
    "rookie-sign",
    (c) => commitById(c, "rookie", GM_OF[rookieOwner(c.k).org])
  );
  add("udfa-sign", (c) => commitById(c, "udfa", SP.gm));
  add(
    "replay-udfa-sign",
    (c) => {
      const offer = offerRecord(c, "udfa");
      return {
        type: "CommitContractSigning",
        actingPersonId: SP.gm,
        offerId: offer.id,
        offerRevision: offer.revision,
        expectedRevision: 1,
        beliefIds: [],
        evidenceClaimIds: [],
        rationale: { note: "sign again" }
      };
    },
    { expect: "INVALID_PAYLOAD" }
  );
  add(
    "late-selection-after-draft",
    (c) => ({
      type: "MakeDraftSelection",
      actingPersonId: GM_OF[c.k.world.decisions.proposals.find((p) => p.id === c.m.draftProposal12).organizationId],
      proposalId: c.m.draftProposal12,
      expectedRevision: 1,
      rationale: { note: "too late" }
    }),
    { expect: "INVALID_PAYLOAD" }
  );
  add(
    "stale-revision-advance",
    { type: "AdvanceDays", days: 1 },
    {
      expect: "STALE_REVISION",
      staleRevision: true
    }
  );
  var PACKAGE_C_STEPS = steps;

  // packages/sim-core/src/packageCScenarioRun.ts
  var stateOf = (k) => ({
    fingerprint: fingerprintWorld(k.world),
    rngDraws: k.world.rng.draws,
    chainHead: k.chainHead,
    events: k.eventCount
  });
  var createPackageCGenesisKernel = () => WorldKernel.fromGenesis(
    createWorld(PACKAGE_C_SEED, SYNTHETIC_PACKAGE_C_RULESET, {
      newWorldId: () => worldId(PACKAGE_C_WORLD_ID)
    }),
    SYNTHETIC_PACKAGE_C_RULESET
  );
  var runPackageCScenario = (options = {}) => {
    var _a;
    const variant = (_a = options.variant) != null ? _a : "primary";
    let kernel = createPackageCGenesisKernel();
    const memo = {};
    const steps_ = [];
    PACKAGE_C_STEPS.forEach((spec2, index) => {
      var _a2, _b, _c, _d, _e;
      kernel = (_b = (_a2 = options.beforeStep) == null ? void 0 : _a2.call(options, index, kernel)) != null ? _b : kernel;
      const ctx = () => ({ k: kernel, m: memo, variant });
      (_c = spec2.before) == null ? void 0 : _c.call(spec2, ctx());
      const known = kernel.knownCommandIds;
      const n = spec2.duplicate === true ? known.length : known.length + 1;
      const envelope = {
        commandId: commandId(`cmd-${String(n).padStart(6, "0")}`),
        expectedRevision: worldRevision(
          spec2.staleRevision === true ? 0 : Number(kernel.world.revision)
        ),
        actor: harness,
        command: spec2.command(ctx())
      };
      const before = stateOf(kernel);
      const result = kernel.execute(envelope);
      if (spec2.expect === "committed") {
        if (!result.ok)
          throw new PackageCScenarioError(
            `${spec2.label} should commit but was rejected: ${result.rejection.code}: ${result.rejection.message}`
          );
        (_d = options.onCommit) == null ? void 0 : _d.call(options, {
          snapshot: sealSnapshot({
            world: kernel.world,
            chainHead: kernel.chainHead,
            eventCount: kernel.eventCount,
            knownCommandIds: kernel.knownCommandIds
          }),
          commands: [{ envelope, resultRevision: Number(result.world.revision) }],
          events: result.events
        });
        (_e = spec2.after) == null ? void 0 : _e.call(spec2, ctx());
      } else {
        if (result.ok)
          throw new PackageCScenarioError(
            `${spec2.label} should be rejected as ${spec2.expect} but committed`
          );
        if (result.rejection.code !== spec2.expect)
          throw new PackageCScenarioError(
            `${spec2.label} rejected as ${result.rejection.code}, expected ${spec2.expect}: ${result.rejection.message}`
          );
        const after = stateOf(kernel);
        if (after.fingerprint !== before.fingerprint || after.rngDraws !== before.rngDraws || after.chainHead !== before.chainHead || after.events !== before.events)
          throw new PackageCScenarioError(
            `${spec2.label} changed state or consumed randomness`
          );
      }
      steps_.push({
        label: spec2.label,
        outcome: spec2.expect,
        revision: Number(kernel.world.revision),
        rngDraws: kernel.world.rng.draws,
        fingerprint: fingerprintWorld(kernel.world),
        chainHead: kernel.chainHead
      });
    });
    const w = kernel.world;
    const findings = auditAcquisitionWorld(w, tx).filter(
      (f) => f.severity === "error"
    );
    if (findings.length > 0)
      throw new PackageCScenarioError(
        `the final audit has ${findings.length} error finding(s): ${findings[0].code}: ${findings[0].detail}`
      );
    const summaries = [NF, SP, EB, WL].map((o) => {
      const cap = rosterCapacity(w.roster, tx, entityId(o.org), w.simDate);
      return {
        organizationId: o.org,
        committed2027: capPosition(tx, w.contracts, entityId(o.org), 2027).committed,
        committed2028: capPosition(tx, w.contracts, entityId(o.org), 2028).committed,
        active: cap.active.count,
        reserve: cap.reserve.count,
        practiceSquad: cap.practice_squad.count,
        picksOwned: w.draft.picks.filter(
          (p) => p.ownerOrganizationId === o.org && p.status === "available"
        ).length
      };
    });
    const ownership = {};
    for (const p of w.draft.picks.filter((x) => x.season === 2027))
      ownership[p.id] = `${p.ownerOrganizationId}:${p.status}`;
    for (const id of w.draft.classes[0].eligiblePlayerIds) {
      const r = activeRightsFor(w.roster, id, w.simDate)[0];
      ownership[id] = r === void 0 ? "unattached" : `${r.holderOrganizationId}:${r.kind}`;
    }
    return {
      scenario: PACKAGE_C_SCENARIO_ID,
      worldId: w.worldId,
      finalSimDate: w.simDate,
      revision: Number(w.revision),
      eventCount: kernel.eventCount,
      rngDraws: w.rng.draws,
      fingerprint: fingerprintWorld(w),
      eventChainHead: kernel.chainHead,
      organizations: summaries,
      capCheckpoints: Object.fromEntries(
        Object.entries(memo).filter(([k]) => k.startsWith("cap:")).map(([k, v]) => [k.slice(4), Number(v)])
      ),
      assetOwnership: ownership,
      auditErrorFindings: findings.length,
      keyRecordIds: Object.fromEntries(
        Object.entries(memo).filter(([k]) => !k.startsWith("cap:"))
      ),
      steps: steps_
    };
  };

  // scripts/hermes/entryPackageCDebug.ts
  try {
    runPackageCScenario({
      beforeStep: (i, k) => {
        if (i === 18)
          print(
            JSON.stringify({
              assignments: k.world.scouting.assignments,
              reports: k.world.scouting.reports,
              beliefs: k.world.information.beliefs.slice(-3)
            })
          );
      }
    });
  } catch (e) {
    print(String(e.message));
  }
})();
