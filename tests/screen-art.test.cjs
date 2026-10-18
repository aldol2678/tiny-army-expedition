'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../src/screen-art.js');
assert.equal(A.version,'0.5.1');
assert(Object.isFrozen(A));
assert(Object.isFrozen(A.palette));
const samples = [
  ...A.iconNames.map(name => [name,A.icon(name,48)]),
  ...A.markerTypes.map(name => [name,A.marker(name,96)]),
  ...['available','current','locked','complete'].map(state => [state,A.marker('boss',96,{state})]),
  ...[1,2,'map','camp','reward','shop','rest','prepare','army','complete','defeat','event'].map(name => [name,A.backdrop(name)]),
  ...['army','camp','rest','shop','reward','complete','defeat','event','prepare'].map(name => [name,A.banner(name,240)]),
  ...['spear','guardian','charger','archer','sniper','volley','support'].map(name => [name,A.insignia(name,64)])
];
for(const [name,xml] of samples) {
  assert(xml.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'),name);
  assert(xml.endsWith('</svg>'),name);
  assert(xml.includes('aria-hidden="true"'),name);
  assert(xml.includes('focusable="false"'),name);
  assert(!/<(?:script|image|foreignObject|use)\b|\b(?:href|id)=|url\(|NaN|undefined|Infinity|onload=/i.test(xml),name);
  assert(!/<text\b|<filter\b/.test(xml),name);
  assert(xml.length < 15000,`Unnecessarily heavy ${name}`);
}
assert.equal(A.marker('unknown'),A.marker('battle'));
assert.equal(A.marker('battle',-1),A.marker('battle',72));
assert.equal(A.icon('coin',NaN),A.icon('coin',24));
assert.equal(A.icon('coin',Infinity),A.icon('coin',24));
assert(A.icon('coin',1).includes('width="8"'));
assert(A.icon('coin',99999).includes('width="2400"'));
assert(A.icon('army',24,{label:'A < B & "C"'}).includes('aria-label="A &lt; B &amp; &quot;C&quot;"'));
assert(!A.icon('army',24,{label:'Army'}).includes('aria-hidden'));
assert.equal(A.icon('gold'),A.icon('coin'));
assert.equal(A.banner('unknown'),A.banner('army'));
assert.equal(A.backdrop(1),A.backdrop(1));
assert.notEqual(A.backdrop(1),A.backdrop(2));
assert.notEqual(A.marker('battle'),A.marker('elite'));
assert.notEqual(A.marker('rest'),A.marker('shop'));
assert(A.marker('boss',72,{state:'locked'}).includes('opacity=".48"'));
assert(A.marker('boss',72,{state:'complete'}).includes('is-complete'));
const source=fs.readFileSync(path.join(__dirname,'../src/screen-art.js'),'utf8');
assert(!/\b(?:fetch|XMLHttpRequest|setInterval|setTimeout|requestAnimationFrame|Math\.random|document\.)\b/.test(source));
console.log(`Screen art: ${samples.length} SVG variants and 20 API/safety checks passed.`);
