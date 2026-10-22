import {assert,deepFreeze} from '../relic-services/registry.js';
import {createRB6Projection,RB6_CAPABILITY} from '../relic-batch-6/index.js';
import {FH1_VERSION,FH1_CAPABILITY} from './contract.js';
export {FH1_VERSION,FH1_CAPABILITY};
export const FH1_DEFINITION=deepFreeze({id:'vacant_center',name:'비운 가운데',intrinsicRarity:'rare',
  definitionVersion:FH1_VERSION,maxEvolution:3,maxOwned:1,values:[5,7,9],effectEnabled:true,
  acquisitionEnabled:false,balanceApproved:false,scope:'start-slots-0-and-3-both-occupied-1-and-2-empty',
  usesPerTargetPerBattle:1});
export function createFirstHpProjection(C,{capability=null}={}) {
  assert(capability===null||capability===FH1_CAPABILITY,'Unknown FH1 capability');
  const enabled=capability===FH1_CAPABILITY,base=createRB6Projection(C,{capability:enabled?RB6_CAPABILITY:null});
  const RELICS=deepFreeze(Object.assign(Object.create(null),base.RELICS,enabled?{vacant_center:FH1_DEFINITION}:{}));
  function normalizeRelics(rs=[]) {
    assert(Array.isArray(rs),'Relic array required');const seen=new Set();
    return Array.from(rs,r=>{
      assert(r&&typeof r==='object'&&!Array.isArray(r)&&Object.hasOwn(r,'id')&&typeof r.id==='string'&&Object.hasOwn(RELICS,r.id),'Own supported relic ID required');
      assert(!seen.has(r.id),'Duplicate relic');seen.add(r.id);
      if(r.id!=='vacant_center')return base.normalizeRelic(r);
      for(const k of ['evolution','evolutionStage','stacks','rarity','intrinsicRarity','definitionVersion'])assert(!(k in r)||Object.hasOwn(r,k),'Own metadata required');
      const e=r.evolution??r.evolutionStage??1;assert(Number.isInteger(e)&&e>=1&&e<=3,'Invalid stage');
      assert(r.evolution===undefined||r.evolutionStage===undefined||r.evolution===r.evolutionStage,'Conflicting stage');
      assert(r.stacks===undefined||r.stacks===1,'No duplicate stacking');
      assert((r.rarity===undefined||r.rarity==='rare')&&(r.intrinsicRarity===undefined||r.intrinsicRarity==='rare'),'R2 intrinsic rarity fixed');
      assert(r.definitionVersion===undefined||r.definitionVersion===FH1_VERSION,'Foreign definition');
      return {id:r.id,rarity:'rare',evolution:e,stacks:1};
    });
  }
  const filtered=o=>({...o,relics:normalizeRelics(o.relics??[]).filter(r=>r.id!=='vacant_center')}),ids=Object.freeze(Object.keys(RELICS));
  return {...base,RELICS,RELIC_LIST:Object.freeze(Object.values(RELICS)),supportedRelicIds:ids,
    implementedRelicIds:Object.freeze(ids.filter(id=>!base.blockedRelicIds.includes(id))),
    normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],
    projectUnit:(u,o={})=>base.projectUnit(u,filtered(o)),guardianLinks:(r=[],o={})=>base.guardianLinks(r,filtered(o)),
    getRelicEffects:(rs=[],skills=[])=>base.getRelicEffects(normalizeRelics(rs).filter(r=>r.id!=='vacant_center'),skills),
    ...(enabled?{fh1Capability:FH1_CAPABILITY}:{})};
}
