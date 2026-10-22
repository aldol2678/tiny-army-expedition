// Explicit private candidate only. Neither official 26 nor FQI1 definitions change.
import {createFormationQAProjection,FORMATION_IDS,FORMATION_QA_CAPABILITY} from '../formation-qa/projection.js';
import {KEY_RELIC_IDS,assert,deepFreeze} from '../relic-services/registry.js';
export {FORMATION_IDS};
export const LR29_CAPABILITY='EXPLICIT_PRIVATE_LIGHTWEIGHT_LR29';
export function createLightweightProjection(C,{capability}={}){
 assert(capability===LR29_CAPABILITY,'Explicit private LR29 capability required');
 const base=createFormationQAProjection(C,{capability:FORMATION_QA_CAPABILITY});
 const RELICS=deepFreeze(Object.fromEntries(base.supportedRelicIds.map(id=>[id,FORMATION_IDS.includes(id)?{...base.RELICS[id],formationQAFixture:false,formationReleaseCandidate:true,acquisitionEnabled:true,baseUnlocked:true,key:false}:KEY_RELIC_IDS.includes(id)?{...base.RELICS[id],rarity:'legendary',intrinsicRarity:'legendary'}:base.RELICS[id]])));
 return {...base,RELICS,RELIC_LIST:Object.freeze(base.supportedRelicIds.map(id=>RELICS[id])),formationQA:undefined,
  lightweightRelease:deepFreeze({version:'lr29-2',acceptedRelicCount:29,naturalAcquisitionCount:29,explicitOptIn:true,officialPoolEnabled:false,productionEnabled:false,balanceApproved:false}),
  rc2Status:deepFreeze({...base.rc2Status,integrationAcceptance:'PRIVATE_LIGHTWEIGHT_RELEASE_CANDIDATE'})};
}
