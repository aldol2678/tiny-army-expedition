'use strict';
const assert=require('node:assert/strict');
const R=require('../src/battle-readability.js');
const unit=(id,x=300,y=300,type='spear',team='ally')=>({id,x,y,type,team,hp:70,maxHp:100});
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
function frozen(o){if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o)}return o}
const dense=frozen({units:Array.from({length:12},(_,i)=>unit(i)),enemies:Array.from({length:12},(_,i)=>unit(i+100,330,300,'swarm','enemy')),width:900,height:580,scale:1});
const before=JSON.stringify(dense),bars=R.layoutBars(dense);
assert.equal(bars.length,24);assert.deepEqual(bars,R.layoutBars(dense));assert.equal(JSON.stringify(dense),before);
for(let i=0;i<bars.length;i++){assert.equal(bars[i].crowded,false);for(let j=i+1;j<bars.length;j++)assert(!overlap(bars[i],bars[j]),`overlap ${i}/${j}`)}
assert(bars.some(b=>b.displaced));
for(const scale of [.5,1,1.3,2])for(const width of [1,24,320,900])for(const height of [1,24,260,1100]){
 const values=R.layoutBars({...dense,width,height,scale});
 for(const b of values){assert(Object.values(b).every(v=>typeof v!=='number'||Number.isFinite(v)));assert(b.x>=0&&b.y>=0&&b.x+b.width<=width+1e-8&&b.y+b.height<=height+1e-8)}
}
assert(R.layoutBars({...dense,width:1,height:1}).some(b=>b.crowded));
const scaled=R.layoutBars({units:[unit(1,400,400)],height:1160,scale:1.3})[0];assert.equal(scaled.x,400-38*1.3/2);assert.equal(scaled.y,800-73*1.3);
assert.equal(R.layoutBars({units:[{...unit(1),hp:0},{...unit(2),x:NaN}]}).length,0);
const protect=frozen([unit(1,0,0,'guardian'),unit(2,100,0,'guardian'),unit(3,60,0),unit(4,255,0),unit(5,254.999,0),unit(6,60,0,'spear','enemy'),{...unit(7,65,0,'guardian'),hp:0},unit(8,50,0)]);
const links=R.guardianLinks(protect);assert.deepEqual(links.map(l=>[l.sourceId,l.targetId]),[[2,3],[2,5],[1,8]]);assert(!links.some(l=>l.targetId===1||l.targetId===2||l.targetId===4));
// Engine's nearest guardian selection, including original-order equal distances.
for(let i=0;i<150;i++){
 const us=[unit(1,i,11,'guardian'),unit(2,100,50,'guardian'),unit(3,i*2,75),unit(4,i/2,200)];
 const actual=R.guardianLinks(us);
 for(const t of us.filter(u=>u.type!=='guardian')){const expected=us.filter(u=>u.type==='guardian'&&u.hp>0&&Math.hypot(u.x-t.x,u.y-t.y)<155).sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0];assert.equal(actual.find(l=>l.targetId===t.id)?.sourceId,expected?.id)}
}
const effects=frozen([{kind:'heal',tx:30,ty:50,life:.4,max:.55},{kind:'heal',tx:20,ty:20,life:0,max:.55},{kind:'arrow',tx:10,ty:10,life:1,max:1}]);
assert.deepEqual(R.healHighlights(effects).map(x=>[x.x,x.y]),[[30,50]]);
assert.equal(R.healHighlights([]).length,0);
const calls=[],ctx={save(){calls.push('save')},restore(){calls.push('restore')},beginPath(){},moveTo(){},lineTo(){},stroke(){calls.push('stroke')},fillRect(...args){assert(args.every(Number.isFinite));calls.push('fillRect')}};
R.drawLinks(ctx,{units:protect,effects,reducedMotion:true,lowEffects:true});assert(calls.includes('stroke'));
const healingStart=calls.length;R.drawHealing(ctx,{effects,reducedMotion:true,lowEffects:true});assert.equal(calls.slice(healingStart).filter(x=>x==='stroke').length,2);
const noHealingStart=calls.length;R.drawLinks(ctx,{units:[],effects});assert.equal(calls.slice(noHealingStart).filter(x=>x==='stroke').length,0);
assert.deepEqual(R.drawBars(ctx,dense),bars);assert.equal(calls.filter(x=>x==='save').length,calls.filter(x=>x==='restore').length);
assert.equal(JSON.stringify(dense),before);assert(Object.isFrozen(R));
console.log('battle-readability: pure deterministic layout, 24-unit crowd, constrained viewports, engine guardian parity, committed healing and minimal Canvas rendering passed');
