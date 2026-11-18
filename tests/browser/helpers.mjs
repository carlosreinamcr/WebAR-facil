import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import sharp from 'sharp';
import {openCV} from '../../scripts/opencv-node.mjs';
import {scene,renderMarker,intrinsics} from '../fixtures/render-scene.mjs';
import {prepareMultiTargets} from '../fixtures/multi-target.mjs';

export async function prepareFrames({markerSource='public/marker.png',framePrefix='frame'}={}){
  const{cv}=await openCV(),world=scene(208,true);
  const marker=await sharp(markerSource).resize(800,600,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  await mkdir('tests/generated',{recursive:true});
  await prepareMultiTargets();
  await writeFile('tests/generated/calibration.json',JSON.stringify(intrinsics));
  await writeFile('tests/generated/distorted-calibration.json',JSON.stringify({...intrinsics,distortion:[.6,-.05,.001,-.002,0]}));
  const gradient=new Uint8Array(640*480*4);for(let y=0;y<480;y++)for(let x=0;x<640;x++){const i=(y*640+x)*4;gradient[i]=Math.round(x/639*255);gradient[i+1]=Math.round(y/479*255);gradient[i+2]=128;gradient[i+3]=255;}
  await sharp(gradient,{raw:{width:640,height:480,channels:4}}).png().toFile('tests/generated/gradient.png');
  await sharp('public/marker.png').withMetadata({orientation:6}).jpeg({quality:95}).toFile('tests/generated/rotated-exif.jpg');
  const frames=[];
  for(let i=0;i<42;i++){
    const x=i*.002,image=world.render(x).data;
    const data=i<30?renderMarker(cv,image,marker,x):image;
    const path=`tests/generated/${framePrefix}-${String(i).padStart(2,'0')}.png`;
    await sharp(data,{raw:{width:640,height:480,channels:4}}).png().toFile(path);frames.push('/'+path);
  }
  return frames;
}

export async function prepareVideo(){
  // Probar decodificación/render con el MP4 original distribuido. Recodificar en
  // cada suite podía producir cero bytes bajo carga y falsear fallos de cámara.
  // La regeneración del fixture sigue disponible en generate-demo-video.mjs.
  await mkdir('tests/generated',{recursive:true});
  await copyFile('public/videos/demo-chroma.mp4','tests/generated/chroma.mp4');
}

export async function prepareExampleMarkerFrame(){
  const {cv}=await openCV();
  const marker=await sharp('examples/assets/marcador.jpg').resize(800,600,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const frame=renderMarker(cv,scene(208,true).render().data,marker);
  await mkdir('tests/generated',{recursive:true});
  const path='tests/generated/example-marker.png';
  await sharp(frame,{raw:{width:640,height:480,channels:4}}).png().toFile(path);
  return `/${path}`;
}

export async function virtualCamera(page,frames,{width=640,height=480}={}){
  await page.addInitScript(({frames,width,height})=>{
    const support=navigator.mediaDevices.getSupportedConstraints.bind(navigator.mediaDevices);
    navigator.mediaDevices.getSupportedConstraints=()=>({...support(),facingMode:true});
    navigator.mediaDevices.getUserMedia=async constraints=>{
      if(constraints.video.facingMode?.exact)throw new Error('Webcam must not require a rear camera.');
      const images=await Promise.all(frames.map(src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;})));
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');
      let index=0,moving=false,frame=0;
      const draw=()=>{
        context.drawImage(images[index],0,0,width,height);
        // Los capturadores pueden omitir repintados idénticos.
        context.fillStyle=frame++%2?'#121212':'#303030';
        context.fillRect(0,0,2,2);
      };
      draw();const timer=setInterval(()=>{if(moving)index=Math.min(images.length-1,index+1);draw();},100);
      const stream=canvas.captureStream(30);
      for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
      window.__camera={move:()=>{moving=true;},freeze:()=>{moving=false;},setIndex:value=>{index=value;draw();},canvas,stream};
      return stream;
    };
  },{frames,width,height});
}
