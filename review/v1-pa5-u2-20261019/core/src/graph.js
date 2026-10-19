// New isolated route candidate. Fight counts are consequences of this trial graph,
// not a user-mandated minimum. One node per stage; services replace a fight.
import { TRIAL, INTEGRATION_TRIAL_VALUES as V } from './config.js';
import {EVENT_TRIAL_CONFIG as EV,EVENT_DEFINITION_IDS} from '../events/config.js';
export {EVENT_DEFINITION_IDS};
import { canonical, digest, invariant } from '../runtime/hash.js';
export { canonical, digest, invariant };
export function normalizeSeed(seed) {
 invariant(typeof seed === 'string' || Number.isSafeInteger(seed), 'Seed must be a string or safe integer');
 const s=String(seed).normalize('NFC');invariant(s.length>0&&s.length<=128,'Seed length must be 1..128');return s;
}
const pick=(seed,chapter,key,n)=>Number(BigInt('0x'+digest([TRIAL.mapRngNamespace,seed,chapter,key]))%BigInt(n));
export const isBattle=node=>['normal','elite','boss'].includes(node.kind);
const eventPick=(seed,chapter,key,n)=>Number(BigInt('0x'+digest(['parallel-event-map-rng-1',String(seed),chapter,key]))%BigInt(n));
function eventMetadata(seed,chapter,id,forced=null){const eventDefinitionId=forced||EVENT_DEFINITION_IDS[eventPick(seed,chapter,['definition',id],EVENT_DEFINITION_IDS.length)];return {eventDefinitionId,eventEncounterKind:eventDefinitionId==='ambush'?['normal','elite','boss'][eventPick(seed,chapter,['risk',id],3)]:eventDefinitionId==='treasure'?'elite':eventDefinitionId==='prisoner'?'normal':null,milestoneOrigin:'event'};}

export const SERVICE_ROLES=Object.freeze({lab:'전략 업그레이드',forge:'유물 업그레이드',training:'병사 업그레이드',shop:'병력·유물 구매',target_shop:'목표 유물 구매',event:'선택 사건',rest:'선택 회복'});
export function rewardRole(chapter,row){
 if(row===7)return chapter===5?'none':'mixed';
 if(chapter===1&&row===2)return 'evolve';if(chapter===1&&row===4)return 'train-I';if(chapter===2&&row===1)return 'train-II';
 return chapter===1&&row===6||chapter===3&&row===1||chapter===4&&row===6?'relic-only':'mixed';
}
function serviceKind(seed,chapter,row){
 if(row===3&&chapter===3)return 'shop';
 if(row===3&&[2,4].includes(chapter))return 'lab';
 // Never place a guaranteed unusable forge before the first relic opportunity.
 const pool=chapter===1?(row===3?['shop','event','rest']:['training','shop','event','rest']):['forge','training','shop','event','rest'];
 const selected=pool[pick(seed,chapter,['service-kind',row],pool.length)];
 // C2 narrow map delta: preserve the 5-slot draw, but never advertise unsupported E02.
 return chapter===2&&selected==='event'?'shop':selected;
}
export function generateChapter(seed,chapter){
 seed=normalizeSeed(seed);invariant(Number.isInteger(chapter)&&chapter>=1&&chapter<=TRIAL.chapters,'Invalid chapter');
 const nodes={},layers=[];
 for(let row=1;row<=6;row++){
  const layer=[],width=2+pick(seed,chapter,['width',row],2);
  for(let lane=0;lane<width;lane++){
   const service=lane===1&&[3,5].includes(row),id=service?`s${row}.1`:`b${row}.${lane}`;
   const kind=service?serviceKind(seed,chapter,row):lane===0?'normal':lane===1?[2,4].includes(row)?'elite':'normal':pick(seed,chapter,['kind',row,lane],3)===0?'elite':'normal';
   nodes[id]={id,row,lane,kind,...(service&&row===3&&chapter===3?{randomRelicSlots:3}:{}),...(kind==='event'?eventMetadata(seed,chapter,id):{milestoneOrigin:'route'}),xp:service?0:TRIAL.xpByBattle[row-1]+(kind==='elite'?TRIAL.eliteXPBonus:0),rewardRole:service?'none':rewardRole(chapter,row),edges:[],
    ...(service?{serviceRef:`service-node-c${chapter}-${id}-${kind}`,serviceRole:SERVICE_ROLES[kind],effectContract:'explicit-once-choice-no-visit-grant'}:{encounterRef:`service-node-c${chapter}-${kind}-${pick(seed,chapter,['encounter',id],4)}`})};layer.push(id);
  }layers.push(layer);
 }
 nodes.boss={id:'boss',row:7,lane:0,kind:'boss',milestoneOrigin:'chapter-boss',xp:TRIAL.xpByBattle[6],rewardRole:rewardRole(chapter,7),edges:[],encounterRef:`service-node-c${chapter}-boss`};layers.push(['boss']);
 for(let i=0;i<6;i++){
  const current=layers[i],next=layers[i+1];
  for(const src of current){const lane=nodes[src].lane,targets=new Set([next[Math.min(lane,next.length-1)]]);
   for(const dst of next)if(Math.abs(lane-nodes[dst].lane)<=1&&pick(seed,chapter,['edge',src,dst],2))targets.add(dst);
   // Every service has a visible fight alternative, including the ordinary lane.
   if(next.some(id=>!isBattle(nodes[id])))for(const dst of next)if(nodes[dst].lane<=1)targets.add(dst);
   if(!isBattle(nodes[src]))targets.add(next[0]);
   nodes[src].edges=[...targets].sort();
  }
  for(const dst of next)if(!current.some(src=>nodes[src].edges.includes(dst)))nodes[current[Math.min(nodes[dst].lane,current.length-1)]].edges.push(dst);
  for(const src of current)nodes[src].edges.sort();
 }
 // Add exactly one parallel option, preserving every original node/edge/draw.
 // A late trainer uses the added slot only; no existing facility is displaced.
 const needsLateTrainer=serviceKind(seed,3,5)!=='training'&&serviceKind(seed,4,5)!=='training';
 const fallback=chapter===4&&needsLateTrainer,row=fallback?5:[3,5][eventPick(seed,chapter,'parallel-row',2)],layer=layers[row-1],lane=layer.length,id=`e${row}.${lane}`;
 const meta=eventMetadata(seed,chapter,id,fallback?'trainer':null);
 nodes[id]={id,row,lane,kind:'event',xp:0,rewardRole:'none',...meta,parallel:true,guaranteedTrainingOpportunity:fallback,edges:[...nodes[`s${row}.1`].edges],serviceRef:`event-node-c${chapter}-${id}-${meta.eventDefinitionId}`,serviceRole:SERVICE_ROLES.event,effectContract:'frozen-two-choice-event-no-entry-grant'};
 for(const prior of layers[row-2])nodes[prior].edges=[...nodes[prior].edges,id].sort();
 layer.push(id);
 return {generatorVersion:TRIAL.generatorVersion,rulesVersion:TRIAL.rulesVersion,configVersion:TRIAL.configVersion,seed,chapter,starts:layers[0],bossPreview:{encounterRef:nodes.boss.encounterRef,riskRef:`service-node-c${chapter}-boss-risk`},nodes};
}
export function routeBudgets(graph){
 const dp={},order=Object.keys(graph.nodes).sort((a,b)=>graph.nodes[b].row-graph.nodes[a].row);
 for(const id of order){const n=graph.nodes[id],combat=+isBattle(n),risk=n.kind==='event'&&['treasure','prisoner','ambush'].includes(n.eventDefinitionId),k=n.eventEncounterKind;
  const own={battles:[combat,combat||risk?1:0],services:[combat?0:risk?0:1,combat?0:1],xp:[n.xp,n.xp+(risk?EV.encounterEconomy[k].xp:0)],gold:[combat?V.goldByEncounter[n.kind]:0,combat?V.goldByEncounter[n.kind]:risk?EV.encounterEconomy[k].gold:n.eventDefinitionId==='supplies'?EV.suppliesGold:0],rewards:[combat&&n.rewardRole!=='none'?1:0,combat&&n.rewardRole!=='none'||risk?1:0],fatigue:[combat?V.fatigueByEncounter[n.kind]:0,combat?V.fatigueByEncounter[n.kind]:n.eventDefinitionId==='ambush'?EV.ambushEscapeCondition:risk?EV.encounterEconomy[k].fatigue:0],eventChoices:[n.kind==='event'?1:0,n.kind==='event'?1:0]},tails=n.edges.map(d=>dp[d]),budget={paths:tails.length?tails.reduce((s,t)=>s+t.paths,0):1};
  for(const [field,[lo,hi]] of Object.entries(own)){budget[`min${field}`]=lo+(tails.length?Math.min(...tails.map(t=>t[`min${field}`])):0);budget[`max${field}`]=hi+(tails.length?Math.max(...tails.map(t=>t[`max${field}`])):0);}dp[id]=budget;
 }
 const starts=graph.starts.map(id=>dp[id]),result={paths:starts.reduce((s,t)=>s+t.paths,0)};for(const key of Object.keys(starts[0]).filter(k=>k!=='paths'))result[key]=(key.startsWith('min')?Math.min:Math.max)(...starts.map(t=>t[key]));return {fromNodes:dp,total:result};
}
export function validateGraph(graph){
 invariant(graph&&graph.generatorVersion===TRIAL.generatorVersion&&graph.rulesVersion===TRIAL.rulesVersion&&graph.configVersion===TRIAL.configVersion,'Unsupported graph version');invariant(canonical(graph)===canonical(generateChapter(graph.seed,graph.chapter)),'Graph differs from registered seeded generator');
 const nodes=graph.nodes,order=Object.keys(nodes).sort((a,b)=>nodes[a].row-nodes[b].row),reachable=new Set(graph.starts);invariant(order.length<=20&&order.filter(id=>nodes[id].kind==='boss').length===1,'Node bound/boss');
 for(const id of order){const n=nodes[id];invariant(reachable.has(id),'Orphan node');invariant(n.edges.length>0||id==='boss','Dead end');invariant(isBattle(n)||n.xp===0&&n.rewardRole==='none','Service grants XP/reward');for(const dst of n.edges){invariant(nodes[dst]&&nodes[dst].row===n.row+1,'Cycle/dangling/skipped stage');reachable.add(dst);}if(!isBattle(n)){invariant([3,5].includes(n.row),'Service outside investment stage');invariant(n.edges.every(dst=>isBattle(nodes[dst])),'Repeated free service chain');}}
 for(let row=1;row<=6;row++){invariant(nodes[`b${row}.0`].kind==='normal','Safe route elite/service');invariant(nodes[`b${row}.0`].edges.includes(row===6?'boss':`b${row+1}.0`),'Missing ordinary combat alternative');}
 invariant([1,2,3,4,5,6,7].every(row=>order.filter(id=>nodes[id].row===row).length<=4),'Layer width');
 const extras=order.filter(id=>nodes[id].parallel);invariant(extras.length===1,'Exactly one parallel event per chapter');for(const id of extras){const n=nodes[id];invariant(order.filter(p=>nodes[p].row===n.row-1).every(p=>nodes[p].edges.includes(id)),'Parallel event not offered to every predecessor');}
 const b=routeBudgets(graph).total;invariant(b.minbattles===5&&b.maxbattles===7&&b.maxservices===2&&b.minservices===0,'Candidate route range differs');
 return {paths:b.paths,minBattles:b.minbattles,maxBattles:b.maxbattles,minXP:b.minxp,maxXP:b.maxxp,maxServices:b.maxservices,budget:b};
}
export function validatePathPrefix(graph,path){invariant(Array.isArray(path)&&path.length<=7&&new Set(path).size===path.length,'Duplicate/oversize path');invariant(path.every(id=>typeof id==='string'&&Object.hasOwn(graph.nodes,id)),'Unknown path node');invariant(!path.length||graph.starts.includes(path[0]),'Invalid path start');for(let i=1;i<path.length;i++)invariant(graph.nodes[path[i-1]].edges.includes(path[i]),'Invalid path edge');return true;}
