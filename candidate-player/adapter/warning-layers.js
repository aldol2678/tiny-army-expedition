import {invariant} from './data.js';
import {ultimateShapePrimitives} from '../core/browser-event-ui/battle-view.js';
const finitePoint=(x,y)=>Number.isFinite(x)&&Number.isFinite(y);
function shapes(t,snapshot) {
 const shape=t.shape;
 if(shape.kind==='target'&&finitePoint(shape.x,shape.y))return [shape];
 if(shape.kind==='line'||shape.kind==='polygon')return [shape];
 return ultimateShapePrimitives(shape,snapshot);
}
function path(ctx,s) {
 ctx.beginPath();
 if(s.kind==='polygon'){invariant(s.points.length>=3&&s.points.every(p=>finitePoint(...p)),'Invalid warning polygon');ctx.moveTo(...s.points[0]);for(const p of s.points.slice(1))ctx.lineTo(...p);ctx.closePath();}
 else if(s.kind==='circle'){invariant(finitePoint(s.x,s.y)&&Number.isFinite(s.radius)&&s.radius>=0,'Invalid warning circle');ctx.arc(s.x,s.y,s.radius,0,Math.PI*2);}
 else if(s.kind==='cone'){invariant([s.x,s.y,s.dx,s.dy,s.radius,s.halfAngle].every(Number.isFinite),'Invalid warning cone');const a=Math.atan2(s.dy,s.dx);ctx.moveTo(s.x,s.y);ctx.arc(s.x,s.y,s.radius,a-s.halfAngle,a+s.halfAngle);ctx.closePath();}
 else if(s.kind==='target'){invariant(finitePoint(s.x,s.y)&&finitePoint(s.origin.x,s.origin.y),'Invalid warning target');ctx.arc(s.x,s.y,21,0,Math.PI*2);ctx.moveTo(s.origin.x,s.origin.y);ctx.lineTo(s.x,s.y);}
 else if(s.kind==='line'){invariant([s.x,s.y,s.endX,s.endY].every(Number.isFinite),'Invalid warning line');ctx.moveTo(s.x,s.y);ctx.lineTo(s.endX,s.endY);}
 else throw Error('Unsupported warning primitive');
}
export function drawAdditionalWarnings(ctx,snapshot,sy,foreground,{seconds=n=>String(n),step=1/60}={}) {
 let count=0;
 for(const group of ['encounterTelegraphs','ultimateTelegraphs'])for(const t of snapshot[group]||[]){
  if(Number.isFinite(t.resolveTick)&&t.resolveTick<snapshot.tickCount)continue;
  const owner=[...snapshot.units,...snapshot.enemies].find(u=>u.id===t.ownerId);
  if(owner&&owner.hp<=0)continue;
  const enemy=t.team==='enemy',list=shapes(t,snapshot);
  ctx.save();ctx.scale(1,sy);ctx.fillStyle=enemy?'#d35f4e25':'#e6ad4f2b';ctx.strokeStyle=enemy?'#a7392d':'#94651e';ctx.lineWidth=3;
  for(const s of list){path(ctx,s);if(foreground)ctx.stroke();else ctx.fill();count++;}
  ctx.restore();
  if(foreground&&list.length){const s=list[0],point=s.points?.[0]||[s.x,s.y];ctx.save();ctx.fillStyle=enemy?'#8a2e20':'#765018';ctx.font='bold 13px "Army Pretendard", sans-serif';ctx.textAlign='center';const remaining=Number.isFinite(t.resolveTick)?Math.max(0,t.resolveTick-snapshot.tickCount)*step:null;ctx.fillText(`${t.name||(group==='ultimateTelegraphs'?'궁극기':'적 기술')}${remaining===null?'':` · ${seconds(remaining)}`}`,point[0],Math.max(22,point[1]*sy-28));ctx.restore();}
 }
 return count;
}
