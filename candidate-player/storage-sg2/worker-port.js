import {STORAGE_WORKER_PROTOCOL} from './worker-client.js';

const serializedError = cause => ({name: cause?.name || 'Error', code: cause?.code || 'SAVE_WORKER_FAILED',
  message: cause?.message || 'Storage worker task failed'});
const abortedError = () => Object.assign(new Error('Storage worker request canceled'), {
  name: 'AbortError', code: 'SAVE_WORKER_ABORTED',
});

// The small port adapter is also used by real node:worker_threads tests. A
// rejected/canceled job never leaves a result that can be mistaken for success.
export function installStorageWorker(port, {dispatch} = {}) {
  const jobs = new Map(), queue = [];
  let running = false, stopped = false, session = null, lastId = 0;
  const send = (job, ok, value) => port.postMessage({protocol: STORAGE_WORKER_PROTOCOL,
    session: job.session, id: job.id, ownerToken: job.ownerToken, ok, ...(ok ? {result: value} : {error: serializedError(value)})});
  async function drain() {
    if (running || stopped) return;
    running = true;
    try {
      while (queue.length && !stopped) {
        const job = queue.shift();
        if (!jobs.has(job.id)) continue;
        try {
          const result = await dispatch(job.kind, job.payload, {signal: job.controller.signal});
          if (jobs.has(job.id) && !stopped) send(job, true, result);
        } catch (cause) { if (jobs.has(job.id) && !stopped) send(job, false, cause); }
        finally { jobs.delete(job.id); }
      }
    } finally { running = false; }
  }
  function receive(message) {
    if (stopped || !message || message.protocol !== STORAGE_WORKER_PROTOCOL
      || typeof message.session !== 'string' || message.session.length > 256
      || !Number.isSafeInteger(message.id) || message.id < 1) return;
    if (session !== null && message.session !== session) return;
    if (message.type === 'cancel') {
      const job = jobs.get(message.id);
      if (job && job.ownerToken === message.ownerToken) {
        // Cooperative replay/validation can now release the serial queue at its
        // next yield. An already executing synchronous codec is not preempted.
        const cause = abortedError();
        job.controller.abort(cause);
        jobs.delete(job.id);
        const queuedIndex = queue.indexOf(job);
        if (queuedIndex >= 0) queue.splice(queuedIndex, 1);
        send(job, false, cause);
      }
      return;
    }
    if (message.type !== 'request') return;
    session = message.session;
    if (message.id <= lastId) return; // Do not replay a finished or duplicate job.
    lastId = message.id;
    if (jobs.size >= 64) {
      send(message, false, Object.assign(new Error('Storage worker queue is full'), {code: 'SAVE_WORKER_BUSY'}));
      return;
    }
    const job = {...message, controller: new AbortController()};
    jobs.set(job.id, job);
    queue.push(job);
    void drain();
  }
  const remove = port.subscribe(receive);
  return () => {
    stopped = true;
    for (const job of jobs.values()) job.controller.abort(abortedError());
    jobs.clear(); queue.length = 0; remove?.();
  };
}

// Shared native/Node port startup. Browser registration is synchronous;
// Node retains the original parentPort adapter, with no same-thread fallback.
export async function startStorageWorker(dispatch){
 if(typeof dispatch!=='function')throw Error('Explicit storage dispatcher required');
 if(typeof globalThis.WorkerGlobalScope!=='undefined'&&globalThis instanceof globalThis.WorkerGlobalScope){
  return installStorageWorker({postMessage:message=>globalThis.postMessage(message),subscribe(callback){const listener=event=>callback(event.data);globalThis.addEventListener('message',listener);return()=>globalThis.removeEventListener('message',listener);}},{dispatch});
 }else if(typeof process!=='undefined'&&process.versions?.node){
  const {parentPort,isMainThread}=await import('node:worker_threads');
  if(!isMainThread&&parentPort)return installStorageWorker({postMessage:message=>parentPort.postMessage(message),subscribe(callback){parentPort.on('message',callback);return()=>parentPort.off('message',callback);}},{dispatch});
 }
}
