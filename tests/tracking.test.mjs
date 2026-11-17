import {decodeMarker,encodeMarker} from '../src/tracking/ImageCompiler.ts';
import {GrayBuffers,createORB,extractORB,matchORB} from '../src/vision/features.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {BrowserWorker} from './fixtures/browser-worker.mjs';
import {openCV} from '../scripts/opencv-node.mjs';
import {projectWorld} from '../src/vision/geometry.ts';
import {matrixFromPose,quaternionFromMatrix} from '../src/spatial/PoseFilter.ts';
import {multiply} from '../src/spatial/matrices.ts';
import {projectionFromIntrinsics} from '../src/vision/calibration.ts';
import {TrackingContinuity} from '../src/tracking/TrackingContinuity.ts';
globalThis.self=globalThis;globalThis.Worker=BrowserWorker;
const{Tracker}=await import('../dist/webar-facil.core.js'),{cv}=await openCV();
const{data}=await sharp('public/marker.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const k={width:640,height:480,fx:650,fy:650,cx:320,cy:240};

function render(view,{dark=false,blur=false}={}){
  const corners=[[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]];
  const output=new cv.Mat(),input=cv.matFromArray(600,800,cv.CV_8UC4,data);
  const src=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,800,0,800,600,0,600]);
  const dst=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>projectWorld(p,view,k).slice(0,2)));
  const h=cv.getPerspectiveTransform(src,dst);cv.warpPerspective(input,output,h,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(35,35,35,255));
  if(blur)cv.GaussianBlur(output,output,new cv.Size(3,3),1.1);
  const pixels=new Uint8ClampedArray(output.data);
  if(dark)for(let i=0;i<pixels.length;i+=4)for(let channel=0;channel<3;channel++)pixels[i+channel]=pixels[i+channel]*.4+8;
  for(const resource of[output,input,src,dst,h])resource.delete();return pixels;
}

test('NFT Worker real: escala, perspectiva, recorte, poca luz y desenfoque',{timeout:30_000},async()=>{
  const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k,allowEstimatedCalibration:false});
  try{
    const bytes=await readFile('public/target.dat');await tracker.loadTarget(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
    const cases=[['frontal',.5,0,0,false,false],['cerca',.35,0,0,false,false],['lejos',.85,0,0,false,false],
      ['perspectiva',.5,0,.35,false,false],['recorte parcial',.5,.21,0,false,false],['luz reducida',.5,0,0,true,false],['desenfoque leve',.5,0,0,false,true]];
    let session=0;
    for(const[name,distance,x,tilt,dark,blur]of cases){
      const view=multiply(matrixFromPose([x,0,-distance],[Math.SQRT1_2,0,0,Math.SQRT1_2]),matrixFromPose([0,0,0],[Math.sin(tilt/2),0,0,Math.cos(tilt/2)]));
      const rgba=render(view,{dark,blur});
      const result=await tracker.processFrame({imageData:{data:rgba,width:640,height:480},sessionId:++session,timestampMs:session*33,mediaTimeSeconds:0,sourceWidth:640,sourceHeight:480});
      assert.equal(result.status,'tracked',name);assert.ok(result.inliers>=12,name);
      assert.ok(Math.hypot(...[12,13,14].map(i=>view[i]-result.matrix[i]))<.04,`${name}: traslación incorrecta`);
      const q=quaternionFromMatrix(view),r=quaternionFromMatrix(result.matrix),dot=Math.abs(q.reduce((sum,v,i)=>sum+v*r[i],0));
      assert.ok(dot>Math.cos(.12),`${name}: orientación incorrecta`);
    }
    const absent=await tracker.processFrame({imageData:{data:new Uint8ClampedArray(640*480*4).fill(255),width:640,height:480},sessionId:++session,timestampMs:1000,mediaTimeSeconds:1,sourceWidth:640,sourceHeight:480});
    assert.equal(absent.status,'not-found');assert.equal(absent.matrix,null);
  }finally{tracker.dispose();}
});

test('continuidad: tolera pérdida breve sin inventar poses y confirma pérdida sostenida',()=>{
  const state=new TrackingContinuity(120);
  assert.equal(state.update(false,0),'lost');assert.equal(state.update(true,10),'tracked');
  assert.equal(state.update(false,43),'recovering');assert.equal(state.update(false,109),'recovering');
  assert.equal(state.update(false,130),'lost');assert.equal(state.update(true,163),'tracked');
  state.reset();assert.equal(state.update(false,164),'lost');
  const strict=new TrackingContinuity(0);strict.update(true,1);assert.equal(strict.update(false,2),'lost');
});

test('etiqueta cilíndrica: recupera el eje desde varios ángulos y descarta fondo vacío',{timeout:30_000},async()=>{
  const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k});
  const bytes=await readFile('public/target.dat');
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
  const marker=decodeMarker(buffer),diameter=.17,radius=diameter/2,distance=.45;
  const width=marker.physicalWidthMeters,height=width*marker.height/marker.width;
  function frame(yaw){
    const rgba=new Uint8ClampedArray(k.width*k.height*4);
    for(let y=0;y<k.height;y++)for(let x=0;x<k.width;x++){
      const dx=(x-k.cx)/k.fx,dy=(k.cy-y)/k.fy,a=dx*dx+1;
      const delta=distance*distance-a*(distance*distance-radius*radius);
      const index=(y*k.width+x)*4;
      rgba[index]=rgba[index+1]=rgba[index+2]=35;rgba[index+3]=255;
      if(delta<0)continue;
      const depth=(distance-Math.sqrt(delta))/a;
      const angle=Math.atan2(dx*depth,distance-depth)-yaw;
      const u=angle*radius/width+.5,v=.5-dy*depth/height;
      if(u<0||u>=1||v<0||v>=1)continue;
      const sample=(Math.floor(v*600)*800+Math.floor(u*800))*4;
      rgba.set(data.subarray(sample,sample+3),index);
    }
    return rgba;
  }
  const detect=(data,sessionId)=>tracker.processFrame({imageData:{data,width:k.width,height:k.height},
    sessionId,timestampMs:sessionId*33,mediaTimeSeconds:0,sourceWidth:k.width,sourceHeight:k.height});
  try{
    await assert.rejects(tracker.loadTarget(buffer.slice(0),undefined,'can',.01),/circunferencia/);
    await tracker.loadTarget(buffer,undefined,'can',diameter);
    for(const [index,yaw] of [0,.27,-.31].entries()){
      const result=await detect(frame(yaw),index+1);
      assert.equal(result.status,'tracked',`yaw ${yaw}`);
      assert.ok(Math.hypot(result.matrix[12],result.matrix[13],result.matrix[14]+distance)<.025);
      assert.ok(Math.abs(Math.atan2(result.matrix[8],result.matrix[10])-yaw)<.12);
    }
    assert.equal((await detect(new Uint8ClampedArray(k.width*k.height*4).fill(255),4)).status,'not-found');
  }finally{tracker.dispose();}
});

test('NFT sostenido: cambios de escala, luz, oclusión parcial y redetección',{timeout:45_000},async()=>{
  const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k});
  try{
    const bytes=await readFile('public/target.dat');await tracker.loadTarget(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
    let detected=0,cachedAttempts=0,fullDetections=0;
    for(let i=0;i<48;i++){
      const view=multiply(matrixFromPose([.04*Math.sin(i*.14),0,-(.5+.09*Math.sin(i*.1))],[Math.SQRT1_2,0,0,Math.SQRT1_2]),
        matrixFromPose([0,0,0],[Math.sin(.35*Math.sin(i*.09)/2),0,0,Math.cos(.35*Math.sin(i*.09)/2)]));
      const absent=i>=28&&i<32;
      const rgba=absent?new Uint8ClampedArray(640*480*4).fill(255):render(view,{blur:i%8===0,dark:i>=16&&i<24});
      if(i>=8&&i<16)for(let y=140;y<320;y++)for(let x=330;x<460;x++){
        const offset=(y*640+x)*4;rgba[offset]=rgba[offset+1]=rgba[offset+2]=45;
      }
      const result=await tracker.processFrame({imageData:{data:rgba,width:640,height:480},sessionId:1,timestampMs:i*33,mediaTimeSeconds:i/30,sourceWidth:640,sourceHeight:480});
      const profile=tracker.latestProfile;assert.ok(profile);cachedAttempts+=profile.counts.cachedAttempts;fullDetections+=profile.counts.fullDetections;
      assert.ok(profile.timings.roundTripMs>=profile.timings.workerMs-.5);
      assert.ok(Object.values(profile.timings).every(value=>Number.isFinite(value)&&value>=0));
      const saved=tracker.latestProfile;profile.counts.redetections=99999;assert.equal(tracker.latestProfile.counts.redetections,saved.counts.redetections);
      if(absent){assert.equal(result.status,'not-found');continue;}
      if(result.status==='tracked'){
        detected++;assert.ok(result.reprojectionErrorPx<3.5);
        const errors=[[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]].map(point=>{
          const actual=projectWorld(point,result.matrix,k),expected=projectWorld(point,view,k);return Math.hypot(actual[0]-expected[0],actual[1]-expected[1]);});
        assert.ok(Math.max(...errors)<8,`frame ${i}: registro ${Math.max(...errors).toFixed(1)}px`);
      }
      if(i===32)assert.equal(result.status,'tracked','recuperación al volver a observar el marcador');
    }
    const frontal=matrixFromPose([0,0,-.5],[Math.SQRT1_2,0,0,Math.SQRT1_2]);
    await tracker.processFrame({imageData:{data:render(frontal),width:640,height:480},sessionId:1,timestampMs:48*33,mediaTimeSeconds:48/30,sourceWidth:640,sourceHeight:480});
    const noise=new Uint8ClampedArray(640*480*4);let seed=12345;
    for(let i=0;i<noise.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise[i]=seed>>>24;noise[i+1]=seed>>>16&255;noise[i+2]=seed>>>8&255;noise[i+3]=255;}
    const foreign=await tracker.processFrame({imageData:{data:noise,width:640,height:480},sessionId:1,timestampMs:49*33,mediaTimeSeconds:49/30,sourceWidth:640,sourceHeight:480});assert.ok(tracker.latestProfile.counts.cachedAttempts>0);assert.equal(foreign.status,'not-found','No aceptar textura ajena con una caché activa');
    const view=matrixFromPose([0,0,-.5],[Math.SQRT1_2,0,0,Math.SQRT1_2]);
    const reset=await tracker.processFrame({imageData:{data:render(view),width:640,height:480},sessionId:2,timestampMs:50*33,mediaTimeSeconds:50/30,sourceWidth:640,sourceHeight:480});assert.equal(reset.status,'tracked');assert.equal(tracker.latestProfile.counts.cachedAttempts,0,'Una sesión nueva descarta la referencia verificada');assert.equal(tracker.latestProfile.counts.fullDetections,1);
    assert.ok(cachedAttempts>0,'Debe usar el subconjunto verificado');assert.ok(fullDetections>=2,'Debe conservar búsqueda global y recuperación');
    assert.ok(detected>=42,`${detected}/44 frames con marcador detectados`);
  }finally{tracker.dispose();}
});

test('NFT automático: sin calibración, movimiento, perspectiva y recuperación',{timeout:30_000},async()=>{
  const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url)});
  try{
    const bytes=await readFile('public/target.dat');await tracker.loadTarget(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
    let timestamp=0;
    const process=rgba=>tracker.processFrame({imageData:{data:rgba,width:640,height:480},sessionId:1,
      timestampMs:timestamp+=33,mediaTimeSeconds:timestamp/1000,sourceWidth:640,sourceHeight:480});
    const corners=[[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]];
    for(let i=0;i<18;i++){
      if(i===9){
        const lost=await process(new Uint8ClampedArray(640*480*4).fill(255));
        assert.equal(lost.status,'not-found');assert.equal(lost.matrix,null);
      }
      const tilt=Math.sin(i/5)*.3,x=Math.sin(i/7)*.04,distance=.5+i*.006;
      const view=multiply(matrixFromPose([x,0,-distance],[Math.SQRT1_2,0,0,Math.SQRT1_2]),matrixFromPose([0,0,0],[Math.sin(tilt/2),0,0,Math.cos(tilt/2)]));
      const result=await process(render(view));assert.equal(result.status,'tracked',`frame ${i}`);
      assert.equal(result.projectionSource,'estimated');
      const automatic=result.reference.intrinsics;
      assert.deepEqual(result.projectionMatrix,projectionFromIntrinsics(automatic));
      const errors=corners.map(point=>{const actual=projectWorld(point,result.matrix,automatic),expected=projectWorld(point,view,k);
        return Math.hypot(actual[0]-expected[0],actual[1]-expected[1]);});
      assert.ok(Math.max(...errors)<8,`frame ${i}: alineación en pantalla ${Math.max(...errors).toFixed(2)}px`);
    }
  }finally{tracker.dispose();}
});

test('NFT: vistas offline inclinadas y saltos rápidos sin calibración manual',{timeout:40_000},async()=>{
  const{ImageCompiler}=await import('../src/tracking/ImageCompiler.ts');
  const compiler=new ImageCompiler(),buffer=await compiler.compileRGBA({data:new Uint8ClampedArray(data),width:800,height:600},{physicalWidthMeters:.2,opencvURL:new URL('../public/vision/opencv.js',import.meta.url).href});
  const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url)});
  try{
    await tracker.loadTarget(buffer);
    for(const[i,[tilt,x]]of [[0,0],[.75,0],[1.05,0],[-.95,0],[.2,.11],[.2,-.11],[0,0]].entries()){
      const view=multiply(matrixFromPose([x,0,-.55],[Math.SQRT1_2,0,0,Math.SQRT1_2]),matrixFromPose([0,0,0],[Math.sin(tilt/2),0,0,Math.cos(tilt/2)]));
      const result=await tracker.processFrame({imageData:{data:render(view),width:640,height:480},sessionId:1,timestampMs:i*33,mediaTimeSeconds:i/30,sourceWidth:640,sourceHeight:480});
      assert.equal(result.status,'tracked',`frame ${i}: tilt ${tilt}`);assert.ok(result.inliers>=12);
    }
  }finally{tracker.dispose();}
});


test('NFT: soporte escaso distribuido evita búsquedas globales por cantidad y conserva recuperación',{timeout:30000},async()=>{
 const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k});
 try{
  const bytes=await readFile('public/target.dat');await tracker.loadTarget(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
  let global=0,sparse=0,reliable=0;
  const view=matrixFromPose([0,0,-1.05],[Math.SQRT1_2,0,0,Math.SQRT1_2]);
  for(let i=0;i<60;i++){
   const absent=i===35;
   const result=await tracker.processFrame({imageData:{data:absent?new Uint8ClampedArray(640*480*4).fill(255):render(view),width:640,height:480},sessionId:1,timestampMs:i*33,mediaTimeSeconds:i/30,sourceWidth:640,sourceHeight:480});
   const p=tracker.latestProfile;global+=p.counts.fullDetections;reliable+=p.counts.flowReliable;
   if(p.counts.flowInputPoints>=12&&p.counts.flowInputPoints<24&&p.counts.flowReliable)sparse++;
   assert.equal(result.status,absent?'not-found':'tracked',String(i));
   if(!absent){for(const point of [[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]]){const a=projectWorld(point,result.matrix,k),b=projectWorld(point,view,k);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<8);}}
  }
  assert.ok(sparse>=30,'Ejercitar 12–23 puntos fiables en Worker real');assert.ok(reliable>=40);assert.ok(global>=3&&global<=8,'Revisar periódicamente y al perder soporte sin redetectar cada frame');
 }finally{tracker.dispose();}
});


test('NFT: referencia verificada con menos de 30 descriptores necesita evidencia geométrica y evita matching global',{timeout:30000},async()=>{
 const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k});
 const gray=new GrayBuffers(cv),orb=createORB(cv),resources=[];
 try{
  const bytes=await readFile('public/target.dat'),marker=decodeMarker(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
  const view=matrixFromPose([0,0,-1.05],[Math.SQRT1_2,0,0,Math.SQRT1_2]),rgba=render(view);
  const features=extractORB(cv,gray.frame(rgba,640,480),orb),matches=matchORB(cv,marker.descriptors,features.descriptors);
  const a=cv.matFromArray(matches.length,1,cv.CV_32FC2,matches.flatMap(m=>[marker.keypoints[4*m.query],marker.keypoints[4*m.query+1]]));resources.push(a);
  const b=cv.matFromArray(matches.length,1,cv.CV_32FC2,matches.flatMap(m=>[features.keypoints[4*m.train],features.keypoints[4*m.train+1]]));resources.push(b);
  const mask=new cv.Mat();resources.push(mask);resources.push(cv.findHomography(a,b,cv.RANSAC,3,mask,1500,.995));
  const bins=new Map();for(let i=0;i<matches.length;i++)if(mask.data[i]){const q=matches[i].query,cell=Math.floor(marker.keypoints[4*q]/marker.width*6)+6*Math.floor(marker.keypoints[4*q+1]/marker.height*6);const bin=bins.get(cell)??[];bin.push(q);bins.set(cell,bin);}
  const selected=[];for(let level=0;selected.length<23;level++){let added=false;for(const bin of bins.values()){if(bin[level]!==undefined){selected.push(bin[level]);added=true;if(selected.length===23)break;}}if(!added)break;}
  assert.equal(selected.length,23);
  await tracker.loadTarget(encodeMarker({width:marker.width,height:marker.height,keypoints:new Float32Array(selected.flatMap(i=>Array.from(marker.keypoints.subarray(4*i,4*i+4)))),descriptors:new Uint8Array(selected.flatMap(i=>Array.from(marker.descriptors.subarray(32*i,32*i+32))))},{physicalWidthMeters:.2,extractorId:marker.extractorId}));
  let cached=0,global=0;
  for(let i=0;i<20;i++){
   const result=await tracker.processFrame({imageData:{data:rgba.slice(),width:640,height:480},sessionId:1,timestampMs:i*33,mediaTimeSeconds:i/30,sourceWidth:640,sourceHeight:480});
   assert.equal(result.status,'tracked',String(i));assert.ok(result.inliers<=23);cached+=tracker.latestProfile.counts.cachedAttempts;global+=tracker.latestProfile.counts.fullDetections;
   for(const point of [[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]]){const a=projectWorld(point,result.matrix,k),b=projectWorld(point,view,k);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<8);}
  }
  assert.ok(cached>=2);assert.equal(global,1,'La caché de 23 descriptores con geometría válida debe confirmar sin búsqueda global');
 }finally{tracker.dispose();gray.dispose();orb.delete();for(const resource of resources)resource.delete();}
});
