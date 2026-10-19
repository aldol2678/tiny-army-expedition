// Pure reducer tests using synthetic states and real service/projection modules.
// No actual combat, campaign, seed-balance run, deployment, or win-rate evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {C, state, unit, digest} from '../relic-services/test-fixture.js';
import {createRelicServices} from '../relic-services/index.js';
import {createEventServices, EVENT_IDS, EVENT_TRIAL_VALUES as V} from './index.js';
import {EVENT_TRIAL_CONFIG, EVENT_DEFINITION_IDS} from './config.js';
import {clone} from './registry.js';
const R = createRelicServices(C, {digest, enableNewRelics: true, enablePreparedEvents: true, enableResearch: true});
const E = createEventServices({services: R, content: C, digest});
const n = (id, extra={}) => ({id:`event-${id}`, kind:'event', row:3, eventDefinitionId:id, ...extra});
const choice = (offer, suffix) => offer.choices.find(c => c.id.endsWith(`:${suffix}`));
const make = (id, extra={}, nodeExtra={}) => {const s=state(extra); return {s,o:E.makeEventOffer(s,n(id,nodeExtra))};};
const select = (s,o,suffix) => E.applyEventChoice(s,o,choice(o,suffix).id);
const withVictory = (s,o) => ({...clone(s), battleCount:s.battleCount+1, xp:s.xp+2, gold:s.gold+20, pendingEvent:clone(o)});

test('pure synthetic: authoritative config and exactly eight mechanisms, no final-balance claim',()=>{
  assert.equal(EVENT_TRIAL_CONFIG,V); assert.equal(EVENT_DEFINITION_IDS,EVENT_IDS);
  assert.equal(EVENT_IDS.length,8); assert.equal(new Set(EVENT_IDS).size,8);
  assert.match(V.status,/NOT_FINAL_USER_APPROVED/); assert.equal(V.releaseReady,false);
  assert.deepEqual(V.providerPrices,{training:30,individualPreparation:60,forgeIToII:20,forgeIIToIII:30,research:20});
  assert.equal(V.interestEnabled,false);
});
test('pure synthetic: all eight offers freeze two choices, source, ID, version and hash without mutation',()=>{
  for(const id of EVENT_IDS){const s=state(),before=clone(s),o=E.makeEventOffer(s,n(id));
    assert.deepEqual(s,before);assert.equal(o.choices.length,2);assert.equal(o.node.kind,'event');
    assert.equal(o.id,o.eventId);assert.equal(o.chapter,s.chapter);assert.equal(o.selectionBudget,1);
    assert.equal(o.candidateBalance,true);assert.ok(Object.isFrozen(o));assert.ok(Object.isFrozen(o.choices));
    const {offerHash,...payload}=o;assert.equal(offerHash,digest(payload));
    assert.deepEqual(E.makeEventOffer(s,n(id)),o);
  }
});
test('pure synthetic: seeded content does not change with run ID and unknown definition fails',()=>{
  for(const id of ['prisoner','treasure','ambush']){const a=E.makeEventOffer(state({runId:'a'}),n(id)),b=E.makeEventOffer(state({runId:'b'}),n(id));
    assert.notEqual(a.id,b.id);assert.deepEqual(a.choices.map(c=>c.grant??c.combat?.encounterKind),b.choices.map(c=>c.grant??c.combat?.encounterKind));}
  assert.throws(()=>make('unknown'),/Unknown event/);assert.throws(()=>E.makeEventOffer(state(),{id:'x',kind:'training',row:3}),/genuine/);
});
test('pure synthetic: trainer, forge and strategist open fixed true-event capability and entry grants nothing',()=>{
  for(const [id,serviceKind] of [['trainer','training'],['field_forge','forge'],['strategist','lab']]){
    const {s,o}=make(id,{relics:[{id:'long_sight',evolution:1}]});
    const out=select(s,o,'provider');assert.deepEqual(out.state,s);assert.equal(out.next,'provider');
    assert.equal(out.providerKind,id);assert.equal(out.providerOffer.node.kind,'event');
    assert.equal(out.providerOffer.providerCapability.serviceKind,serviceKind);
    assert.equal(out.providerOffer.providerCapability.eventId,o.id);assert.deepEqual(out.providerOffer,choice(o,'provider').providerOffer);
    assert.equal(out.receipt.goldGranted,0);assert.equal(out.receipt.goldCost,0);
    assert.deepEqual(select(s,o,'leave').state,s);
  }
});
test('pure synthetic: provider item prices are inherited, stock stays frozen, no free preparation',()=>{
  const {o}=make('trainer');const p=choice(o,'provider').providerOffer;
  assert.ok(p.choices.some(c=>c.kind==='train'));assert.ok(p.choices.filter(c=>c.kind==='train').every(c=>c.price===30));
  assert.ok(p.choices.filter(c=>c.kind==='awakening-training').every(c=>c.price===60));
  assert.equal(p.multiPurchase,true);assert.ok(p.stockHash);assert.deepEqual(p.purchasedCandidateIds,[]);
  const forge=make('field_forge',{relics:[{id:'long_sight',evolution:1},{id:'banner',evolution:2}]}).o;
  assert.equal(choice(forge,'provider').providerOffer.choices.find(c=>c.relicId==='long_sight').price,20);
  assert.equal(choice(forge,'provider').providerOffer.choices.find(c=>c.relicId==='banner').price,30);
  const lab=make('strategist').o;assert.ok(choice(lab,'provider').providerOffer.choices.filter(c=>c.kind==='research').every(c=>c.price===20));
});
test('pure synthetic: treasure freezes useful common versus rare actual-elite descriptor; exclusive grants',()=>{
  const {s,o}=make('treasure'),safe=choice(o,'safe'),fight=choice(o,'fight');
  assert.equal(safe.grant.relic.id,'long_sight');assert.equal(R.RELICS[safe.grant.relic.id].intrinsicRarity,'common');
  assert.equal(R.RELICS[fight.grant.relic.id].intrinsicRarity,'rare');assert.equal(safe.preview.valid,true);assert.equal(fight.preview.valid,true);
  const out=select(s,o,'safe');assert.equal(out.state.relics.length,s.relics.length+1);assert.equal(out.receipt.goldGranted,0);
  assert.equal(out.state.battleCount,s.battleCount);assert.equal(out.state.xp,s.xp);assert.equal(out.state.gold,s.gold);
  const pending=select(s,o,'fight');assert.deepEqual(pending.state,s);assert.equal(pending.next,'battle');
  assert.equal(pending.combat.encounterKind,'elite');assert.equal(pending.combat.encounter.kind,'elite');
  assert.equal(pending.combat.rewardMode,'event-special-replacement');assert.equal(pending.combat.ordinaryRewardSelectionBudget,0);
});
test('pure synthetic: saturated treasure never rerolls, can safely close, cannot auto-sell or duplicate',()=>{
  const saturated=state({relics:Object.keys(R.RELICS).map(id=>({id,evolution:R.RELICS[id].maxEvolution||3}))});
  const o=E.makeEventOffer(saturated,n('treasure'));assert.equal(o.choices.length,2);assert.ok(o.choices.every(c=>c.disabled));
  assert.ok(o.choices.every(c=>c.reason));assert.equal(o.safeCloseAllowed,true);
  assert.deepEqual(E.applyEventChoice(saturated,o,null).state,saturated);
  assert.throws(()=>select(saturated,o,'safe'),/available/);
  const {s,o:original}=make('treasure'),claimed=select(s,original,'safe').state;
  assert.throws(()=>select(claimed,original,'safe'),/snapshot/);
});
test('pure synthetic: prisoner paths name the same legal reserve, ransom pays exactly30 and no unlock or prep',()=>{
  const {s,o}=make('prisoner'),fight=choice(o,'fight'),ransom=choice(o,'ransom');assert.deepEqual(fight.grant,ransom.grant);
  assert.ok(['charger','guardian','sniper','volley'].includes(ransom.grant.type));assert.equal(ransom.goldCost,30);assert.equal(ransom.goldAfter,s.gold-30);
  const out=select(s,o,'ransom'),added=out.state.roster.at(-1);assert.equal(out.state.gold,s.gold-30);assert.equal(out.state.roster.length,s.roster.length+1);
  assert.deepEqual({...added,id:undefined},{id:undefined,type:ransom.grant.type,training:0,trainingTrack:null,condition:100,slot:null});
  assert.deepEqual(out.state.unlocks,s.unlocks);assert.deepEqual(out.state.awakening,s.awakening);assert.equal(added.awakeningTraining,undefined);
  const pending=select(s,o,'fight');assert.deepEqual(pending.state,s);assert.equal(pending.combat.encounterKind,'normal');
});
test('pure synthetic: ransom insufficient funds and full roster fail atomically and permit safe close',()=>{
  const {s,o}=make('prisoner',{gold:29});const before=clone(s);assert.equal(choice(o,'ransom').affordable,false);
  assert.equal(choice(o,'ransom').goldAfter,null);assert.throws(()=>select(s,o,'ransom'),/30G/);assert.deepEqual(s,before);
  assert.equal(o.safeCloseAllowed,true);assert.deepEqual(E.applyEventChoice(s,o,null).state,s);
  const full=state({roster:Array.from({length:20},(_,i)=>unit(i+1,'spear',i===0?0:null)),nextUnitId:21}),fullBefore=clone(full),fo=E.makeEventOffer(full,n('prisoner'));
  assert.ok(fo.choices.every(c=>c.disabled));assert.throws(()=>select(full,fo,'ransom'),/cap20/);assert.deepEqual(full,fullBefore);
  assert.deepEqual(E.applyEventChoice(full,fo,null).state,full);
});
test('pure synthetic: escape exact all-owned deltas floor at0, no hidden KO/recovery/resources',()=>{
  const s=state({roster:[unit(1,'guardian',0,{condition:22}),unit(2,'archer',8,{condition:5}),unit(3,'support',null,{condition:80}),unit(4,'mage',null,{condition:0})]}),o=E.makeEventOffer(s,n('ambush',{eventEncounterKind:'elite'}));
  const escape=choice(o,'escape');assert.deepEqual(escape.actualConditionChanges.map(c=>c.delta),[-8,-5,-8,0]);assert.equal(escape.totalActualConditionDelta,-21);
  const out=select(s,o,'escape');assert.deepEqual(out.state.roster.map(u=>u.condition),[14,0,72,0]);
  assert.equal(out.receipt.effect.totalActualConditionDelta,-21);assert.equal(out.receipt.effect.knockout,false);
  for(const key of ['gold','xp','battleCount'])assert.equal(out.state[key],s[key]);
  for(const key of ['goldCost','goldGranted','xp','battles','wins','rewards','interest'])assert.equal(out.receipt[key],0);
  assert.throws(()=>E.applyEventChoice(s,o,null),/no free/);assert.throws(()=>select({...s,pendingBattle:{battleId:'already-started'}},o,'escape'),/commitment/);
});
test('pure synthetic: zero-condition escape discloses zero actual loss and no phantom cost',()=>{
  const {s,o}=make('ambush',{roster:[unit(1,'spear',0,{condition:0})],nextUnitId:2});
  assert.equal(choice(o,'escape').totalActualConditionDelta,0);assert.equal(select(s,o,'escape').state.roster[0].condition,0);
});
test('pure synthetic: consecutive boss-grade event descriptors retain event origin, not progression',()=>{
  let s=state({chapter:5,milestones:{chapterBosses:[1,2,3,4]}});const before=clone(s);
  for(let i=0;i<2;i++){const o=E.makeEventOffer(s,n('ambush',{id:`boss-grade-event-${i}`,eventEncounterKind:'boss'})),out=select(s,o,'fight');
    assert.equal(out.combat.encounterKind,'boss');assert.equal(out.combat.encounter.kind,'boss');assert.equal(out.combat.milestoneOrigin,'event');
    assert.equal(out.combat.advancesMilestone,false);assert.equal(out.combat.grantsGuaranteedKey,false);
    assert.deepEqual({gold:out.combat.gold,xp:out.combat.xp,fatigue:out.combat.fatigue},{gold:30,xp:3,fatigue:3});
    s=out.state;assert.deepEqual(s.milestones,before.milestones);assert.equal(s.chapter,5);assert.equal(s.campaignComplete,false);
  }
  assert.deepEqual(s,before); // Reducers do not invent either real combat result.
});
test('pure synthetic: supplies recovery or explicit one-shot15G grant, never both',()=>{
  const {s,o}=make('supplies',{roster:[unit(1,'spear',0,{condition:95}),unit(2,'archer',null,{condition:20})],nextUnitId:3});
  const heal=select(s,o,'recover');assert.deepEqual(heal.state.roster.map(u=>u.condition),[100,38]);assert.equal(heal.receipt.effect.totalActualConditionDelta,23);assert.equal(heal.state.gold,s.gold);
  const sell=select(s,o,'sell');assert.equal(sell.state.gold,s.gold+15);assert.deepEqual(sell.state.roster,s.roster);
  assert.deepEqual(sell.receipt.eventGrant,{kind:'gold',amount:15});assert.equal(sell.receipt.xp,0);assert.equal(sell.receipt.interest,0);
});
test('pure synthetic: scout reproduces E01 recovery/prepared tradeoff and no stacking or permanent stats',()=>{
  const {s,o}=make('scout',{chapter:5,roster:[unit(1,'spear',0,{condition:98}),unit(2,'archer',null,{condition:3})],nextUnitId:3});
  const rest=select(s,o,'rest'),scout=select(s,o,'scout');assert.deepEqual(rest.state.roster.map(u=>u.condition),[100,21]);
  assert.deepEqual(scout.state.roster.map(u=>u.condition),[93,0]);assert.equal(scout.state.prepared,true);
  assert.equal(choice(o,'scout').preview.damageBonus,C.CONDITION.preparedDamageBonus);assert.equal(choice(o,'scout').preview.durationSeconds,C.CONDITION.preparedDuration);
  assert.deepEqual(scout.state.relics,s.relics);assert.equal(scout.state.gold,s.gold);assert.equal(scout.state.xp,s.xp);
});
test('pure synthetic: special reward replaces ordinary chooser once, allows pass and has no reroll',()=>{
  for(const id of ['treasure','prisoner']){const {s,o}=make(id),c=choice(o,'fight');
    assert.throws(()=>E.makeCombatReward(s,o,c.id),/associated victory/);
    const after=withVictory(s,o),reward=E.makeCombatReward(after,o,c.id);
    assert.equal(reward.mode,'event-special-replacement');assert.equal(reward.original.length,1);assert.equal(reward.selectionBudget,1);assert.equal(reward.ordinaryRewardSelectionBudget,0);assert.equal(reward.reroll,null);
    assert.deepEqual(E.applyCombatReward(after,reward,null).state,after);
    const out=E.applyCombatReward(after,reward,reward.original[0].candidateId);
    assert.equal(out.receipt.selectionBudgetUsed,1);assert.equal(out.state.gold,after.gold);assert.equal(out.state.xp,after.xp);
    assert.equal(out.state.roster.length+out.state.relics.length,after.roster.length+after.relics.length+1);
    assert.throws(()=>E.applyCombatReward(out.state,reward,reward.original[0].candidateId),/snapshot/);
  }
});
test('pure synthetic: blocked postbattle grant remains fixed and explicitly skippable, never replaced or sold',()=>{
  const {s,o}=make('treasure'),c=choice(o,'fight'),after=withVictory(s,o);after.relics.push(clone(c.grant.relic));
  const reward=E.makeCombatReward(after,o,c.id);assert.equal(reward.original[0].disabled,true);assert.deepEqual(reward.grant,c.grant);
  const before=clone(after);assert.throws(()=>E.applyCombatReward(after,reward,reward.original[0].candidateId),/Unavailable/);assert.deepEqual(after,before);
  assert.deepEqual(E.applyCombatReward(after,reward,null).state,after);
});
test('pure synthetic: tampering, stale snapshots, unknown choices, invalid costs fail without mutation',()=>{
  const {s,o}=make('prisoner'),before=clone(s),bad=clone(o);bad.choices[1].goldCost=0;
  assert.throws(()=>E.applyEventChoice(s,bad,bad.choices[1].id),/contents changed/);assert.deepEqual(s,before);
  assert.throws(()=>E.applyEventChoice(s,o,'missing'),/Unknown/);
  assert.throws(()=>select({...s,xp:s.xp+1},o,'ransom'),/snapshot/);
  assert.throws(()=>select({...s,gold:0},o,'ransom'),/30G/);assert.deepEqual(s,before);
  assert.throws(()=>select({...s,runId:'other-run'},o,'ransom'),/snapshot/);
  assert.throws(()=>select({...s,nextUnitId:s.nextUnitId+1},o,'ransom'),/snapshot/);
  assert.throws(()=>select({...s,eventResolution:{next:'battle'}},o,'ransom'),/commitment/);
  assert.throws(()=>select({...s,phase:'prepare'},o,'ransom'),/commitment/);
});
test('pure synthetic: local module production source has no Node APIs, nondeterministic RNG or forbidden label',()=>{
  const source=['index.js','registry.js','config.js'].map(f=>fs.readFileSync(new URL(f,import.meta.url),'utf8')).join('\n');
  assert.doesNotMatch(source,/[\'"]node:|Math\.random|Date\.now|localStorage|장 보스/);
});

test('consistency: prisoner safe close does not depend on29/30/31G, and ambush never gets a free exit',()=>{
 for(const gold of [0,29,30,31,100]){const {s,o}=make('prisoner',{gold});assert.equal(o.choices.length,2);assert.equal(o.safeCloseAllowed,true);const before=clone(s),r=E.applyEventChoice(s,o,null);assert.deepEqual(r.state,before);assert.equal(r.receipt.goldCost,0);assert.equal(r.receipt.goldGranted,0);assert.equal(r.receipt.safeClose,true);assert.equal(r.receipt.grantsNothing,true);}
 const {s,o}=make('ambush',{gold:0});assert.equal(o.safeCloseAllowed,false);assert.throws(()=>E.applyEventChoice(s,o,null),/no free safe-close/);
});
test('consistency: zero-recovery supplies and already-prepared costly scouting are disabled without changing the alternative',()=>{
 const {s,o}=make('supplies',{roster:[unit(1,'spear',0,{condition:100}),unit(2,'archer',null,{condition:100})],nextUnitId:3});assert.equal(choice(o,'recover').disabled,true);assert.match(choice(o,'recover').reason,/컨디션/);assert.throws(()=>select(s,o,'recover'));assert.equal(select(s,o,'sell').state.gold,s.gold+15);
 const partial=make('supplies',{roster:[unit(1,'spear',0,{condition:99})],nextUnitId:2});assert.equal(choice(partial.o,'recover').disabled,false);assert.equal(select(partial.s,partial.o,'recover').state.roster[0].condition,100);
 const prepared=make('scout',{prepared:true,roster:[unit(1,'spear',0,{condition:70})],nextUnitId:2});assert.equal(choice(prepared.o,'scout').disabled,true);assert.match(choice(prepared.o,'scout').reason,/이미/);assert.throws(()=>select(prepared.s,prepared.o,'scout'));assert.equal(select(prepared.s,prepared.o,'rest').state.roster[0].condition,88);
});
