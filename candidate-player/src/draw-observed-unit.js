export function unitMotionBounds({x=0,y=0,r=18}={}){if(![x,y,r].every(Number.isFinite)||r<=0)throw Error('Finite motion footprint required');const s=r/12;return Object.freeze({x:x-38*s,y:y-47*s,width:93*s,height:65*s});}
// Keeps the original official asset; transforms are clipped below the HP-bar band.
export function drawObservedUnit(ctx,{art,unit,pose,r=18,x=0,y=0}={}){
 if(!art?.drawUnit||!unit||pose?.id!==unit.id||pose.type!==unit.type||!Number.isFinite(r)||r<=0)throw Error('Matching observed unit and official art required');
 const s=r/12,bounds=unitMotionBounds({r});unitMotionBounds({x,y,r});ctx.save();try{ctx.translate(x,y);
 ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.width,bounds.height);ctx.clip();
 if(pose.dead&&pose.deathProgress>=1){ctx.globalAlpha*=.22;ctx.fillStyle='#566a65';ctx.beginPath();ctx.ellipse(0,3*s,9*s,2.4*s,0,0,Math.PI*2);ctx.fill();return;}
 ctx.rotate(pose.bodyRotation);ctx.scale(pose.scaleX,pose.scaleY);
 art.drawUnit(ctx,{type:unit.type,team:unit.team,x:0,y:0,r,anchor:'feet',phase:pose.phaseClock,moving:pose.moving,hit:pose.hit,prepare:0,attack:pose.attack,actionKind:pose.actionKind,active:pose.active,reducedMotion:pose.reducedMotion,lowEffects:pose.lowEffects,...(pose.dead?{deathProgress:pose.deathProgress}:{})});
 if(pose.healMark>0){ctx.globalAlpha*=pose.healMark;ctx.strokeStyle='#318d8c';ctx.lineWidth=1.5*s;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-15*s,-22*s);ctx.lineTo(-9*s,-22*s);ctx.moveTo(-12*s,-25*s);ctx.lineTo(-12*s,-19*s);ctx.stroke();}
 }finally{ctx.restore();}
}
