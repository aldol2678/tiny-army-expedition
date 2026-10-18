/* Tiny Army Screen Art 0.5.1 — original, offline SVG illustrations.
 * Screen scenery and landmarks, not gameplay. No network, timers, DOM mutations,
 * randomness, global SVG IDs, font assets, or dependencies. Text stays in HTML.
 * Keep a visible label on controls: all art is decorative unless options.label
 * is supplied. Repeated inline assets are safe and cannot collide through IDs. */
(function (global) {
  'use strict';
  const C = Object.freeze({ ink:'#203548',navy:'#284456',dark:'#172b3b',teal:'#318d8c',mint:'#7dd5bc',cream:'#fff0cb',pale:'#fff9e7',skin:'#edba86',orange:'#ee9861',gold:'#f6c772',rust:'#bc5953',wine:'#673b4e',steel:'#b8d5d5',wood:'#a37c52',grass:'#a5c9aa' });
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sizeOf = (n, fallback) => Number.isFinite(Number(n)) && Number(n)>0 ? Math.min(2400,Math.max(8,Number(n))) : fallback;
  const path = (d,fill=C.teal,stroke=C.ink,width=2.6,extra='') => `<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''}${extra?` ${extra}`:''}/>`;
  const line = (d,stroke=C.ink,width=2.6,extra='') => path(d,'none',stroke,width,extra);
  const circle = (x,y,r,fill,stroke='',width=2.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''}/>`;
  const ellipse = (x,y,rx,ry,fill,extra='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
  const rect = (x,y,w,h,r,fill,stroke=C.ink,width=2.6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}"`:''}/>`;
  const group = (content,transform,extra='') => `<g${transform?` transform="${transform}"`:''}${extra?` ${extra}`:''}>${content}</g>`;
  const sparkle = (x,y,r=5,fill=C.gold) => path(`M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}Z`,fill,'');
  function svg(content,w,h,size,classes,options={}) {
    const width=sizeOf(size,w),label=options&&options.label;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${width}" height="${Math.round(width*h/w*100)/100}" class="ta-screen-art ${classes}" ${label?`role="img" aria-label="${escape(label)}"`:'aria-hidden="true"'} focusable="false" overflow="hidden" fill="none" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  }
  function tree(x=0,y=0,s=1,tone=C.teal) {
    return group(ellipse(0,5,14,4,'#203548', 'opacity=".1"')+line('M0 1V-18',C.wood,5)+path('M0-48-15-25h7l-12 18Q0 0 20-7L8-25h7Z',tone,C.ink,2)+path('M0-44v31l12 3-9-17h5Z',C.mint,'',0,'opacity=".45"')+line('M-6-23 0-20 5-23',C.cream,1.4),`translate(${x} ${y}) scale(${s})`);
  }
  function rock(x,y,s=1,tone=C.steel) {
    return group(path('M-12 3-8-7 1-11 11-5 14 3Z',tone,C.ink,1.6)+path('M-8-7 1-11 3-3-12 3Z',C.pale,'',0,'opacity=".4"'),`translate(${x} ${y}) scale(${s})`);
  }
  function pennant(x,y,s=1,color=C.teal) {
    return group(line('M0 36V-11',C.ink,3.4)+path('M0-8h27l-6 10 6 10H0Z',color,C.ink,2.5)+path('m11-3 3 5 5 2-5 2-3 5-2-5-5-2 5-2Z',C.cream,'')+circle(0,-12,3.4,C.gold,C.ink,2),`translate(${x} ${y}) scale(${s})`);
  }
  function shield(x=0,y=0,s=1,color=C.teal) {
    return group(path('m24 3 19 7-2 23C38 42 31 48 24 52 17 48 10 42 7 33L5 10Z',C.cream)+path('m24 10 12 5-2 16c-1 5-5 10-10 14-5-4-9-9-10-14l-2-16Z',color,'')+line('M24 16v21m-8-13h16',C.gold,3)+circle(24,24,3,C.pale,C.ink,1.5),`translate(${x} ${y}) scale(${s})`);
  }
  function sword(x=0,y=0,s=1,angle=0) {
    return group(path('M0 7-5 2-5-25 0-35 5-25 5 2Z',C.steel)+path('M0-32V4L4 0v-25Z',C.pale,'')+line('M0 8v13',C.wood,5)+line('M-9 5H9',C.gold,5)+circle(0,16,3.1,C.gold,C.ink,1.6),`translate(${x} ${y}) rotate(${angle}) scale(${s})`);
  }
  function helmet(x=0,y=0,s=1,elite=false) {
    return group(path('M23 12 18 2l9-1 8 12',elite?C.gold:C.orange)+path('M8 40V24C8 7 40 6 42 25v15l-10 7H18Z',elite?C.wine:C.teal)+path('M8 30h34v10l-10 7H18Z',C.navy)+path('M13 26c2-10 8-13 15-13',C.mint,'')+line('M14 32h10m8 0h5',C.cream,3)+path('M25 27h5v20h-5Z',C.steel,C.ink,1.5)+(elite?path('M10 23 1 11l2 17 9 6m28-11 9-12-2 17-9 6',C.gold,C.ink,2.3):''),`translate(${x} ${y}) scale(${s})`);
  }
  function chest(open=false) {
    const lid=open?path('M19 43V26q0-10 10-10h36q10 0 10 10v7L22 48Z',C.orange)+path('M23 30v-4q0-6 6-6h36q6 0 6 6v4Z',C.cream,C.ink,2)+path('M23 34h48L23 44Z',C.wood,C.ink,2):path('M17 47V34q0-12 12-12h38q12 0 12 12v13Z',C.orange)+path('M23 37v-3q0-7 7-7h36q7 0 7 7v3Z',C.gold,'');
    return ellipse(48,79,35,6,'#203548','opacity=".13"')+(open?path('m25 50-8-25 18 11L48 8l13 28 18-11-8 25',C.gold,'',0,'opacity=".35"'):'')+lid+path('M17 44h62v25q0 6-6 6H23q-6 0-6-6Z',C.wood)+path('M17 44h62v12H17Z',C.orange)+path('M26 45h7v29h-7m30-29h7v29h-7',C.gold,C.ink,1.8)+rect(40,45,16,18,3,C.gold,C.ink,2)+circle(48,52,2.7,C.ink)+line('M48 54v4',C.ink,2.5)+(open?sparkle(23,15,6,C.cream)+sparkle(77,10,4,C.gold)+circle(36,41,6,C.gold,C.ink,1.6)+circle(57,38,7,C.gold,C.ink,1.6):'');
  }
  function tent() {
    return ellipse(46,80,39,6,'#203548','opacity=".12"')+line('M43 20V7',C.wood,3)+path('M44 9h20l-4 5 4 6H44Z',C.orange,C.ink,1.8)+path('M42 24 77 28 92 74H66Z',C.teal)+path('M42 24 8 74h58Z',C.cream)+path('M42 36 23 74h32Z',C.navy)+path('M42 36 33 73H23Z',C.mint,'')+path('M42 36 55 74H43Z',C.teal,'')+line('M16 70 10 80m51-10 7 10m20-10 5 10',C.wood,2.5)+line('M44 25 63 68',C.pale,2.2);
  }
  function fire(x=0,y=0,s=1) {
    return group(ellipse(0,13,16,4,C.ink,'opacity=".12"')+line('M-10 11 10 6m-20 0 20 5',C.ink,6)+line('M-10 11 10 6m-20 0 20 5',C.wood,3)+path('M0-24C-1-10-15-8-10 3-7 12 8 11 12 1c2-6-3-11-5-15-1 8-5 8-7-10Z',C.orange,C.ink,2)+path('M0-6C1 0-5 1-4 6c1 5 9 3 9-1 0-5-3-5-5-11Z',C.gold,''),`translate(${x} ${y}) scale(${s})`);
  }
  function shop() {
    return ellipse(48,82,39,6,C.ink,'opacity=".13"')+rect(17,32,62,36,3,C.wood)+rect(19,34,58,22,1,C.navy)+path('M13 32 22 14h51l10 18Z',C.cream)+path('M22 14h10l-5 18H13m30-18h10v18H40m23-18h10l10 18H68',C.teal,C.ink,2)+path('M13 32h14v6q-7 7-14 0Zm14 0h13v6q-6 7-13 0Zm13 0h14v6q-7 7-14 0Zm14 0h14v6q-7 7-14 0Zm14 0h15v6q-7 7-15 0Z',C.cream,C.ink,2)+path('M13 32h14v6q-7 7-14 0Zm27 0h14v6q-7 7-14 0Zm28 0h15v6q-7 7-15 0Z',C.teal,C.ink,2)+rect(12,55,72,10,2,C.orange)+line('M24 68h49',C.ink,4)+circle(27,73,8,C.navy,C.ink,2)+circle(69,73,8,C.navy,C.ink,2)+circle(27,73,3,C.gold)+circle(69,73,3,C.gold)+rect(26,46,12,9,2,C.gold,C.ink,1.5)+path('M52 44h11l4 11H48Z',C.mint,C.ink,1.5)+line('M57 43v-5',C.wood,2)+circle(74,9,3,C.gold,C.ink,1.4);
  }
  function castle(boss=false) {
    const stone=boss?'#8d899b':C.steel, roof=boss?C.wine:C.teal;
    return ellipse(48,82,39,6,C.ink,'opacity=".13"')+path('M14 79V38h19v-9h30v9h19v41Z',stone)+path('M10 38V25h8v6h8v-6h9v13m26 0V25h9v6h8v-6h8v13',stone)+path('M36 29V17L48 7l12 10v12Z',roof)+path('M38 79V60q10-15 20 0v19Z',C.navy)+path('M44 64h8v15h-8Z',C.wood,C.ink,1.5)+line('M22 48v8m52-8v8M44 36h8',C.navy,4)+line('M15 67h11m46 4h10M27 39v8m33 5h10',boss?'#b6acb9':C.pale,2)+pennant(49,5,.45,boss?C.rust:C.orange)+(boss?path('m42 45 6-3 6 3-1 9-5 4-5-4Z',C.gold,C.ink,1.5)+line('M45 48h1m4 0h1',C.wine,2):'');
  }
  function bridge() {
    return path('M4 61q25-17 48-4t40 0v24q-22 13-45 0T4 85Z',C.steel,'')+line('M6 76q24-11 42 0m18-5q14 4 24-1',C.pale,2)+path('M11 45q36-18 74 0v17q-16-8-25-8-12-1-20 0-14 1-29 8Z',C.wood)+path('M11 40q36-18 74 0v9q-37-18-74 0Z',C.cream)+line('M17 35v26m16-32v25m16-26v24m16-24v25m14-19v27',C.ink,3)+line('M12 37q36-18 72 0',C.orange,4)+rock(8,72,.7)+rock(89,80,.55);
  }
  function mill() {
    return ellipse(48,81,33,5,C.ink,'opacity=".12"')+path('M35 32h27l7 45H29Z',C.cream)+path('M32 34 48 15l17 19Z',C.teal)+path('M43 77V63q5-6 10 0v14Z',C.wood)+line('M49 35 27 13m22 22 22-22m-22 22L27 57m22-22 22 22',C.ink,4)+path('M26 12 17 21l16 16 9-9m29-16 9 9-16 16-9-9M27 57l9 9 16-16-9-9m28 16 9-9-16-16-9 9',C.steel,C.ink,2)+circle(49,35,5,C.gold,C.ink,2)+line('m22 20 14 14m37-14L59 34M33 60l14-14m27 3L60 35',C.pale,1.5);
  }
  function ruins() {
    return ellipse(48,81,38,6,C.ink,'opacity=".12"')+path('M15 78V30h19l6 7-5 12-1 29Zm47 0V22h18v56Z',C.steel)+path('M14 30V20h9v5h13v5M60 22V12h9v5h13v5',C.cream)+path('M34 33h31v15l-8-5-9 8-5-12-9 7Z',C.steel)+line('M21 46h12m-10 16h11m29-29h12m-10 26h13',C.pale,3)+path('M16 37q-6 15 6 24m52-32q15 7 5 18', 'none',C.teal,3)+path('m17 42-7-4 1 8 7 3m61-14 7-2-1 8-7 3',C.mint,C.ink,1.5)+rock(43,79,.8);
  }
  function signpost() {
    return ellipse(48,81,26,5,C.ink,'opacity=".12"')+line('M48 18v61',C.ink,7)+line('M48 18v61',C.wood,3)+path('M22 23h46l12 11-12 11H22Z',C.cream)+path('M75 46H29L17 57l12 11h46Z',C.teal)+sparkle(48,34,8,C.orange)+line('M36 57h24m-24 0 5-5m-5 5 5 5',C.cream,3)+circle(48,15,4,C.gold,C.ink,2);
  }
  function markerBody(type) {
    if(type==='camp'||type==='rest')return tent()+fire(75,76,.5);
    if(type==='treasure'||type==='chest'||type==='reward')return chest(type==='reward');
    if(type==='shop')return shop();
    if(type==='boss')return castle(true);
    if(type==='tower')return castle(false);
    if(type==='bridge')return bridge();
    if(type==='mill')return mill();
    if(type==='ruins')return ruins();
    if(type==='event')return signpost();
    if(type==='forest')return tree(25,75,1.1)+tree(65,78,1.35)+tree(46,86,.9,C.mint);
    if(type==='current'||type==='army')return ellipse(47,80,26,7,C.ink,'opacity=".13"')+pennant(41,24,1.2)+shield(20,51,.58)+path('m44 87 5 5 5-5',C.orange,'');
    if(type==='elite')return ellipse(48,80,33,6,C.ink,'opacity=".13"')+sword(23,55,.9,-28)+sword(72,55,.9,28)+helmet(16,26,1.24,true)+sparkle(48,13,7,C.gold);
    return ellipse(48,80,32,6,C.ink,'opacity=".13"')+sword(35,48,1,-38)+sword(61,48,1,38)+shield(24,29,1,C.teal);
  }
  const markerTypes=Object.freeze(['normal','battle','elite','boss','rest','camp','shop','event','treasure','chest','reward','current','army','forest','bridge','mill','ruins','tower']);
  function marker(type='battle',size=72,options={}) {
    if(!markerTypes.includes(type))type='battle';
    const state=['available','current','locked','complete'].includes(options?.state)?options.state:'available';
    const ground=ellipse(48,82,42,11,state==='current'?C.gold:state==='complete'?C.mint:'#dce7d2');
    const ring=state==='current'?ellipse(48,82,42,11,'none',`stroke="${C.orange}" stroke-width="2.5"`):'';
    const done=state==='complete'?circle(77,70,10,C.teal,C.cream,2)+line('m72 70 3 3 6-7',C.pale,2.6):'';
    return svg(ground+group(markerBody(type),'',state==='locked'?'opacity=".48"':'')+ring+done,96,96,sizeOf(size,72),`ta-marker ta-marker-${type} is-${state}`,options);
  }
  const simpleIcons = {
    coin:()=>ellipse(24,40,17,3,C.ink,'opacity=".12"')+circle(24,23,17,C.gold,C.ink,2.6)+circle(24,23,12,C.orange,C.ink,1.5)+path('m24 13 6 10-6 10-6-10Z',C.cream,C.ink,1.6)+line('M14 10 12 13',C.pale,2.4),
    token:()=>path('m24 3 18 10v21L24 45 6 34V13Z',C.teal)+path('m24 9 12 7v15l-12 7-12-7V16Z',C.mint,C.ink,1.8)+path('m24 14 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',C.cream,C.ink,1.6),
    heal:()=>path('M18 13V8h12v5',C.cream,C.ink,2.8)+rect(5,13,38,29,5,C.cream)+path('M5 23h38v12H5Z',C.teal,C.ink,1.7)+rect(17,19,14,19,3,C.mint,C.ink,2)+line('M24 23v11m-5-5h10',C.pale,3),
    guard:()=>shield(1,-1,.96),
    focus:()=>circle(22,26,17,C.cream,C.ink,2.6)+circle(22,26,10,C.teal)+circle(22,26,4,C.cream)+line('M22 26 39 9',C.ink,3)+path('M34 5v9h9l-5-5 1-7Z',C.orange,C.ink,2)+line('M5 26H2m20 17v3',C.ink,2),
    rally:()=>pennant(13,13,.85)+line('M7 13 3 10m4 12H2m6 8-4 3',C.orange,2.6),
    sword:()=>sword(24,31,.92,35),
    shield:()=>shield(1,-1,.96),
    army:()=>helmet(1,0,.94,false),
    map:()=>path('m4 10 13-5 14 6 13-5v32l-13 5-14-6-13 5Z',C.cream)+path('M17 5v32l14 6V11Z',C.mint,C.ink,2)+line('m10 26 8-7 10 5 9-6',C.teal,2.5,'stroke-dasharray="2 4"')+circle(37,17,3,C.orange,C.ink,1.7),
    scroll:()=>path('M12 9h26v27q0 7-8 7H10q-6-2-5-9h26',C.cream)+path('M12 9q0-5 6-5h19q7 0 7 9H18q-6 0-6-4Z',C.gold)+line('M18 20h12m-12 7h9',C.teal,2.8)+circle(33,33,7,C.orange,C.ink,2)+path('m29 38-1 9 5-3 5 3-1-9',C.orange,C.ink,1.7),
    settings:()=>path('m20 4 8 0 2 6 6 3 6-1 4 7-5 5v6l3 6-7 5-6-3-6 1-4 5-8-4v-7l-4-5-6-2 1-8 7-2 4-5Z',C.steel)+circle(24,24,8,C.teal,C.ink,2.2)+circle(24,24,3,C.cream),
    pause:()=>rect(10,7,10,34,3,C.cream)+rect(28,7,10,34,3,C.cream),
    play:()=>path('M14 6 40 24 14 42Z',C.cream),
    speed:()=>path('M5 10 24 24 5 38Zm20 0 19 14-19 14Z',C.cream),
    check:()=>circle(24,24,19,C.teal,C.ink,2.6)+line('m14 24 7 7 14-15',C.cream,4),
    lock:()=>path('M13 22V14a11 11 0 0 1 22 0v8', 'none',C.ink,4)+rect(8,20,32,24,5,C.steel)+circle(24,30,4,C.ink)+line('M24 33v5',C.ink,3),
    crown:()=>path('m6 13 10 7L24 6l8 14 10-7-4 24H10Z',C.gold)+path('M10 32h28v8H10Z',C.orange)+circle(24,26,3,C.teal,C.ink,1.5)+circle(6,10,3,C.cream,C.ink,1.5)+circle(24,5,3,C.cream,C.ink,1.5)+circle(42,10,3,C.cream,C.ink,1.5),
    heart:()=>path('M24 42C18 36 4 27 4 16c0-13 15-15 20-4C30 1 44 4 44 16c0 11-14 20-20 26Z',C.orange)+path('M11 16c0-5 5-7 8-3', 'none',C.cream,3)
  };
  const iconAliases=Object.freeze({roster:'army',formation:'army',troop:'army',gold:'coin',tokens:'token',recruit:'army',train:'focus',evolve:'crown',details:'scroll',record:'scroll',history:'scroll',menu:'settings',battle:'sword',normal:'sword',victory:'crown',unit:'army',health:'heart',loot:'chest'});
  const iconNames=Object.freeze(Object.keys(simpleIcons).concat(['camp','rest','shop','chest','reward','boss','elite','event','treasure']));
  function icon(name='army',size=24,options={}) {
    name=iconAliases[name]||name;
    const compact=simpleIcons[name],body=compact?compact():group(markerBody(markerTypes.includes(name)?name:'army'),'scale(.5)');
    return svg(body,48,48,sizeOf(size,24),`ta-screen-icon ta-icon-${iconNames.includes(name)?name:'army'}`,options);
  }
  function meadow(chapter=1) {
    const ash=Number(chapter)>=2,bg=ash?'#e5dfd6':'#e8edd9',land=ash?'#d8d0c5':'#dce6cd',hill=ash?'#c7c2bc':'#cbdabf',edge=ash?'#a8a9a2':'#b7cbb0',leaf=ash?'#6f9284':'#5b9d87';
    let out=rect(0,0,600,420,0,bg,'')+path('M0 0h600v85Q516 58 446 88T283 62 117 91 0 63Z',land,'')+path('M0 115Q55 76 108 101l-12 38Q42 141 0 168ZM600 92Q550 111 521 158l79 33ZM0 311Q62 298 100 329l-9 91H0ZM600 292q-70 5-94 61l22 67h72Z',land,'')+path('M0 18 31 30 81 5 119 39 172 0H0ZM600 0H441l44 39 46-22 36 26 33-10Z',hill,'')+path('M0 46 29 61 47 36 68 68 91 61 104 87H0ZM600 45l-39 25-21-13-30 40h90Z',edge,'');
    out+=path('M576 155q-63 34-37 80t61 50v24q-79-15-84-67t60-107Z',ash?'#aeb9b6':'#bcd7d1','')+line('M566 164q-42 28-29 60m14 34q17 17 41 22',ash?'#d4ded8':'#e1ede0',3);
    out+=group(tree(28,154,.86,leaf)+tree(53,187,.65,leaf)+tree(14,219,.8,leaf)+tree(566,117,.8,leaf)+tree(591,145,.6,leaf)+tree(31,350,.85,leaf)+tree(62,386,.65,leaf)+tree(572,354,.85,leaf)+tree(541,395,.6,leaf),'','opacity=".7"');
    out+=group(rock(32,254,1.3,hill)+rock(58,275,.7,hill)+rock(581,323,1.2,hill)+rock(544,337,.7,hill)+rock(21,400,.7,hill),'','opacity=".65"');
    out+=line('M14 300h12m-6-3v6m557 77h12m-6-3v6M44 118h10m-5-3v6',edge,2);
    out+=group(ash?ruins():mill(),ash?'translate(468 2) scale(.72)':'translate(442 0) scale(.72)','opacity=".55"');
    // A quiet central corridor intentionally leaves route lines and labels clear.
    out+=path('M175 0q-30 93 18 170t-6 143q-28 48-12 107h230q-38-75-9-154t-6-137Q357 56 397 0Z',C.pale,'',0,'opacity=".1"');
    return out;
  }
  function portraitMeadow(chapter=1) {
    const ash=Number(chapter)>=2,bg=ash?'#e5dfd6':'#e8edd9',land=ash?'#d8d0c5':'#dce6cd',hill=ash?'#c7c2bc':'#cbdabf',edge=ash?'#a8a9a2':'#b7cbb0',leaf=ash?'#6f9284':'#5b9d87';
    let out=rect(0,0,600,960,0,bg,'');
    out+=path('M0 0h600v125Q503 96 435 131T269 96 97 143 0 104Z',land,'')+path('M0 36 41 51 92 12 153 58 191 0H0ZM600 0H418l48 57 59-29 33 35 42-22Z',hill,'');
    out+=path('M0 181q48-35 87-8t-4 110Q45 346 0 329Zm600 14q-69 22-91 83l16 113 75 31ZM0 448q58-19 98 49t-12 109Q36 654 0 623ZM600 507q-78 6-91 64t14 134l77 32ZM0 766q68-51 97 5t-6 115l29 74H0ZM600 807q-64 11-88 69l17 84h71Z',land,'');
    out+=path('M591 145q-57 78-32 146t-22 122q-28 49 9 95t1 111q-41 65 21 126l32 24v-22q-66-55-39-115t0-111q-30-51-3-105t16-126q-25-58 17-115Z',ash?'#b3bfbb':'#bcd7d1','');
    out+=line('M580 172q-33 54-17 103m-14 152q-19 35 2 66m9 143q-15 45 29 87',ash?'#d6ddd6':'#e1ede0',3);
    out+=group(tree(22,210,1.2,leaf)+tree(63,243,.85,leaf)+tree(17,290,.95,leaf)+tree(571,193,.9,leaf)+tree(594,231,.75,leaf)+tree(33,450,1.15,leaf)+tree(63,487,.75,leaf)+tree(17,531,.9,leaf)+tree(577,456,1.1,leaf)+tree(548,507,.8,leaf)+tree(594,550,.8,leaf)+tree(31,719,1.05,leaf)+tree(64,762,.75,leaf)+tree(16,793,.8,leaf)+tree(572,751,1.05,leaf)+tree(547,804,.8,leaf)+tree(591,844,.9,leaf),'','opacity=".64"');
    out+=group(rock(32,362,1.2,hill)+rock(57,388,.75,hill)+rock(575,337,1.1,hill)+rock(544,357,.65,hill)+rock(28,626,.8,hill)+rock(581,665,1.2,hill)+rock(552,686,.7,hill)+rock(38,877,1.2,hill),'','opacity=".65"');
    out+=line('M22 318h12m-6-3v6m550 274h12m-6-3v6M42 586h10m-5-3v6m520 298h10m-5-3v6',edge,2);
    out+=group(ash?ruins():mill(),'translate(469 51) scale(.72)','opacity=".53"');
    out+=path('M184 0q-25 142 14 279t-21 238q-32 134 15 224t-11 219h227q-37-112-16-221t-3-232q-26-134 16-244t-10-263Z',C.pale,'',0,'opacity=".1"');
    return out;
  }
  // A purpose-built panoramic ribbon. Objects are fully visible at 48px high;
  // no important detail relies on cropping a large background illustration.
  function ribbon(kind,chapter=1) {
    const ash=Number(chapter)>=2,rest=kind==='rest',warm=kind==='reward'||kind==='complete';
    const sky=ash?'#e6e0d9':rest?'#d8e7df':warm?'#fff0cf':'#e8eedc';
    let out=rect(0,0,600,96,0,sky,'');
    out+=path('M0 51Q55 20 117 44T224 41 340 36 457 44 600 27V96H0Z',ash?'#d4cec5':'#ccdcca','');
    out+=path('M0 75Q71 58 138 73T274 72 431 65 600 71V96H0Z',ash?'#ddd8cb':'#dce5cd','');
    out+=line('M150 81h300',ash?'#bfb8a5':'#b9c9b0',1.2)+line('M181 85h238',C.pale,1);
    // Only the two endcaps carry imagery. The center is a quiet visual pause.
    if(rest){
      out+=circle(491,22,13,C.pale)+circle(497,18,12,sky)+sparkle(459,18,3,C.pale)+sparkle(535,31,2.5,C.pale);
      out+=group(tree(30,80,1.1)+tree(121,81,.7),'','opacity=".5"')+group(tent(),'translate(43 22) scale(.68)')+fire(113,78,.43);
      out+=group(tent(),'translate(490 42) scale(.48)')+tree(570,83,.82,ash?'#93a697':'#8cae98');
    }else if(warm){
      out+=group(chest(true),'translate(45 17) scale(.8)')+sparkle(43,30,5,C.gold)+sparkle(124,23,4,C.orange);
      out+=group(pennant(0,0,1.05,C.teal),'translate(505 34)')+group(shield(0,0,.73),'translate(519 46)')+circle(490,81,5,C.gold,C.ink,1.4)+circle(478,84,4,C.gold,C.ink,1.4);
    }else if(kind==='prepare'||kind==='army'){
      out+=group(pennant(0,0,1.05),'translate(53 32)')+group(shield(0,0,.8),'translate(62 43)')+sword(113,66,.62,26);
      out+=group(helmet(0,0,.78),'translate(493 33)')+group(helmet(0,0,.62),'translate(533 43)')+line('M486 83h84',C.wood,2);
    }else if(kind==='shop'){
      out+=group(shop(),'translate(44 12) scale(.85)')+group(chest(false),'translate(510 42) scale(.48)')+group(signpost(),'translate(468 34) scale(.59)');
    }else if(kind==='event'){
      out+=group(signpost(),'translate(48 8) scale(.9)')+tree(550,84,1.2,ash?'#93a697':'#8cae98')+group(chest(false),'translate(479 47) scale(.45)');
    }else{
      out+=group(ruins(),'translate(45 14) scale(.8)')+group(tent(),'translate(493 32) scale(.62)');
    }
    out+=rect(0,93,600,3,0,ash?'#bbb6a0':'#bac9aa','');
    return out;
  }
  function scene(kind='camp',chapter=1) {
    if(kind!=='camp')return ribbon(kind,chapter);
    const ash=Number(chapter)>=2,sky=ash?'#e6e0d9':'#e9efdf';
    let out=rect(0,0,600,240,0,sky,'')+circle(493,42,29,'#f6e2a4');
    out+=path('M0 117Q75 54 151 98T317 84 490 102 600 66V240H0Z',ash?'#c6c4bd':'#bfd6b8','')+path('M0 155Q92 111 168 150T341 143 491 149 600 121V240H0Z',ash?'#d5d0c8':'#d5e2c4','')+path('M0 206Q110 171 203 198T399 187 600 201v39H0Z',ash?'#e0dbd3':'#e5eacb','');
    out+=group(tree(22,186,1.4)+tree(62,198,.95)+tree(580,169,1.2)+tree(548,202,.85),'','opacity=".55"');
    out+=group(tent(),'translate(450 132) scale(1.05)')+fire(442,212,.7)+group(tent(),'translate(53 164) scale(.55)');
    return out;
  }
  function warmer(warm){return warm?'#f3d88e':'#f6e2a4'}
  function backdrop(chapter=1,options={}) {
    const isMap=typeof chapter==='number'||chapter==='1'||chapter==='2'||chapter==='map';
    const kind=['camp','reward','shop','rest','prepare','army','complete','defeat','event'].includes(chapter)?chapter:'camp';
    const landscape=options?.landscape===true;
    const output=svg(isMap?(landscape?meadow:portraitMeadow)(chapter==='map'?1:chapter):scene(kind,options?.chapter),600,isMap?(landscape?420:960):(kind==='camp'?240:96),600,isMap?`ta-map-backdrop ta-chapter-${Number(chapter)>=2?2:1}`:`ta-screen-backdrop ta-scene-${kind} ta-chapter-${Number(options?.chapter)>=2?2:1}`,options);
    // A portrait board fills mobile; on desktop slice keeps each tree undistorted.
    return isMap?output.replace(' viewBox=', ' preserveAspectRatio="xMidYMid slice" viewBox='):output;
  }
  function banner(kind='army',size=160,options={}) {
    const known=['army','camp','rest','shop','reward','complete','defeat','event','prepare'];
    if(!known.includes(kind))kind='army';
    let body=ellipse(120,108,103,12,'#203548','opacity=".1"')+path('M14 103q33-21 69-13t67-5 76 18q-96 25-212 0Z','#cddfc2','');
    if(kind==='camp'||kind==='rest')body+=tree(29,96,1.25)+tree(208,99,1.55)+group(tent(),'translate(72 20) scale(1.1)')+fire(69,102,.85)+rock(177,110,.8)+group(tent(),'translate(172 53) scale(.55)');
    else if(kind==='shop')body+=tree(28,95,1.1)+group(shop(),'translate(75 11) scale(1.2)')+group(signpost(),'translate(5 53) scale(.6)')+group(chest(false),'translate(176 57) scale(.5)');
    else if(kind==='reward'||kind==='complete')body+=group(pennant(0,0,.95,C.orange),'translate(48 39)')+group(chest(true),'translate(65 13) scale(1.2)')+sparkle(185,30,9,C.gold)+sparkle(49,25,5,C.orange)+sparkle(172,57,5,C.cream)+circle(194,98,7,C.gold,C.ink,2)+circle(182,105,6,C.gold,C.ink,2)+circle(43,103,6,C.gold,C.ink,2);
    else if(kind==='defeat')body+=group(ruins(),'translate(112 10) scale(1.1)')+group(tent(),'translate(30 40) scale(.9)')+rock(198,109,.9);
    else if(kind==='event')body+=tree(41,105,1.25)+group(signpost(),'translate(78 11) scale(1.2)')+group(chest(false),'translate(166 55) scale(.55)')+sparkle(165,25,7,C.gold);
    else body+=group(pennant(0,0,1.5),'translate(120 23)')+group(shield(0,0,1.14),'translate(87 48)')+group(helmet(0,0,.9),'translate(36 57)')+group(helmet(0,0,.9),'translate(161 57)')+sword(59,85,.85,-35)+sword(183,85,.85,35)+rock(203,112,.6);
    return svg(body,240,128,sizeOf(size,160),`ta-banner-art ta-banner-${kind}`,options);
  }
  function insignia(type='spear',size=40,options={}) {
    const archetype={spear:'sword',guardian:'shield',charger:'sword',archer:'focus',sniper:'focus',volley:'focus',support:'heal'}[type]||'army';
    const center=simpleIcons[archetype]();
    return svg(path('m32 3 24 11-2 29-22 18L10 43 8 14Z',C.navy)+path('m32 8 18 9-2 23-16 14-16-14-2-23Z',C.cream,C.ink,1.6)+group(center,'translate(14 13) scale(.75)'),64,64,sizeOf(size,40),'ta-unit-insignia',options);
  }
  const api=Object.freeze({version:'0.5.1',palette:C,iconNames,markerTypes,icon,marker,backdrop,banner,insignia});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.TinyArmyScreenArt=api;
})(typeof window!=='undefined'?window:globalThis);
