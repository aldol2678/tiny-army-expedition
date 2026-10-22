import {assert,clone,canonical,deepFreeze} from '../relic-services/registry.js';
import {digest} from '../runtime/hash.js';
import {evaluateFirstHpReduction,FH1_VERSION as BASE_FH1_VERSION,FH1_CAPABILITY,FH1_ARITHMETIC} from '../first-hp-hit/contract.js';
import {FH1_DEFINITION} from '../first-hp-hit/projection.js';
const FH1_VERSION='first-hp-hit-rc2-child-cost-1';
const participantId='fh1-first-hp-hit';
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=1024&&!['constructor','toString','__proto__'].includes(x);
const natural=x=>Number.isSafeInteger(x)&&x>=0;
const signature=r=>digest(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='signature')));

export function installFirstHpHitAdapter(game,{content,runId,capability=null,afterReceipt=null}={}) {
  assert(validId(runId),'Explicit bounded runId required');
  assert(capability===null||capability===FH1_CAPABILITY,'Unknown first-HP capability');
  assert(content?.fh1Capability===FH1_CAPABILITY&&game?.phase==='battle'&&game.tickCount===0,'Fresh FH1 projected battle required');
  assert(!game._fh1FirstHp&&typeof game._rb6FinalDamage?.currentHitContext==='function','Install once after FH1 final-hit owner');
  assert(game._rb6FinalDamage.snapshot().receipts.length===0,'No retroactive first-HP installation');
  const roster=clone(game.startingRoster),members=new Map([...game.units,...game.enemies].map(u=>[u.id,u.team]));
  assert(new Set(roster.map(u=>u.id)).size===roster.length,'Unique start roster required');
  const deployed=roster.filter(u=>Number.isInteger(u.slot)&&u.slot>=0&&u.slot<=11);
  assert(new Set(deployed.map(u=>u.slot)).size===deployed.length,'Unique start slots required');
  const occupant=s=>deployed.find(u=>u.slot===s);
  const eligibleTargets=occupant(0)&&occupant(3)&&!occupant(1)&&!occupant(2)?[occupant(0).id,occupant(3).id]:[];
  const relics=content.normalizeRelics(game.relics),stage=relics.find(r=>r.id==='vacant_center')?.evolution??0;
  const bonus=capability===FH1_CAPABILITY&&stage?FH1_DEFINITION.values[stage-1]/100:0;
  const context=digest({version:FH1_VERSION,arithmetic:FH1_ARITHMETIC,runId,battleId:game.battleId,
    initialSeed:game.initialSeed,roster,relics,eligibleTargets,bonus});
  let state={version:FH1_VERSION,context,sequence:0,receipts:[],uses:[]};
  const direct=tags=>!tags.dot&&!tags.reflection&&['normal','ultimate'].includes(tags.sourceKind)&&
    ['basic_attack','unit_skill','enemy_pattern'].includes(tags.actionType);
  function eligibility(hit,uses) {
    if(!bonus)return 'neutral';
    if(!eligibleTargets.includes(hit.targetId))return 'start-formation-ineligible';
    if(members.get(hit.sourceId)!=='enemy'||members.get(hit.targetId)!=='ally')return 'ineligible-side';
    if(!direct(hit.tags))return 'not-enemy-direct';
    if(!hit.rootActionId&&!hit.eventId)return 'unattributed-original-hit';
    if(uses.some(u=>u.targetId===hit.targetId))return 'target-used';
    return null;
  }
  function plan(q) {
    const hit=game._rb6FinalDamage.currentHitContext(),protection=game._rb6FinalDamage.currentProtection();
    assert(hit&&hit.sourceId===q.attacker.id&&hit.targetId===q.target.id,'Actual original hit binding required');
    assert(q.rawRemaining===Math.max(0,q.mitigated-q.absorbed),'Raw residual mismatch');
    const reason=eligibility(hit,state.uses),incoming=protection?.incoming??q.incoming;
    const math=evaluateFirstHpReduction({incoming,mitigated:q.mitigated,absorbed:q.absorbed,hpBefore:q.hpBefore,bonus:reason?0:bonus,preProtectionMitigated:protection?.mitigated??q.mitigated,protectionReduction:protection?.reduction??0});
    return {...math,hit:clone(hit),protection:protection?clone(protection):null,
      reason:reason??(math.hpBenefit>0?null:q.rawRemaining===0?'shield-only':math.availableReduction===0?'R55-saturated':math.baseHpAfter===0&&math.hpAfter===0?'still-lethal':'zero-endpoint-benefit')};
  }
  function committed(p) {
    const final=game._rb6FinalDamage.currentCommitted();
    assert(final&&final.sourceId===p.hit.sourceId&&final.targetId===p.hit.targetId&&final.eventId===p.hit.eventId&&final.rootActionId===p.hit.rootActionId,'Matching final receipt required');
    // FH consumes its positive defense-stage endpoint benefit before the independent
    // crystal HP-cost child. A child KO never recharges the original defense.
    if(p.consumed)assert(final.originalHpAfter===p.hpAfter&&final.reportedDamage===p.reportedDamage&&final.bonusHpLoss===0&&final.hpAfter===Math.max(0,p.hpAfter-final.childCostHp),'First-HP final endpoint mismatch');
    const {hit,protection,reason,...math}=p,sequence=state.sequence+1;
    const r={id:`${game.battleId}:fh1-hit:${sequence}`,sequence,version:FH1_VERSION,context,runId,
      battleId:game.battleId,tick:game.tickCount,effectId:'vacant_center',stage,hit,protection,reason,math,
      originalReceiptId:final.id,finalHpAfter:final.hpAfter,finalReportedDamage:final.reportedDamage,
      finalHpLoss:final.hpLoss,finalChildCostHp:final.childCostHp,finalChildCostId:final.childCost?.id??null,useSequence:math.consumed?1:null};
    r.signature=signature(r);state.sequence=sequence;state.receipts.push(r);
    if(math.consumed)state.uses.push({effectId:'vacant_center',targetId:hit.targetId,rootActionId:hit.rootActionId??hit.eventId,
      eventId:hit.eventId,receiptId:r.id,originalReceiptId:final.id,useSequence:1});
    afterReceipt?.(deepFreeze(clone(r)));
  }
  function validate(s) {
    assert(s&&s.version===FH1_VERSION&&s.context===context,'Foreign first-HP checkpoint');
    assert(natural(s.sequence)&&Array.isArray(s.receipts)&&s.sequence===s.receipts.length&&Array.isArray(s.uses),'Invalid first-HP journal');
    const uses=[],originalReceipts=new Set();
    for(const [i,r] of s.receipts.entries()) {
      assert(r.id===`${game.battleId}:fh1-hit:${i+1}`&&r.sequence===i+1&&r.version===FH1_VERSION&&r.context===context&&r.runId===runId&&r.battleId===game.battleId&&natural(r.tick),'Invalid first-HP receipt identity');
      assert(r.signature===signature(r),'First-HP signature mismatch');
      assert(r.effectId==='vacant_center'&&r.stage===stage&&members.has(r.hit?.sourceId)&&members.has(r.hit?.targetId),'Invalid first-HP effect/actors');
      assert(r.hit.rootActionId===null||validId(r.hit.rootActionId),'Invalid first-HP root');
      assert(r.hit.eventId===null||validId(r.hit.eventId),'Invalid first-HP event');
      assert(validId(r.originalReceiptId)&&!originalReceipts.has(r.originalReceiptId),'Duplicate final-hit link');originalReceipts.add(r.originalReceiptId);
      const reason=eligibility(r.hit,uses),m=r.math;
      const expected=evaluateFirstHpReduction({incoming:m.incoming,mitigated:m.mitigated,absorbed:m.absorbed,hpBefore:m.hpBefore,bonus:reason?0:bonus,preProtectionMitigated:m.preProtectionMitigated,protectionReduction:m.protectionReduction});
      assert(canonical(m)===canonical(expected),'First-HP arithmetic replay mismatch');
      const expectedReason=reason??(m.hpBenefit>0?null:m.rawRemaining===0?'shield-only':m.availableReduction===0?'R55-saturated':m.baseHpAfter===0&&m.hpAfter===0?'still-lethal':'zero-endpoint-benefit');
      assert(r.reason===expectedReason,'First-HP eligibility replay mismatch');
      assert(r.useSequence===(m.consumed?1:null),'First-HP use sequence mismatch');
      assert(Number.isFinite(r.finalChildCostHp)&&r.finalChildCostHp>=0&&r.finalChildCostHp<=2&&(r.finalChildCostId===(r.finalChildCostHp>0?r.originalReceiptId+':crystal_nail:cost':null)),'First-HP child-cost link mismatch');
      if(m.consumed){assert(r.finalHpAfter===Math.max(0,m.hpAfter-r.finalChildCostHp)&&r.finalReportedDamage===m.reportedDamage&&r.finalHpLoss===m.hpBefore-r.finalHpAfter,'First-HP final endpoint mismatch');uses.push({effectId:'vacant_center',targetId:r.hit.targetId,rootActionId:r.hit.rootActionId??r.hit.eventId,eventId:r.hit.eventId,receiptId:r.id,originalReceiptId:r.originalReceiptId,useSequence:1});}
    }
    assert(canonical(s.uses)===canonical(uses)&&new Set(uses.map(u=>u.targetId)).size===uses.length,'First-HP consumption ledger mismatch');
    return true;
  }
  function validateAggregate(parts) {
    assert(Array.isArray(parts)&&new Set(parts.map(x=>x.id)).size===parts.length,'Unique participant manifest required');
    const own=parts.find(p=>p.id===participantId),final=parts.find(p=>p.id==='rb6-final-damage');
    assert(own&&final,'Missing first-HP/final-hit journal');validate(own.state);
    const finals=new Map(final.state.receipts.map(r=>[r.id,r]));
    for(const r of own.state.receipts){const f=finals.get(r.originalReceiptId);assert(f&&f.status==='applied'&&f.sourceId===r.hit.sourceId&&f.targetId===r.hit.targetId&&f.rootActionId===r.hit.rootActionId&&f.eventId===r.hit.eventId&&canonical(f.tags)===canonical(r.hit.tags),'First-HP original receipt binding mismatch');
      assert(f.childCostHp===r.finalChildCostHp&&(f.childCost?.id??null)===r.finalChildCostId,'First-HP child-cost amount/link mismatch');
      assert(f.hpBefore===r.math.hpBefore&&f.damageEnteringBarrier===r.math.mitigated&&f.absorbed===r.math.absorbed&&f.hpAfter===r.finalHpAfter&&f.reportedDamage===r.finalReportedDamage&&f.hpLoss===r.finalHpLoss,'First-HP original amount binding mismatch');
      assert(f.originalReportedDamage===r.math.reportedDamage&&f.originalHpAfter===r.math.hpAfter&&f.overkill===Math.max(0,r.math.remaining-r.math.hpBefore),'First-HP original HP budget mismatch');
      assert((f.protection?.mitigated??f.damageEnteringBarrier)===r.math.preProtectionMitigated&&(f.protection?.reduction??0)===r.math.protectionReduction,'First-HP original cap budget mismatch');
      assert(canonical(f.protection)===canonical(r.protection)&&(f.protection?.incoming??f.incoming)===r.math.incoming,'First-HP original reduction context mismatch');
    }
    assert(final.state.receipts.filter(r=>r.status==='applied').length===own.state.receipts.length,'Missing first-HP applied-hit receipt');return true;
  }
  const api=Object.freeze({version:FH1_VERSION,plan,committed,validate,validateAggregate,
    snapshot:()=>deepFreeze(clone(state)),restore(s){validateAggregate([{id:participantId,state:s},{id:'rb6-final-damage',state:game._rb6FinalDamage.snapshot()}]);state=clone(s);},
    eligibleTargets:()=>Object.freeze([...eligibleTargets])});
  game._v10CheckpointParticipants.push({id:participantId,capture:()=>clone(state),restore:api.restore});
  Object.defineProperty(game,'_fh1FirstHp',{value:api,configurable:true});return api;
}
