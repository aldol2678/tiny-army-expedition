'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const art=require('../src/game-art.js');
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

const frames=[{}, {prepare:1}, {attack:1}, {attack:.7}, {attack:.25}, {hit:1}, {deathProgress:.6}];
for(const reducedMotion of [false,true])for(const lowEffects of [false,true])for(const facing of [-1,1])for(const frame of frames){
 const unit=Object.freeze({type:'mage',x:1,y:2,r:18,anchor:'feet',phase:.7,actionKind:'arcane_bolt',reducedMotion,lowEffects,facing,...frame});
 const a=recording(),b=recording();art.drawUnit(a.ctx,unit);art.drawUnit(b.ctx,unit);a.balanced();b.balanced();assert.deepEqual(a.calls,b.calls);assert(a.calls.length<600);
 if(reducedMotion){const c=recording();art.drawUnit(c.ctx,{...unit,phase:0,moving:true});assert.deepEqual(a.calls,c.calls);}
}
const samples=frames.slice(0,5).map(frame=>{const r=recording();art.drawUnit(r.ctx,{type:'mage',actionKind:'arcane_bolt',...frame});return JSON.stringify(r.calls)});assert(new Set(samples).size>=4);
for(const kind of ['arcane_bolt','mage_bolt','arcane_hit'])for(const reducedMotion of [false,true]){
 const r=recording();art.drawEffect(r.ctx,{kind,progress:.3,reducedMotion});r.balanced();assert(!r.calls.some(c=>c[0]==='arc'||c[0]==='ellipse'),'caster effects have no area ring');
 const done=recording();art.drawEffect(done.ctx,{kind,progress:1});assert.equal(done.calls.length,0);
}
const sandbox={};vm.createContext(sandbox);
for(const file of ['src/game-ui-art.js','procedural-art/relic-art.js','procedural-art/rarity-art.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
const ui=sandbox.TinyArmyUIArt,newArt=sandbox.TinyArmyV08Art,rarity=sandbox.TinyArmyRarityArt;
for(const type of ['spear','guardian','charger','archer','sniper','volley','support','mage'])assert(ui.portrait(type).includes('<svg'));
assert.notEqual(ui.portrait('mage'),ui.portrait('spear'));
for(const id of ['keen_eye','arcane_lens'])for(const tier of rarity.tiers){
 const svg=newArt.icon(id,tier.id,{decorative:true});assert(svg.includes(`data-rarity="${tier.id}"`));assert(svg.includes(newArt.motifs[id]));assert(!svg.includes('<g aria-hidden="true"><rect'));assert(!/https?:/.test(svg.replace('http://www.w3.org/2000/svg','')));
 const accessible=newArt.icon(id,tier.id,{label:'<test>'});assert(accessible.includes('&lt;test&gt;'));assert(accessible.includes('role="img"'));
}
assert.equal(newArt.icon('keen_eye','invalid'),undefined);assert.equal(newArt.icon('unknown','common'),undefined);
assert(newArt.icon('relic-marching-banner','common',{decorative:true}).includes('data-rarity="common"'));
if(process.argv.includes('--sheet')){
 const content=['<rect width="1120" height="700" fill="#eef0e4"/>','<text x="24" y="30" font-size="22" fill="#203548">TINY ARMY v0.8 / original caster and relic art</text>'];
 ['READY','PREPARE','CAST','RECOIL','RECOVER','HIT','FALL'].forEach((name,i)=>{content.push(`<text x="${34+i*155}" y="68" font-size="12">${name}</text>`);const r=recording();art.drawUnit(r.ctx,{type:'mage',actionKind:'arcane_bolt',x:65+i*155,y:185,r:26,anchor:'feet',...frames[i]});content.push(...r.shapes)});
 ['mage_bolt','arcane_bolt','arcane_hit'].forEach((kind,i)=>{content.push(`<text x="${24+i*250}" y="238" font-size="13">${kind}: single target</text>`);const r=recording();art.drawEffect(r.ctx,{kind,x:170+i*250,y:265,progress:.25});content.push(...r.shapes)});
 ['keen_eye','arcane_lens'].forEach((id,row)=>{const y=318+row*165;content.push(`<text x="24" y="${y+45}" font-size="15">${id}</text>`);rarity.tiers.forEach((tier,col)=>{const x=200+col*170;content.push(`<g transform="translate(${x} ${y})">${newArt.icon(id,tier.id,{size:110,decorative:true})}</g><text x="${x}" y="${y+132}" font-size="13">${tier.id}</text>`);})});
 fs.writeFileSync('reports/v08-caster-relic-contact-sheet.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="700" viewBox="0 0 1120 700" font-family="sans-serif">${content.join('')}</svg>`);
}
console.log('v08-caster-art: 56 deterministic pose variants; reduced motion; single-target bolt/impact; mage portrait; 10 framed relic variants; legacy fallback PASS');
