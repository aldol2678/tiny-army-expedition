import {immutableCopy,invariant,exactKeys} from './data.js';
export const RENDER_PROJECTION_VERSION='official-render-projection-2';
const GROUPS=['effects','basicTelegraphs','encounterTelegraphs','ultimateTelegraphs'];
const NUMERIC_ITEM_KEYS=['x','y','tx','ty','radius','left','max','life','startTick','endTick','announceTick','resolveTick','remainingTicks','durationTicks'];
const SHAPE_NUMBERS=['x','y','radius','r','dx','dy','halfAngle','range','width','length','endX','endY'];
const ITEM_KEYS=['id','kind','ownerId','sourceId','targetId','team','x','y','tx','ty','radius','left','max','life','color','text','shape','startTick','endTick','effectKind','ownerAlive','announceTick','resolveTick','remainingTicks','durationTicks','name','icon'];
function checkShape(shape,depth=0) {
 invariant(depth<5,'Shape too deep');
 if(shape===null)return;
 invariant(shape&&typeof shape==='object','Shape required');
 exactKeys(shape,['kind','x','y','radius','r','dx','dy','halfAngle','range','width','length','centered','targetId','targetIds','origin','direction','endX','endY','points']);
 invariant(['circle','cone','target','targets','linked','rectangle','segment','line','polygon'].includes(shape.kind),'Unknown render shape');
 for(const key of SHAPE_NUMBERS)if(shape[key]!==undefined)invariant(typeof shape[key]==='number'&&Number.isFinite(shape[key]),'Invalid shape number');
 if(shape.centered!==undefined)invariant(typeof shape.centered==='boolean','Invalid centered flag');
 if(shape.targetId!==undefined)invariant(Number.isSafeInteger(shape.targetId)||typeof shape.targetId==='string','Invalid target ID');
 for(const key of ['origin','direction'])if(shape[key]!==undefined){exactKeys(shape[key],['x','y']);for(const v of Object.values(shape[key]))invariant(typeof v==='number'&&Number.isFinite(v),'Invalid shape vector');}
 if(shape.targetIds!==undefined)invariant(Array.isArray(shape.targetIds)&&shape.targetIds.length<=4096&&shape.targetIds.every(x=>Number.isSafeInteger(x)||typeof x==='string'),'Invalid target IDs');
 if(shape.points!==undefined)invariant(Array.isArray(shape.points)&&shape.points.length<=64&&shape.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)),'Invalid polygon');
}
export function validateRenderProjection(input,{battleId,tickCount}) {
 const data=immutableCopy(input);exactKeys(data,['version','battleId','tickCount',...GROUPS]);
 invariant(data.version===RENDER_PROJECTION_VERSION,'Unsupported render projection');
 invariant(typeof data.battleId==='string'&&data.battleId===battleId,'Mismatched render battle');
 invariant(Number.isSafeInteger(data.tickCount)&&data.tickCount>=0&&data.tickCount===tickCount,'Mismatched render tick');
 for(const group of GROUPS){invariant(Array.isArray(data[group])&&data[group].length<=4096,'Missing/unbounded render group: '+group);
  for(const item of data[group]){exactKeys(item,ITEM_KEYS);invariant(typeof item.kind==='string'&&item.kind.length<=80,'Render kind required');
   for(const [key,value] of Object.entries(item)){
    if(key==='shape'){checkShape(value);continue;}
    invariant(value===null||['number','string','boolean'].includes(typeof value),'Primitive render field required');
    if(NUMERIC_ITEM_KEYS.includes(key))invariant(typeof value==='number'&&Number.isFinite(value),'Invalid render number');
    if(key==='ownerAlive')invariant(typeof value==='boolean','Invalid owner alive flag');
    if(['color','text','team','effectKind','name','icon'].includes(key))invariant(typeof value==='string','Invalid render text');
    if(typeof value==='string')invariant(value.length<=512,'Render text too long');
    if(['ownerId','sourceId','targetId'].includes(key))invariant(value===null||Number.isSafeInteger(value)||typeof value==='string','Stable owner ID required');
   }
  }
 }
 return data;
}
// Compatibility wrapper for externally supplied projection readers. R2's copied
// controller also exposes an atomic renderSnapshot() via game-render-provider.js.
// Frozen PI2 itself still has no provider; neither path changes gameplay state.
export function attachRenderProjection(controller,readProjection) {
 invariant(controller&&typeof controller.snapshot==='function','Controller snapshot required');
 return Object.freeze({available:typeof readProjection==='function',renderSnapshot(){
  if(typeof readProjection!=='function')return Object.freeze({available:false,reason:'RENDER_PROJECTION_PROVIDER_REQUIRED'});
  const snapshot=immutableCopy(controller.snapshot());
  const projection=validateRenderProjection(readProjection(Object.freeze({battleId:snapshot.battleId,tickCount:snapshot.tickCount})),snapshot);
  return immutableCopy({available:true,snapshot,projection});
 }});
}
