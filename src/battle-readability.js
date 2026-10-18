/* Tiny Army Battle Readability 0.7.1. Rendering only: no simulation writes,
 * RNG, timers, particles, or stored layout state. All coordinates are
 * logical canvas pixels: engine x, engine y * height/580, visual scale only.
 * Bars use a bounded nearest-free search. Impossible tiny/dense viewports may
 * overlap; `crowded` explicitly reports that fallback instead of hiding units.
 */
(function (host) {
 'use strict';
 const finite=(n,f)=>Number.isFinite(n)?n:f;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const alive=u=>u&&u.hp>0&&Number.isFinite(u.x)&&Number.isFinite(u.y);
 function metrics(o={}) {return {width:Math.max(1,finite(o.width,900)),height:Math.max(1,finite(o.height,580)),scale:clamp(finite(o.scale,1),.5,2)}}
 // A render transform only: all simulation coordinates and targeting radii stay intact.
 // The caller owns prior-frame state. Telegraph extents participate in the fit;
 // broad formations retain the identity view rather than shrinking the army.
 function frameActors(o={}) {
  const m=metrics(o),sy=m.height/580,s=m.scale,identity={zoom:1,offsetX:0,offsetY:0};
  const actors=[...(o.units||[]),...(o.enemies||[])].filter(alive).slice(0,128);
  if(!actors.length)return identity;
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  const include=(x,y,rx,above,below)=>{left=Math.min(left,x-rx);right=Math.max(right,x+rx);top=Math.min(top,y-above);bottom=Math.max(bottom,y+below)};
  // Reserve headroom for health-bar lanes, weapons and ground markers.
  for(const u of actors)include(u.x,u.y*sy,(u.type==='boss'?74:56)*s,(u.type==='boss'?146:120)*s,42*s);
  for(const t of (o.telegraphs||[]).slice(0,128))if(t&&Number.isFinite(t.x)&&Number.isFinite(t.y)&&Number.isFinite(t.radius)&&t.radius>=0&&t.left>0)include(t.x,t.y*sy,t.radius+12,t.radius*sy+30,t.radius*sy+12);
  const pad=Math.min(24,Math.min(m.width,m.height)*.04),fit=Math.min((m.width-2*pad)/Math.max(1,right-left),(m.height-2*pad)/Math.max(1,bottom-top));
  const targetZoom=clamp(fit,1,1.25);
  if(targetZoom<=1)return identity;
  // Zoom out immediately if needed to keep new threats visible; ease only inward.
  const previous=o.previous,alpha=1-Math.exp(-6*clamp(finite(o.dt,1),0,1));
  const zoom=previous?Math.min(targetZoom,clamp(finite(previous.zoom,1),1,1.25)+(targetZoom-clamp(finite(previous.zoom,1),1,1.25))*alpha):targetZoom;
  const axis=(lo,hi,size,prior)=>{
   const min=pad-lo*zoom,max=size-pad-hi*zoom,target=clamp(size/2-(lo+hi)*zoom/2,Math.min(min,max),Math.max(min,max));
   // Fit constraints take priority over easing when an actor enters at the edge.
   return clamp(previous?finite(prior,target)+(target-finite(prior,target))*alpha:target,Math.min(min,max),Math.max(min,max));
  };
  return {zoom,offsetX:axis(left,right,m.width,previous?.offsetX),offsetY:axis(top,bottom,m.height,previous?.offsetY)};
 }
 function projectPoint(x,y,o={}) {
  const m=metrics(o),f=o.frame||{},z=clamp(finite(f.zoom,1),1,1.25);
  return {x:finite(x,0)*z+finite(f.offsetX,0),y:finite(y,0)*m.height/580*z+finite(f.offsetY,0)};
 }
 function unprojectPoint(x,y,o={}) {
  const m=metrics(o),f=o.frame||{},z=clamp(finite(f.zoom,1),1,1.25);
  return {x:(finite(x,0)-finite(f.offsetX,0))/z,y:(finite(y,0)-finite(f.offsetY,0))/z*580/m.height};
 }
 function intersects(a,b,gap=0){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y}
 function layoutBars(o={}) {
  const m=metrics(o),sy=m.height/580,s=m.scale*clamp(finite(o.frame?.zoom,1),1,1.25),pad=Math.min(4*s,m.width/4,m.height/4),gap=2*s;
  const input=[...(o.units||[]),...(o.enemies||[])].filter(alive).slice(0,128);
  // Stable identity ordering prevents depth-sort changes from swapping lanes.
  const ordered=input.map((u,i)=>({u,i})).sort((a,b)=>String(a.u.team).localeCompare(String(b.u.team))||finite(a.u.id,a.i)-finite(b.u.id,b.i)||a.i-b.i);
  const placed=[];
  for(const {u} of ordered){
   const w=Math.min((u.type==='boss'?62:u.type==='swarm'?30:38)*s,m.width-2*pad),h=Math.min(6*s,m.height-2*pad);
   const point=projectPoint(u.x,u.y,o);
   const ax=clamp(point.x,pad,m.width-pad),ay=clamp(point.y-(u.type==='boss'?94:u.type==='swarm'?56:73)*s,pad,m.height-pad-h);
   const baseX=clamp(ax-w/2,pad,m.width-pad-w),baseY=ay;
   const candidate=(dx,dy)=>({x:clamp(baseX+dx,pad,m.width-pad-w),y:clamp(baseY+dy,pad,m.height-pad-h),width:w,height:h});
   let chosen=null,best=null,bestScore=Infinity;
   // 81 candidates maximum per bar, never iterative physical separation.
   for(let ring=0;ring<=10&&!chosen;ring++){
    const offsets=ring===0?[[0,0]]:[[0,-ring*(h+gap)],[0,ring*(h+gap)],[-ring*12*s,0],[ring*12*s,0],[-ring*12*s,-ring*(h+gap)],[ring*12*s,-ring*(h+gap)],[-ring*12*s,ring*(h+gap)],[ring*12*s,ring*(h+gap)]];
    for(const [dx,dy] of offsets){const c=candidate(dx,dy),hits=placed.filter(b=>intersects(c,b,gap));if(!hits.length){chosen=c;break}const area=hits.reduce((n,b)=>n+Math.max(0,Math.min(c.x+w,b.x+b.width)+gap-Math.max(c.x,b.x))*Math.max(0,Math.min(c.y+h,b.y+b.height)+gap-Math.max(c.y,b.y)),0),score=area*1000+dx*dx+dy*dy;if(score<bestScore){bestScore=score;best=c}}
   }
   const rect=chosen||best||candidate(0,0),ratio=clamp(finite(u.hp/Math.max(.001,finite(u.maxHp,1)),0),0,1);
   placed.push({...rect,id:u.id,team:u.team,ratio,danger:u.team!=='enemy'&&ratio<=.3,anchorX:ax,anchorY:ay+h/2,displaced:Math.abs(rect.x-baseX)+Math.abs(rect.y-baseY)>1,crowded:!chosen});
  }
  return placed;
 }
 // Same strict threshold, original array tie-break and non-guardian target rule
 // as Engine.hit. These indicate current coverage, never a promised future block.
 function guardianLinks(units=[]) {
  const guardians=units.filter(u=>alive(u)&&u.type==='guardian'),links=[];
  for(const target of units){if(!alive(target)||target.team!=='ally'||target.type==='guardian')continue;let source=null,distance=155;for(const g of guardians){const d=Math.hypot(g.x-target.x,g.y-target.y);if(d<distance){source=g;distance=d}}if(source)links.push({sourceId:source.id,targetId:target.id,x:source.x,y:source.y,tx:target.x,ty:target.y,distance})}
  return links;
 }
 // Effects carry committed heal coordinates, not predictive patient selection.
 function healHighlights(effects=[]) {return effects.filter(e=>e&&e.kind==='heal'&&e.life>0&&Number.isFinite(e.tx)&&Number.isFinite(e.ty)).slice(0,64).map(e=>({x:e.tx,y:e.ty,strength:clamp(finite(e.life/e.max,1),.25,1)}))}
 function segment(ctx,x,y,tx,ty){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke()}
 function drawLinks(ctx,o={}) {
  if(!ctx)return;const m=metrics(o),sy=m.height/580,s=m.scale;ctx.save();
  ctx.lineWidth=1.4*s;ctx.strokeStyle='#327f93';ctx.globalAlpha=.34;
  for(const link of guardianLinks(o.units)){segment(ctx,link.x,link.y*sy-4*s,link.tx,link.ty*sy-4*s);ctx.fillStyle='#327f93';ctx.fillRect(link.tx-2*s,link.ty*sy-6*s,4*s,4*s)}
  ctx.restore();
 }
 function drawHealing(ctx,o={}) {
  if(!ctx)return;const m=metrics(o),sy=m.height/580,s=m.scale;ctx.save();
  ctx.strokeStyle='#19775a';ctx.lineWidth=2*s;
  for(const h of healHighlights(o.effects)){ctx.globalAlpha=.55+.35*h.strength;const y=h.y*sy-26*s;segment(ctx,h.x-4*s,y,h.x+4*s,y);segment(ctx,h.x,y-4*s,h.x,y+4*s)}
  ctx.restore();
 }
 function drawBars(ctx,o={}) {
  const bars=layoutBars(o);if(!ctx)return bars;const s=metrics(o).scale*clamp(finite(o.frame?.zoom,1),1,1.25);ctx.save();ctx.lineWidth=s;
  for(const b of bars){if(!b.displaced)continue;ctx.globalAlpha=.65;ctx.strokeStyle=b.team==='enemy'?'#8c6252':'#39716a';segment(ctx,clamp(b.anchorX,b.x,b.x+b.width),clamp(b.anchorY,b.y,b.y+b.height),b.anchorX,b.anchorY)}
  ctx.globalAlpha=1;
  for(const b of bars){ctx.fillStyle='#263e38';ctx.fillRect(b.x-s,b.y-s,b.width+2*s,b.height+2*s);ctx.fillStyle='#fffbed';ctx.fillRect(b.x,b.y,b.width,b.height);ctx.fillStyle=b.team==='enemy'?'#b65c4a':b.danger?'#bb4c35':'#176f65';ctx.fillRect(b.x,b.y,b.width*b.ratio,b.height);if(b.danger){ctx.fillStyle='#fffbed';ctx.fillRect(b.x+1*s,b.y+1*s,Math.min(2*s,b.width),Math.max(0,b.height-2*s))}}
  ctx.restore();return bars;
 }
 const api=Object.freeze({version:'0.7.1',frameActors,projectPoint,unprojectPoint,layoutBars,guardianLinks,healHighlights,drawLinks,drawHealing,drawBars});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;host.TinyArmyBattleReadability=api;
})(typeof globalThis!=='undefined'?globalThis:this);
