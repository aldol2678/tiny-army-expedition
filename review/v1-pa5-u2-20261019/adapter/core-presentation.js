import {immutableCopy,invariant} from './data.js';
import {officialUnitName} from './official-unit-name.js';
import {createOfficialViewModel} from './view-model.js';
// Core owns every numeric projection. No stat, economy, unlock or training policy here.
// JSON crossing normalizes the pinned VM's plain objects; immutableCopy then rejects bad data.
const plain=value=>JSON.parse(JSON.stringify(value));
export function createCorePresentationReader({campaignRules,deploymentCap,unitSkillView},secondClasses={}) {
 invariant([campaignRules,deploymentCap,unitSkillView].every(fn=>typeof fn==='function'),'Frozen core readers required');
 return function read(run,{selectedUnitId=null,locked=false,profile=null}={}) {
  const s=run.state,C=campaignRules(run.encounterProfile).content,roster=s.roster,options={...s,combatRulesVersion:'v09-combat-1'},projections={},unitLabels={},skills={},types={};
  for(const unit of roster){projections[unit.id]=C.projectUnit(unit,options);unitLabels[unit.id]={name:officialUnitName(unit),className:secondClasses[unit.secondClassId]?.name||C.TYPES[unit.type]?.name||unit.type};skills[unit.id]=unitSkillView(unit);types[unit.type]=C.TYPES[unit.type];}
  const cap=deploymentCap(s.xp),selected=roster.find(u=>u.id===selectedUnitId),synergy=C.synergyPreview?.(roster)||{families:[]};
  const removeSynergy=selected?C.synergyPreview?.(roster.map(u=>u.id===selected.id?{...u,slot:null}:u))||{families:[]}:synergy;
  const detail=plain({version:'official-components-view-2',identity:{runId:run.runId,revision:run.revision,phase:s.phase,nodeId:s.currentNode??null},roster,selectedUnitId,editable:['map','prepare'].includes(s.phase)&&!s.pendingBattle&&!locked,summary:{owned:roster.length,deployed:roster.filter(u=>u.slot!==null).length,deploymentCap:cap},projections,links:C.guardianLinks?.(roster,options)||{},synergy,removeSynergy,unitLabels,skills,types,trainingMax:C.TRAINING.max,caps:C.CAPS||{},relics:s.relics.map(r=>({...r,name:C.RELICS[r.id]?.name||r.id})),relicNames:Object.fromEntries(Object.entries(C.RELICS).map(([id,d])=>[id,d.name||id]))});
  return immutableCopy({view:createOfficialViewModel(run,{deploymentCap:cap,unitLabels,projectedUnits:detail.projections,profile,locked,selectedUnitId}),detail});
 };
}
