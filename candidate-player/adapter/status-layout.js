// U5 R2 display-only placement adapter. Exact R4 rotation/glyph sources stay
// unchanged. Candidate origin clears the owner's final CSS protection region;
// the association leader still terminates at the real official HP bar.
import {clipStatusLeader} from '../presentation/status-r4/status-placement.js';
import {overlaps} from '../presentation/status-r4/readability-layout.js';
const rect=b=>b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>=0&&b.height>=0;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const offsets=[0,-28,28,-40,40,-56,56,-80,80,-112,112];
const candidates=offsets.flatMap(dx=>offsets.map(dy=>({dx,dy,cost:dx*dx+dy*dy+(dy>0?40:0)}))).sort((a,b)=>a.cost-b.cost||a.dy-b.dy||a.dx-b.dx);
function association(box,bar,obstacles,width,height,gap){
 const anchor={x:bar.x+bar.width/2,y:bar.y-2},end={x:box.x+12,y:box.y+24<bar.y?box.y+25:box.y-1};
 let best={segments:[],visibleLength:0,totalLength:distance(anchor,end)};
 for(const mid of [{x:end.x,y:anchor.y},{x:anchor.x,y:end.y}]){
  const segments=[...clipStatusLeader(anchor,mid,obstacles),...clipStatusLeader(mid,end,obstacles)].filter(s=>s.a.x===s.b.x?s.a.x>=gap&&s.a.x<=width-gap:s.a.y>=gap&&s.a.y<=height-gap).map(s=>({a:{x:Math.max(gap,Math.min(width-gap,s.a.x)),y:Math.max(gap,Math.min(height-gap,s.a.y))},b:{x:Math.max(gap,Math.min(width-gap,s.b.x)),y:Math.max(gap,Math.min(height-gap,s.b.y))}})).filter(s=>distance(s.a,s.b)>=1);
  const visibleLength=segments.reduce((n,s)=>n+distance(s.a,s.b),0);if(visibleLength>best.visibleLength)best={segments,visibleLength,totalLength:distance(anchor,end)};
 }
 return best;
}
export function layoutProtectedStatusBadges({width,height,items,protectedRects=[],gap=4}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<48||height<48||!Number.isFinite(gap)||gap<2||gap>12||!Array.isArray(items)||items.length>128||!Array.isArray(protectedRects)||protectedRects.length>512||!protectedRects.every(rect))throw TypeError('Invalid bounded layout');
 const ids=new Set(),placed=[],unplaced=[],details=[];
 for(const item of [...items].sort((a,b)=>String(a.unitId).localeCompare(String(b.unitId)))){
  const f=item.frame;if(!rect(item.bar)||!f||f.unitId!==item.unitId||f.size!==24||ids.has(String(item.unitId))||!Array.isArray(f.detail)||f.detail.length>7)throw TypeError('Mismatched status owner/frame');ids.add(String(item.unitId));
  details.push({unitId:item.unitId,frameId:f.frameId,entries:f.detail.map(e=>({...e})),statusAvailableBadge:{label:'상태 있음',count:f.detail.length}});if(!f.entry)continue;
  const ownerTop=Math.min(item.bar.y,...protectedRects.filter(r=>r.ownerId===item.unitId&&['motion-clip','legacy-conservative','legacy-observed','actor-observed'].includes(r.role)).map(r=>r.y));
  const origin={x:item.bar.x+item.bar.width/2-12,y:ownerTop-gap-24};
  const obstacles=[...protectedRects,...placed.flatMap(p=>[p.box,...p.leaderSegments.map(s=>({x:Math.min(s.a.x,s.b.x)-.4,y:Math.min(s.a.y,s.b.y)-.4,width:Math.max(.8,Math.abs(s.a.x-s.b.x)+.8),height:Math.max(.8,Math.abs(s.a.y-s.b.y)+.8)}))])];
  let chosen=null,foundInside=false;const rejected={viewport:0,protected:0,association:0};
  for(const {dx,dy}of candidates){const box={x:origin.x+dx,y:origin.y+dy,width:24,height:24};if(box.x<gap||box.y<gap||box.x+24>width-gap||box.y+24>height-gap){rejected.viewport++;continue;}foundInside=true;if(obstacles.some(b=>overlaps(box,b,2))){rejected.protected++;continue;}
   const l=association(box,item.bar,obstacles,width,height,gap),shifted=dx!==0||dy!==0||ownerTop!==item.bar.y;
   if(shifted&&(l.visibleLength<8||l.visibleLength/Math.max(1,l.totalLength)<.2)){rejected.association++;continue;}
   chosen={unitId:item.unitId,frameId:f.frameId,entry:{...f.entry},box,origin,ownerProtectionTop:ownerTop,offset:{x:dx,y:dy},leaderSegments:l.segments,leaderWidth:.8,leaderLayer:'BELOW_PROTECTED_FOREGROUND',leaderVisibleFraction:l.totalLength?l.visibleLength/l.totalLength:1};break;
  }
  if(chosen)placed.push(chosen);else unplaced.push({unitId:item.unitId,frameId:f.frameId,reason:foundInside?'NO_SAFE_ASSOCIATED_SLOT':'VIEWPORT_EDGE',origin,ownerProtectionTop:ownerTop,rejected,detailAvailable:true,statusAvailableBadge:{label:'상태 있음',count:f.detail.length},acknowledgePresented:false});
 }
 return {placed,unplaced,details,size:24,candidateLimitPerOwner:candidates.length,maxOffsetPerAxis:112,anchorPolicy:'OWNER_CSS_PROTECTION_TOP_WITH_REAL_HP_LEADER',policy:'ONE_ROTATING_BADGE_NOT_STACKED',detailPolicy:'FULL_LIST_ON_UNIT_DETAIL',outsideListMandatory:false};
}
