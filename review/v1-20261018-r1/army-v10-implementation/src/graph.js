import { createHash } from 'node:crypto';
import { TRIAL } from './config.js';
export function invariant(ok, message) { if (!ok) throw new Error(message); }
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}
export function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function normalizeSeed(seed) {
  invariant(typeof seed === 'string' || Number.isSafeInteger(seed), 'Seed must be a string or safe integer');
  const s = String(seed).normalize('NFC');
  invariant(s.length > 0 && s.length <= 128, 'Seed length must be 1..128');
  return s;
}
const pick = (seed, chapter, key, n) => Number(BigInt('0x' + digest([TRIAL.generatorVersion, seed, chapter, key])) % BigInt(n));
export const isBattle = node => ['normal', 'elite', 'boss'].includes(node.kind);
export function generateChapter(seed, chapter) {
  seed = normalizeSeed(seed);
  invariant(Number.isInteger(chapter) && chapter >= 1 && chapter <= TRIAL.chapters, 'Invalid chapter');
  const nodes = {}, layers = [];
  for (let row = 1; row <= 6; row++) {
    const layer = [];
    for (let lane = 0, width = 2 + pick(seed, chapter, ['width', row], 2); lane < width; lane++) {
      const id = `b${row}.${lane}`;
      const kind = lane === 0 || pick(seed, chapter, ['kind', row, lane], 3) ? 'normal' : 'elite';
      nodes[id] = { id, row, lane, kind, xp: TRIAL.xpByBattle[row - 1], edges: [],
        encounterRef: `trial-ch${chapter}-${kind}-${pick(seed, chapter, ['encounter', id], 4)}` };
      layer.push(id);
    }
    layers.push(layer);
  }
  nodes.boss = { id: 'boss', row: 7, lane: 0, kind: 'boss', xp: TRIAL.xpByBattle[6], edges: [], encounterRef: `trial-ch${chapter}-boss` };
  layers.push(['boss']);
  for (let i = 0; i < 6; i++) {
    const current = layers[i], next = layers[i + 1];
    for (const src of current) {
      const lane = nodes[src].lane;
      const targets = new Set([next[Math.min(lane, next.length - 1)]]);
      for (const dst of next) if (Math.abs(lane - nodes[dst].lane) <= 1 && pick(seed, chapter, ['edge', src, dst], 2)) targets.add(dst);
      nodes[src].edges = [...targets].sort();
    }
    for (const dst of next) if (!current.some(src => nodes[src].edges.includes(dst))) {
      nodes[current[Math.min(nodes[dst].lane, current.length - 1)]].edges.push(dst);
    }
    for (const src of current) nodes[src].edges.sort();
    if ([2, 4].includes(i + 1)) {
      const row = i + 1, src = current[pick(seed, chapter, ['service-source', row], current.length)];
      const id = `s${row}`;
      const kind = chapter === 3 && row === 2 ? 'target_shop' : ['shop', 'event', 'forge', 'rest'][pick(seed, chapter, ['service-kind', row], 4)];
      nodes[id] = { id, row: row + 0.5, lane: nodes[src].lane, kind, xp: 0, edges: [...nodes[src].edges],
        serviceRef: `trial-ch${chapter}-${id}-${kind}`, effectContract: kind === 'rest' ? 'optional-recovery-with-visible-cost' : 'optional-explicit-choice-no-auto-effect' };
      nodes[src].edges.push(id); nodes[src].edges.sort();
    }
  }
  return { generatorVersion: TRIAL.generatorVersion, rulesVersion: TRIAL.rulesVersion, configVersion: TRIAL.configVersion,
    seed, chapter, starts: layers[0], bossPreview: { encounterRef: nodes.boss.encounterRef, riskRef: `trial-ch${chapter}-boss-risk` }, nodes };
}
export function validateGraph(graph) {
  invariant(graph && graph.generatorVersion === TRIAL.generatorVersion && graph.rulesVersion === TRIAL.rulesVersion && graph.configVersion === TRIAL.configVersion, 'Unsupported graph version');
  invariant(canonical(graph) === canonical(generateChapter(graph.seed, graph.chapter)), 'Graph differs from registered seeded generator');
  const nodes = graph.nodes, order = Object.keys(nodes).sort((a, b) => nodes[a].row - nodes[b].row);
  invariant(order.length <= 21 && order.filter(id => nodes[id].kind === 'boss').length === 1, 'Node bound/boss');
  const reachable = new Set(graph.starts), dp = {};
  for (const id of order) {
    const n = nodes[id];
    invariant(reachable.has(id), 'Orphan node');
    invariant(n.edges.length > 0 || id === 'boss', 'Dead end');
    for (const dst of n.edges) {
      invariant(nodes[dst] && nodes[dst].row > n.row, 'Cycle/dangling edge');
      invariant(isBattle(n) ? [n.row + 0.5, n.row + 1].includes(nodes[dst].row) : nodes[dst].row === Math.floor(n.row) + 1, 'Skipped battle layer');
      reachable.add(dst);
    }
  }
  for (const id of [...order].reverse()) {
    const n = nodes[id], combat = +isBattle(n), service = 1 - combat, tails = n.edges.map(d => dp[d]);
    dp[id] = tails.length ? { minBattles: combat + Math.min(...tails.map(t => t.minBattles)), maxBattles: combat + Math.max(...tails.map(t => t.maxBattles)),
      minXP: n.xp + Math.min(...tails.map(t => t.minXP)), maxXP: n.xp + Math.max(...tails.map(t => t.maxXP)),
      maxServices: service + Math.max(...tails.map(t => t.maxServices)), paths: tails.reduce((sum, t) => sum + t.paths, 0) }
      : { minBattles: combat, maxBattles: combat, minXP: n.xp, maxXP: n.xp, maxServices: service, paths: 1 };
  }
  const starts = graph.starts.map(id => dp[id]);
  invariant(starts.every(d => d.minBattles === 7 && d.maxBattles === 7 && d.minXP === 10 && d.maxXP === 10 && d.maxServices <= 2), 'All-route invariant failed');
  for (let row = 1; row <= 6; row++) {
    invariant(['b' + (row + 1) + '.0', 'boss'].some(dst => nodes[`b${row}.0`].edges.includes(dst)), 'No zero-elite safe route');
    invariant(nodes[`b${row}.0`].kind === 'normal', 'Safe route elite');
    invariant([2, 3].includes(order.filter(id => nodes[id].row === row).length), 'Width');
  }
  return { paths: starts.reduce((sum, d) => sum + d.paths, 0), minBattles: 7, maxBattles: 7, xp: 10, maxServices: Math.max(...starts.map(d => d.maxServices)) };
}
export function validatePathPrefix(graph, path) {
  invariant(Array.isArray(path) && path.length <= 9 && new Set(path).size === path.length, 'Duplicate/oversize path');
  invariant(path.every(id => typeof id === 'string' && Object.hasOwn(graph.nodes, id)), 'Unknown path node');
  invariant(!path.length || graph.starts.includes(path[0]), 'Invalid path start');
  for (let i = 1; i < path.length; i++) invariant(graph.nodes[path[i - 1]].edges.includes(path[i]), 'Invalid path edge');
  return true;
}
