'use strict';
const assert=require('node:assert/strict');
const API=require('../src/formation-input.js');
class Events {
 constructor(){this.listeners=new Map()}
 addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list)}
 removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(x=>x!==fn))}
 emit(type,values={}){const e={type,button:0,pointerId:1,isPrimary:true,clientX:10,clientY:10,detail:1,cancelable:true,currentTarget:this,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true},...values};for(const fn of [...this.listeners.get(type)||[]]){fn(e);if(e.stopped)break}return e}
 count(){return [...this.listeners.values()].reduce((n,a)=>n+a.length,0)}
}
function fixture(){
 const doc=new Events(),win=new Events(),root=new Events();doc.defaultView=win;root.ownerDocument=doc;
 const nodes=[];root.contains=n=>nodes.includes(n);let pointed=null;
 doc.elementFromPoint=()=>pointed;
 function node(data){const set=new Set();const n={dataset:data,ownerDocument:doc,isConnected:true,disabled:false,classList:{add:c=>set.add(c),remove:c=>set.delete(c),contains:c=>set.has(c)},contains:t=>t===n,closest:()=>n,setPointerCapture(id){this.capture=id},hasPointerCapture(id){return this.capture===id},releasePointerCapture(){this.capture=null}};nodes.push(n);return n}
 const source=node({action:'slot',slot:'0',unitId:'7'}),target=node({action:'slot',slot:'1'}),roster=node({inspectUnitId:'7'});
 let clock=0,next=0;const timers=new Map(),moves=[],inspects=[];let enabled=true;
 const options={onMove:(...v)=>moves.push(v),onInspect:id=>inspects.push(id),canInteract:()=>enabled,setTimeout:(fn,ms)=>{timers.set(++next,{fn,at:clock+ms});return next},clearTimeout:id=>timers.delete(id)};
 const attach=()=>API.attach(root,options);let controller=attach();
 const down=(values={})=>{doc.emit('pointerdown',{target:source,...values});return root.emit('pointerdown',{target:source,...values})};
 const advance=ms=>{clock+=ms;for(const [id,t] of [...timers])if(t.at<=clock){timers.delete(id);t.fn()}};
 return {doc,win,root,source,target,roster,timers,moves,inspects,options,attach,controller,down,advance,point:n=>pointed=n,enable:v=>enabled=v};
}
{
 const f=fixture();f.down();f.doc.emit('pointerup',{target:f.source});f.advance(1000);assert.deepEqual(f.moves,[]);assert.deepEqual(f.inspects,[]);assert(!f.doc.emit('click',{target:f.source}).prevented);f.controller.destroy();
}
{
 const f=fixture();f.down();f.advance(499);assert.equal(f.inspects.length,0);f.advance(1);assert.deepEqual(f.inspects,[7]);f.advance(500);f.doc.emit('pointermove',{clientX:90,target:f.source});f.doc.emit('pointerup',{target:f.source});assert.deepEqual(f.moves,[]);assert(f.doc.emit('click',{target:f.source}).prevented);assert(!f.doc.emit('click',{target:f.source}).prevented);f.controller.destroy();
}
{
 const f=fixture();f.down();f.point(f.target);f.doc.emit('pointermove',{clientX:40,target:f.source});assert(f.source.classList.contains('formation-drag-source'));assert(f.target.classList.contains('formation-drop-target'));assert.equal(f.source.capture,1);f.advance(600);assert.equal(f.inspects.length,0);f.doc.emit('pointerup',{clientX:40,target:f.source});assert.deepEqual(f.moves,[[7,1]],'hit-test destination wins over captured source');assert(!f.target.classList.contains('formation-drop-target'));assert.equal(f.source.capture,null);assert(f.doc.emit('click',{clientX:40,target:f.target}).prevented);f.controller.destroy();
}
for(const reason of ['pointercancel','lostpointercapture','Escape','visibilitychange','resize','blur','pagehide','scroll','manual','destroy','second-pointer']){
 const f=fixture();f.down();f.point(f.target);f.doc.emit('pointermove',{clientX:40,target:f.source});
 if(reason==='Escape')f.doc.emit('keydown',{key:'Escape'});else if(['resize','blur','pagehide'].includes(reason))f.win.emit(reason);else if(reason==='manual')f.controller.cancel();else if(reason==='destroy')f.controller.destroy();else if(reason==='second-pointer')f.doc.emit('pointerdown',{pointerId:2,isPrimary:false});else f.doc.emit(reason);
 f.advance(800);f.doc.emit('pointerup',{clientX:40,target:f.source});assert.deepEqual(f.moves,[],reason);assert.deepEqual(f.inspects,[],reason);assert.equal(f.timers.size,0,reason);assert(!f.source.classList.contains('formation-drag-source'),reason);f.controller.destroy();assert.equal(f.doc.count()+f.win.count()+f.root.count(),0,reason);
}
for(const invalid of ['outside','invalid-slot','disabled','phase','removed']){
 const f=fixture();f.down();f.point(f.target);f.doc.emit('pointermove',{clientX:40});
 if(invalid==='outside')f.point(null);if(invalid==='invalid-slot')f.target.dataset.slot='99';if(invalid==='disabled')f.target.disabled=true;if(invalid==='phase')f.enable(false);if(invalid==='removed')f.source.isConnected=false;
 f.doc.emit('pointerup',{clientX:40,target:f.source});assert.deepEqual(f.moves,[],invalid);f.controller.destroy();
}
{
 const f=fixture();f.down({button:2});f.advance(600);f.down({isPrimary:false});f.advance(600);assert.deepEqual(f.inspects,[]);assert.equal(f.timers.size,0);f.controller.destroy();
}
{
 const f=fixture();f.down({target:f.roster});f.advance(500);assert.deepEqual(f.inspects,[7]);f.doc.emit('pointerup',{target:f.roster});f.down({target:f.roster});f.doc.emit('pointermove',{clientX:40,target:f.roster});f.advance(600);f.doc.emit('pointerup',{clientX:40,target:f.roster});assert.deepEqual(f.inspects,[7]);assert.deepEqual(f.moves,[]);f.controller.destroy();
}
{
 const f=fixture();f.options.onInspect=()=>{f.inspects.push(7);f.controller.destroy();f.controller=f.attach()};f.down();f.advance(500);const realNow=Date.now;Date.now=()=>realNow()+2500;f.doc.emit('pointerup',{target:f.source});assert(!f.doc.emit('click',{target:f.source,detail:0}).prevented,'keyboard click survives');assert(f.doc.emit('click',{target:f.source}).prevented,'hold suppression survives a long hold and render destroy/re-attach');Date.now=realNow;f.controller.destroy();
}
{
 const f=fixture();f.down();f.controller.cancel();f.down();f.doc.emit('pointerup',{target:f.source});assert(!f.doc.emit('click',{target:f.source}).prevented,'new tap is not swallowed');f.controller.destroy();f.controller.destroy();
}

{
 const f=fixture();f.down();f.advance(500);f.doc.emit('pointerup',{target:f.source});assert(!f.doc.emit('click',{target:f.target,pointerId:2,clientX:300,clientY:300}).prevented,'unrelated click survives');assert(f.doc.emit('click',{target:f.source,detail:0,pointerType:'touch'}).prevented,'explicit touch compatibility click is consumed');f.controller.destroy();
}
{
 const f=fixture();f.down();f.controller.cancel();f.doc.emit('pointerdown',{target:f.target});f.doc.emit('pointerup',{target:f.target});assert(!f.doc.emit('click',{target:f.target}).prevented,'empty-slot fresh tap survives previous cancellation');f.controller.destroy();
}
{
 const f=fixture();f.down();f.enable(false);f.advance(600);assert.deepEqual(f.inspects,[],'hold rechecks phase');f.controller.destroy();
}
{
 const f=fixture();let removed=0;const cards=[];
 f.doc.body={appendChild:card=>cards.push(card)};
 f.doc.createElement=()=>({style:{},setAttribute(){},appendChild(){},remove(){removed++}});
 f.source.setPointerCapture=()=>{throw Error('capture unavailable')};
 f.down();f.point(f.target);f.doc.emit('pointermove',{clientX:40});assert.equal(cards.length,1);assert.equal(cards[0].className,'formation-drag-ghost');assert.equal(cards[0].style.pointerEvents,'none');assert(cards[0].style.transform.startsWith('translate('));f.controller.cancel();assert.equal(removed,1);f.controller.destroy();assert.equal(removed,1);
}
console.log('formation input: deterministic pointer, hold, cancellation, phase, cleanup and click-suppression checks passed');
