/* Tiny Army Art 1.5 — original procedural Canvas art, no assets or dependencies. */
(function (global) {
  'use strict';
  const C = Object.freeze({
    ink: '#203548', navy: '#284456', dark: '#172b3b', teal: '#318d8c', mint: '#7dd5bc',
    cream: '#fff0cb', pale: '#fff9e7', skin: '#edba86', orange: '#ee9861', gold: '#f6c772',
    rust: '#bc5953', wine: '#673b4e', enemyDark: '#442f44', enemySkin: '#d48c78',
    steel: '#b8d5d5', white: '#ffffff', shadow: 'rgba(26,47,56,.18)'
  });
  const ALIASES = {
    soldier:'spear', spearman:'spear', lancer:'spear', infantry:'spear',
    guard:'guardian', tank:'guardian', shield:'guardian', cavalry:'charger', assault:'charger',
    bow:'archer', ranger:'archer', marksman:'sniper', multishot:'volley',
    healer:'support', medic:'support', banner:'support', captain:'support',
    grunt:'melee', goblin:'melee', fighter:'melee', runner:'raider', fast:'raider',
    bomb:'bomber', ranged:'bomber', chief:'boss'
  };
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function path(ctx, points, fill, stroke, width=1.5, close=true) {
    ctx.beginPath(); points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    if(close)ctx.closePath(); if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function line(ctx, points, color, width=1.5){path(ctx,points,null,color,width,false);}
  function ellipse(ctx,x,y,rx,ry,color,stroke,width=1.5){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function circle(ctx,x,y,r,color,stroke,width=1.5){ellipse(ctx,x,y,r,r,color,stroke,width);}
  function box(ctx,x,y,w,h,fill,stroke,width=1.5){
    ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.strokeRect(x,y,w,h);}
  }
  function star(ctx,x,y,r,color,points=4,rotation=0){
    const pts=[];for(let i=0;i<points*2;i++){const a=rotation+i*Math.PI/points;const rr=i%2?r*.32:r;pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}path(ctx,pts,color);
  }
  function face(ctx,enemy,hood,visor){
    const skin=enemy?C.enemySkin:C.skin;
    ellipse(ctx,0,-8,7.2,7.5,skin,C.ink,1.5);
    if(hood)path(ctx,[[-8,-7],[-7,-15],[-2,-19],[6,-15],[8,-8],[4,-11],[-4,-11],[-5,-5]],hood,C.ink,1.5);
    else {
      path(ctx,[[-8,-8],[-7,-15],[-3,-18],[4,-17],[8,-12],[8,-8]],enemy?C.wine:C.teal,C.ink,1.5);
      line(ctx,[[-7,-10],[7,-10]],enemy?C.rust:C.mint,2);
    }
    if(visor){box(ctx,-3,-9,10,4,C.navy);box(ctx,2,-8,3,1,C.cream);}
    else {box(ctx,3,-8,1.8,2.3,C.ink);line(ctx,[[2,-3],[5,-3]],enemy?C.wine:'#bf7f59',.9);}
    circle(ctx,-5,-5,1.8,skin);
  }
  function boots(ctx,phase,moving,enemy){
    const stride=moving?Math.sin(phase*8)*2.8:0;
    path(ctx,[[-6,6],[-1,6],[-1+stride,14],[-7+stride,14],[-7+stride,11]],enemy?C.enemyDark:C.ink);
    path(ctx,[[1,6],[6,6],[6-stride,11],[8-stride,13],[1-stride,13]],enemy?C.enemyDark:C.ink);
    line(ctx,[[-6+stride,14],[-1+stride,14]],enemy?C.rust:C.cream,1);
    line(ctx,[[2-stride,13],[7-stride,13]],enemy?C.rust:C.cream,1);
  }
  function torso(ctx,enemy,coat){
    path(ctx,[[-6,-2],[4,-3],[8,4],[6,9],[-7,9],[-8,3]],coat||(enemy?C.rust:C.navy),C.ink,1.5);
    line(ctx,[[-5,6],[6,6]],enemy?C.orange:C.cream,2);
    box(ctx,-1,5,3,2,C.gold);
  }
  function arm(ctx,points,enemy){line(ctx,points,C.ink,5);line(ctx,points,enemy?C.rust:C.teal,3);circle(ctx,points[points.length-1][0],points[points.length-1][1],1.9,enemy?C.enemySkin:C.skin);}
  // Draw-only action envelope. A real event starts attack at 1; the caller
  // decays it over .32 seconds. Windup is separately supplied as prepare 0..1.
  // This code never changes an actor, cooldown, target, position, or damage.
  function actionState(o){
    let prepare=clamp(Number(o.prepare)||0,0,1),attack=clamp(Number(o.attack==null?o.attackProgress:o.attack)||0,0,1);
    if(o.actionProgress!=null&&Number.isFinite(Number(o.actionProgress))){
      const p=clamp(Number(o.actionProgress),0,1),strike=7/23;
      prepare=p<strike?p/strike:0;attack=p>=strike?1-(p-strike)/(1-strike):0;
    }
    const ease=v=>v*v*(3-2*v);
    // The first .09 s holds a strong contact pose; .23 s restores the stance.
    const strike=ease(clamp(attack/.76,0,1));
    const recoil=Math.sin(Math.PI*clamp((1-attack)/.48,0,1))*(attack>0?1:0);
    const motion=o.reducedMotion?.25:1;
    return {prepare:ease(prepare)*motion,attack,strike:strike*motion,recoil:recoil*motion,block:clamp(Number(o.block)||0,0,1)*motion,
      special:clamp(Number(o.special)||0,0,1)*motion,actionKind:o.actionKind||'attack',
      active:!!o.active,reducedMotion:!!o.reducedMotion,lowEffects:!!o.lowEffects};
  }
  function spear(ctx,o){
    const thrust=o.strike,wind=o.prepare,dx=thrust*11-wind*5;
    // Rotate around the hand: a visibly lowered spear is a thrust, not a
    // character teleport. The tip stays in the local sprite footprint.
    ctx.save();ctx.translate(11+dx,-2);ctx.rotate(thrust*.78-wind*.2);
    line(ctx,[[-6,12],[8,-13]],C.ink,3.2);
    line(ctx,[[-6,12],[8,-13]],'#a37c52',1.7);
    path(ctx,[[5,-13],[13,-21],[10,-10]],C.cream,C.ink,1.2);
    line(ctx,[[8,-13],[13,-21]],C.steel,1);
    path(ctx,[[4,-9],[9,-7],[7,-3]],C.orange);
    if(thrust>.7&&!o.reducedMotion&&!o.lowEffects){
      ctx.globalAlpha*=.45*o.attack;line(ctx,[[2,-18],[8,-23]],C.cream,1.4);
    }
    ctx.restore();
  }
  function shield(ctx,kind,enemy,block=0){
    const large=kind==='guardian';
    path(ctx,large?[[-3,-8],[7,-11],[18,-7],[19,5],[10,15],[-2,10]]:[[3,0],[12,-1],[13,7],[8,11],[3,7]],enemy?C.wine:C.cream,C.ink,large?1.9:1.7);
    path(ctx,large?[[1,-5],[8,-7],[14,-4],[15,4],[9,10],[2,7]]:[[5,2],[10,1],[11,6],[8,8],[5,6]],enemy?C.rust:C.teal);
    if(large){
      line(ctx,[[8,-5],[9,10]],C.gold,1.5);line(ctx,[[4,1],[13,1]],C.gold,1.5);
      circle(ctx,8.5,1,2.2,C.cream,C.ink,.8);
      if(block>.06){ctx.save();ctx.globalAlpha*=block;line(ctx,[[15,-6],[17,4],[11,12]],C.pale,2.4);ctx.restore();}
    }
  }
  function bow(ctx,sniper,volley,o){
    const wind=o.prepare,release=o.strike;
    ctx.save();ctx.translate(-o.recoil*(sniper?2.5:1.4),o.recoil*.6);
    const nocked=o.attack<.08||wind>.05;
    if(sniper){
      // Long stock, broad cross-limbs and a small sight distinguish the
      // evolved marksman even at mobile scale or with no animation.
      line(ctx,[[-2,3],[23,-2]],C.ink,5.2);line(ctx,[[-1,3],[23,-2]],'#b58a58',2.8);
      path(ctx,[[1,3],[5,3],[3,8],[-1,8]],C.navy,C.ink,1);
      line(ctx,[[14,-12],[17,-3],[21,7]],C.ink,3.7);
      line(ctx,[[14,-12],[17,-3],[21,7]],C.steel,2);
      line(ctx,[[14,-12],[10-wind*4,-1],[21,7]],C.cream,1);
      box(ctx,9,-7,7,3,C.ink);box(ctx,11,-6,3,1,C.gold);
      if(nocked){line(ctx,[[6-wind*2,1],[28,-4]],C.ink,1.3);path(ctx,[[26,-6],[31,-4],[27,-2]],C.cream,C.ink,.6);}
      if(release>.8&&!o.lowEffects&&!o.reducedMotion){line(ctx,[[26,-4],[32,-6]],C.cream,1.6);}
    }else{
      const bx=volley?14:12,top=volley?-17:-13,bottom=volley?13:10;
      ctx.beginPath();ctx.moveTo(bx,top);ctx.quadraticCurveTo(bx+14-wind*2,-2,bx+1,bottom);ctx.strokeStyle=C.ink;ctx.lineWidth=volley?4.2:3.5;ctx.stroke();
      ctx.beginPath();ctx.moveTo(bx,top);ctx.quadraticCurveTo(bx+14-wind*2,-2,bx+1,bottom);ctx.strokeStyle=volley?C.gold:C.orange;ctx.lineWidth=2.1;ctx.stroke();
      if(volley){line(ctx,[[bx-1,top+4],[bx,top],[bx+3,top+2]],C.cream,1.3);line(ctx,[[bx+1,bottom-4],[bx+1,bottom],[bx+4,bottom-2]],C.cream,1.3);}
      const pull=bx-3-wind*9;
      line(ctx,[[bx,top],[pull,-1],[bx+1,bottom]],C.cream,1.2);
      if(nocked){const shots=volley?[-5,0,5]:[0];shots.forEach(d=>{
        line(ctx,[[pull,-1+d*.45],[bx+12,-1+d]],C.ink,volley?1.5:1.2);
        path(ctx,[[bx+10,-3+d],[bx+15,-1+d],[bx+10,1+d]],C.cream,C.ink,.55);
      });}
      if(release>.8&&!o.lowEffects&&!o.reducedMotion){line(ctx,[[bx+1,-5],[bx-1,-1],[bx+1,3]],C.mint,1.1);}
    }
    ctx.restore();
  }
  function mage(ctx,o){
    const cast=o.actionKind==='arcane_bolt'||o.actionKind==='cast',a=o.strike,w=o.prepare;
    // A tapered robe, pointed hood and forked crystal staff distinguish the caster.
    boots(ctx,o.phase,o.moving&&!o.reducedMotion,false);
    path(ctx,[[-6,-4],[5,-4],[10,11],[3,10],[0,13],[-9,11]],C.teal,C.ink,1.5);
    path(ctx,[[-3,-3],[1,-3],[4,10],[0,13],[-3,10]],C.cream,C.ink,.8);
    line(ctx,[[-7,7],[7,7]],C.gold,1.5);
    face(ctx,false,C.teal,false);
    path(ctx,[[-8,-8],[-8,-16],[-3,-25],[5,-18],[8,-10],[3,-14],[-4,-14],[-5,-7]],C.teal,C.ink,1.5);
    line(ctx,[[-7,-15],[-3,-22],[3,-17]],C.gold,1.3);
    const sx=12+a*(cast?6:3)-w*2,sy=-1-w*3;
    arm(ctx,[[4,0],[sx,sy]],false);
    ctx.save();ctx.translate(sx,sy);ctx.rotate(a*(cast?.32:.16)-w*.18);
    line(ctx,[[0,13],[0,-19]],C.ink,3.6);line(ctx,[[0,12],[0,-19]],'#a37c52',1.7);
    path(ctx,[[-5,-23],[-4,-17],[0,-14],[4,-17],[5,-23],[2,-20],[-2,-20]],C.gold,C.ink,1.1);
    path(ctx,[[0,-29],[4,-24],[0,-18],[-4,-24]],C.mint,C.ink,1.2);
    line(ctx,[[0,-27],[0,-21]],C.pale,1);
    if(cast&&Math.max(w,a)>.05){ctx.save();ctx.globalAlpha*=Math.max(w,a);star(ctx,0,-24,5.5,C.pale,4);if(!o.lowEffects&&!o.reducedMotion){line(ctx,[[-7,-26],[-10,-28]],C.gold,1.2);line(ctx,[[7,-24],[10,-24]],C.mint,1.2);}ctx.restore();}
    ctx.restore();
    arm(ctx,[[-5,0],[-8-w*2,2-w*4],[-4+a*7,-3-w*7]],false);
    if(cast&&a>.1)star(ctx,2+a*5,-3,2+a*2,C.gold,4);
  }
  function drawAlly(ctx,type,o){
    if(type==='mage'){mage(ctx,o);return;}
    const a=o.strike,w=o.prepare,block=Math.max(o.block,type==='guardian'?(o.hit||0)*(o.reducedMotion?.25:1):0);
    if(type==='charger'){
      const cape=o.reducedMotion?0:Math.sin(o.phase*5)*.6;
      path(ctx,[[-4,-4],[-13,-2],[-19,7+cape],[-12,6],[-14,12],[-3,7]],C.orange,C.ink,1.3);
      line(ctx,[[-9,-1],[-15,7+cape]],C.gold,1.3);
    }
    if(type==='sniper'){
      path(ctx,[[-7,-5],[-16,10],[-8,9],[-3,12],[4,9],[4,-2]],C.navy,C.ink,1.3);
      line(ctx,[[-11,4],[-14,8],[-8,7]],C.gold,1.3);
    }else if(type==='volley')path(ctx,[[-7,-5],[-14,9],[-6,8],[-2,12],[4,9],[4,-2]],C.teal,C.ink,1.3);
    if(type==='archer'||type==='volley'){
      path(ctx,[[-8,-2],[-12,5],[-8,8],[-4,0]],'#a37c52',C.ink,1);
      line(ctx,[[-10,1],[-13,-10]],C.cream,1.4);line(ctx,[[-8,0],[-10,-10]],C.cream,1.4);
      path(ctx,[[-15,-10],[-11,-12],[-12,-6]],C.orange);
      if(type==='volley')line(ctx,[[-6,-1],[-7,-12]],C.cream,1.5);
    }
    if(type==='support'){
      const flutter=o.reducedMotion?0:Math.sin(o.phase*3)*.6;
      ctx.save();ctx.rotate((a*.045-w*.025)*(o.reducedMotion?0:1));
      line(ctx,[[-9,12],[-9,-27]],C.ink,3);
      path(ctx,[[-9,-26],[7,-25+flutter],[4,-19],[7,-14+flutter],[-9,-16]],C.teal,C.ink,1.3);
      star(ctx,-2,-21,4,C.cream,4,Math.PI/4);
      circle(ctx,-9,-28,2.3,C.gold,C.ink,1);ctx.restore();
    }
    boots(ctx,o.phase,o.moving&&!o.reducedMotion,false);
    torso(ctx,false,type==='support'?C.cream:null);
    if(type==='support'){
      line(ctx,[[-4,-1],[-4,6]],C.teal,2.5);line(ctx,[[3,-1],[3,6]],C.teal,2.5);
      // The medical kit stays visible while the casting hand moves.
      line(ctx,[[-4,-2],[5,6]],C.navy,2);
      path(ctx,[[1,3],[10,3],[11,11],[0,11]],C.navy,C.ink,1.3);
      line(ctx,[[3,3],[3,1],[7,1],[7,3]],C.gold,1.2);
      line(ctx,[[3,7],[8,7]],C.cream,1.8);line(ctx,[[5.5,4.5],[5.5,9.5]],C.cream,1.8);
      face(ctx,false,C.cream,false);path(ctx,[[-8,-11],[-7,-15],[7,-15],[9,-11]],C.cream,C.ink,1.2);
      box(ctx,-2,-16,3,5,C.teal);box(ctx,-3,-15,5,2,C.teal);
      const healing=o.actionKind==='heal'||o.active,lift=healing?Math.max(w,a):Math.max(w*.35,a*.45),hx=11+a*2,hy=-4-lift*12;
      arm(ctx,[[5,0],[8,-2-lift*3],[hx,hy]],false);
      circle(ctx,hx,hy,2.7,C.mint,C.ink,.85);
      if(healing&&Math.max(w,a)>.05){
        ctx.save();ctx.globalAlpha*=Math.max(w,a);circle(ctx,hx,hy,4.2,C.mint,C.cream,1);
        line(ctx,[[hx-2.4,hy],[hx+2.4,hy]],C.pale,1.6);line(ctx,[[hx,hy-2.4],[hx,hy+2.4]],C.pale,1.6);
        if(!o.lowEffects&&!o.reducedMotion){star(ctx,hx+6,hy-4,2.1,C.cream);
          ctx.beginPath();ctx.arc(hx,hy,7+w*2,-Math.PI*.8,Math.PI*.5);ctx.strokeStyle=C.mint;ctx.lineWidth=1.1;ctx.stroke();}
        ctx.restore();
      }
    }else if(type==='guardian'){
      // Heavy shoulder plates, two broad crest tabs, and an oversized kite
      // shield make this a visibly different promotion from a basic spear.
      path(ctx,[[-9,-4],[-12,-7],[-6,-9],[-2,-4],[5,-6],[10,-3],[8,1]],C.steel,C.ink,1.2);
      face(ctx,false,null,true);path(ctx,[[-4,-17],[-5,-25],[0,-23],[3,-17]],C.orange,C.ink,1);
      path(ctx,[[0,-17],[3,-24],[6,-21],[6,-16]],C.gold,C.ink,1);
      arm(ctx,[[-5,1],[-9-w*2,3-a*7]],false);
      ctx.save();ctx.translate(-10-w*2,-a*7);ctx.rotate(-a*.32-w*.2);line(ctx,[[0,8],[0,-9]],C.ink,3.6);line(ctx,[[0,7],[0,-9]],C.steel,2.1);line(ctx,[[-3,3],[3,3]],C.gold,2);ctx.restore();
      ctx.save();ctx.translate(block*5+a*3,-block*4-w*2);ctx.rotate(-block*.2-a*.1);shield(ctx,type,false,block);ctx.restore();
    }else if(type==='charger'){
      path(ctx,[[-8,-3],[-10,-6],[-4,-7],[1,-3]],C.cream,C.ink,1.1);
      face(ctx,false,null,true);path(ctx,[[-4,-17],[-13,-25],[-3,-23],[5,-17]],C.orange,C.ink,1);
      arm(ctx,[[4,0],[11+a*5-w*3,-1-w*4]],false);
      ctx.save();ctx.translate(11+a*5-w*3,-1-w*4);ctx.rotate(a*.8-w*.45-o.special*.18);
      path(ctx,[[0,1],[4,-2],[13,-16],[17,-16],[15,-10],[4,3]],C.cream,C.ink,1.6);
      line(ctx,[[5,-2],[14,-13]],C.steel,1.2);line(ctx,[[-2,-1],[4,5]],C.gold,2.5);
      if(a>.8&&!o.reducedMotion&&!o.lowEffects){ctx.globalAlpha*=.5*o.attack;line(ctx,[[8,-17],[14,-20],[19,-17]],C.cream,1.6);}ctx.restore();
      path(ctx,[[-8,1],[-2,0],[-1,8],[-6,11],[-10,6]],C.cream,C.ink,1.5);
      path(ctx,[[-7,3],[-4,2],[-3,7],[-6,8]],C.orange);
    }else if(type==='archer'||type==='sniper'||type==='volley'){
      face(ctx,false,type==='sniper'?C.navy:C.teal,false);
      if(type==='sniper'){
        path(ctx,[[-6,-2],[7,-2],[8,1],[-6,2]],C.orange);line(ctx,[[-5,0],[-13,3]],C.orange,2.5);
        path(ctx,[[0,-17],[5,-23],[7,-22],[5,-16]],C.steel,C.ink,.9);
        box(ctx,3,-10,6,3,C.ink);box(ctx,7,-9,2,1.2,C.gold);
      }
      if(type==='volley'){
        path(ctx,[[-6,-16],[-7,-26],[-3,-23],[-1,-16]],C.cream,C.ink,1);
        path(ctx,[[-1,-17],[2,-27],[5,-23],[3,-16]],C.gold,C.ink,1);
        line(ctx,[[-5,4],[4,5]],C.gold,1.6);
      }
      const bx=type==='volley'?14:12;
      arm(ctx,[[4,0],[bx-a*.8,-2]],false);
      arm(ctx,[[-3,1],[2-w*5,type==='sniper'?4:-3],[bx-3-w*9-a*4,-1-a*2]],false);
      bow(ctx,type==='sniper',type==='volley',o);
    }else{
      face(ctx,false,null,false);path(ctx,[[-2,-18],[0,-22],[3,-18]],C.orange,C.ink,1);
      arm(ctx,[[4,0],[11+a*11-w*5,-2]],false);spear(ctx,o);shield(ctx,'small',false);
    }
  }
  function horns(ctx,boss){
    path(ctx,[[-6,-14],[-12,-20],[-11,-11],[-6,-8]],boss?C.gold:C.cream,C.ink,1.2);
    path(ctx,[[5,-15],[10,-22],[12,-14],[7,-9]],boss?C.gold:C.cream,C.ink,1.2);
  }
  function axe(ctx,x,y,big,attack,prepare=0){
    ctx.save();ctx.translate(x+attack*3-prepare*3,y-prepare*5);ctx.rotate(attack*.95-prepare*.7);
    line(ctx,[[0,12],[2,-10]],C.ink,big?4:3);line(ctx,[[0,12],[2,-10]],'#a37c52',big?2.2:1.4);
    path(ctx,big?[[2,-12],[12,-13],[15,-6],[11,0],[2,-4]]:[[2,-10],[8,-10],[11,-5],[8,-1],[2,-4]],C.steel,C.ink,1.5);
    line(ctx,big?[[12,-12],[14,-6],[11,-1]]:[[8,-9],[10,-5],[8,-2]],C.cream,1.1);ctx.restore();
  }
  function drawEnemy(ctx,type,o){
    const boss=type==='boss',raider=type==='raider',a=o.strike,w=Math.max(o.prepare,o.special*.8);
    // These are role silhouettes, not extra combat effects. Armor has a
    // straight tower shield and broad plates; fragile swarms have a low,
    // unarmored pointed hood and two short blades. No team-color reliance.
    if(type==='swarm'){
      const flutter=o.reducedMotion?0:Math.sin(o.phase*9)*.8;
      path(ctx,[[-5,-3],[-13,-1],[-17,5+flutter],[-10,3],[-13,8+flutter],[-4,4]],C.orange,C.ink,1.1);
      boots(ctx,o.phase*1.2,o.moving&&!o.reducedMotion,true);
      torso(ctx,true,C.wine);
      path(ctx,[[-6,1],[-3,8],[1,6],[4,9],[7,4],[4,0]],C.rust,C.ink,1);
      face(ctx,true,C.rust,false);
      path(ctx,[[-7,-13],[-10,-22],[-2,-18],[5,-16],[8,-9]],C.rust,C.ink,1.3);
      line(ctx,[[-7,-13],[-1,-15],[6,-11]],C.orange,1.5);
      path(ctx,[[-5,-2],[6,-3],[8,0],[1,2],[-6,0]],C.orange,C.ink,.7);
      const hx=10+a*5-w*3,hy=-1-w*4;
      arm(ctx,[[4,1],[hx,hy]],true);
      ctx.save();ctx.translate(hx,hy);ctx.rotate(a*.7-w*.45);
      path(ctx,[[0,0],[3,-2],[6,-11],[9,-13],[8,-5],[3,2]],C.cream,C.ink,1.2);
      line(ctx,[[-1,-1],[3,2]],C.wine,2);ctx.restore();
      arm(ctx,[[-5,2],[-9-w,5-a*3]],true);
      path(ctx,[[-10-w,4-a*3],[-15-w,-1-a*3],[-13-w,6-a*3],[-10-w,7-a*3]],C.steel,C.ink,1.1);
      if(a>.7&&!o.lowEffects&&!o.reducedMotion){ctx.save();ctx.globalAlpha*=o.attack*.55;line(ctx,[[15,-9],[20,-6]],C.cream,1.2);ctx.restore();}
      return;
    }
    if(boss)path(ctx,[[-7,-7],[-16,10],[-10,12],[-4,10],[4,12],[9,-4]],C.wine,C.ink,1.5);
    if(type==='bomber')ellipse(ctx,-8,2,7.5,9,C.enemyDark,C.ink,1.5);
    boots(ctx,o.phase,o.moving&&!o.reducedMotion,true);torso(ctx,true,boss?C.enemyDark:null);
    if(type==='armored'){
      const brace=Math.max(o.block,(o.hit||0)*(o.reducedMotion?.25:1));
      // Layered slate plates and rust edges retain the enemy palette without
      // borrowing the friendly guardian's cream kite shield or gold crest.
      path(ctx,[[-8,-4],[-14,-5],[-14,-10],[-8,-12],[-4,-7],[5,-8],[12,-12],[15,-7],[13,-2],[6,0]],'#68797d',C.ink,1.6);
      path(ctx,[[-7,-1],[6,-2],[8,6],[4,10],[-7,8],[-9,3]],'#798c8d',C.ink,1.5);
      line(ctx,[[-7,2],[7,1]],C.steel,1.2);line(ctx,[[-6,6],[6,5]],C.enemyDark,1.6);
      face(ctx,true,null,true);
      path(ctx,[[-8,-8],[-9,-18],[-5,-22],[5,-22],[9,-17],[8,-8],[4,-5],[4,-13],[-4,-13],[-4,-6]],'#68797d',C.ink,1.5);
      path(ctx,[[-5,-22],[5,-22],[5,-19],[-5,-19]],C.rust,C.ink,.8);
      line(ctx,[[-6,-16],[6,-16]],C.steel,1.4);box(ctx,-1,-11,6,2,C.orange);
      const mx=-10+a*5-w*2,my=1-w*3;
      arm(ctx,[[-5,1],[mx,my]],true);
      ctx.save();ctx.translate(mx,my);ctx.rotate(a*.95-w*.4);
      line(ctx,[[0,7],[0,-12]],C.ink,4);line(ctx,[[0,6],[0,-11]],'#a37c52',2);
      path(ctx,[[-5,-16],[-2,-19],[3,-19],[6,-16],[6,-9],[3,-7],[-4,-9]],'#798c8d',C.ink,1.5);
      line(ctx,[[-2,-17],[-2,-10]],C.steel,1.4);ctx.restore();
      arm(ctx,[[5,1],[10,-1]],true);
      ctx.save();ctx.translate(brace*2+a*1.3,-brace*2-w*.6);ctx.rotate(-brace*.07);
      path(ctx,[[3,-8],[18,-8],[21,-4],[20,10],[15,14],[5,11],[2,5]],C.enemyDark,C.ink,1.8);
      path(ctx,[[6,-5],[16,-5],[18,-2],[17,8],[14,10],[7,8],[5,4]],'#68797d',C.rust,1.5);
      line(ctx,[[11,-5],[11,9]],C.steel,2);line(ctx,[[6,1],[17,1]],C.steel,2);
      circle(ctx,11,1,2.8,C.rust,C.ink,1.1);circle(ctx,6,-5,1,C.gold);circle(ctx,16,-5,1,C.gold);
      if(brace>.08){ctx.globalAlpha*=brace;line(ctx,[[18,-6],[20,-3],[19,8]],C.pale,2);}
      ctx.restore();
    }else if(boss){
      path(ctx,[[-8,-3],[-11,-6],[-4,-7],[0,-2],[6,-6],[11,-3],[8,1],[0,1]],C.rust,C.ink,1.2);
      face(ctx,true,null,true);horns(ctx,true);box(ctx,-4,-1,8,2,C.gold);axe(ctx,12,0,true,a,w);
      path(ctx,[[-10,0],[-2,-1],[-1,9],[-6,13],[-12,7]],C.wine,C.ink,1.4);star(ctx,-7,5,3,C.orange,4);
    }else if(type==='brute'){
      path(ctx,[[-8,-3],[-13,-6],[-8,-10],[-3,-5],[4,-6],[10,-10],[13,-4],[7,0]],C.steel,C.ink,1.4);
      face(ctx,true,null,true);path(ctx,[[-4,-17],[-3,-21],[2,-20],[5,-17]],C.rust,C.ink,1.2);
      arm(ctx,[[4,0],[11+a*3-w*3,1-w*5]],true);axe(ctx,13,0,true,a,w);
      line(ctx,[[-6,1],[-2,4],[3,0]],C.gold,1.5);
    }else if(type==='archer'||type==='sniper'||type==='volley'){
      face(ctx,true,C.wine,false);
      path(ctx,[[-8,-2],[-12,5],[-8,8],[-4,0]],C.enemyDark,C.ink,1);
      line(ctx,[[-10,1],[-13,-10]],C.orange,1.5);line(ctx,[[-8,0],[-10,-10]],C.orange,1.5);
      arm(ctx,[[4,0],[12-a,-2]],true);arm(ctx,[[-3,1],[9-w*9-a*4,-1-a*2]],true);bow(ctx,false,false,o);
    }else if(raider){
      face(ctx,true,null,false);horns(ctx,false);path(ctx,[[-6,-2],[7,-2],[8,1],[-6,2]],C.orange);
      arm(ctx,[[4,0],[11+a*5-w*4,-2-w*4]],true);
      ctx.save();ctx.translate(a*5-w*4,-w*4);ctx.rotate(a*.35-w*.3);line(ctx,[[10,0],[21,-9]],C.ink,3.4);line(ctx,[[11,-1],[21,-9]],C.cream,1.8);ctx.restore();
      arm(ctx,[[-5,1],[-8,4]],true);line(ctx,[[-8,4],[-14,-1]],C.steel,2.2);
    }else if(type==='bomber'){
      face(ctx,true,C.wine,false);box(ctx,-4,-11,11,4,C.ink);box(ctx,-2,-10,3,2,C.orange);box(ctx,3,-10,3,2,C.orange);
      arm(ctx,[[4,0],[11+a*4-w*4,2-w*10]],true);ctx.save();ctx.translate(a*4-w*4,-w*10);circle(ctx,13,2,5.7,C.enemyDark,C.ink,1.5);circle(ctx,11,0,1.7,'#786071');
      line(ctx,[[15,-3],[14,-6],[18,-7]],C.gold,1.5);star(ctx,18,-7,o.reducedMotion||o.lowEffects?2.5:3+(Math.sin(o.phase*14)+1)*.6,C.orange,4,o.reducedMotion?0:o.phase);ctx.restore();
    }else {
      face(ctx,true,null,false);path(ctx,[[-6,-14],[-10,-17],[-10,-11]],C.cream,C.ink,1);
      arm(ctx,[[4,0],[10+a*3-w*3,1-w*5]],true);axe(ctx,11,-1,false,a,w);
      path(ctx,[[-9,1],[-2,-1],[-2,8],[-7,10],[-11,6]],C.wine,C.ink,1.3);line(ctx,[[-8,2],[-5,7]],C.rust,2);
    }
  }
  function drawUnit(ctx, unit, extra) {
    const o=Object.assign({},unit||{},extra||{});
    const enemy=o.enemy===true||o.team==='enemy'||o.team==='enemies'||o.side==='enemy';
    let type=o.type||o.kind||o.role||(enemy?'melee':'spear');type=ALIASES[type]||type;
    const r=Number(o.r||o.radius||12),scale=(o.scale==null?r/12:o.scale)*(type==='boss'?1.3:type==='brute'?1.12:type==='armored'?1.08:type==='swarm'?.8:1);
    const phase=Number(o.phase==null?(o.time||0):o.phase),moving=!!(o.moving||o.walking);
    const state=Object.assign(actionState(o),{phase,moving,hit:clamp(Number(o.hit)||0,0,1)});
    const facing=o.facing===-1||o.facing==='left'?-1:o.facing===1||o.facing==='right'?1:(enemy?-1:1);
    const dying=o.deathProgress!=null,death=dying?clamp(Number(o.deathProgress)||0,0,1):0;
    const alpha=(o.alpha==null?1:clamp(o.alpha,0,1))*(dying?1-death:1);
    const evolve=!!o.evolutionFrom&&Number.isFinite(Number(o.evolutionProgress)),ep=evolve?clamp(Number(o.evolutionProgress),0,1):1;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(Number(o.x||0),Number(o.y||0));ctx.scale(scale,scale);
    if(o.anchor==='feet')ctx.translate(0,-14);
    ctx.lineJoin='round';ctx.lineCap='round';
    if(o.shadow!==false){ellipse(ctx,0,14,12,4,C.shadow);ellipse(ctx,0,14,8,2,enemy?'rgba(188,89,83,.3)':'rgba(49,141,140,.27)');}
    if(o.selected){ctx.beginPath();ctx.ellipse(0,14,15,5,0,0,Math.PI*2);ctx.strokeStyle=enemy?C.orange:C.mint;ctx.lineWidth=1.8;ctx.stroke();}
    ctx.scale(facing,1);
    if(!state.reducedMotion){
      const ranged=['archer','sniper','volley','bomber','mage'].includes(type),heavy=['guardian','armored','brute','boss'].includes(type);
      const wind=Math.max(state.prepare,state.special*.65),lean=ranged?(-state.recoil*.065+wind*.025):(state.strike*(heavy?.09:.14)-wind*.075);
      // Rotate around planted feet. Recoil and weight transfer never move the actor's anchor.
      ctx.translate(0,14);ctx.rotate(lean-state.hit*.055-(dying?death*.85:0));ctx.translate(0,-14);
      ctx.translate(0,dying?death*8:moving?Math.sin(phase*16)*.65:Math.sin(phase*3)*.18);
      if(evolve&&ep<.7){const settle=ep<.2?1-ep*.22:1+Math.sin((ep-.2)/.5*Math.PI)*.055;ctx.translate(0,14);ctx.scale(settle,settle);ctx.translate(0,-14);}
    }
    if(evolve&&!state.reducedMotion&&ep<.22)type=ALIASES[o.evolutionFrom]||o.evolutionFrom;
    if(enemy)drawEnemy(ctx,type,state);else drawAlly(ctx,type,state);
    if(state.hit>0){
      ctx.save();ctx.globalAlpha*=state.hit*.82;
      // A compact contact glint leaves the face, equipment and HP readable.
      star(ctx,type==='guardian'?15:7,-3,state.reducedMotion?3.5:5.5,C.pale,4,.15);
      if(!state.lowEffects&&!state.reducedMotion)line(ctx,[[13,-8],[16,-10]],C.gold,1.5);ctx.restore();
    }
    if(evolve&&ep>.15&&ep<.48){ctx.save();ctx.globalAlpha*=Math.sin((ep-.15)/.33*Math.PI)*.7;star(ctx,0,-7,state.reducedMotion?4:7,C.gold,4,.1);ctx.restore();}
    ctx.restore();
  }
  function drawProjectile(ctx, projectile) {
    const p=projectile||{},type=p.type||p.kind||'arrow',angle=p.angle==null?Math.atan2(p.vy||0,p.vx||1):p.angle;
    const low=!!(p.lowEffects||p.reducedMotion),sniper=p.sourceType==='sniper',critical=!!p.critical;
    ctx.save();ctx.translate(p.x||0,p.y||0);ctx.rotate(angle);ctx.globalAlpha*=p.alpha==null?1:p.alpha;ctx.lineCap='round';ctx.lineJoin='round';
    if(type==='bomb'){circle(ctx,0,0,4.5,C.enemyDark,C.ink,1);line(ctx,[[2,-3],[4,-6]],C.gold,1);star(ctx,4,-6,low?1.8:2.8,C.orange);}
    else if(type==='arcane_bolt'||type==='mage_bolt'){
      const spell=type==='arcane_bolt',head=spell?9:5,half=spell?4:2.8;
      if(!low)line(ctx,[[-head-6,0],[-head,0]],C.teal,spell?3:1.5);
      path(ctx,[[-head,0],[0,-half],[head,0],[0,half]],C.teal,C.ink,1);
      path(ctx,[[-head*.45,0],[1,-half*.6],[head*.8,0],[1,half*.6]],spell?C.gold:C.mint);
      line(ctx,[[0,0],[head*.65,0]],C.pale,1);
    }
    else if(type==='heal'||type==='magic'||p.sourceType==='support'){
      if(!low)line(ctx,[[-8,0],[-4,0]],'rgba(125,213,188,.55)',2.2);
      circle(ctx,0,0,3.7,C.mint,C.ink,.75);
      line(ctx,[[-2,0],[2,0]],C.pale,1.4);line(ctx,[[0,-2],[0,2]],C.pale,1.4);
    }else {
      const head=sniper?13:10,tail=sniper?-12:-10,tint=p.enemy?C.orange:critical?C.gold:C.cream;
      if(!low&&critical)line(ctx,[[tail-7,0],[tail-1,0]],'rgba(246,199,114,.55)',2.2);
      line(ctx,[[tail,0],[head-5,0]],C.ink,sniper?3.2:2.8);line(ctx,[[tail,0],[head-5,0]],tint,1.25);
      path(ctx,[[head-6,-3],[head,0],[head-6,3]],tint,C.ink,.85);
      line(ctx,[[tail,-2.5],[tail+3,0],[tail,2.5]],p.enemy?C.rust:C.teal,1.6);
    }
    ctx.restore();
  }
  function drawEffect(ctx,effect){
    const e=effect||{},type=e.type||e.kind||'hit';
    const t=clamp(e.progress==null?(e.duration?e.age/e.duration:0):e.progress,0,1);if(t>=1)return;
    const size=Math.max(1,Number(e.r||e.radius||14)),color=e.color||(e.enemy?C.orange:C.mint),low=!!(e.lowEffects||e.reducedMotion);
    ctx.save();ctx.translate(e.x||0,e.y||0);ctx.globalAlpha*=1-t;ctx.lineCap='round';
    if(type==='arrow'||type==='bomb'||type==='projectile'||type==='arcane_bolt'||type==='mage_bolt'){drawProjectile(ctx,Object.assign({},e,{x:0,y:0}));}
    else if(type==='arcane_hit'){
      // Compact contact flash only. Never a ring that implies area damage.
      const d=(low?4:7)*(1-t*.45);star(ctx,0,0,d,C.mint,4,.1);
      star(ctx,0,0,d*.5,C.pale,4,.1);
      if(!low)line(ctx,[[3,-4],[6,-7]],C.gold,1.4);
    }
    else if(type==='rally'||type==='heal'||type==='spawn'){
      const radius=Math.min(size,25);ctx.beginPath();ctx.ellipse(0,8,radius*(.5+(e.reducedMotion?0:t*.4)),radius*.2,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1.8*(1-t)+.5;ctx.stroke();
      if(!low){for(let i=0;i<3;i++){const x=(i-1)*radius*.5;star(ctx,x,-2-t*10+(i===1?-4:0),2.4,color,4);}}
      if(type==='heal'){const y=-7-(e.reducedMotion?0:t*6);line(ctx,[[-3,y],[3,y]],C.cream,1.8);line(ctx,[[0,y-3],[0,y+3]],C.cream,1.8);}
    }else if(type==='slash'||type==='spear'||type==='block'){
      ctx.rotate(e.angle||0);const d=Math.min(size,25),advance=e.reducedMotion?0:t*d*.25;
      line(ctx,[[-d*.4+advance,4],[d*.25+advance,-3],[d*.6+advance,-5]],C.pale,Math.max(.6,3*(1-t)));
      if(!low)line(ctx,[[-d*.3+advance,6],[d*.6+advance,-2]],color,Math.max(.5,1.6*(1-t)));
    }else if(type==='explosion'){
      const radius=Math.min(size,32),grow=e.reducedMotion?.55:.35+t*.45;
      circle(ctx,0,0,radius*grow,t<.25?'rgba(246,199,114,.5)':'rgba(238,152,97,.13)');
      ctx.beginPath();ctx.arc(0,0,radius*grow,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=2*(1-t)+.5;ctx.stroke();
      if(!low){for(let i=0;i<4;i++){const a=i*Math.PI/2+.5,d=radius*grow;star(ctx,Math.cos(a)*d,Math.sin(a)*d,3*(1-t)+.4,C.cream,4,a);}}
    }else if(type==='death'){
      // Short grounded dust crescent distinguishes a fall from a hit.
      ctx.beginPath();ctx.ellipse(0,3,Math.min(size,16)*(e.reducedMotion?.6:.45+t*.4),2,0,0,Math.PI);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
      if(!low){for(let i=0;i<3;i++){const a=i*2.094+1.1,d=3+t*Math.min(size,12);circle(ctx,Math.cos(a)*d,Math.sin(a)*d-t*4,1.8*(1-t)+.3,color);}}
      else line(ctx,[[-3,0],[3,0]],color,1.2);
    }else{
      const impact=Math.min(size,12);star(ctx,0,0,impact*(low?.55:.75)*(1-t*.45),e.critical?C.gold:C.cream,4,.15);
      if(!low){for(let i=0;i<3;i++){const a=i*Math.PI*2/3+.4,d=impact*(.55+t*.35);line(ctx,[[Math.cos(a)*d,Math.sin(a)*d],[Math.cos(a)*(d+3),Math.sin(a)*(d+3)]],color,1.3);}}
    }
    ctx.restore();
  }
  function drawRewardEffect(ctx,options){
    const o=options||{},p=clamp(Number(o.progress)||0,0,1);if(p>=1)return;
    const type=o.type||'evolve',size=Math.min(54,Math.max(20,Number(o.size)||42)),color=type==='train'?C.orange:type==='evolve'?C.gold:C.mint,low=!!(o.reducedMotion||o.lowEffects);
    ctx.save();ctx.translate(Number(o.x)||0,Number(o.y)||0);ctx.globalAlpha*=Math.sin(Math.PI*Math.max(.025,p))*.85;ctx.lineCap='round';
    const ease=1-Math.pow(1-p,3),radius=size*(low?.48:.35+ease*.28);
    ctx.beginPath();ctx.ellipse(0,2,radius,radius*.28,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=1.8*(1-p)+.6;ctx.stroke();
    if(type==='evolve'){
      const y=-size*(low?.72:.6+ease*.22);line(ctx,[[-5,y+4],[0,y-2],[5,y+4]],C.cream,2.2);
      if(!low){star(ctx,-size*.35,-size*.47-ease*9,2.5*(1-p)+.6,color);star(ctx,size*.35,-size*.34-ease*7,2.1*(1-p)+.6,C.cream);}
    }else if(type==='train'){
      const y=-size*.65;line(ctx,[[-4,y],[4,y]],color,2);line(ctx,[[0,y-4],[0,y+4]],color,2);
    }else if(!low){star(ctx,-size*.3,-size*.5-ease*5,2.5*(1-p)+.6,C.cream);star(ctx,size*.3,-size*.4-ease*5,2.5*(1-p)+.6,color);}
    ctx.restore();
  }
  function drawIcon(ctx,type,x,y,size,options){
    drawUnit(ctx,Object.assign({type,x,y:y+size*.09,r:size*.29,phase:0,shadow:false},options||{}));
  }
  const api=Object.freeze({version:'1.8.0',colors:C,drawUnit,drawProjectile,drawEffect,drawRewardEffect,drawIcon});
  global.TinyArmyArt=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
