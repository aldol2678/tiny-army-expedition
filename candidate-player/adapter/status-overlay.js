import {immutableCopy} from './data.js';
import {createStatusAuthorityProjector} from './status-authority.js';
import {statusProtectedGeometry} from './status-geometry.js';
import {createStatusIndicator} from '../presentation/status-r4/status-rotation.js';
import {layoutProtectedStatusBadges} from './status-layout.js';
import {GLYPHS,PALETTE} from '../presentation/status-r4/visual-kit.js';
// Canvas rendering of exact R4 glyph primitives only. No telegraph/pattern API.
export function drawStatusGlyph(ctx,kind,box){const g=GLYPHS[kind];if(!g)throw Error('Unknown status glyph');ctx.save();try{ctx.translate(box.x,box.y);ctx.scale(box.width/28,box.height/28);ctx.translate(2,2);ctx.lineJoin='round';ctx.lineCap='round';for(const halo of [true,false])for(const p of g.parts){ctx.beginPath();if(p.type==='circle')ctx.arc(p.x,p.y,p.r,0,Math.PI*2);else if(p.type==='curve')for(const [op,...v] of p.commands){if(op==='M')ctx.moveTo(...v);else if(op==='L')ctx.lineTo(...v);else if(op==='Q')ctx.quadraticCurveTo(...v);else if(op==='C')ctx.bezierCurveTo(...v);else if(op==='Z')ctx.closePath();}else{p.points.forEach((v,i)=>i?ctx.lineTo(...v):ctx.moveTo(...v));if(p.type==='poly')ctx.closePath();}ctx.lineWidth=p.width+(halo?2.4:0);if(p.type!=='line'&&p.fill!==null){ctx.fillStyle=halo?PALETTE.pale:PALETTE[p.fill];ctx.fill();}ctx.strokeStyle=halo?PALETTE.pale:PALETTE[p.type==='line'?p.color:p.type==='curve'?p.color:'ink'];ctx.stroke();}}finally{ctx.restore();}}
export function createStatusOverlay({canvas,host,drawGlyph=drawStatusGlyph}){
 const authority=createStatusAuthorityProjector(),indicators=new Map();let battleId=null,disposed=false,last=null,ownerEpoch=0,displayOwner=null,drawSequence=0;
 const clear=()=>{drawSequence++;displayOwner=null;for(const x of indicators.values())x.dispose();indicators.clear();battleId=null;last=null;authority.reset();};
 function draw(frame,{camera,width=900,height=580,visualScale=1,actorBounds=[],displayNowMs=0,paused=false,reducedMotion=false,targeting=false,enemyPresentation=null}={}){
  if(disposed)return null;const drawToken=++drawSequence;const facts=authority.sample(frame);if(facts.battleId!==battleId){for(const x of indicators.values())x.dispose();indicators.clear();battleId=facts.battleId;displayOwner=`u5-status-${++ownerEpoch}`;}
  const rect=canvas.getBoundingClientRect?.(),cssWidth=rect?.width||canvas.clientWidth||width,cssHeight=rect?.height||canvas.clientHeight||height,ctx=canvas.getContext('2d');
  const geometry={width,height,cssWidth,cssHeight,camera,visualScale,actorBounds,paused,targeting,enemyPresentation};
  let items=[],layout={placed:[],unplaced:[],details:[]},error=null,errorDetail=null,protectedRects=[];
  const details=facts.units.filter(u=>u.statuses.length).map(u=>({...u,placement:'UNPLACED'}));
  try{
   const bars=host.TinyArmyBattleReadability.layoutBars({units:frame.snapshot.units,enemies:frame.snapshot.enemies,width,height,scale:visualScale,frame:camera});
   protectedRects=statusProtectedGeometry(frame,{...geometry,bars,measureText:text=>{ctx.save();try{ctx.font='bold 13px "Army Pretendard", sans-serif';return ctx.measureText(text).width;}finally{ctx.restore();}}});
   const ids=new Set(facts.units.map(u=>u.unitId));for(const [id,x]of indicators)if(!ids.has(id)){x.dispose();indicators.delete(id);}
   for(const u of facts.units){if(!indicators.has(u.unitId))indicators.set(u.unitId,createStatusIndicator({battleId:displayOwner,unitId:u.unitId}));const f=indicators.get(u.unitId).update({battleId:displayOwner,unitId:u.unitId,snapshotRevision:facts.snapshotRevision,gameTick:facts.gameTick,statuses:u.statuses.map(({instanceId,kind,displayPriority,appliedSequence,remainingTicks})=>({instanceId,kind,displayPriority,appliedSequence,remainingTicks}))},{displayNowMs,paused,reducedMotion});const bar=bars.find(b=>b.id===u.unitId);if(bar)items.push({unitId:u.unitId,frame:f,bar:{x:bar.x*cssWidth/width,y:bar.y*cssHeight/height,width:bar.width*cssWidth/width,height:bar.height*cssHeight/height}});}
   layout=layoutProtectedStatusBadges({width:cssWidth,height:cssHeight,items,protectedRects});
   ctx.save();try{ctx.setTransform(canvas.width/cssWidth,0,0,canvas.height/cssHeight,0,0);ctx.setLineDash([]);for(const p of layout.placed){if(disposed||drawToken!==drawSequence)break;const indicator=indicators.get(p.unitId);if(!indicator?.isCurrent(p.frameId))continue;ctx.strokeStyle=PALETTE.ink;ctx.lineWidth=p.leaderWidth;for(const s of p.leaderSegments){ctx.beginPath();ctx.moveTo(s.a.x,s.a.y);ctx.lineTo(s.b.x,s.b.y);ctx.stroke();}drawGlyph(ctx,p.entry.kind,p.box);if(!disposed&&drawToken===drawSequence&&battleId===facts.battleId&&indicator.acknowledgePresented(p.frameId)){const detail=details.find(u=>u.unitId===p.unitId);if(detail)detail.placement='PLACED';}}}finally{ctx.restore();}
  }catch(e){error='STATUS_PRESENTATION_UNAVAILABLE';errorDetail=String(e.message).slice(0,160);/* Fail closed visually; never stop the battle or hide authority detail. */}
  if(disposed||drawToken!==drawSequence||battleId!==facts.battleId)return null;last=immutableCopy({battleId,gameTick:facts.gameTick,snapshotRevision:facts.snapshotRevision,details,layout,protectedRects,error,errorDetail,geometry,authorityOnly:true});return last;
 }
 return Object.freeze({draw,state:()=>last,reset:clear,dispose(){if(disposed)return;clear();authority.dispose();disposed=true;}});
}
