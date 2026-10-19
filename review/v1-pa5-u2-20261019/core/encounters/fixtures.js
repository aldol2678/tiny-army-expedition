// Real pinned-engine battle comparisons. These are not earned campaign rosters.
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createEncounter,createEncounterAdapter} from './index.js';
const ctx=vm.createContext({console}),sourceHashes={};
for(const file of ['content.js','v09-content.js','game-engine.js']){const source=fs.readFileSync(new URL(`../runtime/vendor/${file}`,import.meta.url));sourceHashes[file]=createHash('sha256').update(source).digest('hex');vm.runInContext(source.toString(),ctx);}
const {Game,STEP}=ctx.TinyArmy,C=ctx.TinyArmyV09Content;
const cases={ordinary_support_no_cleanse:['guardian','charger','volley','sniper','medic','frostmage'],no_support_no_cleanse:['guardian','guardian','charger','volley','volley','sniper']},results=[];
for(const [profile,types] of Object.entries(cases))for(let chapter=3;chapter<=5;chapter++)for(const kind of ['normal','elite','boss']){
 const encounter=createEncounter(chapter,{kind,row:kind==='boss'?7:1}),game=new Game(),roster=types.map((type,i)=>({id:i+1,type,slot:i<3?i:i+5,training:2,trainingTrack:'handling',condition:70}));
 if(!game.configureBattle({seed:417,battleId:`fixture:${profile}:c${chapter}:${kind}`,combatRulesVersion:C.COMBAT_VERSION,roster,relics:[],skills:['heal','guard'],encounter})||!game.start())throw Error('Fixture rejected');
 const adapter=createEncounterAdapter(game,encounter);let maxConcurrentShapes=0;
 while(game.phase==='battle'){if(game.tickCount%60===0){game.castSkill('heal');game.castSkill('guard');}adapter.beforeTick();maxConcurrentShapes=Math.max(maxConcurrentShapes,game.encounterTelegraphs.length);game.tick(STEP);adapter.afterTick();}
 const receipt=game.history.at(-1),snapshot=adapter.snapshot();results.push({profile,chapter,kind,win:receipt.win,reason:receipt.reason,time:receipt.time,survivors:receipt.survivors,hpRatio:receipt.hpRatio,enemyPatternActions:snapshot.pattern.journal.filter(e=>e.type==='announced').length,appliedAilments:snapshot.status.journal.filter(e=>e.type==='applied').length,actualPatternDamage:snapshot.receipts.filter(e=>e.type==='damage').reduce((s,e)=>s+(e.actualDamage||0),0),maxConcurrentShapes,cleanseCasts:0,preventionCasts:0,ultimates:0,relics:0,research:0});
}
console.log(JSON.stringify({scope:'RECONSTRUCTED_ISOLATED_SIX_UNIT_COMPARISON_NOT_EARNED_CAMPAIGN_PROGRESSION',fixture:{seed:417,training:2,trainingTrack:'handling',condition:70,commands:'heal+guard once per second if ready',deployed:6,sourceHashes},results},null,2));
