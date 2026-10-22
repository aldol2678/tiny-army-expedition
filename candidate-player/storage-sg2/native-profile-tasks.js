// Native-only bounded live segments; archived proofs remain immutable SG2 records.
import {canonical,clone,sha256,invariant,exactKeys} from '../core/runtime/hash.js';
import {assertBoundedJSON} from '../core/runtime/current-validation.js';
import {parseStrictJSON} from '../core/profile-integration/strict-json.js';
import * as P from '../core/profile-integration/portable.js';
import {isNativeOrigin} from '../core/profile-integration/native.js';
import {createNativeCheckpoint,createNativeCheckpointCurrent,createNativeFromCheckpoint,validateNativeSegmentStrictAsync} from '../core/profile-integration/native-checkpoint.js';
import {dispatchProfileTask} from './profile-tasks.js';
import {ensureWorkerEngine} from './worker-engine.js';
import {BUNDLE_FORMAT,unpackBundle,assertRoot,settlementKeys} from './record-bundle.js';
import {packBundleAsync,prepareCommitAsync} from './record-bundle-async.js';
import {decodeRecord} from './worker-tasks.js';
import {prepareNativeArchive,auditNativeArchive,prepareNativeArchiveCommit,readNativeArchiveHead} from './native-record-bundle.js';
export const NATIVE_ROOT_SCHEMA='tiny-army-native-current-root-2';
export const NATIVE_BACKUP_FORMAT='tiny-army-native-archive-jsonl-2';
const previews=new Map(),hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const abort=signal=>{if(signal?.aborted)throw Object.assign(Error('Native task canceled'),{name:'AbortError'});};
function recordMap(records){invariant(Array.isArray(records),'Native records required');const map=new Map();for(const r of records){invariant(!map.has(r.id),'Duplicate native backup record');decodeRecord(r);map.set(r.id,r);}return map;}
export function assertNativeRoot(root){
 assertBoundedJSON(root);exactKeys(root,['schema','identity','revision','liveRoot','archiveHead','archiveCount','recordIds','previousRootHash','transactionId','hash']);
 invariant(root.schema===NATIVE_ROOT_SCHEMA&&Number.isSafeInteger(root.revision)&&root.revision>=0,'Unsupported native root');
 assertRoot(root.liveRoot);invariant(root.liveRoot.kind==='profile'&&root.identity===root.liveRoot.identity,'Native root identity differs');
 invariant(Number.isSafeInteger(root.archiveCount)&&root.archiveCount>=0&&(root.archiveCount===0?root.archiveHead===null:hash(root.archiveHead)),'Native archive head/count differs');
 invariant(canonical(root.recordIds)===canonical([...root.liveRoot.recordIds,...(root.archiveHead?[root.archiveHead]:[])])&&root.recordIds.length<=8&&new Set(root.recordIds).size===root.recordIds.length,'Native root reference bound differs');
 invariant(root.previousRootHash===null||hash(root.previousRootHash),'Invalid native previous hash');
 const {hash:h,...body}=root;invariant(hash(h)&&h===sha256(canonical(body)),'Native root hash differs');return true;
}
async function current(bundle,signal){
 const root=bundle.root,map=recordMap(bundle.records);let live,head=null,count=0;
 if(root.schema===NATIVE_ROOT_SCHEMA){assertNativeRoot(root);live=root.liveRoot;head=root.archiveHead;count=root.archiveCount;}
 else{assertRoot(root);live=root;}
 invariant(bundle.records.length===(root.recordIds?.length??0),'Missing or extra native current records');
 const value=unpackBundle({format:BUNDLE_FORMAT,root:live,records:live.recordIds.map(id=>map.get(id))});
 invariant(isNativeOrigin(value.origin),'Native player session cannot reinterpret legacy profile');
 P.validateProfileEnvelopeRecordsCurrent(value);let checkpoint=null;
 if(head){const node=await readNativeArchiveHead(head,async id=>map.get(id),signal);invariant(node.sequence===count&&node.profileId===value.profileId,'Native archive head identity differs');checkpoint=node.checkpoint;}
 invariant(canonical(value.origin.checkpoint??null)===canonical(checkpoint),'Native live checkpoint does not match archive head');
 return {value,liveBundle:{format:BUNDLE_FORMAT,root:live,records:live.recordIds.map(id=>map.get(id))},head,count,checkpoint,map};
}
const segmentVerifier=simulationOptions=>async(value,checkpoint,{mode,signal})=>{invariant(canonical(value.origin.checkpoint??null)===canonical(checkpoint),'Native segment checkpoint linkage differs');return mode==='strict'?createNativeCheckpoint(value,{...simulationOptions,verifiedCheckpoint:checkpoint,signal}):createNativeCheckpointCurrent(value);};
function project(value){return {run:value.activeRun,envelope:{profileId:value.profileId,revision:value.revision,activeRun:value.activeRun,completedRuns:value.completedRuns.map(r=>({runId:r.runId}))},view:P.profileViewRecordsCurrent(value)};}
function summary(value,count){return {verification:'CURRENT_STATE_CHECKED',kind:'profile',identity:value.profileId,revision:value.revision,completedRuns:value.candidateRecords.runs,archivedSegments:count,phase:value.activeRun?.state.phase??'profile',battles:value.activeRun?.state.battleCount??0,tokens:value.tokenAccount.balance};}
function rootFor(live,head,count,{transactionId,expectedRootHash,revision}){const root={schema:NATIVE_ROOT_SCHEMA,identity:live.identity,revision,liveRoot:live,archiveHead:head,archiveCount:count,recordIds:[...live.recordIds,...(head?[head]:[])],previousRootHash:expectedRootHash,transactionId};root.hash=sha256(canonical(root));assertNativeRoot(root);return root;}
async function fullAudit(bundle,archiveRecords,signal,simulationOptions){
 const verifySegment=segmentVerifier(simulationOptions);
 const c=await current(bundle,signal),map=recordMap(archiveRecords??[]);
 for(const [id,record]of c.map){if(map.has(id))invariant(canonical(map.get(id))===canonical(record),'Native audit record collision');else map.set(id,record);}
 const audit=await auditNativeArchive({head:c.head,readRecord:async id=>map.get(id),verifySegment,signal});
 invariant(audit.segments===c.count,'Native audit count differs');
 const reachable=new Set([...audit.proofRecordIds,...c.map.keys()]);invariant(map.size===reachable.size&&[...map.keys()].every(id=>reachable.has(id)),'Unreferenced native backup proof records');
 await validateNativeSegmentStrictAsync(c.value,{...simulationOptions,verifiedCheckpoint:audit.checkpoint,signal});abort(signal);
 return {verification:'FULL_REPLAY_VERIFIED',projection:project(c.value),segments:c.count};
}
function parseBackup(raw){
 const lines=raw.split('\n');invariant(lines.length>=1&&!lines.some(x=>x===''),'Invalid native archive framing');
 const header=parseStrictJSON(lines[0]);exactKeys(header,['format','root']);invariant(header.format===NATIVE_BACKUP_FORMAT,'Explicit native archive backup required');assertNativeRoot(header.root);
 const all=lines.slice(1).map(line=>{const x=parseStrictJSON(line);exactKeys(x,['record']);return x.record;}),map=recordMap(all);
 const records=header.root.recordIds.map(id=>{invariant(map.has(id),'Missing native current backup record');return map.get(id);});
 return {bundle:{format:BUNDLE_FORMAT,root:header.root,records},archiveRecords:all};
}
export async function dispatchNativeProfileTask(kind,payload,{signal,simulationOptions}={}){
 // Trusted in-process test dependency only. Worker RPC payloads never supply
 // simulationOptions; production keeps its existing simulation defaults.
 const verifySegment=segmentVerifier(simulationOptions);
 await ensureWorkerEngine();abort(signal);const type=kind.split(':')[1];
 if(type==='archiveReferences'){
  const node=await readNativeArchiveHead(payload.id,async id=>id===payload.record?.id?payload.record:null,signal);
  return {previousHead:node.previousHead,sequence:node.sequence,profileId:node.profileId,recordIds:node.segmentRoot.recordIds};
 }
 if(type==='preview'){
  const source=parseBackup(payload.raw);await fullAudit(source.bundle,source.archiveRecords,signal,simulationOptions);
  const c=await current(source.bundle,signal),previewDigest=sha256(payload.raw);previews.set(previewDigest,{raw:payload.raw,...source});if(previews.size>4)previews.delete(previews.keys().next().value);
  return {previewDigest,conversion:true,sourceFormat:NATIVE_BACKUP_FORMAT,projection:project(c.value),summary:summary(c.value,c.count)};
 }
 if(type==='import'){
  invariant(payload.confirmed===true,'Explicit native import confirmation required');const p=previews.get(payload.previewDigest);invariant(p&&p.raw===payload.raw,'Strict exact native import preview required');
  invariant(payload.expectedRootHash===null,'Native import requires empty slot');await fullAudit(p.bundle,p.archiveRecords,signal,simulationOptions);const c=await current(p.bundle,signal);
  const root=rootFor(c.liveBundle.root,c.head,c.count,{transactionId:payload.transactionId,expectedRootHash:null,revision:0});
  return {commit:prepareNativeArchiveCommit({slot:payload.slot,expectedRootHash:null,transactionId:payload.transactionId,root,records:p.archiveRecords}),projection:project(c.value),summary:summary(c.value,c.count),backup:{raw:payload.raw,physical:payload.raw}};
 }
 const c=type==='new'?null:await current(payload.bundle,signal);
 if(type==='inspect')return {projection:project(c.value),summary:summary(c.value,c.count)};
 if(type==='preserved')return {raw:null};
 if(type==='audit')return fullAudit(payload.bundle,payload.archiveRecords,signal,simulationOptions);
 if(type==='export'){
  // Export preserves exact proof; audit is deliberately a separate operation.
  const records=recordMap(payload.archiveRecords??[]);for(const [id,record]of c.map)records.set(id,record);
  const sourceRoot=payload.bundle.root,exportRoot=sourceRoot.schema===NATIVE_ROOT_SCHEMA?sourceRoot:rootFor(c.liveBundle.root,c.head,c.count,{transactionId:sourceRoot.transactionId,expectedRootHash:sourceRoot.previousRootHash,revision:sourceRoot.revision});
  const lines=[canonical({format:NATIVE_BACKUP_FORMAT,root:exportRoot}),...[...records.values()].map(record=>canonical({record}))];
  // Each line is independently bounded and strictly parseable on restore.
  for(const line of lines)parseStrictJSON(line);
  return {exportRaw:lines.join('\n'),format:NATIVE_BACKUP_FORMAT,summary:summary(c.value,c.count)};
 }
 invariant(type==='new'||type==='transition','Unsupported native task');
 if(type==='transition')invariant(payload.expectedRootHash===payload.bundle.root.hash,'Native outer transaction base differs');
 const promotedRecords=[];
 // A previously saved native v1 profile may already contain all eight terminal
 // runs. Fold it atomically BEFORE the requested next action, never force the
 // old validator past its bound or drop the player's original evidence.
 if(c&&c.value.activeRun===null&&c.value.completedRuns.length){
  const archive=await prepareNativeArchive({segmentBundle:c.liveBundle,previousHead:c.head,sequence:c.count+1,previousCheckpoint:c.checkpoint,verifySegment,signal});
  promotedRecords.push(...archive.records);c.head=archive.head;c.count=archive.sequence;c.checkpoint=archive.checkpoint;c.value=createNativeFromCheckpoint(archive.checkpoint);
  c.liveBundle=await packBundleAsync('profile',c.value,{transactionId:payload.transactionId,signal});
 }
 const oldPayload={...payload,...(c?{bundle:c.liveBundle,expectedRootHash:c.liveBundle.root.hash}:{})};
 let old;
 if(type==='transition'&&simulationOptions){
  const result=await P.transitionProfileRecordsCurrentResultAsync(c.value,payload.action,payload.transactionId,c.value.revision,{...simulationOptions,signal});
  const bundle=await packBundleAsync('profile',result.value,{signal,transactionId:payload.transactionId,previousRootHash:c.liveBundle.root.hash,archiveRecords:c.liveBundle.records});
  const prior=new Set(settlementKeys(c.value));
  old={commit:await prepareCommitAsync(bundle,{signal,slot:payload.slot,expectedRootHash:c.liveBundle.root.hash,transactionId:payload.transactionId,settlementKeys:settlementKeys(result.value).filter(key=>!prior.has(key)),existingRecordIds:c.liveBundle.root.recordIds})};
 }else old=await dispatchProfileTask('profile:'+type,oldPayload,{signal});
 let live={format:BUNDLE_FORMAT,root:old.commit.root,records:old.commit.records};
 // Existing old-task archive records may have been omitted from its commit.
 if(c){const map=new Map([...c.liveBundle.records,...old.commit.records].map(r=>[r.id,r]));live.records=live.root.recordIds.map(id=>map.get(id));}
 let value=unpackBundle(live),head=c?.head??null,count=c?.count??0,records=[...promotedRecords,...live.records];
 if(value.activeRun===null&&value.completedRuns.length){
  const archive=await prepareNativeArchive({segmentBundle:live,previousHead:head,sequence:count+1,previousCheckpoint:c?.checkpoint??null,verifySegment,signal});
  head=archive.head;count=archive.sequence;records.push(archive.record);value=createNativeFromCheckpoint(archive.checkpoint);
  live=await packBundleAsync('profile',value,{transactionId:payload.transactionId,signal});
  records.push(...live.records);
 }
 const expectedRootHash=payload.expectedRootHash??null,root=rootFor(live.root,head,count,{transactionId:payload.transactionId,expectedRootHash,revision:(payload.bundle?.root.revision??-1)+1});
 const unique=[...new Map(records.map(r=>[r.id,r])).values()];
 return {commit:prepareNativeArchiveCommit({slot:payload.slot,expectedRootHash,transactionId:payload.transactionId,root,records:unique,settlementKeys:old.commit.settlementKeys}),projection:project(value),summary:summary(value,count)};
}
