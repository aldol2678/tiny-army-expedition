// Synthetic fixed geometry and readiness for mechanism tests, never earned evidence.
import assert from 'node:assert/strict';
import {C,engine} from '../runtime/engine.js';
import {SECOND_CLASSES} from '../progression/registry.js';
import {createEncounter,createEncounterAdapter} from '../encounters/index.js';
import {createSpearCombatAdapter,installProtectionPipeline} from '../spear-skills/browser.js';
import {createClassCombatAdapter} from '../progression/combat.js';
import {installActionArbiter} from './adapter.js';
import {createUltimateTrialAdapter} from './trial-adapter.js';
import {ULTIMATE_TRIAL_CONFIG} from './trial-config.js';
export function trialSetup({kind='marksman',store,afterEffect,config=ULTIMATE_TRIAL_CONFIG,basics=false}={}){const c=SECOND_CLASSES[kind],roster=[{id:1,type:c.firstClassId,slot:4,training:2,trainingTrack:'specialty',condition:100,classStage:3,secondClassId:kind,skillIds:[...c.skillIds,c.ultimateId],ultimateId:c.ultimateId},{id:2,type:'spear',slot:5,training:0,condition:100},{id:3,type:'support',slot:8,training:0,condition:100}],encounter=createEncounter(3,{kind:'normal',row:1}),game=new engine.Game();assert.equal(game.configureBattle({seed:23,battleId:'ua2-synthetic-'+kind,combatRulesVersion:C.COMBAT_VERSION,roster,skills:['heal','guard'],relics:[],encounter}),true);assert.equal(game.start(),true);for(const [i,u]of game.units.entries()){u.x=i===0?200:240;u.y=i===0?220:i===1?200:250;u.cd=100;u.speed=0;}for(const [i,e]of game.enemies.entries()){e.x=i<3?270+i*34:500+i*40;e.y=220;e.cd=100;e.speed=0;e.publicAttackReadyTick=330;e.publicAttackSequence=e.attacks;e.range=100;}game.tickCount=300;game.time=5;game.units[0].unitSkillReadyTick=600;game.units[0].mana=game.units[0].maxMana;
 installProtectionPipeline(game,C);const arbiter=installActionArbiter(game),status=createEncounterAdapter(game,encounter),spear=createSpearCombatAdapter(game,{content:C,roster,actionArbiter:arbiter,ultimateMode:'independent-foundation'}),classes=createClassCombatAdapter(game,{roster,statusAdapter:status,actionArbiter:arbiter,ultimateMode:'independent-foundation'}),ult=createUltimateTrialAdapter(game,{roster,actionArbiter:arbiter,statusAdapter:status,config,store,afterEffect});
 const step=(n=1)=>{for(let i=0;i<n&&game.phase==='battle';i++){ult.beforeTick();if(basics){spear.beforeTick();classes.beforeTick();}game.tick(1/60);if(basics){spear.afterTick();classes.afterTick();}ult.afterTick();}};return {game,roster,status,spear,classes,arbiter,ult,step};}
