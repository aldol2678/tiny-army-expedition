/**
 * SG2 isolated transactional persistence. No localStorage or migration path.
 * Codec/content validation is performed by the preparation worker. This layer
 * verifies immutable prepared bytes, references, CAS, ownership and uniqueness.
 * Worker supplies the cryptographic commitHash; this backend never serializes
 * or hashes the potentially large inline active record. Transactions
 * contain IDB requests and synchronous callbacks only: never awaited work.
 *
 * Preparation trust boundary: commitHash MUST be SHA-256 of the worker's exact
 * canonical {slot, expectedRootHash, transactionId, root, records, settlementKeys}
 * payload. It must be recomputed when any field changes. This low-level store
 * does not authenticate arbitrary caller-provided hashes. The controller must
 * only submit validated worker results, not caller-authored descriptors.
 *
 * Schema v1: roots {slot,value}; records {id,value}; commits
 * {id,commitHash,rootHash,revision}; settlements {id,transactionId,rootHash}.
 * Commit and settlement IDs are JSON [slot, transactionId/key] pairs.
 * No deletion/GC/pruning is exposed; the profile transaction bound is enforced
 * before preparation, not by silently discarding idempotency receipts.
 */
export const SG2_DATABASE_VERSION = 1;
export const SG2_DATABASE_NAME = 'tiny-army-sg2p2-isolated-v1';
const STORES = ['roots', 'records', 'commits', 'settlements'];
const HEX = /^[a-f0-9]{64}$/;

export class RecordStoreError extends Error {
  constructor(code, message) { super(message); this.name = 'RecordStoreError'; this.code = code; }
}
const error = (code, message) => new RecordStoreError(code, message);
const requireThat = (ok, code, message) => { if (!ok) throw error(code, message); };
const abortedError = () => Object.assign(error('ABORTED', 'SG2 commit was cancelled before completion'), {name: 'AbortError'});
const stringKey = value => typeof value === 'string' && value.length > 0 && value.length <= 4096;

// A detached, deterministic, JSON-only snapshot. Reject lossy JSON values,
// accessors and toJSON hooks rather than executing caller code mid-transaction.
function snapshot(value, seen = new Set(), depth = 0) {
  requireThat(depth <= 128, 'INVALID_INPUT', 'Prepared metadata nesting exceeds bound');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    requireThat(Number.isFinite(value), 'INVALID_INPUT', 'Non-finite JSON number');
    return Object.is(value, -0) ? 0 : value;
  }
  requireThat(value && typeof value === 'object' && !seen.has(value), 'INVALID_INPUT', 'Expected acyclic JSON data');
  requireThat(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null,
    'INVALID_INPUT', 'Prepared data must contain only plain objects');
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  requireThat(Reflect.ownKeys(value).every(key => typeof key === 'string'), 'INVALID_INPUT', 'Symbol keys are unsupported');
  let result;
  if (Array.isArray(value)) {
    requireThat(Object.keys(value).length === value.length, 'INVALID_INPUT', 'Sparse arrays and array properties are unsupported');
    result = value.map((_, index) => {
      requireThat(descriptors[index] && 'value' in descriptors[index], 'INVALID_INPUT', 'Accessor values are unsupported');
      return snapshot(descriptors[index].value, seen, depth + 1);
    });
  } else {
    result = {};
    for (const key of Object.keys(value).sort()) {
      requireThat('value' in descriptors[key], 'INVALID_INPUT', 'Accessor values are unsupported');
      Object.defineProperty(result, key, {value: snapshot(descriptors[key].value, seen, depth + 1), enumerable: true, writable: true, configurable: true});
    }
  }
  seen.delete(value);
  return result;
}
// Compare immutable prepared values directly. In particular, packed strings
// are never parsed, re-encoded or JSON-stringified on the calling thread.
function sameJSON(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJSON(a[key], b[key]));
}
function checkOwner(assertOwner, ownerToken) {
  requireThat(ownerToken !== undefined && ownerToken !== null, 'OWNER_REQUIRED', 'A current operation ownership token is required');
  requireThat(typeof assertOwner === 'function', 'OWNER_REQUIRED', 'A synchronous ownership guard is required');
  let result;
  try { result = assertOwner(ownerToken); } catch (cause) {
    const failure = error('OWNER_LOST', 'Save ownership is no longer valid'); failure.cause = cause; throw failure;
  }
  requireThat(result === true, 'OWNER_LOST', 'Ownership guard must synchronously return true');
}
function validateRoot(root) {
  requireThat(root && !Array.isArray(root) && typeof root.hash === 'string' && HEX.test(root.hash), 'INVALID_INPUT', 'Root hash must be lowercase SHA-256');
  requireThat(Array.isArray(root.recordIds) && root.recordIds.every(id => typeof id === 'string' && HEX.test(id)) && new Set(root.recordIds).size === root.recordIds.length,
    'INVALID_INPUT', 'Root recordIds must be distinct lowercase SHA-256 identifiers');
}
function prepare(input) {
  requireThat(input && typeof input === 'object', 'INVALID_INPUT', 'Commit input required');
  const {slot, expectedRootHash, transactionId, ownerToken, assertOwner, commitHash, signal} = input;
  if (signal?.aborted) throw abortedError();
  requireThat(!signal || (typeof signal.addEventListener === 'function' && typeof signal.removeEventListener === 'function'), 'INVALID_INPUT', 'Expected an AbortSignal');
  requireThat(typeof commitHash === 'string' && HEX.test(commitHash), 'INVALID_INPUT', 'Worker-prepared SHA-256 commitHash required');
  requireThat(stringKey(slot) && stringKey(transactionId), 'INVALID_INPUT', 'Slot and transaction ID are required');
  requireThat(expectedRootHash === null || (typeof expectedRootHash === 'string' && HEX.test(expectedRootHash)), 'INVALID_INPUT', 'Expected root hash required, or null for an empty slot');
  checkOwner(assertOwner, ownerToken);
  const root = snapshot(input.root), records = snapshot(input.records ?? []), settlementKeys = snapshot(input.settlementKeys ?? []);
  validateRoot(root);
  requireThat(Array.isArray(records) && Array.isArray(settlementKeys), 'INVALID_INPUT', 'Records and settlement keys must be arrays');
  const ids = new Set();
  for (const record of records) {
    requireThat(record && !Array.isArray(record) && typeof record.id === 'string' && HEX.test(record.id) && record.id === record.hash && typeof record.packed === 'string' &&
      Number.isSafeInteger(record.rawChars) && record.rawChars >= 0 && Number.isSafeInteger(record.rawBytes) && record.rawBytes >= 0,
      'INVALID_INPUT', 'Prepared records require matching id/hash, packed bytes and raw sizes');
    requireThat(!ids.has(record.id), 'INVALID_INPUT', 'Duplicate prepared record ID'); ids.add(record.id);
  }
  requireThat(settlementKeys.every(stringKey) && new Set(settlementKeys).size === settlementKeys.length, 'INVALID_INPUT', 'Settlement keys must be distinct strings');
  records.sort((a, b) => a.id.localeCompare(b.id)); settlementKeys.sort();
  return {slot, expectedRootHash, transactionId, ownerToken, assertOwner, root, prepared: records, settlementKeys, commitHash, signal};
}

export async function openRecordStore({indexedDB = globalThis.indexedDB, name = SG2_DATABASE_NAME} = {}) {
  requireThat(indexedDB && typeof indexedDB.open === 'function', 'IDB_UNAVAILABLE', 'IndexedDB is unavailable');
  requireThat(stringKey(name), 'INVALID_INPUT', 'Database name required');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(name, SG2_DATABASE_VERSION); let blocked = false;
    request.onupgradeneeded = () => {
      const database = request.result;
      for (const store of STORES) if (!database.objectStoreNames.contains(store)) database.createObjectStore(store, {keyPath: store === 'roots' ? 'slot' : 'id'});
    };
    request.onerror = () => reject(request.error || error('OPEN_FAILED', 'Could not open SG2 database'));
    request.onblocked = () => { blocked = true; reject(error('OPEN_BLOCKED', 'Another connection blocks SG2 database opening')); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      if (!STORES.every(store => request.result.objectStoreNames.contains(store))) {
        request.result.close(); reject(error('INVALID_SCHEMA', 'SG2 database is missing required object stores')); return;
      }
      resolve(request.result);
    };
  });
  let closed = false;
  db.onversionchange = () => { closed = true; db.close(); };
  const ensureOpen = () => requireThat(!closed, 'STORE_CLOSED', 'SG2 store connection is closed');
  async function readValue(store, key) {
    ensureOpen(); requireThat(stringKey(key), 'INVALID_INPUT', 'Read key required');
    return new Promise((resolve, reject) => {
      const tx = db.transaction([store], 'readonly'); let value = null;
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => { value = request.result?.value ?? null; };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error || error('TRANSACTION_ABORTED', 'SG2 read aborted'));
      tx.onerror = () => {}; // onabort is the authoritative terminal result.
    });
  }
  async function commit(input) {
    ensureOpen();
    const p = prepare(input);
    ensureOpen(); checkOwner(p.assertOwner, p.ownerToken);
    return new Promise((resolve, reject) => {
      // IndexedDB serializes overlapping readwrite transactions, across tabs.
      const tx = db.transaction(STORES, 'readwrite', {durability: 'strict'});
      const roots = tx.objectStore('roots'), records = tx.objectStore('records');
      const commits = tx.objectStore('commits'), settlements = tx.objectStore('settlements');
      const receiptId = JSON.stringify([p.slot, p.transactionId]);
      let failure = null, result = null;
      const abort = cause => { if (!failure) failure = cause; try { tx.abort(); } catch {} };
      const guarded = fn => event => { try { fn(event); } catch (cause) { abort(cause); } };
      const get = (store, key, done) => { const request = store.get(key); request.onsuccess = guarded(() => done(request.result)); };
      const getKey = (store, key, done) => { const request = store.getKey(key); request.onsuccess = guarded(() => done(request.result)); };
      tx.onerror = () => {}; // Do not preventDefault: quota/request errors abort all writes.
      const cancel = () => abort(abortedError());
      const cleanup = () => p.signal?.removeEventListener('abort', cancel);
      tx.onabort = () => { cleanup(); reject(failure || tx.error || error('TRANSACTION_ABORTED', 'SG2 transaction aborted')); };
      // Cancellation after native commit started cannot turn durable success
      // into a false failure. oncomplete remains the authoritative outcome.
      tx.oncomplete = () => { cleanup(); resolve(result); };
      p.signal?.addEventListener('abort', cancel, {once: true});
      if (p.signal?.aborted) { cancel(); return; }
      const finalCheck = () => {
        checkOwner(p.assertOwner, p.ownerToken);
        // Final synchronous check while abort remains legal. oncomplete would
        // be too late. Ownership after commit begins cannot revoke durability.
        if (typeof tx.commit === 'function') tx.commit();
      };
      get(commits, receiptId, receipt => {
        get(roots, p.slot, previous => {
          const currentRoot = previous?.value ?? null;
          if (receipt) {
            requireThat(receipt.commitHash === p.commitHash, 'TRANSACTION_ID_COLLISION', 'Transaction ID was already used with another payload');
            result = {root: currentRoot, currentRoot, committedRootHash: receipt.rootHash, transactionId: p.transactionId, replayed: true};
            finalCheck(); return;
          }
          requireThat((currentRoot?.hash ?? null) === p.expectedRootHash, 'STALE_BASE', 'Saved root changed in another writer');
          // Reject ABA roots: the same hash cannot designate different metadata.
          requireThat(!currentRoot || currentRoot.hash !== p.root.hash || sameJSON(currentRoot, p.root),
            'ROOT_HASH_COLLISION', 'Root hash cannot identify different manifest bytes');
          const existing = new Map(), knownIds = new Set();
          const incomingIds = new Set(p.prepared.map(record => record.id));
          const allIds = [...new Set([...p.root.recordIds, ...p.prepared.map(record => record.id)])];
          let remaining = allIds.length + p.settlementKeys.length;
          const checked = () => { if (--remaining === 0) write(); };
          const write = () => {
            const incoming = new Map(p.prepared.map(record => [record.id, record]));
            for (const id of p.root.recordIds) requireThat(knownIds.has(id) || incoming.has(id), 'MISSING_RECORD', `Missing referenced record: ${id}`);
            for (const record of p.prepared) {
              const prior = existing.get(record.id);
              requireThat(!prior || sameJSON(prior.value, record), 'IMMUTABLE_RECORD_COLLISION', 'Existing record ID has different prepared bytes');
            }
            checkOwner(p.assertOwner, p.ownerToken);
            for (const record of p.prepared) if (!existing.has(record.id)) records.add({id: record.id, value: record});
            for (const key of p.settlementKeys) settlements.add({id: JSON.stringify([p.slot, key]), transactionId: p.transactionId, rootHash: p.root.hash});
            roots.put({slot: p.slot, value: p.root});
            const request = commits.add({id: receiptId, commitHash: p.commitHash, rootHash: p.root.hash, revision: p.root.revision ?? null});
            request.onsuccess = guarded(() => {
              result = {root: p.root, currentRoot: p.root, committedRootHash: p.root.hash, transactionId: p.transactionId, replayed: false};
              finalCheck();
            });
          };
          for (const id of allIds) {
            if (incomingIds.has(id)) get(records, id, value => {
              if (value) { existing.set(id, value); knownIds.add(id); } checked();
            });
            // Existing archives only need existence checks. getKey avoids
            // structured-cloning every historical packed record on each save.
            else getKey(records, id, value => { if (value !== undefined) knownIds.add(id); checked(); });
          }
          for (const key of p.settlementKeys) get(settlements, JSON.stringify([p.slot, key]), value => {
            requireThat(!value, 'DUPLICATE_SETTLEMENT', 'Settlement key was already committed'); checked();
          });
          if (!remaining) write();
        });
      });
    });
  }
  return Object.freeze({
    read: slot => readValue('roots', slot),
    readRecord: id => readValue('records', id),
    commit,
    close() { if (!closed) { closed = true; db.close(); } }
  });
}
