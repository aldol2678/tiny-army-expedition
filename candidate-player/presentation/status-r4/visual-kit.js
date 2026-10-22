// Private visual-only candidate. No engine, clock, RNG, storage, audio or network.
// Geometry is caller-owned authoritative data; no hit tests or target selection.
export const PALETTE=Object.freeze({ink:'#203548',navy:'#284456',teal:'#318d8c',mint:'#7dd5bc',cream:'#fff0cb',pale:'#fff9e7',gold:'#f6c772',coral:'#d47a65',rust:'#bc5953',wine:'#673b4e',steel:'#b8d5d5'});
const poly=(points,fill='cream',width=1.65)=>({type:'poly',points,fill,width});
const line=(points,color='ink',width=1.65)=>({type:'line',points,color,width});
const circle=(x,y,r,fill='cream',width=1.65)=>({type:'circle',x,y,r,fill,width});
const curve=(commands,fill='cream',width=1.65,color='ink')=>({type:'curve',commands,fill,width,color});
// Original state silhouettes. None of these symbols establishes an engine hook.
export const GLYPHS=Object.freeze({
 pierce:{label:'관통 직선',color:'coral',parts:[poly([[3,8],[16,8],[16,4],[22,12],[16,20],[16,16],[3,16]],'cream'),line([[3,12],[15,12]],'rust',2)]},
 fan:{label:'부채꼴 연발',color:'coral',parts:[poly([[3,21],[5,4],[20,3],[22,18]],'cream'),line([[4,20],[8,8]],'rust',2),line([[4,20],[14,7]],'rust',2),line([[4,20],[19,13]],'rust',2)]},
 crossfire:{label:'순차 교차사격',color:'coral',parts:[line([[3,6],[18,6]],'ink',3),poly([[17,3],[22,6],[17,9]],'gold',1.3),line([[21,18],[6,18]],'ink',3),poly([[7,15],[2,18],[7,21]],'cream',1.3),line([[5,3],[5,9]],'gold',1.5),line([[17,15],[17,21]],'cream',1.5)]},
 flank:{label:'외곽 침투 경로',color:'steel',parts:[line([[3,20],[3,5],[16,5],[16,14]],'ink',3),line([[3,20],[3,5],[16,5],[16,14]],'steel',1.3),poly([[12,13],[20,13],[16,21]],'cream')]},
 healer:{label:'치유자 조준',color:'coral',parts:[line([[3,8],[3,3],[8,3]],'ink',2),line([[16,3],[21,3],[21,8]],'ink',2),line([[3,16],[3,21],[8,21]],'ink',2),line([[16,21],[21,21],[21,16]],'ink',2),poly([[10,6],[14,6],[14,10],[18,10],[18,14],[14,14],[14,18],[10,18],[10,14],[6,14],[6,10],[10,10]],'cream',1.3)]},
 focus:{label:'집중 표식',color:'coral',parts:[line([[2,8],[2,3],[7,3]],'ink',2),line([[17,3],[22,3],[22,8]],'ink',2),line([[2,16],[2,21],[7,21]],'ink',2),line([[17,21],[22,21],[22,16]],'ink',2),poly([[12,5],[17,12],[12,19],[7,12]],'gold',1.4)]},
 charge:{label:'차단 가능한 충전',color:'coral',parts:[poly([[3,8],[14,8],[14,4],[22,12],[14,20],[14,16],[3,16]],'cream'),line([[8,3],[8,21]],'ink',2.6),line([[7,6],[11,10],[6,14],[10,18]],'rust',2)]},
 summon:{label:'비피해 소환 착지',color:'steel',parts:[line([[3,8],[3,3],[8,3]],'ink',2),line([[16,3],[21,3],[21,8]],'ink',2),line([[3,16],[3,21],[8,21]],'ink',2),line([[16,21],[21,21],[21,16]],'ink',2),poly([[12,5],[17,9],[17,15],[12,19],[7,15],[7,9]],'steel'),line([[12,8],[12,16]],'ink',1.5),line([[9,12],[15,12]],'ink',1.5)]},
 // R3 original metaphors, not traced game artwork. Paired text preserves narrow mechanics.
 curse:{label:'회복 저주',color:'wine',parts:[curve([['M',6,18],['Q',1,16,3,11],['Q',0,8,4,5],['L',3,2],['Q',9,3,10,7],['L',17,6],['Q',22,11,19,17],['Z']],'wine',1.5),curve([['M',5,10],['C',5,3,18,3,18,10],['Q',18,14,15,15],['L',15,19],['L',8,19],['L',8,15],['Q',5,14,5,10],['Z']]),circle(9,11,1.4,'ink',.6),circle(14,11,1.4,'ink',.6),line([[10,16],[10,18]],'ink',1.3),line([[13,16],[13,18]],'ink',1.3),poly([[18,14],[21,14],[21,17],[24,17],[24,20],[21,20],[21,23],[18,23],[18,20],[15,20],[15,17],[18,17]],'coral',1.4)]},
 weakness:{label:'쇠약 · 공격 약화',color:'wine',parts:[poly([[16,2],[22,2],[22,8],[16,13],[15,10],[12,11],[12,7]],'cream',1.7),poly([[8,11],[8,14],[12,13],[13,16],[8,21],[3,16]],'steel',1.7),line([[3,13],[11,21]],'gold',3.6),line([[6,18],[3,21]],'ink',3.8),line([[6,18],[3,21]],'gold',1.8),line([[6,6],[4,4]],'coral',1.8),line([[20,17],[22,19]],'coral',1.8)]},
 stun:{label:'기절 · 짧은 경직',color:'gold',parts:[curve([['M',3,9],['C',2,3,22,3,22,9]],null,1.5,'steel'),circle(12,16,6.2,'cream',1.65),line([[8,14],[10,15],[8,16]],'ink',1.5),line([[16,14],[14,15],[16,16]],'ink',1.5),line([[10,19],[14,19]],'ink',1.3),poly([[5,1],[6.3,4],[9.5,4.3],[7,6.4],[7.7,9.5],[5,7.8],[2.3,9.5],[3,6.4],[.5,4.3],[3.7,4]],'gold',1.25),poly([[20,2],[21,4.5],[23.7,4.7],[21.6,6.5],[22.2,9],[20,7.6],[17.8,9],[18.4,6.5],[16.3,4.7],[19,4.5]],'gold',1.25)]},
 silence:{label:'공격기술 봉인',color:'wine',parts:[curve([['M',5,2],['L',19,2],['Q',23,2,23,6],['L',23,15],['Q',23,19,19,19],['L',10,19],['L',5,23],['L',5,18],['Q',1,17,1,14],['L',1,6],['Q',1,2,5,2],['Z']],'cream',1.65),poly([[15,5],[19,5],[19,9],[12,16],[9,13]],'gold',1.3),line([[8,12],[13,17]],'ink',2),line([[10,15],[7,18]],'ink',2.4),line([[4,4],[20,20]],'ink',3.7),line([[4,4],[20,20]],'coral',1.8)]},
 confusion:{label:'혼란 · 적 표적 변경',color:'wine',parts:[curve([['M',7.5,6.5],['C',7.5,1.8,17.5,1.8,17.5,6.5],['C',17.5,10.5,12.5,10,12.5,14]],null,3.1,'ink'),circle(12.5,19,1.7,'gold',1.3)]},
 slow:{label:'둔화',color:'steel',parts:[curve([['M',4,4],['L',11,4],['L',10,12],['L',15,15],['Q',21,15,22,19],['L',22,21],['L',3,21],['L',3,17],['L',4,13],['Z']],'cream',1.65),line([[4,8],[10,8]],'steel',2),line([[4,18],[21,18]],'steel',2),poly([[16,2],[23,2],[23,4],[20,7],[23,10],[23,12],[16,12],[16,10],[19,7],[16,4]],'gold',1.35),line([[17,3],[22,3]],'ink',1.1),line([[17,11],[22,11]],'ink',1.1)]},
 cleanse:{label:'정화',color:'mint',parts:[poly([[14,4],[16.8,10.7],[23,14],[16.8,16.4],[14,23],[11.2,16.4],[5,14],[11.2,10.7]],'mint',1.7),poly([[5,1],[6.4,4.6],[10,6],[6.4,7.4],[5,11],[3.6,7.4],[0,6],[3.6,4.6]],'gold',1.3),line([[14,10],[14,17]],'cream',1.5)]}
});
const fail=(ok,m)=>{if(!ok)throw new TypeError(m);};
const finite=(n,min=-1e6,max=1e6)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const point=p=>{fail(p&&finite(p.x)&&finite(p.y),'Invalid world point');return {x:p.x,y:p.y};};
const direction=d=>{d=point(d);fail(Math.abs(Math.hypot(d.x,d.y)-1)<1e-6,'direction must be a unit vector');return d;};
const identity=x=>(typeof x==='string'&&x.length>0&&x.length<=100)||Number.isSafeInteger(x);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const num=n=>String(Math.round(n*1e6)/1e6);
const M=(x,y)=>['M',x,y],L=(x,y)=>['L',x,y];
export const PATTERN_VISUALS=Object.freeze(Object.fromEntries([
 ['EP01','flank','movement'],['EP02','healer','damage'],['EP03','pierce','damage'],['EP04','fan','damage'],['EP05','crossfire','damage'],['EP06','focus','status'],['EP07','charge','interrupt'],['EP08','summon','spawn'],['EP09','curse','status'],['EP10','weakness','status'],['EP11','stun','status'],['EP12','silence','status'],['EP13','confusion','status'],['EP14','slow','damage']
].map(([id,glyph,role])=>[id,Object.freeze({glyph,role})])));
export function worldTransform(width,height){fail(finite(width,48,4096)&&finite(height,48,4096),'Invalid viewport');const scale=Math.min(width/960,height/600);return {scale,offsetX:(width-960*scale)/2,offsetY:(height-600*scale)/2};}
export function worldToScreen(p,t){p=point(p);return {x:p.x*t.scale+t.offsetX,y:p.y*t.scale+t.offsetY};}
export function screenToWorld(p,t){p=point(p);return {x:(p.x-t.offsetX)/t.scale,y:(p.y-t.offsetY)/t.scale};}
export function geometryCommands(input){
 fail(input&&typeof input==='object','Geometry required');const kind=input.kind;
 if(kind==='segment'){
  fail(input.centered===false,'Only origin-to-end finite segments are supported');const o=point(input.origin),d=direction(input.direction);fail(finite(input.length,.001,1e4)&&finite(input.width,.001,1e4),'Invalid segment length/width');const x=o.x+d.x*input.length,y=o.y+d.y*input.length,nx=-d.y*input.width/2,ny=d.x*input.width/2;
  const points=[[o.x+nx,o.y+ny],[x+nx,y+ny],[x-nx,y-ny],[o.x-nx,o.y-ny]];return {kind,commands:[M(...points[0]),...points.slice(1).map(p=>L(...p)),['Z']],points,bounds:bounds(points),origin:o,tip:{x,y}};
 }
 if(kind==='cone'){
  const o=point(input.origin),d=direction(input.direction);fail(finite(input.range,.001,1e4)&&finite(input.halfAngle,.001,Math.PI/2),'Invalid cone range/halfAngle');const a=Math.atan2(d.y,d.x),start=a-input.halfAngle,end=a+input.halfAngle,r=input.range,pt=t=>[o.x+Math.cos(t)*r,o.y+Math.sin(t)*r];const points=[[o.x,o.y],pt(start),pt(end)];for(let n=-4;n<=4;n++){const t=n*Math.PI/2;if(t>=start&&t<=end)points.push(pt(t));}
  return {kind,commands:[M(o.x,o.y),L(...pt(start)),['A',o.x,o.y,r,start,end],['Z']],bounds:bounds(points),origin:o,tip:{x:o.x+d.x*r,y:o.y+d.y*r}};
 }
 if(kind==='target'){
  const o=point(input.origin),t=point(input.targetPosition);fail(identity(input.targetId),'Target identity required');fail(finite(input.range,.001,1e4),'Target cast range required');return {kind,commands:[],bounds:[t.x,t.y,t.x,t.y],origin:o,tip:t,targetId:input.targetId,range:input.range};
 }
 if(kind==='path_target'){
  fail(input.damage===false,'Path is a movement cue, never a damage corridor');fail(Array.isArray(input.points)&&input.points.length>=2&&input.points.length<=16,'Finite movement path required');fail(identity(input.targetId),'Path target identity required');const ps=input.points.map(point).map(p=>[p.x,p.y]);const tip=point(input.targetPosition);return {kind,commands:[M(...ps[0]),...ps.slice(1).map(p=>L(...p))],bounds:bounds(ps),origin:{x:ps[0][0],y:ps[0][1]},tip,targetId:input.targetId};
 }
 if(kind==='spawn_points'){
  fail(input.damage===false,'Spawn marker radius is not a hitbox');fail(Array.isArray(input.points)&&input.points.length>0&&input.points.length<=2,'One or two fixed spawn points required');const children=input.points.map(p=>{const o=point(p);fail(finite(p.radius,.001,1e4),'Invalid spawn visual radius');const r=p.radius;return {kind:'spawn_point',commands:[M(o.x+r,o.y),['A',o.x,o.y,r,0,Math.PI*2],['Z']],bounds:[o.x-r,o.y-r,o.x+r,o.y+r],origin:o,tip:o};});return {kind,children,commands:[],origin:children[0].origin,tip:children[0].tip};
 }
 if(kind==='sequence'){
  fail(Array.isArray(input.children)&&input.children.length===2&&input.children.every(c=>c.kind==='segment'),'Exactly two fixed segment children required');const children=input.children.map(geometryCommands);return {kind,children,commands:[],origin:children[0].origin,tip:children[0].tip};
 }
 throw new TypeError('Unknown authoritative shape');
}
function bounds(points){return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
function svgPath(commands){let out='';for(const c of commands){if(c[0]==='A'){const [,x,y,r,a,b]=c;const point=t=>[x+Math.cos(t)*r,y+Math.sin(t)*r];if(b-a>=Math.PI*2-1e-8){out+=`A${num(r)} ${num(r)} 0 1 1 ${point(a+Math.PI).map(num).join(' ')} A${num(r)} ${num(r)} 0 1 1 ${point(b).map(num).join(' ')} `;}else out+=`A${num(r)} ${num(r)} 0 ${b-a>Math.PI?1:0} 1 ${point(b).map(num).join(' ')} `;}else out+=c[0]+c.slice(1).map(num).join(' ')+' ';}return out.trim();}
function pathCanvas(ctx,commands){ctx.beginPath();for(const [op,...p] of commands){if(op==='M')ctx.moveTo(...p);else if(op==='L')ctx.lineTo(...p);else if(op==='A')ctx.arc(...p);else if(op==='Z')ctx.closePath();}}
function glyphPartPath(p){return p.commands.map(c=>c[0]+c.slice(1).map(num).join(' ')).join(' ');}
function glyphPartsSVG(g,mono){
 const color=k=>mono?(k==='ink'?'#203548':'#fff0cb'):PALETTE[k];
 const shape=(p,halo)=>{const stroke=halo?PALETTE.pale:mono?PALETTE.ink:color(p.type==='line'?p.color:p.type==='curve'?p.color:'ink');const fill=p.type==='line'||p.fill===null?'none':halo?PALETTE.pale:color(p.fill);const attrs=`fill="${fill}" stroke="${stroke}" stroke-width="${p.width+(halo?2.4:0)}"`;return p.type==='circle'?`<circle cx="${p.x}" cy="${p.y}" r="${p.r}" ${attrs}/>`:p.type==='curve'?`<path d="${glyphPartPath(p)}" ${attrs}/>`:`<${p.type==='line'?'polyline':'polygon'} points="${p.points.map(x=>x.join(',')).join(' ')}" ${attrs}/>`;};
 return `<g aria-hidden="true">${g.parts.map(p=>shape(p,true)).join('')}</g>`+g.parts.map(p=>shape(p,false)).join('');
}
export function glyphSVG(id,{size=48,monochrome=false}={}){fail(Object.hasOwn(GLYPHS,id),'Unknown glyph');fail(finite(size,16,512),'Invalid glyph size');const g=GLYPHS[id];return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="${size}" height="${size}" role="img"><title>${esc(g.label)}</title><g transform="translate(2 2)" stroke-linejoin="round" stroke-linecap="round">${glyphPartsSVG(g,monochrome)}</g></svg>`;}
function drawGlyph(ctx,id,x,y,size,monochrome){
 const g=GLYPHS[id],color=k=>monochrome?(k==='ink'?'#203548':'#fff0cb'):PALETTE[k];ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/28,size/28);ctx.translate(2,2);ctx.lineJoin='round';ctx.lineCap='round';
 for(const halo of [true,false])for(const p of g.parts){ctx.beginPath();if(p.type==='circle')ctx.arc(p.x,p.y,p.r,0,Math.PI*2);else if(p.type==='curve'){for(const [op,...v] of p.commands){if(op==='M')ctx.moveTo(...v);else if(op==='L')ctx.lineTo(...v);else if(op==='Q')ctx.quadraticCurveTo(...v);else if(op==='C')ctx.bezierCurveTo(...v);else if(op==='Z')ctx.closePath();}}else{p.points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));if(p.type==='poly')ctx.closePath();}ctx.lineWidth=p.width+(halo?2.4:0);if(p.type!=='line'&&p.fill!==null){ctx.fillStyle=halo?PALETTE.pale:color(p.fill);ctx.fill();}ctx.strokeStyle=halo?PALETTE.pale:monochrome?PALETTE.ink:color(p.type==='line'?p.color:p.type==='curve'?p.color:'ink');ctx.stroke();}ctx.restore();
}
const phaseNames={announce:'예고',commit:'시전',resolve:'발동',recovery:'회복',cancelled:'취소',ended:'종료'};
export function prepareVisual(event,{reducedMotion=false,lowEffects=false,monochrome=false}={}){
 fail(event&&Object.hasOwn(phaseNames,event.phase),'Explicit authoritative phase required');fail(Object.hasOwn(PATTERN_VISUALS,event.patternId),'Unknown pattern');for(const k of ['battleId','actionId','sourceId'])fail(identity(event[k]),`Missing ${k}`);fail(typeof event.damage==='boolean','Explicit damage policy required');
 for(const k of ['phaseStartTick','announceTick','commitTick','resolveTick','recoveryUntilTick','remainingTicks'])fail(Number.isSafeInteger(event[k])&&event[k]>=0,`Invalid ${k}`);
 fail(event.announceTick<=event.commitTick&&event.commitTick<=event.resolveTick&&event.resolveTick<=event.recoveryUntilTick,'Nonmonotonic authority timing');
 const progress=event.phaseProgress??null;fail(progress===null||finite(progress,0,1),'Phase progress must be supplied 0..1 or unknown');
 const interruptProgress=event.interruptProgress??null;fail(interruptProgress===null||finite(interruptProgress,0,1),'Interrupt progress must be supplied 0..1 or unknown');
 for(const [k,max] of [['remainingPulses',3],['remainingAttacks',2]])fail(event[k]===undefined||event[k]===null||(Number.isInteger(event[k])&&event[k]>=0&&event[k]<=max),`Invalid ${k}`);
 const {glyph,role}=PATTERN_VISUALS[event.patternId];
 const terminal=['cancelled','recovery','ended'].includes(event.phase);
 // A dead target need not have a live position. Terminal cues use source only.
 const terminalNoTarget=terminal&&['target','path_target'].includes(event.geometry?.kind)&&event.targetPosition===null;
 const geometryInput=terminalNoTarget?{...event.geometry,targetPosition:event.geometry.origin??event.geometry.points?.[0]}:event.geometry;
 const geometry=geometryCommands(geometryInput);
 const expected={EP01:'path_target',EP03:'segment',EP04:'cone',EP05:'sequence',EP07:'segment',EP08:'spawn_points',EP14:'segment'}[event.patternId]||'target';fail(geometry.kind===expected,'Pattern/geometry mismatch');
 fail(event.geometry.damage===undefined||event.geometry.damage===event.damage,'Conflicting damage policy');
 if(['target','path_target'].includes(geometry.kind)) {fail(event.targetId===geometry.targetId,'Target identity mismatch');if(!terminalNoTarget){const target=point(event.targetPosition);fail(target.x===geometry.tip.x&&target.y===geometry.tip.y,'Target snapshot mismatch');}}
 if(role==='movement'||role==='spawn')fail(event.damage===false,'Movement/spawn must not imply direct damage');
 if(event.phase==='cancelled')fail(typeof event.cancelReason==='string'&&event.cancelReason.length>0,'Cancelled reason required');
 const active=event.phase==='announce'||event.phase==='commit'||event.phase==='resolve';let shapes=[];
 if(geometry.kind==='sequence') {fail(event.activeGeometryIndex===0||event.activeGeometryIndex===1,'Authority activeGeometryIndex required');shapes=geometry.children.map((g,i)=>({geometry:g,secondary:i>event.activeGeometryIndex,index:i})).filter(s=>s.index>=event.activeGeometryIndex);}
 else shapes=(geometry.children||[geometry]).map(g=>({geometry:g,secondary:false}));
 const anchor=event.phase==='recovery'||event.phase==='cancelled'?geometry.origin:shapes.find(x=>!x.secondary).geometry.tip;
 // Shape commands are never changed by progress, accessibility options or phase.
 return {visible:event.phase!=='ended',active,phase:event.phase,label:`${GLYPHS[glyph].label} · ${phaseNames[event.phase]}`,role,glyph,geometry,shapes,anchor,warning:event.phase==='announce'||event.phase==='commit',fillOpacity:active&&event.damage?.12:0,color:monochrome?PALETTE.ink:PALETTE[role==='spawn'||role==='movement'?'navy':'rust'],progress,interruptProgress,remainingPulses:event.remainingPulses??null,remainingAttacks:event.remainingAttacks??null,reducedMotion,lowEffects,monochrome};
}
function style(v,s){return {dash:s.secondary?[3,6]:v.role==='movement'?[8,6]:v.role==='spawn'?[3,5]:[],fill:s.secondary?0:v.fillOpacity};}
function decoration(v){return v.active&&v.phase==='resolve'&&!v.lowEffects?(v.reducedMotion||v.progress===null?12:8+8*v.progress):null;}
function glyphAnchor(v,t){const p=worldToScreen(v.anchor,t);return {x:p.x,y:p.y-30};} // screen-space offset avoids actor/HP body
export function telegraphSVG(event,{width=360,height=225,...options}={}){
 const t=worldTransform(width,height),v=prepareVisual(event,options);let body='';
 if(v.visible){if(v.active)for(const s of v.shapes){const g=s.geometry,st=style(v,s),path=svgPath(g.commands);if(path)body+=`<g transform="translate(${t.offsetX} ${t.offsetY}) scale(${t.scale})"><path d="${path}" fill="${st.fill?v.color:'none'}" fill-opacity="${st.fill}" stroke="${PALETTE.cream}" stroke-width="6" vector-effect="non-scaling-stroke"${st.dash.length?` stroke-dasharray="${st.dash}"`:''}/><path d="${path}" fill="none" stroke="${PALETTE.ink}" stroke-width="3" vector-effect="non-scaling-stroke"${st.dash.length?` stroke-dasharray="${st.dash}"`:''}/></g>`;
 if(g.kind==='target'){const a=worldToScreen(g.origin,t),b=worldToScreen(g.tip,t);body+=`<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${PALETTE.ink}" stroke-width="1.5" stroke-dasharray="3 5" fill="none"/><circle cx="${b.x}" cy="${b.y}" r="13" fill="none" stroke="${v.color}" stroke-width="2"/>`;}
 if(s.secondary){const o=worldToScreen(g.origin,t),p={x:Math.min(width-90,Math.max(8,o.x+12)),y:Math.max(16,o.y-16)};body+=`<text x="${p.x}" y="${p.y}" font-size="12" font-family="sans-serif" fill="${PALETTE.ink}" stroke="${PALETTE.cream}" stroke-width="3" paint-order="stroke">NEXT / 다음</text>`;}}
 if(v.active&&v.role==='spawn')for(const s of v.shapes.slice(1)){const a=glyphAnchor({...v,anchor:s.geometry.tip},t);body+=`<g transform="translate(${a.x-24} ${a.y-24}) scale(${48/28}) translate(2 2)" stroke-linejoin="round" stroke-linecap="round">${glyphPartsSVG(GLYPHS[v.glyph],v.monochrome)}</g>`;}
 const a=glyphAnchor(v,t);body+=`<g transform="translate(${a.x-24} ${a.y-24}) scale(${48/28}) translate(2 2)" stroke-linejoin="round" stroke-linecap="round">${glyphPartsSVG(GLYPHS[v.glyph],v.monochrome)}</g>`;
 const r=decoration(v);if(r!==null)body+=`<path d="M${a.x-20-r} ${a.y}h-5 M${a.x+20+r} ${a.y}h5 M${a.x} ${a.y-20-r}v-5" stroke="${PALETTE.ink}" stroke-width="2" fill="none"/>`;
 if(v.phase==='cancelled')body+=`<path d="M${a.x-20} ${a.y+20}l40 -40" stroke="${PALETTE.ink}" stroke-width="3"/>`;
 if(v.interruptProgress!==null&&v.glyph==='charge'&&v.active)body+=`<path d="M${a.x-22} ${a.y+29}h44" stroke="${PALETTE.ink}" stroke-width="7"/><path d="M${a.x-22} ${a.y+29}h${44*v.interruptProgress}" stroke="${PALETTE.gold}" stroke-width="3"/>`;
 const count=v.remainingPulses??v.remainingAttacks;if(count!==null&&v.active)for(let n=0;n<count;n++)body+=`<rect x="${a.x-12+n*9}" y="${a.y+27}" width="6" height="5" fill="${PALETTE.ink}"/>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(v.label)} · demo, not live combat</title>${body}</svg>`;
}
export function drawTelegraph(ctx,event,{width=360,height=225,...options}={}){
 const t=worldTransform(width,height),v=prepareVisual(event,options);if(!v.visible)return v;ctx.save();try{ctx.lineJoin='round';ctx.lineCap='butt';if(v.active)for(const s of v.shapes){const g=s.geometry,st=style(v,s);ctx.save();ctx.translate(t.offsetX,t.offsetY);ctx.scale(t.scale,t.scale);ctx.setLineDash(st.dash.map(x=>x/t.scale));if(g.commands.length){pathCanvas(ctx,g.commands);if(st.fill){ctx.save();ctx.globalAlpha*=st.fill;ctx.fillStyle=v.color;ctx.fill();ctx.restore();}ctx.lineWidth=6/t.scale;ctx.strokeStyle=PALETTE.cream;ctx.stroke();ctx.lineWidth=3/t.scale;ctx.strokeStyle=PALETTE.ink;ctx.stroke();}ctx.restore();
 if(g.kind==='target'){const a=worldToScreen(g.origin,t),b=worldToScreen(g.tip,t);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.setLineDash([3,5]);ctx.lineWidth=1.5;ctx.strokeStyle=PALETTE.ink;ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(b.x,b.y,13,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle=v.color;ctx.stroke();}
 if(s.secondary){const o=worldToScreen(g.origin,t),p={x:Math.min(width-90,Math.max(8,o.x+12)),y:Math.max(16,o.y-16)};ctx.font='12px sans-serif';ctx.lineWidth=3;ctx.strokeStyle=PALETTE.cream;ctx.strokeText('NEXT / 다음',p.x,p.y);ctx.fillStyle=PALETTE.ink;ctx.fillText('NEXT / 다음',p.x,p.y);}}
 if(v.active&&v.role==='spawn')for(const s of v.shapes.slice(1)){const a=glyphAnchor({...v,anchor:s.geometry.tip},t);drawGlyph(ctx,v.glyph,a.x,a.y,48,v.monochrome);}
 const a=glyphAnchor(v,t);ctx.setLineDash([]);drawGlyph(ctx,v.glyph,a.x,a.y,48,v.monochrome);const r=decoration(v);if(r!==null){ctx.beginPath();ctx.moveTo(a.x-20-r,a.y);ctx.lineTo(a.x-25-r,a.y);ctx.moveTo(a.x+20+r,a.y);ctx.lineTo(a.x+25+r,a.y);ctx.moveTo(a.x,a.y-20-r);ctx.lineTo(a.x,a.y-25-r);ctx.lineWidth=2;ctx.strokeStyle=PALETTE.ink;ctx.stroke();}
 if(v.phase==='cancelled'){ctx.beginPath();ctx.moveTo(a.x-20,a.y+20);ctx.lineTo(a.x+20,a.y-20);ctx.lineWidth=3;ctx.strokeStyle=PALETTE.ink;ctx.stroke();}
 if(v.interruptProgress!==null&&v.glyph==='charge'&&v.active){ctx.beginPath();ctx.moveTo(a.x-22,a.y+29);ctx.lineTo(a.x+22,a.y+29);ctx.lineWidth=7;ctx.strokeStyle=PALETTE.ink;ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-22,a.y+29);ctx.lineTo(a.x-22+44*v.interruptProgress,a.y+29);ctx.lineWidth=3;ctx.strokeStyle=PALETTE.gold;ctx.stroke();}
 const count=v.remainingPulses??v.remainingAttacks;if(count!==null&&v.active){ctx.fillStyle=PALETTE.ink;for(let n=0;n<count;n++)ctx.fillRect(a.x-12+n*9,a.y+27,6,5);}
 }finally{ctx.restore();}return v;
}
