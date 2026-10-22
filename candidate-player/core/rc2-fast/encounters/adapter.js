import { ENCOUNTER_VERSION } from './content.js';
import { createPatternState, tickPatterns, patternView } from './patterns.js';
import { createStatusState, tickStatuses, applyStatus, cleanseStatus, grantStatusWard, statusMultiplier } from './status.js';
const clone=x=>JSON.parse(JSON.stringify(x));
/** Install after start. Shared protection pipeline FIRST, this adapter second. */
export function createEncounterAdapter(game,encounter=game.encounter){
  if(game.phase!=='battle'||game.combatRulesVersion!=='v09-combat-1')throw Error('Start a v09-compatible isolated battle before installing encounter adapter');
  if(game.__encounterAdapter)throw Error('Encounter adapter already installed');
  if(encounter.contentVersion!==ENCOUNTER_VERSION||game.enemies.length!==encounter.enemies.length)throw Error('Encounter metadata mismatch');
  for(const e of game.enemies){const spec=encounter.enemies[e.encounterIndex];if(!spec||spec.type!==e.type)throw Error('Enemy role/index mismatch');e.encounterRole=spec.role;}
  let patterns=createPatternState(encounter),statuses=createStatusState(),view=patternView(patterns),disposed=false,lastBefore=-1,lastAfter=-1,nextBarrierToken=0;
  const preventionProviders=new Map();
  const appliedEvents=new Map(),wardBarriers=new Map(),barrierHistory=new Set(),lockedPositions=new Map();
  const native={attack:game.attack,moveToward:game.moveToward,hit:game.hit,heal:game.heal};
  const all=()=>[...game.units,...game.enemies],find=id=>all().find(u=>u.id===id),tick=()=>game.tickCount;
  const actors=()=>all().map(u=>({id:u.id,team:u.team,role:u.encounterRole||u.type,type:u.type,hp:u.hp,maxHp:u.maxHp,x:u.x,y:u.y,attackPower:u.attackPower,range:u.range}));
  function syncStatuses(){
    const living=all().filter(u=>u.hp>0),validWardIds=statuses.wards.filter(w=>{const target=find(w.targetId),source=find(w.sourceId),barrier=target?.barrier,token=wardBarriers.get(w.id);return target&&source&&source.hp>0&&target.hp>0&&barrier&&barrier._v10EncounterWardToken===token&&barrier.amount>0&&tick()<barrier.untilTick;}).map(w=>w.id);
    statuses=tickStatuses(statuses,tick(),{aliveIds:living.map(u=>u.id),validWardIds});
    for(const u of all())u.statuses=clone(statuses.statuses.filter(s=>s.targetId===u.id));
  }
  game.attack=function(u,...args){if(view.lockedIds.includes(u?.id))return false;return native.attack.call(this,u,...args);};
  game.moveToward=function(u,...args){if(view.lockedIds.includes(u?.id)){u.move=0;return;}return native.moveToward.call(this,u,...args);};
  game.hit=function(attacker,target,amount,kind,action={}){
    const adjusted=amount*statusMultiplier(statuses,attacker?.id,'damage',tick());
    // Avoid native hit's depth-zero recursion applying weakness twice.
    const resolve=()=>native.hit.call(this,attacker,target,adjusted,kind,action);
    return this.damageActionDepth>0?resolve():this.resolveDamageAction(resolve);
  };
  game.heal=function(target,amount,...args){
    // Preserve native rejection of nonfinite heals; never create Infinity/NaN HP.
    if(!Number.isFinite(amount))return 0;
    return native.heal.call(this,target,amount*statusMultiplier(statuses,target?.id,'healing',tick()),...args);
  };
  function applyStatusTo(targetId,spec,sourceId){
    syncStatuses();const target=find(targetId),source=find(sourceId);if(!target||!source||target.hp<=0||source.hp<=0||game.phase!=='battle')return {applied:false,reason:'invalid_or_dead_target'};
    const result=applyStatus(statuses,{...spec,targetId,sourceId,tick:tick()});
    if(result.applied){for(const [id,provider] of [...preventionProviders].sort(([a],[b])=>a.localeCompare(b))){const decision=provider({targetId,sourceId,statusType:spec.type,tick:tick()});if(decision?.prevented){statuses.journal.push({id:`status-event-${++statuses.sequence}`,type:'prevented',tick:tick(),targetId,sourceId,statusType:spec.type,providerId:id,rootActionId:decision.rootActionId});syncStatuses();return {applied:false,reason:'shared-ultimate-prevention'};}}}
    statuses=result.state;syncStatuses();return {...result,state:undefined};
  }
  function beforeTick(){
    if(disposed||game.phase!=='battle')return false;if(lastBefore===tick())return false;if(tick()<lastBefore)throw Error('Restore full encounter checkpoint before reversing time');lastBefore=tick();syncStatuses();
    for(const e of game.enemies)if(e.type==='boss'||e.type==='brute')e.skillCd=1e6;
    const result=tickPatterns(patterns,actors(),tick());patterns=result.state;view=result.view;game.encounterTelegraphs=clone(view.telegraphs);game.encounterPattern=clone(view);
    lockedPositions.clear();for(const id of view.lockedIds){const u=find(id);if(u&&u.hp>0){lockedPositions.set(id,{x:u.x,y:u.y});u.cd=Math.max(u.cd,.25);u.move=0;}}
    const orderedStatuses=result.intents.filter(i=>i.type!=='damage').sort((a,b)=>a.targetId-b.targetId||String(a.eventId).localeCompare(String(b.eventId)));let statusIndex=0;
    for(const intent of result.intents.map(i=>i.type==='damage'?i:orderedStatuses[statusIndex++])){if(appliedEvents.has(intent.eventId))continue;const source=find(intent.sourceId),target=find(intent.targetId);let receipt={eventId:intent.eventId,type:intent.type,tick:tick(),sourceId:intent.sourceId,targetId:intent.targetId};
      if(!source||!target||source.hp<=0||target.hp<=0)receipt.cancelled='source_or_target_dead';
      else if(intent.type==='damage'){receipt.ranged=intent.ranged===true;receipt.pattern=intent.pattern;receipt.actualDamage=game.hit(source,target,intent.amount,intent.ranged?(intent.damageType==='magic'?'arcane_bolt':'arrow'):'hit',{eventId:intent.eventId,actionType:'enemy_pattern',damageType:intent.damageType,ranged:intent.ranged===true,skillId:intent.pattern,canCrit:false});}
      else receipt.status=applyStatusTo(target.id,{...intent,type:intent.statusType},source.id);
      appliedEvents.set(intent.eventId,receipt);
    }
    return true;
  }
  function afterTick(){
    if(disposed||lastAfter===tick())return false;if(tick()<lastAfter)throw Error('Restore full encounter checkpoint before reversing time');lastAfter=tick();
    for(const [id,pos] of lockedPositions){const u=find(id);if(u&&u.hp>0){u.x=pos.x;u.y=pos.y;u.move=0;u.cd=Math.max(u.cd,.25);}}
    if(game.phase!=='battle'){statuses={...createStatusState(),sequence:statuses.sequence,journal:statuses.journal};patterns.active=null;view=patternView(patterns);game.encounterTelegraphs=[];game.encounterPattern=clone(view);for(const u of all())u.statuses=[];}
    else syncStatuses();return true;
  }
  function cleanse(targetId,options={}){syncStatuses();const target=find(targetId);if(!target||target.hp<=0||game.phase!=='battle')return {removed:[]};const r=cleanseStatus(statuses,targetId,tick(),options);statuses=r.state;syncStatuses();return {removed:r.removed};}
  function protect(targetId,{sourceId,durationTicks=240}={}){
    syncStatuses();const target=find(targetId),source=find(sourceId),barrier=target?.barrier;
    if(!Number.isSafeInteger(durationTicks)||durationTicks<=0)throw Error('Invalid protection duration');
    if(game.phase!=='battle'||!target||target.hp<=0||!source||source.hp<=0||!barrier||barrier.ownerId!==sourceId||!Number.isFinite(barrier.amount)||barrier.amount<=0||tick()>=barrier.untilTick)return {granted:false,reason:'live_owned_barrier_required'};
    if(barrier._v10EncounterWardToken&&barrierHistory.has(barrier._v10EncounterWardToken))return {granted:false,reason:'barrier_prevention_already_used'};
    const result=grantStatusWard(statuses,{targetId,sourceId,tick:tick(),expiresTick:Math.min(barrier.untilTick,tick()+durationTicks),barrierId:`barrier-${targetId}-${tick()}-${statuses.sequence}`});statuses=result.state;
    if(result.granted){const token=`${game.battleId}:encounter-barrier:${++nextBarrierToken}`;barrier._v10EncounterWardToken=token;barrierHistory.add(token);wardBarriers.set(result.ward.id,token);}return {granted:result.granted,ward:result.ward,reason:result.reason};
  }
  // Observational capture: no expiry, ward consumption, journal writes or RNG.
  function captureCheckpoint(){return clone({version:ENCOUNTER_VERSION,battleId:game.battleId,encounterId:encounter.id,patterns,statuses,view,lastBefore,lastAfter,nextBarrierToken,appliedEvents:[...appliedEvents.entries()],wardBarriers:[...wardBarriers.entries()],barrierHistory:[...barrierHistory],lockedPositions:[...lockedPositions.entries()]});}
  function restoreCheckpoint(data){
    if(disposed||data.version!==ENCOUNTER_VERSION||data.battleId!==game.battleId||data.encounterId!==encounter.id)throw Error('Mismatched encounter checkpoint');
    const saved=clone(data);patterns=saved.patterns;statuses=saved.statuses;view=saved.view;lastBefore=saved.lastBefore;lastAfter=saved.lastAfter;nextBarrierToken=saved.nextBarrierToken;
    for(const [map,entries] of [[appliedEvents,saved.appliedEvents],[wardBarriers,saved.wardBarriers],[lockedPositions,saved.lockedPositions]]){map.clear();for(const [key,value] of entries)map.set(key,value);}
    barrierHistory.clear();for(const token of saved.barrierHistory)barrierHistory.add(token);
    // The host restores Game first. Tokens follow restored barrier identities.
    // A just-depleted barrier may have an unprocessed expiration; retain it here
    // and let the next explicit tick/action expire it, never during observation.
    // Public Game metadata is already restored by the shared host. Do not add
    // absent fields or normalize stale-but-unprocessed observations here.
  }
  const participant={id:`encounter:${game.battleId}`,capture:captureCheckpoint,restore:restoreCheckpoint};game._v10CheckpointParticipants??=[];game._v10CheckpointParticipants.push(participant);
  const api={beforeTick,afterTick,cleanse,protect,applyStatus:applyStatusTo,
    registerPreventionProvider(id,provider){if(typeof id!=='string'||!id||typeof provider!=='function'||preventionProviders.has(id))throw Error('Unique status prevention provider required');preventionProviders.set(id,provider);},
    statusesFor:targetId=>clone(statuses.statuses.filter(s=>s.targetId===targetId&&tick()<s.expiresTick&&find(targetId)?.hp>0)),
    snapshot:()=>({version:ENCOUNTER_VERSION,pattern:clone(patterns),status:clone(statuses),view:clone(view),receipts:clone([...appliedEvents.values()]),integration:'PER_INSTANCE_ACTIVE_TICK_ADAPTER'}),
    // UI-only observation. Preserve current owner facts without expiring them,
    // copying journals, or changing the full snapshot/checkpoint contract.
    presentationSnapshot:()=>clone({version:ENCOUNTER_VERSION,battleId:game.battleId,tickCount:tick(),status:{version:statuses.version,statuses:statuses.statuses,wards:statuses.wards}}),
    dispose:()=>{if(disposed)return;disposed=true;Object.assign(game,native);game._v10CheckpointParticipants=game._v10CheckpointParticipants.filter(p=>p!==participant);delete game.__encounterAdapter;game.encounterTelegraphs=[];game.encounterPattern=null;for(const u of all())delete u.statuses;}};
  game.__encounterAdapter=api;return api;
}
