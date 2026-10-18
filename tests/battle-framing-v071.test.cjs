'use strict';
const assert=require('node:assert/strict');
const R=require('../src/battle-readability.js');
const unit=(id,x=450,y=300)=>({id,x,y,type:id<12?'spear':'swarm',team:id<12?'ally':'enemy',hp:70,maxHp:100});
const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o)}return o};
const actors=Array.from({length:24},(_,i)=>unit(i,430+i%4*12,300+Math.floor(i/4)*4));
const input=freeze({units:actors.slice(0,12),enemies:actors.slice(12),width:900,height:580,scale:1});
const original=JSON.stringify(input),frame=R.frameActors(input);
assert.equal(frame.zoom,1.25);assert.deepEqual(R.frameActors(input),frame);assert.equal(JSON.stringify(input),original);
for(const actor of actors){const p=R.projectPoint(actor.x,actor.y,{...input,frame});assert(p.x>0&&p.x<900&&p.y>0&&p.y<580);const q=R.unprojectPoint(p.x,p.y,{...input,frame});assert(Math.abs(q.x-actor.x)<1e-9&&Math.abs(q.y-actor.y)<1e-9)}
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
for(const height of [260,580,1100])for(const scale of [.5,1,1.3,2]){
 const options={...input,height,scale},f=R.frameActors(options),bars=R.layoutBars({...options,frame:f});
 assert(f.zoom>=1&&f.zoom<=1.25);assert.equal(bars.length,24);
 for(let i=0;i<bars.length;i++){const b=bars[i];assert(b.x>=0&&b.y>=0&&b.x+b.width<=900+1e-8&&b.y+b.height<=height+1e-8);for(let j=i+1;j<bars.length;j++)assert(!overlap(b,bars[j]),`bar overlap at height ${height}, scale ${scale}`)}
}
const identity={zoom:1,offsetX:0,offsetY:0};
assert.deepEqual(R.frameActors(),identity);
assert.deepEqual(R.frameActors({units:[{...unit(1),hp:0},{...unit(2),x:NaN}]}),identity);
assert.deepEqual(R.frameActors({units:[unit(1,0,0),unit(2,900,580)]}),identity);
assert.deepEqual(R.frameActors({...input,telegraphs:[{x:450,y:300,radius:500,left:1}]}),identity);
const danger=R.frameActors({...input,telegraphs:[{x:650,y:300,radius:100,left:1}]});
for(const [x,y] of [[550,200],[750,400]]){const p=R.projectPoint(x,y,{...input,frame:danger});assert(p.x>=0&&p.x<=900&&p.y>=0&&p.y<=580)}
const smoothed=R.frameActors({...input,previous:identity,dt:1/60});assert(smoothed.zoom>1&&smoothed.zoom<1.25);
assert.deepEqual(R.frameActors({...input,previous:frame,dt:1/60,telegraphs:[{x:450,y:300,radius:500,left:1}]}),identity);
for(const width of [1,24,320,900])for(const height of [1,24,260,1100]){
 const f=R.frameActors({...input,width,height,previous:{zoom:NaN,offsetX:Infinity,offsetY:NaN},dt:NaN});assert(Object.values(f).every(Number.isFinite));
 const bars=R.layoutBars({...input,width,height,frame:f});for(const b of bars)assert(Object.values(b).every(v=>typeof v!=='number'||Number.isFinite(v)));
}
assert.equal(JSON.stringify(input),original);
console.log('v0.7.1 battle framing: frozen 24 actors, edge safety, telegraph bounds, limited smoothing, projection round trip and screen-space bar overlap passed');
