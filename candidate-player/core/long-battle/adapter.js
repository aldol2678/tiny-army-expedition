import {clone,invariant} from '../runtime/hash.js';
import {LONG_BATTLE_POLICY,pressurePercent} from './trial-config.js';
// Install last. The only finish interception is BEFORE native terminal effects.
// No vendor changes, no revive, no clock rewrite, no healing/barrier modifiers.
export function createLongBattleAdapter(game,policy=LONG_BATTLE_POLICY){
 invariant(game.phase==='battle'&&!game.__longBattleAdapter,'A new live battle is required');
 const native={finish:game.finish,hit:game.hit};
 let lowest=new Map(game.enemies.map(u=>[u.id,u.hp])),dead=new Set(),lastProgressTick=0,lastPhase=game.encounterPattern?.stage??0,lastProgressKind='start';
 game.finish=function(win,reason=''){
  if(reason==='timeout'&&win===false&&this.phase==='battle'){this.message='장기전 시험 진행 중 · 철수를 선택할 수 있습니다.';return false;}
  return native.finish.call(this,win,reason);
 };
 game.hit=function(attacker,target,amount,kind,action={}){
  const percent=attacker?.team==='enemy'&&target?.team==='ally'?pressurePercent(this.tickCount,policy):0;
  // The encounter wrapper establishes damageActionDepth before the protection
  // pipeline, so the multiplied amount is passed through the pipeline once.
  return native.hit.call(this,attacker,target,amount*(1+percent/100),kind,action);
 };
 function afterTick(){
  const tick=game.tickCount;let progress=null;
  for(const u of game.enemies){
   if(!lowest.has(u.id)){lowest.set(u.id,u.hp);progress='enemy-added';}
   else if(u.hp<lowest.get(u.id)-1e-9){lowest.set(u.id,u.hp);progress='enemy-hp-new-low';}
   if(u.hp<=0&&!dead.has(u.id)){dead.add(u.id);progress='enemy-defeated';}
  }
  const phase=game.encounterPattern?.stage??0;if(phase!==lastPhase){lastPhase=phase;progress='encounter-phase-change';}
  if(progress){lastProgressTick=tick;lastProgressKind=progress;}
 }
 function snapshot(){const tick=game.tickCount;return {policyVersion:policy.policyVersion,trial:true,tick,pressurePercent:pressurePercent(tick,policy),experimentalEnemyPressure:policy.experimentalEnemyPressure,baselineTimeMultiplier:tick>3600?1+(tick/60-60)/30:1,pressureAnnounced:policy.experimentalEnemyPressure&&tick>=policy.pressureNoticeTick,lastProgressTick,lastProgressKind,enemyIds:[...lowest.keys()],defeatedEnemyIds:[...dead],encounterStage:lastPhase,noProgress:game.phase==='battle'&&tick>=policy.pressureStartTick&&tick-lastProgressTick>=policy.noProgressTicks,progressSemantics:'per-enemy-hp-low-death-addition-and-encounter-stage-warning-only'};}
 const participant={id:`long-battle:${game.battleId}`,capture:()=>({lowest:[...lowest],dead:[...dead],lastProgressTick,lastPhase,lastProgressKind}),restore(data){lowest=new Map(data.lowest);dead=new Set(data.dead);({lastProgressTick,lastPhase,lastProgressKind}=data);}};
 game._v10CheckpointParticipants??=[];game._v10CheckpointParticipants.push(participant);
 const api={afterTick,snapshot,withdraw(){if(game.phase!=='battle')return false;const ok=game.finish(false,'withdrawal');if(ok)game.message='장기전에서 철수했습니다. 시간 초과나 전멸이 아닌 자발적 철수입니다.';return ok;}};
 game.__longBattleAdapter=api;return api;
}
