import {escapeHtml as esc,invariant} from './data.js';
export const DETAIL_ICON_PATH='./assets/formation/detail-info.svg';
// Contract-only markup scaffold, NOT the complete official formation renderer.
// Uses existing official classes and icon. No new CSS or typography rules.
// Full official game-ui.js bytes are pinned in reference; condition gauges,
// previews, reserves and input binding remain intentionally NOT integrated.
// trustedPortrait is an injected official art renderer, never a saved/user HTML string.
export function formationComponent(view,{trustedPortrait=()=>''}={}) {
 invariant(view?.version==='official-view-1','Official view required');const f=view.formation;
 const card=(cell)=>{const u=cell.unit,selected=!!u?.selected;const description=`${cell.columnName} ${cell.row+1}번, ${u?u.name+', 컨디션 '+u.condition+'%':'빈 칸'}`;
 return `<div class="formation-card"><button type="button" class="formation-cell ${u?'occupied':''} ${selected?'selected':''}" data-action="slot" data-slot="${cell.slot}" ${u?`data-unit-id="${u.id}"`:''} ${f.editable?'':'disabled'} aria-label="${esc(description)}" aria-pressed="${selected}"><span class="slot-number">${String(cell.index+1).padStart(2,'0')}</span>${u?`<span class="unit-portrait" aria-hidden="true">${trustedPortrait(u.type,{condition:u.condition,state:selected?'selected':'normal',simplified:true})}</span><span class="cell-copy"><b>${esc(u.name)}</b><small>${esc(u.className)}</small><small class="unit-condition-value">${esc(u.condition)}%</small></span>`:'<span class="empty-cell" aria-hidden="true">+</span>'}</button>${u?`<button type="button" class="formation-detail-button" data-action="unit-detail" data-id="${u.id}" aria-label="${esc(u.name)} 상세 보기"><img class="formation-ui-icon" data-formation-icon="info" src="${DETAIL_ICON_PATH}" width="20" height="20" alt="" aria-hidden="true" draggable="false"></button>`:''}</div>`;};
 return `<div class="formation-board-note"><span>12칸 모두 배치 가능 · 출전 ${f.deployed}/${f.deploymentCap}명</span><strong>적 방향 →</strong></div><div class="formation-head"><span>후열</span><span>중열</span><span>전열</span></div><div class="formation-grid" aria-label="후열 중열 전열 각 네 칸, 전체 12칸 배치">${f.cells.map(card).join('')}</div>`;
}
export function updateOfficialHeader(document,view) {
 invariant(view?.version==='official-view-1','Official view required');
 const write=(id,value)=>{const node=document.getElementById(id);invariant(node,'Missing official element: '+id);node.textContent=value;};
 write('goldStat',String(view.header.gold));write('tokenStat',view.header.tokens===null?'—':String(view.header.tokens));
 write('stageHeading',`${view.header.chapter}장`);write('stageProgress',`${view.header.chapter}/${view.header.chapterCount}장`);
}
