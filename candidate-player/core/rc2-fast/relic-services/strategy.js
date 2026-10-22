// Candidate values transcribed from recovered content-plan.md §5 / E03.
// These are test defaults, not a claim of approved balance or permanent unlocks.
import {clone,assert,deepFreeze,LIMITS} from './registry.js';
import {validatePendingProvider} from './provider-capabilities.js';
export const RESEARCH_VERSION='v10-command-research-event-providers-1';
export const RESEARCH_PRICE=20;
export const RESEARCH_VARIANTS=deepFreeze({
 focused_treatment:{id:'focused_treatment',skillId:'heal',name:'집중 처치',power:.35,cooldown:18,duration:0,target:'lowest-hp-living-ally',tradeoff:'전체 회복을 포기하고 한 명을 구조합니다.'},
 shock_barrier:{id:'shock_barrier',skillId:'guard',name:'충격 차단',power:.35,cooldown:24,duration:3,target:'living-allies',tradeoff:'지속이 짧고 재사용 대기가 길어집니다.'},
 compressed_mark:{id:'compressed_mark',skillId:'focus',name:'압축 표식',power:.25,cooldown:24,duration:4,target:'one-living-enemy-basic-attacks-only',tradeoff:'짧은 집중 화력 대신 유지 시간과 재사용이 불리합니다.'},
 charge_signal:{id:'charge_signal',skillId:'rally',name:'돌격 신호',power:.40,cooldown:22,duration:4,target:'living-spear-family',tradeoff:'창 계열 이외 병사는 가속하지 않습니다.'}
});
export const BASE_COMMANDS=deepFreeze({
 heal:{id:'heal',skillId:'heal',name:'응급 회복',power:.15,cooldown:24,duration:0,target:'living-allies'},
 guard:{id:'guard',skillId:'guard',name:'수호 진형',power:.20,cooldown:20,duration:4,target:'living-allies'},
 focus:{id:'focus',skillId:'focus',name:'집중 사격',power:.10,cooldown:18,duration:6,target:'one-living-enemy-basic-attacks-only'},
 rally:{id:'rally',skillId:'rally',name:'사기 고양',power:.25,cooldown:26,duration:5,target:'living-allies'}
});
export function normalizeResearch(value){
 const r=clone(value??{owned:[],equipped:{},purchases:[]});
 assert(r&&Array.isArray(r.owned)&&r.equipped&&typeof r.equipped==='object'&&!Array.isArray(r.equipped)&&Array.isArray(r.purchases),'Invalid research state');
 assert(r.owned.length<=2&&new Set(r.owned).size===r.owned.length&&r.owned.every(id=>RESEARCH_VARIANTS[id]),'Invalid research ownership/cap');
 assert(r.purchases.length===r.owned.length&&r.purchases.every(p=>p&&r.owned.includes(p.variantId)&&Number.isInteger(p.chapter)&&p.chapter>=1&&p.chapter<=5&&p.price===RESEARCH_PRICE&&typeof p.nodeId==='string'),'Invalid research purchase record');
 assert(new Set(r.purchases.map(p=>`${p.chapter}:${p.nodeId}`)).size===r.purchases.length&&new Set(r.purchases.map(p=>p.variantId)).size===r.purchases.length,'Research once per service opportunity');
 for(const [skillId,id] of Object.entries(r.equipped))assert(BASE_COMMANDS[skillId]&&(id===null||r.owned.includes(id)&&RESEARCH_VARIANTS[id].skillId===skillId),'Research selection requires matching owned variant');
 return r;
}
export function projectCommands(C,projection,state){
 const research=normalizeResearch(state.research),effects=projection.getRelicEffects(state.relics||[],state.skills||[]),commands={};
 const cdr=Math.min(.20,Math.max(0,effects.commanderSkillCdr||0));
 for(const [skillId,base] of Object.entries(BASE_COMMANDS)){
  const id=research.equipped[skillId],variant=id?RESEARCH_VARIANTS[id]:null,spec=variant||base,timed=skillId!=='heal';
  const cooldown=spec.cooldown*(1-(timed?cdr:0));
  const duration=(spec.duration+(skillId==='rally'?(effects.rallyDurationBonus||0):0))*(timed?(effects.commanderDurationCostFactor??1):1);
  commands[skillId]={...clone(spec),id:skillId,variantId:variant?.id??null,cooldown:Math.ceil((cooldown-1e-9)*60)/60,duration:Math.max(0,Math.ceil((Math.min(duration,Math.max(0,cooldown-2))-1e-9)*60)/60),baseCooldown:spec.cooldown,baseDuration:spec.duration,commandCdr:cdr,caps:{damageReduction:LIMITS.damageReduction,attackSpeed:LIMITS.attackSpeedBonus,basicDamageBonus:LIMITS.basicDamageBonus,commandCdr:.20},candidateBalance:true};
 }
 return commands;
}
export function createResearch(C,projection){
 function previewResearch(state,variantId){
  const definition=RESEARCH_VARIANTS[variantId],r=normalizeResearch(state.research),blocked=reason=>({variantId,valid:false,reason,price:RESEARCH_PRICE,gains:[],losses:[]});
  if(!definition)return blocked('Unknown command variant');
  if(state.campaignComplete)return blocked('Campaign has ended');
  if(r.owned.includes(variantId))return blocked('Variant already researched');
  if(r.owned.length>=2)return blocked('Two research purchases per expedition is the maximum');
  if(!(state.skills||[]).includes(definition.skillId))return blocked('Matching command is not equipped');
  const deployed=(state.roster||[]).filter(C.isDeployed),units=deployed.map(u=>({unit:u,stats:projection.projectUnit(u,state)}));
  if(!units.length)return blocked('No deployed unit can use this command');
  const before=projectCommands(C,projection,state)[definition.skillId];
  const candidateResearch={...r,owned:[...r.owned,variantId],equipped:{...r.equipped,[definition.skillId]:variantId},purchases:[...r.purchases,{variantId,chapter:state.chapter,nodeId:'preview',price:RESEARCH_PRICE}]};
  const after=projectCommands(C,projection,{...state,research:candidateResearch})[definition.skillId];
  let changes=[];
  if(definition.skillId==='heal')changes=units.map(({unit:u,stats:p})=>({unitId:u.id,field:'max-heal-on-selected-target',before:p.maxHp*before.power,after:p.maxHp*after.power,delta:p.maxHp*(after.power-before.power),conditional:'Lowest HP-ratio living ally only; missing HP clip, no revive/condition recovery'}));
  if(definition.skillId==='guard')changes=units.map(({unit:u,stats:p})=>{const a=Math.max(.45,100/(100+p.defense)*(1-before.power)),b=Math.max(.45,100/(100+p.defense)*(1-after.power));return {unitId:u.id,field:'incoming-damage-factor',before:a,after:b,delta:a-b,conditional:'While guard active; final damage reduction capped at55%'};});
  if(definition.skillId==='focus')changes=units.map(({unit:u,stats:p})=>{const a=Math.min(.35,p.basicDamageBonus+before.power),b=Math.min(.35,p.basicDamageBonus+after.power);return {unitId:u.id,field:'focused-basic-damage-bonus',before:a,after:b,delta:b-a,conditional:'Only the marked living target in normal range; not independent innate spells'};});
  if(definition.skillId==='rally')changes=units.filter(({unit:u})=>C.familyOf(u.type)==='spear').map(({unit:u,stats:p})=>{const a=Math.min(.5,p.attackSpeedBonus+before.power),b=Math.min(.5,p.attackSpeedBonus+after.power);return {unitId:u.id,field:'rally-haste',before:a,after:b,delta:b-a,conditional:'Only living spear-family allies; aggregate haste capped at50%'};});
  const gains=changes.filter(c=>c.delta>1e-9);
  if(!gains.length)return blocked(definition.skillId==='rally'?'No deployed spear-family ally with haste headroom':'No effective command improvement after current caps');
  return {variantId,skillId:definition.skillId,name:definition.name,valid:true,reason:'',price:RESEARCH_PRICE,before,after,changes,gains,losses:[definition.tradeoff],scope:'current-expedition-only',candidateBalance:true,selectionBudget:1};
 }
 function researchCandidates(state){return (state.skills||[]).slice(0,2).map(skillId=>Object.values(RESEARCH_VARIANTS).find(v=>v.skillId===skillId)).filter(Boolean).map(v=>{const preview=previewResearch(state,v.id);return {id:`research:${v.id}`,kind:'research',name:v.name,skillId:v.skillId,variantId:v.id,price:RESEARCH_PRICE,goldCost:RESEARCH_PRICE,disabled:!preview.valid,reason:preview.reason,preview};});}
 function applyResearch(state,candidate,node,providerCapability=null){
  const preview=previewResearch(state,candidate.variantId);assert(preview.valid&&candidate.skillId===preview.skillId,'Research no longer eligible');assert((providerCapability?validatePendingProvider(state,node,providerCapability)==='lab':node?.kind==='lab')&&!normalizeResearch(state.research).purchases.some(p=>p.chapter===state.chapter&&p.nodeId===node.id),'Research service opportunity already used or invalid');
  const next=clone(state),r=normalizeResearch(next.research);r.owned.push(candidate.variantId);r.equipped[candidate.skillId]=candidate.variantId;r.purchases.push({variantId:candidate.variantId,chapter:state.chapter,nodeId:node.id,price:RESEARCH_PRICE});next.research=r;return {state:next,receipt:preview};
 }
 function selectResearchVariant(state,{skillId,variantId=null}){
  assert(['map','prepare'].includes(state.phase)&&!state.pendingBattle,'Research selection only before battle');
  assert((state.skills||[]).includes(skillId)&&BASE_COMMANDS[skillId],'Matching equipped command required');
  const next=clone(state),r=normalizeResearch(next.research);assert(variantId===null||r.owned.includes(variantId)&&RESEARCH_VARIANTS[variantId]?.skillId===skillId,'Matching owned research variant required');r.equipped[skillId]=variantId;next.research=r;
  return {state:next,receipt:{kind:'research-selection',skillId,variantId,goldCost:0,xp:0,scope:'current-expedition-only'}};
 }
 return {previewResearch,researchCandidates,applyResearch,selectResearchVariant,projectCommands:state=>projectCommands(C,projection,state),validateResearch:state=>normalizeResearch(state.research)};
}
