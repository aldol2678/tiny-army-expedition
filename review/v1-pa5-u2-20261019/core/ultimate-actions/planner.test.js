import test from 'node:test';
import assert from 'node:assert/strict';
import { SECOND_CLASSES } from '../progression/registry.js';
import { ULTIMATE_TRIAL_CONFIG as CONFIG, ULTIMATE_TRIAL_FLAGS } from './trial-config.js';
import { planUltimate, ultimateShapeContains } from './trial-planner.js';
import { C, engine } from '../runtime/engine.js';

const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const sum = (p, kind) => p.intents.filter(e => e.kind === kind).reduce((n, e) => n + e.amount, 0);
const frozen = value => { if (value && typeof value === 'object') { assert(Object.isFrozen(value)); Object.values(value).forEach(frozen); } };
function fixture(id) {
  const c = SECOND_CLASSES[id];
  const raw = { id: 1, type: c.firstClassId, secondClassId: id, classStage: 3, training: 2, trainingTrack: 'specialty', condition: 50, slot: 4 };
  const source = { ...raw, team: 'ally', hp: 100, maxHp: 100, x: 200, y: 200, attackPower: 40, abilityPower: 30, conditionMultiplier: .8, mana: 40, maxMana: 50, range: 250, healRange: 205, skill: { range: 150 }, shield: { range: 205 }, defense: 15, guardUntilTick: 0, basicDamageBonus: .35, shieldBonus: .2, mageSkillDamageBonus: .1, supportHealBonus: .35 };
  const ally = (id, x, y, hp, row) => ({ id, type: 'spear', team: 'ally', hp, maxHp: 100, x, y, row, slot: row === 'back' ? 8 : 0, defense: 0, guardUntilTick: 0, statuses: [] });
  const enemy = (id, x, y) => ({ id, type: 'raider', team: 'enemy', hp: 500, maxHp: 500, x, y, range: 80, speed: 30, move: 1, attacks: 2, publicAttackSequence: 2, publicAttackReadyTick: 330, cd: .5, slows: [] });
  const game = { phase: 'battle', tickCount: 300, units: [source, ally(2, 225, 200, 20, 'front'), ally(3, 220, 240, 40, 'back')], enemies: [enemy(101, 260, 200), enemy(102, 290, 205), enemy(103, 305, 210)], telegraphs: [], encounterTelegraphs: [], formationLinks: { 2: { sourceId: 1 }, 3: { sourceId: 1 } } };
  game.encounterTelegraphs.push({ sourceId: 101, resolveTick: 350, shape: { kind: 'circle', x: 225, y: 220, radius: 30 } });
  const statuses = new Map([[2, [{ id: 's1', type: 'weakness', dispellable: true, expiresTick: 450 }]]]);
  const statusAdapter = { statusesFor: id => structuredClone(statuses.get(id) ?? []) };
  if (id === 'heat_warden') game.enemies.forEach(e => e.range = 300);
  if (id === 'pursuer') { game.enemies[0].x = 250; game.enemies[0].y = 240; game.enemies[0].range = 20; game.enemies[1].x = 255; game.enemies[1].y = 245; game.enemies[1].range = 20; }
  return { game, raw, source, statusAdapter, statuses, plan: options => planUltimate(game, raw, { statusAdapter, ...options }) };
}

test('TRIAL config preserves 16 variants, existing four IDs and explicit safe experiment flags', () => {
  assert.equal(Object.keys(CONFIG.variants).length, 16);
  assert.deepEqual(Object.keys(CONFIG.variants).sort(), Object.keys(SECOND_CLASSES).sort());
  assert.equal(ULTIMATE_TRIAL_FLAGS.productionEnabled, false);
  assert.equal(ULTIMATE_TRIAL_FLAGS.releaseEligible, false);
  assert.equal(ULTIMATE_TRIAL_FLAGS.retargetAtResolve, false);
  assert.equal(ULTIMATE_TRIAL_FLAGS.allowEchoRefund, false);
  frozen(CONFIG);
});

for (const id of Object.keys(SECOND_CLASSES)) test(`${id}: bounded pure immutable JSON plan, fixed targets and family timing`, () => {
  const f = fixture(id), before = JSON.stringify(f.game), p = f.plan();
  assert.equal(p.allowed, true, p.reason);
  assert.equal(JSON.stringify(f.game), before, 'Planning cannot mutate world, mana, cooldown or entitlement');
  assert.equal(p.skillId, SECOND_CLASSES[id].ultimateSkillId);
  assert.equal(p.variantId, id);
  assert.deepEqual([p.windupTicks, p.recoveryTicks, p.manaCost], Object.values(CONFIG.timing[SECOND_CLASSES[id].family]));
  assert(p.targetIds.length <= CONFIG.variants[id].maxTargets);
  assert(p.intents.length <= CONFIG.maximumIntents);
  assert(p.intents.every(e => e.sourceId === 1 && e.shape && Number.isSafeInteger(e.dueOffsetTicks) && e.dueOffsetTicks >= p.windupTicks));
  assert(p.intents.every(e => Number.isFinite(e.amount) && e.amount >= 0));
  assert.equal(p.resolvePolicy.retarget, false);
  assert.equal(p.resolvePolicy.redistribute, false);
  assert.equal(p.resourcePolicy.echoRefund, false);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
  frozen(p);
  assert.deepEqual(f.plan(), p);
  f.game.units.reverse(); f.game.enemies.reverse();
  assert.deepEqual(f.plan(), p, 'Stable identity tie breaking must not depend on array order');
});

test('preconditions never emit an action or change mana/use state', () => {
  const f = fixture('marksman');
  assert.equal(f.plan({ tick: 299 }).reason, 'charging');
  f.raw.classStage = 2; assert.equal(f.plan().reason, 'not-awakened'); f.raw.classStage = 3;
  f.raw.slot = null; assert.equal(f.plan().reason, 'source-not-deployed'); f.raw.slot = 4;
  f.source.hp = 0; assert.equal(f.plan().reason, 'source-dead-or-not-deployed'); f.source.hp = 100;
  f.source.attackPower = Infinity; assert.equal(f.plan().reason, 'invalid-projected-stats'); f.source.attackPower = 40;
  f.game.enemies[1].id = f.game.enemies[0].id; assert.equal(f.plan().reason, 'invalid-or-duplicate-target-ids');
  const m = fixture('ember_tactician'); m.source.mana = 9; assert.equal(m.plan().reason, 'insufficient-mana'); assert.equal(m.source.mana, 9);
});

test('actual pinned projection applies current stat investment and condition once, no basic bonuses', () => {
  const c = SECOND_CLASSES.marksman, raw = { id: 1, type: c.firstClassId, slot: 4, training: 2, trainingTrack: 'handling', condition: 50, classStage: 3, secondClassId: c.id };
  const game = new engine.Game();
  assert(game.configureBattle({ seed: 1, battleId: 'ua2-pure-projection', combatRulesVersion: C.COMBAT_VERSION, roster: [raw], skills: ['heal', 'guard'], relics: [{ id: 'heavy_blade', evolution: 1 }], encounter: { id: 'pure', enemies: ['raider'], scale: 1, row: 0 } }));
  assert(game.start()); game.tickCount = 300; game.time = 5;
  const u = game.units[0]; u.x = 200; u.y = 200; game.enemies[0].x = 260; game.enemies[0].y = 200;
  const before = JSON.stringify(game), p = planUltimate(game, raw);
  assert(p.allowed); near(sum(p, 'damage'), (u.attackPower * 1.2 + u.abilityPower * .3) * u.conditionMultiplier);
  assert.equal(p.statBasis.effectiveAP, u.abilityPower * u.conditionMultiplier);
  assert.equal(JSON.stringify(game), before);
});

test('magic and shield bonuses clamp once; normal-heal-only and basic bonuses are excluded', () => {
  const m = fixture('ember_tactician'); m.source.mageSkillDamageBonus = 10;
  near(sum(m.plan(), 'damage'), 30 * .8 * 1.2 * 1.35);
  const b = fixture('barrier_keeper'); b.source.shieldBonus = 10;
  near(sum(b.plan(), 'shield'), 30 * .8 * 1.6 * 1.35);
  const s = fixture('surgeon'); near(sum(s.plan(), 'heal'), 30 * .8 * 1.6);
  const a = fixture('marksman'); near(sum(a.plan(), 'damage'), (40 * 1.2 + 30 * .3) * .8);
});

test('bastion requires existing guardian links, real future threat and nonzero protection headroom', () => {
  const f = fixture('bastion'), p = f.plan(), grant = p.intents[0];
  assert.equal(grant.kind, 'protection'); assert.deepEqual(grant.targetIds, [2, 3]);
  assert.equal(grant.totalBudget, 24); assert.equal(grant.amount, 24); assert.equal(grant.durationTicks, 180);
  assert.equal(grant.shape.kind, 'linked'); assert.equal(grant.range, undefined);
  delete f.game.formationLinks[2]; delete f.game.formationLinks[3]; assert.equal(f.plan().reason, 'no-effective-target');
  const capped = fixture('bastion'); capped.game.units.slice(1).forEach(u => u.defense = 200);
  assert.equal(capped.plan().reason, 'no-effective-target');
  const stale = fixture('bastion'); stale.game.enemies.forEach(e => e.publicAttackReadyTick = 299); stale.game.encounterTelegraphs[0].resolveTick = 299;
  assert.equal(stale.plan().reason, 'no-effective-target');
});

test('sentinel independent attack is within real80 counter range and never delays bosses or stale sequence', () => {
  const f = fixture('sentinel'); let p = f.plan();
  assert.equal(sum(p, 'damage'), 25.6); assert.equal(sum(p, 'attackDelay'), .3);
  f.game.enemies[0].type = 'boss'; p = f.plan(); assert.equal(sum(p, 'damage'), 25.6); assert.equal(sum(p, 'attackDelay'), 0);
  f.game.enemies[0].x = 290; assert.equal(f.plan().reason, 'no-effective-target');
});

test('vanguard locks a bounded segment, max2 hits and single total damage; blocked destination cannot commit', () => {
  const f = fixture('vanguard'), p = f.plan(), move = p.intents.find(e => e.kind === 'move');
  assert(move); assert(move.amount <= f.source.skill.range); assert.equal(move.maxDistance, 150);
  near(sum(p, 'damage'), 25.6); assert(p.intents.filter(e => e.kind === 'damage').length <= 2);
  assert(p.intents.filter(e => e.kind === 'damage').every(e => ultimateShapeContains(e.shape, f.game.enemies.find(t => t.id === e.targetId))));
  f.game.obstacles = [{ kind: 'circle', x: 280, y: 205, radius: 100 }]; assert.equal(f.plan().reason, 'no-effective-target');
});

test('pursuit spends total2seconds across at most2 actually approaching rear targets', () => {
  const f = fixture('pursuer'), p = f.plan(); assert.equal(p.targetIds.length, 2);
  assert.equal(p.intents.filter(e => e.kind === 'slow').reduce((n, e) => n + e.durationTicks, 0), 120);
  near(sum(p, 'damage'), 16);
  f.game.enemies.forEach(e => e.move = 0); assert.equal(f.plan().reason, 'no-effective-target');
});

test('watcher damage fallback waits three seconds after readiness and has no invented delay', () => {
  const f = fixture('watcher'); f.game.enemies.forEach(e => delete e.publicAttackReadyTick);
  assert.equal(f.plan({ tick: 479 }).reason, 'no-effective-target');
  const p = f.plan({ tick: 480 }); assert(p.allowed); assert.equal(sum(p, 'attackDelay'), 0);
  assert.deepEqual(p.notes, ['damage-only-after-three-second-wait']);
});

test('piercing and suppression cannot hit off-line/fan targets or grow aggregate damage', () => {
  for (const id of ['skirmisher', 'suppressor']) {
    const f = fixture(id); const total = sum(f.plan(), 'damage');
    f.game.enemies[1].x = 215; f.game.enemies[1].y = 320;
    f.game.enemies[2].x = 210; f.game.enemies[2].y = 330;
    const p = f.plan(); assert.deepEqual(p.targetIds, [101]); near(sum(p, 'damage'), total);
  }
});

test('fire reserves nine immutable per-target/pulse shares, no new targets or field movement', () => {
  const f = fixture('ember_tactician'), p = f.plan(), before = JSON.stringify(p);
  assert.equal(p.intents.length, 9);
  assert.deepEqual([...new Set(p.intents.map(e => e.dueOffsetTicks))], [21, 81, 141]);
  assert(p.intents.every(e => e.derived && e.noProc && !e.paidCast));
  near(sum(p, 'damage'), 24 * 1.2 * 1.1);
  f.game.enemies[0].hp = 0; f.game.enemies[1].x = 700; f.game.enemies.push({ ...f.game.enemies[2], id: 104 });
  assert.equal(JSON.stringify(p), before); assert(!p.targetIds.includes(104));
  assert(!ultimateShapeContains(p.intents[0].shape, f.game.enemies[1]));
});

test('heat only protects a max2 ranged-threat rectangle with one shared finite registration', () => {
  const f = fixture('heat_warden'), p = f.plan();
  assert.equal(p.intents.length, 1); assert.equal(p.intents[0].rangedOnly, true);
  near(p.intents[0].totalBudget, 24 * .9); assert.equal(p.intents[0].shape.width, 50); assert.equal(p.intents[0].shape.length, 120);
  f.game.enemies.forEach(e => e.range = 50); f.game.encounterTelegraphs = []; assert.equal(f.plan().reason, 'no-effective-target');
});

test('frost max3 once each, and binder splits .6seconds without cancelling boss or bypassing immunity', () => {
  const f = fixture('frost_weaver'), p = f.plan();
  assert.equal(new Set(p.intents.filter(e => e.kind === 'damage').map(e => e.targetId)).size, p.intents.filter(e => e.kind === 'damage').length);
  near(sum(p, 'damage'), 24 * .6 * 1.1);
  const b = fixture('frost_binder'); let q = b.plan(); near(sum(q, 'attackDelay'), .6);
  b.game.enemies[0].type = 'boss'; b.game.enemies[1]._v10SealImmuneUntil = 400; q = b.plan();
  assert.equal(sum(q, 'attackDelay'), 0); near(sum(q, 'damage'), 24 * .6 * 1.1);
});

test('slow already at or above effective magnitude emits no redundant control; boss amount stays unhalved for kernel', () => {
  const f = fixture('suppressor'); f.game.enemies.forEach(e => e.slows = [{ value: .25, untilTick: 500 }]);
  assert.equal(f.plan().intents.filter(e => e.kind === 'slow').length, 0);
  f.game.enemies[0].type = 'boss'; f.game.enemies[0].slows = [];
  const slow = f.plan().intents.find(e => e.kind === 'slow'); assert.equal(slow.value, .15); assert.equal(slow.bossMultiplier, .5);
});

test('surgery allocates by missing health ratio, does not preclip healing before curse', () => {
  const f = fixture('surgeon'); f.game.units[1].maxHp = 1000; f.game.units[1].hp = 200;
  const p = f.plan(), heals = p.intents.filter(e => e.kind === 'heal');
  near(heals[0].amount / heals[1].amount, .8 / .6);
  near(sum(p, 'heal'), p.budgets.healing); assert(heals.every(e => e.sourceKind === 'ultimate_special_heal'));
  f.game.units.slice(1).forEach(u => u.hp = u.maxHp * .51); assert.equal(f.plan().reason, 'no-effective-target');
});

test('cleanser chooses status targets first, max1 cleanse each, emergency threshold and explicit tradeoff note', () => {
  const f = fixture('cleanser'); let p = f.plan(); assert.deepEqual(p.targetIds, [2]); assert.equal(sum(p, 'cleanse'), 1);
  f.statuses.set(3, [{ id: 's2', dispellable: true, expiresTick: 450 }, { id: 's3', dispellable: true, expiresTick: 450 }]);
  p = f.plan(); assert.equal(sum(p, 'cleanse'), 2);
  f.statuses.clear(); p = f.plan(); assert.equal(sum(p, 'cleanse'), 0); assert.deepEqual(p.targetIds, [2]); assert.match(p.notes[0], /opportunity-spent/);
  f.game.units[1].hp = 36; assert.equal(f.plan().reason, 'no-effective-target');
});

test('barrier refuses equal/stronger shields yet can shrink two ineffective half-shares into useful single full share', () => {
  const f = fixture('barrier_keeper'), total = f.plan().budgets.shield;
  f.game.units.slice(1).forEach(u => u.barrier = { amount: total * .75, untilTick: 500, ownerId: 8 });
  const p = f.plan(); assert.equal(p.targetIds.length, 1); near(sum(p, 'shield'), total);
  f.game.units.slice(1).forEach(u => u.barrier.amount = total); assert.equal(f.plan().reason, 'no-effective-target');
});

test('ward has one shared charge across max2 shields and never fabricates permanent immunity', () => {
  const f = fixture('ward_keeper'), p = f.plan(), wards = p.intents.filter(e => e.kind === 'ward');
  assert.equal(wards.length, 1); assert.equal(wards[0].amount, 1); assert.equal(wards[0].totalBudget, 1);
  assert.equal(wards[0].charges, 1); assert.equal(wards[0].durationTicks, 180); assert.equal(wards[0].requiresOwnedBarrier, true);
  assert.equal(p.intents.at(-1).kind, 'ward'); assert.deepEqual(wards[0].targetIds, p.targetIds);
});

test('public threat shape IDs and in-range focus are observed without invoking mutating focusTarget', () => {
  const f = fixture('marksman'); f.game.focusTargetId = 102; f.game.focusUntilTick = 400;
  f.game.focusTarget = () => { throw Error('Must not call mutating method'); };
  assert.deepEqual(f.plan().targetIds, [102]);
  const b = fixture('bastion'); b.game.enemies.forEach(e => delete e.publicAttackReadyTick);
  b.game.encounterTelegraphs = [{ sourceId: 101, resolveTick: 330, shape: { kind: 'target', targetId: 3, origin: { x: 260, y: 200 }, range: 100 } }];
  assert.deepEqual(b.plan().targetIds, [3]);
});


test('observed live stronger shared protection holds redundant casts without invoking protection provider callbacks', () => {
  const f = fixture('bastion');
  f.game._v10ProtectionProviders = [{ candidates: () => { throw Error('Planner must not call effect providers'); } }];
  const groups = [{ kind: 'protection', sourceId: 1, targetIds: [2, 3], untilTick: 600, remainingBudget: 50, rate: .2, rangedOnly: false, shape: { kind: 'targets', targetIds: [2, 3] } }];
  f.game.ultimateProtectionGroups = () => structuredClone(groups);
  assert.equal(f.plan().reason, 'no-effective-target');
  groups[0].rangedOnly = true;
  assert(f.plan().allowed, 'Ranged-only protection must not block general melee protection');
  groups[0].rangedOnly = false; groups[0].remainingBudget = 0;
  assert(f.plan().allowed, 'Exhausted protection cannot suppress a useful new action');
});
