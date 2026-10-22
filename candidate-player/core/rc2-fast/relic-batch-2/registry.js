import {deepFreeze,assert} from '../relic-services/registry.js';
export const RB2_CAPABILITY='TEST_ONLY_RELIC_BATCH_RB2';
export const RB2_VERSION='relic-semantic-batch-rb2-1';
export const RB2_CHECKPOINT='relic-semantic-batch-rb2-checkpoint-1';
const d=(id,name,rarity,values,detail)=>({id,name,intrinsicRarity:rarity,values,maxEvolution:3,maxOwned:1,acquisitionEnabled:false,balanceApproved:false,detail});
export const RB2_REGISTRY=deepFreeze([
 d('quiet_column','고요한 종열','common',[.06,.08,.10],'시작 같은 열 정확히2명만 이동 +6/8/10%p, W25% 합산. 시작 배치 고정.'),
 d('sandglass_pact','모래의 계약','rare',[.08,.11,.14],'첫12초 평타 공속 +8/11/14%p, 이후 −5%p. 양수V50% 적용 뒤 비용, 기존 배율비용·둔화 유지.'),
 d('last_arrow','마지막 화살묶음','common',[.03,.04,.05],'HP30% 이하 적의 첫 적격 정상 평타 +3/4/5%p, B35%. 공격자×적1회, 공격자당 최대3적. 기술·강화·일제 제외. 적격 명중은 실드-only/포화에도 소비.'),
 d('patient_ribbon','환자 표찰','uncommon',[.06,.09,.12],'대상의 앞선 유효 정상 치유 후3초 이내 별개 치유에 N+6/9/12%p, N35%. 대상6초CD. 포화 추가0이면 CD 미소비; 유효 치유 시각은 갱신.'),
 d('guard_clock','수호의 추','uncommon',[.5,.75,1],'수호 지속 +0.5/0.75/1초, 위력×0.9. 양수 지속→기존 비용→최종CD−2초 상한.'),
 d('delayed_seal','대기 인장','rare',[.3,.5,.7],'재사용 준비 후4초 대기한 지속형 지휘의 다음 성공 시전 지속 +0.3/0.5/0.7초. 기존 지속비용·최종CD−2초 한도.'),
 d('signal_thread','신호 실','uncommon',[.04,.06,.08],'바로 앞 다른 성공 지휘 뒤3초 이내 현재 지휘 CD−4/6/8%p, 원CD 기준 C20%. 무순서 지휘쌍10초CD, 실효단축0 미소비.')
]);
export const RB2_IDS=Object.freeze(RB2_REGISTRY.map(d=>d.id));
export const RB2_BY_ID=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(RB2_REGISTRY.map(d=>[d.id,d]))));
export const isRB2=id=>typeof id==='string'&&Object.hasOwn(RB2_BY_ID,id);
export const value=(relics,id)=>{assert(isRB2(id)&&Array.isArray(relics),'Known string RB2 ID and relic array required');const r=relics.find(r=>r?.id===id);if(!r)return 0;assert(Number.isInteger(r.evolution)&&r.evolution>=1&&r.evolution<=3,'Valid RB2 tier required');return RB2_BY_ID[id].values[r.evolution-1];};
