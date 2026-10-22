import {createRB6Projection,RB6_CAPABILITY} from '../relic-batch-6/index.js';
import {assert,deepFreeze} from '../relic-services/registry.js';
export const HB1_CAPABILITY='TEST_ONLY_HEAL_BARRIER_HB1';
export const HB1_VERSION='heal-barrier-contract-hb1-1';
export const HB1_REGISTRY=deepFreeze([{id:'first_aid_route',name:'구호 이정표',intrinsicRarity:'common',definitionVersion:HB1_VERSION,maxEvolution:3,maxOwned:1,values:[10,15,20],effectEnabled:true,acquisitionEnabled:false,balanceApproved:false,scope:'normal-heal-injured-search',detail:'정상 치유의 부상자 탐색 사거리 +10/15/20. 동일 정상 행동 resolve에 유효 범위 보존. 공격·지휘·특수·파생 범위 불변.'}]);
export function createHB1Projection(C,{capability=null}={}){
 assert(capability===null||capability===HB1_CAPABILITY,'Unknown HB1 capability');
 const enabled=capability===HB1_CAPABILITY,base=createRB6Projection(C,{capability:enabled?RB6_CAPABILITY:null});
 const RELICS=deepFreeze(Object.assign(Object.create(null),base.RELICS,enabled?{first_aid_route:HB1_REGISTRY[0]}:{}));
 function normalizeRelics(rs=[]){assert(Array.isArray(rs),'Relic array required');const seen=new Set();return rs.map(r=>{
  assert(r&&typeof r==='object'&&!Array.isArray(r)&&Object.hasOwn(r,'id')&&typeof r.id==='string'&&Object.hasOwn(RELICS,r.id),'Own supported string ID required');assert(!seen.has(r.id),'Duplicate relic');seen.add(r.id);
  if(r.id!=='first_aid_route')return base.normalizeRelic(r);
  for(const k of ['evolution','evolutionStage','stacks','rarity','intrinsicRarity','definitionVersion'])assert(!(k in r)||Object.hasOwn(r,k),'Own metadata required');
  const e=r.evolution??r.evolutionStage??1;assert(Number.isInteger(e)&&e>=1&&e<=3,'Invalid stage');assert(r.evolution===undefined||r.evolutionStage===undefined||r.evolution===r.evolutionStage,'Conflicting stage');assert(r.stacks===undefined||r.stacks===1,'No duplicates');assert((r.rarity===undefined||r.rarity==='common')&&(r.intrinsicRarity===undefined||r.intrinsicRarity==='common'),'Intrinsic rarity fixed');assert(r.definitionVersion===undefined||r.definitionVersion===HB1_VERSION,'Foreign definition');return {id:r.id,rarity:'common',evolution:e,stacks:1};
 });}
 const filtered=o=>({...o,relics:normalizeRelics(o.relics??[]).filter(r=>r.id!=='first_aid_route')}),ids=Object.freeze(Object.keys(RELICS));
 return {...base,RELICS,RELIC_LIST:Object.freeze(Object.values(RELICS)),supportedRelicIds:ids,implementedRelicIds:Object.freeze(ids.filter(id=>!base.blockedRelicIds.includes(id))),normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],projectUnit:(u,o={})=>base.projectUnit(u,filtered(o)),guardianLinks:(r=[],o={})=>base.guardianLinks(r,filtered(o)),getRelicEffects:(r=[],s=[])=>base.getRelicEffects(normalizeRelics(r).filter(r=>r.id!=='first_aid_route'),s),...(enabled?{hb1Capability:HB1_CAPABILITY}:{})};
}
export {installHealBarrierAuthority} from './authority.js';
