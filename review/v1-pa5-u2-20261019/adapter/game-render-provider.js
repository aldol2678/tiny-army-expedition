// Observation only. Called inside the copied controller's existing withContent scope.
// Explicit primitive projection prevents raw actors, damage closures and Game methods escaping.
import {immutableCopy,invariant} from './data.js';
import {validateRenderProjection,RENDER_PROJECTION_VERSION} from './render-projection-adapter.js';
const EFFECT_FIELDS=['kind','x','y','tx','ty','life','max','color','text','effectKind','sourceId','targetId','ownerId'];
const SHAPE_FIELDS=['kind','x','y','radius','r','dx','dy','halfAngle','range','width','length','centered','targetId','endX','endY'];
function primitives(source,keys) {const out={};for(const key of keys)if(source[key]!==undefined){const value=source[key];invariant(value===null||['string','number','boolean'].includes(typeof value),'Nonprimitive render field '+key);out[key]=value;}return out;}
function copyShape(shape) {invariant(shape&&typeof shape==='object','Missing warning shape');const out=primitives(shape,SHAPE_FIELDS);for(const key of ['origin','direction'])if(shape[key])out[key]=primitives(shape[key],['x','y']);if(shape.targetIds)out.targetIds=Array.from(shape.targetIds);if(shape.points)out.points=Array.from(shape.points,p=>Array.from(p));return out;}
export function collectRenderProjection(game) {
 const tickCount=game.tickCount;
 const effects=Array.from(game.effects||[],e=>primitives(e,EFFECT_FIELDS));
 const basicTelegraphs=Array.from(game.telegraphs||[],t=>({...primitives(t,['team','x','y','radius','left','max']),kind:'slam',ownerId:t.owner?.id??null,ownerAlive:t.owner? t.owner.hp>0:true}));
 const encounterTelegraphs=Array.from(game.encounterTelegraphs||[],t=>({...primitives(t,['sourceId','targetId','announceTick','resolveTick','remainingTicks','name','icon']),kind:'encounter',id:t.actionId,ownerId:t.sourceId??null,team:'enemy',shape:copyShape(t.shape)}));
 const ultimateTelegraphs=Array.from(game.ultimateTelegraphs||[],t=>({...primitives(t,['sourceId','resolveTick','durationTicks']),kind:'ultimate',id:t.rootActionId,ownerId:t.sourceId??null,team:'ally',shape:copyShape(t.shape)}));
 // Optional upstream ids are genuinely optional; no manufactured gameplay identity.
 for(const list of [encounterTelegraphs,ultimateTelegraphs])for(const item of list)if(item.id===undefined)delete item.id;
 return validateRenderProjection({version:RENDER_PROJECTION_VERSION,battleId:game.battleId,tickCount,effects,basicTelegraphs,encounterTelegraphs,ultimateTelegraphs},game);
}
export function sampleGameRender(game,snapshot) {
 invariant(snapshot.battleId===game.battleId&&snapshot.tickCount===game.tickCount,'Nonatomic render sample');
 const projection=collectRenderProjection(game),unitSkillStates={};
 for(const unit of game.units){const state=game.unitSkillState?.(unit.id);if(state)unitSkillStates[unit.id]=primitives(state,['id','name','mana','maxMana','cost','remaining','ready','canCast']);}
 return immutableCopy({available:true,snapshot,projection,unitSkillStates});
}
