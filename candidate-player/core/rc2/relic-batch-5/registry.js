import {assert, deepFreeze} from '../relic-services/registry.js';

// Isolated TEST_ONLY definitions. No acquisition, forge, UI or persistent-stat wiring.
export const RB5_CAPABILITY = 'TEST_ONLY_RELIC_BATCH_RB5';
export const RB5_VERSION = 'relic-semantic-batch-rb5-1';
export const RB5_CHECKPOINT = 'relic-semantic-batch-rb5-checkpoint-1';
export const RB5_CASCADE_LOCK_REASON = 'BLOCKED_SPEC: the preserved cascade_cup source consumes on success, while the approved no-repeated-discount-on-failed-commit rule requires ownership at discounted commit. No reconciliation is authorized; the effect stays disabled, including with the RB5 capability.';

// Verbatim original records. Pool/status language is provenance, not authorization.
const chargeSheathSource = {
  "no": 30,
  "id": "charge_sheath",
  "name": "돌격 칼집",
  "rarity": "고급",
  "effect": "유효 돌격 피해 해결 뒤 본인 DEF +4/6/8, 2초"
};

const steadyPendulumSource = {
  "no": 50,
  "id": "steady_pendulum",
  "name": "침착한 진자",
  "rarity": "희귀",
  "effect": "마나가 가득 찬 채 3초 이상 기다린 뒤 다음 유료 주문 마나 비용 -2/3/4"
};

const cascadeCupSource = {
  "id": "cascade_cup",
  "name": "연계 잔",
  "rarity": "희귀",
  "role": "기술·지휘",
  "short_effect": "유료 기술 2표적 적중 뒤 다음 단일 기술 −1/2/3마나",
  "precise_trigger_and_targets": "같은 병사의 한 번 유료 피해 기술이 서로 다른 적 2명 이상에게 실제 피해를 주면 다음 합법 단일 대상 유료 기술의 실제 비용을 줄임",
  "cap_and_overflow": "원 비용20% 이하·최소1마나; 성공 시 소비, 미사용 전투 종료 시 소멸",
  "stacking_and_reuse": "병사별8초 내부쿨, 스택1, 파생 틱·반사 피해는 대상수에서 제외",
  "acquisition_and_upgrades": "정예·마법 목표, I/II/III 제련",
  "inherited_after_promotion": "마법 부모 계열·유료 기술",
  "synergy_and_abuse_risk": "광역→단일 연결; 단일 보스 무효",
  "icon_motif": "연결된 두 잔의 물길",
  "implementation_difficulty": "높음",
  "verification_cases": "2표적 중복 hit·0코스트·20% 상한·시전 실패·로드",
  "dependency_gate": "스킬 대상별 직접 피해 기록",
  "status": "설계 완료 / 미구현 / 아트 미제작 / 밸런스 미검증",
  "values_status": "I/II/III 모두 검증 전 가안",
  "upgrade_values": [
    1,
    2,
    3
  ],
  "max_stage": 3,
  "upgrade_metric": "정의된 적격 상황에서 효과의 이익 지표(세부 단위는 효과문구 참조)",
  "upgrade_efficacy": "검증 전 가안: 추가 후보·대상·효과의 실제 실효는 적격/상한/반올림 확인 필요. 실효0인 상태에서는 제련 UI 비활성; III 강제하지 않음.",
  "capability_status": "DESIGN_ONLY_UNVERIFIED_IN_CURRENT_ENGINE",
  "eligible_pool": "DISABLED_UNTIL_REQUIRED_CAPABILITIES_AND_QA",
  "contract_evidence": "R2-review PI1 동결 소스 기반 검토 / 실제 지원·런타임 검증 별도",
  "policy_status": "NOT_ADOPTED",
  "no_retroactive": true,
  "action_id_scope": "runId + battleId(if any) + originalActionId + relicId + targetId(if any) + effectUseSequence; persisted in checkpoint",
  "upgrade_policy": "수치 상승만으로 PASS 아님. 각 단계 I→II→III에서 같은 적격 시드/편성/원장에서 실효가 단조개선되는 테스트. 이미 상한에 걸린 시전은 제련 불가/무효 표시, 수치 보정으로 상한 우회 금지.",
  "capability_group": "CONDITIONAL",
  "pool_eligibility_rule": "불변 기준: 신규47종은 런타임/기능 게이트 PASS+기존26회귀 PASS+승인된 풀 정책 충족 후에만 후보 포함; R2 작성만으로 후보에 편입 금지.",
  "ownership": "군단 전역 유물1개; 개별 병사는 효과 적용대상이지 유물 소유자가 아님.",
  "consumption_contract": "획득 전 사건 소급0. 소비한 효과는 제련/교환/재획득/전직/런 저장 복원으로 재충전0(별도 명시한 다회사용 제외).",
  "targeting_and_rollover": "대상 존재·합법성·정수·cap 판정 후 1회; 한도 초과/효과 미발동은 RNG 증가, 자원 보전, 미래 이월 없음.",
  "engine_supported": "아니오: R2에서는 신규47을 실제 엔진 구현/검증한 것으로 간주하지 않는다."
};

const concordMedallionSource = {
  "id": "concord_medallion",
  "name": "공명 훈장",
  "rarity": "전설",
  "role": "전직·진화",
  "short_effect": "궁극진화 병사 둘 이상일 때 첫 기술 마나 −1/2/3",
  "precise_trigger_and_targets": "같은 전투 출전 roster 중 *서로 다른 soldierId*의 궁극진화 완료가 2명 이상일 경우 각 궁극병사 첫 유료 고유기술의 실제 지불 마나만 줄임",
  "cap_and_overflow": "최대 원가20%, 비용 최저1마나; 궁극기의 무료 시전·일반 기술 삭제 없음",
  "stacking_and_reuse": "각 해당 병사당 전투1회, 2명 출전 탈락 후 이미 확정한 혜택 회수 없음",
  "acquisition_and_upgrades": "일반 전설 풀·정예, I/II/III 제련",
  "inherited_after_promotion": "궁극 병사 고유ID와 직업계열 계승",
  "synergy_and_abuse_risk": "다중 궁극의 선택적 보상; 조기 궁극 없으면 무효, 필수 열쇠는 아님",
  "icon_motif": "서로 비추는 훈장 둘",
  "implementation_difficulty": "높음",
  "verification_cases": "궁극2명·1명·예비1명·재소환·무료주문 환급0",
  "dependency_gate": "궁극 완료 이벤트, 출전snapshot",
  "status": "설계 완료 / 미구현 / 아트 미제작 / 밸런스 미검증",
  "values_status": "I/II/III 모두 검증 전 가안",
  "upgrade_values": [
    1,
    2,
    3
  ],
  "max_stage": 3,
  "upgrade_metric": "정의된 적격 상황에서 효과의 이익 지표(세부 단위는 효과문구 참조)",
  "upgrade_efficacy": "검증 전 가안: 추가 후보·대상·효과의 실제 실효는 적격/상한/반올림 확인 필요. 실효0인 상태에서는 제련 UI 비활성; III 강제하지 않음.",
  "capability_status": "DESIGN_ONLY_UNVERIFIED_IN_CURRENT_ENGINE",
  "eligible_pool": "DISABLED_UNTIL_REQUIRED_CAPABILITIES_AND_QA",
  "contract_evidence": "R2-review PI1 동결 소스 기반 검토 / 실제 지원·런타임 검증 별도",
  "policy_status": "NOT_ADOPTED",
  "no_retroactive": true,
  "action_id_scope": "runId + battleId(if any) + originalActionId + relicId + targetId(if any) + effectUseSequence; persisted in checkpoint",
  "upgrade_policy": "수치 상승만으로 PASS 아님. 각 단계 I→II→III에서 같은 적격 시드/편성/원장에서 실효가 단조개선되는 테스트. 이미 상한에 걸린 시전은 제련 불가/무효 표시, 수치 보정으로 상한 우회 금지.",
  "capability_group": "CONDITIONAL",
  "pool_eligibility_rule": "불변 기준: 신규47종은 런타임/기능 게이트 PASS+기존26회귀 PASS+승인된 풀 정책 충족 후에만 후보 포함; R2 작성만으로 후보에 편입 금지.",
  "ownership": "군단 전역 유물1개; 개별 병사는 효과 적용대상이지 유물 소유자가 아님.",
  "consumption_contract": "획득 전 사건 소급0. 소비한 효과는 제련/교환/재획득/전직/런 저장 복원으로 재충전0(별도 명시한 다회사용 제외).",
  "targeting_and_rollover": "대상 존재·합법성·정수·cap 판정 후 1회; 한도 초과/효과 미발동은 RNG 증가, 자원 보전, 미래 이월 없음.",
  "engine_supported": "아니오: R2에서는 신규47을 실제 엔진 구현/검증한 것으로 간주하지 않는다."
};

const sharedCostLimits = {
  combinedManaCostReductionCap: .20,
  minimumPositiveBaseCost: 1,
  zeroBaseCostRemainsZero: true,
  refundsUseActualPostDiscountPayment: true
};
const paidSkillAssumptions = {
  ordinaryPaidUniqueSkillsOnly: true,
  ultimatesObservedButExcluded: true,
  originallyFreeExcluded: true,
  combinedReductionCapIsTestOnly: true,
  discountOrderIsTestOnly: true,
  discountOrder: ['concord_medallion', 'cascade_cup', 'steady_pendulum'],
  zeroActualReductionConsumes: false,
  failedCommitCannotRepeatActualDiscount: true
};
const definition = (sourceDefinition, rarity, values, conditional, blocked = false) => ({
  id: sourceDefinition.id,
  name: sourceDefinition.name,
  intrinsicRarity: rarity,
  values,
  detail: sourceDefinition.effect ?? sourceDefinition.short_effect,
  sourceDefinition,
  conditional,
  definitionVersion: RB5_VERSION,
  maxEvolution: 3,
  maxOwned: 1,
  actionLocal: true,
  acquisitionEnabled: false,
  balanceApproved: false,
  capabilityRequired: RB5_CAPABILITY,
  mechanismImplemented: !blocked,
  effectEnabled: !blocked,
  locked: blocked,
  implementationStatus: blocked ? 'BLOCKED_SPEC' : 'TEST_ONLY_IMPLEMENTED_PENDING_REVIEW',
  reviewStatus: blocked ? 'BLOCKED_SPEC' : 'PENDING_REVIEW',
  lockedReason: blocked ? RB5_CASCADE_LOCK_REASON : null
});

export const RB5_REGISTRY = deepFreeze([
  definition(chargeSheathSource, 'uncommon', [4, 6, 8], {
    metric: 'temporary self flat relic DEF after eligible charge root resolution',
    eligibility: 'Actor of a completed valid charge root that actually dealt damage; apply once after the whole root resolves, not once per target or derived hit',
    limits: {durationTicks: 120, flatRelicDefenseCap: 40, totalDamageReductionCap: .55, maximumStacks: 1},
    consumption: {
      scope: 'per-unit-charge-root',
      settlement: 'after valid whole charge root damage resolution',
      repeatedRootConsumes: false,
      refreshOnly: true,
      refreshDoesNotStack: true,
      effectExpiresAtEndTick: true
    },
    testOnlyAssumptions: {
      originalTrainingDefensePreserved: true,
      combinesWithOriginalTrainingDefense: true,
      wholeChargeRootOnly: true,
      derivedDamageDoesNotTrigger: true
    },
    cost: null,
    noPersistentDefenseStatChange: true
  }),
  definition(steadyPendulumSource, 'rare', [2, 3, 4], {
    metric: 'actual flat mana cost reduction at the next eligible paid-skill commit',
    eligibility: 'Mana user continuously at full mana for at least 180 ticks before the next ordinary paid unique-skill commit, outside the per-unit 600-tick internal cooldown',
    limits: {...sharedCostLimits, continuousFullManaTicks: 180, cooldownTicks: 600, maximumStacks: 1},
    consumption: {
      scope: 'per-unit',
      settlement: 'first eligible commit with positive actual discount',
      zeroReductionConsumes: false,
      failedDiscountedCommitOwnsUse: true,
      laterFailedCommitRollover: false,
      fullManaContinuityResetsBelowMaximum: true,
      cooldownStartsAtActualDiscountCommit: true
    },
    testOnlyAssumptions: {...paidSkillAssumptions},
    cost: null,
    noPersistentManaStatChange: true
  }),
  definition(cascadeCupSource, 'rare', [...cascadeCupSource.upgrade_values], {
    metric: 'prospective flat mana discount only; effective discount is locked to zero',
    eligibility: 'PROSPECTIVE ONLY: one actor paid direct-damage skill root actually damages at least two distinct enemies; its next legal single-target ordinary paid skill would be eligible',
    limits: {...sharedCostLimits, distinctDirectDamageTargets: 2, cooldownTicks: 480, maximumStacks: 1},
    consumption: {
      scope: 'per-unit',
      settlement: 'BLOCKED_SPEC: no reservation, consumption or effective discount is authorized',
      sourceSettlement: '성공 시 소비',
      approvedFailedCommitRepeatedDiscountProhibited: true,
      zeroReductionConsumes: false,
      unusedChargeExpiresAtBattleEnd: true
    },
    testOnlyAssumptions: {
      ...paidSkillAssumptions,
      derivedTicksExcludedFromTargetCount: true,
      reflectedDamageExcludedFromTargetCount: true,
      duplicateTargetHitsCountOnce: true,
      prospectiveTriggerMetadataOnly: true,
      effectDisabledDespiteCapability: true
    },
    cost: null,
    noPersistentManaStatChange: true
  }, true),
  definition(concordMedallionSource, 'legendary', [...concordMedallionSource.upgrade_values], {
    metric: 'actual flat mana cost reduction for each eligible awakened actor first discounted paid-skill commit',
    eligibility: 'Battle-start deployed snapshot contains at least two distinct awakened soldier IDs; each of those awakened actors may discount its first ordinary paid unique-skill commit with positive actual reduction; reserves, free skills and ultimates excluded',
    limits: {...sharedCostLimits, minimumDistinctStartDeployedAwakened: 2, usesPerAwakenedUnitPerBattle: 1},
    consumption: {
      scope: 'per-start-deployed-awakened-unit-per-battle',
      settlement: 'first eligible commit with positive actual discount',
      zeroReductionConsumes: false,
      failedDiscountedCommitOwnsUse: true,
      laterFailedCommitRollover: false,
      snapshotAtBattleStart: true,
      duplicateSoldierIdsCountOnce: true,
      reservesDoNotCount: true,
      laterRosterChangesDoNotRevokeCommittedDiscount: true
    },
    testOnlyAssumptions: {...paidSkillAssumptions},
    cost: null,
    noPersistentManaStatChange: true
  })
]);

export const RB5_IDS = Object.freeze(RB5_REGISTRY.map(def => def.id));
export const RB5_IMPLEMENTED_IDS = Object.freeze(RB5_REGISTRY.filter(def => def.mechanismImplemented).map(def => def.id));
export const RB5_BLOCKED_IDS = Object.freeze(RB5_REGISTRY.filter(def => def.locked).map(def => def.id));
export const RB5_BY_ID = Object.freeze(Object.assign(
  Object.create(null), Object.fromEntries(RB5_REGISTRY.map(def => [def.id, def]))
));
export const isRB5 = id => typeof id === 'string' && Object.hasOwn(RB5_BY_ID, id);

// Direct quantity reads remain strict even for the locked definition, before returning 0.
export function value(relics, id) {
  assert(isRB5(id) && Array.isArray(relics), 'Known string RB5 ID and relic array required');
  const seen = new Set();
  const matches = Array.from(relics, relic => {
    assert(relic && typeof relic === 'object' && !Array.isArray(relic) &&
      Object.hasOwn(relic, 'id') && typeof relic.id === 'string', 'Own string relic ID required');
    assert(!seen.has(relic.id), 'Duplicate relic ID');
    seen.add(relic.id);
    return relic;
  }).filter(relic => relic.id === id);
  if (!matches.length) return 0;
  const relic = matches[0], def = RB5_BY_ID[id];
  for (const field of ['evolution', 'evolutionStage', 'stacks', 'rarity', 'intrinsicRarity', 'definitionVersion'])
    assert(!(field in relic) || Object.hasOwn(relic, field), 'Own relic fields required');
  assert(Object.hasOwn(relic, 'evolution') && Number.isInteger(relic.evolution) &&
    relic.evolution >= 1 && relic.evolution <= 3, 'Valid RB5 tier required');
  assert(relic.evolutionStage === undefined || relic.evolutionStage === relic.evolution, 'Conflicting evolution');
  assert(relic.stacks === undefined || relic.stacks === 1, 'Duplicate stacking');
  assert(relic.definitionVersion === undefined || (typeof relic.definitionVersion === 'string' &&
    relic.definitionVersion === RB5_VERSION), 'Foreign RB5 definition');
  assert((relic.rarity === undefined || relic.rarity === def.intrinsicRarity) &&
    (relic.intrinsicRarity === undefined || relic.intrinsicRarity === def.intrinsicRarity), 'Intrinsic rarity mismatch');
  return def.locked ? 0 : def.values[relic.evolution - 1];
}
