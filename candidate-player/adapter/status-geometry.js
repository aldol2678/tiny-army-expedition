// Screen-space visual protection only. These rectangles never become hitboxes.
import {unitMotionBounds} from '../src/draw-observed-unit.js';
import {ultimateShapePrimitives} from '../core/browser-event-ui/battle-view.js';
const base=new Set(['spear','archer','support','mage']);
const bounds=points=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};};
export function createStatusScreenTransform({width=900,height=580,cssWidth,cssHeight,camera={zoom:1,offsetX:0,offsetY:0}}){
 if(![width,height,cssWidth,cssHeight,camera.zoom,camera.offsetX,camera.offsetY].every(Number.isFinite)||Math.min(width,height,cssWidth,cssHeight,camera.zoom)<=0)throw Error('Finite status screen transform required');
 const point=(x,y)=>({x:(x*camera.zoom+camera.offsetX)*cssWidth/width,y:(y*camera.zoom+camera.offsetY)*cssHeight/height});
 const rect=b=>bounds([[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>{const p=point(x,y);return [p.x,p.y];}));
 const logicalRect=b=>({x:b.x*cssWidth/width,y:b.y*cssHeight/height,width:b.width*cssWidth/width,height:b.height*cssHeight/height});
 return {point,rect,logicalRect,sy:height/580};
}
export function statusProtectedGeometry(frame,{bars=[],width=900,height=580,cssWidth,cssHeight,camera,visualScale=1,actorBounds=[],targeting=false,paused=false,enemyPresentation=null,measureText=text=>text.length*13}={}){
 const s=frame.snapshot,p=frame.projection,t=createStatusScreenTransform({width,height,cssWidth,cssHeight,camera}),actors=[...s.units,...s.enemies],barBorder=visualScale*camera.zoom,regions=bars.map(b=>({...t.logicalRect({x:b.x-barBorder,y:b.y-barBorder,width:b.width+2*barBorder,height:b.height+2*barBorder}),role:'hp',ownerId:b.id}));
 const add=(box,role,ownerId=null)=>regions.push({...t.rect(box),role,ownerId});
 for(const u of actors){
  // M1 wrapper has no facing option: exact base allies face +1. Do not reflect
  // its asymmetric clip for enemies or reuse it for evolved/boss artwork.
  const measured=actorBounds.find(b=>b.id===u.id&&b.type===u.type&&b.team===u.team);
  const local=measured||(u.team==='ally'&&base.has(u.type)?unitMotionBounds({x:0,y:0,r:18*visualScale}):{x:-112*visualScale,y:-160*visualScale,width:224*visualScale,height:192*visualScale});
  if(!measured?.empty)add({...local,x:u.x+local.x,y:u.y*t.sy+local.y},measured?'actor-observed':u.team==='ally'&&base.has(u.type)?'motion-clip':'legacy-conservative',u.id);
  // Existing soldier() danger outline and exclamation are outside drawUnit.
  if(u.hp>0&&u.team!=='enemy'&&u.hp/u.maxHp<=.3){const w=u.type==='boss'?62:u.type==='swarm'?30:38,y=u.type==='boss'?-94:u.type==='swarm'?-56:-73;add({x:u.x-28*visualScale,y:u.y*t.sy-10*visualScale,width:56*visualScale,height:24*visualScale},'danger-outline',u.id);add({x:u.x+(w/2)*visualScale,y:u.y*t.sy+(y-10)*visualScale,width:16*visualScale,height:20*visualScale},'danger-label',u.id);}
  if(u.hp>0&&(targeting&&u.team==='enemy'||u.id===s.focusTargetId&&s.tickCount<s.focusUntilTick))add({x:u.x-31*visualScale,y:u.y*t.sy-16*visualScale,width:62*visualScale,height:32*visualScale},'target',u.id);
 }
 const label=(text,x,y)=>{const w=measureText(text)+8;add({x:x-w/2,y:y-16,width:w,height:21},'warning-label');};
 for(const w of p.basicTelegraphs){if(w.left<=0||w.ownerAlive===false)continue;add({x:w.x-w.radius-6,y:(w.y-w.radius)*t.sy-6,width:w.radius*2+12,height:w.radius*2*t.sy+12},'basic-warning');label(`${w.team==='enemy'?'강타':'아군 강타'} · 고정 ${Math.ceil(Math.max(0,w.left)*10)/10}초`,w.x,Math.max(22,(w.y-w.radius)*t.sy-8));}
 if(enemyPresentation?.supported){
  if(enemyPresentation.battleId!==s.battleId||enemyPresentation.tickCount!==s.tickCount)throw Error('Enemy protection frame mismatch');
  for(const warning of enemyPresentation.telegraphs){const shape=warning.primitive;let b;if(shape.kind==='polygon')b=bounds(shape.points);else if(shape.kind==='target-marker')b={x:shape.x-shape.radiusX,y:shape.y-shape.radiusY,width:shape.radiusX*2,height:shape.radiusY*2};else if(shape.kind==='cone')b={x:shape.x-shape.radius,y:shape.y-shape.radius,width:shape.radius*2,height:shape.radius*2};else throw Error('Unknown enemy protection primitive');add({x:b.x-4,y:b.y*t.sy-4,width:b.width+8,height:b.height*t.sy+8},'enemy-warning',warning.targetId);}
 }
 for(const w of [...(enemyPresentation?.supported?[]:p.encounterTelegraphs),...p.ultimateTelegraphs]){if(Number.isFinite(w.resolveTick)&&w.resolveTick<s.tickCount)continue;const owner=actors.find(u=>u.id===w.ownerId);if(owner&&owner.hp<=0)continue;
  const shape=w.shape,shapes=['line','polygon'].includes(shape.kind)||shape.kind==='target'&&Number.isFinite(shape.x)?[shape]:ultimateShapePrimitives(shape,s);
  for(const sh of shapes){let b;if(sh.kind==='polygon')b=bounds(sh.points);else if(sh.kind==='line')b=bounds([[sh.x,sh.y],[sh.endX,sh.endY]]);else if(sh.kind==='target')b=bounds([[sh.x-23,sh.y-23],[sh.x+23,sh.y+23],[sh.origin.x,sh.origin.y]]);else if(['circle','cone'].includes(sh.kind))b={x:sh.x-sh.radius,y:sh.y-sh.radius,width:sh.radius*2,height:sh.radius*2};else throw Error('Unmapped warning protection');add({x:b.x-4,y:b.y*t.sy-4,width:b.width+8,height:b.height*t.sy+8},'warning');}
  if(shapes.length){const sh=shapes[0],point=sh.points?.[0]||[sh.x,sh.y],remain=Number.isFinite(w.resolveTick)?Math.ceil(Math.max(0,w.resolveTick-s.tickCount)/60*10)/10:null;label(`${w.name||(w.team==='ally'?'궁극기':'적 기술')}${remain===null?'':` · ${remain}초`}`,point[0],Math.max(22,point[1]*t.sy-28));}
 }
 if(paused)regions.push({...t.logicalRect({x:365,y:height/2-29,width:170,height:58}),role:'pause-panel'});
 return regions;
}
