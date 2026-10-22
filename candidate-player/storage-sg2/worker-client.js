// Only the transport runs on the main thread. In particular, do not import the
// codec, SHA implementation, or validation dispatcher into this module.
export const STORAGE_WORKER_PROTOCOL = 'tiny-army-sg2-worker-1';
export const STORAGE_WORKER_MAX_PENDING = 8;
let nextSession = 0;
const error = (code, message, name = 'Error') => Object.assign(new Error(message), {code, name});
const ownerIsValid = owner => owner === null || (typeof owner === 'string' && owner.length <= 256)
  || (typeof owner === 'number' && Number.isSafeInteger(owner));

export function createStorageWorker({workerFactory, rules = 'default', maxPending = STORAGE_WORKER_MAX_PENDING} = {}) {
  if (!Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 64)
    throw error('SAVE_WORKER_CONFIG', 'Storage worker pending limit must be between 1 and 64');
  if (workerFactory !== undefined && typeof workerFactory !== 'function')
    throw error('SAVE_WORKER_CONFIG', 'Storage worker factory must be a function');
  if (!['default', 'lr29-r2'].includes(rules))
    throw error('SAVE_WORKER_CONFIG', 'Unknown exact storage Worker rules');
  if (!workerFactory && typeof globalThis.Worker !== 'function')
    throw error('SAVE_WORKER_UNAVAILABLE', 'Dedicated storage Worker is unavailable; no synchronous fallback');
  const factory = workerFactory || ((url, options) => new globalThis.Worker(url, options));
  const workerURL = new URL(rules === 'lr29-r2' ? './codec-worker-lr29-r2.js' : './codec-worker.js', import.meta.url);
  const worker = factory(workerURL, {type: 'module', name: 'tiny-army-storage-sg2'});
  if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function')
    throw error('SAVE_WORKER_UNAVAILABLE', 'Invalid dedicated storage Worker');
  const session = `${Date.now()}:${++nextSession}:${globalThis.crypto?.randomUUID?.() || Math.random()}`;
  const pending = new Map(), detach = [];
  let sequence = 0, closed = false, closedReason;

  function cleanup(job) {
    if (job.signal && job.abort) job.signal.removeEventListener('abort', job.abort);
  }
  function settle(job, ok, value) {
    if (job.settled) return;
    job.settled = true;
    cleanup(job);
    (ok ? job.resolve : job.reject)(value);
  }
  function shutdown(reason) {
    if (closed) return;
    closed = true;
    closedReason = reason;
    for (const job of pending.values()) settle(job, false, reason);
    pending.clear();
    for (const remove of detach) remove();
    try { worker.terminate(); } catch { /* All callers are already rejected. */ }
  }
  function onMessage(data) {
    if (closed || !data || data.protocol !== STORAGE_WORKER_PROTOCOL || data.session !== session) return;
    const job = pending.get(data.id);
    // A stale/canceled response cannot settle another owner or a newer job.
    if (!job || data.ownerToken !== job.ownerToken || typeof data.ok !== 'boolean') return;
    pending.delete(data.id);
    if (job.settled) return;
    if (data.ok) settle(job, true, data.result);
    else {
      const value = data.error || {};
      settle(job, false, error(typeof value.code === 'string' ? value.code : 'SAVE_WORKER_FAILED',
        typeof value.message === 'string' ? value.message : 'Storage worker task failed',
        typeof value.name === 'string' ? value.name : 'Error'));
    }
  }
  function onFailure(event) {
    shutdown(error('SAVE_WORKER_FAILED', event?.message || 'Storage worker stopped before completion'));
  }
  if (typeof worker.addEventListener === 'function') {
    const message = event => onMessage(event.data);
    for (const [kind, callback] of [['message', message], ['error', onFailure], ['messageerror', onFailure]]) {
      worker.addEventListener(kind, callback);
      detach.push(() => worker.removeEventListener(kind, callback));
    }
  } else if (typeof worker.on === 'function' && typeof worker.off === 'function') {
    for (const [kind, callback] of [['message', onMessage], ['error', onFailure], ['messageerror', onFailure], ['exit', onFailure]]) {
      worker.on(kind, callback);
      detach.push(() => worker.off(kind, callback));
    }
  } else {
    try { worker.terminate(); } catch { /* Invalid port. */ }
    throw error('SAVE_WORKER_UNAVAILABLE', 'Storage Worker event interface is unavailable');
  }

  function request(kind, payload, {signal, ownerToken = null} = {}) {
    if (closed) return Promise.reject(closedReason);
    if (typeof kind !== 'string' || !kind || kind.length > 128 || !ownerIsValid(ownerToken))
      return Promise.reject(error('SAVE_WORKER_REQUEST', 'Invalid storage worker task or owner token'));
    if (signal && (typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function'))
      return Promise.reject(error('SAVE_WORKER_REQUEST', 'Invalid storage worker abort signal'));
    if (signal?.aborted) return Promise.reject(error('SAVE_WORKER_ABORTED', 'Storage worker request canceled', 'AbortError'));
    // Canceled callers still occupy their physical slot until the worker replies.
    // Otherwise repeated cancel/post could create an unbounded hidden work queue.
    if (pending.size >= maxPending) return Promise.reject(error('SAVE_WORKER_BUSY', 'Storage worker queue is full'));
    if (sequence >= Number.MAX_SAFE_INTEGER) return Promise.reject(error('SAVE_WORKER_REQUEST', 'Storage worker request IDs exhausted'));
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const job = {resolve, reject, ownerToken, signal, abort: null, settled: false};
      job.abort = () => {
        settle(job, false, error('SAVE_WORKER_ABORTED', 'Storage worker request canceled', 'AbortError'));
        try { worker.postMessage({protocol: STORAGE_WORKER_PROTOCOL, session, id, ownerToken, type: 'cancel'}); }
        catch (cause) { onFailure(cause); }
      };
      pending.set(id, job);
      if (signal) signal.addEventListener('abort', job.abort, {once: true});
      try { worker.postMessage({protocol: STORAGE_WORKER_PROTOCOL, session, id, ownerToken, type: 'request', kind, payload}); }
      catch (cause) { pending.delete(id); settle(job, false, cause); }
    });
  }

  return Object.freeze({
    request,
    close() { shutdown(error('SAVE_WORKER_CLOSED', 'Storage worker is closed')); },
    get pendingCount() { return pending.size; },
  });
}
