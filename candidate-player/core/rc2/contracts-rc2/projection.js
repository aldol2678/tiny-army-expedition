// One TEST_ONLY registry. Individual frozen projections are normalization authorities,
// not layered runtime facades. No acquisition or production entry point is changed.
import {assert,deepFreeze} from '../relic-services/registry.js';
import {createRB6Projection} from '../relic-batch-6/index.js';
import {createFirstHpProjection,FH1_CAPABILITY} from '../first-hp-hit/projection.js';
import {createCD1Projection,CD1_CAPABILITY} from '../relic-chain-cd1/index.js';
import {createHB1Projection,HB1_CAPABILITY} from '../heal-barrier-hb1/index.js';
import {createRB7Projection,RB7_CAPABILITY,isRB7} from '../relic-batch-7/index.js';
export const RC2_CAPABILITY='TEST_ONLY_FIVE_RELIC_CONTRACTS_RC2';
export const RC2_VERSION='five-relic-contract-integration-rc2-1';
export function createRC2Projection(C,{capability=null}={}){
 assert(capability===null||capability===RC2_CAPABILITY,'Unknown RC2 capability');
 if(capability===null)return createRB6Projection(C);
 const base=createCD1Projection(C,{capability:CD1_CAPABILITY});
 const fh=createFirstHpProjection(C,{capability:FH1_CAPABILITY}),hb=createHB1Projection(C,{capability:HB1_CAPABILITY});
 const rb7=createRB7Projection(C,{capability:RB7_CAPABILITY});
 const extra=new Set(['vacant_center','first_aid_route','command_fork','crystal_nail']);
 const RELICS=deepFreeze(Object.assign(Object.create(null),base.RELICS,{vacant_center:fh.RELICS.vacant_center,first_aid_route:hb.RELICS.first_aid_route,command_fork:rb7.RELICS.command_fork,crystal_nail:rb7.RELICS.crystal_nail}));
 function normalizeRelics(rs=[]){assert(Array.isArray(rs),'Relic array required');const seen=new Set();return Array.from(rs,r=>{assert(r&&typeof r==='object'&&!Array.isArray(r)&&Object.hasOwn(r,'id')&&typeof r.id==='string'&&Object.hasOwn(RELICS,r.id),'Own supported relic ID required');assert(!seen.has(r.id),'Duplicate relic');seen.add(r.id);return (r.id==='vacant_center'?fh:r.id==='first_aid_route'?hb:isRB7(r.id)?rb7:base).normalizeRelic(r);});}
 const stripped=rs=>normalizeRelics(rs).filter(r=>!extra.has(r.id)),filtered=o=>({...o,relics:stripped(o.relics??[])}),ids=Object.freeze(Object.keys(RELICS));
 return {...base,RELICS,RELIC_LIST:Object.freeze(Object.values(RELICS)),supportedRelicIds:ids,implementedRelicIds:ids,blockedRelicIds:Object.freeze([]),definitionCount:ids.length,implementedMechanismCount:ids.length,
  normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],projectUnit:(u,o={})=>base.projectUnit(u,filtered(o)),guardianLinks:(rs=[],o={})=>base.guardianLinks(rs,filtered(o)),getRelicEffects:(rs=[],skills=[])=>base.getRelicEffects(stripped(rs),skills),
  rb7Capability:RB7_CAPABILITY,fh1Capability:FH1_CAPABILITY,hb1Capability:HB1_CAPABILITY,rc2Capability:RC2_CAPABILITY,
  rc2Status:deepFreeze({version:RC2_VERSION,priorAcceptedMechanisms:51,newCandidates:['command_fork','crystal_nail'],candidateMechanisms:53,naturalAcquisitionCount:26,acquisitionEnabled:false,productionEnabled:false,balanceApproved:false,integrationAcceptance:'PENDING'})};
}
