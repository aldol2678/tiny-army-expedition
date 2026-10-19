import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {canonical} from './registry.js';
export const SOURCE_HASHES={
 'content.js':'696b7e8186583719230b51cfe4a90b80b51e31cf578668beb0927f7b5fe783e1',
 'v09-content.js':'3583bed4cef48cedc68287ea5e7a230501b51a6670cc09dc0102434f9f95dabe',
 'game-engine.js':'6e6913f166527fc031fc270320cadcf5fcbb8e914883903ef360215a1b872f20'
};
export const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
export const source={};
for(const [file,hash] of Object.entries(SOURCE_HASHES)){
 const bytes=fs.readFileSync(new URL(`../runtime/vendor/${file}`,import.meta.url));
 if(createHash('sha256').update(bytes).digest('hex')!==hash)throw Error(`Recovered baseline pin mismatch: ${file}`);
 source[file]=bytes.toString();
}
export function newEngine(facade){const context=vm.createContext({console});for(const name of ['content.js','v09-content.js'])vm.runInContext(source[name],context,{filename:name});const original=context.TinyArmyV09Content;if(facade)context.TinyArmyV09Content=Object.freeze({...original,...facade(original)});vm.runInContext(source['game-engine.js'],context,{filename:'game-engine.js'});return {context,C:context.TinyArmyV09Content,A:context.TinyArmy,original};}
export const {C}=newEngine();
export const unit=(id,type,slot,extra={})=>({id,type,slot,training:0,trainingTrack:null,condition:100,...extra});
export const state=(extra={})=>({runId:'reconstruction-test',seed:'recovery-seed',profileId:'fresh-reconstruction-test',chapter:3,battleCount:16,xp:24,gold:100,nextUnitId:5,roster:[unit(1,'guardian',0),unit(2,'mage',4),unit(3,'archer',8),unit(4,'support',9)],relics:[],skills:['heal','guard'],unlocks:{relics:['whistle','drum','echo_crystal','emergency_case'],branches:[]},progressionLedger:[],research:{owned:[],equipped:{},purchases:[]},campaignComplete:false,prepared:false,targetRelicId:null,...extra});
export const node=(kind,row=kind==='target_shop'?3:2.5)=>({id:`s${Math.floor(row)}`,kind,row,xp:0});
export const battle=n=>({id:n%7?'b1.0':'boss',kind:n%7?'normal':'boss',row:n%7||7,rewardRole:({2:'evolve',5:'train-I',8:'train-II'}[n]||([6,15,27].includes(n)?'relic-only':'mixed'))});
