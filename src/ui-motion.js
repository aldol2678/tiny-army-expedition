/* Tiny Army v0.5.1 — original, presentation-only UI motion.
 * All public calls are synchronous and fire-and-forget. There are no gameplay,
 * RNG, storage, event-dispatch, completion callback or reward dependencies here.
 * Capture origins before a DOM rerender; launch visuals after state + UI commit.
 */
(()=>{'use strict';
const host=globalThis,doc=host.document;
if(!doc)return;
host.TinyArmyMotion?.destroy?.();
const media=host.matchMedia?.('(prefers-reduced-motion: reduce)');
const active=new Map(),MAX_EFFECTS=4,MAX_NODES_PER_EFFECT=3;
let root=null,style=null,scene=null,disposed=false,serial=0;
const colors={march:'#357d69',relic:'#a47830',evolve:'#b98736',heal:'#3a8c6c',guard:'#4d80a8',focus:'#b36a45',rally:'#ad8546',recruit:'#417c68',train:'#6b85a0'};
const css=`
.ta-motion-layer{position:fixed;inset:0;z-index:60;overflow:hidden;pointer-events:none!important;contain:layout style paint;isolation:isolate}
.ta-motion-layer,.ta-motion-layer *{pointer-events:none!important;user-select:none;-webkit-user-select:none}
.ta-motion-piece{position:absolute;box-sizing:border-box;pointer-events:none!important;transform-origin:center;will-change:transform,opacity;color:var(--ta-color,#357d69)}
.ta-motion-piece svg{display:block;width:100%;height:100%;overflow:visible}
.ta-motion-march{width:46px;height:50px;filter:drop-shadow(0 3px 1px #20354826)}
.ta-motion-reward{width:45px;height:51px;padding:6px;background:#fff8e8;border:2px solid currentColor;border-radius:9px;box-shadow:0 4px 0 #20354819}
.ta-motion-ring{border:2px solid currentColor;border-radius:14px;background:transparent;opacity:.8}
.ta-motion-line{width:8px;height:4px;border-radius:4px;background:currentColor;opacity:.65}
.ta-motion-light{width:128px;height:128px;border-radius:50%;background:radial-gradient(ellipse,#eac0712e 0 24%,#eac07118 40%,transparent 72%);opacity:.8}
.ta-motion-portrait{width:82px;height:88px;filter:drop-shadow(0 4px 2px #20354820)}
.ta-motion-insignia{width:54px;height:61px;filter:drop-shadow(0 3px 1px #8d642828)}
.ta-motion-skill{border:2px solid currentColor;border-radius:14px;box-shadow:inset 0 0 0 3px #fff7e829;opacity:.8}
.ta-motion-entrance{height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,currentColor,transparent);opacity:.65}
@keyframes ta-motion-flight{0%{opacity:.85;transform:translate(0,0) scale(1)}45%{opacity:1;transform:translate(var(--ta-mid-x),var(--ta-mid-y)) scale(1.04)}85%{opacity:1}100%{opacity:0;transform:translate(var(--ta-end-x),var(--ta-end-y)) scale(.48)}}
@keyframes ta-motion-march{0%{opacity:.9;transform:translate(0,0)}35%{opacity:1;transform:translate(var(--ta-mid-x),var(--ta-mid-y))}82%{opacity:1}100%{opacity:0;transform:translate(var(--ta-end-x),var(--ta-end-y))}}
@keyframes ta-motion-ring{0%{opacity:.65;transform:scale(.94)}55%{opacity:.8;transform:scale(1.04)}100%{opacity:0;transform:scale(1.07)}}
@keyframes ta-motion-light{0%{opacity:0;transform:scale(.88)}35%{opacity:.85;transform:scale(1)}100%{opacity:0;transform:scale(1.1)}}
@keyframes ta-motion-insignia{0%{opacity:0;transform:translateY(10px) scale(.8)}30%{opacity:1;transform:translateY(0) scale(1.04)}72%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-4px) scale(1)}}
@keyframes ta-motion-skill{0%{opacity:.8;transform:scale(.99)}45%{opacity:.9;transform:scale(1.04)}100%{opacity:0;transform:scale(1.06)}}
@keyframes ta-motion-enter{0%{opacity:.88}100%{opacity:1}}
@keyframes ta-motion-accent{0%{opacity:0;transform:scaleX(.6)}35%{opacity:.7}100%{opacity:0;transform:scaleX(1)}}
@media(prefers-reduced-motion:reduce){.ta-motion-piece{animation:none!important;transition:none!important;will-change:auto!important}}
@media(forced-colors:active){.ta-motion-ring,.ta-motion-skill{border-color:Highlight}.ta-motion-reward{background:Canvas;color:CanvasText}.ta-motion-light{display:none}}
`;
const art={
 march:'<svg viewBox="0 0 46 50" xmlns="http://www.w3.org/2000/svg"><ellipse cx="23" cy="45" rx="21" ry="4" fill="#294e3d" opacity=".18"/><path d="M29 8v29" stroke="#6b4b34" stroke-width="3" stroke-linecap="round"/><path d="M30 8h13l-4 6 4 6H30" fill="#daaa5d" stroke="#6b4b34" stroke-width="1.5"/><path d="M34 11v5m-2-2h4" stroke="#fff4c9" stroke-width="2"/><path d="M8 34v7m8-7v7m10-5v8" stroke="#284f43" stroke-width="4" stroke-linecap="round"/><path d="M5 28h14v10H5z" fill="#397e67" stroke="#274f43" stroke-width="1.5"/><path d="M19 29h13v11H19z" fill="#719773" stroke="#274f43" stroke-width="1.5"/><circle cx="12" cy="23" r="7" fill="#e6bc88"/><circle cx="25" cy="25" r="6" fill="#e6bc88"/><path d="M5 23v-3a7 7 0 0 1 14 0v3zM19 25v-3a6 6 0 0 1 12 0v3z" fill="#e0e8c9" stroke="#274f43" stroke-width="1.5"/><path d="M10 17v5m13-3v5" stroke="#719773" stroke-width="2"/><circle cx="14" cy="25" r="1" fill="#274f43"/><circle cx="27" cy="27" r="1" fill="#274f43"/></svg>',
 recruit:'<svg viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg"><path d="M6 25h20v10H6z" fill="#4d8a71" stroke="#294f43" stroke-width="2"/><circle cx="16" cy="16" r="9" fill="#efc790" stroke="#294f43" stroke-width="2"/><path d="M7 15v-3a9 9 0 0 1 18 0v3z" fill="#e2e6c6" stroke="#294f43" stroke-width="2"/><path d="M15 5v9" stroke="#77966e" stroke-width="3"/><path d="M24 27h7m-3.5-3.5v7" stroke="#f6d58f" stroke-width="2.5"/></svg>',
 relic:'<svg viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg"><path d="M16 3l12 8v15L16 35 4 26V11z" fill="#d3a654" stroke="#785934" stroke-width="2"/><path d="M16 8l7 5v10l-7 7-7-7V13z" fill="#f5dc93"/><path d="M16 11l5 8-5 8-5-8z" fill="#477e67"/><path d="M16 11v16m-5-8h10" stroke="#34604e" stroke-width="1.5"/></svg>',
 train:'<svg viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg"><path d="M7 4h18v22L16 35 7 26z" fill="#7391a2" stroke="#3c596d" stroke-width="2"/><path d="M10 13l6-6 6 6m-12 8 6-6 6 6m-12 8 6-6 6 6" fill="none" stroke="#f6e6b9" stroke-width="3" stroke-linejoin="round"/></svg>',
 evolve:'<svg viewBox="0 0 54 61" xmlns="http://www.w3.org/2000/svg"><path d="M11 9h32v31L27 56 11 40z" fill="#e7bb66" stroke="#765b35" stroke-width="2.5"/><path d="M16 13h22v25L27 49 16 38z" fill="#f9e3a1"/><path d="M27 16l9 14-9 14-9-14z" fill="#58836a"/><path d="M27 20v20m-6-10h12" stroke="#e3edc2" stroke-width="2"/><path d="M3 21l3 8m-2 6 5 5m42-19-3 8m2 6-5 5" fill="none" stroke="#c99c4d" stroke-width="3" stroke-linecap="round"/><path d="M24 5h6" stroke="#c99c4d" stroke-width="3" stroke-linecap="round"/></svg>'
};
const graphics=()=>host.TinyArmyGraphics?.effective?.()||{};
const reduced=()=>{const prefs=graphics();return!!(media?.matches||prefs.reducedMotion||prefs.systemReducedMotion||prefs.uiAnimation===false)};
const set=(node,name,value)=>{if(node.style.setProperty)node.style.setProperty(name,value);else node.style[name]=value};
function resolve(value){try{return typeof value==='string'?doc.querySelector(value):value}catch(_){return null}}
function capture(value){
 const element=resolve(value);if(!element)return null;
 if(element.nodeType||typeof element.getBoundingClientRect==='function'){
  if(element.isConnected===false||element.hidden||element.closest?.('[hidden]'))return null;
  try{const computed=host.getComputedStyle?.(element);if(computed?.display==='none'||computed?.visibility==='hidden')return null}catch(_){}
 }
 let rect;try{rect=typeof element.getBoundingClientRect==='function'?element.getBoundingClientRect():element}catch(_){return null}
 const left=Number(rect.left??rect.x),top=Number(rect.top??rect.y),width=Number(rect.width),height=Number(rect.height);
 if(![left,top,width,height].every(Number.isFinite)||width<=0||height<=0)return null;
 return{left,top,width,height,right:left+width,bottom:top+height,cx:left+width/2,cy:top+height/2};
}
function visible(rect){return!!rect&&rect.right>0&&rect.bottom>0&&rect.left<(host.innerWidth||100000)&&rect.top<(host.innerHeight||100000)}
function ensureRoot(){
 if(disposed||doc.hidden||!doc.body)return null;
 if(!style){style=doc.createElement('style');style.id='tiny-army-motion-style';style.textContent=css;(doc.head||doc.body).appendChild(style)}
 if(!root){root=doc.createElement('div');root.className='ta-motion-layer';root.setAttribute('aria-hidden','true');root.setAttribute('data-tiny-army-motion','');root.style.pointerEvents='none';doc.body.appendChild(root)}
 return root;
}
function finish(effect){
 if(!effect||effect.closed)return;effect.closed=true;
 for(const timer of effect.timers)host.clearTimeout?.(timer);effect.timers.clear();
 for(const animation of effect.animations){try{animation.cancel()}catch(_){}}effect.animations.length=0;
 for(const restore of effect.restore){try{restore()}catch(_){}}effect.restore.length=0;
 for(const node of effect.nodes)node.remove?.();effect.nodes.length=0;
 if(active.get(effect.key)===effect)active.delete(effect.key);
 if(!active.size&&root){root.remove?.();root=null}
}
function clear(){for(const effect of [...active.values()])finish(effect)}
function begin(key){
 if(disposed||doc.hidden)return null;
 finish(active.get(key));
 if(active.size>=MAX_EFFECTS)finish(active.values().next().value);
 if(!ensureRoot())return null;
 const effect={key,id:++serial,nodes:[],animations:[],timers:new Set(),restore:[],closed:false};active.set(key,effect);return effect;
}
function expire(effect,ms){
 if(!effect||effect.closed)return;
 let timer;timer=host.setTimeout?.(()=>{effect.timers.delete(timer);finish(effect)},Math.min(900,Math.max(100,ms)));
 if(timer!==undefined&&!effect.closed)effect.timers.add(timer);
}
function piece(effect,className,rect,color,markup){
 if(!effect||effect.closed||effect.nodes.length>=MAX_NODES_PER_EFFECT||!root)return null;
 const node=doc.createElement('span');node.className='ta-motion-piece ta-motion-'+className;set(node,'--ta-color',color||colors.march);
 node.style.left=rect.left+'px';node.style.top=rect.top+'px';if(rect.width)node.style.width=rect.width+'px';if(rect.height)node.style.height=rect.height+'px';
 if(markup)node.innerHTML=markup;root.appendChild(node);effect.nodes.push(node);return node;
}
function play(effect,node,frames,duration,fallback,{delay=0,live=false}={}){
 if(!effect||effect.closed||!node||reduced())return;
 try{if(typeof node.animate==='function'){const animation=node.animate(frames,{duration,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:live?'none':'both',iterations:1});effect.animations.push(animation);return}}catch(_){}
 // Offline legacy fallback: self-contained CSS keyframes, also removed on cancel.
 const previous=node.style.animation;node.style.animation=`${fallback} ${duration}ms cubic-bezier(.22,.61,.36,1) ${delay}ms 1 ${live?'none':'both'}`;
 if(live)effect.restore.push(()=>{node.style.animation=previous||''});
}
function center(rect,width,height=width){return{left:rect.cx-width/2,top:rect.cy-height/2,width,height}}
function outline(effect,rect,color,{duration=420,delay=0,kind='ring'}={}){
 const node=piece(effect,kind,{left:rect.left-3,top:rect.top-3,width:rect.width+6,height:rect.height+6},color);
 if(!reduced())play(effect,node,[{opacity:.65,transform:'scale(.94)'},{offset:.55,opacity:.8,transform:'scale(1.04)'},{opacity:0,transform:'scale(1.07)'}],duration,'ta-motion-ring',{delay});
 return node;
}
function highlight(key,target,color){const rect=capture(target);if(!visible(rect))return false;const effect=begin(key);if(!effect)return false;outline(effect,rect,color);expire(effect,200);return true}
function mapMarch({from,to}={}){
 const destination=capture(to);if(!visible(destination))return false;
 if(reduced())return highlight('march',destination,colors.march);
 const origin=capture(from);if(!visible(origin))return highlight('march',destination,colors.march);
 const effect=begin('march');if(!effect)return false;
 const dx=destination.cx-origin.cx,dy=destination.cy-origin.cy,mx=dx*.5,my=dy*.5-14;
 const node=piece(effect,'march',center(origin,46,50),colors.march,art.march);
 for(const [key,value]of Object.entries({'--ta-end-x':dx+'px','--ta-end-y':dy+'px','--ta-mid-x':mx+'px','--ta-mid-y':my+'px'}))set(node,key,value);
 play(effect,node,[{opacity:.9,transform:'translate(0,0)'},{offset:.35,opacity:1,transform:`translate(${mx}px,${my}px)`},{offset:.82,opacity:1},{opacity:0,transform:`translate(${dx}px,${dy}px)`}],620,'ta-motion-march');
 outline(effect,destination,colors.march,{duration:250,delay:400});expire(effect,680);return true;
}
function rewardClaim({from,to,kind='recruit'}={}){
 const destination=capture(to);if(!visible(destination))return false;const type=Object.hasOwn(colors,kind)?kind:'recruit',color=colors[type];
 if(reduced())return highlight('reward',destination,color);
 const origin=capture(from);if(!visible(origin))return highlight('reward',destination,color);
 const effect=begin('reward');if(!effect)return false;
 const dx=destination.cx-origin.cx,dy=destination.cy-origin.cy,mx=dx*.45,my=dy*.4-Math.min(56,Math.abs(dx)*.12+24);
 const node=piece(effect,'reward',center(origin,45,51),color,art[type]||art.recruit);
 for(const [key,value]of Object.entries({'--ta-end-x':dx+'px','--ta-end-y':dy+'px','--ta-mid-x':mx+'px','--ta-mid-y':my+'px'}))set(node,key,value);
 play(effect,node,[{opacity:.85,transform:'translate(0,0) scale(1)'},{offset:.45,opacity:1,transform:`translate(${mx}px,${my}px) scale(1.04)`},{offset:.85,opacity:1},{opacity:0,transform:`translate(${dx}px,${dy}px) scale(.48)`}],620,'ta-motion-flight');
 outline(effect,destination,color,{duration:270,delay:440});expire(effect,750);return true;
}
function evolution({target,type}={}){
 const rect=capture(target);if(!visible(rect))return false;
 let portrait='';if(['guardian','charger','sniper','volley'].includes(type)){try{portrait=host.TinyArmyUIArt?.portrait?.(type)||''}catch(_){}}
 if(reduced()){
  if(!portrait)return highlight('evolution',rect,colors.evolve);
  const effect=begin('evolution');if(!effect)return false;
  piece(effect,'portrait',center(rect,82,88),colors.evolve,portrait);outline(effect,center(rect,82,88),colors.evolve);expire(effect,200);return true;
 }
 const effect=begin('evolution');if(!effect)return false;
 if(graphics().glow!==false){
  const light=piece(effect,'light',center(rect,128),colors.evolve);
  play(effect,light,[{opacity:0,transform:'scale(.88)'},{offset:.35,opacity:.85,transform:'scale(1)'},{opacity:0,transform:'scale(1.1)'}],740,'ta-motion-light');
 }
 if(portrait){
  const unit=piece(effect,'portrait',center(rect,82,88),colors.evolve,portrait);
  play(effect,unit,[{opacity:.7,transform:'scale(.94)'},{offset:.35,opacity:1,transform:'scale(1.04)'},{offset:.8,opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(1)'}],740,'ta-motion-insignia');
 }
 const badgeRect=portrait?{left:rect.cx+20,top:rect.cy+15,width:28,height:32}:center(rect,54,61);
 const badge=piece(effect,'insignia',badgeRect,colors.evolve,art.evolve);
 play(effect,badge,[{opacity:0,transform:'translateY(10px) scale(.8)'},{offset:.3,opacity:1,transform:'translateY(0) scale(1.04)'},{offset:.72,opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(-4px) scale(1)'}],700,'ta-motion-insignia');
 expire(effect,800);return true;
}
function skillPulse(button,{accepted=true,kind='guard'}={}){
 if(!accepted)return false;const rect=capture(button);if(!visible(rect))return false;const color=colors[kind]||colors.guard;
 if(reduced())return highlight('skill',rect,color);
 const effect=begin('skill');if(!effect)return false;
 const ring=piece(effect,'skill',{left:rect.left-2,top:rect.top-2,width:rect.width+4,height:rect.height+4},color);
 play(effect,ring,[{opacity:.8,transform:'scale(.99)'},{offset:.45,opacity:.9,transform:'scale(1.04)'},{opacity:0,transform:'scale(1.06)'}],280,'ta-motion-skill');expire(effect,330);return true;
}
function enter(target){
 const element=resolve(target),rect=capture(element);if(!visible(rect))return false;
 if(reduced())return highlight('entrance',rect,colors.march);
 const effect=begin('entrance');if(!effect)return false;
 if(typeof element?.getBoundingClientRect==='function')play(effect,element,[{opacity:.88},{opacity:1}],220,'ta-motion-enter',{live:true});
 const width=Math.min(220,rect.width*.6),line=piece(effect,'entrance',{left:rect.cx-width/2,top:rect.top+2,width,height:3},colors.march);
 play(effect,line,[{opacity:0,transform:'scaleX(.6)'},{offset:.35,opacity:.7},{opacity:0,transform:'scaleX(1)'}],300,'ta-motion-accent');expire(effect,350);return true;
}
function newScene(key){if(key===scene)return false;clear();scene=key;return true}
const onVisibility=()=>{if(doc.hidden)clear()},onMedia=()=>clear(),onGeometry=()=>clear();
doc.addEventListener('visibilitychange',onVisibility);
host.addEventListener?.('pagehide',clear);host.addEventListener?.('resize',onGeometry);host.addEventListener?.('scroll',onGeometry,true);
if(media?.addEventListener)media.addEventListener('change',onMedia);else media?.addListener?.(onMedia);
const unsubscribeGraphics=host.TinyArmyGraphics?.subscribe?.(clear);
function destroy(){
 clear();disposed=true;style?.remove?.();style=null;
 if(typeof unsubscribeGraphics==='function')unsubscribeGraphics();
 doc.removeEventListener?.('visibilitychange',onVisibility);host.removeEventListener?.('pagehide',clear);host.removeEventListener?.('resize',onGeometry);host.removeEventListener?.('scroll',onGeometry,true);
 if(media?.removeEventListener)media.removeEventListener('change',onMedia);else media?.removeListener?.(onMedia);
}
function inspect(){return{scene,activeEffects:active.size,nodes:[...active.values()].reduce((n,e)=>n+e.nodes.length,0),timers:[...active.values()].reduce((n,e)=>n+e.timers.size,0),animations:[...active.values()].reduce((n,e)=>n+e.animations.length,0),reducedMotion:reduced(),disposed,maxEffects:MAX_EFFECTS,maxNodesPerEffect:MAX_NODES_PER_EFFECT}}
host.TinyArmyMotion=Object.freeze({capture,newScene,mapMarch,rewardClaim,evolution,skillPulse,enter,clear,destroy,inspect});
})();
