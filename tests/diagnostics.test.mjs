import {createTrackingProfile,copyTrackingProfile} from '../src/tracking/profile.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARDiagnostics} from '../src/diagnostics/ARDiagnostics.ts';
import {SurfacePlacement} from '../src/wrappers/SurfacePlacement.ts';
import {identity} from '../src/spatial/matrices.ts';

function source(){
  const listeners=new Map(),engine={state:'Camera',cameraSettings:{width:640,height:480,frameRate:30,deviceId:'private-device',groupId:'private-group'},targetIds:['poster']};
  for(const name of ['Pose','Status','Error','Metrics','TargetFound','TargetLost','TrackingQuality'])engine['on'+name]=fn=>{const set=listeners.get(name)??new Set();set.add(fn);listeners.set(name,set);return()=>set.delete(fn);};
  return{engine,emit:(name,...values)=>listeners.get(name)?.forEach(fn=>fn(...values)),size:()=>[...listeners.values()].reduce((n,set)=>n+set.size,0)};
}
const pose=(backend='image')=>({backend,targetId:'poster',timestampMs:0,scale:'relative',matrix:identity(),worldMatrix:identity(),viewMatrix:identity(),projectionMatrix:null});

test('Diagnóstico: métricas, recuperación, datos acotados y exclusión de datos sensibles',()=>{
  const fake=source();let now=0;const diagnostics=new ARDiagnostics(fake.engine,{now:()=>now,sampleLimit:16,context:{execution:'automated',platform:'android'},configuration:{analysisWidth:640,requestedFPS:30,mode:'image'}});
  fake.emit('Status','camera-ready');fake.emit('TargetFound',{targetId:'poster'});now=100;fake.emit('TargetLost',{targetId:'poster',reason:'lost'});now=350;fake.emit('TargetFound',{targetId:'poster'});
  for(let i=0;i<50;i++){now+=20;fake.emit('Metrics',{processingMs:i,readbackMs:2,processedFrames:i,skippedFrames:0,averageProcessingMs:20,analysisWidth:640,targetAnalysisFPS:30});fake.emit('Pose',identity(),pose());diagnostics.recordRenderFrame();}
  fake.emit('Error',new Error('No se pudo cargar https://example.com/private?token=secret'));for(let i=0;i<400;i++)diagnostics.mark('test',String(i));
  const tracking=createTrackingProfile();tracking.timings.matchingMs=12;tracking.timings.workerMs=20;tracking.counts.cachedAttempts=1;
  fake.emit('Metrics',{processingMs:23,readbackMs:2,consumerMs:21,tracking,odometry:{flowMs:10,workerMs:20}});
  const measured=diagnostics.snapshot();assert.equal(measured.tracking.frames,1);assert.equal(measured.tracking.stages.matchingMs.mean,12);assert.equal(measured.tracking.paths.cachedAttempts,1);
  assert.equal(measured.odometry.frames,1);assert.equal(measured.odometry.stages.flowMs.mean,10);
  assert.equal(measured.odometry.stages.planeMs.count,0);assert.equal(measured.metrics.consumerMs.mean,21);
  measured.metrics.latestCamera.odometry.flowMs=99;assert.equal(diagnostics.snapshot().metrics.latestCamera.odometry.flowMs,10);
  measured.metrics.latestCamera.tracking.counts.cachedAttempts=999;assert.equal(diagnostics.snapshot().metrics.latestCamera.tracking.counts.cachedAttempts,1);
  diagnostics.recordRenderer({drawCalls:25,triangles:120000,geometries:12,textures:8,drawingBufferWidth:390,drawingBufferHeight:300,pixelRatio:1});
  diagnostics.recordRenderer({drawCalls:3,triangles:12,geometries:12,textures:8,drawingBufferWidth:390,drawingBufferHeight:300,pixelRatio:1});
  diagnostics.recordRenderer({drawCalls:NaN});
  diagnostics.observe('stationary','pending');const report=diagnostics.snapshot();assert.equal(report.targets.poster.recoveriesMs[0],250);assert.equal(report.metrics.processingMs.count,51);assert.equal(report.metrics.processingMs.quantileSamples,16);assert.equal(report.timeline.length,256);
  const text=JSON.stringify(report);assert.ok(!text.includes('private-device')&&!text.includes('private-group')&&!text.includes('token=secret')&&!text.includes('worldMatrix')&&!text.includes('rgba'));
  assert.equal(report.context.execution,'automated');assert.equal(report.context.platform,'android');assert.equal(report.observations[0].result,'pending');
  assert.equal(report.renderer.peakDrawCalls,25);assert.equal(report.renderer.peakTriangles,120000);assert.equal(report.renderer.latest.triangles,12);report.renderer.latest.triangles=999;assert.equal(diagnostics.snapshot().renderer.latest.triangles,12);
  assert.equal(report.configuration.analysisWidth,640);assert.equal(report.configuration.requestedFPS,30);
  diagnostics.stop();assert.equal(fake.size(),0);const count=diagnostics.snapshot().poses.count;fake.emit('Pose',identity(),pose());assert.equal(diagnostics.snapshot().poses.count,count);assert.equal(diagnostics.snapshot().recording,false);
});

test('Diagnóstico: descriptores iOS/Android son declarados y errores redactan URLs',()=>{
  const fake=source(),diagnostics=new ARDiagnostics(fake.engine);diagnostics.setContext({platform:'ios',execution:'physical-user-reported',deviceModel:'iPhone de prueba'});
  diagnostics.recordError(new Error('https://host.invalid/asset.glb?auth=private'));
  assert.ok(!JSON.stringify(diagnostics.snapshot()).includes('auth=private'));assert.equal(diagnostics.snapshot().context.platform,'ios');
  assert.throws(()=>diagnostics.setContext({execution:'certified'}));diagnostics.stop();
});

test('Colocación manual: necesita pose fresca, no altera matrices y recupera sin ancla inventada',()=>{
  let now=0,stale=0;const states=[],guide=new SurfacePlacement(true,state=>states.push(state),()=>now,()=>stale++);guide.begin();assert.equal(guide.state,'scanning');assert.throws(()=>guide.confirm());
  const input=pose('optical-flow');input.worldMatrix[12]=2;guide.observePose(input);assert.equal(guide.state,'surface-found');assert.equal(guide.reticle.matrix.elements[12],2);assert.equal(guide.canConfirm,true);
  now=800;assert.throws(()=>guide.confirm());input.timestampMs=now;guide.observePose(input);guide.confirm();assert.equal(guide.state,'placed');assert.equal(input.worldMatrix[12],2);
  now=1900;guide.tick();assert.equal(guide.state,'lost');guide.observePose(input);assert.equal(stale,1);assert.equal(guide.state,'lost','Una respuesta tardía no renueva la frescura de captura');input.timestampMs=now;guide.observePose(input);assert.equal(guide.state,'placed');guide.status('scan-floor');assert.equal(guide.state,'scanning');assert.equal(guide.canConfirm,false);guide.dispose();
});

test('Colocación: perder el seguimiento conserva la confirmación solo dentro del mismo mapa',()=>{
  const guide=new SurfacePlacement(true,()=>{},()=>0);
  try{
    guide.begin();guide.status('odometry-lost');assert.equal(guide.state,'scanning');
    const input=pose('optical-flow');
    guide.observePose(input);guide.confirm();
    guide.status('odometry-lost');assert.equal(guide.state,'lost');
    guide.observePose(input);assert.equal(guide.state,'placed');
    guide.status('odometry-map-reset');guide.observePose(input);
    assert.equal(guide.state,'surface-found');assert.equal(guide.canConfirm,true);
  }finally{guide.dispose();}
});

test('Colocación automática: vista previa del plano verificado y control de visibilidad',()=>{
  let now=0;
  const enabled=new SurfacePlacement(false,()=>{},()=>now);
  const disabled=new SurfacePlacement(false,()=>{},()=>now,undefined,false);
  try{
    const plane={...pose('optical-flow'),surfaceDetected:true};
    enabled.observePose(plane);disabled.observePose(plane);
    assert.equal(enabled.state,'placed');
    assert.equal(enabled.reticle.visible,true);
    assert.equal(enabled.reticle.children[0].visible,true);
    assert.equal(disabled.reticle.visible,false);
    now=800;plane.timestampMs=800;enabled.observePose(plane);
    now=1501;enabled.tick();
    assert.equal(enabled.state,'placed');assert.equal(enabled.reticle.visible,false);
  }finally{enabled.dispose();disabled.dispose();}
});

test('WebXR: un hit-test es propuesta y solo una pose colocada confirma',()=>{
  const guide=new SurfacePlacement(true,()=>{},()=>0);guide.begin();guide.observeSurface(identity());assert.equal(guide.state,'surface-found');assert.equal(guide.canConfirm,false);assert.throws(()=>guide.confirm());guide.observePose(pose('webxr'));assert.equal(guide.state,'placed');guide.dispose();
});


test('Perfil NFT: validar tiempos y contadores, copiar sin compartir memoria',()=>{
 const profile=createTrackingProfile();profile.timings.workerMs=12;profile.counts.fullDetections=1;
 const copy=copyTrackingProfile(profile);assert.deepEqual(copy,profile);copy.timings.workerMs=50;assert.equal(profile.timings.workerMs,12);
 profile.timings.poseMs=NaN;assert.equal(copyTrackingProfile(profile),null);profile.timings.poseMs=0;profile.counts.cachedAttempts=.5;assert.equal(copyTrackingProfile(profile),null);
 assert.equal(copyTrackingProfile({}),null);assert.equal(copyTrackingProfile(null),null);
});


test('Cuadrícula: el giro visual conserva todos sus vértices sobre el plano verificado',()=>{
  const guide=new SurfacePlacement(true,()=>{},()=>0);
  try{
    const input={...pose('optical-flow'),surfaceDetected:true};
    const a=Math.PI/6,c=Math.cos(a),s=Math.sin(a);
    input.worldMatrix.set([1,0,0,0,0,c,s,0,0,-s,c,0,0,2,-3,1]);
    input.viewMatrix.set([0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1]);
    guide.observePose(input);
    guide.reticle.updateMatrixWorld(true);
    const grid=guide.reticle.children[0],world=grid.matrixWorld.elements;
    assert.ok(Math.abs(grid.rotation.y)>.1);
    const positions=grid.geometry.getAttribute('position');
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),z=positions.getZ(i);
      const y=world[1]*x+world[9]*z+world[13],depth=world[2]*x+world[10]*z+world[14];
      assert.ok(Math.abs(c*(y-2)+s*(depth+3))<1e-6);
    }
  }finally{guide.dispose();}
});
