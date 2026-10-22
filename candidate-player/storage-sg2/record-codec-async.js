import {STORAGE_CODEC_MAX_BYTES, STORAGE_CODEC_PREFIX} from '../model/storage-codec.js';

// Byte-for-byte SG1 LZW1 representation. The LZW routines below are copied
// from model/storage-codec.js; the portable SHA-256 core is adapted from
// core/runtime/hash.js to consume the bytes already validated here. Neither
// original codec nor its synchronous public entry points are changed.
export const RECORD_MAX_BYTES = STORAGE_CODEC_MAX_BYTES;
const FAMILY_PREFIX = 'TINY-ARMY-SAVE\u0000';
const CLEAR = 32767, OFFSET = 256, MIN_LENGTH = 128 * 1024;
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', {fatal: true});
const identityPattern = /^[a-f0-9]{64}$/;
const fields = ['id', 'hash', 'packed', 'rawChars', 'rawBytes'];
const fail = message => { throw Object.assign(new Error(message), {code: 'SAVE_RECORD_INVALID'}); };
const check = (ok, message) => { if (!ok) fail(message); };
const codecCheck = (ok, message) => {
  if (!ok) throw Object.assign(new Error(message), {code: 'SAVE_CODEC_INVALID'});
};
// Read native AbortSignal state without invoking a caller-defined accessor.
const signalPrototype = globalThis.AbortSignal?.prototype;
const abortedGetter = signalPrototype && Object.getOwnPropertyDescriptor(signalPrototype, 'aborted')?.get;
const reasonGetter = signalPrototype && Object.getOwnPropertyDescriptor(signalPrototype, 'reason')?.get;

function snapshotOptions(options) {
  check(options && typeof options === 'object' && !Array.isArray(options), 'Invalid record codec options');
  const descriptor = Object.getOwnPropertyDescriptor(options, 'signal');
  check(!descriptor || Object.hasOwn(descriptor, 'value'), 'Record codec options must not contain accessors');
  const signal = descriptor?.value;
  if (signal !== undefined && signal !== null) {
    check(typeof abortedGetter === 'function', 'AbortSignal is unavailable');
    try { abortedGetter.call(signal); } catch { fail('Invalid record codec AbortSignal'); }
  }
  return signal;
}

function checkNotAborted(signal) {
  if (signal != null && abortedGetter.call(signal)) {
    throw (reasonGetter?.call(signal) ?? Object.assign(new Error('Storage worker request canceled'), {
      name: 'AbortError', code: 'SAVE_WORKER_ABORTED',
    }));
  }
}

function rawBytes(raw) {
  check(typeof raw === 'string', 'Save record must be a string');
  check(raw.length <= RECORD_MAX_BYTES, 'Save record exceeds 16 MiB bound');
  const bytes = encoder.encode(raw);
  check(bytes.length <= RECORD_MAX_BYTES, 'Save record exceeds 16 MiB bound');
  check(decoder.decode(bytes) === raw, 'Save record is not exact UTF-8 text');
  return bytes;
}

function snapshotRecord(record) {
  check(record && typeof record === 'object' && !Array.isArray(record), 'Invalid save record');
  const descriptors = Object.getOwnPropertyDescriptors(record), keys = Reflect.ownKeys(descriptors);
  check(keys.length === fields.length && keys.every(key => fields.includes(key)), 'Unexpected record fields');
  const result = Object.create(null);
  for (const key of fields) {
    const descriptor = descriptors[key];
    check(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable,
      'Save record fields must be enumerable data properties');
    result[key] = descriptor.value;
  }
  check(typeof result.id === 'string' && identityPattern.test(result.id) && result.hash === result.id,
    'Invalid save record identity');
  for (const key of ['rawChars', 'rawBytes']) {
    check(Number.isSafeInteger(result[key]) && result[key] >= 0 && result[key] <= RECORD_MAX_BYTES,
      'Invalid save record limits');
  }
  check(typeof result.packed === 'string', 'Stored save must be a string');
  check(result.packed.length <= RECORD_MAX_BYTES + 1024, 'Stored save exceeds codec bound');
  return result;
}

function compress(bytes) {
  // Numeric (prefix, byte) keys fit in 23 bits. Use a bounded, low-load
  // open-address table instead of allocating a Map entry for every new pair.
  // A zero value is the empty marker because dictionary codes begin at 256.
  // Clearing values is sufficient on the exact original CLEAR boundary; stale
  // keys are never consulted for an empty slot. The code stream is unchanged.
  const keys = new Uint32Array(131072), values = new Uint16Array(131072), chunks = [];
  let codes = [], next = 256, current = bytes[0];
  const emit = code => {
    codes.push(code + OFFSET);
    if (codes.length === 8192) { chunks.push(String.fromCharCode(...codes)); codes = []; }
  };
  for (let i = 1; i < bytes.length; i++) {
    const byte = bytes[i], key = current * 256 + byte;
    let slot = Math.imul(key, 0x9e3779b1) >>> 15;
    while (values[slot] !== 0 && keys[slot] !== key) slot = (slot + 1) & 131071;
    const found = values[slot];
    if (found !== 0) { current = found; continue; }
    emit(current);
    if (next < CLEAR) { keys[slot] = key; values[slot] = next++; }
    else { emit(CLEAR); values.fill(0); next = 256; }
    current = byte;
  }
  if (bytes.length) emit(current);
  if (codes.length) chunks.push(String.fromCharCode(...codes));
  return chunks.join('');
}

function decompress(payload, byteLength) {
  const out = new Uint8Array(byteLength), prefix = new Uint16Array(CLEAR);
  const suffix = new Uint8Array(CLEAR), stack = new Uint8Array(CLEAR);
  let next = 256, previous = -1, position = 0;
  const expand = code => {
    let size = 0;
    while (code >= 256) {
      codecCheck(code < next && size < CLEAR, 'Invalid save dictionary reference');
      stack[size++] = suffix[code]; code = prefix[code];
    }
    stack[size++] = code;
    codecCheck(position + size <= byteLength, 'Save expansion exceeds declared bound');
    for (let j = size - 1; j >= 0; j--) out[position++] = stack[j];
    return code;
  };
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i) - OFFSET;
    codecCheck(code >= 0 && code <= CLEAR, 'Invalid save code');
    if (code === CLEAR) {
      codecCheck(previous >= 0 && next === CLEAR, 'Unexpected save dictionary reset');
      next = 256; previous = -1; continue;
    }
    let first;
    if (code < next) first = expand(code);
    else {
      codecCheck(code === next && previous >= 0 && next < CLEAR, 'Invalid forward save reference');
      first = expand(previous);
      codecCheck(position < byteLength, 'Save expansion exceeds declared bound');
      out[position++] = first;
    }
    if (previous >= 0 && next < CLEAR) { prefix[next] = previous; suffix[next] = first; next++; }
    previous = code;
  }
  codecCheck(position === byteLength && previous >= 0, 'Truncated save payload');
  return out;
}

function decodeFrame(stored) {
  if (!stored.startsWith(FAMILY_PREFIX)) return {raw: stored, bytes: rawBytes(stored), hash: null};
  codecCheck(stored.startsWith(STORAGE_CODEC_PREFIX), 'Unsupported save storage version');
  codecCheck(stored.length <= RECORD_MAX_BYTES + 1024, 'Stored save exceeds codec bound');
  const end = stored.indexOf('\n', STORAGE_CODEC_PREFIX.length);
  codecCheck(end > 0 && end - STORAGE_CODEC_PREFIX.length <= 128, 'Invalid save storage header');
  let header;
  try { header = JSON.parse(stored.slice(STORAGE_CODEC_PREFIX.length, end)); }
  catch { codecCheck(false, 'Invalid save storage header'); }
  codecCheck(Array.isArray(header) && header.length === 3, 'Invalid save storage header');
  const [characters, byteLength, hash] = header;
  codecCheck(Number.isSafeInteger(characters) && characters > 0 && characters <= RECORD_MAX_BYTES &&
    Number.isSafeInteger(byteLength) && byteLength > 0 && byteLength <= RECORD_MAX_BYTES &&
    typeof hash === 'string' && identityPattern.test(hash), 'Invalid save storage limits');
  let bytes = decompress(stored.slice(end + 1), byteLength);
  const raw = decoder.decode(bytes);
  codecCheck(raw.length === characters, 'Stored save integrity check failed');
  // The original TextDecoder strips one UTF-8 BOM before hashing decoded text.
  // Preserve that behavior without re-encoding: fatal UTF-8 is otherwise exact.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  check(!raw.startsWith('\ufeff'), 'Save record is not exact UTF-8 text');
  return {raw, bytes, hash};
}

const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotateRight = (x, n) => (x >>> n) | (x << (32 - n));
function portableSha256(bytes) {
  const n = Math.ceil((bytes.length + 9) / 64) * 64, padded = new Uint8Array(n);
  padded.set(bytes); padded[bytes.length] = 128;
  const view = new DataView(padded.buffer), bits = bytes.length * 8;
  view.setUint32(n - 8, Math.floor(bits / 4294967296)); view.setUint32(n - 4, bits >>> 0);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w = new Uint32Array(64), rr = rotateRight;
  for (let p = 0; p < n; p += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(p + i * 4);
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15], y = w[i - 2];
      w[i] = (w[i - 16] + (rr(x, 7) ^ rr(x, 18) ^ (x >>> 3)) + w[i - 7] + (rr(y, 17) ^ rr(y, 19) ^ (y >>> 10))) >>> 0;
    }
    let A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], G = h[6], H = h[7];
    for (let i = 0; i < 64; i++) {
      const t1 = (H + (rr(E, 6) ^ rr(E, 11) ^ rr(E, 25)) + ((E & F) ^ (~E & G)) + K[i] + w[i]) >>> 0;
      const t2 = ((rr(A, 2) ^ rr(A, 13) ^ rr(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) >>> 0;
      H = G; G = F; F = E; E = (D + t1) >>> 0; D = C; C = B; B = A; A = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + A) >>> 0; h[1] = (h[1] + B) >>> 0; h[2] = (h[2] + C) >>> 0; h[3] = (h[3] + D) >>> 0;
    h[4] = (h[4] + E) >>> 0; h[5] = (h[5] + F) >>> 0; h[6] = (h[6] + G) >>> 0; h[7] = (h[7] + H) >>> 0;
  }
  return h.map(value => value.toString(16).padStart(8, '0')).join('');
}

async function hashBytes(bytes, signal) {
  checkNotAborted(signal);
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function') {
    let digest;
    try { digest = await subtle.digest('SHA-256', bytes); }
    catch {
      // Platforms without a usable native SHA-256 still retain the exact
      // portable implementation. Cancellation is never converted to fallback.
      checkNotAborted(signal);
    }
    checkNotAborted(signal);
    if (digest !== undefined) {
      const result = new Uint8Array(digest);
      check(result.length === 32, 'Invalid native SHA-256 result');
      const hash = Array.from(result, byte => byte.toString(16).padStart(2, '0')).join('');
      checkNotAborted(signal);
      return hash;
    }
  }
  const hash = portableSha256(bytes);
  checkNotAborted(signal);
  return hash;
}

export async function sha256Async(raw, options = {}) {
  const signal = snapshotOptions(options);
  checkNotAborted(signal);
  // Logical multi-record bundles may exceed the individual 16 MiB record
  // ceiling. This general hash API matches sha256's TextEncoder semantics,
  // including replacement of lone surrogates; record APIs remain strict.
  check(typeof raw === 'string', 'SHA-256 input must be a string');
  const bytes = encoder.encode(raw);
  const hash = await hashBytes(bytes, signal);
  checkNotAborted(signal);
  return hash;
}

export async function prepareRecordAsync(raw, options = {}) {
  const signal = snapshotOptions(options);
  checkNotAborted(signal);
  const bytes = rawBytes(raw);
  check(!raw.startsWith(FAMILY_PREFIX), 'Raw record begins with a reserved storage marker');
  const hash = await hashBytes(bytes, signal);
  checkNotAborted(signal);
  let packed = raw;
  if (raw.length >= MIN_LENGTH) {
    const candidate = STORAGE_CODEC_PREFIX + JSON.stringify([raw.length, bytes.length, hash]) + '\n' + compress(bytes);
    if (candidate.length < raw.length) {
      // Byte-equal decoded text already has the checked hash. Verify the
      // complete frame/dictionary without hashing and encoding the text again.
      const frame = decodeFrame(candidate);
      codecCheck(frame.raw === raw && frame.hash === hash && frame.bytes.length === bytes.length,
        'Save codec round trip differs');
      packed = candidate;
    }
  }
  checkNotAborted(signal);
  return {id: hash, hash, packed, rawChars: raw.length, rawBytes: bytes.length};
}

export async function decodeRecordAsync(record, options = {}) {
  const signal = snapshotOptions(options);
  checkNotAborted(signal);
  // All untrusted fields are copied as own data properties before any await.
  // Later caller mutation cannot alter which bytes or metadata are verified.
  const snapshot = snapshotRecord(record), frame = decodeFrame(snapshot.packed);
  check(frame.raw.length === snapshot.rawChars && frame.bytes.length === snapshot.rawBytes,
    'Save record integrity check failed');
  const hash = await hashBytes(frame.bytes, signal);
  checkNotAborted(signal);
  if (frame.hash !== null) codecCheck(hash === frame.hash, 'Stored save integrity check failed');
  check(hash === snapshot.hash, 'Save record integrity check failed');
  checkNotAborted(signal);
  return frame.raw;
}
