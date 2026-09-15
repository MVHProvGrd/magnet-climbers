/* Photo-sampled animation study, deliberately separate from gameplay. */
(() => {
 const bubbles=[320,580,838,1094,1365].flatMap((x,col)=>[315,582].map((y,row)=>({x,y,col,row,initial:(col+row)%2===0})));
 const state=bubbles.map(b=>b.initial),changed=bubbles.map(()=>-10);
 function toggle(i,time){state[i]=!state[i];changed[i]=time;return state[i];}
 function draw(c,img,time){
  c.clearRect(0,0,840,468);c.fillStyle='#29363e';c.fillRect(0,0,840,468);
  c.save();c.scale(.5,.5);c.drawImage(img,0,0);
  bubbles.forEach((b,i)=>{
   if(state[i]===b.initial)return;
   const donor=bubbles[i^1],elapsed=time-changed[i];
   const squash=elapsed<.12?.90+.10*Math.min(1,elapsed/.12):1;
   c.save();c.beginPath();c.ellipse(b.x,b.y,106,106,0,0,Math.PI*2);c.clip();
   c.drawImage(img,donor.x-110,donor.y-110,220,220,b.x-110,b.y-110*squash,220,220*squash);c.restore();
  });c.restore();
 }
 globalThis.PopItReview={bubbles,state,toggle,draw};
 if(typeof document==='undefined')return;
 const canvas=document.querySelector('canvas'),c=canvas.getContext('2d'),img=new Image();let audio;
 img.src=(location.protocol==='file:'?'../../../art/archive/':'https://raw.githubusercontent.com/MVHProvGrd/magnet-climbers/codex/art-ready-pack/art/archive/')+'14-toy-bumper-keychains-v1/ready/bumper-4-v1.webp';
 function sound(i,pressed){
  if(!document.querySelector('#sound').checked)return;
  audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();
  const t=audio.currentTime,o=audio.createOscillator(),gain=audio.createGain();
  o.type='sine';o.frequency.setValueAtTime((pressed?420:560)+i*17,t);o.frequency.exponentialRampToValueAtTime(95+i*4,t+.065);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.18,t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+.085);
  o.connect(gain).connect(audio.destination);o.start(t);o.stop(t+.09);
 }
 function pop(i){const pressed=toggle(i,performance.now()/1000);sound(i,pressed);document.querySelector('#status').textContent=`Bubble ${i+1}: ${pressed?'in':'out'}`;}
 canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)*1680/r.width,y=(e.clientY-r.top)*936/r.height;const i=bubbles.findIndex(b=>Math.hypot(x-b.x,y-b.y)<106);if(i>=0)pop(i);};
 bubbles.forEach((_,i)=>{const b=document.createElement('button');b.textContent=String(i+1);b.setAttribute('aria-label',`Pop bubble ${i+1}`);b.onclick=()=>pop(i);document.querySelector('#buttons').append(b);});
 img.onload=()=>requestAnimationFrame(function frame(t){draw(c,img,t/1000);requestAnimationFrame(frame);});
 img.onerror=()=>document.querySelector('#status').textContent='Image unavailable; open from the local worktree.';
})();
