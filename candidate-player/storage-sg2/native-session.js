import {createRecordSession} from './session.js';
// Same public API as the existing profile session. Main thread only transfers
// immutable stored records; all gameplay and historical verification is worker-only.
export function createNativeProfileSession({store,worker,slot,id,onChange}){
 let staged=new Map();
 const trackedStore={read:key=>store.read(key),readRecord:key=>store.readRecord(key),close:()=>store.close(),async commit(input){
  const captured=new Map(input.records.map(record=>[record.id,record]));staged=captured;
  const result=await store.commit(input);if(staged===captured)staged=new Map();return result;
 }};
 const routedWorker={close:()=>worker.close(),async request(kind,payload={},options={}){
  if(!kind.startsWith('profile:'))return worker.request(kind,payload,options);
  const type=kind.split(':')[1];
  if(type==='audit'||type==='export'){
   const archiveRecords=[],seen=new Set();let head=payload.bundle?.root.archiveHead??null,expected=payload.bundle?.root.archiveCount??0;
   const supplied=new Map((payload.bundle?.records??[]).map(record=>[record.id,record]));
   const readRecord=key=>supplied.get(key)??staged.get(key)??store.readRecord(key);
   while(head!==null){
    if(options.signal?.aborted)throw Object.assign(Error('Native archive read canceled'),{name:'AbortError'});
    const record=await readRecord(head);if(!record)throw Error('Missing native archive record');
    const refs=await worker.request('native:archiveReferences',{id:head,record},options);
    if(refs.sequence!==expected||refs.profileId!==payload.bundle.root.identity)throw Error('Native archive sequence or identity differs');
    if(!seen.has(head)){archiveRecords.push(record);seen.add(head);}
    for(const key of refs.recordIds)if(!seen.has(key)){const proof=await readRecord(key);if(!proof)throw Error('Missing native terminal proof');archiveRecords.push(proof);seen.add(key);}
    expected--;head=refs.previousHead;
   }
   if(expected!==0)throw Error('Native archive genesis missing');
   payload={...payload,archiveRecords};
  }
  return worker.request('native:'+type,payload,options);
 }};
 return createRecordSession({store:trackedStore,worker:routedWorker,slot,kind:'profile',id,onChange});
}
