// R4 bounded staging search. Badge boxes never overlap protected scene regions.
// Thin owner leaders are clipped beneath those regions, not painted over HP/art/warnings.
import {overlaps} from './readability-layout.js';
const rect=b=>b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>=0&&b.height>=0;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export function clipStatusLeader(a,b,obstacles){
 const vertical=a.x===b.x;if(!vertical&&a.y!==b.y)throw new TypeError('Orthogonal leader only');const start=vertical?Math.min(a.y,b.y):Math.min(a.x,b.x),end=vertical?Math.max(a.y,b.y):Math.max(a.x,b.x),fixed=vertical?a.x:a.y;let intervals=[[start,end]];
 for(const o of obstacles){const pad=1,lo=vertical?o.y-pad:o.x-pad,hi=vertical?o.y+o.height+pad:o.x+o.width+pad,crossLo=vertical?o.x-pad:o.y-pad,crossHi=vertical?o.x+o.width+pad:o.y+o.height+pad;if(fixed<crossLo||fixed>crossHi)continue;intervals=intervals.flatMap(([l,h])=>hi<=l||lo>=h?[[l,h]]:[[l,Math.min(h,lo)],[Math.max(l,hi),h]].filter(([x,y])=>y-x>=1));}
 return intervals.filter(([l,h])=>h-l>=1).map(([l,h])=>vertical?{a:{x:fixed,y:l},b:{x:fixed,y:h}}:{a:{x:l,y:fixed},b:{x:h,y:fixed}});
}
function leader(box,bar,obstacles,width,height,gap){
 const anchor={x:bar.x+bar.width/2,y:bar.y-2},end={x:box.x+12,y:box.y+24<bar.y?box.y+25:box.y-1};const paths=[[anchor,{x:end.x,y:anchor.y},end],[anchor,{x:anchor.x,y:end.y},end]];let best={segments:[],visibleLength:0,totalLength:distance(anchor,end)};
 const inViewport=segments=>segments.filter(s=>s.a.x===s.b.x?s.a.x>=gap&&s.a.x<=width-gap:s.a.y>=gap&&s.a.y<=height-gap).map(s=>({a:{x:Math.max(gap,Math.min(width-gap,s.a.x)),y:Math.max(gap,Math.min(height-gap,s.a.y))},b:{x:Math.max(gap,Math.min(width-gap,s.b.x)),y:Math.max(gap,Math.min(height-gap,s.b.y))}})).filter(s=>distance(s.a,s.b)>=1);
 for(const p of paths){const segments=inViewport([...clipStatusLeader(p[0],p[1],obstacles),...clipStatusLeader(p[1],p[2],obstacles)]),visibleLength=segments.reduce((n,s)=>n+distance(s.a,s.b),0);if(visibleLength>best.visibleLength)best={segments,visibleLength,totalLength:distance(anchor,end)};}return best;
}
const offsets=[0,-28,28,-40,40,-56,56];const candidates=offsets.flatMap(dx=>offsets.map(dy=>({dx,dy,cost:dx*dx+dy*dy+(dy>0?40:0)}))).sort((a,b)=>a.cost-b.cost||a.dy-b.dy||a.dx-b.dx);
export function layoutRotatingStatusBadges({width,height,items,protectedRects=[],gap=4}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<48||height<48||!Number.isFinite(gap)||gap<2||gap>12||!Array.isArray(items)||items.length>128||!Array.isArray(protectedRects)||protectedRects.length>512||!protectedRects.every(rect))throw new TypeError('Invalid bounded layout');
 const ids=new Set(),placed=[],unplaced=[],details=[];
 for(const item of [...items].sort((a,b)=>String(a.unitId).localeCompare(String(b.unitId)))){
  const f=item.frame;if(!rect(item.bar)||!f||f.unitId!==item.unitId||f.size!==24||ids.has(String(item.unitId))||!Array.isArray(f.detail)||f.detail.length>7)throw new TypeError('Mismatched status owner/frame');ids.add(String(item.unitId));
  details.push({unitId:item.unitId,frameId:f.frameId,entries:f.detail.map(e=>({...e})),statusAvailableBadge:{label:'상태 있음',count:f.detail.length}});if(!f.entry)continue;
  const origin={x:item.bar.x+item.bar.width/2-12,y:item.bar.y-gap-24};let chosen=null,foundInside=false;
  const obstacles=[...protectedRects,...placed.flatMap(p=>[p.box,...p.leaderSegments.map(s=>({x:Math.min(s.a.x,s.b.x)-.4,y:Math.min(s.a.y,s.b.y)-.4,width:Math.max(.8,Math.abs(s.a.x-s.b.x)+.8),height:Math.max(.8,Math.abs(s.a.y-s.b.y)+.8)}))])];
  for(const {dx,dy} of candidates){const box={x:origin.x+dx,y:origin.y+dy,width:24,height:24};const inside=box.x>=gap&&box.y>=gap&&box.x+24<=width-gap&&box.y+24<=height-gap;if(!inside)continue;foundInside=true;if(obstacles.some(b=>overlaps(box,b,2)))continue;const l=leader(box,item.bar,obstacles,width,height,gap);const shifted=dx!==0||dy!==0;
   // A distant badge without a meaningful visible owner cue is not silently accepted.
   if(shifted&&(l.visibleLength<8||l.visibleLength/Math.max(1,l.totalLength)<.2))continue;
   chosen={unitId:item.unitId,frameId:f.frameId,entry:{...f.entry},box,offset:{x:dx,y:dy},leaderSegments:l.segments,leaderWidth:.8,leaderLayer:'BELOW_PROTECTED_FOREGROUND',leaderVisibleFraction:l.totalLength?l.visibleLength/l.totalLength:1};break;
  }
  if(chosen)placed.push(chosen);else unplaced.push({unitId:item.unitId,frameId:f.frameId,reason:foundInside?'NO_SAFE_ASSOCIATED_SLOT':'VIEWPORT_EDGE',detailAvailable:true,statusAvailableBadge:{label:'상태 있음',count:f.detail.length},acknowledgePresented:false});
 }
 return {placed,unplaced,details,size:24,candidateLimitPerOwner:candidates.length,maxOffsetPerAxis:56,policy:'ONE_ROTATING_BADGE_NOT_STACKED',detailPolicy:'FULL_LIST_ON_UNIT_DETAIL',outsideListMandatory:false};
}
