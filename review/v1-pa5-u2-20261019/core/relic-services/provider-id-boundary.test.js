import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../runtime/campaign.js';
import {VERSION} from './index.js';
import {SECOND_CLASSES,validateProgressionState} from '../progression/index.js';
const R=M.integrated.services,clone=structuredClone;
const advanced=id=>({id,type:'guardian',slot:id-1,training:2,trainingTrack:'specialty',condition:100,classStage:2,secondClassId:'bastion',skillIds:[...SECOND_CLASSES.bastion.skillIds],ultimateId:null});
function fixture(runId,providerKind='trainer',patch={},contextPatch={}){
 const s={...M.createRuntime(17,runId).state,phase:'service',currentNode:'portable-boundary',chapter:2,gold:120,xp:10,roster:[advanced(1),advanced(2)],nextUnitId:3,...patch};
 const node={id:'portable-boundary',kind:'event',row:3,eventDefinitionId:providerKind};
 const context={eventId:'event:0123456789abcdef0123456789abcdef',definitionId:providerKind,providerKind,...contextPatch};
 const offer=R.makeProviderOffer(s,node,context);
 s.pendingEvent={id:context.eventId,eventId:context.eventId,definitionId:context.definitionId,chapter:s.chapter,node:clone(node),choices:[{id:'use',providerOffer:clone(offer)}]};
 s.pendingService=clone(offer);return {s,node,context,offer};
}
const apply=(f,c)=>R.applyServiceAction(f.s,f.offer,{type:c.kind,candidateId:c.candidateId});
test('SYNTHETIC maximum160-character accepted run ID performs actual portable training with production callback',()=>{
 const id='r'.repeat(160),f=fixture(id,'trainer',{roster:[{id:1,type:'guardian',slot:0,training:1,trainingTrack:'specialty',condition:100}],nextUnitId:2});
 assert.equal(f.s.runId.length,160);assert.match(f.offer.id,/^service:[a-f0-9]{64}$/);
 const c=f.offer.choices.find(c=>c.kind==='train'&&c.secondClassId==='bastion'),out=apply(f,c);
 assert.equal(out.state.gold,90);assert.equal(out.state.roster[0].secondClassId,'bastion');assert.equal(out.closed,false);
 const receipt=out.state.progressionLedger.at(-1);assert.equal(receipt.txId,`growth:${c.candidateId}`);assert(receipt.txId.length<=240);assert(validateProgressionState(out.state));
});
test('SYNTHETIC maximum run ID buys distinct60G personal preparations with longest production transaction prefix',()=>{
 const f=fixture('p'.repeat(160)),stock=clone(f.offer.stock);let session=R.createSession(f.s,{service:f.offer});
 for(const [i,c] of f.offer.choices.filter(c=>c.kind==='awakening-training').entries()){
  const a={type:c.kind,candidateId:c.candidateId};session=R.transition(session,a,`paid-${i}`);
  assert.equal(session.state.gold,120-(i+1)*60);assert.deepEqual(session.service.stock,stock);
  assert.equal(session.state.roster[i].awakeningTraining.transactionId,`awakening-training:${c.candidateId}`);
  assert(session.state.roster[i].awakeningTraining.transactionId.length<=240);assert(validateProgressionState(session.state));
  assert.deepEqual(R.transition(clone(session),a,`paid-${i}`),session);
 }
 session=R.transition(session,{type:'leave'},'leave');assert.equal(session.service,null);assert.equal(session.state.roster.filter(u=>u.awakeningTraining).length,2);
});
test('SYNTHETIC maximum run ID researches through genuine strategist capability for20G',()=>{
 const f=fixture('s'.repeat(160),'strategist'),c=f.offer.choices.find(c=>c.kind==='research'&&c.variantId==='focused_treatment'),out=apply(f,c);
 assert.equal(out.state.gold,100);assert.equal(out.offer,null);assert.deepEqual(out.state.research.owned,['focused_treatment']);assert.equal(out.state.research.purchases[0].nodeId,f.node.id);
});
test('provider boundary IDs and replay are exact-repeat deterministic and full-run/source distinct',()=>{
 const id='a'.repeat(159)+'b',a=fixture(id),b=fixture(id),other=fixture('a'.repeat(159)+'c'),event=fixture(id,'trainer',{}, {eventId:'event:fedcba9876543210fedcba9876543210'}),chapter=fixture(id,'trainer',{chapter:3});
 assert.deepEqual(a.offer,b.offer);assert.notEqual(a.offer.id,other.offer.id);assert.notEqual(a.offer.id,event.offer.id);assert.notEqual(a.offer.id,chapter.offer.id);
 const c=a.offer.choices.find(c=>c.kind==='awakening-training');assert.deepEqual(apply(a,c),apply(b,c));
 const n={...a.node,id:'different-source'};assert.notEqual(a.offer.id,R.makeProviderOffer({...a.s,currentNode:n.id},n,a.context).id);
});
test('PI1 short IDs remain descriptive; long provider and ordinary IDs are bounded',()=>{
 const f=fixture('short-boundary'),expected=`${f.s.runId}:${VERSION}:service:c${f.s.chapter}:${f.node.id}:${f.context.eventId}`;
 assert(expected.length<=200);assert.equal(f.offer.id,expected);
 const long=fixture('z'.repeat(160)),ordinaryNode={id:'training-original',kind:'training',row:3},ordinary=R.makeServiceOffer(long.s,ordinaryNode);
 assert.match(ordinary.id,/^service:[a-f0-9]{64}$/);
 for(const length of [1,159,160]){const p=fixture('q'.repeat(length));for(const choice of p.offer.choices)assert(`awakening-training:${choice.candidateId}`.length<=240);}
});
test('provider compaction boundary preserves200chars and hashes201chars without loosening guards',()=>{
 const f=fixture('boundary'),overhead=f.offer.id.length-f.s.runId.length,length=200-overhead;
 assert(length>0&&length<160);const exact=fixture('b'.repeat(length)),over=fixture('b'.repeat(length+1));
 assert.equal(exact.offer.id.length,200);assert.doesNotMatch(exact.offer.id,/^service:/);assert.match(over.offer.id,/^service:[a-f0-9]{64}$/);
 for(const p of [exact,over]){const c=p.offer.choices.find(c=>c.kind==='awakening-training'),out=apply(p,c);assert.equal(out.state.gold,60);assert(out.state.roster[0].awakeningTraining.transactionId.length<=240);}
 assert.throws(()=>M.createRuntime(17,'x'.repeat(161)),/runId/);
});
