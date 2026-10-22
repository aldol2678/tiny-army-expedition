// Observes the existing Canvas calls while forwarding each call exactly once.
// Bounds are local to the current actor feet; this never reads engine state.
export function observeDrawBounds(ctx,draw){
 let matrix=[1,0,0,1,0,0],clip=null,stack=[],path=null,paint=null,pathScale=1,valid=true;
 const merge=(a,b)=>!a?{...b}:{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),right:Math.max(a.right,b.right),bottom:Math.max(a.bottom,b.bottom)};
 const point=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
 const scale=()=>Math.hypot(...matrix.slice(0,4));
 const add=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y)){valid=false;return;}path=merge(path,{x,y,right:x,bottom:y});pathScale=Math.max(pathScale,scale());};
 const p=(x,y)=>{const q=point(x,y);add(q.x,q.y);};
 const multiply=n=>{const [a,b,c,d,e,f]=matrix,[g,h,i,j,k,l]=n;matrix=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];};
 const rectangle=(x,y,w,h)=>{p(x,y);p(x+w,y);p(x+w,y+h);p(x,y+h);};
 const commit=stroke=>{if(!path||ctx.globalAlpha===0)return;const pad=stroke?Math.max(0,Number(ctx.lineWidth)||1)*Math.max(pathScale,scale())/2:0;let b={x:path.x-pad,y:path.y-pad,right:path.right+pad,bottom:path.bottom+pad};if(clip)b={x:Math.max(b.x,clip.x),y:Math.max(b.y,clip.y),right:Math.min(b.right,clip.right),bottom:Math.min(b.bottom,clip.bottom)};if(b.right>=b.x&&b.bottom>=b.y)paint=merge(paint,b);};
 const ellipse=(x,y,rx,ry,angle=0)=>{const q=point(x,y),ca=Math.cos(angle),sa=Math.sin(angle),ax=rx*ca,ay=rx*sa,bx=-ry*sa,by=ry*ca,ex=Math.hypot(matrix[0]*ax+matrix[2]*ay,matrix[0]*bx+matrix[2]*by),ey=Math.hypot(matrix[1]*ax+matrix[3]*ay,matrix[1]*bx+matrix[3]*by);add(q.x-ex,q.y-ey);add(q.x+ex,q.y+ey);};
 const handlers={save(){stack.push({matrix:matrix.slice(),clip});},restore(){if(!stack.length){valid=false;return;}const prior=stack.pop();matrix=prior.matrix;clip=prior.clip;},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},rotate(a){multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},beginPath(){path=null;pathScale=scale();},closePath(){},moveTo:p,lineTo:p,quadraticCurveTo(cx,cy,x,y){p(cx,cy);p(x,y);},bezierCurveTo(a,b,c,d,x,y){p(a,b);p(c,d);p(x,y);},arc(x,y,r){ellipse(x,y,r,r);},ellipse,rect:rectangle,clip(){if(!path){valid=false;return;}clip=clip?{x:Math.max(clip.x,path.x),y:Math.max(clip.y,path.y),right:Math.min(clip.right,path.right),bottom:Math.min(clip.bottom,path.bottom)}:{...path};},fill(){commit(false);},stroke(){commit(true);},fillRect(x,y,w,h){const prior=path,ps=pathScale;path=null;rectangle(x,y,w,h);commit(false);path=prior;pathScale=ps;},strokeRect(x,y,w,h){const prior=path,ps=pathScale;path=null;rectangle(x,y,w,h);commit(true);path=prior;pathScale=ps;}};
 const methods=new Map();const proxy=new Proxy(ctx,{get(target,key){const value=target[key];if(typeof value!=='function')return value;if(!methods.has(key))methods.set(key,(...args)=>{try{if(handlers[key])handlers[key](...args);else valid=false;}catch{valid=false;}return value.apply(target,args);});return methods.get(key);},set(target,key,value){target[key]=value;return true;}});
 draw(proxy);
 if(!valid||stack.length)return null;if(!paint)return Object.freeze({empty:true,x:0,y:0,width:0,height:0});
 const pad=1.5;return Object.freeze({x:paint.x-pad,y:paint.y-pad,width:paint.right-paint.x+2*pad,height:paint.bottom-paint.y+2*pad});
}
