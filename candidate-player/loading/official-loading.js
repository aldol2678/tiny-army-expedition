// Presentation only. No clock, save access, simulation, import or automatic retry.
export const PHASE_LABELS=Object.freeze({data:'자료 불러오기',storage:'저장 확인',expedition:'원정 준비'});
// Opt-in SG2 wording only. Legacy callers retain their original copy and lifecycle.
const sg2ReadOperations=new Set(['boot','full-audit','legacy','preview','read']);
export const SG2_LOADING_COPY=Object.freeze({
 status(s,{cancelRequested}){return s.status==='loading'&&!cancelRequested&&s.copyState?.storagePhase==='committing'?'저장하기':null;},
 phaseLabel(s,phase=s.phase){return phase==='storage'?(s.copyState?.operation&&!sg2ReadOperations.has(s.copyState.operation)?'저장하기':'저장 검사'):PHASE_LABELS[phase];},
 note(s,{canDismiss,cancelRequested}){
  if(s.status==='failed')return s.canRetry?(canDismiss?'다시 시도하거나 이전 화면으로 돌아가 주세요.':'다시 시도해 주세요.'):canDismiss?'돌아가기를 눌러 확인 내용을 살펴봐 주세요.':'확인 내용을 살펴봐 주세요.';
  if(s.status==='cancelled')return '다시 시작할 때 새로 확인해요.';
  if(s.copyState?.storagePhase==='committing')return '저장을 마무리하고 있어요. 이 단계는 취소할 수 없어요.';
  if(cancelRequested)return '현재 작업의 중단을 요청했어요.';
  const count=s.copyState?.countKind==='scripts'?' 표시된 수는 불러온 게임 자료 수예요. 전체 원정 기록 수는 아니에요.':s.copyState?.countKind==='images'?' 표시된 수는 준비한 그림 수예요. 전체 원정 기록 수는 아니에요.':'';
  return '준비가 끝나면 시작해요.'+(s.canCancel?' 준비 중에는 취소할 수 있어요.':'')+count+' 자료와 기록의 크기, 기기에 따라 걸리는 시간이 달라질 수 있어요. 단계 표시는 현재 작업이며 전체 진행률이나 남은 시간이 아니에요.';
 }
});
const statuses=new Set(['loading','ready','failed','cancelled']);
const leases=new WeakMap();
const assert=(ok,message)=>{if(!ok)throw new TypeError(message);};
const identity=s=>JSON.stringify([s.ownerId,s.requestId]);
export function loadingSnapshot(input){
 assert(input&&typeof input==='object','Loading snapshot required');
 assert(typeof input.ownerId==='string'&&input.ownerId.length>0,'ownerId required');
 assert(typeof input.requestId==='string'&&input.requestId.length>0||Number.isSafeInteger(input.requestId)&&input.requestId>=0,'requestId required');
 assert(statuses.has(input.status)&&Object.hasOwn(PHASE_LABELS,input.phase),'Unknown loading state');
 let progress=null;
 if(input.progress!==null&&input.progress!==undefined){
  const p=input.progress;
  // Zero/unknown total is indeterminate, never a fake completed 0/0 stage.
  assert(Number.isSafeInteger(p.completed)&&p.completed>=0&&Number.isSafeInteger(p.total)&&p.total>=0&&p.completed<=p.total,'Invalid measured progress');
  if(p.total>0)progress=Object.freeze({completed:p.completed,total:p.total});
 }
 return Object.freeze({ownerId:input.ownerId,requestId:input.requestId,status:input.status,phase:input.phase,progress,canCancel:input.status==='loading'&&input.canCancel===true,canRetry:['failed','cancelled'].includes(input.status)&&input.canRetry===true,errorCode:typeof input.errorCode==='string'?input.errorCode:null,...(input.copyState?{copyState:Object.freeze({operation:input.copyState.operation??null,storagePhase:input.copyState.storagePhase??null,countKind:input.copyState.countKind??null})}:{})});
}
// A host explicitly begins each request. update cannot seize ownership or revive
// a terminal request. Replacing a mounted component retires the former DOM lease.
export function mountOfficialLoading({document,ownerId,onCancel=()=>{},onRetry=()=>{},onDismiss=null,copy=null}){
 assert(typeof ownerId==='string'&&ownerId,'ownerId required');
 const get=id=>document.getElementById(id),root=get('siteBoot'),shell=get('appShell'),status=get('siteBootStatus'),note=get('siteBootNote'),meter=get('siteBootProgress'),fill=get('siteBootProgressFill'),count=get('siteBootCount'),cancel=get('siteBootCancel'),retry=get('siteBootRetry'),dismiss=get('siteBootDismiss');
 assert([root,shell,status,note,meter,fill,count,cancel,retry,dismiss].every(Boolean),'Official loading markup required');
 const previous=leases.get(root),token={},baseline=previous?.baseline||{inert:shell.inert,hidden:shell.getAttribute('aria-hidden'),busy:shell.getAttribute('aria-busy')};
 const lease={token,baseline,returnFocus:previous?.returnFocus??document.activeElement};leases.set(root,lease);
 let current=null,destroyed=false,focusBefore=lease.returnFocus,cancelRequested=false,retryRequested=false,dismissed=false,actionHandlers=null;
 const retired=new Set(),owns=()=>!destroyed&&leases.get(root)?.token===token;
 const restoreAttribute=(name,value)=>value===null?shell.removeAttribute(name):shell.setAttribute(name,value);
 function release(){if(!owns())return;root.hidden=true;root.setAttribute('aria-busy','false');shell.inert=baseline.inert;restoreAttribute('aria-hidden',baseline.hidden);restoreAttribute('aria-busy',baseline.busy);if(root.contains(document.activeElement)&&focusBefore?.isConnected!==false)focusBefore?.focus?.();}
 function render(){
  if(!owns()||!current)return false;
  const rendered=current;
  if(current.status==='ready'){release();return true;}
  const needsFocus=root.hidden||!root.contains(document.activeElement);if(root.hidden&&!root.contains(document.activeElement)){focusBefore=document.activeElement;lease.returnFocus=focusBefore;}
  root.hidden=false;root.dataset.state=current.status;shell.inert=true;shell.setAttribute('aria-hidden','true');shell.setAttribute('aria-busy',String(current.status==='loading'));if(needsFocus)status.focus();
  if(!owns()||current!==rendered)return false;
  const label=copy?.phaseLabel?.(current)??PHASE_LABELS[current.phase];
  const message=copy?.status?.(current,{cancelRequested})??(current.status==='failed'?'준비하지 못했어요':current.status==='cancelled'?'준비를 취소했어요':cancelRequested?'취소 요청 중':label);
  if(status.textContent!==message)status.textContent=message;
  note.hidden=false;note.textContent=copy?.note?.(current,{canDismiss:!!onDismiss,cancelRequested})??(current.status==='failed'?(current.canRetry?'다시 시도하거나 이전 화면으로 돌아가세요.':'이전 화면에서 자료를 다시 선택해 주세요.'):current.status==='cancelled'?'다시 시작할 때 새로 확인해요.':current.canCancel?'준비가 끝나면 바로 시작해요. 취소할 수 있어요.':'준비가 끝나면 바로 시작해요.');
  for(const phase of Object.keys(PHASE_LABELS)){const el=get('siteBootPhase-'+phase);if(el){if(copy?.phaseLabel)el.textContent=copy.phaseLabel(current,phase);el.setAttribute('aria-current',current.phase===phase?'step':'false');el.dataset.active=String(current.phase===phase);}}
  const p=current.status==='loading'?current.progress:null;
  meter.hidden=current.status!=='loading';meter.setAttribute('aria-label',label+' 진행');meter.dataset.mode=p?'determinate':'indeterminate';
  meter.setAttribute('aria-valuemin','0');
  if(p){meter.setAttribute('aria-valuemax',String(p.total));meter.setAttribute('aria-valuenow',String(p.completed));meter.setAttribute('aria-valuetext',`${p.total}개 중 ${p.completed}개 완료`);fill.style.width=`${p.completed/p.total*100}%`;count.textContent=`${p.completed} / ${p.total}`;}
  else{meter.removeAttribute('aria-valuemax');meter.removeAttribute('aria-valuenow');meter.removeAttribute('aria-valuetext');fill.style.width='';count.textContent=current.status==='loading'?'진행 중':'';}
  cancel.hidden=!current.canCancel;cancel.disabled=cancelRequested;retry.hidden=!current.canRetry;retry.disabled=retryRequested;dismiss.hidden=!onDismiss||!['failed','cancelled'].includes(current.status);
  return true;
 }
 function begin(input){if(!owns())return false;const next=loadingSnapshot(input);if(next.ownerId!==ownerId||retired.has(identity(next)))return false;if(current&&identity(current)===identity(next))return update(next);if(current)retired.add(identity(current));current=next;cancelRequested=false;retryRequested=false;dismissed=false;bindActions();return render();}
 function update(input){if(!owns())return false;const next=loadingSnapshot(input);if(!current||identity(next)!==identity(current)||current.status!=='loading')return false;current=next;return render();}
 const reference=()=>Object.freeze({ownerId:current.ownerId,requestId:current.requestId});
 const sameRequest=ref=>owns()&&current&&identity(ref)===identity(current);
 function requestCancel(expected){if(expected&&!sameRequest(expected))return;if(!owns()||!current?.canCancel||current.status!=='loading'||cancelRequested||dismissed)return;const ref=reference();cancelRequested=true;render();if(sameRequest(ref)&&current.canCancel&&current.status==='loading')onCancel(ref);}
 function requestRetry(expected){if(expected&&!sameRequest(expected))return;if(!owns()||!current?.canRetry||retryRequested||dismissed)return;const ref=reference();retryRequested=true;render();if(sameRequest(ref)&&current.canRetry)onRetry(ref);}
 function requestDismiss(expected){if(expected&&!sameRequest(expected))return;if(!owns()||!current||!['failed','cancelled'].includes(current.status)||!onDismiss||dismissed)return;const ref=reference();dismissed=true;release();if(sameRequest(ref))onDismiss(ref);}
 function key(event){if(!owns()||root.hidden)return;if(event.key==='Escape'){event.preventDefault();requestCancel();}else if(event.key==='Tab'){const buttons=[cancel,retry,dismiss].filter(b=>!b.hidden&&!b.disabled),items=buttons.length?buttons:[status],i=items.indexOf(document.activeElement);event.preventDefault();items[i<0?(event.shiftKey?items.length-1:0):(i+(event.shiftKey?-1:1)+items.length)%items.length].focus();}}
 function unbindActions(){if(!actionHandlers)return;cancel.removeEventListener('click',actionHandlers.cancel);retry.removeEventListener('click',actionHandlers.retry);dismiss.removeEventListener('click',actionHandlers.dismiss);actionHandlers=null;}
 function bindActions(){unbindActions();const ref=reference();actionHandlers={cancel:()=>requestCancel(ref),retry:()=>requestRetry(ref),dismiss:()=>requestDismiss(ref)};cancel.addEventListener('click',actionHandlers.cancel);retry.addEventListener('click',actionHandlers.retry);dismiss.addEventListener('click',actionHandlers.dismiss);}
 document.addEventListener('keydown',key);
 return Object.freeze({begin,update,state:()=>current,destroy(){if(destroyed)return;release();if(owns())leases.delete(root);destroyed=true;unbindActions();document.removeEventListener('keydown',key);}});
}
