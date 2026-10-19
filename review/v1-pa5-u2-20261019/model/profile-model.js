import {previewProfileRecovery,previewProfileRecoveryAsync,validateRecoveryConfirmation,validateRecoveryConfirmationAsync} from './profile-recovery.js';
// One isolated profile slot; importing never replaces or merges an existing lineage.
export const PROFILE_UI_KEY='tiny-army-private-pi2-profile-1';
let readerSequence=0;
export function createProfileUIModel({api,storage,notify=()=>{},id=()=>globalThis.crypto.randomUUID(),yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0))}){
 const current=typeof api.ProfileSession==='function'&&!!api.CurrentProfileSession&&['importProfileEnvelopeCurrent','exportProfileEnvelopeCurrent','transitionProfileCurrent','validateProfileCommitCurrent','profileViewCurrent'].every(k=>typeof api[k]==='function');
 const operations=current&&['createProfileOperationCurrent','describeProfileOperationCurrent','commitProfileOperationCurrent'].every(k=>typeof api[k]==='function');
 const local=current?{Session:api.CurrentProfileSession,parse:api.importProfileEnvelopeCurrent,serialize:api.exportProfileEnvelopeCurrent,transition:api.transitionProfileCurrent,commit:api.validateProfileCommitCurrent,view:api.profileViewCurrent}:{Session:api.ProfileSession,parse:api.importProfileEnvelope,serialize:api.exportProfileEnvelope,transition:api.transitionProfile,commit:api.validateProfileCommit,view:api.profileView};
 const state={envelope:null,view:null,preview:null,recoveryPreview:null,error:'',ready:false,reading:false,readKind:null,progress:null};
 let pending=null,pendingProjection=null,preparing=false,readEpoch=0,unloadedRaw,session=null,sessionRaw=null,sessionOwner=null,verification=null,failedOwner=null,activeRead=null;
 // The claim belongs to exact saved bytes, not to the mutable public envelope.
 Object.defineProperties(state,{pending:{enumerable:true,get:()=>pendingProjection},hasSavedBytes:{enumerable:true,get:()=>typeof (unloadedRaw===undefined?sessionRaw:unloadedRaw)==='string'},verificationStatus:{enumerable:true,get:()=>verification?.owner===sessionOwner&&verification?.raw===sessionRaw?verification.label:null},actionsBlocked:{enumerable:true,get:()=>!!sessionOwner&&failedOwner===sessionOwner}});
 const readerOwner=`profile-reader:${++readerSequence}`;let requestSequence=0,readStatus=null;
 Object.defineProperty(state,'readStatus',{enumerable:true,get:()=>readStatus});
 function reportRead(job,status,{phase,progress,errorCode}={}){if(progress?.detail&&Number.isFinite(progress.detail.completed)&&Number.isFinite(progress.detail.total)&&progress.detail.total>0)progress=progress.detail;const p=progress&&Number.isFinite(progress.completed)&&Number.isFinite(progress.total)&&progress.total>0&&progress.completed>=0&&progress.completed<=progress.total?Object.freeze({completed:progress.completed,total:progress.total}):null;readStatus=Object.freeze({ownerId:readerOwner,requestId:job.requestId,status,phase:phase??readStatus?.phase??'storage',progress:p,canCancel:status==='loading',canRetry:status!=='loading'&&status!=='ready'&&job.kind==='boot',errorCode:errorCode??null});}
 const store={load:()=>storage.getItem(PROFILE_UI_KEY),commit(expected,next){if(storage.getItem(PROFILE_UI_KEY)!==expected)throw Error('다른 탭의 프로필이 변경되었습니다. 다시 불러오세요.');local.commit(expected,next);storage.setItem(PROFILE_UI_KEY,next);return next;}};
 const fail=e=>{state.error=e.message||String(e);notify(state);return false;};
 const blocked=()=>state.actionsBlocked?fail(Error('전체 전투 정밀검사에 실패했습니다. 원본을 내보내고 다시 불러오세요. 이 세션에서는 저장할 수 없습니다.')):false;
 function adopt(loaded,raw){unloadedRaw=undefined;session=loaded;sessionRaw=raw;sessionOwner=loaded?{}:null;failedOwner=null;verification=loaded?{owner:sessionOwner,raw,label:'CURRENT_STATE_CHECKED'}:null;}
 const publish=view=>{state.envelope=session.envelope;state.view=view===undefined?local.view(session.envelope):view;state.error='';state.ready=true;notify(state);return true;};
 const cancelled=()=>Object.assign(new Error('Profile read cancelled'),{name:'AbortError'});
 const owns=job=>activeRead===job&&!job.controller.signal.aborted;
 function check(job){if(!owns(job))throw cancelled();}
 function cancelRead(announce=true){readEpoch++;const job=activeRead;activeRead=null;if(job)reportRead(job,'cancelled');job?.controller.abort();job?.unlink();state.reading=false;state.readKind=null;state.progress=null;if(announce)notify(state);}
 // Reserve before file.text(), settle promptly on cancellation, and ignore all late results.
 function abortable(job,work){return new Promise((resolve,reject)=>{const signal=job.controller.signal,abort=()=>reject(cancelled());signal.addEventListener('abort',abort,{once:true});Promise.resolve().then(()=>{check(job);return work();}).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));if(signal.aborted)abort();});}
 async function readTask(kind,work,accept,{signal,onProgress:externalProgress=()=>{}}={}){
  cancelRead(false);const controller=new AbortController(),relay=()=>controller.abort();signal?.addEventListener('abort',relay,{once:true});
  const job={controller,kind,requestId:++requestSequence,unlink:()=>signal?.removeEventListener('abort',relay)};activeRead=job;reportRead(job,'loading',{phase:['legacy','recovery','import'].includes(kind)?'data':'storage'});if(signal?.aborted)controller.abort();
  state.reading=true;state.readKind=kind;state.progress=null;state.error='';notify(state);
  let lastProgressNotice=0;const options={signal:controller.signal,yieldControl,onProgress:p=>{if(owns(job)){externalProgress(p);if(!owns(job))return;state.progress=p;reportRead(job,'loading',{phase:'storage',progress:p});const now=Date.now();if(!p.battle||now-lastProgressNotice>=50){lastProgressNotice=now;notify(state);}}}};
  try{const value=await abortable(job,()=>work(options,job));check(job);reportRead(job,'loading',{phase:'expedition'});notify(state);check(job);const result=accept(value);if(owns(job))reportRead(job,result===false?'failed':'ready',{errorCode:result===false?'VALIDATION_FAILED':null});return result;}
  catch(e){if(activeRead!==job)return false;reportRead(job,e.name==='AbortError'?'cancelled':'failed',{errorCode:e.name==='AbortError'?null:e.code||e.name||'VALIDATION_FAILED'});if(e.name!=='AbortError')return fail(e);return false;}
  finally{job.unlink();if(activeRead===job){activeRead=null;state.reading=false;state.readKind=null;state.progress=null;notify(state);}}
 }
 async function boot(options={}){
  if(state.pending)return fail(Error('미확인 프로필 저장을 먼저 복구하세요.'));
  state.ready=false;verification=null;state.preview=null;state.recoveryPreview=null;
  return readTask('boot',async validation=>{const raw=store.load();unloadedRaw=raw;if(raw===null)return {raw,loaded:null};const loaded=await local.Session.loadAsync(store,{...validation,expectedRaw:raw});return {raw,loaded};},({raw,loaded})=>{if(store.load()!==raw)throw Error('검증 중 프로필 저장이 변경되었습니다. 다시 불러오세요.');adopt(loaded,raw);if(session)return publish();state.envelope=null;state.view=null;state.ready=true;notify(state);return true;},options);
 }
 async function fullAudit(options={}){
  if(state.pending)return fail(Error('미확인 프로필 저장을 먼저 복구하세요.'));
  if(state.reading||state.actionsBlocked||!state.ready||!session)return false;
  const captured={owner:sessionOwner,session,raw:sessionRaw};
  return readTask('full-audit',async validation=>{if(store.load()!==captured.raw)throw Error('프로필 저장이 변경되었습니다. 다시 불러오세요.');try{await api.importProfileEnvelopeAsync(captured.raw,validation);return null;}catch(e){if(e.name==='AbortError')throw e;return e;}},error=>{
   if(sessionOwner!==captured.owner||session!==captured.session||sessionRaw!==captured.raw)return false;
   if(store.load()!==captured.raw)throw Error('정밀검사 중 프로필 저장이 변경되었습니다. 다시 불러오세요.');
   verification={owner:captured.owner,raw:captured.raw,label:error?'FULL_REPLAY_FAILED':'FULL_REPLAY_VERIFIED'};
   if(error){failedOwner=captured.owner;return fail(error);}state.error='';notify(state);return true;
  },options);
 }
 async function previewFile(read){
  state.preview=null;state.recoveryPreview=null;
  return readTask('legacy',async(options,job)=>{const raw=await abortable(job,read);check(job);await yieldControl();check(job);return api.previewLegacyImport(raw,{profileId:'preserved-local-profile',transactionId:'import-original'});},value=>{state.preview=value;notify(state);return true;});
 }
 // File/legacy and recovery boundaries deliberately retain the original strict API.
 function preview(raw){cancelRead(false);try{state.recoveryPreview=null;state.preview=api.previewLegacyImport(raw,{profileId:'preserved-local-profile',transactionId:'import-original'});state.error='';notify(state);return true;}catch(e){state.preview=null;return fail(e);}}
 function confirm(confirmedPreviewDigest){if(state.reading)return false;if(state.actionsBlocked)return blocked();if(state.pending)return fail(Error('미확인 프로필 저장이 있습니다.'));if(!state.preview)return false;try{if(store.load()!==null&&(!session||!state.ready))throw Error('저장된 프로필 검증을 먼저 완료하세요.');const loaded=local.Session.create(state.preview,{confirmedPreviewDigest},store),raw=store.load();adopt(loaded,raw);state.preview=null;return publish();}catch(e){return fail(e);}}
 function installPending(record,next,action){pending=Object.freeze(record);pendingProjection=Object.freeze({action:structuredClone(action),transactionId:record.transactionId,expectedRaw:record.expectedRaw,nextRaw:record.nextRaw,next});}
 function clearPending(){pending=null;pendingProjection=null;}
 function commitPending(){
  const p=pending;if(!p)return false;if(state.actionsBlocked)return blocked();
  try{
   if(p.handle){
    const attemptEpoch=readEpoch;
    const assertOwner=()=>{if(pending!==p||sessionOwner!==p.owner||sessionRaw!==p.expectedRaw||activeRead||state.reading||failedOwner===p.owner||readEpoch!==attemptEpoch)throw Error('프로필 저장 작업의 소유권이 변경되었습니다. 같은 기록을 다시 확인하세요.');};
    const external=work=>{assertOwner();try{return work();}finally{assertOwner();}};
    // This store only performs exact-byte CAS. The private operation has
    // already proved the one checked successor; never execute that action twice.
    const preparedStore={load:()=>external(()=>storage.getItem(PROFILE_UI_KEY)),commit(expected,next){assertOwner();if(expected!==p.expectedRaw||next!==p.nextRaw)throw Error('프로필 저장 작업의 기록이 변경되었습니다.');if(external(()=>storage.getItem(PROFILE_UI_KEY))!==expected)throw Error('다른 탭의 프로필이 변경되었습니다.');external(()=>storage.setItem(PROFILE_UI_KEY,next));return next;}};
    const committed=api.commitProfileOperationCurrent(p.handle,preparedStore,{assertOwner});assertOwner();
    adopt(new local.Session(committed.envelope,store,committed.raw),committed.raw);clearPending();return publish(committed.view);
   }
   const parse=p.strict?api.importProfileEnvelope:local.parse,validate=p.strict?api.validateProfileCommit:local.commit,observed=store.load();
   if(observed!==p.nextRaw){
    if(observed!==p.expectedRaw)throw Error('다른 탭의 프로필이 변경되었습니다. 미확인 기록을 내보내고 다시 불러오세요.');
    try{validate(p.expectedRaw,p.nextRaw);if(store.load()!==p.expectedRaw)throw Error('다른 탭의 프로필이 변경되었습니다.');storage.setItem(PROFILE_UI_KEY,p.nextRaw);if(store.load()!==p.nextRaw)throw Error('프로필 저장 확인에 실패했습니다.');}
    catch(error){let saved;try{saved=store.load();}catch{throw error;}if(saved!==p.nextRaw)throw error;parse(saved);}
   }
   // Exact durable next bytes are the sole authority. Never mint another tx ID.
   adopt(new local.Session(parse(p.nextRaw),store,p.nextRaw),p.nextRaw);clearPending();return publish();
  }catch(e){return fail(e);}
 }
 function retry(){if(state.reading)return false;return commitPending();}
 function transition(action){
  if(state.reading||preparing)return false;if(state.actionsBlocked)return blocked();
  if(!state.ready)return fail(Error('저장된 프로필 검증을 먼저 완료하세요.'));
  if(pending)return fail(Error('먼저 미확인 프로필 저장을 재시도하세요.'));
  if(!session)return fail(Error('먼저 완료된 구버전 프로필을 명시적으로 가져오세요.'));
  preparing=true;
  try{const owner=sessionOwner,expectedRaw=sessionRaw,epoch=readEpoch,transactionId=`ui:${id()}`;
   if(operations){
    const handle=api.createProfileOperationCurrent(expectedRaw,action,transactionId),description=api.describeProfileOperationCurrent(handle);
    if(sessionOwner!==owner||sessionRaw!==expectedRaw||activeRead||state.reading||failedOwner===owner||readEpoch!==epoch||description.expectedRaw!==expectedRaw||description.transactionId!==transactionId)throw Error('프로필 준비 중 저장 작업의 소유권이 변경되었습니다.');
    installPending({handle,owner,transactionId,expectedRaw,nextRaw:description.nextRaw},description.next,action);
   }else{const parent=local.parse(expectedRaw),next=local.transition(parent,action,transactionId,parent.revision);installPending({transactionId,expectedRaw,nextRaw:local.serialize(next)},next,action);}
   verification={owner:sessionOwner,raw:sessionRaw,label:'CURRENT_STATE_CHECKED'};return commitPending();
  }catch(e){return fail(e);}finally{preparing=false;}
 }
 function previewRecovery(raw){cancelRead(false);try{state.preview=null;state.recoveryPreview=previewProfileRecovery(api,store.load(),raw);state.error='';notify(state);return true;}catch(e){state.recoveryPreview=null;return fail(e);}}
 async function previewRecoveryFile(read){
  state.preview=null;state.recoveryPreview=null;
  return readTask('recovery',async(options,job)=>{const base=store.load(),raw=await abortable(job,read);check(job);const preview=await previewProfileRecoveryAsync(api,base,raw,options);return {base,preview};},({base,preview})=>{if(store.load()!==base)throw Error('검증 중 프로필 저장이 변경되었습니다. 복구 파일을 다시 선택하세요.');state.recoveryPreview=preview;notify(state);return true;});
 }
 function acceptRecovery(p){if(state.actionsBlocked)return blocked();if(state.pending&&state.pending.nextRaw!==p.incomingRaw)throw Error('다른 미확인 거래가 있습니다.');installPending({transactionId:p.transactionId,expectedRaw:p.originalBackupRaw,nextRaw:p.incomingRaw,strict:true},api.importProfileEnvelope(p.incomingRaw),p.action);const ok=commitPending();if(ok)state.recoveryPreview=null;return ok;}
 function confirmRecovery(confirmedDigest){if(state.reading)return false;if(state.actionsBlocked)return blocked();try{return acceptRecovery(validateRecoveryConfirmation(api,state.recoveryPreview,store.load(),confirmedDigest));}catch(e){return fail(e);}}
 async function confirmRecoveryAsync(confirmedDigest){
  if(state.reading)return false;if(state.actionsBlocked)return blocked();const preview=state.recoveryPreview;
  return readTask('confirm-recovery',async options=>{const base=store.load(),validated=await validateRecoveryConfirmationAsync(api,preview,base,confirmedDigest,options);return {base,validated};},({base,validated})=>{if(store.load()!==base)throw Error('검증 중 프로필 저장이 변경되었습니다. 복구 파일을 다시 선택하세요.');return acceptRecovery(validated);});
 }
 function startRun(seed,tactic='balanced'){return transition({type:'startRun',seed,runId:`profile-run:${id()}`,tactic});}
 return {state,boot,fullAudit,preview,previewFile,cancelRead,previewRecovery,previewRecoveryFile,confirmRecovery,confirmRecoveryAsync,confirm,startRun,transition,retry,cancel(){cancelRead(false);state.preview=null;state.recoveryPreview=null;notify(state);},exportRecoveryBackup(){return state.recoveryPreview?.originalBackupRaw??null;},exportSave(){if(pending)return pending.nextRaw;if(unloadedRaw!==undefined){if(unloadedRaw===null)throw Error('No profile');return unloadedRaw;}if(!session)throw Error('No profile');return sessionRaw;},exportPreservedOriginal(){return sessionRaw?JSON.parse(sessionRaw).origin.preservation.originalRaw:null;},exportOriginal(){return state.preview?.preservation.originalRaw??(sessionRaw?JSON.parse(sessionRaw).origin.preservation.originalRaw:null);}};
}
