/* Presentation-only strategy reference. Never write these rounded values to a
 * roster, engine snapshot or save. Deltas subtract displayed endpoints and may
 * differ from the independently rounded raw simulation delta by one last digit. */
(function (host) {
  'use strict';
  const finite = (value, fallback = 0) => {
    try { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
    catch (_) { return fallback; }
  };
  const decimals = options => Math.max(0, Math.min(2, Math.floor(finite(options?.maxDecimals, 2))));
  // Keep both scaled endpoints and their difference inside the exact integer range.
  function scaled(value, places) {
    const scale = 10 ** places, limit = Math.floor(Number.MAX_SAFE_INTEGER / 4);
    const n = Math.max(-limit, Math.min(limit, finite(value) * scale));
    const rounded = Math.round(Math.abs(n) + Math.min(1e-7, Math.abs(n) * Number.EPSILON * 2));
    return n < 0 && rounded ? -rounded : rounded;
  }
  function integerText(value, places) {
    const magnitude = Math.abs(value), scale = 10 ** places;
    const fraction = places ? String(magnitude % scale).padStart(places, '0').replace(/0+$/, '') : '';
    return (value < 0 ? '-' : '') + Math.floor(magnitude / scale) + (fraction ? '.' + fraction : '');
  }
  // Unit strings are plain text; consumers inserting them into HTML must escape.
  const unitText = value => typeof value === 'string' ? value : '';
  function format(value, options = {}) {
    const places = decimals(options);
    return integerText(scaled(value, places), places) + unitText(options?.unit);
  }
  function pair(before, after, options = {}) {
    const places = decimals(options), b = scaled(before, places), a = scaled(after, places), delta = a - b;
    const unit = unitText(options?.unit), deltaUnit = options?.deltaUnit === undefined ? (unit === '%' ? '%p' : unit) : unitText(options.deltaUnit);
    return Object.freeze({ before: integerText(b, places) + unit, after: integerText(a, places) + unit,
      delta: (delta > 0 ? '+' : '') + integerText(delta, places) + deltaUnit, deltaNumber: delta / (10 ** places) });
  }
  // Same normalized 0..100 domain and invalid-value default as content.js.
  const conditionEfficiency = value => .7 + .3 * Math.max(0, Math.min(100, finite(value, 100))) / 100;
  const baseSingleTargetDps = (damage, interval) => finite(interval) > 0 ? finite(Math.max(0, finite(damage)) / finite(interval)) : 0;
  const DPS_LABEL = '기본 단일 대상 DPS';
  const DPS_NOTE = '기본 피해 ÷ 공격 간격. 저격 강화·다중 대상·돌격 기술·치명타·마법사 주문·치유·방어·이동·첫 공격 지연·일시 효과 제외.';
  const traits = Object.freeze({
    spear: Object.freeze({ name: '창병', summary: '근접 단일 공격', detail: '가장 가까운 적에게 접근해 한 명을 공격합니다. 창병 계열 유물이 적용됩니다.', targets: 1, family: 'spear' }),
    archer: Object.freeze({ name: '궁수', summary: '원거리 단일 공격', detail: '가장 가까운 적 한 명을 사거리 안에서 공격합니다.', targets: 1, family: 'archer' }),
    support: Object.freeze({ name: '지원병', summary: '공격과 별도 주기의 아군 치유', detail: '치유 사거리 내 부상 아군 중 체력 비율이 가장 낮은 한 명을 치유합니다. 치유 후 2.8초 간격이며 기본공격 가속은 치유를 가속하지 않습니다.', healInterval: 2.8, healRange: 220, family: 'support' }),
    guardian: Object.freeze({ name: '방벽병', summary: '자체 피해 감소 28% · 주변 아군 보호', detail: '자체 피해 감소 28%. 거리 155 미만의 비방벽 아군에게 피해 감소 +20%p. 여러 방벽병의 보호는 중첩되지 않고 전체 피해 감소 상한은 55%입니다.', ownReduction: .28, auraReduction: .2, auraRange: 155, reductionCap: .55, family: 'spear' }),
    charger: Object.freeze({ name: '돌격병', summary: '기본공격과 별도의 광역 타격', detail: '가장 가까운 적이 거리 150 미만이면 0.45초 예고 후 반경 112 안을 피해 1.6배로 타격합니다. 재사용 9초. 창끝의 기본공격 보너스와 집중 표적은 이 기술에 적용되지 않습니다.', triggerRange: 150, radius: 112, windup: .45, multiplier: 1.6, cooldown: 9, family: 'spear' }),
    sniper: Object.freeze({ name: '저격수', summary: '매 3번째 공격 1.9배', detail: '사거리 안에서 현재 체력이 가장 낮은 적을 우선합니다. 매 3번째 공격은 피해 1.9배. 사거리 내 집중 사격 표적이 있으면 표적 우선순위가 바뀝니다.', every: 3, multiplier: 1.9, targeting: 'lowest-current-hp-in-range', family: 'archer' }),
    volley: Object.freeze({ name: '연사수', summary: '서로 다른 적 최대 3명 동시 공격', detail: '공격마다 사거리 내 가까운 적 최대 3명에게 각각 기본 피해를 줍니다. 집중 사격 표적이 사거리 안에 있으면 대상에 우선 포함됩니다.', targets: 3, family: 'archer' }),
    mage: Object.freeze({ name: '마법사', summary: '마나를 사용하는 자동 단일 주문', detail: '사거리 220 안의 살아 있는 적에게 비전 화살을 자동으로 사용합니다. 마나 20, 재사용 6초. 주문은 치명타가 없으며 지휘 기술과 별개입니다.', family: 'mage' })
  });
  const trait = type => Object.prototype.hasOwnProperty.call(traits, type) ? traits[type] : null;
  // Presentation only: all combat values are supplied by Game.projectUnit.
  function statRows(stats, options = {}) {
    if (options.modern === 'v09' || options.rulesVersion === 'v09-combat-1') return v09StatRows(stats, options);
    const rows = [['maxHp','최대 체력',stats.maxHp,''],['basicDamage','기본공격 피해',stats.basicDamage,''],['attackInterval','공격 간격',stats.attackInterval,'초'],['attackRange','공격 사거리',stats.attackRange,'']];
    if (stats.heal > 0) rows.push(['heal','치유량',stats.heal,'']);
    if (options.modern) rows.push(['critChance','기본공격 치명타 확률',finite(stats.critChance)*100,'%'],['critDamage','치명타 총 피해 배율',finite(stats.critDamage,1.5)*100,'%']);
    if (stats.maxMana > 0) rows.push(['spellPower','주문력',stats.spellPower,''],['skillDamageBonus','주문 피해 보너스',finite(stats.skillDamageBonus)*100,'%'],['skillDamage','비전 화살 피해',stats.skillDamage,''],['startingMana','전투 시작 마나',stats.startingMana,''],['maxMana','최대 마나',stats.maxMana,''],['manaRegen','초당 마나 회복',stats.manaRegen,'/초'],['skillManaCost','비전 화살 마나 소모',stats.skillManaCost,''],['skillCooldown','비전 화살 재사용',stats.skillCooldown,'초']);
    return rows.map(([key,name,value,unit])=>Object.freeze({key,name,value:finite(value),unit,text:format(value,{unit})}));
  }

  // One semantic registry serves inspectors, evolution, training and forge previews.
  // All primary inputs are supplied by the active content projection, never saved.
  const ROWS = Object.freeze({
    maxHp: {name:'최대 체력',icon:'hp',direction:'higher',better:'체력 증가',worse:'체력 감소'},
    attackPower: {name:'공격력 ATK',icon:'attackPower',direction:'higher',better:'공격력 증가',worse:'공격력 감소'},
    abilityPower: {name:'주문력 AP',icon:'abilityPower',direction:'higher',better:'주문력 증가',worse:'주문력 감소'},
    basicDamage: {name:'기본공격 피해',icon:'attack',direction:'higher',better:'한 발 강화',worse:'한 발 약화'},
    attackSpeed: {name:'공격 속도',icon:'attackSpeed',unit:'회/초',direction:'higher',better:'더 빠름',worse:'더 느림'},
    attackInterval: {name:'공격 간격',icon:'attackInterval',unit:'초/회',direction:'lower',better:'더 빠름',worse:'더 느림'},
    defense: {name:'방어력 DEF',icon:'defense',direction:'higher',better:'방어 증가',worse:'방어 감소'},
    baseDamageReduction: {name:'방어력 피해 감소',icon:'damageReduction',unit:'%',direction:'higher',better:'감소율 증가',worse:'감소율 감소'},
    attackRange: {name:'공격 사거리',icon:'attackRange',direction:'contextual',better:'사거리 증가',worse:'사거리 감소'},
    speed: {name:'이동 속도',icon:'attackSpeed',direction:'higher',better:'더 빠른 이동',worse:'더 느린 이동'},
    baseSingleTargetDps: {name:DPS_LABEL,icon:'basicDps',direction:'neutral',better:'기본 DPS 증가',worse:'기본 DPS 감소'},
    heal: {name:'치유량',icon:'heal',direction:'higher',better:'치유 증가',worse:'치유 감소'},
    healInterval: {name:'치유 간격',icon:'cooldown',unit:'초',direction:'lower',better:'더 자주 치유',worse:'치유 빈도 감소'},
    healRange: {name:'치유 사거리',icon:'attackRange',direction:'contextual',better:'범위 증가',worse:'범위 감소'},
    critChance: {name:'기본공격 치명타 확률',icon:'critChance',unit:'%',direction:'higher',better:'확률 증가',worse:'확률 감소'},
    critDamage: {name:'치명타 총 피해 배율',icon:'critMultiplier',unit:'%',direction:'higher',better:'배율 증가',worse:'배율 감소'},
    startingMana: {name:'전투 시작 마나',icon:'mana',direction:'higher',better:'시작 마나 증가',worse:'시작 마나 감소'},
    maxMana: {name:'최대 마나',icon:'mana',direction:'higher',better:'마나 증가',worse:'마나 감소'},
    manaRegen: {name:'초당 마나 회복',icon:'mana',unit:'/초',direction:'higher',better:'마나 회복 증가',worse:'마나 회복 감소'},
    skillDamage: {name:'고유 기술 효과량',icon:'abilityPower',direction:'higher',better:'효과 증가',worse:'효과 감소'},
    skillManaCost: {name:'기술 마나 소모',icon:'manaCost',direction:'lower',better:'소모 감소',worse:'소모 증가'},
    skillCooldown: {name:'기술 재사용',icon:'cooldown',unit:'초',direction:'lower',better:'더 자주 사용',worse:'사용 빈도 감소'},
    shieldAmount: {name:'보호막량',icon:'shield',direction:'higher',better:'흡수량 증가',worse:'흡수량 감소'},
    shieldDuration: {name:'보호막 지속',icon:'cooldown',unit:'초',direction:'higher',better:'지속 증가',worse:'지속 감소'},
    shieldCooldown: {name:'보호막 재사용',icon:'cooldown',unit:'초',direction:'lower',better:'더 자주 사용',worse:'사용 빈도 감소'}
  });
  function v09StatRows(stats, options={}) {
    const interval=finite(stats.attackInterval,finite(stats.rate)), damage=finite(stats.basicDamage,finite(stats.damage));
    const values={...stats,maxHp:finite(stats.maxHp,stats.hp),basicDamage:damage,attackInterval:interval,attackSpeed:interval>0?1/interval:0,
      baseDamageReduction:finite(stats.defense)/(100+Math.max(0,finite(stats.defense)))*100,
      attackRange:finite(stats.attackRange,stats.range),baseSingleTargetDps:baseSingleTargetDps(damage,interval),
      critChance:finite(stats.critChance)*100,critDamage:finite(stats.critDamage,1.5)*100,
      skillDamage:finite(stats.skill?.damage,stats.skillDamage),skillManaCost:finite(stats.skill?.manaCost,stats.skillManaCost),
      skillCooldown:finite(stats.skill?.cooldown,stats.skillCooldown),shieldAmount:finite(stats.shield?.amount),
      shieldDuration:finite(stats.shield?.duration),shieldCooldown:finite(stats.shield?.cooldown)};
    const keys=['maxHp','attackPower','abilityPower','basicDamage','attackSpeed','attackInterval','defense','baseDamageReduction','attackRange','speed','baseSingleTargetDps'];
    if (stats.heal>0 || options.includeEmpty) keys.push('heal','healInterval','healRange');
    keys.push('critChance','critDamage');
    if(stats.maxMana>0 || options.includeEmpty)keys.push('startingMana','maxMana','manaRegen','skillManaCost');
    if(stats.skill?.damage!==undefined || options.includeEmpty)keys.push('skillDamage');
    if(stats.skill?.cooldown || options.includeEmpty)keys.push('skillCooldown');
    if(stats.shield || options.includeEmpty)keys.push('shieldAmount','shieldDuration','shieldCooldown');
    return keys.map(key=>{const definition=ROWS[key],value=finite(values[key]),unit=definition.unit||'';return Object.freeze({key,...definition,value,unit,text:format(value,{unit})})});
  }
  function semanticDelta(row,before,after) {
    const result=pair(before,after,{unit:row.unit||''}),delta=result.deltaNumber;
    const trend=!delta?'same':row.direction==='neutral'||row.direction==='contextual'?'contextual':(row.direction==='lower'?delta<0:delta>0)?'up':'down';
    const phrase=!delta?'변화 없음':(row.direction==='lower'?delta<0:delta>0)?row.better||'증가':row.worse||'감소';
    return Object.freeze({...result,trend,phrase});
  }
  function compareRows(before,after,options={}) {
    const modern=options.modern==='v09'||options.rulesVersion==='v09-combat-1';
    const a=statRows(before,{...options,includeEmpty:modern}),b=statRows(after,{...options,includeEmpty:modern}),byKey=new Map(a.map(row=>[row.key,row]));
    return b.filter(row=>!modern||!['heal','healInterval','healRange','startingMana','maxMana','manaRegen','skillDamage','skillManaCost','skillCooldown','shieldAmount','shieldDuration','shieldCooldown'].includes(row.key)||row.value||byKey.get(row.key)?.value).map(row=>{const old=byKey.get(row.key);return {...row,before:old?.value||0,after:row.value,...semanticDelta(row,old?.value||0,row.value),beforeValue:old?.value||0,afterValue:row.value}});
  }
  const api = Object.freeze({ format, pair, conditionEfficiency, baseSingleTargetDps, DPS_LABEL, DPS_NOTE, traits, trait, statRows, ROWS, semanticDelta, compareRows });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  host.TinyArmyStrategyView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
