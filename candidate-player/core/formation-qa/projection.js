// Only this private QA facade accepts the 26 natural relics plus the three
// previously validated formation mechanisms. Definitions and mechanics are reused.
import {createRC2Projection,RC2_CAPABILITY} from '../rci2/contracts.js';
import {RELIC_REGISTRY,assert,deepFreeze} from '../relic-services/registry.js';
export const FORMATION_IDS=Object.freeze(['diagonal_banner','isolated_crown','quiet_column']);
export const FORMATION_QA_CAPABILITY='EXPLICIT_PRIVATE_FORMATION_QA_FQI1';
export function createFormationQAProjection(C,{capability}={}){
 assert(capability===FORMATION_QA_CAPABILITY,'Explicit formation QA capability required');
 const full=createRC2Projection(C,{capability:RC2_CAPABILITY}),ids=Object.freeze([...RELIC_REGISTRY,...FORMATION_IDS]);
 const RELICS=deepFreeze(Object.assign(Object.create(null),Object.fromEntries(ids.map(id=>[id,FORMATION_IDS.includes(id)?{...full.RELICS[id],familyRequirement:{mode:'COMMON'},formationQAFixture:true}:full.RELICS[id]]))));
 function normalizeRelics(relics=[]){assert(Array.isArray(relics),'Relic array required');for(const r of relics)assert(r&&Object.hasOwn(r,'id')&&Object.hasOwn(RELICS,r.id),'Relic is outside the 29-entry QA boundary');return full.normalizeRelics(relics);}
 const checked=o=>({...o,relics:normalizeRelics(o?.relics??[])});
 return {...full,RELICS,RELIC_LIST:Object.freeze(ids.map(id=>RELICS[id])),supportedRelicIds:ids,implementedRelicIds:ids,definitionCount:29,implementedMechanismCount:29,
  normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],projectUnit:(u,o={})=>full.projectUnit(u,checked(o)),guardianLinks:(r=[],o={})=>full.guardianLinks(r,checked(o)),getRelicEffects:(rs=[],s=[])=>full.getRelicEffects(normalizeRelics(rs),s),
  formationQA:deepFreeze({capability:FORMATION_QA_CAPABILITY,fixtureOnly:true,naturalAcquisitionCount:26,acceptedRelicCount:29,officialPoolEnabled:false,productionEnabled:false,balanceApproved:false}),
  rc2Status:deepFreeze({...full.rc2Status,candidateMechanisms:29,newCandidates:FORMATION_IDS,integrationAcceptance:'PRIVATE_QA_FIXTURE_ONLY'})};
}
