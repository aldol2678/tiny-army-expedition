/* Tiny Army Card Art v0.8.2
 * Offline generated portrait atlases with the original SVG fallback and icons.
 * No network, fonts, emoji or third-party artwork. Decorative assets only;
 * keep names, values, selection and disabled explanations in surrounding HTML.
 * Every character is a new close-up illustration, not a scaled battle sprite.
 */
(function (global) {
  'use strict';
  const P = Object.freeze({ink:'#203548',navy:'#284456',teal:'#318d8c',mint:'#7dd5bc',cream:'#fff0cb',paper:'#fff9e7',gold:'#e4b563',orange:'#ee9861',skin:'#edba86',shade:'#bf7f59',steel:'#b8d5d5',wood:'#a37c52'});
  const TYPES = Object.freeze(['spear','archer','support','guardian','charger','sniper','volley','mage']);
  const METRICS = Object.freeze(['gold','condition','up','down','unchanged','prepared','token','hp','attack','heal','mana','training','lock']);
  const NAMES = Object.freeze({spear:'창병',archer:'궁수',support:'지원병',guardian:'방벽병',charger:'돌격병',sniper:'저격수',volley:'연사수',mage:'마법사'});
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const number = (value, fallback, min = 1, max = 4096) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const options = value => typeof value === 'number' ? {size:value} : (value || {});
  const stateOf = value => value === 'selected' ? 'selected' : (value === 'disabled' ? 'disabled' : 'normal');
  let serial = 0;
  function svg(body, width, height, box, cls, extra = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${width}" height="${height}" class="${cls}" aria-hidden="true" focusable="false" fill="none" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none" ${extra}>${body}</svg>`;
  }
  function path(d, fill = 'none', stroke = P.ink, sw = 2) { return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; }
  function rect(x,y,w,h,fill,rx=0,stroke='none',sw=2) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; }
  function circle(x,y,r,fill,stroke='none',sw=2) { return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`; }

  // Deliberately simple 24-unit silhouettes remain legible at 16, 20 and 24 px.
  const metricBodies = Object.freeze({
    gold: path('M3 13v5c0 2 3 3.5 7 3.5s7-1.5 7-3.5v-5',P.gold,P.ink,1.5) + '<ellipse cx="10" cy="13" rx="7" ry="3.5" fill="#fff0cb" stroke="#203548" stroke-width="1.5"/>' + circle(15.5,8,6,P.gold,P.ink,1.5) + path('m15.5 4.5 2.5 3.5-2.5 3.5L13 8Z',P.cream,P.ink,1.1),
    condition: path('M5 3h14v14l-7 4-7-4Z',P.cream,P.ink,1.5) + path('M8 14v2m4-6v6m4-10v10','none',P.teal,2.7),
    up: path('m4 11 8-8 8 8h-5v10H9V11Z',P.teal,P.ink,1.5) + path('M12 6v8','none',P.cream,1.5),
    down: path('m4 13 8 8 8-8h-5V3H9v10Z',P.orange,P.ink,1.5) + path('M12 10v8','none',P.cream,1.5),
    unchanged: path('M5 8h14M5 16h14','none',P.ink,3) + path('M6 8h12M6 16h12','none',P.steel,1.1),
    prepared: path('M4 22V3M5 3h15l-3 6 3 6H5',P.teal,P.ink,1.5) + path('m8 8 2.5 2.5 4.5-5','none',P.cream,2.2),
    token: path('m8 2 8 0 6 6v8l-6 6H8l-6-6V8Z',P.cream,P.ink,1.5) + path('m8 5 8 0 3 4v6l-3 4H8l-3-4V9Z',P.teal,'none') + path('m12 7 4 5-4 5-4-5Z',P.gold,P.ink,1.1),
    hp: path('M12 21C9 18 2 13 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 5-7 10-10 13Z',P.orange,P.ink,1.5)+path('M5 8q0-3 3-3','none',P.cream,1.7),
    attack: path('m8 16 11-13 3-1-1 5L10 18Z',P.steel,P.ink,1.5)+path('m5 13 7 7M3 21l5-5','none',P.ink,3)+path('m5 13 7 7','none',P.gold,1.8),
    heal: path('M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z',P.teal,P.ink,1.5)+path('M12 6v12M6 12h12','none',P.mint,1.8),
    mana: path('M12 2 21 12l-9 10-9-10Z',P.teal,P.ink,1.5)+path('M12 2v20l5-10Z',P.mint,'none')+path('m7 11 5-6','none',P.cream,1.7),
    training: path('M5 3h14v14l-7 5-7-5Z',P.cream,P.ink,1.5)+path('m8 10 4-4 4 4m-8 5 4-4 4 4','none',P.teal,2.1),
    lock: path('M7 11V7a5 5 0 0 1 10 0v4','none',P.ink,2.2)+path('M8 10V7a4 4 0 0 1 8 0v3','none',P.steel,1.2)+rect(4,10,16,12,P.cream,2,P.ink,1.5)+circle(12,15,2,P.teal,P.ink,1)+path('M12 16v3','none',P.ink,1.6)
  });
  const metricAliases = Object.freeze({coin:'gold',coins:'gold',increase:'up',decrease:'down',equal:'unchanged',same:'unchanged',ready:'prepared',tokens:'token'});
  function metric(id, opts) {
    const o=options(opts), key=metricAliases[id] || id;
    if (!own(metricBodies,key)) return '';
    const size=number(o.size,20), state=stateOf(o.state);
    return svg(`<g${state==='disabled'?' opacity=".43"':''}>${metricBodies[key]}</g>`,size,size,'0 0 24 24','ta-card-metric',`data-metric="${key}" data-state="${state}"`);
  }

  const badgeBodies=Object.freeze({
    spear: path('m8 20 8-15','none',P.cream,2) + path('m14 6 5-4-1 7Z',P.cream,P.ink,1) + path('M3 10h8v7l-4 4-4-4Z',P.gold,P.ink,1.2),
    archer: path('M8 3q14 9 0 18','none',P.gold,2.2) + path('m8 3 4 9-4 9M4 12h16','none',P.cream,1.3) + path('m18 9 4 3-4 3',P.cream,'none'),
    support: path('M5 21V3h15l-3 5 3 5H5','none',P.cream,1.8) + path('m11 6 1.5 2L15 9l-2.5 1-1.5 2-1.5-2L7 9l2.5-1Z',P.gold,'none'),
    guardian: path('m12 2 8 3v8l-8 9-8-9V5Z',P.cream,P.ink,1.3) + path('m12 5 5 2v5l-5 6-5-6V7Z',P.teal,'none') + path('M12 7v8M9 10h6','none',P.gold,1.7),
    charger: path('m6 19 13-16 2-1-1 5L9 21Z',P.cream,P.ink,1.3) + path('m4 14 8 6M3 21l4-5','none',P.gold,2.1),
    sniper: path('M5 6q13 4 14 14M5 6l14 14M3 18l17-13','none',P.cream,1.7) + path('m17 4 5-1-2 5Z',P.gold,'none') + path('m6 17 3 4','none',P.gold,2.4),
    volley: path('M5 19 9 4M10 21 14 6M15 22 19 7','none',P.cream,1.6) + path('m7 5 3-4 1 5M12 7l3-4 1 5M17 8l3-4 1 5',P.gold,'none'),
    mage: path('M10 22 15 8','none',P.gold,2.2) + path('m16 2 4 5-5 5-4-5Z',P.mint,P.cream,1.2) + path('m4 5 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z',P.cream,'none')
  });
  function badge(type, opts) {
    const o=options(opts), key=own(badgeBodies,type)?type:'spear', size=number(o.size,24), state=stateOf(o.state);
    const body=path('M3 1h18v17l-9 5-9-5Z',state==='disabled'?'#879391':P.navy,P.gold,1.2)+`<g transform="translate(2 2) scale(.83)">${badgeBodies[key]}</g>`;
    return svg(body,size,size,'0 0 24 24','ta-card-badge',`data-role="${key}" data-state="${state}"`);
  }

  function frameBody(width,height,state,quiet) {
    const edge=state==='selected'?P.teal:state==='disabled'?'#9baca4':'#8a9f91';
    let body=rect(1.5,1.5,width-3,height-3,state==='disabled'?'#e8e6d8':P.paper,11,edge,state==='selected'?3:2);
    body+=rect(5.5,5.5,width-11,height-11,'none',8,state==='selected'?P.gold:'#d8cfad',1);
    if(!quiet){
      body+=path(`M13 29V14h15M${width-28} 14h15v15M13 ${height-29}v15h15M${width-28} ${height-14}h15v-15`,'none',state==='disabled'?'#a5aea1':P.gold,2);
      body+=path(`M${width/2-12} 7h24M${width/2-8} ${height-7}h16`,'none',state==='disabled'?'#a5aea1':P.teal,2);
    }
    return body;
  }
  // Background only. State semantics and interactivity belong to the HTML card.
  // Accepts frame({state,width,height}) or frame('selected',{width,height}).
  function frame(value, opts) {
    const o=typeof value==='string'?Object.assign({},options(opts),{state:value}):options(value);
    const width=number(o.width||o.size,180,32),height=number(o.height,224,32),state=stateOf(o.state);
    return svg(frameBody(width,height,state,!!o.quiet),width,height,`0 0 ${width} ${height}`,'ta-card-frame',`data-state="${state}" preserveAspectRatio="none"`);
  }

  const face=()=>path('M37 56q-3 6-1 15c1 10 9 17 20 17 13 0 20-9 21-22l-4-18-31-4Z',P.skin)+path('M72 61l7 8-7 2',P.skin)+path('M46 73q2 3 6 3','none',P.shade,1.5)+rect(62,66,3,5,P.ink,1)+path('M62 78h6','none',P.shade,1.5)+path('M39 65q-8-7-9 2 0 8 9 8',P.skin)+path('M36 67v3','none',P.shade,1.3);
  const neck=()=>path('M45 80v12l15 6 7-8-4-12Z',P.skin);
  const torso=(fill=P.navy)=>path('M36 87q-11 4-16 24l4 32h62l1-32q-4-21-19-25l-13 9Z',fill)+path('M36 89l18 11 15-12-4 14-10 4-15-6Z',P.teal)+path('M28 122h55v9H28Z',P.cream)+rect(51,122,10,9,P.gold,1,P.ink,1.4)+rect(54,125,4,3,P.navy,.4)+path('M42 105v12M70 106v11','none','#486877',1.3);
  const helmet=(kind='normal')=>path('M32 59l3-20 16-12 19 8 9 16-1 10Z',P.teal)+path('M36 42l16-10 17 7','none',P.mint,2)+path('M31 58h48v7H33Z',P.navy)+path('M34 58h42','none',P.mint,2)+(kind==='normal'?path('m48 28 6-15 10 17Z',P.orange):'');
  const hood=()=>path('M32 69l-3-20 9-19 16-9 22 14 5 27-8-8-4-12-26-1-6 19 2 15Z',P.teal)+path('M36 46l7-12 12-7 17 11','none',P.mint,2)+path('M39 82l14 8 19-8 3 10-21 10-18-10Z',P.navy);
  const hand=(x,y)=>path(`M${x-6} ${y-5}q6-4 11 1l1 7q-5 6-11 1Z`,P.skin,P.ink,1.7);
  const sleeve=(d,fill=P.teal)=>path(d,fill);
  const spear=()=>{
    let s=path('M88 140 102 28','none',P.ink,6)+path('M88 140 102 28','none',P.wood,3)+path('m95 31 10-20 5 22-8 10Z',P.cream)+path('m105 14-3 25','none',P.steel,1.5)+path('m99 38 10 4-12 14Z',P.orange);
    s+=neck()+torso()+face()+helmet()+sleeve('M73 91q8-1 13 9l8 7-7 10-15-14Z')+hand(91,108);
    s+=path('M19 100 40 94l17 8-1 27-18 15-19-15Z',P.cream)+path('M25 105 39 101l12 5-1 20-12 11-13-11Z',P.teal)+path('M39 104v26','none',P.gold,2)+circle(39,115,3,P.gold,P.ink,1);
    return s;
  };
  const archer=()=>{
    let s=path('M22 121 15 61l14-3 15 63Z',P.wood)+path('m20 73-4-35m9 34-1-40m7 40 1-35','none',P.cream,2)+path('m12 41 3-10 4 10m1-7 4-9 3 9m1 6 5-9 2 9',P.orange,P.ink,1);
    s+=neck()+torso()+face()+hood();
    s+=sleeve('M67 90q8 3 14 12l11-9 6 10-17 14-20-16Z')+hand(94,98);
    s+=path('M90 37q36 44 1 89','none',P.ink,6)+path('M90 37q36 44 1 89','none',P.wood,3)+path('M90 38 97 82l-6 44','none',P.cream,1.7)+path('M51 84h57','none',P.ink,2.7)+path('M51 84h57','none',P.cream,1.1)+path('m105 80 9 4-9 4Z',P.cream,P.ink,1.3)+sleeve('M29 95q2-8 10-6l19 13-6 9-19-7Z')+hand(55,104);
    return s;
  };
  const support=()=>{
    let s=path('M20 140V20','none',P.ink,5)+path('M20 140V20','none',P.wood,2)+path('M22 23 63 27l-9 13 8 12-40-5Z',P.teal)+path('m40 30 3 7 8 3-8 3-3 6-3-7-8-3 8-3Z',P.cream,'none')+circle(20,18,5,P.gold,P.ink,1.5);
    s+=neck()+torso(P.teal)+path('M36 88 44 89l4 51H33Z',P.cream)+face()+path('M33 57l3-15 15-6 21 5 6 17Z',P.cream)+path('M33 56h45v8H33Z',P.navy)+path('M53 42v11m-5-6h10','none',P.teal,3)+sleeve('M31 93 22 98l-5 18 11 3 12-22Z')+hand(21,116);
    s+=path('M88 140 92 83','none',P.ink,5)+path('M88 140 92 83','none',P.gold,2.5)+path('m85 83 7 8 8-8','none',P.gold,3)+circle(93,77,9,P.mint,P.ink,2)+path('M90 74l5-3','none',P.cream,2)+sleeve('M72 93 92 102l-4 12-20-10Z')+hand(89,108)+path('M56 112h27v29H56Z',P.navy)+path('M69 119v15m-7-7h14','none',P.cream,4);
    return s;
  };
  const guardian=()=>{
    let s=neck()+torso()+path('M23 99 20 86l18-8 14 13-6 12Z',P.steel)+path('m65 88 13-10 15 11-5 16Z',P.steel)+face()+helmet('guard');
    s+=path('M42 31 38 13l13 7 5 12Z',P.orange)+path('m57 32 5-18 10 10-4 11Z',P.gold)+path('M42 59h35l-1 15-13 7-18-7Z',P.navy)+path('M48 64h23','none',P.cream,2)+path('M61 69v7','none',P.steel,1.5);
    s+=path('M23 143V94','none',P.ink,6)+path('M23 139V95','none',P.steel,3)+path('M17 116h12','none',P.gold,4)+hand(23,107);
    s+=path('M48 94 74 84l29 9 1 30-29 24-28-17Z',P.cream)+path('M55 100 75 93l21 7v20l-21 18-20-13Z',P.teal)+path('M75 95v39M59 112h32','none',P.gold,3)+circle(75,112,6,P.cream,P.ink,1.5)+path('m72 111 3-3 3 3-3 4Z',P.gold,'none');
    return s;
  };
  const charger=()=>{
    let s=path('M43 83 20 84 8 117l17-5-5 26 36-17Z',P.orange)+path('m30 92-13 24m16-17-7 25','none',P.gold,2)+neck()+torso()+path('m27 94 2-12 18-1 6 11-15 8Z',P.cream)+face()+helmet('charger');
    s+=path('M46 30 28 13l27 6 13 17Z',P.orange)+path('m40 21 16 6','none',P.gold,2)+path('M42 61h36v10H42Z',P.navy)+path('M50 65h19','none',P.cream,2);
    s+=sleeve('M69 91q9 0 13 14l9-5 6 10-18 12-15-16Z')+hand(91,108)+path('m85 106 7-6 13-39 8-10-1 17-15 35-8 9Z',P.cream)+path('m97 99 12-36','none',P.steel,2)+path('m82 99 15 10','none',P.gold,4)+path('m78 116 10-13','none',P.ink,5)+path('m78 116 10-13','none',P.wood,2);
    s+=path('m24 106 18-6 13 15-12 23-20-11Z',P.cream)+path('m29 109 11-3 8 11-8 14-12-7Z',P.orange);
    return s;
  };
  const sniper=()=>{
    let s=path('M35 81 20 98 14 140l23-6 18 10 34-8-13-43Z',P.navy)+path('m23 128-4 9 15-5','none',P.gold,2)+neck()+torso()+face()+path('M31 60 33 40l11-13 11 5 13-1 10 15-2 15Z',P.navy)+path('m51 30 9-17 10-2-5 20Z',P.steel)+path('M34 58h42','none',P.steel,3)+path('M45 77 65 82l-8 10-21-4Z',P.orange);
    s+=sleeve('M29 96q5-7 13 0l15 11-4 11-22-12Z')+sleeve('M73 94 88 108l-6 11-19-14Z')+hand(54,110)+hand(85,112);
    s+=path('m34 118 65-25','none',P.ink,7)+path('m34 118 65-25','none',P.wood,3.5)+path('m66 87 37 28','none',P.ink,5)+path('m66 87 37 28','none',P.steel,2.6)+path('m66 87 17 14 20 14','none',P.cream,1.5)+path('m52 111 54-21','none',P.cream,1.4)+path('m103 87 10 1-7 6Z',P.cream,P.ink,1.3)+path('m43 120 5 10 9-3-4-11Z',P.wood);
    return s;
  };
  const volley=()=>{
    let s=path('M24 120 16 67l15-3 12 55Z',P.wood)+path('m20 76-5-35m12 32-1-37m7 36 3-34','none',P.cream,2)+path('m11 44 4-10 4 9m3-5 4-10 3 10m4 3 4-10 2 10',P.orange,P.ink,1);
    s+=neck()+torso(P.teal)+face()+hood()+path('m41 28-2-15 9 8 2 8Z',P.cream)+path('m55 25 6-16 6 8-5 12Z',P.gold)+path('M38 83 53 90l21-7 3 10-23 9-18-9Z',P.navy);
    s+=sleeve('M68 94 87 99l6 9-10 8-21-12Z')+hand(90,106)+path('M89 40q37 40 7 90','none',P.ink,6)+path('M89 40q37 40 7 90','none',P.gold,3)+path('M89 41 98 86l-2 44','none',P.cream,1.5);
    for(const y of [79,89,99])s+=path(`M56 ${y}h51`,'none',P.ink,2.5)+path(`M56 ${y}h51`,'none',P.cream,1)+path(`m105 ${y-3} 8 3-8 3Z`,P.cream,P.ink,1);
    s+=sleeve('M30 97q4-8 12-4l17 10-6 11-22-9Z')+hand(56,106);
    return s;
  };
  const mage=()=>{
    let s=path('M43 84 24 93l-11 50h73L75 94 65 84Z',P.teal)+path('M45 84 34 141h33L61 86Z',P.navy)+path('M34 140h33','none',P.gold,3)+neck()+face()+path('M29 66 32 42 45 12l20 23 11 29-17-11-20 2-4 15Z',P.teal)+path('M35 46 45 20l15 19','none',P.gold,2.3)+path('M37 52 57 47l14 11','none',P.mint,2)+path('M42 84 54 93l14-9 3 11-17 13-16-14Z',P.teal)+path('M54 101v28','none',P.gold,2)+circle(54,110,3,P.gold,P.ink,1);
    s+=path('M91 144 96 54','none',P.ink,6)+path('M91 144 96 54','none',P.wood,3)+path('m86 47 2 13 8 6 10-9 1-13-7 9h-9Z',P.gold)+path('m96 20 11 15-11 19-10-19Z',P.mint)+path('M96 24v23','none',P.cream,2)+path('M89 35h13','none',P.teal,1.5);
    s+=sleeve('M70 94q9 0 13 12l12 2-2 12-23-7Z')+hand(93,113)+sleeve('M32 94 21 107l15 14 7-10-9-7 6-5Z')+hand(38,113)+path('m20 75 3 5 5 2-5 2-3 5-2-5-5-2 5-2Z',P.gold,'none')+path('m81 29 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z',P.cream,'none');
    return s;
  };
  const illustrators=Object.freeze({spear,archer,support,guardian,charger,sniper,volley,mage});
  const scenic=Object.freeze({
    spear: path('M13 111 30 84l14 14 22-34 34 47Z','#cbd9c4','none'),
    archer: path('M10 111 23 66l8 19 13-43 15 43 13-24 13 49Z','#c5d9c5','none'),
    support: path('M12 118V95l22-21 22 21v23M66 116V91l20-17 23 17v25','#d5d9c5','none'),
    guardian: path('M10 118V72h16V61h12v12h11v45M77 119V66h12V53h13v14h10v52','#c4d5cb','none'),
    charger: path('m10 83 41-17-29 31 42-12-30 35H10Z','#dec9a9','none'),
    sniper: path('M10 112 24 57l10 23 11-37 16 69M77 113 91 54l20 59Z','#c3d2c9','none'),
    volley: path('M11 114 26 70l11 22 17-42 21 64M79 113l16-40 15 40Z','#c7d7be','none'),
    mage: path('M12 115V91l15-12 13 12v24M75 116V74l16-17 18 17v42','#c6d6cf','none')
  });
  // These are artwork expressions, not the game's four condition mechanics bands.
  // Missing/invalid values default to fresh; finite values clamp without mutation.
  function portraitCondition(value) {
    const parsed=typeof value==='number'?value:(typeof value==='string'&&value.trim()!==''?Number(value):NaN);
    return Number.isFinite(parsed)?Math.max(0,Math.min(100,parsed)):100;
  }
  const portraitResources=new WeakMap();
  function portraitSheetUri(entry) {
    // Node/Sharp cannot resolve browser Blob URLs. Keep their standalone data URI.
    if(!global.document||!global.URL||typeof global.URL.createObjectURL!=='function'||typeof global.Blob!=='function'||typeof global.atob!=='function')return entry.dataUri;
    if(portraitResources.has(entry))return portraitResources.get(entry);
    let uri=entry.dataUri;
    try{
      const comma=uri.indexOf(','),mime=uri.slice(5,uri.indexOf(';'));
      const decoded=global.atob(uri.slice(comma+1)),bytes=new Uint8Array(decoded.length);
      for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
      const localUri=global.URL.createObjectURL(new global.Blob([bytes],{type:mime}));
      if(typeof localUri==='string'&&localUri.startsWith('blob:'))uri=localUri;
    }catch(_){
      // Unsupported resource creation must not hide otherwise valid artwork.
    }
    // Cache by immutable entry identity, so replacing a registry never reuses stale
    // image data. Keep prior URLs alive while earlier portraits may still use them;
    // document teardown owns their cleanup. Never mutate the source registry.
    portraitResources.set(entry,uri);
    return uri;
  }
  function portraitSheet(type,condition) {
    const registry=global.TinyArmyPortraitSheets,entry=registry&&registry.sheets&&registry.sheets[type];
    if(!entry||typeof entry.dataUri!=='string'||!/^data:image\/(?:webp|png);base64,/.test(entry.dataUri))return null;
    const index=condition>=75?0:condition>=25?1:2,cell=entry.cells&&entry.cells[index],view=entry.viewport;
    if(!cell||!view||![entry.width,entry.height,cell.x,cell.y,cell.width,cell.height,view.x,view.y,view.width,view.height].every(Number.isFinite))return null;
    if(entry.width<=0||entry.height<=0||cell.width<=0||cell.height<=0||view.width<=0||view.height<=0||cell.x<0||cell.y<0||cell.x+cell.width>entry.width||cell.y+cell.height>entry.height||view.x<0||view.y<0||view.x+view.width>cell.width||view.y+view.height>cell.height)return null;
    return {entry,cell,view,index,band:['fresh','tired','exhausted'][index]};
  }
  function portrait(type, opts) {
    if(!own(illustrators,type))return '';
    const o=options(opts), key=type, state=stateOf(o.state), width=number(o.width||o.size,96), height=number(o.height,width*1.25);
    const condition=portraitCondition(o.condition),atlas=portraitSheet(key,condition),id=`ta-card-clip-${++serial}`;
    let body=`<defs><clipPath id="${id}"><rect x="8" y="8" width="104" height="134" rx="5"/></clipPath>`;
    if(atlas)body+=`<clipPath id="${id}-cell" clipPathUnits="userSpaceOnUse"><rect x="${atlas.cell.x}" y="${atlas.cell.y}" width="${atlas.cell.width}" height="${atlas.cell.height}"/></clipPath>`;
    body+='</defs>';
    body+=frameBody(120,150,state,true);
    body+=`<g clip-path="url(#${id})"${state==='disabled'?' opacity=".47"':''}>`;
    body+=rect(8,8,104,134,'#e6e3c8',5)+path('M8 8h104v48L8 102Z',P.cream,'none');
    body+=path('M13 13h12v53l-6-5-6 5Z','#d2c493','none')+path('M104 8v91','none','#d0c6a5',1.2);
    body+=scenic[key]+path('M8 126q50-15 104-1v17H8Z','#c4cbb0','none');
    if(atlas){
      const {entry,cell,view}=atlas;
      // SVG cropping only: reuse one local resource per entry when supported.
      // Decoding/cache behavior is browser-dependent and remains unverified.
      // Explicit source-cell clipping prevents a neighboring expression leaking in.
      body+=`<svg x="8" y="8" width="104" height="134" viewBox="${cell.x+view.x} ${cell.y+view.y} ${view.width} ${view.height}" preserveAspectRatio="xMidYMid meet" overflow="hidden" class="ta-card-atlas"><image href="${portraitSheetUri(entry)}" x="0" y="0" width="${entry.width}" height="${entry.height}" preserveAspectRatio="none" clip-path="url(#${id}-cell)"/></svg>`;
    }else body+=`<g stroke="${P.ink}" stroke-width="2">${illustrators[key]()}</g>`;
    body+='</g>';
    body+=rect(8,8,104,134,'none',5,state==='selected'?P.gold:'#b7b796',1);
    body+=path('M10 26V10h16M94 10h16v16M10 124v16h16M94 140h16v-16','none',state==='selected'?P.gold:P.cream,2);
    if(state==='selected')body+=path('M92 5h22v22l-11-5-11 5Z',P.teal,P.ink,1.2)+path('m98 13 4 4 6-7','none',P.cream,2.2);
    return svg(body,width,height,'0 0 120 150','ta-card-portrait',`data-unit="${key}" data-state="${state}" data-condition="${condition}" data-portrait-source="${atlas?'atlas':'svg-fallback'}" data-portrait-state="${atlas?atlas.band:'fresh'}" data-portrait-cell="${atlas?atlas.index:0}" preserveAspectRatio="xMidYMid meet"`);
  }
  const api=Object.freeze({version:'0.8.2',portrait,metric,frame,badge,roleBadge:badge,types:TYPES,metricNames:METRICS,names:NAMES,palette:P});
  global.TinyArmyCardArt=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
