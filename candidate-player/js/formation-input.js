/* Formation gestures. Campaign mutations belong to the caller. */
(function(global){'use strict';
const suppressed=new WeakMap();
function consumeClick(event){
 const doc=event.target?.ownerDocument||event.currentTarget?.ownerDocument||event.currentTarget;
 const entry=doc&&suppressed.get(doc);
 if(!entry||(event.detail===0&&!event.sourceCapabilities?.firesTouchEvents&&!['touch','pen'].includes(event.pointerType)))return false; // Keyboard/assistive clicks always remain available.
 if(Date.now()>entry.until){suppressed.delete(doc);return false}
 const target=event.target;
 const samePointer=event.pointerId!=null&&event.pointerId===entry.pointerId;
 const near=Math.hypot((event.clientX??Infinity)-entry.x,(event.clientY??Infinity)-entry.y)<32;
 const sameSource=target===entry.source||entry.source?.contains?.(target);
 if(!samePointer&&!near&&!sameSource)return false;
 suppressed.delete(doc);event.preventDefault();event.stopImmediatePropagation();return true;
}
function attach(root,options={}){
 if(!root?.addEventListener)throw new TypeError('A formation event root is required');
 const doc=root.ownerDocument||root,win=doc.defaultView||global;
 const threshold=options.dragThreshold??10;
 const listeners=[];let state=null,destroyed=false;
 const listen=(node,type,fn,opts)=>{if(node?.addEventListener){node.addEventListener(type,fn,opts);listeners.push(()=>node.removeEventListener(type,fn,opts))}};
 const allowed=()=>!destroyed&&(!options.canInteract||options.canInteract());
 const grid=root.querySelector?.('.formation-grid');
 const scroller=root.closest?.('.dialog-content,.content-screen')||root;
 function fitBoard(){
  if(!grid?.getBoundingClientRect||!scroller?.getBoundingClientRect||!scroller.clientHeight)return;
  const top=grid.getBoundingClientRect().top-scroller.getBoundingClientRect().top+(scroller.scrollTop||0);
  grid.style.setProperty('--formation-row-size',rowBudget(scroller.clientHeight-top)+'px');
 }
 const observer=grid&&win.ResizeObserver?new win.ResizeObserver(fitBoard):null;
 observer?.observe(scroller);fitBoard();listen(win,'resize',fitBoard);

 const inside=node=>!!node&&(node===root||root.contains(node));
 const validSource=s=>inside(s.source)&&s.source.isConnected!==false&&!s.source.disabled&&allowed()&&s.source.dataset.action==='slot'&&String(s.source.dataset.unitId)===String(s.id)&&String(s.source.dataset.slot)===s.slot;
 function remember(s,event,pending=true){suppressed.set(doc,{until:pending?Infinity:Date.now()+900,pointerId:s.pointerId,source:s.source,x:event?.clientX??s.x,y:event?.clientY??s.y})}
 function release(s){try{if(s.source.hasPointerCapture?.(s.pointerId))s.source.releasePointerCapture(s.pointerId)}catch{}}
 function clean(s){s.ghost?.remove();s.source.classList.remove('formation-drag-source');s.target?.classList.remove('formation-drop-target');release(s)}
 function ghost(s){
  if(!doc.createElement||!doc.body?.appendChild)return;
  const card=doc.createElement('div');card.className='formation-drag-ghost';card.setAttribute('aria-hidden','true');
  Object.assign(card.style,{position:'fixed',pointerEvents:'none',left:'0',top:'0',zIndex:'10000'});
  const portrait=s.source.querySelector?.('.unit-portrait')?.cloneNode(true);
  if(portrait){
   for(const node of [portrait,...portrait.querySelectorAll('*')]){
    for(const attr of [...node.attributes])if(attr.name==='id'||attr.name==='tabindex'||attr.name.startsWith('data-')||attr.name.startsWith('on'))node.removeAttribute(attr.name);
   }
   card.appendChild(portrait);
  }
  const name=doc.createElement('span');name.textContent=s.source.querySelector?.('.cell-copy b')?.textContent||'병사';card.appendChild(name);
  doc.body.appendChild(card);s.ghost=card;
 }
 function positionGhost(s){if(s.ghost){const x=Math.max(0,Math.min(s.x+14,(win.innerWidth||s.x+150)-120)),y=Math.max(0,Math.min(s.y+14,(win.innerHeight||s.y+100)-80));s.ghost.style.transform=`translate(${x}px, ${y}px)`}}
 function cancel(){const s=state;if(!s)return;state=null;remember(s);clean(s);options.onCancel?.()}
 function destination(event){let element;try{element=doc.elementFromPoint(event.clientX,event.clientY)}catch{return null}
 const slot=element?.closest?.('[data-action="slot"]');const n=Number(slot?.dataset.slot);
 return inside(slot)&&!slot.disabled&&Number.isInteger(n)&&n>=0&&n<12?slot:null;
 }
 function down(event){
  if(state){if(event.pointerId!==state.pointerId)cancel();return}
  // Pointer identity, not a coarse media query: hybrid laptops retain mouse drag.
  if(event.pointerType==='touch'||event.pointerType==='pen')return;
  if(event.button!==0||event.isPrimary===false||!allowed())return;
  if(event.target?.closest?.('[data-action="unit-detail"]'))return;
  const source=event.target?.closest?.('[data-action="slot"][data-unit-id]');
  if(!inside(source)||source.disabled)return;
  const id=Number(source.dataset.unitId);if(!Number.isFinite(id))return;
  suppressed.delete(doc); // A genuinely new pointer gesture must not be swallowed by an old cancellation.
  state={source,id,slot:String(source.dataset.slot),pointerId:event.pointerId,pointerType:event.pointerType,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,dragging:false,moved:false,target:null};
 }
 function move(event){const s=state;if(!s||s.pointerId!==event.pointerId)return;
  s.x=event.clientX;s.y=event.clientY;if(!validSource(s)){cancel();return}
  if(!s.dragging&&Math.hypot(s.x-s.startX,s.y-s.startY)>=threshold){
   s.moved=true;
   s.dragging=true;s.source.classList.add('formation-drag-source');ghost(s);try{s.source.setPointerCapture?.(s.pointerId)}catch{}
  }
  if(!s.dragging)return;
  positionGhost(s);
  if(event.cancelable)event.preventDefault();
  const target=destination(event);if(target!==s.target){s.target?.classList.remove('formation-drop-target');s.target=target;s.target?.classList.add('formation-drop-target');options.onPreview?.(s.id,target?Number(target.dataset.slot):null)}
 }
 function settle(event){const entry=suppressed.get(doc);if(entry&&entry.pointerId===event.pointerId){entry.until=Date.now()+900;entry.x=event.clientX??entry.x;entry.y=event.clientY??entry.y}}
 function up(event){settle(event);const s=state;if(!s||s.pointerId!==event.pointerId)return;
  const target=s.dragging&&validSource(s)?destination(event):null;
  state=null;if(s.dragging||s.moved)remember(s,event,false);clean(s);
  if(target&&allowed())options.onMove?.(s.id,Number(target.dataset.slot));else if(s.dragging||s.moved)options.onCancel?.();
 }
 function cancelled(event){if(state&&event.pointerId===state.pointerId)cancel();settle(event)}
 listen(root,'pointerdown',down);
 // A second finger anywhere cancels rather than accidentally moving a soldier.
 listen(doc,'pointerdown',event=>{if(state&&event.pointerId!==state.pointerId)cancel();else if(!state&&event.button===0&&event.isPrimary!==false)suppressed.delete(doc)},true);
 listen(doc,'pointermove',move,{passive:false});listen(doc,'pointerup',up);listen(doc,'pointercancel',cancelled);
 listen(doc,'lostpointercapture',cancelled,true);listen(doc,'click',consumeClick,true);
 listen(doc,'keydown',event=>{if(event.key==='Escape')cancel()},true);
 listen(doc,'visibilitychange',cancel);listen(win,'resize',cancel);listen(win,'blur',cancel);listen(win,'pagehide',cancel);listen(doc,'scroll',cancel,true);
 return Object.freeze({cancel,destroy(){if(destroyed)return;cancel();destroyed=true;observer?.disconnect();listeners.splice(0).forEach(remove=>remove())}});
}
function rowBudget(available){return Math.max(86,Math.min(100,Math.floor((available-12-8)/4)))}
const api=Object.freeze({attach,consumeClick,rowBudget});global.TinyArmyFormationInput=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
