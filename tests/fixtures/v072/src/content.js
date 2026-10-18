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

  globalThis.TinyArmyContent = deepFreeze({
    VERSION, CHAPTERS, NODE_TYPES, TRAINING, ECONOMY, CONDITION, REST_OPTIONS, EVENTS, SKILLS, CAPS,
    RARITIES, RARITY_BY_ID, RELICS, RELIC_LIST, UNLOCKS, ENCOUNTERS,
    conditionEfficiency, rankOf, stackMultiplier, relicEffect, getRelicEffects, describeRelic,
    rarityWeights, rarityDistribution, rollRarity, legendaryExposure, relicAction,
    eligibleRelicIds, troopCandidates, availableEventChoices, getEncounter
  });
})();
