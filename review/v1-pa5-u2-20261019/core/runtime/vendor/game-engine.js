/* Independent fixed-step simulation; also loaded directly by the included Node tests. */
(()=>{'use strict';
const STEP=1/60, LIMIT=110, CAP=12;
const TRAINING=Object.freeze({max:2,hp:.18,damage:.16,heal:.14,spellPower:.15,maxMana:5});
const LEGACY_RULES='v05-combat-1',NEW_RULES='v08-combat-1';
const emptyStats=()=>({damage:0,healing:0,blocked:0,damageTaken:0,kills:0});
const TYPES={
 mage:{name:'마법사',hp:100,damage:5,range:220,rate:3,speed:34,heal:0,spellPower:20,maxMana:40,startingMana:40,manaRegen:3,skill:{id:'arcane_bolt',coefficient:1.5,manaCost:20,cooldown:6},color:'#8276b3',role:'mage'},
 spear:{name:'창병',hp:190,damage:12,range:47,rate:2.1,speed:40,color:'#327b75',role:'spear'},
 archer:{name:'궁수',hp:100,damage:16,range:220,rate:2.7,speed:35,color:'#7b8652',role:'archer'},
 support:{name:'지원병',hp:115,damage:4,range:170,rate:3,speed:34,heal:15,healRange:220,color:'#d2b067',role:'support'},
 guardian:{name:'방벽병',hp:370,damage:17,range:53,rate:2.1,speed:34,armor:.28,color:'#317981',role:'spear'},
 charger:{name:'돌격병',hp:285,damage:25,range:55,rate:1.9,speed:48,color:'#ce824f',role:'spear'},
 sniper:{name:'저격수',hp:145,damage:37,range:340,rate:2.9,speed:35,color:'#5d7775',role:'archer'},
 volley:{name:'연사수',hp:150,damage:15,range:255,rate:2.2,speed:36,color:'#8b8351',role:'archer'},
 raider:{name:'잿빛 보병',hp:110,damage:8,range:44,rate:2.4,speed:30,color:'#a56b58',role:'raider'},
 bow:{name:'잿빛 궁수',hp:85,damage:10,range:220,rate:3.1,speed:26,color:'#8c6c75',role:'bow'},
 armored:{name:'철갑 방패병',hp:170,damage:10,range:48,rate:3,speed:23,armorFlat:6,color:'#69717a',role:'armored'},
 swarm:{name:'잿빛 잔병',hp:38,damage:4,range:38,rate:1.9,speed:42,color:'#ae8060',role:'swarm'},
 brute:{name:'바위 방패병',hp:205,damage:12,range:51,rate:3.1,speed:24,armor:.15,color:'#886f66',role:'brute'},
 boss:{name:'잿빛 파수꾼',hp:1020,damage:26,range:70,rate:3.2,speed:19,armor:.12,color:'#725b60',role:'boss'}
};
const STAGES=[
 {name:'풀잎 평원',description:'작은 방패 세 개. 원정은 여기서 시작됩니다.',enemies:['raider','raider','bow'],scale:1,tip:'창병은 전열, 궁수와 지원병은 후열에서 시작해 보세요.'},
 {name:'오래된 돌길',description:'철갑 방패 뒤로 적의 화살이 날아옵니다.',enemies:['armored','raider','bow','bow'],scale:1.02,tip:'철갑은 타격당 피해를 최대 6 줄여요. 저격수의 강한 단발에서는 감소 비중이 작아요.'},
 {name:'바람의 언덕',description:'약하지만 빠른 잔병들이 무리를 이루어 몰려옵니다.',enemies:['swarm','swarm','swarm','swarm','swarm','swarm','swarm','bow','bow'],scale:1.12,tip:'연사수는 최대 3명을 동시에, 돌격병은 주기적으로 범위 안의 적들을 공격해요.'},
 {name:'무너진 성문',description:'철갑 방패병과 강타를 쓰는 방패병이 성문을 지킵니다.',enemies:['armored','armored','brute','bow','bow'],scale:1.10,tip:'철갑에는 강한 단발을, 붉은 강타 범위에는 방벽병의 보호와 회복을 준비해 보세요.'},
 {name:'잿빛 전초기지',description:'단단한 방패와 잔병 무리가 함께 길을 막습니다.',enemies:['armored','brute','swarm','swarm','swarm','swarm','bow','bow'],scale:1.20,tip:'철갑을 상대할 강한 공격과 잔병을 상대할 다중 공격을 함께 준비해 보세요.'},
 {name:'마지막 파수꾼',description:'파수꾼과 철갑 호위, 잔병 무리가 원정의 끝을 지킵니다.',enemies:['boss','armored','swarm','swarm','swarm','bow'],scale:1,tip:'파수꾼의 넓은 붉은 원은 강타 예고예요. 사기 진작은 쓰러지기 전에 사용하세요.'}
];
const ALLY_TYPES=Object.freeze(['spear','archer','support','guardian','charger','sniper','volley','mage']);
const SKILLS=Object.freeze({
 heal:Object.freeze({id:'heal',name:'응급 회복',cooldown:24,duration:0}),
 guard:Object.freeze({id:'guard',name:'수호 진형',cooldown:20,duration:4}),
 focus:Object.freeze({id:'focus',name:'집중 사격',cooldown:18,duration:6}),
 rally:Object.freeze({id:'rally',name:'사기 고양',cooldown:26,duration:5})
});
const RARITIES=['common','uncommon','rare','epic','legendary'];
const ROWS=['front','mid','back'];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const ticksFor=seconds=>Math.ceil(Math.max(0,seconds)/STEP-1e-9);
const clone=value=>JSON.parse(JSON.stringify(value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const NO_RELICS=Object.freeze({hpBonus:0,spearDamageBonus:0,spearReduction:0,supportHealBonus:0,whistleHaste:0,whistleDuration:6,rallyDurationBonus:0,rallyCooldownPenalty:0,skillCdr:0});

// Standalone fallback mirrors the content contract. The content module owns live balance data.
function relicEffects(relics,skills,version=LEGACY_RULES){
 const content=globalThis.TinyArmyContent;
 if(content&&typeof content.getRelicEffects==='function'){const effects={...NO_RELICS,...content.getRelicEffects(relics,skills)};if(version===LEGACY_RULES)for(const key of ['critChance','critDamageBonus','mageSpellPowerBonus','mageSkillDamageBonus'])delete effects[key];return effects;}
 const effects={...NO_RELICS};
 const tables={banner:['hpBonus',[.08,.10,.12,.14,.20]],seal:['spearReduction',[.06,.07,.085,.10,.14]],spear_tip:['spearDamageBonus',[.12,.15,.19,.24,.36]],medic:['supportHealBonus',[.16,.20,.24,.28,.40]],whistle:['whistleHaste',[.15,.18,.21,.24,.32]],drum:['rallyDurationBonus',[1,1.2,1.4,1.6,2.4]]};
 for(const relic of relics){if(relic.id==='keen_eye'||relic.id==='arcane_lens'){const i=RARITIES.indexOf(relic.rarity),mult=relic.rarity!=='legendary'&&relic.stacks===2?1.25:1;if(relic.id==='keen_eye'){effects.critChance=([.08,.10,.12,.14,.18][i]||0)*mult;effects.critDamageBonus=([.15,.18,.21,.24,.32][i]||0)*mult}else{effects.mageSpellPowerBonus=([.15,.18,.21,.24,.32][i]||0)*mult;effects.mageSkillDamageBonus=([.10,.12,.14,.16,.21][i]||0)*mult}continue}if(relic.id==='drum'&&!skills.includes('rally'))continue;const table=tables[relic.id];if(!table)continue;const i=RARITIES.indexOf(relic.rarity),mult=relic.rarity!=='legendary'&&relic.stacks===2?1.25:1;effects[table[0]]+=table[1][i]*mult;if(relic.id==='drum')effects.rallyCooldownPenalty=0}
 return effects;
}
function normalizeRelics(items,version=LEGACY_RULES){
 const result=[];
 for(const item of Array.isArray(items)?items:[]){
  if(!item||![ 'banner','seal','spear_tip','medic','whistle','drum',...(version===NEW_RULES?['keen_eye','arcane_lens']:[])].includes(item.id))continue;
  const rarity=RARITIES.includes(item.rarity)?item.rarity:'common';
  const next={id:item.id,rarity,stacks:rarity==='legendary'?1:clamp(Math.floor(finite(item.stacks,1)),1,2)};
  const index=result.findIndex(r=>r.id===next.id);
  if(index<0){if(result.length<3)result.push(next);continue}
  const old=result[index];
  // Malformed duplicate equipment never applies twice. A higher tier replaces, not adds.
  if(RARITIES.indexOf(next.rarity)>RARITIES.indexOf(old.rarity))result[index]=next;
  else if(next.rarity===old.rarity&&next.rarity!=='legendary')old.stacks=Math.max(old.stacks,next.stacks);
 }
 return result;
}

class Game{
 constructor(seed=417){this.reset(seed)}
 initialize(seed=417){
  this.seed=seed>>>0;this.initialSeed=this.seed;this.nextId=1;this.stage=0;this.phase='prepare';
  this.combatRulesVersion=LEGACY_RULES;
  this.externalMode=false;this.battleId=null;this.encounter=null;this.prepared=false;
  this.units=[];this.enemies=[];this.effects=[];this.telegraphs=[];this.time=0;this.totalTime=0;this.tickCount=0;
  this.rallyUsed=false;this.rallyUntil=0;this.rewardTaken=false;this.history=[];this.lastResult=null;
  this.damageDealt=0;this.healingDone=0;this.minHpRatio=1;this.rallyHealing=0;this.skillHealing=0;this.enemySlams=0;
  this.relics=[];this.relicEffects={...NO_RELICS};this.skills=['heal','guard'];
  this.skillReadyTicks={heal:0,guard:0,focus:0,rally:0};this.skillCasts={heal:0,guard:0,focus:0,rally:0};
  this.focusTargetId=null;this.focusUntilTick=0;this.whistleTriggered=false;this.inputLog=[];
 }
 reset(seed=417){
  this.initialize(seed);this.message='전장의 아군을 눌러 배치를 정한 뒤 출발하세요.';
  this.spawn('spear','front');this.spawn('archer','back');this.spawn('support','back');this.preview();return this;
 }
 configureBattle(config={}){
  if(this.phase==='battle'||!config||typeof config!=='object')return false;
  const roster=config.roster,encounter=config.encounter,version=config.combatRulesVersion===undefined?LEGACY_RULES:config.combatRulesVersion;
  if(![LEGACY_RULES,NEW_RULES].includes(version))return false;
  if(config.seed!==undefined&&(!Number.isInteger(config.seed)||config.seed<0||config.seed>0xffffffff))return false;
  if(!Array.isArray(roster)||!roster.length||roster.length>CAP||!encounter||!Array.isArray(encounter.enemies)||!encounter.enemies.length||encounter.enemies.length>60)return false;
  const ids=new Set(),slots=new Set();
  for(const u of roster){
   if(!u||!Number.isSafeInteger(u.id)||u.id<1||u.id>1000000||!ALLY_TYPES.includes(u.type)||(version===LEGACY_RULES&&u.type==='mage')||ids.has(u.id)||!Number.isInteger(u.slot)||u.slot<0||u.slot>=CAP||slots.has(u.slot))return false;
   if(u.training!==undefined&&(!Number.isInteger(u.training)||u.training<0||u.training>TRAINING.max))return false;
   if(u.condition!==undefined&&(!Number.isFinite(u.condition)||u.condition<0||u.condition>100))return false;
   ids.add(u.id);slots.add(u.slot);
  }
  for(const entry of encounter.enemies){const type=typeof entry==='string'?entry:entry&&entry.type;if(!TYPES[type]||ALLY_TYPES.includes(type))return false;if(typeof entry==='object'&&entry.scale!==undefined&&(!Number.isFinite(entry.scale)||entry.scale<=0||entry.scale>20||(encounter.scale||1)*entry.scale>20))return false}
  if(encounter.scale!==undefined&&(!Number.isFinite(encounter.scale)||encounter.scale<=0||encounter.scale>20))return false;
  const skills=config.skills===undefined?['heal','guard']:config.skills;
  if(!Array.isArray(skills)||skills.length!==2||new Set(skills).size!==2||skills.some(id=>!SKILLS[id]))return false;
  this.initialize(config.seed===undefined?417:config.seed);
  this.combatRulesVersion=version;
  this.externalMode=true;this.battleId=config.battleId||null;this.encounter=clone(encounter);this.prepared=config.prepared===true;
  this.stage=Math.max(0,finite(encounter.row));this.skills=skills.slice();this.relics=normalizeRelics(config.relics,version);this.relicEffects=relicEffects(this.relics,this.skills,version);
  this.nextId=Math.max(0,...roster.map(u=>u.id))+1;
  this.units=roster.map(entry=>{const u=this.make(entry.type,'ally',ROWS[Math.floor(entry.slot/4)]);u.id=entry.id;u.slot=entry.slot;u.training=entry.training||0;u.condition=entry.condition===undefined?100:entry.condition;this.applyGrowth(u);return u});
  this.preview();this.message=encounter.description||'배치와 지휘 스킬을 확인한 뒤 출발하세요.';return this;
 }
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296}
 spawn(type,row='back'){
  if(this.phase==='battle'||this.units.length>=CAP||!ALLY_TYPES.includes(type)||(this.combatRulesVersion===LEGACY_RULES&&type==='mage'))return null;
  const u=this.make(type,'ally',row);const preferred=ROWS.indexOf(row)*4;
  u.slot=Array.from({length:CAP},(_,i)=>(Math.max(0,preferred)+i)%CAP).find(slot=>!this.units.some(v=>v.slot===slot));
  this.applyGrowth(u);this.units.push(u);return u;
 }
 make(type,team,row='front',scale=1){
  const t=TYPES[type];if(!t)return null;const initialCd=.3+this.random()*1.2;
  return{id:this.nextId++,type,team,row,hp:t.hp*scale,maxHp:t.hp*scale,damage:t.damage*scale,x:0,y:0,cd:initialCd,initialCd,healCd:2,skillCd:type==='charger'?2:8,flash:0,attacks:0,scale,move:0,training:0,condition:100,conditionMultiplier:1,heal:t.heal||0,healRange:t.healRange||0,guardUntilTick:0,rallyUntilTick:0,whistleUntilTick:0,stats:emptyStats(),career:emptyStats()};
 }
 preview(){
  const encounter=this.externalMode?this.encounter:STAGES[this.stage];if(!encounter)return false;
  this.enemies=encounter.enemies.map((entry,index)=>{const type=typeof entry==='string'?entry:entry.type,scale=(encounter.scale||1)*(typeof entry==='object'?(entry.scale||1):1);const u=this.make(type,'enemy',TYPES[type].range>100?'back':'front',scale);u.encounterIndex=index;return u});
  this.position(this.units);this.position(this.enemies);this.effects=[];this.telegraphs=[];return true;
 }
 position(list){
  if(this.externalMode&&list===this.units){for(const u of list){u.row=ROWS[Math.floor(u.slot/4)];u.x=[330,260,190][Math.floor(u.slot/4)];u.y=180+(u.slot%4)*80;this.resetUnitBattleState(u)}return}
  for(const row of ROWS){const group=list.filter(u=>u.row===row);group.forEach((u,i)=>{u.x=u.team==='ally'?(row==='front'?330:row==='mid'?260:190):(row==='front'?645:row==='mid'?700:755);u.y=150+(i+1)*300/(group.length+1);this.resetUnitBattleState(u)})}
 }
 resetUnitBattleState(u){u.hp=u.maxHp;u.cd=u.initialCd;u.healCd=2;u.skillCd=u.type==='charger'?2:8;u.attacks=0;u.flash=0;u.move=0;u.guardUntilTick=0;u.rallyUntilTick=0;u.whistleUntilTick=0;if(this.combatRulesVersion===NEW_RULES&&u.type==='mage'){u.mana=Math.min(u.maxMana,u.startingMana);u.unitSkillReadyTick=0}}
 setSlot(id,slot){
  if(this.phase!=='prepare'||!Number.isInteger(slot)||slot<0||slot>=CAP)return false;
  const unit=this.units.find(u=>u.id===id);if(!unit)return false;
  const other=this.units.find(u=>u.slot===slot&&u!==unit);if(other){other.slot=unit.slot;other.row=ROWS[Math.floor(other.slot/4)]}
  unit.slot=slot;unit.row=ROWS[Math.floor(slot/4)];this.position(this.units);return true;
 }
 setRow(id,row){
  if(this.phase!=='prepare'||!ROWS.includes(row))return false;const u=this.units.find(u=>u.id===id);if(!u)return false;
  if(this.externalMode){const start=ROWS.indexOf(row)*4;const slot=[start,start+1,start+2,start+3].find(s=>!this.units.some(v=>v.slot===s));return this.setSlot(id,slot===undefined?start:slot)}
  u.row=row;this.position(this.units);return true;
 }
 start(){
  if(this.phase!=='prepare'||!this.units.length||!this.enemies.length)return false;
  this.position(this.units);this.position(this.enemies);this.phase='battle';this.time=0;this.tickCount=0;
  this.rallyUsed=false;this.rallyUntil=0;this.minHpRatio=1;this.rallyHealing=0;this.skillHealing=0;this.enemySlams=0;this.damageDealt=0;this.healingDone=0;
  this.skillReadyTicks={heal:0,guard:0,focus:0,rally:0};this.skillCasts={heal:0,guard:0,focus:0,rally:0};this.inputLog=[];this.focusTargetId=null;this.focusUntilTick=0;this.whistleTriggered=false;
  this.effects=[];this.telegraphs=[];this.lastResult=null;for(const u of [...this.units,...this.enemies])u.stats=emptyStats();this.message='군단이 전진합니다';return true;
 }
 skillCooldown(id){const spec=SKILLS[id];if(!spec)return 0;return ticksFor(spec.cooldown*(1-clamp(finite(this.relicEffects.skillCdr),0,.2))+(id==='rally'?Math.max(0,finite(this.relicEffects.rallyCooldownPenalty)):0))*STEP}
 skillDuration(id){return SKILLS[id]?ticksFor(SKILLS[id].duration+(id==='rally'?Math.max(0,finite(this.relicEffects.rallyDurationBonus)):0))*STEP:0}
 getSkillState(id){
  const spec=SKILLS[id];if(!spec)return null;const equipped=this.skills.includes(id),remaining=Math.max(0,(this.skillReadyTicks[id]-this.tickCount)*STEP),ready=remaining===0;
  const allies=this.alive('ally');let valid=allies.length>0;if(id==='heal')valid=allies.some(u=>u.hp<u.maxHp-1e-9);if(id==='focus')valid=this.alive('enemy').length>0;
  const active=id==='focus'?!!this.focusTarget():id==='guard'?allies.some(u=>this.tickCount<u.guardUntilTick):id==='rally'?allies.some(u=>this.tickCount<u.rallyUntilTick):false;
  return{id,name:spec.name,equipped,ready,cooldown:this.skillCooldown(id),remaining,duration:this.skillDuration(id),active,canCast:this.phase==='battle'&&equipped&&ready&&valid,targetId:id==='focus'?this.focusTargetId:null,readyTick:this.skillReadyTicks[id]};
 }
 skillState(){return this.skills.map(id=>this.getSkillState(id))}
 castSkill(id,targetId){
  const state=this.getSkillState(id);if(!state||!state.canCast)return false;
  const allies=this.alive('ally');let target=null;
  if(id==='focus'){target=this.enemies.find(u=>u.id===targetId&&u.hp>0);if(!target)return false}
  const expires=this.tickCount+ticksFor(this.skillDuration(id)),effectStart=this.effects.length;
  if(id==='heal'){let healed=0;for(const u of allies)healed+=this.heal(u,u.maxHp*.15);if(healed<=0)return false;this.skillHealing+=healed}
  else if(id==='guard')for(const u of allies){u.guardUntilTick=expires;this.effect('ring',u.x,u.y,0,0,'#87bad0',.8)}
  else if(id==='focus'){this.focusTargetId=target.id;this.focusUntilTick=expires;this.effect('ring',target.x,target.y,0,0,'#efb652',.8)}
  else if(id==='rally'){for(const u of allies){u.rallyUntilTick=expires;this.effect('ring',u.x,u.y,0,0,'#e4c568',.8)}this.rallyUsed=true;this.rallyUntil=expires*STEP}
  for(let i=effectStart;i<this.effects.length;i++)this.effects[i].skillId=id;
  this.skillReadyTicks[id]=this.tickCount+ticksFor(state.cooldown);this.skillCasts[id]++;
  this.inputLog.push({battleId:this.battleId,tick:this.tickCount,sequence:this.inputLog.length+1,skillId:id,targetId:target?target.id:null});this.message=SKILLS[id].name+'!';return true;
 }
 // Compatibility alias: the retired combined heal + haste action is never retained.
 rally(){return this.castSkill('rally')}
 focusTarget(){return this.tickCount<this.focusUntilTick?this.enemies.find(u=>u.id===this.focusTargetId&&u.hp>0)||null:null}
 attackHaste(u){if(u.team!=='ally')return 1;return 1+clamp((this.tickCount<u.rallyUntilTick?.25:0)+(this.tickCount<u.whistleUntilTick?Math.max(0,finite(this.relicEffects.whistleHaste)):0),0,.5)}
 alive(team){return(team==='ally'?this.units:this.enemies).filter(u=>u.hp>0)}
 effect(kind,x,y,tx=0,ty=0,color='#fff',life=.35,text=''){this.effects.push({kind,x,y,tx,ty,color,life,max:life,text})}
 heal(u,n,source=null){
  if(!u||u.hp<=0||!Number.isFinite(n))return 0;
  const amount=Math.min(Math.max(0,n),Math.max(0,u.maxHp-u.hp));if(amount<=0)return 0;
  u.hp+=amount;this.healingDone+=amount;if(source){source.stats.healing+=amount;source.career.healing+=amount}
  this.effect('text',u.x,u.y-32,0,0,'#227d78',1.1,'+'+Math.round(amount));return amount;
 }
 measureHP(){const max=this.units.reduce((sum,u)=>sum+u.maxHp,0);return max?this.units.reduce((sum,u)=>sum+Math.max(0,u.hp),0)/max:0}
 hit(attacker,target,amount,kind='hit'){
  if(!attacker||!target||target.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
  const armor=TYPES[target.type].armor||0,flat=TYPES[target.type].armorFlat||0;
  const guardian=target.team==='ally'&&target.type!=='guardian'?this.units.filter(u=>u.type==='guardian'&&u.hp>0&&distance(u,target)<155).sort((a,b)=>distance(a,target)-distance(b,target))[0]:null;
  const relicArmor=target.team==='ally'&&TYPES[target.type].role==='spear'?Math.max(0,finite(this.relicEffects.spearReduction)):0;
  const guard=target.team==='ally'&&this.tickCount<target.guardUntilTick?.2:0;
  const ownReduction=clamp(armor+relicArmor+guard,0,.55),reduction=Math.min(.55,ownReduction+(guardian ? .2 : 0));
  const conditionRules=globalThis.TinyArmyContent&&globalThis.TinyArmyContent.CONDITION||{};
  const preparedBonus=finite(conditionRules.preparedDamageBonus,.1),preparedDuration=finite(conditionRules.preparedDuration,10);
  const longBattle=this.time>60?1+(this.time-60)/30:1,prepared=attacker.team==='ally'&&this.prepared&&this.tickCount<ticksFor(preparedDuration)?1+preparedBonus:1;
  const incoming=amount*longBattle*prepared,afterFlat=Math.max(Math.min(1,incoming),incoming-flat),before=target.hp;
  const afterOwn=Math.min(before,afterFlat*(1-ownReduction)),actual=Math.min(before,afterFlat*(1-reduction));
  target.hp=Math.max(0,before-actual);target.flash=.16;target.stats.damageTaken+=actual;target.career.damageTaken+=actual;
  const ownBlocked=Math.max(0,Math.min(before,incoming)-afterOwn);target.stats.blocked+=ownBlocked;target.career.blocked+=ownBlocked;
  if(guardian){const protectedDamage=Math.max(0,afterOwn-actual);guardian.stats.blocked+=protectedDamage;guardian.career.blocked+=protectedDamage}
  attacker.stats.damage+=actual;attacker.career.damage+=actual;if(attacker.team==='ally')this.damageDealt+=actual;
  if(target.team==='ally')this.minHpRatio=Math.min(this.minHpRatio,this.measureHP());
  this.effect(kind,attacker.x,attacker.y-10,target.x,target.y-10,attacker.team==='ally'?'#f6bd6c':'#bd6250',['arrow','mage_bolt','arcane_bolt'].includes(kind)?.3:.15);
  if(target.hp<=0){
   attacker.stats.kills++;attacker.career.kills++;target.guardUntilTick=0;target.rallyUntilTick=0;target.whistleUntilTick=0;
   if(target.id===this.focusTargetId){this.focusTargetId=null;this.focusUntilTick=0}
   if(target.team==='ally'&&!this.whistleTriggered&&this.relicEffects.whistleHaste>0){this.whistleTriggered=true;const expires=this.tickCount+ticksFor(this.relicEffects.whistleDuration||6);for(const u of this.alive('ally'))u.whistleUntilTick=expires}
   this.effect('fall',target.x,target.y,0,0,'#7e7466',.7);
  }
  return actual;
 }
 applyGrowth(u){
  const t=TYPES[u.type],training=globalThis.TinyArmyContent&&globalThis.TinyArmyContent.TRAINING||TRAINING,n=clamp(Math.floor(finite(u.training)),0,training.max);
  u.training=n;u.condition=clamp(finite(u.condition,100),0,100);
  const content=globalThis.TinyArmyContent;u.conditionMultiplier=content&&typeof content.conditionEfficiency==='function'?content.conditionEfficiency(u.condition):.7+.3*u.condition/100;
  u.maxHp=t.hp*(1+training.hp*n)*(1+Math.max(0,finite(this.relicEffects.hpBonus)));
  u.damage=t.damage*(1+training.damage*n)*u.conditionMultiplier;
  u.heal=(t.heal||0)*(1+training.heal*n)*u.conditionMultiplier*(1+(u.type==='support'?Math.max(0,finite(this.relicEffects.supportHealBonus)):0));
  u.healRange=t.healRange||0;u.hp=u.maxHp;
  if(this.combatRulesVersion===NEW_RULES){const projected=this.projectUnit(u);for(const key of ['critChance','critDamage','spellPower','skillDamageBonus','maxMana','startingMana','manaRegen','skillDamage'])u[key]=projected[key]}
 }
 static projectUnit(unit,options={}){
  if(!unit||!TYPES[unit.type])return null;
  const t=TYPES[unit.type],version=options.combatRulesVersion||LEGACY_RULES,modern=version===NEW_RULES;
  const training=globalThis.TinyArmyContent&&globalThis.TinyArmyContent.TRAINING||TRAINING,n=clamp(Math.floor(finite(unit.training)),0,training.max);
  const condition=clamp(finite(unit.condition,100),0,100),content=globalThis.TinyArmyContent;
  const efficiency=content&&typeof content.conditionEfficiency==='function'?content.conditionEfficiency(condition):.7+.3*condition/100;
  const effects=relicEffects(normalizeRelics(options.relics,version),options.skills||['heal','guard'],version);
  const mage=modern&&unit.type==='mage',spellPower=mage?t.spellPower*(1+finite(training.spellPower,.15)*n)*(1+Math.max(0,finite(effects.mageSpellPowerBonus)))*efficiency:0;
  const skillDamageBonus=mage?Math.max(0,finite(effects.mageSkillDamageBonus)):0;
  return Object.freeze({maxHp:t.hp*(1+training.hp*n)*(1+Math.max(0,finite(effects.hpBonus))),basicDamage:t.damage*(1+training.damage*n)*efficiency*(1+(t.role==='spear'?Math.max(0,finite(effects.spearDamageBonus)):0)),heal:(t.heal||0)*(1+training.heal*n)*efficiency*(1+(unit.type==='support'?Math.max(0,finite(effects.supportHealBonus)):0)),attackInterval:t.rate,attackRange:t.range,conditionMultiplier:efficiency,critChance:modern?clamp(finite(effects.critChance),0,1):0,critDamage:modern?1.5+Math.max(0,finite(effects.critDamageBonus)):1.5,spellPower,skillDamageBonus,maxMana:mage?t.maxMana+finite(training.maxMana,5)*n:0,startingMana:mage?t.startingMana:0,manaRegen:mage?t.manaRegen:0,skillManaCost:mage?t.skill.manaCost:0,skillCooldown:mage?t.skill.cooldown:0,skillDamage:mage?spellPower*t.skill.coefficient*(1+skillDamageBonus):0});
 }
 projectUnit(unit,options={}){return Game.projectUnit(unit,{relics:this.relics,skills:this.skills,combatRulesVersion:this.combatRulesVersion,...options})}
 criticalMultiplier(u){
  if(!(u.critChance>0))return 1;
  // A keyed stream never advances the legacy placement / first-windup RNG.
  let hash=(this.initialSeed^Math.imul(u.id,0x9e3779b1)^Math.imul(u.attacks,0x85ebca6b))>>>0;
  hash=Math.imul(hash^(hash>>>16),0x7feb352d);hash=Math.imul(hash^(hash>>>15),0x846ca68b);hash=(hash^(hash>>>16))>>>0;
  return hash/4294967296<u.critChance?u.critDamage:1;
 }
 unitSkillState(unitId){
  const u=this.units.find(unit=>unit.id===unitId);if(!u||u.type!=='mage'||this.combatRulesVersion!==NEW_RULES)return null;
  const skill=TYPES[u.type].skill,remaining=Math.max(0,((u.unitSkillReadyTick||0)-this.tickCount)*STEP),ready=remaining===0;
  const target=this.alive('enemy').some(enemy=>distance(u,enemy)<=TYPES[u.type].range+.01);
  return {id:skill.id,mana:u.mana,maxMana:u.maxMana,cost:skill.manaCost,remaining,ready,canCast:this.phase==='battle'&&u.hp>0&&ready&&u.mana+1e-9>=skill.manaCost&&target};
 }
 castUnitSkill(unitId,targetId){
  const state=this.unitSkillState(unitId);if(!state||!state.canCast)return false;
  const u=this.units.find(unit=>unit.id===unitId),targets=this.alive('enemy').filter(enemy=>distance(u,enemy)<=TYPES[u.type].range+.01).sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id);
  const target=targetId===undefined?targets[0]:targets.find(enemy=>enemy.id===targetId);if(!target)return false;
  u.mana=Math.max(0,u.mana-state.cost);u.unitSkillReadyTick=this.tickCount+ticksFor(TYPES[u.type].skill.cooldown);
  this.hit(u,target,u.skillDamage,'arcane_bolt');this.effect('arcane_hit',target.x,target.y-10,0,0,'#a8a0df',.3);return true;
 }
 moveToward(u,x,y,stop,dt){const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<=stop+.01){u.move=0;return}const n=Math.min(TYPES[u.type].speed*dt,d-stop);u.x+=dx/d*n;u.y+=dy/d*n;u.move+=dt*8}
 basicDamage(u,target){const spearBonus=u.team==='ally'&&TYPES[u.type].role==='spear'?Math.max(0,finite(this.relicEffects.spearDamageBonus)):0;const focusBonus=u.team==='ally'&&this.focusTarget()===target?.1:0;return u.damage*(1+spearBonus+focusBonus)}
 attack(u,target){
  if(!target||target.hp<=0)return;const t=TYPES[u.type];u.attacks++;
  const critical=this.combatRulesVersion===NEW_RULES&&u.team==='ally'&&!(u.type==='sniper'&&u.attacks%3===0)?this.criticalMultiplier(u):1;
  if(u.type==='volley'){
   const candidates=this.alive(u.team==='ally'?'enemy':'ally').filter(e=>distance(e,u)<=t.range+.01).sort((a,b)=>distance(a,u)-distance(b,u));
   const focused=u.team==='ally'?this.focusTarget():null;
   if(focused&&candidates.includes(focused)){candidates.splice(candidates.indexOf(focused),1);candidates.unshift(focused)}
   candidates.slice(0,3).forEach(e=>this.hit(u,e,this.basicDamage(u,e)*critical,'arrow'));return;
  }
  this.hit(u,target,this.basicDamage(u,target)*critical*(u.type==='sniper'&&u.attacks%3===0?1.9:1),u.type==='mage'?'mage_bolt':t.range>100?'arrow':'hit');
  if(u.type==='sniper'&&u.attacks%3===0)this.effect('ring',target.x,target.y,0,0,'#f2ca69',.5);
 }
 tick(dt=STEP){
  if(this.phase!=='battle'||!Number.isFinite(dt)||Math.abs(dt-STEP)>1e-10)return false;
  // Commands are applied at tickCount before this step; effects use [castTick, expiryTick).
  this.time=this.tickCount*STEP;
  if(!this.focusTarget()){this.focusTargetId=null;this.focusUntilTick=0}
  this.effects.forEach(e=>e.life-=STEP);this.effects=this.effects.filter(e=>e.life>0);
  for(const signal of this.telegraphs){
   if(signal.owner.hp<=0){signal.left=-1;continue}signal.left-=STEP;
   if(signal.left<=0){if(signal.team==='enemy')this.enemySlams++;const victims=this.alive(signal.team==='enemy'?'ally':'enemy').filter(v=>Math.hypot(v.x-signal.x,v.y-signal.y)<signal.radius);victims.forEach(v=>this.hit(signal.owner,v,signal.damage));this.effect('blast',signal.x,signal.y,signal.radius,0,signal.team==='enemy'?'#c75e4b':'#eeaa52',.5)}
  }
  this.telegraphs=this.telegraphs.filter(t=>t.left>0);
  for(const u of [...this.units,...this.enemies]){
   if(u.hp<=0)continue;if(this.combatRulesVersion===NEW_RULES&&u.type==='mage')u.mana=Math.min(u.maxMana,u.mana+u.manaRegen*STEP);u.flash=Math.max(0,u.flash-STEP);const haste=this.attackHaste(u);if(u.attacks>0)u.cd=Math.max(0,u.cd-STEP*haste);u.skillCd-=STEP;u.healCd-=STEP;
   const stats=TYPES[u.type],targets=this.alive(u.team==='ally'?'enemy':'ally');if(!targets.length)break;
   const injured=u.type==='support'?this.alive('ally').filter(v=>v.hp<v.maxHp-.1).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp):[];
   if(u.type==='support'&&u.healCd<=0){const patient=injured.find(v=>distance(v,u)<=u.healRange+.01);if(patient){this.heal(patient,u.heal,u);this.effect('heal',u.x,u.y-10,patient.x,patient.y-10,'#54a78b',.55);u.healCd=2.8}}
   const automaticTarget=targets.slice().sort((a,b)=>distance(a,u)-distance(b,u))[0];let target=automaticTarget;
   if(u.type==='sniper'){const inRange=targets.filter(v=>distance(v,u)<=stats.range+.01);if(inRange.length)target=inRange.sort((a,b)=>a.hp-b.hp)[0]}
   const focused=u.team==='ally'?this.focusTarget():null;if(focused&&distance(focused,u)<=stats.range+.01)target=focused;
   const dist=distance(target,u);
   // The seeded first windup starts only in normal attack range and is never rerolled by placement.
   if(u.attacks===0&&dist<=stats.range+.01)u.cd=Math.max(0,u.cd-STEP*haste);
   if(u.type==='support'){
    const remotePatient=injured[0],inReach=injured.some(v=>distance(v,u)<=u.healRange+.01);
    if(remotePatient&&!inReach)this.moveToward(u,remotePatient.x,remotePatient.y,u.healRange*.85,STEP);
    else if(dist<=stats.range+.01){u.move=0;if(u.cd<=0){this.attack(u,target);u.cd=stats.rate}}
    else{const anchors=this.alive('ally').filter(v=>v.id!==u.id&&v.type!=='support').sort((a,b)=>distance(a,automaticTarget)-distance(b,automaticTarget));if(anchors[0])this.moveToward(u,Math.max(75,anchors[0].x-105),anchors[0].y,30,STEP);else this.moveToward(u,automaticTarget.x,automaticTarget.y,stats.range,STEP)}
   }else if(dist>stats.range+.01)this.moveToward(u,target.x,target.y,stats.range,STEP);
   else{u.move=0;if(u.cd<=0){this.attack(u,target);u.cd=stats.rate}}
   if(this.combatRulesVersion===NEW_RULES&&u.type==='mage')this.castUnitSkill(u.id);
   // Innate attacks retain their independent automatic target, never the focus marker.
   const automaticDistance=distance(automaticTarget,u);
   if(u.type==='charger'&&u.skillCd<=0&&automaticDistance<150&&automaticTarget.hp>0){this.telegraphs.push({owner:u,team:'ally',x:automaticTarget.x,y:automaticTarget.y,radius:112,left:.45,max:.45,damage:u.damage*1.6});this.effect('charge',u.x,u.y,automaticTarget.x,automaticTarget.y,'#eeaa52',.5);u.skillCd=9;this.message='돌격병이 광역 타격을 펼칩니다!'}
   if((u.type==='boss'||u.type==='brute')&&u.skillCd<=0&&automaticDistance<150&&automaticTarget.hp>0){const boss=u.type==='boss';this.telegraphs.push({owner:u,team:'enemy',x:automaticTarget.x,y:automaticTarget.y,radius:boss?150:85,left:boss?2.1:1.5,max:boss?2.1:1.5,damage:u.damage*(boss?2:1.6)});u.skillCd=boss?9:12;this.message=boss?'파수꾼의 강타! 붉은 범위에 공격이 곧 떨어져요.':'방패병의 강타가 준비됩니다.'}
  }
  for(const list of [this.units,this.enemies]){const living=list.filter(u=>u.hp>0);for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){const a=living[i],b=living[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<32){const push=(32-d)*STEP*3,nx=d>.01?dx/d:0,ny=d>.01?dy/d:1;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push}}for(const u of living){u.x=clamp(u.x,75,830);u.y=clamp(u.y,128,477)}}
  this.tickCount++;this.time=this.tickCount*STEP;this.totalTime+=STEP;
  if(!this.alive('enemy').length)this.finish(true);else if(!this.alive('ally').length)this.finish(false);else if(this.tickCount>=ticksFor(LIMIT)){this.message='해가 저물었어요. 제한 시간 안에 돌파하지 못했습니다.';this.finish(false,'timeout')}
  return true;
 }
 finish(win,reason=''){
  if(this.phase!=='battle')return false;
  const enemySummary=Object.keys(TYPES).filter(type=>this.enemies.some(u=>u.type===type)).map(type=>{const group=this.enemies.filter(u=>u.type===type);return{type,count:group.length,survivors:group.filter(u=>u.hp>0).length,remainingHp:group.reduce((n,u)=>n+Math.max(0,u.hp),0),blocked:group.reduce((n,u)=>n+u.stats.blocked,0)}});
  const contributions=this.units.map(u=>({id:u.id,type:u.type,training:u.training,row:u.row,slot:u.slot,condition:u.condition,hp:u.hp,maxHp:u.maxHp,...u.stats}));
  const result={battleId:this.battleId,stage:this.stage,win:!!win,reason,time:this.time,ticks:this.tickCount,survivors:this.alive('ally').length,unitCount:this.units.length,hpRatio:this.measureHP(),minHpRatio:this.minHpRatio,rallyHealing:0,skillHealing:this.skillHealing,damageDealt:this.damageDealt,healingDone:this.healingDone,enemySlams:this.enemySlams,enemySummary,contributions,skillCasts:{...this.skillCasts},inputLog:clone(this.inputLog)};
  this.history.push(result);this.lastResult=clone(result);this.rewardTaken=false;this.telegraphs=[];this.focusTargetId=null;this.focusUntilTick=0;this.rallyUntil=0;
  for(const u of this.units){u.guardUntilTick=0;u.rallyUntilTick=0;u.whistleUntilTick=0}
  if(win){this.units.forEach(u=>u.hp=u.maxHp);this.phase=!this.externalMode&&this.stage===5?'victory':'reward';this.message=this.phase==='victory'?'작은 군단이 원정을 완수했습니다!':'승리! 쓰러진 병사도 모두 돌아왔어요.'}
  else{this.phase='defeat';if(reason!=='timeout')this.message='군단이 쓰러졌어요. 다른 편성으로 다시 도전해 보세요.'}
  return true;
 }
 reward(kind,value,id){
  if(this.externalMode||this.phase!=='reward'||this.rewardTaken)return false;
  if(kind==='recruit'){if(!['spear','archer','support'].includes(value)||this.units.length>=CAP)return false;for(let n=0;n<2&&this.units.length<CAP;n++)this.spawn(value,value==='spear'?'front':'back')}
  else if(kind==='evolve'){const unit=this.units.find(u=>u.id===id);if(!unit)return false;const options=unit.type==='spear'?['guardian','charger']:unit.type==='archer'?['sniper','volley']:[];if(!options.includes(value))return false;unit.type=value;this.applyGrowth(unit)}
  else if(kind==='train'){const unit=this.units.find(u=>u.id===id);if(!unit||unit.training>=TRAINING.max)return false;unit.training++;this.applyGrowth(unit)}else return false;
  this.rewardTaken=true;this.stage++;this.phase='prepare';this.time=0;this.tickCount=0;this.rallyUsed=false;this.preview();this.message='성장 완료! 다음 전투를 준비하세요';return true;
 }
 snapshot(){return clone({stage:this.stage,phase:this.phase,time:this.time,tickCount:this.tickCount,seed:this.seed,initialSeed:this.initialSeed,externalMode:this.externalMode,battleId:this.battleId,prepared:this.prepared,encounter:this.encounter,units:this.units,enemies:this.enemies,rallyUsed:this.rallyUsed,rallyUntil:this.rallyUntil,skills:this.skills,skillStates:this.skillState(),skillReadyTicks:this.skillReadyTicks,skillCasts:this.skillCasts,focusTargetId:this.focusTargetId,focusUntilTick:this.focusUntilTick,whistleTriggered:this.whistleTriggered,relics:this.relics,relicEffects:this.relicEffects,inputLog:this.inputLog,history:this.history,lastResult:this.lastResult,minHpRatio:this.minHpRatio,damageDealt:this.damageDealt,healingDone:this.healingDone})}
}

// v0.9 is a separate rules implementation. The original methods above remain the
// authoritative v05/v08 replay path, including their RNG consumption and shape.
const V09_RULES='v09-combat-1';
const legacyMethods=Object.fromEntries(Object.getOwnPropertyNames(Game.prototype).filter(k=>k!=='constructor').map(k=>[k,Game.prototype[k]]));
const legacyProjection=Game.projectUnit;
const statsV09=()=>({...emptyStats(),barrierAbsorbed:0,barrierGranted:0,barrierExpired:0,overkill:0,overhealing:0,manaSpent:0,manaRefunded:0,unitSkillCasts:0,normalHeals:0,barrierCasts:0});
const v09Content=()=>globalThis.TinyArmyV09Content;
const V09_ENEMIES=Object.freeze(Object.fromEntries(Object.entries(TYPES).filter(([type])=>!ALLY_TYPES.includes(type)).map(([type,t])=>{const {armor,armorFlat,...base}=t;return [type,Object.freeze({...base,attackPower:t.damage,abilityPower:0,defense:({armored:50,brute:18,boss:14})[type]||0})]})));
const v09Types=()=>Object.freeze({...V09_ENEMIES,...(v09Content()?v09Content().TYPES:{})});
const sourceUnit=u=>({id:u.id,type:u.type,slot:u.slot,training:u.training||0,trainingTrack:u.trainingTrack||null,condition:u.condition===undefined?100:u.condition});
const adjacent=(a,b)=>Math.abs(Math.floor(a/4)-Math.floor(b/4))+Math.abs(a%4-b%4)===1;
const statMetaV09=Object.freeze({version:'v09-stats-1',damage:'actual HP lost',healing:'actual HP restored',blocked:'HP-limited prevention, split between defense, guardian and barrier',barrierAbsorbed:'barrier resource consumed; do not add to blocked',rulesVersion:V09_RULES});
class V09Rules {
 configureBattle(config={}){
  const C=v09Content(),roster=config.roster,encounter=config.encounter,skills=config.skills===undefined?['heal','guard']:config.skills;
  if(!C||typeof C.projectUnit!=='function'||this.phase==='battle'||!Array.isArray(roster)||!roster.length||roster.length>CAP||!encounter||!Array.isArray(encounter.enemies)||!encounter.enemies.length||encounter.enemies.length>60)return false;
  if(config.seed!==undefined&&(!Number.isInteger(config.seed)||config.seed<0||config.seed>0xffffffff))return false;
  if(!Array.isArray(skills)||skills.length!==2||new Set(skills).size!==2||skills.some(id=>!SKILLS[id]))return false;
  const ids=new Set(),slots=new Set();
  for(const u of roster){
   if(!u||!Number.isSafeInteger(u.id)||u.id<1||u.id>1000000||!C.ALLY_TYPES.includes(u.type)||ids.has(u.id)||!Number.isInteger(u.slot)||u.slot<0||u.slot>=CAP||slots.has(u.slot))return false;
   const n=u.training===undefined?0:u.training,track=u.trainingTrack===undefined?null:u.trainingTrack;
   if(!Number.isInteger(n)||n<0||n>2||(n===0?track!==null:!['specialty','handling'].includes(track)))return false;
   if(u.condition!==undefined&&(!Number.isFinite(u.condition)||u.condition<0||u.condition>100))return false;
   ids.add(u.id);slots.add(u.slot);
  }
  if(encounter.scale!==undefined&&(!Number.isFinite(encounter.scale)||encounter.scale<=0||encounter.scale>20))return false;
  for(const entry of encounter.enemies){const type=typeof entry==='string'?entry:entry&&entry.type;if(!TYPES[type]||ALLY_TYPES.includes(type))return false;if(typeof entry==='object'&&entry.scale!==undefined&&(!Number.isFinite(entry.scale)||entry.scale<=0||entry.scale>20||(encounter.scale||1)*entry.scale>20))return false}
  const relics=Array.isArray(config.relics)?clone(config.relics):[];
  if(config.relics!==undefined&&!Array.isArray(config.relics))return false;
  const seenRelics=new Set();for(const r of relics){if(!r||!C.RELICS[r.id]||seenRelics.has(r.id))return false;const stage=r.evolutionStage===undefined?(r.evolution===undefined?1:r.evolution):r.evolutionStage;if(!Number.isInteger(stage)||stage<1||stage>3)return false;seenRelics.add(r.id)}
  // All input/projection validation happens before the existing battle is replaced.
  let projected;try{projected=roster.map(u=>C.projectUnit(u,{relics,roster,skills,prepared:config.prepared===true}));if(projected.some(p=>!p||![p.maxHp,p.attackPower,p.abilityPower,p.defense,p.basicDamage,p.attackRange,p.attackInterval].every(Number.isFinite)||p.maxHp<=0||p.attackInterval<=0))return false}catch(_){return false}
  legacyMethods.initialize.call(this,config.seed===undefined?417:config.seed);
  this.combatRulesVersion=V09_RULES;this.externalMode=true;this.battleId=config.battleId||null;this.encounter=clone(encounter);this.prepared=config.prepared===true;
  this.stage=Math.max(0,finite(encounter.row));this.skills=skills.slice();this.relics=relics;this.relicEffects=C.getRelicEffects(relics,skills);this.nextId=Math.max(...roster.map(u=>u.id))+1;
  this.startingRoster=null;this.synergySnapshot=null;this.formationLinks={};this.damageActionDepth=0;this.emergencyCaseUsed=false;
  this.units=roster.map((entry,i)=>{const u=this.make(entry.type,'ally',ROWS[Math.floor(entry.slot/4)]);Object.assign(u,sourceUnit(entry));this.applyProjection(u,projected[i],true);return u});
  this.preview();this.message=encounter.description||'배치와 지휘 스킬을 확인한 뒤 출발하세요.';return true;
 }
 getType(type){const C=v09Content();return this.combatRulesVersion===V09_RULES&&C&&(C.TYPES[type]||V09_ENEMIES[type])||TYPES[type]}
 make(type,team,row='front',scale=1){
  const t=this.getType(type);if(!t)return null;const initialCd=.3+this.random()*1.2,atk=finite(t.attackPower,t.damage),def=finite(t.defense,({armored:50,brute:18,boss:14})[type]||0);
  return {id:this.nextId++,type,team,row,hp:t.hp*scale,maxHp:t.hp*scale,damage:atk*scale,attackPower:atk*scale,abilityPower:finite(t.abilityPower),defense:def,baseDefense:def,range:t.range,rate:t.rate,speed:t.speed,x:0,y:0,cd:initialCd,initialCd,healCd:2,skillCd:type==='charger'?2:8,flash:0,attacks:0,scale,move:0,training:0,trainingTrack:null,condition:100,conditionMultiplier:1,heal:0,healRange:0,guardUntilTick:0,rallyUntilTick:0,whistleUntilTick:0,slows:[],barrier:null,temporaryDefense:0,temporaryDefenseUntilTick:0,stats:statsV09(),career:statsV09()};
 }
 applyProjection(u,p,resetHp=false){
  const oldHp=u.hp,oldMana=u.mana;u.projection=p;
  for(const k of ['maxHp','attackPower','abilityPower','defense','baseDefense','guardianDefense','guardianLink','basicDamage','conditionMultiplier','critChance','critDamage','spellPower','maxMana','startingMana','manaRegen','heal','healRange','healInterval','healInitialDelay','attackSpeedBonus','attackFrequencyCostFactor','attackIntervalCostFactor','basicDamageBonus','supportHealBonus','shieldBonus','firstAttackMultiplier','maxTargets','secondaryMultiplier','primaryMultiplier','skill','shield','skillDamage','modifiers','modifierLedger','ledger','emergencyThreshold','emergencyMultiplier','mageSkillDamageBonus'])if(p[k]!==undefined)u[k]=p[k];
  u.damage=p.basicDamage;u.rate=p.baseAttackInterval||p.attackInterval;u.range=p.attackRange;u.speed=p.speed;u.hp=resetHp?p.maxHp:Math.min(oldHp,p.maxHp);if(oldMana!==undefined)u.mana=Math.min(oldMana,p.maxMana||0);
 }
 applyGrowth(u){
  if(u.team!=='ally')return;const p=this.projectUnit(u);if(!p)return;this.applyProjection(u,p,this.phase==='prepare'&&u.projection===undefined);
 }
 projectUnit(unit,options={}){return Game.projectUnit(unit,{relics:this.relics,skills:this.skills,prepared:this.prepared,combatRulesVersion:V09_RULES,roster:this.startingRoster||this.units.map(sourceUnit),...options})}
 resetUnitBattleState(u){
  u.hp=u.maxHp;u.cd=u.initialCd;u.healCd=finite(u.healInitialDelay,2);u.skillCd=u.skill?finite(u.skill.initialDelay,u.type==='charger'?2:0):8;u.attacks=0;u.flash=0;u.move=0;u.guardUntilTick=0;u.rallyUntilTick=0;u.whistleUntilTick=0;u.slows=[];u.barrier=null;u.temporaryDefense=0;u.temporaryDefenseUntilTick=0;u.paidSpellCount=0;u.unitSkillReadyTick=0;u.shieldReadyTick=ticksFor(u.shield?u.shield.initialDelay:2);u.mana=u.maxMana?Math.min(u.maxMana,u.startingMana):0;
 }
 setSlot(id,slot){
  if(this.phase!=='prepare'||!Number.isInteger(slot)||slot<0||slot>=CAP)return false;const u=this.units.find(v=>v.id===id);if(!u)return false;
  const other=this.units.find(v=>v.slot===slot&&v!==u);if(other)other.slot=u.slot;u.slot=slot;
  const roster=this.units.map(sourceUnit);for(const v of this.units){v.row=ROWS[Math.floor(v.slot/4)];v.x=[330,260,190][Math.floor(v.slot/4)];v.y=180+(v.slot%4)*80;this.applyProjection(v,this.projectUnit(v,{roster}),false)}return true;
 }
 start(){
  if(this.phase!=='prepare'||!this.units.length||!this.enemies.length)return false;
  this.startingRoster=clone(this.units.map(sourceUnit));this.synergySnapshot=clone(v09Content().synergyPreview(this.startingRoster));
  for(const u of this.units){u.startingSlot=u.slot;this.applyProjection(u,this.projectUnit(u),false)}
  const ok=legacyMethods.start.call(this);if(!ok)return false;
  this.damageActionDepth=0;this.emergencyCaseUsed=false;this.formationLinks={};for(const u of [...this.units,...this.enemies])u.stats=statsV09();
  for(const target of this.units){const candidates=target.type==='guardian'?[]:this.units.filter(s=>s.type==='guardian'&&adjacent(s.startingSlot,target.startingSlot)).map(s=>({sourceId:s.id,value:finite(s.guardianDefense,Math.min(20,s.abilityPower*.6))})).sort((a,b)=>b.value-a.value||a.sourceId-b.sourceId);this.formationLinks[target.id]={candidates,sourceId:null,value:0}}
  this.refreshGuardianLinks();return true;
 }
 refreshGuardianLinks(){
  if(!this.formationLinks)return;for(const u of this.units){const link=this.formationLinks[u.id];if(!link)continue;const active=link.candidates.find(c=>this.units.some(s=>s.id===c.sourceId&&s.hp>0));link.sourceId=active?active.sourceId:null;link.value=active?active.value:0;u.guardianLink=clone(link);u.defense=this.effectiveDefense(u,link.value,this.tickCount<u.temporaryDefenseUntilTick?u.temporaryDefense:0)}
 }
 effectiveDefense(u,formationFlat=0,temporaryFlat=0){const C=v09Content();return u.team==='ally'&&u.projection&&C.projectDefense?C.projectDefense(u,u.projection,formationFlat,temporaryFlat):Math.max(0,finite(u.baseDefense)+formationFlat+temporaryFlat)}
 resolveDamageAction(action){
  if(this.damageActionDepth>0)return action();this.refreshGuardianLinks();this.actionGuardianLinks=clone(this.formationLinks);this.damageActionDepth=1;
  try{return action()}finally{this.damageActionDepth=0;this.actionGuardianLinks=null;this.refreshGuardianLinks()}
 }
 castSkill(id,targetId){const before=this.effects.length,ok=legacyMethods.castSkill.call(this,id,targetId);if(ok)for(let i=before;i<this.effects.length;i++)Object.assign(this.effects[i],{ownerKind:'commander',actionType:'commander_skill',effectKind:id==='heal'?'heal':id==='guard'?'protection':id==='rally'?'haste':'focus',damageType:'none'});return ok}
 skillCooldown(id){const command=this.relicEffects.commandSkills&&this.relicEffects.commandSkills[id];return ticksFor(command?command.cooldown:SKILLS[id]?SKILLS[id].cooldown:0)*STEP}
 skillDuration(id){const command=this.relicEffects.commandSkills&&this.relicEffects.commandSkills[id];return ticksFor(command?command.duration:SKILLS[id]?SKILLS[id].duration:0)*STEP}
 activeSlow(u){return (u.slows||[]).filter(s=>this.tickCount<s.untilTick).reduce((a,s)=>Math.max(a,s.value),0)}
 applySlow(source,target,value,duration){if(!target||target.hp<=0)return false;const effect={sourceId:source.id,value:clamp(value,0,.25)*(target.type==='boss'?.5:1),untilTick:this.tickCount+ticksFor(duration)};target.slows=(target.slows||[]).filter(s=>s.sourceId!==source.id&&this.tickCount<s.untilTick);target.slows.push(effect);return true}
 attackHaste(u){const gain=u.team==='ally'?finite(u.attackSpeedBonus)+(this.tickCount<u.rallyUntilTick?.25:0)+(this.tickCount<u.whistleUntilTick?finite(this.relicEffects.whistleHaste):0):0;return (1+clamp(gain,0,.5))*finite(u.attackFrequencyCostFactor,1)/finite(u.attackIntervalCostFactor,1)*(1-this.activeSlow(u))}
 moveToward(u,x,y,stop,dt){const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy);if(d<=stop+.01){u.move=0;return}const n=Math.min(u.speed*(1-this.activeSlow(u))*dt,d-stop);u.x+=dx/d*n;u.y+=dy/d*n;u.move+=dt*8}
 basicDamage(u,target){const bonus=finite(u.basicDamageBonus)+(u.team==='ally'&&this.focusTarget()===target?.1:0);return u.attackPower*u.conditionMultiplier*(1+bonus)}
 hit(attacker,target,amount,kind='hit',action={}){
  if(!attacker||attacker.hp<=0||!target||target.hp<=0||!Number.isFinite(amount)||amount<=0)return 0;
  if(!this.damageActionDepth)return this.resolveDamageAction(()=>this.hit(attacker,target,amount,kind,action));
  const conditions=v09Content().CONDITION||{},prepared=attacker.team==='ally'&&this.prepared&&this.tickCount<ticksFor(finite(conditions.preparedDuration,10))?1+finite(conditions.preparedDamageBonus,.1):1;
  const incoming=amount*(this.time>60?1+(this.time-60)/30:1)*prepared,H=target.hp,link=target.team==='ally'&&this.actionGuardianLinks[target.id]||{sourceId:null,value:0},temporary=this.tickCount<target.temporaryDefenseUntilTick?target.temporaryDefense:0;
  const ownDefense=this.effectiveDefense(target,0,temporary),effectiveDefense=this.effectiveDefense(target,link.value,temporary),P=target.team==='ally'&&this.tickCount<target.guardUntilTick?.2:0;
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
 heal(u,n,source=null,action={}){
  if(!u||u.hp<=0||!Number.isFinite(n))return 0;const amount=Math.min(Math.max(0,n),Math.max(0,u.maxHp-u.hp));
  if(source&&n>amount){source.stats.overhealing+=Math.max(0,n-amount);source.career.overhealing+=Math.max(0,n-amount)}
  if(amount<=0)return 0;u.hp+=amount;this.healingDone+=amount;if(source){source.stats.healing+=amount;source.career.healing+=amount}
  this.effect('text',u.x,u.y-32,0,0,'#227d78',1.1,'+'+Math.round(amount));Object.assign(this.effects[this.effects.length-1],{ownerKind:source?'unit':'commander',actionType:source?'heal':'commander_skill',effectKind:'heal',damageType:'none',sourceKind:action.sourceKind||'normal',sourceId:source?source.id:null,targetId:u.id});return amount;
 }
 supportHeal(u,target){
  if(!u||u.hp<=0||!target||target.hp<=0||target.hp>=target.maxHp-1e-9||distance(u,target)>u.healRange+.01)return false;
  const before=target.hp/target.maxHp,mult=u.type==='medic'&&before<finite(u.emergencyThreshold,.35)?finite(u.emergencyMultiplier,1.25):1;
  const actual=this.heal(target,u.heal*mult,u);if(actual<=0)return false;u.stats.normalHeals++;u.career.normalHeals++;this.effect('heal',u.x,u.y-10,target.x,target.y-10,'#54a78b',.55);Object.assign(this.effects[this.effects.length-1],{ownerKind:'unit',actionType:'heal',effectKind:'heal',damageType:'none',sourceKind:'normal',sourceId:u.id,targetId:target.id});
  if(!this.emergencyCaseUsed&&this.relicEffects.emergencyHeal>0&&before<=.2){this.emergencyCaseUsed=true;this.heal(target,this.relicEffects.emergencyHeal,null,{sourceKind:'relic_proc'})}
  return true;
 }
 expireBarrier(u){if(!u.barrier)return;const source=this.units.find(v=>v.id===u.barrier.ownerId);if(source){source.stats.barrierExpired+=u.barrier.amount;source.career.barrierExpired+=u.barrier.amount}u.barrier=null}
 grantBarrier(source,target,amount,duration){
  if(!source||source.hp<=0||!target||target.hp<=0||!(amount>0))return false;if(target.barrier&&this.tickCount>=target.barrier.untilTick)this.expireBarrier(target);
  if(target.barrier&&target.barrier.amount>=amount)return false;
  if(target.barrier)this.expireBarrier(target);target.barrier={amount,ownerId:source.id,untilTick:this.tickCount+ticksFor(duration)};source.stats.barrierGranted+=amount;source.career.barrierGranted+=amount;
  this.effect('ring',target.x,target.y,0,0,'#9cb8df',.5);Object.assign(this.effects[this.effects.length-1],{ownerKind:'unit',actionType:'shield',effectKind:'shield',damageType:'none',sourceId:source.id,targetId:target.id});return true;
 }
 castBarrier(unitId){
  const u=this.units.find(v=>v.id===unitId);if(this.phase!=='battle'||!u||u.hp<=0||!u.shield||this.tickCount<u.shieldReadyTick)return false;
  const s=u.shield,targets=this.alive('ally').filter(v=>distance(u,v)<=s.range+.01).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||b.x-a.x||a.id-b.id).slice(0,s.targets||2);let applied=0;
  const amount=Number.isFinite(s.amount)?s.amount:u.abilityPower*s.coefficient*u.conditionMultiplier*(1+finite(u.shieldBonus));for(const target of targets)if(this.grantBarrier(u,target,amount,s.duration))applied++;
  if(!applied)return false;u.shieldReadyTick=this.tickCount+ticksFor(s.cooldown);u.stats.barrierCasts++;u.career.barrierCasts++;return true;
 }
 unitSkillState(unitId){
  const u=this.units.find(v=>v.id===unitId);if(!u||!u.skill||!(u.maxMana>0))return null;const s=u.skill,remaining=Math.max(0,((u.unitSkillReadyTick||0)-this.tickCount)*STEP),ready=remaining===0,target=this.alive('enemy').some(e=>distance(u,e)<=u.range+.01);
  return{id:s.id,name:s.name,mana:u.mana,maxMana:u.maxMana,cost:s.manaCost,remaining,ready,canCast:this.phase==='battle'&&u.hp>0&&ready&&u.mana+1e-9>=s.manaCost&&target};
 }
 castUnitSkill(unitId,targetId){
  const state=this.unitSkillState(unitId);if(!state||!state.canCast)return false;const u=this.units.find(v=>v.id===unitId),s=u.skill,candidates=this.alive('enemy').filter(e=>distance(u,e)<=u.range+.01).sort((a,b)=>distance(u,a)-distance(u,b)||a.id-b.id),target=targetId===undefined?candidates[0]:candidates.find(e=>e.id===targetId);if(!target)return false;
  const targets=[target];if(u.type==='pyromancer')targets.push(...this.alive('enemy').filter(e=>e!==target&&distance(e,target)<=s.radius+.01).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id).slice(0,(s.targets||3)-1));
  u.mana=Math.max(0,u.mana-state.cost);u.unitSkillReadyTick=this.tickCount+ticksFor(s.cooldown);u.stats.manaSpent+=state.cost;u.career.manaSpent+=state.cost;u.stats.unitSkillCasts++;u.career.unitSkillCasts++;u.paidSpellCount++;
  this.resolveDamageAction(()=>{for(let i=0;i<targets.length;i++){const coefficient=i?finite(s.secondaryCoefficient):s.coefficient,damage=i?finite(s.secondaryDamage,u.abilityPower*coefficient*u.conditionMultiplier):finite(s.damage,(u.attackPower*finite(s.attackCoefficient)+u.abilityPower*coefficient)*u.conditionMultiplier);this.hit(u,targets[i],damage,u.type==='pyromancer'?'fire_bolt':u.type==='frostmage'?'frost_bolt':'arcane_bolt',{actionType:'unit_skill',damageType:'magic'});if(u.type==='frostmage')this.applySlow(u,targets[i],s.slow,s.slowDuration)}});
  if(this.relicEffects.echoRefund>0&&u.paidSpellCount%3===0){const refund=Math.min(u.maxMana-u.mana,state.cost*this.relicEffects.echoRefund);u.mana+=refund;u.stats.manaRefunded+=refund;u.career.manaRefunded+=refund}return true;
 }
 attack(u,target){
  if(!u||u.hp<=0||!target||target.hp<=0||distance(u,target)>u.range+.01)return false;const enemyTeam=u.team==='ally'?'enemy':'ally';let targets=[target];
  if(u.type==='volley'){targets=this.alive(enemyTeam).filter(e=>distance(u,e)<=u.range+.01).sort((a,b)=>distance(a,u)-distance(b,u)||a.id-b.id);const focus=u.team==='ally'?this.focusTarget():null;if(focus&&targets.includes(focus)){targets.splice(targets.indexOf(focus),1);targets.unshift(focus)}else if(targets.includes(target)){targets.splice(targets.indexOf(target),1);targets.unshift(target)}targets=targets.slice(0,u.maxTargets||3)}
  if(!targets.length)return false;u.attacks++;const enhanced=u.type==='sniper'&&u.attacks%3===0,critical=u.team==='ally'&&!enhanced?this.criticalMultiplier(u):1;
  this.resolveDamageAction(()=>{targets.forEach((e,i)=>{let damage=this.basicDamage(u,e);if(enhanced){const s=u.skill||{};damage=(u.attackPower*finite(s.attackCoefficient,1)+u.abilityPower*finite(s.coefficient,1.8))*u.conditionMultiplier*(1+finite(u.basicDamageBonus)+(this.focusTarget()===e?.1:0))}if(u.type==='archer'&&u.attacks===1)damage*=finite(u.firstAttackMultiplier,1);if(u.type==='volley')damage*=i?finite(u.secondaryMultiplier,1):finite(u.primaryMultiplier,1);this.hit(u,e,damage*critical,['mage','pyromancer','frostmage'].includes(u.type)?'mage_bolt':u.range>100?'arrow':'hit',{actionType:'basic_attack',damageType:['mage','pyromancer','frostmage'].includes(u.type)?'magic':'physical',canCrit:!enhanced,enhancedBasic:enhanced})})});return true;
 }
 tick(dt=STEP){
  if(this.phase!=='battle'||!Number.isFinite(dt)||Math.abs(dt-STEP)>1e-10)return false;this.time=this.tickCount*STEP;
  if(!this.focusTarget()){this.focusTargetId=null;this.focusUntilTick=0}this.effects.forEach(e=>e.life-=STEP);this.effects=this.effects.filter(e=>e.life>0);
  for(const u of [...this.units,...this.enemies]){if(u.barrier&&this.tickCount>=u.barrier.untilTick)this.expireBarrier(u);u.slows=u.slows.filter(s=>this.tickCount<s.untilTick)}this.refreshGuardianLinks();
  for(const signal of this.telegraphs){if(signal.owner.hp<=0){signal.left=-1;continue}signal.left-=STEP;if(signal.left<=0){if(signal.team==='enemy')this.enemySlams++;const victims=this.alive(signal.team==='enemy'?'ally':'enemy').filter(v=>Math.hypot(v.x-signal.x,v.y-signal.y)<signal.radius);this.resolveDamageAction(()=>victims.forEach(v=>this.hit(signal.owner,v,signal.damage,'hit',{actionType:'unit_skill',damageType:'physical'})));if(signal.owner.type==='charger'&&signal.owner.trainingTrack==='handling'){signal.owner.temporaryDefense=finite(signal.owner.skill&&signal.owner.skill.defenseAfter);signal.owner.temporaryDefenseUntilTick=this.tickCount+ticksFor(finite(signal.owner.skill&&signal.owner.skill.defenseDuration,2));this.refreshGuardianLinks()}this.effect('blast',signal.x,signal.y,signal.radius,0,signal.team==='enemy'?'#c75e4b':'#eeaa52',.5)}}this.telegraphs=this.telegraphs.filter(t=>t.left>0);
  for(const u of [...this.units,...this.enemies]){
   if(u.hp<=0)continue;if(u.maxMana>0)u.mana=Math.min(u.maxMana,u.mana+u.manaRegen*STEP);u.flash=Math.max(0,u.flash-STEP);const haste=this.attackHaste(u);if(u.attacks>0)u.cd=Math.max(0,u.cd-STEP*haste);u.skillCd-=STEP;u.healCd-=STEP;
   const targets=this.alive(u.team==='ally'?'enemy':'ally');if(!targets.length)break;const supportive=u.team==='ally'&&['support','medic','warder'].includes(u.type),injured=supportive?this.alive('ally').filter(v=>v.hp<v.maxHp-1e-9).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id-b.id):[];
   if(supportive&&u.healCd<=0){const patient=injured.find(v=>distance(v,u)<=u.healRange+.01);if(patient&&this.supportHeal(u,patient))u.healCd=u.healInterval}
   const automaticTarget=targets.slice().sort((a,b)=>distance(a,u)-distance(b,u)||a.id-b.id)[0];let target=automaticTarget;
   if(u.type==='sniper'){const inRange=targets.filter(v=>distance(v,u)<=u.range+.01);if(inRange.length)target=inRange.sort((a,b)=>a.hp-b.hp||a.id-b.id)[0]}
   const focused=u.team==='ally'?this.focusTarget():null;if(focused&&distance(focused,u)<=u.range+.01)target=focused;const dist=distance(target,u);
   if(u.attacks===0&&dist<=u.range+.01)u.cd=Math.max(0,u.cd-STEP*haste);
   if(supportive){const remote=injured[0],inReach=injured.some(v=>distance(v,u)<=u.healRange+.01);if(remote&&!inReach)this.moveToward(u,remote.x,remote.y,u.healRange*.85,STEP);else if(dist<=u.range+.01){u.move=0;if(u.cd<=0&&this.attack(u,target))u.cd=u.rate}else{const anchors=this.alive('ally').filter(v=>v.id!==u.id&&!['support','medic','warder'].includes(v.type)).sort((a,b)=>distance(a,automaticTarget)-distance(b,automaticTarget)||a.id-b.id);if(anchors[0])this.moveToward(u,Math.max(75,anchors[0].x-105),anchors[0].y,30,STEP);else this.moveToward(u,automaticTarget.x,automaticTarget.y,u.range,STEP)}}
   else if(dist>u.range+.01)this.moveToward(u,target.x,target.y,u.range,STEP);else{u.move=0;if(u.cd<=0&&this.attack(u,target))u.cd=u.rate}
   if(u.maxMana>0)this.castUnitSkill(u.id);if(u.shield)this.castBarrier(u.id);
   const automaticDistance=distance(automaticTarget,u);
   if(u.type==='charger'&&u.skillCd<=0&&automaticDistance<finite(u.skill&&u.skill.range,150)&&automaticTarget.hp>0){const s=u.skill||{},damage=finite(s.damage,(u.attackPower*finite(s.attackCoefficient,1)+u.abilityPower*finite(s.coefficient,.6))*u.conditionMultiplier);this.telegraphs.push({owner:u,team:'ally',x:automaticTarget.x,y:automaticTarget.y,radius:s.radius||112,left:finite(s.windup,.45),max:finite(s.windup,.45),damage});this.effect('charge',u.x,u.y,automaticTarget.x,automaticTarget.y,'#eeaa52',.5);u.skillCd=s.cooldown||9;this.message='돌격병이 광역 타격을 펼칩니다!'}
   if((u.type==='boss'||u.type==='brute')&&u.skillCd<=0&&automaticDistance<150&&automaticTarget.hp>0){const boss=u.type==='boss';this.telegraphs.push({owner:u,team:'enemy',x:automaticTarget.x,y:automaticTarget.y,radius:boss?150:85,left:boss?2.1:1.5,max:boss?2.1:1.5,damage:u.attackPower*(boss?2:1.6)});u.skillCd=boss?9:12;this.message=boss?'파수꾼의 강타! 붉은 범위에 공격이 곧 떨어져요.':'방패병의 강타가 준비됩니다.'}
  }
  for(const list of [this.units,this.enemies]){const living=list.filter(u=>u.hp>0);for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){const a=living[i],b=living[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<32){const push=(32-d)*STEP*3,nx=d>.01?dx/d:0,ny=d>.01?dy/d:1;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push}}for(const u of living){u.x=clamp(u.x,75,830);u.y=clamp(u.y,128,477)}}
  this.tickCount++;this.time=this.tickCount*STEP;this.totalTime+=STEP;if(!this.alive('enemy').length)this.finish(true);else if(!this.alive('ally').length)this.finish(false);else if(this.tickCount>=ticksFor(LIMIT)){this.message='해가 저물었어요. 제한 시간 안에 돌파하지 못했습니다.';this.finish(false,'timeout')}return true;
 }
 finish(win,reason=''){
  if(this.phase!=='battle')return false;for(const u of [...this.units,...this.enemies])this.expireBarrier(u);const ok=legacyMethods.finish.call(this,win,reason);if(!ok)return false;
  const result=this.history[this.history.length-1];Object.assign(result,{combatRulesVersion:V09_RULES,statsMetadata:statMetaV09,synergySnapshot:clone(this.synergySnapshot),startingRoster:clone(this.startingRoster)});result.contributions.forEach(c=>{const u=this.units.find(v=>v.id===c.id);c.trainingTrack=u.trainingTrack;c.attackPower=u.attackPower;c.abilityPower=u.abilityPower;c.defense=u.defense});this.lastResult=clone(result);return true;
 }
 snapshot(){return {...legacyMethods.snapshot.call(this),combatRulesVersion:V09_RULES,statsMetadata:statMetaV09,startingRoster:clone(this.startingRoster),synergySnapshot:clone(this.synergySnapshot),formationLinks:clone(this.formationLinks),emergencyCaseUsed:this.emergencyCaseUsed}}
 spawn(){return null}
 reward(){return false}
}
// Preserve the public Game class and all old callers. Only an explicit version
// selects the new rules; merely loading new content cannot rebalance old saves.
for(const name of Object.getOwnPropertyNames(V09Rules.prototype)){
 if(name==='constructor')continue;const modern=V09Rules.prototype[name],old=legacyMethods[name];
 if(name==='configureBattle')Game.prototype[name]=function(config={}){return config&&config.combatRulesVersion===V09_RULES?modern.call(this,config):old.call(this,config)};
 else Game.prototype[name]=old?function(...args){return this.combatRulesVersion===V09_RULES?modern.apply(this,args):old.apply(this,args)}:modern;
}
Game.projectUnit=function(unit,options={}){if(options.combatRulesVersion!==V09_RULES)return legacyProjection.call(this,unit,options);const C=v09Content();return C&&typeof C.projectUnit==='function'?C.projectUnit(unit,options):null};
Game.typesForVersion=version=>version===V09_RULES&&v09Content()?v09Types():TYPES;

globalThis.TinyArmy={Game,TYPES,STAGES,STEP,LIMIT,CAP,get TRAINING(){return globalThis.TinyArmyContent&&globalThis.TinyArmyContent.TRAINING||TRAINING},SKILLS,ALLY_TYPES};
})();
