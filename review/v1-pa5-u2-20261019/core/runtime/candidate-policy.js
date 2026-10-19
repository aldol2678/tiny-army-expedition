import {available,visibleReward,serviceChoices,availableAwakenings} from './core.js';
import {advertisedServicePreview} from './views.js';
import {deploymentCap} from '../src/config.js';
export const POLICY_VERSION='parallel-event-policy-1';
export const ROUTE_POLICIES=['combat-heavy','investment-heavy','elite-investment','blind-service-seeking','event-seeking'];
export const POLICIES=['troop-first','growth-first','relic-synergy','novice'];
const family=t=>['spear','guardian','charger'].includes(t)?'spear':['archer','sniper','volley'].includes(t)?'archer':['mage','pyromancer','frostmage'].includes(t)?'mage':'support';
export function legalFormation(state){const cap=deploymentCap(state.xp),current=state.roster.filter(u=>u.slot!==null&&u.slot>=0),chosen=[...current,...state.roster.filter(u=>u.slot===null||u.slot<0)].slice(0,cap),used=new Set(),slots=[];for(const u of chosen){let slot=u.slot;if(slot===null||slot<0||used.has(slot)){const order=family(u.type)==='spear'?[0,1,2,3,4,5,6,7,8,9,10,11]:[8,9,10,11,4,5,6,7,0,1,2,3];slot=order.find(n=>!used.has(n)&&!chosen.some(v=>v.id!==u.id&&v.slot===n));if(slot===undefined)slot=order.find(n=>!used.has(n));}used.add(slot);slots.push({unitId:u.id,slot});}for(const u of state.roster)if(!slots.some(v=>v.unitId===u.id))slots.push({unitId:u.id,slot:null});return slots.sort((a,b)=>a.unitId-b.unitId);}
function rank(c,s,policy){if(c.kind==='pass')return 10000;if(c.reserved&&c.target)return -100;if(policy==='novice')return c.slot;
 if(policy==='troop-first'){if(c.kind==='recruit')return s.roster.length<9?0:50;if(['train','evolve'].includes(c.kind))return 5+(c.training===2?-1:0);return 20;}
 if(policy==='growth-first'){if(['train','evolve'].includes(c.kind))return 0+(c.training===2?-1:0);if(c.kind==='relic')return 10;return 20;}
 if(c.kind==='relic')return -10-(c.preview?.gains?.length||0);if(['train','evolve'].includes(c.kind))return 10;return 20;
}
export function nextCandidateAction(run,policy='troop-first',routePolicy='combat-heavy',{autoAwaken=true}={}){
 if(!ROUTE_POLICIES.includes(routePolicy))throw Error('Unknown route policy');if(!POLICIES.includes(policy))throw Error('Unknown policy');const s=run.state;
 if(['map','prepare'].includes(s.phase)&&!s.pendingBattle){const eligible=availableAwakenings(run);if(autoAwaken&&eligible.length)return {type:'awaken',unitId:eligible[0].unitId};const slots=legalFormation(s);if(slots.some(x=>s.roster.find(u=>u.id===x.unitId).slot!==x.slot))return {type:'setFormation',slots};}
 switch(s.phase){case 'map':{const nodes=available(run),services=nodes.filter(n=>!['normal','elite','boss'].includes(n.kind));let n;
  if(routePolicy==='event-seeking')n=services.find(node=>node.kind==='event');
  if(!n&&routePolicy!=='combat-heavy'&&services.length)n=services.find(node=>routePolicy==='blind-service-seeking'||advertisedServicePreview(run,node).choices.some(c=>c.usable&&(!['rest','clinic'].includes(c.kind)||s.roster.some(u=>u.condition<85))&&(c.kind!=='recruit-stock'||policy==='troop-first'&&s.roster.length<9)));
  if(!n){const battles=nodes.filter(n=>['normal','elite','boss'].includes(n.kind));n=battles.sort((a,b)=>routePolicy==='elite-investment'?(b.kind==='elite')-(a.kind==='elite')||(b.lane===1)-(a.lane===1)||a.lane-b.lane:(a.kind==='elite')-(b.kind==='elite')||a.lane-b.lane)[0];}
  if(!n)throw Error('No reachable route');return {type:'selectNode',nodeId:n.id};}
 case 'event':{const o=s.pendingEvent,choices=o.choices.filter(c=>!c.disabled&&c.affordable);let c=choices.find(c=>c.next==='provider'&&c.providerOffer.choices.some(x=>!x.disabled&&x.kind!=='leave'&&x.price<=s.gold));if(!c)c=choices.find(c=>c.grant&&c.next==='complete')||choices.find(c=>c.goldGranted>0)||choices.find(c=>c.next==='battle')||choices.find(c=>c.conditionDelta>0)||choices.find(c=>c.leave)||choices[0];return {type:'eventChoice',eventId:o.id,choiceId:c?.id??null};}
 case 'prepare':return {type:'startBattle'};
 case 'battle':return {type:'finishBattle'};
 case 'reward':{const choices=visibleReward(run).filter(c=>c.kind!=='pass'&&!c.disabled).sort((a,b)=>rank(a,s,policy)-rank(b,s,policy)||a.slot-b.slot);return choices.length?{type:'claimReward',candidateId:choices[0].candidateId}:{type:'skipReward'};}
 case 'service':{const choices=serviceChoices(run).filter(c=>!c.disabled&&c.price<=s.gold&&c.kind!=='leave'&&c.kind!=='pass');let c;
  if(policy!=='novice')c=choices.find(c=>c.target)||choices.find(c=>c.kind==='rest')||choices.find(c=>c.purchaseKind==='recruit'&&s.roster.length<9&&policy==='troop-first')||choices.find(c=>c.kind==='awakening-training')||choices.find(c=>c.kind==='train'&&s.roster.find(u=>u.id===c.unitId)?.type!=='spear')||choices.find(c=>c.kind==='train')||choices.find(c=>c.kind==='research')||choices.find(c=>c.kind==='forge')||choices.find(c=>c.kind==='event'&&c.conditionDelta>0&&s.roster.some(u=>u.condition<85));
  return c?{type:'serviceAction',candidateId:c.candidateId}:{type:'leaveService'};}
 case 'awakening':{const c=availableAwakenings(run)[0];return c?{type:'awaken',unitId:c.unitId}:{type:'skipAwakening'};}
 case 'settlement':case 'defeat':return {type:'settle'};
 case 'complete':return null;default:throw Error(`Unknown phase ${s.phase}`);}
}
