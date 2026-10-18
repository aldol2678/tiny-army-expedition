// Structural proof, not combat simulation. No game or production save imports.
import assert from 'node:assert/strict';
import { generateChapter, digest, validateGraph, validatePathPrefix } from '../src/graph.js';
let graphs = 0, prefixes = 0, paths = 0;
const topologies = new Set();
for (let seed = 0; seed < 1000; seed++) for (let chapter = 1; chapter <= 5; chapter++) {
  const g = generateChapter(seed, chapter);
  assert.deepEqual(g, generateChapter(seed, chapter));
  assert.equal(digest(g), digest(generateChapter(seed, chapter)));
  paths += validateGraph(g).paths; graphs++;
  topologies.add(digest(Object.fromEntries(Object.entries(g.nodes).map(([id, n]) => [id, n.edges]))));
  const prefix = Object.fromEntries(g.starts.map(id => [id, [id]]));
  for (const start of g.starts) { validatePathPrefix(g, [start]); prefixes++; }
  for (const id of Object.keys(g.nodes).sort((a, b) => g.nodes[a].row - g.nodes[b].row)) {
    for (const dst of g.nodes[id].edges) {
      const path = [...prefix[id], dst]; validatePathPrefix(g, path); prefixes++; prefix[dst] ??= path;
    }
  }
  for (let length = 0; length <= 7; length++) {
    validatePathPrefix(g, ['b1.0', 'b2.0', 'b3.0', 'b4.0', 'b5.0', 'b6.0', 'boss'].slice(0, length)); prefixes++;
  }
  for (const invalid of [['b1.0', 'boss'], ['b1.0', 'b1.0'], ['s2'], ['missing']]) assert.throws(() => validatePathPrefix(g, invalid));
}
assert.ok(topologies.size > 1000);
console.log(JSON.stringify({ status: 'PASS', seeds: 1000, graphs, allRoutesProvenByDAG: paths, validGraphPathPrefixes: prefixes,
  distinctTopologies: topologies.size, battlesPerChapter: 7, minimumCampaignBattles: 35,
  scope: 'ISOLATED_STRUCTURAL_PROOF', combatSimulation: false, productionSaveMigration: false }, null, 2));
