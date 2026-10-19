import {serviceStock} from '../relic-services/training-access.js';
import {validateProviderCapability,validatePendingProvider} from '../relic-services/provider-capabilities.js';
import {FAMILIES,FIRST_CLASSES,SECOND_CLASSES,KEY_RELICS,familyOf,classStage,combatDescriptor,PROGRESSION_VERSION} from './registry.js';
const copy=x=>JSON.parse(JSON.stringify(x)),assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const canonical=x=>Array.isArray(x)?`[${x.map(canonical).join(',')}]`:x&&typeof x==='object'?`{${Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')}}`:JSON.stringify(x);
const unlocked=(s,kind,id)=>{const u=s.entitlements??s.unlocks??{};return (Array.isArray(u)?u:u[kind]??[]).includes(id);};
const supported=(id,o)=>!o.supportedSecondClasses||o.supportedSecondClasses.includes(id);
export const AWAKENING_TRAINING_VERSION='awakening-training-event-providers-2';
export const AWAKENING_TRAINING_PRICE=60;
export const AWAKENING_LEDGER_VERSION='multi-awakening-ledger-1';
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=240;
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical([...keys].sort());
const completeSecond=u=>u.training===2&&u.classStage===2&&SECOND_CLASSES[u.secondClassId]?.firstClassId===u.type&&canonical(u.skillIds)===canonical(SECOND_CLASSES[u.secondClassId].skillIds);
const awakeningLedger=s=>s.awakening??{version:AWAKENING_LEDGER_VERSION,unitIds:[],deferred:false};
function validateTrainingRecord(s,u,{requireReceipt=false}={}){
 const p=u.awakeningTraining;if(p===undefined)return false;
 assert(exactKeys(p,['version','price','sourceNodeId','chapter','transactionId',...(p?.providerCapability?['providerCapability']:[])])&&p.version===AWAKENING_TRAINING_VERSION&&p.price===AWAKENING_TRAINING_PRICE&&validId(p.sourceNodeId)&&validId(p.transactionId)&&Number.isInteger(p.chapter)&&p.chapter>=1&&p.chapter<=5,'Invalid individual awakening training record');
 if(p.providerCapability)assert(validateProviderCapability(p.providerCapability,{id:p.sourceNodeId,kind:'event'},p.chapter)==='training','Preparation has an invalid portable training source');
 assert(u.secondClassId&&u.training===2&&[2,3].includes(u.classStage)&&canonical(u.skillIds)===canonical([...SECOND_CLASSES[u.secondClassId].skillIds,...(u.classStage===3?[SECOND_CLASSES[u.secondClassId].ultimateSkillId]:[])]),'Preparation requires a complete second class and skills');
 if(s.chapter!==undefined)assert(Number.isInteger(s.chapter)&&p.chapter<=s.chapter,'Awakening training cannot come from a future chapter');
 if(requireReceipt||s.progressionLedger!==undefined){
  const entry=(s.progressionLedger??[]).find(e=>e.txId===p.transactionId),r=entry?.receipt;
  assert(r?.version===PROGRESSION_VERSION&&r.txId===p.transactionId&&r.kind==='awakening-training'&&r.unitId===u.id&&r.candidateId===`awaken-train:${u.id}`&&r.price===p.price&&r.cost===p.price&&r.costOwnedByHost===true&&canonical(r.preparation)===canonical(p)&&entry.fingerprint===canonical({kind:'awakening-training',candidateId:`awaken-train:${u.id}`,unitId:u.id,sourceNodeId:p.sourceNodeId,chapter:p.chapter,price:p.price,...(p.providerCapability?{providerCapability:p.providerCapability}:{})}),'Awakening training receipt mismatch');
 }
 return true;
}
function validateCampaignAwakening(s){
 for(const u of s.roster){if(u.awakeningTraining!==undefined)validateTrainingRecord(s,u,{requireReceipt:true});if(u.classStage===3)assert(u.awakeningTraining&&s.awakening?.unitIds.includes(u.id),'Awakened campaign unit requires individual preparation and ledger');}
}
export function validateProgressionState(s){
 assert(s&&Array.isArray(s.roster),'Roster required');if(s.progressionLedger!==undefined)assert(Array.isArray(s.progressionLedger),'Unsupported progression ledger version');const ids=new Set(),slots=new Set(),awakened=[],preparationIds=new Set();
 for(const u of s.roster){assert(Number.isSafeInteger(u.id)&&u.id>0&&!ids.has(u.id),'Invalid or duplicate unit ID');ids.add(u.id);assert(familyOf(u),'Unknown unit type');assert(FAMILIES[u.type]||FIRST_CLASSES[u.type],'Legacy type must stay basic/first class');
  const rank=u.training??0;assert(Number.isInteger(rank)&&rank>=0&&rank<=2,'Invalid training rank');if(rank)assert(['specialty','handling'].includes(u.trainingTrack),'Training track required');else assert(u.trainingTrack==null,'Untrained unit cannot own a track');
  assert(u.condition===undefined||Number.isFinite(u.condition)&&u.condition>=0&&u.condition<=100,'Invalid condition');assert(u.slot==null||Number.isInteger(u.slot)&&u.slot>=-1&&u.slot<12,'Invalid slot');if(u.slot>=0&&u.slot!=null){assert(!slots.has(u.slot),'Duplicate deployment slot');slots.add(u.slot);}
  if(u.secondClassId){
   const c=SECOND_CLASSES[u.secondClassId];assert(c&&c.firstClassId===u.type&&rank===2,'Invalid second class inheritance');assert(u.classStage===2||u.classStage===3,'Invalid advanced stage');
   const isAwakened=u.classStage===3,expected=[...c.skillIds,...(isAwakened?[c.ultimateSkillId]:[])];
   if(u.skillIds!==undefined||isAwakened)assert(canonical(u.skillIds)===canonical(expected),'Invalid class skills');
   assert((u.ultimateSkillId??null)===(isAwakened?c.ultimateSkillId:null),'Invalid ultimate skill identity');
   assert((u.ultimateVariantId??null)===(isAwakened?c.ultimateVariantId:null),'Invalid ultimate variant identity');
   if(u.ultimateId!==undefined)assert(u.ultimateId===(isAwakened?c.ultimateSkillId:null),'Invalid ultimate compatibility identity');
   if(isAwakened)awakened.push(u.id);
  }
  else{assert(u.classStage===undefined||u.classStage===(FIRST_CLASSES[u.type]?1:0),'Stage without complete second class');assert(u.ultimateId==null&&u.ultimateSkillId==null&&u.ultimateVariantId==null,'Ultimate without awakening');assert(u.skillIds===undefined||u.skillIds.length===0,'Skills without second class');}
  if(u.awakeningTraining!==undefined){validateTrainingRecord(s,u);assert(!preparationIds.has(u.awakeningTraining.transactionId),'Individual preparation cannot be shared');preparationIds.add(u.awakeningTraining.transactionId);}
 }
 if(s.awakening!=null){const a=s.awakening;assert(exactKeys(a,['version','unitIds','deferred'])&&a.version===AWAKENING_LEDGER_VERSION&&Array.isArray(a.unitIds)&&typeof a.deferred==='boolean','Unsupported awakening ledger version');assert(a.unitIds.every(id=>Number.isSafeInteger(id)&&id>0)&&new Set(a.unitIds).size===a.unitIds.length&&canonical([...a.unitIds].sort((a,b)=>a-b))===canonical([...awakened].sort((a,b)=>a-b)),'Awakening ledger differs from awakened roster');assert(awakened.every(id=>s.roster.find(u=>u.id===id).awakeningTraining),'Awakened campaign unit lacks individual preparation');}
 if(s.progressionLedger!==undefined){assert(Array.isArray(s.progressionLedger),'Unsupported progression ledger version');const txIds=new Set();for(const e of s.progressionLedger){assert(e&&validId(e.txId)&&!txIds.has(e.txId)&&typeof e.fingerprint==='string'&&e.receipt?.txId===e.txId&&e.receipt.version===PROGRESSION_VERSION,'Invalid progression ledger entry');txIds.add(e.txId);if(e.receipt.kind==='awakening-training')assert(s.roster.some(u=>u.id===e.receipt.unitId&&u.awakeningTraining?.transactionId===e.txId),'Individual preparation receipt lost its unit record');}}
 return true;
}
function branches(first,o){return FIRST_CLASSES[first].secondClassIds.filter(id=>supported(id,o));}
export function progressionCandidates(s,options={}){
 validateProgressionState(s);const out=[];
 for(const u of s.roster){const rank=u.training??0;
  for(const branch of FAMILIES[u.type]?.firstClassIds??[]){if(FIRST_CLASSES[branch].unlockId&&!unlocked(s,'branches',branch))continue;const ids=rank===2?branches(branch,options):[null];for(const secondClassId of ids)out.push({id:`evolve:${u.id}:${branch}:${secondClassId??'first'}`,kind:'evolve',unitId:u.id,type:branch,branchId:branch,...(secondClassId?{secondClassId}:{}),training:rank,trainingTrack:u.trainingTrack??null});}
  if(rank<2){const tracks=rank?[u.trainingTrack]:['specialty',...(!['mage','support'].includes(familyOf(u))||unlocked(s,'training',`${familyOf(u)}_handling`)?['handling']:[])];for(const trainingTrack of tracks){const ids=rank===1&&FIRST_CLASSES[u.type]?branches(u.type,options):[null];for(const secondClassId of ids)out.push({id:`train:${u.id}:${rank+1}:${trainingTrack}:${secondClassId??'base'}`,kind:'train',unitId:u.id,type:u.type,training:rank+1,trainingTrack,...(secondClassId?{secondClassId}:{} )});}}
 }
 return out;
}
function normalizedProgression(action){const kind=action.kind??(['evolve','train'].includes(action.type)?action.type:null);return {kind,unitId:action.unitId,branchId:action.branchId??(kind==='evolve'&&action.type!=='evolve'?action.type:null),training:action.training??action.rank??null,trainingTrack:action.trainingTrack??action.track??null,secondClassId:action.secondClassId??null,candidateId:action.id??null};}
function transaction(s,action,txId,mutate){
 validateProgressionState(s);validateCampaignAwakening(s);assert(validId(txId),'Transaction ID required');const fingerprint=canonical(action),prior=(s.progressionLedger??[]).find(e=>e.txId===txId);
 if(prior){assert(prior.fingerprint===fingerprint,'Transaction ID reused for different action');return {state:copy(s),receipt:copy(prior.receipt),duplicate:true};}
 const next=copy(s),details=mutate(next),receipt={version:PROGRESSION_VERSION,txId,...copy(details)};next.progressionLedger??=[];next.progressionLedger.push({txId,fingerprint,receipt});validateProgressionState(next);return {state:next,receipt:copy(receipt),duplicate:false};
}
function assignSecond(u,id){const c=SECOND_CLASSES[id];u.secondClassId=id;u.classStage=2;u.skillIds=[...c.skillIds];u.ultimateSkillId=null;u.ultimateVariantId=null;u.ultimateId=null;}
export function applyProgression(s,action,txId,options={}){
 const a=normalizedProgression(action);return transaction(s,a,txId,next=>{
  const candidates=progressionCandidates(next,options);const candidate=candidates.find(c=>c.kind===a.kind&&c.unitId===a.unitId&&(!a.candidateId||c.id===a.candidateId)&&(a.kind!=='evolve'||c.branchId===a.branchId)&&(a.kind!=='train'||(a.training===null||c.training===a.training)&&c.trainingTrack===a.trainingTrack)&&(c.secondClassId??null)===a.secondClassId);
  assert(candidate,'Ineligible, stale, or incomplete growth choice');const reserved=options.reservedBattle===true?next.battleCount:options.reservedBattle;
  if(reserved!==undefined){assert([2,5,8].includes(reserved),'Unknown reserved milestone');assert(reserved===2?candidate.kind==='evolve':candidate.kind==='train'&&candidate.training===(reserved===5?1:2),'Wrong reserved growth choice');}
  const u=next.roster.find(u=>u.id===candidate.unitId),before=copy(u);if(candidate.kind==='evolve')u.type=candidate.branchId;else{u.training=candidate.training;u.trainingTrack=candidate.trainingTrack;}
  u.classStage=FIRST_CLASSES[u.type]?1:0;if(candidate.secondClassId)assignSecond(u,candidate.secondClassId);
  return {kind:'progression',candidateId:candidate.id,unitId:u.id,before,after:copy(u),reservedBattle:reserved??null};
 });
}
export function targetKeyEligibility(s,keyId){
 const key=KEY_RELICS[keyId];if(!key)return {eligible:false,reason:'unknown-key',keyId};const owned=(s.roster??[]).filter(u=>familyOf(u)===key.family),ready=owned.filter(u=>u.secondClassId&&classStage(u)>=2),alreadyOwned=(s.relics??[]).some(r=>r.id===keyId);
 return {keyId,family:key.family,eligible:owned.length>0&&!alreadyOwned&&!s.campaignComplete,reason:alreadyOwned?'already-owned':!owned.length?'no-owned-family':s.campaignComplete?'campaign-complete':null,unitIds:owned.map(u=>u.id),readyUnitIds:ready.map(u=>u.id),secondClassReady:ready.length>0,immediateOrdinaryValue:owned.some(u=>Number.isInteger(u.slot)&&u.slot>=0),futureUse:owned.length>0,keyRetained:true};
}
export function keyCandidates(s){return Object.keys(KEY_RELICS).map(id=>targetKeyEligibility(s,id)).filter(e=>e.eligible).map(e=>({id:e.keyId,kind:'key',keyId:e.keyId,...e}));}
export function applyKeyCollection(s,action,txId){return transaction(s,{kind:'collect-key',keyId:action.keyId,source:action.source,sourceNode:action.sourceNode??null,battleNumber:action.battleNumber??s.battleCount},txId,next=>{
 const battle=action.battleNumber??next.battleCount;assert(['reward','shop','boss-reward','chapter3-shop'].includes(action.source),'Invalid key opportunity');assert(!next.campaignComplete,'Campaign complete');assert(targetKeyEligibility(next,action.keyId).eligible,'Ineligible key');next.relics??=[];next.relics.push({id:action.keyId,evolution:1});return {kind:'key-collection',keyId:action.keyId,source:action.source,sourceNode:action.sourceNode??null,battleNumber:battle,costOwnedByHost:true};});}
// Eligibility is also observable from a route preview. Only the paid facility reducer
// can grant the preparation, and it does not touch the host-owned wallet.
export function awakeningTrainingCandidates(s,options={}){
 validateProgressionState(s);if(s.pendingBattle||s.campaignComplete||['battle','reward','complete','defeat','settlement'].includes(s.phase))return [];
 return s.roster.filter(u=>completeSecond(u)&&supported(u.secondClassId,options)&&u.awakeningTraining===undefined).map(u=>({id:`awaken-train:${u.id}`,kind:'awakening-training',type:'awakening-training',unitId:u.id,secondClassId:u.secondClassId,keyId:SECOND_CLASSES[u.secondClassId].keyId,price:AWAKENING_TRAINING_PRICE,cost:AWAKENING_TRAINING_PRICE}));
}
export function applyAwakeningTraining(s,candidate,txId,{node,providerCapability=null}={}){
 assert(providerCapability?validatePendingProvider(s,node,providerCapability)==='training':node?.kind==='training'&&validId(node.id),'Individual preparation requires an actual or registered training facility');
 assert(candidate&&candidate.id===`awaken-train:${candidate.unitId}`&&candidate.kind==='awakening-training'&&(candidate.type===undefined||candidate.type==='awakening-training')&&(candidate.price===undefined||candidate.price===AWAKENING_TRAINING_PRICE)&&(candidate.cost===undefined||candidate.cost===AWAKENING_TRAINING_PRICE),'Invalid awakening training candidate');
 if(providerCapability)assert(serviceStock(s.pendingService,s).some(c=>c.kind==='awakening-training'&&c.id===candidate.id&&c.unitId===candidate.unitId&&c.price===AWAKENING_TRAINING_PRICE&&!s.pendingService.purchasedCandidateIds?.includes(c.candidateId)),'Individual preparation is absent from frozen event provider stock');
 const selected=s.roster?.find(u=>u.id===candidate.unitId);assert(selected&&(candidate.secondClassId===undefined||candidate.secondClassId===selected.secondClassId)&&(candidate.keyId===undefined||candidate.keyId===SECOND_CLASSES[selected.secondClassId]?.keyId),'Awakening training candidate identity mismatch');
 const action={kind:'awakening-training',candidateId:candidate.id,unitId:candidate.unitId,sourceNodeId:node.id,chapter:s.chapter,price:AWAKENING_TRAINING_PRICE,...(providerCapability?{providerCapability:copy(providerCapability)}:{})};
 return transaction(s,action,txId,next=>{
  assert(next.phase==='service'&&!next.pendingBattle&&!next.campaignComplete,'Preparation unavailable during this phase/checkpoint');
  assert(Number.isInteger(next.chapter)&&next.chapter>=1&&next.chapter<=5,'Valid training chapter required');
  if(next.currentNode!=null)assert(next.currentNode===node.id,'Training facility differs from current node');
  if(!providerCapability&&next.pendingService!=null)assert(next.pendingService.node?.id===node.id&&next.pendingService.node.kind==='training'&&next.pendingService.chapter===next.chapter,'Training facility differs from pending service');
  if(providerCapability)assert(validatePendingProvider(next,node,providerCapability)==='training','Registered training provider required');
  const eligible=awakeningTrainingCandidates(next).find(c=>c.id===candidate.id&&c.unitId===candidate.unitId);
  assert(eligible&&(candidate.secondClassId===undefined||candidate.secondClassId===eligible.secondClassId)&&(candidate.keyId===undefined||candidate.keyId===eligible.keyId),'Ineligible, stale, or already prepared unit');
  const u=next.roster.find(u=>u.id===candidate.unitId),before=copy(u);
  u.awakeningTraining={version:AWAKENING_TRAINING_VERSION,price:AWAKENING_TRAINING_PRICE,sourceNodeId:node.id,chapter:next.chapter,transactionId:txId,...(providerCapability?{providerCapability:copy(providerCapability)}:{})};
  return {kind:'awakening-training',candidateId:candidate.id,unitId:u.id,price:AWAKENING_TRAINING_PRICE,cost:AWAKENING_TRAINING_PRICE,costOwnedByHost:true,preparation:copy(u.awakeningTraining),before,after:copy(u),keyRequired:false,keyConsumed:false,basicStatsChanged:false,trainingRankChanged:false};
 });
}
export function awakeningCandidates(s,options={}){
 validateProgressionState(s);if(!['map','prepare'].includes(s.phase)||s.pendingBattle||s.campaignComplete)return [];
 return s.roster.filter(u=>completeSecond(u)&&supported(u.secondClassId,options)&&u.awakeningTraining!==undefined&&validateTrainingRecord(s,u,{requireReceipt:true})&&s.relics?.some(r=>r.id===SECOND_CLASSES[u.secondClassId].keyId&&(r.evolution??1)>=1)).map(u=>({id:`awaken:${u.id}`,type:'awaken',kind:'awaken',unitId:u.id,keyId:SECOND_CLASSES[u.secondClassId].keyId,cost:0,skillIds:combatDescriptor(u).basicSkillIds,secondClassId:u.secondClassId,ultimateSkillId:SECOND_CLASSES[u.secondClassId].ultimateSkillId,ultimateVariantId:SECOND_CLASSES[u.secondClassId].ultimateVariantId,ultimateId:SECOND_CLASSES[u.secondClassId].ultimateSkillId}));
}
// One canonical, read-only view for UI and route planning. It never grants prerequisites.
export function awakeningReadiness(s,options={}){
 validateProgressionState(s);
 const eligibleIds=new Set(awakeningCandidates(s,options).map(c=>c.unitId));
 const phaseAllowed=['map','prepare'].includes(s.phase),checkpointLocked=!!s.pendingBattle||['service','reward','battle','complete','defeat','settlement'].includes(s.phase)||!!s.campaignComplete;
 return s.roster.map(u=>{
  const definition=SECOND_CLASSES[u.secondClassId],alreadyAwakened=u.classStage===3;
  const twoBasicSkills=!!definition&&Array.isArray(u.skillIds)&&canonical(u.skillIds.slice(0,2))===canonical(definition.skillIds);
  const secondClassComplete=completeSecond(u)||(alreadyAwakened&&completeSecond({...u,classStage:2,skillIds:u.skillIds?.slice(0,2)}));
  const preparationComplete=u.awakeningTraining!==undefined&&validateTrainingRecord(s,u,{requireReceipt:true});
  const keyId=definition?.keyId??FAMILIES[familyOf(u)]?.keyId??null,keyOwned=!!keyId&&s.relics?.some(r=>r.id===keyId&&(r.evolution??1)>=1)===true;
  const remainingReasonCodes=[];
  if(alreadyAwakened)remainingReasonCodes.push('already-awakened');
  else{
   if(!secondClassComplete)remainingReasonCodes.push('second-class-incomplete');
   if(!twoBasicSkills)remainingReasonCodes.push('basic-skills-incomplete');
   if(!preparationComplete)remainingReasonCodes.push('preparation-required');
   if(!keyOwned)remainingReasonCodes.push('matching-key-required');
   if(definition&&!supported(definition.id,options))remainingReasonCodes.push('unsupported-second-class');
   if(!phaseAllowed)remainingReasonCodes.push('phase-not-allowed');
   if(checkpointLocked)remainingReasonCodes.push('checkpoint-locked');
   if(s.campaignComplete)remainingReasonCodes.push('campaign-complete');
  }
  return {unitId:u.id,alreadyAwakened,secondClassComplete,twoBasicSkills,preparationComplete,keyId,keyOwned,ultimateSkillId:definition?.ultimateSkillId??null,ultimateVariantId:definition?.ultimateVariantId??null,phaseAllowed,checkpointLocked,eligible:eligibleIds.has(u.id),remainingReasonCodes};
 });
}
export function applyAwakening(s,action,txId,options={}){
 const type=action.type??action.kind;
 // Explicit identity claims must match even on an exact-once retry. A minimal
 // {type,unitId} action remains compatible; aliases never authorize a key.
 if(type==='awaken'){
  const selected=s.roster?.find(u=>u.id===action.unitId),definition=SECOND_CLASSES[selected?.secondClassId];
  const identity={secondClassId:definition?.id,keyId:definition?.keyId,ultimateSkillId:definition?.ultimateSkillId,ultimateVariantId:definition?.ultimateVariantId,ultimateId:definition?.ultimateSkillId};
  for(const [field,value] of Object.entries(identity))assert(action[field]===undefined||action[field]===value,'Awakening candidate identity mismatch');
 }
 return transaction(s,{type,unitId:action.unitId??null},txId,next=>{
  assert(['map','prepare'].includes(next.phase)&&!next.pendingBattle&&!next.campaignComplete,'Awakening unavailable during this phase/checkpoint');
  if(type==='skipAwakening'||type==='skip'){next.awakening={...copy(awakeningLedger(next)),deferred:true};return {kind:'awakening',decision:'skip',cost:0};}
  assert(type==='awaken','Unknown awakening action');
  const candidate=awakeningCandidates(next,options).find(c=>c.unitId===action.unitId);assert(candidate,'No matching complete second class, individual preparation, or key');
  const u=next.roster.find(u=>u.id===action.unitId);
  u.classStage=3;u.ultimateSkillId=candidate.ultimateSkillId;u.ultimateVariantId=candidate.ultimateVariantId;u.ultimateId=candidate.ultimateSkillId;
  u.skillIds=[...SECOND_CLASSES[u.secondClassId].skillIds,candidate.ultimateSkillId];
  next.awakening={version:AWAKENING_LEDGER_VERSION,unitIds:[...awakeningLedger(next).unitIds,u.id],deferred:false};
  return {kind:'awakening',decision:'awaken',unitId:u.id,keyId:candidate.keyId,ultimateSkillId:candidate.ultimateSkillId,ultimateVariantId:candidate.ultimateVariantId,cost:0,keyConsumed:false};
 });
}
