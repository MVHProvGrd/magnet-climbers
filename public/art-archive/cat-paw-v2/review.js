/* Isolated art study only: no gameplay or collision code. */
(() => {
  const duration = 3.2;
  const smooth = t => t * t * (3 - 2 * t);
  const keys = [[0,-70],[.3,-25],[.48,205],[.57,205],[.72,125],[.87,242],[.95,242],[1.10,145],[1.25,219],[1.31,219],[1.65,-70],[3.2,-70]];
  function pose(time) {
    const cycle = Math.floor(time / duration), t = time % duration;
    const x = 95 + ((cycle * 137 + 63) % 210);
    let y = -70;
    for(let i=1;i<keys.length;i++) if(t<=keys[i][0]) {
      const [a,ya]=keys[i-1], [b,yb]=keys[i];
      y=ya+(yb-ya)*smooth((t-a)/(b-a)); break;
    }
    const contact = (t>=.48&&t<=.57)||(t>=.87&&t<=.95)||(t>=1.25&&t<=1.31);
    return {x:x+Math.sin(t*4)*7,y,contact,t};
  }
  function draw(ctx,time,art) {
    ctx.save();ctx.beginPath();ctx.rect(0,0,400,480);ctx.clip();
    const steel=ctx.createLinearGradient(0,0,400,0);
    steel.addColorStop(0,'#aeb9bd');steel.addColorStop(.45,'#e3e7e5');steel.addColorStop(1,'#929da3');
    ctx.fillStyle=steel;ctx.fillRect(0,0,400,480);
    ctx.fillStyle='#42494d';ctx.fillRect(197,0,6,480);
    ctx.fillStyle='#ffffff20';for(let y=0;y<480;y+=3)ctx.fillRect(0,y,400,1);
    // Scratch positions are frozen at contact, never dragged along with the paw.
    const cycle=Math.floor(time/duration);
    for(let n=Math.max(0,cycle-1);n<=cycle;n++)for(const tap of [.48,.87,1.25]){
      const age=time-(n*duration+tap);if(age<0||age>1.6)continue;
      const hit=pose(n*duration+tap),grow=Math.min(1,age/.10),fade=Math.pow(1-age/1.6,1.5);
      // Match the four visible ivory claw tips; keep marks off the door seam.
      for(const [dx,dy] of [[-36,35],[-8,55],[21,54],[48,31]]){
        const x=hit.x+dx,y=hit.y+dy;if(x>191&&x<209)continue;
        ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';
        ctx.strokeStyle='#49565d';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-1,y+9*grow,x-3,y+20*grow);ctx.stroke();
        ctx.strokeStyle='#ffffff';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(x+.8,y);ctx.quadraticCurveTo(x-.2,y+9*grow,x-2.2,y+20*grow);ctx.stroke();ctx.restore();
      }
    }
    const p=pose(time),scale=.24;
    // Source pad center (510,1080); intentional top crop stays outside viewport.
    ctx.drawImage(art,p.x-510*scale,p.y-1080*scale,1024*scale,1536*scale);
    if(p.t<.3){ctx.strokeStyle='#ffc663';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,32,12+8*p.t/.3,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='#152026';ctx.fillRect(14,393,372,71);
    ctx.fillStyle='#fff';ctx.font='bold 18px sans-serif';ctx.fillText('TOP PAW / TAP · TAP · TAP',26,420);
    ctx.font='13px sans-serif';ctx.fillStyle='#c6d0d4';ctx.fillText('Art motion study · no gameplay hitboxes',26,445);
    ctx.restore();
  }
  globalThis.CatPawReview={draw,pose,duration};
  if(typeof document==='undefined')return;
  const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),art=new Image();
  art.src=(location.protocol==='file:'?'../../../art/archive/':'https://raw.githubusercontent.com/MVHProvGrd/magnet-climbers/codex/art-ready-pack/art/archive/')+'17-cat-paw-claws-v2/ready/cat-paw-back-claws-v2.webp';
  let paused=matchMedia('(prefers-reduced-motion: reduce)').matches, time=.87, previous=0;
  document.querySelector('button').onclick=()=>{paused=!paused;document.querySelector('button').textContent=paused?'Play':'Pause';};
  art.onload=()=>{document.querySelector('button').textContent=paused?'Play':'Pause';requestAnimationFrame(function frame(now){if(!paused&&previous)time+=Math.min((now-previous)/1000,.05);previous=now;draw(ctx,time,art);requestAnimationFrame(frame);});};
  art.onerror=()=>document.querySelector('#status').textContent='Image unavailable: open this page from the local worktree or push the art branch.';
})();
