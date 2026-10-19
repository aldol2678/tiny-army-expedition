// TEST_ONLY fixed geometry; not a campaign policy.
// TEST_ONLY fixed-geometry foundation mechanisms, not earned/balance fixtures.
import assert from 'node:assert/strict';
import {C,engine} from '../runtime/engine.js';
import {SECOND_CLASSES} from '../progression/registry.js';
import {createClassCombatAdapter} from '../progression/combat.js';
import {createSpearCombatAdapter,installProtectionPipeline,captureGame} from '../spear-skills/browser.js';
import {installActionArbiter,createUltimateFoundationAdapter} from './adapter.js';
import {createExactMemoryStore} from './foundation.js';

export function setup({program=[],store,afterEffect,kind='watcher'}={}){const c=SECOND_CLASSES[kind],raw={id:1,type:c.firstClassId,slot:4,training:2,trainingTrack:'specialty',condition:100,classStage:3,secondClassId:kind,skillIds:[...c.skillIds,c.ultimateId],ultimateId:c.ultimateId};const roster=[raw,{id:2,type:'spear',slot:1,training:0,condition:100,trainingTrack:null}],game=new engine.Game();assert.equal(game.configureBattle({seed:23,battleId:'neutral-foundation',combatRulesVersion:C.COMBAT_VERSION,roster,skills:['heal','guard'],relics:[],encounter:{id:'neutral',enemies:['raider','raider'],scale:1,row:0}}),true);assert.equal(game.start(),true);for(const [i,u]of game.units.entries()){u.x=200;u.y=200+i*30;u.cd=100;u.speed=0;}for(const [i,e]of game.enemies.entries()){e.x=260;e.y=200+i*20;e.cd=100;e.speed=0;}installProtectionPipeline(game,C);const arbiter=installActionArbiter(game),spear=createSpearCombatAdapter(game,{content:C,roster,actionArbiter:arbiter,ultimateMode:'independent-foundation'}),classes=createClassCombatAdapter(game,{roster,actionArbiter:arbiter,ultimateMode:'independent-foundation'});const policy=program.length?{classification:'TEST_ONLY_NEUTRAL',id:'neutral-fixed-intents-1',useLimitPerUnit:1,program}:null;const ult=createUltimateFoundationAdapter(game,{roster,actionArbiter:arbiter,fixturePolicy:policy,store,afterEffect});const step=(n=1)=>{for(let i=0;i<n&&game.phase==='battle';i++){ult.beforeTick();spear.beforeTick();classes.beforeTick();game.tick(1/60);spear.afterTick();classes.afterTick();ult.afterTick();}};return {game,roster,arbiter,spear,classes,ult,step};}
export const neutralProgram=[{unitId:1,atTick:0,windupTicks:2,recoveryTicks:3,manaCost:0,effects:[{target:'enemy:0',kind:'damage',amount:1},{target:'enemy:1',kind:'damage',amount:1}]}];
