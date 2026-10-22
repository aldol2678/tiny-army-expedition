import {createRB6Projection,RB6_CAPABILITY} from '../relic-batch-6/index.js';
import {assert,deepFreeze} from '../relic-services/registry.js';
export const RB7_CAPABILITY='TEST_ONLY_RELIC_BATCH_RB7';
export const RB7_VERSION='relic-semantic-batch-rb7-1';
export const RB7_CHECKPOINT='relic-semantic-batch-rb7-checkpoint-1';
const definition=(id,name,rarity,values)=>({id,name,intrinsicRarity:rarity,values,definitionVersion:RB7_VERSION,maxEvolution:3,maxOwned:1,effectEnabled:true,acquisitionEnabled:false,releaseEligible:false,balanceApproved:false});
export const RB7_REGISTRY=deepFreeze([
 definition('command_fork','갈림 명령지','epic',[.03,.04,.05]),
 definition('crystal_nail','유리못','common',[.05,.07,.09])
]);
const byId=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(RB7_REGISTRY.map(r=>[r.id,r]))));
export const isRB7=id=>typeof id==='string'&&Object.hasOwn(byId,id);
export const value=(rs,id)=>{assert(isRB7(id),'Own RB7 string ID required');const r=rs.find(r=>r.id===id);return r?byId[id].values[r.evolution-1]:0;};
export function createRB7Projection(C,{capability=null}={}){
 assert(capability===null||capability===RB7_CAPABILITY,'Unknown RB7 capability');const enabled=capability===RB7_CAPABILITY,base=createRB6Projection(C,{capability:enabled?RB6_CAPABILITY:null});
 const RELICS=deepFreeze(Object.assign(Object.create(null),base.RELICS,enabled?byId:{}));
 function normalizeRelics(rs=[]){assert(Array.isArray(rs),'Relic array required');const seen=new Set();return Array.from(rs,r=>{assert(r&&typeof r==='object'&&!Array.isArray(r)&&Object.hasOwn(r,'id')&&typeof r.id==='string'&&Object.hasOwn(RELICS,r.id),'Own supported string ID required');assert(!seen.has(r.id),'Duplicate relic');seen.add(r.id);if(!isRB7(r.id))return base.normalizeRelic(r);for(const k of ['evolution','evolutionStage','stacks','rarity','intrinsicRarity','definitionVersion'])assert(!(k in r)||Object.hasOwn(r,k),'Own metadata required');const e=r.evolution??r.evolutionStage??1,d=byId[r.id];assert(Number.isInteger(e)&&e>=1&&e<=3,'Invalid stage');assert(r.evolution===undefined||r.evolutionStage===undefined||r.evolution===r.evolutionStage,'Conflicting stage');assert(r.stacks===undefined||r.stacks===1,'No duplicates');assert((r.rarity===undefined||r.rarity===d.intrinsicRarity)&&(r.intrinsicRarity===undefined||r.intrinsicRarity===d.intrinsicRarity),'R2 intrinsic rarity fixed');assert(r.definitionVersion===undefined||r.definitionVersion===RB7_VERSION,'Foreign definition');return {id:r.id,rarity:d.intrinsicRarity,evolution:e,stacks:1};});}
 const filtered=options=>({...options,relics:normalizeRelics(options.relics??[]).filter(r=>!isRB7(r.id))}),ids=Object.freeze(Object.keys(RELICS));
 return {...base,RELICS,RELIC_LIST:Object.freeze(Object.values(RELICS)),supportedRelicIds:ids,implementedRelicIds:Object.freeze(ids.filter(id=>!base.blockedRelicIds.includes(id))),normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],projectUnit:(u,o={})=>base.projectUnit(u,filtered(o)),guardianLinks:(r=[],o={})=>base.guardianLinks(r,filtered(o)),getRelicEffects:(r=[],s=[])=>base.getRelicEffects(normalizeRelics(r).filter(r=>!isRB7(r.id)),s),...(enabled?{rb7Capability:RB7_CAPABILITY}:{})};
}
