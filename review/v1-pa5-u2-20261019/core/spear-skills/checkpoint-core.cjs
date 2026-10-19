'use strict';
// Reconstructed from retained 2026-10-18 implementation transcript.
class CheckpointConflictError extends Error{constructor(message='Checkpoint revision conflict'){super(message);this.code='CHECKPOINT_CONFLICT';}}
function canonical(value){const seen=new Set();function walk(v){if(v===null||typeof v==='boolean'||typeof v==='string')return JSON.stringify(v);if(typeof v==='number'&&Number.isFinite(v))return JSON.stringify(v);if(!v||typeof v!=='object'||seen.has(v))throw TypeError('Checkpoint requires finite acyclic JSON values');seen.add(v);let out;if(Array.isArray(v))out='['+Array.from(v,walk).join(',')+']';else{const keys=Object.keys(v).sort();if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw TypeError('Unsafe checkpoint key');out='{'+keys.map(k=>JSON.stringify(k)+':'+walk(v[k])).join(',')+'}';}seen.delete(v);return out;}return walk(value);}
const cloneJSON=value=>JSON.parse(canonical(value));
function validateCommit(current,expected,next){if((current?.revision??null)!==expected)throw new CheckpointConflictError();if(!next||!Number.isSafeInteger(next.revision)||next.revision!==(expected===null?0:expected+1))throw TypeError('Invalid next revision');}
// Only stores created here can adopt a parent's trusted checkpoint. This is a
// one-shot cold initialization capability, not a general checkpoint rewind API.
const privateMemoryStores=new WeakMap();
function createMemoryCheckpointStore(initial=null){let data=initial===null?null:cloneJSON(initial),fresh=initial===null;const store={load:()=>data===null?null:cloneJSON(data),commit(expected,next){const safe=cloneJSON(next);validateCommit(data,expected,safe);if(expected!==null)fresh=false;data=safe;return cloneJSON(data);}};
 function validateFresh(expected){if(canonical(data)!==canonical(expected))throw new CheckpointConflictError('Exact-parent private checkpoint conflict');if(!fresh||data?.revision!==0||!data.records||!data.receipts||Object.keys(data.records).length||Object.keys(data.receipts).length)throw Object.assign(Error('Private checkpoint adoption requires a fresh empty memory host'),{code:'CHECKPOINT_NOT_FRESH'});}
 privateMemoryStores.set(store,{validateFresh,adoptFresh(expected,next){validateFresh(expected);const safe=cloneJSON(next);data=safe;fresh=false;return cloneJSON(data);}});return store;
}
const getPrivateMemoryCheckpointAccess=store=>privateMemoryStores.get(store)||null;
module.exports={canonical,cloneJSON,validateCommit,createMemoryCheckpointStore,CheckpointConflictError,getPrivateMemoryCheckpointAccess};
