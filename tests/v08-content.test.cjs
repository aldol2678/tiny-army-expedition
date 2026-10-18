'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({console});
for (const name of ['content', 'campaign-legacy']) vm.runInContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), ctx);
const C = ctx.TinyArmyContent, old = ctx.TinyArmyLegacyCampaign.content;
const copy = x => JSON.parse(JSON.stringify(x));
const eq = (a,b) => assert.deepEqual(copy(a),copy(b));
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
let passed=0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
check('All six legacy relic definitions, descriptions, and effect fields remain exact', () => {
  for (const id of Object.keys(old.RELICS)) {
    eq(C.RELICS[id], old.RELICS[id]);
    for (const rarity of old.RARITIES.map(x=>x.id)) for (const stacks of [1,2]) {
      const relic={id,rarity,stacks}, a=C.relicEffect(relic), b=old.relicEffect(relic);
      for (const key of Object.keys(b)) assert.equal(a[key],b[key]);
      assert.equal(C.describeRelic(relic),old.describeRelic(relic));
      const summed=C.getRelicEffects([relic],['rally']), original=old.getRelicEffects([relic],['rally']);
      for (const key of Object.keys(original)) assert.equal(summed[key],original[key]);
    }
  }
});
check('Rarity distributions and duplicate policy are unchanged', () => {
  eq(C.RARITIES,old.RARITIES); assert.equal(old.ECONOMY.purchasesPerShop,1); assert.equal(C.ECONOMY.purchasesPerShop,null); eq(C.ECONOMY,{...copy(old.ECONOMY),purchasesPerShop:null});
  for(let chapter=1;chapter<=2;chapter++) for(let row=0;row<=8;row++) {
    eq(C.rarityWeights(chapter,row),old.rarityWeights(chapter,row));
    for(const source of ['normal','elite','boss','shop']) eq(C.rarityDistribution(chapter,row,source),old.rarityDistribution(chapter,row,source));
  }
});
check('New relic dual payloads use standard duplicate factor and legendary promotion', () => {
  for(const id of ['keen_eye','arcane_lens']) {
    const def=C.RELICS[id];
    for(const rarity of C.RARITIES.map(x=>x.id)) {
      const one=C.relicEffect({id,rarity,stacks:1}), two=C.relicEffect({id,rarity,stacks:2});
      for(const key of [def.effect,def.secondaryEffect]) near(two[key],one[key]*(rarity==='legendary'?1:1.25));
    }
    for(const key of [def.effect,def.secondaryEffect]) assert.ok(C.relicEffect({id,rarity:'legendary',stacks:1})[key]>C.relicEffect({id,rarity:'epic',stacks:2})[key]);
    assert.equal(C.relicAction([{id,rarity:'common',stacks:2}],{id,rarity:'common'}).valid,false);
  }
  const fx=C.getRelicEffects([{id:'keen_eye',rarity:'common',stacks:1},{id:'arcane_lens',rarity:'common',stacks:1}]);
  near(fx.critChance,.08); near(fx.critDamageBonus,.15); near(fx.mageSpellPowerBonus,.15); near(fx.mageSkillDamageBonus,.10);
  eq(C.getRelicEffects([{id:'keen_eye',rarity:'common'}]),C.getRelicEffects([{id:'keen_eye',rarity:'common'},{id:'keen_eye',rarity:'legendary'}]));
});
check('New-only rewards remain unavailable without explicit new rules, lens requires mage', () => {
  const context={units:[{type:'spear'},{type:'archer'},{type:'support'},{type:'mage'}],unlockedRelics:Object.keys(C.RELICS),skills:['rally']};
  for(const combatRulesVersion of [undefined,'v05-combat-1']) {
    const ids=C.eligibleRelicIds({...context,combatRulesVersion});
    assert.ok(!ids.includes('keen_eye')&&!ids.includes('arcane_lens'));
  }
  const newer={...context,combatRulesVersion:'v08-combat-1'};
  assert.ok(C.eligibleRelicIds(newer).includes('keen_eye'));
  assert.ok(C.eligibleRelicIds(newer).includes('arcane_lens'));
  assert.ok(!C.eligibleRelicIds({...newer,units:[{type:'charger'}]}).includes('arcane_lens'));
  assert.ok(C.eligibleRelicIds({...newer,unlockedRelics:[]}).includes('keen_eye'));
});
check('Mage recruits one, supports training and has no evolution; legacy candidates exact', () => {
  const units=[{id:1,type:'spear',training:1},{id:2,type:'archer',training:0},{id:3,type:'support',training:2}];
  eq(C.troopCandidates(units),old.troopCandidates(units));
  const options={combatRulesVersion:'v08-combat-1'};
  assert.equal(C.troopCandidates([],12,options).find(x=>x.type==='mage').count,1);
  assert.ok(!C.troopCandidates(Array(12).fill({id:1,type:'mage',training:2}),12,options).some(x=>x.kind==='recruit'));
  const mage=C.troopCandidates([{id:9,type:'mage',training:0}],12,options);
  assert.ok(!mage.some(x=>x.kind==='evolve'));
  assert.ok(mage.find(x=>x.kind==='train').description.includes('주문력 +15%, 최대 마나 +5'));
  assert.equal(C.TRAINING.spellPower,.15); assert.equal(C.TRAINING.maxMana,5);
});
console.log(`${passed} content checks passed; browser NOT_RUN.`);
