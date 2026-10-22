import {LONG_BATTLE_POLICY as P} from '../core/long-battle/trial-config.js';
// UI speed and periodic pauses are presentation policy, never game-clock ticks.
export function createLongBattleUI(){
 let battleId=null,autoHandled=false,manualLowered=false,nextPauseTick=P.safetyPauseEveryTicks,safetyPaused=false;
 function reset(id){battleId=id;autoHandled=false;manualLowered=false;nextPauseTick=P.safetyPauseEveryTicks;safetyPaused=false;}
 return {observe({id,tick,speed,enabled,active=true}){if(id!==battleId)reset(id);if(!enabled)return {speed,paused:false,notice:''};
  let nextSpeed=speed;if(active&&tick>=P.autoSpeedTick&&!autoHandled){autoHandled=true;if(!manualLowered)nextSpeed=Math.max(speed,P.autoSpeed);}
  if(active&&tick>=nextPauseTick)safetyPaused=true;
  const notice=safetyPaused?'장기전 시험 안전 정지입니다. 계속 전투하거나 철수할 수 있습니다.':tick>=P.replayBudgetTicks?'재생 검사 한도를 넘었습니다. 결과 확정이 차단될 수 있으니 원본과 진행 기록을 보존하세요.':tick>=P.autoSpeedTick?'장기전 시험 중 · 속도는 언제든 낮출 수 있습니다.':tick>=P.speedNoticeTick?'110초부터 한 번만 2배속으로 전환합니다. 수동으로 낮추면 다시 올리지 않습니다.':'';
  return {speed:nextSpeed,paused:safetyPaused,notice,nextPauseTick,autoHandled,manualLowered};},
  manualSpeed(previous,next){if(next<previous)manualLowered=true;},
  continueBattle(tick){if(!safetyPaused)return false;safetyPaused=false;nextPauseTick=(Math.floor(tick/P.safetyPauseEveryTicks)+1)*P.safetyPauseEveryTicks;return true;},
  reset
 };
}
export function longBattleStatusMarkup(state,ui){if(!state)return '';const seconds=Math.floor(state.tick/60),pressure=!state.experimentalEnemyPressure?'적 추가 압박 OFF':state.pressurePercent?`적 공격 피해 추가 +${state.pressurePercent}% (기존 시간 증폭 유지)`:(state.pressureAnnounced?'120초부터 기존 시간 증폭에 더해 적 공격 압박이 점진적으로 증가합니다.':'회복·보호막·기존 패턴 예고는 변경하지 않습니다.');return `<section class="info-box" aria-label="장기전 시험 상태"><strong>LB1 장기전 시험 · ${seconds}초</strong><p>기존 양측 피해 시간 증폭: ×${(state.baselineTimeMultiplier??1).toFixed(2)} · 60초 이후 아군과 적 모두 적용</p><p>${pressure}</p>${ui.notice?`<p role="status">${ui.notice}</p>`:''}${state.noProgress?'<p role="status">최근 30초간 적 HP 최저치·처치·새 개체·단계 변화가 확인되지 않았습니다. 재생이나 소환 등은 오판할 수 있으므로 경고만 표시합니다.</p>':''}${ui.paused?'<button type="button" class="official-button" data-action="long-battle-continue">계속 전투</button>':''}<button type="button" class="official-button" data-action="long-battle-withdraw">철수 선택</button></section>`;}
