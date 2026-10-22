import {RCI1_LONG_PROFILE,RCI1_PRESSURE_PROFILE} from '../rci1/identity.js';
import {canonical,invariant} from '../runtime/hash.js';
// LB1 hypotheses, not shipping balance. OFF is the unmodified SF1 profile.
export const LONG_BATTLE_PROFILE='v10-private-long-battle-lb1-20261019-1';
export const LONG_BATTLE_PRESSURE_PROFILE='v10-private-long-battle-pressure-lb1-20261019-1';
export const WITHDRAW_COMMAND='long_battle_withdraw';
export const LONG_BATTLE_POLICY=Object.freeze({
 policyVersion:'long-battle-trial-lb1-2',trial:true,experimentalEnemyPressure:false,
 speedNoticeTick:95*60,autoSpeedTick:110*60,autoSpeed:2,
 pressureNoticeTick:110*60,pressureStartTick:120*60,
 pressureStepTicks:20*60,pressureStepPercent:10,pressureMaxPercent:100,
 noProgressTicks:30*60,safetyPauseEveryTicks:600*60,
 replayBudgetTicks:3600*60
});
export const LONG_BATTLE_PRESSURE_POLICY=Object.freeze({...LONG_BATTLE_POLICY,policyVersion:'long-battle-pressure-trial-lb1-2',experimentalEnemyPressure:true});
export const isLongBattleProfile=id=>[LONG_BATTLE_PROFILE,LONG_BATTLE_PRESSURE_PROFILE,RCI1_LONG_PROFILE,RCI1_PRESSURE_PROFILE].includes(id);
export function longBattlePolicyFor(config){
 if(!isLongBattleProfile(config.runtimeProfile)){invariant(config.longBattlePolicy===undefined,'Long battle policy requires the LB1 profile');return null;}
 const expected=[LONG_BATTLE_PRESSURE_PROFILE,RCI1_PRESSURE_PROFILE].includes(config.runtimeProfile)?LONG_BATTLE_PRESSURE_POLICY:LONG_BATTLE_POLICY;
 invariant(canonical(config.longBattlePolicy)===canonical(expected),'Long battle policy/version mismatch');return expected;
}
export function pressurePercent(tick,policy=LONG_BATTLE_POLICY){return !policy.experimentalEnemyPressure||tick<policy.pressureStartTick?0:Math.min(policy.pressureMaxPercent,(1+Math.floor((tick-policy.pressureStartTick)/policy.pressureStepTicks))*policy.pressureStepPercent);}
export function replayCutoffError(tick,limit){return Object.assign(new Error(`BLOCKED: 장기전 재생 검사 한도 (${limit} tick)에 도달했습니다. 패배나 보상 정산을 기록하지 않았습니다. 원본 저장을 보존하세요.`),{name:'LongBattleReplayBlockedError',code:'LONG_BATTLE_REPLAY_BLOCKED',completedTicks:tick,maximumTicks:limit});}
