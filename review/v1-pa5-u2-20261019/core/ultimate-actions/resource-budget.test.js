// Synthetic mechanism tests. These are not campaign or earned-balance evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {planMageSecondary} from '../progression/combat.js';
import {captureGame} from '../spear-skills/browser.js';
import {createExactMemoryStore} from './foundation.js';
import {installUltimateResourceBudget, RESOURCE_BUDGET_VERSION} from './resource-budget.js';
import {trialSetup} from './trial-fixture.js';

const copy = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

function budgetFixture(overrides = {}) {
  const unit = {
    id: 1, x: 0, y: 0, range: 100,
    mana: 20, maxMana: 40, manaRegen: 3, unitSkillReadyTick: 0,
    cd: 9, skill: {manaCost: 30}, ...overrides,
  };
  const game = {
    battleId: 'ua2-resource-budget-test', tickCount: 0,
    enemies: [{id: 101, hp: 100, x: 50, y: 0}],
    _v10CheckpointParticipants: [],
  };
  const resources = installUltimateResourceBudget(game);
  const participant = game._v10CheckpointParticipants.find(p => p.id === 'ua2-mage-resource-budget');
  return {game, unit, resources, participant};
}

function individualPlan({game, unit}, cost = 10, occupancyTicks = 42) {
  return planMageSecondary({
    tick: game.tickCount, mana: unit.mana, maxMana: unit.maxMana, manaRegen: unit.manaRegen,
    primaryCost: unit.skill.manaCost, primaryReadyTick: unit.unitSkillReadyTick,
    secondaryCost: cost, occupancyTicks, primaryTargetAvailable: true,
  });
}

function payExtra(f, cost = 10, id = 'paid-extra') {
  const decision = f.resources.plan(f.unit, cost, 42);
  assert.equal(decision.allowed, true, JSON.stringify(decision));
  f.unit.mana -= cost;
  f.game.ultimateResourceCommitted(f.unit, decision, {rootActionId: id, skillId: id, cost});
  return decision;
}

function advanceBudget(f, ticks) {
  f.game.tickCount += ticks;
  f.unit.mana = Math.min(f.unit.maxMana, f.unit.mana + ticks * f.unit.manaRegen / 60);
}

function deferClassSecondary(f) {
  const saved = f.classes.snapshot();
  saved.states[0].cooldowns.second = 10000;
  f.classes.restore(saved);
}

test('individual mana and occupancy budgets allow exactly 240 ticks, not 241', () => {
  const f = budgetFixture();
  const paidBoundary = f.resources.plan(f.unit, 12, 42);
  assert.equal(paidBoundary.allowed, true);
  assert.equal(paidBoundary.primaryWithoutSecondaryTick, 200);
  assert.equal(paidBoundary.primaryAfterSecondaryTick, 440);
  assert.equal(paidBoundary.aggregateDelayTicks, 240);
  const paidOver = f.resources.plan(f.unit, 12.05, 42);
  assert.equal(paidOver.allowed, false);
  assert.equal(paidOver.reason, 'primary-delay-limit');
  assert.equal(paidOver.additionalPrimaryDelayTicks, 241);
  assert.equal(f.resources.plan(f.unit, 10, 440).allowed, true);
  const occupiedOver = f.resources.plan(f.unit, 10, 441);
  assert.equal(occupiedOver.allowed, false);
  assert.equal(occupiedOver.additionalPrimaryDelayTicks, 241);
});

test('sequential individually legal extras share one 240-tick primary-cycle budget', () => {
  const f = budgetFixture();
  const first = payExtra(f);
  assert.equal(first.aggregateDelayTicks, 200);
  advanceBudget(f, 42);
  const individual = individualPlan(f);
  assert.equal(individual.allowed, true);
  assert.equal(individual.additionalPrimaryDelayTicks, 200);
  const before = f.resources.snapshot();
  const combined = f.resources.plan(f.unit, 10, 42);
  assert.equal(combined.allowed, false);
  assert.equal(combined.reason, 'combined-primary-delay-limit');
  assert.equal(combined.baselinePrimaryTick, 200);
  assert.equal(combined.primaryAfterSecondaryTick, 600);
  assert.equal(combined.aggregateDelayTicks, 400);
  assert.deepEqual(f.resources.snapshot(), before);
  assert.throws(() => f.game.ultimateResourceCommitted(f.unit, combined, {cost: 10}), /combined primary budget/);
  assert.deepEqual(f.resources.snapshot(), before);
});

test('waiting past the original primary forecast cannot renew an unpaid cycle budget', () => {
  const f = budgetFixture();
  payExtra(f);
  advanceBudget(f, 360);
  assert.equal(f.unit.mana, 28);
  const individual = individualPlan(f);
  assert.equal(individual.allowed, true);
  assert.equal(individual.primaryWithoutSecondaryTick, 400);
  assert.equal(individual.primaryAfterSecondaryTick, 600);
  assert.equal(individual.additionalPrimaryDelayTicks, 200);
  const combined = f.resources.plan(f.unit, 10, 42);
  assert.equal(combined.allowed, false, 'Elapsed time must not reset an unpaid primary cycle');
  assert.equal(combined.reason, 'combined-primary-delay-limit');
  assert.equal(combined.baselinePrimaryTick, 200);
  assert.equal(combined.aggregateDelayTicks, 400);
  assert.equal(f.resources.snapshot().cycles[1].extras.length, 1);
});

test('two paid extras may exactly fill 240 ticks without resetting either clock', () => {
  const f = budgetFixture({manaRegen: 5});
  payExtra(f, 10, 'first');
  advanceBudget(f, 42);
  const second = payExtra(f, 10, 'second');
  assert.equal(second.aggregateDelayTicks, 240);
  assert.equal(second.baselinePrimaryTick, 120);
  assert.equal(f.unit.unitSkillReadyTick, 0);
  assert.equal(f.unit.cd, 9);
  close(f.unit.mana, 3.5);
  const saved = f.resources.snapshot();
  assert.equal(saved.cycles[1].baselineTick, 120);
  assert.equal(saved.cycles[1].extras.length, 2);
  assert.equal(saved.journal.length, 2);
});

test('primary priority requires a living in-range target and planning is observational', () => {
  const f = budgetFixture({mana: 40});
  const beforeUnit = copy(f.unit), beforeResources = f.resources.snapshot();
  assert.equal(f.resources.plan(f.unit, 10, 42).reason, 'primary-priority');
  f.game.enemies[0].hp = 0;
  assert.equal(f.resources.plan(f.unit, 10, 42).allowed, true);
  f.game.enemies[0].hp = 100;
  f.game.enemies[0].x = f.unit.range + .02;
  assert.equal(f.resources.plan(f.unit, 10, 42).allowed, true);
  f.game.enemies[0].x = f.unit.range + .01;
  assert.equal(f.resources.plan(f.unit, 10, 42).reason, 'primary-priority');
  assert.deepEqual(f.unit, beforeUnit);
  assert.deepEqual(f.resources.snapshot(), beforeResources);
});

test('per-unit cycles stay independent and paid-primary reset changes only its owner', () => {
  const f = budgetFixture();
  payExtra(f, 10, 'unit-one');
  const second = {...f.unit, id: 2, mana: 20};
  const secondPlan = f.resources.plan(second, 10, 42);
  assert.equal(secondPlan.allowed, true);
  second.mana -= 10;
  f.game.ultimateResourceCommitted(second, secondPlan, {rootActionId: 'unit-two', cost: 10});
  const previous = f.resources.snapshot();
  f.game.ultimatePrimaryCommitted(f.unit);
  const after = f.resources.snapshot();
  assert.equal(after.cycles[1], undefined);
  assert.deepEqual(after.cycles[2], previous.cycles[2]);
  assert.deepEqual(after.journal.at(-1).previous, previous.cycles[1]);
  assert.equal(after.journal.at(-1).type, 'primary-paid');
  assert.equal(f.unit.mana, 10, 'The accounting hook must not refund mana');
  assert.equal(f.unit.unitSkillReadyTick, 0);
});

test('resource participant captures/restores exact independent data and rejects foreign identity', () => {
  const f = budgetFixture();
  payExtra(f);
  const saved = f.participant.capture(), expected = copy(saved);
  assert.equal(saved.version, RESOURCE_BUDGET_VERSION);
  assert.equal(saved.battleId, f.game.battleId);
  f.game.ultimatePrimaryCommitted(f.unit);
  assert.notDeepEqual(f.participant.capture(), expected);
  f.participant.restore(saved);
  assert.deepEqual(f.participant.capture(), expected);
  saved.cycles[1].extras[0].cost = 999;
  saved.journal[0].cost = 999;
  assert.deepEqual(f.participant.capture(), expected, 'Restore must not retain caller-owned objects');
  const exported = f.participant.capture();
  exported.cycles[1].baselineTick = -1;
  exported.journal.length = 0;
  assert.deepEqual(f.participant.capture(), expected, 'Capture must not expose mutable live objects');
  for (const foreign of [{...expected, version: 'foreign-version'}, {...expected, battleId: 'foreign-battle'}]) {
    assert.throws(() => f.participant.restore(foreign), /Foreign combined resource budget/);
    assert.deepEqual(f.participant.capture(), expected);
  }
});

test('real trial ultimate and class secondary cannot each spend a separate delay allowance', () => {
  const f = trialSetup({kind: 'ember_tactician'}), u = f.game.units[0];
  u.mana = 24;
  u.unitSkillReadyTick = f.game.tickCount;
  f.ult.beforeTick();
  assert.equal(f.ult.snapshot().actions.length, 1);
  assert.equal(u.mana, 14);
  assert.equal(f.ult.snapshot().resources.cycles[u.id].baselineTick, 380);
  f.step(42);
  f.ult.beforeTick();
  const mana = u.mana, secondReady = f.classes.states()[0].cooldowns.second;
  const isolated = planMageSecondary({tick: f.game.tickCount, mana: u.mana, maxMana: u.maxMana,
    manaRegen: u.manaRegen, primaryCost: u.skill.manaCost, primaryReadyTick: u.unitSkillReadyTick,
    secondaryCost: 12, occupancyTicks: 42, primaryTargetAvailable: true});
  assert.equal(isolated.allowed, true);
  assert.equal(isolated.additionalPrimaryDelayTicks, 240);
  f.classes.beforeTick();
  assert.equal(f.classes.journal().filter(x => x.phase === 'commit').length, 0);
  const held = f.classes.states()[0].secondaryPlan;
  assert.equal(held.reason, 'combined-primary-delay-limit');
  assert.equal(held.aggregateDelayTicks, 440);
  assert.equal(u.mana, mana);
  assert.equal(f.classes.states()[0].cooldowns.second, secondReady);
  assert.equal(f.ult.snapshot().resources.journal.filter(x => x.type === 'extra-paid').length, 1);
});

test('real primary clears its cycle only after a successful paid commit, never a failed attempt', () => {
  const f = trialSetup({kind: 'ember_tactician'}), g = f.game, u = g.units[0];
  deferClassSecondary(f);
  f.ult.beforeTick();
  const paidCycle = f.ult.resources.snapshot();
  assert.equal(paidCycle.cycles[u.id].extras.length, 1);
  u.unitSkillReadyTick = g.tickCount;
  f.classes.beforeTick();
  assert.deepEqual(f.ult.resources.snapshot(), paidCycle, 'Ultimate occupancy still owns the action');
  g.tickCount = 342;
  f.ult.beforeTick();
  u.mana = u.skill.manaCost - 1;
  f.classes.beforeTick();
  assert.deepEqual(f.ult.resources.snapshot(), paidCycle, 'Insufficient mana is not a primary commit');
  const positions = g.enemies.map(e => ({x: e.x, y: e.y}));
  g.tickCount = 343;
  u.mana = u.maxMana;
  g.enemies.forEach(e => { e.x = 900; e.y = 400; });
  f.classes.beforeTick();
  assert.deepEqual(f.ult.resources.snapshot(), paidCycle, 'No valid target is not a primary commit');
  g.tickCount = 344;
  g.enemies.forEach((e, i) => Object.assign(e, positions[i]));
  u.unitSkillReadyTick = 500;
  f.classes.beforeTick();
  assert.deepEqual(f.ult.resources.snapshot(), paidCycle, 'An unready primary cannot clear accounting');
  const originalCommitted = g.ultimatePrimaryCommitted, manaBefore = u.mana, spentBefore = u.stats.manaSpent;
  let hookCalls = 0;
  g.ultimatePrimaryCommitted = paid => {
    hookCalls++;
    assert.equal(paid.id, u.id);
    assert.equal(paid.mana, manaBefore - paid.skill.manaCost);
    assert.equal(paid.stats.manaSpent, spentBefore + paid.skill.manaCost);
    assert.ok(f.classes.journal().some(x => x.phase === 'commit' && x.skillId === paid.skill.id && x.paidMana === paid.skill.manaCost));
    originalCommitted(paid);
  };
  g.tickCount = 500;
  f.classes.beforeTick();
  assert.equal(hookCalls, 1);
  assert.equal(f.ult.resources.snapshot().cycles[u.id], undefined);
  assert.deepEqual(f.ult.resources.snapshot().journal.at(-1).previous, paidCycle.cycles[u.id]);
  assert.equal(u.unitSkillReadyTick, 500 + Math.ceil(u.skill.cooldown * 60));
  f.classes.beforeTick();
  assert.equal(hookCalls, 1, 'Repeated same-tick entry must not pay or reset again');
});

test('real protective ultimate can act when a funded ready primary has no target', () => {
  const f = trialSetup({kind: 'heat_warden'}), g = f.game, u = g.units[0];
  u.unitSkillReadyTick = g.tickCount;
  for (const e of g.enemies) { e.x = 600; e.y = 220; e.range = 500; }
  assert.ok(g.enemies.every(e => Math.hypot(e.x - u.x, e.y - u.y) > u.range + .01));
  const before = u.mana;
  f.ult.beforeTick();
  assert.equal(f.ult.snapshot().actions.length, 1, JSON.stringify(f.ult.snapshot().units));
  assert.equal(u.mana, before - 10);
  assert.equal(u.unitSkillReadyTick, 300);
  assert.equal(f.arbiter.owner(u.id, g.tickCount), 'ultimate');
  assert.equal(f.ult.snapshot().resources.journal[0].reason, 'combined-paid-weave');
});

for (const kind of ['ember_tactician', 'heat_warden', 'frost_weaver', 'frost_binder']) {
  test(`real ${kind} pays ten mana without cooldown resets or paid-spell/echo procs`, () => {
    const f = trialSetup({kind}), g = f.game, u = g.units[0];
    if (kind === 'heat_warden') for (const e of g.enemies) e.range = 200;
    g.relicEffects.echoRefund = .5;
    u.paidSpellCount = 2;
    const before = {mana: u.mana, cd: u.cd, primary: u.unitSkillReadyTick,
      second: copy(f.classes.states()[0].cooldowns), casts: u.stats.unitSkillCasts,
      refunded: u.stats.manaRefunded, careerRefunded: u.career.manaRefunded};
    f.ult.beforeTick();
    assert.equal(f.ult.snapshot().actions.length, 1);
    assert.equal(u.mana, before.mana - 10);
    assert.equal(u.stats.manaSpent, 10);
    assert.equal(u.career.manaSpent, 10);
    assert.equal(u.cd, before.cd);
    assert.equal(u.unitSkillReadyTick, before.primary);
    assert.deepEqual(f.classes.states()[0].cooldowns, before.second);
    f.step(165);
    assert.equal(f.ult.snapshot().actions[0].status, 'settled');
    close(u.mana, Math.min(u.maxMana, before.mana - 10 + 165 * u.manaRegen / 60));
    assert.equal(u.unitSkillReadyTick, before.primary);
    assert.deepEqual(f.classes.states()[0].cooldowns, before.second);
    assert.equal(u.paidSpellCount, 2);
    assert.equal(u.stats.unitSkillCasts, before.casts);
    assert.equal(u.stats.manaRefunded, before.refunded);
    assert.equal(u.career.manaRefunded, before.careerRefunded);
    assert.equal(u.stats.manaSpent, 10);
    assert.equal(f.ult.snapshot().resources.journal.filter(x => x.type === 'primary-paid').length, 0);
  });
}

test('real composite cold restore preserves the paid resource cycle and exact continuation', () => {
  const warm = trialSetup({kind: 'ember_tactician'});
  warm.ult.beforeTick();
  warm.step(30);
  const checkpoint = warm.ult.exportCheckpoint();
  const cold = trialSetup({kind: 'ember_tactician', store: createExactMemoryStore(checkpoint)});
  assert.deepEqual(cold.ult.resources.snapshot(), warm.ult.resources.snapshot());
  assert.deepEqual(captureGame(cold.game), captureGame(warm.game));
  warm.step(45);
  cold.step(45);
  assert.deepEqual(cold.ult.resources.snapshot(), warm.ult.resources.snapshot());
  assert.deepEqual(cold.ult.snapshot(), warm.ult.snapshot());
  assert.deepEqual(captureGame(cold.game), captureGame(warm.game));
});
