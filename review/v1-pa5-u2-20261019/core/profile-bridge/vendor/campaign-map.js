/* Versioned, reward-RNG-independent campaign maps. */
(() => {
'use strict';
const LEGACY='v05-fixed-1', PREVIOUS='v08-seeded-1', CURRENT='v082-events-1', V09='v09-operations-1';
// Pinned to this map version; catalog growth must use another map version.
const EVENT_IDS=Object.freeze(['supply_cart','watchtower','field_infirmary','guide_camp','abandoned_cache','roadside_kitchen']);
const clone=x=>JSON.parse(JSON.stringify(x));
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0}
const TEMPLATES={braid:[[[0,1],[0,1,2],[1,2]]],fork:[[[0,1],[0,1,2],[1,2]],[[0],[0,1,2],[2]]],weave:[[[0,1],[1,2],[2]],[[0],[0,1],[1,2]]]};
function create(seed,{version=CURRENT}={}){
 if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Invalid map seed');
 if(version===V09)return createOperations(seed);
 if(![LEGACY,PREVIOUS,CURRENT].includes(version))throw new Error('Unsupported map version');
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
 if(version===CURRENT){
  // An isolated stream shuffles the six encounters once. No offers/combat RNG is read.
  const events=EVENT_IDS.slice();let state=hash(`${seed}:v082:events`);
  for(let i=events.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[events[i],events[j]]=[events[j],events[i]]}
  nodes.filter(n=>n.type==='event').forEach((n,index)=>{n.eventId=events[index]});
 }
 return{nodes,templateIds};
}
// New maps are opt-in. Existing CURRENT and every legacy generator remain unchanged.
const OP_ROUTES=Object.freeze([
 {id:'supply',name:'보급로 지원',types:['normal','shop'],risk:'보통',summary:'병력 성장 뒤 행상인에게서 필요한 것을 구매합니다.'},
 {id:'recovery',name:'야영지 확보',types:['normal','rest'],risk:'보통',summary:'전투를 치른 뒤 컨디션을 정비합니다.'},
 {id:'forge',name:'장비 정비',types:['normal','forge'],risk:'보통',summary:'성장 기회를 얻고 보유 유물의 진화를 준비합니다.'},
 {id:'ruins',name:'폐허 탐사',types:['event','elite'],risk:'높음',summary:'사건의 결과를 감수하고 정예전에 도전합니다.'},
 {id:'scout',name:'길잡이 동행',types:['normal','event'],risk:'보통',summary:'전투 뒤 길 위의 만남에서 비용과 보상을 선택합니다.'},
 {id:'assault',name:'전초기지 돌파',types:['elite','shop'],risk:'높음',summary:'정예를 돌파한 뒤 획득한 골드로 군단을 보완합니다.'}
]);
function createOperations(seed){
 const C=globalThis.TinyArmyLegacyCampaign?.content||globalThis.TinyArmyContent;
 if(!C||typeof C.getEncounter!=='function')throw new Error('Campaign content must be loaded before operations maps');
 const nodes=[],templateIds=[];
 const names={normal:'일반 전투',elite:'정예 전투',boss:'장 보스',rest:'야영지',shop:'행상인',event:'길 위의 만남',forge:'대장간',checkpoint:'합류 지점'};
 const loss={normal:4,elite:8,boss:10};
 const make=(chapter,row,lane,id,type,next,operation)=>{
  const battle=Object.hasOwn(loss,type),difficultyRow=type==='boss'?8:Math.min(6,Math.floor(row/3)*2+(row%3===1?2:0));
  const variant=hash(`${seed}:${id}:encounter`)%3;
  const encounter=battle?{...clone(C.getEncounter(chapter,difficultyRow,type,variant)),chapter,row:difficultyRow,nodeType:type}:null;
  if(encounter){encounter.tip=type==='boss'?'적의 강타 예고와 아군 체력을 확인하고 지휘 기술을 사용하세요.':type==='elite'?'적의 방어력과 공격 대상을 확인해 편성과 기술을 준비하세요.':'전열과 후열의 역할, 병종 시너지와 인접 보호를 확인하세요.';encounter.description=type==='boss'?'지역을 지키는 강적과 호위 병력이 마지막 전투를 준비합니다.':type==='elite'?'강한 적을 상대하는 작전입니다. 전투 위험과 성장 기회를 함께 비교하세요.':'작전 경로를 지키는 적과 맞섭니다. 군단 상태에 맞는 편성을 준비하세요.';}
  const eventId=type==='event'?EVENT_IDS[hash(`${seed}:${id}:event`)%EVENT_IDS.length]:null;
  return {id,chapter,row,lane,type,name:names[type],description:type==='checkpoint'?'보상이나 자동 회복 없이 군단을 정리하고 다음 작전을 선택합니다.':type==='forge'?'골드를 써서 보유 유물을 진화시킵니다. 효과와 비용을 확인하세요.':type==='rest'?'컨디션 회복 또는 다음 전투 준비를 선택합니다.':type==='shop'?'잔액과 재고를 확인하고 필요한 상품을 구매합니다.':type==='event'?'비용과 실제 결과를 보고 선택합니다.':`${names[type]} · 컨디션 기본 소모 ${loss[type]}`,next,encounter,eventId,conditionCost:loss[type]||0,operation:operation||null};
 };
 for(let chapter=1;chapter<=2;chapter++){
  const choices=[];
  for(let segment=0;segment<3;segment++){
   let pair;
   if(segment===0)pair=[OP_ROUTES[0],OP_ROUTES[1]];
   else if(segment===1)pair=[OP_ROUTES[2],OP_ROUTES[hash(`${seed}:${chapter}:risk-route`)%2?3:5]];
   else pair=[OP_ROUTES[4],OP_ROUTES[hash(`${seed}:${chapter}:last-service`)%2?0:5]];
   if(hash(`${seed}:${chapter}:${segment}:order`)%2)pair=pair.slice().reverse();
   choices.push(pair.map(r=>r.id).join('-'));
   const checkpoint=`c${chapter}-o${segment}-checkpoint`;
   for(let branch=0;branch<2;branch++){
    const route=pair[branch],base=segment*3;
    const operation={id:`c${chapter}-o${segment}-b${branch}`,segment,branch,title:route.name,name:route.name,routeId:route.id,serviceTypes:route.types.slice(),risk:route.risk,summary:route.summary,checkpointId:checkpoint,stopCount:2};
    for(let stop=0;stop<2;stop++){
     const id=`${operation.id}-s${stop}`,next=[stop===0?`${operation.id}-s1`:checkpoint];
     nodes.push(make(chapter,base+stop,branch===0?0:2,id,route.types[stop],next,{...operation,stopIndex:stop}));
    }
   }
   const next=segment<2?[`c${chapter}-o${segment+1}-b0-s0`,`c${chapter}-o${segment+1}-b1-s0`]:[`c${chapter}-boss`];
   nodes.push(make(chapter,segment*3+2,1,checkpoint,segment===2?'rest':'checkpoint',next,null));
  }
  nodes.push(make(chapter,9,1,`c${chapter}-boss`,'boss',chapter<2?[`c${chapter+1}-o0-b0-s0`,`c${chapter+1}-o0-b1-s0`]:[],null));
  templateIds.push(`operations:${choices.join('|')}`);
 }
 return {nodes,templateIds};
}
function validateOperations(nodes,{seed,templateIds}={}){
 try{
  const expected=createOperations(seed);
  if(!Array.isArray(nodes)||nodes.length!==32||JSON.stringify(templateIds)!==JSON.stringify(expected.templateIds))throw Error();
  for(let i=0;i<nodes.length;i++){
   const n=nodes[i],e=expected.nodes[i];
   if(!n||typeof n!=='object'||Array.isArray(n))throw Error();
   for(const key of Object.keys(e))if(JSON.stringify(n[key])!==JSON.stringify(e[key]))throw Error();
   if(Object.keys(n).some(key=>!Object.hasOwn(e,key)))throw Error();
  }
  return {valid:true};
 }catch(_){return {valid:false,error:'작전 경로가 시드 또는 지도 버전과 일치하지 않습니다.'};}
}
function setType(n,type,seed){
 const content=globalThis.TinyArmyLegacyCampaign.content;
 const battle=['normal','elite','boss'].includes(type);n.type=type;n.name={normal:'일반 전투',elite:'정예 전투',boss:'장 보스',rest:'야영지',shop:'여행 상인',event:'길 위의 만남'}[type];
 n.description=battle?(type==='elite'?'위험한 적 · 더 좋은 보상 · 컨디션 소모 8':type==='boss'?'장을 마무리하는 보스 · 컨디션 소모 10':'기본 성장 보상 · 컨디션 소모 4'):type==='rest'?'컨디션 회복 또는 다음 전투 준비':type==='shop'?'고정 재고 · 골드를 모아 필요한 것을 구매':'비용과 결과를 보고 하나를 선택';
 n.encounter=battle?{...clone(content.getEncounter(n.chapter,n.row,type,hash(`${seed}:${n.id}`)%3)),chapter:n.chapter,row:n.row,nodeType:type}:null;
 n.eventId=type==='event'?content.EVENTS[(n.chapter+n.lane)%2].id:null;n.conditionCost=battle?content.CONDITION.loss[type]:0;
}
function validate(nodes,{seed,version=CURRENT,templateIds}={}){try{
 if(version===V09){if(!Number.isInteger(seed)||seed<0||seed>4294967295)return{valid:false,error:'올바르지 않은 시드입니다.'};return validateOperations(nodes,{seed,templateIds});}
 const expected=create(seed,{version});
 if(JSON.stringify(templateIds)!==JSON.stringify(expected.templateIds)||!Array.isArray(nodes)||nodes.length!==50)return{valid:false,error:'지도 버전 또는 템플릿이 올바르지 않습니다.'};
 const seen=new Set();for(const n of nodes){if(!n||seen.has(n.id))throw Error();seen.add(n.id);const e=expected.nodes.find(x=>x.id===n.id);if(!e||['id','chapter','row','lane','type','eventId','conditionCost'].some(k=>n[k]!==e[k])||JSON.stringify(n.next)!==JSON.stringify(e.next))throw Error()}
 return{valid:true};
 }catch(_){return{valid:false,error:'시드와 지도 경로가 일치하지 않습니다.'}}}
 globalThis.TinyArmyMap=Object.freeze({create,validate,LEGACY,PREVIOUS,CURRENT,V09,EVENT_IDS,OP_ROUTES});
})();
