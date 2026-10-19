import {ULTIMATE_TRIAL_CONFIG} from '../ultimate-actions/trial-config.js';
import {campaignRules,available,availableAwakenings,serviceChoices} from './core.js';
import {RESEARCH_VARIANTS} from '../relic-services/strategy.js';
import {DEFAULT_CANDIDATE} from './identity.js';
import {isBattle,routeBudgets,SERVICE_ROLES} from './portable-graph.js';
import {clone} from './hash.js';import {combatDescriptor,SKILLS} from '../progression/index.js';
export function encounterPreview(run){const s=run.state;if(s.eventResolution?.combat)return clone(s.eventResolution.combat.encounter);const n=s.currentNode?run.graphs[s.chapter-1].nodes[s.currentNode]:available(run).find(n=>['normal','elite','boss'].includes(n.kind));return n&&['normal','elite','boss'].includes(n.kind)?campaignRules(run.encounterProfile).encounter(s.chapter,n):null;}
export function bossPreview(run){return campaignRules(run.encounterProfile).encounter(run.state.chapter,run.graphs[run.state.chapter-1].nodes.boss);}
// This scan uses only the immutable generated DAG, never previews or rolls stock.
// An unavailable/unknown future event definition is not evidence of absence.
export function remainingTrainingOpportunity(run,node=run.graphs[run.state.chapter-1]?.nodes[run.state.currentNode]){
 if(!node)return {status:'unknown',message:null};let unknown=false;
 for(let chapter=run.state.chapter;chapter<=run.graphs.length;chapter++){
  const graph=run.graphs[chapter-1],queue=chapter===run.state.chapter?[...node.edges]:[...graph.starts],seen=new Set();
  while(queue.length){const id=queue.pop();if(seen.has(id))continue;seen.add(id);const n=graph.nodes[id];if(!n){unknown=true;continue;}if(n.kind==='training'||n.kind==='event'&&n.eventDefinitionId==='trainer')return {status:'exists-in-frozen-remaining-graph',message:null};if(n.kind==='event'&&!n.eventDefinitionId)unknown=true;queue.push(...n.edges);}
 }
 return unknown?{status:'unknown',message:null}:{status:'none-in-frozen-remaining-graph',message:'이후 훈련 기회 없음'};
}
function trainingConsequences(run,c,node){if(c.kind!=='train')return {};const future=remainingTrainingOpportunity(run,node);if(campaignRules(run.encounterProfile).services.trainingAccessEnabled)return {closesVisit:false,consequenceWarning:'훈련 후에도 준비 구매와 다른 고정 상품 선택 가능',futureTraining:future,warning:'퇴장 전 새로 자격을 갖춘 병사는 60G 준비 가능 · 기존 훈련 재고는 보충되지 않음'};return {closesVisit:true,consequenceWarning:'훈련 후 이곳을 떠납니다',futureTraining:future,warning:['훈련 후 이곳을 떠납니다',future.message].filter(Boolean).join(' · ')};}
export function visibleService(run){const node=run.graphs[run.state.chapter-1]?.nodes[run.state.currentNode];return serviceChoices(run).map(c=>({...c,...trainingConsequences(run,c,node),cost:c.price??0,available:!c.disabled&&(c.price??0)<=run.state.gold,action:{type:'serviceAction',candidateId:c.candidateId}}));}
export const awakeningCandidates=availableAwakenings;
export function ultimateFoundationView(){return {releaseEligible:false,effectsImplemented:true,trialOnly:true,capability:'TRIAL_SIXTEEN_ACTUAL_EFFECTS_NOT_FINAL_BALANCE',config:clone(ULTIMATE_TRIAL_CONFIG),message:'독립 궁극기 16갈래 실제 효과 시험본입니다. 수치와 자동 발동 정책은 최종 밸런스·출시 승인이 아닙니다.'};}
export function awakeningView(run){const s=run.state;return {foundation:ultimateFoundationView(),available:['map','prepare'].includes(s.phase)&&!s.pendingBattle&&!s.campaignComplete,candidates:availableAwakenings(run),units:clone(campaignRules(run.encounterProfile).awakeningReadiness(s)),awakenedUnitIds:clone(s.awakening?.unitIds||[]),deferred:s.awakening?.deferred===true,chapterIsRecommendation:true,cap:null,capStatus:'no-global-awakening-cap-existing-roster-and-deployment-limits-retained',requirements:['complete-second-class','two-basic-skills','individual-paid-awakening-training','owned-matching-key'],preparation:{price:60,trialPrice:true,source:'training-node-or-registered-portable-trainer',keyRequired:false,sharedBetweenUnits:false},cost:0,keyConsumed:false};}
export function shopStockView(run){const o=run.state.pendingService;return o?.multiPurchase?{serviceId:o.id,nodeKind:o.node.kind,serviceKind:o.providerCapability?.serviceKind||o.node.kind,providerCapability:clone(o.providerCapability||null),ordinaryTrainingClosesVisit:(o.providerCapability?.serviceKind||o.node.kind)==='training'&&!o.trainingAccess,stockHash:o.stockHash,stock:clone(o.stock),purchasedCandidateIds:clone(o.purchasedCandidateIds),purchases:clone(o.purchaseReceipts),remaining:visibleService(run),fixedAtEntry:!o.trainingAccess,initialStockFixedAtEntry:true,preparationAdditions:clone(o.trainingAccess?.preparationAdditions||[]),preparationExtensionRule:o.trainingAccess?'paid-original-training-newly-eligible-same-unit-once':null,replenishes:false,exitRequired:true}:null;}

export function unitSkillView(unit){const d=combatDescriptor(unit);return d.skillIds.map(id=>({id,name:id===d.ultimateId?'독립 궁극기 (시험)':SKILLS[id]?.name||id,available:true,implemented:true,trialOnly:id===d.ultimateId,effect:id===d.ultimateId?'trial-independent-action':'existing-basic',automatic:id===d.ultimateId?true:SKILLS[id]?.automatic===true,ultimate:id===d.ultimateId,keyId:id===d.ultimateId?d.keyId:null,ultimateSkillId:id===d.ultimateId?d.ultimateSkillId:null,ultimateVariantId:id===d.ultimateId?d.ultimateVariantId:null,capability:id===d.ultimateId?'TRIAL_SIXTEEN_ACTUAL_EFFECTS_NOT_FINAL_BALANCE':'EXISTING_BASIC_SKILL'}));}
export function projectUnit(unit,state){return campaignRules(state.encounterProfile).content.projectUnit(unit,state);}
export function relicDefinition(id,run){const profile=run?.encounterProfile||run?.state?.encounterProfile;return clone(campaignRules(profile||DEFAULT_CANDIDATE).content.RELICS[id]||null);}

const COST_HINTS=Object.freeze({lab:[20],training:[30,60],forge:[20,30],shop:[10,15,20,30,40],target_shop:[10,15,20,30,40],rest:[0],event:[]});
export function nextNodePreview(run,nodeId=null){
 const graph=run.graphs[run.state.chapter-1],reachable=new Set(available(run).map(n=>n.id)),budgets=routeBudgets(graph),r=campaignRules(run.encounterProfile);
 const describe=n=>({id:n.id,row:n.row,lane:n.lane,kind:n.kind,eventDefinitionId:n.eventDefinitionId||null,guaranteedTrainingOpportunity:n.guaranteedTrainingOpportunity===true,role:isBattle(n)?(n.kind==='boss'?'보스':n.kind==='elite'?'위험 전투':'전투'):SERVICE_ROLES[n.kind],xp:n.xp,rewardRole:n.rewardRole,reachable:reachable.has(n.id),costHints:clone(COST_HINTS[n.kind]||[]),estimateOnly:true,visitGrantsNothing:!isBattle(n),canAffordAnyListedCost:(COST_HINTS[n.kind]||[]).some(price=>price<=run.state.gold),previewNotice:isBattle(n)?null:'Service entry is irreversible route selection; listed costs are current estimates, exact saved choices appear after entry. Leave grants nothing.',encounter:isBattle(n)?r.encounter(run.state.chapter,n):null,remainingBudget:clone(budgets.fromNodes[n.id])});
 const nodes=nodeId===null?available(run):[graph.nodes[nodeId]].filter(Boolean);
 return nodes.map(n=>({...describe(n),servicePreview:isBattle(n)?null:advertisedServicePreview(run,n),currentGold:run.state.gold,affordabilityIsCurrentSnapshot:true,next:n.edges.map(id=>describe(graph.nodes[id]))}));
}
export function campaignRouteBudget(run){return run.graphs.map(g=>({chapter:g.chapter,...clone(routeBudgets(g).total)}));}

export function commandLoadoutView(run){const s=run.state,R=campaignRules(run.encounterProfile).services;return {editable:['map','prepare'].includes(s.phase)&&!s.pendingBattle,selected:clone(s.skills),commands:clone(R.projectCommands(s)),research:clone(s.research),ownedVariants:clone(s.research.owned),variantOptions:s.research.owned.map(id=>({...clone(RESEARCH_VARIANTS[id]),effective:clone(R.projectCommands({...s,research:{...s.research,equipped:{...s.research.equipped,[RESEARCH_VARIANTS[id].skillId]:id}}})[RESEARCH_VARIANTS[id].skillId])}))};}

// Only deterministic advertised targets are shown here. Random shop inventory is
// never rolled/revealed by this pre-entry view; it is frozen after route commit.
export function advertisedServicePreview(run,node){
 const s=run.state,R=campaignRules(run.encounterProfile).services;let choices=[],information=null;
 if(node.kind==='training')choices=[...R.paidTrainingCandidates(s),...R.preparationCandidates(s)];
 else if(node.kind==='forge')choices=s.relics.map(relic=>{const p=R.previewRelic(s,relic.id,{operation:'forge'});return {id:relic.id,kind:'forge',targetId:relic.id,price:p.goldCost,disabled:!p.valid,reason:p.reason,preview:p};});
 else if(node.kind==='lab')choices=R.researchCandidates(s);
 else if(node.kind==='rest')choices=[{kind:'rest',price:0,disabled:!s.roster.some(u=>u.condition<100),conditionDelta:20}];
 else if(node.kind==='shop'){
  if(R.recruitCandidates(s).length)choices.push({kind:'recruit-stock',price:20,disabled:false,preview:'Recruitment is advertised; exact saved offer appears after entry.'});

 }else if(node.kind==='event'){const offer=campaignRules(run.encounterProfile).events.makeEventOffer(s,node);return {kind:'event',role:offer.name,event:clone(offer),goldBefore:s.gold,choices:offer.choices.map(c=>({...clone(c),price:c.goldCost,usable:!c.disabled&&c.affordable&&(c.next!=='provider'||c.providerOffer.choices.some(x=>x.kind!=='leave'&&!x.disabled&&x.price<=s.gold))})),randomInventoryHidden:false,estimateOnly:true,visitGrantsNothing:true};}
 return {kind:node.kind,role:SERVICE_ROLES[node.kind],goldBefore:s.gold,...(information?{information}:{}),choices:clone(choices).map(c=>({...c,...trainingConsequences(run,c,node),affordable:Number.isFinite(c.price)&&c.price<=s.gold,usable:!c.disabled&&Number.isFinite(c.price)&&c.price<=s.gold})),randomInventoryHidden:true,estimateOnly:true,visitGrantsNothing:true};
}

export function eventView(run){const s=run.state;if(!s.pendingEvent)return null;const offer=clone(s.pendingEvent),editable=s.phase==='event'&&!s.eventResolution;return {...offer,editable,committed:clone(s.eventResolution),provider:clone(s.pendingService?.providerCapability||null),choices:offer.choices.map(c=>({...c,...(c.providerOffer?{providerOffer:{...c.providerOffer,choices:c.providerOffer.choices.map(x=>({...x,...trainingConsequences(run,x,offer.node)}))}}:{}),available:editable&&!c.disabled&&c.affordable,action:{type:'eventChoice',eventId:offer.id,choiceId:c.id}})),safeCloseAction:editable&&offer.safeCloseAllowed?{type:'eventChoice',eventId:offer.id,choiceId:null}:null};}
export function eventHistory(run){return clone(run.state.events);}

export function rewardView(run){const p=run.state.pendingReward;if(!p)return null;const special=p.mode==='event-special-replacement';return {id:p.id,mode:p.mode,selectionBudget:p.selectionBudget,choices:clone(p.rerolled?p.reroll:p.original),canSkip:true,canReroll:!special&&!p.rerolled&&run.state.gold>=5,rerollCost:special?null:5,rerollAvailableByRules:!special,ordinaryRewardSelectionBudget:special?0:1,eventOrigin:special?{eventId:p.eventId,choiceId:p.choiceId}:run.state.eventResolution?{eventId:run.state.pendingEvent.id,choiceId:run.state.eventResolution.choiceId}:null};}
