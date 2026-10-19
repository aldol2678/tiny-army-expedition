// Run with node --test encounters/integration-checks.js after shared host recovery.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createEncounter,createEncounterAdapter} from './index.js';
import {createClassCombatAdapter,SECOND_CLASSES} from '../progression/index.js';
const require=createRequire(import.meta.url),{installProtectionPipeline,captureGame,restoreGame}=require('../spear-skills/v09-host.cjs');
const ctx=vm.createContext({console});for(const file of ['content.js','v09-content.js','game-engine.js'])vm.runInContext(fs.readFileSync(new URL(`../runtime/vendor/${file}`,import.meta.url),'utf8'),ctx);
const C=ctx.TinyArmyV09Content,{Game,STEP}=ctx.TinyArmy;
function fixture(heat=false){
 const spec=SECOND_CLASSES.heat_warden,roster=[{id:1,type:'guardian',slot:0,training:2,trainingTrack:'handling',condition:100},{id:2,type:'pyromancer',slot:8,training:2,trainingTrack:'handling',condition:100,...(heat?{classStage:2,secondClassId:'heat_warden',skillIds:[...spec.skillIds],ultimateId:null}:{})},{id:3,type:'warder',slot:9,training:2,trainingTrack:'handling',condition:100}];
 const encounter=createEncounter(2,{kind:'normal',row:2}),game=new Game();assert.equal(game.configureBattle({seed:1,battleId:'encounter-integration',combatRulesVersion:C.COMBAT_VERSION,roster,relics:[],skills:['heal','guard'],encounter}),true);assert.equal(game.start(),true);
 installProtectionPipeline(game,C);const adapter=createEncounterAdapter(game,encounter),classes=createClassCombatAdapter(game,{roster,statusAdapter:adapter});
 for(const u of game.units){u.x=200;u.y=220+(u.id-1)*35;u.speed=0;u.cd=1e6;u.skillCd=1e6;u.unitSkillReadyTick=1e6;u.shieldReadyTick=1e6;u.healCd=1e6;}
 const volley=game.enemies.find(u=>u.encounterRole==='volley_archer'),brute=game.enemies.find(u=>u.encounterRole==='brute');for(const e of game.enemies){e.hp=e===volley||e===brute?100000:0;e.maxHp=100000;e.speed=0;e.cd=1e6;e.x=e===volley?350:280;e.y=220;}
 const step=n=>{for(let i=0;i<n;i++){adapter.beforeTick();classes.beforeTick();game.tick(STEP);adapter.afterTick();classes.afterTick();}};
 return {game,adapter,classes,step,volley,brute};
}
const json=x=>JSON.parse(JSON.stringify(x));
test('actual scheduled volley triggers heat-veil ranged protection; melee slam does not',()=>{
 const p=fixture(true),c=fixture(false);p.step(397);c.step(397);assert.ok(p.classes.journal().some(e=>e.skillId==='heat_veil'&&e.phase==='resolve'));
 const ranged=run=>run.adapter.snapshot().receipts.filter(r=>r.type==='damage'&&r.pattern==='volley'),a=ranged(p),b=ranged(c);assert.ok(a.length>0&&a.length===b.length);assert.ok(a.every(r=>r.ranged===true));assert.ok(a.reduce((n,r)=>n+r.actualDamage,0)<b.reduce((n,r)=>n+r.actualDamage,0));
 const saved=p.classes.snapshot(),field=saved.states.find(s=>s.classId==='heat_warden').field;assert.ok(field);field.until=2000;field.remainingBudget=1000;p.classes.restore(saved);
 const before=p.classes.journal().filter(e=>e.phase==='protection').length;p.step(430);c.step(430);const melee=run=>run.adapter.snapshot().receipts.filter(r=>r.type==='damage'&&r.pattern==='narrow'),ma=melee(p),mb=melee(c);assert.ok(ma.length>0&&ma.length===mb.length);assert.ok(ma.every(r=>r.ranged===false));assert.deepEqual(ma.map(r=>r.actualDamage),mb.map(r=>r.actualDamage));assert.equal(p.classes.journal().filter(e=>e.phase==='protection').length,before);
});
test('full-Game checkpoint restores ward charge, tokens, consumed history and future pattern receipts',()=>{
 const f=fixture(),source=f.game.units[2],target=f.game.units[0];f.game.grantBarrier(source,target,100,20);assert.equal(f.adapter.protect(target.id,{sourceId:source.id,durationTicks:360}).granted,true);f.step(250);
 const saved=captureGame(f.game),before=f.adapter.snapshot();assert.ok(saved.participants.some(p=>p.id==='encounter:encounter-integration'));
 assert.equal(f.adapter.applyStatus(target.id,{type:'healing_curse'},f.volley.id).reason,'prevented');const afterConsume=captureGame(f.game);f.game.grantBarrier(source,target,300,20);f.step(170);const expected=json({state:f.adapter.snapshot(),units:f.game.units,enemies:f.game.enemies});
 restoreGame(f.game,saved);assert.deepEqual(f.adapter.snapshot(),before);assert.equal(f.adapter.applyStatus(target.id,{type:'healing_curse'},f.volley.id).reason,'prevented');f.game.grantBarrier(source,target,300,20);f.step(170);assert.deepEqual(json({state:f.adapter.snapshot(),units:f.game.units,enemies:f.game.enemies}),expected);
 restoreGame(f.game,afterConsume);assert.equal(f.adapter.protect(target.id,{sourceId:source.id}).granted,false);assert.equal(f.adapter.applyStatus(target.id,{type:'healing_curse'},f.volley.id).applied,true);
});
test('capture immediately after depletion is observational and restores before explicit expiry',()=>{
 const f=fixture(),source=f.game.units[2],target=f.game.units[0];f.game.grantBarrier(source,target,1,20);f.adapter.protect(target.id,{sourceId:source.id});f.game.hit(f.volley,target,10,'arrow',{ranged:true});assert.equal(target.barrier,null);
 const before=JSON.stringify(f.game),state=f.adapter.snapshot(),saved=captureGame(f.game);assert.equal(JSON.stringify(f.game),before);assert.deepEqual(f.adapter.snapshot(),state);restoreGame(f.game,saved);assert.deepEqual(f.adapter.snapshot(),state);assert.equal(f.adapter.applyStatus(target.id,{type:'weakness'},f.volley.id).applied,true);assert.equal(f.adapter.snapshot().status.wards.length,0);
});
test('initial full checkpoint round trip adds no public fields or RNG changes',()=>{
 const f=fixture(),before=json(f.game),state=f.adapter.snapshot(),saved=captureGame(f.game);f.step(10);restoreGame(f.game,saved);assert.deepEqual(json(f.game),before);assert.deepEqual(f.adapter.snapshot(),state);
});
