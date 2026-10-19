// Local implementation candidate only. New quantities below are internal test
// proposals, not final user-approved balance or a production release.
export const EVENT_VERSION = 'v10-eight-event-offers-1';
export const EVENT_RNG_NAMESPACE = 'v10-eight-events-selection-1';
export const EVENT_COMBAT_RNG_NAMESPACE = 'v10-eight-events-combat-1';
export const clone = value => JSON.parse(JSON.stringify(value));
export const assert = (ok, message) => { if (!ok) throw new Error(message); };
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export const EVENT_TRIAL_VALUES = freeze({
  version: 'v10-eight-events-internal-trial-1',
  status: 'INTERNAL_TEST_PROPOSAL_NOT_FINAL_USER_APPROVED_BALANCE',
  releaseReady: false,
  prisonerRansomGold: 30, ambushEscapeCondition: 8,
  suppliesConditionRecovery: 18, suppliesGold: 15,
  escapeScope: 'all-owned-including-reserve',
  // Inherited E01 semantics, not a new prepared effect.
  scoutConditionRecovery: 18, scoutConditionCost: 5,
  encounterEconomy: {
    normal: { gold: 10, xp: 1, fatigue: 1 },
    elite: { gold: 20, xp: 2, fatigue: 2 },
    boss: { gold: 30, xp: 3, fatigue: 3 },
  },
  eventXPStatus: 'INTERNAL_EVENT_XP_PROPOSAL',
  ordinaryGoldFatigueSource: 'existing-integration-per-kind-values',
  providerPrices: { training: 30, individualPreparation: 60, forgeIToII: 20, forgeIIToIII: 30, research: 20 },
  interestEnabled: false,
});
export const EVENT_DEFINITIONS = freeze({
  trainer: { id: 'trainer', name: '이동 훈련사', text: '길가의 훈련사가 병력을 살핀다.', providerKind: 'trainer' },
  field_forge: { id: 'field_forge', name: '야전 대장간', text: '대장장이가 소유 유물을 손볼 수 있다.', providerKind: 'field_forge' },
  treasure: { id: 'treasure', name: '보물상자', text: '작은 상자는 안전하다. 큰 상자는 수호병이 지킨다.' },
  prisoner: { id: 'prisoner', name: '포로 수송대', text: '수송대에 숙련 병사가 붙잡혀 있다.' },
  ambush: { id: 'ambush', name: '적의 매복', text: '전방에 적이 길을 막는다.' },
  supplies: { id: 'supplies', name: '보급고', text: '남은 보급품을 어떻게 쓸까?' },
  scout: { id: 'scout', name: '정찰 초소', text: '쉬어 갈 수도, 앞길을 정찰할 수도 있다.' },
  strategist: { id: 'strategist', name: '떠돌이 전략가', text: '지휘 명령의 다른 운용법을 배울 수 있다.', providerKind: 'strategist' },
});
export const EVENT_IDS = freeze(Object.keys(EVENT_DEFINITIONS));
export const CAPTIVE_TYPES = freeze(['charger', 'guardian', 'sniper', 'volley']);
