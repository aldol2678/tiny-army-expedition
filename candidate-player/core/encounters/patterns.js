import { PATTERNS, ENCOUNTER_VERSION } from './content.js';
const copy=x=>JSON.parse(JSON.stringify(x));
const byId=(a,b)=>a.id-b.id;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const total=p=>p.announce+p.cast+p.pulses.at(-1)+p.recovery;
export function createPatternState(encounter){
  if(encounter.contentVersion!==ENCOUNTER_VERSION||!encounter.mechanics)throw Error('Unsupported encounter behavior version');
  return {version:ENCOUNTER_VERSION,encounterId:encounter.id,chapter:encounter.chapter,kind:encounter.kind,mechanics:copy(encounter.mechanics),tick:-1,sequence:0,cycle:0,cycleStart:encounter.mechanics.openingTicks,cursor:0,stage:0,pendingStage:null,nextReadyTick:encounter.mechanics.openingTicks,active:null,journal:[]};
}
function log(s,type,tick,detail){const e={eventId:`${s.encounterId}:pattern:${++s.sequence}`,type,tick,...detail};s.journal.push(e);return e;}
function phase(a,tick){return tick<a.castTick?'announce':tick<a.resolveTick?'cast':tick<=a.lastImpactTick?'impact':tick<a.recoveryUntilTick?'recovery':'complete';}
function ordered(s){const list=s.mechanics.order.slice();if(!s.stage||list.length<2)return list;if(s.chapter===5){const first=s.stage===1?2:1;return [...list.slice(first),...list.slice(0,first)];}if(s.chapter===4)return [list[2],list[0],list[1]];return list.slice().reverse();}
export function shapeContains(shape,target){
  if(shape.kind==='target')return shape.targetId===target.id&&distance(shape.origin,target)<=shape.range+.000001;
  if(shape.kind==='circle')return Math.hypot(target.x-shape.x,target.y-shape.y)<=shape.radius+.000001;
  const dx=target.x-shape.x,dy=target.y-shape.y,d=Math.hypot(dx,dy);if(d>shape.radius+.000001)return false;if(d<.000001)return true;
  return (dx*shape.dx+dy*shape.dy)/d>=Math.cos(shape.halfAngle)-.000001;
}
function lockShape(owner,target,p){
  if(p.shape==='target')return {kind:'target',targetId:target.id,x:target.x,y:target.y,origin:{x:owner.x,y:owner.y},range:p.range};
  if(p.shape==='circle')return {kind:'circle',x:target.x,y:target.y,radius:p.radius};
  const d=distance(owner,target)||1;return {kind:'cone',x:owner.x,y:owner.y,dx:(target.x-owner.x)/d,dy:(target.y-owner.y)/d,radius:p.radius,halfAngle:p.halfAngle};
}
export function patternView(state){
  const a=state.active,order=ordered(state.pendingStage===null?state:{...state,stage:state.pendingStage}),next=order.length?Array.from({length:Math.min(2,order.length)},(_,i)=>PATTERNS[order[(state.cursor+i)%order.length][1]].name):[];
  return {phase:a?phase(a,state.tick):state.pendingStage!==null?'phase_notice':'waiting',active:a?copy(a):null,lockedIds:a?a.lockIds.slice():[],telegraphs:a&&state.tick<=a.lastImpactTick?[{actionId:a.actionId,name:a.name,icon:a.icon,shape:copy(a.shape),targetId:a.targetId,sourceId:a.ownerId,announceTick:a.announceTick,resolveTick:a.resolveTick,remainingTicks:Math.max(0,a.resolveTick-state.tick),dispellable:!!a.status,preventable:!!a.status}]:[],next,stage:state.stage,pendingStage:state.pendingStage};
}
/** Pure transition. Returned damage/status intents must be applied once by a host. */
export function tickPatterns(state,actors,tick){
  if(!Number.isSafeInteger(tick)||tick<0||tick<state.tick)throw Error('Pattern time must be monotone integer ticks');
  if(tick===state.tick)return {state:copy(state),intents:[],view:patternView(state)};
  const s=copy(state),intents=[];s.tick=tick;
  const enemies=actors.filter(a=>a.team==='enemy'&&a.hp>0),allies=actors.filter(a=>a.team==='ally'&&a.hp>0),boss=enemies.find(a=>a.role==='boss');
  if(s.active){const a=s.active,owner=enemies.find(e=>e.id===a.ownerId);
    if(!owner){log(s,'cancelled',tick,{actionId:a.actionId,sourceId:a.ownerId,reason:'source_dead'});s.nextReadyTick=Math.max(s.nextReadyTick,a.recoveryUntilTick+s.mechanics.gapTicks);s.active=null;}
    else {
      for(let pulse=0;pulse<a.pulseTicks.length;pulse++)if(!a.resolvedPulses.includes(pulse)&&tick>=a.pulseTicks[pulse]){
        a.resolvedPulses.push(pulse);const victims=allies.filter(v=>shapeContains(a.shape,v)).sort(byId);
        for(const v of victims){const eventId=`${a.actionId}:pulse:${pulse}:target:${v.id}`;intents.push({eventId,type:'damage',sourceId:a.ownerId,targetId:v.id,amount:a.damage/a.pulseTicks.length,damageType:a.status?'magic':'physical',ranged:a.shape.kind==='cone'||a.shape.kind==='target',pattern:a.pattern});if(a.status)intents.push({...copy(a.status),eventId:`${eventId}:status`,type:'status',statusType:a.status.type,sourceId:a.ownerId,targetId:v.id});}
        log(s,'resolved',tick,{actionId:a.actionId,pulse,sourceId:a.ownerId,targetIds:victims.map(v=>v.id),shape:copy(a.shape)});
      }
      if(tick>=a.recoveryUntilTick){log(s,'recovered',tick,{actionId:a.actionId,sourceId:a.ownerId});s.nextReadyTick=a.recoveryUntilTick+s.mechanics.gapTicks;s.active=null;}
    }
  }
  const order=ordered(s);
  if(!s.active&&order.length&&tick>=s.nextReadyTick&&allies.length){
    if(s.cursor>=order.length){
      s.cursor=0;s.cycle++;s.nextReadyTick=Math.max(s.nextReadyTick,s.cycleStart+s.mechanics.minimumCycleTicks);s.cycleStart=s.nextReadyTick;
      const ratio=boss?boss.hp/boss.maxHp:1,nextStage=s.mechanics.phaseThresholds.filter(v=>ratio<=v).length;
      if(nextStage>s.stage){s.pendingStage=nextStage;s.nextReadyTick=Math.max(s.nextReadyTick,tick+180);log(s,'phase_switch_queued',tick,{stage:nextStage,executeTick:s.nextReadyTick});}
    }
    if(tick>=s.nextReadyTick){
      if(s.pendingStage!==null){s.stage=s.pendingStage;s.pendingStage=null;log(s,'phase_switched',tick,{stage:s.stage});}
      const [role,pattern]=ordered(s)[s.cursor],p=PATTERNS[pattern];
      const owners=enemies.filter(e=>e.role===role).sort(byId),owner=owners[(s.cycle+s.cursor)%Math.max(1,owners.length)];
      if(!owner){log(s,'empty_slot',tick,{role,pattern,reason:'source_removed'});s.cursor++;s.nextReadyTick=tick+total(p)+s.mechanics.gapTicks;}
      else {const target=allies.filter(v=>distance(owner,v)<=p.range+.000001).sort((a,b)=>distance(owner,a)-distance(owner,b)||a.id-b.id)[0];
        if(target){const actionId=`${s.encounterId}:action:${++s.sequence}`,resolveTick=tick+p.announce+p.cast,lastImpactTick=resolveTick+p.pulses.at(-1),lockIds=[owner.id];
          if(boss&&owner!==boss)lockIds.push(boss.id);if(pattern==='volley'&&boss)for(const e of enemies)if(e.role==='volley_archer'&&!lockIds.includes(e.id))lockIds.push(e.id);
          s.active={actionId,pattern,name:p.name,icon:p.icon,ownerId:owner.id,targetId:target.id,shape:lockShape(owner,target,p),announceTick:tick,castTick:tick+p.announce,resolveTick,lastImpactTick,recoveryUntilTick:lastImpactTick+p.recovery,pulseTicks:p.pulses.map(t=>resolveTick+t),resolvedPulses:[],damage:owner.attackPower*p.coefficient,status:p.status?copy(p.status):null,lockIds};
          s.cursor++;log(s,'announced',tick,{actionId,sourceId:owner.id,targetId:target.id,pattern,shape:copy(s.active.shape),resolveTick,recoveryUntilTick:s.active.recoveryUntilTick});
        }
      }
    }
  }
  return {state:s,intents,view:patternView(s)};
}
