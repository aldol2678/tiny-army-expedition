// SG2-only async UI adapter. Save validation, hashing, preparation and export
// are worker-owned; this module never opens a legacy storage slot.
import {WITHDRAW_COMMAND} from '../core/long-battle/trial-config.js';
import {RCI1_LONG_PROFILE,RCI1_PRESSURE_PROFILE} from '../core/rci1/identity.js';
import {RCI2_PROFILE} from '../core/rci2/identity.js';
import {makeFamilySelection} from '../core/family-selection/contract.js';
import {createBattleController} from '../core/runtime/portable-engine.js';
import {committedAudioIntent} from './reconstructed/audio-events.js';
export const SAVE_KEY='sg2-runtime';
let ownerSequence=0;

// Shared orchestration only. This helper does not deserialize a save or perform
// save validation on the main thread. A failed commit keeps the session's exact
// worker-prepared transaction for retry, without invoking transition again.
export function createSG2Binding({session,kind,notify=()=>{}}){
 if(!session||typeof session.state!=='function')throw Error('Explicit SG2 session required');
 const state={error:'',ready:false,reading:false,busy:false,readKind:null,progress:null,readStatus:null,conflict:false,conflictKind:null,actionsBlocked:false,recoveryRequired:false,verificationStatus:null};
 let epoch=0,active=null,projection=null,request=0,closed=false;
 const ownerId=`sg2-${kind}-reader:${++ownerSequence}`;
 const changed=()=>{try{notify(state);}catch{}};
 const snapshot=()=>session.state();
 Object.defineProperties(state,{pending:{enumerable:true,configurable:true,get:()=>snapshot().pending?snapshot().pendingProjection??{sg2:true}:null},hasSavedBytes:{enumerable:true,configurable:true,get:()=>!!snapshot().hasSavedBytes||!!snapshot().rootHash||!!snapshot().pending},hasRecoveryBackup:{enumerable:true,get:()=>false}});
 function sync(){const s=snapshot();projection=s.projection??null;state.verificationStatus=s.summary?.verification??(projection?'CURRENT_STATE_CHECKED':null);return s;}
 function report(job,status){state.readStatus=Object.freeze({ownerId,requestId:job.request,status,kind:job.kind,copyState:Object.freeze({operation:job.kind,storagePhase:snapshot().phase}),phase:job.kind==='boot'?'storage':'expedition',progress:null,canCancel:status==='loading'&&!job.nonCancelable&&snapshot().phase!=='committing',canRetry:status==='failed'&&job.kind==='boot',errorCode:status==='failed'?'SG2_OPERATION_FAILED':null});}
 const owns=job=>!closed&&active===job&&epoch===job.epoch;
 const unsubscribe=session.subscribe?.(()=>{if(active&&owns(active)){if(snapshot().phase==='committing')active.nonCancelable=true;report(active,'loading');changed();}});
 async function run(operation,work,{accept=()=>{},allowPending=false,allowBlocked=false}={}){
  if(closed||active||(!allowPending&&snapshot().pending)||(!allowBlocked&&(state.actionsBlocked||state.conflict)))return false;
  const job={epoch:++epoch,request:++request,kind:operation,nonCancelable:false};active=job;state.reading=state.busy=true;state.readKind=operation;state.error='';report(job,'loading');changed();
  try{if(!owns(job))return false;const result=await work({isCurrent:()=>owns(job),check(){if(!owns(job))throw Object.assign(Error('SG2 operation canceled'),{name:'AbortError'});}});if(!owns(job))return false;if(result===false){report(job,'failed');return false;}sync();if(result?.needsReload){state.conflict=true;state.conflictKind='saved-then-changed';state.error='이 탭의 변경은 저장됐어요. 그 뒤 다른 탭에서 저장 기록이 바뀌었어요. 현재 저장된 기록을 다시 불러와 주세요.';report(job,'failed');return false;}await accept(result);if(!owns(job))return false;state.ready=true;state.recoveryRequired=false;report(job,'ready');return true;}
  catch(error){if(!owns(job))return false;sync();if(error.name!=='AbortError'){state.error=error.message||String(error);if(['SAVE_CONFLICT','CAS_CONFLICT','CONFLICT','STALE_BASE'].includes(error.code)){state.conflict=true;state.conflictKind=snapshot().pending?'pending-change':'external-change';}if(operation==='boot')state.recoveryRequired=true;report(job,'failed');}else report(job,'cancelled');return false;}
  finally{if(active===job){active=null;state.reading=state.busy=false;state.readKind=null;changed();}}
 }
 function cancelRead(){if(!active)return false;if(active.nonCancelable||snapshot().phase==='committing')return false;session.cancel();const job=active;epoch++;active=null;state.busy=state.reading=false;state.readKind=null;report(job,'cancelled');changed();return true;}
 return {state,session,run,sync,changed,get projection(){return projection;},
  async boot(accept){if(snapshot().pending)return false;state.ready=false;state.conflict=false;state.conflictKind=null;state.actionsBlocked=false;return run('boot',()=>session.boot(),{allowBlocked:true,accept});},
  async audit(){return run('full-audit',()=>session.audit(),{accept:()=>{state.verificationStatus='FULL_REPLAY_VERIFIED';}}).then(ok=>{if(!ok&&state.error){state.actionsBlocked=true;state.verificationStatus='FULL_REPLAY_FAILED';changed();}return ok;});},
  async retry(accept){if(!snapshot().pending)return false;return run('retry',()=>session.retry(),{allowPending:true,accept});},
  async exportSave(){return session.exportRaw({pending:!!snapshot().pending});},
  cancelRead,close(){if(closed)return;closed=true;epoch++;unsubscribe?.();session.close();active=null;state.busy=state.reading=false;}
 };
}

export function createAppModel({session,freshProfile=RCI2_PROFILE,allowExperimentalProfiles=true,profile=null,audio={},notify=()=>{},id=()=>globalThis.crypto.randomUUID(),controllerFactory=createBattleController}){
 const binding=createSG2Binding({session,kind:'runtime',notify:()=>notify(m)}),m=binding.state;
 Object.assign(m,{run:null,profileMode:false,controller:null,importCandidate:null,completionBlocked:null});
 for(const key of ['verificationStatus','actionsBlocked','conflict','conflictKind','recoveryRequired']){let standalone=m[key];Object.defineProperty(m,key,{enumerable:true,get:()=>m.profileMode?(key==='conflict'?standalone||profile?.state[key]:profile?.state[key]):standalone,set:value=>{standalone=value;}});}
 let importRaw=null,battleCompletion=null,battlePending=null,actionPending=null,controllerConfig=null;
 const changed=()=>binding.changed();
 const fail=error=>{m.error=error.message||String(error);changed();return false;};
  const pendingOwn=()=>session.state().pending;
 // Pending profile state is surfaced through the runtime host as well.
 const standalonePending=Object.getOwnPropertyDescriptor(m,'pending').get,standaloneSaved=Object.getOwnPropertyDescriptor(m,'hasSavedBytes').get;
 Object.defineProperty(m,'pending',{enumerable:true,get:()=>{const p=m.profileMode?profile?.state.pending:standalonePending();return p&&battlePending?{...p,battleController:battlePending.controller}:p;}});
 Object.defineProperty(m,'hasSavedBytes',{enumerable:true,get:()=>m.profileMode?profile?.state.hasSavedBytes:standaloneSaved()});
 function adopt(){const next=binding.projection?.run??null;m.run=next;controllerConfig=next?.state.pendingBattle?.config?structuredClone(next.state.pendingBattle.config):null;}
 function adoptProfile(){m.run=profile?.state.envelope?.activeRun??null;controllerConfig=m.run?.state.pendingBattle?.config?structuredClone(m.run.state.pendingBattle.config):null;}
 function locked(){return m.busy||m.pending||m.conflict||m.actionsBlocked||m.recoveryRequired||m.profileMode&&(profile?.state.reading||!profile?.state.ready||profile?.state.recoveryRequired||profile?.state.pending||profile?.state.actionsBlocked||profile?.state.conflict);}
 function cue(before,action){const value=committedAudioIntent(before,action,m.run);if(value&&m.run)try{audio.committed?.(m.run.runId,m.run.revision,value);}catch{}}
 async function boot(){if(battleCompletion||m.profileMode&&profile?.state.pending)return false;const ok=await binding.boot(()=>{adopt();m.profileMode=false;m.controller=null;m.completionBlocked=null;importRaw=null;m.importCandidate=null;});if(!ok&&m.recoveryRequired){m.run=null;m.controller=null;controllerConfig=null;m.profileMode=false;changed();}return ok;}
 async function dispatch(action,{kind='transition'}={}){
  if(locked())return false;const before=m.run;actionPending={before,action};
  let ok;if(m.profileMode){m.busy=true;m.readKind=kind;changed();try{ok=await profile.transition({type:'runAction',action},{kind});if(ok)adoptProfile();}finally{m.busy=false;m.readKind=null;changed();}}
  else ok=await binding.run(kind,()=>session.transition(action),{accept:adopt});
  if(ok){cue(before,action);actionPending=null;m.error='';}else if(m.profileMode)m.error=profile.state.error;
  changed();return ok;
 }
 async function retry(){
  if(m.busy||m.conflict||m.actionsBlocked)return false;
  const before=actionPending?.before,action=actionPending?.action;
  let ok;if(m.profileMode){if(!profile?.state.pending)return false;ok=await profile.retry();if(ok)adoptProfile();else m.error=profile.state.error;}
  else ok=await binding.retry(adopt);
  if(ok){if(before&&action)cue(before,action);if(m.profileMode&&!m.run)m.profileMode=false;actionPending=null;if(battlePending){m.controller=null;battlePending=null;}m.completionBlocked=null;m.error='';}
  changed();return ok;
 }
 async function newRun(seed,selectedBaseFamilyIds,{longBattle=false,experimentalEnemyPressure=false}={}){
  if(!allowExperimentalProfiles&&(longBattle||experimentalEnemyPressure))return fail(Error('이 통합 후보는 검토된 LR29-r2 원정만 새로 시작합니다.'));
  if(locked()||m.profileMode||m.recoveryRequired)return false;
  if(m.run&&m.run.state.phase!=='complete')return fail(Error('진행 중인 SG2 원정은 새 원정으로 바꾸지 않습니다.'));
  if(m.controller)return false;
  return binding.run('new',()=>session.newRun({seed,runId:`run:${id()}`,options:{encounterProfile:longBattle?(experimentalEnemyPressure?RCI1_PRESSURE_PROFILE:RCI1_LONG_PROFILE):freshProfile,familySelection:makeFamilySelection({selectedBaseFamilyIds})}}),{accept:()=>{adopt();m.controller=null;}});
 }
 async function importFile(read){if(locked()||m.profileMode)return false;if(m.hasSavedBytes)return fail(Error('SG2는 비어 있는 격리 슬롯에만 가져옵니다. 기존 기록은 바꾸지 않았습니다.'));importRaw=null;m.importCandidate=null;
  return binding.run('import',async operation=>{const raw=await read();operation.check();const preview=await session.preview(raw);return {raw,preview};},{accept:({raw,preview})=>{importRaw=raw;m.importCandidate=preview.projection?.run??preview.run;}});
 }
 async function confirmImport(){if(locked()||m.profileMode||!m.importCandidate||typeof importRaw!=='string')return false;
  return binding.run('import',()=>session.importExplicit(importRaw,{confirmed:true}),{accept:()=>{adopt();importRaw=null;m.importCandidate=null;m.controller=null;}});
 }
 function resumeBattle(){if(locked()||m.run?.state.phase!=='battle'||!controllerConfig)return false;try{m.controller=controllerFactory(structuredClone(controllerConfig));m.completionBlocked=null;changed();return true;}catch(e){return fail(e);}}
 async function start(){if(!await dispatch({type:'startBattle',commandMode:'manual'}))return false;return resumeBattle();}
 function finishBattleAsync(){
  if(battleCompletion)return battleCompletion;
  const controller=m.controller;if(locked()||!controller?.isFinished())return Promise.resolve(false);
  const run=m.run,mode=m.profileMode,commands=structuredClone(controller.commandLog());
  // Reserve synchronously, before any notification or worker dispatch. Repeated
  // terminal ticks and duplicate UI commands share this exact one promise.
  let resolve;const promise=new Promise(r=>{resolve=r;});battleCompletion=promise;
  void (async()=>{try{
   const ok=await dispatch({type:'finishBattle',commands},{kind:'battle-result'});
   if(m.profileMode!==mode)return false;
   if(ok){m.controller=null;m.completionBlocked=null;return true;}
   if((mode?profile.state.pending:pendingOwn())){battlePending={controller,run};m.controller=null;m.completionBlocked='검증된 같은 결과의 저장 확인이 필요합니다.';}
   else m.completionBlocked=m.error||'결과 검증을 중단했습니다. 원본은 보존되었습니다.';
   return false;
  }catch(e){return fail(e);}finally{battleCompletion=null;changed();}})().then(resolve);
  return promise;
 }
 function tick(steps=1,includeSnapshot=true){if(locked()||!m.controller)return null;const value=m.controller.tick(steps,includeSnapshot);if(m.controller.isFinished()&&!battleCompletion&&!m.completionBlocked)void finishBattleAsync();return value;}
 function cast(skill,targetId){return !locked()&&m.controller&&!m.controller.isFinished()?m.controller.castSkill(skill,targetId):false;}
 function withdraw(){if(!m.run?.state.pendingBattle?.config.longBattlePolicy||!cast(WITHDRAW_COMMAND))return Promise.resolve(false);return finishBattleAsync();}
 function openProfileRun(){if(m.busy||m.pending||m.controller||!profile?.state.ready||profile.state.pending||profile.state.actionsBlocked||profile.state.conflict||profile.state.recoveryRequired||!profile.state.envelope?.activeRun)return false;m.profileMode=true;adoptProfile();m.conflict=false;m.conflictKind=null;changed();return true;}
 async function archiveProfileRun(){if(locked()||!m.profileMode||m.run?.state.phase!=='complete')return false;const ok=await profile.transition({type:'archiveTerminal',runId:m.run.runId});if(ok){m.run=null;m.profileMode=false;m.controller=null;controllerConfig=null;}else m.error=profile.state.error;changed();return ok;}
 async function enableProfileTokenSettlement(){if(locked()||!m.profileMode||m.controller)return false;const ok=await profile.enableOfficialTokenSettlement();if(ok)adoptProfile();else m.error=profile.state.error;changed();return ok;}
 async function checkChanged(){if(locked())return false;try{const changedOutside=await (m.profileMode?profile.checkChanged():session.checkChanged());if(changedOutside){m.conflict=true;m.conflictKind='external-change';m.error='다른 탭에서 저장 기록이 바뀌었어요. 현재 저장된 기록을 다시 불러와 주세요.';changed();}return changedOutside;}catch(e){fail(e);return true;}}
 return {state:m,boot,newRun,dispatch,retry,importFile,confirmImport,start,resumeBattle,tick,cast,withdraw,finishBattleAsync,openProfileRun,archiveProfileRun,enableProfileTokenSettlement,checkChanged,
  setProfile:value=>{profile=value;},reconcileProfile(){if(profile?.state.pending||profile?.state.actionsBlocked||profile?.state.conflict)return false;adoptProfile();m.controller=null;changed();return true;},
  fullAudit:()=>m.profileMode?profile.fullAudit():binding.audit(),cancelRead(){return m.profileMode?profile?.cancelRead():binding.cancelRead();},cancelImport(){binding.cancelRead();importRaw=null;m.importCandidate=null;changed();},
  exportSave:()=>m.profileMode?profile.exportSave():binding.exportSave(),exportRecoveryBackup:()=>null,
  async exportLiveBattle(){if(!m.controller)throw Error('No live battle');return JSON.stringify({status:'UNSETTLED_DIAGNOSTIC_NOT_A_SAVE',runId:m.run.runId,revision:m.run.revision,commands:m.controller.commandLog(),snapshot:m.controller.snapshot(),...(m.controller.isFinished()?{unsettledReceipt:m.controller.result()}:{})});},
  close:()=>binding.close(),
 };
}
