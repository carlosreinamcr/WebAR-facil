import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CameraManager} from '../dist/webar-facil.core.js';
import {PoseFilter,matrixFromPose,quaternionFromMatrix} from '../src/spatial/PoseFilter.ts';
import {identity,assertRigid} from '../src/spatial/matrices.ts';

function environment(supported=true,expectedDevice=null){
  const callbacks=new Map(),doc=new EventTarget(),requests=[];let id=0,resolveStream;
  Object.assign(doc,{visibilityState:'visible',createElement:()=>Object.assign(new EventTarget(),{setAttribute(){},play:async()=>{},pause(){},remove(){},readyState:2,currentTime:0,videoWidth:640,videoHeight:480})});
  globalThis.document=doc;globalThis.isSecureContext=true;globalThis.HTMLMediaElement={HAVE_CURRENT_DATA:2};
  globalThis.requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};globalThis.cancelAnimationFrame=id=>callbacks.delete(id);
  globalThis.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return{drawImage(){},getImageData:(_x,_y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)})};}};
  const track=Object.assign(new EventTarget(),{readyState:'live',stopped:0,constraints:[],stop(){this.stopped++;},getCapabilities:()=>({focusMode:['continuous','manual'],focusDistance:{min:0,max:10}}),getSettings:()=>({width:640,height:480}),async applyConstraints(value){this.constraints.push(value);}});
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getSupportedConstraints:()=>({facingMode:supported}),getUserMedia:options=>{requests.push(options);if(expectedDevice)assert.equal(options.video.deviceId.exact,expectedDevice);else if(supported)assert.equal(options.video.facingMode.ideal,'environment');else assert.equal(options.video.facingMode,undefined);return new Promise(resolve=>{resolveStream=resolve;});}}}});
  return{doc,track,callbacks,requests,grant:()=>resolveStream(stream),tick(time){const[key,fn]=callbacks.entries().next().value;callbacks.delete(key);fn(time);}};
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('cámara: autoenfoque, backpressure, pausa de página y liberación',async()=>{
  const env=environment();let complete,frames=0;
  const camera=new CameraManager({onFrame:()=>{frames++;return new Promise(resolve=>{complete=resolve;});}});
  const start=camera.start();env.grant();await start;
  assert.equal(env.track.constraints[0].advanced[0].focusMode,'continuous');
  env.tick(0);env.tick(20);assert.equal(frames,1);complete();await flush();
  env.doc.visibilityState='hidden';env.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(camera.state,'paused');assert.equal(env.callbacks.size,0);
  env.doc.visibilityState='visible';env.doc.dispatchEvent(new Event('visibilitychange'));await flush();
  assert.equal(camera.state,'running');await camera.setFocus('manual',3);
  await assert.rejects(camera.setFocus('manual',11),RangeError);
  camera.dispose();assert.equal(env.track.stopped,1);assert.equal(env.callbacks.size,0);
});
test('cámara: un permiso tardío tras stop no deja un stream abierto',async()=>{
  const env=environment(),camera=new CameraManager({onFrame(){}}),starting=camera.start();
  const cancelled=assert.rejects(starting,{name:'AbortError'});camera.stop();await cancelled;env.grant();await flush();
  assert.equal(env.track.stopped,1);camera.dispose();
});

test('cámara: autoenfoque pendiente no bloquea vídeo ni frames; publica etapas reales',async()=>{
  const env=environment(),phases=[];
  env.track.applyConstraints=()=>new Promise(()=>{});
  const camera=new CameraManager({onFrame(){},onStatus:phase=>phases.push(phase)});
  const starting=camera.start();assert.deepEqual(phases,['camera-requesting']);env.grant();
  await Promise.race([starting,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Autoenfoque bloqueó el inicio')),500))]);
  assert.equal(camera.state,'running');assert.ok(camera.videoElement.srcObject);
  assert.deepEqual(phases,['camera-requesting','camera-granted','camera-playing']);
  assert.equal(env.callbacks.size,1);camera.dispose();assert.equal(env.track.stopped,1);
});

test('cámara: Detener cancela enfoque manual y play pendientes sin dejar la sesión bloqueada',async()=>{
  for(const stage of ['focus','play']){
    const env=environment(),camera=new CameraManager({focusMode:'manual',onFrame(){}});
    if(stage==='focus')env.track.applyConstraints=()=>new Promise(()=>{});
    else camera.videoElement.play=()=>new Promise(()=>{});
    const starting=camera.start(),cancelled=assert.rejects(starting,{name:'AbortError'});
    env.grant();await flush();assert.equal(camera.state,'starting');camera.stop();await cancelled;
    assert.equal(camera.state,'idle');assert.equal(env.track.stopped,1);camera.dispose();
  }
});
test('filtro: slerp conserva rigidez y reduce jitter sin mezclar matrices',()=>{
  const q=[0,Math.sin(.7),0,Math.cos(.7)],pose=matrixFromPose([1,2,3],q),roundtrip=quaternionFromMatrix(pose);
  assert.ok(Math.abs(roundtrip.reduce((sum,v,i)=>sum+v*q[i],0))>.9999);
  const filter=new PoseFilter(),values=[];
  for(let i=0;i<80;i++){const m=identity();m[12]=i%2?.005:-.005;const output=filter.filter(m,i*16.67);assertRigid(output);if(i>20)values.push(output[12]);}
  assert.ok(values.reduce((sum,v)=>sum+v*v,0)/values.length<.005**2*.5);
});

test('webcam: funciona sin facingMode y permite seleccionar deviceId',async()=>{
  for(const [supported,deviceId] of [[false,undefined],[true,'usb-webcam']]){
    const env=environment(supported,deviceId),camera=new CameraManager({deviceId,onFrame(){}});
    const starting=camera.start();env.grant();await starting;
    assert.equal(camera.state,'running');camera.dispose();assert.equal(env.track.stopped,1);
  }
});

test('cámara: el ancho de una semilla permanece fijo incluso con feedback de marcador pequeño',async()=>{
  const env=environment(),widths=[],camera=new CameraManager({onFrame:frame=>{widths.push(frame.imageData.width);}});
  const starting=camera.start();env.grant();await starting;camera.setAnalysisWidth(320);env.tick(0);await flush();
  camera.setTrackingFeedback([{targetId:'a',state:'tracking',targetSizePx:80,inliers:20,issues:[]}]);
  camera.videoElement.currentTime=.1;env.tick(40);await flush();
  assert.deepEqual(widths,[320,320]);camera.dispose();
});

test('cámara: perfiles negocian captura; presupuesto acotado en vertical y horizontal',async()=>{
  for(const [mode,captureWidth,captureHeight,fps,budget] of [['auto',960,540,30,307200],['balanced',1280,720,30,307200],['battery',640,480,20,172800],['quality',1920,1080,30,921600]]){
    for(const [width,height] of [[720,1280],[1280,720]]){
      const env=environment(),frames=[],camera=new CameraManager({performance:mode,adaptive:false,onFrame:frame=>{frames.push(frame.imageData);}});
      camera.videoElement.videoWidth=width;camera.videoElement.videoHeight=height;
      const pending=camera.start();env.grant();await pending;env.tick(0);await flush();
      const request=env.requests[0].video,frame=frames[0];
      assert.equal(request.width.ideal,captureWidth);assert.equal(request.height.ideal,captureHeight);assert.equal(request.frameRate.ideal,fps);
      assert.ok(frame.width*frame.height<=budget);assert.ok(Math.abs(frame.height-frame.width*height/width)<=.5);
      camera.dispose();
    }
  }
  assert.throws(()=>new CameraManager({performance:'unknown',onFrame(){}}),/performance/);
  assert.throws(()=>new CameraManager({maxFramePixels:0,onFrame(){}}),/maxFramePixels/);
});

test('cámara: carga sostenida adapta análisis; protege marcador débil y resolución del mapa',async t=>{
  let now=0;t.mock.method(performance,'now',()=>now);
  for(const policy of ['image','weak-target','map']){
    now=0;const env=environment(),widths=[],camera=new CameraManager({onFrame:frame=>{widths.push(frame.imageData.width);now+=120;}});
    if(policy==='weak-target')camera.setTrackingFeedback([{state:'tracking',targetSizePx:80,inliers:20,issues:[]}]);
    if(policy==='map')camera.setAdaptiveResolution(false);
    const pending=camera.start();env.grant();await pending;
    for(let i=0;i<35;i++){camera.videoElement.currentTime=i*.2;env.tick(now);await flush();}
    assert.ok(widths.length>20);
    if(policy==='image')assert.ok(widths.at(-1)<widths[0],'Reducir trabajo tras varias muestras lentas');
    else if(policy==='weak-target')assert.ok(widths.at(-1)>widths[0],'El detalle sube para un marcador pequeño incluso bajo carga');
    else assert.ok(widths.every(width=>width===widths[0]),'La resolución del mapa permanece fija');
    camera.dispose();
  }
});

test('cámara: restaurar ancho de mapa conserva dimensiones aunque supere el presupuesto',async()=>{
  const env=environment(),sizes=[],camera=new CameraManager({adaptive:false,onFrame:frame=>{sizes.push([frame.imageData.width,frame.imageData.height]);}});
  camera.videoElement.videoWidth=720;camera.videoElement.videoHeight=1280;
  const pending=camera.start();env.grant();await pending;env.tick(0);await flush();
  camera.setAnalysisWidth(640);camera.setAdaptiveResolution(false);camera.videoElement.currentTime=.1;env.tick(100);await flush();
  assert.ok(sizes[0][0]*sizes[0][1]<=307200);assert.deepEqual(sizes[1],[640,1138]);
  camera.setAdaptiveResolution(true);camera.videoElement.currentTime=.2;env.tick(200);await flush();
  assert.deepEqual(sizes[2],sizes[0]);camera.dispose();
});
