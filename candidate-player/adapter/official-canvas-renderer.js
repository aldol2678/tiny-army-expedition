// Generated draw-only official renderer. Existing artwork is injected, never replaced.
import {invariant} from './data.js';
import {createRenderFacade} from './render-facade.js';
import {drawAdditionalWarnings} from './warning-layers.js';
import {createUnitMotionObserver} from '../src/unit-motion.js';
import {drawObservedUnit} from '../src/draw-observed-unit.js';
import {observeDrawBounds} from './draw-bounds.js';
import {createEnemyPresentationObserver,drawEnemyGround} from './enemy-presentation.js';
export function createOfficialCanvasRenderer({canvas,host,types,chapter=1,row=0}) {
 invariant(canvas?.getContext&&host?.TinyArmyArt?.drawUnit,'Official canvas/art required');
 const ctx=canvas.getContext('2d'),TYPES=types,art=host.TinyArmyUIArt,TinyArmyArt=host.TinyArmyArt,TinyArmyEffects=host.TinyArmyEffects;
 let game=null,viewW=900,viewH=580,clock=0,visualScale=1,speed=1,paused=false,targeting=null,selectedUnitId=null,rewardBursts=[],skillBursts=[],battleFrame={zoom:1,offsetX:0,offsetY:0};
 const campaign={run:{chapter,row}},combatCues=new Map(),isV09=()=>true;
 const motionObserver=createUnitMotionObserver(),enemyObserver=createEnemyPresentationObserver();let motionPoses=new Map(),actorBounds=[],enemyView=null,disposed=false;
 function legacyArt(u,options){const box=observeDrawBounds(ctx,tracked=>TinyArmyArt.drawUnit(tracked,options));if(box)actorBounds.push(Object.freeze({id:u.id,type:u.type,team:u.team,...box}));}
 let options={reducedMotion:false,particleAmount:1,decorativeBackground:true,glow:true};
 const reduceMotion=()=>options.reducedMotion,visualSettings=()=>options,metric=n=>host.TinyArmyStrategyView?.format(n)??String(n),seconds=n=>metric(Math.ceil(Math.max(0,n)*10)/10)+'초';
 const UNIT_NAMES=['나루','보리','하루','여울','다온','마루','이솔','라온','해솔','누리','아라','도담','시온','소담','가온','루리'];
function unitName(u){const id=Math.max(0,Math.floor(Number(u.id)||1)-1),base=UNIT_NAMES[id%UNIT_NAMES.length];let group=Math.floor(id/UNIT_NAMES.length),prefix='';while(group){group--;prefix=String.fromCharCode(0xac00+group%11172)+prefix;group=Math.floor(group/11172)}return prefix+base}
function syncCombatCues(){for(const u of [...game.units,...game.enemies]){const old=combatCues.get(u.id),base={spellReadyTick:u.unitSkillReadyTick||0,barrierCasts:u.stats.barrierCasts||0,castAt:-99,attacks:u.attacks,healing:u.stats.healing,blocked:u.stats.blocked,hp:u.hp,deathAt:u.hp<=0?clock:-99,attackAt:-99,healAt:-99,blockAt:-99};if(!old){combatCues.set(u.id,base);continue}if((u.unitSkillReadyTick||0)>old.spellReadyTick||(u.stats.barrierCasts||0)>old.barrierCasts)old.castAt=game.time;old.barrierCasts=u.stats.barrierCasts||0;old.spellReadyTick=u.unitSkillReadyTick||0;if(old.hp>0&&u.hp<=0)old.deathAt=clock;old.hp=u.hp;if(u.attacks>old.attacks)old.attackAt=game.time;if(u.stats.healing>old.healing)old.healAt=game.time;if(u.stats.blocked>old.blocked)old.blockAt=game.time;old.attacks=u.attacks;old.healing=u.stats.healing;old.blocked=u.stats.blocked}}
function unitCues(u){
 if(game.phase!=='battle')return{prepare:0,attack:0,block:0,active:false,special:0};
 const cue=combatCues.get(u.id),attackAge=cue?game.time-cue.attackAt:99,healAge=cue?game.time-cue.healAt:99,healing=healAge<.32&&healAge<=attackAge,castAge=cue?game.time-cue.castAt:99,casting=castAge<.4,age=casting?castAge:healing?healAge:attackAge;
 const t=TYPES[u.type],canAttack=!u.move&&u.cd>0&&u.cd<=.14&&game.alive(u.team==='ally'?'enemy':'ally').some(v=>Math.hypot(v.x-u.x,v.y-u.y)<=(isV09()?u.range:t.range)+.01),telegraph=game.telegraphs.find(signal=>signal.owner.id===u.id);
 return{prepare:canAttack?1-u.cd/.14:0,attack:Math.max(0,1-age/.32),actionKind:casting?(isV09()?u.skill?.id||u.shield?.id||'arcane_bolt':'arcane_bolt'):healing?'heal':'attack',active:healing||casting,block:cue?Math.max(0,1-(game.time-cue.blockAt)/.22):0,special:telegraph?1-telegraph.left/telegraph.max:0};
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function terrain(){if(host.TinyArmyChapterBackdrop?.draw(ctx,{chapter:campaign.run.chapter,width:viewW,height:viewH,decorativeBackground:visualSettings().decorativeBackground,reducedMotion:reduceMotion()}))return;if(!visualSettings().decorativeBackground){ctx.fillStyle='#e8eddd';ctx.fillRect(0,0,viewW,viewH);return}if(art?.drawBackdrop){art.drawBackdrop(ctx,{stage:Math.min(5,(campaign.run.chapter-1)*3+Math.floor(campaign.run.row/3)),width:viewW,height:viewH,phase:game.phase,clock:reduceMotion()?0:clock});return}ctx.fillStyle='#e9eddb';ctx.fillRect(0,0,viewW,viewH);const sy=viewH/580;ctx.save();ctx.scale(1,sy);ctx.fillStyle='#dbe4d2';ctx.beginPath();ctx.moveTo(0,115);ctx.bezierCurveTo(200,50,390,140,580,80);ctx.bezierCurveTo(750,45,810,95,900,58);ctx.lineTo(900,0);ctx.lineTo(0,0);ctx.fill();ctx.fillStyle='#cbdac9';ctx.beginPath();ctx.moveTo(0,66);ctx.lineTo(90,31);ctx.lineTo(145,55);ctx.lineTo(220,16);ctx.lineTo(333,71);ctx.lineTo(430,29);ctx.lineTo(550,75);ctx.lineTo(720,20);ctx.lineTo(900,68);ctx.lineTo(900,0);ctx.lineTo(0,0);ctx.fill();ctx.fillStyle='#ede8d4';ctx.beginPath();ctx.moveTo(0,460);ctx.bezierCurveTo(260,390,510,510,900,430);ctx.lineTo(900,515);ctx.bezierCurveTo(490,555,210,460,0,535);ctx.fill();ctx.strokeStyle='#cbd3ba';ctx.lineWidth=2;for(let i=0;i<65;i++){const x=(i*137+31)%900,y=110+(i*79)%435;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y-5);ctx.moveTo(x,y);ctx.lineTo(x+4,y-7);ctx.stroke()}for(let i=0;i<14;i++){const x=(i*223+49)%880,y=136+(i*113)%360;ctx.fillStyle=i%2?'#d4d9c6':'#c8cebb';ctx.beginPath();ctx.ellipse(x,y,5+i%3,3,0,0,7);ctx.fill()}ctx.fillStyle='#b3bdaf';rr(770,59,23,53,3);ctx.fill();rr(804,76,31,39,3);ctx.fill();ctx.fillStyle='#ced4c5';rr(766,53,31,9,2);ctx.fill();rr(800,69,39,9,2);ctx.fill();ctx.fillStyle='#aebaaa';ctx.fillRect(777,83,5,14);ctx.fillStyle='#c6ccba';ctx.beginPath();ctx.ellipse(790,118,62,10,0,0,7);ctx.fill();if(game.phase==='prepare'){ctx.setLineDash([6,9]);ctx.lineWidth=2;ctx.strokeStyle='#749b8a55';rr(285,129,90,355,13);ctx.stroke();rr(145,129,90,355,13);ctx.stroke();ctx.setLineDash([]);ctx.font='bold 15px "Army Pretendard", sans-serif';ctx.textAlign='center';ctx.fillStyle='#72917b';ctx.fillText('전열',330,515);ctx.fillText('후열',190,515)}ctx.fillStyle='#4d7162';ctx.font='bold 13px "Army Pretendard", sans-serif';ctx.textAlign='left';ctx.fillText('OUR LITTLE LEGION',39,558);ctx.fillStyle='#94766b';ctx.textAlign='right';ctx.fillText(game.stage===5?'THE ASHEN WARDEN':'THE ASHEN TROOP',861,558);ctx.restore()}
function soldier(u){
 const enemy=u.team==='enemy',boss=u.type==='boss',sy=viewH/580,reducedMotion=reduceMotion(),settings=visualSettings(),lowEffects=reducedMotion||speed>=2||game.units.length>=10||settings.particleAmount<1;
 ctx.save();ctx.translate(u.x,u.y*sy);
 if(game.phase==='prepare'&&u.id===selectedUnitId){ctx.fillStyle='#167a6a26';ctx.strokeStyle='#126d60';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,3,27*visualScale,11*visualScale,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#174c43';ctx.font='bold 15px "Army Pretendard", sans-serif';ctx.textAlign='center';ctx.fillText(unitName(u),0,-78*visualScale)}
 const observed=motionPoses.get(u.id);
 if(observed){const box=observeDrawBounds(ctx,tracked=>drawObservedUnit(tracked,{art:TinyArmyArt,unit:u,pose:observed,r:18*visualScale}));if(box)actorBounds.push(Object.freeze({id:u.id,type:u.type,team:u.team,...box}));if(observed.dead){ctx.restore();return;}}
 if(!observed&&u.hp<=0){const deathAt=combatCues.get(u.id)?.deathAt??-99,deathProgress=reducedMotion?1:Math.min(1,Math.max(0,(clock-deathAt)/.55));if(deathProgress<1)legacyArt(u,{type:u.type,team:u.team,x:0,y:0,r:18*visualScale,anchor:'feet',phase:0,moving:false,reducedMotion,lowEffects,deathProgress});else{ctx.globalAlpha=.16;ctx.fillStyle='#6a7565';ctx.beginPath();ctx.ellipse(0,4,10*visualScale,3*visualScale,0,0,7);ctx.fill();actorBounds.push(Object.freeze({id:u.id,type:u.type,team:u.team,x:-10*visualScale-.5,y:visualScale-.5,width:20*visualScale+1,height:6*visualScale+1}));}ctx.restore();return}
 const cue=unitCues(u),burst=rewardBursts.find(b=>b.id===u.id&&b.type==='evolve');
 if(!observed)legacyArt(u,{type:u.type,team:u.team,x:0,y:0,r:18*visualScale,anchor:'feet',phase:reducedMotion?0:clock+u.id,moving:!reducedMotion&&!!u.move,hit:reducedMotion?0:Math.min(1,u.flash*4),...cue,reducedMotion,lowEffects,evolutionFrom:burst?.from,evolutionProgress:burst?1-(burst.until-clock)/1.1:1});
 if(game.phase==='battle'||game.phase==='defeat'){
  // Only visual size changes. Feet stay at u.x/u.y, and bars stay above the resized silhouette.
  const w=(boss?62:u.type==='swarm'?30:38)*visualScale,y=(boss?-94:u.type==='swarm'?-56:-73)*visualScale,h=6*visualScale;
  const danger=!enemy&&u.hp/u.maxHp<=.3;if(danger){ctx.strokeStyle='#ac412c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,2,25*visualScale,9*visualScale,0,0,Math.PI*2);if(settings.glow){ctx.shadowColor='#d7743d';ctx.shadowBlur=8}ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#a43f2d';ctx.font=`bold ${12*visualScale}px "Army Pretendard", sans-serif`;ctx.textAlign='center';ctx.fillText('!',w/2+8*visualScale,y+6*visualScale)}
 }
 ctx.restore();
}
function drawResolvedContact(ctx,e,sy,reducedMotion,lowEffects){
 const x=e.tx,y=e.ty*sy,dx=x-e.x,dy=y-e.y*sy,length=Math.hypot(dx,dy),heal=e.kind==='heal';
 ctx.save();ctx.globalAlpha=reducedMotion?.8:Math.max(0,Math.min(1,e.life/e.max));
 ctx.strokeStyle=e.color;ctx.lineWidth=2;
 // A short, stationary trace ending AT the resolved target, never an in-flight projectile.
 if(!reducedMotion&&!lowEffects&&length>0){const tail=Math.min(26,length);ctx.beginPath();ctx.moveTo(x-dx/length*tail,y-dy/length*tail);ctx.lineTo(x,y);ctx.stroke()}
 ctx.beginPath();
 if(heal){ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5)}
 else{ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath()}
 ctx.stroke();ctx.restore();
}
function drawDangerLayer(ctx,telegraphs,sy,foreground){
 for(const t of telegraphs){
  if(t.left<=0||t.owner?.hp<=0)continue;
  const enemy=t.team==='enemy';
  ctx.save();ctx.translate(t.x,t.y*sy);ctx.scale(1,sy);
  ctx.beginPath();ctx.arc(0,0,t.radius,0,Math.PI*2);
  if(!foreground){ctx.fillStyle=enemy?'#d35f4e25':'#e6ad4f2b';ctx.fill()}
  else{ctx.strokeStyle=enemy?'#a7392d':'#94651e';ctx.lineWidth=3;ctx.stroke();
   // Fixed center and four ticks distinguish the real boundary, not timer growth.
   ctx.strokeRect(-4,-4,8,8);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ctx.beginPath();ctx.moveTo(dx*(t.radius-5),dy*(t.radius-5));ctx.lineTo(dx*(t.radius+5),dy*(t.radius+5));ctx.stroke()}}
  ctx.restore();
  if(foreground){ctx.save();ctx.fillStyle=enemy?'#8a2e20':'#765018';ctx.font='bold 13px "Army Pretendard", sans-serif';ctx.textAlign='center';ctx.fillText(`${enemy?'강타':'아군 강타'} · 고정 ${seconds(t.left)}`,t.x,Math.max(22,t.y*sy-t.radius*sy-8));ctx.restore()}
 }
}
function draw(frameDelta=1/60){
 if(!game||!canvas.width||!canvas.height)return;
 ctx.setTransform(canvas.width/viewW,0,0,canvas.height/viewH,0,0);terrain();
 const sy=viewH/580,reducedMotion=reduceMotion(),settings=visualSettings(),lowEffects=reducedMotion||speed>=2||game.units.length>=10||settings.particleAmount<1;
 if(!targeting&&!paused)battleFrame=reducedMotion?{zoom:1,offsetX:0,offsetY:0}:host.TinyArmyBattleReadability?.frameActors?.({units:game.units,enemies:game.enemies,telegraphs:game.telegraphs,width:viewW,height:viewH,scale:visualScale,previous:battleFrame,dt:frameDelta})||{zoom:1,offsetX:0,offsetY:0};
 ctx.save();ctx.translate(battleFrame.offsetX,battleFrame.offsetY);ctx.scale(battleFrame.zoom,battleFrame.zoom);
 rewardBursts=rewardBursts.filter(b=>b.until>clock);
 for(const burst of rewardBursts){const u=game.units.find(u=>u.id===burst.id);if(u&&settings.particleAmount>0&&art?.drawRewardEffect)art.drawRewardEffect(ctx,{type:burst.type,x:u.x,y:u.y*sy,progress:1-(burst.until-clock)/1.1,size:44*visualScale,reducedMotion:lowEffects})}
 // Fill stays below actors; exact boundaries and timing are drawn above decoration.
 drawDangerLayer(ctx,game.telegraphs,sy,false);drawAdditionalWarnings(ctx,enemyView?.supported?{...game,encounterTelegraphs:[]}:game,sy,false,{seconds});drawEnemyGround(ctx,enemyView,{sy});
 if(game.phase==='battle'||game.phase==='defeat')host.TinyArmyBattleReadability?.drawLinks(ctx,{units:game.units,effects:game.effects,width:viewW,height:viewH,scale:visualScale,combatRulesVersion:game.combatRulesVersion,formationLinks:game.formationLinks});
 [...game.units,...game.enemies].sort((a,b)=>a.y-b.y).forEach(soldier);
 for(const e of game.effects){
  const essential=['arrow','heal','blast','arcane_bolt','arcane_hit','mage_bolt','fire_bolt','frost_bolt'].includes(e.kind)||(e.kind==='ring'&&e.effectKind==='shield');if(!essential){if(settings.particleAmount===0)continue;if(settings.particleAmount<1){const key=[e.kind,e.x,e.y,e.tx,e.ty,e.max].join('|');let hash=2166136261;for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);if(hash&1)continue}}
  const p=1-e.life/e.max;if(lowEffects&&e.kind==='text')continue;
  ctx.save();ctx.globalAlpha=Math.min(1,e.life/e.max*2);ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
  if(e.kind==='arcane_hit'){if(reducedMotion)drawResolvedContact(ctx,{...e,tx:e.x,ty:e.y},sy,true,true);else TinyArmyArt.drawEffect(ctx,{type:e.kind,x:e.x,y:e.y*sy,r:12,progress:p,color:e.color,reducedMotion,lowEffects});
  }else if(e.kind==='ring'&&e.effectKind==='shield'){TinyArmyArt.drawEffect(ctx,{type:'ring',effectKind:'shield',x:e.x,y:e.y*sy,r:24,progress:p,color:e.color,reducedMotion,lowEffects});
  }else if(['arrow','heal','arcane_bolt','mage_bolt','fire_bolt','frost_bolt'].includes(e.kind)){
   drawResolvedContact(ctx,e,sy,reducedMotion,lowEffects);
  }else if(e.kind==='hit'){
   if(reducedMotion)drawResolvedContact(ctx,e,sy,true,true);
   else TinyArmyArt.drawEffect(ctx,{type:'hit',x:e.tx,y:e.ty*sy,r:11,progress:p,color:e.color,reducedMotion,lowEffects});
  }else if(e.kind==='charge'){
   // Charge is emitted when the fixed-circle windup STARTS, not when damage resolves.
   // Its real telegraph already carries the warning; do not invent a line hitbox/contact.
  }else if(e.kind==='text'){
   ctx.font='bold 15px "Army Pretendard", sans-serif';ctx.textAlign='center';ctx.fillText(e.text,e.x,(e.y-p*20)*sy);
  }else if(e.kind==='fall'){
   TinyArmyArt.drawEffect(ctx,{type:'death',x:e.x,y:e.y*sy,r:13,progress:p,color:e.color,reducedMotion,lowEffects});
  }else if(e.kind==='blast'){
   // Impact keeps the real radius; avoid an expanding area that implies larger damage.
   ctx.lineWidth=lowEffects?2:3;ctx.beginPath();ctx.ellipse(e.x,e.y*sy,e.tx,e.tx*sy,0,0,7);ctx.stroke();
   if(!lowEffects)TinyArmyArt.drawEffect(ctx,{type:'hit',x:e.x,y:e.y*sy,r:20,progress:p,color:e.color,reducedMotion,lowEffects});
  }else{
   ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y*sy,35*(reducedMotion ? .8 : p+.1),20*(reducedMotion ? .8 : p+.1),0,0,7);ctx.stroke();
  }
  ctx.restore();
 }
 for(const burst of skillBursts){const u=[...game.units,...game.enemies].find(u=>u.id===burst.id);if(u&&settings.particleAmount>0&&host.TinyArmyEffects&&host.Path2D)TinyArmyEffects.drawEffect(ctx,burst.kind,{x:u.x,y:u.y*sy-25,scale:visualScale,progress:1-(burst.until-clock),reducedMotion,lowEffects})}skillBursts=skillBursts.filter(b=>b.until>clock);
 drawDangerLayer(ctx,game.telegraphs,sy,true);drawAdditionalWarnings(ctx,enemyView?.supported?{...game,encounterTelegraphs:[]}:game,sy,true,{seconds});
 if(game.phase==='battle'||game.phase==='defeat')host.TinyArmyBattleReadability?.drawHealing(ctx,{effects:game.effects,width:viewW,height:viewH,scale:visualScale});
 if(targeting){for(const u of game.alive('enemy')){ctx.save();ctx.strokeStyle='#a46c26';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(u.x,u.y*sy,28*visualScale,11*visualScale,0,0,7);ctx.stroke();ctx.restore()}}
 const focused=game.focusTarget();if(focused){ctx.save();ctx.strokeStyle='#a95d21';ctx.lineWidth=3;if(settings.glow){ctx.shadowColor='#e5ad47';ctx.shadowBlur=10}ctx.beginPath();ctx.ellipse(focused.x,focused.y*sy,26*visualScale,10*visualScale,0,0,7);ctx.stroke();ctx.restore()}
 ctx.restore();
 if(game.phase==='battle'||game.phase==='defeat'){
  const bars=host.TinyArmyBattleReadability?.drawBars(ctx,{units:game.units,enemies:game.enemies,width:viewW,height:viewH,scale:visualScale,frame:battleFrame})||[];
  ctx.save();for(const bar of bars){if(bar.team!=='ally')continue;const state=game.unitSkillState?.(bar.id);if(!state||!(state.maxMana>0))continue;const h=Math.max(1,bar.height*.3),y=bar.y+bar.height-h;ctx.fillStyle='#202d55';ctx.fillRect(bar.x,y,bar.width,h);ctx.fillStyle='#82b8ff';ctx.fillRect(bar.x,y,bar.width*Math.max(0,Math.min(1,state.mana/state.maxMana)),h)}ctx.restore();
 }
 if(paused&&!targeting&&game.phase==='battle'){ctx.fillStyle='#193e3b33';ctx.fillRect(0,0,900,viewH);ctx.fillStyle='#fffdf0';rr(365,viewH/2-29,170,58,14);ctx.fill();ctx.fillStyle='#25483f';ctx.font='bold 20px "Army Pretendard", sans-serif';ctx.textAlign='center';ctx.fillText('잠시 쉬어가기',450,viewH/2+7)}
}

 return Object.freeze({
  draw(frame,next={}) {
   invariant(!disposed,'Official renderer disposed');
   invariant(canvas.width>0&&canvas.height>0,'Canvas backing dimensions must be set by host');
   const previous=game;game=createRenderFacade(frame);
   if(previous?.battleId!==game.battleId){combatCues.clear();battleFrame={zoom:1,offsetX:0,offsetY:0};rewardBursts=[];skillBursts=[];}
   viewH=next.height??580;invariant(Number.isFinite(viewH)&&viewH>0,'Positive logical height required');
   visualScale=next.visualScale??1;invariant(Number.isFinite(visualScale)&&visualScale>=.5&&visualScale<=2,'Invalid visual scale');
   speed=next.speed??1;paused=!!next.paused;targeting=next.targeting??null;clock=next.clock??game.time;
   options={...options,...next};enemyView=enemyObserver.sample(frame,{reducedMotion:reduceMotion()});campaign.run.chapter=next.chapter??chapter;campaign.run.row=next.row??row;
   const motion=motionObserver.sample(frame,{reducedMotion:reduceMotion(),lowEffects:reduceMotion()||speed>=2||game.units.length>=10||options.particleAmount<1});
   motionPoses=new Map(motion.poses.map(p=>[p.id,p]));
   actorBounds=[];syncCombatCues();draw(next.frameDelta??1/60);
   return Object.freeze({battleId:game.battleId,tickCount:game.tickCount,frame:Object.freeze({...battleFrame}),actorBounds:Object.freeze(actorBounds.slice()),enemyPresentation:enemyView,groupCounts:Object.freeze({effects:game.effects.length,basic:game.telegraphs.length,encounter:game.encounterTelegraphs.length,ultimate:game.ultimateTelegraphs.length})});
  },dispose(){if(disposed)return;disposed=true;game=null;enemyObserver.dispose();enemyView=null;motionObserver.reset();motionPoses.clear();combatCues.clear();},reset(){game=null;enemyObserver.reset();enemyView=null;motionObserver.reset();motionPoses.clear();combatCues.clear();battleFrame={zoom:1,offsetX:0,offsetY:0};}
 });
}
