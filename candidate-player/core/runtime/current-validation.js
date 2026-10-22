import {isLongBattleProfile,LONG_BATTLE_POLICY,WITHDRAW_COMMAND,longBattlePolicyFor,replayCutoffError} from '../long-battle/trial-config.js';
// Deliberately lower-trust current-state validation. These checks establish safe,
// coherent local state, NOT that historical combat/economy actually happened.
// This module never invokes an engine, a reducer, or a strict validation cache.
import {allowsUnitFamily,relicFamilyEligibility,validateSelectedRoster} from '../family-selection/contract.js';
import {canonical,digest,invariant,exactKeys} from './hash.js';
import {normalizeSeed,isBattle,validatePathPrefix} from './portable-graph.js';
import {ENGINE_HASHES} from './identity.js';
import {freezeInterest,settleInterest} from './interest.js';
import {terminalResultLedger} from './terminal-result.js';
import {validateProgressionState,FAMILIES,FIRST_CLASSES,SECOND_CLASSES} from '../progression/index.js';
import {PRICES,FORGE_PRICES,NEW_RELICS} from '../relic-services/registry.js';
import {WEIGHT_RULES} from '../relic-services/family-weight.js';
import {normalizeResearch,RESEARCH_VARIANTS} from '../relic-services/strategy.js';
import {validateProviderCapability} from '../relic-services/provider-capabilities.js';
import {createEncounter} from '../encounters/content.js';
import {EVENT_COMBAT_RNG_NAMESPACE,EVENT_TRIAL_VALUES as EVENT_VALUES} from '../events/registry.js';
import {deploymentCap} from '../src/config.js';

const eq=(a,b,message)=>invariant(canonical(a)===canonical(b),message);
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const id=(v,max=240)=>typeof v==='string'&&v.length<=max&&/^[A-Za-z0-9_.:-]+$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const array=(v,max=10000)=>Array.isArray(v)&&v.length<=max;
const commands=['heal','guard','focus','rally'];
const allowedFields=(value,allowed,required=[])=>invariant(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(value,k)),'Invalid current-state fields');

// Descriptor inspection must precede clone, digest, JSON.stringify or property
// reads. Reject accessors without invoking them, sparse/decorated arrays, custom
// prototypes and cyclic object inputs. Bounds include repeated shared subtrees.
export function assertBoundedJSON(value){
 let nodes=0,characters=0;const active=new Set();
 function visit(v,depth){
  invariant(depth<=64&&++nodes<=500000,'JSON structure exceeds current-state bound');
  if(v===null||typeof v==='boolean')return;
  if(typeof v==='number'){invariant(Number.isFinite(v),'Non-finite JSON number');return;}
  if(typeof v==='string'){characters+=v.length;invariant(characters<=16*1024*1024,'JSON strings exceed current-state bound');return;}
  invariant(typeof v==='object'&&!active.has(v),'Non-JSON value or cycle');
  const isArray=Array.isArray(v),proto=Object.getPrototypeOf(v);invariant(isArray?proto===Array.prototype:proto===Object.prototype||proto===null,'Non-plain JSON object');
  const keys=Reflect.ownKeys(v);invariant(keys.every(k=>typeof k==='string'),'Symbol JSON key');invariant(keys.length<=10001,'JSON object exceeds key bound');
  const descriptors=Object.getOwnPropertyDescriptors(v);active.add(v);
  if(isArray){invariant(integer(descriptors.length?.value,0,10000)&&keys.length===descriptors.length.value+1,'Sparse or decorated JSON array');for(let i=0;i<descriptors.length.value;i++){const d=descriptors[String(i)];invariant(d&&Object.hasOwn(d,'value')&&d.enumerable,'Accessor or sparse JSON array');visit(d.value,depth+1);}}
  else for(const key of keys){invariant(!['__proto__','prototype','constructor'].includes(key),'Unsafe JSON key');const d=descriptors[key];invariant(d&&Object.hasOwn(d,'value')&&d.enumerable,'Accessor or hidden JSON property');characters+=key.length;invariant(characters<=16*1024*1024,'JSON strings exceed current-state bound');visit(d.value,depth+1);}
  active.delete(v);
 }
 visit(value,0);return true;
}

function checkCommands(log,longBattle=false){
 invariant(array(log,4096),'Invalid command history');let previous=-1;
 for(const [index,c]of log.entries()){if(longBattle&&Number.isSafeInteger(c?.tick)&&c.tick>LONG_BATTLE_POLICY.replayBudgetTicks)throw replayCutoffError(0,LONG_BATTLE_POLICY.replayBudgetTicks);if(c?.skillId===WITHDRAW_COMMAND)invariant(longBattle&&index===log.length-1,'Withdrawal must be the final command');allowedFields(c,['tick','skillId','targetId'],['tick','skillId']);invariant(integer(c.tick,0,longBattle?LONG_BATTLE_POLICY.replayBudgetTicks:6600)&&c.tick>=previous&&(commands.includes(c.skillId)||longBattle&&c.skillId===WITHDRAW_COMMAND&&c.targetId===undefined),'Invalid command timing/identity');invariant(c.targetId===undefined||c.targetId===null||integer(c.targetId,1),'Invalid command target');previous=c.tick;}
}
const actionFields={selectNode:[['nodeId'],['nodeId']],setFormation:[['slots'],['slots']],eventChoice:[['eventId','choiceId'],['choiceId']],startBattle:[['battleId','commandMode'],[]],retryBattleCheckpoint:[['battleId'],[]],finishBattle:[['battleId','commands'],[]],rerollReward:[['rewardId'],[]],claimReward:[['rewardId','candidateId','opportunityId'],['candidateId']],skipReward:[['rewardId','candidateId','opportunityId'],[]],serviceAction:[['serviceId','candidateId'],['candidateId']],leaveService:[['serviceId','candidateId'],[]],awaken:[['unitId'],['unitId']],skipAwakening:[[],[]],setCommands:[['skills'],['skills']],equipResearch:[['skillId','variantId'],['skillId','variantId']],settle:[[],[]]};
function checkAction(a,longBattle=false){
 invariant(a&&Object.hasOwn(actionFields,a.type),'Unsupported current-state action');const [fields,required]=actionFields[a.type];allowedFields(a,['type',...fields],['type',...required]);
 for(const k of ['nodeId','eventId','choiceId','battleId','rewardId','candidateId','opportunityId','serviceId'])if(Object.hasOwn(a,k))invariant(a[k]===null||a[k]===''||id(a[k],400),'Invalid action identity');
 if(a.type==='selectNode')invariant(id(a.nodeId),'Invalid selected node');
 if(a.type==='claimReward'||a.type==='serviceAction')invariant(id(a.candidateId,400),'Candidate required');
 if(a.type==='setFormation'){invariant(array(a.slots,20)&&a.slots.length>0,'Invalid formation');const ids=new Set();for(const x of a.slots){exactKeys(x,['unitId','slot']);invariant(integer(x.unitId,1,1000000)&&!ids.has(x.unitId)&&(x.slot===null||integer(x.slot,0,11)),'Invalid formation member');ids.add(x.unitId);}}
 if(a.type==='setCommands')invariant(array(a.skills,2)&&a.skills.length===2&&new Set(a.skills).size===2&&a.skills.every(x=>commands.includes(x)),'Invalid commands');
 if(a.type==='equipResearch')invariant(commands.includes(a.skillId)&&(a.variantId===null||id(a.variantId)),'Invalid research selection');
 if(a.type==='awaken')invariant(integer(a.unitId,1,1000000),'Invalid awakening unit');
 if(a.commandMode!==undefined)invariant(['auto','manual'].includes(a.commandMode),'Invalid command mode');
 if(a.commands!==undefined)checkCommands(a.commands,longBattle);
}
function checkRoster(roster,xp,rules,{full=true}={}){
 invariant(array(roster,20)&&roster.length>=1,'Invalid roster size');const ids=new Set(),slots=new Set();
 for(const u of roster){allowedFields(u,['id','type','slot','training','trainingTrack','condition','classStage','secondClassId','skillIds','ultimateSkillId','ultimateVariantId','ultimateId','awakeningTraining'],['id','type','slot','training','trainingTrack','condition']);invariant(integer(u.id,1,1000000)&&!ids.has(u.id),'Invalid roster identity');ids.add(u.id);invariant(u.slot===null||integer(u.slot,-1,11),'Invalid deployment slot');if(u.slot!==null&&u.slot>=0){invariant(!slots.has(u.slot),'Duplicate deployment slot');slots.add(u.slot);}invariant(Number.isFinite(u.condition)&&u.condition>=0&&u.condition<=100,'Invalid condition');}
 invariant(slots.size>=1&&slots.size<=deploymentCap(xp),'Invalid deployment count');validateProgressionState({roster});return ids;
}
function checkRelics(relics,rules){
 invariant(array(relics,100),'Invalid relic collection');const ids=new Set();
 for(const relic of relics){invariant(id(relic.id)&&!ids.has(relic.id),'Duplicate/invalid relic');ids.add(relic.id);const definition=rules.services.RELICS?.[relic.id];invariant(Object.hasOwn(rules.services.RELICS||{},relic.id)&&definition&&integer(relic.evolution??relic.evolutionStage??1,1,definition.maxEvolution??3),'Invalid relic evolution');}
 rules.services.normalizeRelics(relics);for(const relic of relics)invariant(relicFamilyEligibility({familySelection:rules.familySelection},rules.services.RELICS[relic.id]).eligible,'Unselected relic family');
}
function checkResearch(research){
 exactKeys(research,['owned','equipped','purchases']);invariant(array(research.owned,2)&&research.owned.every(x=>typeof x==='string'&&Object.hasOwn(RESEARCH_VARIANTS,x)),'Unknown research variant');invariant(research.equipped&&Object.keys(research.equipped).every(x=>commands.includes(x)),'Unknown research command');for(const purchase of research.purchases||[]){exactKeys(purchase,['variantId','chapter','nodeId','price']);invariant(Object.hasOwn(RESEARCH_VARIANTS,purchase.variantId),'Unknown purchased research');}normalizeResearch(research);
}
function checkSnapshot(snapshot,rules){
 eq(snapshot?.familySelection??null,rules.familySelection??null,'Offer family selection differs from run');validateSelectedRoster(snapshot);
 invariant(snapshot&&integer(snapshot.chapter,1,5)&&integer(snapshot.battleCount,0,35)&&integer(snapshot.xp,0,1000000000)&&typeof snapshot.prepared==='boolean'&&typeof snapshot.campaignComplete==='boolean','Invalid offer snapshot');
 checkRoster(snapshot.roster,snapshot.xp,rules);checkRelics(snapshot.relics,rules);checkResearch(snapshot.research);invariant(array(snapshot.skills,2)&&snapshot.skills.length===2&&new Set(snapshot.skills).size===2&&snapshot.skills.every(x=>commands.includes(x)),'Invalid snapshot skills');
}
function sealed(offer,{reroll=false}={}){invariant(offer&&hash(offer.offerHash)&&hash(offer.snapshotHash),'Invalid offer digests');const {offerHash,...payload}=offer;invariant(digest(reroll?{...payload,rerolled:false}:payload)===offerHash&&digest(offer.snapshot)===offer.snapshotHash,'Frozen offer changed');}
function checkConfig(config,run,rules){
 exactKeys(config,['runtimeProfile','combatRulesVersion','seed','battleId','battleOrigin','interestSnapshot','roster','relics','skills','research','prepared','commandMode','encounter',...(rules.longBattlePolicy?['longBattlePolicy']:[])]);longBattlePolicyFor(config);
 invariant(config.runtimeProfile===run.encounterProfile&&config.combatRulesVersion==='v09-combat-1'&&integer(config.seed,0,0xffffffff)&&id(config.battleId,220)&&['auto','manual'].includes(config.commandMode)&&typeof config.prepared==='boolean','Invalid battle config');
 validateSelectedRoster({familySelection:run.familySelection,roster:config.roster});checkRoster(config.roster,Number.MAX_SAFE_INTEGER,rules);invariant(config.roster.every(u=>u.slot!==null&&u.slot>=0),'Battle roster contains reserve');checkRelics(config.relics,rules);checkResearch(config.research);
 invariant(array(config.skills,2)&&config.skills.length===2&&new Set(config.skills).size===2&&config.skills.every(x=>commands.includes(x)),'Invalid frozen skills');
 exactKeys(config.interestSnapshot,['rulesVersion','battleId','principal','ownedAtStart','amountOnVictory']);invariant(integer(config.interestSnapshot.principal,0,1000000000)&&typeof config.interestSnapshot.ownedAtStart==='boolean'&&config.interestSnapshot.battleId===config.battleId,'Invalid interest identity');eq(config.interestSnapshot,freezeInterest({gold:config.interestSnapshot.principal,relics:config.relics},config.battleId),'Frozen interest mismatch');
}
function eventFor(s,chapter,nodeId){return s.events.find(e=>e.offer.chapter===chapter&&e.offer.node.id===nodeId)||(s.pendingEvent?.chapter===chapter&&s.pendingEvent.node.id===nodeId?{offer:s.pendingEvent,resolution:s.eventResolution}:null);}
function contextFor(run,chapter,nodeId,battleContext){const e=eventFor(run.state,chapter,nodeId);return battleContext({...run,state:{...run.state,chapter,currentNode:nodeId,pendingEvent:e?.offer??null,eventResolution:e?.resolution??null}});}
function checkBattle(b,run,rules,battleContext,index){
 exactKeys(b,['chapter','nodeId','kind','milestoneOrigin','origin','economy','rewardExpected','battleNumber','config','receipt']);invariant(integer(b.chapter,1,run.state.chapter)&&id(b.nodeId)&&run.graphs[b.chapter-1].nodes[b.nodeId]&&run.state.visited[b.chapter-1].includes(b.nodeId),'Unknown historical battle node');
 const c=contextFor(run,b.chapter,b.nodeId,battleContext);invariant(b.battleNumber===index+1&&b.kind===c.kind&&b.milestoneOrigin===c.milestoneOrigin&&b.rewardExpected===(c.rewardRole!=='none'),'Battle ledger context mismatch');eq(b.origin,c.origin,'Battle origin mismatch');checkConfig(b.config,run,rules);invariant(b.config.battleId===c.battleId&&b.config.seed===c.seed,'Battle config identity mismatch');eq(b.config.battleOrigin,c.origin,'Config origin mismatch');eq(b.config.encounter,c.encounter,'Config encounter mismatch');
 const receipt=b.receipt;exactKeys(receipt,['source','engineHashes','inputDigest','commands','resultDigest','result','knockoutVersion','knockoutSource','knockedOut']);invariant(receipt.source==='REAL_PINNED_V09_ENGINE'&&hash(receipt.inputDigest)&&hash(receipt.resultDigest),'Invalid historical receipt');eq(receipt.engineHashes,rules.engineHashes??ENGINE_HASHES,'Receipt engine identity mismatch');invariant(receipt.inputDigest===digest(b.config)&&receipt.resultDigest===digest(receipt.result),'Historical receipt digest mismatch');checkCommands(receipt.commands,!!rules.longBattlePolicy);invariant(b.config.commandMode==='manual'||receipt.commands.length===0,'Commands on automatic battle');
 const result=receipt.result;if(rules.longBattlePolicy&&Number.isSafeInteger(result.ticks)&&result.ticks>LONG_BATTLE_POLICY.replayBudgetTicks)throw replayCutoffError(0,LONG_BATTLE_POLICY.replayBudgetTicks);invariant(result.battleId===b.config.battleId&&result.combatRulesVersion===b.config.combatRulesVersion&&result.integration?.version===rules.version&&integer(result.ticks,0,rules.longBattlePolicy?LONG_BATTLE_POLICY.replayBudgetTicks:6601),'Historical terminal identity mismatch');if(rules.longBattlePolicy){const withdrawal=receipt.commands.at(-1)?.skillId===WITHDRAW_COMMAND;invariant(result.reason!=='timeout'&&withdrawal===(result.reason==='withdrawal'),'Long battle terminal reason mismatch');if(withdrawal)invariant(result.win===false&&result.ticks===receipt.commands.at(-1).tick,'Withdrawal terminal tick mismatch');invariant(receipt.commands.every(c=>c.tick<=result.ticks),'Command beyond long battle terminal');}const terminal=terminalResultLedger(result,b.config.roster);invariant(receipt.knockoutVersion===terminal.version&&receipt.knockoutSource===terminal.source,'Terminal KO source mismatch');eq(receipt.knockedOut,terminal.knockedOut,'Terminal KO mismatch');
 exactKeys(b.economy,['gold','xp','fatigue','interest']);for(const k of ['gold','xp','fatigue'])invariant(b.economy[k]===c.budget[k],'Battle budget mismatch');eq(b.economy.interest,settleInterest(b.config.interestSnapshot,result,receipt.resultDigest),'Historical interest mismatch');
}
const rarityNames=['common','uncommon','rare','epic','legendary'];
const owns=(registry,key)=>typeof key==='string'&&Object.hasOwn(registry,key);
function checkGrant(grant,rules){
 invariant(grant&&['relic','recruit'].includes(grant.kind),'Invalid event grant kind');
 if(grant.kind==='relic'){exactKeys(grant,['kind','relic']);exactKeys(grant.relic,['id','evolution']);checkRelics([grant.relic],rules);invariant(grant.relic.evolution===1,'Event relic must start at evolution I');}
 else {invariant(allowsUnitFamily({familySelection:rules.familySelection},grant.type),'Unselected captive family');exactKeys(grant,['kind','type','count','training','trainingTrack','condition','slot']);invariant(['charger','guardian','sniper','volley'].includes(grant.type)&&grant.count===1&&grant.training===0&&grant.trainingTrack===null&&grant.condition===100&&grant.slot===null,'Invalid event captive grant');}
}
// Validate the contents of retained queues, never replace them with newly drawn
// offers. Eligibility is evaluated only for the currently consumable snapshot.
function checkAcquisition(c,snapshot,rules,{kind=c.kind,eligibility=false,service=false}={}){
 invariant(['pass','relic','recruit','evolve','train'].includes(kind),'Invalid acquisition kind');
 if(c.rarity!==undefined)invariant(rarityNames.includes(c.rarity),'Unknown candidate rarity');
 if(c.reserved!==undefined)invariant(c.reserved===true&&!service,'Invalid reserved candidate flag');
 if(c.acquisitionPool!==undefined)invariant(['ordinary','key'].includes(c.acquisitionPool),'Unknown relic acquisition pool');
 if(c.familyWeightVersion!==undefined)invariant(c.familyWeightVersion===WEIGHT_RULES.version,'Unknown family weighting');
 if(kind==='pass'){
  invariant(['relic','recruit','growth',...(service?['research']:[])].includes(c.category)&&c.id===`pass:${c.category}`&&c.goldCost===0,'Invalid zero-value pass');
  invariant(c.relic===undefined&&c.type===undefined&&c.unitId===undefined&&c.count===undefined,'Pass contains a grant');return;
 }
 if(kind==='relic'){
  invariant(['type','count','unitId','training','trainingTrack','secondClassId','branchId'].every(k=>c[k]===undefined),'Relic candidate contains a foreign grant');
  invariant(c.category==='relic'&&c.id===`relic:${c.relic?.id}`&&typeof c.target==='boolean','Invalid relic candidate identity');exactKeys(c.relic,['id','evolution']);checkRelics([c.relic],rules);const definition=rules.services.RELICS[c.relic.id];invariant(c.relic.evolution===1&&c.rarity===definition.intrinsicRarity,'Invalid candidate relic rarity/evolution');
  if(c.acquisitionPool!==undefined)invariant((c.acquisitionPool==='key')===(NEW_RELICS[c.relic.id]?.key===true)&&c.target===(c.acquisitionPool==='key'),'Relic pool/target mismatch');
  if(eligibility)invariant(rules.services.previewRelic(snapshot,c.relic.id,{target:c.target}).valid,'Pending relic candidate is ineligible');return;
 }
 if(kind==='recruit'){
  invariant(['relic','unitId','training','trainingTrack','secondClassId','branchId','rarity','target','acquisitionPool','familyWeightVersion'].every(k=>c[k]===undefined),'Recruit candidate contains a foreign grant');
  invariant(allowsUnitFamily({familySelection:rules.familySelection},c.type),'Unselected recruit family');invariant(owns(FAMILIES,c.type)&&c.id===`recruit:${c.type}`&&integer(c.count,1,2)&&(!eligibility&&service||snapshot.roster.length+c.count<=20)&&c.category===(service?'troop':'recruit'),'Invalid recruit candidate');
  if(eligibility){const candidate=rules.services.recruitCandidates(snapshot).find(x=>x.id===c.id);invariant(candidate&&candidate.type===c.type&&candidate.count===c.count,'Pending recruitment candidate is ineligible');}return;
 }
 invariant(['relic','count','rarity','target','acquisitionPool','familyWeightVersion'].every(k=>c[k]===undefined),'Growth candidate contains a foreign grant');
 invariant(allowsUnitFamily({familySelection:rules.familySelection},c.type),'Unselected growth family');invariant((service?c.category===undefined:c.category==='growth')&&integer(c.unitId,1,1000000)&&snapshot.roster.some(u=>u.id===c.unitId)&&[FAMILIES,FIRST_CLASSES].some(r=>owns(r,c.type))&&integer(c.training,kind==='train'?1:0,2),'Invalid growth candidate');
 invariant(c.training?['specialty','handling'].includes(c.trainingTrack):c.trainingTrack===null,'Invalid candidate training track');
 if(c.secondClassId!==undefined)invariant(owns(SECOND_CLASSES,c.secondClassId)&&SECOND_CLASSES[c.secondClassId].firstClassId===c.type&&c.training===2,'Invalid candidate second class');
 if(kind==='evolve')invariant(owns(FIRST_CLASSES,c.type)&&c.branchId===c.type&&c.id===`evolve:${c.unitId}:${c.type}:${c.secondClassId??'first'}`,'Invalid evolution candidate');
 else invariant(c.branchId===undefined&&c.id===`train:${c.unitId}:${c.training}:${c.trainingTrack}:${c.secondClassId??'base'}`,'Invalid training candidate');
 if(eligibility){const candidate=rules.services.growthCandidates(snapshot).find(x=>x.id===c.id);invariant(candidate&&['kind','unitId','type','training','trainingTrack','secondClassId','branchId'].every(key=>candidate[key]===({...c,kind})[key]),'Pending growth candidate is ineligible');}
}
function checkRewardCandidates(reward,rules,{pending=false,gold}={}){
 // Frozen reward snapshots intentionally omit currency; eligibility still needs the validated live gold balance.
 const special=reward.mode==='event-special-replacement';
 for(const [queueIndex,queue] of [reward.original,reward.reroll].entries()){
  if(queue===null)continue;const ids=new Set(),grants=new Set();
  for(const [slot,c] of queue.entries()){
   invariant(c&&id(c.candidateId,400)&&!ids.has(c.candidateId)&&c.slot===slot&&['pass','relic','recruit','evolve','train'].includes(c.kind),'Invalid reward candidate slot/identity');ids.add(c.candidateId);
   invariant(c.goldCost===0||c.goldCost===undefined&&c.reserved===true&&['train','evolve'].includes(c.kind),'Reward candidate must grant at zero price');invariant(c.price===undefined&&c.goldGranted===undefined&&c.xp===undefined,'Reward candidate contains an economic override');
   if(special){checkGrant(c.grant,rules);invariant(c.id===`${reward.id}:grant`&&c.candidateId===c.id&&c.kind===c.grant.kind&&typeof c.disabled==='boolean'&&c.category===undefined,'Invalid fixed special reward');eq(c.grant,reward.grant,'Special candidate grant differs');if(pending)invariant(c.disabled===!rules.services.previewEventGrant({...reward.snapshot,gold},c.grant).valid,'Special reward availability differs from snapshot');continue;}
   invariant(c.disabled===undefined&&c.grant===undefined,'Ordinary reward contains a foreign grant/availability flag');
   const reserved=slot===0&&['evolve','train-I','train-II'].includes(reward.rewardRole);invariant((c.reserved===true)===reserved&&c.candidateId===(reserved?`${reward.id}:reserved`:`${reward.id}:${queueIndex}:${slot}`),'Reward candidate opportunity mismatch');
   if(reward.rewardRole==='relic-only')invariant(['relic','pass'].includes(c.kind)&&c.category==='relic','Non-relic grant in relic-only reward');
   if(reserved)invariant(c.kind==='pass'&&c.category==='growth'||reward.rewardRole==='evolve'&&c.kind==='evolve'||reward.rewardRole==='train-I'&&c.kind==='train'&&c.training===1||reward.rewardRole==='train-II'&&c.kind==='train'&&c.training===2,'Reserved reward kind mismatch');
   checkAcquisition(c,reward.snapshot,rules,{eligibility:pending});if(c.kind!=='pass'){invariant(!grants.has(c.id),'Duplicate granted candidate');grants.add(c.id);}
  }
 }
 if(!special&&reward.original[0].reserved)eq(reward.original[0],reward.reroll[0],'Reserved reward differs between frozen queues');
}
function checkReward(reward,run,rules,pending=false){
 const special=reward.mode==='event-special-replacement';sealed(reward,{reroll:!special});checkSnapshot(reward.snapshot,rules);invariant(integer(reward.battleNumber,1,run.state.battleCount)&&reward.selectionBudget===1&&typeof reward.rerolled==='boolean','Invalid reward identity/budget');const battle=run.state.battles.find(b=>b.battleNumber===reward.battleNumber);invariant(battle?.receipt.result.win&&battle.rewardExpected&&reward.snapshot.chapter===battle.chapter,'Reward lacks associated victory');
 if(special){const e=eventFor(run.state,battle.chapter,battle.nodeId);invariant(reward.contentVersion===rules.events.version&&reward.id===`${e?.offer.id}:reward`&&reward.eventId===e?.offer.id&&reward.choiceId===e?.resolution.choiceId&&reward.sourceOfferHash===e?.offer.offerHash&&reward.reroll===null&&!reward.rerolled&&reward.ordinaryRewardSelectionBudget===0,'Invalid special reward source');invariant(array(reward.original,1)&&reward.original.length===1,'Invalid special reward slots');eq(reward.grant,e.resolution.combat.specialGrant,'Special reward grant mismatch');}
 else {invariant(reward.contentVersion===rules.services.version&&reward.id===`${run.runId}:${rules.services.version}:reward:${reward.battleNumber}`&&['mixed','relic-only-replacement'].includes(reward.mode),'Invalid ordinary reward source');invariant(array(reward.original,3)&&reward.original.length===3&&array(reward.reroll,3)&&reward.reroll.length===3,'Invalid reward slots');const node=run.graphs[battle.chapter-1].nodes[battle.nodeId],event=battle.origin.type==='event',role=event?'mixed':node.rewardRole;eq(reward.sourceNode,{id:node.id,kind:node.kind,row:node.row,rewardRole:role,...(event?{encounterKind:battle.kind,milestoneOrigin:'event'}:{})},'Reward node mismatch');invariant(reward.rewardRole===role&&reward.mode===(role==='relic-only'?'relic-only-replacement':'mixed')&&array(reward.rngCounters,2)&&reward.rngCounters.length===2&&reward.rngCounters.every(x=>integer(x,0,1000)),'Invalid reward role/RNG counters');}
 checkRewardCandidates(reward,rules,{pending,gold:run.state.gold});
}
function checkEventChoices(offer,rules){
 const suffixes={trainer:['provider','leave'],field_forge:['provider','leave'],strategist:['provider','leave'],treasure:['safe','fight'],prisoner:['fight','ransom'],ambush:['fight','escape'],supplies:['recover','sell'],scout:['rest','scout']}[offer.definitionId];
 invariant(suffixes,'Unknown event definition');
 for(const [i,c] of offer.choices.entries()){
  const suffix=suffixes[i],next=suffix==='provider'?'provider':suffix==='fight'?'battle':'complete';
  invariant(c.id===`${offer.id}:${suffix}`&&c.choiceId===c.id&&c.kind==='event-choice'&&c.next===next&&typeof c.disabled==='boolean'&&typeof c.affordable==='boolean'&&integer(c.goldCost,0,1000000000)&&integer(c.goldGranted,0,1000000000)&&c.xp===0,'Invalid event choice fields');
  const cost=suffix==='ransom'?EVENT_VALUES.prisonerRansomGold:0,granted=offer.definitionId==='supplies'&&suffix==='sell'?EVENT_VALUES.suppliesGold:0;
  invariant(c.goldCost===cost&&c.goldGranted===granted&&c.goldBefore===offer.startingGold&&c.affordable===(offer.startingGold>=cost)&&c.goldAfter===(c.affordable?offer.startingGold-cost+granted:null),'Event choice economy changed');
  if(c.grant)checkGrant(c.grant,rules);
  if(next==='battle'){
   const kind=offer.node.eventEncounterKind,special=['treasure','prisoner'].includes(offer.definitionId),row=Math.max(1,Math.min(6,Math.floor(offer.node.row)));invariant(['normal','elite','boss'].includes(kind),'Invalid event combat kind');
   eq(c.combat,{eventId:offer.id,choiceId:c.id,encounterKind:kind,milestoneOrigin:'event',rngNamespace:EVENT_COMBAT_RNG_NAMESPACE,encounterRow:row,encounter:createEncounter(offer.chapter,{kind,row}),...EVENT_VALUES.encounterEconomy[kind],candidateBalance:true,trialConfigVersion:EVENT_VALUES.version,rewardMode:special?'event-special-replacement':'ordinary',specialGrant:special?c.grant:null,ordinaryRewardSelectionBudget:special?0:1,eventRewardSelectionBudget:special?1:0,settlementAuthority:'actual-engine-victory-only',advancesMilestone:false,grantsGuaranteedKey:false,grantsAwakeningPreparation:false},'Frozen event combat specification changed');
  }else invariant(c.combat===undefined,'Combat attached to noncombat event choice');
  if(next==='provider'){invariant(c.providerOffer?.providerCapability?.eventId===offer.id&&c.providerOffer.providerCapability.definitionId===offer.definitionId&&c.providerKind===offer.definitionId,'Invalid event provider choice');sealed(c.providerOffer);checkSnapshot(c.providerOffer.snapshot,rules);checkServiceCandidates(c.providerOffer,rules);validateProviderCapability(c.providerOffer.providerCapability,offer.node,offer.chapter);}
 }
}
function checkEvent(entry,run,rules,pending=false){
 const offer=pending?entry:entry.offer,resolution=pending?run.state.eventResolution:entry.resolution;rules.events.validateOffer(offer);sealed(offer);checkEventChoices(offer,rules);checkSnapshot(offer.snapshot,rules);const node=run.graphs[offer.chapter-1]?.nodes[offer.node.id];invariant(node?.kind==='event'&&run.state.visited[offer.chapter-1].includes(node.id)&&integer(offer.startingGold),'Invalid event node/economy');eq(offer.node,node,'Event graph identity mismatch');invariant(offer.id===`event:${digest([rules.events.version,run.runId,String(run.seed),offer.chapter,node.id]).slice(0,32)}`&&offer.definitionId===node.eventDefinitionId&&offer.snapshot.runId===run.runId&&offer.snapshot.seed===String(run.seed),'Event source identity mismatch');
 if(!resolution){invariant(pending&&run.state.phase==='event','Missing event resolution');return;}
 const choice=offer.choices.find(c=>c.id===resolution.choiceId);invariant(resolution.eventId===offer.id&&['complete','provider','battle'].includes(resolution.next)&&(choice?.next===resolution.next||resolution.choiceId===null&&offer.safeCloseAllowed&&resolution.next==='complete'),'Invalid committed event choice');if(resolution.next==='battle')eq(resolution.combat,choice.combat,'Committed event combat changed');const receipt=resolution.receipt;invariant(receipt?.eventId===offer.id&&receipt.choiceId===resolution.choiceId&&receipt.definitionId===offer.definitionId&&receipt.offerHash===offer.offerHash&&receipt.selectionBudgetUsed===1,'Invalid event receipt identity');
 if(!pending){invariant(['resolved','defeat'].includes(entry.outcome),'Invalid event outcome');if(resolution.next==='battle'){const b=run.state.battles.find(b=>b.config.battleId===resolution.battle?.battleId);invariant(b&&b.nodeId===node.id&&b.chapter===offer.chapter&&b.receipt.resultDigest===resolution.battle.resultDigest&&b.receipt.result.win===resolution.battle.win&&entry.outcome===(b.receipt.result.win?'resolved':'defeat'),'Event terminal link mismatch');}else invariant(entry.outcome==='resolved','Nonbattle event defeat');}
}
function checkServiceCandidates(offer,rules,{pending=false,state=offer.snapshot}={}){
 const facility=offer.providerCapability?.serviceKind||offer.node.kind;
 for(const [queueName,queue] of [['stock',offer.stock],['choices',offer.choices]]){
  if(!queue)continue;const ids=new Set();
  for(const [slot,c] of queue.entries()){
   invariant(c&&c.slot===slot&&id(c.candidateId,400)&&!ids.has(c.candidateId),'Invalid service candidate slot/identity');ids.add(c.candidateId);
   if(queueName==='stock'||!offer.stock)invariant(c.candidateId===`${offer.id}:${slot}`,'Service stock identity changed');
   invariant(c.disabled===undefined||typeof c.disabled==='boolean','Invalid service availability');invariant(typeof c.affordable==='boolean'&&c.goldGranted===undefined&&c.xp===undefined&&c.goldGrant===undefined,'Invalid service economic fields');
   const effective=pending&&queueName==='choices'&&!c.disabled&&!offer.purchasedCandidateIds?.includes(c.candidateId);
   if(c.kind==='pass'){checkAcquisition(c,offer.snapshot,rules,{service:true});invariant(c.disabled===true&&c.price===undefined,'Invalid service pass');continue;}
   invariant(integer(c.price,0,1000000000)&&c.goldCost===c.price,'Service price/goldCost mismatch');
   if(c.kind!=='rest')invariant(c.conditionDelta===undefined&&c.actualConditionChanges===undefined&&c.prepared===undefined,'Service has a foreign effect');
   if(c.kind==='leave'){invariant(c.id==='leave'&&c.price===0,'Invalid free service exit');continue;}
   if(c.kind==='buy'){
    invariant(facility==='shop'&&['relic','recruit','train'].includes(c.purchaseKind),'Invalid shop purchase kind');checkAcquisition(c,effective?state:offer.snapshot,rules,{kind:c.purchaseKind,service:true,eligibility:effective});const price=c.purchaseKind==='relic'?PRICES[c.rarity]:PRICES[c.purchaseKind];invariant(c.price===price,'Invalid shop price');continue;
   }
   if(c.kind==='train'){
    invariant(facility==='training'&&c.price===30,'Invalid training facility/price');checkAcquisition(c,effective?state:offer.snapshot,rules,{service:true,eligibility:effective});if(effective)invariant(rules.services.paidTrainingCandidates(state).some(x=>x.id===c.id&&!x.disabled),'Pending paid training is ineffective');continue;
   }
   if(c.kind==='awakening-training'){
    invariant(facility==='training'&&c.price===60&&integer(c.unitId,1,1000000)&&c.id===`awaken-train:${c.unitId}`&&owns(SECOND_CLASSES,c.secondClassId)&&c.keyId===SECOND_CLASSES[c.secondClassId].keyId&&offer.snapshot.roster.some(u=>u.id===c.unitId),'Invalid awakening preparation candidate');if(effective)invariant(rules.services.preparationCandidates(state).some(x=>x.id===c.id&&x.unitId===c.unitId&&x.secondClassId===c.secondClassId),'Pending preparation is ineligible');continue;
   }
   if(c.kind==='research'){
    invariant(facility==='lab'&&owns(RESEARCH_VARIANTS,c.variantId)&&c.skillId===RESEARCH_VARIANTS[c.variantId].skillId&&c.id===`research:${c.variantId}`&&c.price===20,'Invalid research candidate');if(effective)invariant(rules.services.previewResearch(state,c.variantId).valid,'Pending research is ineligible');continue;
   }
   if(c.kind==='forge'){
    invariant(facility==='forge'&&owns(rules.services.RELICS,c.relicId)&&c.id===`forge:${c.relicId}`&&c.targetId===c.relicId&&offer.snapshot.relics.some(x=>x.id===c.relicId),'Invalid forge candidate');const owned=offer.snapshot.relics.find(x=>x.id===c.relicId);invariant(c.price===(FORGE_PRICES[owned.evolution??1]??0)||c.disabled===true&&c.price===0,'Invalid forge price');if(effective){const preview=rules.services.previewRelic(state,c.relicId,{operation:'forge'});invariant(preview.valid&&preview.effective&&preview.goldCost===c.price,'Pending forge is ineligible');}continue;
   }
   invariant(c.kind==='rest'&&facility==='rest'&&c.id==='rest:20'&&c.price===0&&c.conditionDelta===20,'Invalid rest candidate');eq(c.actualConditionChanges,offer.snapshot.roster.map(u=>{const after=Math.min(100,u.condition+20);return {unitId:u.id,before:u.condition,after,delta:after-u.condition};}),'Rest condition preview changed');
  }
 }
}
function checkService(entry,run,rules,pending=false){
 const offer=pending?entry:entry.offer;sealed(offer);checkSnapshot(offer.snapshot,rules);checkServiceCandidates(offer,rules,{pending,state:run.state});invariant(offer.contentVersion===rules.services.version&&integer(offer.chapter,1,run.state.chapter)&&run.state.visited[offer.chapter-1].includes(offer.node?.id),'Invalid service identity');eq(offer.node,run.graphs[offer.chapter-1].nodes[offer.node.id],'Service graph identity mismatch');
 if(offer.providerCapability){validateProviderCapability(offer.providerCapability,offer.node,offer.chapter);const e=eventFor(run.state,offer.chapter,offer.node.id);invariant(e?.offer.id===offer.providerCapability.eventId&&e?.resolution?.next==='provider','Orphan provider service');}else invariant(['shop','forge','rest','lab','training'].includes(offer.node.kind),'Invalid route service');
 const descriptive=`${run.runId}:${rules.services.version}:service:c${offer.chapter}:${offer.node.id}${offer.providerCapability?':'+offer.providerCapability.eventId:''}`,expected=descriptive.length>200?`service:${digest({namespace:'pi1-bounded-service-id-1',runId:run.runId,contentVersion:rules.services.version,chapter:offer.chapter,node:offer.node,providerCapability:offer.providerCapability??null})}`:descriptive;invariant(offer.id===expected,'Service source identity mismatch');
 invariant(array(offer.choices,200)&&offer.choices.length>0&&new Set(offer.choices.map(c=>c.candidateId)).size===offer.choices.length&&offer.choices.every(c=>id(c.candidateId,400)&&integer(c.price??0)&&(c.disabled===undefined||typeof c.disabled==='boolean')&&typeof c.affordable==='boolean'&&['pass','buy','train','awakening-training','research','forge','rest','leave'].includes(c.kind)),'Invalid service choices');
 if(offer.multiPurchase){invariant(array(offer.stock,200)&&hash(offer.stockHash)&&digest({id:offer.id,node:offer.node,chapter:offer.chapter,stock:offer.stock})===offer.stockHash,'Frozen stock changed');invariant(array(offer.purchasedCandidateIds,100)&&new Set(offer.purchasedCandidateIds).size===offer.purchasedCandidateIds.length&&array(offer.purchaseReceipts,100)&&offer.purchaseReceipts.length===offer.purchasedCandidateIds.length,'Invalid purchase ledger');for(const [i,p] of offer.purchaseReceipts.entries())invariant(p.serviceId===offer.id&&p.choice?.candidateId===offer.purchasedCandidateIds[i]&&p.action?.candidateId===p.choice.candidateId&&integer(p.goldCost)&&p.goldGranted===0&&p.xp===0,'Invalid purchase receipt');}
 if(!pending){const receipt=entry.receipt;invariant(receipt?.serviceId===offer.id&&receipt.nodeId===offer.node.id&&receipt.choice?.candidateId&&integer(receipt.goldCost)&&receipt.goldGranted===0&&receipt.xp===0&&receipt.selectionBudgetUsed===1,'Invalid service closing receipt');if(offer.multiPurchase){eq(entry.purchaseReceipts,offer.purchaseReceipts,'Closed purchase ledger changed');invariant(entry.totalGoldCost===offer.purchaseReceipts.reduce((n,p)=>n+p.goldCost,0)+receipt.goldCost,'Service total cost mismatch');}}
}

// Scan action/receipt chronology without replaying historical effects. This
// accounts for every receipt exactly once but does not authenticate old wins.
function* scanHistory(run){
 const s=run.state,visited=[[],[],[],[],[]],completed=[[],[],[],[],[]];let chapter=1,phase='map',node=null,battleFrozen=false,mode=null,bi=0,ri=0,si=0,ei=0,purchase=0,reward=null,rerolled=false,event=null,service=null,wins=0;
 const after=()=>{if(event){ei++;event=null;}const n=run.graphs[chapter-1].nodes[node];node=null;battleFrozen=false;mode=null;if(n.milestoneOrigin==='chapter-boss'){if(chapter===5)phase='settlement';else{chapter++;phase='map';}}else phase='map';};
 const closeNode=()=>{completed[chapter-1].push(node);after();};
 const match=(claim,actual,message)=>invariant(!claim||claim===actual,message);
 for(const t of run.transactions){const a=t.action;switch(a.type){
  case 'selectNode':{invariant(phase==='map','Historical node selection outside map');const g=run.graphs[chapter-1],path=completed[chapter-1],reachable=path.length?g.nodes[path.at(-1)].edges:g.starts;invariant(reachable.includes(a.nodeId),'Historical node not reachable');node=a.nodeId;visited[chapter-1].push(node);const n=g.nodes[node];if(isBattle(n))phase='prepare';else if(n.kind==='event'){event=s.events[ei]||(s.pendingEvent?{offer:s.pendingEvent,resolution:s.eventResolution}:null);invariant(event?.offer.chapter===chapter&&event.offer.node.id===node,'Missing ordered event offer');phase='event';}else {service=s.services[si]||(s.pendingService?{offer:s.pendingService}:null);invariant(service?.offer.chapter===chapter&&service.offer.node.id===node,'Missing ordered service offer');purchase=0;phase='service';}break;}
  case 'eventChoice':{invariant(phase==='event'&&event?.resolution,'Historical event commitment missing');match(a.eventId,event.offer.id,'Event action identity mismatch');invariant(a.choiceId===event.resolution.choiceId,'Event action choice mismatch');if(event.resolution.next==='complete')closeNode();else if(event.resolution.next==='battle')phase='prepare';else {service=s.services[si]||(s.pendingService?{offer:s.pendingService}:null);invariant(service?.offer.chapter===chapter&&service.offer.node.id===node,'Missing ordered provider service');purchase=0;phase='service';}break;}
  case 'startBattle':{invariant(phase==='prepare','Historical battle start phase mismatch');const b=s.battles[bi],config=b?.chapter===chapter&&b.nodeId===node?b.config:s.pendingBattle?.config;invariant(config,'Missing ordered battle config');match(a.battleId,config.battleId,'Battle action identity mismatch');if(!battleFrozen)mode=a.commandMode||'auto';else if(a.commandMode)invariant(a.commandMode===mode,'Retry changed command mode');invariant(config.commandMode===mode,'Recorded battle command mode mismatch');battleFrozen=true;phase='battle';break;}
  case 'retryBattleCheckpoint':invariant(phase==='battle'&&battleFrozen,'Historical retry lacks checkpoint');match(a.battleId,s.battles[bi]?.config.battleId||s.pendingBattle?.battleId,'Retry battle identity mismatch');phase='prepare';break;
  case 'finishBattle':{invariant(phase==='battle'&&battleFrozen,'Historical finish lacks checkpoint');const b=s.battles[bi++];invariant(b&&b.chapter===chapter&&b.nodeId===node,'Missing ordered battle receipt');match(a.battleId,b.config.battleId,'Finished battle identity mismatch');eq(a.commands||[],b.receipt.commands,'Finished command log mismatch');battleFrozen=false;mode=null;if(!b.receipt.result.win){if(event){ei++;event=null;}phase='defeat';break;}wins++;completed[chapter-1].push(node);if(b.rewardExpected){reward=s.rewards[ri]?.reward||s.pendingReward;invariant(reward?.battleNumber===wins,'Missing ordered victory reward');rerolled=false;phase='reward';}else after();break;}
  case 'rerollReward':invariant(phase==='reward'&&reward&&!rerolled&&reward.mode!=='event-special-replacement','Invalid historical reward reroll');match(a.rewardId,reward.id,'Reroll identity mismatch');rerolled=true;break;
  case 'claimReward':case 'skipReward':{invariant(phase==='reward'&&reward,'Historical reward claim outside reward');match(a.rewardId,reward.id,'Reward action identity mismatch');match(a.opportunityId,reward.id,'Opportunity action identity mismatch');const record=s.rewards[ri++];invariant(record&&record.reward.id===reward.id&&reward.rerolled===rerolled,'Missing ordered reward receipt');if(a.type==='claimReward'){const choice=(rerolled?reward.reroll:reward.original).find(c=>c.candidateId===a.candidateId);invariant(choice&&choice.kind!=='pass','Claimed reward not offered');if(reward.mode==='event-special-replacement')invariant(record.receipt.skipped!==true&&canonical(record.receipt.grant)===canonical(choice.grant),'Special reward receipt mismatch');else eq(record.receipt.choice,choice,'Reward receipt choice mismatch');}else invariant(record.receipt.kind==='skip'&&record.receipt.grantsNothing===true||record.receipt.skipped===true,'Skip receipt grants a reward');reward=null;after();break;}
  case 'serviceAction':case 'leaveService':{invariant(phase==='service'&&service,'Historical service action outside service');match(a.serviceId,service.offer.id,'Service action identity mismatch');const purchases=service.offer.purchaseReceipts||[],record=purchase<purchases.length?purchases[purchase]:service.receipt;invariant(record,'Missing service action receipt');if(a.type==='leaveService')invariant(record.choice?.kind==='leave'&&purchase===purchases.length,'Service left before purchase receipts');else invariant(a.candidateId===record.choice?.candidateId,'Service candidate receipt mismatch');invariant(record.action?.type===record.choice.kind&&(!record.action.candidateId||record.action.candidateId===record.choice.candidateId),'Service receipt action mismatch');if(purchase<purchases.length)purchase++;else{si++;service=null;closeNode();}break;}
  case 'setFormation':case 'setCommands':case 'equipResearch':case 'awaken':case 'skipAwakening':invariant(['map','prepare'].includes(phase)&&!battleFrozen,'Historical loadout action during frozen phase');break;
  case 'settle':invariant(['settlement','defeat'].includes(phase),'Duplicate or premature settlement');phase='complete';break;
  default:throw Error('Unsupported structural action');
 }yield 'transactions';}
 invariant(chapter===s.chapter&&phase===s.phase&&node===s.currentNode&&wins===s.battleCount,'Current phase/counter differs from action history');eq(visited,s.visited,'Visited history differs');eq(completed,s.completed,'Completed history differs');invariant(bi===s.battles.length&&ri===s.rewards.length&&si===s.services.length&&ei===s.events.length,'Unconsumed historical receipt');invariant(battleFrozen===!!s.pendingBattle&&!!reward===!!s.pendingReward&&!!service===!!s.pendingService&&!!event===!!s.pendingEvent,'Pending matrix differs from action history');if(reward)invariant(reward.rerolled===rerolled,'Pending reroll state mismatch');if(service)invariant(purchase===(service.offer.purchaseReceipts||[]).length,'Unconsumed pending purchase receipt');
}

export function* currentValidationSteps(run,{initialFor,assertShape,battleContext,rules:rulesFor}){
 // Caller guarantees the bounded JSON scan happened before this generator.
 invariant(run&&typeof run==='object','Runtime object required');invariant(typeof run.seed==='string'&&run.seed===normalizeSeed(run.seed),'Noncanonical runtime seed');const initial=initialFor(run),rules={...rulesFor(run.encounterProfile),familySelection:run.familySelection},s=run.state;
 invariant(array(run.graphHashes,5)&&run.graphHashes.length===5,'Missing graph hashes');for(let i=0;i<5;i++){eq(run.graphs[i],initial.graphs[i],'Graph differs from deterministic generator');invariant(hash(run.graphHashes[i])&&run.graphHashes[i]===digest(run.graphs[i]),'Graph hash mismatch');}yield 'header-graphs';
 exactKeys(s,Object.keys(initial.state));for(const key of ['seed','runId','profileId','encounterProfile','unlocks',...(run.familySelection?['familySelection']:[]),...(run.profileStart?['entitlements','tactic','entitlementSnapshotDigest']:[])])eq(s[key],initial.state[key],`Runtime ${key} identity mismatch`);
 invariant(integer(s.chapter,1,5)&&['map','prepare','battle','reward','service','event','settlement','defeat','complete'].includes(s.phase),'Invalid current phase/chapter');invariant(s.currentNode===null||id(s.currentNode)&&Object.hasOwn(run.graphs[s.chapter-1].nodes,s.currentNode),'Invalid current node');invariant(integer(s.gold,0,1000000000)&&integer(s.xp,0,1000000000)&&integer(s.battleCount,0,35)&&typeof s.prepared==='boolean'&&typeof s.campaignComplete==='boolean'&&s.targetRelicId===null,'Invalid current counters/flags');
 const rosterIds=checkRoster(s.roster,s.xp,rules);invariant(integer(s.nextUnitId,1,1000000)&&s.nextUnitId>Math.max(...rosterIds),'Invalid next unit ID');checkRelics(s.relics,rules);exactKeys(s.research,['owned','equipped','purchases']);checkResearch(s.research);exactKeys(s.milestones,['chapterBosses']);invariant(array(s.milestones.chapterBosses,5)&&new Set(s.milestones.chapterBosses).size===s.milestones.chapterBosses.length,'Invalid chapter milestones');
 for(const key of ['visited','completed'])invariant(array(s[key],5)&&s[key].length===5,'Invalid path matrix');for(let i=0;i<5;i++){validatePathPrefix(run.graphs[i],s.visited[i]);validatePathPrefix(run.graphs[i],s.completed[i]);if(i+1<s.chapter)invariant(s.completed[i].at(-1)==='boss','Unfinished previous chapter');if(i+1>s.chapter)invariant(s.visited[i].length===0&&s.completed[i].length===0,'Future chapter path');}
 for(const key of ['battles','rewards','services','events'])invariant(array(s[key],35),`Invalid ${key} ledger`);invariant(array(s.progressionLedger,700),'Invalid progression ledger');assertShape(run);yield 'state';
 const txIds=new Set();for(const t of run.transactions){exactKeys(t,['id','action','stateDigest']);invariant(id(t.id,160)&&!txIds.has(t.id)&&hash(t.stateDigest),'Invalid transaction identity/digest');txIds.add(t.id);checkAction(t.action,isLongBattleProfile(run.encounterProfile));if(t.action.type==='setFormation')invariant(t.action.slots.every(x=>rosterIds.has(x.unitId)),'Formation refers to unknown unit');if(t.action.type==='awaken')invariant(rosterIds.has(t.action.unitId),'Awakening refers to unknown unit');}invariant(!run.transactions.length||run.transactions.at(-1).stateDigest===digest(s),'Latest state digest mismatch');if(run.revision===0)eq(s,initial.state,'Revision-zero state differs from initial state');yield 'transaction-shapes';
 const eventIds=new Set();for(const entry of s.events){exactKeys(entry,['offer','resolution','outcome']);checkEvent(entry,run,rules);invariant(!eventIds.has(entry.offer.id),'Duplicate event opportunity');eventIds.add(entry.offer.id);yield 'events';}if(s.pendingEvent){checkEvent(s.pendingEvent,run,rules,true);invariant(!eventIds.has(s.pendingEvent.id),'Reused pending event');}
 const battleIds=new Set();for(let i=0;i<s.battles.length;i++){const b=s.battles[i];checkBattle(b,run,rules,battleContext,i);invariant(b.config.roster.every(u=>rosterIds.has(u.id)),'Historical battle has foreign unit');invariant(!battleIds.has(b.config.battleId),'Duplicate battle settlement');battleIds.add(b.config.battleId);invariant(b.receipt.result.win||i===s.battles.length-1&&['defeat','complete'].includes(s.phase),'Nonterminal defeat');yield 'battles';}
 const rewardIds=new Set();for(const record of s.rewards){exactKeys(record,['reward','receipt']);checkReward(record.reward,run,rules);invariant(!rewardIds.has(record.reward.id),'Duplicate reward opportunity');rewardIds.add(record.reward.id);invariant(record.receipt&&typeof record.receipt==='object','Missing reward receipt');if(record.receipt.kind!=='skip')invariant(record.receipt.rewardId===record.reward.id&&record.receipt.selectionBudgetUsed===1&&record.receipt.goldCost===0&&record.receipt.xp===0,'Invalid reward receipt');yield 'rewards';}
 const serviceIds=new Set();for(const entry of s.services){checkService(entry,run,rules);invariant(!serviceIds.has(entry.offer.id),'Duplicate service opportunity');serviceIds.add(entry.offer.id);yield 'services';}
 for(const purchase of s.research.purchases){const n=run.graphs[purchase.chapter-1]?.nodes[purchase.nodeId];invariant(n&&s.visited[purchase.chapter-1].includes(n.id)&&s.services.some(e=>e.offer.chapter===purchase.chapter&&e.offer.node.id===n.id)||n&&s.pendingService?.chapter===purchase.chapter&&s.pendingService.node.id===n.id,'Orphan research source');}
 for(const entry of s.progressionLedger){invariant(['progression','awakening-training','awakening','key-collection'].includes(entry.receipt.kind),'Unknown progression receipt');if(entry.receipt.unitId!==undefined)invariant(rosterIds.has(entry.receipt.unitId),'Orphan progression unit');}
 yield 'references';
 if(s.pendingBattle){const p=s.pendingBattle;exactKeys(p,['battleId','nodeId','context','config','configHash','startingReserveIds']);invariant(['prepare','battle'].includes(s.phase)&&p.nodeId===s.currentNode&&!battleIds.has(p.battleId),'Invalid pending battle phase/identity');const context=battleContext(run);eq(p.context,context,'Frozen battle context mismatch');checkConfig(p.config,run,rules);invariant(p.battleId===context.battleId&&p.configHash===digest(p.config),'Pending battle config digest mismatch');const expected={runtimeProfile:run.encounterProfile,combatRulesVersion:'v09-combat-1',seed:context.seed,battleId:context.battleId,battleOrigin:context.origin,interestSnapshot:freezeInterest(s,context.battleId),roster:s.roster.filter(u=>u.slot!==null&&u.slot>=0),relics:s.relics,skills:s.skills,research:s.research,prepared:s.prepared,commandMode:p.config.commandMode,encounter:context.encounter,...(rules.longBattlePolicy?{longBattlePolicy:rules.longBattlePolicy}:{})};eq(p.config,expected,'Pending battle differs from current state');eq(p.startingReserveIds,s.roster.filter(u=>u.slot===null||u.slot<0).map(u=>u.id),'Pending reserve ledger mismatch');}
 if(s.pendingReward){invariant(s.phase==='reward'&&!rewardIds.has(s.pendingReward.id),'Invalid pending reward');checkReward(s.pendingReward,run,rules,true);if(s.pendingReward.mode==='event-special-replacement')rules.events.validateCombatReward(s,s.pendingReward);else rules.services.validateReward(s,s.pendingReward);}
 if(s.pendingService){invariant(s.phase==='service'&&!serviceIds.has(s.pendingService.id),'Invalid pending service');checkService(s.pendingService,run,rules,true);rules.services.validateServiceOffer(s,s.pendingService);}
 if(s.phase==='event'){invariant(s.pendingEvent&&!s.eventResolution,'Invalid uncommitted event');const snapshot={...rules.services.snapshotOf(s),runId:s.runId,seed:String(s.seed),nextUnitId:s.nextUnitId};invariant(digest(snapshot)===s.pendingEvent.snapshotHash&&s.gold===s.pendingEvent.startingGold,'Pending event snapshot changed');eq(s.pendingEvent,rules.events.makeEventOffer(s,run.graphs[s.chapter-1].nodes[s.currentNode]),'Pending event choices differ from current rules');}
 if(s.pendingEvent&&s.eventResolution){if(s.eventResolution.next==='provider')invariant(s.phase==='service'&&s.pendingService?.providerCapability?.eventId===s.pendingEvent.id,'Invalid pending provider matrix');else {invariant(s.eventResolution.next==='battle'&&['prepare','battle','reward'].includes(s.phase),'Invalid pending event combat matrix');if(s.phase==='reward'){const b=s.battles.at(-1);eq(s.eventResolution.battle,{battleId:b.config.battleId,resultDigest:b.receipt.resultDigest,win:true},'Pending event victory link mismatch');}else invariant(s.eventResolution.battle===undefined,'Pending event has an unsettled result');}}
 yield 'pending';
 if(s.settlement){invariant(s.phase==='complete','Settlement outside complete phase');const outcome=s.battles.at(-1)?.receipt.result.win===false?'defeat':'victory';eq(s.settlement,{version:'service-node-local-result-1',outcome,wonBattles:s.battleCount,attemptedBattles:s.battles.length,resultDigests:s.battles.map(b=>b.receipt.resultDigest),productionCurrency:0,permanentSettlementStatus:'PENDING_FIVE_CHAPTER_ECONOMY_SPEC'},'Settlement receipt mismatch');invariant(outcome==='victory'?s.campaignComplete:!s.campaignComplete,'Settlement outcome mismatch');}else invariant(s.phase!=='complete','Complete phase lacks settlement');invariant(!['settlement'].includes(s.phase)||s.campaignComplete,'Premature victory settlement');yield 'settlement';
 yield* scanHistory(run);yield 'complete';return true;
}
