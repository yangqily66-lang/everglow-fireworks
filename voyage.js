'use strict';
let waterGrain=null;
function makeWaterGrain(){
 if(waterGrain)return waterGrain;const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d');
 c.fillStyle='#07111b';c.fillRect(0,0,512,512);if(photos.lake?.complete){const im=photos.lake;c.drawImage(im,im.width*.05,im.height*.63,im.width*.9,im.height*.32,0,0,512,512);c.fillStyle='#02101c88';c.fillRect(0,0,512,512)}const rng=seeded(8041);
 for(let i=0;i<16000;i++){const x=rng()*512,y=rng()*512,w=1+rng()*15;const shade=Math.floor(17+rng()*27);c.strokeStyle=`rgba(${shade},${shade+13},${shade+23},${.1+rng()*.25})`;c.lineWidth=.4+rng()*.9;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+w*.5,y+rng()*2,x+w,y);c.stroke()}
 // Duplicate a seamless-enough field into a strip; sampling is anchored to world metres.
 const strip=document.createElement('canvas');strip.width=2048;strip.height=512;const cc=strip.getContext('2d');for(let i=0;i<4;i++)cc.drawImage(cv,i*512,0);waterGrain=strip;return strip;
}
function journeyProjection(x,z,height=0){const cameraZ=pov==='boat'?showTime*1.7:0;const dz=z-cameraZ;if(dz<=.4)return null;const f=H*.9,eye=pov==='boat'?1.1:3.3;return{x:W*.5+(x-Math.sin(showTime*.06)*.35)*f/dz,y:horizon+(eye-height)*f/dz,scale:f/dz,z:dz}}
function drawNavigableWater(){
 if(pov==='flight')return;const texture=makeWaterGrain(),f=H*.9,eye=pov==='boat'?1.1:3.3,travel=pov==='boat'?showTime*1.7:0,top=Math.round(horizon);
 const water=wc.createLinearGradient(0,top,0,H);water.addColorStop(0,'#18222c00');water.addColorStop(.25,'#0b1720bb');water.addColorStop(1,'#030b11');wc.fillStyle=water;wc.fillRect(0,top,W,H-top);
 for(let y=top+2;y<H;y+=2){const z=eye*f/(y-top),span=Math.min(1500,W*z/f*18),sy=((z+travel)*18+Math.sin(showTime*.6+z*.8)*1.2)%510,sx=256+Math.sin(showTime*.06)*8;wc.globalAlpha=Math.min(.9,(y-top)/H*5);wc.drawImage(texture,sx,sy,span,2,0,y,W,2)}wc.globalAlpha=1;
 // Broken, lengthened reflections respond to the active shells, on the same moving surface.
 wc.save();wc.globalCompositeOperation='screen';
 const sources=[{x:W*.18,rgb:[194,158,83],power:.25},{x:W*.61,rgb:[213,180,104],power:.3},{x:W*.87,rgb:[145,187,210],power:.2},...shellLights.map(l=>({x:l.x,rgb:RGB[l.col%9],power:Math.max(0,1-l.age/l.life)*l.size*.75}))];
 for(const light of sources){for(let k=0;k<60;k++){const d=k/60,y=top+d*(H-top),wave=Math.sin(k*2.41-showTime*2.3)*Math.sin(k*.71+showTime)*W*(.001+d*.012),spread=W*(.006+d*.045);wc.fillStyle=`rgba(${light.rgb},${light.power*(1-d)*(.12+.25*Math.sin(k*2.31+showTime)**2)})`;wc.fillRect(light.x+wave-spread*.5,y,spread,Math.max(1,H*.001*(1+d)))}}
 wc.restore();
 if(pov==='boat'){
  // Fixed mooring markers pass the viewer in perspective: far objects enlarge, approach and leave behind.
  for(let n=0;n<12;n++){const z=14+n*23;for(const side of [n%2?1:-1]){const point=journeyProjection(side*(2.8+Math.sin(n*5.6)*1.5),z);if(!point||point.y>H*1.15)continue;const h=point.scale*.32;wc.fillStyle='#19252a';wc.beginPath();wc.ellipse(point.x,point.y,point.scale*.11,point.scale*.04,0,0,TAU);wc.fill();wc.fillRect(point.x-point.scale*.018,point.y-h,point.scale*.036,h);const a=.35+.2*Math.sin(showTime+n);halo(wc,point.x,point.y-h,Math.max(2,point.scale*.09),'255,190,94',a);wc.fillStyle='#ffdda2';wc.fillRect(point.x-1,point.y-h-1,2,2)}}
 }
}
