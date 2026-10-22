import {ensureWorkerEngine} from './worker-engine.js';
import {canonical,invariant} from '../core/runtime/hash.js';
import {decodeStoredSave} from '../model/storage-codec.js';
import * as P from '../core/profile-integration/portable.js';
import * as R from '../core/runtime/browser-api.js';
import {assertBoundedJSON} from '../core/runtime/current-validation.js';
import {makeFamilySelection} from '../core/family-selection/contract.js';
import {RCI2_PROFILE} from '../core/rci2/identity.js';
import {parseBundleJSON} from './bundle-json.js';
import {parseStrictJSON} from '../core/profile-integration/strict-json.js';
import {settlementKeys} from './record-bundle.js';
import {packBundleAsync,unpackBundleAsync,prepareCommitAsync} from './record-bundle-async.js';
const previews=new Map();
function projection(kind,value,checkedProfileView){const run=kind==='profile'?value.activeRun:value;return {run,envelope:kind==='profile'?{profileId:value.profileId,revision:value.revision,activeRun:run,completedRuns:value.completedRuns.map(r=>({runId:r.runId}))}:null,view:kind==='profile'?(checkedProfileView??P.profileViewRecordsCurrent(value)):null};}
const validate=(kind,value)=>{if(kind==='profile')return P.validateProfileEnvelopeRecordsCurrent(value);invariant(!value.profileStart&&value.schema!==R.PROFILE_RUN_SCHEMA,'Profile-bound run requires its complete profile, not standalone import');return R.validateRuntimeCurrent(value);};
function summary(kind,value){return {verification:'CURRENT_STATE_CHECKED',kind,identity:value.profileId??value.runId,revision:value.revision,completedRuns:value.completedRuns?.length??0,phase:(value.activeRun??value).state?.phase??'profile',battles:(value.activeRun??value).state?.battleCount??0,tokens:value.tokenAccount?.balance??value.preservedProfile?.tokens??null};}
export async function dispatchProfileTask(kind,payload,{signal}={}){
 const check=()=>{if(signal?.aborted)throw Object.assign(Error('SG2 worker operation canceled'),{name:'AbortError'});};check();
 await ensureWorkerEngine();check();
 const isProfile=kind.startsWith('profile:'),type=kind.split(':')[1],recordKind=isProfile?'profile':'runtime';
 if(type==='preview'){
  const raw=decodeStoredSave(payload.raw),parsed=parseBundleJSON(raw);let value,legacy=null,bundleSource=false;
  if(parsed?.format==='tiny-army-sg2-bundle-1'){
   invariant(parsed.root?.kind===recordKind,'Backup kind differs');value=await unpackBundleAsync(parsed,{signal});validate(recordKind,value);
   // Explicit external restore retains strict historical verification, unlike resume.
   if(isProfile)await P.validateProfileEnvelopeRecordsStrictAsync(value,{signal});else await R.importRuntimeAsync(canonical(value),{signal});check();bundleSource=true;
  }else if(isProfile){if(Object.hasOwn(parsed,'completedRuns'))value=await P.importProfileEnvelopeAsync(raw,{signal});else{legacy=P.previewLegacyImport(raw,{profileId:payload.profileId??'sg2-preserved-profile',transactionId:payload.transactionId??'sg2-preview'});if(!legacy.conversion)return {conversion:false,changes:legacy.changes,previewDigest:legacy.previewDigest};value=P.acceptLegacyPreview(legacy,{confirmedPreviewDigest:legacy.previewDigest});}}
  else value=await R.importRuntimeAsync(raw,{signal});
  validate(recordKind,value);
  const previewDigest=(await import('../core/runtime/hash.js')).sha256(payload.raw);previews.set(previewDigest,{recordKind,raw:payload.raw,value,bundleSource});if(previews.size>4)previews.delete(previews.keys().next().value);
  return {projection:projection(recordKind,value),summary:summary(recordKind,value),previewDigest,changes:legacy?.changes??null,conversion:true,sourceFormat:bundleSource?'sg2-record-bundle':'legacy-json'};
 }
 if(type==='new'){
  if(isProfile){invariant(payload.expectedRootHash===null||payload.expectedRootHash===undefined,'Native profile creation requires empty slot');const value=P.createNativeProfile(payload.profileId);const bundle=await packBundleAsync(recordKind,value,{signal,transactionId:payload.transactionId});return {commit:await prepareCommitAsync(bundle,{signal,slot:payload.slot,expectedRootHash:null,transactionId:payload.transactionId}),summary:summary(recordKind,value),projection:projection(recordKind,value)};}
  if(payload.expectedRootHash!==null&&payload.expectedRootHash!==undefined){invariant(payload.bundle?.root.hash===payload.expectedRootHash,'New runtime base differs');const previous=await unpackBundleAsync(payload.bundle,{signal});R.validateRuntimeCurrent(previous);invariant(previous.state.phase==='complete','Only terminal standalone run can be replaced');}
  const options=payload.options??{},value=R.createRuntimeCurrent(payload.seed,payload.runId,{encounterProfile:options.encounterProfile??RCI2_PROFILE,...(options.familySelection?{familySelection:options.familySelection}:{}),...(options.selectedBaseFamilyIds?{familySelection:makeFamilySelection({selectedBaseFamilyIds:options.selectedBaseFamilyIds})}:{})});
  const bundle=await packBundleAsync(recordKind,value,{signal,transactionId:payload.transactionId,previousRootHash:payload.expectedRootHash??null});
  return {commit:await prepareCommitAsync(bundle,{signal,slot:payload.slot,expectedRootHash:payload.expectedRootHash??null,transactionId:payload.transactionId}),summary:summary(recordKind,value),projection:projection(recordKind,value)};
 }
 if(type==='import'){
  invariant(payload.confirmed===true,'Explicit isolated import confirmation required');
  const preview=previews.get(payload.previewDigest);
  invariant(preview&&preview.recordKind===recordKind&&preview.raw===payload.raw,'A strict exact preview must be confirmed before import');
  const value=preview.value;validate(recordKind,value);
  const bundle=await packBundleAsync(recordKind,value,{signal,transactionId:payload.transactionId});
  return {commit:await prepareCommitAsync(bundle,{signal,slot:payload.slot,transactionId:payload.transactionId,settlementKeys:isProfile?settlementKeys(value):[]}),summary:summary(recordKind,value),projection:projection(recordKind,value),backup:{raw:decodeStoredSave(payload.raw),physical:payload.raw}};
 }
 invariant(payload.bundle?.root.kind===recordKind,'Task and record kind differ');
 const value=await unpackBundleAsync(payload.bundle,{signal});
 // For profile transitions the core operation owns both required validation
 // passes. A read-only inspect validates once while producing its small view.
 // Every request still decodes, bounds-checks and hashes the durable bundle.
 // Runtime transitions also own both required passes, just like profile transitions.
 if(type==='inspect'&&isProfile){const view=P.profileViewRecordsCurrent(value);check();return {summary:summary(recordKind,value),projection:projection(recordKind,value,view),logicalRaw:payload.includeRaw?canonical(value):null};}
 if(type!=='transition')validate(recordKind,value);
 else if(!isProfile)invariant(!value.profileStart&&value.schema!==R.PROFILE_RUN_SCHEMA,'Profile-bound run requires its complete profile, not standalone import');
 if(type==='inspect')return {summary:summary(recordKind,value),projection:projection(recordKind,value),logicalRaw:payload.includeRaw?canonical(value):null};
 if(type==='transition'){
  invariant(payload.expectedRootHash===payload.bundle.root.hash,'Worker operation base differs');
  const previousKeys=new Set(isProfile?settlementKeys(value):[]);
  const result=isProfile?await P.transitionProfileRecordsCurrentResultAsync(value,payload.action,payload.transactionId,value.revision,{signal}):null;
  const next=isProfile?result.value:await R.transitionRuntimeCurrentAsync(value,payload.action,payload.transactionId,value.revision,{signal});check();
  // Both current transition APIs validate their own detached input and result.
  // Do not repeat those full validations here; imports/inspect/audit remain unchanged.
  const bundle=await packBundleAsync(recordKind,next,{signal,transactionId:payload.transactionId,previousRootHash:payload.expectedRootHash,archiveRecords:payload.bundle.records});
  const newKeys=isProfile?settlementKeys(next).filter(k=>!previousKeys.has(k)):[];
  return {commit:await prepareCommitAsync(bundle,{signal,slot:payload.slot,expectedRootHash:payload.expectedRootHash,transactionId:payload.transactionId,settlementKeys:newKeys,existingRecordIds:payload.bundle.root.recordIds}),summary:summary(recordKind,next),projection:projection(recordKind,next,result?.view)};
 }
 if(type==='audit'){if(isProfile)await P.validateProfileEnvelopeRecordsStrictAsync(value,{signal});else await R.importRuntimeAsync(canonical(value),{signal});check();return {verification:'FULL_REPLAY_VERIFIED',projection:projection(recordKind,value)};}
 if(type==='preserved')return {raw:isProfile?value.origin.preservation?.originalRaw??null:null};
 if(type==='export'){const logicalRaw=canonical(value);let legacyCompatible=true;try{assertBoundedJSON(value);if(new TextEncoder().encode(logicalRaw).length>16*1024*1024)legacyCompatible=false;}catch{legacyCompatible=false;}return {bundle:payload.bundle,logicalRaw,exportRaw:legacyCompatible?logicalRaw:JSON.stringify(payload.bundle),format:legacyCompatible?'legacy-logical-json':'sg2-record-bundle',legacyCompatible,summary:summary(recordKind,value)};}
 throw Error('Unsupported SG2 profile/runtime task');
}
