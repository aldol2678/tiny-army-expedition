'use strict';
// P0 regression: host time-escalation / prepared amplification must be accepted exactly once,
// while forged, replayed and resumed receipts keep exact-once settlement.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const M=require('./spear-skills.cjs'),{resolveThroughHost}=require('./adapter.cjs');
const src=path.resolve(__dirname,'../../tiny-army-sites/dist/js');
const ctx=vm.createContext({console});for(const f of ['content.js','v09-content.js','game-engine.js'])vm.runInContext(fs.readFileSync(path.join(src,f),'utf8'),ctx,{filename:f});
const C=ctx.TinyArmyV09Content,A=ctx.TinyArmy;
const unit=(type,id,slot)=>({id,type,slot,training:2,trainingTrack:'specialty',condition:100});

// Same setup as army-v10-validation/build-compatibility/receipt-bug.cjs, but with a
// contract-compliant host: durable journal keyed by eventId + full damage breakdown.
function setup({time=90,tick=5400,prepared=false}={}){
 const roster=[unit('charger',1,0)];
 const g=new A.Game();g.configureBattle({seed:1,combatRulesVersion:C.COMBAT_VERSION,roster,encounter:{enemies:['boss'],scale:1},skills:[],relics:[],prepared});g.start();g.time=time;g.tickCount=tick;
 const actor=g.units[0],target=g.enemies[0];actor.x=0;actor.y=0;target.x=80;target.y=0;
 const p=C.projectUnit(roster[0],{roster,prepared});const state=M.createUnitState(p,{battleId:'receipt-escalation'});
 const world={units:[actor,target],links:{}};
 const journal=new Map();let calls=0;
 const host={snapshot:()=>world,applyDamageOnce:e=>{
  if(journal.has(e.eventId))return journal.get(e.eventId);
  const t=[...g.units,...g.enemies].find(u=>u.id===e.targetId);
  const cond=C.CONDITION||{},longBattle=g.time>60?1+(g.time-60)/30:1;
  const prep=actor.team==='ally'&&g.prepared&&g.tickCount<M.ticks(cond.preparedDuration??10)?1+(cond.preparedDamageBonus??.1):1;
  const hpBefore=t.hp,actualDamage=g.hit(actor,t,e.amount,'hit',{actionType:e.actionType,damageType:e.damageType,canCrit:e.canCrit});calls++;
  const r=Object.freeze({eventId:e.eventId,targetId:e.targetId,amount:e.amount,amplification:longBattle*prep,incoming:e.amount*longBattle*prep,hpBefore,hpAfter:t.hp,actualDamage});
  journal.set(e.eventId,r);return r;}};
 const committed=M.commitAction(state,world,tick-27);assert(committed.committed);assert.equal(committed.state.action.resolveTick,tick);
 return {g,actor,target,world,host,journal,get calls(){return calls},committed:committed.state};
}

test('90s amplified charge (47.5 -> 95) is accepted exactly once',()=>{
 const f=setup();const hp0=f.target.hp;
 const out=resolveThroughHost(f.committed,f.host,5400);
 assert.equal(f.calls,1);assert.equal(hp0-f.target.hp,95);
 assert.equal(out.state.action,null);assert.equal(out.state.lastResolved.effective,true);
 assert.deepEqual(out.state.processedEvents,['receipt-escalation:1:1:0']);
 assert.equal(out.state.protections.filter(p=>p.skillId==='charge_cover').length,1);
 // Replaying the same receipts against the settled state is a no-op (no second cover).
 const again=M.acknowledgeEffects(out.state,[...f.journal.values()],5400);
 assert.deepEqual(again,out.state);
});

test('checkpoint taken between resolve and settlement resumes without double damage',()=>{
 const f=setup();const hp0=f.target.hp;
 const r=M.resolveAction(f.committed,f.world,5400);const checkpoint=JSON.stringify(r.state);
 // Crash after host applied damage but before the reducer acknowledged.
 for(const e of r.state.action.events)f.host.applyDamageOnce(e);
 assert.equal(f.calls,1);assert.equal(hp0-f.target.hp,95);
 const a=resolveThroughHost(JSON.parse(checkpoint),f.host,5400);
 const b=resolveThroughHost(JSON.parse(checkpoint),f.host,5400);
 assert.equal(f.calls,1,'journal must stop re-application');assert.equal(hp0-f.target.hp,95);
 assert.deepEqual(a.state,b.state);assert.equal(a.state.action,null);
 assert.equal(a.state.protections.filter(p=>p.skillId==='charge_cover').length,1);
});

test('settled state cannot be re-settled and resolve replay emits nothing',()=>{
 const f=setup();const out=resolveThroughHost(f.committed,f.host,5400);
 const replay=resolveThroughHost(JSON.parse(JSON.stringify(out.state)),f.host,5400);
 assert.equal(replay.events.length,0);assert.equal(f.calls,1);assert.deepEqual(replay.state.protections,out.state.protections);
});

test('forged or inconsistent receipts are still rejected',()=>{
 const f=setup();const r=M.resolveAction(f.committed,f.world,5400);const e=r.state.action.events[0];
 const good={eventId:e.eventId,targetId:e.targetId,amount:e.amount,amplification:2,incoming:95,hpBefore:110,hpAfter:15,actualDamage:95};
 const bad=[
  {eventId:e.eventId,actualDamage:95},                    // bare receipt above amount: unverifiable amplification
  {...good,amplification:2.5,incoming:118.75,hpAfter:0,actualDamage:110}, // amplification above 90s rule
  {...good,actualDamage:96,hpAfter:14},                    // actual > incoming
  {...good,hpAfter:20},                                    // HP delta != actualDamage
  {...good,targetId:'other'},                              // wrong target
  {...good,amount:50},                                     // altered projected amount
  {...good,incoming:100},                                  // incoming != amount*amplification
  {...good,amplification:.5,incoming:23.75,hpAfter:86.25,actualDamage:23.75}, // amplification < 1
  {...good,actualDamage:NaN},
 ];
 for(const x of bad)assert.throws(()=>M.acknowledgeEffects(r.state,[x],5400),/Invalid damage receipt/,JSON.stringify(x));
 assert.throws(()=>M.acknowledgeEffects(r.state,[good,good],5400),/Exactly one receipt/);
 assert.equal(M.acknowledgeEffects(r.state,[good],5400).action,null);
});

test('60s boundary and prepared window bounds',()=>{
 const mk=(tick,prepared=false)=>{const f=setup({time:tick/60,tick,prepared});return M.resolveAction(f.committed,f.world,tick).state;};
 const rc=(s,amp,extra={})=>{const e=s.action.events[0];return {eventId:e.eventId,targetId:e.targetId,amount:e.amount,amplification:amp,incoming:e.amount*amp,hpBefore:110,hpAfter:110-Math.min(110,e.amount*amp*.5),actualDamage:Math.min(110,e.amount*amp*.5),...extra};};
 const at60=mk(3600);assert.ok(M.acknowledgeEffects(at60,[rc(at60,1)],3600));assert.throws(()=>M.acknowledgeEffects(at60,[rc(at60,1.01)],3600),/Invalid damage receipt/);
 const at61=mk(3660);assert.equal(M.acknowledgeEffects(at61,[rc(at61,1+1/30)],3660).action,null);
 const early=mk(300,true);assert.equal(M.acknowledgeEffects(early,[rc(early,1.1)],300).action,null);
 const earlyNoPrep=mk(300,false);assert.throws(()=>M.acknowledgeEffects(earlyNoPrep,[rc(earlyNoPrep,1.1)],300),/Invalid damage receipt/);
 const afterPrep=mk(900,true);assert.throws(()=>M.acknowledgeEffects(afterPrep,[rc(afterPrep,1.1)],900),/Invalid damage receipt/);
});

test('real engine at 90s with prepared host still settles once (no prepared bonus after 10s)',()=>{
 const f=setup({prepared:true});const hp0=f.target.hp;const out=resolveThroughHost(f.committed,f.host,5400);
 assert.equal(f.calls,1);assert.equal(hp0-f.target.hp,95);assert.equal(out.state.action,null);
});
