import {assert, deepFreeze} from '../relic-services/registry.js';

// Isolated TEST_ONLY paid-skill definitions. Acquisition and static gains stay OFF.
export const RB4_CAPABILITY = 'TEST_ONLY_RELIC_BATCH_RB4';
export const RB4_VERSION = 'relic-semantic-batch-rb4-1';
export const RB4_CHECKPOINT = 'relic-semantic-batch-rb4-checkpoint-1';

// Verbatim source records, including their original unadopted pool/status language.
// These records are provenance, not authorization to acquire, forge or grant effects.
const openingFlaskSource = {
  "no": 49,
  "id": "opening_flask",
  "name": "개전 마나병",
  "rarity": "고급",
  "effect": "마나 사용자 첫 유료 주문 확정 시 지불액의 10/15/20%를 resolve 성공 뒤 환급"
};

const hourMossSource = {
  "id": "hour_moss",
  "name": "시계 이끼",
  "rarity": "일반",
  "role": "기술·지휘",
  "short_effect": "30초 뒤 첫 기술 CD −0.2/0.3/0.4초(총 U15% 이내)",
  "precise_trigger_and_targets": "30초 tick1800 경과 후 군단 내 첫 성공한 유료 고유기술 1회에만 적용. baseCooldownSec가 확정된 그 기술의 기존 모든 U 단축분을 합산하고 남은 15% 총단축 예산 내에서 flat0.2/0.3/0.4초를 사용. 원래무료 지휘 제외.",
  "cap_and_overflow": "실제 단축 = min(단계초, max(0, 0.15×baseCD−alreadyReductionSec)); 최소 최종CD1초. flat도 U15%에 포함; 포화 시0.",
  "stacking_and_reuse": "전투/유물1회, 성공 스킬영수증 후 지급. 30초 전 실행은 사용횟수 미소비, 실제 단축0으로 발동 가능한 시전이면 소비하지 않음.",
  "acquisition_and_upgrades": "기본·연구 후보, I/II/III 제련",
  "inherited_after_promotion": "병사 ID·모든 전직 고유기술 태그",
  "synergy_and_abuse_risk": "긴 전투의 첫 수복; 초반 폭발 무효",
  "icon_motif": "이끼가 붙은 작은 시계",
  "implementation_difficulty": "중간",
  "verification_cases": "baseCD 10초·기존1.4초단축→남은.1초, I/II/III 모두 .1; 0단축이면 .2/.3/.4; U15%포화는0.",
  "dependency_gate": "기술 사용 완료 로그",
  "status": "설계 완료 / 미구현 / 아트 미제작 / 밸런스 미검증",
  "values_status": "I/II/III 모두 검증 전 가안",
  "upgrade_values": [
    0.2,
    0.3,
    0.4
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
  "capability_group": "ADAPTER_REQUIRED",
  "pool_eligibility_rule": "불변 기준: 신규47종은 런타임/기능 게이트 PASS+기존26회귀 PASS+승인된 풀 정책 충족 후에만 후보 포함; R2 작성만으로 후보에 편입 금지.",
  "ownership": "군단 전역 유물1개; 개별 병사는 효과 적용대상이지 유물 소유자가 아님.",
  "consumption_contract": "획득 전 사건 소급0. 소비한 효과는 제련/교환/재획득/전직/런 저장 복원으로 재충전0(별도 명시한 다회사용 제외).",
  "targeting_and_rollover": "대상 존재·합법성·정수·cap 판정 후 1회; 한도 초과/효과 미발동은 RNG 증가, 자원 보전, 미래 이월 없음.",
  "engine_supported": "아니오: R2에서는 신규47을 실제 엔진 구현/검증한 것으로 간주하지 않는다."
};

const definition = (sourceDefinition, rarity, values, conditional) => ({
  id: sourceDefinition.id,
  name: sourceDefinition.name,
  intrinsicRarity: rarity,
  values,
  detail: sourceDefinition.effect ?? sourceDefinition.short_effect,
  sourceDefinition,
  conditional,
  definitionVersion: RB4_VERSION,
  maxEvolution: 3,
  maxOwned: 1,
  actionLocal: true,
  acquisitionEnabled: false,
  balanceApproved: false
});

export const RB4_REGISTRY = deepFreeze([
  definition(openingFlaskSource, 'uncommon', [.10, .15, .20], {
    metric: 'fraction of actual paid mana refunded after successful resolution',
    eligibility: 'Each mana user first ordinary paid unique-skill commit; refund only after that same root succeeds while its actor is alive; free actions, commands and ultimates excluded',
    limits: {totalManaRefundCap: .50, usesPerUnitPerBattle: 1, respectMaximumMana: true},
    consumption: {
      scope: 'per-unit-per-battle',
      reservation: 'first ordinary paid unique-skill commit',
      settlement: 'successful same-root resolution while the actor is alive',
      failedOrDeadFirstCommitOwnsUse: true,
      laterCommitRollover: false
    },
    testOnlyAssumptions: {
      ordinaryPaidUniqueSkillsOnly: true,
      ultimatesObservedButExcluded: true,
      firstPaidCommitOwnsUseEvenOnFailureOrDeath: true,
      noLaterRollover: true
    },
    cost: null,
    noPersistentManaStatChange: true
  }),
  definition(hourMossSource, 'common', [...hourMossSource.upgrade_values], {
    metric: 'seconds of flat cooldown reduction for the successful eligible skill',
    eligibility: 'Army first successful ordinary paid unique skill committed at tick 1800 or later with positive remaining U cooldown budget; free actions, commands and ultimates excluded',
    limits: {
      unitSkillCooldownReductionCap: .15,
      minimumCooldownSec: 1,
      eligibleCommitTick: 1800,
      usesPerArmyPerBattle: 1
    },
    consumption: {
      scope: 'per-army-per-battle',
      reservation: 'ordinary paid unique-skill commit at tick 1800 or later',
      settlement: 'successful same-root resolution with positive actual cooldown reduction',
      zeroReductionConsumes: false,
      preThresholdCommitConsumes: false
    },
    testOnlyAssumptions: {
      ordinaryPaidUniqueSkillsOnly: true,
      ultimatesObservedButExcluded: true,
      thresholdUsesCommitTick: true,
      commit1799Resolve1801Excluded: true
    },
    cost: null,
    noPersistentCooldownStatChange: true
  })
]);

export const RB4_IDS = Object.freeze(RB4_REGISTRY.map(def => def.id));
export const RB4_BY_ID = Object.freeze(Object.assign(
  Object.create(null), Object.fromEntries(RB4_REGISTRY.map(def => [def.id, def]))
));
export const isRB4 = id => typeof id === 'string' && Object.hasOwn(RB4_BY_ID, id);

// The adapter supplies normalized relics; still reject corrupt direct-call shapes.
export function value(relics, id) {
  assert(isRB4(id) && Array.isArray(relics), 'Known string RB4 ID and relic array required');
  const matches = Array.from(relics, relic => {
    assert(relic && typeof relic === 'object' && !Array.isArray(relic) &&
      Object.hasOwn(relic, 'id') && typeof relic.id === 'string', 'Own string relic ID required');
    return relic;
  }).filter(relic => relic.id === id);
  assert(matches.length <= 1, 'Duplicate RB4 relic');
  if (!matches.length) return 0;
  const relic = matches[0], def = RB4_BY_ID[id];
  assert(Number.isInteger(relic.evolution) && relic.evolution >= 1 && relic.evolution <= 3, 'Valid RB4 tier required');
  assert(relic.evolutionStage === undefined || relic.evolutionStage === relic.evolution, 'Conflicting evolution');
  assert(relic.stacks === undefined || relic.stacks === 1, 'Duplicate stacking');
  assert(relic.definitionVersion === undefined || relic.definitionVersion === RB4_VERSION, 'Foreign RB4 definition');
  assert((relic.rarity === undefined || relic.rarity === def.intrinsicRarity) &&
    (relic.intrinsicRarity === undefined || relic.intrinsicRarity === def.intrinsicRarity), 'Intrinsic rarity mismatch');
  return def.values[relic.evolution - 1];
}
