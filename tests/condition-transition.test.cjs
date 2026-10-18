'use strict';
const assert = require('node:assert/strict');
const art = require('../src/condition-art.js');
const {createController} = require('../src/condition-transition.js');
function fixture() {
  const timers = new Map(), listeners = new Map(), mediaListeners = new Map();
  let serial = 0, writes = 0, prefs = {}, subscriber;
  const doc = {hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const media = {matches:false,addEventListener:(name,fn)=>mediaListeners.set(name,fn),removeEventListener:name=>mediaListeners.delete(name)};
  const host = {document:doc,TinyArmyConditionArt:art,matchMedia:()=>media,TinyArmyGraphics:{effective:()=>prefs,subscribe:fn=>{subscriber=fn;return()=>{subscriber=null;};}},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
  const node = () => {
    const light={attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
    const fill={attrs:{},nextElementSibling:light,setAttribute(k,v){this.attrs[k]=v;}};
    return {fill,light,set innerHTML(value){writes++;this.html=value;},querySelector:()=>fill};
  };
  const mean=node(), min=node(), element={isConnected:true,querySelector:selector=>selector.includes('"mean"')?mean:min};
  const controller=createController(host);
  return {controller,timers,doc,listeners,media,mediaListeners,element,mean,min,get writes(){return writes;},prefs(value){prefs=value;subscriber?.();},step(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
}
const data=Object.freeze({before:92,after:73,beforeMin:40,afterMin:0,reason:'전투 후'});
let f=fixture();
const html=f.controller.markup(data);
assert(html.includes('aria-valuenow="73"'));
assert(html.includes('92 → 73 (-19)'));
assert(html.includes('40 → 0 (-40)'));
assert(html.includes('viewBox="0 0 120 18"'));
assert(!f.controller.markup({...data,reason:'<img>'}).includes('<img>'));
assert(f.controller.play(f.element,data));
assert.equal(Number(f.mean.fill.attrs.width),104.88);
assert.equal(f.timers.size,1);
for(let i=0;i<24;i++){assert.equal(f.timers.size,1);f.step();}
assert.equal(f.timers.size,0);
assert.equal(Number(f.mean.fill.attrs.width),83.22);
assert.equal(Number(f.min.fill.attrs.width),0);
assert.equal(f.writes,2,'frame updates do not replace SVG or panel markup');
assert.deepEqual(data,{before:92,after:73,beforeMin:40,afterMin:0,reason:'전투 후'});
// Rounding uses displayed endpoints: 49.94→50.05 must say 49.9→50.1 (+0.2).
assert(f.controller.markup({before:49.94,after:50.05}).includes('49.9 → 50.1 (+0.2)'));
for(const mode of ['hidden','detached','scene','destroy','media','prefs','clear']){
  f=fixture(); f.controller.play(f.element,data);
  if(mode==='hidden'){f.doc.hidden=true;f.listeners.get('visibilitychange')();}
  if(mode==='detached'){f.element.isConnected=false;f.step();}
  if(mode==='scene')f.controller.setScene('camp');
  if(mode==='destroy')f.controller.destroy();
  if(mode==='media'){f.media.matches=true;f.mediaListeners.get('change')();}
  if(mode==='prefs')f.prefs({uiAnimation:false});
  if(mode==='clear')f.controller.clear();
  assert.equal(f.timers.size,0,mode);
  assert.equal(Number(f.mean.fill.attrs.width),83.22,mode);
  if(mode==='destroy'){assert.equal(f.listeners.size,0);assert.equal(f.mediaListeners.size,0);assert.equal(f.controller.play(f.element,data),false);}
}
f=fixture();f.media.matches=true;
assert.equal(f.controller.play(f.element,data),false);assert.equal(f.timers.size,0);assert.equal(Number(f.mean.fill.attrs.width),83.22);
f=fixture();f.controller.play(f.element,data);f.controller.play(f.element,{before:0,after:100});
assert.equal(f.timers.size,1,'new effect replaces old effect');assert.equal(Number(f.mean.fill.attrs.width),0);
f.controller.clear();assert.equal(Number(f.mean.fill.attrs.width),114);
console.log('condition transition: exact start/end, bounded batched timer, nonmutation, compact markup, rounding, cancellation and reduced motion passed');
