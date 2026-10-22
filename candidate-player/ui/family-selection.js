import {FAMILY_CATALOG,makeFamilySelection,selectedFamilySummary} from '../core/family-selection/contract.js';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Current catalog has only four playable base families. No fictitious fifth tile.
export function familySelectionInput(prefix){
 const selection=makeFamilySelection();
 return `<fieldset class="family-selection"><legend>이번 원정 기본 계열 4개</legend><p>현재 지원되는 4개 계열이 모두 자동 선택돼요. 모집과 계열 유물은 이 범위로 고정되며, 진화·각성 갈래는 별도로 세지 않아요.</p><div class="family-selection-options">${FAMILY_CATALOG.families.map(f=>`<label><input id="${esc(prefix)}-family-${esc(f.id)}" type="checkbox" checked disabled><span>${esc(f.name)}</span></label>`).join('')}</div><p class="official-private-note">공통 유물은 유지됩니다. 계열을 선택해도 현재 편성·필수 기술 등 기존 획득 조건은 그대로예요. 이후 새 직업은 해금 후 다음 새 원정의 선택 목록에 추가될 수 있어요.</p><input id="${esc(prefix)}-family-catalog" type="hidden" value="${esc(selection.catalogVersion)}"></fieldset>`;
}
export function readFamilySelection(document,prefix){
 // Inputs are disabled in this four-only shell; use the declared checked state.
 const selectedBaseFamilyIds=FAMILY_CATALOG.families.filter(f=>document.getElementById(`${prefix}-family-${f.id}`)?.hasAttribute('checked')===true).map(f=>f.id);
 return makeFamilySelection({selectedBaseFamilyIds}).selectedBaseFamilyIds;
}
export function familySelectionSummaryMarkup(run){
 const summary=selectedFamilySummary(run?.familySelection);
 return `<p class="official-private-note">${esc(summary.label)}${summary.families.length?`: ${summary.families.map(f=>esc(f.name)).join(' · ')}. 원정 중에는 변경되지 않아요.`:'. 다음 새 원정부터 기본 계열 선택이 적용돼요.'}</p>`;
}
