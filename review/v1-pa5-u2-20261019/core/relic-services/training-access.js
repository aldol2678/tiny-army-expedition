// Narrow, receipt-authorized preparation suffix. Original entry inventory is immutable.
import {PROGRESSION_VERSION} from '../progression/registry.js';
import {digest} from '../runtime/hash.js';
import {assert,canonical,clone} from './registry.js';
export const TRAINING_ACCESS_VERSION='training-access-continuation-1';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&canonical(Object.keys(v).sort())===canonical([...keys].sort());
export function trainingAccessEnabled(offer){return offer?.trainingAccess?.version===TRAINING_ACCESS_VERSION;}
const additionId=(offer,sourceCandidateId,unitId)=>`training-prep:${digest({namespace:TRAINING_ACCESS_VERSION,offerId:offer.id,sourceCandidateId,unitId})}`;
export function serviceStock(offer,state=null){
 assert(Array.isArray(offer?.stock),'Frozen entry stock required');
 if(offer.trainingAccess===undefined)return offer.stock;
 const access=offer.trainingAccess;
 assert(exact(access,['version','preparationAdditions'])&&access.version===TRAINING_ACCESS_VERSION&&Array.isArray(access.preparationAdditions),'Invalid training access envelope');
 assert((offer.providerCapability?.serviceKind||offer.node?.kind)==='training','Preparation suffix requires a training provider');
 const seen=new Set(offer.stock.filter(c=>c.kind==='awakening-training').map(c=>c.unitId)),extra=[];
 for(const [i,addition] of access.preparationAdditions.entries()){
  assert(exact(addition,['sourceCandidateId','item']),'Invalid preparation suffix record');
  const source=offer.stock.find(c=>c.candidateId===addition.sourceCandidateId),receipt=offer.purchaseReceipts?.find(r=>r.choice?.candidateId===addition.sourceCandidateId),item=addition.item;
  assert(source?.kind==='train'&&source.training===2&&receipt?.choice?.kind==='train'&&receipt.goldCost===30&&receipt.goldGranted===0&&receipt.xp===0&&receipt.serviceId===offer.id&&offer.purchasedCandidateIds?.includes(source.candidateId),'Preparation suffix requires its successful original30G training receipt');
  assert(canonical(receipt.action)===canonical({type:'train',candidateId:source.candidateId})&&receipt.nodeId===offer.node.id&&receipt.kind===offer.node.kind&&canonical(receipt.providerCapability??null)===canonical(offer.providerCapability??null),'Training receipt action/provider differs from this visit');
  const fields=['id','kind','unitId','type','training','trainingTrack','secondClassId','candidateId','slot','price','goldCost'];
  assert(fields.every(k=>canonical(receipt.choice[k])===canonical(source[k])&&canonical(receipt.effect?.candidate?.[k])===canonical(source[k])),'Training receipt differs from original purchased stock');
  const entry=state?.progressionLedger?.find(e=>e.txId===`growth:${source.candidateId}`),ledger=entry?.receipt;
  assert(ledger?.kind==='progression'&&ledger.unitId===source.unitId&&ledger.candidateId===source.id,'Preparation suffix lacks its actual progression transaction');
  const normalized={kind:'train',unitId:source.unitId,branchId:null,training:source.training,trainingTrack:source.trainingTrack,secondClassId:source.secondClassId??null,candidateId:source.id};
  assert(entry.fingerprint===canonical(normalized)&&ledger.txId===entry.txId&&ledger.version===PROGRESSION_VERSION,'Preparation suffix progression action identity mismatch');
  const before=receipt.effect?.before?.roster?.find(u=>u.id===source.unitId),after=receipt.effect?.after?.roster?.find(u=>u.id===source.unitId);
  assert(canonical(ledger.before)===canonical(before)&&canonical(ledger.after)===canonical(after),'Preparation suffix snapshot differs from authoritative progression receipt');
  const current=clone(state.roster.find(u=>u.id===source.unitId));delete current.awakeningTraining;
  assert(canonical(current)===canonical(after),'Preparation suffix current soldier differs from paid progression result');
  assert(before?.training===1&&before.awakeningTraining===undefined&&after?.training===2&&after.classStage===2&&after.secondClassId===source.secondClassId&&Array.isArray(after.skillIds)&&after.skillIds.length===2&&after.awakeningTraining===undefined,'Preparation suffix requires newly completed purchased soldier');
  assert(item?.kind==='awakening-training'&&item.id===`awaken-train:${source.unitId}`&&item.unitId===source.unitId&&item.secondClassId===after.secondClassId&&item.price===60&&item.goldCost===60&&item.cost===60&&!seen.has(item.unitId),'Invalid, free, duplicate or foreign preparation suffix');
  assert(item.candidateId===additionId(offer,addition.sourceCandidateId,item.unitId)&&item.slot===offer.stock.length+i,'Preparation suffix identity changed');
  seen.add(item.unitId);extra.push(item);
 }
 return [...offer.stock,...extra];
}
export function preparationAddition(offer,sourceCandidateId,item,index){return {sourceCandidateId,item:{...clone(item),candidateId:additionId(offer,sourceCandidateId,item.unitId),slot:offer.stock.length+index}};}
