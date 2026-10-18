'use strict';
// Isolated audit: reads production sources, never patches or copies them into production.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),src=path.join(root,'tiny-army-sites/dist/js');
const files=['content.js','v09-content.js','game-engine.js','campaign.js'];
const hashes=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(src,f))).digest('hex')]));
const ctx=vm.createContext({console});for(const f of files.slice(0,3))vm.runInContext(fs.readFileSync(path.join(src,f),'utf8'),ctx,{filename:f});
const C=ctx.TinyArmyV09Content,A=ctx.TinyArmy,near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const relic=(id,evolutionStage=1)=>({id,evolutionStage,intrinsicRarity:C.RELICS[id].intrinsicRarity});
const unit=(type,id,slot)=>({id,type,slot,training:0,trainingTrack:null,condition:100});
const ids=C.RELIC_LIST.filter(x=>!x.experimental).map(x=>x.id);assert.equal(ids.length,17);assert(!ids.includes('rear_gambit'));

const M=require('../../army-v10-implementation/spear-skills/spear-skills.cjs');
const Adapter=require('../../army-v10-implementation/spear-skills/adapter.cjs');
// Valid host actual damage can exceed projected amount due to existing time escalation.
const roster=[{...unit('charger',1,0),training:2,trainingTrack:'specialty'}];
const g=new A.Game();g.configureBattle({seed:1,combatRulesVersion:C.COMBAT_VERSION,roster,encounter:{enemies:['boss'],scale:1},skills:[],relics:[]});g.start();g.time=90;g.tickCount=5400;
const actor=g.units[0],target=g.enemies[0];actor.x=0;actor.y=0;target.x=80;target.y=0;
const p=C.projectUnit(roster[0],{roster});const state=M.createUnitState(p,{battleId:'receipt-escalation'});
const world={units:[actor,target],links:{}};const committed=M.commitAction(state,world,5373);assert(committed.committed);
const hpBefore=target.hp; let receipt,exception=null;
try{Adapter.resolveThroughHost(committed.state,{snapshot:()=>world,applyDamageOnce:e=>{receipt={eventId:e.eventId,amount:e.amount,actualDamage:g.hit(actor,target,e.amount,'hit',e)};return receipt;}},committed.state.action.resolveTick)}catch(e){exception=e.message}
assert(receipt.actualDamage>receipt.amount);assert.equal(exception,'Invalid damage receipt');

console.log(JSON.stringify({receipt,exception,hpBefore,hpAfter:target.hp,tick:g.tickCount,resolveTick:committed.state.action.resolveTick},null,2));
