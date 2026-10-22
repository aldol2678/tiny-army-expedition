/* Tiny Army skill effects 0.5.0 | Original Canvas geometry | No game integration.
 * Browser: TinyArmyEffects.drawEffect(ctx, kind, options)
 * Native Canvas: TinyArmyEffects.createRenderer(Path2D).drawEffect(...)
 * Clock, event dispatch, lifetime, pooling, and gameplay belong to the caller.
 */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const COLORS = Object.freeze({
    ink: '#203548', navy: '#284456', teal: '#318d8c', mint: '#7dd5bc',
    cream: '#fff0cb', pale: '#fff9e7', gold: '#f6c772', coral: '#d47a65',
    rust: '#bc5953', wine: '#673b4e', steel: '#b8d5d5'
  });
  const DESCRIPTORS = Object.freeze([
    {kind:'spear-strike', name:'Spear strike', nameKo:'창 찌르기', durationMs:360, role:'Directional slash and contact mark', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'sniper-hit', name:'Charged shot', nameKo:'집중 사격', durationMs:520, role:'Converging sights, single decisive impact', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'volley-trails', name:'Volley trails', nameKo:'연발 화살', durationMs:600, role:'Three staggered, separate arrow trails', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'guardian-block', name:'Guardian block', nameKo:'수호 방패', durationMs:540, role:'Shield silhouette, rim and deflected fragments', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'healing-burst', name:'Healing bloom', nameKo:'치유의 빛', durationMs:900, role:'Rounded mint sprouts and clear healing sign', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'rally-wave', name:'Rally wave', nameKo:'진군의 함성', durationMs:1000, role:'Ground wave with rising banner chevrons', bounds:[-56,-48,56,48], layer:'above-ground'},
    {kind:'enemy-slam', name:'Enemy slam', nameKo:'적 내려치기', durationMs:600, telegraphDurationMs:850, role:'Explicit separate telegraph/contact phases', bounds:[-56,-48,56,48], layer:'phase-dependent', phases:['telegraph','contact']},
    {kind:'relic-halo', name:'Relic awakening', nameKo:'유물 각성', durationMs:1250, role:'Gold halo, diamond rune and four orbital marks', bounds:[-56,-48,56,48], layer:'above-units'},
    {kind:'focus-target', name:'Focus target', nameKo:'집중 공격 표식', durationMs:900, role:'Target selection brackets and converging pointer', bounds:[-56,-48,56,48], layer:'above-units'}
  ].map(d=>Object.freeze(Object.assign({},d,{bounds:Object.freeze([-64,-48,64,48]),...(d.phases?{phases:Object.freeze(d.phases)}:{})}))));
  const KINDS = Object.freeze(DESCRIPTORS.map(d=>d.kind));
  const byKind = Object.freeze(Object.fromEntries(DESCRIPTORS.map(d=>[d.kind,d])));
  const finite = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const smooth = value => {const v=clamp(value,0,1);return v*v*(3-2*v);};
  const easeOut = value => 1-Math.pow(1-clamp(value,0,1),3);
  // One gentle onset, one fade. Never periodic flashes or automatic repeats.
  const opacity = p => smooth(p/.12)*(1-smooth((p-.58)/.42));

  function createRenderer(PathCtor) {
    if(typeof PathCtor !== 'function') throw new TypeError('A standard Canvas Path2D constructor is required.');
    function shape(ctx, build, fill, stroke, width) {
      const path = new PathCtor(); build(path);
      if(fill){ctx.fillStyle=fill;ctx.fill(path);}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width || 1.6;ctx.stroke(path);}
    }
    function polygon(ctx,points,fill,stroke,width) {
      shape(ctx,p=>{points.forEach((a,i)=>i?p.lineTo(a[0],a[1]):p.moveTo(a[0],a[1]));p.closePath();},fill,stroke,width);
    }
    function line(ctx,points,color,width) {
      shape(ctx,p=>points.forEach((a,i)=>i?p.lineTo(a[0],a[1]):p.moveTo(a[0],a[1])),null,color,width);
    }
    function ellipse(ctx,x,y,rx,ry,fill,stroke,width) {
      shape(ctx,p=>p.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU),fill,stroke,width);
    }
    function arc(ctx,x,y,r,start,end,color,width) {
      shape(ctx,p=>p.arc(x,y,Math.max(.01,r),start,end),null,color,width);
    }
    function star(ctx,x,y,r,color,rotation=0,outline=true) {
      const points=[];
      for(let i=0;i<8;i++){
        const angle=i*Math.PI/4+rotation,rr=i%2?r*.32:r;
        points.push([x+Math.cos(angle)*rr,y+Math.sin(angle)*rr]);
      }
      polygon(ctx,points,color,outline?COLORS.ink:null,1.1);
    }
    function plus(ctx,x,y,size,color) {
      const a=size*.33,b=size;
      polygon(ctx,[[-a,-b],[a,-b],[a,-a],[b,-a],[b,a],[a,a],[a,b],[-a,b],[-a,a],[-b,a],[-b,-a],[-a,-a]].map(pt=>[pt[0]+x,pt[1]+y]),color,COLORS.ink,1.3);
    }
    function arrow(ctx,x,y,length,color) {
      line(ctx,[[x-length,y],[x-5,y]],COLORS.ink,3.7);
      line(ctx,[[x-length,y],[x-5,y]],color,1.6);
      polygon(ctx,[[x-7,y-3],[x,y],[x-7,y+3]],COLORS.cream,COLORS.ink,.95);
    }
    function shield(ctx,x,y,size,fill,stroke) {
      const s=size/24;
      polygon(ctx,[[-11,-15],[0,-20],[11,-15],[10,3],[6,11],[0,16],[-6,11],[-10,3]].map(p=>[x+p[0]*s,y+p[1]*s]),fill,stroke,1.8);
    }
    function atAlpha(ctx,amount,fn) {ctx.save();try{ctx.globalAlpha*=clamp(amount,0,1);fn();}finally{ctx.restore();}}

    function spear(ctx,p,low) {
      const q=low?.42:easeOut(p),dx=low?0:(q-.5)*8;
      shape(ctx,path=>{
        path.moveTo(-36+dx,14);path.quadraticCurveTo(-11+dx,-18,29+dx,-16);
        path.quadraticCurveTo(7+dx,-11,-4+dx,-3);path.quadraticCurveTo(-22+dx,4,-36+dx,14);path.closePath();
      },COLORS.cream,COLORS.ink,1.6);
      shape(ctx,path=>{path.moveTo(-28+dx,9);path.quadraticCurveTo(-5+dx,-10,22+dx,-13);},null,COLORS.teal,2.4);
      const hit=low?1:smooth((p-.14)/.15);
      atAlpha(ctx,hit,()=>{
        star(ctx,22,-12,low?8:10-p*4,COLORS.gold,.1);
        if(!low){
          const d=9+q*9;
          line(ctx,[[26,-18],[26+d*.45,-18-d*.45]],COLORS.coral,2);
          line(ctx,[[30,-8],[34+d*.6,-6]],COLORS.teal,2);
          line(ctx,[[23,-1],[23+d*.25,3+d*.4]],COLORS.gold,2);
        }
      });
    }
    function sniper(ctx,p,low) {
      const converge=low?1:smooth(p/.32),gap=20-converge*8;
      // Open sight corners never cover the contact point.
      for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
        line(ctx,[[x*(gap+6),y*gap],[x*gap,y*gap],[x*gap,y*(gap+6)]],COLORS.ink,3.3);
        line(ctx,[[x*(gap+6),y*gap],[x*gap,y*gap],[x*gap,y*(gap+6)]],COLORS.teal,1.6);
      }
      const impact=low?1:smooth((p-.19)/.12);
      atAlpha(ctx,impact,()=>{
        line(ctx,[[-42,0],[31,0]],COLORS.ink,low?2.8:3.8);
        line(ctx,[[-42,0],[31,0]],COLORS.gold,low?1.2:1.8);
        star(ctx,0,0,low?8:13-5*p,COLORS.cream,0);
        ellipse(ctx,0,0,3,3,COLORS.gold,COLORS.ink,1);
        if(!low){
          const radius=18+easeOut(p)*11;
          arc(ctx,0,0,radius,-.65,.65,COLORS.gold,1.6);
          arc(ctx,0,0,radius,Math.PI-.65,Math.PI+.65,COLORS.gold,1.6);
        }
      });
    }
    function volley(ctx,p,low) {
      for(let i=0;i<3;i++){
        const q=low?.57:clamp((p-i*.07)/.79,0,1),x=-29+q*61,y=(i-1)*13;
        const a=low?1:smooth(q/.13)*(1-smooth((q-.79)/.21));
        atAlpha(ctx,a,()=>{
          const bend=(i-1)*2;
          shape(ctx,path=>{path.moveTo(x-19,y+bend);path.quadraticCurveTo(x-27,y+6+bend,x-34,y+5+bend);},null,COLORS.ink,3.5);
          shape(ctx,path=>{path.moveTo(x-19,y+bend);path.quadraticCurveTo(x-27,y+6+bend,x-34,y+5+bend);},null,i===1?COLORS.gold:COLORS.teal,1.5);
          arrow(ctx,x,y,19,i===1?COLORS.gold:COLORS.steel);
        });
      }
    }
    function guardian(ctx,p,low) {
      const grow=low?1:.92+.08*easeOut(p/.3),dx=low?0:Math.sin(Math.PI*clamp(p/.6,0,1))*2;
      shield(ctx,dx,1,27*grow,COLORS.cream,COLORS.ink);
      shield(ctx,dx,0,20*grow,COLORS.teal,COLORS.ink);
      line(ctx,[[dx,-17],[dx,12]],COLORS.gold,2.3);
      line(ctx,[[dx-8,-4],[dx+8,-4]],COLORS.gold,2.3);
      ellipse(ctx,dx,-4,3.2,3.2,COLORS.cream,COLORS.ink,1.1);
      shape(ctx,path=>{path.moveTo(17,-20);path.quadraticCurveTo(27,-1,13,21);},null,COLORS.ink,4.6);
      shape(ctx,path=>{path.moveTo(17,-20);path.quadraticCurveTo(27,-1,13,21);},null,COLORS.mint,2.5);
      star(ctx,22,-10,low?5.5:7-p*2,COLORS.gold,.2);
      if(!low){
        const d=4+easeOut(p)*11;
        line(ctx,[[27,-16],[27+d,-16-d*.65]],COLORS.coral,2);
        line(ctx,[[28,-4],[30+d,-3+d*.3]],COLORS.gold,2);
      }
    }
    function healing(ctx,p,low) {
      const lift=low?0:easeOut(p)*9,r=low?24:16+easeOut(p)*15;
      ellipse(ctx,0,15,r,r*.28,null,COLORS.ink,3.7);
      ellipse(ctx,0,15,r,r*.28,null,COLORS.mint,2);
      plus(ctx,0,-8-lift,8,COLORS.mint);
      for(let i=0;i<2;i++){
        const s=i?1:-1,x=s*(low?17:13+easeOut(p)*9),y=low?2:8-easeOut(p)*12;
        shape(ctx,path=>{
          path.moveTo(x,y+5);path.quadraticCurveTo(x-s*9,y-3,x-s*3,y-10);
          path.quadraticCurveTo(x+s*5,y-7,x,y+5);path.closePath();
        },COLORS.teal,COLORS.ink,1.3);
        if(!low)star(ctx,s*30,-16-lift*.6,2.6,COLORS.gold,Math.PI/4);
      }
    }
    function rally(ctx,p,low) {
      const radius=low?31:17+easeOut(p)*25;
      ellipse(ctx,0,14,radius,radius*.34,null,COLORS.ink,3.9);
      ellipse(ctx,0,14,radius,radius*.34,null,COLORS.teal,2.2);
      if(!low)atAlpha(ctx,.55,()=>ellipse(ctx,0,14,radius*.75,radius*.255,null,COLORS.gold,1.8));
      const lift=low?0:easeOut(p)*9;
      for(const x of [-16,0,16]){
        const y=(x===0?-10:-2)-lift;
        polygon(ctx,[[x-5,y+3],[x,y-3],[x+5,y+3],[x+5,y+8],[x,y+2],[x-5,y+8]],x===0?COLORS.gold:COLORS.cream,COLORS.ink,1.5);
      }
      line(ctx,[[-5,-26],[5,-26]],COLORS.teal,2);
    }
    function slamTelegraph(ctx,p,low) {
      // Warning footprint is constant: progress cannot grow the hazard area.
      atAlpha(ctx,.15,()=>ellipse(ctx,0,8,39,20,COLORS.coral,null));
      ellipse(ctx,0,8,39,20,null,COLORS.ink,3.5);
      ctx.setLineDash([5,4]);ellipse(ctx,0,8,39,20,null,COLORS.coral,2);ctx.setLineDash([]);
      polygon(ctx,[[-8,4],[0,-10],[8,4]],COLORS.cream,COLORS.ink,1.4);
      line(ctx,[[0,-4],[0,0]],COLORS.rust,2);
      ellipse(ctx,0,2,1,1,COLORS.rust,null);
      // Fixed countdown marks illuminate once; no flashing, impact, or damage.
      for(let i=0;i<4;i++){
        const a=(i+.5)*Math.PI/2,x=Math.cos(a)*30,y=8+Math.sin(a)*15;
        const lit=low || p >= i*.22;
        polygon(ctx,[[x-2,y],[x,y-3],[x+2,y],[x,y+3]],lit?COLORS.coral:COLORS.steel,COLORS.ink,.8);
      }
    }
    function slamContact(ctx,p,low) {
      const q=low?.55:easeOut(p),r=low?32:16+q*24;
      ellipse(ctx,0,8,r,r*.38,null,COLORS.ink,4.1);
      ellipse(ctx,0,8,r,r*.38,null,COLORS.coral,2.3);
      polygon(ctx,[[-12,8],[-6,4],[-11,-1],[-3,1],[0,-8],[4,0],[12,-3],[8,4],[16,8],[6,9],[2,15],[-3,9]],COLORS.gold,COLORS.ink,1.4);
      line(ctx,[[-20,12],[-10,10],[-5,16]],COLORS.rust,1.5);
      line(ctx,[[12,16],[18,10],[26,13]],COLORS.rust,1.5);
      if(!low){
        for(const [x,y,sign] of [[-29,-5,-1],[26,-10,1],[-13,-15,-1]]){
          const dx=x+sign*q*5,dy=y-Math.sin(p*Math.PI)*9;
          polygon(ctx,[[dx-3,dy+1],[dx,dy-3],[dx+4,dy],[dx+1,dy+4]],COLORS.coral,COLORS.ink,1.2);
        }
      }
    }
    function relic(ctx,p,low) {
      const q=low?.5:easeOut(p),r=low?28:23+q*7,rotation=low?0:p*.38;
      ellipse(ctx,0,0,r,r,null,COLORS.ink,3.9);
      ellipse(ctx,0,0,r,r,null,COLORS.gold,2.1);
      ellipse(ctx,0,0,r-6,r-6,null,COLORS.teal,1.1);
      polygon(ctx,[[0,-13],[9,0],[0,13],[-9,0]],COLORS.cream,COLORS.ink,1.6);
      polygon(ctx,[[0,-7],[4,0],[0,7],[-4,0]],COLORS.teal,null);
      for(let i=0;i<4;i++){
        const a=i*Math.PI/2+rotation,rr=r+6,x=Math.cos(a)*rr,y=Math.sin(a)*rr;
        star(ctx,x,y,low?3.2:3.8,COLORS.gold,a);
      }
      if(!low){
        line(ctx,[[-12,-31],[-12,-36]],COLORS.teal,1.5);
        line(ctx,[[13,30],[13,35]],COLORS.teal,1.5);
      }
    }
    function focusTarget(ctx,p,low) {
      const r=low?23:30-easeOut(p)*7;
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2+Math.PI/4;
        arc(ctx,0,0,r,angle-.26,angle+.26,COLORS.ink,4.8);
        arc(ctx,0,0,r,angle-.26,angle+.26,COLORS.gold,2.7);
      }
      const y=low?-32:-38+easeOut(p)*6;
      polygon(ctx,[[-6,y-2],[6,y-2],[0,y+6]],COLORS.teal,COLORS.ink,1.4);
      ellipse(ctx,0,0,3,3,null,COLORS.ink,1.4);
      line(ctx,[[-10,0],[-6,0]],COLORS.teal,1.6);line(ctx,[[6,0],[10,0]],COLORS.teal,1.6);
      line(ctx,[[0,-10],[0,-6]],COLORS.teal,1.6);line(ctx,[[0,6],[0,10]],COLORS.teal,1.6);
    }
    const drawByKind = Object.freeze({
      'spear-strike':spear,'sniper-hit':sniper,'volley-trails':volley,
      'guardian-block':guardian,'healing-burst':healing,'rally-wave':rally,'relic-halo':relic,'focus-target':focusTarget
    });

    function drawEffect(ctx,kind,options) {
      if(!Object.prototype.hasOwnProperty.call(byKind,kind)) return false;
      const o=options || {},p=clamp(finite(o.progress,0),0,1);
      if(p>=1) return false;
      // Enemy warning and contact are distinct event calls. No implicit impact.
      const phase=kind==='enemy-slam'?(o.phase || 'telegraph'):null;
      if(kind==='enemy-slam'&&phase!=='telegraph'&&phase!=='contact') return false;
      if(!ctx || typeof ctx.save!=='function' || typeof ctx.restore!=='function') throw new TypeError('A Canvas 2D context is required.');
      const scale=clamp(finite(o.scale,1),0,8),alpha=clamp(finite(o.alpha,1),0,1);
      if(!scale || !alpha) return false;
      const reduced=!!o.reducedMotion || !!o.lowEffects;
      // Warning remains readable to its end. Fade-out/lifetime remains caller-owned.
      const envelope=phase==='telegraph'?(.8+.2*smooth(p/.2)):opacity(p);
      // Some native Canvas implementations restore paint state but leave style
      // getters stale; preserve those two observable properties explicitly too.
      const previousFill=ctx.fillStyle,previousStroke=ctx.strokeStyle;
      ctx.save();
      try {
        ctx.translate(clamp(finite(o.x,0),-1e6,1e6),clamp(finite(o.y,0),-1e6,1e6));
        ctx.rotate(finite(o.angle,0)%TAU);ctx.scale(scale*(o.facing===-1?-1:1),scale);
        ctx.globalAlpha*=alpha*envelope;
        ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';
        ctx.miterLimit=2;ctx.setLineDash([]);ctx.lineDashOffset=0;
        ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;ctx.shadowColor='rgba(0,0,0,0)';
        if('filter' in ctx)ctx.filter='none';
        if(kind==='enemy-slam') (phase==='contact'?slamContact:slamTelegraph)(ctx,p,reduced);
        else drawByKind[kind](ctx,p,reduced);
      } finally { ctx.restore();ctx.fillStyle=previousFill;ctx.strokeStyle=previousStroke; }
      return true;
    }
    return Object.freeze({version:'0.5.0',colors:COLORS,kinds:KINDS,descriptors:DESCRIPTORS,drawEffect,createRenderer});
  }
  // Browser Path2D is lazily resolved; module loading never touches Canvas or DOM.
  let browserRenderer;
  function drawEffect(ctx,kind,options){
    if(!browserRenderer)browserRenderer=createRenderer(root.Path2D);
    return browserRenderer.drawEffect(ctx,kind,options);
  }
  const api=Object.freeze({version:'0.5.0',colors:COLORS,kinds:KINDS,descriptors:DESCRIPTORS,drawEffect,createRenderer});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.TinyArmyEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this);
