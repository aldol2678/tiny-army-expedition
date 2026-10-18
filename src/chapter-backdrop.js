/* Original Canvas scenery, v0.7.1 visual refresh. Decoration only: deterministic, static, offline.
 * The central combat floor is intentionally blank. Coordinates are logical CSS
 * pixels; the caller owns DPR transforms and gameplay overlays. */
(function(global){
  'use strict';
  const palettes=Object.freeze({
    border:Object.freeze({ground:'#e9eddb',horizon:'#d4e2cf',distant:'#b7cec0',stone:'#adc1ad',detail:'#819d8b',foliage:'#729b88'}),
    ashcastle:Object.freeze({ground:'#e5dfd6',horizon:'#d8d0c5',distant:'#c3c3b9',stone:'#a1aaa1',detail:'#7e908b',foliage:'#9aa69b'})
  });
  const paletteForChapter=chapter=>Number(chapter)>=2?palettes.ashcastle:palettes.border;
  function draw(ctx,options={}){
    const width=Number(options.width),height=Number(options.height);
    if(!ctx||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return false;
    const p=paletteForChapter(options.chapter),ash=Number(options.chapter)>=2;
    ctx.save();
    try{
      ctx.fillStyle=p.ground;ctx.fillRect(0,0,width,height);
      if(options.decorativeBackground===false)return true;
      ctx.scale(width/900,height/580);
      const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()};
      // Only the top 15% and outer edges contain decorative marks.
      polygon([[0,0],[900,0],[900,65],[790,47],[675,77],[540,53],[420,83],[275,54],[140,72],[0,59]],p.horizon);
      polygon([[0,0],[900,0],[900,35],[800,15],[685,52],[590,26],[470,57],[340,20],[210,48],[100,15],[0,43]],p.distant);
      const stone=(x,y,w,h)=>{ctx.fillStyle=p.stone;ctx.fillRect(x,y,w,h);ctx.fillStyle=p.distant;ctx.fillRect(x-3,y-4,w+6,6)};
      const block=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h)};
      const tree=(x,y,s)=>{block(x-2,y-12*s,4,13*s,p.stone);polygon([[x,y-42*s],[x-14*s,y-12*s],[x-8*s,y-12*s],[x-18*s,y],[x+18*s,y],[x+8*s,y-12*s],[x+14*s,y-12*s]],p.foliage);polygon([[x,y-37*s],[x-12*s,y-12*s],[x,y-8*s]],p.distant)};
      if(ash){
        // The courtyard's broken aqueduct is a silhouette confined to the skyline.
        stone(710,29,25,54);stone(786,20,30,63);stone(857,39,22,44);
        block(729,34,65,11,p.stone);block(811,45,51,9,p.stone);
        polygon([[741,45],[753,57],[764,48],[774,58],[786,45]],p.stone);
        block(719,41,5,15,p.detail);block(795,33,6,18,p.detail);block(864,51,5,12,p.detail);
        [710,722,786,799,811].forEach(x=>block(x,12+(x<750?9:0),7,12,p.stone));
        polygon([[736,27],[736,8],[759,12],[753,19],[736,17]],'#ac9990');
        block(737,8,2,29,p.detail);
        // Narrow peripheral masonry never extends into the playable corridor.
        for(let i=0;i<5;i++){block(0,130+i*84,18+(i%2)*8,20,p.horizon);block(881,173+i*78,19,18,p.horizon)}
        stone(8,238,15,24);stone(877,389,17,18);
        polygon([[8,269],[16,258],[29,266],[34,279],[13,282]],p.distant);
        polygon([[868,412],[877,398],[891,403],[897,417]],p.distant);
        // Receding floor slabs are low contrast and limited to the bottom border.
        for(let i=0;i<8;i++){block(42+i*106,557+(i%2)*8,79,4,'#d4d0c3');block(48+i*106,565+(i%2)*8,58,2,'#f0eade')}
      }else{
        // A windmill and split-rail fence distinguish the green border country.
        polygon([[755,82],[765,43],[784,43],[795,82]],'#bdcbb5');
        polygon([[761,45],[774,29],[788,45]],p.foliage);
        block(772,18,4,52,p.detail);block(747,42,54,4,p.detail);
        block(777,19,10,17,'#edf0d9');block(784,47,17,10,'#edf0d9');block(762,52,10,17,'#edf0d9');block(747,32,17,10,'#edf0d9');
        block(770,71,9,12,p.foliage);
        [830,851,874].forEach(x=>block(x,58,3,25,p.detail));block(828,65,53,3,p.stone);block(828,75,53,3,p.stone);
        tree(22,82,1.1);tree(57,80,.8);tree(98,81,.65);
        tree(18,179,.8);tree(883,240,.75);tree(17,406,.68);tree(884,452,.65);
        // Soft hedge fragments at the very edges, never beneath health bars.
        polygon([[0,325],[15,315],[31,321],[23,332],[0,337]],p.horizon);
        polygon([[900,361],[878,354],[865,366],[882,374],[900,371]],p.horizon);
        for(let i=0;i<9;i++){block(42+i*99,560+(i%3)*5,22,2,'#d3dfc5');block(50+i*99,556+(i%3)*5,3,4,'#c5d5bb')}
      }
      // Sparse fragments stay away from unit silhouettes, aim lines and text.
      polygon([[8,309],[14,301],[25,304],[31,312]],p.distant);
      polygon([[872,332],[877,326],[889,328],[894,335]],p.distant);
      polygon([[13,476],[18,470],[29,474],[31,479]],p.distant);
      return true;
    }finally{ctx.restore()}
  }
  const api=Object.freeze({version:'0.5.2',draw,paletteForChapter,palettes});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  global.TinyArmyChapterBackdrop=api;
})(typeof window!=='undefined'?window:globalThis);
