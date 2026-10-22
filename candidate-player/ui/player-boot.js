import {mountOfficialLoading,SG2_LOADING_COPY} from '../loading/official-loading.js';
import {LIGHTWEIGHT_RECORDS_OPTIONS,COMBINED_DATABASE,COMBINED_RUNTIME_SLOT,COMBINED_PROFILE_SLOT} from './lightweight-records-options.js';
import {installCombinedRules} from '../core/lightweight-records/install.js';
import {openRecordStore} from '../storage-sg2/idb-store.js';
import {createStorageWorker} from '../storage-sg2/worker-client.js';
import {createRecordSession} from '../storage-sg2/session.js';
import {createNativeProfileSession} from '../storage-sg2/native-session.js';
// Same-origin, private static entry. No production URL, automatic migration, or
// old Campaign/game-ui bootstrap. Every manifest-listed legacy script is hash checked.
export async function loadVerifiedScripts(manifest,{document,fetch,crypto,signal,onProgress=()=>{}}){
 const total=manifest.scripts.length;onProgress({completed:0,total});
 for(const [i,item]of manifest.scripts.entries()){
  if(signal.aborted)throw Object.assign(Error('취소'),{name:'AbortError'});
  const url=new URL('../'+item.file,import.meta.url),response=await fetch(url,{cache:'no-store',signal});if(!response.ok)throw Error('필수 자료를 읽지 못했어요.');
  const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==item.sha256)throw Error('필수 자료의 원본 확인에 실패했어요.');
  await new Promise((resolve,reject)=>{const script=document.createElement('script'),cancel=()=>{script.remove();reject(Object.assign(Error('취소'),{name:'AbortError'}));};script.src=url.href;script.integrity='sha256-'+btoa(String.fromCharCode(...new Uint8Array(hash.match(/../g).map(x=>parseInt(x,16)))));script.crossOrigin='anonymous';script.async=false;script.onload=()=>{signal.removeEventListener('abort',cancel);resolve();};script.onerror=()=>{signal.removeEventListener('abort',cancel);reject(Error('필수 자료를 시작하지 못했어요.'));};signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return;}document.head.append(script);});
  if(signal.aborted)throw Object.assign(Error('취소'),{name:'AbortError'});onProgress({completed:i+1,total});
 }
}
export async function bootPlayer({window=globalThis.window,document=globalThis.document,fetch=globalThis.fetch,crypto=globalThis.crypto}={}){
 const controller=new AbortController(),ownerId='official-boot',requestId=1,base={ownerId,requestId,status:'loading',phase:'data',progress:null,canCancel:true};let app=null,realm=null,audio=null,runtimeSession=null,profileSession=null,disposed=false;
 const shell=document.getElementById('appShell');shell.inert=false; // the new overlay owns the initial lock synchronously
 const overlay=mountOfficialLoading({document,ownerId,copy:SG2_LOADING_COPY,onCancel(){controller.abort();app?.model.cancelRead();app?.profile?.cancelRead();overlay.update({...base,status:'cancelled',canRetry:true});},onRetry(){window.location.reload();}});overlay.begin(base);
 const check=()=>{if(disposed||controller.signal.aborted)throw Object.assign(Error('준비를 취소했어요.'),{name:'AbortError'});};
 const stop=()=>{if(disposed)return;disposed=true;controller.abort();if(app)app.dispose();else{audio?.dispose();runtimeSession?.close();profileSession?.close();}realm?.dispose();overlay.destroy();};window.addEventListener('pagehide',stop,{once:true});
 try{
  const response=await fetch(new URL('../boot-manifest.json',import.meta.url),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('자료 목록을 읽지 못했어요.');const manifest=await response.json();check();
  await loadVerifiedScripts(manifest,{document,fetch,crypto,signal:controller.signal,onProgress:progress=>overlay.update({...base,phase:'data',progress,copyState:{operation:'boot',countKind:'scripts'}})});check();
  overlay.update({...base,phase:'data',progress:null});
  const [api,profileApi,{SECOND_CLASSES},{mountOfficialApp},{createCandidateAudio}]=await Promise.all([import('../core/runtime/browser-api.js'),import('../core/profile-integration/browser.js'),import('../core/progression/registry.js'),import('./official-app-sg2.js'),import('../audio/audio.js')]);check();
  api.initializeBrowserEngine({content:window.TinyArmyV09Content,engine:window.TinyArmy,engines:{rci1:window.TinyArmyRCI1}});
  installCombinedRules();
  overlay.update({...base,phase:'storage',progress:null});
  // Audio preferences use a new player-only namespace. No legacy game or audio key is read.
  const audioWindow=new Proxy(window,{get(target,key){if(key==='localStorage')return {getItem:()=>target.localStorage.getItem('tiny-army-player.audio.muted.v1'),setItem:(_,v)=>target.localStorage.setItem('tiny-army-player.audio.muted.v1',v)};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
  audio=createCandidateAudio({window:audioWindow,document});
  const dependencies=async(kind,slot)=>{const worker=createStorageWorker({rules:'lr29-r2'});try{return (kind==='profile'?createNativeProfileSession:createRecordSession)({store:await openRecordStore({indexedDB:window.indexedDB,name:'tiny-army-player-private-v1'}),worker,kind,slot});}catch(error){worker.close();throw error;}};
  runtimeSession=await dependencies('runtime','player-runtime');check();profileSession=await dependencies('profile','player-profile');check();
  app=mountOfficialApp({...LIGHTWEIGHT_RECORDS_OPTIONS,playerMode:true,runtimeSession,profileSession,api,profileApi,classes:SECOND_CLASSES,audio,document,window,startup:true,onStartupRead:s=>{if(!controller.signal.aborted&&s.status==='loading')overlay.update({...base,phase:s.phase,progress:s.progress,canCancel:s.canCancel,copyState:s.copyState});}});
  const ready=await app.ready;check();if(ready!==true&&!app.recoveryAvailable)throw Error(app.model.state.error||app.profile?.state.error||'저장 확인을 완료하지 못했어요.');
  const resources=window.TinyArmySiteResources;if(!resources?.preparePortraits)throw Error('공식 그림 준비 기능을 찾지 못했어요.');
  const types=[...new Set(['archer','spear','support',...(app.view()?.state.roster||[]).map(u=>u.type)])],report=()=>{const states=types.map(t=>resources.portraitState(t)),settled=states.filter(s=>['ready','fallback'].includes(s.status)).length;overlay.update({...base,phase:'expedition',progress:{completed:settled,total:states.length},copyState:{operation:'boot',countKind:'images'}});};
  document.addEventListener('tinyarmy:resource-state',report);try{report();await resources.preparePortraits(types);check();report();}finally{document.removeEventListener('tinyarmy:resource-state',report);}
  check();overlay.update({...base,status:'ready',phase:'expedition'});overlay.destroy();app.start();return Object.freeze({ok:true,app,dispose:stop});
 }catch(error){controller.abort();if(app)app.dispose();else{audio?.dispose();runtimeSession?.close();profileSession?.close();}realm?.dispose();if(!disposed){overlay.update({...base,status:error.name==='AbortError'?'cancelled':'failed',canRetry:true,errorCode:error.name==='AbortError'?'CANCELLED':'BOOT_FAILED'});document.getElementById('siteBootNote').textContent=error.name==='AbortError'?'준비를 중단했어요. 다시 시작할 때 새로 확인해요.':'자료나 저장 기록을 확인하지 못했어요. 다시 시도해 주세요.';}return Object.freeze({ok:false,error,app,dispose:stop});}
}
if(typeof window!=='undefined'&&typeof document!=='undefined')window.TinyArmyPlayerReady=bootPlayer();
