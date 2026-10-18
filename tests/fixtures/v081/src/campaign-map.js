/* Versioned, reward-RNG-independent campaign maps. */
(() => {
'use strict';
const LEGACY='v05-fixed-1', CURRENT='v08-seeded-1';
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
const TEMPLATES={braid:[[[0,1],[0,1,2],[1,2]]],fork:[[[0,1],[0,1,2],[1,2]],[[0],[0,1,2],[2]]],weave:[[[0,1],[1,2],[2]],[[0],[0,1],[1,2]]]};
function create(seed,{version=CURRENT}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid map seed');
 if(![LEGACY,CURRENT].includes(version))throw new Error('Unsupported map version');
 const nodes=globalThis.TinyArmyLegacyCampaign.createMap(seed);
 if(version===LEGACY)return{nodes,templateIds:['fixed','fixed']};
 const templateIds=[];
 for(let chapter=1;chapter<=2;chapter++){
  const key=Object.keys(TEMPLATES)[hash(`${seed}:chapter:${chapter}:topology`)%3],mirror=!!(hash(`${seed}:chapter:${chapter}:mirror`)%2);templateIds.push(key+(mirror?'-mirror':''));
  const rows=Array.from({length:9},(_,row)=>nodes.filter(n=>n.chapter===chapter&&n.row===row));
  for(let row=0;row<7;row++)for(const n of rows[row]){const lane=mirror?2-n.lane:n.lane,targets=TEMPLATES[key][row%TEMPLATES[key].length][lane];n.next=targets.map(l=>mirror?2-l:l).sort().map(l=>`c${chapter}-r${row+1}-l${l}`)}
  for(const row of [1,3,5]){const types=['rest','shop','event'];let state=hash(`${seed}:${chapter}:${row}:types`);for(let i=2;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[types[i],types[j]]=[types[j],types[i]]}rows[row].forEach((n,l)=>setType(n,types[l],seed));}
  for(const row of [2,4,6]){rows[row].forEach(n=>setType(n,'normal',seed));const eligible=rows[row].filter(candidate=>rows[row-1].every(prev=>prev.next.some(id=>id!==candidate.id)));if(eligible.length){const elite=eligible[hash(`${seed}:${chapter}:${row}:elite`)%eligible.length];setType(elite,'elite',seed)}}
 }
 return{nodes,templateIds};
}
function setType(n,type,seed){
 const content=globalThis.TinyArmyLegacyCampaign.content;
 const battle=['normal','elite','boss'].includes(type);n.type=type;n.name={normal:'일반 전투',elite:'정예 전투',boss:'장 보스',rest:'야영지',shop:'여행 상인',event:'길 위의 만남'}[type];
 n.description=battle?(type==='elite'?'위험한 적 · 더 좋은 보상 · 컨디션 소모 8':type==='boss'?'장을 마무리하는 보스 · 컨디션 소모 10':'기본 성장 보상 · 컨디션 소모 4'):type==='rest'?'컨디션 회복 또는 다음 전투 준비':type==='shop'?'고정 재고 · 골드를 모아 필요한 것을 구매':'비용과 결과를 보고 하나를 선택';
 n.encounter=battle?{...clone(content.getEncounter(n.chapter,n.row,type,hash(`${seed}:${n.id}`)%3)),chapter:n.chapter,row:n.row,nodeType:type}:null;
 n.eventId=type==='event'?content.EVENTS[(n.chapter+n.lane)%2].id:null;n.conditionCost=battle?content.CONDITION.loss[type]:0;
}
function validate(nodes,{seed,version=CURRENT,templateIds}={}){try{
 const expected=create(seed,{version});
 if(JSON.stringify(templateIds)!==JSON.stringify(expected.templateIds)||!Array.isArray(nodes)||nodes.length!==50)return{valid:false,error:'지도 버전 또는 템플릿이 올바르지 않습니다.'};
 const seen=new Set();for(const n of nodes){if(!n||seen.has(n.id))throw Error();seen.add(n.id);const e=expected.nodes.find(x=>x.id===n.id);if(!e||['id','chapter','row','lane','type','eventId','conditionCost'].some(k=>n[k]!==e[k])||JSON.stringify(n.next)!==JSON.stringify(e.next))throw Error()}
 return{valid:true};
 }catch(_){return{valid:false,error:'시드와 지도 경로가 일치하지 않습니다.'}}}
 globalThis.TinyArmyMap=Object.freeze({create,validate,LEGACY,CURRENT});
})();
