import {VERSION,LEGACY_RELIC_IDS,NEW_RELICS,NEW_RELIC_IDS,LIMITS,clone,assert,deepFreeze} from './registry.js';
// Overlay this facade only inside the new campaign's isolated engine context.
// The original frozen content, old-run definitions and source bytes stay intact.
export function createProjection(C,{enableNewRelics=false}={}) {
 assert(C&&typeof C.projectUnit==='function','Pinned content projection required');
 const supportedRelicIds=[...LEGACY_RELIC_IDS,...(enableNewRelics?NEW_RELIC_IDS:[])];
 const RELICS=deepFreeze(Object.fromEntries(supportedRelicIds.map(id=>[id,clone(NEW_RELICS[id]||C.RELICS[id])])));
 function normalizeRelic(relic) {
  const def=RELICS[relic?.id]; assert(def,'Unsupported relic capability');
  if(!NEW_RELICS[relic.id])return clone(C.normalizeRelic(relic));
  const evolution=relic.evolution??relic.evolutionStage??1;
  assert(Number.isInteger(evolution)&&evolution>=1&&evolution<=def.maxEvolution,'Invalid relic evolution');
  assert(relic.evolution===undefined||relic.evolutionStage===undefined||relic.evolution===relic.evolutionStage,'Conflicting evolution fields');
  assert((relic.rarity===undefined||relic.rarity===def.intrinsicRarity)&&(relic.intrinsicRarity===undefined||relic.intrinsicRarity===def.intrinsicRarity),'Intrinsic rarity cannot change');
  assert(relic.stacks===undefined||relic.stacks===1,'Duplicate relic stacking forbidden');
  assert(relic.definitionVersion===undefined||relic.definitionVersion===VERSION,'Unsupported relic definition version');
  return {id:relic.id,rarity:def.intrinsicRarity,evolution,stacks:1};
 }
 function normalizeRelics(relics=[]) {
  assert(Array.isArray(relics),'Relic array required');const seen=new Set();
  return relics.map(relic=>{const item=normalizeRelic(relic);assert(!seen.has(item.id),'Duplicate relic ID');seen.add(item.id);return item;});
 }
 function newModifiers(unit,options,relics) {
  const roster=(options.roster||[unit]).filter(C.isDeployed),family=C.familyOf(unit.type),front=roster.filter(u=>u.slot<4);
  const scopes={spear:family==='spear',archer:family==='archer',mage:family==='mage',support:family==='support',adjacent_ally:roster.some(u=>u.id!==unit.id&&C.adjacent(u.slot,unit.slot)),rear_archer:unit.slot>=8&&family==='archer',sparse_front:unit.slot<4&&front.length>=1&&front.length<=2,four_families:new Set(roster.map(u=>C.familyOf(u.type))).size===4};
  return relics.flatMap(relic=>!NEW_RELICS[relic.id]?[]:NEW_RELICS[relic.id].effects.map((effect,index)=>({sourceId:`relic:${relic.id}`,effectId:`${relic.id}:${index}`,category:'relic',affectedField:effect.affectedField,operation:effect.operation,value:effect.values[relic.evolution-1],scope:effect.scope,applied:C.isDeployed(unit)&&!!scopes[effect.scope],positiveCapKey:effect.affectedField==='defense'?'relicDefense':effect.affectedField,reason:C.isDeployed(unit)&&scopes[effect.scope]?'':'Starting formation or family condition is not met'})));
 }
 function getRelicEffects(relics=[],skills=[]) {return clone(C.getRelicEffects(normalizeRelics(relics).filter(r=>!NEW_RELICS[r.id]),skills));}
 function rawProjection(unit,options) {
  const relics=normalizeRelics(options.relics||[]),extra=newModifiers(unit,options,relics);
  const p=clone(C.projectUnit(unit,{...options,formation:false,relics:relics.filter(r=>!NEW_RELICS[r.id]),modifiers:[...(options.modifiers||[]),...extra]}));
  const rangeGain=Math.min(LIMITS.relicRange,p.ledger.filter(e=>e.applied&&e.category==='relic'&&e.affectedField==='range'&&e.operation==='flat_gain').reduce((sum,e)=>sum+e.value,0));
  p.range+=rangeGain;p.attackRange=p.range;p.abilities.find(a=>a.id==='basic_attack').range=p.range;p.relicRangeBonus=rangeGain;p.relicProjectionVersion=VERSION;
  return p;
 }
 function guardianLinks(roster=[],options={}) {
  const alive=options.aliveIds===undefined?null:new Set(options.aliveIds),deployed=roster.filter(C.isDeployed);
  const guardians=deployed.filter(u=>u.type==='guardian'&&(!alive||alive.has(u.id))).map(unit=>({unit,projection:rawProjection(unit,{...options,roster})}));
  return Object.fromEntries(deployed.map(unit=>{const candidates=unit.type==='guardian'?[]:guardians.filter(g=>g.unit.id!==unit.id&&C.adjacent(g.unit.slot,unit.slot)).map(g=>({sourceId:g.unit.id,value:g.projection.guardianDefense})).sort((a,b)=>b.value-a.value||a.sourceId-b.sourceId);return [unit.id,{sourceId:candidates[0]?.sourceId??null,value:candidates[0]?.value??0,candidates}];}));
 }
 function projectUnit(unit,options={}) {
  const p=rawProjection(unit,options);
  if(options.formation!==false&&C.isDeployed(unit)){p.guardianLink=guardianLinks(options.roster||[unit],options)[unit.id]||p.guardianLink;p.defense=C.projectDefense(unit,p,p.guardianLink.value);}
  return deepFreeze(p);
 }
 return {RELICS,RELIC_LIST:Object.values(RELICS),supportedRelicIds,normalizeRelic,normalizeRelics,projectUnit,guardianLinks,projectDefense:(...args)=>C.projectDefense(...args),getRelicEffects};
}
