'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/game-ui-art.js'), 'utf8'), sandbox);
const ui = sandbox.TinyArmyUIArt;
const art = require('../src/game-art.js');
const roles = ['spear', 'guardian', 'charger', 'archer', 'sniper', 'volley', 'support'];
function recording() {
  const calls = [], paths = [];
  let current = [], depth = 0;
  const ctx = {globalAlpha: 1};
  for (const method of ['save','restore','translate','scale','rotate','beginPath','moveTo','lineTo','closePath','fill','stroke','ellipse','arc','quadraticCurveTo','fillRect','strokeRect']) {
    ctx[method] = (...args) => {
      for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), method + ' has finite coordinates');
      calls.push([method, ...args]);
      if (method === 'save') depth++;
      if (method === 'restore') { depth--; assert(depth >= 0); }
      if (method === 'beginPath') { current = []; paths.push(current); }
      if (method === 'moveTo' || method === 'lineTo') current.push(args);
    };
  }
  return {ctx, calls, paths, balanced: () => assert.equal(depth, 0)};
}
assert(Object.isFrozen(ui));
assert(Object.isFrozen(art));
for (const role of roles) {
  const svg = ui.portrait(role);
  assert.match(svg, /viewBox="0 0 64 64"/);
  assert.match(svg, /aria-hidden="true"/);
  assert(!/<(?:script|image|foreignObject|animate)|\son\w+=|\sid=|https?:\/\/(?!www.w3.org)/.test(svg));
  assert.equal(svg, ui.portrait(role));
  for (const reducedMotion of [false, true]) for (const action of [0, .1, .3, .5, .7, .9, 1]) {
    const r = recording();
    art.drawUnit(r.ctx, {type:role, x:100, y:100, anchor:'feet', facing:-1, moving:true, phase:1.3, attack:action, block:action, hit:action, reducedMotion, actionKind:role==='support'?'heal':'attack'});
    r.balanced();
    assert(r.calls.some(c => c[0] === 'translate' && c[1] === 0 && c[2] === -14), 'feet anchor retained');
    assert(r.calls.some(c => c[0] === 'scale' && c[1] === -1 && c[2] === 1), 'facing retained');
  }
}
assert.equal(ui.portrait('unknown'), ui.portrait('spear'));
assert.notEqual(ui.portrait('armored'), ui.portrait('guardian'), 'enemy portrait wrapper retained');
// Check actual Canvas geometry and its static portrait agree on defining outlines.
for (const [role, points] of [
  ['guardian',[[-3,-8],[7,-11],[18,-7],[19,5],[10,15],[-2,10]]],
  ['sniper',[[-7,-5],[-16,10],[-8,9],[-3,12],[4,9],[4,-2]]],
  ['sniper',[[-3,1],[2,4],[9,-1]]],
  ['support',[[1,3],[10,3],[11,11],[0,11]]],
  ['volley',[[11,-3.25],[26,-6]]],
  ['volley',[[11,-1],[26,-1]]],
  ['volley',[[11,1.25],[26,4]]]
]) {
  const r = recording();
  art.drawUnit(r.ctx, {type:role, phase:0, shadow:false});
  assert(r.paths.some(p => JSON.stringify(p) === JSON.stringify(points)), role + ' Canvas role geometry');
  const d = points.map((p,i) => (i?'L':'M') + p.join(' ')).join('');
  assert(ui.portrait(role).includes('d="'+d), role + ' SVG role geometry');
}
for (const role of ['sniper','volley']) assert(ui.portrait(role).includes('translate(24 57) scale(1.2 1.2)'), 'ranged tips have safe portrait margins');
for (const role of ['charger','support']) assert(ui.portrait(role).includes('translate(27 57) scale(1.2 1.2)'), 'crest and banner have safe portrait margins');
console.log('v07-unit-art: seven safe deterministic SVGs, Canvas/SVG role parity, finite action frames, facing and feet anchors passed');
