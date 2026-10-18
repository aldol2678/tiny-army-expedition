'use strict';
const assert = require('node:assert/strict');
const A = require('../src/condition-art.js');
assert(Object.isFrozen(A));
for (const [value, key] of [[0,'exhausted'],[24,'exhausted'],[24.99,'exhausted'],[25,'tired'],[49,'tired'],[49.99,'tired'],[50,'fair'],[74,'fair'],[74.99,'fair'],[75,'good'],[100,'good']]) {
  assert.equal(A.bandFor(value).key,key);
  const html = A.markup(value);
  assert.equal((html.match(/role="meter"/g)||[]).length,1);
  assert(html.includes('aria-valuenow="'+value+'"'));
  assert(html.includes('aria-valuemax="100"'));
  assert(html.includes('표시 등급'));
  assert(html.includes('aria-hidden="true"'));
  assert(html.includes(A.bandFor(value).label));
}
for (const [value, expected] of [[NaN,0],[undefined,0],['oops',0],[-50,0],[Infinity,100],[-Infinity,0],[135,100],['75',75],[Symbol(),0]]) assert.equal(A.normalize(value),expected);
const hostile = '<img src=x onerror="alert(1)">&\'",';
const escaped = A.markup(72,{label:hostile});
assert(!escaped.includes('<img'));
assert(escaped.includes('&lt;img'));
assert(escaped.includes('&quot;'));
assert(escaped.includes('&#39;'));
assert(!/\sid=|url\(|<filter|<animate|<script|<image/.test(escaped));
const many = Array.from({length:100},(_,i)=>A.markup(i,{compact:true})).join('');
assert.equal((many.match(/role="meter"/g)||[]).length,100);
assert(!/\sid=/.test(many),'ID-free SVGs cannot collide');
assert.equal(A.markup(75),A.markup(75),'pure deterministic output');
assert(A.markup(50,{compact:true}).includes('is-compact'));
assert(!A.markup(50,{showLabel:false}).includes('class="ta-condition__label"'));
for (const compact of [false, true]) {
  const trackWidth = compact ? 114 : 194;
  for (const value of [0, 12.5, 24.99, 25, 49.99, 50, 74.99, 75, 79.71428571428571, 100]) {
    const svg = A.svg(value, {compact});
    const fills = [...svg.matchAll(/<rect class="ta-condition__fill"[^>]*>/g)];
    assert.equal(fills.length, value > 0 ? 1 : 0, 'one continuous fill, empty at zero');
    if (value > 0) {
      assert(fills[0][0].includes('width="' + (value / 100 * trackWidth).toFixed(3) + '"'));
      assert(fills[0][0].includes('fill="' + A.bandFor(value).color + '"'));
    }
    assert.equal((svg.match(/class="ta-condition__tick"/g) || []).length, 3);
    for (const tick of [25, 50, 75]) assert(svg.includes('data-tick="' + tick + '"'));
    if (value >= 75) {
      for (const oldBand of A.bands.slice(0, 3)) assert(!svg.includes(oldBand.color), 'high condition must not contain red/orange/gold fill');
    }
  }
}
for (const mark of [0, 25, 50, 75, 100]) assert(A.svg(50).includes('>' + mark + '</text>'));
assert(!A.svg(50, {compact:true}).includes('<text'), 'compact artwork does not duplicate caption numbers');
const noCaption = A.markup(79.75, {compact:true, showCaption:false});
assert(!noCaption.includes('ta-condition__caption'));
assert(noCaption.includes('aria-valuenow="79.75"'));
assert(noCaption.includes('aria-valuetext="컨디션 79.8/100 · 양호 (표시 등급)"'));
assert.equal((noCaption.match(/role="meter"/g)||[]).length, 1);
assert(!A.markup(50, {showValue:false}).includes('class="ta-condition__value"'));
assert(!A.markup(50, {showState:false}).includes('class="ta-condition__band"'));
assert(!A.markup(50, {showLabel:false, showValue:false, showState:false}).includes('ta-condition__caption'));
const fractional = A.markup(558 / 7);
assert(fractional.includes('class="ta-condition__value">79.7/100</span>'));
assert(fractional.includes('aria-valuenow="' + (558 / 7) + '"'));
assert(A.markup(74.99).includes('class="ta-condition__value">75/100</span>'));
assert(A.markup(74.99).includes('data-condition-band="fair"'));
assert(A.markup(75).includes('class="ta-condition__value">75/100</span>'));
assert(!A.markup(75).includes('75.0/100'));
console.log('condition-art: boundaries, semantics, clamping, escaping, continuous current-band fill, ticks, caption options, deterministic ID-free artwork passed');
