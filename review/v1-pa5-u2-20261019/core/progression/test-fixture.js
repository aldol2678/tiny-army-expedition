import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {SECOND_CLASSES} from './registry.js';
import {createClassCombatAdapter} from './combat.js';
const require=createRequire(import.meta.url);
let host={};
if(fs.existsSync(new URL('../spear-skills/v09-host.cjs',import.meta.url)))host=require('../spear-skills/v09-host.cjs');
else if(fs.existsSync(new URL('../spear-skills/browser.js',import.meta.url)))host=await import('../spear-skills/browser.js');
export const protectionAvailable=typeof host.installProtectionPipeline==='function';
export const context=vm.createContext({console});for(const file of ['content.js','v09-content.js','game-engine.js'])vm.runInContext(fs.readFileSync(new URL(`../runtime/vendor/${file}`,import.meta.url),'utf8'),context);
export const C=context.TinyArmyV09Content,Game=context.TinyArmy.Game;
export function fixture(id,{tier=2,track='specialty',condition=100,enemyTypes=['raider','raider','raider'],statusAdapter=null,startTick=300,restore=null}={}){
 const c=SECOND_CLASSES[id],raw={id:1,type:c.firstClassId,training:2,trainingTrack:track,slot:4,condition,classStage:tier,secondClassId:id,skillIds:[...c.skillIds,...(tier===3?[c.ultimateId]:[])],ultimateId:tier===3?c.ultimateId:null};
 const roster=[raw,{id:2,type:'guardian',slot:0,training:0,trainingTrack:null,condition:100},{id:3,type:'spear',slot:1,training:0,trainingTrack:null,condition:100}],game=new Game();assert(game.configureBattle({seed:17,battleId:`recovered-${id}`,combatRulesVersion:C.COMBAT_VERSION,roster,relics:[],skills:['heal','guard'],encounter:{id:'fixture',enemies:enemyTypes,scale:1,row:0}}));assert(game.start());
 game.tickCount=startTick;game.time=startTick/60;for(let i=0;i<game.units.length;i++){const a=game.units[i];a.x=200;a.y=200+i*40;a.speed=0;a.attackPower=i?0:a.attackPower;a.cd=i?100:0;a.hp=a.maxHp;}
 for(let i=0;i<game.enemies.length;i++){const e=game.enemies[i];e.x=390;e.y=200+i*25;e.speed=0;e.attackPower=0;e.damage=0;e.hp=e.maxHp=10000;e.cd=100;}
 if(restore)for(const [k,v]of Object.entries(restore.game))game[k]=JSON.parse(JSON.stringify(v));
 if(protectionAvailable)host.installProtectionPipeline(game,C);
 const adapter=createClassCombatAdapter(game,{roster,statusAdapter,restore:restore?.adapter}),u=game.units[0];
 const step=n=>{for(let i=0;i<n&&game.phase==='battle';i++){adapter.beforeTick();game.tick(1/60);adapter.afterTick();}};
 return {game,u,roster,adapter,step};
}
// This cold-fixture capture is a TEST helper, not a durable host transaction API.
export function coldCapture(f){const game={};for(const [k,v]of Object.entries(f.game))if(!k.startsWith('_v10')&&typeof v!=='function'&&v!==undefined)game[k]=JSON.parse(JSON.stringify(v));return {game,adapter:f.adapter.snapshot()};}
export const commits=(a,id)=>a.journal().filter(e=>e.phase==='commit'&&e.skillId===id);
export const effects=(a,id)=>a.journal().filter(e=>e.phase==='effect'&&e.skillId===id);
export const captureGame=host.captureGame,restoreGame=host.restoreGame;
