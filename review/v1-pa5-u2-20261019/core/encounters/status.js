// Pure, deterministic non-stacking statuses. Tick is authoritative, not wall time.
export const STATUS_VERSION='encounter-status-1';
export const STATUS_LIMITS=Object.freeze({healing_curse:Object.freeze({magnitude:.25,durationTicks:240,priority:0}),weakness:Object.freeze({magnitude:.15,durationTicks:240,priority:1})});
const copy=x=>JSON.parse(JSON.stringify(x));
const validTick=t=>Number.isSafeInteger(t)&&t>=0;
export function createStatusState(){return {version:STATUS_VERSION,sequence:0,statuses:[],wards:[],cooldowns:{},journal:[]};}
function log(s,type,tick,detail){const e={id:`status-event-${++s.sequence}`,type,tick,...detail};s.journal.push(e);return e;}
export function tickStatuses(state,tick,{aliveIds=null,validWardIds=null}={}){
  if(!validTick(tick))throw Error('Invalid status tick');const s=copy(state),alive=aliveIds&&new Set(aliveIds),wards=validWardIds&&new Set(validWardIds);
  s.statuses=s.statuses.filter(e=>{const keep=tick<e.expiresTick&&(!alive||alive.has(e.targetId));if(!keep)log(s,'expired',tick,{statusId:e.id,targetId:e.targetId,reason:tick>=e.expiresTick?'duration':'target_dead'});return keep;});
  s.wards=s.wards.filter(e=>{const keep=e.charges>0&&tick<e.expiresTick&&(!alive||(alive.has(e.targetId)&&alive.has(e.sourceId)))&&(!wards||wards.has(e.id));if(!keep)log(s,'ward_ended',tick,{wardId:e.id,targetId:e.targetId});return keep;});return s;
}
export function applyStatus(state,{type,targetId,sourceId,tick,magnitude,durationTicks}){
  const limits=STATUS_LIMITS[type];if(!limits||!validTick(tick)||!Number.isSafeInteger(targetId)||!Number.isSafeInteger(sourceId))throw Error('Invalid status intent');
  if(magnitude!==undefined&&(!Number.isFinite(magnitude)||magnitude<=0))throw Error('Invalid status magnitude');
  if(durationTicks!==undefined&&(!Number.isSafeInteger(durationTicks)||durationTicks<=0))throw Error('Invalid status duration');
  let s=tickStatuses(state,tick),key=`${targetId}:${type}`;
  if(s.statuses.some(e=>e.targetId===targetId&&e.type===type)||tick<(s.cooldowns[key]||0))return {state:s,applied:false,reason:'nonstacking_or_reapply_gap'};
  const ward=s.wards.filter(e=>e.targetId===targetId).sort((a,b)=>a.expiresTick-b.expiresTick||a.id.localeCompare(b.id))[0];
  if(ward){ward.charges=0;log(s,'prevented',tick,{wardId:ward.id,targetId,sourceId,statusType:type});s.wards=s.wards.filter(e=>e.charges>0);return {state:s,applied:false,reason:'prevented'};}
  const e={id:`status-${++s.sequence}`,type,sourceId,targetId,appliedTick:tick,expiresTick:tick+Math.min(durationTicks??limits.durationTicks,limits.durationTicks),magnitude:Math.min(magnitude??limits.magnitude,limits.magnitude),dispellable:true,preventable:true};
  s.statuses.push(e);s.cooldowns[key]=e.expiresTick+120;log(s,'applied',tick,{statusId:e.id,statusType:type,targetId,sourceId});return {state:s,applied:true,status:copy(e)};
}
export function cleanseStatus(state,targetId,tick,{max=1}={}){
  if(max!==1)throw Error('P0 cleanse budget is exactly one');const s=tickStatuses(state,tick),eligible=s.statuses.filter(e=>e.targetId===targetId&&e.dispellable).sort((a,b)=>STATUS_LIMITS[a.type].priority-STATUS_LIMITS[b.type].priority||a.expiresTick-b.expiresTick||a.id.localeCompare(b.id));
  const e=eligible[0];if(!e)return {state:s,removed:[]};s.statuses=s.statuses.filter(x=>x.id!==e.id);log(s,'cleansed',tick,{statusId:e.id,targetId});return {state:s,removed:[copy(e)]};
}
export function grantStatusWard(state,{targetId,sourceId,tick,expiresTick,barrierId}){
  if(!validTick(tick)||!validTick(expiresTick)||expiresTick<=tick||typeof barrierId!=='string'||!barrierId||!Number.isSafeInteger(targetId)||!Number.isSafeInteger(sourceId))throw Error('Invalid ward intent');
  const s=tickStatuses(state,tick);if(s.wards.some(e=>e.targetId===targetId))return {state:s,granted:false,reason:'existing_ward'};
  const e={id:`ward-${++s.sequence}`,targetId,sourceId,barrierId,appliedTick:tick,expiresTick:Math.min(expiresTick,tick+360),charges:1};s.wards.push(e);log(s,'ward_granted',tick,{wardId:e.id,targetId,sourceId});return {state:s,granted:true,ward:copy(e)};
}
export function statusMultiplier(state,targetId,kind,tick){const type=kind==='healing'?'healing_curse':kind==='damage'?'weakness':null;if(!type)throw Error('Unknown multiplier kind');return 1-state.statuses.filter(e=>e.targetId===targetId&&e.type===type&&tick<e.expiresTick).reduce((n,e)=>Math.max(n,e.magnitude),0);}
