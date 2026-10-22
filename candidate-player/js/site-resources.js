/* Web-only image readiness. Exact manifest URLs/bytes; no gameplay state changes. */
(function(g){'use strict';
const allowed=Object.freeze({"./assets/portraits/spear.3237f03386a175b8.webp":{"sha256":"3237f03386a175b8dfb910a6283d1ff7168ea94a5f08c69742bc26ec3ae93ac3","group":"portraits","id":"spear"},"./assets/portraits/archer.af377459569fd85e.webp":{"sha256":"af377459569fd85ebd16ade7ad5da376504d803d160fa2ade0e706bc384b530e","group":"portraits","id":"archer"},"./assets/portraits/support.c778489dcab2988e.webp":{"sha256":"c778489dcab2988ef89f0250c9be8da34e7db01f720ca572ab030a01e024ff06","group":"portraits","id":"support"},"./assets/portraits/guardian.8eaa1a2aa0d77eb8.webp":{"sha256":"8eaa1a2aa0d77eb806132ef852a3beebaa5bb19819e8d1b42548ba849ed05826","group":"portraits","id":"guardian"},"./assets/portraits/charger.2dac0e5bd21bfcb2.webp":{"sha256":"2dac0e5bd21bfcb2d6e05dc11ef31991e8613edd604749f9fd0b5d463500dfad","group":"portraits","id":"charger"},"./assets/portraits/sniper.da093abf7e4c7275.webp":{"sha256":"da093abf7e4c7275457a55937cd189d482e43ff9fdbdd552ee78fe77620ae0cd","group":"portraits","id":"sniper"},"./assets/portraits/volley.d9ebf0efbbbbcaa0.webp":{"sha256":"d9ebf0efbbbbcaa05223f6c7d6fff55ffcadca80074e3d94add848750c3b7cde","group":"portraits","id":"volley"},"./assets/portraits/mage.651dcda02c482a7a.webp":{"sha256":"651dcda02c482a7a1d8ece05fcca3b509068f89972b22db6decfbf081c4f3fc7","group":"portraits","id":"mage"},"./assets/portraits/frostmage.d8e05c7a22a1b8a1.webp":{"sha256":"d8e05c7a22a1b8a1031a9c502b98e8ce4c0fe39455421ffa74d70128e3e832de","group":"portraits","id":"frostmage"},"./assets/portraits/medic.53c8da5e83292cf4.webp":{"sha256":"53c8da5e83292cf432dd9504c7c435feff0a25479db5fea56e2af51f95e2d670","group":"portraits","id":"medic"},"./assets/portraits/pyromancer.5b715b5bf012257d.webp":{"sha256":"5b715b5bf012257dadb80e5d415b3dc2f033eaab42f804a29db864201e6c47f9","group":"portraits","id":"pyromancer"},"./assets/portraits/warder.8f166ee78f510e07.webp":{"sha256":"8f166ee78f510e07400fcba7a56fbcc33d52a501084123b34e9d9b1f2a183b65","group":"portraits","id":"warder"},"./assets/events/abandoned_cache.95a62aee9fa7cb77.webp":{"sha256":"95a62aee9fa7cb7721b5d6134c835670fb4d00e577c63fe7c7673531a2a7f8c1","group":"events","id":"abandoned_cache"},"./assets/events/field_infirmary.9a9428663c5f3884.webp":{"sha256":"9a9428663c5f3884676bd1359d68c3441fd845173174571d35454773f78568dd","group":"events","id":"field_infirmary"},"./assets/events/guide_camp.86f58f421066bc8f.webp":{"sha256":"86f58f421066bc8f8ea4bdb8531c43004e8ccad5d2aa139a3d0e0ef006da042d","group":"events","id":"guide_camp"},"./assets/events/roadside_kitchen.4d81c5b5eee4b781.webp":{"sha256":"4d81c5b5eee4b781b2d9842caecd8317a7727d0e5f547cd9b2cfe15d55f6dff2","group":"events","id":"roadside_kitchen"},"./assets/events/supply_cart.5ff2eb3da6496ebb.webp":{"sha256":"5ff2eb3da6496ebb3af23118004b2f9269e3579df406f6cc6ca59bc2f060324c","group":"events","id":"supply_cart"},"./assets/events/watchtower.6efef5f2f921ff79.webp":{"sha256":"6efef5f2f921ff7989d4cae874a9fbf3726da4adce9a5ef31cd5f7ef9d5eeec4","group":"events","id":"watchtower"},"./assets/enemies/armored.02f85010b9e8c7c6.webp":{"sha256":"02f85010b9e8c7c6d06e93be3d41dc3879b23262655f9e419a660a43ddbb0b7f","group":"enemies","id":"armored"},"./assets/enemies/boss.2a6530afe671f7b4.webp":{"sha256":"2a6530afe671f7b4f81545d42e611e98154acc7d176ea5baf95f5660588df421","group":"enemies","id":"boss"},"./assets/enemies/bow.fa2e9c3049d2490c.webp":{"sha256":"fa2e9c3049d2490c4a4605bf4259de5b0c95c09b57fee9631f3ea183ecfd8a02","group":"enemies","id":"bow"},"./assets/enemies/brute.c687d0fdc24d9846.webp":{"sha256":"c687d0fdc24d9846cbd316ed1ee54793e3ac7f31c86168ef43f6c8fa6018f0a3","group":"enemies","id":"brute"},"./assets/enemies/raider.0d6431544f190110.webp":{"sha256":"0d6431544f19011040e392a5672a80b13c2dbd124ab5b070dbdc83f5fc410f60","group":"enemies","id":"raider"},"./assets/enemies/swarm.6d3e53f6aee054b3.webp":{"sha256":"6d3e53f6aee054b3500f1e158cabd0ec88769f9f37a7da705b763c5d14e1ff7d","group":"enemies","id":"swarm"}}),failed=new Set(),placeholder=new Set(),records=new Map(),demanded=new Set();
const initialPortraitTypes=Object.freeze(['archer','spear','support']);
const TIMEOUT_MS=12000,SELECTOR='.ta-card-portrait[data-unit],svg[data-asset]';
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const paths=Object.keys(allowed),painted=new WeakMap();
let refreshQueued=false,observer=null,notice=null,noticeText=null,retryButton=null,retryInProgress=false,dismissedFailures='';
function hasFailed(entry){return !!entry&&failed.has(entry.dataUri);}
// Validation is independent of failure state, so a failed URL remains safely retryable.
function verifiedUri(path){
  if(typeof path!=='string'||!own(allowed,path))return null;
  if(!g.document)return path;
  try{const url=new g.URL(path,g.document.baseURI);
    return g.location&&url.origin===g.location.origin&&['https:','http:'].includes(url.protocol)?url.href:null;
  }catch(_){return null;}
}
function resolve(entry){
  if(!entry||typeof entry.dataUri!=='string'||!own(allowed,entry.dataUri)||entry.sha256!==allowed[entry.dataUri].sha256||hasFailed(entry)||placeholder.has(entry.dataUri))return null;
  return verifiedUri(entry.dataUri);
}
function pathFor(group,id){return paths.find(path=>allowed[path].group===group&&allowed[path].id===id);}
function stateFor(path){
  const r=records.get(path),meta=allowed[path];
  return Object.freeze({id:meta?.id||null,path:path||null,status:r?.status||(meta?'idle':'unknown'),reason:r?.reason||null});
}
function portraitState(type){return stateFor(pathFor('portraits',type));}
function publish(path){
  queueRefresh();
  if(g.document?.dispatchEvent&&typeof g.CustomEvent==='function')g.document.dispatchEvent(new g.CustomEvent('tinyarmy:resource-state',{detail:stateFor(path)}));
}
function ensurePath(path,retry=false,speculative=false){
  const uri=verifiedUri(path);
  if(!uri)return Promise.resolve(stateFor(null));
  if(!speculative)demanded.add(path);
  let r=records.get(path);
  if(r&&(!retry||r.status!=='fallback')){
    if(!speculative&&r.image&&r.status==='loading')r.image.fetchPriority='auto';
    return r.promise;
  }
  // A retry is explicit and bounded to one attempt at this same allowlisted URL.
  failed.delete(path);
  r={status:'loading',reason:null,attempt:(r?.attempt||0)+1,image:null,promise:null,finish:null};
  records.set(path,r);
  let settle;
  r.promise=new Promise(resolvePromise=>{settle=resolvePromise;});
  let timer=null,decoding=false,finished=false;
  const finish=(status,reason=null)=>{
    if(finished||records.get(path)!==r)return;
    finished=true;
    if(timer!==null)g.clearTimeout(timer);
    if(r.image){r.image.onload=null;r.image.onerror=null;}
    r.finish=null;r.status=status;r.reason=reason;
    if(status==='ready')failed.delete(path);else failed.add(path);
    settle(stateFor(path));publish(path);
  };
  r.finish=finish;
  publish(path);
  if(typeof g.Image!=='function'){finish('fallback','image-unavailable');return r.promise;}
  try{
    const image=r.image=new g.Image();
    image.decoding='async';
    image.fetchPriority=speculative?'low':'auto';
    const loaded=()=>{
      if(finished||decoding)return;
      if(!(image.naturalWidth>0)){finish('fallback','empty-image');return;}
      decoding=true;
      if(typeof image.decode==='function'){
        Promise.resolve().then(()=>image.decode()).then(()=>finish('ready'),()=>finish('fallback','decode-error'));
      }else finish('ready');
    };
    image.onload=loaded;
    image.onerror=()=>finish('fallback','network-error');
    timer=g.setTimeout(()=>finish('fallback','timeout'),TIMEOUT_MS);
    image.src=uri;
    if(image.complete&&image.naturalWidth>0)loaded();
  }catch(_){finish('fallback','image-error');}
  return r.promise;
}
function selectedPortraitPaths(types){
  return [...new Set((Array.isArray(types)?types:[]).map(type=>pathFor('portraits',type)).filter(Boolean))];
}
function preparePortraits(types=initialPortraitTypes){return Promise.all(selectedPortraitPaths(types).map(path=>ensurePath(path)));}
function retryPortraits(types=initialPortraitTypes){return Promise.all(selectedPortraitPaths(types).map(path=>ensurePath(path,true)));}
// Intent-only next-screen warming: at most two extra atlases per page, one at
// a time. Never enumerate the library or touch campaign/save state. Existing
// URL records retain their Image and decode Promise for subsequent demand.
const warmed=new Set();
let warmScheduled=false,warmTypes=[];
function canWarm(){
  const connection=g.navigator?.connection;
  return !g.document?.hidden&&!connection?.saveData&&!['slow-2g','2g','3g'].includes(connection?.effectiveType);
}
function scheduleWarm(types){
  if(!canWarm()||warmed.size>=2)return;
  warmTypes=Array.isArray(types)?types.slice(0,20):[];
  if(warmScheduled)return;
  warmScheduled=true;
  const run=async()=>{
    try{
      // Finish the three required camp images before any optional work.
      await preparePortraits();
      for(const path of selectedPortraitPaths(warmTypes)){
        if(!canWarm()||warmed.size>=2)break;
        if(records.has(path))continue;
        // Do not compete with a screen that is already loading on demand.
        if([...records.values()].some(r=>r.status==='loading'))break;
        warmed.add(path);
        await ensurePath(path,false,true);
      }
    }finally{warmScheduled=false;warmTypes=[];}
  };
  if(typeof g.requestIdleCallback==='function')g.requestIdleCallback(run);
  else g.setTimeout(run,150);
}
function onPortraitIntent(event){
  const button=event.target?.closest?.('[data-action]');
  if(!button||button.disabled||!['roster','formation'].includes(button.getAttribute('data-action')))return;
  const campaign=g.tinyArmyCampaign,roster=campaign?.roster||campaign?.run?.roster;
  if(Array.isArray(roster))scheduleWarm(roster.map(unit=>unit.type));
}
function failedDemandPaths(){return [...records].filter(([path,r])=>demanded.has(path)&&r.status==='fallback').map(([path])=>path);}
function portraitFallbackType(type){return {pyromancer:'mage',frostmage:'mage',medic:'support',warder:'guardian'}[type];}
function size(value,fallback){const n=Number(value);return Number.isFinite(n)&&n>0?Math.max(8,Math.min(1024,n)):fallback;}
function mediaFallback(group,id,opts={}){
  if(!pathFor(group,id))return '';
  const o=typeof opts==='number'?{size:opts}:opts,width=size(o.width||o.size,group==='events'?360:96),height=size(o.height,group==='events'?width*2/3:width);
  const markup=group==='events'?g.TinyArmyScreenArt?.banner('event',width):
    (g.TinyArmyUIArt?.portraits?.[id]||g.TinyArmyScreenArt?.icon(id==='boss'?'boss':id==='bow'?'focus':'sword',width));
  if(!markup)return '';
  return markup.replace(/^<svg\b([^>]*)>/,(_,attrs)=>`<svg${attrs.replace(/\s(?:width|height|class|data-asset|data-site-fallback)="[^"]*"/g,'')} width="${width}" height="${height}" class="ta-v09-${group}" data-asset="${group}:${id}" data-site-fallback="image-error">`);
}
function targetPath(container){
  if(container.matches?.('.ta-card-portrait[data-unit]'))return pathFor('portraits',container.getAttribute('data-unit'));
  const asset=container.getAttribute?.('data-asset')||'',colon=asset.indexOf(':');
  return colon>0?pathFor(asset.slice(0,colon),asset.slice(colon+1)):null;
}
function markupFor(container,path,temporaryFallback){
  const meta=allowed[path];
  if(temporaryFallback)placeholder.add(path);
  try{
    if(container.matches('.ta-card-portrait'))return g.TinyArmyCardArt?.portrait(meta.id,{
      condition:container.getAttribute('data-condition'),state:container.getAttribute('data-state'),
      simplified:container.getAttribute('data-simplified')==='true',
      width:size(container.getAttribute('width'),96),height:size(container.getAttribute('height'),120)});
    const opts={width:size(container.getAttribute('width'),96),height:size(container.getAttribute('height'),96)};
    if(temporaryFallback||failed.has(path))return mediaFallback(meta.group,meta.id,opts);
    return (meta.group==='events'?g.TinyArmyV09Art?.event(meta.id,opts):g.TinyArmyV09Art?.enemy(meta.id,opts))||'';
  }finally{placeholder.delete(path);}
}
function replaceArt(container,markup){
  const root=markup&&markup.match(/^<svg\b([^>]*)>([\s\S]*)<\/svg>$/);
  if(!root)return false;
  const box=root[1].match(/\bviewBox="([^"]+)"/);
  if(box)container.setAttribute('viewBox',box[1]);
  // Replace only decorative SVG descendants. The surrounding card, selection,
  // focus, scroll container and simulation are never replaced or paused.
  container.innerHTML=root[2];
  for(const name of ['data-portrait-source','data-portrait-state','data-portrait-cell']){
    const value=root[1].match(new RegExp('\\b'+name+'="([^"]*)"'));
    if(value)container.setAttribute(name,value[1]);
  }
  return true;
}
function preparationMark(container){
  if(!g.document?.createElementNS)return;
  const ns='http://www.w3.org/2000/svg',mark=g.document.createElementNS(ns,'g');
  mark.setAttribute('class','site-portrait-preparing');
  const rect=g.document.createElementNS(ns,'rect'),text=g.document.createElementNS(ns,'text');
  rect.setAttribute('x','15');rect.setAttribute('y','112');rect.setAttribute('width','90');rect.setAttribute('height','23');rect.setAttribute('rx','6');
  text.setAttribute('x','60');text.setAttribute('y','128');text.setAttribute('text-anchor','middle');text.textContent='준비 중';
  mark.appendChild(rect);mark.appendChild(text);container.appendChild(mark);
}
function paint(container){
  const path=targetPath(container);
  if(!path||!verifiedUri(path))return;
  ensurePath(path);
  const r=records.get(path),isPortrait=container.matches('.ta-card-portrait');
  const signature=[path,r.status,r.attempt,...['data-condition','data-state','data-simplified','width','height'].map(name=>container.getAttribute(name))].join('|');
  if(painted.get(container)===signature)return;
  painted.set(container,signature);
  const prior=container.getAttribute('data-site-readiness');
  // Keep already decoded original markup intact on its first observation.
  const needsReplacement=r.status!=='ready'||(prior&&prior!=='ready')||container.getAttribute('data-portrait-source')==='svg-fallback'||container.hasAttribute('data-site-fallback');
  if(needsReplacement&&!replaceArt(container,markupFor(container,path,r.status==='loading'))){painted.delete(container);return;}
  container.setAttribute('data-site-readiness',r.status);
  container.setAttribute('data-site-resource-attempt',String(r.attempt));
  if(r.status==='fallback')container.setAttribute('data-site-fallback',r.reason||'image-error');
  else container.removeAttribute('data-site-fallback');
  if(r.status==='loading'&&isPortrait)preparationMark(container);
}
function placeNotice(){
  if(!notice)return;
  const modal=g.document.getElementById?.('modal');
  const target=(modal&&!modal.hidden?modal.querySelector?.('.dialog-head'):g.document.querySelector?.('#appShell>.journey-summary'))||g.document.body;
  if(target&&notice.parentElement!==target)target.appendChild(notice);
}
function refreshNotice(){
  if(!g.document?.body||!g.document.createElement)return;
  const failures=failedDemandPaths();
  if(retryInProgress){
    if(notice){notice.hidden=false;noticeText.textContent='그림 준비 중';placeNotice();}
    return;
  }
  if(!failures.length){if(notice)notice.hidden=true;dismissedFailures='';return;}
  const key=failures.join('|');
  if(key===dismissedFailures)return;
  if(!notice){
    notice=g.document.createElement('aside');notice.id='siteResourceNotice';notice.className='site-resource-notice';
    notice.setAttribute('aria-label','그림 불러오기');
    noticeText=g.document.createElement('p');noticeText.setAttribute('role','status');noticeText.setAttribute('aria-live','polite');
    retryButton=g.document.createElement('button');retryButton.type='button';retryButton.textContent='다시 받기';retryButton.setAttribute('aria-label','원본 그림 다시 받기');
    retryButton.addEventListener('click',()=>{
      const targets=failedDemandPaths();
      retryInProgress=true;retryButton.disabled=true;noticeText.textContent='그림 준비 중';
      Promise.all(targets.map(path=>ensurePath(path,true))).then(()=>{retryInProgress=false;retryButton.disabled=false;refreshNotice();});
    });
    const close=g.document.createElement('button');close.type='button';close.className='site-resource-dismiss';close.textContent='닫기';
    close.addEventListener('click',()=>{dismissedFailures=failedDemandPaths().join('|');notice.hidden=true;});
    notice.appendChild(noticeText);notice.appendChild(retryButton);notice.appendChild(close);
  }
  noticeText.textContent='일부 그림 대체 중';
  noticeText.title='일부 원본 그림을 불러오지 못해 기본 모습을 표시했어요. 플레이는 계속할 수 있어요.';
  notice.hidden=false;placeNotice();
}
function refresh(){
  refreshQueued=false;
  g.document?.querySelectorAll?.(SELECTOR).forEach(paint);
  refreshNotice();
}
function queueRefresh(){
  if(refreshQueued||!g.document?.querySelectorAll)return;
  refreshQueued=true;Promise.resolve().then(refresh);
}
function observe(){
  if(observer||!g.document?.body)return;
  if(typeof g.MutationObserver==='function'){
    observer=new g.MutationObserver(changes=>{
      // Ignore text-only/status changes and our own SVG descendants. Newly added
      // card/portrait roots still get checked before the next browser paint.
      if(changes.some(change=>(change.type==='attributes'&&(!['hidden','data-view'].includes(change.attributeName)||['modal','appShell'].includes(change.target.id)))||Array.from(change.addedNodes||[]).some(node=>node.nodeType===1&&(node.matches?.(SELECTOR)||node.querySelector?.(SELECTOR)))))queueRefresh();
    });
    observer.observe(g.document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-unit','data-condition','data-state','data-simplified','width','height','hidden','data-view']});
  }
  queueRefresh();
}
function onImageError(event){
  const image=event.target;
  if(!image||String(image.tagName).toLowerCase()!=='image'||typeof image.getAttribute!=='function'||image.isConnected===false)return;
  const href=image.getAttribute('href'),path=paths.find(path=>href===path||href===verifiedUri(path));
  if(!path)return;
  const container=image.closest?.('.ta-card-portrait,[data-asset]');
  if(!container)return;
  const r=records.get(path);
  // The shared Image owns network/decode failures while loading. A stale SVG
  // event from a replaced attempt cannot poison a later retry.
  if(r?.status==='loading'||r?.status==='fallback')return;
  if(r&&container.getAttribute('data-site-resource-attempt')&&container.getAttribute('data-site-resource-attempt')!==String(r.attempt))return;
  if(r){r.status='fallback';r.reason='render-error';failed.add(path);r.promise=Promise.resolve(stateFor(path));publish(path);}
  else ensurePath(path);
}
if(g.document?.addEventListener){
  g.document.addEventListener('error',onImageError,true);
  for(const type of ['pointerover','pointerdown','focusin'])g.document.addEventListener(type,onPortraitIntent,{passive:true});
  if(g.document.body)observe();else g.document.addEventListener('DOMContentLoaded',observe,{once:true});
}
g.TinyArmySiteResources=Object.freeze({resolve,hasFailed,portraitFallbackType,mediaFallback,initialPortraitTypes,preparePortraits,retryPortraits,portraitState});
// Only the three camp portraits start eagerly. Others wait for use or bounded intent.
if(g.document&&typeof g.Image==='function')preparePortraits();
})(typeof window!=='undefined'?window:globalThis);
