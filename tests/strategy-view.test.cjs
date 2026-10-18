'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const V = require('../src/strategy-view.js');
require('../src/content.js');
require('../src/game-engine.js');
const { TYPES, ALLY_TYPES, Game } = globalThis.TinyArmy;
const C = globalThis.TinyArmyContent;
assert(Object.isFrozen(V));
assert.deepEqual(V.pair(19, .19 * 1.25 * 100, {unit: '%'}), {before:'19%',after:'23.75%',delta:'+4.75%p',deltaNumber:4.75});
assert.deepEqual(V.pair(1.004, 1.006), {before:'1',after:'1.01',delta:'+0.01',deltaNumber:.01});
assert.deepEqual(V.pair(1.006, 1.004), {before:'1.01',after:'1',delta:'-0.01',deltaNumber:-.01});
assert.equal(V.format(1.005), '1.01');
assert.equal(V.format(-1.005), '-1.01');
assert.equal(V.format(23.75, {maxDecimals:1}), '23.8');
assert.equal(V.format(20, {unit:'G'}), '20G');
assert.equal(V.format(-.00001), '0');
assert.equal(V.pair(-.0001, .0001).delta, '0');
for (const value of [NaN, Infinity, -Infinity, undefined, Symbol(), {}, 'oops']) assert.equal(V.format(value), '0');
assert.equal(V.format('23.750'), '23.75');
for (let i = -1000; i <= 1000; i++) {
  const p = V.pair(i / 700, i / 113 + .005);
  const cents = value => Math.round(Number(value) * 100);
  assert.equal(cents(p.after) - cents(p.before), cents(p.delta));
  assert(!Object.is(p.deltaNumber, -0));
}
for (const c of [-20, 0, 25, 50, 75, 100, 120, NaN, undefined, '75']) {
  assert(Math.abs(V.conditionEfficiency(c) - C.conditionEfficiency(c)) < 1e-12);
}
assert.equal(V.conditionEfficiency(Symbol()), 1);
assert.equal(V.baseSingleTargetDps(25, 2), 12.5);
assert.equal(V.baseSingleTargetDps(Number.MAX_VALUE, Number.MIN_VALUE), 0);
for(const bad of [0,-1,NaN,Infinity,Symbol()])assert.equal(V.baseSingleTargetDps(25,bad),0);
assert.match(V.DPS_LABEL,/기본 단일 대상/);
assert.match(V.DPS_NOTE,/저격 강화·다중 대상·돌격 기술/);
assert.deepEqual(Object.keys(V.traits), ALLY_TYPES);
for(const type of ALLY_TYPES){assert.equal(V.trait(type).name,TYPES[type].name);assert.equal(V.trait(type).family,TYPES[type].role);assert(Object.isFrozen(V.trait(type)));}
assert.equal(V.trait('__proto__'), null);
assert.equal(V.trait('unknown'), null);
assert.equal(V.trait('spear').targets,1);
assert.equal(V.trait('archer').targets,1);
assert.equal(V.trait('support').healRange,TYPES.support.healRange);
assert.equal(V.trait('guardian').ownReduction,TYPES.guardian.armor);
// Actual engine attacks verify single-target, periodic sniper boost and distinct volley targets.
for(const type of ['spear','archer','sniper','volley']){
  const g = new Game(7), u = g.units[0];
  u.type=type;u.attacks=0;u.x=200;u.y=200;
  g.enemies.slice(0,3).forEach((e,i)=>{e.x=210+i;e.y=200;});
  const hits=[];g.hit=(source,target,damage)=>hits.push({id:target.id,damage});
  for(let attack=1;attack<=3;attack++){
    hits.length=0;g.attack(u,g.enemies[0]);
    assert.equal(hits.length,V.trait(type).targets||1);
    assert.equal(new Set(hits.map(hit=>hit.id)).size,hits.length);
    assert.equal(hits[0].damage,g.basicDamage(u,g.enemies[0])*(type==='sniper'&&attack===V.trait(type).every?V.trait(type).multiplier:1));
  }
}
// Reference contracts cover timed/aura conditions without changing the simulation.
const engine = fs.readFileSync(require.resolve('../src/game-engine.js'),'utf8');
assert(engine.includes('u.healCd='+V.trait('support').healInterval));
assert(engine.includes('distance(u,target)<'+V.trait('guardian').auraRange));
assert(engine.includes('guardian ? '+V.trait('guardian').auraReduction.toString().replace(/^0/, '')+' : 0'));
assert(engine.includes('Math.min('+V.trait('guardian').reductionCap.toString().replace(/^0/, '')+',ownReduction'));
const ch=V.trait('charger');
for(const fragment of ['automaticDistance<'+ch.triggerRange,'radius:'+ch.radius,'left:'+String(ch.windup).replace(/^0/,''),'damage:u.damage*'+ch.multiplier,'u.skillCd='+ch.cooldown]) assert(engine.includes(fragment),fragment);
assert(engine.includes('inRange.sort((a,b)=>a.hp-b.hp)[0]'));
const game = new Game(13), before = JSON.stringify(game.snapshot());
for(const u of game.units){V.format(u.damage);V.pair(u.damage,u.damage*1.16);V.conditionEfficiency(u.condition);V.trait(u.type);}
assert.equal(JSON.stringify(game.snapshot()),before,'view helpers cannot mutate numeric snapshots');
console.log('strategy-view: coherent decimal pairs, sanitization, condition, seven engine-aligned traits, purity passed');
