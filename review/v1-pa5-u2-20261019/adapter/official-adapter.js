import {invariant} from './data.js';
import {createOfficialViewModel} from './view-model.js';
import {previewFormationMove} from './slots.js';
// Composes the contracts; readPresentation is supplied by the future frozen core
// view adapter. No default cap, economy policy, legacy migration or live storage.
export function createOfficialAdapter({boundary,readPresentation}) {
 invariant(boundary&&typeof boundary.state==='function'&&typeof boundary.dispatch==='function','Command boundary required');
 invariant(typeof readPresentation==='function','Core presentation provider required');
 let selectedUnitId=null;
 function view() {const s=boundary.state();return createOfficialViewModel(s.run,{...readPresentation(s.run),locked:!s.canAdvance,selectedUnitId});}
 function select(unitId) {const v=view();if(!v.formation.editable)return false;const units=[...v.formation.cells.map(c=>c.unit).filter(Boolean),...v.formation.reserves];invariant(unitId===null||units.some(u=>u.id===unitId),'Unknown selection');selectedUnitId=unitId;return true;}
 async function move(toSlot,owner) {
  const v=view();if(!v.formation.editable||selectedUnitId===null)return false;
  const s=boundary.state(),action=previewFormationMove(s.run.state.roster,selectedUnitId,toSlot,v.formation.deploymentCap);
  const accepted=await boundary.dispatch(action,owner);if(accepted)selectedUnitId=null;return accepted;
 }
 return Object.freeze({view,owner:()=>boundary.owner(),select,move,dispatch:(action,owner)=>boundary.dispatch(action,owner),retry:()=>boundary.retry(),canAdvance:()=>boundary.canAdvance()});
}
