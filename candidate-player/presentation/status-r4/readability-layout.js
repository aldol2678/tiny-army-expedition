// Staging-only layout proposal. Not connected to the game. No state, clocks or authority.
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const overlaps=(a,b,gap=0)=>a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;
export function layoutStatusStaging({width,height,items,protectedRects=[],size=24,gap=4}){
 if(!finite(gap)||gap<0||gap>12)throw new TypeError('Invalid gap');
 if(!finite(width)||!finite(height)||width<48||height<48||![24,32,48].includes(size)||!Array.isArray(items)||items.length>128||!Array.isArray(protectedRects)||protectedRects.length>512)throw new TypeError('Bounded staging input required');
 const validRect=b=>b&&['x','y','width','height'].every(k=>finite(b[k]))&&b.width>=0&&b.height>=0;
 if(!protectedRects.every(validRect))throw new TypeError('Invalid protected region');
 const seen=new Set(),placed=[],rail=[];
 for(const item of [...items].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
  if(!item||seen.has(String(item.id))||!validRect(item.bar)||!Array.isArray(item.statuses)||item.statuses.length<1||item.statuses.length>7||!item.statuses.every(s=>['confusion','stun','silence','curse','weakness','slow','cleanse'].includes(s)))throw new TypeError('Invalid status owner');seen.add(String(item.id));
  // Multiple simultaneous effects are listed, never piled up over a soldier.
  if(item.statuses.length!==1){rail.push({id:item.id,bar:{...item.bar},statuses:[...item.statuses],reason:'MULTIPLE_STATUSES'});continue;}
  const box={x:item.bar.x+item.bar.width/2-size/2,y:item.bar.y-gap-size,width:size,height:size};
  const inside=box.x>=gap&&box.y>=gap&&box.x+size<=width-gap&&box.y+size<=height-gap;
  const collision=protectedRects.some(b=>overlaps(box,b,2))||placed.some(p=>overlaps(box,p.box,2));
  if(inside&&!collision)placed.push({id:item.id,status:item.statuses[0],box});else rail.push({id:item.id,bar:{...item.bar},statuses:[...item.statuses],reason:inside?'PROTECTED_REGION':'VIEWPORT_EDGE'});
 }
 return {placed,rail,fieldSize:size,railOutsideBattle:true};
}
