// Start-of-expedition selection only. No profile writes or catalog expansion.
import {FAMILIES,FIRST_CLASSES,SECOND_CLASSES,familyOf} from '../progression/registry.js';
import {canonical,clone,invariant,exactKeys} from '../runtime/hash.js';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const FAMILY_SELECTION_VERSION='selected-base-families-1';
export const FAMILY_POOL_POLICY_VERSION='selected-family-pool-1';
export const FAMILY_RUN_SCHEMA='v10-selected-family-private-run-1';
export const FAMILY_PROFILE_RUN_SCHEMA='v10-selected-family-profile-private-run-1';
export const FAMILY_RUNTIME_VERSION='selected-family-private-runtime-1';
export const FAMILY_CATALOG=freeze({version:'base-family-catalog-20261019-1',families:Object.values(FAMILIES).map(f=>({id:f.id,name:f.name,supported:true,baseUnlocked:true}))});
export const DEFAULT_SELECTED_BASE_FAMILY_IDS=freeze(FAMILY_CATALOG.families.map(f=>f.id));
const own=(o,k)=>typeof k==='string'&&Object.hasOwn(o,k);
function catalogIds(catalog){
 invariant(catalog&&typeof catalog.version==='string'&&Array.isArray(catalog.families),'Family catalog required');
 const ids=catalog.families.map(f=>f.id);invariant(new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'&&/^[a-z][a-z0-9_]*$/.test(id)),'Invalid base family catalog');return ids;
}
// Alternate catalogs are an explicit pure-function test seam, never accepted by runtime headers.
export function makeFamilySelection({selectedBaseFamilyIds,unlockedBaseFamilyIds}={},catalog=FAMILY_CATALOG){
 const ids=catalogIds(catalog),supported=catalog.families.filter(f=>f.supported===true).map(f=>f.id);
 const unlocked=unlockedBaseFamilyIds??catalog.families.filter(f=>f.baseUnlocked===true).map(f=>f.id);
 invariant(Array.isArray(unlocked)&&new Set(unlocked).size===unlocked.length&&unlocked.every(id=>ids.includes(id)),'Invalid unlocked base families');
 const available=ids.filter(id=>supported.includes(id)&&unlocked.includes(id));
 if(selectedBaseFamilyIds===undefined){invariant(available.length===4,'Select exactly four available base families');selectedBaseFamilyIds=available;}
 invariant(Array.isArray(selectedBaseFamilyIds)&&selectedBaseFamilyIds.length===4&&new Set(selectedBaseFamilyIds).size===4,'Exactly four unique base families required');
 invariant(selectedBaseFamilyIds.every(id=>available.includes(id)),'Selected family is locked, unsupported, or not a base family');
 return freeze({version:FAMILY_SELECTION_VERSION,catalogVersion:catalog.version,poolPolicyVersion:FAMILY_POOL_POLICY_VERSION,selectedBaseFamilyIds:ids.filter(id=>selectedBaseFamilyIds.includes(id)),unlockedBaseFamilyIds:ids.filter(id=>unlocked.includes(id))});
}
export function validateFamilySelection(selection,catalog=FAMILY_CATALOG){
 exactKeys(selection,['version','catalogVersion','poolPolicyVersion','selectedBaseFamilyIds','unlockedBaseFamilyIds']);
 invariant(selection.version===FAMILY_SELECTION_VERSION&&selection.poolPolicyVersion===FAMILY_POOL_POLICY_VERSION&&selection.catalogVersion===catalog.version,'Unsupported family selection/catalog version; preserve original save');
 const expected=makeFamilySelection(selection,catalog);invariant(canonical(selection)===canonical(expected),'Noncanonical family selection');return true;
}
export function allowsBaseFamily(selection,family,catalog=FAMILY_CATALOG){
 if(selection===undefined)return true;validateFamilySelection(selection,catalog);return selection.selectedBaseFamilyIds.includes(family);
}
export function allowsUnitFamily(state,value){return allowsBaseFamily(state.familySelection,familyOf(value));}
// Explicit requirement language: COMMON, one family, or ALL/ANY over base IDs.
export function requirementEligibility(selection,requirement,catalog=FAMILY_CATALOG){
 if(selection===undefined)return {eligible:true,reason:'legacy-unfiltered'};
 validateFamilySelection(selection,catalog);
 const reject=()=>({eligible:false,reason:'ambiguous-or-unsupported-family-requirement'});
 if(!requirement||typeof requirement!=='object'||Array.isArray(requirement))return reject();
 if(requirement.mode==='COMMON'&&Object.keys(requirement).length===1)return {eligible:true,reason:'common'};
 const ids=requirement.baseFamilyIds,known=catalogIds(catalog);
 if(!['ALL','ANY'].includes(requirement.mode)||Object.keys(requirement).sort().join(',')!=='baseFamilyIds,mode'||!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||!ids.every(id=>known.includes(id)))return reject();
 const selected=selection.selectedBaseFamilyIds,eligible=requirement.mode==='ALL'?ids.every(id=>selected.includes(id)):ids.some(id=>selected.includes(id));
 return {eligible,reason:eligible?'selected-family':'unselected-family'};
}
export const MIXED_RELIC_REQUIREMENTS=freeze({
 heavy_blade:{mode:'ANY',baseFamilyIds:['spear','archer']},
 // Guardians, chargers and snipers also have AP. Do not misclassify as mage/support only.
 mid_resonance:{mode:'ANY',baseFamilyIds:['spear','archer','mage','support']},
});
export function relicFamilyRequirement(definition,catalog=FAMILY_CATALOG){
 if(!definition)return null;
 if(Object.hasOwn(definition,'familyRequirement'))return definition.familyRequirement;
 if(own(MIXED_RELIC_REQUIREMENTS,definition.id))return MIXED_RELIC_REQUIREMENTS[definition.id];
 if(catalogIds(catalog).includes(definition.family))return {mode:'ALL',baseFamilyIds:[definition.family]};
 if(['army','economy'].includes(definition.family))return {mode:'COMMON'};
 return null;
}
export function relicFamilyEligibility(state,definition,catalog=FAMILY_CATALOG){return requirementEligibility(state.familySelection,relicFamilyRequirement(definition,catalog),catalog);}
export function validateSelectedRoster(state){
 invariant(state&&typeof state==='object','State required');if(state.familySelection===undefined)return true;validateFamilySelection(state.familySelection);
 invariant((state.roster||[]).every(u=>allowsUnitFamily(state,u)),'Roster contains an unselected base family');return true;
}
export function projectSelectedUnlocks(unlocks,selection,relics){
 validateFamilySelection(selection);const result=clone(unlocks||{});
 for(const [group,ids] of Object.entries(result)){
  invariant(Array.isArray(ids),'Unlock group must be an array');
  result[group]=ids.filter(id=>{
   if(group==='relics')return relicFamilyEligibility({familySelection:selection},relics[id]).eligible;
   if(group==='branches')return allowsBaseFamily(selection,FIRST_CLASSES[id]?.family??SECOND_CLASSES[id]?.family);
   if(group==='training')return allowsBaseFamily(selection,id.replace(/_handling$/,''));
   if(group==='families')return allowsBaseFamily(selection,id);
   if(group==='tactics'){const roster={balanced:['spear','archer','support'],vanguard:['spear','archer','support'],arcane_guard:['spear','mage','support'],swift_expedition:['spear','archer','mage']}[id];return !!roster&&roster.every(f=>allowsBaseFamily(selection,f));}
   return false; // Future entitlement groups need an explicit projection contract.
  });
 }
 return result;
}
export function selectedFamilySummary(selection){if(selection===undefined)return {legacy:true,label:'기존 원정 규칙 유지',families:[]};validateFamilySelection(selection);return {legacy:false,label:'이번 원정 기본 계열 4개',families:selection.selectedBaseFamilyIds.map(id=>({id,name:FAMILIES[id].name})),catalogVersion:selection.catalogVersion};}
