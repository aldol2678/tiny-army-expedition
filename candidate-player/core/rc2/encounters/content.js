// Reconstructed from retained implementation tool history. Production tables are not mutated.
export const ENCOUNTER_PROFILE = 'five-chapter-encounters-p0-1';
export const ENCOUNTER_VERSION = 'encounter-status-patterns-1';
export const TICKS_PER_SECOND = 60;
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const PATTERNS = freeze({
  narrow: { name:'좁은 각인', icon:'single-ring', shape:'circle', radius:75, range:150, announce:72, cast:24, pulses:[0], recovery:108, coefficient:.65 },
  wide: { name:'넓은 각인', icon:'double-ring', shape:'circle', radius:140, range:150, announce:138, cast:30, pulses:[0], recovery:180, coefficient:1.3 },
  slam: { name:'성문 강타', icon:'crown-ring', shape:'circle', radius:135, range:150, announce:120, cast:30, pulses:[0], recovery:150, coefficient:1.25 },
  tired: { name:'지친 반격', icon:'broken-weapon', shape:'circle', radius:75, range:150, announce:84, cast:24, pulses:[0], recovery:180, coefficient:.6 },
  volley: { name:'호위 일제', icon:'fan-three-ticks', shape:'cone', radius:230, halfAngle:.33, range:220, announce:90, cast:30, pulses:[0,18,36], recovery:180, coefficient:1.2 },
  healing_curse: { name:'회복 저주', icon:'broken-cross', shape:'target', radius:0, range:220, announce:96, cast:24, pulses:[0], recovery:150, coefficient:.3, status:{type:'healing_curse',magnitude:.25,durationTicks:240} },
  weakness: { name:'쇠약', icon:'broken-sword', shape:'target', radius:0, range:220, announce:96, cast:24, pulses:[0], recovery:150, coefficient:.3, status:{type:'weakness',magnitude:.15,durationTicks:240} },
});
const ENEMY_TYPES = { raider:'raider', swarm:'swarm', armored:'armored', bow:'bow', brute:'brute', boss:'boss', ruin_smasher:'brute', volley_archer:'bow', blackmage:'bow' };
const group = (...pairs) => pairs.flatMap(([role,count]) => Array.from({length:count},()=>({type:ENEMY_TYPES[role],role})));
const row = (id,name,enemies,question) => ({id,name,enemies,question});
export const CHAPTER_PROFILES = freeze({
  1:{ name:'바람잎 평원',boss:'평원의 파수꾼',cycle:960,
    normal:[row('leaf-road','풀잎 길목',group(['raider',2],['bow',1]),'전열이 공격할 시간을 만듭니다.'),row('wind-hill','바람의 둔덕',group(['swarm',6],['bow',2]),'넓은 시작 전열과 작은 적 정리.')],
    elite:row('hill-encirclement','언덕 포위대',group(['brute',1],['swarm',6],['bow',2]),'강타 이후 회복 공백.'),
    final:row('plains-sentinel','평원의 파수꾼',group(['boss',1],['armored',1],['swarm',4],['bow',2]),'큰 원 다음 작은 원.'),
    bossOrder:[['boss','slam'],['boss','narrow']] },
  2:{name:'잿빛 철성',boss:'철성의 문지기',cycle:1080,
    normal:[row('outer-fortress','철성 외곽',group(['armored',2],['raider',1],['bow',3]),'철갑 뒤 사격.'),row('rotating-volley','교대 사격진',group(['brute',1],['volley_archer',2],['swarm',4]),'일제 뒤 재장전 공백.')],
    elite:row('double-gate','이중 성문',group(['brute',2],['armored',2],['bow',3]),'강타가 한 번씩 순서대로 옵니다.'),
    final:row('iron-gatekeeper','철성의 문지기',group(['boss',1],['brute',1],['armored',2],['volley_archer',2]),'강타 다음 호위 일제.'),
    bossOrder:[['boss','slam'],['volley_archer','volley']] },
  3:{name:'잊힌 유적길',boss:'봉인의 기록관',cycle:1440,
    normal:[row('cracked-stone','갈라진 석로',group(['ruin_smasher',1],['swarm',5],['bow',1],['blackmage',1]),'회복 저주는 4초 뒤 만료됩니다. 정화 없이도 보호·집중·버티기로 대응.'),row('seal-caravan','봉인 운반대',group(['armored',2],['ruin_smasher',1],['volley_archer',1],['blackmage',1]),'쇠약은 피해만 줄이고 치유와 방벽은 줄이지 않습니다.')],
    elite:row('ruin-guard','유적 수호대',group(['ruin_smasher',2],['armored',1],['swarm',4],['blackmage',1]),'저주와 강타는 동시에 발동하지 않습니다.'),
    final:row('seal-archivist','봉인의 기록관',group(['boss',1],['ruin_smasher',1],['volley_archer',1],['blackmage',1],['swarm',4]),'작은 원 다음 큰 원. 저주 시전자 제거도 대안입니다.'),
    bossOrder:[['boss','narrow'],['blackmage','healing_curse'],['boss','wide'],['ruin_smasher','narrow'],['volley_archer','volley']] },
  4:{name:'깨어난 성채',boss:'깨어난 성주',cycle:1440,
    normal:[row('citadel-courtyard','성채 시험마당',group(['armored',1],['ruin_smasher',1],['swarm',4],['bow',2]),'기본 기술부터 확인. 궁극 없는 대응도 가능합니다.'),row('broken-corridor','깨진 회랑',group(['volley_archer',1],['brute',1],['swarm',5],['blackmage',1]),'사격 다음 강타. 큰 자원 뒤에도 기본 기술을 유지.')],
    elite:row('awakened-watch','각성 감시대',group(['ruin_smasher',1],['brute',1],['volley_archer',1],['armored',1],['blackmage',1]),'예고는 하나씩. 회복과 보호를 나누어 사용.'),
    final:row('awakened-lord','깨어난 성주',group(['boss',1],['volley_archer',2],['armored',1],['swarm',4]),'강타 → 일제 → 지친 반격.'),
    bossOrder:[['boss','slam'],['volley_archer','volley'],['boss','tired']] },
  5:{name:'마지막 방어선',boss:'최후의 파수군주',cycle:1440,
    normal:[row('last-blockade','잔병 차단선',group(['swarm',6],['ruin_smasher',1],['volley_archer',1],['blackmage',1]),'익숙한 저주·강타·사격을 순서대로 대응.'),row('last-gate','마지막 성문',group(['armored',2],['brute',2],['volley_archer',1]),'두 강타가 번갈아 옵니다.')],
    elite:row('throne-siege','왕좌 포위망',group(['ruin_smasher',1],['volley_archer',1],['blackmage',1],['swarm',6],['armored',1]),'시전자 제거가 끝까지 유지됩니다. 재소환 없음.'),
    final:row('final-sentinel','최후의 파수군주',group(['boss',1],['ruin_smasher',1],['volley_archer',2],['swarm',4]),'강타 → 일제 → 각인. HP 단계는 순서만 변경.'),
    bossOrder:[['boss','slam'],['volley_archer','volley'],['boss','narrow'],['ruin_smasher','narrow']] },
});
export function createEncounter(chapter,node={}) {
  if (!Number.isInteger(chapter)||!CHAPTER_PROFILES[chapter]) throw new Error('Chapter must be 1..5');
  if (!['normal','elite','boss'].includes(node.kind)) throw new Error('Encounter kind must be normal, elite or boss');
  if (!Number.isInteger(node.row)||node.row<1||node.row>7) throw new Error('Encounter row must be 1..7');
  const p=CHAPTER_PROFILES[chapter],variant=(node.row-1)%2,template=node.kind==='boss'?p.final:node.kind==='elite'?p.elite:p.normal[variant];
  let order=node.kind==='boss'?p.bossOrder:chapter===3&&variant===0&&node.kind==='normal'?[['blackmage','healing_curse'],['ruin_smasher','narrow'],['ruin_smasher','wide']]:[['volley_archer','volley'],['blackmage',variant?'weakness':'healing_curse'],['ruin_smasher','narrow'],['brute','narrow'],['ruin_smasher','wide'],['brute','wide']];
  const roles=new Set(template.enemies.map(e=>e.role));order=order.filter(([role])=>roles.has(role));
  return JSON.parse(JSON.stringify({id:`v10-c${chapter}-${template.id}`,name:template.name,description:template.question,chapter,kind:node.kind,row:node.row-1,scale:1,enemies:template.enemies,
    profile:ENCOUNTER_PROFILE,contentVersion:ENCOUNTER_VERSION,chapterName:p.name,bossName:p.boss,
    mechanics:{openingTicks:chapter===4&&variant===0&&node.kind==='normal'?360:240,gapTicks:120,minimumCycleTicks:p.cycle,order,phaseThresholds:node.kind==='boss'?chapter===5?[.6,.3]:chapter===4?[.5]:chapter===2?[.6]:[]:[],maximumConcurrentShapes:1,maximumStatusTargets:1,noReinforcements:true},
    counterplay:['정상 사거리 안 시전자 집중 제거','피해 보호막·지휘 수호와 만료까지 버티기','소수 대상 정화 또는 유한 예방은 선택적 대안'],
    balanceStatus:'P0_LOCAL_IMPLEMENTED_NOT_RELEASE_BALANCED',requiresClasses:[],requiresRelics:[],requiresUltimate:false}));
}
