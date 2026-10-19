// Explicit exact-next recovery only. No creation, merging or migration of profile lineages.
import {digest,canonical} from './reconstructed/hash.js';
export function previewProfileRecovery(api,currentRaw,incomingRaw){
 if(typeof currentRaw!=='string')throw Error('복구할 현재 로컬 프로필이 없습니다.');
 const current=api.importProfileEnvelope(currentRaw),incoming=api.importProfileEnvelope(incomingRaw);
 return recoveryFromValidated(currentRaw,incomingRaw,current,incoming);
}
// Only called with complete, validated envelopes, never partially replayed data.
function recoveryFromValidated(currentRaw,incomingRaw,current,incoming){
 if(current.profileId!==incoming.profileId||canonical(current.origin)!==canonical(incoming.origin))throw Error('다른 프로필 계보는 복구할 수 없습니다.');
 const exact=currentRaw===incomingRaw;
 if(!exact){if(incoming.revision!==current.revision+1)throw Error('Profile store requires exact next revision');if(canonical(incoming.transactions.slice(0,-1))!==canonical(current.transactions))throw Error('Profile store lineage conflict');if(current.activeRun&&incoming.activeRun&&current.activeRun.runId!==incoming.activeRun.runId)throw Error('다른 원정은 복구할 수 없습니다.');}
 const transaction=incoming.transactions.at(-1);if(!transaction)throw Error('복구할 거래가 없습니다.');
 const body={version:'pi1-exact-next-profile-recovery-1',baseDigest:digest(currentRaw),nextDigest:digest(incomingRaw),profileId:current.profileId,runId:incoming.activeRun?.runId??current.activeRun?.runId??null,fromRevision:current.revision,toRevision:incoming.revision,transactionId:transaction.id,action:structuredClone(transaction.action),alreadyStored:exact,tokenDelta:0,unlocksAdded:0,originalBackupRaw:currentRaw,incomingRaw};
 return {...body,previewDigest:digest(body)};
}
export function validateRecoveryConfirmation(api,preview,currentRaw,confirmedDigest){if(!preview||preview.previewDigest!==confirmedDigest)throw Error('복구 미리보기 확인이 필요합니다.');const {previewDigest,...body}=preview;if(digest(body)!==previewDigest)throw Error('복구 미리보기가 변경되었습니다.');if(digest(currentRaw)!==preview.baseDigest){if(currentRaw===preview.incomingRaw)return previewProfileRecovery(api,currentRaw,preview.incomingRaw);throw Error('미리보기 이후 로컬 프로필이 변경되었습니다.');}const fresh=previewProfileRecovery(api,currentRaw,preview.incomingRaw);if(fresh.previewDigest!==preview.previewDigest)throw Error('복구 검증 결과가 변경되었습니다.');return fresh;}

function aborted(signal){if(signal?.aborted)throw Object.assign(new Error('Profile recovery cancelled'),{name:'AbortError'});}
export async function previewProfileRecoveryAsync(api,currentRaw,incomingRaw,{signal,onProgress=()=>{},yieldControl}={}){
 if(typeof currentRaw!=='string')throw Error('복구할 현재 로컬 프로필이 없습니다.');
 const current=await api.importProfileEnvelopeAsync(currentRaw,{signal,yieldControl,onProgress:p=>onProgress({...p,stage:'current'})});aborted(signal);
 const incoming=await api.importProfileEnvelopeAsync(incomingRaw,{signal,yieldControl,onProgress:p=>onProgress({...p,stage:'incoming'})});aborted(signal);
 return recoveryFromValidated(currentRaw,incomingRaw,current,incoming);
}
export async function validateRecoveryConfirmationAsync(api,preview,currentRaw,confirmedDigest,options={}){
 if(!preview||preview.previewDigest!==confirmedDigest)throw Error('복구 미리보기 확인이 필요합니다.');
 const {previewDigest,...body}=preview;if(digest(body)!==previewDigest)throw Error('복구 미리보기가 변경되었습니다.');
 const changed=digest(currentRaw)!==preview.baseDigest;
 if(changed&&currentRaw!==preview.incomingRaw)throw Error('미리보기 이후 로컬 프로필이 변경되었습니다.');
 const fresh=await previewProfileRecoveryAsync(api,currentRaw,preview.incomingRaw,options);aborted(options.signal);
 if(!changed&&fresh.previewDigest!==preview.previewDigest)throw Error('복구 검증 결과가 변경되었습니다.');
 return fresh;
}
