'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createTransactionalHost}=require('./adapter.cjs');
const {createMemoryCheckpointStore,cloneJSON,canonical}=require('./checkpoint-core.cjs');
function fixture({store=createMemoryCheckpointStore(),parentComposition=true}={}){
 let live={hp:100,notes:[]},restores=0;
 const host=createTransactionalHost({hostId:'parent-fixture',store,parentComposition,capture:()=>live,restore:s=>{live=s;restores++;},snapshot:()=>({units:[]}),applyDamage:()=>{throw Error('Unexpected effect');}});
 return {host,store,get live(){return live;},get restores(){return restores;}};
}
function savedCheckpoint(){const f=fixture(),cp=f.host.capturePrivateCheckpoint();cp.revision=7;cp.transactionId='prior:settle';cp.host={hp:73,notes:['prior-effect']};cp.records={action:{unitId:1,actionSeq:1,signature:'stable',tick:27,pending:{action:{actionId:'prior'}},events:[],settled:{action:null}}};cp.receipts={effect:{signature:'frozen',receipt:{eventId:'effect',actualDamage:27}}};return cp;}
test('private inspection is pure and fresh adoption preserves the entire envelope without restoring Game',()=>{
 const saved=savedCheckpoint(),f=fixture(),before=f.store.load();f.live.hp=73;f.live.notes.push('parent-restored');
 assert.deepEqual(f.host.validatePrivateCheckpoint(saved),saved);assert.deepEqual(f.store.load(),before);assert.equal(f.restores,0);
 f.host.adoptPrivateCheckpoint(saved);assert.deepEqual(f.store.load(),saved);assert.deepEqual(f.host.capturePrivateCheckpoint(),saved);assert.equal(f.host.revision,7);assert.equal(f.live.hp,73);assert.deepEqual(f.live.notes,['parent-restored']);assert.equal(f.restores,0);
 const inspected=f.host.capturePrivateCheckpoint();inspected.receipts.effect.receipt.actualDamage=0;assert.deepEqual(f.host.capturePrivateCheckpoint(),saved);assert.throws(()=>f.host.adoptPrivateCheckpoint(saved),/fresh|adopt/i);
});
test('adoption rejects foreign, durable, used, preloaded, and exact-parent conflicts before mutation',()=>{
 const saved=savedCheckpoint(),foreign=cloneJSON(saved);foreign.hostId='foreign';const f=fixture();assert.throws(()=>f.host.validatePrivateCheckpoint(foreign),/foreign/i);assert.equal(f.host.revision,0);
 const base=createMemoryCheckpointStore(),durable=fixture({store:{load:base.load,commit:base.commit}});assert.throws(()=>durable.host.adoptPrivateCheckpoint(saved),/private|memory/i);assert.equal(durable.restores,0);
 const disabled=fixture({parentComposition:false});assert.throws(()=>disabled.host.capturePrivateCheckpoint(),/composition|enabled/i);
 const used=fixture();used.live.hp--;used.host.exportCheckpoint();assert.throws(()=>used.host.adoptPrivateCheckpoint(saved),/fresh/i);
 const preloaded=fixture({store:createMemoryCheckpointStore(f.store.load())});assert.throws(()=>preloaded.host.adoptPrivateCheckpoint(saved),/fresh/i);
 const stale=fixture(),originalLoad=stale.store.load;stale.store.load=()=>{const cp=originalLoad();cp.transactionId='same-revision-foreign';return cp;};assert.throws(()=>stale.host.capturePrivateCheckpoint(),/conflict/i);assert.throws(()=>stale.host.adoptPrivateCheckpoint(saved),/conflict/i);assert.equal(stale.restores,0);
});
test('parent transaction allows pure inspection but blocks all child mutations and releases after throws',()=>{
 const f=fixture(),saved=savedCheckpoint(),before=canonical(f.store.load());
 f.host.withParentTransaction(()=>{assert.equal(f.host.capturePrivateCheckpoint().revision,0);for(const fn of [()=>f.host.prepare({},0),()=>f.host.resolve({},0),()=>f.host.exportCheckpoint(),()=>f.host.adoptPrivateCheckpoint(saved),()=>f.host.withParentTransaction(()=>{})])assert.throws(fn,/parent|nested/i);});
 assert.equal(canonical(f.store.load()),before);assert.throws(()=>f.host.withParentTransaction(()=>{throw Error('parent-failed');}),/parent-failed/);f.live.hp--;f.host.exportCheckpoint();assert.equal(f.host.revision,1);
});
test('private inspection and parent transactions reject an uncertain child without reconciling it',()=>{
 const base=createMemoryCheckpointStore();let failRead=false,armed=false;
 const store={load(){if(failRead){failRead=false;throw Error('read unavailable');}return base.load();},commit(parent,next){base.commit(parent,next);if(armed){armed=false;failRead=true;throw Error('ack lost');}}};
 const f=fixture({store});f.live.hp=50;armed=true;assert.throws(()=>f.host.exportCheckpoint(),e=>e.code==='CHECKPOINT_OUTCOME_UNKNOWN');const restored=f.restores;
 assert.throws(()=>f.host.capturePrivateCheckpoint(),/unknown|uncertain/i);assert.throws(()=>f.host.withParentTransaction(()=>{}),/unknown|uncertain/i);assert.equal(f.restores,restored);assert.equal(base.load().host.hp,50);
 f.host.exportCheckpoint();assert.equal(f.live.hp,50);assert.equal(f.host.capturePrivateCheckpoint().revision,1);
});
test('busy child rejects parent inspection and cannot grant a parent transaction',()=>{
 let host,armed=false;const live={hp:100};host=createTransactionalHost({hostId:'busy',parentComposition:true,capture(){if(armed){assert.throws(()=>host.capturePrivateCheckpoint(),/busy/i);assert.throws(()=>host.withParentTransaction(()=>{}),/busy/i);}return live;},restore:s=>Object.assign(live,s),snapshot:()=>({units:[]}),applyDamage:()=>{}});
 armed=true;live.hp--;host.exportCheckpoint();assert.equal(host.capturePrivateCheckpoint().revision,1);
});
test('live spear adapter blocks both scheduler phases while the parent owns its transaction',()=>{
 const {A,C}=require('./test-support.cjs'),{createSpearCombatAdapter,SPEAR_COMBAT_VERSION}=require('./combat.cjs'),{captureGame}=require('./v09-host.cjs');
 const roster=[{id:1,type:'charger',slot:0,training:2,trainingTrack:'specialty',condition:100,secondClassId:'vanguard',classStage:2}],game=new A.Game();
 assert.equal(game.configureBattle({seed:7,battleId:'parent-lock',combatRulesVersion:C.COMBAT_VERSION,roster,encounter:{enemies:['boss'],scale:1},skills:['heal','guard'],relics:[]}),true);assert.equal(game.start(),true);
 const adapter=createSpearCombatAdapter(game,{content:C,roster,ultimateMode:'independent-foundation'}),before=canonical(captureGame(game));assert.equal(SPEAR_COMBAT_VERSION,'spear-live-four-v4-ultimate-composite');
 adapter.withParentTransaction(()=>{assert.throws(()=>adapter.beforeTick(),/parent/i);assert.throws(()=>adapter.afterTick(),/parent/i);assert.equal(adapter.capturePrivateCheckpoint().revision,0);});assert.equal(canonical(captureGame(game)),before);adapter.beforeTick();
});
