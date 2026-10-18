'use strict';
// Draw-only contract checks. Canvas facade records geometry; no game engine is invoked.
const assert=require('node:assert/strict'),fs=require('node:fs');
const art=require('../src/game-art.js');
const roles=['spear','guardian','charger','archer','sniper','volley','support','melee','raider','bomber','brute','armored','swarm','boss'];
function recording(){
 const calls=[],stack=[],shapes=[];let path='',transform='';
 const ctx={globalAlpha:1,fillStyle:'#000',strokeStyle:'#000',lineWidth:1};
 function color(value){return value.replace(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/,'rgb($1,$2,$3)')}
 function opacity(value){const m=value.match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);return m?Number(m[1]):1}
 function add(d,fill,stroke){shapes.push(`<path d="${d}" transform="${transform}" fill="${fill?color(ctx.fillStyle):'none'}" stroke="${stroke?color(ctx.strokeStyle):'none'}" fill-opacity="${opacity(ctx.fillStyle)}" stroke-opacity="${opacity(ctx.strokeStyle)}" stroke-width="${ctx.lineWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${ctx.globalAlpha}"/>`)}
 const methods={
 save(){stack.push({transform,globalAlpha:ctx.globalAlpha,fillStyle:ctx.fillStyle,strokeStyle:ctx.strokeStyle,lineWidth:ctx.lineWidth})},restore(){assert(stack.length);const state=stack.pop();transform=state.transform;Object.assign(ctx,state)},
 translate(x,y){transform+=` translate(${x} ${y})`},scale(x,y){transform+=` scale(${x} ${y})`},rotate(a){transform+=` rotate(${a*180/Math.PI})`},
 beginPath(){path=''},moveTo(x,y){path+=`M${x} ${y}`},lineTo(x,y){path+=`L${x} ${y}`},closePath(){path+='Z'},quadraticCurveTo(a,b,c,d){path+=`Q${a} ${b} ${c} ${d}`},
 ellipse(x,y,rx,ry,rotation,start,end){for(let i=0;i<=36;i++){const a=start+(end-start)*i/36,px=x+Math.cos(a)*rx,py=y+Math.sin(a)*ry;path+=`${i?'L':'M'}${px} ${py}`}},
 arc(x,y,r,a,b){methods.ellipse(x,y,r,r,0,a,b)},
 fill(){add(path,true,false)},stroke(){add(path,false,true)},fillRect(x,y,w,h){add(`M${x} ${y}h${w}v${h}h${-w}Z`,true,false)},strokeRect(x,y,w,h){add(`M${x} ${y}h${w}v${h}h${-w}Z`,false,true)}
 };
 for(const [name,fn]of Object.entries(methods))ctx[name]=(...args)=>{args.forEach(a=>{if(typeof a==='number')assert(Number.isFinite(a),name+' finite')});calls.push([name,...args]);return fn(...args)};
 return{ctx,calls,shapes,balanced(){assert.equal(stack.length,0);assert.equal(ctx.globalAlpha,1)}};
}
const frames=[{prepare:0,attack:0},{prepare:1,attack:0},{prepare:0,attack:1},{prepare:0,attack:.7},{prepare:0,attack:.25},{prepare:0,attack:0,hit:1},{prepare:0,attack:0,deathProgress:.6}];
for(const role of roles)for(const reducedMotion of [false,true])for(const lowEffects of [false,true])for(const facing of [-1,1])for(const frame of frames){
 const input=Object.freeze({type:role,enemy:roles.indexOf(role)>=7,phase:.7,x:10,y:20,r:18,anchor:'feet',facing,reducedMotion,lowEffects,actionKind:role==='support'?'heal':'attack',...frame});
 const r=recording();art.drawUnit(r.ctx,input);r.balanced();assert(r.calls.length<600,'bounded draw cost');
 const repeat=recording();art.drawUnit(repeat.ctx,input);assert.deepEqual(r.calls,repeat.calls,'deterministic geometry');
 assert(r.calls.some(c=>c[0]==='translate'&&c[1]===0&&c[2]===-14),'feet anchor');
 if(reducedMotion){const zero=recording();art.drawUnit(zero.ctx,{...input,phase:0,moving:true});assert.deepEqual(zero.calls,r.calls,'reduced motion ignores idle/walk clock');}
}
for(const role of roles){const samples=frames.slice(0,5).map(frame=>{const r=recording();art.drawUnit(r.ctx,{type:role,enemy:roles.indexOf(role)>=7,...frame});return JSON.stringify(r.calls)});assert(new Set(samples).size>=4,role+' has distinct preparation/contact/recoil/recovery');}
for(const type of ['death','hit','block','heal'])for(const reducedMotion of [false,true]){const r=recording();art.drawEffect(r.ctx,{type,reducedMotion,progress:.3});r.balanced();const done=recording();art.drawEffect(done.ctx,{type,progress:1});assert.equal(done.calls.length,0,'completed effects draw nothing');}
if(process.argv.includes('--sheet')){
 const names=['READY','ANTICIPATE','CONTACT','RECOIL','RECOVER','HIT','FALL'];
 const content=[`<rect width="1120" height="${roles.length*115+100}" fill="#eef0e4"/>`,`<text x="22" y="28" font-size="19" font-weight="700">TINY ARMY / v0.7.1 combat poses</text>`];
 names.forEach((name,i)=>content.push(`<text x="${155+i*140}" y="58" font-size="11" fill="#35544b">${name}</text>`));
 roles.forEach((role,row)=>{const y=135+row*115;content.push(`<text x="22" y="${y-16}" font-size="13" fill="#35544b">${role}</text>`);frames.forEach((frame,col)=>{const r=recording();art.drawUnit(r.ctx,{type:role,enemy:row>=7,x:183+col*140,y,r:23,anchor:'feet',actionKind:role==='support'?'heal':'attack',...frame});content.push(...r.shapes)})});
 fs.writeFileSync('reports/v071-combat-contact-sheet.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="${roles.length*115+100}" viewBox="0 0 1120 ${roles.length*115+100}" font-family="sans-serif">${content.join('')}</svg>`);
}
console.log('v071-combat-art: 784 deterministic frames, planted anchors, finite/bounded geometry, balanced state, reduced-motion and phase separation PASS');
