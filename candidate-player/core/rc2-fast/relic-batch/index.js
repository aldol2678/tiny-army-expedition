// RB1 is an isolated, opt-in mechanism laboratory. No acquisition/price/drop path imports this module.
import {createProjection} from '../relic-services/projection.js';
import {clone,deepFreeze,canonical,assert} from '../relic-services/registry.js';
import {captureGame,restoreGame} from '../spear-skills/browser.js';
export const RB1_CAPABILITY='TEST_ONLY_RELIC_BATCH_RB1';
export const RB1_VERSION='relic-semantic-batch-rb1-r1-1';
export const RB1_CHECKPOINT='relic-semantic-batch-rb1-r1-checkpoint-1';
const def=(id,name,rarity,values,scope,detail)=>({id,name,intrinsicRarity:rarity,maxEvolution:3,maxOwned:1,values,scope,detail,acquisitionEnabled:false,balanceApproved:false});
export const BATCH_REGISTRY=deepFreeze([
 def('diagonal_banner','사선 깃발','uncommon',[.03,.05,.07],'starting-diagonal-ally','시작 대각선 아군이 있는 병사 ATK +3/5/7%, ATK +50% 공통 상한.'),
 def('isolated_crown','고독한 왕관','epic',[.07,.10,.13],'starting-no-orthogonal-ally','시작 직교 아군이 없는 병사 ATK·AP +7/10/13%, DEF −5 고정. 양수 상한 뒤 DEF 비용, 최저0.'),
 def('triage_watch','진료 시계','rare',[.04,.06,.08],'support-normal-heal','정상 치유 간격 −4/6/8%(합계15%·최소1초), 정상 치유량 ×0.95. 최초 지연·특수 치유·방벽 불변.'),
 def('breathing_charm','숨고르기 부적','uncommon',[.08,.12,.16],'support-first-valid-normal','시작 컨디션90 이상 지원 병사의 첫 유효 정상 치유 +8/12/16%p. 기존 N +35%에 합산, 유효 정상 치유면 추가량0이어도 소비.'),
 def('rescue_knot','구조 매듭','uncommon',[.08,.12,.16],'commander-heal-below30','지휘 회복 직전 HP30% 미만 생존 대상의 회복량 +8/12/16%. 정상·유물·특수 치유 제외, 결손 HP 한도.'),
 def('bandage_stud','작은 봉합핀','common',[2,3,4],'recipient-first-normal-below50','대상별 HP50% 이하 첫 유효 정상 치유 +2/3/4HP. 배율 뒤 고정 추가, 남은 N +35% 예산과 결손 HP 한도, 유효 정상 치유0은 미소비.')
]);
export const BATCH_IDS=Object.freeze(BATCH_REGISTRY.map(x=>x.id));
const BY_ID=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(BATCH_REGISTRY.map(d=>[d.id,d]))));
const hasBatch=id=>typeof id==='string'&&Object.hasOwn(BY_ID,id);
const stageValue=(rels,id)=>{const r=rels.find(r=>r.id===id);return r?BY_ID[id].values[r.evolution-1]:0;};
const diag=(a,b)=>Number.isInteger(a)&&Number.isInteger(b)&&Math.abs(Math.floor(a/4)-Math.floor(b/4))===1&&Math.abs(a%4-b%4)===1;
export function createBatchProjection(C,{capability=null}={}){
 assert(capability===null||capability===RB1_CAPABILITY,'Unknown batch capability');
 const base=createProjection(C,{enableNewRelics:true});if(!capability)return base;
 const RELICS=deepFreeze({...base.RELICS,...Object.fromEntries(BATCH_REGISTRY.map(d=>[d.id,{...d,definitionVersion:RB1_VERSION}]))});
 function normalizeRelics(relics=[]){assert(Array.isArray(relics),'Relic array required');const ids=new Set();return relics.map(r=>{assert(r&&typeof r.id==='string','Relic ID must be a string');assert(!ids.has(r.id),'Duplicate relic ID');ids.add(r.id);if(!hasBatch(r.id))return base.normalizeRelic(r);const d=BY_ID[r.id],e=r.evolution??r.evolutionStage??1;assert(Number.isInteger(e)&&e>=1&&e<=3,'Invalid batch evolution');assert(r.evolution===undefined||r.evolutionStage===undefined||r.evolution===r.evolutionStage,'Conflicting evolution');assert(r.stacks===undefined||r.stacks===1,'Duplicate stacking forbidden');assert((r.rarity===undefined||r.rarity===d.intrinsicRarity)&&(r.intrinsicRarity===undefined||r.intrinsicRarity===d.intrinsicRarity),'Intrinsic rarity cannot change');assert(r.definitionVersion===undefined||r.definitionVersion===RB1_VERSION,'Foreign batch definition');return {id:r.id,rarity:d.intrinsicRarity,evolution:e,stacks:1};});}
 function projectDefense(u,p,formation=0,temporary=0){return Math.max(0,base.projectDefense(u,p,formation,temporary)-(p.rb1?.defenseCost??0));}
 function guardianLinks(roster=[],options={}){
  options={...options,relics:normalizeRelics(options.relics??[])};
  const alive=options.aliveIds===undefined?null:new Set(options.aliveIds),deployed=roster.filter(C.isDeployed),guardians=deployed.filter(u=>u.type==='guardian'&&(!alive||alive.has(u.id))).map(u=>({u,p:projectUnit(u,{...options,roster,formation:false})}));
  return Object.fromEntries(deployed.map(u=>{const candidates=u.type==='guardian'?[]:guardians.filter(g=>g.u.id!==u.id&&C.adjacent(g.u.slot,u.slot)).map(g=>({sourceId:g.u.id,value:g.p.guardianDefense})).sort((a,b)=>b.value-a.value||a.sourceId-b.sourceId);return [u.id,{sourceId:candidates[0]?.sourceId??null,value:candidates[0]?.value??0,candidates}];}));
 }
 function projectUnit(u,options={}){
  const relics=normalizeRelics(options.relics??[]),own=relics.filter(r=>hasBatch(r.id));if(!own.length)return base.projectUnit(u,options);
  const roster=options.roster??[u],deployed=roster.filter(C.isDeployed),active=C.isDeployed(u),diagonal=active&&deployed.some(x=>x.id!==u.id&&diag(x.slot,u.slot)),isolated=active&&!deployed.some(x=>x.id!==u.id&&C.adjacent(x.slot,u.slot)),mods=[];
  function add(id,field,applied){const v=stageValue(own,id);if(v)mods.push({sourceId:`relic:${id}`,effectId:`${id}:${field}`,category:'relic',affectedField:field,operation:'percent_gain',value:v,applied,positiveCapKey:field});}
  add('diagonal_banner','attackPower',diagonal);add('isolated_crown','attackPower',isolated);add('isolated_crown','abilityPower',isolated);
  const p=clone(base.projectUnit(u,{...options,relics:relics.filter(r=>!hasBatch(r.id)),modifiers:[...(options.modifiers??[]),...mods]}));
  const defenseCost=isolated&&stageValue(own,'isolated_crown')?5:0;
  p.rb1={version:RB1_VERSION,defenseCost,startingDiagonal:diagonal,startingIsolated:isolated};
  if(options.formation!==false&&active)p.guardianLink=guardianLinks(roster,options)[u.id]??p.guardianLink;p.baseDefense=Math.max(0,p.baseDefense-defenseCost);p.modifiers.defense.value=p.baseDefense;p.defense=projectDefense(u,p,p.guardianLink?.value??0);
  const reduction=active&&C.familyOf(u.type)==='support'?stageValue(own,'triage_watch'):0;
  if(reduction){p.heal*=.95;p.healInterval=Math.max(1,p.healInterval*(1-Math.min(.15,reduction)));const a=p.abilities.find(a=>a.id==='normal_heal');if(a){a.amount=p.heal;a.interval=p.healInterval;}p.rb1.normalHealIntervalReduction=reduction;p.rb1.normalHealCost=.95;}
  return deepFreeze(p);
 }
 return {RELICS,RELIC_LIST:Object.values(RELICS),supportedRelicIds:Object.keys(RELICS),normalizeRelics,normalizeRelic:r=>normalizeRelics([r])[0],projectUnit,projectDefense,guardianLinks,getRelicEffects:(rs=[],skills=[])=>base.getRelicEffects(normalizeRelics(rs).filter(r=>!hasBatch(r.id)),skills),rb1Capability:RB1_CAPABILITY};
}
export function installBatchAdapter(game,{content,capability=null,afterReceipt=null}={}){
 assert(capability===null||capability===RB1_CAPABILITY,'Unknown batch capability');
 if(!capability){assert(!(game.relics??[]).some(r=>hasBatch(r.id)),'Batch relic requires capability');return {version:RB1_VERSION,snapshot:()=>({enabled:false,receipts:[]})};}
 assert(content?.rb1Capability===RB1_CAPABILITY&&game.phase==='battle','Started test-only batch content required');
 assert(!game._rb1Installed&&!game._v10ClassCombat&&!game._v10SpearAdapter,'Batch adapter must install once before class/spear capture');
 const relics=content.normalizeRelics(game.relics),roster=clone(game.startingRoster),context=canonical({version:RB1_VERSION,battleId:game.battleId,relics,roster,initialSeed:game.initialSeed,encounter:game.encounter,skills:game.skills,prepared:game.prepared});
 let state={version:RB1_VERSION,context,sequence:0,breathingUsed:[],bandageUsed:[],receipts:[]},normal=null,commander=false,depth=0;
 const original={};for(const name of ['supportHeal','heal','castSkill','hit','attack','castUnitSkill','castBarrier'])original[name]=game[name];
 const value=id=>stageValue(relics,id),unitIds=new Set(game.units.map(u=>u.id));
 function valid(s){assert(s&&s.version===RB1_VERSION&&s.context===context,'Foreign batch checkpoint');assert(Number.isInteger(s.sequence)&&s.sequence===s.receipts?.length,'Invalid receipt sequence');for(const k of ['breathingUsed','bandageUsed'])assert(Array.isArray(s[k])&&new Set(s[k]).size===s[k].length&&s[k].every(id=>unitIds.has(id)),'Invalid used identities');for(let i=0;i<s.receipts.length;i++){const r=s.receipts[i];assert(r.sequence===i+1&&r.id===`${game.battleId}:rb1:${i+1}`&&Number.isFinite(r.actual)&&r.actual>=0,'Invalid effect receipt');}return true;}
 game._rb1Installed={version:RB1_VERSION,context};game._v10CheckpointParticipants??=[];
 game._v10CheckpointParticipants.push({id:'rb1-relic-effects',capture:()=>clone(state),restore:s=>{valid(s);state=clone(s);}});
 function atomic(fn){if(depth)return fn();const before=captureGame(game);depth++;try{return fn();}catch(e){restoreGame(game,before);throw e;}finally{depth--;normal=null;commander=false;}}
 function record(r){const sequence=++state.sequence,receipt={id:`${game.battleId}:rb1:${sequence}`,sequence,battleId:game.battleId,tick:game.tickCount,...r};state.receipts.push(receipt);afterReceipt?.(clone(receipt));return receipt;}
 for(const name of ['attack','castUnitSkill','castBarrier'])game[name]=function(...args){return atomic(()=>original[name].apply(this,args));};
 game.supportHeal=function(source,target){return atomic(()=>{const old=normal;normal={sourceId:source?.id,targetId:target?.id,observed:false};try{return original.supportHeal.call(this,source,target);}finally{normal=old;}});};
 game.castSkill=function(id,targetId){return atomic(()=>{const old=commander;commander=id==='heal';try{return original.castSkill.call(this,id,targetId);}finally{commander=old;}});};
 game.heal=function(target,amount,source=null,action={}){
  const isNormal=normal&&!normal.observed&&source?.id===normal.sourceId&&target?.id===normal.targetId&&source?.team==='ally'&&target?.team==='ally';
  if(!isNormal&&!commander)return original.heal.call(this,target,amount,source,action);
  const validTarget=target?.hp>0&&Number.isFinite(amount)&&amount>0;if(!validTarget)return original.heal.call(this,target,amount,source,action);
  const before=target.hp,ratio=before/target.maxHp;let adjusted=amount,breathing=0,bandage=0,rescue=0,base=amount;
  const start=source&&roster.find(u=>u.id===source.id),breathingEligible=isNormal&&content.familyOf(source.type)==='support'&&(start?.condition??100)>=90&&!state.breathingUsed.includes(source.id)&&value('breathing_charm')>0;
  const bandageEligible=isNormal&&ratio<=.5&&!state.bandageUsed.includes(target.id)&&value('bandage_stud')>0;
  if(isNormal){normal.observed=true;const n=Math.min(.35,Math.max(0,source.supportHealBonus??0));base=amount/(1+n);let budget=Math.max(0,base*.35-(amount-base));if(breathingEligible){breathing=Math.min(budget,base*value('breathing_charm'));budget=Math.max(0,budget-breathing);}if(bandageEligible)bandage=Math.min(budget,value('bandage_stud'));adjusted+=breathing+bandage;}
  else if(commander&&!source&&ratio<.3&&value('rescue_knot')){rescue=amount*Math.min(.35,value('rescue_knot'));adjusted+=rescue;}
  const actual=original.heal.call(this,target,adjusted,source,action);
  if(isNormal&&actual>0){if(breathingEligible)state.breathingUsed.push(source.id);if(bandageEligible)state.bandageUsed.push(target.id);}
  const received=Math.max(0,target.hp-before),amplification=adjusted>0?actual/adjusted:0;
  record({kind:isNormal?'normal-heal':'commander-heal',sourceId:source?.id??null,targetId:target.id,requestedBase:amount,requested:adjusted,actual:received,before,after:target.hp,normalBucketCap:.35,breathingRequested:breathing,bandageRequested:bandage,rescueRequested:rescue,healingOutcomeFactor:amplification,componentsAreRequestedNotAttributed:true});
  return actual;
 };
 game.hit=function(attacker,target,amount,kind,action){if(!this.damageActionDepth)return this.resolveDamageAction(()=>this.hit(attacker,target,amount,kind,action));return atomic(()=>{const before=target?.hp??0,actual=original.hit.call(this,attacker,target,amount,kind,action);if((attacker?.team==='ally'||target?.team==='ally')&&(value('diagonal_banner')||value('isolated_crown')))record({kind:'damage',sourceId:attacker?.id??null,targetId:target?.id??null,requested:amount,actual,before,after:target?.hp??before,attackPower:attacker?.attackPower??null,effectiveDefense:target?this.effectiveDefense(target,this.actionGuardianLinks?.[target.id]?.value??0,this.tickCount<target.temporaryDefenseUntilTick?target.temporaryDefense:0):null,notIncrementalBenefit:true});return actual;});};
 function exportCheckpoint(){assert(!game._v10SpearAdapter,'Use outer composite host checkpoint when spear journal is installed');assert(!depth,'Cannot checkpoint inside action');return {schema:RB1_CHECKPOINT,context,game:captureGame(game)};}
 function importCheckpoint(cp){assert(!game._v10SpearAdapter,'Use outer composite host checkpoint when spear journal is installed');assert(!depth,'Cannot restore inside action');assert(cp?.schema===RB1_CHECKPOINT&&cp.context===context,'Foreign checkpoint schema/context');const data=cp.game?.data;assert(data&&canonical({version:RB1_VERSION,battleId:data.battleId,relics:content.normalizeRelics(data.relics),roster:data.startingRoster,initialSeed:data.initialSeed,encounter:data.encounter,skills:data.skills,prepared:data.prepared})===context,'Checkpoint data identity mismatch');const part=cp.game?.participants?.find(x=>x.id==='rb1-relic-effects');valid(part?.state);const old=captureGame(game);try{restoreGame(game,clone(cp.game));}catch(e){restoreGame(game,old);throw e;}}
 return {version:RB1_VERSION,snapshot:()=>deepFreeze(clone(state)),exportCheckpoint,importCheckpoint};
}

// Observational capability preview only. It never grants relics or enables shops.
export function previewBatchRelic(C,state,id,evolution=1){
 assert(hasBatch(id),'Unknown batch relic');const P=createBatchProjection(C,{capability:RB1_CAPABILITY});
 const owned=P.normalizeRelics(state.relics??[]),previous=owned.find(r=>r.id===id),next=P.normalizeRelics([...owned.filter(r=>r.id!==id),{id,evolution}]);
 const changes=[],potential=[];for(const u of (state.roster??[]).filter(C.isDeployed)){
  const before=P.projectUnit(u,{...state,relics:owned}),after=P.projectUnit(u,{...state,relics:next});
  for(const field of ['attackPower','abilityPower','defense','heal','healInterval'])if(before[field]!==after[field])changes.push({unitId:u.id,field,before:before[field],after:after[field],delta:after[field]-before[field]});
  const values=(rels)=>{const v=stageValue(rels,id);if(!v)return 0;if(id==='breathing_charm')return C.familyOf(u.type)==='support'&&(u.condition??100)>=90?before.heal*Math.max(1,before.emergencyMultiplier??1)/(1+before.supportHealBonus)*Math.min(v,Math.max(0,.35-before.supportHealBonus)):0;if(id==='bandage_stud'){const healers=(state.roster??[]).filter(x=>C.isDeployed(x)&&C.familyOf(x.type)==='support');return Math.max(0,...healers.map(h=>{const p=P.projectUnit(h,{...state,relics:rels});return Math.min(v,p.heal*Math.max(1,p.emergencyMultiplier??1)/(1+p.supportHealBonus)*Math.max(0,.35-p.supportHealBonus));}));}if(id==='rescue_knot')return (state.skills??[]).includes('heal')?Math.min(.35,v):0;return 0;};
  if(['breathing_charm','bandage_stud','rescue_knot'].includes(id)){const a=values(owned),b=values(next);potential.push({unitId:u.id,before:a,after:b,delta:b-a,unit:id==='rescue_knot'?'commander-heal-ratio':'requested-HP',assumption:id==='breathing_charm'?'Conditional upper request with eligible medic emergency multiplier; non-emergency target may be lower':id==='bandage_stud'?'Conditional upper request with eligible medic emergency multiplier, after breathing use; simultaneous first heal or non-emergency target may be lower':null,conditional:true,notObservedBenefit:true});}
 }
 const positive=changes.some(x=>x.field==='healInterval'?x.delta<0:x.delta>0)||potential.some(x=>x.delta>1e-9);
 return deepFreeze({version:RB1_VERSION,id,evolution,previousEvolution:previous?.evolution??null,definition:BY_ID[id],changes,potential,hasEffectiveImprovement:positive,canForge:false,acquisitionEnabled:false,reason:positive?'TEST_ONLY capability; conditional benefit requires actual valid action':'No positive effect in this formation/cap context; no upgrade offered',costOrder:id==='bandage_stud'?'normal multipliers and triage cost -> breathing within N35 -> flat within remaining N35 -> healing curse -> missing HP clip':null});
}
