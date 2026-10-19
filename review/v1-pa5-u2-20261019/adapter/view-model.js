import {immutableCopy,invariant} from './data.js';
import {OFFICIAL_SLOT_ORDER,FORMATION_COLUMNS,validateRosterSlots} from './slots.js';
export function createOfficialViewModel(run,{deploymentCap,unitLabels={},projectedUnits={},profile=null,locked=false,selectedUnitId=null}={}) {
 invariant(run && typeof run.runId==='string' && Number.isSafeInteger(run.revision),'Runtime identity required');
 const s=run.state;invariant(s && Array.isArray(run.graphs) && run.graphs.length>0,'Runtime state/graphs required');validateRosterSlots(s.roster);
 invariant(Number.isInteger(deploymentCap)&&deploymentCap>=1&&deploymentCap<=12,'Core deployment cap must be supplied');
 invariant(Number.isInteger(s.chapter)&&s.chapter>=1&&s.chapter<=run.graphs.length,'Invalid chapter');
 const editable=['map','prepare'].includes(s.phase)&&!s.pendingBattle&&!locked;
 const units=s.roster.map(u=>{
  invariant(Number.isFinite(u.condition)&&u.condition>=0&&u.condition<=100,'Invalid condition');
  const labels=unitLabels[u.id]||{};
  return {id:u.id,slot:u.slot,type:u.type,secondClassId:u.secondClassId??null,name:labels.name||`병사 #${u.id}`,className:labels.className||u.secondClassId||u.type,condition:u.condition,selected:selectedUnitId===u.id,projection:projectedUnits[u.id]??null};
 });
 const cells=OFFICIAL_SLOT_ORDER.map((slot,index)=>({index,slot,row:Math.floor(index/3),col:index%3,columnName:FORMATION_COLUMNS[index%3],unit:units.find(u=>u.slot===slot)||null}));
 return immutableCopy({version:'official-view-1',identity:{runId:run.runId,revision:run.revision,phase:s.phase,nodeId:s.currentNode??null},header:{chapter:s.chapter,chapterCount:run.graphs.length,gold:s.gold,tokens:profile?.tokens??null,level:profile?.level??null},formation:{editable,deploymentCap,deployed:units.filter(u=>u.slot!==null).length,selectedUnitId,cells,reserves:units.filter(u=>u.slot===null)},locked:!!locked});
}
