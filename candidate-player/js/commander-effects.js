/* Tiny Army — Commander effect candidates 1.0
 * Original deterministic Canvas/SVG geometry. Imported for v0.9 via v09-art.js adapter.
 * Apply an instantaneous skill in the simulation first, then show this burst.
 * The visual windup is decorative gathering, never a gameplay cast delay.
 * Caller owns time, pooling, target, status duration, canvas clearing and layers.
 */
(function(root){
  'use strict';
  const C=Object.freeze({ink:'#203548',navy:'#284456',teal:'#318d8c',mint:'#7dd5bc',cream:'#fff0cb',pale:'#fff9e7',gold:'#f6c772',coral:'#d47a65',steel:'#b8d5d5',white:'#ffffff'});
  const TYPES=Object.freeze(['heal','guard','focus','rally']);
  const DESCRIPTORS=Object.freeze([
    {type:'heal',name:'응급 회복',visualDurationMs:900,statusDurationSeconds:0,color:C.teal,meaning:'최대 체력 15% 즉시 회복. 컨디션 회복 없음.',shape:'청록/흰 십자와 회복 물결'},
    {type:'guard',name:'수호 진형',visualDurationMs:760,statusDurationSeconds:4,color:C.teal,meaning:'생존 아군 피해 감소 +20%p, 4초. 피해 감소 상한 55%.',shape:'겹 방패와 보호 장벽'},
    {type:'focus',name:'집중 사격',visualDurationMs:800,statusDurationSeconds:6,color:C.coral,meaning:'적 하나를 6초 표시. 정상 사거리 내 우선 공격, 해당 적 기본공격 피해 +10%.',shape:'열린 조준선과 대상 지시점'},
    {type:'rally',name:'사기 고양',visualDurationMs:940,statusDurationSeconds:5,color:C.gold,meaning:'5초간 기본공격 게이지 소진 속도 +25%. 치유·고유 기술 가속 없음.',shape:'뿔나팔과 리본 파동'}
  ].map(d=>Object.freeze({...d,bounds:Object.freeze([-72,-64,72,64])})));
  const finite=(v,f)=>typeof v==='number'&&Number.isFinite(v)?v:f;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
  const ease=v=>1-Math.pow(1-clamp(v,0,1),3);
  const phase=p=>p>=1?'complete':p<.18?'windup':p<.60?'impact':'fade';
  function shape(out,d,fill=null,stroke=null,width=1.8,alpha=1){out.push({d,fill,stroke,width,alpha});}
  function poly(out,pts,fill,stroke,width=1.8,alpha=1){shape(out,pts.map((p,i)=>[i?'L':'M',...p]).concat([['Z']]),fill,stroke,width,alpha);}
  function line(out,pts,stroke,width=1.8,alpha=1){shape(out,pts.map((p,i)=>[i?'L':'M',...p]),null,stroke,width,alpha);}
  function ellipse(out,x,y,rx,ry,fill,stroke,width=1.8,alpha=1){
    const k=.5522847498307936;
    shape(out,[['M',x+rx,y],['C',x+rx,y+k*ry,x+k*rx,y+ry,x,y+ry],['C',x-k*rx,y+ry,x-rx,y+k*ry,x-rx,y],['C',x-rx,y-k*ry,x-k*rx,y-ry,x,y-ry],['C',x+k*rx,y-ry,x+rx,y-k*ry,x+rx,y],['Z']],fill,stroke,width,alpha);
  }
  function star(out,x,y,r,color,alpha=1){poly(out,[[x,y-r],[x+r*.28,y-r*.25],[x+r,y],[x+r*.28,y+r*.25],[x,y+r],[x-r*.28,y+r*.25],[x-r,y],[x-r*.28,y-r*.25]],color,null,1,alpha);}
  function cross(out,x,y,s,fill,stroke,w=1.8){const q=4*s,l=12*s;poly(out,[[x-q,y-l],[x+q,y-l],[x+q,y-q],[x+l,y-q],[x+l,y+q],[x+q,y+q],[x+q,y+l],[x-q,y+l],[x-q,y+q],[x-l,y+q],[x-l,y-q],[x-q,y-q]],fill,stroke,w);}
  function shield(out,x,y,s,fill,stroke,width=2){shape(out,[['M',x,y-24*s],['Q',x+10*s,y-18*s,x+19*s,y-18*s],['L',x+17*s,y+7*s],['Q',x+12*s,y+21*s,x,y+27*s],['Q',x-12*s,y+21*s,x-17*s,y+7*s],['L',x-19*s,y-18*s],['Q',x-10*s,y-18*s,x,y-24*s],['Z']],fill,stroke,width);}
  function horn(out,shift=0){
    // The open bell is on the right; the cream lip gives the silhouette direction.
    shape(out,[['M',-22,5+shift],['Q',-9,10+shift,7,-13+shift],['L',21,-18+shift],['Q',11,7+shift,-7,15+shift],['Q',-15,18+shift,-24,12+shift],['Z']],C.gold,C.ink,2.4);
    poly(out,[[5,-14+shift],[18,-21+shift],[27,-1+shift],[13,3+shift]],C.cream,C.ink,2.2);
    line(out,[[10,-14+shift],[19,-17+shift],[24,-4+shift],[16,-1+shift]],C.gold,2.2);
    poly(out,[[-26,4+shift],[-19,5+shift],[-21,14+shift],[-28,12+shift]],C.mint,C.ink,1.8);
    line(out,[[-5,8+shift],[-2,12+shift]],C.cream,2.8);
  }
  function core(out,type,q=1){
    if(type==='heal'){
      ellipse(out,0,-6,23,23,C.mint,C.ink,2.3);
      ellipse(out,0,-6,19,19,C.teal,null);
      cross(out,0,-6,1.08,C.white,null);
      line(out,[[-12,24],[-6,29],[0,24],[6,29],[12,24]],C.teal,2.3);
    }else if(type==='guard'){
      shield(out,0,-2,1,C.cream,C.ink,2.5);
      shield(out,0,-2,.78,C.teal,C.gold,2.1);
      poly(out,[[0,-17],[8,-7],[0,5],[-8,-7]],C.mint,C.ink,1.5);
      line(out,[[0,4],[0,14]],C.gold,2.7);
      line(out,[[-10,12],[0,18],[10,12]],C.cream,1.8);
    }else if(type==='focus'){
      const r=24+(1-q)*7,l=9;
      for(const sx of [-1,1])for(const sy of [-1,1]){
        line(out,[[sx*(r-l),sy*r],[sx*r,sy*r],[sx*r,sy*(r-l)]],C.ink,6.5);
        line(out,[[sx*(r-l),sy*r],[sx*r,sy*r],[sx*r,sy*(r-l)]],C.gold,3.1);
      }
      for(const [x,y,dx,dy] of [[-15,0,5,0],[15,0,-5,0],[0,-15,0,5],[0,15,0,-5]])line(out,[[x,y],[x+dx,y+dy]],C.coral,2.7);
      ellipse(out,0,0,3,3,C.cream,C.ink,1.5);
      poly(out,[[-7,-43],[7,-43],[0,-32]],C.coral,C.ink,1.9);
    }else{
      // Ribbon is a motif of morale only; it does not imply movement speed.
      shape(out,[['M',-28,22],['Q',-7,29,19,14],['L',24,22],['Q',-5,38,-31,31],['L',-25,28],['Z']],C.teal,C.ink,1.8);
      line(out,[[-20,26],[0,26],[16,20]],C.mint,1.6);
      horn(out,-3+(1-q)*2);
    }
  }
  function scene(type,p,reduced,low){
    const out=[],q=reduced?1:ease(p/.6),arrival=reduced?1:smooth(p/.18),decor=reduced?1:(.28+.72*arrival);
    const fade=reduced?1:1-smooth((p-.6)/.4),baseOpacity=reduced?1:(.68+.32*arrival)*fade;
    if(type==='heal'){
      const r=reduced?43:19+32*q;
      ellipse(out,0,22,r,r*.28,C.mint,null,1,.10*decor);
      ellipse(out,0,22,r,r*.28,null,C.teal,3.1,.80*decor);
      if(!low)ellipse(out,0,22,r*.76,r*.19,null,C.cream,1.8,.90*decor);
      if(!reduced){
        for(let i=0;i<(low?0:4);i++){
          const side=i%2?-1:1,x=side*(28+(i>1?14:0)),y=14-(q*25)-(i>1?9:0);
          cross(out,x,y,.22+(i>1?0:.05),i%2?C.teal:C.mint,null);
        }
      }
      if(!low){
        shape(out,[['M',-19,16],['Q',-40,11,-41,-6],['Q',-21,-4,-19,16],['Z']],C.mint,C.teal,1.6,decor);
        shape(out,[['M',19,16],['Q',40,11,41,-6],['Q',21,-4,19,16],['Z']],C.mint,C.teal,1.6,decor);
      }
      core(out,type,q);
      if(!reduced&&!low){star(out,-31,-31-q*6,3,C.cream);star(out,30,-22-q*9,3.5,C.white);}
    }else if(type==='guard'){
      const spread=reduced?32:19+15*q;
      ellipse(out,0,28,49,11,C.teal,null,1,.10*decor);
      if(!low){
        shield(out,-spread,-1,.72,null,C.teal,2.1);shield(out,spread,-1,.72,null,C.teal,2.1);
        line(out,[[-49,11],[-49,-15],[-35,-25]],C.mint,2.6,decor);
        line(out,[[49,11],[49,-15],[35,-25]],C.mint,2.6,decor);
      }
      shield(out,0,-2,1.38,null,C.mint,3.2);
      core(out,type,q);
      if(!low&&!reduced){for(const sx of [-1,1]){star(out,sx*(32+8*q),-31+5*q,3.7,C.gold);line(out,[[sx*52,-8],[sx*(55+4*q),-11]],C.gold,2);}}
    }else if(type==='focus'){
      const r=reduced?43:31+14*q;
      ellipse(out,0,30,r,9,null,C.gold,1.8,.50*decor);
      if(!low){
        for(const sx of [-1,1]){
          const x=sx*(40+(1-q)*9);
          poly(out,[[x,-5],[x-sx*6,0],[x,5]],C.coral,C.ink,1.3,decor);
        }
      }
      core(out,type,q);
      if(!low&&!reduced){line(out,[[-9,-51],[0,-55],[9,-51]],C.gold,1.8,decor);}
    }else{
      const spread=reduced?0:6*q;
      if(!low){
        shape(out,[['M',30+spread,-30],['Q',43+spread,-17,40+spread,-4]],null,C.gold,3.0,decor);
        shape(out,[['M',39+spread,-34],['Q',55+spread,-17,50+spread,0]],null,C.teal,2.2,decor);
      }
      ellipse(out,0,32,39+spread,9,null,C.gold,2.4,.70*decor);
      core(out,type,q);
      if(!reduced&&!low){
        poly(out,[[-42,-7-9*q],[-36,-13-9*q],[-30,-7-9*q],[-30,-1-9*q],[-36,-7-9*q],[-42,-1-9*q]],C.gold,C.ink,1.3);
        star(out,-16,-31-7*q,3.4,C.cream);star(out,5,-43,2.4,C.gold);
      }
    }
    return {shapes:out,opacity:baseOpacity,phase:phase(p)};
  }
  function normalize(options){
    const o=options&&typeof options==='object'?options:{};
    return {type:o.type,x:clamp(finite(o.x,0),-1e6,1e6),y:clamp(finite(o.y,0),-1e6,1e6),progress:clamp(finite(o.progress,0),0,1),scale:clamp(finite(o.scale,1),0,8),reducedMotion:o.reducedMotion===true,lowEffects:o.lowEffects===true};
  }
  function buildPath(PathCtor,commands){const p=new PathCtor();for(const d of commands){if(d[0]==='M')p.moveTo(d[1],d[2]);else if(d[0]==='L')p.lineTo(d[1],d[2]);else if(d[0]==='Q')p.quadraticCurveTo(...d.slice(1));else if(d[0]==='C')p.bezierCurveTo(...d.slice(1));else p.closePath();}return p;}
  function createRenderer(PathCtor){
    if(typeof PathCtor!=='function')throw new TypeError('Canvas Path2D constructor is required.');
    function draw(ctx,options){
      const o=normalize(options);
      if(!ctx||!TYPES.includes(o.type)||o.progress>=1||o.scale<=0)return false;
      const s=scene(o.type,o.progress,o.reducedMotion,o.lowEffects);
      // Some native Canvas adapters restore paint state but cache stale style
      // getters. Explicitly restoring these two values preserves both contracts.
      const previousFill=ctx.fillStyle,previousStroke=ctx.strokeStyle;
      ctx.save();
      try{
        ctx.translate(o.x,o.y);ctx.scale(o.scale,o.scale);
        ctx.globalCompositeOperation='source-over';ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
        if('filter' in ctx)ctx.filter='none';
        ctx.lineCap='round';ctx.lineJoin='round';ctx.miterLimit=2;ctx.setLineDash([]);ctx.lineDashOffset=0;
        const inherited=clamp(finite(ctx.globalAlpha,1),0,1);
        for(const item of s.shapes){
          ctx.globalAlpha=inherited*s.opacity*item.alpha;
          const path=buildPath(PathCtor,item.d);
          if(item.fill){ctx.fillStyle=item.fill;ctx.fill(path);}
          if(item.stroke){ctx.strokeStyle=item.stroke;ctx.lineWidth=item.width;ctx.stroke(path);}
        }
      }finally{ctx.restore();ctx.fillStyle=previousFill;ctx.strokeStyle=previousStroke;}
      return true;
    }
    return Object.freeze({draw});
  }
  function draw(ctx,options){
    // Do not cache DOM state, clocks, Canvas objects, mutable particles or RNG.
    if(typeof root.Path2D!=='function')throw new TypeError('Use createRenderer(Path2D) in native Canvas.');
    return createRenderer(root.Path2D).draw(ctx,options);
  }
  function svg(type,variant='icon'){
    if(!TYPES.includes(type))throw new TypeError('Unknown effect type.');
    const out=[];core(out,type,1);
    const d=DESCRIPTORS.find(d=>d.type===type),status=variant==='status',size=status?48:96,scale=status?.48:.9,cy=status?25:49;
    const body=out.map(s=>`<path d="${s.d.map(d=>d.map(v=>typeof v==='number'?Number(v.toFixed(4)):v).join(' ')).join(' ')}" fill="${s.fill||'none'}" stroke="${s.stroke||'none'}" stroke-width="${s.width}" opacity="${s.alpha}"/>`).join('');
    const badge=status?`<circle cx="24" cy="24" r="22" fill="${C.pale}" stroke="${C.ink}" stroke-width="2"/>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-labelledby="title"><title id="title">${d.name} ${status?'상태 표시':'기술 아이콘'}</title>${badge}<g transform="translate(${size/2} ${cy}) scale(${scale})" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>\n`;
  }
  const api=Object.freeze({version:'1.0.0-candidate',draw,createRenderer,svg,types:TYPES,descriptors:DESCRIPTORS,colors:C,phase:p=>phase(clamp(finite(p,0),0,1))});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TinyArmyCommanderEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this);
