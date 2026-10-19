import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from './index.js';
import {C,digest,state as serviceState,unit} from '../relic-services/test-fixture.js';
import {createRelicServices} from '../relic-services/index.js';

// Legal reducer fixtures: growth and preparation are applied by production reducers.
// These are deterministic synthetic setup states, not earned campaign playthroughs.
const clone=structuredClone;
const expectedFamilies={spear:['iron_oath','ult_spear'],archer:['eagle_signet','ult_archer'],mage:['arcane_seed','ult_mage'],support:['covenant_lamp','ult_support']};
const R=createRelicServices(C,{digest,enableNewRelics:true,enableResearch:true,progressionCandidates:P.progressionCandidates,applyProgressionCandidate:(s,c)=>P.applyProgression(s,c,`growth:${c.candidateId}`),targetKeyEligibility:P.targetKeyEligibility,awakeningTrainingCandidates:P.awakeningTrainingCandidates,applyAwakeningTrainingCandidate:(s,c,node,providerCapability)=>P.applyAwakeningTraining(s,c,`preparation:${c.candidateId}`,{node,providerCapability})});
function invested(classIds=['bastion'],{chapter=1,gold=60*classIds.length,track='specialty'}={}){
 let s=serviceState({runId:'ultimate-identity-foundation-test',phase:'map',chapter,battleCount:0,gold,xp:17,roster:classIds.map((id,i)=>unit(i+1,P.SECOND_CLASSES[id].family,i)),nextUnitId:classIds.length+1,unlocks:{branches:['frostmage','warder'],training:['mage_handling','support_handling'],relics:[]}});
 for(const [i,classId] of classIds.entries()){
  const def=P.SECOND_CLASSES[classId],unitId=i+1;
  const predicates=[c=>c.kind==='evolve'&&c.type===def.firstClassId,c=>c.kind==='train'&&c.training===1&&c.trainingTrack===track,c=>c.kind==='train'&&c.secondClassId===classId];
  for(const [j,predicate] of predicates.entries()){
   const c=P.progressionCandidates(s).find(c=>c.unitId===unitId&&predicate(c));assert(c);
   s=P.applyProgression(s,c,`investment:${unitId}:${j}`).state;
  }
 }
 return s;
}
function service(s,{portable=false}={}){
 const node={id:portable?'identity-event-trainer':'identity-training',kind:portable?'event':'training',row:2.5,xp:0};
 const state={...clone(s),phase:'service',currentNode:node.id};
 const offer=portable?R.makeProviderOffer(state,node,{eventId:'identity-event-offer',definitionId:'trainer',providerKind:'trainer'}):R.makeServiceOffer(state,node);
 state.pendingService=clone(offer);
 if(portable)state.pendingEvent={id:'identity-event-offer',eventId:'identity-event-offer',definitionId:'trainer',chapter:state.chapter,node:clone(node),choices:[{id:'use',providerOffer:clone(offer)}]};
 return R.createSession(state,{service:offer});
}
function payPreparations(s,options={}){
 let session=service(s,options);const stock=clone(session.service.stock),choices=session.service.choices.filter(c=>c.kind==='awakening-training');
 for(const [i,c] of choices.entries()){
  const before=clone(session),action={type:c.kind,candidateId:c.candidateId},tx=`pay:${i}`;
  session=R.transition(session,action,tx);
  assert.equal(session.state.gold,before.state.gold-60);
  assert.equal(session.state.roster.filter(u=>u.awakeningTraining).length,i+1);
  assert.deepEqual(session.service.stock,stock);
  assert.deepEqual(R.transition(session,action,tx),session);
  assert.throws(()=>R.transition(session,action,`${tx}:again`));
 }
 session=R.transition(session,{type:'leave'},'leave');assert.equal(session.service,null);
 return {...session.state,phase:'map',currentNode:null,pendingService:null,pendingEvent:null};
}
function collect(s,keyId){return P.applyKeyCollection(s,{keyId,source:'reward'},`key:${keyId}`).state;}
function ready(classIds=['bastion'],options={}){
 let s=payPreparations(invested(classIds,options),options);
 for(const family of new Set(classIds.map(id=>P.SECOND_CLASSES[id].family)))s=collect(s,expectedFamilies[family][0]);
 return s;
}
function awaken(s,id=1,action={}){return P.applyAwakening(s,{type:'awaken',unitId:id,...action},`awake:${id}`);}

test('new progression version separates four frozen neutral skill identities from keys and sixteen branch variants',()=>{
 assert.notEqual(P.PROGRESSION_VERSION,'v10-progression-event-providers-1');
 assert.equal(P.ULTIMATE_IDENTITY_VERSION,'ultimate-identity-foundation-1');
 assert.deepEqual(Object.keys(P.ULTIMATE_SKILLS).sort(),Object.values(expectedFamilies).map(x=>x[1]).sort());
 const variants=new Set();
 for(const [family,[keyId,ultimateSkillId]] of Object.entries(expectedFamilies)){
  assert.equal(P.FAMILIES[family].keyId,keyId);assert.equal(P.FAMILIES[family].ultimateSkillId,ultimateSkillId);
  const skill=P.ULTIMATE_SKILLS[ultimateSkillId];
  assert.equal(skill.id,ultimateSkillId);assert.equal(skill.family,family);assert.equal(skill.identityOnly,true);assert.equal(skill.automatic,false);assert.equal(skill.commanderSlot,false);
  assert.equal(P.SKILLS[ultimateSkillId],skill);assert.equal(P.KEY_RELICS[ultimateSkillId],undefined);assert.equal(P.SKILLS[keyId],undefined);
  assert(Object.isFrozen(skill));assert.equal(Object.values(skill).some(x=>typeof x==='number'),false);
  for(const field of ['effects','damage','heal','cooldown','castTime','autoCast','program'])assert.equal(skill[field],undefined);
 }
 for(const c of Object.values(P.SECOND_CLASSES)){
  assert.equal(c.keyId,expectedFamilies[c.family][0]);assert.equal(c.ultimateSkillId,expectedFamilies[c.family][1]);assert.equal(c.ultimateVariantId,c.id);assert.equal(c.ultimateId,c.ultimateSkillId);
  assert.equal(c.skillIds.length,2);assert(c.skillIds.every(id=>P.SKILLS[id]&&!P.KEY_RELICS[id]));variants.add(c.ultimateVariantId);
 }
 assert.equal(variants.size,16);assert(Object.isFrozen(P.ULTIMATE_SKILLS));assert.equal(P.CLASS_REGISTRY.ultimates,P.ULTIMATE_SKILLS);
});

test('all sixteen branches and both training tracks keep two basics plus a genuine third skill ID',()=>{
 for(const c of Object.values(P.SECOND_CLASSES))for(const track of ['specialty','handling']){
  const s=ready([c.id],{track}),before=clone(s),candidate=P.awakeningCandidates(s)[0];
  assert.equal(candidate.keyId,expectedFamilies[c.family][0]);assert.equal(candidate.ultimateSkillId,expectedFamilies[c.family][1]);assert.equal(candidate.ultimateVariantId,c.id);
  const result=awaken(s),u=result.state.roster[0],d=P.combatDescriptor(u);
  assert.deepEqual(u.skillIds,[...c.skillIds,expectedFamilies[c.family][1]]);assert.deepEqual(u.skillIds.slice(0,2),before.roster[0].skillIds);
  assert.equal(u.ultimateSkillId,c.ultimateSkillId);assert.equal(u.ultimateVariantId,c.id);assert.equal(u.ultimateId,u.ultimateSkillId);
  assert.equal(d.keyId,c.keyId);assert.equal(d.ultimateSkillId,u.ultimateSkillId);assert.equal(d.ultimateVariantId,c.id);assert.equal(d.ultimateId,u.ultimateSkillId);assert.deepEqual(d.skillIds,u.skillIds);
  assert.equal(result.receipt.keyId,c.keyId);assert.equal(result.receipt.ultimateSkillId,c.ultimateSkillId);assert.equal(result.receipt.ultimateVariantId,c.id);
  assert.equal(result.receipt.cost,0);assert.equal(result.receipt.keyConsumed,false);assert.deepEqual(result.state.relics,before.relics);assert.equal(result.state.gold,0);
  for(const field of ['id','type','slot','condition','training','trainingTrack','secondClassId','awakeningTraining'])assert.deepEqual(u[field],before.roster[0][field]);
  assert(P.validateProgressionState(result.state));assert.deepEqual(s,before);
 }
});

test('second class descriptors expose the prerequisite but no granted ultimate identity before awakening',()=>{
 const s=invested(),u=s.roster[0],d=P.combatDescriptor(u);
 assert.equal(d.keyId,'iron_oath');assert.equal(u.ultimateSkillId,null);assert.equal(u.ultimateVariantId,null);assert.equal(u.ultimateId,null);
 assert.equal(d.ultimateSkillId,null);assert.equal(d.ultimateVariantId,null);assert.equal(d.ultimateId,null);assert.deepEqual(d.skillIds,P.SECOND_CLASSES.bastion.skillIds);
 assert.deepEqual(P.awakeningCandidates(s),[]);assert.equal(P.awakeningTrainingCandidates(s)[0].keyId,'iron_oath');
});

test('ordinary and portable trainers each charge 60G per distinct unit and keep frozen stock before same-key multiple awakenings',()=>{
 for(const portable of [false,true]){
  const initial=invested(['bastion','sentinel']),before=clone(initial);let s=payPreparations(initial,{portable});
  assert.equal(s.gold,0);assert.equal(s.xp,before.xp);assert.deepEqual(s.unlocks,before.unlocks);assert.deepEqual(s.relics,[]);assert.deepEqual(s.research,before.research);
  assert.notEqual(s.roster[0].awakeningTraining.transactionId,s.roster[1].awakeningTraining.transactionId);
  for(const [i,u] of s.roster.entries()){const {awakeningTraining,...unchanged}=u;assert.equal(awakeningTraining.price,60);assert.deepEqual(unchanged,before.roster[i]);}
  s=collect(s,'iron_oath');assert.deepEqual(P.awakeningCandidates(s).map(c=>c.unitId),[1,2]);
  s=awaken(s,1).state;assert.deepEqual(P.awakeningCandidates(s).map(c=>c.unitId),[2]);s=awaken(s,2).state;
  assert.deepEqual(s.awakening.unitIds,[1,2]);assert.deepEqual(s.roster.map(u=>u.ultimateSkillId),['ult_spear','ult_spear']);assert.deepEqual(s.roster.map(u=>u.ultimateVariantId),['bastion','sentinel']);
  assert.deepEqual(s.relics,[{id:'iron_oath',evolution:1}]);assert.equal(s.gold,0);assert.deepEqual(initial,before);
 }
});

test('retained keys keep exactly the same ordinary passive projection after identity-only awakening',()=>{
 for(const classId of ['bastion','marksman','ember_tactician','surgeon']){
  const s=ready([classId]),u=s.roster[0],keyId=expectedFamilies[P.SECOND_CLASSES[classId].family][0],withoutKey=R.projectUnit(u,{...s,relics:[]}),before=R.projectUnit(u,s),out=awaken(s).state,after=R.projectUnit(out.roster[0],out);
  assert.deepEqual(after,before);assert.deepEqual(out.relics,s.relics);
  const field={iron_oath:'maxHp',eagle_signet:'basicDamage',arcane_seed:'manaRegen',covenant_lamp:'abilityPower'}[keyId];assert(before[field]>withoutKey[field]);
 }
});

test('all four family keys are rejected cross-family and ultimate skills never count as relic keys',()=>{
 for(const c of ['bastion','marksman','ember_tactician','surgeon'].map(id=>P.SECOND_CLASSES[id])){
  const s=payPreparations(invested([c.id]));
  for(const keyId of Object.values(expectedFamilies).map(x=>x[0]).filter(id=>id!==expectedFamilies[c.family][0])){
   const wrong={...s,relics:[{id:keyId,evolution:1}]},before=clone(wrong);assert.deepEqual(P.awakeningCandidates(wrong),[]);assert.throws(()=>awaken(wrong));assert.deepEqual(wrong,before);
  }
  const fake={...s,relics:[{id:expectedFamilies[c.family][1],evolution:1}]};assert.deepEqual(P.awakeningCandidates(fake),[]);assert.throws(()=>awaken(fake));
 }
});

test('explicit awakening identity claims reject wrong key, skill, second class or variant instead of silently ignoring them',()=>{
 const s=ready(),before=clone(s),candidate=P.awakeningCandidates(s)[0];
 for(const patch of [{keyId:'arcane_seed'},{ultimateSkillId:'ult_mage'},{ultimateId:'iron_oath'},{ultimateVariantId:'sentinel'},{secondClassId:'sentinel'}])assert.throws(()=>awaken(s,1,{...candidate,...patch}));
 assert.deepEqual(s,before);const valid=awaken(s,1,candidate);assert.equal(valid.state.roster[0].ultimateVariantId,'bastion');
 assert.deepEqual(awaken(valid.state,1,candidate).state,valid.state);assert.throws(()=>awaken(valid.state,1,{...candidate,keyId:'arcane_seed'}));
});

test('paid preparation and awakening have no chapter gate and no extra rewards, interest or unlocks',()=>{
 for(const chapter of [1,2,3,4,5]){
  const s=ready(['bastion'],{chapter}),before=clone(s),out=awaken(s).state;
  assert.equal(out.roster[0].ultimateSkillId,'ult_spear');assert.equal(out.roster[0].awakeningTraining.chapter,chapter);
  for(const field of ['gold','xp','chapter','battleCount','unlocks','research','relics','prepared','targetRelicId'])assert.deepEqual(out[field],before[field]);
 }
});

test('less than 60G fails atomically and neither visits, ordinary growth nor key possession substitute for preparation',()=>{
 const s=invested(['bastion'],{gold:59}),session=service(s),before=clone(session),c=session.service.choices.find(c=>c.kind==='awakening-training');
 assert.equal(c.affordable,false);assert.throws(()=>R.transition(session,{type:c.kind,candidateId:c.candidateId},'poor'),/60G/);assert.deepEqual(session,before);
 assert.equal(session.state.roster[0].awakeningTraining,undefined);assert.deepEqual(P.awakeningCandidates(collect(s,'iron_oath')),[]);
 assert.deepEqual(P.progressionCandidates(s),[]);
});

test('new saves reject key-as-skill, missing canonical stage3 identities and cross-branch variants without mutating input',()=>{
 const good=awaken(ready()).state;
 for(const mutate of [s=>{s.roster[0].skillIds[2]='iron_oath';},s=>{s.roster[0].ultimateId='iron_oath';},s=>{s.roster[0].ultimateSkillId='ult_mage';},s=>{s.roster[0].ultimateVariantId='sentinel';},s=>{delete s.roster[0].ultimateSkillId;},s=>{delete s.roster[0].ultimateVariantId;}]){
  const bad=clone(good);mutate(bad);const before=clone(bad);assert.throws(()=>P.validateProgressionState(bad));assert.deepEqual(bad,before);
 }
 const stage2=invested();delete stage2.roster[0].ultimateSkillId;delete stage2.roster[0].ultimateVariantId;assert.equal(P.validateProgressionState(stage2),true);
 const aliasOptional=clone(good);delete aliasOptional.roster[0].ultimateId;assert.equal(P.validateProgressionState(aliasOptional),true);
});

test('new progression receipt version rejects frozen E1 ledger without an implicit migration',()=>{
 const s=ready(),old=clone(s);old.progressionLedger[0].receipt.version='v10-progression-event-providers-1';const before=clone(old);
 assert.throws(()=>P.validateProgressionState(old),/ledger|version/i);assert.deepEqual(old,before);
 const cold=JSON.parse(JSON.stringify(s));assert.deepEqual(awaken(cold),awaken(s));
});
