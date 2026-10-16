'use strict';
let pov='shore', environmentCache=null, environmentKey='', sceneRevision=0;
let cameraTransform=null,foregroundDrawKey='';
const THEMES={shore:{title:'岸边 · 万花入梦',sub:'远处一朵初开，下一朵就在头顶。',tag:'十六种花型 / 远近交错 / 管弦与鼓点',location:'ON THE SHORE · 万花入梦'},boat:{title:'扁舟 · 独游星河',sub:'一个人，顺着水光，慢慢划进这场夏夜。',tag:'水上漫游 / 第一视角 / 拨弦与笛声',location:'DRIFTING ALONE · 独游星河'},flight:{title:'夜航 · 万家灯火',sub:'每一盏亮着的灯，都有一个还没睡的故事。',tag:'城市灯海 / 云间掠影 / 电子夜曲',location:'LIGHTS BELOW · 万家灯火'}};
const photos={};
if(typeof Image!=='undefined')for(const name of ['lake','flight','boat']){const img=photos[name]=new Image();img.onload=()=>{sceneRevision++;if(typeof drawWorld==='function')drawWorld()};img.onerror=()=>{if(typeof toast==='function')toast('实景照片暂未加载，已保留夜景与演出')};img.src='assets/'+name+(name==='boat'?'.png':'.jpg')}
function isFlight(){return mode==='symphony'&&pov==='flight'}
function drawPhotoWorld(){
 if(mode!=='symphony')return false;
 const img=photos[isFlight()?'flight':'lake'];if(!img?.complete||!img.naturalWidth)return false;
 wc.fillStyle='#0b111b';wc.fillRect(0,0,W,H);
 if(isFlight()){
  const cropY=img.height*.06,cropH=img.height*.94;const scale=Math.max(W/img.width,H/cropH);wc.drawImage(img,0,cropY,img.width,cropH,(W-img.width*scale)/2,(H-cropH*scale)/2,img.width*scale,cropH*scale);
  wc.fillStyle='#06101d22';wc.fillRect(0,0,W,H);horizon=H*1.2;
 }else{
  const dh=W*img.height/img.width,dy=H*(pov==='boat'?.65:.79)-dh*.55;
  // Retain photographic perspective; extend only the upper sky with its own cloud texture.
  wc.drawImage(img,0,0,img.width,img.height*.24,0,0,W,Math.max(H*.4,dy+dh*.24));
  wc.drawImage(img,0,dy,W,dh);
  const grade=wc.createLinearGradient(0,0,0,H);grade.addColorStop(0,'#030b17e8');grade.addColorStop(.35,'#050e1ddc');grade.addColorStop(.65,'#030c18b0');grade.addColorStop(1,'#02101b66');wc.fillStyle=grade;wc.fillRect(0,0,W,H);horizon=H*(pov==='boat'?.65:.79);
 }
 return true;
}
function applyCamera(){
 if(typeof gpuEnvironmentActive!=='undefined'&&gpuEnvironmentActive){if(cameraTransform!=='none'){for(const cv of [world,stage])cv.style.transform='none';cameraTransform='none'}return}
 let x=0,y=0,r=0,s=1;
 const reduce=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(mode==='symphony'&&!reduce){
  if(pov==='shore'){x=0;y=0;s=1}
  else if(pov==='boat'){x=Math.sin(showTime*.07)*.4;y=Math.sin(showTime*.7)*.3;r=Math.sin(showTime*.38)*.35;s=1.018}
  else {x=Math.sin(showTime*.009-1)*5.5;y=Math.sin(showTime*.018)*1.2;r=Math.sin(showTime*.012)*.6;s=1.16}
 }
 const transform=`translate(${x}%,${y}%) rotate(${r}deg) scale(${s})`;
 if(transform!==cameraTransform){for(const c of [world,stage])c.style.transform=transform;cameraTransform=transform}
}
function animateEnvironment(){
 if(mode!=='symphony')return;
 const key=pov+':'+W+':'+H+':'+sceneRevision;
 if(environmentKey!==key){if(!drawPhotoWorld())return;environmentCache=document.createElement('canvas');environmentCache.width=W;environmentCache.height=H;environmentCache.getContext('2d').drawImage(world,0,0);environmentKey=key}
 if(!environmentCache)return;
 wc.clearRect(0,0,W,H);wc.drawImage(environmentCache,0,0);const t=showTime;
 if(pov!=='flight'){drawNavigableWater(); }else{
  // Moving headlamps follow perspective-scaled city corridors, independently of camera drift.
  wc.save();wc.globalCompositeOperation='screen';for(let i=0;i<85;i++){const u=(i*.618+t*.008)%1;const lane=i%5;const y=H*(.5+lane*.085)+Math.sin(u*3+lane)*H*.035;const x=W*u;const bright=.15+(lane/5)*.45;wc.strokeStyle=i%2?`rgba(255,216,148,${bright})`:`rgba(255,100,62,${bright*.5})`;wc.lineWidth=H*(.0006+lane*.00012);wc.beginPath();wc.moveTo(x,y);wc.lineTo(x+W*.0025,y-H*.0005);wc.stroke()}
  wc.restore();
 }
 // Translucent cloud and mist layers move independently across the photographic scene.
 wc.save();wc.globalCompositeOperation='screen';for(let i=0;i<5;i++){const x=((i*.29+t*(pov==='flight'?.009:.002))%1.5-.25)*W,y=H*(pov==='flight'?.2+i*.11:.08+i*.035),r=W*(.14+i*.025);const g=wc.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(108,129,151,${pov==='flight'?.055:.018})`);g.addColorStop(1,'rgba(108,129,151,0)');wc.fillStyle=g;wc.fillRect(x-r,y-r,2*r,2*r)}wc.restore();
}

function drawPOV(){
 const cv=document.querySelector('#foreground');if(!cv)return;const key=mode+':'+pov+':'+W+':'+H;if(pov!=='boat'&&foregroundDrawKey===key)return;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}const c=cv.getContext('2d');c.clearRect(0,0,W,H);foregroundDrawKey=key;if(mode!=='symphony')return;
 if(pov==='boat'){
  c.save();c.globalCompositeOperation='screen';for(let side of [-1,1])for(let i=0;i<28;i++){const u=(i/28+showTime*.17)%1;const y=H*(.85+u*.15),x=W*(.5+side*(.035+u*.28));c.strokeStyle=`rgba(177,211,222,${(1-u)*.17})`;c.lineWidth=H*.001;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+side*W*.025,y+H*.008,x+side*W*.065,y+H*.014);c.stroke()}c.restore();
  if(photos.boat?.complete&&photos.boat.naturalWidth){const sway=Math.sin(showTime*.73)*H*.002;c.drawImage(photos.boat,W*.26,H*.72+sway,W*.48,H*.32)}
 }else if(pov==='flight'){
  c.fillStyle='#0c0d12';c.beginPath();c.rect(0,0,W,H);c.roundRect(W*.065,H*.06,W*.87,H*.88,H*.2);c.fill('evenodd');c.strokeStyle='#706c6666';c.lineWidth=H*.012;c.beginPath();c.roundRect(W*.065,H*.06,W*.87,H*.88,H*.2);c.stroke();c.strokeStyle='#050509';c.lineWidth=H*.025;c.beginPath();c.roundRect(W*.055,H*.045,W*.89,H*.91,H*.22);c.stroke();
 }
}
function setPOV(next){if(!['shore','boat','flight'].includes(next))return;pov=next;environmentKey='';SYMPHONY=SCORES[pov];switchShow('symphony');document.querySelectorAll('[data-pov]').forEach(b=>{const active=b.dataset.pov===pov;b.setAttribute('aria-pressed',String(active));b.classList.toggle('active',active)})}

async function enterLandscape(){
 if(innerWidth>1000&&innerHeight>600)return;
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();await window.screen?.orientation?.lock?.('landscape')}catch{}
}
function initViews(){document.querySelectorAll('[data-pov]').forEach(b=>b.onclick=()=>setPOV(b.dataset.pov));const skip=document.querySelector('#portrait-skip');if(skip)skip.onclick=()=>document.body.classList.add('portrait-accepted');const turn=document.querySelector('#rotate-start');if(turn)turn.onclick=()=>{enableSound()}}
// Skyline matte follows the photographed trees; distant sparks disappear behind the bank.
function occludeBank(){
 if(mode!=='symphony'||isFlight()||!photos.lake?.complete||!photos.lake.naturalWidth)return;
 const dh=W*photos.lake.height/photos.lake.width,dy=H*(pov==='boat'?.65:.79)-dh*.55;
 const outline=[[0,.46],[.03,.47],[.1,.46],[.14,.43],[.18,.43],[.22,.38],[.26,.38],[.29,.36],[.35,.38],[.39,.35],[.42,.37],[.44,.4],[.49,.36],[.52,.31],[.55,.3],[.58,.28],[.62,.33],[.66,.34],[.69,.24],[.72,.22],[.75,.21],[.79,.19],[.83,.24],[.86,.26],[.9,.22],[.94,.24],[1,.28]];
 sc.save();sc.globalCompositeOperation='destination-out';sc.beginPath();for(let i=0;i<outline.length;i++){const [x,y]=outline[i];let px=x,py=(dy+y*dh)/H;if(gpuEnvironmentActive){const projected=projectEnvironmentLandscapePoint(px,py,pov,showTime,horizon/H,W/H);px=projected.x;py=projected.y}if(i===0)sc.moveTo(px*W,Math.min(horizon,py*H));else sc.lineTo(px*W,Math.min(horizon,py*H))}sc.lineTo(W,horizon);sc.lineTo(0,horizon);sc.closePath();sc.fillStyle='#000';sc.fill();sc.restore();
}
function viewpointTitle(){if(mode!=='symphony')return;const d=THEMES[pov];document.querySelector('#title').textContent=d.title;document.querySelector('#subtitle').textContent=d.sub;document.querySelector('#location').textContent=d.location;document.querySelector('#tag').textContent=d.tag}
