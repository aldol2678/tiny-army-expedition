'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const A=require('../src/screen-art.js');
const B=require('../src/chapter-backdrop.js');
function context(){
  const log=[];const ctx={log};
  for(const key of ['fillStyle','strokeStyle'])Object.defineProperty(ctx,key,{set(value){log.push([key,value])}});
  for(const method of ['save','restore','scale','fillRect','beginPath','moveTo','lineTo','closePath','fill'])ctx[method]=(...args)=>log.push([method,...args]);
  return ctx;
}
assert(Object.isFrozen(B));assert(Object.isFrozen(B.palettes.ashcastle));
assert.notDeepEqual(B.paletteForChapter(1),B.paletteForChapter(2));
assert.equal(B.paletteForChapter('2'),B.paletteForChapter(2));
assert.equal(B.paletteForChapter(undefined),B.paletteForChapter(1));
for(const chapter of [1,2]){
  for(const size of [[900,580],[360,600],[1200,450]]){
    const a=context(),b=context();
    assert.equal(B.draw(a,{chapter,width:size[0],height:size[1]}),true);
    B.draw(b,{chapter,width:size[0],height:size[1],reducedMotion:true,clock:1234});
    assert.deepEqual(a.log,b.log,'Scenery must be static and deterministic');
    assert.deepEqual(a.log[0],['save']);assert.deepEqual(a.log.at(-1),['restore']);
    assert.deepEqual(a.log.find(x=>x[0]==='scale'),['scale',size[0]/900,size[1]/580]);
    // Every decorative path point remains outside the combat corridor.
    for(const call of a.log.filter(x=>['moveTo','lineTo'].includes(x[0])))assert(call[2]<90||call[1]<40||call[1]>860,`Clutter inside combat floor: ${call}`);
    const low=context();B.draw(low,{chapter,width:size[0],height:size[1],decorativeBackground:false});
    assert.deepEqual(low.log,[['save'],['fillStyle',B.paletteForChapter(chapter).ground],['fillRect',0,0,...size],['restore']]);
  }
}
for(const bad of [0,-1,NaN,Infinity])assert.equal(B.draw(context(),{width:bad,height:580}),false);
assert.equal(B.draw(null,{width:900,height:580}),false);
const fail=context();fail.fillRect=()=>{throw Error('test')};assert.throws(()=>B.draw(fail,{width:900,height:580}));assert.deepEqual(fail.log.at(-1),['restore']);
for(const kind of ['prepare','army','shop','rest','reward','complete','event','camp']){
  const first=A.backdrop(kind),ash=A.backdrop(kind,{chapter:2});
  assert.equal(first,A.backdrop(kind,{chapter:1}));assert.notEqual(first,ash);
  assert(ash.includes('ta-chapter-2'));assert(ash.includes('#e6e0d9'));
  assert(ash.includes('aria-hidden="true"'));
  assert(!/NaN|undefined|Infinity|<text\b|<script\b/.test(ash));
  assert(ash.length<15000);
}
const source=fs.readFileSync(require.resolve('../src/chapter-backdrop.js'),'utf8');
assert(!/\b(?:fetch|XMLHttpRequest|setInterval|setTimeout|requestAnimationFrame|Math\.random|document\.)\b/.test(source));
console.log('Chapter theme: chapter-aware SVG scenes, sparse Canvas scenery, low graphics, deterministic rendering and context restoration passed.');
