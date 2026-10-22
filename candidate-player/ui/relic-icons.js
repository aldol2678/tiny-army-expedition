import {RELIC_ICON_MANIFEST} from './relic-icon-manifest.js';
import {esc} from '../model/presentation.js';

// An unknown ID is deliberately a shared symbol, never invented dedicated art.
export function relicIconEntry(id){return typeof id==='string'&&Object.hasOwn(RELIC_ICON_MANIFEST,id)?RELIC_ICON_MANIFEST[id]:null;}
export function choiceRelicId(choice){const id=choice?.relic?.id??choice?.relicId;return typeof id==='string'&&id.length?id:null;}
export function relicIconMarkup(id,{host={},name=id}={}){
 const entry=relicIconEntry(id),symbol=host.TinyArmyUIArt?.icons?.relic||'<span class="relic-icon-text">유물</span>';
 return `<span class="official-relic-icon" data-relic-icon="${esc(id)}" data-relic-art="${entry?'preserved':'shared'}" data-art-status="${entry?'loading':'shared'}" aria-hidden="true"><span class="relic-icon-fallback">${symbol}<small class="relic-icon-fallback-label">공통</small></span>${entry?`<img data-relic-image="${esc(id)}" src="./${entry.file}" width="64" height="64" alt="" decoding="async" hidden>`:''}</span>`;
}

// Capture non-bubbling image events for every freshly rendered card/modal.
// This owns no game state, commands, storage, observers, or periodic work.
export function mountRelicImageFallbacks(document){
 let disposed=false;const versions=new WeakMap();
 const target=e=>{const img=e?.target;if(!img?.hasAttribute?.('data-relic-image'))return null;const box=img.closest?.('[data-relic-icon]');return box?{img,box}:null;};
 function failed(e){const t=target(e);if(!t||disposed)return;versions.set(t.img,(versions.get(t.img)||0)+1);t.img.hidden=true;t.box.dataset.artStatus='failed';}
 async function loaded(e){const t=target(e);if(!t||disposed)return;const version=(versions.get(t.img)||0)+1;versions.set(t.img,version);
  try{if(typeof t.img.decode==='function')await t.img.decode();if(!(t.img.naturalWidth>0&&t.img.naturalHeight>0))throw Error('Empty image');
   if(disposed||versions.get(t.img)!==version||t.box.isConnected===false)return;
   t.img.hidden=false;t.box.dataset.artStatus='ready';
  }catch{if(!disposed&&versions.get(t.img)===version)failed(e);}
 }
 document.addEventListener('load',loaded,true);document.addEventListener('error',failed,true);
 return Object.freeze({dispose(){if(disposed)return;disposed=true;document.removeEventListener('load',loaded,true);document.removeEventListener('error',failed,true);}});
}
