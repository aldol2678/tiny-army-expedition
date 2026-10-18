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
let cases=0;const rows=[];
for(const branch of ['guardian','charger'])for(const track of ['specialty','handling'])for(const tier of [2,3])for(const id of ids)for(const rank of [1,2,3])for(const slot of [0,4,8]){
 const raw={...unit(branch,1,slot),training:2,trainingTrack:track,condition:70};
 const projected=JSON.parse(JSON.stringify(C.projectUnit(raw,{roster:[raw],relics:[relic(id,rank)]})));
 const s=M.createUnitState(projected,{battleId:'inheritance',tier});assert.deepEqual(s.projection,projected);assert.deepEqual(M.skillLoadout(branch,3).slice(0,2),M.skillLoadout(branch,2));cases++;
 rows.push({branch,track,tier,relic:id,rank,slot,projectionEqual:true});
}
fs.writeFileSync(path.join(__dirname,'inheritance-results.json'),JSON.stringify({scope:'Projection retained byte-for-byte in reducer state, NOT actual action frequency or combat contribution.',cases,rows},null,2)+'\n');console.log(JSON.stringify({cases,passed:true}));
