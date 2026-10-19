// Isolated profile/run transaction envelope. No localStorage or payout API.
import {canonical,clone,digest,invariant,exactKeys} from '../runtime/hash.js';
import {createRuntime,transitionRuntime,transitionRuntimeAsync,validateRuntime,clearValidationCache,DEFAULT_CANDIDATE,createRuntimeCurrent,transitionRuntimeCurrent,validateRuntimeCurrent,snapshotRuntimeCurrentAsync} from '../runtime/core.js';
import {legacyProfileSupport,makeProfileStart,catalogPreview,freeze,PROFILE_INTEGRATION_VERSION} from './start.js';
import {assertBoundedJSON} from '../runtime/current-validation.js';
import {normalizeSeed} from '../runtime/portable-graph.js';
import {parseStrictJSON} from './strict-json.js';
import {validateSettlementRuleConfig} from '../profile-bridge/bridge.js';
export const PROFILE_SCHEMA='isolated-preserved-profile-private-integrated-envelope-2';
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]{1,120}$/.test(x),verified=new Set();
function remember(e){verified.add(digest(e));if(verified.size>64)verified.delete(verified.values().next().value);return e;}
export function clearProfileValidationCache(){verified.clear();clearValidationCache();}
export function previewLegacyImport(raw,{profileId,transactionId}={}){
 const {bridge}=legacyProfileSupport(),preserved=bridge.preserveLegacy(raw);invariant(validId(profileId)&&validId(transactionId),'Explicit profile/import transaction IDs required');
 const data=parseStrictJSON(raw),terminal=preserved.routing.conversionAllowed;
 const body={version:PROFILE_INTEGRATION_VERSION,kind:'READ_ONLY_IMPORT_PREVIEW',profileId,transactionId,preservation:preserved,routing:clone(preserved.routing),conversion:terminal?bridge.convertTerminal(preserved,{profileId,transactionId}):null,changes:{tokensBefore:data.profile.tokens,tokensAfter:data.profile.tokens,tokenDelta:0,unlocksBefore:clone(data.profile.unlocks),unlocksAfter:clone(data.profile.unlocks),unlockGrants:[],legacyRecords:clone(data.profile.records),legacySettledRunIds:clone(data.profile.settledRunIds),runResourcesCarried:[],legacySettlementReapplied:false,storageWrites:0,originalBytesPreserved:true},warning:terminal?'New candidate records remain separate; no token settlement or unlock purchase is enabled.':'Active two-chapter run must remain in its pinned v09 runner. No forced retirement or appended chapters.'};
 return freeze({...body,previewDigest:digest(body)});
}
function validatePreview(p){exactKeys(p,['version','kind','profileId','transactionId','preservation','routing','conversion','changes','warning','previewDigest']);const expected=previewLegacyImport(p.preservation.originalRaw,{profileId:p.profileId,transactionId:p.transactionId});invariant(canonical(p)===canonical(expected),'Import preview changed');return expected;}
export function legacyResumeView(preview){validatePreview(preview);return legacyProfileSupport().bridge.legacyResumePayload(preview.preservation);}
function initial(conversion){legacyProfileSupport().bridge.validateConverted(conversion);return {schema:PROFILE_SCHEMA,version:PROFILE_INTEGRATION_VERSION,profileId:conversion.profile.id,revision:0,origin:clone(conversion),preservedProfile:clone(conversion.profile),candidateRecords:{runs:0,wins:0,bestChapter:0,battles:0},activeRun:null,completedRuns:[],terminalReceipts:[],transactions:[]};}
export function acceptLegacyPreview(preview,{confirmedPreviewDigest}={}){validatePreview(preview);invariant(confirmedPreviewDigest===preview.previewDigest,'Explicit confirmation of exact preview required');invariant(preview.conversion,'Active legacy run cannot become a candidate profile');return remember(initial(preview.conversion));}
function validateAction(a,keys){exactKeys(a,['type',...keys]);}
function terminalReceipt(run,current=false){(current?validateRuntimeCurrent:validateRuntime)(run);return terminalReceiptProjection(run);}
function terminalReceiptProjection(run){const s=run.state;invariant(s.phase==='complete'&&s.settlement&&['victory','defeat'].includes(s.settlement.outcome)&&s.settlement.productionCurrency===0,'Only checked terminal local results may be archived');return {version:PROFILE_INTEGRATION_VERSION,runId:run.runId,campaignRulesVersion:run.encounterProfile,runDigest:digest(run),outcome:s.settlement.outcome,battlesWon:s.battleCount,bestChapter:Math.max(0,...s.milestones.chapterBosses),tokensDelta:0,unlocksGranted:[],tokenSettlement:'PENDING_UNAPPROVED_ECONOMY_NOT_SETTLED'};}
function* apply(e,a,id,current=false){
 switch(a.type){
  case 'startRun':{validateAction(a,['seed','runId','tactic']);invariant(!e.activeRun,'Existing candidate run must be terminal and archived first');invariant(validId(a.runId)&&!e.preservedProfile.settledRunIds.includes(a.runId)&&!e.completedRuns.some(r=>r.runId===a.runId),'Run ID already exists or was settled');invariant(e.completedRuns.length<8,'Isolated envelope retains at most8 completed runs; export before starting more');const profileStart=makeProfileStart(e.origin,{runId:a.runId,campaignRulesVersion:DEFAULT_CANDIDATE,tactic:a.tactic});e.activeRun=(current?createRuntimeCurrent:createRuntime)(a.seed,a.runId,{profileStart});break;}
  case 'runAction':{validateAction(a,['action']);invariant(e.activeRun,'No candidate run');e.activeRun=yield {kind:'runtime',run:e.activeRun,action:a.action,transactionId:`profile:${id}`};break;}
  case 'archiveTerminal':{validateAction(a,['runId']);invariant(e.activeRun?.runId===a.runId,'No matching active run');const receipt=terminalReceipt(e.activeRun,current);invariant(!e.terminalReceipts.some(r=>r.runId===a.runId),'Terminal run already recorded');e.completedRuns.push(e.activeRun);e.activeRun=null;e.terminalReceipts.push(receipt);const records=e.candidateRecords;records.runs++;if(receipt.outcome==='victory')records.wins++;records.battles+=receipt.battlesWon;records.bestChapter=Math.max(records.bestChapter,receipt.bestChapter);break;}
  default:throw Error('Unsupported profile action; payouts, purchases, imports and free unlock grants are not enabled');
 }
 invariant(canonical(e.preservedProfile)===canonical(e.origin.profile),'Legacy profile was modified');
}
function applySync(e,action,id,current=false){const work=apply(e,action,id,current);let step=work.next();while(!step.done){invariant(step.value.kind==='runtime','Unknown internal profile replay request');const request=step.value;step=work.next((current?transitionRuntimeCurrent:transitionRuntime)(request.run,request.action,request.transactionId));}}
async function applyAsync(e,action,id,options){const work=apply(e,action,id);let step=work.next();while(!step.done){aborted(options.signal);invariant(step.value.kind==='runtime','Unknown internal profile replay request');const request=step.value,next=await transitionRuntimeAsync(request.run,request.action,request.transactionId,request.run.revision,options);aborted(options.signal);step=work.next(next);}aborted(options.signal);}
function applyTransaction(envelope,action,id,current=false){const e=clone(envelope);applySync(e,clone(action),id,current);e.revision++;const state={...e};delete state.transactions;e.transactions.push({id,action:clone(action),stateDigest:digest(state)});return e;}
async function applyTransactionAsync(envelope,action,id,options){aborted(options.signal);const e=clone(envelope);await applyAsync(e,clone(action),id,options);aborted(options.signal);e.revision++;const state={...e};delete state.transactions;e.transactions.push({id,action:clone(action),stateDigest:digest(state)});aborted(options.signal);return e;}
export function transitionProfile(e,action,id,expectedRevision=e.revision){validateProfileEnvelope(e);invariant(validId(id),'Explicit transaction ID required');const prior=e.transactions.find(t=>t.id===id);if(prior){invariant(canonical(prior.action)===canonical(action),'Profile transaction ID collision');return clone(e);}invariant(expectedRevision===e.revision,'Stale profile revision');invariant(e.transactions.length<6000,'Profile transaction bound exceeded');return remember(applyTransaction(e,action,id));}
export function validateProfileEnvelope(e){const key=digest(e);if(verified.has(key))return true;exactKeys(e,['schema','version','profileId','revision','origin','preservedProfile','candidateRecords','activeRun','completedRuns','terminalReceipts','transactions']);invariant(e.schema===PROFILE_SCHEMA&&e.version===PROFILE_INTEGRATION_VERSION,'Unsupported profile envelope');invariant(Array.isArray(e.transactions)&&e.transactions.length<=6000&&e.revision===e.transactions.length,'Invalid profile transaction revision');let replay=initial(e.origin);const ids=new Set();for(const t of e.transactions){exactKeys(t,['id','action','stateDigest']);invariant(validId(t.id)&&!ids.has(t.id),'Duplicate profile transaction ID');ids.add(t.id);replay=applyTransaction(replay,t.action,t.id);invariant(replay.transactions.at(-1).stateDigest===t.stateDigest,'Profile receipt/state differs from replay');}invariant(canonical(e)===canonical(replay),'Profile envelope differs from full replay');remember(e);return true;}
export function exportProfileEnvelope(e){validateProfileEnvelope(e);const raw=canonical(e);invariant(new TextEncoder().encode(raw).length<=16*1024*1024,'Profile envelope exceeds16MB; no truncation');return raw;}
export function importProfileEnvelope(raw){const e=parseStrictJSON(raw);validateProfileEnvelope(e);return e;}
export function profileView(e){validateProfileEnvelope(e);return profileViewProjection(e);}
function profileViewProjection(e){return freeze({profileId:e.profileId,revision:e.revision,tokens:e.preservedProfile.tokens,level:e.preservedProfile.level,unlocks:clone(e.preservedProfile.unlocks),legacyAggregate:clone(e.preservedProfile.legacyAggregate),legacySettledRunIds:clone(e.preservedProfile.settledRunIds),candidateRecords:clone(e.candidateRecords),pendingTokenSettlements:e.terminalReceipts.map(x=>({runId:x.runId,outcome:x.outcome,status:x.tokenSettlement})),catalog:catalogPreview(e.origin),activeRunId:e.activeRun?.runId??null,payoutEnabled:false,purchasesEnabled:false});}
// Explicit supplied coefficients are only arithmetic, never approval or balance mutation.
export function previewCandidateSettlement(e,runId,rules){validateProfileEnvelope(e);const {eventTokenByKind,...ordinaryRules}=rules;validateSettlementRuleConfig(ordinaryRules);if(eventTokenByKind!==undefined){exactKeys(eventTokenByKind,['normal','elite','boss']);invariant(Object.values(eventTokenByKind).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9),'Invalid explicit event token coefficients');}const run=[e.activeRun,...e.completedRuns].find(r=>r?.runId===runId);invariant(run,'Unknown candidate run');const receipt=terminalReceipt(run);invariant(rules.campaignRulesVersion===run.encounterProfile,'Settlement rules/profile mismatch');const s=run.state,wins=s.battles.filter(b=>b.receipt.result.win);if(receipt.outcome==='victory')invariant(s.campaignComplete&&canonical(s.milestones.chapterBosses)===canonical([1,2,3,4,5])&&wins.at(-1)?.milestoneOrigin==='chapter-boss'&&wins.at(-1)?.chapter===5,'Actual fifth boss completion required, not a fixed fight count');invariant(!wins.some(b=>b.origin.type==='event')||eventTokenByKind!==undefined,'Explicit event payout policy is required for preview; no default event tokens');const perBattle=wins.map(b=>({battleId:b.receipt.result.battleId,kind:b.kind,origin:clone(b.origin),milestoneOrigin:b.milestoneOrigin,chapter:b.chapter,amount:(b.origin.type==='event'?eventTokenByKind:rules.tokenByKind)[b.kind]}));const wonBattleTokens=perBattle.reduce((a,b)=>a+b.amount,0),bonus=receipt.outcome==='victory'?rules.completionBonus:0,total=wonBattleTokens+bonus;invariant(Number.isSafeInteger(total)&&total<=1e9&&e.preservedProfile.tokens+total<=1e9,'Preview exceeds preserved profile bound');return freeze({kind:'NON_MUTATING_PREVIEW_NOT_APPROVAL',rulesVersion:rules.version,runId,runDigest:digest(run),perBattle,wonBattleTokens,bonus,total,tokensBefore:e.preservedProfile.tokens,hypotheticalTokensAfter:e.preservedProfile.tokens+total,applied:false,profileWrites:0,warning:'No settlement function is enabled; rule validity is not owner approval.'});}
export * from './start.js';
function aborted(signal){if(signal?.aborted){const e=new Error('Profile import cancelled');e.name='AbortError';throw e;}}
export async function importProfileEnvelopeAsync(raw,{signal,onProgress=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),...simulationOptions}={}){
 // A real task boundary before parse/replay gives loading UI and cancellation a turn.
 aborted(signal);await yieldControl();aborted(signal);
 const e=parseStrictJSON(raw);aborted(signal);exactKeys(e,['schema','version','profileId','revision','origin','preservedProfile','candidateRecords','activeRun','completedRuns','terminalReceipts','transactions']);invariant(e.schema===PROFILE_SCHEMA&&e.version===PROFILE_INTEGRATION_VERSION&&Array.isArray(e.transactions)&&e.transactions.length<=6000&&e.revision===e.transactions.length,'Unsupported profile envelope/revision');
 const total=e.transactions.length;onProgress({completed:0,total});aborted(signal);if(verified.has(digest(e))){await yieldControl();aborted(signal);onProgress({completed:total,total});aborted(signal);return e;}
 let replay=initial(e.origin);const ids=new Set();for(let i=0;i<total;i++){aborted(signal);const t=e.transactions[i];exactKeys(t,['id','action','stateDigest']);invariant(validId(t.id)&&!ids.has(t.id),'Duplicate profile transaction ID');ids.add(t.id);replay=await applyTransactionAsync(replay,t.action,t.id,{...simulationOptions,signal,yieldControl,onBattleProgress:battle=>onProgress({completed:i,total,battle})});aborted(signal);invariant(replay.transactions.at(-1).stateDigest===t.stateDigest,'Profile receipt/state differs from replay');onProgress({completed:i+1,total});aborted(signal);await yieldControl();}
 invariant(canonical(e)===canonical(replay),'Profile envelope differs from full replay');onProgress({completed:total,total});aborted(signal);await yieldControl();aborted(signal);remember(e);return e;
}

// PA5 local-resume boundary. These functions never call remember() and make no
// assertion that historical combat/resources were earned. Strict APIs above
// continue to prove history. Only the one newly requested action is executed.
const digestText=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function currentProfileHeader(e){
 assertBoundedJSON(e);
 exactKeys(e,['schema','version','profileId','revision','origin','preservedProfile','candidateRecords','activeRun','completedRuns','terminalReceipts','transactions']);
 invariant(e.schema===PROFILE_SCHEMA&&e.version===PROFILE_INTEGRATION_VERSION&&validId(e.profileId),'Unsupported current profile envelope');
 invariant(Array.isArray(e.transactions)&&e.transactions.length<=6000&&Number.isSafeInteger(e.revision)&&e.revision===e.transactions.length,'Invalid current profile revision');
 invariant(Array.isArray(e.completedRuns)&&e.completedRuns.length<=8&&Array.isArray(e.terminalReceipts),'Invalid completed profile runs');
 invariant(e.activeRun===null||e.activeRun&&typeof e.activeRun==='object','Invalid active run');
 invariant(!e.activeRun||e.completedRuns.length<8,'Completed run retention bound exceeded');
 const genesis=initial(e.origin);
 invariant(e.profileId===genesis.profileId&&canonical(e.preservedProfile)===canonical(genesis.preservedProfile),'Preserved profile/origin mismatch');
 return genesis;
}
function currentProfileStructure(e,genesis){
 const all=[...e.completedRuns,...(e.activeRun?[e.activeRun]:[])],runs=new Map(),legacy=new Set(e.preservedProfile.settledRunIds);
 for(const run of all){
  invariant(validId(run.runId)&&!runs.has(run.runId)&&!legacy.has(run.runId),'Duplicate or legacy-settled run ID');
  invariant(run.profileStart&&canonical(run.profileStart.conversion)===canonical(e.origin),'Run does not belong to preserved profile origin');
  runs.set(run.runId,run);
 }
 invariant(e.terminalReceipts.length===e.completedRuns.length,'Terminal receipt count differs from completed runs');
 const aggregate={runs:0,wins:0,bestChapter:0,battles:0};
 for(let i=0;i<e.completedRuns.length;i++){
  const expected=terminalReceiptProjection(e.completedRuns[i]);
  invariant(canonical(e.terminalReceipts[i])===canonical(expected),'Terminal profile receipt differs from its run');
  aggregate.runs++;aggregate.wins+=expected.outcome==='victory'?1:0;aggregate.battles+=expected.battlesWon;aggregate.bestChapter=Math.max(aggregate.bestChapter,expected.bestChapter);
 }
 invariant(canonical(e.candidateRecords)===canonical(aggregate),'Profile candidate aggregate differs from terminal receipts');
 const ids=new Set(),started=new Set();let active=null,index=0,archived=0;
 for(const t of e.transactions){
  exactKeys(t,['id','action','stateDigest']);invariant(validId(t.id)&&!ids.has(t.id)&&digestText(t.stateDigest),'Invalid or duplicate profile transaction');ids.add(t.id);
  const a=t.action;invariant(a&&typeof a==='object','Missing profile action');
  if(a.type==='startRun'){
   validateAction(a,['seed','runId','tactic']);invariant(active===null&&validId(a.runId)&&!started.has(a.runId)&&!legacy.has(a.runId),'Profile run start sequence differs');
   active=runs.get(a.runId);invariant(active&&active.seed===normalizeSeed(a.seed),'Profile start references missing/different run');
   const expected=makeProfileStart(e.origin,{runId:a.runId,campaignRulesVersion:DEFAULT_CANDIDATE,tactic:a.tactic});
   invariant(active.encounterProfile===DEFAULT_CANDIDATE&&canonical(active.profileStart)===canonical(expected),'Profile run start entitlements differ');started.add(a.runId);index=0;
  }else if(a.type==='runAction'){
   validateAction(a,['action']);invariant(active&&index<active.transactions.length,'Profile action has no corresponding run transaction');
   const rt=active.transactions[index++];invariant(rt.id===`profile:${t.id}`&&canonical(rt.action)===canonical(a.action),'Profile/runtime transaction subsequence differs');
  }else if(a.type==='archiveTerminal'){
   validateAction(a,['runId']);invariant(active&&a.runId===active.runId&&index===active.transactions.length&&e.completedRuns[archived]===active,'Invalid or duplicate profile archive sequence');
   archived++;active=null;index=0;
  }else throw Error('Unsupported current profile action');
 }
 invariant(started.size===all.length&&archived===e.completedRuns.length&&active===e.activeRun&&(!active||index===active.transactions.length),'Profile/run ledger continuity differs');
 if(e.revision){const state={...e};delete state.transactions;invariant(e.transactions.at(-1).stateDigest===digest(state),'Current profile state digest differs');}
 else invariant(canonical(e)===canonical(genesis),'Revision-zero profile differs from origin');
 return true;
}
export function validateProfileEnvelopeCurrent(e){const genesis=currentProfileHeader(e);for(const run of [...e.completedRuns,...(e.activeRun?[e.activeRun]:[])])validateRuntimeCurrent(run);return currentProfileStructure(e,genesis);}
export function importProfileEnvelopeCurrent(raw){const e=parseStrictJSON(raw);validateProfileEnvelopeCurrent(e);return e;}
export async function importProfileEnvelopeCurrentAsync(raw,{signal,onProgress=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 aborted(signal);await yieldControl();aborted(signal);const e=parseStrictJSON(raw),genesis=currentProfileHeader(e),runs=[...e.completedRuns,...(e.activeRun?[e.activeRun]:[])],total=runs.length+1;
 onProgress({completed:0,total,stage:'current-state'});aborted(signal);await yieldControl();
 for(let i=0;i<runs.length;i++){aborted(signal);const checked=await snapshotRuntimeCurrentAsync(runs[i],{signal,yieldControl,onProgress:detail=>onProgress({completed:i,total,stage:'current-state',detail})});if(i<e.completedRuns.length)e.completedRuns[i]=checked;else e.activeRun=checked;onProgress({completed:i+1,total,stage:'current-state'});aborted(signal);await yieldControl();}
 aborted(signal);currentProfileStructure(e,genesis);onProgress({completed:total,total,stage:'current-state'});aborted(signal);await yieldControl();aborted(signal);return e;
}
export function exportProfileEnvelopeCurrent(e){validateProfileEnvelopeCurrent(e);const raw=canonical(e);invariant(new TextEncoder().encode(raw).length<=16*1024*1024,'Profile envelope exceeds16MB; no truncation');return raw;}
export function transitionProfileCurrent(e,action,id,expectedRevision){
 validateProfileEnvelopeCurrent(e);if(expectedRevision===undefined)expectedRevision=e.revision;assertBoundedJSON(action);invariant(validId(id),'Explicit transaction ID required');
 const prior=e.transactions.find(t=>t.id===id);if(prior){invariant(canonical(prior.action)===canonical(action),'Profile transaction ID collision');return clone(e);}
 invariant(expectedRevision===e.revision,'Stale profile revision');invariant(e.transactions.length<6000,'Profile transaction bound exceeded');
 const next=applyTransaction(e,action,id,true);validateProfileEnvelopeCurrent(next);return next;
}
export function profileViewCurrent(e){validateProfileEnvelopeCurrent(e);return profileViewProjection(e);}

// One-operation capabilities, never a current/strict validation cache. Every
// record is produced from owned parsed bytes and kept out of public objects.
const currentOperations=new WeakMap();
function operationRecord(handle){const record=currentOperations.get(handle);invariant(record,'Unknown current profile operation');return record;}
export function createProfileOperationCurrent(parentRaw,action,transactionId){
 assertBoundedJSON(action);invariant(validId(transactionId),'Explicit transaction ID required');
 const parent=importProfileEnvelopeCurrent(parentRaw);
 invariant(parent.transactions.length<6000,'Profile transaction bound exceeded');
 invariant(!parent.transactions.some(t=>t.id===transactionId),'Profile operation requires a new transaction ID');
 const next=applyTransaction(parent,action,transactionId,true);validateProfileEnvelopeCurrent(next);
 const nextRaw=canonical(next);invariant(new TextEncoder().encode(nextRaw).length<=16*1024*1024,'Profile envelope exceeds16MB; no truncation');
 const handle=Object.freeze(Object.create(null));
 currentOperations.set(handle,{expectedRaw:parentRaw,transactionId,next,nextRaw,view:profileViewProjection(next),committing:false});
 return handle;
}
export function describeProfileOperationCurrent(handle){
 const r=operationRecord(handle);return {expectedRaw:r.expectedRaw,transactionId:r.transactionId,nextRaw:r.nextRaw,next:clone(r.next),view:clone(r.view)};
}
export function commitProfileOperationCurrent(handle,store,{assertOwner=()=>{}}={}){
 const r=operationRecord(handle);invariant(!r.committing,'Current profile operation is already committing');invariant(typeof assertOwner==='function','Operation owner assertion must be a function');
 let ownerFailed=false,ownerError;
 const check=()=>{if(ownerFailed)throw ownerError;try{assertOwner();}catch(error){ownerFailed=true;ownerError=error;throw error;}};
 // An owner failure is sticky for this call, including ambiguous-write paths.
 const external=fn=>{check();try{return fn();}finally{check();}};
 r.committing=true;
 try{
  const observed=external(()=>store.load());
  if(observed!==r.nextRaw){
   invariant(observed===r.expectedRaw,'Profile operation base changed');
   try{
    invariant(external(()=>store.load())===r.expectedRaw,'Profile operation base changed before write');
    external(()=>store.commit(r.expectedRaw,r.nextRaw));
    invariant(external(()=>store.load())===r.nextRaw,'Profile operation write readback mismatch');
   }catch(error){
    check();let saved;try{saved=external(()=>store.load());}catch{check();throw error;}
    if(saved!==r.nextRaw)throw error;
   }
  }
  check();return {envelope:clone(r.next),view:clone(r.view),raw:r.nextRaw};
 }finally{r.committing=false;}
}
