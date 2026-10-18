'use strict';
// Isolated P0 reducer. Inputs are already projected by v09 projectUnit, never raw stats.
const PROFILE_ID='v10-trial-p0', RULES_VERSION='v10-trial-p0';
const clone=x=>JSON.parse(JSON.stringify(x));
const ticks=s=>Math.max(1,Math.ceil(s*60-1e-9));
const live=u=>u&&u.hp>0&&u.deployed!==false&&(u.team==='enemy'||Number.isInteger(u.slot)&&u.slot>=0&&u.slot<12);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const idOrder=(a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'en');
const adjacent=(a,b)=>Math.abs(Math.floor(a/4)-Math.floor(b/4))+Math.abs(a%4-b%4)===1;
function skillLoadout(branch,tier){if(!['guardian','charger'].includes(branch)||![1,2,3].includes(tier))throw Error('Unsupported branch/tier');const a=branch==='guardian'?['guardian_link']:['charge'];if(tier>=2)a.push(branch==='guardian'?'bastion_guard':'charge_cover');if(tier===3)a.push('iron_oath');return a;}
function createUnitState(p,{battleId,tier=2,nextBasicTick=0,unitCooldownCostFactor=1}={}){
 if(!battleId||p.training!==2&&tier>=2)throw Error('Battle ID and training II required');skillLoadout(p.type,tier);
 if(!Number.isFinite(p.abilityPower)||!Number.isFinite(p.conditionMultiplier)||!Number.isFinite(unitCooldownCostFactor)||unitCooldownCostFactor<=0)throw Error('Invalid projection');
 return {battleId,profileId:PROFILE_ID,rulesVersion:RULES_VERSION,unitId:p.id,branch:p.type,tier,projection:clone(p),unitCooldownCostFactor,actionSeq:0,action:null,phase:'ready',nextBasicTick,recoveryUntil:0,cooldownUntil:p.type==='charger'?ticks(p.skill.initialDelay??2):ticks(3),coverCooldownUntil:0,ultimateState:tier===3?'charging':'locked',ultimateUsed:false,protections:[],processedEvents:[],triggerClaims:[],remainingTriggerBudget:0,lastTick:0,ended:false};
}
function checked(s,tick){if(!Number.isInteger(tick)||tick<s.lastTick)throw Error('Nonmonotonic tick');const n=clone(s);n.lastTick=tick;return n;}
function actor(s,w){return w.units.find(u=>u.id===s.unitId);}
function linked(s,w){const u=actor(s,w);if(!live(u))return [];return w.units.filter(v=>live(v)&&v.team===u.team&&v.type!=='guardian'&&v.id!==u.id&&adjacent(s.projection.slot,v.startSlot??v.slot)&&w.links?.[v.id]?.sourceId===u.id);}
function guardCandidates(s,w,tick){return linked(s,w).filter(v=>((v.telegraphTick>=tick&&v.telegraphTick-tick<=60)||v.hp/v.maxHp<=.5&&w.units.some(e=>live(e)&&e.team!==v.team&&dist(e,v)<=150.01))&&!w.protections?.some(p=>p.targetId===v.id&&p.sourceId!==s.unitId&&p.untilTick>tick&&p.remainingBudget>0)).sort((a,b)=>(a.telegraphTick??Infinity)-(b.telegraphTick??Infinity)||a.hp/a.maxHp-b.hp/b.maxHp||(a.barrier?.amount??0)-(b.barrier?.amount??0)||dist(actor(s,w),a)-dist(actor(s,w),b)||idOrder(a.id,b.id));}
function enemies(s,w){const u=actor(s,w);return w.units.filter(v=>live(v)&&v.team!==u.team).sort((a,b)=>(a.id===w.focusId?-1:0)-(b.id===w.focusId?-1:0)||dist(u,a)-dist(u,b)||idOrder(a.id,b.id));}
function advance(s,w,tick){const n=checked(s,tick),u=actor(n,w);n.protections=n.protections.filter(p=>p.untilTick>tick&&p.remainingBudget>0&&p.hitsLeft>0&&live(u)&&(p.skillId==='charge_cover'||linked(n,w).some(v=>v.id===p.targetId)));if(!live(u)||w.ended){n.action=null;n.protections=[];n.ended=!!w.ended;n.phase='cancelled';n.ultimateState='consumed';return n;}if(n.tier===3&&!n.ultimateUsed&&tick>=300)n.ultimateState='armed';if(!n.action&&tick>=n.recoveryUntil)n.phase='ready';return n;}
function canBasicAttack(s,w,tick){return live(actor(s,w))&&!s.ended&&!w.ended&&!s.action&&tick>=s.recoveryUntil&&tick>=s.nextBasicTick;}
function commitAction(s,w,tick){const n=advance(s,w,tick),u=actor(n,w);if(n.ended||!live(u)||n.action||tick<n.recoveryUntil||tick<n.cooldownUntil)return {state:n,committed:false};
 const p=n.projection,skillId=n.branch==='guardian'?'bastion_guard':'charge';if(n.branch==='guardian'&&n.tier<2)return {state:n,committed:false};
 const target=n.branch==='guardian'?guardCandidates(n,w,tick)[0]:enemies(n,w).find(v=>dist(u,v)<=p.skill.range+.01);if(!target)return {state:n,committed:false};
 const ultimate=n.ultimateState==='armed'&&(n.branch==='guardian'?target.telegraphTick>=tick&&target.telegraphTick-tick<=60:enemies(n,w).filter(e=>dist(e,target)<=p.skill.radius+.01).length>=2||target.telegraphTick>=tick);
 const windup=ticks(n.branch==='guardian'?.2:ultimate?.2:(p.skill.windup??.45));const recovery=ticks(n.branch==='guardian'?.4:ultimate?.6:.35);
 const cooldown=n.branch==='guardian'?ticks(10*(1-Math.min(.15,Math.max(0,p.unitSkillCdr||0)))*n.unitCooldownCostFactor):ticks(p.skill.cooldown);
 const actionId=`${n.battleId}:${n.unitId}:${++n.actionSeq}`;
 n.action={actionId,rootActionId:actionId,skillId,targetIds:[target.id],point:{x:target.x,y:target.y},commitTick:tick,resolveTick:tick+windup,recoveryUntil:tick+windup+recovery,paidMana:0,ultimateModifier:ultimate?'iron_oath':null,status:'windup',events:[]};n.phase='windup';n.cooldownUntil=tick+cooldown;n.recoveryUntil=n.action.recoveryUntil;
 // Pause remaining normal attack time, rather than erasing or accumulating attacks.
 n.nextBasicTick=Math.max(tick,n.nextBasicTick)+windup+recovery;n.remainingTriggerBudget=3;n.triggerClaims=[];
 if(ultimate){n.ultimateUsed=true;n.ultimateState='consumed';}return {state:n,committed:true};
}
function event(s,a,index,targetId,effectKind,extra={}){return {rootActionId:a.actionId,eventId:`${a.actionId}:${index}`,parentEventId:null,unitId:s.unitId,targetId,family:'spear',skillId:a.skillId,phase:'resolve',actionType:'unit_skill',effectKind,damageType:effectKind==='damage'?'physical':'none',canCrit:false,enhancedBasic:false,sourceKind:'normal',paidCast:false,ultimateModifier:a.ultimateModifier,...extra};}
function resolveAction(s,w,tick){let n=advance(s,w,tick);const a=n.action;if(!a||a.status!=='windup'||tick<a.resolveTick)return {state:n,events:[]};if(tick!==a.resolveTick)throw Error('Resolve must run on scheduled fixed tick');const p=n.projection;let events=[];
 if(n.branch==='charger'){events=enemies(n,w).filter(v=>dist(v,a.point)<=p.skill.radius+.01).sort((a,b)=>idOrder(a.id,b.id)).map((v,i)=>event(n,a,i,v.id,'damage',{amount:p.skill.damage}));a.status='awaiting_receipts';a.resolvedTick=tick;a.events=events;n.phase='resolve';}
 else {let target=linked(n,w).find(v=>v.id===a.targetIds[0]);if(!target)target=guardCandidates(n,w,tick)[0];if(target){const e=event(n,a,0,target.id,'protection',{amount:p.abilityPower*p.conditionMultiplier*.5});events=[e];n.protections.push({sourceId:n.unitId,targetId:target.id,rootActionId:a.actionId,skillId:a.skillId,remainingBudget:e.amount,rate:.15,hitsLeft:a.ultimateModifier?3:1,untilTick:tick+ticks(a.ultimateModifier?2:1.5)});}n.action=null;n.phase='recovery';}
 return {state:n,events};
}
function acknowledgeEffects(s,receipts,tick){const n=checked(s,tick),a=n.action;if(!a||a.status!=='awaiting_receipts')return n;if(tick!==a.resolvedTick)throw Error('Invalid receipt tick');
 if(receipts.length!==a.events.length||new Set(receipts.map(r=>r.eventId)).size!==receipts.length)throw Error('Exactly one receipt per event required');
 for(const e of a.events){const r=receipts.find(r=>r.eventId===e.eventId);if(!r||!Number.isFinite(r.actualDamage)||r.actualDamage<0||r.actualDamage>e.amount+1e-9)throw Error('Invalid damage receipt');}
 const effective=receipts.some(r=>r.actualDamage>0);n.processedEvents.push(...receipts.map(r=>r.eventId));
 if(effective&&n.tier>=2&&tick>=n.coverCooldownUntil){n.protections.push({sourceId:n.unitId,targetId:n.unitId,rootActionId:a.actionId,skillId:'charge_cover',remainingBudget:n.projection.abilityPower*n.projection.conditionMultiplier*.4,rate:.12,hitsLeft:1,untilTick:tick+ticks(1.2)});n.coverCooldownUntil=tick+ticks(9);n.recoveryUntil+=ticks(.25);n.nextBasicTick+=ticks(.25);}
 n.lastResolved={actionId:a.actionId,effective,temporaryDefense:effective?(n.projection.skill.defenseAfter||0):0,temporaryDefenseUntil:tick+ticks(n.projection.skill.defenseDuration||2)};n.action=null;n.phase='recovery';return n;
}
function cancelAction(s,tick,{endBattle=false}={}){const n=checked(s,tick);n.action=null;n.protections=[];n.phase='cancelled';if(endBattle){n.ended=true;n.ultimateState='consumed';}return n;}
// Invoke after existing DEF/link/commander mitigation, before barrier absorption.
function applyProtection(states,w,{tick,targetId,incoming,mitigated}){if(!Number.isFinite(incoming)||!Number.isFinite(mitigated)||incoming<0||mitigated<0||mitigated>incoming)throw Error('Invalid damage');const next=states.map(s=>advance(s,w,tick));const candidates=next.flatMap((s,i)=>s.protections.filter(p=>p.targetId===targetId).map(p=>({i,p,reduction:Math.min(p.remainingBudget,mitigated*p.rate,Math.max(0,mitigated-.45*incoming))}))).sort((a,b)=>b.reduction-a.reduction||idOrder(a.p.sourceId,b.p.sourceId));const c=candidates[0];if(!c||c.reduction<=0)return {states:next,damage:mitigated,prevented:0};c.p.remainingBudget-=c.reduction;c.p.hitsLeft--;return {states:next,damage:mitigated-c.reduction,prevented:c.reduction,sourceId:c.p.sourceId};}
function claimTrigger(s,{rootActionId,triggerId,sourceKind='normal'}){const n=clone(s),root=n.action?.actionId??n.lastResolved?.actionId,key=`${rootActionId}:${triggerId}`;if(sourceKind!=='normal'||rootActionId!==root||n.remainingTriggerBudget<=0||n.triggerClaims.includes(key))return {state:n,allowed:false};n.triggerClaims.push(key);n.remainingTriggerBudget--;return {state:n,allowed:true};}
module.exports={PROFILE_ID,RULES_VERSION,ticks,skillLoadout,createUnitState,advance,canBasicAttack,commitAction,resolveAction,acknowledgeEffects,cancelAction,applyProtection,claimTrigger};
