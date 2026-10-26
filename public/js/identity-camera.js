'use strict';
(()=>{
 const form=document.getElementById('identity-verify-form');if(!form)return;
 const video=document.getElementById('identity-live-video'),canvas=document.getElementById('identity-camera-frame'),preview=document.getElementById('identity-photo-preview'),file=document.getElementById('identity-photo-file'),status=document.getElementById('identity-camera-status');
 const start=document.getElementById('identity-start-camera'),take=document.getElementById('identity-take-photo'),retake=document.getElementById('identity-retake-photo');
 let stream=null;
 function stop(){if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}}
 window.addEventListener('pagehide',stop);
 start.addEventListener('click',async()=>{try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera access requires HTTPS or localhost and a supported browser.');
  stop();stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:1600}}});video.srcObject=stream;video.hidden=false;preview.hidden=true;await video.play();take.disabled=false;status.textContent='Camera ready. Position the candidate and capture.';
 }catch(e){status.textContent='Camera unavailable: '+e.message+'. Use the device camera upload control below.';}});
 take.addEventListener('click',()=>{
  if(!video.videoWidth||!video.videoHeight)return;
  const vw=video.videoWidth,vh=video.videoHeight;let w=vw,h=vw*5/4;if(h>vh){h=vh;w=vh*4/5;}
  const ctx=canvas.getContext('2d');ctx.drawImage(video,(vw-w)/2,(vh-h)/2,w,h,0,0,480,600);
  canvas.toBlob(blob=>{if(!blob)return;const uploaded=new File([blob],'centre-camera.jpg',{type:'image/jpeg'});const dt=new DataTransfer();dt.items.add(uploaded);file.files=dt.files;preview.src=URL.createObjectURL(blob);preview.hidden=false;video.hidden=true;take.disabled=true;retake.disabled=false;status.textContent='Official 4:5 photo captured. Verify original ID before submitting.';stop();},'image/jpeg',0.9);
 });
 retake.addEventListener('click',()=>{file.value='';preview.hidden=true;retake.disabled=true;start.click();});
 file.addEventListener('change',()=>{if(file.files.length){stop();video.hidden=true;status.textContent='Photo selected. Verify it was captured here by authorised staff.';}});
})();
