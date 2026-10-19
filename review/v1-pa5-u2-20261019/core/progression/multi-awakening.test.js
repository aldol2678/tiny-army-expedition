// UA1 synthetic stage3 fixture explicitly supplies separated canonical identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import {SECOND_CLASSES,PROGRESSION_VERSION} from './registry.js';
import {C} from './test-fixture.js';
import {AWAKENING_TRAINING_PRICE,AWAKENING_TRAINING_VERSION,AWAKENING_LEDGER_VERSION,awakeningTrainingCandidates,applyAwakeningTraining,awakeningCandidates,applyAwakening,applyProgression,progressionCandidates,validateProgressionState} from './transactions.js';
const clone=x=>JSON.parse(JSON.stringify(x));
const node={id:'training-1',kind:'training',row:2};
const unit=(id=1,classId='bastion',track='specialty')=>{const c=SECOND_CLASSES[classId];return {id,type:c.firstClassId,training:2,trainingTrack:track,secondClassId:classId,classStage:2,skillIds:[...c.skillIds],ultimateId:null,slot:id-1,condition:71};};
const seed=(roster=[unit()])=>({phase:'map',chapter:1,battleCount:0,gold:180,xp:12,roster,relics:[],progressionLedger:[],awakening:{version:AWAKENING_LEDGER_VERSION,unitIds:[],deferred:false},campaignComplete:false,pendingBattle:null});
function train(s,unitId=1,tx=`prep-${unitId}`,facility=node){const input={...s,phase:'service'},candidate=awakeningTrainingCandidates(input).find(c=>c.unitId===unitId);assert(candidate);return applyAwakeningTraining(input,candidate,tx,{node:facility});}
function leave(s){return {...s,phase:'map',pendingService:null,currentNode:null};}
function keyed(s,...ids){return {...s,relics:ids.map(id=>({id,evolution:1}))};}
function awaken(s,id=1,tx=`awaken-${id}`){return applyAwakening(s,{type:'awaken',unitId:id},tx);}

test('preparation eligibility is observable at map/prepare/service and absent from ordinary growth',()=>{
 for(const phase of ['map','prepare','service']){const s={...seed(),phase},before=clone(s),c=awakeningTrainingCandidates(s);assert.equal(c.length,1);assert.equal(c[0].id,'awaken-train:1');assert.equal(c[0].price,60);assert.equal(c[0].kind,'awakening-training');assert.deepEqual(progressionCandidates(s),[]);assert.deepEqual(s,before);}
 for(const patch of [{phase:'reward'},{phase:'battle'},{phase:'settlement'},{phase:'complete'},{campaignComplete:true},{pendingBattle:{battleId:'frozen'}}])assert.deepEqual(awakeningTrainingCandidates({...seed(),...patch}),[]);
});
test('second class, trainingII and two exact basic skills must exist before preparation',()=>{
 const incomplete=[{id:1,type:'spear',training:0,trainingTrack:null},{id:1,type:'guardian',training:1,trainingTrack:'specialty'}, {...unit(),skillIds:undefined}];
 for(const u of incomplete)assert.deepEqual(awakeningTrainingCandidates(seed([u])),[]);
 for(const u of [{...unit(),training:1},{...unit(),secondClassId:'surgeon'},{...unit(),skillIds:['guardian_link']},{...unit(),skillIds:['guardian_link','fixed_aim']}])assert.throws(()=>awakeningTrainingCandidates(seed([u])));
});
test('preparation requires explicit real training service and consistent node context',()=>{
 const s=seed(),candidate=awakeningTrainingCandidates(s)[0],before=clone(s);
 for(const phase of ['map','prepare','reward','battle','complete','settlement','defeat'])assert.throws(()=>applyAwakeningTraining({...s,phase},candidate,'invalid',{node}));
 for(const badNode of [undefined,{id:node.id,kind:'shop'},{id:node.id,kind:'reward'},{kind:'training'},{id:'',kind:'training'}])assert.throws(()=>applyAwakeningTraining({...s,phase:'service'},candidate,'invalid',{node:badNode}));
 for(const patch of [{pendingBattle:{battleId:'frozen'}},{campaignComplete:true},{currentNode:'other'},{pendingService:{node:{id:'other',kind:'training'},chapter:1}},{pendingService:{node:{...node,kind:'shop'},chapter:1}},{pendingService:{node,chapter:2}},{chapter:0},{chapter:6}])assert.throws(()=>applyAwakeningTraining({...s,phase:'service',...patch},candidate,'invalid',{node}));
 assert.deepEqual(s,before);
 const good={...s,phase:'service',currentNode:node.id,pendingService:{node,chapter:1}};assert.equal(applyAwakeningTraining(good,candidate,'good',{node}).state.roster[0].awakeningTraining.sourceNodeId,node.id);
});
test('paid preparation before a key records cost once but wallet mutation belongs to host',()=>{
 const s=seed(),before=clone(s),out=train(s);assert.equal(AWAKENING_TRAINING_PRICE,60);assert.equal(out.state.gold,180);assert.equal(out.receipt.costOwnedByHost,true);assert.equal(out.receipt.cost,60);assert.equal(out.receipt.price,60);assert.equal(out.receipt.keyRequired,false);assert.equal(out.receipt.keyConsumed,false);assert.equal(out.receipt.basicStatsChanged,false);assert.equal(out.receipt.trainingRankChanged,false);
 assert.deepEqual(out.state.roster[0].awakeningTraining,{version:AWAKENING_TRAINING_VERSION,price:60,sourceNodeId:node.id,chapter:1,transactionId:'prep-1'});assert.deepEqual(s,before);assert.deepEqual(awakeningCandidates(leave(out.state)),[]);assert.deepEqual(awakeningTrainingCandidates(out.state),[]);
});
test('all32 branch/track preparations preserve exact base projection, training and investment',()=>{
 for(const c of Object.values(SECOND_CLASSES))for(const track of ['specialty','handling']){const s=seed([unit(1,c.id,track)]),out=train(s),prepared=out.state.roster[0],{awakeningTraining,...unchanged}=prepared;assert(awakeningTraining);assert.deepEqual(unchanged,s.roster[0]);assert.deepEqual(C.projectUnit(prepared,{roster:out.state.roster,relics:[]}),C.projectUnit(s.roster[0],{roster:s.roster,relics:[]}));assert.equal(out.state.gold,s.gold);assert.equal(out.state.xp,s.xp);assert.deepEqual(out.state.relics,s.relics);assert.deepEqual(progressionCandidates(out.state),[]);}
});
test('preparation transaction is exact-once and binds unit, price and facility',()=>{
 const input={...seed([unit(1),unit(2)]),phase:'service'},candidate=awakeningTrainingCandidates(input)[0],first=applyAwakeningTraining(input,candidate,'p',{node}),again=applyAwakeningTraining(first.state,candidate,'p',{node});assert.equal(first.duplicate,false);assert.equal(again.duplicate,true);assert.deepEqual(again.state,first.state);assert.deepEqual(again.receipt,first.receipt);assert.equal(first.state.progressionLedger.length,1);
 assert.throws(()=>applyAwakeningTraining(first.state,candidate,'another',{node}));assert.throws(()=>applyAwakeningTraining(first.state,candidate,'p',{node:{...node,id:'another'}}));
 for(const patch of [{unitId:2,id:'awaken-train:2'},{price:0},{cost:0},{kind:'train'},{id:'train:1'},{secondClassId:'surgeon'},{keyId:'arcane_seed'}])assert.throws(()=>applyAwakeningTraining(first.state,{...candidate,...patch},'p',{node}));
 assert.throws(()=>applyProgression(input,candidate,'not-ordinary'));
});
test('unprepared matching key holder and prepared mismatched key holder cannot awaken',()=>{
 const s=keyed(seed(),'iron_oath');assert.deepEqual(awakeningCandidates(s),[]);assert.throws(()=>awaken(s));const prepared=leave(train(seed()).state);assert.deepEqual(awakeningCandidates(keyed(prepared,'eagle_signet')),[]);assert.throws(()=>awaken(keyed(prepared,'eagle_signet')));assert.equal(awakeningCandidates(keyed(prepared,'iron_oath')).length,1);
});
test('one retained key supports separately prepared units without global awakening cap',()=>{
 let s=keyed(seed([unit(1),unit(2,'sentinel')]),'iron_oath');s=leave(train(s,1).state);assert.deepEqual(awakeningCandidates(s).map(c=>c.unitId),[1]);s=awaken(s,1).state;assert.deepEqual(s.awakening.unitIds,[1]);assert.deepEqual(awakeningCandidates(s),[]);assert.deepEqual(awakeningTrainingCandidates(s).map(c=>c.unitId),[2]);
 s=leave(train(s,2).state);assert.deepEqual(awakeningCandidates(s).map(c=>c.unitId),[2]);s=awaken(s,2).state;assert.deepEqual(s.awakening,{version:AWAKENING_LEDGER_VERSION,unitIds:[1,2],deferred:false});assert(s.roster.every(u=>u.classStage===3));assert.equal(s.gold,180);assert.deepEqual(s.relics,[{id:'iron_oath',evolution:1}]);assert.equal(s.roster[0].awakeningTraining.transactionId,'prep-1');assert.equal(s.roster[1].awakeningTraining.transactionId,'prep-2');assert.equal(validateProgressionState(s),true);
});
test('each of four families awakens independently only with its retained matching key',()=>{
 let s=seed([unit(1,'bastion'),unit(2,'marksman'),unit(3,'ember_tactician'),unit(4,'surgeon')]);for(const u of s.roster)s=leave(train(s,u.id).state);s=keyed(s,'iron_oath','eagle_signet','arcane_seed','covenant_lamp');for(const id of [4,2,1,3])s=awaken(s,id).state;assert.deepEqual(s.awakening.unitIds,[4,2,1,3]);assert.equal(s.relics.length,4);assert(s.roster.every(u=>u.classStage===3));
});
test('awakening itself is exact-once per unit, free and nonconsuming',()=>{
 const s=keyed(leave(train(seed()).state),'iron_oath'),out=awaken(s),again=awaken(out.state);assert(again.duplicate);assert.deepEqual(again.state,out.state);assert.deepEqual(again.receipt,out.receipt);assert.equal(out.receipt.cost,0);assert.equal(out.receipt.keyConsumed,false);assert.equal(out.state.gold,s.gold);assert.equal(out.state.roster[0].skillIds.length,3);assert.deepEqual(out.state.relics,s.relics);assert.throws(()=>awaken(out.state,1,'duplicate-new-id'));
});
test('early preparation and awakening stay available across all chapters including chapter5',()=>{
 for(const chapter of [1,2,3,4,5]){let s={...seed(),chapter};s=leave(train(s).state);assert.equal(s.roster[0].awakeningTraining.chapter,chapter);s=keyed(s,'iron_oath');assert.equal(awaken(s).state.roster[0].classStage,3);}
 const early=train(seed()).state,late=keyed({...leave(early),chapter:5,battleCount:29},'iron_oath');assert.equal(awaken(late).state.roster[0].classStage,3);assert.equal(late.roster[0].awakeningTraining.chapter,1);
});
test('defer preserves prepared units, awakened entries and later future opportunities',()=>{
 let s=keyed(seed([unit(1),unit(2)]),'iron_oath');s=leave(train(s,1).state);s=leave(train(s,2).state);const before=clone(s.roster);s=applyAwakening(s,{type:'skipAwakening'},'skip-first').state;assert(s.awakening.deferred);assert.deepEqual(s.roster,before);assert.deepEqual(awakeningCandidates(s).map(c=>c.unitId),[1,2]);s=awaken(s,1).state;s=applyAwakening(s,{type:'skipAwakening'},'skip-after-one').state;assert.deepEqual(s.awakening,{version:AWAKENING_LEDGER_VERSION,unitIds:[1],deferred:true});assert.deepEqual(awakeningCandidates(s).map(c=>c.unitId),[2]);s=awaken({...s,chapter:5},2).state;assert.deepEqual(s.awakening.unitIds,[1,2]);assert.equal(s.awakening.deferred,false);
 const empty=applyAwakening(seed(),{type:'skipAwakening'},'skip-before-preparation').state;assert.equal(awakeningTrainingCandidates(empty).length,1);
});
test('map/prepare awakening is locked throughout pending checkpoints and completion',()=>{
 const s=keyed(leave(train(seed()).state),'iron_oath');for(const phase of ['map','prepare'])assert.equal(awakeningCandidates({...s,phase}).length,1);
 for(const patch of [{phase:'service'},{phase:'reward'},{phase:'battle'},{phase:'complete'},{phase:'settlement'},{phase:'defeat'},{pendingBattle:{battleId:'frozen'}},{campaignComplete:true}]){const bad={...s,...patch},before=clone(bad);assert.deepEqual(awakeningCandidates(bad),[]);assert.throws(()=>awaken(bad));assert.throws(()=>applyAwakening(bad,{type:'skipAwakening'},'skip-locked'));assert.deepEqual(bad,before);}
});
test('malformed individual preparation records and inconsistent receipts are rejected',()=>{
 const good=leave(train(seed()).state),patches=[null,true,{}, {...good.roster[0].awakeningTraining,version:'old'}, {...good.roster[0].awakeningTraining,price:0}, {...good.roster[0].awakeningTraining,chapter:2}, {...good.roster[0].awakeningTraining,chapter:0}, {...good.roster[0].awakeningTraining,sourceNodeId:''}, {...good.roster[0].awakeningTraining,transactionId:'missing'}, {...good.roster[0].awakeningTraining,shared:true}];
 for(const preparation of patches){const bad=clone(good);bad.roster[0].awakeningTraining=preparation;assert.throws(()=>validateProgressionState(bad));}
 for(const mutate of [s=>{delete s.roster[0].awakeningTraining;},s=>{s.progressionLedger=[];},s=>{s.progressionLedger[0].receipt.unitId=2;},s=>{s.progressionLedger[0].receipt.costOwnedByHost=false;},s=>{s.progressionLedger[0].receipt.price=0;},s=>{s.progressionLedger[0].receipt.preparation.sourceNodeId='other';},s=>{s.progressionLedger[0].fingerprint='forged';}]){const bad=clone(good);mutate(bad);assert.throws(()=>validateProgressionState(bad));}
 const withoutLedger=clone(good);delete withoutLedger.progressionLedger;assert.equal(validateProgressionState(withoutLedger),true);assert.throws(()=>awakeningCandidates(keyed(withoutLedger,'iron_oath')));assert.throws(()=>applyAwakening(withoutLedger,{type:'skipAwakening'},'cannot-mutate-snapshot'));
});
test('preparation cannot be shared across units or copied under another identity',()=>{
 const s=leave(train(seed([unit(1),unit(2)])).state),bad=clone(s);bad.roster[1].awakeningTraining=clone(bad.roster[0].awakeningTraining);assert.throws(()=>validateProgressionState(bad));delete bad.progressionLedger;assert.throws(()=>validateProgressionState(bad));
});
test('per-unit awakening ledger rejects old T1 identity, duplicates and roster mismatch',()=>{
 const s=keyed(leave(train(seed()).state),'iron_oath'),awake=awaken(s).state;
 for(const awakening of [{decided:true,used:true,unitId:1,decision:'awaken'},{version:'old',unitIds:[1],deferred:false},{version:AWAKENING_LEDGER_VERSION,unitIds:[1,1],deferred:false},{version:AWAKENING_LEDGER_VERSION,unitIds:[],deferred:false},{version:AWAKENING_LEDGER_VERSION,unitIds:[2],deferred:false},{version:AWAKENING_LEDGER_VERSION,unitIds:[1],deferred:'false'}])assert.throws(()=>validateProgressionState({...awake,awakening}));
 const historical=clone(s);historical.progressionLedger[0].receipt.version='v10-progression-prerequisite-timing-1';assert.notEqual(historical.progressionLedger[0].receipt.version,PROGRESSION_VERSION);assert.throws(()=>validateProgressionState(historical));
});
test('combat-only advanced fixtures need no preparation metadata but cannot become campaign transactions',()=>{
 const roster=[unit(1),unit(2)];for(const u of roster){u.classStage=3;u.ultimateId=SECOND_CLASSES[u.secondClassId].ultimateId;u.ultimateSkillId=SECOND_CLASSES[u.secondClassId].ultimateSkillId;u.ultimateVariantId=SECOND_CLASSES[u.secondClassId].ultimateVariantId;u.skillIds.push(u.ultimateId);}const synthetic={roster,phase:'map',chapter:1};assert.equal(validateProgressionState(synthetic),true);assert.throws(()=>applyAwakening(synthetic,{type:'skipAwakening'},'cannot-migrate-fixture'));
});
