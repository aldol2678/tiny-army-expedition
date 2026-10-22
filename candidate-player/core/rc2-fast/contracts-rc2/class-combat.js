import {SECOND_CLASSES,familyOf,combatDescriptor} from '../progression/registry.js';
import {compareIds,distance,selectTargets,protectionReduction,resolveIntent} from '../progression/resolver.js';
import {shapeContains} from '../encounters/patterns.js';
// Recovery reconstruction; never identify these bytes as the historical R5 build.
export const CLASS_COMBAT_VERSION='v10-class-combat-rc2-unified-1';
export const CLASS_COMBAT_IDS=Object.freeze(Object.values(SECOND_CLASSES).filter(c=>c.family!=='spear').map(c=>c.id));
const copy=x=>JSON.parse(JSON.stringify(x)),ticks=s=>Math.max(1,Math.ceil(s*60-1e-9)),finite=(n,f=0)=>Number.isFinite(n)?n:f;
const life=u=>u&&u.hp>0,credit=(u,k,n)=>{if(n>0){u.stats[k]=finite(u.stats[k])+n;u.career[k]=finite(u.career[k])+n;}};
export function planMageSecondary({tick,mana,maxMana,manaRegen,primaryCost,primaryReadyTick,secondaryCost,occupancyTicks,emberOverlap=false,primaryTargetAvailable=true}) {
 const values=[tick,mana,maxMana,manaRegen,primaryCost,primaryReadyTick,secondaryCost,occupancyTicks];
 if(values.some(n=>!Number.isFinite(n))||mana<0||maxMana<0||mana>maxMana+1e-9||manaRegen<0||primaryCost<=0||secondaryCost<=0||occupancyTicks<0)return {allowed:false,reason:'invalid-budget'};
 if(mana+1e-9<secondaryCost)return {allowed:false,reason:'secondary-unaffordable'};
 if(maxMana+1e-9<primaryCost)return {allowed:false,reason:'primary-unfundable'};
 if(primaryTargetAvailable&&primaryReadyTick<=tick&&mana+1e-9>=primaryCost)return {allowed:false,reason:'primary-priority'};
 const fundedAt=available=>available+1e-9>=primaryCost?tick:manaRegen>0?tick+Math.ceil((primaryCost-available)*60/manaRegen-1e-9):Infinity;
 const without=Math.max(tick,primaryReadyTick,fundedAt(mana)),after=Math.max(primaryReadyTick,tick+occupancyTicks,fundedAt(mana-secondaryCost));
 if(!Number.isFinite(after)||!Number.isFinite(without))return {allowed:false,reason:'primary-unfundable'};
 const plan={primaryWithoutSecondaryTick:without,primaryAfterSecondaryTick:after,additionalPrimaryDelayTicks:after-without,maxAdditionalPrimaryDelayTicks:240};
 if(plan.additionalPrimaryDelayTicks>240)return {allowed:false,reason:'primary-delay-limit',...plan};
 if(emberOverlap&&after>tick+21+270)return {allowed:false,reason:'awaiting-overlap-window',...plan};
 return {allowed:true,reason:'paid-weave',...plan};
}
/** One started isolated Game; beforeTick -> game.tick(1/60) -> afterTick.
 * Checkpoint Game and adapter together. Owns twelve non-spear second classes. */
export function createClassCombatAdapter(game,{roster=game.startingRoster??[],statusAdapter=null,restore=null,actionArbiter=null,ultimateMode='independent-foundation',paidLifecycle=null,content=null}={}) {
 if(ultimateMode!=='independent-foundation')throw Error('Unsupported ultimate mode');
 if(game._v10ClassCombat)throw Error('Class adapter already installed on this Game');
 if(game.phase!=='battle'||game.combatRulesVersion!=='v09-combat-1')throw Error('Class adapter requires a started v09-compatible isolated battle');
 if(paidLifecycle&&(!content||game._rb4PaidLifecycle!==paidLifecycle))throw Error('Explicit paid lifecycle/content required');
 const ownDirect=paidLifecycle?.bindDirectOwner('class');
 const units=new Map(game.units.map(u=>[u.id,u])),states=new Map(),journal=[],receipts=new Map();
 let lastBefore=-1,lastAfter=-1,disposed=false,manual=false;
 const original={};for(const name of ['attack','moveToward','castUnitSkill','castBarrier','supportHeal','hit'])original[name]=game[name].bind(game);
 const now=()=>game.tickCount,world=()=>({units:[...game.units,...game.enemies]}),unit=id=>units.get(id),enemy=id=>game.enemies.find(x=>x.id===id);
 for(const raw of roster){if(!CLASS_COMBAT_IDS.includes(raw.secondClassId))continue;const d=combatDescriptor(raw),u=unit(raw.id);if(!u)continue;Object.assign(u,{secondClassId:raw.secondClassId,classStage:d.classStage,ultimateId:d.ultimateId});states.set(raw.id,{unitId:raw.id,classId:raw.secondClassId,tier:d.classStage,seq:0,action:null,recoveryUntil:0,cooldowns:{second:raw.type==='medic'?ticks(5*finite(u.projection?.supportPeriodCostFactor,1)):ticks(raw.type==='warder'?finite(u.shield?.initialDelay,2):raw.type==='sniper'?2:familyOf(raw)==='mage'?4:3)},ultimateState:d.classStage===3?(ultimateMode==='legacy-modifier'?'charging':'independent-foundation'):'locked',ultimateUsed:false,field:null,aim:null,scheduled:[],lastBasicTick:-1,attackDebt:0,frozenCd:null,ended:false});}
 const state=u=>u&&states.get(u.id),locked=s=>!!s&&(s.action!==null||now()<s.recoveryUntil||!!actionArbiter&&!actionArbiter.canStart(s.unitId,'class',now())),supported=u=>!!state(u);
 const enemies=(u,range=u.range)=>selectTargets(game.enemies,u,{range,focusId:game.focusTarget()?.id});
 const patients=u=>selectTargets(game.units,u,{team:'ally',range:u.healRange,mode:'heal'});
 const normalPatients=(u,range=game.normalHealRange?.(u)??u.healRange)=>selectTargets(game.units,u,{team:'ally',range,mode:'heal'});
 function telegraph(target){
  const t=game.telegraphs.filter(t=>t.owner?.team==='enemy'&&t.owner.hp>0&&Math.hypot(target.x-t.x,target.y-t.y)<=t.radius+.01).map(t=>now()+ticks(Math.max(0,t.left)));
  for(const tell of game.encounterTelegraphs??[])if(tell.resolveTick>=now()&&tell.shape&&shapeContains(tell.shape,target))t.push(tell.resolveTick);
  return t.length?Math.min(...t):Infinity;
 }
 function protectees(u,amount){return selectTargets(game.units.map(v=>({...v,telegraphTick:telegraph(v)})),u,{team:'ally',range:u.shield?.range??u.healRange,mode:'protection',amount}).map(v=>unit(v.id));}
 const ap=u=>u.abilityPower*u.conditionMultiplier;
 const supportFactor=u=>finite(u.projection?.supportPeriodCostFactor,1);
 const secondCD=(u,n)=>ticks(n*(1-Math.min(.15,finite(u.projection?.unitSkillCdr)))*(familyOf(u)==='support'?supportFactor(u):1));
 function note(s,skillId,phase,extra={}){journal.push({tick:now(),unitId:s.unitId,classId:s.classId,skillId,phase,...extra});}
 function readyUltimate(s){return ultimateMode==='legacy-modifier'&&s.tier===3&&!s.ultimateUsed&&now()>=300;}
 function consumeUltimate(s,a,condition){if(readyUltimate(s)&&condition){s.ultimateUsed=true;s.ultimateState='consumed';a.ultimateModifier=SECOND_CLASSES[s.classId].ultimateId;note(s,a.skillId,'ultimate',{rootActionId:a.id});return true;}return false;}
 function price(u,skillId,baseCost){return paidLifecycle&&baseCost>0?paidLifecycle.price({sourceId:u.id,ownerKind:'class',skillId,baseCost}):null;}
 function commit(s,skillId,targetIds,{windup=.2,recovery=.3,cooldown=0,mana=0,payload={},ultimate=false,baseCooldownSec=0,cooldownSlot='none',scheduledCooldown=0}={}) {
  const u=unit(s.unitId);if(!life(u)||locked(s))return null;const costPlan=price(u,skillId,mana),paidMana=costPlan?.paidCost??mana;if(u.mana+1e-9<paidMana)return null;
  const id=`${game.battleId}:${u.id}:class:${++s.seq}`,a={id,skillId,targetIds:[...targetIds],commitTick:now(),resolveTick:now()+ticks(windup),recoveryUntil:now()+ticks(windup)+ticks(recovery),mana:paidMana,payload,ultimateModifier:null};
  const payment=paidLifecycle&&mana>0?paidLifecycle.quote({rootActionId:id,sourceId:u.id,skillId,ownerKind:'class',commitTick:now(),baseCost:mana,paidMana,costPlan,baseCooldownSec,priorReductionSec:baseCooldownSec*Math.min(.15,finite(u.projection?.unitSkillCdr)),cooldownTicks:scheduledCooldown||cooldown,cooldownSlot}):null,manaBefore=u.mana;
  if(actionArbiter)actionArbiter.claim({unitId:u.id,id,owner:'class',from:now(),until:Math.max(now()+1,a.recoveryUntil)});
  if(mana){u.mana=Math.max(0,u.mana-paidMana);credit(u,'manaSpent',paidMana);credit(u,'unitSkillCasts',1);}
  if(cooldown)s.cooldowns.second=now()+cooldown;s.action=a;s.recoveryUntil=a.recoveryUntil;s.frozenCd=Math.max(0,u.cd);consumeUltimate(s,a,ultimate);note(s,skillId,'commit',{rootActionId:id,targetIds:[...targetIds],paidMana,recoveryUntil:a.recoveryUntil,ultimateModifier:a.ultimateModifier});if(payment){a.payment=payment;if(cooldownSlot==='unit')u.unitSkillReadyTick=now()+payment.cooldownTicks;paidLifecycle.commit(payment,{manaBefore,manaAfter:u.mana});}return a;
 }
 function successfulSpell(s,a){const u=unit(s.unitId);if(!a.mana||!life(u)||a.spellSuccess)return;a.spellSuccess=true;u.paidSpellCount=finite(u.paidSpellCount)+1;let echoRefund=0;if(u.paidSpellCount%3===0&&game.relicEffects.echoRefund>0){echoRefund=Math.min(u.maxMana-u.mana,a.mana*Math.min(.5,game.relicEffects.echoRefund));u.mana+=echoRefund;credit(u,'manaRefunded',echoRefund);}note(s,a.skillId,'paid-spell-success',{rootActionId:a.id});if(paidLifecycle)settlePaid(s,a,'success',echoRefund);}
 function settlePaid(s,a,outcome,echoRefund=0){if(!paidLifecycle||!a.payment||a.paidSettled)return;const u=unit(s.unitId),get=()=>a.payment.cooldownSlot==='second'?s.cooldowns.second:u.unitSkillReadyTick,set=v=>{if(a.payment.cooldownSlot==='second')s.cooldowns.second=v;else u.unitSkillReadyTick=v;};paidLifecycle.resolve(a.id,{outcome,echoRefund,effectIds:Array.from({length:a.effectSeq??0},(_,i)=>`${a.id}:effect:${i+1}`),directEffects:a.directEffects??[]},{get,set});a.paidSettled=true;}
 function effect(s,a,target,kind,amount,extra={}) {
  const eventId=`${a.id}:effect:${a.effectSeq=(a.effectSeq??0)+1}`,intent={eventId,rootActionId:a.id,tick:now(),sourceId:s.unitId,targetId:target.id,skillId:a.skillId,effectKind:kind,amount,actionType:kind==='damage'?'unit_skill':kind==='heal'?'heal':kind==='shield'?'shield':'unit_skill',damageType:familyOf(unit(s.unitId))==='mage'?'magic':'physical',canCrit:false,sourceKind:'normal',paidCast:false,ultimateModifier:a.ultimateModifier,...extra};
  const resolved=resolveIntent(world(),intent);if(!resolved.effects.length){note(s,a.skillId,'fizzle',{eventId,reason:resolved.reason});return 0;}
  if(receipts.has(eventId))return receipts.get(eventId).actual;
  const e=resolved.effects[0],u=unit(s.unitId);let actual=0;
  if(kind==='damage')game.resolveDamageAction(()=>{const apply=()=>{const hit=()=>game.hit(u,target,e.amount,e.damageType==='magic'?'arcane_bolt':'arrow',{...e,ownerKind:'unit'});actual=ownDirect&&a.payment&&e.sourceKind==='normal'?ownDirect({rootActionId:a.id,eventId:e.eventId,sourceId:u.id,targetId:target.id,skillId:a.skillId,sourceKind:'normal'},hit):hit();};if(game._rb6FinalDamage)game._rb6FinalDamage.withClassAction({action:a,source:u,classId:s.classId,eventId:e.eventId,targetId:target.id},apply);else apply();});
  else if(kind==='heal')actual=game.heal(target,e.amount,u,{sourceKind:extra.sourceKind??'special_heal'});
  else if(kind==='shield'){const granted=game.grantBarrier(u,target,e.amount,extra.duration,{eventId:e.eventId,rootActionId:a.id});actual=granted?(game._hb1Healing?.barrierReceipt(e.eventId)?.grantedAmount??e.amount):0;}
  else if(kind==='slow'){const active=(target.slows??[]).filter(x=>x.untilTick>now()).reduce((v,x)=>Math.max(v,x.value),0),v=Math.min(.25,extra.value)*(target.type==='boss'?.5:1);if(active<v-1e-9){game.applySlow(u,target,extra.value,extra.duration);actual=v*extra.duration;}}
  else if(kind==='cleanse')actual=statusAdapter?.cleanse(target.id,{max:1}).removed.length??0;
  if(paidLifecycle&&a.payment&&kind==='damage'&&e.sourceKind==='normal')(a.directEffects??=[]).push({eventId,targetId:target.id,actualDamage:actual,sourceKind:'normal'});
  const receipt={eventId,actual,requested:amount??0,tick:now()};receipts.set(eventId,receipt);note(s,a.skillId,'effect',{...receipt,targetId:target.id,effectKind:kind,sourceKind:e.sourceKind});return actual;
 }
 function publicBasicThreats(u,range=u.range){return enemies(u,range).filter(e=>e.type!=='boss'&&e.publicAttackReadyTick>=now()&&e.publicAttackReadyTick-now()<=30&&e.publicAttackSequence===e.attacks);}
 function publishBasicTelegraphs(){for(const e of game.enemies){if(!life(e)||e.type==='boss')continue;const near=game.units.filter(life).some(a=>distance(a,e)<=e.range+.01);if(near&&e.cd>0&&e.cd<=.5){e.publicAttackReadyTick=now()+ticks(e.cd/Math.max(.01,game.attackHaste(e)));e.publicAttackSequence=e.attacks;if(e._v10LastTell!==e.attacks){e._v10LastTell=e.attacks;game.effect('ring',e.x,e.y,0,0,'#ad7050',.5);}}}}
 // Research owns command eligibility and its shared basic-damage cap. The
 // reserved enhanced shot uses the additive command term once, not a second
 // multiplier over game.basicDamage. Without that adapter retain legacy10%.
 const commandBasicBonus=(u,target)=>typeof game.commandBasicBonus==='function'?Math.max(0,finite(game.commandBasicBonus(u,target))):(game.focusTarget()===target?.1:0);
 function shotAmount(u,target,enhanced){return enhanced?(u.attackPower*finite(u.skill?.attackCoefficient,1)+u.abilityPower*finite(u.skill?.coefficient,1.8))*u.conditionMultiplier*(1+finite(u.basicDamageBonus)+commandBasicBonus(u,target)):game.basicDamage(u,target);}
 function reserveShot(u,s,target){const enhanced=(u.attacks+1)%3===0;u.attacks++;const amount=shotAmount(u,target,enhanced)*(enhanced?1:game.criticalMultiplier(u));u.cd=u.rate;s.frozenCd=u.cd;return {amount,enhanced};}
 function groundCandidate(u,radius){return enemies(u).map(e=>({x:e.x,y:e.y,id:e.id,count:game.enemies.filter(v=>life(v)&&distance(v,e)<=radius+.01).length})).sort((a,b)=>b.count-a.count||distance(u,a)-distance(u,b)||compareIds(a.id,b.id))[0];}
 function approaching(u){return enemies(u).filter(e=>e.range<150&&game.units.filter(life).some(a=>distance(e,a)>e.range+.01));}
 function secondaryPlan(s,u,skillId,cost,occupancyTicks,emberOverlap=false){const paidCost=price(u,skillId,cost)?.paidCost??cost;const plan=game.ultimateResourcePlan?game.ultimateResourcePlan(u,paidCost,occupancyTicks,{emberOverlap}):planMageSecondary({tick:now(),mana:u.mana,maxMana:u.maxMana,manaRegen:u.manaRegen,primaryCost:u.skill.manaCost,primaryReadyTick:u.unitSkillReadyTick,secondaryCost:paidCost,occupancyTicks,emberOverlap,primaryTargetAvailable:enemies(u).length>0});s.secondaryPlan={tick:now(),...plan};return plan;}
 function commitSecondary(s,u,skillId,targetIds,options){const plan=secondaryPlan(s,u,skillId,options.mana,ticks(options.windup)+ticks(options.recovery),skillId==='ember_field'&&ultimateMode==='legacy-modifier'&&s.tier===3&&!s.ultimateUsed);if(!plan.allowed)return null;const a=commit(s,skillId,targetIds,{...options,baseCooldownSec:12,cooldownSlot:'second',payload:{...options.payload,resourcePlan:plan}});if(a){game.ultimateResourceCommitted?.(u,plan,{rootActionId:a.id,skillId,cost:a.mana});note(s,skillId,'secondary-budget',{rootActionId:a.id,...plan});}return a;}
 function beginSpell(s,u){
  if(now()<u.unitSkillReadyTick||u.mana+1e-9<(price(u,u.skill.id,u.skill.manaCost)?.paidCost??u.skill.manaCost))return false;const es=enemies(u);if(!es.length)return false;
  const target=es[0],flame=u.type==='pyromancer',targets=flame?[target,...game.enemies.filter(e=>life(e)&&e.id!==target.id&&distance(e,target)<=u.skill.radius+.01).sort((a,b)=>distance(a,target)-distance(b,target)||compareIds(a.id,b.id)).slice(0,2)]:[target];
  const field=s.field,ultimate=flame&&s.classId==='ember_tactician'&&field?.kind==='ember'&&field.ticksLeft>=2&&distance(target,field)<=65.01;
  const a=commit(s,u.skill.id,targets.map(v=>v.id),{windup:flame?.25:.2,recovery:flame?.25:.25,mana:u.skill.manaCost,baseCooldownSec:content?.TYPES[u.type].skill.cooldown??0,cooldownSlot:'unit',scheduledCooldown:ticks(u.skill.cooldown),payload:{point:{x:target.x,y:target.y},damage:u.skill.damage,secondaryDamage:u.skill.secondaryDamage,range:u.range},ultimate});
  if(!a)return false;game.ultimatePrimaryCommitted?.(u);u.unitSkillReadyTick=now()+ticks(u.skill.cooldown);
  if(a.ultimateModifier&&field){a.payload.compressed={x:field.x,y:field.y,budget:field.perTick*field.ticksLeft};s.field=null;}return true;
 }
 function candidate(s){
  const u=unit(s.unitId);if(!life(u)||locked(s))return;const cid=s.classId,secondReady=now()>=s.cooldowns.second;
  if(['marksman','watcher'].includes(cid)){
   if(cid==='marksman'&&secondReady&&u.attacks%3===2&&u.cd<=.4&&!s.aim){const target=enemies(u).sort((a,b)=>Number(b.id===game.focusTarget()?.id)-Number(a.id===game.focusTarget()?.id)||Number(b.publicAttackReadyTick>=now())-Number(a.publicAttackReadyTick>=now())||b.hp-a.hp||distance(u,a)-distance(u,b)||compareIds(a.id,b.id))[0];if(target)commit(s,'fixed_aim',[target.id],{windup:.4,recovery:0,cooldown:secondCD(u,8)});}
   else if(cid==='watcher'&&secondReady&&u.cd<=1/60){const target=publicBasicThreats(u)[0];if(target){const a=commit(s,'watch_shot',[target.id],{windup:.15,recovery:.25,cooldown:secondCD(u,8),payload:{sequence:target.attacks,range:u.range},ultimate:true});Object.assign(a.payload,reserveShot(u,s,target));}}
   return;
  }
  if(['skirmisher','suppressor'].includes(cid)){
   const close=enemies(u,100)[0];
   if(cid==='skirmisher'&&secondReady&&close){const angle=Math.atan2(u.y-close.y,u.x-close.x),options=[0,45,-45,90,-90].map((d,i)=>{const a=angle+d*Math.PI/180;return {x:u.x+45*Math.cos(a),y:u.y+45*Math.sin(a),i};}).filter(p=>p.x>=75&&p.x<=830&&p.y>=128&&p.y<=477).map(p=>({...p,safety:Math.min(...game.enemies.filter(life).map(e=>distance(p,e)))})).filter(p=>p.safety>distance(u,close)+1).sort((a,b)=>b.safety-a.safety||a.i-b.i);if(options.length){commit(s,'retreat_step',[],{windup:.1,recovery:1.2,cooldown:secondCD(u,12),payload:{destination:options[0]}});return;}}
   const es=enemies(u,u.range+30),extended=es.find(e=>distance(e,u)>u.range+.01);
   if(now()>=finite(s.cooldowns.salvo,ticks(3))&&u.cd<=1/60&&es.length>=2&&extended){let targets=es.slice(0,u.maxTargets);if(!targets.some(e=>distance(e,u)>u.range+.01))targets[targets.length-1]=extended;const a=commit(s,'volley_salvo',targets.map(e=>e.id),{windup:.15,recovery:.35,payload:{range:u.range+30,amounts:targets.map((e,i)=>game.basicDamage(u,e)*(i?u.secondaryMultiplier:u.primaryMultiplier))},ultimate:es.length>=3});if(a.ultimateModifier){const max=u.maxTargets+2,primary=targets[0],more=es.filter(e=>e.id!==primary.id).slice(0,max-1),total=a.payload.amounts.slice(1).reduce((a,b)=>a+b,0);targets=[primary,...more];a.targetIds=targets.map(e=>e.id);a.payload.amounts=[a.payload.amounts[0],...more.map(()=>total/more.length)];}u.attacks++;u.cd=u.rate;s.frozenCd=u.cd;s.cooldowns.salvo=now()+secondCD(u,10);return;}
   if(cid==='suppressor'&&secondReady&&u.cd<=1/60){const es=approaching(u);if(es.length>=2){const p=es[0],a=commit(s,'suppress_lane',es.slice(0,u.maxTargets).map(e=>e.id),{windup:.35,recovery:.45,cooldown:secondCD(u,12),payload:{point:{x:p.x,y:p.y},range:u.range,amounts:es.slice(0,u.maxTargets).map((e,i)=>game.basicDamage(u,e)*(i?u.secondaryMultiplier:u.primaryMultiplier))},ultimate:es.length>=3});u.attacks++;u.cd=u.rate;s.frozenCd=u.cd;}}
   return;
  }
  if(u.maxMana>0){
   if(beginSpell(s,u))return;if(!secondReady||s.field)return;
   if(cid==='ember_tactician'){const p=groundCandidate(u,65);if(p?.count>=2)commitSecondary(s,u,'ember_field',[],{windup:.35,recovery:.35,cooldown:secondCD(u,12),mana:12,payload:{point:p,total:ap(u)*.9*(1+finite(u.mageSkillDamageBonus))}});}
   else if(cid==='heat_warden'){const allies=game.units.filter(life).filter(a=>distance(u,a)<=u.range+.01),target=allies.filter(a=>game.enemies.some(e=>life(e)&&e.range>100&&distance(e,a)<=e.range+30)).sort((a,b)=>telegraph(a)-telegraph(b)||a.hp/a.maxHp-b.hp/b.maxHp||compareIds(a.id,b.id))[0];if(target)commitSecondary(s,u,'heat_veil',[target.id],{windup:.3,recovery:.3,cooldown:secondCD(u,12),mana:10,payload:{point:{x:target.x,y:target.y},budget:ap(u)*.5},ultimate:true});}
   else if(cid==='frost_weaver'){const es=approaching(u);if(es.length>=2)commitSecondary(s,u,'frost_boundary',[],{windup:.3,recovery:.3,cooldown:secondCD(u,12),mana:10,payload:{point:{x:es[0].x,y:es[0].y,ux:(u.x-es[0].x)/(distance(u,es[0])||1),uy:(u.y-es[0].y)/(distance(u,es[0])||1)}},ultimate:true});}
   else if(cid==='frost_binder'){const es=enemies(u).filter(e=>!e._v10FrostSeal&&now()>=finite(e._v10SealImmuneUntil));if(es.length)commitSecondary(s,u,'frost_seal',es.slice(0,2).map(e=>e.id),{windup:.3,recovery:.35,cooldown:secondCD(u,12),mana:10,payload:{range:u.range},ultimate:es.length>=2});}
   return;
  }
  const ps=patients(u),factor=supportFactor(u);
  if(cid==='surgeon'&&secondReady){const target=ps.find(p=>p.hp/p.maxHp<=.30&&p.maxHp-p.hp>=ap(u)*1.5);if(target){const wounded=ps.filter(p=>p.hp/p.maxHp<=.5),a=commit(s,'field_surgery',[target.id],{windup:factor,recovery:.5*factor,cooldown:secondCD(u,14),payload:{amount:ap(u)*1.5,range:u.healRange},ultimate:wounded.length>=2});if(a.ultimateModifier)a.targetIds=wounded.slice(0,2).map(p=>p.id);u.healCd=Math.max(u.healCd,(a.recoveryUntil-now())/60+u.healInterval);return;}}
  if(cid==='cleanser'&&secondReady&&statusAdapter){const target=game.units.filter(life).filter(p=>distance(u,p)<=u.healRange+.01&&statusAdapter.statusesFor(p.id).some(st=>st.dispellable)).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||compareIds(a.id,b.id))[0];if(target){commit(s,'cleanse',[target.id],{windup:.3*factor,recovery:.3*factor,cooldown:secondCD(u,10),payload:{range:u.healRange},ultimate:true});return;}}
  if(['barrier_keeper','ward_keeper'].includes(cid)&&now()>=u.shieldReadyTick){const amount=u.shield.amount*(cid==='ward_keeper'?.6:1),targets=protectees(u,amount),urgent=targets.some(p=>telegraph(p)-now()<=60);if(targets.length&&(urgent||u.healCd>0||!ps.length)){const a=commit(s,cid==='ward_keeper'?'ward_barrier':'ward_shield',targets.slice(0,cid==='ward_keeper'?1:2).map(p=>p.id),{windup:.2,recovery:.3,payload:{amount,duration:u.shield.duration,range:u.shield.range},ultimate:cid==='ward_keeper'?urgent:targets.length>=2&&targets.slice(0,2).every(p=>telegraph(p)-now()<=60)});if(cid==='ward_keeper'&&a.ultimateModifier){a.resolveTick=now()+ticks(.1);a.payload.earlyPreventionWindow=true;}u.shieldReadyTick=now()+ticks(u.shield.cooldown);credit(u,'barrierCasts',1);return;}}
  const normalPs=normalPatients(u);if(u.healCd<=1/60&&normalPs.length){commit(s,'normal_heal',[normalPs[0].id],{windup:.15,recovery:.15,payload:{range:game.normalHealRange?.(u)??u.healRange}});u.healCd=u.healInterval;}
 }
 function complete(s,a){const u=unit(s.unitId);note(s,a.skillId,'resolve',{rootActionId:a.id});s.action=null;
  if(a.skillId==='fixed_aim'){let t=enemy(a.targetIds[0]);if(!life(t)||distance(u,t)>u.range+.01)t=enemies(u)[0];if(t)s.aim={targetId:t.id,untilTick:now()+60};return;}
  if(a.skillId==='watch_shot'){let t=enemy(a.targetIds[0]);if(a.ultimateModifier&&(!life(t)||distance(u,t)>a.payload.range+.01))t=publicBasicThreats(u)[0];if(life(t)&&distance(u,t)<=a.payload.range+.01){effect(s,a,t,'damage',a.payload.amount,{range:a.payload.range,actionType:'basic_attack',enhancedBasic:a.payload.enhanced});if(t.type!=='boss'&&t.attacks===a.payload.sequence&&t.publicAttackReadyTick>=now()&&now()>=finite(t._v10WatchImmuneUntil)){t.cd+=.3*game.attackHaste(t);t._v10WatchImmuneUntil=now()+ticks(4);note(s,a.skillId,'attack-delayed',{targetId:t.id,seconds:.3});}}return;}
  if(a.skillId==='retreat_step'){s.scheduled.push({kind:'retreat',from:now(),until:now()+60,destination:a.payload.destination,action:a});return;}
  if(a.skillId==='volley_salvo'){for(let i=0;i<a.targetIds.length;i++){const t=enemy(a.targetIds[i]);if(life(t)&&distance(u,t)<=a.payload.range+.01)effect(s,a,t,'damage',a.payload.amounts[i]/2,{range:a.payload.range,actionType:'basic_attack',enhancedBasic:true});}s.scheduled.push({kind:'salvo-second',at:now()+9,action:a});return;}
  if(a.skillId==='suppress_lane'){let count=0;for(let i=0;i<a.targetIds.length;i++){const t=enemy(a.targetIds[i]);if(!life(t)||distance(u,t)>a.payload.range+.01)continue;const dx=t.x-u.x,dy=t.y-u.y,p=a.payload.point,px=p.x-u.x,py=p.y-u.y,d=Math.hypot(px,py)||1,side=Math.abs(dx*py-dy*px)/d,along=(dx*px+dy*py)/d,laneSides=a.ultimateModifier?[Math.abs(side*Math.cos(.2)-along*Math.sin(.2)),Math.abs(side*Math.cos(.2)+along*Math.sin(.2))]:[side];if(along<0||Math.min(...laneSides)>35)continue;effect(s,a,t,'damage',a.payload.amounts[i],{range:a.payload.range,actionType:'basic_attack',enhancedBasic:true});effect(s,a,t,'slow',0,{value:.15,duration:.75});count++;}note(s,a.skillId,'lane-budget',{targets:count,maximum:a.targetIds.length});return;}
  if(['flame_burst','frost_bolt'].includes(a.skillId)){
   let success=false;if(a.skillId==='flame_burst'){for(let i=0;i<a.targetIds.length;i++){const t=enemy(a.targetIds[i]);if(!life(t)||distance(t,a.payload.point)>65.01)continue;effect(s,a,t,'damage',i?a.payload.secondaryDamage:a.payload.damage,{damageType:'magic'});success=true;}}
   else{let t=enemy(a.targetIds[0]);if(!life(t)||distance(u,t)>a.payload.range+.01)t=enemies(u)[0];if(t){effect(s,a,t,'damage',a.payload.damage,{range:a.payload.range,damageType:'magic'});effect(s,a,t,'slow',0,{value:u.skill.slow,duration:u.skill.slowDuration});success=true;}}
   if(success)successfulSpell(s,a);if(a.payload.compressed){const p=a.payload.compressed,ts=game.enemies.filter(e=>life(e)&&distance(e,p)<=65.01).sort((a,b)=>distance(a,p)-distance(b,p)||compareIds(a.id,b.id)).slice(0,3);for(const t of ts)effect(s,a,t,'damage',p.budget/ts.length,{damageType:'magic',sourceKind:'derived',dot:true});}return;
  }
  if(a.skillId==='ember_field'){s.field={kind:'ember',...a.payload.point,perTick:a.payload.total/6,ticksLeft:6,nextTick:now()+60,until:now()+361,action:a};successfulSpell(s,a);return;}
  if(a.skillId==='heat_veil'){s.field={kind:'heat',...a.payload.point,remainingBudget:a.payload.budget,until:now()+ticks(3),ultimate:!!a.ultimateModifier,action:a};successfulSpell(s,a);return;}
  if(a.skillId==='frost_boundary'){s.field={kind:'frost',...a.payload.point,visited:[],until:now()+ticks(4),ultimate:!!a.ultimateModifier,action:a};successfulSpell(s,a);return;}
  if(a.skillId==='frost_seal'){let ts=a.targetIds.map(enemy).filter(t=>life(t)&&distance(u,t)<=a.payload.range+.01&&!t._v10FrostSeal);if(!a.ultimateModifier)ts=ts.slice(0,1);const total=.6;for(const t of ts)t._v10FrostSeal={sourceId:u.id,seconds:total/ts.length,until:now()+ticks(4),actionId:a.id};if(ts.length)successfulSpell(s,a);return;}
  if(a.skillId==='normal_heal'){let t=unit(a.targetIds[0]);if(!life(t)||t.hp>=t.maxHp-.000001||distance(u,t)>a.payload.range+.01)t=normalPatients(u,a.payload.range)[0];if(t){manual=true;try{const before=t.hp;if(game._hb1Healing)game._hb1Healing.withNormalAction({rootActionId:a.id,sourceId:u.id,targetId:t.id,range:a.payload.range},()=>original.supportHeal(u,t));else original.supportHeal(u,t);note(s,a.skillId,'effect',{rootActionId:a.id,targetId:t.id,actual:t.hp-before,sourceKind:'normal'});}finally{manual=false;}}return;}
  if(a.skillId==='field_surgery'){const n=a.targetIds.length,used=new Set(),reserved=new Set(a.targetIds);for(const id of a.targetIds){let t=unit(id);if(!life(t)||t.hp>=t.maxHp-.000001||distance(u,t)>a.payload.range+.01)t=patients(u).find(p=>!used.has(p.id)&&!reserved.has(p.id)&&p.hp/p.maxHp<=(a.ultimateModifier?.5:.3));if(t&&!used.has(t.id)){used.add(t.id);effect(s,a,t,'heal',a.payload.amount/n,{range:a.payload.range,sourceKind:'special_heal'});}}return;}
  if(a.skillId==='cleanse'){let t=unit(a.targetIds[0]);const eligible=t=>life(t)&&distance(u,t)<=a.payload.range+.01&&statusAdapter?.statusesFor(t.id).some(x=>x.dispellable);if(!eligible(t))t=a.ultimateModifier?game.units.filter(eligible).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||compareIds(a.id,b.id))[0]:null;if(t)effect(s,a,t,'cleanse',0,{range:a.payload.range});return;}
  if(['ward_shield','ward_barrier'].includes(a.skillId)){
   let t=unit(a.targetIds[0]);if(!life(t)||distance(u,t)>a.payload.range+.01||(t.barrier?.amount??0)>=a.payload.amount)t=protectees(u,a.payload.amount)[0];a.grantedIds=[];
   if(t&&effect(s,a,t,'shield',a.payload.amount,{range:a.payload.range,duration:a.payload.duration})>0){a.grantedIds.push(t.id);if(a.skillId==='ward_barrier')statusAdapter?.protect(t.id,{sourceId:u.id,durationTicks:ticks(a.payload.duration)});}
   if(a.skillId==='ward_shield')s.scheduled.push({kind:'ward-second',at:now()+(a.ultimateModifier?1:48),action:a});return;
  }
 }
 function advanceFields(s){const u=unit(s.unitId),f=s.field;if(!f)return;if(!life(u)||now()>=f.until){note(s,f.action.skillId,'expired',{remainingBudget:f.remainingBudget??finite(f.perTick)*finite(f.ticksLeft)});s.field=null;return;}
  if(f.kind==='ember'&&now()>=f.nextTick){const ts=game.enemies.filter(e=>life(e)&&distance(e,f)<=65.01).sort((a,b)=>distance(a,f)-distance(b,f)||compareIds(a.id,b.id)).slice(0,3);for(const t of ts)effect(s,f.action,t,'damage',f.perTick/ts.length,{damageType:'magic',sourceKind:'derived',dot:true});f.ticksLeft--;f.nextTick+=60;if(f.ticksLeft===0)s.field=null;}
  if(f.kind==='frost'){const inside=e=>f.ultimate?Math.abs((e.x-f.x)*(-f.uy)+(e.y-f.y)*f.ux)<=25.01&&Math.abs((e.x-f.x)*f.ux+(e.y-f.y)*f.uy)<=75.01:distance(e,f)<=50.01;const es=game.enemies.filter(e=>life(e)&&inside(e)&&!f.visited.includes(e.id)).sort((a,b)=>distance(a,f)-distance(b,f)||compareIds(a.id,b.id));for(const t of es.slice(0,3-f.visited.length)){f.visited.push(t.id);effect(s,f.action,t,'slow',0,{value:.25,duration:1.25});}if(f.visited.length>=3)s.field=null;}
 }
 function scheduled(s){const u=unit(s.unitId),keep=[];for(const q of s.scheduled){if(!life(u))continue;if(q.kind==='retreat'){if(now()<q.until){original.moveToward(u,q.destination.x,q.destination.y,0,1/60);keep.push(q);}continue;}if(now()<q.at){keep.push(q);continue;}const a=q.action;
   if(q.kind==='salvo-second'){for(let i=0;i<a.targetIds.length;i++){const t=enemy(a.targetIds[i]);if(life(t)&&distance(u,t)<=a.payload.range+.01)effect(s,a,t,'damage',a.payload.amounts[i]/2,{range:a.payload.range,actionType:'basic_attack',enhancedBasic:true});}}
   else if(q.kind==='ward-second'){const t=protectees(u,a.payload.amount).find(t=>!a.grantedIds.includes(t.id));if(t)effect(s,a,t,'shield',a.payload.amount,{range:a.payload.range,duration:a.payload.duration});}
  }s.scheduled=keep;
 }
 const wrappers={
  attack(u,target){const s=state(u);if(s&&!manual){if(locked(s))return false;if(s.classId==='marksman'&&s.aim&&u.attacks%3===2){const t=enemy(s.aim.targetId);if(life(t)&&distance(u,t)<=u.range+.01)target=t;const ultimate=readyUltimate(s)&&(target.publicAttackReadyTick>=now()||target.hp>=shotAmount(u,target,true));if(ultimate){s.ultimateUsed=true;s.ultimateState='consumed';s.shotBonus=game.basicDamage(u,target);s.attackDebt+=u.rate;note(s,'precision_shot','ultimate',{targetId:target.id,borrowedAttackSeconds:u.rate});}s.aim=null;}s.lastBasicTick=now();}
   const result=original.attack(u,target);if(s)s.shotBonus=0;
   if(result&&u.team==='enemy'&&u._v10FrostSeal){const seal=u._v10FrostSeal;delete u._v10FrostSeal;if(now()<seal.until&&life(unit(seal.sourceId))){u._v10PendingRecoveryDebt=finite(u._v10PendingRecoveryDebt)+seal.seconds*game.attackHaste(u);u._v10SealImmuneUntil=now()+ticks(4);journal.push({tick:now(),skillId:'frost_seal',phase:'delay-consumed',targetId:u.id,seconds:seal.seconds,sourceId:seal.sourceId});}}
   return result;
  },
  moveToward(u,...args){if(!manual&&locked(state(u)))return;return original.moveToward(u,...args);},
  castUnitSkill(id,...args){if(states.has(id)&&!manual)return false;return original.castUnitSkill(id,...args);},
  castBarrier(id,...args){if(states.has(id)&&!manual)return false;return original.castBarrier(id,...args);},
  supportHeal(u,...args){if(supported(u)&&!manual)return false;return original.supportHeal(u,...args);},
  hit(u,t,amount,kind,action={}){const s=state(u);if(s?.shotBonus&&action.enhancedBasic&&game.damageActionDepth>0)amount+=s.shotBonus;return original.hit(u,t,amount,kind,action);},
 };
 for(const [name,fn]of Object.entries(wrappers))game[name]=fn;
 const provider={id:'class-heat-veil',candidates({attacker,target,incoming,mitigated,tick,kind,action={}}){if(target.team!=='ally'||!(action.ranged===true||['arrow','mage_bolt','arcane_bolt'].includes(kind)))return [];const out=[];for(const s of states.values()){const f=s.field;if(!f||f.kind!=='heat'||!life(unit(s.unitId))||tick>=f.until||f.remainingBudget<=0)continue;const inside=f.ultimate?Math.abs(target.x-f.x)<=75.01&&Math.abs(target.y-f.y)<=25.01:distance(target,f)<=50.01;if(!inside)continue;const reduction=protectionReduction({incoming,mitigated,remainingBudget:f.remainingBudget,rate:.15});out.push({id:f.action.id,sourceId:s.unitId,targetId:target.id,reduction,consume:(effective=reduction)=>{f.remainingBudget=Math.max(0,f.remainingBudget-effective);note(s,'heat_veil','protection',{targetId:target.id,prevented:effective});}});}return out;}};
 game._v10ProtectionProviders??=[];game._v10ProtectionProviders.push(provider);
 function view(){return [...states.values()].sort((a,b)=>compareIds(a.unitId,b.unitId)).map(s=>({unitId:s.unitId,secondClassId:s.classId,classStage:s.tier,name:SECOND_CLASSES[s.classId].name,basicSkillIds:[...SECOND_CLASSES[s.classId].skillIds],ultimateId:s.tier===3?SECOND_CLASSES[s.classId].ultimateId:null,ultimateState:s.ultimateState,holdReason:ultimateMode==='independent-foundation'&&s.tier===3?'independent-action-owner':!life(unit(s.unitId))?'source-dead':s.tier<3?'not-awakened':s.ultimateUsed?'already-used':now()<300?'charging':locked(s)?'action-in-progress':'awaiting-eligible-skill-condition',action:s.action?{skillId:s.action.skillId,resolveTick:s.action.resolveTick,recoveryUntil:s.action.recoveryUntil}:null,secondReadyTick:s.cooldowns.second}));}
 function snapshot(){return {version:CLASS_COMBAT_VERSION,battleId:game.battleId,states:[...states.values()].map(copy),journal:copy(journal),receipts:[...receipts.values()].map(copy),lastBefore,lastAfter};}
 function restoreSnapshot(data){if(data.version!==CLASS_COMBAT_VERSION||data.battleId!==game.battleId||data.states.length!==states.size)throw Error('Mismatched class snapshot');for(const s of data.states){const existing=states.get(s.unitId);if(!existing||existing.classId!==s.classId||existing.tier!==s.tier)throw Error('Mismatched class snapshot identity');}for(const s of data.states)states.set(s.unitId,copy(s));journal.splice(0,journal.length,...copy(data.journal));receipts.clear();for(const r of data.receipts)receipts.set(r.eventId,copy(r));lastBefore=data.lastBefore;lastAfter=data.lastAfter;}
 const participant={id:'class-combat',capture:snapshot,restore:restoreSnapshot};game._v10CheckpointParticipants??=[];game._v10CheckpointParticipants.push(participant);
 function beforeTickImpl(){if(disposed)throw Error('Disposed class adapter');if(game.phase!=='battle')return;if(now()===lastBefore)return;if(now()<lastBefore)throw Error('Nonmonotonic class tick');lastBefore=now();publishBasicTelegraphs();
  for(const e of game.enemies)if(e._v10FrostSeal&&(!life(unit(e._v10FrostSeal.sourceId))||e._v10FrostSeal.until<=now()))delete e._v10FrostSeal;
  for(const s of [...states.values()].sort((a,b)=>compareIds(a.unitId,b.unitId))){const u=unit(s.unitId);if(!life(u)){if(s.action)settlePaid(s,s.action,'source-ended');s.action=null;s.field=null;s.scheduled=[];s.aim=null;s.ultimateState='consumed';s.ended=true;continue;}if(ultimateMode==='legacy-modifier'&&s.tier===3&&!s.ultimateUsed&&now()>=300)s.ultimateState='armed';if(s.aim&&s.aim.untilTick<=now())s.aim=null;
   scheduled(s);if(s.action&&s.action.resolveTick<=now()){const a=s.action;complete(s,a);if(!a.spellSuccess)settlePaid(s,a,'no-effect');}advanceFields(s);
   if(!locked(s)){s.frozenCd=null;candidate(s);}s.freezeThisTick=locked(s);s.lockedPosition=s.freezeThisTick&&!s.scheduled.some(q=>q.kind==='retreat')?{x:u.x,y:u.y}:null;if(s.freezeThisTick&&s.frozenCd===null)s.frozenCd=Math.max(0,u.cd);
  }
 }
 function beforeTick(){return paidLifecycle?paidLifecycle.atomic(beforeTickImpl):beforeTickImpl();}
 function afterTickImpl(){if(disposed)throw Error('Disposed class adapter');if(now()===lastAfter)return;if(now()<lastAfter)throw Error('Nonmonotonic class tick');lastAfter=now();
  for(const s of states.values()){const u=unit(s.unitId);if(s.freezeThisTick&&s.frozenCd!==null&&life(u))u.cd=Math.max(u.cd,s.frozenCd);if(s.lockedPosition&&life(u)){u.x=s.lockedPosition.x;u.y=s.lockedPosition.y;u.move=0;}if(s.attackDebt){u.cd+=s.attackDebt;s.attackDebt=0;}if(game.phase!=='battle'){if(s.action)settlePaid(s,s.action,'battle-ended');s.action=null;s.field=null;s.scheduled=[];s.ultimateState='consumed';s.ended=true;}}
  for(const e of game.enemies)if(e._v10PendingRecoveryDebt){e.cd+=e._v10PendingRecoveryDebt;delete e._v10PendingRecoveryDebt;}
 }
 function afterTick(){return paidLifecycle?paidLifecycle.atomic(afterTickImpl):afterTickImpl();}
 function dispose(){for(const [name,fn]of Object.entries(wrappers))if(game[name]===fn)game[name]=original[name];game._v10ProtectionProviders=game._v10ProtectionProviders.filter(x=>x!==provider);game._v10CheckpointParticipants=game._v10CheckpointParticipants.filter(x=>x!==participant);delete game._v10ClassCombat;disposed=true;}
 const api={beforeTick,afterTick,snapshot,view,restore:restoreSnapshot,dispose,states:()=>copy([...states.values()]),journal:()=>copy(journal),capabilities:{secondClassIds:[...CLASS_COMBAT_IDS],statusSkills:!!statusAdapter,heatProtectionPipeline:!!game._v10PipelineInstalled}};game._v10ClassCombat=api;if(restore)restoreSnapshot(restore);return api;
}
