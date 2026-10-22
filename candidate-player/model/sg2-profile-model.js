// Profile host for the explicit SG2 database. It never opens, copies, migrates,
// or falls back to any old localStorage save key.
import {RCI2_PROFILE} from '../core/rci2/identity.js';
import {DEFAULT_SELECTED_BASE_FAMILY_IDS} from '../core/family-selection/contract.js';
import {TOKEN_SETTLEMENT_VERSION} from '../core/profile-integration/token-settlement.js';
import {createSG2Binding} from './sg2-app-model.js';
export const PROFILE_UI_KEY='sg2-profile';
export function createProfileUIModel({session,freshProfile=RCI2_PROFILE,notify=()=>{},id=()=>globalThis.crypto.randomUUID()}){
 const binding=createSG2Binding({session,kind:'profile',notify}),state=binding.state;
 Object.assign(state,{previousProfileAvailable:false,envelope:null,view:null,preview:null,recoveryPreview:null});
 let previewRaw=null;
 const publish=()=>{state.envelope=binding.projection?.envelope??null;state.view=binding.projection?.view??null;};
 const fail=message=>{state.error=message;binding.changed();return false;};
 const unsupported=()=>fail('SG2는 비어 있는 격리 슬롯에만 명시적으로 가져옵니다. 기존 기록 교체·병합·구버전 자동 복사는 지원하지 않습니다.');
 async function previewFile(read){
  if(state.reading||state.pending||state.actionsBlocked)return false;
  if(state.hasSavedBytes)return unsupported();
  state.preview=null;previewRaw=null;
  return binding.run('legacy',async operation=>{const raw=await read();operation.check();return {raw,preview:await session.preview(raw)};},{accept:({raw,preview})=>{previewRaw=raw;state.preview=preview;}});
 }
 async function confirm(digest){
  if(state.reading||state.pending||!state.preview||typeof previewRaw!=='string')return false;
  if(digest!==state.preview.previewDigest)return fail('가져오기 미리보기가 바뀌었습니다. 파일을 다시 확인해 주세요.');
  return binding.run('import',()=>session.importExplicit(previewRaw,{confirmed:true,previewDigest:digest}),{accept:()=>{publish();state.preview=null;previewRaw=null;}});
 }
 async function transition(action,{kind='transition'}={}){if(!state.ready||!state.envelope)return fail('SG2 프로필 파일을 먼저 확인하고 가져와 주세요.');return binding.run(kind,()=>session.transition(action),{accept:publish});}
 return {state,
  createProfile:()=>binding.run('new',()=>session.newRun({profileId:`player:${id()}`}),{accept:publish}),
  purchasePreview:unlockId=>state.view?.catalog?.find(x=>x.id===unlockId)??null,
  purchaseUnlock:unlockId=>transition({type:'purchaseUnlock',unlockId}),
  boot:()=>binding.boot(()=>{publish();state.preview=null;previewRaw=null;}),previewFile,preview:raw=>previewFile(()=>raw),confirm,transition,
  transitionAsync:(action,options={})=>transition(action,{kind:options.kind??'battle-result'}),
  startRun:(seed,tactic='balanced',selectedBaseFamilyIds=DEFAULT_SELECTED_BASE_FAMILY_IDS)=>transition({type:'startRun',encounterProfile:freshProfile,seed,runId:state.view?.nextRunId??`profile-run:${id()}`,tactic,selectedBaseFamilyIds:[...selectedBaseFamilyIds]}),
  enableOfficialTokenSettlement:()=>transition({type:'enableOfficialTokenSettlement',policyVersion:TOKEN_SETTLEMENT_VERSION}),
  retry:()=>binding.retry(publish),fullAudit:()=>binding.audit(),cancelRead:()=>binding.cancelRead(),
  cancel(){binding.cancelRead();state.preview=null;previewRaw=null;binding.changed();},
  exportSave:()=>binding.exportSave(),exportPreservedOriginal:()=>session.exportPreservedOriginal(),exportOriginal:()=>previewRaw??session.exportPreservedOriginal(),exportRecoveryBackup:()=>null,
  copyPreviousProfile:unsupported,previewRecovery:unsupported,previewRecoveryFile:unsupported,confirmRecovery:unsupported,confirmRecoveryAsync:unsupported,
  async checkChanged(){return session.checkChanged();},close:()=>binding.close(),
 };
}
