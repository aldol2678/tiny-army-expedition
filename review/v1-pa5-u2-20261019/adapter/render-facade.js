import {immutableCopy,invariant} from './data.js';
import {validateRenderProjection} from './render-projection-adapter.js';
// Game-shaped read facade for the ORIGINAL draw functions, never a Game instance.
export function createRenderFacade(input) {
 invariant(input?.available===true,'Atomic render sample required');
 const frame=immutableCopy(input),s=frame.snapshot,p=validateRenderProjection(frame.projection,s);
 invariant(Array.isArray(s.units)&&Array.isArray(s.enemies),'Actor snapshot required');
 const telegraphs=p.basicTelegraphs.map(t=>Object.freeze({...t,owner:Object.freeze({id:t.ownerId,hp:t.ownerAlive===false?0:1})}));
 // Compatibility owner contains only copied id/alive flag, not a live actor.
 return Object.freeze({...s,effects:p.effects,telegraphs:Object.freeze(telegraphs),encounterTelegraphs:p.encounterTelegraphs,ultimateTelegraphs:p.ultimateTelegraphs,
  alive:team=>(team==='ally'?s.units:s.enemies).filter(u=>u.hp>0),
  focusTarget:()=>s.tickCount<s.focusUntilTick?s.enemies.find(u=>u.id===s.focusTargetId&&u.hp>0)||null:null,
  unitSkillState:id=>frame.unitSkillStates?.[id]||null,
  measureHP:()=>{const total=s.units.reduce((sum,u)=>sum+u.maxHp,0);return total?s.units.reduce((sum,u)=>sum+Math.max(0,u.hp),0)/total:0;}
 });
}
