// Read-only projection of already implemented snapshot status facts. No Game,
// commands, ticks, clocks, storage, or synthetic hard-state gameplay.
import {immutableCopy,invariant} from './data.js';
const ACTIVE_TYPES={healing_curse:{kind:'curse',label:'회복 저주'},weakness:{kind:'weakness',label:'쇠약'}};
const pct=n=>Math.round(n*1000)/10;
export function readCurrentStatusFacts(frame){
 invariant(frame?.available===true&&frame.snapshot?.battleId===frame.projection?.battleId&&frame.snapshot?.tickCount===frame.projection?.tickCount,'Atomic status frame required');
 const s=frame.snapshot,tick=s.tickCount;invariant(Number.isSafeInteger(tick)&&tick>=0,'Status tick required');
 const owners=(s.integration||[]).filter(h=>h?.version==='encounter-status-patterns-1'&&h?.status?.version==='encounter-status-1'||h?.version==='enemy-pattern-d2-e4-test-only-1'&&h?.capability==='enemy-pattern-host-eh1-test-only-1'&&h?.status?.version==='d2-e1-status-test-only-1');
 invariant(owners.length<=1,'Multiple encounter status authorities');const authority=owners[0]?.status??null;
 const actors=[...(s.units||[]),...(s.enemies||[])],out=[];
 for(const u of actors){const statuses=[];if(s.phase==='battle'&&u.hp>0){
  // Membership comes from the authoritative encounter hook, not a wall clock.
  for(const e of authority?.statuses||[]){const meta=Object.hasOwn(ACTIVE_TYPES,e.type)?ACTIVE_TYPES[e.type]:null;if(e.targetId!==u.id||!meta)continue;invariant(typeof e.id==='string'&&Number.isSafeInteger(e.expiresTick)&&Number.isSafeInteger(e.appliedTick),'Explicit encounter identity/timing required');statuses.push({sourceIdentity:e.id,kind:meta.kind,label:meta.label,detail:`${e.type==='healing_curse'?'받는 치유':'주는 피해'} −${pct(e.magnitude)}%`,remainingTicks:e.expiresTick>tick?e.expiresTick-tick:null,authority:'encounter.status.statuses',sourceIds:[e.sourceId]});}
  for(const e of authority?.wards||[]){if(e.targetId!==u.id||!(e.charges>0))continue;invariant(typeof e.id==='string'&&Number.isSafeInteger(e.expiresTick),'Explicit ward identity/timing required');statuses.push({sourceIdentity:e.id,kind:'cleanse',label:'상태 예방',detail:`상태 이상 ${e.charges}회 예방 · 정화 완료 아님`,remainingTicks:e.expiresTick>tick?e.expiresTick-tick:null,authority:'encounter.status.wards',sourceIds:[e.sourceId]});}
  // Engine activeSlow uses precisely this current snapshot-tick predicate/max.
  // This is a display summary, not stack combination or a new effect.
  const slows=(u.slows||[]).filter(e=>Number.isFinite(e.value)&&e.value>0&&Number.isSafeInteger(e.untilTick)&&tick<e.untilTick).sort((a,b)=>b.value-a.value||a.untilTick-b.untilTick||String(a.sourceId).localeCompare(String(b.sourceId)));
  if(slows.length){const strongest=slows[0];statuses.push({sourceIdentity:`slow:${String(strongest.sourceId)}:${strongest.untilTick}:${strongest.value}`,kind:'slow',label:'둔화',detail:`이동 · 기본공격 ${pct(strongest.value)}% 둔화 · 현재 최대값`,remainingTicks:strongest.untilTick-tick,authority:'unit.slows / engine activeSlow',sourceIds:slows.map(e=>e.sourceId)});}
 }
 invariant(new Set(statuses.map(e=>e.kind)).size===statuses.length,'One authoritative summary per kind required');
 out.push({unitId:u.id,type:u.type,team:u.team,statuses});}
 return immutableCopy({battleId:s.battleId,gameTick:tick,units:out,unsupported:['unimplemented confusion/stun/silence','ultimate shared ward eligibility projection']});
}
export function createStatusAuthorityProjector(){
 let battleId=null,lastTick=-1,revision=0,signature='',nextSequence=0,identities=new Map(),disposed=false;
 function reset(){battleId=null;lastTick=-1;revision=0;signature='';nextSequence=0;identities.clear();}
 function sample(frame){invariant(!disposed,'Status authority disposed');const facts=readCurrentStatusFacts(frame);if(facts.battleId!==battleId){reset();battleId=facts.battleId;}invariant(facts.gameTick>=lastTick,'Status observation moved backwards');
  const raw=JSON.stringify(facts);if(raw!==signature){revision++;signature=raw;}lastTick=facts.gameTick;
  const present=new Set(),units=facts.units.map(u=>({...u,statuses:u.statuses.map(e=>{const key=JSON.stringify([u.unitId,e.kind,e.sourceIdentity]);present.add(key);if(!identities.has(key))identities.set(key,++nextSequence);const seq=identities.get(key);return {...e,instanceId:`observed-${seq}`,appliedSequence:seq,displayPriority:'normal'};})}));
  for(const key of identities.keys())if(!present.has(key))identities.delete(key);
  return immutableCopy({...facts,snapshotRevision:revision,units});
 }
 return Object.freeze({sample,reset,dispose(){reset();disposed=true;}});
}
