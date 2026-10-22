import {encodeStoredSave, decodeStoredSave, STORAGE_CODEC_MAX_BYTES} from '../model/storage-codec.js';
import {sha256} from '../core/runtime/hash.js';

// Representation changes only: the SG1 codec and SHA implementation are reused
// unchanged. Every individual record retains the existing 16 MiB ceiling.
export const RECORD_MAX_BYTES = STORAGE_CODEC_MAX_BYTES;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const storageFamilyPrefix = 'TINY-ARMY-SAVE\u0000';
const fail = message => { throw Object.assign(new Error(message), {code: 'SAVE_RECORD_INVALID'}); };
const check = (ok, message) => { if (!ok) fail(message); };
function checkNotAborted({signal} = {}) {
  if (signal?.aborted) throw signal.reason ?? Object.assign(new Error('Storage worker request canceled'), {
    name: 'AbortError', code: 'SAVE_WORKER_ABORTED',
  });
}

export function rawRecordSize(raw) {
  check(typeof raw === 'string', 'Save record must be a string');
  check(raw.length <= RECORD_MAX_BYTES, 'Save record exceeds 16 MiB bound');
  const bytes = encoder.encode(raw);
  check(bytes.length <= RECORD_MAX_BYTES, 'Save record exceeds 16 MiB bound');
  // UTF-8 SHA identity cannot distinguish lone surrogates from U+FFFD. Portable
  // JSON represents those as escapes; reject unpaired literal surrogates here.
  check(decoder.decode(bytes) === raw, 'Save record is not exact UTF-8 text');
  return {rawChars: raw.length, rawBytes: bytes.length};
}

function decode(stored) {
  check(typeof stored === 'string', 'Stored save must be a string');
  check(stored.length <= RECORD_MAX_BYTES + 1024, 'Stored save exceeds codec bound');
  const raw = decodeStoredSave(stored);
  rawRecordSize(raw);
  return raw;
}

export function prepareRecord(raw) {
  const sizes = rawRecordSize(raw), hash = sha256(raw);
  check(!raw.startsWith(storageFamilyPrefix), 'Raw record begins with a reserved storage marker');
  return {id: hash, hash, packed: encodeStoredSave(raw), ...sizes};
}

export function decodeRecord(record) {
  check(record && typeof record === 'object' && !Array.isArray(record), 'Invalid save record');
  check(Object.keys(record).sort().join(',') === 'hash,id,packed,rawBytes,rawChars', 'Unexpected record fields');
  check(typeof record.id === 'string' && /^[a-f0-9]{64}$/.test(record.id) && record.hash === record.id,
    'Invalid save record identity');
  for (const key of ['rawChars', 'rawBytes']) {
    check(Number.isSafeInteger(record[key]) && record[key] >= 0 && record[key] <= RECORD_MAX_BYTES,
      'Invalid save record limits');
  }
  const raw = decode(record.packed), sizes = rawRecordSize(raw);
  check(sizes.rawChars === record.rawChars && sizes.rawBytes === record.rawBytes && sha256(raw) === record.hash,
    'Save record integrity check failed');
  return raw;
}

export const storageTasks = Object.freeze({
  serializeBackup(value) { return JSON.stringify(value); },
  encode(raw) {
    rawRecordSize(raw);
    check(!raw.startsWith(storageFamilyPrefix), 'Raw record begins with a reserved storage marker');
    return encodeStoredSave(raw);
  },
  decode,
  sha256(raw) { rawRecordSize(raw); return sha256(raw); },
  prepareRecord,
  decodeRecord,
});

// Profile preparation/validation can be added here by composing a dispatcher;
// no synchronous dispatcher is imported or invoked by worker-client.js.
export function createTaskDispatcher(additionalTasks = {}) {
  const tasks = new Map(Object.entries(storageTasks));
  for (const [kind, task] of Object.entries(additionalTasks)) {
    check(!tasks.has(kind) && typeof task === 'function', 'Invalid additional worker task');
    tasks.set(kind, task);
  }
  return (kind, payload, context = {}) => {
    checkNotAborted(context);
    const task = tasks.get(kind);
    if (!task) throw Object.assign(new Error('Unknown storage worker task'), {code: 'SAVE_WORKER_TASK'});
    return task(payload, context);
  };
}

const dispatchCoreTask = createTaskDispatcher();
let profileTasks;
export function dispatchStorageTask(kind, payload, context = {}) {
  checkNotAborted(context);
  if (typeof kind === 'string' && (kind.startsWith('profile:') || kind.startsWith('runtime:'))) {
    profileTasks ||= import('./profile-tasks.js');
    return profileTasks.then(module => {
      checkNotAborted(context);
      return module.dispatchProfileTask(kind, payload, context);
    });
  }
  return dispatchCoreTask(kind, payload, context);
}
