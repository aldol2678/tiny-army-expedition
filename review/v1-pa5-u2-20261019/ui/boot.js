import {mountOfficialLoading} from '../loading/official-loading.js';
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
export async function bootOfficial({window=globalThis.window,document=globalThis.document,fetch=globalThis.fetch,crypto=globalThis.crypto}={}){
 const controller=new AbortController(),ownerId='official-boot',requestId=1,base={ownerId,requestId,status:'loading',phase:'data',progress:null,canCancel:true};let app=null,realm=null,audio=null,disposed=false;
 const shell=document.getElementById('appShell');shell.inert=false; // the new overlay owns the initial lock synchronously
 const overlay=mountOfficialLoading({document,ownerId,onCancel(){controller.abort();app?.model.cancelRead();app?.profile?.cancelRead();overlay.update({...base,status:'cancelled',canRetry:true});},onRetry(){window.location.reload();}});overlay.begin(base);
 const check=()=>{if(disposed||controller.signal.aborted)throw Object.assign(Error('준비를 취소했어요.'),{name:'AbortError'});};
 const stop=()=>{if(disposed)return;disposed=true;controller.abort();if(app)app.dispose();else audio?.dispose();realm?.dispose();overlay.destroy();};window.addEventListener('pagehide',stop,{once:true});
 try{
  const response=await fetch(new URL('../boot-manifest.json',import.meta.url),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('자료 목록을 읽지 못했어요.');const manifest=await response.json();check();
  await loadVerifiedScripts(manifest,{document,fetch,crypto,signal:controller.signal,onProgress:progress=>overlay.update({...base,phase:'data',progress})});check();
  overlay.update({...base,phase:'data',progress:null});
  const [api,profileApi,{SECOND_CLASSES},{initializeProfileRealm},{mountOfficialApp},{createCandidateAudio},{privateAudioWindow}]=await Promise.all([import('../core/runtime/browser-api.js'),import('../core/profile-integration/browser.js'),import('../core/progression/registry.js'),import('../profile-loader.js'),import('./official-app.js'),import('../audio/audio.js'),import('../audio/audio-scope.js')]);check();
  api.initializeBrowserEngine({content:window.TinyArmyV09Content,engine:window.TinyArmy});
  realm=await initializeProfileRealm(profileApi,{document,fetch,crypto,signal:controller.signal});check();
  overlay.update({...base,phase:'storage',progress:null});
  audio=createCandidateAudio({window:privateAudioWindow(window),document});
  app=mountOfficialApp({api,profileApi,classes:SECOND_CLASSES,audio,document,window,startup:true,onStartupRead:s=>{if(!controller.signal.aborted&&s.status==='loading')overlay.update({...base,phase:s.phase,progress:s.progress,canCancel:s.canCancel});}});
  const ready=await app.ready;check();if(ready!==true)throw Error(app.model.state.error||app.profile?.state.error||'저장 확인을 완료하지 못했어요.');
  const resources=window.TinyArmySiteResources;if(!resources?.preparePortraits)throw Error('공식 그림 준비 기능을 찾지 못했어요.');
  const types=[...new Set(['archer','spear','support',...(app.view()?.state.roster||[]).map(u=>u.type)])],report=()=>{const states=types.map(t=>resources.portraitState(t)),settled=states.filter(s=>['ready','fallback'].includes(s.status)).length;overlay.update({...base,phase:'expedition',progress:{completed:settled,total:states.length}});};
  document.addEventListener('tinyarmy:resource-state',report);try{report();await resources.preparePortraits(types);check();report();}finally{document.removeEventListener('tinyarmy:resource-state',report);}
  check();overlay.update({...base,status:'ready',phase:'expedition'});overlay.destroy();app.start();return Object.freeze({ok:true,app,dispose:stop});
 }catch(error){controller.abort();if(app)app.dispose();else audio?.dispose();realm?.dispose();if(!disposed){overlay.update({...base,status:error.name==='AbortError'?'cancelled':'failed',canRetry:true,errorCode:error.name==='AbortError'?'CANCELLED':'BOOT_FAILED'});document.getElementById('siteBootNote').textContent=error.name==='AbortError'?'준비를 중단했어요. 다시 시작할 때 새로 확인해요.':'자료나 저장을 확인하지 못했어요. 원본 저장을 바꾸지 않고 멈췄어요. 다시 시도해 주세요.';}return Object.freeze({ok:false,error,app,dispose:stop});}
}
if(typeof window!=='undefined'&&typeof document!=='undefined')void bootOfficial();
