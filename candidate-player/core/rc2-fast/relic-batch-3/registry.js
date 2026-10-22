import {assert, deepFreeze} from '../relic-services/registry.js';

// Test-only action-local definitions. Neither ownership nor acquisition is enabled.
export const RB3_CAPABILITY = 'TEST_ONLY_RELIC_BATCH_RB3';
export const RB3_VERSION = 'relic-semantic-batch-rb3-1';
export const RB3_CHECKPOINT = 'relic-semantic-batch-rb3-checkpoint-1';

const definition = (id, name, rarity, values, detail, conditional) => ({
  id, name, intrinsicRarity: rarity, values, detail, conditional,
  definitionVersion: RB3_VERSION,
  maxEvolution: 3,
  maxOwned: 1,
  actionLocal: true,
  acquisitionEnabled: false,
  balanceApproved: false
});

export const RB3_REGISTRY = deepFreeze([
  definition('armor_file', '방어 깎개', 'uncommon', [2, 3, 4],
    '창·궁 계열 정상 평타의 적 기본 DEF 2/3/4 무시. 타격 한정, DEF 최저0, 병사당 4초 내부쿨. 강화탄·일제 제외, R55%와 기존 실드 순서 유지.', {
      metric: 'hit-local enemy base DEF ignored',
      eligibility: 'Deployed spear/archer normal basic attack against an enemy; enhanced shots and volleys excluded',
      limits: {defenseFloor: 0, totalDamageReductionCap: .55, cooldownTicks: 240},
      cost: null,
      noPersistentDefenseChange: true
    }),
  definition('unshielded_plate', '맨몸 흉갑', 'uncommon', [3, 4, 5],
    '보호막0인 병사의 첫 적격 피격 계산에만 DEF +3/4/5. D고정+40 및 R55% 상한. 병사당 전투1회, 후속 타격에 잔류하지 않음.', {
      metric: 'hit-local flat DEF',
      eligibility: 'First eligible incoming hit while the recipient has no shield; shield-only hits excluded',
      limits: {flatRelicDefenseCap: 40, totalDamageReductionCap: .55, usesPerUnitPerBattle: 1},
      cost: null,
      noPersistentDefenseChange: true
    }),
  definition('burdened_sight', '과적 조준기', 'rare', [.08, .12, .16],
    '출전 궁 계열 정상 평타의 치명 확률 −5%p(최저0), 비치명 분기만 B+8/12/16%p(B35%). 치명 판정 전에 비용 확정, 강화탄·일제 제외.', {
      metric: 'noncritical normal basic-attack bonus points',
      eligibility: 'Deployed archer normal basic attack, noncritical branch only; enhanced shots and volleys excluded',
      limits: {basicDamageBonusCap: .35, criticalChanceFloor: 0},
      cost: {criticalChancePoints: -.05, timing: 'Before the eligible normal attack critical roll'},
      noPersistentCriticalChanceChange: true
    })
]);

export const RB3_IDS = Object.freeze(RB3_REGISTRY.map(def => def.id));
export const RB3_BY_ID = Object.freeze(Object.assign(
  Object.create(null), Object.fromEntries(RB3_REGISTRY.map(def => [def.id, def]))
));
export const isRB3 = id => typeof id === 'string' && Object.hasOwn(RB3_BY_ID, id);

// The adapter calls this with normalized relics; reject corrupt direct callers too.
export function value(relics, id) {
  assert(isRB3(id) && Array.isArray(relics), 'Known string RB3 ID and relic array required');
  const matches = relics.filter(relic => relic?.id === id);
  assert(matches.length <= 1, 'Duplicate RB3 relic');
  if (!matches.length) return 0;
  const relic = matches[0], def = RB3_BY_ID[id];
  assert(Object.hasOwn(relic, 'id'), 'Own string relic ID required');
  assert(Number.isInteger(relic.evolution) && relic.evolution >= 1 && relic.evolution <= 3, 'Valid RB3 tier required');
  assert(relic.evolutionStage === undefined || relic.evolutionStage === relic.evolution, 'Conflicting evolution');
  assert(relic.stacks === undefined || relic.stacks === 1, 'Duplicate stacking');
  assert(relic.definitionVersion === undefined || relic.definitionVersion === RB3_VERSION, 'Foreign RB3 definition');
  assert((relic.rarity === undefined || relic.rarity === def.intrinsicRarity) &&
    (relic.intrinsicRarity === undefined || relic.intrinsicRarity === def.intrinsicRarity), 'Intrinsic rarity mismatch');
  return def.values[relic.evolution - 1];
}
