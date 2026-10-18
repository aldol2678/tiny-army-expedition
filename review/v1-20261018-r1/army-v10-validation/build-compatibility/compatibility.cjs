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
const baseTypes=['guardian','charger','spear','pyromancer','frostmage','volley','medic','warder','sniper'];
const slots=[0,1,2,4,5,6,8,9,10];
const variants={reference:baseTypes,no_guardian:baseTypes.map(x=>x==='guardian'?'charger':x),no_sniper:baseTypes.map(x=>x==='sniper'?'volley':x),neither:baseTypes.map(x=>x==='guardian'?'charger':x==='sniper'?'volley':x)};
const encounters={boss:{enemies:['boss','armored','bow','raider'],scale:1},pressure:{enemies:['boss','brute','armored','bow','bow','bow'],scale:1.4},high_pressure:{enemies:['boss','brute','armored','bow','bow','bow'],scale:2}};
const rows=[];
for(const [variant,types] of Object.entries(variants))for(const [encounter,enc] of Object.entries(encounters))for(let seed=1;seed<=16;seed++){
 const roster=types.map((type,i)=>({...unit(type,i+1,slots[i]),training:type==='spear'?0:2,trainingTrack:type==='spear'?null:'specialty'}));
 const g=new A.Game();assert(g.configureBattle({seed,combatRulesVersion:C.COMBAT_VERSION,roster,encounter:enc,skills:['guard','rally'],relics:[]}));assert(g.start());
 while(g.phase==='battle'){if(g.tickCount%60===0){g.castSkill('guard');g.castSkill('rally')}g.tick(A.STEP)}
 const r=g.history.at(-1);rows.push({variant,encounter,seed,win:r.win,time:r.time,hpRatio:r.hpRatio,survivors:r.survivors});
}
const summaries=[];for(const variant of Object.keys(variants))for(const encounter of Object.keys(encounters)){const rs=rows.filter(r=>r.variant===variant&&r.encounter===encounter);summaries.push({variant,encounter,n:rs.length,wins:rs.filter(r=>r.win).length,meanTime:rs.reduce((s,r)=>s+r.time,0)/rs.length});}
// Valid host actual damage can exceed projected amount due to existing time escalation.
const roster=[{...unit('charger',1,0),training:2,trainingTrack:'specialty'}];
const g=new A.Game();g.configureBattle({seed:1,combatRulesVersion:C.COMBAT_VERSION,roster,encounter:{enemies:['boss'],scale:1},skills:[],relics:[]});g.start();g.time=90;g.tickCount=5400;
const actor=g.units[0],target=g.enemies[0];actor.x=0;actor.y=0;target.x=80;target.y=0;
const p=C.projectUnit(roster[0],{roster});const state=M.createUnitState(p,{battleId:'receipt-escalation'});
const world={units:[actor,target],links:{}};const committed=M.commitAction(state,world,5373);assert(committed.committed);
let receipt,exception=null;
try{Adapter.resolveThroughHost(committed.state,{snapshot:()=>world,applyDamageOnce:e=>{receipt={eventId:e.eventId,amount:e.amount,actualDamage:g.hit(actor,target,e.amount,'hit',e)};return receipt;}},committed.state.action.resolveTick)}catch(e){exception=e.message}
assert(receipt.actualDamage>receipt.amount);assert.equal(exception,'Invalid damage receipt');
const result={scope:'Actual v09 fixed encounter ablations; NOT v1.0 win rates. All units recruited/trained upfront, no costs modeled.',sourceHashes:hashes,fixture:{variants,slots,training:'specialty II except base spear',relics:[],seedRange:[1,16],encounters,commandPolicy:'guard/rally every 60 ticks'},summaries,rows,receiptBug:{receipt,exception,time:90,seed:1,description:'Legacy rage scaling after 60s makes actualDamage > event.amount; adapter mutates HP then reducer rejects receipt.'}};
fs.writeFileSync(path.join(__dirname,'compatibility-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({summaries,receiptBug:result.receiptBug},null,2));
