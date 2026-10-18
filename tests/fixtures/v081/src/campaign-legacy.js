/* Frozen v0.7.2 content and schema-1 validator. Do not modify for newer rules. */
(() => { let frozenContent;
/* Tiny Army v0.5: immutable content and pure rules. Campaign owns all mutable state. */
(() => {
  'use strict';

  const VERSION = '0.5.0';
  const deepFreeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const pct = value => `${Math.round(value * 10000) / 100}%`;

  // All public chapter arguments are one-based (1 or 2); rows are zero-based (0..8).
  const CHAPTERS = deepFreeze([
    { id: 1, chapter: 1, name: '바람잎 평원', subtitle: '방패 뒤의 활과 빠른 잔병', description: '넓은 평원에서 전열을 세우고 잔병의 포위를 돌파하세요.', rows: 8, bossRow: 8, bossName: '평원의 파수꾼', theme: 'meadow' },
    { id: 2, chapter: 2, name: '잿빛 철성', subtitle: '겹친 강타와 후열의 집중 포화', description: '철갑과 강타를 버티는 동안 후열의 궁수를 제압하세요.', rows: 8, bossRow: 8, bossName: '철성의 문지기', theme: 'citadel' }
  ]);
  const NODE_TYPES = deepFreeze({
    normal: { id: 'normal', name: '일반전', description: '작은 소모로 병력과 유물 보상을 얻습니다.', icon: '⚔', combat: true },
    elite: { id: 'elite', name: '정예전', description: '추가 컨디션 소모를 감수하고 골드와 높은 등급의 보상을 노립니다.', icon: '◆', combat: true },
    boss: { id: 'boss', name: '장 보스', description: '지역의 마지막 적입니다. 다음 장 또는 원정 정산으로 이어집니다.', icon: '♜', combat: true },
    rest: { id: 'rest', name: '야영지', description: '컨디션 회복과 다음 전투 준비 중 하나를 선택합니다.', icon: '☾', combat: false },
    event: { id: 'event', name: '길 위의 만남', description: '비용과 결과를 확인하고 한 가지 선택을 합니다.', icon: '?', combat: false },
    shop: { id: 'shop', name: '행상인', description: '고정된 재고에서 한 번 구매하거나 골드를 아낍니다.', icon: 'G', combat: false }
  });

  const TRAINING = deepFreeze({ max: 2, hp: .18, damage: .16, heal: .14 });
  const ECONOMY = deepFreeze({
    startingGold: 0, walletCap: null,
    gold: { normal: 10, elite: 20, boss: 30 },
    battleGold: { normal: 10, elite: 20, boss: 30 },
    prices: { recruit: 20, train: 30, common: 10, uncommon: 15, rare: 20, epic: 30, legendary: 40 },
    recruitPrice: 20, trainingPrice: 30, purchasesPerShop: 1, relicStock: 2,
    rerolls: 0, relicSlots: 3, maxRelicStacks: 2, duplicateBonus: .25,
    objectiveTokens: { normal: 1, elite: 3, boss: 5, chapter2Multiplier: 2, completion: 8 }
  });
  const CONDITION = deepFreeze({
    max: 100, min: 0, efficiencyFloor: .70,
    loss: { normal: 4, elite: 8, boss: 10 },
    knockoutLoss: 4, restRecovery: 35, prepareRecovery: 10, preparedDamageBonus: .10, preparedDuration: 10
  });
  const conditionEfficiency = condition => CONDITION.efficiencyFloor + (1 - CONDITION.efficiencyFloor) * clamp(number(condition, 100), 0, 100) / 100;
  const REST_OPTIONS = deepFreeze([
    { id: 'recover', name: '충분히 쉬기', description: '전원 컨디션 +35. 100을 넘지 않습니다.', recover: 35, recovery: 35, prepared: false },
    { id: 'prepare', name: '진형 점검', description: '전원 컨디션 +10. 다음 전투 첫 10초간 공격 피해 +10%. 다음 전투 한 번만 적용됩니다.', recover: 10, recovery: 10, prepared: true, bonus: .10, duration: 10 }
  ]);
  const EVENTS = deepFreeze([
    {
      id: 'supply_cart', name: '고장 난 보급 수레',
      description: '행상인이 수레를 고치는 동안 보급품을 나눠 주겠다고 합니다.',
      choices: [
        { id: 'buy_rations', name: '든든한 식사', description: '12G를 지불하고 전원 컨디션 +24.', costGold: 12, conditionCost: 0, rewardGold: 0, recover: 24, prepared: false },
        { id: 'help_cart', name: '수레를 밀어 주기', description: '전원 컨디션 -6, 보답으로 12G 획득.', costGold: 0, conditionCost: 6, rewardGold: 12, recover: 0, prepared: false },
        { id: 'pass', name: '길을 계속 가기', description: '비용과 보상 없이 지나갑니다.', costGold: 0, conditionCost: 0, rewardGold: 0, recover: 0, prepared: false }
      ]
    },
    {
      id: 'watchtower', name: '오래된 망루',
      description: '높은 망루에서 적의 진형을 살필 수도, 그늘에서 잠시 쉴 수도 있습니다.',
      choices: [
        { id: 'scout', name: '높은 곳에서 정찰', description: '전원 컨디션 -5. 다음 전투 첫 10초간 공격 피해 +10%. 준비 효과는 중첩되지 않습니다.', costGold: 0, conditionCost: 5, rewardGold: 0, recover: 0, prepared: true },
        { id: 'shelter', name: '그늘에서 쉬기', description: '전원 컨디션 +18.', costGold: 0, conditionCost: 0, rewardGold: 0, recover: 18, prepared: false }
      ]
    }
  ]);
  const SKILLS = deepFreeze({
    heal: { id: 'heal', name: '응급 회복', cooldown: 24, duration: 0, heal: .15, target: 'allies', description: '생존 아군의 최대 체력 15% 회복. 컨디션은 회복하지 않습니다.' },
    guard: { id: 'guard', name: '수호 진형', cooldown: 20, duration: 4, reduction: .20, target: 'allies', description: '4초간 생존 아군 피해 감소 +20%p. 전체 피해 감소 상한 55%.' },
    focus: { id: 'focus', name: '집중 사격', cooldown: 18, duration: 6, damage: .10, target: 'enemy', description: '6초간 적 하나를 표시. 정상 사거리 안에서 우선 공격하며 해당 적에게 기본공격 피해 +10%.' },
    rally: { id: 'rally', name: '사기 고양', cooldown: 26, duration: 5, haste: .25, target: 'allies', description: '5초간 생존 아군의 기본공격 게이지 소진 속도 +25%. 치유·고유 기술은 가속하지 않습니다.' }
  });
  const CAPS = deepFreeze({ damageReduction: .55, attackSpeed: .50, skillCdr: .20, skillSlots: 2, relicSlots: 3, armySize: 12 });

  const RARITIES = deepFreeze([
    { id: 'common', name: '일반', nameKo: '일반', rank: 1, color: '#FFFFFF', price: 10 },
    { id: 'uncommon', name: '고급', nameKo: '고급', rank: 2, color: '#57D978', price: 15 },
    { id: 'rare', name: '희귀', nameKo: '희귀', rank: 3, color: '#4CA9FF', price: 20 },
    { id: 'epic', name: '영웅', nameKo: '영웅', rank: 4, color: '#B67AFF', price: 30 },
    { id: 'legendary', name: '전설', nameKo: '전설', rank: 5, color: '#FFA33D', price: 40 }
  ]);
  const RARITY_BY_ID = deepFreeze(Object.fromEntries(RARITIES.map(rarity => [rarity.id, rarity])));
  const RELICS = deepFreeze({
    banner: { id: 'banner', name: '행군의 깃발', iconId: 'relic-marching-banner', family: 'army', baseUnlocked: true, description: '군단 전체의 최대 체력을 높입니다.', effect: 'maxHp', values: [.08, .10, .12, .14, .20] },
    seal: { id: 'seal', name: '철벽의 인장', iconId: 'relic-ironwall-seal', family: 'spear', baseUnlocked: true, description: '창병·방벽병·돌격병의 피해 감소율을 높입니다.', effect: 'damageReduction', values: [.06, .07, .085, .10, .14] },
    spear_tip: { id: 'spear_tip', name: '날 선 창끝', iconId: 'relic-keen-spear-tip', family: 'spear', baseUnlocked: true, description: '창병 계열의 기본공격 피해를 높입니다. 돌격 기술에는 적용되지 않습니다.', effect: 'basicDamage', values: [.12, .15, .19, .24, .36] },
    medic: { id: 'medic', name: '야전 구급낭', iconId: 'relic-field-medkit', family: 'support', baseUnlocked: true, description: '지원병 치유량을 높입니다. 응급 회복의 치유량은 바꾸지 않습니다.', effect: 'supportHeal', values: [.16, .20, .24, .28, .40] },
    whistle: { id: 'whistle', name: '역습의 호루라기', iconId: 'relic-counter-whistle', family: 'army', baseUnlocked: false, unlockId: 'whistle', description: '첫 아군 전투불능 때, 생존 아군의 기본공격을 6초간 가속합니다. 전투당 한 번.', effect: 'attackSpeed', values: [.15, .18, .21, .24, .32], duration: 6 },
    drum: { id: 'drum', name: '결전의 북', iconId: 'relic-battle-drum', family: 'army', baseUnlocked: false, unlockId: 'drum', requiredSkill: 'rally', description: '사기 고양의 지속시간이 늘어납니다. 평타 가속 수치와 재사용 시간은 그대로입니다.', effect: 'rallyDuration', values: [1, 1.2, 1.4, 1.6, 2.4], cooldownPenalty: 0 }
  });
  const RELIC_LIST = deepFreeze(Object.values(RELICS));
  const UNLOCKS = deepFreeze([
    { id: 'whistle', name: '역습의 호루라기', type: 'relic', relic: 'whistle', cost: 3, description: '이후 원정의 보상·상점 후보에 역습의 호루라기를 추가합니다.' },
    { id: 'drum', name: '결전의 북', type: 'relic', relic: 'drum', cost: 5, description: '이후 원정에서 사기 고양을 장착하면 결전의 북이 후보로 등장합니다.' }
  ]);

  const rankOf = rarity => RARITY_BY_ID[rarity]?.rank || 1;
  const stackMultiplier = relic => relic?.rarity === 'legendary' ? 1 : 1 + (clamp(Math.floor(number(relic?.stacks, 1)), 1, 2) - 1) * ECONOMY.duplicateBonus;
  function relicEffect(relic) {
    const effects = { maxHp: 0, damageReduction: 0, basicDamage: 0, supportHeal: 0, attackSpeed: 0, whistleDuration: 0, rallyDuration: 0, rallyCooldown: 0, skillCdr: 0 };
    const definition = RELICS[relic?.id];
    if (!definition) return effects;
    effects[definition.effect] = definition.values[rankOf(relic.rarity) - 1] * stackMultiplier(relic);
    if (definition.duration) effects.whistleDuration = definition.duration;
    if (definition.cooldownPenalty) effects.rallyCooldown = definition.cooldownPenalty;
    return effects;
  }
  function getRelicEffects(relics = [], skills = []) {
    const effects = { hpBonus: 0, spearDamageBonus: 0, spearReduction: 0, supportHealBonus: 0, whistleHaste: 0, whistleDuration: 0, rallyDurationBonus: 0, rallyCooldownPenalty: 0, skillCdr: 0 };
    const seen = new Set();
    for (const relic of Array.isArray(relics) ? relics : []) {
      if (!RELICS[relic?.id] || seen.has(relic.id) || seen.size >= CAPS.relicSlots) continue;
      seen.add(relic.id);
      const effect = relicEffect(relic);
      effects.hpBonus += effect.maxHp;
      effects.spearDamageBonus += effect.basicDamage;
      effects.spearReduction += effect.damageReduction;
      effects.supportHealBonus += effect.supportHeal;
      effects.whistleHaste += effect.attackSpeed;
      effects.whistleDuration = Math.max(effects.whistleDuration, effect.whistleDuration);
      if (skills.includes('rally')) {
        effects.rallyDurationBonus += effect.rallyDuration;
        effects.rallyCooldownPenalty += effect.rallyCooldown;
      }
      effects.skillCdr += effect.skillCdr;
    }
    effects.spearReduction = Math.min(CAPS.damageReduction, effects.spearReduction);
    effects.whistleHaste = Math.min(CAPS.attackSpeed, effects.whistleHaste);
    effects.skillCdr = Math.min(CAPS.skillCdr, effects.skillCdr);
    return effects;
  }
  function describeRelic(id, rarity = 'common', stacks = 1) {
    if (id && typeof id === 'object') { stacks = id.stacks; rarity = id.rarity; id = id.id; }
    const definition = RELICS[id];
    if (!definition) return '알 수 없는 유물';
    const effect = relicEffect({ id, rarity, stacks });
    const descriptions = {
      banner: `아군 전체 최대 체력 +${pct(effect.maxHp)}.`,
      seal: `창병 계열 피해 감소 +${pct(effect.damageReduction)}p. 전체 피해 감소 상한 55%.`,
      spear_tip: `창병 계열 기본공격 피해 +${pct(effect.basicDamage)}. 돌격 기술에는 적용되지 않습니다.`,
      medic: `지원병 치유량 +${pct(effect.supportHeal)}. 응급 회복에는 적용되지 않습니다.`,
      whistle: `첫 아군 전투불능 때 생존 아군 평타 가속 +${pct(effect.attackSpeed)}, ${effect.whistleDuration}초. 전투당 한 번. 총 가속 상한 50%.`,
      drum: `사기 고양 지속 +${Math.round(effect.rallyDuration * 1000) / 1000}초. 가속 수치·재사용 시간은 그대로. 사기 고양 장착 필요.`
    };
    return descriptions[id] + (rarity !== 'legendary' && number(stacks, 1) >= 2 ? ' 2중첩: 두 번째 효과는 25%만 추가.' : '');
  }

  function normalizeDepth(chapter, row) {
    if (chapter && typeof chapter === 'object') return { chapter: number(chapter.chapter, 1), row: number(chapter.row, 0) };
    return { chapter: number(chapter, 1), row: number(row, 0) };
  }
  function rarityWeights(chapter, row) {
    const depth = normalizeDepth(chapter, row), fraction = clamp(depth.row / 8, 0, 1);
    let weights;
    if (depth.chapter >= 2) weights = fraction < .6 ? [.30, .34, .28, .0775, .0025] : [.25, .33, .31, .1075, .0025];
    else if (fraction < .4) weights = [.70, .25, .05, 0, 0];
    else if (fraction < .6) weights = [.60, .28, .11, .01, 0];
    else if (fraction < .8) weights = [.50, .30, .17, .029, .001];
    else weights = [.40, .32, .23, .049, .001];
    return Object.fromEntries(RARITIES.map((rarity, index) => [rarity.id, weights[index]]));
  }
  function rarityDistribution(chapter, row, source = 'normal') {
    if (chapter && typeof chapter === 'object') { source = chapter.type || chapter.source || source; row = chapter.row; chapter = chapter.chapter; }
    const base = rarityWeights(chapter, row);
    if (source !== 'elite' && source !== 'boss') return base;
    const distribution = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: base.legendary };
    RARITIES.slice(0, 4).forEach((rarity, index) => {
      if (source === 'boss') distribution[RARITIES[clamp(index + 1, 2, 3)].id] += base[rarity.id];
      else {
        distribution[rarity.id] += base[rarity.id] * .6;
        distribution[RARITIES[Math.min(index + 1, 3)].id] += base[rarity.id] * .4;
      }
    });
    return distribution;
  }
  function rollRarity(randomFn, chapter, row, source = 'normal') {
    // Supports rollRarity(randomFn, chapter, row, source) and rollRarity({chapter,row,type}, randomFn).
    if (randomFn && typeof randomFn === 'object') {
      const context = randomFn;
      randomFn = chapter; chapter = context.chapter; row = context.row; source = context.type || context.source || 'normal';
    }
    if (typeof randomFn !== 'function') throw new TypeError('rollRarity requires an explicit seeded random function.');
    const draw = () => {
      const value = randomFn();
      if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random draws must be finite values in [0, 1).');
      return value;
    };
    const weights = rarityWeights(chapter, row), legendaryChance = weights.legendary;
    // Exactly one direct legendary check; subsequent promotion cannot reach legendary.
    if (draw() < legendaryChance) return 'legendary';
    let pick = draw() * (1 - legendaryChance), rank = 3;
    for (let index = 0; index < 4; index++) {
      pick -= weights[RARITIES[index].id];
      if (pick < 0) { rank = index; break; }
    }
    if (source === 'elite' && draw() < .4) rank = Math.min(3, rank + 1);
    if (source === 'boss') rank = clamp(rank + 1, 2, 3);
    return RARITIES[rank].id;
  }
  function legendaryExposure(contexts = []) {
    return 1 - contexts.reduce((none, context) => none * Math.pow(1 - rarityWeights(context.chapter, context.row).legendary, Math.max(0, Math.floor(number(context.cards, 0)))), 1);
  }
  function relicAction(owned, incoming) {
    if (!RELICS[incoming?.id] || !RARITY_BY_ID[incoming.rarity]) return { valid: false, reason: '알 수 없는 유물 또는 등급입니다.' };
    const existing = (owned || []).find(relic => relic.id === incoming.id);
    if (!existing) return { valid: true, action: 'equip', requiresReplacement: (owned || []).length >= CAPS.relicSlots };
    if (existing.rarity === 'legendary') return { valid: false, reason: '이 정체성의 전설은 이미 보유 중입니다.' };
    const currentRank = rankOf(existing.rarity), incomingRank = rankOf(incoming.rarity);
    if (incomingRank > currentRank) return { valid: true, action: 'replace', existing: copy(existing), requiresConfirmation: true, requiresReplacement: false, result: { id: incoming.id, rarity: incoming.rarity, stacks: 1 } };
    if (incomingRank <= currentRank && number(existing.stacks, 1) < 2) return { valid: true, action: 'merge', existing: copy(existing), requiresReplacement: false, result: { id: incoming.id, rarity: existing.rarity, stacks: 2 } };
    return { valid: false, reason: '이미 최대 2중첩입니다.' };
  }
  function eligibleRelicIds(context = {}, rarity = null) {
    const units = context.units || context.roster || [];
    const owned = context.relics || context.owned || [];
    const unlockInput = context.unlockedRelics || context.unlocks?.relics || context.unlocks || [];
    const unlocks = new Set(Array.isArray(unlockInput) ? unlockInput : []);
    const skills = context.skills || [];
    return RELIC_LIST.filter(relic => {
      if (!relic.baseUnlocked && !unlocks.has(relic.id)) return false;
      if (relic.family === 'spear' && !units.some(unit => ['spear', 'guardian', 'charger'].includes(unit.type))) return false;
      if (relic.family === 'support' && !units.some(unit => unit.type === 'support')) return false;
      if (relic.requiredSkill && !skills.includes(relic.requiredSkill)) return false;
      if (rarity) return relicAction(owned, { id: relic.id, rarity, stacks: 1 }).valid;
      return !owned.some(item => item.id === relic.id && item.rarity === 'legendary');
    }).map(relic => relic.id);
  }
  function troopCandidates(units = [], cap = CAPS.armySize) {
    const candidates = [], names = { spear: '창병', archer: '궁수', support: '지원병', guardian: '방벽병', charger: '돌격병', sniper: '저격수', volley: '연사수' };
    if (units.length < cap) ['spear', 'archer', 'support'].forEach(type => {
      const count = Math.min(2, cap - units.length);
      candidates.push({ id: `recruit:${type}`, kind: 'recruit', category: 'troop', type, count, name: `${names[type]} ${count}명 모집`, description: `컨디션 100인 새 ${names[type]} ${count}명이 합류합니다. 기존 병사의 컨디션은 유지합니다.` });
    });
    for (const unit of units) {
      const upgrades = unit.type === 'spear' ? ['guardian', 'charger'] : unit.type === 'archer' ? ['sniper', 'volley'] : [];
      upgrades.forEach(type => candidates.push({ id: `evolve:${unit.id}:${type}`, kind: 'evolve', category: 'troop', unitId: unit.id, type, name: `${names[type]}로 진화`, description: `${names[unit.type]} #${unit.id} → ${names[type]}. 훈련·컨디션을 유지합니다.` }));
      if (number(unit.training, 0) < TRAINING.max) candidates.push({ id: `train:${unit.id}`, kind: 'train', category: 'troop', unitId: unit.id, name: `${names[unit.type]} 집중 훈련`, description: `#${unit.id} 훈련 ${number(unit.training, 0) + 1}/2. 기본 체력 +18%, 공격 +16%, 치유 +14%. 컨디션은 유지합니다.` });
    }
    return candidates;
  }
  function availableEventChoices(event, context = {}) {
    const definition = typeof event === 'string' ? EVENTS.find(item => item.id === event) : event;
    return (definition?.choices || []).map(choice => ({ ...copy(choice), available: number(context.gold, 0) >= choice.costGold, reason: number(context.gold, 0) < choice.costGold ? `${choice.costGold}G가 필요합니다.` : '' }));
  }

  const encounters = (name, description, enemies, tip, scale = 1) => ({ name, description, enemies, tip, scale });
  // Compositions provide different pressures. There is no global chapter HP/damage multiplier.
  const ENCOUNTERS = deepFreeze({
    1: {
      normal: [
        encounters('풀잎 길목', '세 명의 정찰병이 평원 입구를 지킵니다.', ['raider', 'raider', 'bow'], '창병은 앞에, 궁수와 지원병은 뒤에 배치해 보세요.'),
        encounters('낡은 돌다리', '철갑 뒤의 궁수가 전열을 노립니다.', ['armored', 'raider', 'bow', 'bow'], '철갑의 고정 방어에는 강한 단발이 유리합니다.'),
        encounters('바람의 둔덕', '빠른 잔병이 넓게 퍼져 접근합니다.', ['swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow'], '연사수와 돌격병은 여러 잔병을 함께 공격할 수 있습니다.'),
        encounters('버려진 초소', '강타 방패병과 궁수가 같은 전열에 압박을 줍니다.', ['brute', 'armored', 'raider', 'bow', 'bow'], '붉은 강타 예고에 수호를 맞추고 후열의 공격 기회를 만드세요.'),
        encounters('풀잎 전초진지', '철갑 뒤로 잔병과 화살이 함께 밀려옵니다.', ['armored', 'brute', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow'], '전열 방어와 다중 공격이 서로 다른 적을 상대합니다.')
      ],
      elite: [
        encounters('쌍방패 순찰대', '철갑 둘이 강타 방패병과 궁수를 보호합니다.', ['armored', 'armored', 'brute', 'bow', 'bow', 'swarm', 'swarm'], '정예전은 컨디션을 8 소모합니다. 방어를 뚫을 화력을 준비하세요.'),
        encounters('언덕 포위대', '많은 잔병이 전열을 묶는 동안 궁수가 공격합니다.', ['brute', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow', 'bow'], '잔병을 빨리 정리하지 못하면 후열의 화살이 오래 쌓입니다.')
      ],
      boss: [encounters('평원의 파수꾼', '넓은 강타를 쓰는 파수꾼을 잔병과 궁수가 호위합니다.', ['boss', 'armored', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow'], '넓은 강타에는 수호, 잔병 호위에는 다중 공격을 준비하세요. 승리 후 두 번째 장으로 갑니다.')]
    },
    2: {
      normal: [
        encounters('철성 외곽', '철갑 전열과 네 궁수가 견고한 사격진을 세웠습니다.', ['armored', 'armored', 'raider', 'bow', 'bow', 'bow', 'bow'], '강한 단발로 철갑을 뚫고 사거리 안의 궁수를 집중 표시해 보세요.'),
        encounters('이중 성문', '서로 다른 두 강타 예고가 전열을 위협합니다.', ['brute', 'brute', 'armored', 'bow', 'bow', 'bow', 'swarm', 'swarm'], '강타가 겹치는 순간에 수호를 아껴 쓰세요.'),
        encounters('잿빛 병영', '잔병 떼를 궁수와 철갑이 지원합니다.', ['armored', 'armored', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow', 'bow'], '다중 공격이 잔병을 걷어 내는 동안 전열이 화살을 버텨야 합니다.'),
        encounters('내성의 긴 회랑', '철갑과 강타 방패병이 긴 사격진 앞에 서 있습니다.', ['armored', 'armored', 'brute', 'brute', 'bow', 'bow', 'bow', 'bow'], '전열을 한곳에 모으면 강타 피해도 모입니다. 자리 배치를 비교하세요.')
      ],
      elite: [
        encounters('철갑 근위대', '세 겹 철갑과 두 강타병이 사격대를 지킵니다.', ['armored', 'armored', 'armored', 'brute', 'brute', 'bow', 'bow', 'bow', 'bow'], '강한 단발과 생존 수단을 함께 갖춘 편성에 맞는 위험한 길입니다.'),
        encounters('성벽의 포위망', '강타와 잔병 무리, 다섯 궁수가 동시에 압박합니다.', ['brute', 'brute', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'swarm', 'bow', 'bow', 'bow', 'bow', 'bow'], '다중 공격만으로는 후열의 사격이 멈추지 않습니다. 전열 유지도 살피세요.')
      ],
      boss: [encounters('철성의 문지기', '문지기의 넓은 강타와 두 호위병의 강타 뒤로 궁수 다섯이 공격합니다.', ['boss', 'brute', 'brute', 'armored', 'armored', 'bow', 'bow', 'bow', 'bow', 'bow', 'swarm', 'swarm', 'swarm', 'swarm'], '평원의 잔병전과 달리 강타가 겹치고 사격 압박이 길어집니다. 이 보스가 이번 원정의 마지막입니다.')]
    }
  });
  function getEncounter(chapter, row, nodeType = 'normal', variant = 0) {
    if (chapter && typeof chapter === 'object') {
      const context = chapter;
      chapter = context.chapter; row = context.row; nodeType = context.type || context.nodeType || 'normal'; variant = context.variant ?? context.seed ?? 0;
    }
    const chapterId = Math.floor(number(chapter, 1));
    if (!ENCOUNTERS[chapterId]) throw new RangeError('The public expedition has chapters 1 and 2 only.');
    if (!['normal', 'elite', 'boss'].includes(nodeType)) throw new RangeError('Only combat nodes have encounters.');
    const pool = ENCOUNTERS[chapterId][nodeType];
    const depth = clamp(Math.floor(number(row, 0)), 0, 8);
    let index = 0;
    if (nodeType === 'normal') index = depth === 0 && chapterId === 1 ? 0 : clamp(Math.floor(depth * pool.length / 8) + Math.abs(Math.floor(number(variant, 0))) % 2, 0, pool.length - 1);
    else if (nodeType === 'elite') index = (Math.floor(depth / 3) + Math.abs(Math.floor(number(variant, 0)))) % pool.length;
    return { ...copy(pool[index]), id: `chapter-${chapterId}-${nodeType}-${index}`, chapter: chapterId, row: depth, type: nodeType, conditionCost: CONDITION.loss[nodeType], gold: ECONOMY.gold[nodeType], final: chapterId === 2 && nodeType === 'boss' };
  }

  frozenContent = deepFreeze({
    VERSION, CHAPTERS, NODE_TYPES, TRAINING, ECONOMY, CONDITION, REST_OPTIONS, EVENTS, SKILLS, CAPS,
    RARITIES, RARITY_BY_ID, RELICS, RELIC_LIST, UNLOCKS, ENCOUNTERS,
    conditionEfficiency, rankOf, stackMultiplier, relicEffect, getRelicEffects, describeRelic,
    rarityWeights, rarityDistribution, rollRarity, legendaryExposure, relicAction,
    eligibleRelicIds, troopCandidates, availableEventChoices, getEncounter
  });
})();

/* Campaign state machine. No DOM, eval, timers, or battle simulation. */
(() => {
'use strict';
const SCHEMA_VERSION=1, STORAGE_KEY='tiny-army-v05-save', RULES_VERSION='v05-campaign-1';
const TYPES=['spear','archer','support','guardian','charger','sniper','volley'];
const SKILLS=['heal','guard','focus','rally'];
const RARITIES=['common','uncommon','rare','epic','legendary'];
const RELIC_IDS=['banner','seal','spear_tip','medic','whistle','drum'];
const BASE_RELICS=RELIC_IDS.slice(0,4), TERMINAL=['complete','defeat','retired'];
const PHASES=['map','prepare','battle','reward','rest','shop','event','nodeComplete',...TERMINAL];
const NODE_TYPES=['normal','elite','boss','rest','shop','event'];
const DEFAULT_EVENTS=[{id:'supply_cart',choices:[{id:'help_cart',name:'수레를 밀어 주기',description:'전원 컨디션 -6 · 12G 획득',costGold:0,conditionCost:6,rewardGold:12,recover:0,prepared:false},{id:'pass',name:'길을 계속 가기',description:'비용 없이 지나갑니다.',costGold:0,conditionCost:0,rewardGold:0,recover:0,prepared:false}]},{id:'watchtower',choices:[{id:'scout',name:'망루 정찰',description:'전원 컨디션 -5 · 다음 전투 첫 10초 피해량 +10%',costGold:0,conditionCost:5,rewardGold:0,recover:0,prepared:true},{id:'shelter',name:'그늘에서 쉬기',description:'전원 컨디션 +18',costGold:0,conditionCost:0,rewardGold:0,recover:18,prepared:false}]}];
const NAMES={normal:'일반 전투',elite:'정예 전투',boss:'장 보스',rest:'야영지',shop:'여행 상인',event:'길 위의 만남'};
const UNIT_NAMES={spear:'창병',archer:'궁수',support:'지원병',guardian:'방벽병',charger:'돌격병',sniper:'저격수',volley:'연사수'};
// v0.5 balance fixture: five combat decisions per chapter, not a future content limit.
const MATRIX=[['normal','normal','normal'],['event','shop','rest'],['normal','normal','elite'],['rest','event','shop'],['normal','elite','normal'],['shop','rest','event'],['normal','normal','elite'],['rest','rest','rest']];
const clone=value=>JSON.parse(JSON.stringify(value));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const str=(v,max=200)=>typeof v==='string'&&v.length<=max;
const unique=a=>new Set(a).size===a.length;
const content=()=>frozenContent;
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
function storageDefault(){try{return globalThis.localStorage||null}catch(_){return null}}
function createProfile(){return{version:1,tokens:0,level:1,unlocks:{relics:BASE_RELICS.slice(),tactics:['balanced']},records:{runs:0,wins:0,bestChapter:0,battles:0},settledRunIds:[]}}
function safeTree(value,depth=0){if(depth>22)return false;if(typeof value==='number')return Number.isFinite(value);if(value===null||typeof value==='string'||typeof value==='boolean')return true;if(Array.isArray(value))return value.length<=10000&&value.every(v=>safeTree(v,depth+1));if(!obj(value))return false;return Object.keys(value).every(k=>!['__proto__','constructor','prototype'].includes(k)&&safeTree(value[k],depth+1))}
function fallbackEncounter(chapter,row,type,seed){const boss=type==='boss',elite=type==='elite';return{name:chapter===1?'초록빛 변방':'잿빛 성채',description:boss?'장 보스와 호위대가 길을 막습니다.':elite?'추가 위험을 감수하는 정예 경로입니다.':'적의 진형을 살펴보고 출발하세요.',enemies:boss?(chapter===1?['boss','armored','bow']:['boss','brute','armored','bow','bow']):elite?['armored','brute','bow','bow']:row<2&&chapter===1?['raider','raider','bow']:['armored','raider','bow','swarm','swarm'],scale:chapter===1?1+(row*.035):1.2+(row*.045),tip:'전열을 지키고 지원병을 보호하세요.',chapter,row,nodeType:type,seed}}
function getEncounter(chapter,row,type,seed){let e;try{if(content().getEncounter)e=content().getEncounter(chapter,row,type,seed%3)}catch(_){}return{...clone(e||fallbackEncounter(chapter,row,type,seed)),chapter,row,nodeType:type}}
function createMap(seed){const nodes=[];for(let chapter=1;chapter<=2;chapter++){for(let row=0;row<9;row++)for(let lane=0;lane<(row===8?1:3);lane++){const type=row===8?'boss':MATRIX[row][lane],id=`c${chapter}-r${row}-l${lane}`,battle=['normal','elite','boss'].includes(type);const next=row===8?(chapter===1?[0,1,2].map(l=>`c2-r0-l${l}`):[]):row===7?[`c${chapter}-r8-l0`]:[0,1,2].filter(l=>Math.abs(l-lane)<=1).map(l=>`c${chapter}-r${row+1}-l${l}`);nodes.push({id,chapter,row,lane,type,name:NAMES[type],description:battle?(type==='elite'?'위험한 적 · 더 좋은 보상 · 컨디션 소모 8':type==='boss'?'장을 마무리하는 보스 · 컨디션 소모 10':'기본 성장 보상 · 컨디션 소모 4'):type==='rest'?'컨디션 회복 또는 다음 전투 준비':type==='shop'?'고정 재고 · 골드를 모아 필요한 것을 구매':'비용과 결과를 보고 하나를 선택',next,encounter:battle?getEncounter(chapter,row,type,hash(`${seed}:${id}`)):null,eventId:type==='event'?(content().EVENTS||DEFAULT_EVENTS)[(chapter+lane)%2].id:null,conditionCost:battle?(content().CONDITION?.loss?.[type]??(type==='normal'?4:type==='boss'?10:8)):0})}}return nodes}
function validRelic(r){return obj(r)&&RELIC_IDS.includes(r.id)&&RARITIES.includes(r.rarity)&&int(r.stacks,1,r.rarity==='legendary'?1:2)}
function validRoster(list){return Array.isArray(list)&&list.length>=1&&list.length<=12&&list.every(u=>obj(u)&&int(u.id,1,1000000)&&TYPES.includes(u.type)&&int(u.training,0,2)&&int(u.slot,0,11)&&num(u.condition,0,100))&&unique(list.map(u=>u.id))&&unique(list.map(u=>u.slot))}
function validProfile(p){return obj(p)&&p.version===1&&int(p.tokens,0,1000000000)&&int(p.level,1,4)&&obj(p.unlocks)&&Array.isArray(p.unlocks.relics)&&p.unlocks.relics.every(id=>RELIC_IDS.includes(id))&&unique(p.unlocks.relics)&&BASE_RELICS.every(id=>p.unlocks.relics.includes(id))&&Array.isArray(p.unlocks.tactics)&&p.unlocks.tactics.every(id=>['balanced','vanguard'].includes(id))&&unique(p.unlocks.tactics)&&p.unlocks.tactics.includes('balanced')&&obj(p.records)&&['runs','wins','battles'].every(k=>int(p.records[k],0,10000000))&&int(p.records.bestChapter,0,2)&&p.records.wins<=p.records.runs&&Array.isArray(p.settledRunIds)&&p.settledRunIds.length<=10000&&p.settledRunIds.every(id=>str(id,120))&&unique(p.settledRunIds)}
function validOffer(o,roster){if(!obj(o)||!str(o.id,120)||!str(o.name)||!str(o.description,2000)||!['troop','relic'].includes(o.category))return false;if(o.kind==='relic')return o.category==='relic'&&validRelic(o.relic)&&o.relic.stacks===1&&['equip','merge','replace'].includes(o.action)&&typeof o.requiresReplacement==='boolean'&&(!o.existing||validRelic(o.existing));if(o.category!=='troop')return false;if(o.kind==='recruit')return['spear','archer','support'].includes(o.type)&&int(o.count,1,2);if(o.kind==='evolve')return int(o.unitId,1,1000000)&&['guardian','charger','sniper','volley'].includes(o.type);return o.kind==='train'&&int(o.unitId,1,1000000)}
function validResult(h){
 if(!safeTree(h)||!obj(h)||!str(h.battleId,240)||typeof h.win!=='boolean'||(own(h,'reason')&&!str(h.reason))||(own(h,'time')&&!num(h.time,0,10000)))return false;
 for(const key of ['damageDealt','healingDone','rallyHealing','skillHealing','enemySlams'])if(own(h,key)&&!num(h[key],0,1000000000))return false;
 for(const key of ['hpRatio','minHpRatio'])if(own(h,key)&&!num(h[key],0,1.000000001))return false;
 if(own(h,'stage')&&!int(h.stage,0,8)||own(h,'ticks')&&!int(h.ticks,0,660000)||own(h,'survivors')&&!int(h.survivors,0,12)||own(h,'unitCount')&&!int(h.unitCount,1,12))return false;
 if(!Array.isArray(h.contributions)||h.contributions.length>12||!unique(h.contributions.map(u=>u&&u.id)))return false;
 for(const u of h.contributions){if(!obj(u)||!int(u.id,1,1000000)||!num(u.hp,0,1000000)||!num(u.maxHp,.0001,1000000)||u.hp>u.maxHp||['damage','healing','blocked','damageTaken','kills'].some(k=>own(u,k)&&!num(u[k],0,1000000000)))return false;if(own(u,'type')&&!TYPES.includes(u.type)||own(u,'training')&&!int(u.training,0,2)||own(u,'slot')&&!int(u.slot,0,11)||own(u,'condition')&&!num(u.condition,0,100)||own(u,'row')&&!['front','mid','back'].includes(u.row))return false;}
 if(own(h,'skillCasts')&&(!obj(h.skillCasts)||Object.keys(h.skillCasts).some(id=>!SKILLS.includes(id)||!int(h.skillCasts[id],0,10000))))return false;
 if(own(h,'inputLog')&&(!Array.isArray(h.inputLog)||h.inputLog.length>10000||h.inputLog.some(x=>!obj(x)||!int(x.tick,0,660000)||!SKILLS.includes(x.skillId)||(own(x,'battleId')&&x.battleId!==h.battleId)||(own(x,'sequence')&&!int(x.sequence,1,10000))||(x.targetId!==null&&!int(x.targetId,1,2000000)))))return false;
 if(own(h,'enemySummary')&&(!Array.isArray(h.enemySummary)||h.enemySummary.length>60||h.enemySummary.some(x=>!obj(x)||!['raider','bow','armored','swarm','brute','boss'].includes(x.type)||!int(x.count,1,60)||!int(x.survivors,0,x.count)||!num(x.remainingHp,0,1000000000)||!num(x.blocked,0,1000000000))))return false;
 return true;
}
function validateSave(value){try{
 const fail=error=>({valid:false,error});if(!safeTree(value))return fail('저장 데이터에 사용할 수 없는 값이 있습니다.');if(!obj(value)||value.schemaVersion!==SCHEMA_VERSION||value.rulesVersion!==RULES_VERSION)return fail('지원하지 않는 저장 버전입니다.');if(!validProfile(value.profile))return fail('군단 기록이 올바르지 않습니다.');const r=value.run;if(!obj(r)||!str(r.id,120)||!r.id||!int(r.seed,0,4294967295)||!int(r.rngState,0,4294967295)||!int(r.chapter,1,2)||!int(r.row,-1,8)||!PHASES.includes(r.phase)||!validRoster(r.roster))return fail('원정 기본 정보가 올바르지 않습니다.');
 if(!Array.isArray(r.relics)||r.relics.length>3||!r.relics.every(validRelic)||!unique(r.relics.map(x=>x.id))||!Array.isArray(r.skills)||r.skills.length!==2||!r.skills.every(x=>SKILLS.includes(x))||!unique(r.skills))return fail('유물 또는 기술 구성이 올바르지 않습니다.');
 if(!int(r.gold,0,1000000000)||!int(r.earnedTokens,0,1000000000)||typeof r.prepared!=='boolean'||!int(r.nextUnitId,1,1000000)||r.nextUnitId<=Math.max(...r.roster.map(u=>u.id))||!Array.isArray(r.unlockedRelics)||!r.unlockedRelics.every(id=>RELIC_IDS.includes(id))||!unique(r.unlockedRelics)||!BASE_RELICS.every(id=>r.unlockedRelics.includes(id))||typeof r.tutorial!=='boolean'||!['balanced','vanguard'].includes(r.tactic)||!Array.isArray(r.pendingUnlocks)||!unique(r.pendingUnlocks)||!r.pendingUnlocks.every(id=>['vanguard'].includes(id)))return fail('원정 자원 정보가 올바르지 않습니다.');
 const expected=createMap(r.seed);if(!Array.isArray(r.map)||r.map.length!==50||!unique(r.map.map(n=>n.id)))return fail('지도 정보가 올바르지 않습니다.');for(const n of r.map){const e=expected.find(v=>v.id===n.id);if(!obj(n)||!e||['id','chapter','row','lane','type','eventId','conditionCost'].some(k=>n[k]!==e[k])||JSON.stringify(n.next)!==JSON.stringify(e.next)||!str(n.name)||!str(n.description,2000))return fail('지도 경로 정보가 올바르지 않습니다.');if(e.encounter){if(!obj(n.encounter)||!str(n.encounter.name)||!str(n.encounter.description,2000)||!Array.isArray(n.encounter.enemies)||!n.encounter.enemies.length||n.encounter.enemies.length>60||!num(n.encounter.scale,.1,20))return fail('전투 정보가 올바르지 않습니다.');for(const enemy of n.encounter.enemies){const t=typeof enemy==='string'?enemy:enemy&&enemy.type;if(!['raider','bow','armored','swarm','brute','boss'].includes(t))return fail('알 수 없는 적 정보입니다.');if(obj(enemy)&&own(enemy,'scale')&&(!num(enemy.scale,.1,20)||enemy.scale*n.encounter.scale>20))return fail('적 배율이 올바르지 않습니다.')}}else if(n.encounter!==null)return fail('비전투 노드의 전투 정보가 잘못되었습니다.');}
 if(!Array.isArray(r.visited)||r.visited.length>18||!unique(r.visited)||!Array.isArray(r.completed)||!unique(r.completed)||r.completed.length>r.visited.length)return fail('진행 경로가 올바르지 않습니다.');for(let i=0;i<r.visited.length;i++){const n=r.map.find(n=>n.id===r.visited[i]);if(!n||(i===0&&(n.chapter!==1||n.row!==0))||(i>0&&!r.map.find(n=>n.id===r.visited[i-1]).next.includes(n.id)))return fail('연결되지 않은 지도 경로입니다.');if(i<r.completed.length&&r.completed[i]!==r.visited[i])return fail('완료 노드 원장이 올바르지 않습니다.');}
 const node=r.currentNodeId===null?null:r.map.find(n=>n.id===r.currentNodeId);if(r.visited.length){if(!node||r.visited[r.visited.length-1]!==node.id)return fail('현재 노드가 경로와 다릅니다.');const transition=['map','retired'].includes(r.phase)&&node.chapter===1&&node.row===8&&r.chapter===2&&r.row===-1;if(!transition&&(node.chapter!==r.chapter||node.row!==r.row))return fail('현재 장과 행이 경로와 다릅니다.')}else if(r.currentNodeId!==null||r.row!==-1||r.chapter!==1||!['map','retired'].includes(r.phase))return fail('시작 지점이 올바르지 않습니다.');
 if(['prepare','battle','reward'].includes(r.phase)&&(!node||!['normal','elite','boss'].includes(node.type)))return fail('현재 전투 단계가 올바르지 않습니다.');if(['rest','shop','event'].includes(r.phase)&&(!node||node.type!==r.phase))return fail('현재 노드 단계가 올바르지 않습니다.');if(['prepare','battle','rest','shop','event'].includes(r.phase)&&r.completed.includes(r.currentNodeId))return fail('완료한 노드가 다시 열렸습니다.');if(['reward','nodeComplete'].includes(r.phase)&&!r.completed.includes(r.currentNodeId))return fail('완료되지 않은 노드의 보상입니다.');if(r.phase==='map'&&r.completed.length!==r.visited.length)return fail('미완료 노드를 건너뛸 수 없습니다.');
 if(r.pendingReward!==null){const p=r.pendingReward;if(!obj(p)||!str(p.id,120)||p.nodeId!==r.currentNodeId||typeof p.claimed!=='boolean'||!Array.isArray(p.categories)||!unique(p.categories)||!p.categories.length||!p.categories.every(c=>['troop','relic'].includes(c))||!obj(p.offers)||!['troop','relic',null].includes(p.previewCategory))return fail('보상 정보가 올바르지 않습니다.');let ids=[];for(const cat of ['troop','relic']){if(!Array.isArray(p.offers[cat])||p.offers[cat].length>3||!p.offers[cat].every(o=>validOffer(o,r.roster)&&o.category===cat))return fail('보상 후보가 올바르지 않습니다.');ids.push(...p.offers[cat].map(o=>o.id))}if(!unique(ids)||p.categories.some(c=>!p.offers[c].length))return fail('보상 후보가 중복되거나 없습니다.');if(r.phase==='reward'&&p.claimed)return fail('이미 받은 보상을 다시 열 수 없습니다.');}else if(r.phase==='reward')return fail('보상 후보가 없습니다.');
 if(r.shop!==null){if(!obj(r.shop)||r.shop.nodeId!==r.currentNodeId||!Array.isArray(r.shop.offers)||r.shop.offers.length>8||!unique(r.shop.offers.map(o=>o.id))||!r.shop.offers.every(o=>validOffer(o,r.roster)&&int(o.price,0,100000)&&typeof o.purchased==='boolean'))return fail('상점 재고가 올바르지 않습니다.');}else if(r.phase==='shop')return fail('상점 재고가 없습니다.');
 if(!Array.isArray(r.history)||r.history.length>18||!r.history.every(validResult)||!unique(r.history.map(h=>h.battleId)))return fail('전투 기록이 올바르지 않습니다.');const finishedNodes=r.completed.map(id=>r.map.find(n=>n.id===id)).filter(n=>['normal','elite','boss'].includes(n.type));const won=r.history.filter(h=>h.win);if(won.length!==finishedNodes.length||won.some((h,i)=>h.battleId!==`${r.id}:${finishedNodes[i].id}`))return fail('전투 승리와 완료 원장이 다릅니다.');if(r.history.some(h=>!h.win)&&(r.history.filter(h=>!h.win).length!==1||!['defeat','retired'].includes(r.phase)||r.history[r.history.length-1].win||r.history[r.history.length-1].battleId!==`${r.id}:${r.currentNodeId}`))return fail('패배 기록이 원정 단계와 다릅니다.');if(r.phase==='defeat'&&(!r.history.length||r.history[r.history.length-1].win))return fail('패배 결과가 없습니다.');if(r.pendingUnlocks.includes('vanguard')&&!finishedNodes.some(n=>n.chapter===1&&n.type==='boss'))return fail('해금 목표가 완료되지 않았습니다.');const expectedTokens=finishedNodes.reduce((n,node)=>n+({normal:1,elite:3,boss:5}[node.type])*(node.chapter===2?2:1),0);if(r.earnedTokens!==expectedTokens)return fail('완료 목표와 증표 원장이 다릅니다.');if(!str(r.battleId,240)||!int(r.battleSeed,0,4294967295))return fail('전투 체크포인트가 올바르지 않습니다.');if(['prepare','battle'].includes(r.phase)&&r.battleId!==`${r.id}:${r.currentNodeId}`)return fail('전투 체크포인트가 현재 노드와 다릅니다.');
 if(TERMINAL.includes(r.phase)){const s=r.settlement;if(!obj(s)||s.runId!==r.id||s.outcome!==r.phase||!int(s.tokens,0,1000000000)||!int(s.completedBattles,0,18)||!int(s.bonus,0,100)||!Array.isArray(s.unlocks)||!s.unlocks.every(id=>id==='vanguard')||!value.profile.settledRunIds.includes(r.id))return fail('정산 기록이 올바르지 않습니다.');if(s.tokens!==r.earnedTokens+s.bonus||s.bonus!==(r.phase==='complete'?8:0)||s.completedBattles!==won.length)return fail('정산 금액이 완료 목표와 다릅니다.');if(r.phase==='complete'&&(!node||node.chapter!==2||node.type!=='boss'||r.completed.length!==18))return fail('완주 조건이 충족되지 않았습니다.');}else if(r.settlement!==null||value.profile.settledRunIds.includes(r.id))return fail('진행 중 원정의 정산 상태가 올바르지 않습니다.');
 return{valid:true};
 }catch(_){return{valid:false,error:'저장 데이터를 읽을 수 없습니다.'}}}
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>own(o,k)).map(k=>[k,o[k]]));
function normalizeResult(h){const out=pick(h,['battleId','stage','win','reason','time','ticks','survivors','unitCount','hpRatio','minHpRatio','rallyHealing','skillHealing','damageDealt','healingDone','enemySlams','enemySummary','contributions','skillCasts','inputLog']);out.contributions=h.contributions.map(u=>pick(u,['id','type','training','row','slot','condition','hp','maxHp','damage','healing','blocked','damageTaken','kills']));if(out.skillCasts)out.skillCasts=pick(out.skillCasts,SKILLS);if(Array.isArray(out.enemySummary))out.enemySummary=out.enemySummary.map(u=>pick(u,['type','count','survivors','remainingHp','blocked']));if(Array.isArray(out.inputLog))out.inputLog=out.inputLog.map(x=>pick(x,['battleId','tick','sequence','skillId','targetId']));return out}
function normalizeSave(raw){const data=clone(raw),p=data.profile,r=data.run;data.profile=pick(p,['version','tokens','level','unlocks','records','settledRunIds']);data.profile.unlocks=pick(p.unlocks,['relics','tactics']);data.profile.records=pick(p.records,['runs','wins','bestChapter','battles']);data.run=pick(r,['id','seed','rngState','chapter','row','phase','map','currentNodeId','visited','completed','roster','relics','skills','gold','pendingReward','shop','history','earnedTokens','prepared','settlement','nextUnitId','unlockedRelics','tutorial','tactic','pendingUnlocks','battleId','battleSeed']);const relic=x=>pick(x,['id','rarity','stacks']);const offer=o=>{const result=pick(o,['id','category','kind','name','description','type','count','unitId','relic','action','existing','requiresReplacement','price','purchased']);if(o.relic)result.relic=relic(o.relic);if(o.existing)result.existing=relic(o.existing);return result};data.run.roster=r.roster.map(u=>pick(u,['id','type','training','slot','condition']));data.run.relics=r.relics.map(relic);data.run.map=r.map.map(n=>{const out=pick(n,['id','chapter','row','lane','type','name','description','next','encounter','eventId','conditionCost']);if(n.encounter){out.encounter=pick(n.encounter,['id','name','description','enemies','scale','tip','chapter','row','nodeType','type','conditionCost','gold','final','seed']);out.encounter.enemies=n.encounter.enemies.map(e=>typeof e==='string'?e:pick(e,['type','scale']))}return out});if(r.pendingReward){data.run.pendingReward=pick(r.pendingReward,['id','nodeId','categories','offers','previewCategory','claimed']);data.run.pendingReward.offers={troop:r.pendingReward.offers.troop.map(offer),relic:r.pendingReward.offers.relic.map(offer)}}if(r.shop)data.run.shop={nodeId:r.shop.nodeId,offers:r.shop.offers.map(offer)};data.run.history=r.history.map(normalizeResult);if(r.settlement)data.run.settlement=pick(r.settlement,['runId','outcome','tokens','completedBattles','unlocks','bonus']);return{schemaVersion:SCHEMA_VERSION,rulesVersion:RULES_VERSION,profile:data.profile,run:data.run}}

globalThis.TinyArmyLegacyCampaign=Object.freeze({validateSave,createMap,normalizeSave,content:frozenContent});
})();
})();
