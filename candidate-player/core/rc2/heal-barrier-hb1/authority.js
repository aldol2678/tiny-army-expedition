// Trusted per-instance trial owner. No acquisition, forge, economy, new barrier effect or persistent store.
import {clone,canonical,deepFreeze,assert} from '../relic-services/registry.js';
import {captureGame,restoreGame} from '../spear-skills-rb6/browser.js';
import {HB1_CAPABILITY,HB1_VERSION,HB1_REGISTRY} from './index.js';
// Upstream explicit IDs use RB6's 1024 limit. A caller supplies a generated
// namespace only when constructing, validating, or replaying that owner role.
const id=(x,prefix=null)=>typeof x==='string'&&x.length>0&&(x.length<=1024||(prefix!==null&&x.startsWith(prefix)&&/^[1-9][0-9]*$/.test(x.slice(prefix.length))&&Number.isSafeInteger(Number(x.slice(prefix.length)))));
const tick=x=>Number.isSafeInteger(x)&&x>=0;
const finite=x=>Number.isFinite(x)&&x>=0;
const kinds=['normal','commander','derived','native_special'];
const derivedTags=['derived','relic_proc','split_heal','relic_heal'];
export function installHealBarrierAuthority(game,{content,capability=null,afterReceipt=null}={}){
 assert(capability===null||capability===HB1_CAPABILITY,'Unknown HB1 capability');
 if(!capability){assert(!(game.relics??[]).some(r=>r.id==='first_aid_route'),'HB1 relic requires capability');return {enabled:false,snapshot:()=>({enabled:false,heals:[],barriers:[]})};}
 assert(content?.hb1Capability===HB1_CAPABILITY&&game.phase==='battle','Started HB1 trial required');
 assert(!game._hb1Healing&&!game._rb1Installed&&!game._v10ClassCombat&&!game._v10SpearAdapter,'Install HB1 once, before heal consumers and class/spear');
 const relics=content.normalizeRelics(game.relics),route=relics.find(r=>r.id==='first_aid_route'),rangeGain=route?HB1_REGISTRY[0].values[route.evolution-1]:0;
 const context=canonical({version:HB1_VERSION,battleId:game.battleId,seed:game.initialSeed,relics,roster:game.startingRoster,encounter:game.encounter,skills:game.skills,prepared:game.prepared});
 let state={version:HB1_VERSION,context,rootSequence:0,healSequence:0,barrierSequence:0,roots:[],heals:[],barriers:[],derivedEvents:[],normalActions:[]},scope=null,depth=0,notifying=false,pendingHeal=null;
 const original={};for(const k of ['heal','supportHeal','castSkill','grantBarrier'])original[k]=game[k];
 const find=x=>[...game.units,...game.enemies].find(u=>u.id===x),owned=u=>!!u&&find(u.id)===u;
 function atomic(fn){if(depth)return fn();const before=captureGame(game),old=scope;depth++;try{return fn();}catch(e){restoreGame(game,before);throw e;}finally{depth--;scope=old;}}
 function notify(receipt){if(!afterReceipt)return;const old=notifying;notifying=true;try{afterReceipt(deepFreeze(clone(receipt)));}finally{notifying=old;}}
 function root(originKind,sourceId,targetId=null,external=null,range=null){assert(external===null||!external.startsWith(`${game.battleId}:hb1-root:`),'Reserved generated root namespace');const rootActionId=external??`${game.battleId}:hb1-root:${++state.rootSequence}`;assert(id(rootActionId,external===null?`${game.battleId}:hb1-root:`:null),'Root identity required');const row={rootActionId,originKind,sourceId,targetId,range,tick:game.tickCount,generated:external===null,sequence:external===null?state.rootSequence:null};const old=state.roots.find(x=>x.rootActionId===rootActionId);if(old)assert(canonical(old)===canonical(row),'Conflicting root identity');else state.roots.push(row);return {...row,observed:false};}
 function withScope(next,fn){const old=scope;scope=next;try{return fn();}finally{scope=old;}}
 function classify(action={},source=null,target=null){
  if(scope?.originKind==='derived'||action?.originKind==='derived'||derivedTags.includes(action?.sourceKind))return 'derived';
  if(action?.sourceKind&&action.sourceKind!=='normal')return 'native_special';
  if(scope?.originKind==='normal'&&!scope.observed&&owned(source)&&owned(target)&&source.id===scope.sourceId&&target.id===scope.targetId&&source.team==='ally'&&target.team==='ally')return 'normal';
  if(scope?.originKind==='commander'&&source===null&&owned(target)&&target.team==='ally')return 'commander';
  return 'native_special';
 }
 function normalRange(u){if(scope?.originKind==='normal'&&scope.sourceId===u?.id&&finite(scope.range))return scope.range;return u.healRange+(u.team==='ally'&&content.familyOf(u.type)==='support'?rangeGain:0);}
 game.normalHealRange=normalRange;
 function withNormalAction(spec,fn){
  assert(spec&&id(spec.rootActionId)&&owned(find(spec.sourceId))&&owned(find(spec.targetId))&&finite(spec.range)&&typeof fn==='function','Explicit normal owner required');
  if(notifying||scope?.originKind==='derived'||scope?.observed)return false;
  const fingerprint=canonical({rootActionId:spec.rootActionId,sourceId:spec.sourceId,targetId:spec.targetId,range:spec.range}),prior=state.normalActions.find(r=>r.rootActionId===spec.rootActionId);
  if(prior){assert(prior.fingerprint===fingerprint,'Conflicting normal action replay');return prior.result;}
  return atomic(()=>withScope(root('normal',spec.sourceId,spec.targetId,spec.rootActionId,spec.range),()=>{const result=fn();assert(typeof result==='boolean','Normal owner result required');state.normalActions.push({rootActionId:spec.rootActionId,sourceId:spec.sourceId,targetId:spec.targetId,range:spec.range,fingerprint,result});return result;}));
 }
 function observeNativeHeal(target,amount,source){
  assert(pendingHeal&&target===pendingHeal.target&&source===pendingHeal.source,'Native healing observer needs active owner');
  pendingHeal.input={amount:Number.isFinite(amount)?amount:null,before:target?.hp??0,maxHp:target?.maxHp??0};
 }

 game.supportHeal=function(source,target){
  if(notifying)return false;
  if(scope?.originKind==='derived'||scope?.observed)return false;
  if(!owned(source)||!owned(target))return false;
  return atomic(()=>{if(scope?.originKind==='normal')return original.supportHeal.call(this,source,target);return withScope(root('normal',source.id,target.id,null,normalRange(source)),()=>original.supportHeal.call(this,source,target));});
 };
 game.castSkill=function(commandId,...args){if(notifying)return false;if(commandId!=='heal')return original.castSkill.call(this,commandId,...args);return atomic(()=>withScope(root('commander',null),()=>original.castSkill.call(this,commandId,...args)));};
 game.heal=function(target,amount,source=null,action={}){
  if(notifying)return 0;
  assert((target==null||owned(target))&&(source===null||owned(source)),'Owned healing source/target required');
  // Untrusted-looking labels never promote a direct heal to a normal root.
  return atomic(()=>{
   const kind=classify(action,source,target),active=scope??root(kind,source?.id??null,target?.id??null,id(action?.rootActionId)?action.rootActionId:null);
   if(kind==='normal')active.observed=true;
   const before=target?.hp??0,priorPending=pendingHeal;pendingHeal={target,source,input:null};let result,nativeInput;try{result=original.heal.call(this,target,amount,source,action);nativeInput=pendingHeal.input;}finally{pendingHeal=priorPending;}const after=target?.hp??before,sequence=++state.healSequence;
   const receipt={id:`${game.battleId}:hb1-heal:${sequence}`,sequence,rootActionId:active.rootActionId,originKind:kind,sourceKind:action?.sourceKind??null,requestedOriginKind:action?.originKind??null,sourceId:source?.id??null,targetId:target?.id??null,tick:game.tickCount,requested:Number.isFinite(amount)?amount:null,maxHp:target?.maxHp??0,nativeInput,engineResult:result,before,after,actual:Math.max(0,after-before),normalTriggerEligible:kind==='normal'&&after>before,effectiveRange:kind==='normal'?active.range:null};
   state.heals.push(receipt);notify(receipt);return result;
  });
 };
 function barrierReceipt(eventId){return clone(state.barriers.find(x=>x.eventId===eventId)??null);}
 game.grantBarrier=function(source,target,amount,duration,identity={}){
  if(notifying)return false;
  assert(identity&&typeof identity==='object'&&!Array.isArray(identity),'Barrier identity object required');
  for(const key of ['eventId','rootActionId'])assert(!(key in identity)||(Object.hasOwn(identity,key)&&id(identity[key],key==='eventId'&&state.barriers.some(r=>r.eventId===identity[key])?`${game.battleId}:hb1-grant:`:null)),'Own barrier identity required');
  assert(owned(source)&&owned(target)&&Number.isFinite(amount)&&Number.isFinite(duration)&&duration>=0&&tick(game.tickCount+Math.ceil(duration/(1/60)-1e-9)),'Finite owned barrier request required');
  const fingerprint=canonical({sourceId:source.id,targetId:target.id,amount,duration,rootActionId:identity.rootActionId??null});
  const prior=identity.eventId&&state.barriers.find(r=>r.eventId===identity.eventId);if(prior){assert(prior.fingerprint===fingerprint,'Conflicting barrier replay');return prior.accepted;}
  assert(!identity.eventId?.startsWith(`${game.battleId}:hb1-grant:`),'Reserved generated grant namespace');
  return atomic(()=>{
   const sequence=++state.barrierSequence,eventId=identity.eventId??`${game.battleId}:hb1-grant:${sequence}`,before=clone(target.barrier??null),live=before&&game.tickCount<before.untilTick,statsBefore=source.stats.barrierGranted;
   const sourceHp=source.hp,targetHp=target.hp,accepted=original.grantBarrier.call(this,source,target,amount,duration),after=clone(target.barrier??null),actualGranted=accepted?after.amount:0,statsDelta=source.stats.barrierGranted-statsBefore;
   assert(Math.abs(statsDelta-actualGranted)<1e-8,'Engine grant and stats disagree');
   const parent=live?state.barriers.findLast(r=>r.accepted&&r.targetId===target.id&&r.after.untilTick===before.untilTick&&r.after.ownerId===before.ownerId):null;
   const row={eventId,sequence,rootActionId:identity.rootActionId??eventId,explicitRootActionId:identity.rootActionId??null,fingerprint,tick:game.tickCount,sourceId:source.id,targetId:target.id,requestedAmount:amount,requestedDuration:duration,sourceHp,targetHp,statsDelta,accepted,grantedAmount:actualGranted,before,after,instanceId:accepted?`${game.battleId}:hb1-barrier:${sequence}`:null,lineageId:accepted?(parent?.lineageId??`${game.battleId}:hb1-lineage:${sequence}`):null,operation:accepted?(live?'replace':'grant'):'rejected',precision:'native-float-unrounded',extensionTicks:0,barrierHemEnabled:false};
   state.barriers.push(row);notify(row);return accepted;
  });
 };
 function derivedHeal({eventId,rootActionId,sourceId=null,targetId,amount,sourceKind='derived'}){
  if(notifying||scope?.originKind==='derived')return 0;
  assert(id(eventId)&&id(rootActionId,`${game.battleId}:hb1-root:`)&&finite(amount)&&derivedTags.includes(sourceKind),'Explicit derived receipt identity required');
  assert(state.roots.some(r=>r.rootActionId===rootActionId),'Known originating root required');
  const target=find(targetId),source=sourceId===null?null:find(sourceId);assert(owned(target)&&(sourceId===null||owned(source)),'Owned derived source/target required');
  const fingerprint=canonical({eventId,rootActionId,sourceId,targetId,amount,sourceKind}),prior=state.derivedEvents.find(r=>r.eventId===eventId);if(prior){assert(prior.fingerprint===fingerprint,'Conflicting derived replay');return prior.actual;}
  return atomic(()=>withScope({originKind:'derived',rootActionId,sourceId,targetId,range:null,observed:true},()=>{const sequence=state.healSequence+1,actual=game.heal(target,amount,source,{originKind:'derived',sourceKind,rootActionId,eventId});state.derivedEvents.push({eventId,rootActionId,sourceId,targetId,amount,sourceKind,fingerprint,actual,healReceiptId:`${game.battleId}:hb1-heal:${sequence}`});return actual;}));
 }
 function validate(s,publicState=game){
  assert(s?.version===HB1_VERSION&&s.context===context,'Foreign HB1 checkpoint');for(const k of ['rootSequence','healSequence','barrierSequence'])assert(tick(s[k]),'Invalid HB1 sequence');
  for(const k of ['roots','heals','barriers','derivedEvents','normalActions'])assert(Array.isArray(s[k]),'HB1 ledger required');
  assert(s.healSequence===s.heals.length&&s.barrierSequence===s.barriers.length,'HB1 receipt sequence mismatch');
  const actors=new Map([...publicState.units,...publicState.enemies].map(u=>[u.id,u])),roots=new Map();let generated=0;
  for(const r of s.roots){
   assert(id(r.rootActionId,r.generated?`${game.battleId}:hb1-root:`:null)&&!roots.has(r.rootActionId)&&kinds.includes(r.originKind)&&tick(r.tick)&&(r.range===null||finite(r.range))&&typeof r.generated==='boolean','Invalid healing root');
   assert((r.sourceId===null||find(r.sourceId))&&(r.targetId===null||find(r.targetId)),'Unknown healing root actor');
   if(r.generated)assert(r.sequence===++generated&&r.rootActionId===`${game.battleId}:hb1-root:${generated}`,'Generated root sequence mismatch');else assert(r.sequence===null&&!r.rootActionId.startsWith(`${game.battleId}:hb1-root:`),'Foreign generated root namespace');
   if(r.originKind==='normal')assert(find(r.sourceId)?.team==='ally'&&content.familyOf(find(r.sourceId).type)==='support'&&find(r.targetId)?.team==='ally'&&finite(r.range),'Invalid normal root owner');
   else assert(r.range===null,'Only normal root owns effective range');
   if(r.originKind==='commander')assert(r.sourceId===null&&r.targetId===null,'Invalid commander root');
   roots.set(r.rootActionId,r);
  }
  assert(s.rootSequence===generated,'Generated root counter mismatch');
  const normalRoots=new Set(),healIds=new Map();
  for(const [i,r] of s.heals.entries()){
   const root=roots.get(r.rootActionId),actor=actors.get(r.sourceId),target=actors.get(r.targetId);
   assert(r.sequence===i+1&&r.id===`${game.battleId}:hb1-heal:${i+1}`&&root&&kinds.includes(r.originKind)&&tick(r.tick)&&r.tick>=root.tick&&finite(r.before)&&finite(r.after)&&finite(r.maxHp)&&r.after<=r.maxHp&&finite(r.actual)&&finite(r.engineResult)&&Math.abs(r.engineResult-r.actual)<1e-8&&r.actual===Math.max(0,r.after-r.before)&&r.after>=r.before&&r.normalTriggerEligible===(r.originKind==='normal'&&r.actual>0),'Invalid healing receipt');
   assert((r.sourceId===null||actor)&&(r.targetId===null? r.actual===0:target)&&(r.requested===null||Number.isFinite(r.requested)),'Invalid healing receipt actor/request');
   assert(!target||r.maxHp===target.maxHp,'Healing receipt maxHp differs from saved actor');
   if(r.nativeInput){const n=r.nativeInput;assert(n.before===r.before&&n.maxHp===r.maxHp&&(n.amount===null||Number.isFinite(n.amount)),'Invalid raw healing input');const expected=r.before<=0||n.amount===null?0:Math.min(Math.max(0,n.amount),Math.max(0,r.maxHp-r.before));assert(r.engineResult===expected&&r.after===r.before+expected,'Healing endpoint differs from native clamp');}else assert(r.requested===null&&r.engineResult===0&&r.after===r.before,'Missing native healing observation');
   const derived=root.originKind==='derived'||r.requestedOriginKind==='derived'||derivedTags.includes(r.sourceKind),special=!!r.sourceKind&&r.sourceKind!=='normal'&&!derived;
   if(r.originKind==='derived')assert(derived&&r.effectiveRange===null&&!r.normalTriggerEligible,'Invalid derived classification');
   else if(r.originKind==='normal'){
    assert(!derived&&!special&&root.originKind==='normal'&&r.tick===root.tick&&r.sourceId===root.sourceId&&r.targetId===root.targetId&&r.effectiveRange===root.range&&!normalRoots.has(r.rootActionId),'Invalid normal receipt ownership');normalRoots.add(r.rootActionId);
   }else if(r.originKind==='commander')assert(!derived&&!special&&root.originKind==='commander'&&r.tick===root.tick&&r.sourceId===null&&target?.team==='ally'&&r.effectiveRange===null,'Invalid commander receipt ownership');
   else assert(!derived&&(special||root.originKind==='native_special')&&r.effectiveRange===null,'Invalid native special classification');
   healIds.set(r.id,r);
  }
  const events=new Set(),accepted=[];
  for(const [i,r] of s.barriers.entries()){
   assert(r.sequence===i+1&&id(r.eventId,r.eventId===`${game.battleId}:hb1-grant:${i+1}`?`${game.battleId}:hb1-grant:`:null)&&!events.has(r.eventId)&&tick(r.tick)&&typeof r.accepted==='boolean'&&find(r.sourceId)&&find(r.targetId)&&finite(r.sourceHp)&&finite(r.targetHp)&&Number.isFinite(r.requestedAmount)&&finite(r.requestedDuration)&&finite(r.grantedAmount)&&Number.isFinite(r.statsDelta)&&Math.abs(r.statsDelta-r.grantedAmount)<1e-8&&r.extensionTicks===0&&r.barrierHemEnabled===false&&r.precision==='native-float-unrounded','Invalid amount barrier receipt');
   assert((r.explicitRootActionId===null||id(r.explicitRootActionId))&&r.rootActionId===(r.explicitRootActionId??r.eventId)&&r.fingerprint===canonical({sourceId:r.sourceId,targetId:r.targetId,amount:r.requestedAmount,duration:r.requestedDuration,rootActionId:r.explicitRootActionId}),'Invalid barrier fingerprint');
   const before=r.before,live=before&&r.tick<before.untilTick,expect=!!(r.sourceHp>0&&r.targetHp>0&&r.requestedAmount>0&&!(live&&before.amount>=r.requestedAmount));
   if(before)assert(finite(before.amount)&&find(before.ownerId)&&tick(before.untilTick),'Invalid prior barrier');
   assert(r.accepted===expect,'Barrier acceptance disagrees with native rule');
   if(r.accepted){
    const parent=live?accepted.findLast(p=>p.targetId===r.targetId&&p.after.untilTick===before.untilTick&&p.after.ownerId===before.ownerId):null;
    assert(canonical(r.after)===canonical({amount:r.requestedAmount,ownerId:r.sourceId,untilTick:r.tick+Math.ceil(r.requestedDuration/(1/60)-1e-9)})&&r.grantedAmount===r.requestedAmount&&r.instanceId===`${game.battleId}:hb1-barrier:${i+1}`&&r.lineageId===(parent?.lineageId??`${game.battleId}:hb1-lineage:${i+1}`)&&r.operation===(live?'replace':'grant'),'Invalid barrier grant/expiry/lineage');accepted.push(r);
   }else {
    // Invalid source/target/amount returns before native expiry; a live equal/smaller request also preserves it.
    const expiryProcessed=r.sourceHp>0&&r.targetHp>0&&r.requestedAmount>0&&before&&!live;
    assert(r.grantedAmount===0&&r.instanceId===null&&r.lineageId===null&&r.operation==='rejected'&&canonical(r.after)===canonical(expiryProcessed?null:before),'Invalid rejected barrier');
   }
   events.add(r.eventId);
  }
  const ds=new Set();
  for(const r of s.derivedEvents){
   const h=healIds.get(r.healReceiptId);
   assert(id(r.eventId)&&!ds.has(r.eventId)&&roots.has(r.rootActionId)&&finite(r.actual)&&finite(r.amount)&&derivedTags.includes(r.sourceKind)&&r.fingerprint===canonical({eventId:r.eventId,rootActionId:r.rootActionId,sourceId:r.sourceId,targetId:r.targetId,amount:r.amount,sourceKind:r.sourceKind}),'Invalid derived replay receipt');
   assert(h&&h.originKind==='derived'&&h.rootActionId===r.rootActionId&&h.sourceId===r.sourceId&&h.targetId===r.targetId&&h.requested===r.amount&&h.sourceKind===r.sourceKind&&h.engineResult===r.actual,'Derived replay disconnected from healing receipt');ds.add(r.eventId);
  }
  const normalIds=new Set();for(const r of s.normalActions){const root=roots.get(r.rootActionId);assert(root?.originKind==='normal'&&!normalIds.has(r.rootActionId)&&r.sourceId===root.sourceId&&r.targetId===root.targetId&&r.range===root.range&&typeof r.result==='boolean'&&r.fingerprint===canonical({rootActionId:r.rootActionId,sourceId:r.sourceId,targetId:r.targetId,range:r.range})&&r.result===s.heals.some(h=>h.rootActionId===r.rootActionId&&h.originKind==='normal'&&h.actual>0),'Invalid completed normal action');normalIds.add(r.rootActionId);}
  return true;
 }
 const participant={id:'hb1-heal-barrier',capture:()=>clone(state),restore:s=>{validate(s);state=clone(s);}};game._v10CheckpointParticipants??=[];game._v10CheckpointParticipants.push(participant);
 function exportCheckpoint(){assert(!depth&&!scope&&!game._v10SpearAdapter,'Use composite checkpoint for active or spear-owned action');return {schema:'hb1-checkpoint-1',context,game:captureGame(game)};}
 function importCheckpoint(cp){assert(!depth&&!scope&&!game._v10SpearAdapter&&cp?.schema==='hb1-checkpoint-1'&&cp.context===context,'Foreign or active HB1 checkpoint');for(const k of ['battleId','initialSeed','startingRoster','relics','skills','encounter','combatRulesVersion'])assert(canonical(cp.game?.data?.[k])===canonical(game[k]),'Foreign game identity '+k);validate(cp.game?.participants?.find(p=>p.id===participant.id)?.state,cp.game.data);const old=captureGame(game);try{restoreGame(game,clone(cp.game));}catch(e){restoreGame(game,old);throw e;}}
 const api=Object.freeze({enabled:true,version:HB1_VERSION,classify,withNormalAction,observeNativeHeal,derivedHeal,barrierReceipt,atomic,snapshot:()=>deepFreeze(clone(state)),validate,exportCheckpoint,importCheckpoint});Object.defineProperty(game,'_hb1Healing',{value:api});return api;
}
