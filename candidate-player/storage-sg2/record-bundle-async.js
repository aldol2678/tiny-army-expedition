// Byte-identical SG2 preparation with native asynchronous SHA-256.
// The durable schema, strict restore/audit policy and atomic store are unchanged.
import {canonical,invariant,exactKeys,clone} from '../core/runtime/hash.js';
import {assertBoundedJSON} from '../core/runtime/current-validation.js';
import {parseStrictJSON} from '../core/profile-integration/strict-json.js';
import {prepareRecordAsync,decodeRecordAsync,sha256Async} from './record-codec-async.js';
import {ROOT_SCHEMA,BUNDLE_FORMAT} from './record-bundle.js';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function check({signal}={}){if(signal?.aborted)throw Object.assign(Error('Storage worker request canceled'),{name:'AbortError',code:'SAVE_WORKER_ABORTED'});}
function fields(value,keys){
 invariant(value&&typeof value==='object'&&!Array.isArray(value),'Expected plain SG2 object');
 const p=Object.getPrototypeOf(value);invariant(p===Object.prototype||p===null,'Expected plain SG2 object');
 const own=Reflect.ownKeys(value),d=Object.getOwnPropertyDescriptors(value);
 invariant(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&Object.hasOwn(d[k],'value')&&d[k].enumerable),'Invalid SG2 object fields');
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function boundedSnapshot(value){assertBoundedJSON(value);return clone(value);}
function recordSnapshot(value){
 const r=fields(value,['id','hash','packed','rawChars','rawBytes']);
 invariant(typeof r.id==='string'&&typeof r.hash==='string'&&typeof r.packed==='string'&&Number.isSafeInteger(r.rawChars)&&Number.isSafeInteger(r.rawBytes),'Invalid archive record fields');
 invariant(r.packed.length<=16*1024*1024+1024,'Stored save exceeds codec bound');
 return r; // A record's wrapper is not a second combined string-budget ceiling.
}
function snapshotRecords(a){
 invariant(Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype,'Missing archive records');
 const d=Object.getOwnPropertyDescriptors(a),keys=Reflect.ownKeys(a),length=d.length?.value;
 invariant(Number.isSafeInteger(length)&&length>=0&&length<=8&&keys.length===length+1,'Invalid archive record array');
 const records=[];for(let i=0;i<length;i++){const v=d[i];invariant(v&&Object.hasOwn(v,'value')&&v.enumerable,'Invalid archive record element');records.push(recordSnapshot(v.value));}
 return records;
}
function snapshotBundle(bundle){
 const b=fields(bundle,['format','root','records']);invariant(b.format===BUNDLE_FORMAT,'Explicit SG2 bundle required');
 return {format:BUNDLE_FORMAT,root:boundedSnapshot(b.root),records:snapshotRecords(b.records)};
}
async function rootHash(root,options){const {hash:ignored,...body}=root;return sha256Async(canonical(body),options);}
async function assertRoot(root,options){
 assertBoundedJSON(root);exactKeys(root,['schema','kind','revision','identity','metadataRecord','activeRecord','recordIds','completedIds','logicalHash','previousRootHash','transactionId','hash']);
 invariant(root.schema===ROOT_SCHEMA&&['profile','runtime'].includes(root.kind),'Unsupported SG2 root');
 invariant(hash(root.hash)&&root.hash===await rootHash(root,options)&&hash(root.logicalHash),'SG2 root hash differs');check(options);
 invariant(root.previousRootHash===null||hash(root.previousRootHash),'Invalid SG2 base hash');
 invariant(Number.isSafeInteger(root.revision)&&root.revision>=0&&typeof root.identity==='string'&&typeof root.transactionId==='string','Invalid SG2 identity');
 invariant(Array.isArray(root.recordIds)&&root.recordIds.length<=8&&new Set(root.recordIds).size===root.recordIds.length&&root.recordIds.every(hash),'Invalid SG2 archive references');
 invariant(canonical(root.completedIds)===canonical(root.recordIds),'Archive ordering differs');
 invariant(root.kind==='profile'?root.metadataRecord!==null:root.metadataRecord===null&&root.recordIds.length===0,'SG2 record kind differs');
 invariant(new TextEncoder().encode(canonical(root)).length<=16*1024*1024,'SG2 root exceeds original16MiB envelope limit');return true;
}
export async function unpackBundleAsync(input,{signal}={}){
 const options={signal};check(options);const bundle=snapshotBundle(input),{root}=bundle;await assertRoot(root,options);
 invariant(bundle.records.length===root.recordIds.length,'Missing or extra archive records');
 const byId=new Map();for(const rec of bundle.records){invariant(root.recordIds.includes(rec.id)&&!byId.has(rec.id),'Unexpected/duplicate archive');byId.set(rec.id,parseStrictJSON(await decodeRecordAsync(rec,options)));}
 const active=root.activeRecord===null?null:parseStrictJSON(await decodeRecordAsync(root.activeRecord,options));
 let value;if(root.kind==='runtime'){invariant(active!==null,'Missing runtime');value=active;}
 else{const metadata=parseStrictJSON(await decodeRecordAsync(root.metadataRecord,options));assertBoundedJSON(metadata);invariant(!Object.hasOwn(metadata,'activeRun')&&!Object.hasOwn(metadata,'completedRuns'),'Metadata contains embedded run');value={...metadata,activeRun:active,completedRuns:root.recordIds.map(id=>byId.get(id))};}
 invariant(await sha256Async(canonical(value),options)===root.logicalHash,'Logical bundle hash differs');
 invariant(value.revision===root.revision&&(value.profileId??value.runId)===root.identity,'Root/logical identity differs');check(options);return value;
}
export async function packBundleAsync(kind,value,{transactionId,previousRootHash=null,archiveRecords=[],signal}={}){
 const options={signal};check(options);invariant(['profile','runtime'].includes(kind),'Invalid bundle kind');
 const existingArchives=snapshotRecords(archiveRecords);
 // Serialize all input before the first await. No caller-owned object survives an
 // async boundary, and no trust cache is introduced. Validation is per record so
 // existing eight-archive profiles do not acquire a new combined 16MiB ceiling.
 let metadataRaw=null,activeRaw=null,archiveRaws=[],revision,identity,logicalRaw;
 if(kind==='profile'){
  invariant(value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),'Unsafe profile prototype');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  invariant(Reflect.ownKeys(value).every(k=>typeof k==='string'&&Object.hasOwn(descriptors[k],'value')&&descriptors[k].enumerable),'Unsafe profile fields');
  const {activeRun,completedRuns,...metadata}=value;assertBoundedJSON(metadata);
  invariant(Array.isArray(completedRuns)&&Object.getPrototypeOf(completedRuns)===Array.prototype&&completedRuns.length<=8,'Invalid completed run bound');
  // Per-element descriptor checks happen before map or property reads.
  const d=Object.getOwnPropertyDescriptors(completedRuns);invariant(Reflect.ownKeys(completedRuns).length===completedRuns.length+1,'Invalid completed run array');
  for(let i=0;i<completedRuns.length;i++)invariant(d[i]&&Object.hasOwn(d[i],'value')&&d[i].enumerable,'Unsafe completed run');
  metadataRaw=canonical(metadata);if(activeRun!==null){assertBoundedJSON(activeRun);activeRaw=canonical(activeRun);}archiveRaws=completedRuns.map(r=>{assertBoundedJSON(r);return canonical(r);});
  // Preserve the exact canonical envelope, including its sorted field order.
  logicalRaw='{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+(k==='activeRun'?(activeRaw??'null'):k==='completedRuns'?'['+archiveRaws.join(',')+']':canonical(metadata[k]))).join(',')+'}';revision=metadata.revision;identity=metadata.profileId??metadata.runId;
 }else{assertBoundedJSON(value);activeRaw=canonical(value);logicalRaw=activeRaw;revision=value.revision;identity=value.profileId??value.runId;}
 const metadataRecord=metadataRaw===null?null:await prepareRecordAsync(metadataRaw,options);
 const activeRecord=activeRaw===null?null:await prepareRecordAsync(activeRaw,options);
 // Preserve already verified immutable archives, but never trust hash equality
 // without checking their exact bytes. All snapshots were taken before awaits.
 const records=[];for(let i=0;i<archiveRaws.length;i++){const raw=archiveRaws[i],existing=existingArchives[i];if(existing&&existing.hash===await sha256Async(raw,options)){invariant(await decodeRecordAsync(existing,options)===raw,'Immutable archive bytes differ');records.push(existing);}else records.push(await prepareRecordAsync(raw,options));}
 const recordIds=records.map(x=>x.id),root={schema:ROOT_SCHEMA,kind,revision,identity,metadataRecord,activeRecord,recordIds,completedIds:[...recordIds],logicalHash:kind==='runtime'?activeRecord.hash:await sha256Async(logicalRaw,options),previousRootHash,transactionId};
 root.hash=await rootHash(root,options);await assertRoot(root,options);check(options);return {format:BUNDLE_FORMAT,root,records};
}
export async function prepareCommitAsync(input,{slot,expectedRootHash=null,transactionId,settlementKeys=[],existingRecordIds=[],signal}){
 const options={signal};check(options);const bundle=snapshotBundle(input),keys=boundedSnapshot(settlementKeys),existing=boundedSnapshot(existingRecordIds);
 await assertRoot(bundle.root,options);invariant(bundle.root.previousRootHash===expectedRootHash&&bundle.root.transactionId===transactionId,'Prepared commit base/transaction differs');
 const payload={slot,expectedRootHash,transactionId,root:bundle.root,records:bundle.records.filter(r=>!existing.includes(r.id)),settlementKeys:[...keys].sort()};
 const commitHash=await sha256Async(canonical(payload),options);check(options);return {...payload,commitHash};
}
