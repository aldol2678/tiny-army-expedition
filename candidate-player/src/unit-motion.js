// Observation-only body motion. No Game, command, target selection or clock writes.
export const BASE_UNIT_TYPES=Object.freeze(['spear','archer','support','mage']);
const duration=Object.freeze({attack:22,cast:25,heal:26,hurt:11,healed:17,death:30});
const priority=Object.freeze({death:6,hurt:5,heal:4,cast:3,attack:2,healed:1});
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const counter=n=>finite(n)?n:null;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const increased=(a,b)=>a!==null&&b!==null&&b>a;
const health=(s,u)=>{const r=s.phase!=='battle'&&s.lastResult?.battleId===s.battleId?s.lastResult:null;const row=Array.isArray(r?.contributions)?r.contributions.find(c=>c.id===u.id&&c.type===u.type):null;return row&&finite(row.hp)&&finite(row.maxHp)&&row.hp<=row.maxHp?row:u;};
function readUnit(s,u){const h=health(s,u);if(!Number.isSafeInteger(u.id)||u.id<1||u.team!=='ally'||!BASE_UNIT_TYPES.includes(u.type)||!finite(h.hp)||!finite(h.maxHp)||h.maxHp<=0||h.hp>h.maxHp)return null;return {id:u.id,type:u.type,hp:h.hp,maxHp:h.maxHp,attacks:counter(u.attacks),healing:counter(u.stats?.healing),casts:counter(u.stats?.unitSkillCasts),damageTaken:counter(u.stats?.damageTaken),normalHeals:counter(u.stats?.normalHeals),move:!!u.move};}
export function createUnitMotionObserver(){
 let battleId=null,lastTick=-1,lastPhase=null,records=new Map();
 function reset(){battleId=null;lastTick=-1;lastPhase=null;records.clear();}
 function sample(frame,{reducedMotion=false,lowEffects=false}={}){
  const s=frame?.snapshot,p=frame?.projection;
  if(frame?.available!==true||typeof s?.battleId!=='string'||!Number.isSafeInteger(s.tickCount)||s.tickCount<0||p?.battleId!==s.battleId||p?.tickCount!==s.tickCount||!Array.isArray(s.units)||s.units.length>60)throw Error('Atomic bounded render frame required');
  const units=s.units.map(u=>readUnit(s,u)).filter(Boolean),ids=new Set(units.map(u=>u.id));if(ids.size!==units.length)throw Error('Duplicate base actor identity');
  const tick=s.tickCount,prime=battleId!==s.battleId||tick<lastTick;
  if(prime){records.clear();battleId=s.battleId;lastTick=-1;lastPhase=null;}
  const changed=tick!==lastTick||s.phase!==lastPhase,previous=new Map(records),byId=new Map(units.map(u=>[u.id,u]));
  if(!changed&&(units.length!==records.size||units.some(u=>records.get(u.id)?.value.type!==u.type)))throw Error('Same-tick actor identity changed');
  if(changed){
   const resetIds=new Set();
   for(const u of units){const old=records.get(u.id),fresh=!old||old.value.type!==u.type;
    if(fresh){resetIds.add(u.id);records.set(u.id,{value:u,events:{}});continue;}
    if(['attacks','casts','healing','damageTaken','normalHeals'].some(k=>u[k]!==null&&old.value[k]!==null&&u[k]<old.value[k])){resetIds.add(u.id);records.set(u.id,{value:u,events:{}});continue;}
    const events={...old.events},wasAlive=old.value.hp>0,alive=u.hp>0;
    const add=(kind,count)=>{events[kind]={tick,count};};
    if(wasAlive&&!alive)add('death',1);
    if(!wasAlive&&alive){resetIds.add(u.id);records.set(u.id,{value:u,events:{}});continue;}
    if(alive&&s.phase==='battle'){
     if(increased(old.value.attacks,u.attacks))add('attack',u.attacks-old.value.attacks);
     if(increased(old.value.casts,u.casts))add('cast',u.casts-old.value.casts);
     if(increased(old.value.healing,u.healing))add('heal',u.healing-old.value.healing);
     if(increased(old.value.damageTaken,u.damageTaken)&&u.hp<old.value.hp)add('hurt',u.damageTaken-old.value.damageTaken);
    }
    records.set(u.id,{value:u,events});
   }
   // Recipient healing is deliberately conservative: positive net HP, unchanged
   // max HP, positive source healing and an actually fresh resolved heal effect.
   // Old effects have no stable event IDs; never replay them by index/position.
   if(s.phase==='battle')for(const e of Array.isArray(p.effects)?p.effects:[]){
    if(resetIds.has(e.sourceId)||resetIds.has(e.targetId))continue;
    if(e.kind!=='heal'||!finite(e.max)||e.max<=0||e.life!==e.max)continue;
    const source=byId.get(e.sourceId),target=byId.get(e.targetId),oldSource=previous.get(e.sourceId)?.value,oldTarget=previous.get(e.targetId)?.value;
    if(source&&target&&oldSource&&oldTarget&&oldTarget.hp>0&&target.hp>oldTarget.hp&&target.maxHp===oldTarget.maxHp&&increased(oldSource.healing,source.healing))records.get(target.id).events.healed={tick,count:target.hp-oldTarget.hp};
   }
   for(const id of records.keys())if(!ids.has(id))records.delete(id);
   lastTick=tick;lastPhase=s.phase;
  }
  const provisional=units.map(u=>{
   const rec=records.get(u.id),dead=rec.value.hp===0,events=Object.entries(rec.events).filter(([kind,event])=>tick-event.tick>=0&&tick-event.tick<duration[kind]).sort((a,b)=>priority[b[0]]-priority[a[0]]);
   const active=s.phase!=='battle'?null:dead?events.find(([kind,e])=>kind==='death'&&!e.bodySuppressed):events.find(([kind,e])=>kind!=='death'&&!e.bodySuppressed);
   return {u:rec.value,events,active,dead};
  });
  const cap=reducedMotion?0:lowEffects?4:8,allowed=new Set(provisional.filter(x=>x.active).sort((a,b)=>priority[b.active[0]]-priority[a.active[0]]||a.u.id-b.u.id).slice(0,cap).map(x=>x.u.id));
  // Admission is final for each observed event. A dropped/cap-excluded body
  // never appears later when another slot clears (especially a KO remnant).
  for(const item of provisional){const chosen=allowed.has(item.u.id)?item.active:null;for(const [,e] of item.events)if(e!==chosen?.[1])e.bodySuppressed=true;if(!chosen)item.active=null;}
  const poses=provisional.map(({u,events,active,dead})=>{
   const animated=!!active&&allowed.has(u.id),kind=active?.[0]??null,event=active?.[1],progress=event?clamp((tick-event.tick)/duration[kind]):1;
   const envelope=animated?1-smooth(Math.max(0,(progress-.1)/.9)):0;
   const react=kind==='attack'||kind==='cast'||kind==='heal';
   const motionScale=lowEffects?.45:1;
   let rotation=0,sx=1,sy=1;
   if(animated&&!dead){if(kind==='hurt')rotation=-.025*envelope;else if(react){rotation=({spear:.035,archer:-.035,support:-.02,mage:.018}[u.type])*envelope;sx=1+(u.type==='archer'?-.012:.012)*envelope;sy=1+(u.type==='mage'||kind==='heal'?.018:-.008)*envelope;}}
   rotation*=motionScale;sx=1+(sx-1)*motionScale;sy=1+(sy-1)*motionScale;
   return {id:u.id,type:u.type,battleId,observedTick:tick,prepare:0,phase:dead?'knockout':!animated?'idle':kind==='hurt'?'hurt':kind==='healed'?'healed':progress<.24?'observed-action':'recovery',primary:kind,dead,terminalOutcome:s.phase!=='battle'&&s.lastResult?.battleId===s.battleId?s.lastResult.win:null,animated,progress,bodyRotation:rotation,scaleX:sx,scaleY:sy,attack:animated&&react?envelope:0,hit:animated&&kind==='hurt'&&!lowEffects?envelope*.75:0,actionKind:kind==='heal'?'heal':kind==='cast'?'arcane_bolt':'attack',active:kind==='heal'&&animated,deathProgress:dead?(animated?smooth(progress):1):null,healMark:animated&&kind==='healed'&&!lowEffects?envelope:0,phaseClock:reducedMotion?0:tick/60+u.id,moving:!reducedMotion&&u.move,reducedMotion:!!reducedMotion,lowEffects:!!lowEffects,observations:events.map(([channel,e])=>({channel,observedTick:e.tick,delta:e.count,bodySuppressed:!!e.bodySuppressed})),warning:'Observed after simulation; not a predicted hit or exact event timestamp'};
  });
  return freeze({battleId,tickCount:tick,prime,poses,animatedCount:poses.filter(p=>p.animated).length,maxAnimated:cap,eventEffectsAdded:0,eventEffectsRemoved:0});
 }
 return Object.freeze({sample,reset});
}
