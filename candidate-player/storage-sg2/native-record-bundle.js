// Native archive transport. Content hashes prove exact bytes, NOT earned rewards.
// Semantic verification is a mandatory trusted-code callback, never save data.
// Existing SG2 roots, codecs, per-record ceilings and validators stay unchanged.
import {canonical,clone,sha256,invariant,exactKeys} from '../core/runtime/hash.js';
import {assertBoundedJSON} from '../core/runtime/current-validation.js';
import {parseStrictJSON} from '../core/profile-integration/strict-json.js';
import {assertRoot,BUNDLE_FORMAT,unpackBundle} from './record-bundle.js';
import {prepareRecord,decodeRecord} from './worker-tasks.js';

export const NATIVE_ARCHIVE_SCHEMA='tiny-army-native-linked-archive-1';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function check(signal){if(signal?.aborted)throw Object.assign(Error('Native archive operation canceled'),{name:'AbortError'});}
function requireVerifier(fn){invariant(typeof fn==='function','Native archive requires trusted semantic verifier');}
function verifyNode(node){
 assertBoundedJSON(node);exactKeys(node,['schema','sequence','profileId','previousHead','segmentRoot','checkpoint']);
 invariant(node.schema===NATIVE_ARCHIVE_SCHEMA&&Number.isSafeInteger(node.sequence)&&node.sequence>0,'Invalid native archive sequence');
 invariant(node.sequence===1?node.previousHead===null:hash(node.previousHead),'Native archive predecessor differs');
 assertRoot(node.segmentRoot);invariant(node.segmentRoot.kind==='profile'&&node.segmentRoot.identity===node.profileId,'Native archive profile differs');
 invariant(node.segmentRoot.activeRecord===null&&node.segmentRoot.recordIds.length>0,'Only terminal nonempty segments may be archived');
 return node;
}
async function readNode(id,readRecord,signal){
 check(signal);invariant(hash(id)&&typeof readRecord==='function','Native archive reader/hash required');
 const rec=await readRecord(id);check(signal);invariant(rec&&rec.id===id,'Missing native archive record');
 return verifyNode(parseStrictJSON(decodeRecord(rec)));
}
export const readNativeArchiveHead=readNode;
async function segmentFor(node,readRecord,signal){
 const records=[];for(const id of node.segmentRoot.recordIds){check(signal);const r=await readRecord(id);invariant(r&&r.id===id,'Missing native terminal run proof');records.push(r);}
 check(signal);return {format:BUNDLE_FORMAT,root:node.segmentRoot,records};
}

// The caller supplies its already validated current checkpoint. This operation
// never upgrades local current-state trust to FULL_REPLAY_VERIFIED.
export async function prepareNativeArchive({segmentBundle,previousHead=null,sequence,previousCheckpoint=null,verifySegment,signal}){
 requireVerifier(verifySegment);check(signal);
 // Decode before awaiting: snapshot the caller-owned bundle and evidence.
 const bundle=clone(segmentBundle),value=unpackBundle(bundle),prior=clone(previousCheckpoint);
 invariant(bundle.root.activeRecord===null&&value.completedRuns.length>0,'Native archive requires terminal segment');
 const checkpoint=await verifySegment(value,prior,{signal,mode:'current'});check(signal);
 invariant(checkpoint&&typeof checkpoint==='object','Semantic verifier must return derived checkpoint');
 const node=verifyNode({schema:NATIVE_ARCHIVE_SCHEMA,sequence,profileId:bundle.root.identity,previousHead,segmentRoot:bundle.root,checkpoint:clone(checkpoint)});
 const record=prepareRecord(canonical(node));
 return {head:record.id,sequence,checkpoint:clone(checkpoint),record,records:[...bundle.records,record],verification:'CURRENT_STATE_CHECKED'};
}

// Strict external restore and audit walk the COMPLETE chain and replay every
// segment through the trusted core verifier. A missing predecessor never means
// genesis, and no checkpoint supplied by an imported archive is a trust anchor.
export async function auditNativeArchive({head,readRecord,verifySegment,signal,onProgress=()=>{}}){
 requireVerifier(verifySegment);check(signal);
 if(head===null)return {verification:'FULL_REPLAY_VERIFIED',checkpoint:null,segments:0,profileId:null,proofRecordIds:[]};
 const ids=[];let id=head,expected=null,profileId=null;
 while(id!==null){
  const node=await readNode(id,readRecord,signal);
  if(expected!==null)invariant(node.sequence===expected,'Native archive sequence gap or cycle');
  if(profileId===null)profileId=node.profileId;else invariant(node.profileId===profileId,'Foreign native archive profile');
  ids.push(id);expected=node.sequence-1;id=node.previousHead;
 }
 invariant(expected===0,'Native archive genesis is missing');
 let checkpoint=null,completed=0;const proofRecordIds=new Set();
 for(const archiveId of ids.reverse()){
  const node=await readNode(archiveId,readRecord,signal),bundle=await segmentFor(node,readRecord,signal);
  proofRecordIds.add(archiveId);for(const recordId of node.segmentRoot.recordIds)proofRecordIds.add(recordId);
  const value=unpackBundle(bundle),derived=await verifySegment(value,clone(checkpoint),{signal,mode:'strict'});check(signal);
  invariant(derived&&canonical(derived)===canonical(node.checkpoint),'Native archive checkpoint differs from earned history');
  checkpoint=clone(derived);onProgress({completed:++completed,total:ids.length});check(signal);
 }
 return {verification:'FULL_REPLAY_VERIFIED',checkpoint,segments:ids.length,profileId,proofRecordIds:[...proofRecordIds]};
}

// Yield existing immutable records separately; never merge all run JSON into a
// single record or imply that a current-only export has been historically audited.
export async function* exportNativeArchiveRecords({head,readRecord,signal}){
 let id=head,expected=null,profileId=null;const emitted=new Set();
 while(id!==null){
  const node=await readNode(id,readRecord,signal);
  if(expected!==null)invariant(node.sequence===expected,'Native archive sequence gap or cycle');
  if(profileId===null)profileId=node.profileId;else invariant(node.profileId===profileId,'Foreign native archive profile');
  for(const recordId of [id,...node.segmentRoot.recordIds])if(!emitted.has(recordId)){
   check(signal);const record=await readRecord(recordId);invariant(record&&record.id===recordId,'Missing native export proof');decodeRecord(record);emitted.add(recordId);yield clone(record);
  }
  expected=node.sequence-1;id=node.previousHead;
 }
 invariant(head===null||expected===0,'Native export genesis missing');
}

// Atomic SG2-compatible commit descriptor. The store commits all records and
// the checkpoint root together using its existing CAS/receipt/quota semantics.
// This does not authorize a root: callers must validate native account semantics.
export function prepareNativeArchiveCommit({slot,expectedRootHash,transactionId,root,records,settlementKeys=[]}){
 assertBoundedJSON(root);invariant(root.previousRootHash===expectedRootHash&&root.transactionId===transactionId,'Native commit base differs');
 invariant(Array.isArray(root.recordIds)&&root.recordIds.length<=8&&new Set(root.recordIds).size===root.recordIds.length&&root.recordIds.every(hash),'Native root references exceed existing bound');
 const {hash:rootHash,...body}=root;invariant(hash(rootHash)&&rootHash===sha256(canonical(body)),'Native root hash differs');
 const detached=clone(records);const seen=new Set();for(const record of detached){invariant(!seen.has(record.id),'Duplicate native prepared record');decodeRecord(record);seen.add(record.id);}
 invariant(Array.isArray(settlementKeys)&&settlementKeys.every(x=>typeof x==='string'&&x.length>0&&x.length<=4096)&&new Set(settlementKeys).size===settlementKeys.length,'Invalid native settlement keys');
 const payload={slot,expectedRootHash,transactionId,root:clone(root),records:detached,settlementKeys:[...settlementKeys].sort()};
 return {...payload,commitHash:sha256(canonical(payload))};
}
