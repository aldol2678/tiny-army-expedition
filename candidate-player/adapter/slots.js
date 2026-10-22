import {invariant,immutableCopy} from './data.js';
export const OFFICIAL_SLOT_ORDER=Object.freeze([8,4,0,9,5,1,10,6,2,11,7,3]);
export const FORMATION_COLUMNS=Object.freeze(['후열','중열','전열']);
export function visualSlot(index) { invariant(Number.isInteger(index)&&index>=0&&index<12,'Invalid visual index'); return OFFICIAL_SLOT_ORDER[index]; }
export function visualPosition(slot) { invariant(Number.isInteger(slot)&&slot>=0&&slot<12,'Invalid raw slot');const index=OFFICIAL_SLOT_ORDER.indexOf(slot);return Object.freeze({index,row:Math.floor(index/3),col:index%3,slot}); }
export function validateRosterSlots(roster) {
 invariant(Array.isArray(roster),'Roster required'); const ids=new Set(),slots=new Set();
 for(const u of roster) { invariant(Number.isSafeInteger(u.id)&&u.id>0&&!ids.has(u.id),'Duplicate/invalid unit ID');ids.add(u.id);invariant(u.slot===null||Number.isInteger(u.slot)&&u.slot>=0&&u.slot<12,'Invalid raw slot');if(u.slot!==null){invariant(!slots.has(u.slot),'Duplicate occupied slot');slots.add(u.slot);} }
 return true;
}
export function previewFormationMove(roster,unitId,toSlot,deploymentCap) {
 validateRosterSlots(roster);invariant(Number.isInteger(deploymentCap)&&deploymentCap>=1&&deploymentCap<=12,'Explicit core deployment cap required');
 invariant(toSlot===null||Number.isInteger(toSlot)&&toSlot>=0&&toSlot<12,'Invalid destination');
 const current=roster.find(u=>u.id===unitId);invariant(current,'Unknown unit');
 const next=roster.map(u=>({unitId:u.id,slot:u.slot})),moving=next.find(u=>u.unitId===unitId);
 if(toSlot!==current.slot) { const other=toSlot===null?null:next.find(u=>u.slot===toSlot);if(other)other.slot=current.slot;moving.slot=toSlot; }
 const count=next.filter(u=>u.slot!==null).length;invariant(count>=1&&count<=deploymentCap,'Deployment cap exceeded or empty formation');
 return immutableCopy({type:'setFormation',slots:next});
}
