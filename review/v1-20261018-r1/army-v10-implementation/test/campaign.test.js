import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign, transition, exportCampaign, importCampaign, validateCampaign, availableNodes, summary } from '../src/campaign.js';
import { generateChapter, digest, validateGraph, normalizeSeed } from '../src/graph.js';
import { TRIAL } from '../src/config.js';
const copy = v => JSON.parse(JSON.stringify(v));
function checkRoundTrip(c) { assert.deepEqual(importCampaign(exportCampaign(c)), c); }
function step(c, action) { const old = JSON.stringify(c); const next = transition(c, action); assert.equal(JSON.stringify(c), old); checkRoundTrip(next); return next; }
function win(c) {
  c = step(c, { type: 'startBattle', battleId: c.state.pendingBattle.battleId });
  return step(c, { type: 'recordBattleResult', battleId: c.state.pendingBattle.battleId, receiptId: `ASSUMED-WIN-${c.state.battleCount + 1}`, outcome: 'win' });
}
test('35 supplied assumed-win receipts, 34 explicitly skipped rewards, chapter4 gate and final settlement boundary', () => {
  let c = createCampaign('full-traverse', 'test-assumed-wins'); checkRoundTrip(c);
  const unlocked = {}, gateCounts = {};
  while (!['settlement', 'defeat'].includes(c.state.phase)) {
    const s = c.state;
    if (s.phase === 'map') {
      const n = availableNodes(c).find(n => n.lane === 0 && ['normal', 'boss'].includes(n.kind));
      assert.ok(n); c = step(c, { type: 'selectNode', nodeId: n.id });
    } else if (s.phase === 'prepare') c = win(c);
    else if (s.phase === 'reward') {
      if (s.pendingReward.reservedSlot) gateCounts[s.battleCount] = s.pendingReward.reservedSlot;
      assert.equal(s.pendingReward.selectionBudget, 1);
      assert.throws(() => transition(c, { type: 'selectNode', nodeId: 'boss' }));
      c = step(c, { type: 'skipReward', opportunityId: s.pendingReward.id });
    } else if (s.phase === 'awakening') {
      assert.equal(s.battleCount, 21); assert.equal(s.chapter, 4); assert.equal(availableNodes(c).length, 0);
      c = step(c, { type: 'skipAwakening' });
      assert.throws(() => transition(c, { type: 'skipAwakening' }));
    } else assert.fail(`Unexpected phase ${s.phase}`);
    const cap = summary(c).deploymentCap; unlocked[cap] ??= c.state.battleCount + 1;
  }
  assert.equal(c.state.battleCount, 35); assert.equal(c.state.xp, 50); assert.equal(c.state.rewardLedger.length, 34);
  assert.equal(c.state.awakeningLedger.length, 1); assert.equal(c.state.pendingReward, null);
  assert.deepEqual(unlocked, { 6: 1, 7: 3, 8: 7, 9: 9 });
  assert.deepEqual(Object.keys(gateCounts), ['2', '5', '8', '21']);
  assert.equal(c.state.finalResult.settlementApplied, false);
  assert.equal(c.state.completed.flat().length, 35);
  assert.throws(() => transition(c, { type: 'recordBattleResult', battleId: 'test-assumed-wins:c5:boss', receiptId: 'again', outcome: 'win' }));
  checkRoundTrip(c);
});
test('defeat, checkpoint retry, duplicate receipt and unsupported effects do not fabricate rewards', () => {
  let c = createCampaign(12, 'loss');
  c = step(c, { type: 'selectNode', nodeId: 'b1.0' });
  const pending = copy(c.state.pendingBattle);
  c = step(c, { type: 'startBattle', battleId: pending.battleId });
  const loaded = importCampaign(exportCampaign(c)); assert.equal(loaded.state.phase, 'battle');
  c = step(loaded, { type: 'retryBattleCheckpoint', battleId: pending.battleId });
  assert.deepEqual(c.state.pendingBattle, pending);
  c = step(c, { type: 'startBattle', battleId: pending.battleId });
  c = step(c, { type: 'recordBattleResult', battleId: pending.battleId, receiptId: 'actual-adapter-receipt', outcome: 'defeat' });
  assert.equal(c.state.phase, 'defeat'); assert.equal(c.state.xp, 0); assert.equal(c.state.battleCount, 0);
  assert.equal(c.state.rewardLedger.length, 0); assert.deepEqual(c.state.completed[0], []);
  assert.throws(() => transition(c, { type: 'selectNode', nodeId: 'b2.0' }));
});
test('optional services preserve free direct edge, visit no XP and no fabricated service benefit', () => {
  let c = createCampaign(32, 'service');
  const g = c.graphs[0];
  const source = Object.values(g.nodes).find(n => n.edges.includes('s2'));
  const start = g.starts.find(id => g.nodes[id].edges.includes(source.id));
  for (const nodeId of [start, source.id]) {
    c = step(c, { type: 'selectNode', nodeId }); c = win(c);
    c = step(c, { type: 'skipReward', opportunityId: c.state.pendingReward.id });
  }
  assert.ok(availableNodes(c).some(n => n.row === 3));
  const xp = c.state.xp, battles = c.state.battleCount;
  c = step(c, { type: 'selectNode', nodeId: 's2' });
  assert.throws(() => transition(c, { type: 'purchase', itemId: 'invented' }));
  c = step(c, { type: 'leaveService', serviceId: c.state.pendingService.id });
  assert.equal(c.state.xp, xp); assert.equal(c.state.battleCount, battles);
  assert.equal(c.state.serviceLedger[0].effectsImplemented, false);
  assert.ok(availableNodes(c).every(n => n.row === 3));
});
test('reject tampered versions, hashes, graphs, phases, receipts, paths, ledgers and legacy saves without mutations', () => {
  let c = createCampaign('invalid-tests', 'invalid-tests');
  c = step(c, { type: 'selectNode', nodeId: 'b1.0' }); c = win(c);
  const mutators = [
    s => s.schemaVersion = 3, s => s.rulesVersion = 'v09-campaign-1', s => s.generatorVersion = 'future',
    s => s.configVersion = 'release', s => s.seed = 'other', s => s.graphHashes[0] = 'bad',
    s => s.graphs[0].nodes['b1.0'].edges.push('boss'), s => s.graphs[0].chapter = 2,
    s => s.state.xp++, s => s.state.phase = 'map', s => s.state.completed[0].push('boss'),
    s => s.state.visited[0].push('b1.0'), s => s.state.xpLedger = [], s => s.state.pendingReward = null,
    s => s.actions.push(s.actions.at(-1)), s => s.state.battleReceipts[0].receiptId = 'forged',
    s => s.state.awakeningLedger.push({ decision: 'granted' }), s => s.unknown = true,
  ];
  for (const mutate of mutators) { const bad = copy(c); mutate(bad); const before = JSON.stringify(bad); assert.throws(() => validateCampaign(bad)); assert.equal(JSON.stringify(bad), before); }
  const legacy = { schemaVersion: 3, campaignRulesVersion: 'v09-campaign-1', chapter: 2, profile: { tokens: 99 } };
  const raw = JSON.stringify(legacy); assert.throws(() => importCampaign(raw)); assert.equal(JSON.stringify(legacy), raw);
  assert.throws(() => importCampaign('{"__proto__":{}}'));
  assert.throws(() => importCampaign(' '.repeat(TRIAL.maxSaveBytes + 1)));
  assert.throws(() => importCampaign('{'));
  assert.throws(() => transition(c, { type: 'skipReward', opportunityId: 'wrong' }));
});
test('seed normalization and stable hash fixture', () => {
  assert.equal(normalizeSeed('e\u0301'), 'é');
  assert.deepEqual(generateChapter(7, 1), generateChapter('7', 1));
  assert.notEqual(digest(generateChapter(7, 1)), digest(generateChapter(8, 1)));
  assert.throws(() => generateChapter(1, 6)); assert.throws(() => generateChapter(NaN, 1));
  assert.throws(() => normalizeSeed({})); assert.throws(() => normalizeSeed(''));
  assert.equal(validateGraph(generateChapter('fixture', 1)).minBattles, 7);
  assert.equal(digest(generateChapter('fixture', 1)), '548b071ff33027d727004150fdd5d33e684cc75d68daefdb3e86107a8897d2cb');
});
test('reused receipt on another battle and stale reward claims are rejected without mutating state', () => {
  let c = createCampaign(19, 'duplicate');
  c = step(c, { type: 'selectNode', nodeId: 'b1.0' }); c = win(c);
  const oldReward = c.state.pendingReward.id;
  c = step(c, { type: 'skipReward', opportunityId: oldReward });
  c = step(c, { type: 'selectNode', nodeId: 'b2.0' });
  c = step(c, { type: 'startBattle', battleId: c.state.pendingBattle.battleId });
  const before = exportCampaign(c);
  assert.throws(() => transition(c, { type: 'recordBattleResult', battleId: c.state.pendingBattle.battleId, receiptId: 'ASSUMED-WIN-1', outcome: 'win' }), /Duplicate/);
  assert.equal(exportCampaign(c), before);
  c = step(c, { type: 'recordBattleResult', battleId: c.state.pendingBattle.battleId, receiptId: 'unique-second', outcome: 'win' });
  assert.throws(() => transition(c, { type: 'skipReward', opportunityId: oldReward }));
  assert.throws(() => transition(c, { type: 'claimReward', opportunityId: c.state.pendingReward.id }));
});
