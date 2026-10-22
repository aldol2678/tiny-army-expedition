import {longBattlePolicyFor,WITHDRAW_COMMAND,replayCutoffError} from '../long-battle/trial-config.js';
import {createLongBattleAdapter} from '../long-battle/adapter.js';
import {sampleGameRender} from '../../adapter/game-render-provider.js';
import {canonical,clone,digest,invariant} from './hash.js';
import {terminalResultLedger,TERMINAL_RESULT_VERSION} from './terminal-result.js';
export {TERMINAL_RESULT_VERSION};
import {ENGINE_HASHES} from './identity.js';
export const LEGACY_PROFILE='reconstructed-legacy-engine-terminal-ko-2';
let environment=null;
const profiles=new Map([[LEGACY_PROFILE,{version:LEGACY_PROFILE,contentFor:C=>C,afterStart:()=>[]}]]);
const cache=new Map();
export function initializeEngine({content,engine,withContent,engines={}}){invariant(content&&engine?.Game,'Pinned engine/content required');environment={content,engine,engines,withContent:withContent||((C,fn)=>fn())};cache.clear();}
export function engineContent(){invariant(environment,'Initialize pinned engine first');return environment.content;}
export function registerCombatProfile(id,profile){invariant(typeof id==='string'&&profile?.version&&typeof profile.contentFor==='function'&&typeof profile.afterStart==='function','Invalid combat profile');const old=profiles.get(id);invariant(!old||old.version===profile.version,'Cannot replace a registered rules identity');profiles.set(id,profile);cache.clear();}
export function clearCombatCache(){cache.clear();}
export function combatProfile(id){invariant(profiles.has(id),'Unsupported combat profile; original save must be preserved');return profiles.get(id);}
export function createBattleController(config){
 invariant(environment,'Initialize pinned engine first');const input=clone(config),longPolicy=longBattlePolicyFor(input),p=combatProfile(input.runtimeProfile||LEGACY_PROFILE),C=p.contentFor(environment.content,input),run=fn=>environment.withContent(C,fn);
 invariant(input.combatRulesVersion==='v09-combat-1','Explicit v09 rules required');
 const selectedEngine=p.engineKey?environment.engines[p.engineKey]:environment.engine;invariant(selectedEngine?.Game,'Selected pinned combat engine is unavailable');
 const game=run(()=>new selectedEngine.Game(input.seed));
 run(()=>{invariant(game.configureBattle(input)===true,'Engine rejected battle configuration');invariant(game.combatRulesVersion==='v09-combat-1','Engine rules mismatch');invariant(game.start()===true,'Engine refused start');});
 const expected=input.roster.map(u=>({id:u.id,type:u.type,slot:u.slot,training:u.training||0,trainingTrack:u.trainingTrack||null,condition:u.condition??100}));
 invariant(canonical(game.startingRoster)===canonical(expected),'Actual starting roster differs from frozen input');
 invariant(canonical(game.enemies.map(u=>u.type))===canonical(input.encounter.enemies.map(u=>typeof u==='string'?u:u.type)),'Actual enemy identities differ');
 invariant(game.battleId===input.battleId,'Actual battle identity differs');
 const hooks=run(()=>p.afterStart(game,input,C))||[],commands=[];if(longPolicy&&!game.__longBattleAdapter)hooks.push(createLongBattleAdapter(game,longPolicy));let receipt=null,fault=null;
 // Opt-in EH2 faults may follow already committed private stages. Never rewind the whole tick.
 const assertHealthy=()=>invariant(!fault,'Controller is faulted; discard it and restore by deterministic replay');
 const guarded=(operation,fn)=>{assertHealthy();try{return fn();}catch(error){if(p.failClosedOnError===true)fault={operation,tick:game.tickCount,partialState:true,reason:String(error?.message||error)};throw error;}};
 const finished=()=>game.phase!=='battle';
 function castSkill(skillId,targetId){assertHealthy();invariant(input.commandMode==='manual','Manual commands require manual-mode frozen config');invariant(!finished(),'Cannot command a finished battle');invariant(commands.length<4096,'Command limit');invariant(typeof skillId==='string','Invalid command');return guarded('command',()=>{const ok=run(()=>longPolicy&&skillId===WITHDRAW_COMMAND?targetId===undefined&&game.__longBattleAdapter.withdraw():game.castSkill(skillId,targetId));if(ok){commands.push({tick:game.tickCount,skillId,...(targetId===undefined?{}:{targetId})});if(finished())run(()=>{for(const h of hooks)h.afterTerminal?.();});}return ok;});}
 function tick(steps=1,includeSnapshot=true){assertHealthy();invariant(Number.isInteger(steps)&&steps>=1&&steps<=6601,'Invalid tick count');return guarded('tick',()=>{for(let i=0;i<steps&&!finished();i++)run(()=>{if(!longPolicy)invariant(game.tickCount<=6600,'Unresolved combat timeout');else invariant(Number.isSafeInteger(game.tickCount)&&game.tickCount<Number.MAX_SAFE_INTEGER,'Unsafe game clock');game.time=game.tickCount*selectedEngine.STEP;if(input.commandMode!=='manual'&&game.tickCount%60===0){for(const id of input.skills){const target=id==='focus'?game.enemies.filter(u=>u.hp>0).sort((a,b)=>a.id-b.id)[0]?.id:undefined;game.castSkill(id,target);}}for(const h of hooks)h.beforeTick?.();invariant(game.tick(selectedEngine.STEP)===true,'Engine tick rejected');for(const h of hooks)h.afterTick?.();});return includeSnapshot?snapshot():game.tickCount;});}
 function snapshot(){return clone(run(()=>({...game.snapshot(),...(fault?{controllerFault:clone(fault)}:{}),integration:hooks.map(h=>h.snapshot?.()||null),encounterTelegraphs:game.encounterTelegraphs||[],ultimateTelegraphs:game.ultimateTelegraphs||[],encounterPattern:game.encounterPattern||null,...(longPolicy?{longBattle:game.__longBattleAdapter.snapshot()}:{} )})));}
 function renderSnapshot(){assertHealthy();return run(()=>sampleGameRender(game,snapshot()));}
 // EL1 private presentation bridge. Full snapshot/result/checkpoint paths stay
 // unchanged; the EH2 fail-closed boundary also applies to this lean observer.
 function presentationSnapshot(){assertHealthy();return run(()=>{
  const native=game.snapshot(),integration=hooks.filter(h=>typeof h.presentationSnapshot==='function').map(h=>h.presentationSnapshot());
  for(const state of integration)invariant(state.battleId===native.battleId&&state.tickCount===native.tickCount,'Nonatomic presentation owner sample');
  return sampleGameRender(game,clone({...native,integration,
   encounterTelegraphs:game.encounterTelegraphs||[],ultimateTelegraphs:game.ultimateTelegraphs||[],encounterPattern:game.encounterPattern||null,
   ...(longPolicy?{longBattle:game.__longBattleAdapter.snapshot()}:{})
  }));
 });}
 function result(){assertHealthy();invariant(finished(),'Battle is not finished');if(receipt)return clone(receipt);const raw=game.history.at(-1);invariant(raw&&raw.battleId===input.battleId&&raw.combatRulesVersion==='v09-combat-1','No authoritative engine result');invariant(raw.win===true||raw.win===false,'Invalid engine outcome');const terminal=terminalResultLedger(raw,expected);const result=clone({...raw,integration:{version:p.version,hooks:hooks.map(h=>h.snapshot?.()||null)}});receipt={source:'REAL_PINNED_V09_ENGINE',engineHashes:p.engineHashes??ENGINE_HASHES,inputDigest:digest(input),commands:clone(commands),resultDigest:digest(result),result,knockoutVersion:terminal.version,knockoutSource:terminal.source,knockedOut:terminal.knockedOut};return clone(receipt);}
 return {tick,castSkill,commandLog:()=>clone(commands),isFinished:()=>{assertHealthy();return finished();},controllerStatus:()=>clone({failed:!!fault,...(fault?{fault}:{}),recovery:'DISCARD_AND_REPLAY_FROZEN_CONFIG'}),tickCount:()=>game.tickCount,snapshot,renderSnapshot,presentationSnapshot,result};
}
// One private replay kernel serves both execution modes. A receipt is cached only
// after the complete command/terminal checks, never after a partial tick batch.
function* replayBattle(config,commands,maxBatchTicks){
 invariant(Array.isArray(commands)&&commands.length<=4096,'Invalid command history');invariant(config.commandMode==='manual'||commands.length===0,'Commands on automatic battle');
 const key=digest([config,commands,combatProfile(config.runtimeProfile||LEGACY_PROFILE).version]);if(cache.has(key))return {key,result:cache.get(key),cached:true};
 const policy=longBattlePolicyFor(config),maximumTicks=policy?.replayBudgetTicks??6601,ctl=createBattleController(config);let pos=0,last=-1;
 for(const cmd of commands){if(policy&&Number.isSafeInteger(cmd?.tick)&&cmd.tick>maximumTicks)throw replayCutoffError(0,maximumTicks);invariant(cmd&&Object.keys(cmd).every(k=>['tick','skillId','targetId'].includes(k))&&Number.isInteger(cmd.tick)&&cmd.tick>=last&&cmd.tick<=(policy?maximumTicks:6600),'Invalid command timing/fields');last=cmd.tick;}
 while(!ctl.isFinished()){
  while(pos<commands.length&&commands[pos].tick===ctl.tickCount()){const c=commands[pos++];invariant(ctl.castSkill(c.skillId,c.targetId)===true,'Recorded command was not accepted');}
  if(ctl.isFinished())break;
  invariant(pos===commands.length||commands[pos].tick>=ctl.tickCount(),'Out of order command');
  if(policy&&ctl.tickCount()>=maximumTicks)throw replayCutoffError(ctl.tickCount(),maximumTicks);
  // Never step beyond the next recorded command. Each tick retains the original
  // STEP, RNG calls and before/after hook order; temporary content is restored
  // inside tick() before control reaches this yield.
  ctl.tick(Math.max(1,Math.min(maxBatchTicks,maximumTicks-ctl.tickCount(),pos<commands.length?commands[pos].tick-ctl.tickCount():maximumTicks)),false);
  yield {completedTicks:ctl.tickCount(),maximumTicks};
 }
 invariant(pos===commands.length,'Command after terminal battle');const result=ctl.result();invariant(canonical(result.commands)===canonical(commands),'Accepted command log mismatch');return {key,result,cached:false};
}
function acceptCompleteReplay(done){if(!done.cached){cache.set(done.key,done.result);if(cache.size>128)cache.delete(cache.keys().next().value);}return clone(done.result);}
function aborted(signal){if(signal?.aborted)throw Object.assign(new Error('Battle replay cancelled'),{name:'AbortError'});}
export function simulateBattle(config,commands=[]){const replay=replayBattle(config,commands,6601);let step=replay.next();while(!step.done)step=replay.next();return acceptCompleteReplay(step.value);}
export async function simulateBattleAsync(config,commands=[],{signal,onProgress=()=>{},yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0)),tickBatchSize=1,maxSliceMs=8}={}){
 aborted(signal);invariant(Number.isInteger(tickBatchSize)&&tickBatchSize>=1&&tickBatchSize<=6601,'Invalid replay tick batch');invariant(Number.isFinite(maxSliceMs)&&maxSliceMs>0&&maxSliceMs<=100,'Invalid replay time slice');
 // Capture caller input before the first task boundary. No externally mutable
 // command/config reference crosses an async suspension.
 const frozenConfig=clone(config),frozenCommands=clone(commands),now=()=>globalThis.performance?.now?.()??Date.now();
 await yieldControl();aborted(signal);const replay=replayBattle(frozenConfig,frozenCommands,tickBatchSize);let sliceStart=now();
 for(;;){aborted(signal);const step=replay.next();aborted(signal);if(step.done){await yieldControl();aborted(signal);return acceptCompleteReplay(step.value);}if(now()-sliceStart>=maxSliceMs){onProgress(step.value);aborted(signal);await yieldControl();aborted(signal);sliceStart=now();}}
}
