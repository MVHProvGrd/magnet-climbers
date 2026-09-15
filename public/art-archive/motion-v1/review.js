(() => {
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x=clamp(x); return x*x*(3-2*x); };
  const state = {angle:0, velocity:0};
  function bump(sign=1) { state.velocity=Math.max(-3,Math.min(3,state.velocity+sign*1.5)); }
  function step(dt) {
    // Small fixed integration steps keep the review pendulum stable after tab stalls.
    for(let left=Math.min(dt,.1);left>0;){const h=Math.min(left,1/120);left-=h;
      state.velocity+=(-9.8*Math.sin(state.angle)-1.4*state.velocity)*h;
      state.angle+=state.velocity*h;
    }
  }
  function steel(c) {
    const g=c.createLinearGradient(0,0,400,480);g.addColorStop(0,'#dde2df');g.addColorStop(.4,'#b5c0c3');g.addColorStop(1,'#829599');c.fillStyle=g;c.fillRect(0,0,400,480);
    c.fillStyle='#657477';c.fillRect(198,0,4,480);c.fillStyle='#e1e9e8';c.fillRect(203,0,1,480);
  }
  function label(c,text){c.fillStyle='#243139';c.font='14px sans-serif';c.textAlign='center';c.fillText(text,200,455);}
  function armPose(mode,time){
    const t=time%4.6, direction=Math.floor(time/4.6)%2? -1:1;
    let enter=ease(t/.8),exit=ease((t-2.65)/.75),sweep=ease((t-.8)/1.85);
    const visibility=enter*(1-exit);
    if(mode==='bottom') return {x:200,y:950-350*visibility,angle:direction*(-.43+.86*sweep),phase:t<.8?'Rise / warning':t<2.65?'Sweep':t<3.4?'Withdraw':'Rest'};
    return {x:-70,y:520,angle:.6+.7*sweep,scale:visibility,phase:t<.8?'Wind-up':t<2.65?'Sweep':t<3.4?'Withdraw':'Rest'};
  }
  function drawScene(c,mode,time,art,angle=state.angle){
    c.save();c.beginPath();c.rect(0,0,400,480);c.clip();steel(c);
    if(mode==='lemon'){
      const im=art.lemon,s=.25,x=200,y=34,cut=300,pivot=285;
      // The static magnetic hook stays put. The entire lower chain/payload rotates at its first link.
      c.drawImage(im,0,0,im.width,cut,x-510*s,y,im.width*s,cut*s);
      c.save();c.translate(x,y+pivot*s);c.rotate(angle);
      c.drawImage(im,0,cut,im.width,im.height-cut,-510*s,(cut-pivot)*s,im.width*s,(im.height-cut)*s);c.restore();
      label(c,'Tap Bump lemon or tap the canvas');
    }else if(mode==='bottom'||mode==='side'){
      const p=armPose(mode,time),im=art.arm,w=265,h=im.height/im.width*w;
      c.save();c.translate(p.x,p.y);c.rotate(p.angle);
      if(mode==='side'){c.translate(0,(1-p.scale)*560);}
      c.drawImage(im,-w/2,-h,w,h);c.restore();label(c,p.phase);
    }else{
      c.drawImage(art.oldReach,22,85,165,165);
      const bob=Math.sin(time*2)*3;c.drawImage(art.reach,205,85+bob,175,175);
      c.fillStyle='#243139';c.font='16px sans-serif';c.textAlign='center';c.fillText('Claude’s current',105,285);c.fillText('Enamel proposal',295,285);
      c.drawImage(art.oldReach,82,325,46,46);c.drawImage(art.reach,272,325,46,46);label(c,'46 px comparison · subtle idle motion');
    }
    c.restore();
  }
  globalThis.MotionReview={drawScene,armPose,step,bump,state};
  if(typeof document==='undefined')return;
  const base=location.protocol==='file:'?'../../../art/archive/': 'https://raw.githubusercontent.com/MVHProvGrd/magnet-climbers/main/art/archive/';
  const paths={lemon:'10-hanging-keepsakes-v1/ready/lemon-keychain-v1.webp',arm:'12-motion-studies-v1/ready/kid-arm-open-v1.webp',reach:'12-motion-studies-v1/ready/reach-enamel-v2.webp',oldReach:'10-reach-badge-v1/reach-badge-v1.png'};
  const art={};let time=0,last=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  const play=document.querySelector('#play');play.textContent=playing?'Pause previews':'Play previews';
  play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause previews':'Play previews';};
  document.querySelector('#bump').onclick=()=>bump(1);document.querySelector('#reverse').onclick=()=>bump(-1);document.querySelector('#lemon').onclick=()=>bump(1);
  Promise.all(Object.entries(paths).map(([key,path])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{art[key]=im;resolve();};im.onerror=()=>reject(new Error(path));im.src=base+path;}))).then(()=>{
    document.querySelector('#status').textContent='Ready · review only';
    function frame(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(playing){time+=dt;step(dt);}
      for(const mode of ['lemon','side','bottom','reach'])drawScene(document.querySelector('#'+mode).getContext('2d'),mode,time,art);
      requestAnimationFrame(frame);
    }requestAnimationFrame(frame);
  }).catch(e=>{document.querySelector('#status').textContent='Could not load '+e.message;});
})();
