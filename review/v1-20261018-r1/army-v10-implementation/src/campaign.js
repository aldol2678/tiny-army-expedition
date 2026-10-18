import { TRIAL, deploymentCap } from './config.js';
import { canonical, digest, generateChapter, invariant, isBattle, normalizeSeed, validateGraph, validatePathPrefix } from './graph.js';

const clone = value => JSON.parse(JSON.stringify(value));
function id(value) { return typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value); }
function exactKeys(value, keys) { invariant(value && typeof value === 'object' && !Array.isArray(value) && canonical(Object.keys(value).sort()) === canonical([...keys].sort()), 'Invalid action fields'); }
function assertKeys(action, keys) { exactKeys(action, ['type', ...keys]); }
export function createCampaign(seed, runId) {
  invariant(id(runId), 'Explicit unique runId required (not a gameplay seed)');
  seed = normalizeSeed(seed);
  const graphs = Array.from({ length: 5 }, (_, i) => generateChapter(seed, i + 1));
  return { schemaVersion: TRIAL.schemaVersion, rulesVersion: TRIAL.rulesVersion, generatorVersion: TRIAL.generatorVersion,
    configVersion: TRIAL.configVersion, scope: 'ISOLATED_TRIAL_NO_COMBAT_ENGINE', seed, runId,
    graphs, graphHashes: graphs.map(digest), actions: [], state: initialState() };
}
function initialState() {
  return { chapter: 1, phase: 'map', visited: [[], [], [], [], []], completed: [[], [], [], [], []], currentNode: null,
    battleCount: 0, xp: 0, xpLedger: [], battleReceipts: [], rewardLedger: [], serviceLedger: [], awakeningLedger: [],
    pendingReward: null, pendingBattle: null, pendingService: null, finalResult: null };
}
export function campaignStage(campaign) {
  const chapter = campaign.state.chapter;
  return chapter <= 2 ? 'build-foundations' : chapter === 3 ? 'collect-relics' : chapter === 4 ? 'awakening-opportunity' : 'use-build';
}
export function availableNodes(campaign) {
  const s = campaign.state;
  if (s.phase !== 'map') return [];
  const g = campaign.graphs[s.chapter - 1], path = s.completed[s.chapter - 1];
  const ids = path.length ? g.nodes[path.at(-1)].edges : g.starts;
  return ids.map(nodeId => clone(g.nodes[nodeId]));
}
function afterNode(campaign) {
  const s = campaign.state, node = campaign.graphs[s.chapter - 1].nodes[s.currentNode];
  s.currentNode = null;
  if (node.kind !== 'boss') { s.phase = 'map'; return; }
  if (s.chapter === 5) { s.phase = 'settlement'; s.finalResult = { outcome: 'victory', battleCount: 35, settlementApplied: false }; return; }
  s.chapter++;
  s.phase = s.chapter === 4 ? 'awakening' : 'map';
}
function rewardOpportunity(campaign, node) {
  const s = campaign.state, total = s.battleCount;
  return { id: `${campaign.runId}:reward:${total}`, battleNumber: total, chapter: s.chapter, nodeId: node.id, selectionBudget: 1,
    reservedSlot: ({ 2: 'evolution-if-eligible', 5: 'training-I-if-eligible', 8: 'training-II-or-second-stage-if-eligible', 21: 'unowned-target-relic-if-eligible' })[total] || null,
    contentStatus: 'REQUIRES_ELIGIBILITY_AND_REWARD_ADAPTER' };
}
function apply(campaign, action) {
  const s = campaign.state, g = campaign.graphs[s.chapter - 1];
  invariant(action && typeof action.type === 'string', 'Invalid action');
  switch (action.type) {
    case 'selectNode': {
      assertKeys(action, ['nodeId']);
      invariant(s.phase === 'map' && availableNodes(campaign).some(n => n.id === action.nodeId), 'Node unavailable in this phase/path');
      const n = g.nodes[action.nodeId];
      s.currentNode = n.id; s.visited[s.chapter - 1].push(n.id);
      if (isBattle(n)) {
        s.phase = 'prepare';
        s.pendingBattle = { battleId: `${campaign.runId}:c${s.chapter}:${n.id}`, nodeId: n.id,
          encounterRef: n.encounterRef, battleSeed: digest(['combat-seed-trial-1', campaign.seed, s.chapter, n.id]) };
      } else {
        s.phase = 'service'; s.pendingService = { id: `${campaign.runId}:c${s.chapter}:${n.id}`, kind: n.kind, serviceRef: n.serviceRef, effectsImplemented: false };
      }
      break;
    }
    case 'startBattle':
      assertKeys(action, ['battleId']);
      invariant(s.phase === 'prepare' && action.battleId === s.pendingBattle.battleId, 'Battle mismatch');
      s.phase = 'battle'; break;
    case 'recordBattleResult': {
      assertKeys(action, ['battleId', 'receiptId', 'outcome']);
      invariant(s.phase === 'battle' && action.battleId === s.pendingBattle.battleId, 'No matching active battle');
      invariant(id(action.receiptId) && !s.battleReceipts.some(r => r.receiptId === action.receiptId), 'Duplicate/invalid result receipt');
      invariant(['win', 'defeat'].includes(action.outcome), 'Invalid battle outcome');
      s.battleReceipts.push({ ...action });
      s.pendingBattle = null;
      if (action.outcome === 'defeat') {
        s.phase = 'defeat'; s.finalResult = { outcome: 'defeat', battleCount: s.battleCount, settlementApplied: false }; break;
      }
      const node = g.nodes[s.currentNode];
      s.completed[s.chapter - 1].push(node.id); s.battleCount++; s.xp += node.xp;
      s.xpLedger.push({ battleId: action.battleId, receiptId: action.receiptId, amount: node.xp });
      if (s.battleCount === 35) afterNode(campaign);
      else { s.pendingReward = rewardOpportunity(campaign, node); s.phase = 'reward'; }
      break;
    }
    case 'skipReward':
      assertKeys(action, ['opportunityId']);
      invariant(s.phase === 'reward' && action.opportunityId === s.pendingReward.id, 'No matching reward opportunity');
      s.rewardLedger.push({ ...s.pendingReward, decision: 'skipped' });
      s.pendingReward = null; afterNode(campaign); break;
    case 'leaveService':
      assertKeys(action, ['serviceId']);
      invariant(s.phase === 'service' && action.serviceId === s.pendingService.id, 'No matching service');
      s.serviceLedger.push({ ...s.pendingService, decision: 'left-without-effect' });
      s.completed[s.chapter - 1].push(s.currentNode); s.pendingService = null; afterNode(campaign); break;
    case 'skipAwakening':
      assertKeys(action, []);
      invariant(s.phase === 'awakening' && s.chapter === 4 && s.awakeningLedger.length === 0, 'No awakening opportunity');
      s.awakeningLedger.push({ opportunityId: `${campaign.runId}:chapter4-entry`, decision: 'skipped', grantedUnits: [] });
      s.phase = 'map'; break;
    case 'retryBattleCheckpoint':
      assertKeys(action, ['battleId']);
      invariant(s.phase === 'battle' && action.battleId === s.pendingBattle.battleId, 'No battle checkpoint');
      s.phase = 'prepare'; break;
    default: throw new Error('Unsupported action: actual rewards/services/awakening/settlement require integration adapters');
  }
  for (let c = 0; c < 5; c++) {
    validatePathPrefix(campaign.graphs[c], s.visited[c]);
    invariant(canonical(s.completed[c]) === canonical(s.visited[c].slice(0, s.completed[c].length)), 'Completed path must be a visited prefix');
  }
}
// Pure copy-on-write. Rejected actions leave the caller's object unchanged.
// The caller, NOT this module, verifies external battle receipts and persists atomically.
export function transition(campaign, action) {
  validateCampaign(campaign);
  invariant(campaign.actions.length < TRIAL.maxActions, 'Action log limit');
  const next = clone(campaign); apply(next, clone(action)); next.actions.push(clone(action));
  return next;
}
export function validateCampaign(campaign) {
  exactKeys(campaign, ['schemaVersion', 'rulesVersion', 'generatorVersion', 'configVersion', 'scope', 'seed', 'runId', 'graphs', 'graphHashes', 'actions', 'state']);
  invariant(campaign.schemaVersion === TRIAL.schemaVersion && campaign.rulesVersion === TRIAL.rulesVersion && campaign.generatorVersion === TRIAL.generatorVersion && campaign.configVersion === TRIAL.configVersion && campaign.scope === 'ISOLATED_TRIAL_NO_COMBAT_ENGINE', 'Unsupported/legacy save: original must be preserved');
  invariant(id(campaign.runId) && normalizeSeed(campaign.seed) === campaign.seed, 'Invalid seed/run ID');
  invariant(Array.isArray(campaign.graphs) && campaign.graphs.length === 5 && Array.isArray(campaign.graphHashes) && campaign.graphHashes.length === 5, 'Missing saved graphs/hashes');
  campaign.graphs.forEach((g, i) => {
    invariant(g.seed === campaign.seed && g.chapter === i + 1, 'Graph seed/chapter mismatch');
    validateGraph(g); invariant(digest(g) === campaign.graphHashes[i], 'Graph hash mismatch');
  });
  invariant(Array.isArray(campaign.actions) && campaign.actions.length <= TRIAL.maxActions, 'Invalid action log');
  const replay = { ...campaign, state: initialState() };
  for (const action of campaign.actions) apply(replay, action);
  invariant(canonical(replay.state) === canonical(campaign.state), 'State/ledger/phase differs from validated event replay');
  return true;
}
export function exportCampaign(campaign) { validateCampaign(campaign); return canonical(campaign); }
export function importCampaign(raw) {
  invariant(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= TRIAL.maxSaveBytes, 'Invalid/oversize save');
  const data = JSON.parse(raw, (key, value) => {
    invariant(!['__proto__', 'constructor', 'prototype'].includes(key), 'Unsafe object key');
    return value;
  });
  validateCampaign(data); return data;
}
export function summary(campaign) {
  return { chapter: campaign.state.chapter, phase: campaign.state.phase, stage: campaignStage(campaign),
    battles: campaign.state.battleCount, xp: campaign.state.xp, deploymentCap: deploymentCap(campaign.state.xp),
    rewardsResolved: campaign.state.rewardLedger.length, settlementApplied: false };
}
