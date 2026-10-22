import {invariant,immutableCopy} from './data.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Uses the original shell nodes/styles. Identity replaces mutable Campaign object identity.
export function createOfficialModal({document,getOwner,isBattle=()=>false,getPaused=()=>false,setPaused=()=>{},cancelInput=()=>{},onClose=()=>{}}) {
 const $=id=>{const n=document.getElementById(id);invariant(n,'Missing official modal node: '+id);return n;};
 const veil=$('modal'),shell=$('appShell'),title=$('modalTitle'),body=$('modalText'),notice=$('modalNotice'),buttons=$('modalButtons'),closeButton=$('dialogClose');
 let current=null,stack=[],focusBefore=null,pauseBefore=false,destroyed=false;
 const focusables=()=>[...veil.querySelectorAll('button:not([disabled]),textarea,input,[tabindex="0"]')].filter(e=>!e.hidden&&!e.disabled);
 function paint(focus=true){title.textContent=current.title;title.setAttribute('tabindex','-1');body.innerHTML=current.content();buttons.innerHTML='<button class="secondary" data-action="close">돌아가기</button>';notice.hidden=true;notice.textContent='';veil.querySelector('.dialog')?.setAttribute('data-view',current.view);if(focus){body.scrollTop=0;title.focus({preventScroll:true});}}
 function open({view,title:caption,content}) {
  invariant(!destroyed&&typeof content==='function','Trusted modal renderer required');cancelInput();
  const owner=immutableCopy(getOwner());
  if(!current){focusBefore=document.activeElement;pauseBefore=getPaused();if(isBattle())setPaused(true);}
  else if(current.view!==view)stack.push({state:current,owner:current.owner,scroll:body.scrollTop,focus:{...document.activeElement?.dataset}});
  current={view,title:caption,content,owner};veil.hidden=false;shell.inert=true;shell.setAttribute('aria-hidden','true');paint();
 }
 function close(restore=true){if(!current)return false;cancelInput();
  if(restore)while(stack.length){const saved=stack.pop();if(!same(saved.owner,getOwner()))continue;current=saved.state;paint(false);body.scrollTop=saved.scroll;const origin=[...veil.querySelectorAll('[data-action]')].find(e=>!e.disabled&&Object.keys(saved.focus).length&&Object.entries(saved.focus).every(([k,v])=>e.dataset[k]===v));(origin||title).focus({preventScroll:true});return true;}
  current=null;stack=[];veil.hidden=true;shell.inert=false;shell.removeAttribute('aria-hidden');notice.hidden=true;notice.textContent='';if(isBattle())setPaused(pauseBefore);
  if(restore)(focusBefore?.isConnected&&!focusBefore.disabled?focusBefore:document.getElementById('menuAction')||document.getElementById('campAction'))?.focus({preventScroll:true});onClose();return true;
 }
 function refresh(){if(!current)return;if(!same(current.owner,getOwner())){close(false);return;}const scroll=body.scrollTop;paint(false);body.scrollTop=scroll;}
 function keydown(event){if(!current)return;if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();close();return;}if(event.key==='Tab'){const nodes=focusables(),first=nodes[0],last=nodes.at(-1);if(!nodes.length){event.preventDefault();title.focus();return;}if(event.shiftKey&&(document.activeElement===first||document.activeElement===title)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
 function click(event){if(event.target===veil||event.target.closest?.('[data-action="close"]')){event.preventDefault();close();}}
 function closeClick(){close();}
 document.addEventListener('keydown',keydown);veil.addEventListener('click',click);closeButton.addEventListener('click',closeClick);
 return Object.freeze({open,close,refresh,isOpen:()=>!!current,state:()=>current?immutableCopy({view:current.view,owner:current.owner,depth:stack.length}):null,
  destroy(){close(false);document.removeEventListener('keydown',keydown);veil.removeEventListener('click',click);closeButton.removeEventListener('click',closeClick);destroyed=true;}
 });
}
