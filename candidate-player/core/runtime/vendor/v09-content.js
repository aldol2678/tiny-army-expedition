/* Tiny Army v0.9: immutable definitions and deterministic, side-effect-free projections.
 * The v05/v08 content object is never modified. The pilot values below are deliberately
 * versioned; evolution replaces an item's stage and never multiplies its rarity. */
(() => {
  'use strict';
  const OLD = globalThis.TinyArmyContent;
  if (!OLD) throw new Error('Load content.js before v09-content.js.');
  const VERSION = '0.9.0', RULES_VERSION = 'v09-campaign-1', COMBAT_VERSION = 'v09-combat-1', MAP_VERSION = 'v09-operations-1';
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const pct = value => `${Math.round(value * 10000) / 100}%`;
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const CAPS = freeze({ armySize: 20, owned: 20, deployment: 12, deployed: 12, skillSlots: 2, relicSlots: null, maxRelicStacks: 1, relicEvolution: 3, damageReduction: .55, hpBonus: .50, attackPowerBonus: .50, abilityPowerBonus: .50, relicDefense: 40, basicDamageBonus: .35, supportHealBonus: .35, shieldBonus: .35, mageSkillDamageBonus: .35, movementSpeedBonus: .25, manaRegenBonus: .50, attackSpeed: .50, unitSkillCdr: .15, commanderSkillCdr: .20, skillCdr: .20, critChance: .50, critDamage: 2.5, guardianDefense: 20, echoRefund: .50 });
  const CONDITION = freeze({ ...clone(OLD.CONDITION), reserveRecovery: 6 });
  const ECONOMY = freeze({ ...clone(OLD.ECONOMY), relicSlots: null, maxRelicStacks: 1, duplicateBonus: 0, rerolls: 1, rewardRerollCost: 5, forge: { 1: 20, 2: 30 }, forgePrices: [20, 30], maxForgeTransactions: 1 });
  const conditionEfficiency = condition => .70 + .003 * clamp(finite(condition, 100), 0, 100);
  const RARITIES = OLD.RARITIES, RARITY_BY_ID = OLD.RARITY_BY_ID;
  const SKILLS = freeze({ ...clone(OLD.SKILLS), guard: { ...clone(OLD.SKILLS.guard), description: '4초간 생존 아군의 방어 적용 후 피해를 20% 줄입니다. 최종 피해 감소 상한 55%.' } });
  const CHAPTERS = OLD.CHAPTERS, EVENTS = OLD.EVENTS, EVENT_FLAVOR = OLD.EVENT_FLAVOR, REST_OPTIONS = OLD.REST_OPTIONS;
  const NODE_TYPES = freeze({ ...clone(OLD.NODE_TYPES), elite: { ...clone(OLD.NODE_TYPES.elite), description: '더 큰 컨디션 소모를 감수하고 추가 골드를 얻습니다. 유물 후보는 현재 출전 편성과 해금에 따라 정해집니다.' }, forge: { id: 'forge', name: '대장간', description: '보유 유물 하나를 제련합니다. 고유 희귀도는 유지되며 진화 단계만 오릅니다.', icon: '⚒', combat: false } });
  const ALLY_TYPES = freeze(['spear', 'guardian', 'charger', 'archer', 'sniper', 'volley', 'mage', 'pyromancer', 'frostmage', 'support', 'medic', 'warder']);
  const familyOf = type => ({ spear: 'spear', guardian: 'spear', charger: 'spear', archer: 'archer', sniper: 'archer', volley: 'archer', mage: 'mage', pyromancer: 'mage', frostmage: 'mage', support: 'support', medic: 'support', warder: 'support' })[typeof type === 'object' ? type.type : type] || null;
  const isDeployed = unit => !!unit && Number.isInteger(unit.slot) && unit.slot >= 0 && unit.slot < 12;
  const deploymentCap = xp => xp >= 13 ? 9 : xp >= 9 ? 8 : xp >= 4 ? 7 : 6;
  const DEPLOYMENT_LEVELS = freeze([{ xp: 0, cap: 6 }, { xp: 4, cap: 7 }, { xp: 9, cap: 8 }, { xp: 13, cap: 9 }]);
  const definition = (id, name, hp, attackPower, abilityPower, defense, rate, range, speed, extra = {}) => ({ id, name, family: familyOf(id), role: familyOf(id), hp, maxHp: hp, attackPower, damage: attackPower, abilityPower, spellPower: abilityPower, defense, rate, attackInterval: rate, range, attackRange: range, speed, heal: 0, healRange: 0, healInterval: 0, maxMana: 0, startingMana: 0, manaRegen: 0, usesMana: false, color: '#788888', ...extra });
  const spell = (id, name, coefficient, manaCost, cooldown, extra = {}) => ({ id, name, actionType: 'unit_skill', effectKind: 'damage', damageType: 'magic', attackCoefficient: 0, coefficient, manaCost, cooldown, initialDelay: 0, targets: 1, canCrit: false, usesMana: true, ...extra });
  const mageBase = { maxMana: 40, startingMana: 40, manaRegen: 3, usesMana: true, color: '#8276b3' };
  const TYPES = freeze({
    spear: definition('spear', '창병', 190, 12, 0, 15, 2.1, 47, 40, { color: '#327b75' }),
    guardian: definition('guardian', '방벽병', 300, 10, 20, 40, 2.8, 53, 29, { color: '#317981', skill: { id: 'guardian_link', name: '방벽 연결', actionType: 'passive_protection', effectKind: 'protection', attackCoefficient: 0, coefficient: .60, cap: 20, adjacency: 'orthogonal', excludeGuardians: true } }),
    charger: definition('charger', '돌격병', 165, 25, 25, 20, 2.1, 55, 48, { color: '#ce824f', skill: { id: 'charge', name: '돌격', actionType: 'unit_skill', effectKind: 'damage', damageType: 'physical', attackCoefficient: 1, coefficient: .60, cooldown: 9, initialDelay: 2, windup: .45, range: 150, radius: 112, targets: null, canCrit: false, defenseAfter: 0, defenseDuration: 2 } }),
    archer: definition('archer', '궁수', 100, 16, 0, 5, 2.7, 220, 35, { color: '#7b8652', firstAttackMultiplier: 1 }),
    sniper: definition('sniper', '저격수', 80, 48, 24, 5, 4, 340, 30, { color: '#5d7775', skill: { id: 'precision_shot', name: '강화탄', actionType: 'basic_attack', effectKind: 'damage', damageType: 'physical', attackCoefficient: 1, coefficient: 1.80, every: 3, enhancedBasic: true, canCrit: false } }),
    volley: definition('volley', '연사수', 90, 14, 0, 8, 2.5, 255, 36, { color: '#8b8351', maxTargets: 3, primaryMultiplier: 1, secondaryMultiplier: 1 }),
    mage: definition('mage', '마법사', 100, 5, 20, 0, 3, 220, 34, { ...mageBase, skill: spell('arcane_bolt', '비전 화살', 1.50, 20, 6) }),
    pyromancer: definition('pyromancer', '폭염술사', 85, 3, 22, 0, 3.4, 230, 32, { ...mageBase, color: '#c66d43', skill: spell('flame_burst', '폭염탄', 1.65, 28, 8, { secondaryCoefficient: .85, targets: 3, radius: 65 }) }),
    frostmage: definition('frostmage', '서리술사', 110, 4, 18, 5, 3.2, 235, 33, { ...mageBase, color: '#6aa5c1', skill: spell('frost_bolt', '서리 화살', 1.40, 22, 7, { slow: .25, bossSlow: .125, slowDuration: 2.5 }) }),
    support: definition('support', '지원병', 115, 4, 15, 8, 3, 170, 34, { color: '#d2b067', heal: 15, healRange: 220, healInterval: 2.8, healCoefficient: 1, healInitialDelay: 2 }),
    medic: definition('medic', '군의관', 90, 2, 23, 5, 3.2, 170, 32, { color: '#d6c6ab', heal: 23, healRange: 245, healInterval: 3.2, healCoefficient: 1, healInitialDelay: 2, emergencyThreshold: .35, emergencyMultiplier: 1.25 }),
    warder: definition('warder', '수호사', 135, 3, 18, 15, 3.2, 170, 32, { color: '#7fa999', heal: 9, healRange: 205, healInterval: 3.2, healCoefficient: .50, healInitialDelay: 2, shield: { id: 'ward_shield', name: '보호막', actionType: 'shield', effectKind: 'shield', coefficient: 1, cooldown: 8, initialDelay: 2, duration: 4, targets: 2, range: 205 } })
  });
  const track = (id, name, description, one, two) => ({ id, name, description, levels: [one, two] });
  const TRAINING = freeze({ max: 2, tracks: {
    spear: { specialty: track('specialty', '밀집 방어', '방어력 +5 / +10.', { defenseFlat: 5 }, { defenseFlat: 10 }), handling: track('handling', '전열 간격', '평타 사거리 +6 / +12.', { range: 53 }, { range: 59 }) },
    guardian: { specialty: track('specialty', '방벽 숙련', '자신의 방어력 +5 / +10.', { defenseFlat: 5 }, { defenseFlat: 10 }), handling: track('handling', '연결 숙련', '상하좌우 연결 DEF의 AP 계수 0.70 / 0.80. 상한 20, 범위 불변.', { skill: { coefficient: .70 } }, { skill: { coefficient: .80 } }) },
    charger: { specialty: track('specialty', '돌격 집중', '돌격의 AP 계수 0.75 / 0.90.', { skill: { coefficient: .75 } }, { skill: { coefficient: .90 } }), handling: track('handling', '복귀 엄호', '돌격 해결 후 자신의 DEF +10 / +20, 2초.', { skill: { defenseAfter: 10 } }, { skill: { defenseAfter: 20 } }) },
    archer: { specialty: track('specialty', '첫 화살', '첫 유효 기본공격 1.25 / 1.50배. 전투당 한 번.', { firstAttackMultiplier: 1.25 }, { firstAttackMultiplier: 1.50 }), handling: track('handling', '사거리 훈련', '평타 사거리 235 / 250.', { range: 235 }, { range: 250 }) },
    sniper: { specialty: track('specialty', '결정타', '매 세 번째 강화탄의 AP 계수 2.10 / 2.40. 치명타 제외.', { skill: { coefficient: 2.10 } }, { skill: { coefficient: 2.40 } }), handling: track('handling', '장거리 조준', '평타 사거리 360 / 380.', { range: 360 }, { range: 380 }) },
    volley: { specialty: track('specialty', '주 표적 명중', '주 대상 기본공격 1.15 / 1.30배.', { primaryMultiplier: 1.15 }, { primaryMultiplier: 1.30 }), handling: track('handling', '확산 사격', '최대 4명. 보조 대상 피해 80% / 100%; 부족한 대상 수는 재분배하지 않습니다.', { maxTargets: 4, secondaryMultiplier: .80 }, { maxTargets: 4, secondaryMultiplier: 1 }) },
    mage: { specialty: track('specialty', '마력 압축', '비전 화살 AP 계수 1.65 / 1.80.', { skill: { coefficient: 1.65 } }, { skill: { coefficient: 1.80 } }), handling: track('handling', '마나 절약', '주문 비용 19 / 18. 재사용 6초 유지.', { skill: { manaCost: 19 } }, { skill: { manaCost: 18 } }) },
    pyromancer: { specialty: track('specialty', '중심 폭발', '주 대상 AP 계수 1.80 / 1.95. 보조 계수 0.85 유지.', { skill: { coefficient: 1.80 } }, { skill: { coefficient: 1.95 } }), handling: track('handling', '연소 효율', '주문 비용 26 / 24. 재사용 8초 유지.', { skill: { manaCost: 26 } }, { skill: { manaCost: 24 } }) },
    frostmage: { specialty: track('specialty', '서리 유지', '둔화 지속 2.75 / 3초. 둔화 25%, 보스 절반.', { skill: { slowDuration: 2.75 } }, { skill: { slowDuration: 3 } }), handling: track('handling', '냉기 순환', '주문 비용 21 / 20. 재사용 7초 유지.', { skill: { manaCost: 21 } }, { skill: { manaCost: 20 } }) },
    support: { specialty: track('specialty', '응급 처치', '정상 치유 AP 계수 1.20 / 1.40.', { healCoefficient: 1.20 }, { healCoefficient: 1.40 }), handling: track('handling', '치료 동선', '치료 사거리 240 / 260.', { healRange: 240 }, { healRange: 260 }) },
    medic: { specialty: track('specialty', '위급 환자 치료', 'HP 35% 미만 대상 치유 1.40 / 1.55배.', { emergencyMultiplier: 1.40 }, { emergencyMultiplier: 1.55 }), handling: track('handling', '후방 치료', '치료 사거리 265 / 285.', { healRange: 265 }, { healRange: 285 }) },
    warder: { specialty: track('specialty', '보호막 숙련', '보호막 AP 계수 1.25 / 1.50.', { shield: { coefficient: 1.25 } }, { shield: { coefficient: 1.50 } }), handling: track('handling', '지속 수호', '보호막 지속 4.5 / 5초. 양과 재사용 불변.', { shield: { duration: 4.5 } }, { shield: { duration: 5 } }) }
  } });
  const SYNERGIES = freeze({
    spear: { id: 'spear', name: '밀집 전열', field: 'defense', operation: 'flat_gain', values: [3, 6], description: '출전 창 계열 2/4명: 같은 계열 DEF +3/+6.' },
    archer: { id: 'archer', name: '교차 사격', field: 'basicDamageBonus', operation: 'percent_gain', values: [.04, .08], description: '출전 궁 계열 2/4명: 같은 계열 기본공격 +4%/+8%.' },
    mage: { id: 'mage', name: '마력 순환', field: 'manaRegenBonus', operation: 'percent_gain', values: [.05, .10], description: '출전 마법 계열 2/4명: 같은 계열 마나 회복 +5%/+10%.' },
    support: { id: 'support', name: '공동 진료', field: 'supportHealBonus', operation: 'percent_gain', values: [.04, .08], description: '출전 지원 계열 2/4명: 같은 계열 정상 치유 +4%/+8%. 보호막 제외.' }
  });
  function synergyPreview(roster = []) {
    const seen = new Set(), units = roster.filter(unit => { if (!isDeployed(unit) || !familyOf(unit.type) || seen.has(unit.id)) return false; seen.add(unit.id); return true; });
    const counts = {}, bonuses = {}, families = Object.values(SYNERGIES).map(def => {
      const members = units.filter(unit => familyOf(unit.type) === def.id), count = members.length, tier = count >= 4 ? 2 : count >= 2 ? 1 : 0;
      counts[def.id] = count; bonuses[def.id] = tier ? { [def.field]: def.values[tier - 1] } : {};
      return { ...clone(def), count, tier, active: tier > 0, nextThreshold: tier === 2 ? null : tier === 1 ? 4 : 2, value: tier ? def.values[tier - 1] : 0, unitIds: members.map(unit => unit.id) };
    });
    return { counts, bonuses, families, active: families.filter(item => item.active), deployed: units.length, reserves: roster.filter(unit => !isDeployed(unit)).length };
  }
  const modifier = (field, operation, values, scope = 'ally', extra = {}) => ({ affectedField: field, operation, values, scope, ...extra });
  const item = (id, name, rarity, family, effects, extra = {}) => ({ id, name, rarity, intrinsicRarity: rarity, definitionVersion: 'v09-relics-1', family, iconId: `relic-${id.replaceAll('_', '-')}`, baseUnlocked: true, perItemCap: 1, maxEvolution: 3, effects, evolution: [1, 2, 3], ...extra });
  const RELICS = freeze({
    banner: item('banner', '행군의 깃발', 'common', 'army', [modifier('maxHp', 'percent_gain', [.08, .10, .12])]),
    seal: item('seal', '철벽의 인장', 'uncommon', 'spear', [modifier('defense', 'flat_gain', [8, 10, 12], 'spear')]),
    spear_tip: item('spear_tip', '날 선 창끝', 'common', 'spear', [modifier('basicDamageBonus', 'percent_gain', [.12, .15, .18], 'spear')]),
    medic: item('medic', '야전 구급낭', 'common', 'support', [modifier('supportHealBonus', 'percent_gain', [.16, .20, .24], 'support')]),
    whistle: item('whistle', '역습의 호루라기', 'epic', 'army', [modifier('whistleHaste', 'percent_gain', [.15, .15, .15], 'army'), modifier('whistleDuration', 'flat_gain', [6, 7, 8], 'army')], { baseUnlocked: false, unlockId: 'whistle', triggerId: 'first_ally_knockout', perBattleLimit: 1 }),
    drum: item('drum', '결전의 북', 'uncommon', 'army', [modifier('rallyDurationBonus', 'flat_gain', [1, 1.4, 1.8], 'command')], { baseUnlocked: false, unlockId: 'drum', requiredSkill: 'rally' }),
    keen_eye: item('keen_eye', '예리한 눈', 'rare', 'army', [modifier('critChance', 'flat_gain', [.08, .10, .12]), modifier('critDamageBonus', 'flat_gain', [.15, .15, .15])]),
    arcane_lens: item('arcane_lens', '비전 렌즈', 'rare', 'mage', [modifier('abilityPower', 'percent_gain', [.15, .19, .23], 'mage')]),
    vanguard_plate: item('vanguard_plate', '전열 철판', 'common', 'army', [modifier('defense', 'flat_gain', [10, 13, 16], 'front')], { row: 'front' }),
    vanguard_banner: item('vanguard_banner', '전열 군기', 'uncommon', 'army', [modifier('maxHp', 'percent_gain', [.12, .15, .18], 'front')], { row: 'front' }),
    mid_resonance: item('mid_resonance', '중열 공명석', 'rare', 'ap_user', [modifier('abilityPower', 'percent_gain', [.16, .20, .24], 'mid_ap')], { row: 'mid' }),
    rear_gambit: item('rear_gambit', '후열 결사의 문장', 'epic', 'army', [modifier('attackPower', 'percent_gain', [.14, .18, .22], 'rear'), modifier('abilityPower', 'percent_gain', [.14, .18, .22], 'rear'), modifier('maxHp', 'multiply_cost', [.88, .88, .88], 'rear')], { row: 'rear', experimental: true }),
    heavy_blade: item('heavy_blade', '묵직한 칼날', 'uncommon', 'weapon', [modifier('attackPower', 'percent_gain', [.22, .28, .34], 'weapon'), modifier('attackFrequencyCostFactor', 'multiply_cost', [.90, .90, .90], 'weapon')]),
    overcharge_core: item('overcharge_core', '과충전 핵', 'rare', 'mage', [modifier('abilityPower', 'percent_gain', [.28, .34, .40], 'mage'), modifier('manaRegen', 'multiply_cost', [.80, .80, .80], 'mage')]),
    triage_codex: item('triage_codex', '집중 치료서', 'epic', 'support', [modifier('abilityPower', 'percent_gain', [.24, .30, .36], 'support'), modifier('supportPeriodCostFactor', 'multiply_cost', [1.20, 1.20, 1.20], 'support')]),
    echo_crystal: item('echo_crystal', '잔향 수정', 'rare', 'mage', [modifier('echoRefund', 'percent_gain', [.20, .25, .30], 'mage')], { baseUnlocked: false, unlockId: 'echo_crystal', triggerId: 'third_paid_spell', perUnit: true, every: 3 }),
    emergency_case: item('emergency_case', '응급 붕대함', 'rare', 'support', [modifier('emergencyHeal', 'flat_gain', [12, 15, 18], 'support')], { baseUnlocked: false, unlockId: 'emergency_case', triggerId: 'critical_successful_normal_heal', threshold: .20, perBattleLimit: 1 }),
    quick_hourglass: item('quick_hourglass', '급행 모래시계', 'legendary', 'army', [modifier('commanderSkillCdr', 'percent_gain', [.10, .12, .14], 'timed_command'), modifier('commanderDurationCostFactor', 'multiply_cost', [.80, .80, .80], 'timed_command')], { requiredTimedCommand: true, unique: true })
  });
  const RELIC_LIST = freeze(Object.values(RELICS)), STARTER_RELIC_IDS = freeze(['banner', 'spear_tip', 'medic']);
  const UNLOCKS = freeze([
    ...[['whistle', 3], ['drum', 5], ['echo_crystal', 5], ['emergency_case', 5]].map(([id, cost]) => ({ id, type: 'relic', kind: 'relic', relic: id, name: RELICS[id].name, cost, description: '다음 원정부터 유물 보상·상점 후보에 추가됩니다. 유물 실물은 별도 획득합니다.' })),
    ...[['frostmage', '서리술사'], ['warder', '수호사']].map(([id, name]) => ({ id, type: 'branch', kind: 'branch', branch: id, name: `${name} 진화`, cost: 12, description: '다음 원정부터 해당 진화 갈래를 선택할 수 있습니다. 병사나 훈련을 즉시 지급하지 않습니다.' })),
    ...[['mage', '마법'], ['support', '지원']].map(([family, name]) => ({ id: `${family}_handling`, type: 'training', kind: 'training', family, training: `${family}_handling`, name: `${name} 계열 운용 교본`, cost: 8, description: '다음 원정부터 계열 전체의 운용 교과를 선택할 수 있습니다. 진화 후에도 같은 교과를 유지합니다.' })),
    { id: 'arcane_guard', type: 'tactic', kind: 'tactic', tactic: 'arcane_guard', name: '비전 호위대', cost: 8, roster: ['spear', 'mage', 'support'], description: '다음 원정을 창병·마법사·지원병 3명으로 시작할 수 있습니다. 궁수를 마법사로 교체합니다.' },
    { id: 'swift_expedition', type: 'tactic', kind: 'tactic', tactic: 'swift_expedition', name: '속전 원정대', cost: 8, roster: ['spear', 'archer', 'mage'], description: '다음 원정을 창병·궁수·마법사 3명으로 시작할 수 있습니다. 지원병의 반복 치유를 포기합니다.' }
  ]);
  const EVOLUTIONS = freeze({ spear: ['guardian', 'charger'], archer: ['sniper', 'volley'], mage: ['pyromancer', 'frostmage'], support: ['medic', 'warder'] });
  function hasUnlock(context, category, id) {
    const source = context.entitlements || context.unlocks || {};
    const entries = category === 'relics' && context.unlockedRelics ? context.unlockedRelics : Array.isArray(source) ? source : source[category];
    return Array.isArray(entries) && entries.includes(id);
  }
  function trainingOptions(unit, context = {}) {
    if (!TYPES[unit?.type] || !Number.isInteger(unit.training ?? 0) || (unit.training ?? 0) >= 2) return [];
    const family = familyOf(unit.type);
    return Object.values(TRAINING.tracks[unit.type]).filter(entry => (unit.training ? entry.id === unit.trainingTrack : entry.id === 'specialty' || !['mage', 'support'].includes(family) || hasUnlock(context, 'training', `${family}_handling`))).map(entry => ({ ...clone(entry), rank: (unit.training || 0) + 1, trainingTrack: entry.id, effect: clone(entry.levels[unit.training || 0]) }));
  }
  function normalizeRelic(relic) {
    if (!relic || !RELICS[relic.id]) throw new RangeError('Unknown v09 relic.');
    const def = RELICS[relic.id], evolution = relic.evolution ?? relic.evolutionStage ?? 1;
    if (relic.rarity !== undefined && relic.rarity !== def.intrinsicRarity) throw new RangeError('Relic intrinsic rarity cannot change.');
    if (relic.intrinsicRarity !== undefined && relic.intrinsicRarity !== def.intrinsicRarity) throw new RangeError('Relic intrinsic rarity cannot change.');
    if (relic.definitionVersion !== undefined && relic.definitionVersion !== def.definitionVersion) throw new RangeError('Unknown relic definition version.');
    if (relic.stacks !== undefined && relic.stacks !== 1) throw new RangeError('V09 relic duplicates do not stack.');
    if (!Number.isInteger(evolution) || evolution < 1 || evolution > 3 || (relic.evolution !== undefined && relic.evolutionStage !== undefined && relic.evolution !== relic.evolutionStage)) throw new RangeError('Invalid relic evolution.');
    return { id: relic.id, rarity: def.intrinsicRarity, stacks: 1, evolution };
  }
  function normalizeRelics(relics = []) {
    if (!Array.isArray(relics)) throw new TypeError('Relics must be an array.');
    const ids = new Set();
    return relics.map(entry => { const relic = normalizeRelic(entry); if (ids.has(relic.id)) throw new RangeError('Duplicate relic ID.'); ids.add(relic.id); return relic; });
  }
  function scopeMatches(scope, unit) {
    if (!isDeployed(unit)) return false;
    const family = familyOf(unit.type), depth = Math.floor(unit.slot / 4);
    return scope === 'ally' || scope === 'army' || scope === family || (scope === 'weapon' && ['spear', 'archer'].includes(family)) || (scope === 'front' && depth === 0) || (scope === 'rear' && depth === 2) || (scope === 'mid_ap' && depth === 1 && TYPES[unit.type].abilityPower > 0);
  }
  const FIELD_CAPS = freeze({ maxHp: .50, attackPower: .50, abilityPower: .50, defense: .50, basicDamageBonus: .35, supportHealBonus: .35, shieldBonus: .35, mageSkillDamageBonus: .35, movementSpeedBonus: .25, manaRegenBonus: .50, attackSpeedBonus: .50, unitSkillCdr: .15, commanderSkillCdr: .20, critChance: .50, critDamageBonus: 1, echoRefund: .50 });
  function collectModifiers(unit, options = {}) {
    const ledger = [], relics = normalizeRelics(options.relics || []), rank = unit.training || 0;
    if (rank) {
      const effect = TRAINING.tracks[unit.type][unit.trainingTrack].levels[rank - 1];
      if (effect.defenseFlat) ledger.push({ sourceId: `training:${unit.type}:${unit.trainingTrack}`, effectId: 'defense', affectedField: 'defense', operation: 'flat_gain', value: effect.defenseFlat, scope: 'self', category: 'training', applied: true, positiveCapKey: null });
    }
    for (const relic of relics) RELICS[relic.id].effects.forEach((effect, index) => ledger.push({ sourceId: `relic:${relic.id}`, effectId: `${relic.id}:${index}`, affectedField: effect.affectedField, operation: effect.operation, value: effect.values[relic.evolution - 1], scope: effect.scope, category: 'relic', positiveCapKey: effect.affectedField === 'defense' && effect.operation === 'flat_gain' ? 'relicDefense' : effect.operation === 'percent_gain' ? effect.affectedField : null, applied: scopeMatches(effect.scope, unit), reason: scopeMatches(effect.scope, unit) ? '' : isDeployed(unit) ? '대상 계열·시작 열 또는 행동 조건이 다릅니다.' : '예비 병사는 전투 효과를 받지 않습니다.' }));
    const synergies = options.synergySnapshot || synergyPreview(options.roster || [unit]);
    const synergy = synergies.families.find(entry => entry.id === familyOf(unit.type));
    if (isDeployed(unit) && synergy?.tier) ledger.push({ sourceId: `synergy:${synergy.id}`, effectId: 'composition', affectedField: synergy.field, operation: synergy.operation, value: synergy.value, scope: synergy.id, category: 'synergy', applied: true, positiveCapKey: synergy.field });
    for (const entry of options.modifiers || []) {
      if (!entry || !['flat_gain', 'percent_gain', 'multiply_cost'].includes(entry.operation) || !Number.isFinite(entry.value) || entry.value < 0 || (entry.operation === 'multiply_cost' && entry.value <= 0)) throw new RangeError('Invalid explicit modifier.');
      ledger.push({ category: 'temporary', applied: true, scope: 'self', ...clone(entry) });
    }
    const seen = new Set();
    return ledger.filter(entry => { const key = `${entry.sourceId}:${entry.effectId}`; if (seen.has(key)) return false; seen.add(key); return true; });
  }
  function applyStatModifiers(base, field, ledger, options = {}) {
    const entries = ledger.filter(entry => entry.applied && entry.affectedField === field);
    const relicFlat = entries.filter(entry => entry.operation === 'flat_gain' && entry.category === 'relic').reduce((sum, entry) => sum + entry.value, 0);
    const otherFlat = entries.filter(entry => entry.operation === 'flat_gain' && entry.category !== 'relic').reduce((sum, entry) => sum + entry.value, 0);
    const flat = Math.min(field === 'defense' ? CAPS.relicDefense : Infinity, relicFlat) + otherFlat + finite(options.extraFlat);
    const positive = entries.filter(entry => entry.operation === 'percent_gain').reduce((sum, entry) => sum + entry.value, 0);
    const cap = options.cap ?? FIELD_CAPS[field] ?? Infinity, appliedPositive = Math.min(cap, positive);
    const costFactor = entries.filter(entry => entry.operation === 'multiply_cost').reduce((product, entry) => product * entry.value, 1);
    return { value: Math.max(0, (base + flat) * (1 + appliedPositive) * costFactor), flat, rawPositive: positive, positive: appliedPositive, capped: positive - appliedPositive, costFactor, relicFlatCapped: Math.max(0, relicFlat - (field === 'defense' ? CAPS.relicDefense : Infinity)) };
  }
  function bonus(field, ledger) {
    const entries = ledger.filter(entry => entry.applied && entry.affectedField === field), raw = entries.filter(entry => entry.operation !== 'multiply_cost').reduce((sum, entry) => sum + entry.value, 0);
    return Math.min(FIELD_CAPS[field] ?? Infinity, raw);
  }
  const factor = (field, ledger) => ledger.filter(entry => entry.applied && entry.affectedField === field && entry.operation === 'multiply_cost').reduce((product, entry) => product * entry.value, 1);
  function getRelicEffects(relics = [], skills = []) {
    const result = { whistleHaste: 0, whistleDuration: 0, rallyDurationBonus: 0, rallyCooldownPenalty: 0, commanderSkillCdr: 0, commanderDurationCostFactor: 1, echoRefund: 0, emergencyHeal: 0, skillCdr: 0, commandSkills: {} };
    for (const relic of normalizeRelics(relics)) {
      const def = RELICS[relic.id];
      if (def.requiredSkill && !skills.includes(def.requiredSkill)) continue;
      for (const entry of def.effects) if (Object.hasOwn(result, entry.affectedField) && entry.affectedField !== 'commandSkills') {
        const value = entry.values[relic.evolution - 1];
        if (entry.operation === 'multiply_cost') result[entry.affectedField] *= value; else result[entry.affectedField] += value;
      }
    }
    result.commanderSkillCdr = Math.min(CAPS.commanderSkillCdr, result.commanderSkillCdr);
    result.echoRefund = Math.min(CAPS.echoRefund, result.echoRefund);
    for (const [id, skill] of Object.entries(SKILLS)) {
      const timed = ['guard', 'focus', 'rally'].includes(id);
      result.commandSkills[id] = { ...clone(skill), cooldown: skill.cooldown * (1 - (timed ? result.commanderSkillCdr : 0)), duration: (skill.duration + (id === 'rally' ? result.rallyDurationBonus : 0)) * (timed ? result.commanderDurationCostFactor : 1) };
    }
    return result;
  }
  function validateUnit(unit) {
    if (!unit || !TYPES[unit.type]) throw new RangeError('Unknown v09 unit type.');
    const rank = unit.training ?? 0, selected = unit.trainingTrack ?? null;
    if (!Number.isInteger(rank) || rank < 0 || rank > 2 || (rank === 0 ? selected !== null : !['specialty', 'handling'].includes(selected))) throw new RangeError('Invalid v09 training rank or track.');
    if (unit.condition !== undefined && (!Number.isFinite(unit.condition) || unit.condition < 0 || unit.condition > 100)) throw new RangeError('Invalid condition.');
    if (unit.slot !== undefined && unit.slot !== null && !isDeployed(unit)) throw new RangeError('Invalid deployment slot.');
  }
  function adjacent(a, b) { return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < 12 && b < 12 && Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) + Math.abs(a % 4 - b % 4) === 1; }
  function guardianLinks(roster = [], options = {}) {
    const alive = options.aliveIds === undefined ? null : new Set(options.aliveIds), deployed = roster.filter(isDeployed), links = {};
    const sources = deployed.filter(unit => unit.type === 'guardian' && (!alive || alive.has(unit.id))).map(unit => ({ unit, projection: projectUnit(unit, { ...options, roster, formation: false }) }));
    for (const unit of deployed) {
      const candidates = unit.type === 'guardian' ? [] : sources.filter(source => source.unit.id !== unit.id && adjacent(source.unit.slot, unit.slot)).map(source => ({ sourceId: source.unit.id, value: source.projection.guardianDefense })).sort((a, b) => b.value - a.value || a.sourceId - b.sourceId);
      links[unit.id] = { sourceId: candidates[0]?.sourceId ?? null, value: candidates[0]?.value ?? 0, candidates };
    }
    return links;
  }
  function projectDefense(unit, projection, formationFlat = 0, temporaryFlat = 0) {
    return applyStatModifiers(TYPES[unit.type].defense, 'defense', projection.ledger, { extraFlat: formationFlat + temporaryFlat }).value;
  }
  function projectUnit(unit, options = {}) {
    validateUnit(unit);
    const base = TYPES[unit.type], rank = unit.training || 0, trained = rank ? TRAINING.tracks[unit.type][unit.trainingTrack].levels[rank - 1] : {}, p = { ...clone(base), ...clone(trained), id: unit.id, type: unit.type, slot: unit.slot ?? null, training: rank, trainingTrack: unit.trainingTrack ?? null, condition: unit.condition ?? 100 };
    if (base.skill) p.skill = { ...clone(base.skill), ...(trained.skill || {}) };
    if (base.shield) p.shield = { ...clone(base.shield), ...(trained.shield || {}) };
    p.ledger = collectModifiers(unit, options); p.modifierLedger = p.ledger;
    p.modifiers = {};
    for (const [field, value] of Object.entries({ maxHp: base.hp, attackPower: base.attackPower, abilityPower: base.abilityPower, defense: base.defense })) { p.modifiers[field] = applyStatModifiers(value, field, p.ledger); p[field] = p.modifiers[field].value; }
    p.baseDefense = p.defense;
    p.guardianDefense = unit.type === 'guardian' ? Math.min(CAPS.guardianDefense, p.abilityPower * p.skill.coefficient) : 0;
    p.guardianLink = { sourceId: null, value: 0, candidates: [] };
    if (options.formation !== false && isDeployed(unit)) { p.guardianLink = guardianLinks(options.roster || [unit], { ...options, formation: false })[unit.id] || p.guardianLink; p.defense = projectDefense(unit, p, p.guardianLink.value); }
    p.conditionMultiplier = conditionEfficiency(p.condition); p.conditionEfficiency = p.conditionMultiplier;
    for (const field of ['basicDamageBonus', 'supportHealBonus', 'shieldBonus', 'mageSkillDamageBonus', 'movementSpeedBonus', 'manaRegenBonus', 'attackSpeedBonus', 'unitSkillCdr']) p[field] = bonus(field, p.ledger);
    p.attackFrequencyCostFactor = factor('attackFrequencyCostFactor', p.ledger); p.attackIntervalCostFactor = factor('attackIntervalCostFactor', p.ledger); p.supportPeriodCostFactor = factor('supportPeriodCostFactor', p.ledger);
    p.baseAttackInterval = base.rate; p.attackInterval = base.rate * p.attackIntervalCostFactor / ((1 + p.attackSpeedBonus) * p.attackFrequencyCostFactor); p.rate = p.attackInterval;
    p.attackRange = p.range; p.speed = base.speed * (1 + p.movementSpeedBonus) * factor('speed', p.ledger);
    p.hp = p.maxHp; p.damage = p.basicDamage = p.attackPower * p.conditionMultiplier * (1 + p.basicDamageBonus); p.spellPower = p.abilityPower;
    p.manaRegen = base.manaRegen * (1 + p.manaRegenBonus) * factor('manaRegen', p.ledger);
    p.heal = p.abilityPower * (p.healCoefficient || 0) * p.conditionMultiplier * (1 + p.supportHealBonus);
    p.healInterval = base.healInterval * p.supportPeriodCostFactor; p.healInitialDelay = (base.healInitialDelay || 0) * p.supportPeriodCostFactor;
    p.critChance = Math.min(CAPS.critChance, bonus('critChance', p.ledger)); p.critDamage = Math.min(CAPS.critDamage, 1.5 + bonus('critDamageBonus', p.ledger));
    p.firstAttackMultiplier = p.firstAttackMultiplier || 1; p.maxTargets = p.maxTargets || 1; p.primaryMultiplier = p.primaryMultiplier || 1; p.secondaryMultiplier = p.secondaryMultiplier ?? 1;
    if (p.skill) {
      const skill = p.skill;
      if (skill.effectKind === 'damage') { const eventBonus = skill.actionType === 'basic_attack' ? p.basicDamageBonus : p.family === 'mage' ? p.mageSkillDamageBonus : 0; skill.damage = (p.attackPower * (skill.attackCoefficient || 0) + p.abilityPower * (skill.coefficient || 0)) * p.conditionMultiplier * (1 + eventBonus); if (skill.secondaryCoefficient) skill.secondaryDamage = p.abilityPower * skill.secondaryCoefficient * p.conditionMultiplier * (1 + eventBonus); }
      if (skill.cooldown) skill.cooldown *= (1 - p.unitSkillCdr) * factor('unitCooldownCostFactor', p.ledger);
      skill.range = skill.range ?? p.range;
    }
    if (p.shield) { p.shield.amount = p.abilityPower * p.shield.coefficient * p.conditionMultiplier * (1 + p.shieldBonus); p.shield.cooldown *= (1 - p.unitSkillCdr) * p.supportPeriodCostFactor; p.shield.initialDelay *= p.supportPeriodCostFactor; }
    p.preparedDamageMultiplier = options.prepared ? 1.10 : 1; p.preparedDuration = options.prepared ? 10 : 0;
    p.relicEffects = getRelicEffects(options.relics || [], options.skills || []);
    p.abilities = [{ id: 'basic_attack', name: '기본공격', actionType: 'basic_attack', attackCoefficient: 1, abilityCoefficient: 0, amount: p.basicDamage, primaryAmount: p.basicDamage * p.primaryMultiplier, secondaryAmount: p.basicDamage * p.secondaryMultiplier, firstAttackMultiplier: p.firstAttackMultiplier, firstAttackAmount: p.basicDamage * p.firstAttackMultiplier, primaryMultiplier: p.primaryMultiplier, secondaryMultiplier: p.secondaryMultiplier, interval: p.attackInterval, range: p.range, targets: p.maxTargets, canCrit: true }];
    if (p.skill) p.abilities.push({ ...clone(p.skill), attackCoefficient: p.skill.attackCoefficient || 0, abilityCoefficient: p.skill.coefficient || 0, amount: p.skill.effectKind === 'protection' ? p.guardianDefense : p.skill.damage, secondaryAmount: p.skill.secondaryDamage, interval: p.skill.cooldown });
    if (p.healCoefficient) p.abilities.push({ id: 'normal_heal', name: '치유', actionType: 'heal', attackCoefficient: 0, abilityCoefficient: p.healCoefficient, amount: p.heal, interval: p.healInterval, range: p.healRange, targets: 1, emergencyThreshold: p.emergencyThreshold, emergencyMultiplier: p.emergencyMultiplier });
    if (p.shield) p.abilities.push({ ...clone(p.shield), attackCoefficient: 0, abilityCoefficient: p.shield.coefficient, interval: p.shield.cooldown });
    p.cappedModifiers = Object.entries(p.modifiers).filter(([, value]) => value.capped || value.relicFlatCapped).map(([field, value]) => ({ field, ...value }));
    return freeze(p);
  }
  function relicAction(owned = [], incoming) {
    try { const existing = normalizeRelics(owned), result = normalizeRelic(incoming); if (existing.some(item => item.id === result.id)) return { valid: false, reason: '이미 보유한 유물입니다. 중복 획득·중첩은 없습니다.' }; if (result.evolution !== 1) return { valid: false, reason: '새 유물은 진화 I로 획득합니다.' }; return { valid: true, action: 'equip', requiresReplacement: false, requiresConfirmation: false, result }; } catch (error) { return { valid: false, reason: error.message }; }
  }
  function eligibleRelicIds(context = {}) {
    const units = (context.roster || context.units || []).filter(isDeployed), owned = context.relics || context.owned || [], skills = context.skills || [];
    return RELIC_LIST.filter(def => {
      if (def.experimental && !context.includeExperimental) return false;
      if (owned.some(item => item.id === def.id) || (!def.baseUnlocked && !hasUnlock(context, 'relics', def.unlockId))) return false;
      if (def.requiredSkill && !skills.includes(def.requiredSkill)) return false;
      if (def.requiredTimedCommand && !skills.some(id => ['guard', 'focus', 'rally'].includes(id))) return false;
      if (['spear', 'archer', 'mage', 'support'].includes(def.family) && !units.some(unit => familyOf(unit.type) === def.family)) return false;
      if (def.family === 'weapon' && !units.some(unit => ['spear', 'archer'].includes(familyOf(unit.type)))) return false;
      if (def.family === 'ap_user' && !units.some(unit => TYPES[unit.type]?.abilityPower > 0)) return false;
      return units.some(unit => !!TYPES[unit.type]);
    }).map(def => def.id);
  }
  function describeRelic(id, rarity, stacks = 1, evolution = 1) {
    if (typeof id === 'object') { const value = id; id = value.id; rarity = value.rarity; stacks = value.stacks ?? 1; evolution = value.evolution ?? value.evolutionStage ?? 1; }
    if (!RELICS[id]) return '알 수 없는 유물';
    let relic; try { relic = normalizeRelic({ id, rarity, stacks, evolution }); } catch (error) { return error.message; }
    const e = Object.fromEntries(RELICS[id].effects.map(effect => [effect.affectedField, effect.values[relic.evolution - 1]]));
    const text = {
      banner: `출전 아군 최대 HP +${pct(e.maxHp)}.`, seal: `창 계열 DEF +${e.defense}. 별도 보호율은 없습니다.`, spear_tip: `창 계열 기본공격 피해 +${pct(e.basicDamageBonus)}. 돌격 제외.`, medic: `지원 계열 정상 치유 +${pct(e.supportHealBonus)}. 보호막·지휘 회복 제외.`, whistle: `첫 아군 전투불능 후 생존 아군 평타 가속 +15%, ${e.whistleDuration}초. 전투당 한 번.`, drum: `사기 고양 지속 +${e.rallyDurationBonus}초. 가속·재사용 불변.`, keen_eye: `기본공격 치명 확률 +${pct(e.critChance)}, 배율 +0.15. 저격 강화탄·고유 기술 제외.`, arcane_lens: `마법 계열 AP +${pct(e.abilityPower)}. 별도 주문 피해 배율 없음.`, vanguard_plate: `시작 전열의 각 병사 DEF +${e.defense}.`, vanguard_banner: `시작 전열의 각 병사 최대 HP +${pct(e.maxHp)}.`, mid_resonance: `시작 중열의 AP 사용 병사 AP +${pct(e.abilityPower)}.`, rear_gambit: `시작 후열 ATK·AP +${pct(e.attackPower)}, 최대 HP -12%. 실험 전용.`, heavy_blade: `창·궁 계열 ATK +${pct(e.attackPower)}, 평타 빈도 -10%.`, overcharge_core: `마법 계열 AP +${pct(e.abilityPower)}, 마나 회복 -20%.`, triage_codex: `지원 계열 AP +${pct(e.abilityPower)}, 치유 간격·보호막 재사용·첫 시도 지연 +20%.`, echo_crystal: `마법 계열의 성공한 유료 주문 매 3회마다 실제 지불 마나의 ${pct(e.echoRefund)} 환급. 재사용 초기화 없음.`, emergency_case: `지원 정상 치유 직전 HP 20% 이하인 생존 아군에게 실제 치유 후 고정 HP ${e.emergencyHeal} 추가 회복. 군단 전투당 한 번.`, quick_hourglass: `지속형 지휘 기술 재사용 -${pct(e.commanderSkillCdr)}, 지속시간 -20%. 응급 회복 제외.`
    };
    return `${RARITY_BY_ID[relic.rarity].name} · 진화 ${['I', 'II', 'III'][relic.evolution - 1]}: ${text[id]}`;
  }
  function forgePreview(owned, relicId, context = {}) {
    let list; try { list = normalizeRelics(owned); } catch (error) { return { valid: false, effective: false, reason: error.message }; }
    const before = list.find(item => item.id === relicId);
    if (!before) return { valid: false, effective: false, reason: '보유한 유물을 선택하세요.' };
    if (before.evolution >= 3) return { valid: false, effective: false, before: clone(before), reason: '이미 최대 진화 III입니다.' };
    const after = { ...before, evolution: before.evolution + 1 }, cost = ECONOMY.forge[before.evolution], next = list.map(item => item.id === relicId ? after : item), changes = [], roster = context.roster || context.units || [];
    const fields = ['maxHp', 'attackPower', 'abilityPower', 'defense', 'basicDamage', 'heal', 'critChance', 'critDamage', 'guardianDefense', 'manaRegen'];
    const inspect = (unitId, field, a, b) => { if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > 1e-9) changes.push({ unitId, field, before: a, after: b, delta: b - a }); };
    try {
      for (const unit of roster.filter(isDeployed)) { const a = projectUnit(unit, { ...context, relics: list, roster }), b = projectUnit(unit, { ...context, relics: next, roster }); fields.forEach(field => inspect(unit.id, field, a[field], b[field])); inspect(unit.id, 'skill.damage', a.skill?.damage, b.skill?.damage); inspect(unit.id, 'skill.secondaryDamage', a.skill?.secondaryDamage, b.skill?.secondaryDamage); inspect(unit.id, 'shield.amount', a.shield?.amount, b.shield?.amount); }
      const a = getRelicEffects(list, context.skills || []), b = getRelicEffects(next, context.skills || []);
      if (roster.some(isDeployed)) { inspect(null, 'whistleDuration', a.whistleDuration, b.whistleDuration); if (roster.some(unit => isDeployed(unit) && familyOf(unit.type) === 'mage')) inspect(null, 'echoRefund', a.echoRefund, b.echoRefund); if (roster.some(unit => isDeployed(unit) && familyOf(unit.type) === 'support')) inspect(null, 'emergencyHeal', a.emergencyHeal, b.emergencyHeal); }
      for (const id of context.skills || []) { inspect(null, `command.${id}.cooldown`, a.commandSkills[id]?.cooldown, b.commandSkills[id]?.cooldown); inspect(null, `command.${id}.duration`, a.commandSkills[id]?.duration, b.commandSkills[id]?.duration); }
    } catch (error) { return { valid: false, effective: false, reason: error.message, before, after, cost }; }
    const effective = changes.length > 0, affordable = context.gold === undefined || context.gold >= cost;
    return { valid: effective && affordable, effective, affordable, reason: !effective ? '현재 편성에서 유효한 강화 효과가 없습니다.' : !affordable ? `${cost}G가 필요합니다.` : '', cost, fromEvolution: before.evolution, toEvolution: after.evolution, fromStage: before.evolution, toStage: after.evolution, before: clone(before), after: clone(after), result: clone(after), changes, description: describeRelic(after) };
  }
  function troopCandidates(units = [], cap = CAPS.armySize, context = {}) {
    const candidates = [];
    if (units.length < Math.min(cap, CAPS.armySize)) for (const type of ['spear', 'archer', 'support', 'mage']) { const count = Math.min(type === 'mage' ? 1 : 2, Math.min(cap, CAPS.armySize) - units.length); candidates.push({ id: `recruit:${type}`, kind: 'recruit', category: 'troop', type, count, name: `${TYPES[type].name} ${count}명 모집`, description: `컨디션 100인 새 병사 ${count}명이 합류합니다. 출전 정원이 차면 예비대에 합류합니다.` }); }
    for (const unit of units) {
      for (const type of EVOLUTIONS[unit.type] || []) if (!['frostmage', 'warder'].includes(type) || hasUnlock(context, 'branches', type)) candidates.push({ id: `evolve:${unit.id}:${type}`, kind: 'evolve', category: 'troop', unitId: unit.id, type, name: `${TYPES[type].name}로 진화`, description: `#${unit.id}의 교과·훈련 등급·컨디션을 유지하고 새 병과의 효과로 교체합니다.` });
      for (const option of trainingOptions(unit, context)) candidates.push({ id: `train:${unit.id}:${option.id}`, kind: 'train', category: 'troop', unitId: unit.id, trainingTrack: option.id, training: option.rank, name: `${TYPES[unit.type].name} · ${option.name} ${option.rank}`, description: option.description });
    }
    return candidates;
  }
  const getEncounter = (...args) => { const result = OLD.getEncounter(...args); if (result.tip.includes('고정 방어')) result.tip = '철갑도 같은 DEF 공식으로 피해를 줄입니다. 강한 단발과 지속 공격의 기회를 비교하세요.'; return result; };
  globalThis.TinyArmyV09Content = freeze({ VERSION, RULES_VERSION, COMBAT_VERSION, MAP_VERSION, TYPES, ALLY_TYPES, TRAINING, SYNERGIES, CAPS, CONDITION, ECONOMY, SKILLS, CHAPTERS, EVENTS, EVENT_FLAVOR, REST_OPTIONS, NODE_TYPES, RARITIES, RARITY_BY_ID, RELICS, RELIC_LIST, UNLOCKS, EVOLUTIONS, STARTER_RELIC_IDS, DEPLOYMENT_LEVELS, FIELD_CAPS, familyOf, isDeployed, deploymentCap, synergyPreview, conditionEfficiency, trainingOptions, troopCandidates, hasUnlock, normalizeRelic, normalizeRelics, collectModifiers, applyStatModifiers, getRelicEffects, projectUnit, projectDefense, projectDef: projectDefense, guardianLinks, adjacent, relicAction, eligibleRelicIds, describeRelic, forgePreview, getEncounter, ENCOUNTERS: OLD.ENCOUNTERS, availableEventChoices: OLD.availableEventChoices, rankOf: OLD.rankOf, rarityWeights: OLD.rarityWeights, rarityDistribution: OLD.rarityDistribution, rollRarity: OLD.rollRarity });
})();
