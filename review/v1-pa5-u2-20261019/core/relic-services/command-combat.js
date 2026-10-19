// Per-battle command consumer. Base hit/attack bodies below are adapted from
// exact pinned v09 game-engine.js SHA256 6e6913f166527fc031fc270320cadcf5fcbb8e914883903ef360215a1b872f20.
// Only mutable per-instance methods change. Vendor bytes and old profiles do not.
import {assert,clone,canonical} from './registry.js';
import {RESEARCH_VERSION,normalizeResearch,projectCommands} from './strategy.js';
export const COMMAND_COMBAT_VERSION='v10-command-combat-candidate-1';
const STEP=1/60,finite=(x,f=0)=>Number.isFinite(x)?x:f,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),ticksFor=n=>Math.ceil(n/STEP-1e-9),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createCommandResearchAdapter(game,{content,research}={}){
 assert(game?.phase==='battle'&&content&&typeof content.getRelicEffects==='function','Command adapter requires started v09 battle and content');
 assert(!game._v10CommandAdapter&&!game._v10PipelineInstalled,'Install command adapter once, before protection pipeline');
 const frozen=normalizeResearch(research),commands=projectCommands(content,content,{relics:game.relics,skills:game.skills,research:frozen});
 const originalState=game.getSkillState;
 game.relicEffects.commandSkills=clone(commands);
 game.commandGuardReduction=function(target){return target?.team==='ally'&&this.tickCount<target.guardUntilTick?commands.guard.power:0;};
 game.commandBasicBonus=function(unit,target){return unit?.team==='ally'&&target&&this.focusTarget()===target?Math.min(commands.focus.power,Math.max(0,.35-finite(unit.basicDamageBonus))):0;};
 game.basicDamage=function(unit,target){return unit.attackPower*unit.conditionMultiplier*(1+finite(unit.basicDamageBonus)+this.commandBasicBonus(unit,target));};
 game.attackHaste=function(unit){const gain=unit.team==='ally'?finite(unit.attackSpeedBonus)+(this.tickCount<unit.rallyUntilTick?commands.rally.power:0)+(this.tickCount<unit.whistleUntilTick?finite(this.relicEffects.whistleHaste):0):0;return (1+clamp(gain,0,.5))*finite(unit.attackFrequencyCostFactor,1)/finite(unit.attackIntervalCostFactor,1)*(1-this.activeSlow(unit));};
 game.getSkillState=function(id){const old=originalState.call(this,id);if(!old)return old;const spec=commands[id];if(id==='rally'&&spec.variantId==='charge_signal'&&!this.alive('ally').some(u=>content.familyOf(u.type)==='spear'))old.canCast=false;return {...old,name:spec.name,variantId:spec.variantId,power:spec.power,target:spec.target,candidateBalance:true};};
 game.castSkill=function(id,targetId){
  const state=this.getSkillState(id);if(!state?.canCast)return false;
  const spec=commands[id],allies=this.alive('ally');let target=null;
  if(id==='focus'){target=this.enemies.find(u=>u.id===targetId&&u.hp>0);if(!target)return false;}
  const expires=this.tickCount+ticksFor(spec.duration),effectStart=this.effects.length;
  if(id==='heal'){
   const patients=spec.variantId==='focused_treatment'?[...allies].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id).slice(0,1):allies;
   let healed=0;for(const unit of patients)healed+=this.heal(unit,unit.maxHp*spec.power);
   if(healed<=0)return false;this.skillHealing+=healed;
  }else if(id==='guard'){for(const unit of allies){unit.guardUntilTick=expires;this.effect('ring',unit.x,unit.y,0,0,'#87bad0',.8);}}
  else if(id==='focus'){this.focusTargetId=target.id;this.focusUntilTick=expires;this.effect('ring',target.x,target.y,0,0,'#efb652',.8);}
  else if(id==='rally'){
   const recipients=spec.variantId==='charge_signal'?allies.filter(u=>content.familyOf(u.type)==='spear'):allies;
   if(!recipients.length)return false;for(const unit of recipients){unit.rallyUntilTick=expires;this.effect('ring',unit.x,unit.y,0,0,'#e4c568',.8);}this.rallyUsed=true;this.rallyUntil=expires*STEP;
  }else return false;
  for(let i=effectStart;i<this.effects.length;i++)Object.assign(this.effects[i],{skillId:id,variantId:spec.variantId,ownerKind:'commander',actionType:'commander_skill',effectKind:id==='heal'?'heal':id==='guard'?'protection':id==='rally'?'haste':'focus',damageType:'none'});
  this.skillReadyTicks[id]=this.tickCount+ticksFor(spec.cooldown);this.skillCasts[id]++;
  this.inputLog.push({battleId:this.battleId,tick:this.tickCount,sequence:this.inputLog.length+1,skillId:id,targetId:target?.id??null});this.message=spec.name+'!';return true;
 };
 game.hit=commandHit;
 game.attack=commandAttack;
 game._v10CommandAdapter={version:COMMAND_COMBAT_VERSION};
 const checkpoint={version:COMMAND_COMBAT_VERSION,research:clone(frozen),commands:clone(commands)};
 game._v10CheckpointParticipants??=[];
 game._v10CheckpointParticipants.push({id:'command-research-context',capture:()=>clone(checkpoint),restore:saved=>assert(canonical(saved)===canonical(checkpoint),'Command research checkpoint context mismatch')});
 return {version:COMMAND_COMBAT_VERSION,snapshot:()=>({version:COMMAND_COMBAT_VERSION,researchVersion:RESEARCH_VERSION,research:clone(frozen),commands:clone(commands)})};
}

function commandHit(attacker,target,amount,kind='hit',action={}){
  if(!attacker||attacker.hp<=0||!target||target.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
  if(!this.damageActionDepth)return this.resolveDamageAction(()=>this.hit(attacker,target,amount,kind,action));
  const conditions={preparedDuration:10,preparedDamageBonus:.1},prepared=attacker.team==='ally'&&this.prepared&&this.tickCount<ticksFor(finite(conditions.preparedDuration,10))?1+finite(conditions.preparedDamageBonus,.1):1;
  const incoming=amount*(this.time>60?1+(this.time-60)/30:1)*prepared,H=target.hp,link=target.team==='ally'&&this.actionGuardianLinks[target.id]||{sourceId:null,value:0},temporary=this.tickCount<target.temporaryDefenseUntilTick?target.temporaryDefense:0;
  const ownDefense=this.effectiveDefense(target,0,temporary),effectiveDefense=this.effectiveDefense(target,link.value,temporary),P=this.commandGuardReduction(target);
  const own=incoming*Math.max(.45,100/(100+ownDefense)*(1-P)),mitigated=incoming*Math.max(.45,100/(100+effectiveDefense)*(1-P));
  if(target.barrier&&this.tickCount>=target.barrier.untilTick)this.expireBarrier(target);
  const absorbed=target.barrier?Math.min(target.barrier.amount,mitigated):0,remaining=Math.max(0,mitigated-absorbed),actual=Math.min(H,remaining);
  const credit=(u,key,value)=>{if(u&&value>0){u.stats[key]=finite(u.stats[key])+value;u.career[key]=finite(u.career[key])+value}};
  credit(target,'blocked',Math.min(H,incoming)-Math.min(H,own));credit(this.units.find(u=>u.id===link.sourceId),'blocked',Math.min(H,own)-Math.min(H,mitigated));
  if(target.barrier){const source=this.units.find(u=>u.id===target.barrier.ownerId);credit(source,'barrierAbsorbed',absorbed);credit(source,'blocked',Math.min(H,mitigated)-Math.min(H,remaining));target.barrier.amount-=absorbed;if(target.barrier.amount<=1e-9)target.barrier=null}
  target.hp=Math.max(0,H-actual);target.flash=.16;credit(target,'damageTaken',actual);credit(attacker,'damage',actual);credit(attacker,'overkill',Math.max(0,remaining-H));if(attacker.team==='ally')this.damageDealt+=actual;
  if(target.team==='ally')this.minHpRatio=Math.min(this.minHpRatio,this.measureHP());
  this.effect(kind,attacker.x,attacker.y-10,target.x,target.y-10,attacker.team==='ally'?'#f6bd6c':'#bd6250',['arrow','mage_bolt','arcane_bolt','fire_bolt','frost_bolt'].includes(kind)?.3:.15);
  Object.assign(this.effects[this.effects.length-1],{ownerKind:action.ownerKind||'unit',actionType:action.actionType||'basic_attack',effectKind:'damage',damageType:action.damageType||'physical',canCrit:action.canCrit===true,enhancedBasic:action.enhancedBasic===true,sourceId:attacker.id,targetId:target.id});
  if(target.hp<=0){credit(attacker,'kills',1);target.guardUntilTick=0;target.rallyUntilTick=0;target.whistleUntilTick=0;target.barrier=null;if(target.id===this.focusTargetId){this.focusTargetId=null;this.focusUntilTick=0}if(target.team==='ally'&&!this.whistleTriggered&&this.relicEffects.whistleHaste>0){this.whistleTriggered=true;const until=this.tickCount+ticksFor(this.relicEffects.whistleDuration||6);for(const u of this.alive('ally'))u.whistleUntilTick=until}this.effect('fall',target.x,target.y,0,0,'#7e7466',.7)}
  return actual;
 }
function commandAttack(u,target){
  if(!u||u.hp<=0||!target||target.hp<=0||distance(u,target)>u.range+.01)return false;const enemyTeam=u.team==='ally'?'enemy':'ally';let targets=[target];
  if(u.type==='volley'){targets=this.alive(enemyTeam).filter(e=>distance(u,e)<=u.range+.01).sort((a,b)=>distance(a,u)-distance(b,u)||a.id-b.id);const focus=u.team==='ally'?this.focusTarget():null;if(focus&&targets.includes(focus)){targets.splice(targets.indexOf(focus),1);targets.unshift(focus)}else if(targets.includes(target)){targets.splice(targets.indexOf(target),1);targets.unshift(target)}targets=targets.slice(0,u.maxTargets||3)}
  if(!targets.length)return false;u.attacks++;const enhanced=u.type==='sniper'&&u.attacks%3===0,critical=u.team==='ally'&&!enhanced?this.criticalMultiplier(u):1;
  this.resolveDamageAction(()=>{targets.forEach((e,i)=>{let damage=this.basicDamage(u,e);if(enhanced){const s=u.skill||{};damage=(u.attackPower*finite(s.attackCoefficient,1)+u.abilityPower*finite(s.coefficient,1.8))*u.conditionMultiplier*(1+finite(u.basicDamageBonus)+this.commandBasicBonus(u,e))}if(u.type==='archer'&&u.attacks===1)damage*=finite(u.firstAttackMultiplier,1);if(u.type==='volley')damage*=i?finite(u.secondaryMultiplier,1):finite(u.primaryMultiplier,1);this.hit(u,e,damage*critical,['mage','pyromancer','frostmage'].includes(u.type)?'mage_bolt':u.range>100?'arrow':'hit',{actionType:'basic_attack',damageType:['mage','pyromancer','frostmage'].includes(u.type)?'magic':'physical',canCrit:!enhanced,enhancedBasic:enhanced})})});return true;
 }
