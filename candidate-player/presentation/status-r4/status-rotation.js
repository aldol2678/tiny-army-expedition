// R4 presentation only. Owns no battle state, clock, timer, DOM, RNG or gameplay effect.
const KINDS=new Set(['confusion','stun','silence','curse','weakness','slow','cleanse']);
const id=x=>(typeof x==='string'&&x.length>0&&x.length<=100)||Number.isSafeInteger(x);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const fail=(ok,m)=>{if(!ok)throw new TypeError(m);};
const frozen=x=>Object.freeze(x);
export function createStatusIndicator({battleId,unitId,cycleMs=1000,urgentHoldMs=120}){
 fail(id(battleId)&&id(unitId),'Explicit owner required');fail(Number.isFinite(cycleMs)&&cycleMs>=500&&cycleMs<=3000,'Bounded display cycle required');fail(Number.isFinite(urgentHoldMs)&&urgentHoldMs>=80&&urgentHoldMs<=200,'Bounded urgent hold required');
 let disposed=false,lastRevision=-1,lastTick=-1,lastSignature='',lastClock=null,lastPaused=true,displayTime=0,frameId=0,pending=null,currentId=null,lastPresentedAt=0,lastNormalId=null,shown=new Set();
 function update(snapshot,{displayNowMs,paused=false,reducedMotion=false}={}){
  fail(!disposed,'Indicator disposed');fail(snapshot?.battleId===battleId&&snapshot?.unitId===unitId,'Wrong battle/unit owner');fail(integer(snapshot.snapshotRevision)&&snapshot.snapshotRevision>=lastRevision,'Stale authority snapshot');fail(integer(snapshot.gameTick)&&snapshot.gameTick>=lastTick,'Stale game tick');fail(Number.isFinite(displayNowMs)&&displayNowMs>=0&&(lastClock===null||displayNowMs>=lastClock),'Monotonic display time required');fail(typeof paused==='boolean'&&typeof reducedMotion==='boolean','Explicit presentation flags required');fail(Array.isArray(snapshot.statuses)&&snapshot.statuses.length<=7,'At most seven active statuses');
  const seen=new Set(),seenKinds=new Set(),previous=new Map((pending?.detail||[]).map(e=>[e.instanceId,e]));const entries=snapshot.statuses.map(e=>{fail(e&&id(e.instanceId)&&!seen.has(e.instanceId)&&KINDS.has(e.kind),'Invalid or duplicate status');seen.add(e.instanceId);fail(!seenKinds.has(e.kind),'One authoritative summary per status kind required');seenKinds.add(e.kind);const prior=previous.get(e.instanceId);fail(!prior||(prior.kind===e.kind&&prior.appliedSequence===e.appliedSequence),'Active instance identity changed');fail(integer(e.appliedSequence),'Authority apply order required');fail(e.remainingTicks===null||(integer(e.remainingTicks)&&e.remainingTicks>0),'Active remaining ticks must be positive or unknown; renderer does not expire states');const urgent=e.kind==='stun'||e.kind==='silence';fail(e.displayPriority===(urgent?'urgent':'normal'),'Explicit hard-state display priority required');return frozen({instanceId:e.instanceId,kind:e.kind,displayPriority:e.displayPriority,appliedSequence:e.appliedSequence,remainingTicks:e.remainingTicks});}).sort((a,b)=>a.appliedSequence-b.appliedSequence||String(a.instanceId).localeCompare(String(b.instanceId)));
  const signature=JSON.stringify([snapshot.gameTick,entries]);fail(snapshot.snapshotRevision!==lastRevision||signature===lastSignature,'Same snapshot revision changed contents');
  // Pause/resume edges consume no wall-time gap. Only unpaused presentation intervals rotate.
  if(lastClock!==null&&!paused&&!lastPaused)displayTime+=displayNowMs-lastClock;
  lastClock=displayNowMs;lastPaused=paused;lastRevision=snapshot.snapshotRevision;lastTick=snapshot.gameTick;lastSignature=signature;
  shown=new Set([...shown].filter(x=>seen.has(x)));let current=entries.find(e=>e.instanceId===currentId)||null;if(!current)currentId=null;
  const unseenUrgent=entries.filter(e=>e.displayPriority==='urgent'&&!shown.has(e.instanceId)).sort((a,b)=>(a.remainingTicks??Infinity)-(b.remainingTicks??Infinity)||b.appliedSequence-a.appliedSequence||String(a.instanceId).localeCompare(String(b.instanceId)));
  let chosen=current;
  if(unseenUrgent.length&&(!current||current.displayPriority!=='urgent'||displayTime-lastPresentedAt>=urgentHoldMs))chosen=unseenUrgent[0];
  else if(!current){const normals=entries.filter(e=>e.displayPriority==='normal');const i=normals.findIndex(e=>e.instanceId===lastNormalId);chosen=normals.length?normals[(i+1)%normals.length]:entries[0]||null;}
  else if(!paused&&displayTime-lastPresentedAt>=cycleMs){const i=entries.findIndex(e=>e.instanceId===currentId);chosen=entries[(i+1)%entries.length]||null;}
  const frame=frozen({battleId,unitId,frameId:++frameId,snapshotRevision:lastRevision,gameTick:lastTick,entry:chosen,detail:frozen(entries.slice()),size:24,paused,reducedMotion,transition:'replace-no-flash',needsPlacement:!!chosen});pending=frame;return frame;
 }
 function acknowledgePresented(candidateFrameId){
  if(disposed||!pending||pending.frameId!==candidateFrameId)return false;
  const e=pending.entry;if(!e){currentId=null;return true;}
  if(currentId!==e.instanceId||!shown.has(e.instanceId))lastPresentedAt=displayTime;
  currentId=e.instanceId;shown.add(e.instanceId);if(e.displayPriority==='normal')lastNormalId=e.instanceId;return true;
 }
 function isCurrent(candidateFrameId){return !disposed&&pending?.frameId===candidateFrameId;}
 function dispose(){disposed=true;pending=null;shown.clear();currentId=null;frameId++;}
 return frozen({update,acknowledgePresented,isCurrent,dispose});
}
