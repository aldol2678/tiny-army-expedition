import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {generateChapter,validateGraph,isBattle} from '../../army-v10-implementation/src/graph.js';
import {createCampaign,transition,availableNodes} from '../../army-v10-implementation/src/campaign.js';
import {INTEGRATION_TRIAL_VALUES as V,deploymentCap} from '../../army-v10-implementation/src/config.js';
const seeds=1200, routesBySeed=[], stat={graphs:0,routes:0,noRestGraphs:0,noRestRuns:0,maxElitesInChapter:0,restCountHistogram:{},serviceMandatory:0};
function enumerate(g){const all=[];function visit(id,path){const p=[...path,g.nodes[id]];if(!g.nodes[id].edges.length)all.push(p);else for(const next of g.nodes[id].edges)visit(next,p);}for(const s of g.starts)visit(s,[]);return all;}
const fatigue=p=>p.reduce((n,x)=>n+(V.fatigueByEncounter[x.kind]||0),0), rests=p=>p.filter(x=>x.kind==='rest').length;
const lex=p=>p.map(n=>n.id).join(',');
function simulate(path,roster,rotation,knockouts){let hp=Array(roster).fill(100),xp=0,minEver=100,battle=0,bossEntry=[],chapterEnd=[],zeroEvents=0;
for(const n of path){if(n.kind==='rest'){hp=hp.map(x=>Math.min(100,x+V.optionalRestRecovery));continue;}if(!isBattle(n))continue;
const size=Math.min(roster,deploymentCap(xp));let order=hp.map((v,i)=>i);if(rotation)order.sort((a,b)=>hp[b]-hp[a]||a-b);const selected=order.slice(0,size), inPlay=new Set(selected);
if(n.kind==='boss')bossEntry.push(Math.min(...selected.map(i=>hp[i])));
let koSet=new Set([...selected].sort((a,b)=>hp[a]-hp[b]||a-b).slice(0,knockouts==='boss1'?(n.kind==='boss'?1:0):knockouts));
hp=hp.map((v,i)=>inPlay.has(i)?Math.max(0,v-V.fatigueByEncounter[n.kind]-(koSet.has(i)?V.knockoutExtraFatigue:0)):Math.min(100,v+V.startingReserveRecoveryOnWin));
minEver=Math.min(minEver,...hp);zeroEvents+=hp.filter(x=>x===0).length;battle++;xp+=n.xp;if(n.kind==='boss')chapterEnd.push(Math.min(...selected.map(i=>hp[i])));
}assert.equal(battle,35);assert.equal(xp,50);return {finalMinimum:Math.min(...hp),finalMean:hp.reduce((a,b)=>a+b,0)/roster,minEver,finalBossEntry:bossEntry[4],bossEntry,chapterEnd,zeroEvents};}
const cases={};for(const policy of ['noRestSafe','restPriority','eliteMaximum'])for(const roster of [6,9,12])for(const ko of [0,1,2,'boss1']){const key=`${policy}_roster${roster}_ko${ko}`;cases[key]=[];}
for(let seed=0;seed<seeds;seed++){const selected={noRestSafe:[],restPriority:[],eliteMaximum:[]};let runRests=0;
for(let ch=1;ch<=5;ch++){const g=generateChapter(seed,ch), proven=validateGraph(g), all=enumerate(g);assert.equal(all.length,proven.paths);stat.graphs++;stat.routes+=all.length;
for(const path of all){assert.equal(path.filter(isBattle).length,7);assert.equal(path.reduce((s,n)=>s+n.xp,0),10);assert.equal(path.at(-1).kind,'boss');stat.maxElitesInChapter=Math.max(stat.maxElitesInChapter,path.filter(n=>n.kind==='elite').length);}
const direct=all.filter(p=>p.every(isBattle));assert.ok(direct.length);const safe=direct.filter(p=>p.every(n=>n.kind!=='elite'));assert.ok(safe.length);
for(const n of Object.values(g.nodes).filter(n=>!isBattle(n))){const src=Object.values(g.nodes).filter(x=>x.edges.includes(n.id));assert.ok(src.length);for(const s of src)assert.ok(n.edges.every(dst=>s.edges.includes(dst)));}
const restNodes=Object.values(g.nodes).filter(n=>n.kind==='rest').length;runRests+=restNodes;if(!restNodes)stat.noRestGraphs++;
selected.noRestSafe.push(...safe.sort((a,b)=>lex(a).localeCompare(lex(b)))[0]);
selected.restPriority.push(...all.sort((a,b)=>rests(b)-rests(a)||fatigue(a)-fatigue(b)||lex(a).localeCompare(lex(b)))[0]);
selected.eliteMaximum.push(...direct.sort((a,b)=>fatigue(b)-fatigue(a)||lex(a).localeCompare(lex(b)))[0]);
}if(!runRests)stat.noRestRuns++;stat.restCountHistogram[runRests]=(stat.restCountHistogram[runRests]||0)+1;
for(const [policy,path] of Object.entries(selected))for(const roster of [6,9,12])for(const ko of [0,1,2,'boss1'])cases[`${policy}_roster${roster}_ko${ko}`].push(simulate(path,roster,roster>6,ko));
if(seed<3)routesBySeed.push({seed,paths:Object.fromEntries(Object.entries(selected).map(([k,p])=>[k,p.map(n=>n.kind)]))});}
function summary(xs){const keys=['finalMinimum','finalMean','minEver','finalBossEntry','zeroEvents'];return Object.fromEntries(keys.map(k=>{const ys=xs.map(x=>x[k]).sort((a,b)=>a-b);return[k,{min:ys[0],p50:ys[Math.floor(ys.length/2)],max:ys.at(-1),mean:ys.reduce((a,b)=>a+b,0)/ys.length}]}));}
let c=createCampaign('route-condition-probe','condition-probe'),timing=[];
while(!['settlement','defeat'].includes(c.state.phase)){const s=c.state;let a;if(s.phase==='map'){const n=availableNodes(c).filter(isBattle).sort((a,b)=>a.lane-b.lane)[0];a={type:'selectNode',nodeId:n.id};}else if(s.phase==='prepare')a={type:'startBattle',battleId:s.pendingBattle.battleId};else if(s.phase==='battle')a={type:'recordBattleResult',battleId:s.pendingBattle.battleId,receiptId:`ASSUMED-WIN-${s.battleCount+1}`,outcome:'win'};else if(s.phase==='reward'){if(s.pendingReward.reservedSlot)timing.push({battle:s.battleCount,slot:s.pendingReward.reservedSlot,remainingBattles:35-s.battleCount});a={type:'skipReward',opportunityId:s.pendingReward.id};}else if(s.phase==='awakening'){timing.push({battle:s.battleCount,phase:s.phase,chapter:s.chapter,remainingBattles:35-s.battleCount});a={type:'skipAwakening'};}else throw Error(s.phase);c=transition(c,a);}
assert.equal(c.state.rewardLedger.length,34);assert.equal(c.state.battleCount,35);assert.equal(c.state.pendingReward,null);assert.equal(timing.find(x=>x.phase==='awakening').remainingBattles,14);
const sourceFiles=['army-v10-implementation/src/graph.js','army-v10-implementation/src/campaign.js','army-v10-implementation/src/config.js','army-v10-planning/IMPLEMENTATION-BASELINE.md'];
assert.equal(cases.noRestSafe_roster6_ko0[0].finalMinimum,55);
assert.deepEqual(cases.noRestSafe_roster6_ko0[0].chapterEnd,[91,82,73,64,55]);
assert.equal(cases.noRestSafe_roster6_koboss1[0].finalMinimum,35);
const report={status:'PASS_STRUCTURAL_ONLY',combatSimulation:false,seeds,...stat,assumptions:{allWins:true,allRecruitsPresentAtStart:true,rosters:[6,9,12],rotation:'highest condition first, ties lowest ID; roles ignored',knockouts:'0/1/2 lowest-condition deployed units per battle, or boss1 = one only on each boss; all assumed wins',restPriority:'omniscient per-chapter route maximizes number of rests then minimizes fatigue, no opportunity cost modeled',normalFatigue:V.fatigueByEncounter,reserveRecovery:V.startingReserveRecoveryOnWin,restRecovery:V.optionalRestRecovery},timing,caseSummaries:Object.fromEntries(Object.entries(cases).map(([k,v])=>[k,summary(v)])),exampleSafe:cases.noRestSafe_roster6_ko0[0],exampleRoutes:routesBySeed,sourceHashes:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))};
fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,seeds,...stat,timing},null,2));
