// All six scripts must match recovered pins before any code executes in a separate realm.
export async function initializeProfileRealm(api,{document=globalThis.document,fetch=globalThis.fetch,crypto=globalThis.crypto,signal}={}){
 const sources=[];
 for(const [file,expected] of Object.entries(api.SOURCE_HASHES)){
  const url=new URL('./core/profile-bridge/vendor/'+file,import.meta.url),response=await fetch(url,{cache:'no-store',signal});if(!response.ok)throw Error('구버전 검증 파일 누락: '+file);
  const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==expected)throw Error('구버전 검증 파일 해시 불일치: '+file);sources.push({file,bytes});
 }
 if(signal?.aborted)throw Error('Profile load cancelled');
 const frame=document.createElement('iframe');frame.hidden=true;frame.title='검증된 구버전 프로필 호환 영역';frame.setAttribute('aria-hidden','true');frame.src='about:blank';document.body.append(frame);
 try{for(const source of sources){const url=URL.createObjectURL(new Blob([source.bytes],{type:'text/javascript'}));try{await new Promise((resolve,reject)=>{const script=frame.contentDocument.createElement('script');script.src=url;const stop=()=>reject(Error('Profile load cancelled'));signal?.addEventListener('abort',stop,{once:true});script.onload=()=>{signal?.removeEventListener('abort',stop);resolve();};script.onerror=()=>{signal?.removeEventListener('abort',stop);reject(Error('구버전 검증 초기화 실패: '+source.file));};if(signal?.aborted){stop();return;}frame.contentDocument.head.append(script);});}finally{URL.revokeObjectURL(url);}}
 if(signal?.aborted)throw Error('Profile load cancelled');
 api.initializeLegacyProfileCompatibility({legacyApi:frame.contentWindow.TinyArmyCampaign,content:frame.contentWindow.TinyArmyV09Content,verifiedSourceHashes:api.SOURCE_HASHES});return {dispose:()=>frame.remove()};
 }catch(e){frame.remove();throw e;}
}
