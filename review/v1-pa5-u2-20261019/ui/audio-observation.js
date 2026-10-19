import {immutableCopy} from '../adapter/data.js';
// Adapt only already-copied primitives to exact v6's old observation shape.
// No Game object, owner reference, timers, RNG, tick or durable cue is exposed.
export function audioObservation(frame){
 const s=frame?.snapshot;if(!s)return null;
 const enemies=(s.enemies||[]).map(e=>({id:e.id,type:e.type,hp:e.hp,encounterRole:e.encounterRole??null}));
 const telegraphs=(frame.projection?.basicTelegraphs||[]).map(t=>{const owner=enemies.find(e=>e.id===t.ownerId);return {team:t.team,x:t.x,y:t.y,radius:t.radius,left:t.left,owner:owner?{id:owner.id,type:owner.type,hp:t.ownerAlive===false?0:owner.hp}:null};});
 return immutableCopy({phase:s.phase,battleId:s.battleId,tickCount:s.tickCount,enemies,encounterTelegraphs:(s.encounterTelegraphs||[]).map(t=>({actionId:t.actionId,sourceId:t.sourceId,remainingTicks:t.remainingTicks})),telegraphs});
}
