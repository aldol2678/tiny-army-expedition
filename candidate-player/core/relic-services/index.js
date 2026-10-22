import {allowsUnitFamily,validateSelectedRoster,relicFamilyEligibility} from '../family-selection/contract.js';
import {familyWeights,choosePool,weightedKey,WEIGHT_RULES} from './family-weight.js';
import {interestAmount,INTEREST_DESCRIPTION,INTEREST_RULES} from '../runtime/interest.js';
// Reconstructed pure, browser-safe candidate module. No global or external writes.
import {VERSION,RNG_NAMESPACE,LEGACY_RELIC_IDS,NEW_RELICS,NEW_RELIC_IDS,KEY_RELIC_IDS,RELIC_REGISTRY,MILESTONES,PRICES,FORGE_PRICES,LIMITS,clone,assert,canonical} from './registry.js';
import {TRAINING_ACCESS_VERSION,trainingAccessEnabled,serviceStock,preparationAddition} from './training-access.js';
export {TRAINING_ACCESS_VERSION} from './training-access.js';
import {createProjection} from './projection.js';
import {createResearch,normalizeResearch,RESEARCH_PRICE} from './strategy.js';
import {createProviderCapability,validateProviderCapability,validatePendingProvider} from './provider-capabilities.js';
export {PROVIDER_CAPABILITY_VERSION,PROVIDER_CAPABILITIES} from './provider-capabilities.js';
export {RESEARCH_VERSION,RESEARCH_PRICE,RESEARCH_VARIANTS,BASE_COMMANDS,normalizeResearch} from './strategy.js';
export {createCommandResearchAdapter,COMMAND_COMBAT_VERSION} from './command-combat.js';
export {VERSION,LEGACY_RELIC_IDS,NEW_RELICS,NEW_RELIC_IDS,KEY_RELIC_IDS,RELIC_REGISTRY,MILESTONES,PRICES,FORGE_PRICES,LIMITS};
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_.:-]{1,200}$/.test(id);
const get=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
const lowerBetter=field=>/Interval|cooldown|initialDelay|InitialDelay|manaCost/.test(field);
const fields=['maxHp','attackPower','abilityPower','defense','basicDamage','heal','guardianDefense','critChance','critDamage','manaRegen','range','attackInterval','healInterval','healInitialDelay','skill.damage','skill.secondaryDamage','shield.amount','shield.cooldown','shield.initialDelay','healRange','firstAttackMultiplier','primaryMultiplier','secondaryMultiplier','maxTargets','emergencyMultiplier','maxMana','startingMana','skill.manaCost','skill.cooldown','skill.defenseAfter','skill.slowDuration','shield.duration'];
export function createRelicServices(C,options={}) {
 const {digest,progressionCandidates,applyProgressionCandidate,targetKeyEligibility,awakeningTrainingCandidates,applyAwakeningTrainingCandidate,enablePreparedEvents=false,enableResearch=false,enableTrainingAccess=false}=options;
 assert(typeof digest==='function','Deterministic canonical digest required');
 const P=options.projection??createProjection(C,options),registry=P.RELICS,Q=createResearch(C,P);
 function snapshotOf(state){return clone({...(state.familySelection!==undefined?{familySelection:state.familySelection}:{}),roster:state.roster||[],relics:state.relics||[],skills:state.skills||[],unlocks:state.unlocks||{},chapter:state.chapter??1,battleCount:state.battleCount??0,xp:state.xp??0,targetRelicId:state.targetRelicId??null,awakening:state.awakening??null,prepared:state.prepared===true,campaignComplete:state.campaignComplete===true,research:normalizeResearch(state.research),supportedRelicIds:P.supportedRelicIds});}
 function checkState(state){
  validateSelectedRoster(state);
  assert(state&&Number.isSafeInteger(state.gold)&&state.gold>=0,'Invalid gold balance');
  assert(Array.isArray(state.roster)&&state.roster.length<=20&&Array.isArray(state.relics),'Roster/relic collection invalid');
  assert(new Set(state.roster.map(u=>u.id)).size===state.roster.length,'Duplicate unit ID');
  const deployed=state.roster.filter(C.isDeployed);assert(new Set(deployed.map(u=>u.slot)).size===deployed.length,'Duplicate formation slot');
  assert(deployed.length<=C.deploymentCap(state.xp||0),'Deployment cap exceeded');
  for(const u of state.roster){assert(Number.isFinite(u.condition)&&u.condition>=0&&u.condition<=100,'Invalid condition');P.projectUnit(u,{...snapshotOf(state),formation:false});}
  P.normalizeRelics(state.relics);normalizeResearch(state.research);assert(Array.isArray(state.skills)&&state.skills.length<=2&&new Set(state.skills).size===state.skills.length,'At most two distinct commands');return true;
 }
 function keyQualification(snapshot,id){
  if(!NEW_RELICS[id]?.key||snapshot.campaignComplete||!relicFamilyEligibility(snapshot,registry[id]).eligible)return [];
  if(typeof targetKeyEligibility==='function'){
   const result=targetKeyEligibility(snapshot,id);
   if(Array.isArray(result))return result.map(u=>typeof u==='object'?u.id:u);
   if(result&&typeof result==='object')return result.eligible===true?(result.unitIds||snapshot.roster.filter(u=>C.familyOf(u.type)===NEW_RELICS[id].family).map(u=>u.id)):[];
   return result===true?snapshot.roster.filter(u=>C.familyOf(u.type)===NEW_RELICS[id].family).map(u=>u.id):[];
  }
  return snapshot.roster.filter(u=>C.familyOf(u.type)===NEW_RELICS[id].family).map(u=>u.id);
 }
 function triggerConditions(id,snapshot){
  const units=snapshot.roster.filter(C.isDeployed),projected=units.map(u=>P.projectUnit(u,snapshot));
  if(id==='whistle')return [{id:'first_ally_knockout_with_survivor',possible:units.length>=2,guaranteed:false,perBattleLimit:1,description:'First allied knockout with a surviving basic attacker'}];
  if(id==='echo_crystal')return [{id:'third_successful_paid_spell',possible:projected.some(p=>p.family==='mage'&&p.skill?.manaCost>0&&p.manaRegen>0),guaranteed:false,description:'Every third paid spell; actual mana paid, clipped at max mana, no cooldown reset'}];
  if(id==='emergency_case')return [{id:'critical_successful_normal_heal',possible:projected.some(p=>p.heal>0),guaranteed:false,perBattleLimit:1,description:'Successful normal heal; target alive and at <=20% HP before healing; clipped at missing HP'}];
  return [];
 }
 function computePreview(state,id,{operation='acquire',target=false}={}){
  const snapshot=snapshotOf(state),definition=registry[id],owned=snapshot.relics.find(r=>r.id===id);
  const blocked=reason=>({version:VERSION,id,operation,valid:false,effective:false,currentUtility:false,futureUtility:false,qualification:false,classification:'invalid',reason,changes:[],gains:[],losses:[],costs:[],caps:[],conditions:[],limits:clone(LIMITS)});
  if(!definition)return blocked('Relic capability is not implemented');
  if(definition.acquisitionEnabled===false)return blocked('QA fixture only; acquisition and forging remain disabled');
  const familyGate=relicFamilyEligibility(snapshot,definition);if(!familyGate.eligible)return blocked(familyGate.reason);
  if(!['acquire','forge'].includes(operation))return blocked('Unknown preview operation');
  if(snapshot.campaignComplete)return blocked('No remaining battle or awakening use');
  if(operation==='acquire'&&owned)return blocked('Already owned; duplicate acquisition does not stack');
  if(operation==='forge'&&!owned)return blocked('Relic is not owned');
  if(id===INTEREST_RULES.relicId){if(!snapshot.roster.length)return blocked('No owned army for future battles');if(operation==='forge')return blocked('Economy relic cannot be forged');return {version:VERSION,id,name:definition.name,operation,valid:true,effective:true,currentUtility:interestAmount(state.gold??0)>0,futureUtility:true,classification:'economy',description:INTEREST_DESCRIPTION,economy:{rulesVersion:INTEREST_RULES.version,principal:state.gold??0,projectedVictoryInterest:interestAmount(state.gold??0),requiresVictory:true,requiresOwnershipAtStart:true},changes:[],gains:[],losses:[],costs:[],caps:[],conditions:[],limits:clone(LIMITS),result:{id,evolution:1},goldCost:0,afterRelics:[...snapshot.relics,{id,evolution:1}]};}
  if(operation==='forge'&&(owned.evolution??1)>=3)return blocked('Evolution III is maximum');
  if(!definition.baseUnlocked&&!C.hasUnlock(snapshot,'relics',definition.unlockId))return blocked('Relic is not unlocked');
  if(definition.requiredSkill&&!snapshot.skills.includes(definition.requiredSkill))return blocked('Required commander skill is not equipped');
  if(definition.requiredTimedCommand&&!snapshot.skills.some(id=>['guard','focus','rally'].includes(id)))return blocked('No timed commander skill equipped');
  const evolution=operation==='forge'?(owned.evolution??1)+1:1,incoming={id,evolution};
  const after={...snapshot,relics:operation==='forge'?snapshot.relics.map(r=>r.id===id?incoming:r):[...snapshot.relics,incoming]};
  const changes=[],costs=[],caps=[],conditions=triggerConditions(id,snapshot);
  const inspect=(unit,field,before,after)=>{if(Number.isFinite(before)&&Number.isFinite(after)&&Math.abs(after-before)>1e-9)changes.push({unitId:unit?.id??null,slot:unit?.slot??null,field,before,after,delta:after-before,benefit:lowerBetter(field)?after<before:after>before});};
  for(const unit of snapshot.roster.filter(C.isDeployed)){
   const a=P.projectUnit(unit,snapshot),b=P.projectUnit(unit,after);
   for(const field of fields){if(unit.type==='volley'&&['critChance','critDamage'].includes(field))continue;inspect(unit,field,get(a,field),get(b,field));}
   for(const e of b.ledger.filter(e=>e.sourceId===`relic:${id}`&&e.applied&&e.operation==='multiply_cost'))costs.push({unitId:unit.id,slot:unit.slot,field:e.affectedField,factor:e.value,remainsOnForge:operation==='forge'});
   for(const [field,modifier] of Object.entries(b.modifiers))if(modifier.capped>1e-9||modifier.relicFlatCapped>1e-9)caps.push({unitId:unit.id,field,...clone(modifier)});
  }
  const a=P.getRelicEffects(snapshot.relics,snapshot.skills),b=P.getRelicEffects(after.relics,snapshot.skills);a.commandSkills=Q.projectCommands(snapshot);b.commandSkills=Q.projectCommands(after);
  for(const command of snapshot.skills){if(command==='rally'&&a.commandSkills.rally.variantId==='charge_signal'&&!snapshot.roster.some(u=>C.isDeployed(u)&&C.familyOf(u.type)==='spear'))continue;inspect(null,`command.${command}.cooldown`,a.commandSkills[command]?.cooldown,b.commandSkills[command]?.cooldown);inspect(null,`command.${command}.duration`,a.commandSkills[command]?.duration,b.commandSkills[command]?.duration);}
  if(id==='quick_hourglass')for(const command of snapshot.skills.filter(id=>['guard','focus','rally'].includes(id)))costs.push({unitId:null,field:`command.${command}.duration`,factor:.8,remainsOnForge:operation==='forge'});
  if(conditions.every(c=>c.possible)){
   if(id==='whistle'){inspect(null,'whistleHaste',a.whistleHaste,b.whistleHaste);inspect(null,'whistleDuration',a.whistleDuration,b.whistleDuration);}
   if(id==='echo_crystal')inspect(null,'echoRefund',a.echoRefund,b.echoRefund);
   if(id==='emergency_case')inspect(null,'emergencyHeal',a.emergencyHeal,b.emergencyHeal);
  }
  const gains=changes.filter(c=>c.benefit),losses=changes.filter(c=>!c.benefit),qualificationUnits=operation==='acquire'?keyQualification(snapshot,id):[];
  const currentUtility=snapshot.roster.some(C.isDeployed)&&gains.length>0&&conditions.every(c=>c.possible),qualification=qualificationUnits.length>0,futureUtility=target&&qualification&&!currentUtility,valid=currentUtility||futureUtility;
  return {version:VERSION,id,name:definition.name,operation,target,fromEvolution:owned?.evolution??null,toEvolution:evolution,valid,effective:currentUtility,currentUtility,futureUtility,qualification,qualificationUnits,classification:!valid?'invalid':!currentUtility?'future-qualification-only':costs.length||losses.length?'conditional-tradeoff':conditions.length?'conditional-effect':'pure-improvement',reason:valid?'':conditions.some(c=>!c.possible)?'Trigger cannot occur with current deployed roster':'No effective improvement after conditions and caps',changes,gains,losses,costs,caps,conditions,limits:clone(LIMITS),beforeRelics:clone(snapshot.relics),afterRelics:clone(after.relics),result:incoming,goldCost:operation==='forge'?FORGE_PRICES[owned.evolution??1]:0,remainingOpportunity:'until-campaign-end',futureInstruction:futureUtility?'Deploy the matching reserve and independently satisfy the complete second-class/two-skill and matching-key prerequisites between battles':null,comparison:'Same roster, starting slots, training, commands and condition; not win-rate or net-power prediction'};
 }
 const cache=new Map();
 function previewRelic(state,id,config={}){const key=digest([snapshotOf(state),state.gold??0,id,config]);if(!cache.has(key)){if(cache.size>1500)cache.clear();cache.set(key,computePreview(state,id,config));}return clone(cache.get(key));}
 function eligibleRelics(state,rarity=null){return Object.keys(registry).sort().filter(id=>(!rarity||registry[id].intrinsicRarity===rarity)&&(!NEW_RELICS[id]?.key||keyQualification(snapshotOf(state),id).length>0)&&previewRelic(state,id).valid);}
 function growthCandidates(state){const snapshot=snapshotOf(state);return clone(typeof progressionCandidates==='function'?progressionCandidates(snapshot):C.troopCandidates(snapshot.roster,20,snapshot).filter(c=>c.kind!=='recruit')).filter(c=>allowsUnitFamily(snapshot,c.type)).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);}
 function recruitCandidates(state){const snapshot=snapshotOf(state);return clone(C.troopCandidates(snapshot.roster,20,snapshot)).filter(c=>c.kind==='recruit'&&allowsUnitFamily(snapshot,c.type));}
 function pass(category,reason){return {id:`pass:${category}`,kind:'pass',category,reason,goldCost:0};}
 function relicCandidate(state,id,target=false){return {id:`relic:${id}`,category:'relic',kind:'relic',name:registry[id].name,rarity:registry[id].intrinsicRarity,relic:{id,evolution:1},preview:previewRelic(state,id,{target}),target,goldCost:0};}
 function targetCandidates(state){const s=snapshotOf(state);return KEY_RELIC_IDS.filter(id=>registry[id]&&keyQualification(s,id).length&&previewRelic(s,id,{target:true}).valid).map(id=>relicCandidate(s,id,true));}
 function sampleRelic(snapshot,random,rarity,used=new Set()){
  const poolKind=choosePool(random()),selection=random();
  if(poolKind==='key'){
   const pool=KEY_RELIC_IDS.filter(id=>registry[id]&&!used.has(`relic:${id}`)&&keyQualification(snapshot,id).length&&previewRelic(snapshot,id,{target:true}).valid).map(id=>({id,family:NEW_RELICS[id].family}));
   const id=weightedKey(pool,familyWeights(snapshot),selection);
   if(id)return {...relicCandidate(snapshot,id,true),acquisitionPool:'key',familyWeightVersion:WEIGHT_RULES.version};
   // An empty key pool falls back to the ordinary rarity roll, without another gate or draw.
  }
  const pool=eligibleRelics(snapshot,rarity).filter(id=>!NEW_RELICS[id]?.key&&!used.has(`relic:${id}`)),id=pool[Math.floor(selection*pool.length)];
  return id?{...relicCandidate(snapshot,id),acquisitionPool:'ordinary',familyWeightVersion:WEIGHT_RULES.version}:{...pass('relic',`No eligible ${rarity} ordinary relic; no substitute`),rarity,acquisitionPool:'ordinary'};
 }
 function reservedCandidate(role,snapshot){
  assert(role!=='target','Retired fixed-target reward role');
  const growth=growthCandidates(snapshot),match=role==='evolve'?growth.find(c=>c.kind==='evolve'):role==='train-I'?growth.find(c=>c.kind==='train'&&c.training===1):role==='train-II'?growth.find(c=>c.kind==='train'&&c.training===2):null;
  return ['evolve','train-I','train-II'].includes(role)?{...(match?{...match,category:'growth'}:pass('growth','No eligible reserved growth; no substitute grant')),reserved:true}:null;
 }
 function randomFor(seed){let count=0;const draw=()=>Number.parseInt(digest([RNG_NAMESPACE,seed,count++]).slice(0,8),16)/2**32;draw.count=()=>count;return draw;}
 function makeReward(state,node){
  const number=state.battleCount,role=node.rewardRole;assert(Number.isInteger(number)&&number>=1&&!state.campaignComplete,'Only nonfinal victories have a reward');assert(['mixed','evolve','train-I','train-II','relic-only'].includes(role),'Explicit nonfinal node rewardRole required');assert(validId(state.runId),'Stable run ID required');
  assert(node.encounterKind===undefined||['normal','elite','boss'].includes(node.encounterKind),'Invalid event encounter rarity kind');
  if(node.kind==='event')assert(role==='mixed'&&node.milestoneOrigin==='event'&&['normal','elite','boss'].includes(node.encounterKind),'Event fights have only explicit ordinary mixed rewards');
  const rarityKind=node.kind==='event'?node.encounterKind:node.kind;
  const snapshot=snapshotOf(state),id=`${state.runId}:${VERSION}:reward:${number}`,relicOnly=role==='relic-only',reserved=reservedCandidate(role,snapshot);
  function generate(reroll){const random=randomFor([String(state.seed),state.profileId||'reconstructed-three-relic-trial',number,reroll]),used=new Set(),candidates=[];
   for(let slot=0;slot<3;slot++){let candidate;
    if(slot===0&&reserved)candidate=clone(reserved);
    else{const category=relicOnly?'relic':['recruit','growth','relic'][Math.floor(random()*3)];
     if(category==='relic'){const rarity=C.rollRarity(random,snapshot.chapter,rarityKind==='boss'?8:Math.floor(node.row)-1,rarityKind);candidate=sampleRelic({...snapshot,gold:state.gold},random,rarity,used);}
     else{const pool=(category==='growth'?growthCandidates(snapshot):recruitCandidates(snapshot)).filter(c=>!used.has(c.id)),selection=random();candidate=pool.length?{...pool[Math.floor(selection*pool.length)],category,goldCost:0}:pass(category,'No eligible candidate; fixed zero-value fallback');}
    }
    if(candidate.kind!=='pass')used.add(candidate.id);candidates.push({...candidate,slot,candidateId:candidate.reserved?`${id}:reserved`:`${id}:${reroll}:${slot}`});
   }return {candidates,draws:random.count()};
  }
  const original=generate(0),reroll=generate(1),reward={id,battleNumber:number,rewardRole:role,sourceNode:{id:node.id,kind:node.kind,row:node.row,rewardRole:role,...(node.kind==='event'?{encounterKind:node.encounterKind,milestoneOrigin:'event'}:{})},...(node.kind==='event'?{milestoneOrigin:'event'}:{}),mode:relicOnly?'relic-only-replacement':'mixed',selectionBudget:1,snapshot,snapshotHash:digest(snapshot),original:original.candidates,reroll:reroll.candidates,rngCounters:[original.draws,reroll.draws],rerolled:false,contentVersion:VERSION,rarityVersion:'pinned-v09-rollRarity',fallback:'pass-zero-value'};
  reward.offerHash=digest({...reward,rerolled:false});return reward;
 }
 function visibleReward(reward){return clone(reward.rerolled?reward.reroll:reward.original);}
 function assignSlot(state,type){if(state.roster.filter(C.isDeployed).length>=C.deploymentCap(state.xp||0))return null;const order=C.familyOf(type)==='spear'?[...Array(12).keys()]:[8,9,10,11,4,5,6,7,0,1,2,3];return order.find(slot=>!state.roster.some(u=>u.slot===slot))??null;}
 function applyCandidate(state,candidate){let next=clone(state);const before=snapshotOf(state);
  if(candidate.kind==='relic'){assert(previewRelic(state,candidate.relic.id,{target:candidate.target===true}).valid,'Relic no longer eligible');next.relics.push(clone(candidate.relic));}
  else if(candidate.kind==='recruit'){const allowed=recruitCandidates(state).find(c=>c.id===candidate.id);assert(allowed&&allowed.type===candidate.type&&allowed.count===candidate.count,'Recruitment no longer eligible');next.nextUnitId??=Math.max(0,...next.roster.map(u=>u.id))+1;for(let i=0;i<candidate.count;i++){const slot=assignSlot(next,candidate.type);next.roster.push({id:next.nextUnitId++,type:candidate.type,training:0,trainingTrack:null,slot,condition:100});}}
  else if(['evolve','train'].includes(candidate.kind)){const allowed=growthCandidates(state).find(c=>c.id===candidate.id);assert(allowed&&['unitId','type','training','trainingTrack','secondClassId'].every(key=>allowed[key]===candidate[key]),'Growth no longer eligible');
   if(typeof applyProgressionCandidate==='function'){const applied=applyProgressionCandidate(next,{...clone(allowed),...(candidate.candidateId?{candidateId:candidate.candidateId}:{})});next=applied.state||applied;}
   else{const unit=next.roster.find(u=>u.id===candidate.unitId);if(candidate.kind==='evolve')unit.type=candidate.type;else{unit.training=candidate.training;unit.trainingTrack=candidate.trainingTrack;}}
  }else assert(false,'Unsupported candidate kind');
  checkState(next);return {state:next,receipt:{candidate:clone(candidate),before,after:snapshotOf(next)}};
 }
 function validateReward(state,reward){assert(reward?.contentVersion===VERSION&&reward.selectionBudget===1&&reward.battleNumber===state.battleCount,'Invalid reward/version/battle');const {offerHash,...payload}=reward;assert(digest({...payload,rerolled:false})===offerHash,'Stored reward offers changed');assert(digest(reward.snapshot)===reward.snapshotHash&&digest(snapshotOf(state))===reward.snapshotHash,'Reward snapshot changed; saved candidates remain');assert(reward.original.length===3&&reward.reroll.length===3,'Three saved reward slots required');}
 function applyRewardChoice(state,reward,candidateId=null){validateReward(state,reward);if(candidateId===null)return {state:clone(state),receipt:{rewardId:reward.id,choice:null,goldCost:0,xp:0,selectionBudgetUsed:1}};const candidate=visibleReward(reward).find(c=>c.candidateId===candidateId);assert(candidate&&candidate.kind!=='pass','Unavailable reward; pass explicitly');if(candidate.relic&&NEW_RELICS[candidate.relic.id]?.key)assert(keyQualification(snapshotOf(state),candidate.relic.id).length,'Key has no owned matching family');const result=applyCandidate(state,candidate);return {state:result.state,receipt:{...result.receipt,rewardId:reward.id,choice:clone(candidate),goldCost:0,xp:0,selectionBudgetUsed:1}};}
 function applyReroll(state,reward){validateReward(state,reward);assert(!reward.rerolled,'Only one reroll permitted');assert(state.gold>=5,'Reroll requires 5G');const next=clone(state),updated=clone(reward);next.gold-=5;updated.rerolled=true;return {state:next,reward:updated,receipt:{rewardId:reward.id,goldCost:5,xp:0,previouslyStoredCandidates:true}};}
 function conditionChanges(snapshot,amount){return snapshot.roster.map(u=>{const after=Math.max(0,Math.min(100,u.condition+amount));return {unitId:u.id,before:u.condition,after,delta:after-u.condition};});}
 function paidTrainingCandidates(state){
  return growthCandidates(state).filter(c=>c.kind==='train').map(candidate=>{
   const unit=state.roster.find(u=>u.id===candidate.unitId),trained={...unit,training:candidate.training,trainingTrack:candidate.trainingTrack,...(candidate.secondClassId?{secondClassId:candidate.secondClassId}:{})};
   const before=P.projectUnit(unit,state),after=P.projectUnit(trained,{...state,roster:state.roster.map(u=>u.id===unit.id?trained:u)}),changes=[];
   for(const field of fields){const a=get(before,field),b=get(after,field);if(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)>1e-9)changes.push({field,before:a,after:b,delta:b-a,benefit:lowerBetter(field)?b<a:b>a});}
   const progressionChanges=candidate.secondClassId&&unit.secondClassId!==candidate.secondClassId&&typeof applyProgressionCandidate==='function'?[{field:'secondClassId',before:unit.secondClassId??null,after:candidate.secondClassId,benefit:true}]:[];
   const valid=(changes.some(c=>c.benefit)||progressionChanges.length>0)&&!state.campaignComplete;
   return {...candidate,name:C.TRAINING.tracks[unit.type][candidate.trainingTrack].name,targetId:unit.id,targetName:`${C.TYPES[unit.type].name} #${unit.id}`,description:C.TRAINING.tracks[unit.type][candidate.trainingTrack].description,kind:'train',price:30,goldCost:30,disabled:!valid,reason:valid?'':'No effective training improvement',preview:{unitId:unit.id,fromTraining:unit.training,toTraining:candidate.training,trainingTrack:candidate.trainingTrack,secondClassId:candidate.secondClassId??null,changes,progressionChanges,limits:clone(LIMITS),scope:'owned-unit-only',xp:0}};
  });
 }
 function preparationCandidates(state){
  if(typeof awakeningTrainingCandidates!=='function'||typeof applyAwakeningTrainingCandidate!=='function')return [];
  return awakeningTrainingCandidates(state).map(c=>{const u=state.roster.find(u=>u.id===c.unitId);return {...c,kind:'awakening-training',name:'개인 각성 훈련',targetId:u.id,targetName:`${C.TYPES[u.type].name} #${u.id}`,price:60,goldCost:60,description:'병사 개인의 각성 준비를 완료합니다. 기본 능력치는 변하지 않으며, 실제 각성에는 계열 열쇠가 별도로 필요합니다.',preview:{unitId:u.id,changes:[],progressionChanges:[{field:'awakeningTraining',before:false,after:true,benefit:true}],keyRequiredForPurchase:false,keyConsumed:false,basicStatsChanged:false,trainingRankChanged:false,trialPrice:true,scope:'owned-individual-only',xp:0}};});
 }
 const isShop=node=>['shop','target_shop'].includes(node.kind);
 const serviceKind=(node,capability=null,chapter=capability?.chapter)=>capability?validateProviderCapability(capability,node,chapter):node.kind;
 const isBounded=(node,capability=null)=>isShop(node)||serviceKind(node,capability)==='training';
 const stockPurchase=(c,access=false)=>c.kind==='buy'||c.kind==='awakening-training'||access&&c.kind==='train';
 const stockBudget=(node,stock,access=false)=>isShop(node)||access?stock.filter(c=>stockPurchase(c,access)).length:stock.filter(c=>c.kind==='awakening-training').length+1;
 function derivedPreparationAdditions(offer){
  const additions=[],known=new Set(offer.stock.filter(c=>c.kind==='awakening-training').map(c=>c.unitId));
  for(const receipt of offer.purchaseReceipts){
   if(receipt.choice.kind!=='train')continue;
   const before=new Set(preparationCandidates(receipt.effect.before).map(c=>c.unitId));
   const candidate=preparationCandidates(receipt.effect.after).find(c=>c.unitId===receipt.choice.unitId&&!before.has(c.unitId)&&!known.has(c.unitId));
   if(candidate){additions.push(preparationAddition(offer,receipt.choice.candidateId,candidate,additions.length));known.add(candidate.unitId);}
  }
  return additions;
 }
 function makeServiceOffer(state,node){return buildServiceOffer(state,node,null);}
 function makeProviderOffer(state,node,context){return buildServiceOffer(state,node,createProviderCapability(state,node,context));}
 function buildServiceOffer(state,node,providerCapability){
  assert(['shop','target_shop','forge','rest','event','lab','training'].includes(node.kind),'Not a functional service node');assert(validId(state.runId),'Stable run ID required');
  const kind=serviceKind(node,providerCapability,state.chapter);
  const descriptiveId=`${state.runId}:${VERSION}:service:c${state.chapter}:${node.id}${providerCapability?':'+providerCapability.eventId:''}`;
  // Preserve short historical IDs. The disjoint digest namespace binds the full
  // source without truncation and leaves room for slot and progression prefixes.
  const id=descriptiveId.length>200?`service:${digest({namespace:'pi1-bounded-service-id-1',runId:state.runId,contentVersion:VERSION,chapter:state.chapter,node:clone(node),providerCapability})}`:descriptiveId;
  const snapshot=snapshotOf(state),random=randomFor([String(state.seed),state.chapter,node.id,'service']),choices=[];
  const add=candidate=>choices.push({...candidate,affordable:state.gold>=(candidate.price??0),affordabilityReason:state.gold>=(candidate.price??0)?'':`Requires ${candidate.price}G; current balance ${state.gold}G`,candidateId:`${id}:${choices.length}`,slot:choices.length});
  assert(node.kind!=='target_shop','Retired target shop');
  if(node.kind==='shop'){

   const recruits=recruitCandidates(snapshot),training=growthCandidates(snapshot).filter(c=>c.kind==='train');
   if(recruits.length){const c=recruits[Math.floor(random()*recruits.length)];add({...c,kind:'buy',purchaseKind:'recruit',price:20,goldCost:20});}
   if(training.length){const c=training[Math.floor(random()*training.length)];add({...c,kind:'buy',purchaseKind:'train',price:30,goldCost:30});}
   const used=new Set(choices.map(c=>c.relic?.id));
   const relicSlots=node.randomRelicSlots??2;assert([2,3].includes(relicSlots),'Invalid random relic stock count');
   for(let i=0;i<relicSlots;i++){const rarity=C.rollRarity(random,state.chapter,Math.floor(node.row)-1,'normal'),c=sampleRelic({...snapshot,gold:state.gold},random,rarity,new Set([...used].map(id=>`relic:${id}`)));if(c.kind==='relic'){add({...c,kind:'buy',purchaseKind:'relic',price:PRICES[c.rarity],goldCost:PRICES[c.rarity]});used.add(c.relic.id);}else add({...c,disabled:true});}
  }else if(kind==='lab'){
   if(enableResearch)for(const candidate of Q.researchCandidates(snapshot))add(candidate);
   else add({...pass('research','Command research combat consumer not enabled'),disabled:true});
  }else if(kind==='training'){
   for(const candidate of paidTrainingCandidates(snapshot))add(candidate);
   for(const candidate of preparationCandidates(state))add(candidate);
  }else if(kind==='forge'){
   for(const relic of snapshot.relics){const preview=previewRelic(snapshot,relic.id,{operation:'forge'});add({id:`forge:${relic.id}`,kind:'forge',relicId:relic.id,targetId:relic.id,targetName:registry[relic.id]?.name,name:registry[relic.id]?.name,preview,price:preview.goldCost??0,goldCost:preview.goldCost??0,disabled:!preview.valid,reason:preview.reason});}
  }else if(kind==='rest')add({id:'rest:20',kind:'rest',name:'선택 휴식',conditionDelta:20,price:0,goldCost:0});
  else{
   if(state.chapter===1){add({id:'event:E01:shade',kind:'event',name:'그늘에서 쉬기',eventId:'E01',conditionDelta:18,price:0,goldCost:0});if(enablePreparedEvents)add({id:'event:E01:scout',kind:'event',name:'정찰하기',eventId:'E01',conditionDelta:-5,prepared:true,price:0,goldCost:0});}
   else if(state.chapter===2)add({...pass('event','E02 currency grant is disabled in the earned-combat-income candidate'),eventId:'E02',disabled:true});
   else if(state.chapter===3)add({id:'event:E04:information',kind:'event',name:'계열 보정 안내',eventId:'E04',informationOnly:true,familyWeights:familyWeights(snapshot),probabilityTrial:WEIGHT_RULES,price:0,goldCost:0});
   else if(state.chapter===4&&enablePreparedEvents)add({id:'event:E07:meal',kind:'event',name:'식사와 점검',eventId:'E07',conditionDelta:10,prepared:true,price:8,goldCost:8});
   else if(state.chapter===5){const effective=conditionChanges(snapshot,20).some(c=>c.delta>0);add({id:'event:E08:clinic',kind:'event',name:'전원 치료받기',eventId:'E08',conditionDelta:20,price:10,goldCost:10,disabled:!effective,reason:effective?'':'No condition recovery available when everyone is at 100'});}
   else add({...pass('event','Command research/prepared combat consumer not enabled'),disabled:true});
  }
  for(const c of choices)if(c.conditionDelta!==undefined)c.actualConditionChanges=conditionChanges(snapshot,c.conditionDelta);
  add({id:'leave',kind:'leave',name:'무료 직행',price:0,goldCost:0});
  const shop=isBounded(node,providerCapability),offer={id,...(providerCapability?{providerCapability}:{}),contentVersion:VERSION,node:clone(node),chapter:state.chapter,snapshot,snapshotHash:digest(snapshot),choices,rngCounter:random.count(),selectionBudget:shop?stockBudget(node,choices,enableTrainingAccess&&kind==='training'):1,visitGrantsNothing:true,xp:0,multiPurchase:shop};
  if(shop){if(enableTrainingAccess&&kind==='training')offer.trainingAccess={version:TRAINING_ACCESS_VERSION,preparationAdditions:[]};offer.stock=clone(choices);offer.stockHash=digest({id,node:offer.node,chapter:offer.chapter,stock:offer.stock});offer.purchasedCandidateIds=[];offer.purchaseReceipts=[];offer.choices=shopChoices(state,offer);}
  offer.offerHash=digest(offer);return offer;
 }
 function shopChoices(state,offer){
  return serviceStock(offer,state).map(item=>{
   const c=clone(item);let reason=c.disabled?c.reason||c.preview?.reason||'Unavailable fixed stock':'';
   if(offer.purchasedCandidateIds.includes(c.candidateId))reason='Already purchased; this stock never replenishes';
   else if(c.kind==='awakening-training'){if(!preparationCandidates(state).some(x=>x.id===c.id&&x.unitId===c.unitId))reason='Individual preparation no longer eligible; no replacement stock';}
   else if(c.kind==='train'){const p=paidTrainingCandidates(state).find(x=>x.id===c.id);if(!p||p.disabled)reason=p?.reason||'Training prerequisites changed; no replacement stock';if(p)c.preview=p.preview;}
   else if(c.kind==='buy'){
    if(c.purchaseKind==='relic'){const p=previewRelic(state,c.relic.id,{target:c.target===true});if(!p.valid)reason=p.reason;c.preview=p;}
    else if(c.purchaseKind==='train'){const p=paidTrainingCandidates(state).find(x=>x.id===c.id);if(!p||p.disabled)reason=p?.reason||'Training prerequisites changed; no replacement stock';if(p)c.preview=p.preview;}
    else if(c.purchaseKind==='recruit'){if(!recruitCandidates(state).some(x=>x.id===c.id&&x.type===c.type&&x.count===c.count))reason='Recruitment no longer eligible';}
    else reason='Unknown fixed stock type';
   }
   c.disabled=!!reason;if(reason)c.reason=reason;else delete c.reason;
   c.affordable=state.gold>=(c.price??0);c.affordabilityReason=c.affordable?'':`Requires ${c.price}G; current balance ${state.gold}G`;return c;
  });
 }
 function validateServiceOffer(state,offer){
  checkState(state);assert(offer?.contentVersion===VERSION&&offer.chapter===state.chapter,'Invalid service offer');
  assert(offer.providerCapability||!state.pendingService?.providerCapability,'Registered provider capability cannot be removed');
  const kind=offer.providerCapability?validatePendingProvider(state,offer.node,offer.providerCapability,offer):serviceKind(offer.node);
  const shop=isBounded(offer.node,offer.providerCapability),access=enableTrainingAccess&&kind==='training';assert(trainingAccessEnabled(offer)===access&&(access||offer.trainingAccess===undefined),'Training access capability mismatch');if(access)assert(canonical(offer.trainingAccess.preparationAdditions)===canonical(derivedPreparationAdditions(offer)),'Preparation additions differ from paid training receipts');assert(offer.multiPurchase===shop&&(shop?Number.isInteger(offer.selectionBudget)&&offer.selectionBudget>=0:offer.selectionBudget===1),'Invalid service budget');
  if(shop){assert(digest({id:offer.id,node:offer.node,chapter:offer.chapter,stock:offer.stock})===offer.stockHash,'Frozen stock changed');assert(Array.isArray(offer.purchasedCandidateIds)&&new Set(offer.purchasedCandidateIds).size===offer.purchasedCandidateIds.length&&offer.purchaseReceipts.length===offer.purchasedCandidateIds.length,'Invalid stock purchase ledger');assert(offer.purchasedCandidateIds.every((id,i)=>serviceStock(offer,state).some(c=>c.candidateId===id&&stockPurchase(c,access))&&offer.purchaseReceipts[i].choice.candidateId===id),'Stock receipt identity mismatch');assert(offer.selectionBudget===stockBudget(offer.node,serviceStock(offer,state),access),'Stock budget changed');assert(canonical(offer.choices)===canonical(shopChoices(state,offer)),'Stock availability differs from current state');}const {offerHash,...payload}=offer;assert(digest(payload)===offerHash,'Stored service offers changed');assert(digest(offer.snapshot)===offer.snapshotHash&&digest(snapshotOf(state))===offer.snapshotHash,'Service snapshot changed');
  return {kind,shop,access};
 }
 function applyServiceAction(state,offer,action){
  const {kind,shop,access}=validateServiceOffer(state,offer);
  const candidate=action.type==='leave'?offer.choices.find(c=>c.kind==='leave'):action.candidateId?offer.choices.find(c=>c.candidateId===action.candidateId):action.type==='rest'?offer.choices.find(c=>c.kind==='rest'):null;
  assert(candidate&&candidate.kind!=='pass'&&!candidate.disabled&&action.type===candidate.kind,'Unavailable service action');assert(Number.isSafeInteger(candidate.price)&&candidate.price>=0&&state.gold>=candidate.price,`Service requires ${candidate.price}G`);
  const facilityKinds={training:['train','awakening-training','leave'],forge:['forge','leave'],lab:['research','leave']};
  if(facilityKinds[kind])assert(facilityKinds[kind].includes(candidate.kind)&&candidate.conditionDelta===undefined&&!candidate.prepared,'Action is outside the registered facility capability');
  if(candidate.kind==='leave')assert(candidate.price===0,'Leaving a service is free');
  let next=clone(state),effect=null;
  if(candidate.kind==='buy'){assert(isShop(offer.node)&&candidate.price===(candidate.purchaseKind==='relic'?PRICES[registry[candidate.relic?.id]?.intrinsicRarity]:candidate.purchaseKind==='recruit'?20:candidate.purchaseKind==='train'?30:-1),'Invalid shop item or price');if(candidate.relic&&NEW_RELICS[candidate.relic.id]?.key)assert(keyQualification(snapshotOf(next),candidate.relic.id).length,'Key has no owned matching family');const applied=applyCandidate(next,{...candidate,kind:candidate.purchaseKind});next=applied.state;effect=applied.receipt;}
  else if(candidate.kind==='awakening-training'){assert(kind==='training'&&typeof applyAwakeningTrainingCandidate==='function'&&preparationCandidates(next).some(c=>c.id===candidate.id&&c.unitId===candidate.unitId)&&candidate.price===60,'Individual preparation requires eligible training facility stock and60G');const applied=applyAwakeningTrainingCandidate(next,candidate,offer.node,offer.providerCapability??null);next=applied.state||applied;effect=applied.receipt;}
  else if(candidate.kind==='research'){assert(enableResearch&&kind==='lab'&&candidate.price===RESEARCH_PRICE,'Research consumer or laboratory unavailable');const applied=Q.applyResearch(next,candidate,offer.node,offer.providerCapability??null);next=applied.state;effect=applied.receipt;}
  else if(candidate.kind==='train'){assert(kind==='training'&&candidate.price===30&&paidTrainingCandidates(next).some(c=>c.id===candidate.id&&!c.disabled),'Training no longer effective');const applied=applyCandidate(next,candidate);next=applied.state;effect=applied.receipt;}
  else if(candidate.kind==='forge'){assert(kind==='forge','Forge action requires an actual or registered forge provider');const preview=previewRelic(next,candidate.relicId,{operation:'forge'});assert(preview.valid&&preview.effective&&preview.goldCost===candidate.price,'Forge saturated, ineligible or stale');next.relics=preview.afterRelics;effect=preview;}
  else if(candidate.conditionDelta!==undefined){effect=conditionChanges(snapshotOf(next),candidate.conditionDelta);for(const change of effect)next.roster.find(u=>u.id===change.unitId).condition=change.after;}
  if(candidate.prepared){assert(enablePreparedEvents,'Prepared battle consumer unavailable');next.prepared=true;}
  assert(!candidate.goldGrant,'Services cannot create currency');next.gold=next.gold-candidate.price;checkState(next);
  const receipt={serviceId:offer.id,nodeId:offer.node.id,kind:offer.node.kind,...(offer.providerCapability?{providerCapability:clone(offer.providerCapability)}:{}),action:clone(action),choice:clone(candidate),goldCost:candidate.price,goldGranted:0,xp:0,effect,selectionBudgetUsed:1};
  let remainingOffer=null;
  if(shop&&stockPurchase(candidate,access)){
   assert(!offer.purchasedCandidateIds.includes(candidate.candidateId),'Stock item already purchased');
   remainingOffer=clone(offer);delete remainingOffer.offerHash;remainingOffer.purchasedCandidateIds.push(candidate.candidateId);remainingOffer.purchaseReceipts.push(clone(receipt));if(access){remainingOffer.trainingAccess.preparationAdditions=derivedPreparationAdditions(remainingOffer);remainingOffer.selectionBudget=stockBudget(offer.node,serviceStock(remainingOffer,next),true);}remainingOffer.snapshot=snapshotOf(next);remainingOffer.snapshotHash=digest(remainingOffer.snapshot);remainingOffer.choices=shopChoices(next,remainingOffer);remainingOffer.offerHash=digest(remainingOffer);
  }
  return {state:next,receipt,offer:remainingOffer,closed:remainingOffer===null};
 }
 const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&canonical(Object.keys(value).sort())===canonical([...keys].sort());
 function validateEventGrant(state,grant){
  checkState(state);assert(!state.campaignComplete,'Campaign has ended');
  assert(Number.isSafeInteger(state.xp)&&state.xp>=0&&Number.isInteger(state.chapter)&&state.chapter>=1&&state.chapter<=5,'Invalid event state counters');
  assert(state.roster.every(u=>Number.isSafeInteger(u.id)&&u.id>0),'Invalid event unit ID');
  assert(state.battleCount===undefined||Number.isSafeInteger(state.battleCount)&&state.battleCount>=0,'Invalid event battle counter');
  assert(state.nextUnitId===undefined||Number.isSafeInteger(state.nextUnitId)&&state.nextUnitId>Math.max(0,...state.roster.map(u=>u.id)),'Invalid next event unit ID');
  assert(grant&&typeof grant==='object'&&!Array.isArray(grant),'Invalid fixed event grant');
  if(grant.kind==='relic'){
   assert(exactKeys(grant,['kind','relic'])&&exactKeys(grant.relic,['id','evolution'])&&validId(grant.relic.id)&&grant.relic.evolution===1,'Event relic grant must declare exactly one evolution-I relic');
   assert(eligibleRelics(state).includes(grant.relic.id),'Fixed event relic is owned, locked, unsupported, or currently ineffective');
   return {valid:true,reason:'',kind:'relic',relic:clone(grant.relic),preview:previewRelic(state,grant.relic.id)};
  }
  assert(grant.kind==='recruit'&&exactKeys(grant,['kind','type','count','training','trainingTrack','condition','slot'])&&['charger','guardian','sniper','volley'].includes(grant.type)&&grant.count===1&&grant.training===0&&grant.trainingTrack===null&&grant.condition===100&&grant.slot===null,'Event captive must be one untrained, healthy approved first-class reserve');
  assert(C.TYPES[grant.type]&&state.roster.length<20,'Owned roster cap20 reached or captive unsupported');
  assert(allowsUnitFamily(state,grant.type),'Captive family was not selected for this expedition');
  const nextId=state.nextUnitId??Math.max(0,...state.roster.map(u=>u.id))+1;
  assert(Number.isSafeInteger(nextId)&&nextId>Math.max(0,...state.roster.map(u=>u.id))&&Number.isSafeInteger(nextId+1),'Invalid next event unit ID');
  return {valid:true,reason:'',kind:'recruit',type:grant.type,count:1,plannedSlot:null,unitId:nextId};
 }
 function previewEventGrant(state,grant){try{return clone(validateEventGrant(state,grant));}catch(error){return {valid:false,reason:error.message};}}
 function applyEventGrant(state,grant,context){
  assert(exactKeys(context,['eventId','choiceId'])&&validId(context.eventId)&&validId(context.choiceId),'Event grant source identity required');
  const preview=validateEventGrant(state,grant),next=clone(state);
  if(grant.kind==='relic')next.relics.push(clone(grant.relic));
  else{next.roster.push({id:preview.unitId,type:grant.type,training:0,trainingTrack:null,condition:100,slot:null});next.nextUnitId=preview.unitId+1;}
  checkState(next);
  return {state:next,receipt:{kind:'event-grant',eventId:context.eventId,choiceId:context.choiceId,grant:clone(grant),unitId:preview.unitId??null,goldCost:0,goldGranted:0,xp:0,unlocksGranted:false,preparationGranted:false,awakeningGranted:false}};
 }
 function chooseRewardCandidate(reward,state,policy='balanced'){
  assert(['troop-first','relic-first','balanced'].includes(policy),'Unknown policy');const offers=visibleReward(reward).filter(c=>c.kind!=='pass');
  const score=c=>{if(c.reserved&&c.target)return -100;if(policy==='relic-first')return c.kind==='relic'?0:['evolve','train'].includes(c.kind)?1:2;if(policy==='troop-first')return c.kind==='recruit'&&state.roster.length<9?0:['evolve','train'].includes(c.kind)?1:c.kind==='relic'?2:3;if(c.reserved&&['evolve','train'].includes(c.kind))return -20;if(c.kind==='recruit'&&state.roster.length<C.deploymentCap(state.xp))return 0;return ['evolve','train'].includes(c.kind)?1:c.kind==='relic'?2:3;};
  offers.sort((a,b)=>score(a)-score(b)||a.slot-b.slot);return offers[0]?.candidateId??null;
 }
 function createSession(state,{reward=null,service=null}={}){checkState(state);assert(!(reward&&service),'Only one pending decision');return {version:VERSION,revision:0,state:clone(state),reward:clone(reward),service:clone(service),ledger:[],receipts:[]};}
 function transition(session,action,transactionId,expectedRevision=session.revision){
  assert(session.version===VERSION&&validId(transactionId),'Invalid session/version/transaction');const existing=session.ledger.find(t=>t.id===transactionId);if(existing){assert(canonical(existing.action)===canonical(action),'Transaction ID reused for another action');return clone(session);}assert(expectedRevision===session.revision,'Stale revision');const next=clone(session);let result;
  if(action.type==='reroll'){assert(next.reward,'No pending reward');result=applyReroll(next.state,next.reward);next.reward=result.reward;}
  else if(['claim','pass'].includes(action.type)){assert(next.reward,'No pending reward');result=applyRewardChoice(next.state,next.reward,action.type==='pass'?null:action.candidateId);next.reward=null;}
  else{assert(next.service,'No pending service');result=applyServiceAction(next.state,next.service,action);next.service=result.offer;}
  next.state=result.state;if(session.service?.providerCapability)next.state.pendingService=clone(result.offer);next.receipts.push(result.receipt);next.ledger.push({id:transactionId,action:clone(action)});next.revision++;return next;
 }
 return {...P,trainingAccessEnabled:enableTrainingAccess,trainingAccessVersion:enableTrainingAccess?TRAINING_ACCESS_VERSION:null,previewResearch:Q.previewResearch,researchCandidates:Q.researchCandidates,projectCommands:Q.projectCommands,equipResearch:Q.selectResearchVariant,validateResearch:Q.validateResearch,paidTrainingCandidates,preparationCandidates,version:VERSION,snapshotOf,checkState,validateReward,validateServiceOffer,previewRelic,eligibleRelics,growthCandidates,recruitCandidates,targetCandidates,makeReward,visibleReward,makeServiceOffer,makeProviderOffer,previewEventGrant,applyEventGrant,applyRewardChoice,applyReroll,applyServiceAction,chooseRewardCandidate,createSession,transition};
}
