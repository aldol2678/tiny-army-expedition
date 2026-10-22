// Worker-only record preparation. These functions never read or write a store.
import {canonical,sha256,invariant,exactKeys} from '../core/runtime/hash.js';
import {assertBoundedJSON} from '../core/runtime/current-validation.js';
import {parseStrictJSON} from '../core/profile-integration/strict-json.js';
import {prepareRecord,decodeRecord} from './worker-tasks.js';
export const ROOT_SCHEMA='tiny-army-sg2-root-1', BUNDLE_FORMAT='tiny-army-sg2-bundle-1';
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function rootHash(root){const {hash:ignored,...body}=root;return sha256(canonical(body));}
export function assertRoot(root){
 assertBoundedJSON(root);exactKeys(root,['schema','kind','revision','identity','metadataRecord','activeRecord','recordIds','completedIds','logicalHash','previousRootHash','transactionId','hash']);
 invariant(root.schema===ROOT_SCHEMA&&['profile','runtime'].includes(root.kind),'Unsupported SG2 root');
 invariant(hash(root.hash)&&root.hash===rootHash(root)&&hash(root.logicalHash),'SG2 root hash differs');
 invariant(root.previousRootHash===null||hash(root.previousRootHash),'Invalid SG2 base hash');
 invariant(Number.isSafeInteger(root.revision)&&root.revision>=0&&typeof root.identity==='string'&&typeof root.transactionId==='string','Invalid SG2 identity');
 invariant(Array.isArray(root.recordIds)&&root.recordIds.length<=8&&new Set(root.recordIds).size===root.recordIds.length&&root.recordIds.every(hash),'Invalid SG2 archive references');
 invariant(canonical(root.completedIds)===canonical(root.recordIds),'Archive ordering differs');
 invariant(root.kind==='profile'?root.metadataRecord!==null:root.metadataRecord===null&&root.recordIds.length===0,'SG2 record kind differs');
 invariant(new TextEncoder().encode(canonical(root)).length<=16*1024*1024,'SG2 root exceeds original16MiB envelope limit');
 return true;
}
export function unpackBundle(bundle){
 invariant(bundle?.format===BUNDLE_FORMAT,'Explicit SG2 bundle required');exactKeys(bundle,['format','root','records']);assertRoot(bundle.root);
 const {root}=bundle;invariant(Array.isArray(bundle.records)&&bundle.records.length===root.recordIds.length,'Missing or extra archive records');
 const byId=new Map();for(const rec of bundle.records){invariant(root.recordIds.includes(rec.id)&&!byId.has(rec.id),'Unexpected/duplicate archive');byId.set(rec.id,parseStrictJSON(decodeRecord(rec)));}
 const active=root.activeRecord===null?null:parseStrictJSON(decodeRecord(root.activeRecord));
 let value;if(root.kind==='runtime'){invariant(active!==null,'Missing runtime');value=active;}
 else{const metadata=parseStrictJSON(decodeRecord(root.metadataRecord));assertBoundedJSON(metadata);invariant(!Object.hasOwn(metadata,'activeRun')&&!Object.hasOwn(metadata,'completedRuns'),'Metadata contains embedded run');value={...metadata,activeRun:active,completedRuns:root.recordIds.map(id=>byId.get(id))};}
 invariant(sha256(canonical(value))===root.logicalHash,'Logical bundle hash differs');
 invariant(value.revision===root.revision&&(value.profileId??value.runId)===root.identity,'Root/logical identity differs');return value;
}
export function packBundle(kind,value,{transactionId,previousRootHash=null,archiveRecords=[]}={}){
 invariant(['profile','runtime'].includes(kind),'Invalid bundle kind');let metadataRecord=null,activeRecord=null,records=[];
 if(kind==='profile'){const {activeRun,completedRuns,...metadata}=value;assertBoundedJSON(metadata);metadataRecord=prepareRecord(canonical(metadata));activeRecord=activeRun?prepareRecord(canonical(activeRun)):null;records=completedRuns.map((run,index)=>{const raw=canonical(run),existing=archiveRecords[index];return existing&&existing.hash===sha256(raw)?existing:prepareRecord(raw);});}
 else activeRecord=prepareRecord(canonical(value));
 const recordIds=records.map(x=>x.id),root={schema:ROOT_SCHEMA,kind,revision:value.revision,identity:value.profileId??value.runId,metadataRecord,activeRecord,recordIds,completedIds:[...recordIds],logicalHash:sha256(canonical(value)),previousRootHash,transactionId};root.hash=rootHash(root);assertRoot(root);
 return {format:BUNDLE_FORMAT,root,records};
}
export function prepareCommit(bundle,{slot,expectedRootHash=null,transactionId,settlementKeys=[],existingRecordIds=[]}){
 assertRoot(bundle.root);invariant(bundle.root.previousRootHash===expectedRootHash&&bundle.root.transactionId===transactionId,'Prepared commit base/transaction differs');
 const payload={slot,expectedRootHash,transactionId,root:bundle.root,records:bundle.records.filter(r=>!existingRecordIds.includes(r.id)),settlementKeys:[...settlementKeys].sort()};
 return {...payload,commitHash:sha256(canonical(payload))};
}
export function settlementKeys(value){return value.tokenAccount?.entries.flatMap(e=>e.credits.map(c=>JSON.stringify([c.runId,c.battleId])))??[];}
