// Opt-in action-local mechanisms. Acquisition and all economy paths remain OFF.
import {clone,canonical,deepFreeze,assert} from '../relic-services/registry.js';
import {captureGame,restoreGame} from '../spear-skills/browser.js';
import {RB3_VERSION,RB3_CAPABILITY,RB3_CHECKPOINT,isRB3,value} from './registry.js';
const finite=(n,d=0)=>Number.isFinite(n)?n:d,positive=n=>Number.isFinite(n)&&n>0;
export function installRB3Adapter(game,{content,capability=null,afterReceipt=null}={}){
 assert(capability===null||capability===RB3_CAPABILITY,'Unknown RB3 capability');
 if(!capability){assert(!(game.relics??[]).some(r=>isRB3(r.id)),'RB3 requires test capability');return {version:RB3_VERSION,snapshot:()=>({enabled:false,receipts:[]})};}
 assert(content?.rb3Capability===RB3_CAPABILITY&&game.phase==='battle'&&game._rb2Installed&&game._v10PipelineInstalled,'Started RB2/protection test host required');
 assert(!game._rb3Installed&&!game._v10ClassCombat&&!game._v10SpearAdapter,'Install RB3 once before class/spear');
 const relics=content.normalizeRelics(game.relics),roster=clone(game.startingRoster),v=id=>value(relics,id);
 const context=canonical({version:RB3_VERSION,battleId:game.battleId,initialSeed:game.initialSeed,relics,roster,encounter:game.encounter,skills:game.skills,prepared:game.prepared,commands:game.relicEffects.commandSkills});
 let state={version:RB3_VERSION,context,actionSequence:0,sequence:0,receipts:[],plateUsed:[],armorReady:[],completedActions:[]},depth=0,root=null,attackContext=null,defenseContext=null;
 const allies=new Set(game.units.map(u=>u.id)),enemies=new Set(game.enemies.map(u=>u.id)),allIds=new Set([...allies,...enemies]);
 const old={};for(const k of ['attack','hit','effectiveDefense','criticalMultiplier','castUnitSkill','castBarrier','supportHeal','castSkill'])old[k]=game[k];
 const id=x=>typeof x==='string'&&x.length>0,tick=x=>Number.isSafeInteger(x)&&x>=0;
 function validate(s){
  assert(s?.version===RB3_VERSION&&s.context===context,'Foreign RB3 checkpoint');assert(tick(s.actionSequence)&&tick(s.sequence)&&Array.isArray(s.receipts)&&s.sequence===s.receipts.length,'Invalid RB3 sequence');
  assert(Array.isArray(s.plateUsed)&&new Set(s.plateUsed).size===s.plateUsed.length&&s.plateUsed.every(x=>allies.has(x)),'Invalid plate uses');
  assert(Array.isArray(s.armorReady)&&new Set(s.armorReady.map(x=>x.sourceId)).size===s.armorReady.length&&s.armorReady.every(x=>allies.has(x.sourceId)&&tick(x.readyTick)&&id(x.rootActionId)),'Invalid armor cooldown');
  assert(Array.isArray(s.completedActions)&&new Set(s.completedActions.map(x=>x.id)).size===s.completedActions.length&&s.completedActions.every(x=>id(x.id)&&x.id.length<=240&&typeof x.fingerprint==='string'&&x.result===true),'Invalid completed actions');
  for(const [i,r] of s.receipts.entries()){assert(r.id===`${game.battleId}:rb3:${i+1}`&&r.sequence===i+1&&r.battleId===game.battleId&&tick(r.tick)&&id(r.rootActionId)&&isRB3(r.relicId)&&r.kind===r.relicId&&allIds.has(r.sourceId)&&allIds.has(r.targetId)&&Number.isFinite(r.actual)&&r.actual>=0,'Invalid RB3 receipt');
   assert(Number.isFinite(r.before)&&r.before>=0&&Number.isFinite(r.after)&&r.after>=0&&r.after<=r.before&&Math.abs((r.before-r.after)-r.actual)<1e-7,'Invalid HP receipt');
   const bounded=(x,max)=>Number.isFinite(x)&&x>=0&&x<=max+1e-9;
   assert(r.notIncrementalBenefit===true&&[null,'base-DEF-zero','R-cap','D-cap','B-cap','no-HP-loss','critical'].includes(r.zeroBenefitReason),'Invalid receipt interpretation');
   if(r.relicId==='armor_file')assert(allies.has(r.sourceId)&&enemies.has(r.targetId)&&bounded(r.baseDefenseIgnored,v('armor_file'))&&typeof r.cooldownConsumed==='boolean'&&tick(r.readyTick)&&(!r.cooldownConsumed||r.readyTick===r.tick+240)&&bounded(r.effectiveDefenseBefore,1e9)&&bounded(r.effectiveDefenseAfter,r.effectiveDefenseBefore),'Invalid armor receipt');
   else if(r.relicId==='unshielded_plate')assert(enemies.has(r.sourceId)&&allies.has(r.targetId)&&bounded(r.defenseFlatAdded,v('unshielded_plate'))&&typeof r.consumed==='boolean'&&r.barrierBefore===0&&bounded(r.effectiveDefenseBefore,1e9)&&bounded(r.effectiveDefenseAfter,1e9)&&r.effectiveDefenseAfter>=r.effectiveDefenseBefore,'Invalid plate receipt');
   else assert(allies.has(r.sourceId)&&enemies.has(r.targetId)&&bounded(r.basicBonusBefore,.35)&&bounded(r.basicBonusAdded,v('burdened_sight'))&&r.basicBonusBefore+r.basicBonusAdded<=.35+1e-9&&bounded(r.critChanceBefore,.5)&&bounded(r.critChanceApplied,.5)&&Math.abs(r.critChanceApplied-Math.max(0,r.critChanceBefore-.05))<1e-9&&typeof r.critical==='boolean'&&bounded(r.requestedBase,1e12)&&bounded(r.requested,1e12),'Invalid sight receipt');
  }
 }
 game._rb3Installed={version:RB3_VERSION,context};game._v10CheckpointParticipants.push({id:'rb3-relic-effects',capture:()=>clone(state),restore:s=>{validate(s);state=clone(s);}});
 function atomic(fn,external=null){if(depth)return fn();const before=captureGame(game),prior={root,attackContext,defenseContext};depth++;root=external??`${game.battleId}:rb3-action:${++state.actionSequence}`;try{const result=fn();if(result===false)restoreGame(game,before);return result;}catch(e){restoreGame(game,before);throw e;}finally{depth--;({root,attackContext,defenseContext}=prior);}}
 function record(data){const sequence=++state.sequence,r={...data,id:`${game.battleId}:rb3:${sequence}`,sequence,battleId:game.battleId,tick:game.tickCount,rootActionId:root};state.receipts.push(r);afterReceipt?.(clone(r));return r;}
 // The ledger stays local to a single hit. D40 and inherited costs are evaluated by the unchanged projector.
 game.effectiveDefense=function(u,formation=0,temporary=0){const c=defenseContext;if(!c||c.targetId!==u?.id)return old.effectiveDefense.call(this,u,formation,temporary);
  if(c.armor>0)return old.effectiveDefense.call(this,{...u,baseDefense:Math.max(0,finite(u.baseDefense)-c.armor)},formation,temporary);
  if(c.plate>0&&u.projection){const p={...u.projection,ledger:[...u.projection.ledger,{sourceId:'relic:unshielded_plate',effectId:'unshielded_plate:hit-local-defense',affectedField:'defense',operation:'flat_gain',category:'relic',value:c.plate,applied:true}]};return content.projectDefense(u,p,formation,temporary);}
  return old.effectiveDefense.call(this,u,formation,temporary);
 };
 game.criticalMultiplier=function(u){const a=attackContext,eligible=a?.sourceId===u?.id&&u?.team==='ally'&&content.familyOf(u.type)==='archer'&&u.type!=='volley'&&v('burdened_sight');if(!eligible)return old.criticalMultiplier.call(this,u);const chance=Math.max(0,finite(u.critChance)-.05),out=old.criticalMultiplier.call(this,{...u,critChance:chance});a.critical={multiplier:out,before:finite(u.critChance),after:chance};return out;};
 game.attack=function(u,t){return atomic(()=>{const previous=attackContext;attackContext={sourceId:u?.id,critical:null,armorReserved:false};try{return old.attack.call(this,u,t);}finally{attackContext=previous;}});};
 game.hit=function(a,t,amount,kind='hit',action={}){
  if(!a||a.hp<=0||!t||t.hp<=0||!positive(amount))return 0;
  return atomic(()=>{if(!this.damageActionDepth)return this.resolveDamageAction(()=>this.hit(a,t,amount,kind,action));
   const normal=a.type!=='volley'&&attackContext?.sourceId===a.id&&a.team==='ally'&&t.team==='enemy'&&action?.actionType==='basic_attack'&&!action.enhancedBasic&&!action.skillId&&!action.dot&&!action.reflection;
   const ready=state.armorReady.find(x=>x.sourceId===a.id),armorEligible=!!(normal&&['spear','archer'].includes(content.familyOf(a.type))&&v('armor_file')&&!attackContext.armorReserved&&this.tickCount>=(ready?.readyTick??0));
   const barrier=t.barrier&&this.tickCount<t.barrier.untilTick?Math.max(0,finite(t.barrier.amount)):0,plateEligible=!!(a.team==='enemy'&&t.team==='ally'&&v('unshielded_plate')&&barrier===0&&!state.plateUsed.includes(t.id));
   const burdened=!!(normal&&content.familyOf(a.type)==='archer'&&v('burdened_sight')&&attackContext.critical),noncritical=burdened&&attackContext.critical.multiplier===1;
   const b=finite(a.basicDamageBonus)+finite(this.commandBasicBonus?.(a,t)),gain=noncritical?Math.min(v('burdened_sight'),Math.max(0,.35-b)):0;
   const link=this.actionGuardianLinks?.[t.id]?.value??0,temp=this.tickCount<t.temporaryDefenseUntilTick?t.temporaryDefense:0,defBefore=old.effectiveDefense.call(this,t,link,temp),priorDefense=defenseContext,priorB=a.basicDamageBonus;
   defenseContext={targetId:t.id,armor:armorEligible?Math.min(v('armor_file'),Math.max(0,finite(t.baseDefense))):0,plate:plateEligible?v('unshielded_plate'):0};
   const defAfter=this.effectiveDefense(t,link,temp),flatBefore=t.projection?.ledger?.filter(x=>x.applied&&x.category==='relic'&&x.affectedField==='defense'&&x.operation==='flat_gain').reduce((n,x)=>n+x.value,0)??0;
   const flatAdded=plateEligible?Math.min(v('unshielded_plate'),Math.max(0,40-flatBefore)):0,before=t.hp,guardBefore=this.commandGuardReduction?.(t)??0,barrierBefore=barrier,requested=amount*(1+gain/(1+b));let actual;
   try{if(gain)a.basicDamageBonus=finite(priorB)+gain;actual=old.hit.call(this,a,t,requested,kind,action);}finally{a.basicDamageBonus=priorB;defenseContext=priorDefense;}
   if(armorEligible){const ignored=Math.min(v('armor_file'),Math.max(0,finite(t.baseDefense))),factorBefore=Math.max(.45,100/(100+defBefore)),factorAfter=Math.max(.45,100/(100+defAfter)),consumed=ignored>0&&factorAfter>factorBefore+1e-12;attackContext.armorReserved=consumed;if(consumed){const row={sourceId:a.id,readyTick:this.tickCount+240,rootActionId:root};if(ready)Object.assign(ready,row);else state.armorReady.push(row);}record({kind:'armor_file',relicId:'armor_file',sourceId:a.id,targetId:t.id,actual,before,after:t.hp,baseDefenseIgnored:ignored,effectiveDefenseBefore:defBefore,effectiveDefenseAfter:defAfter,cooldownConsumed:consumed,readyTick:consumed?this.tickCount+240:ready?.readyTick??0,zeroBenefitReason:ignored===0?'base-DEF-zero':!consumed?'R-cap':actual===0?'no-HP-loss':null,notIncrementalBenefit:true});}
   if(plateEligible){const guard=guardBefore,f0=Math.max(.45,100/(100+defBefore)*(1-guard)),f1=Math.max(.45,100/(100+defAfter)*(1-guard)),effective=defAfter>defBefore&&f1<f0-1e-12,consumed=actual>0&&effective;if(consumed)state.plateUsed.push(t.id);record({kind:'unshielded_plate',relicId:'unshielded_plate',sourceId:a.id,targetId:t.id,actual,before,after:t.hp,barrierBefore,defenseFlatAdded:flatAdded,effectiveDefenseBefore:defBefore,effectiveDefenseAfter:defAfter,consumed,zeroBenefitReason:flatAdded===0?'D-cap':!effective?'R-cap':actual===0?'no-HP-loss':null,notIncrementalBenefit:true});}
   if(burdened)record({kind:'burdened_sight',relicId:'burdened_sight',sourceId:a.id,targetId:t.id,actual,before,after:t.hp,requestedBase:amount,requested,basicBonusBefore:b,basicBonusAdded:gain,critChanceBefore:attackContext.critical.before,critChanceApplied:attackContext.critical.after,critical:!noncritical,zeroBenefitReason:!noncritical?'critical':gain===0?'B-cap':actual===0?'no-HP-loss':null,notIncrementalBenefit:true});
   return actual;
  });
 };
 // These actions retain whole-action rollback even when multiple nested hit effects execute.
 for(const name of ['castUnitSkill','castBarrier','supportHeal','castSkill'])game[name]=function(...args){return atomic(()=>old[name].apply(this,args));};
 function perform(a){assert(a&&Object.hasOwn(a,'actionId')&&Object.hasOwn(a,'kind')&&id(a.actionId)&&a.actionId.length<=240,'Explicit action identity required');assert(typeof a.kind==='string'&&['attack','hit','supportHeal','castSkill','castUnitSkill','castBarrier'].includes(a.kind),'Unsupported action kind');const fingerprint=canonical(a),prior=state.completedActions.find(x=>x.id===a.actionId);if(prior){assert(prior.fingerprint===fingerprint,'Conflicting action identity');return clone(prior.result);}
  return atomic(()=>{const unit=x=>game.units.find(u=>u.id===x),any=x=>[...game.units,...game.enemies].find(u=>u.id===x);let result;if(a.kind==='attack')result=game.attack(unit(a.sourceId),any(a.targetId));else if(a.kind==='hit'){assert(positive(a.amount),'Positive hit required');const source=any(a.sourceId),target=any(a.targetId);if(!source||source.hp<=0||!target||target.hp<=0)return false;game.hit(source,target,a.amount,'hit',a.action??{});result=true;}else if(a.kind==='supportHeal')result=game.supportHeal(unit(a.sourceId),unit(a.targetId));else if(a.kind==='castSkill'){assert(typeof a.skillId==='string'&&['heal','guard','focus','rally'].includes(a.skillId),'Invalid command ID');result=game.castSkill(a.skillId,a.targetId);}else result=game[a.kind](a.sourceId,a.targetId);if(result===true)state.completedActions.push({id:a.actionId,fingerprint,result:true});return result;},`${game.battleId}:rb3-external:${a.actionId}`);
 }
 function exportCheckpoint(){assert(!game._v10SpearAdapter,'Use outer composite checkpoint with spear private journal');assert(!depth,'Cannot checkpoint during action');return {schema:RB3_CHECKPOINT,context,game:captureGame(game)};}
 function importCheckpoint(cp){assert(!game._v10SpearAdapter,'Use outer composite checkpoint with spear private journal');assert(!depth&&cp?.schema===RB3_CHECKPOINT&&cp.context===context,'Foreign RB3 checkpoint');const d=cp.game?.data;assert(d&&canonical({version:RB3_VERSION,battleId:d.battleId,initialSeed:d.initialSeed,relics:content.normalizeRelics(d.relics),roster:d.startingRoster,encounter:d.encounter,skills:d.skills,prepared:d.prepared,commands:d.relicEffects?.commandSkills})===context,'Checkpoint data mismatch');validate(cp.game?.participants?.find(x=>x.id==='rb3-relic-effects')?.state);const prior=captureGame(game);try{restoreGame(game,clone(cp.game));}catch(e){restoreGame(game,prior);throw e;}}
 return {version:RB3_VERSION,snapshot:()=>deepFreeze(clone(state)),perform,exportCheckpoint,importCheckpoint};
}
