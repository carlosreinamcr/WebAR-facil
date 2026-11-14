import {floorScene} from './fixtures/floor-scene.mjs';
import {useWideFlow} from '../src/slam/OpticalFlowPolicy.ts';
import {FlowPointBudget,distributedIndices} from '../src/slam/FlowPointBudget.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { openCV } from '../scripts/opencv-node.mjs';
import { VisualOdometryBackend } from '../src/slam/VisualOdometryBackend.ts';
import { scene,renderMarker,intrinsics } from './fixtures/render-scene.mjs';
import { createORB,extractORB,matchORB,GrayBuffers } from '../src/vision/features.ts';
import { solvePose } from '../src/vision/pose.ts';
import { decodeMarker } from '../src/tracking/ImageCompiler.ts';
import {projectWorld,seededRandom} from '../src/vision/geometry.ts';
import {invertRigid} from '../src/spatial/matrices.ts';

const {cv}=await openCV();
const config={intrinsics,floorROI:{x:0,y:.4,width:1,height:.6}};

test('VO: el intervalo largo necesita movimiento medido para iniciar con ventana amplia',()=>{
  const shortSide=278;
  assert.equal(useWideFlow(null,320,shortSide),false);
  assert.equal(useWideFlow({displacementPx:6,intervalMs:160},250,shortSide),false);
  assert.equal(useWideFlow({displacementPx:6,intervalMs:33},380,shortSide),false);
  assert.equal(useWideFlow({displacementPx:10,intervalMs:140},240,shortSide),true);
  assert.equal(useWideFlow({displacementPx:22,intervalMs:33},33,shortSide),true);
  assert.equal(useWideFlow({displacementPx:40,intervalMs:90},1200,shortSide),false);
});

test('VO: limita LK bajo carga sostenida y reparte el cupo entre zonas',()=>{
  const budget=new FlowPointBudget();
  budget.sample(350,300);budget.sample(350,300);
  assert.equal(budget.limit,750);
  budget.sample(350,300);assert.equal(budget.limit,210);
  for(let i=0;i<12;i++)budget.sample(12,210);
  assert.equal(budget.limit,252);
  const points=[...Array.from({length:30},()=>[10,10]),[500,10],[10,400],[500,400]];
  const selected=distributedIndices(points.length,4,intrinsics,i=>points[i]);
  assert.deepEqual(selected,[0,30,31,32]);
  for(let i=0;i<9;i++)budget.sample(500,100);
  assert.equal(budget.limit,96);
});

test('VO: hipótesis débiles requieren dos observaciones y una escena ajena no relocaliza',()=>{
  const world=scene(),backend=new VisualOdometryBackend(cv,config);
  try{
    for(let i=0;i<65;i++)backend.processFrame({rgba:world.render(i*.005).data,width:640,height:480,timestampMs:i*33});
    const snapshot=backend.exportMap(),last=snapshot.keyframes.at(-1);
    snapshot.keyframes=[{...last,descriptors:last.descriptors.slice(0,24*32),points:last.points.slice(0,24*3)}];backend.importMap(snapshot);
    const input=(data,time)=>backend.processFrame({rgba:data,width:640,height:480,timestampMs:time});
    assert.equal(input(scene(999).render(.32).data,3000).status,'lost');
    assert.equal(input(world.render(.32).data,3033).status,'lost');
    const result=input(world.render(.32).data,3066);assert.equal(result.status,'tracked');assert.equal(result.relocalized,true);
  }finally{backend.reset();}
});

test('VO: exporta mapa, exige relocalización y conserva su geometría tras importar',()=>{
  const world=scene(),backend=new VisualOdometryBackend(cv,config);let last;
  for(let i=0;i<65;i++)last=backend.processFrame({rgba:world.render(i*.005).data,width:640,height:480,timestampMs:i*33});
  assert.equal(last.status,'tracked');const expected=last.worldFromCamera.slice(),snapshot=backend.exportMap(true);
  assert.ok(snapshot.keyframes.length>=1&&snapshot.keyframes.length<=50);
  const expectedView=invertRigid(expected);
  assert.equal(snapshot.currentViewCaptured,true);
  assert.ok(snapshot.keyframes.at(-1).view.every((value,index)=>Math.abs(value-expectedView[index])<1e-5));
  const restored=new VisualOdometryBackend(cv,config);restored.importMap(snapshot);
  const missing=restored.processFrame({rgba:new Uint8ClampedArray(640*480*4).fill(255),width:640,height:480,timestampMs:3000});assert.equal(missing.status,'lost');
  assert.equal(missing.scanHint,'return-to-map');
  const found=restored.processFrame({rgba:world.render(.32).data,width:640,height:480,timestampMs:3033});
  assert.equal(found.status,'tracked');assert.equal(found.scale,snapshot.scale);
  assert.ok(Math.hypot(...[12,13,14].map(i=>found.worldFromCamera[i]-expected[i]))<.08,JSON.stringify({expected:Array.from(expected).slice(12,15),actual:Array.from(found.worldFromCamera).slice(12,15)}));
  const bad=structuredClone(snapshot);bad.keyframes[0].descriptors=new Uint8Array(1);assert.throws(()=>restored.importMap(bad));
  const expanded={...snapshot,keyframes:Array.from({length:50},(_,index)=>snapshot.keyframes[index%snapshot.keyframes.length])};
  restored.importMap(expanded);
  assert.equal(restored.exportMap().keyframes.length,50);
  assert.throws(()=>restored.importMap({...expanded,keyframes:[...expanded.keyframes,expanded.keyframes[0]]}));
  backend.reset();restored.reset();
});

test('VO real: inicializa por paralaje, sigue una escena 3D y relocaliza tras oclusión',()=>{
  const world=scene(),backend=new VisualOdometryBackend(cv,config);let tracked=[];
  for(let frame=0;frame<60;frame++) {
    const image=world.render(frame*.006);
    const result=backend.processFrame({rgba:image.data,width:640,height:480,timestampMs:frame*33});
    if(result.status==='tracked')tracked.push(result);
  }
  assert.ok(tracked.length>15,`Solo ${tracked.length} poses`);
  const recent=tracked.slice(-5).map(p=>p.worldFromCamera[12]);
  assert.ok(recent.at(-1)>recent[0],`Trayectoria ${recent}`);
  const hidden=backend.processFrame({rgba:new Uint8ClampedArray(640*480*4).fill(255),width:640,height:480,timestampMs:2000});
  assert.equal(hidden.status,'lost');
  const recovered=backend.processFrame({rgba:world.render(.354).data,width:640,height:480,timestampMs:2033});
  assert.equal(recovered.status,'tracked');backend.reset();
});

test('VO real: reposo con cambios de exposición, movimiento lento y retorno al mismo punto',t=>{
  const world=scene(),backend=new VisualOdometryBackend(cv,config);
  let time=0;
  const process=rgba=>backend.processFrame({rgba,width:640,height:480,timestampMs:(time+=33)});
  const distance=(a,b)=>Math.hypot(...[12,13,14].map(i=>a.worldFromCamera[i]-b.worldFromCamera[i]));
  try{
    let start;
    for(let i=0;i<=64;i++)start=process(world.render(i*.005).data);
    assert.equal(start.status,'tracked');
    const capture=backend.checkVisualReference('capture','right1',time);
    assert.equal(capture.status,'captured');
    const image=world.render(.32).data;
    let held=0,maxDrift=0;
    for(let i=0;i<24;i++){
      const brightness=i%3-1;
      const result=process(image.map((value,index)=>index%4===3?value:value+brightness*2));
      assert.equal(result.status,'tracked');
      if(result.stationary)held++;
      maxDrift=Math.max(maxDrift,distance(start,result));
    }
    let away;
    for(let i=1;i<=60;i++)away=process(world.render(.32+i*.002).data);
    assert.equal(away.status,'tracked');
    const outward=distance(start,away);
    const awayCheck=backend.checkVisualReference('verify','right1',time);
    if(awayCheck.status==='verified')assert.ok(awayCheck.directReturnUnits>outward*.5);
    let back;
    for(let i=59;i>=0;i--)back=process(world.render(.32+i*.002).data);
    assert.equal(back.status,'tracked');
    assert.ok(held>=18,`Reposo retenido en ${held}/24 fotogramas`);
    assert.ok(outward>.1,`El movimiento real no debe congelarse: ${outward}`);
    assert.ok(maxDrift<outward*.04,`Reposo ${maxDrift}, recorrido ${outward}`);
    const returnError=distance(start,back);
    assert.ok(returnError<outward*.22,`Error de retorno ${returnError}, recorrido ${outward}`);
    const verified=backend.checkVisualReference('verify','right1',time);
    assert.equal(verified.status,'verified');
    assert.ok(verified.inliers>=25);
    assert.ok(verified.directReturnUnits<outward*.15);
    assert.ok(verified.medianImageShiftPx<1);
    assert.equal(backend.checkVisualReference('verify','other',time).status,'missing-reference');
    assert.equal(backend.checkVisualReference('verify','right1',time+500).status,'unavailable');
    t.diagnostic(`Reposo retenido ${held}/24. Excursión máxima ${(100*maxDrift/outward).toFixed(1)} %. Error de retorno ${(100*returnError/outward).toFixed(1)} %.`);
  }finally{backend.reset();}
});

test('VO real: inicialización métrica desde marcador y continuidad tras retirarlo',async()=>{
  const bytes=await readFile('public/target.dat'),marker=decodeMarker(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
  const {data:markerData}=await sharp('public/marker.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const world=scene(208,true),initial=renderMarker(cv,world.render().data,markerData);
  const buffers=new GrayBuffers(cv),orb=createORB(cv),features=extractORB(cv,buffers.frame(initial,640,480),orb);
  const matches=matchORB(cv,marker.descriptors,features.descriptors);
  const points=new Float32Array(matches.flatMap(m=>[features.keypoints[m.train*4],features.keypoints[m.train*4+1]]));
  const objects=new Float32Array(matches.flatMap(m=>[(marker.keypoints[m.query*4]/800-.5)*.2,0,(marker.keypoints[m.query*4+1]/600-.5)*.15]));
  const solution=solvePose(cv,objects,points,intrinsics,true);assert.ok(solution);
  const seed={rgba:initial.buffer,width:640,height:480,timestampMs:0,sessionId:1,intrinsics,cameraFromMarker:solution.matrix,
    imagePoints:new Float32Array(solution.inliers.flatMap(i=>[points[i*2],points[i*2+1]])),
    objectPoints:new Float32Array(solution.inliers.flatMap(i=>Array.from(objects.subarray(i*3,i*3+3)))),
    markerCorners:new Float32Array([-.1,0,-.075,.1,0,-.075,.1,0,.075,-.1,0,.075])};
  buffers.dispose();orb.delete();
  const backend=new VisualOdometryBackend(cv,{...config,seed});let readyAt=-1,last;
  for(let frame=1;frame<45;frame++) {
    const x=frame*.002;
    const image=world.render(x).data;
    const rgba=readyAt<0?renderMarker(cv,image,markerData,x):image;
    last=backend.processFrame({rgba,width:640,height:480,timestampMs:frame*33});
    if(last.status==='tracked'&&last.environmentReady&&readyAt<0)readyAt=frame;
  }
  assert.ok(readyAt>0,`El mapa ambiental no quedó listo; última pose ${JSON.stringify(last)}`);
  assert.equal(last.status,'tracked');assert.equal(last.scale,'metric');
  assert.ok(Math.abs(last.worldFromCamera[12]-.088)<.04,`x=${last.worldFromCamera[12]}, listo en ${readyAt}`);
  backend.reset();
});

test('VO real: reconoce un plano inferior a partir de imágenes y triangulación',()=>{
  const world=scene(),random=seededRandom(73),tiles=[];
  for(let row=0;row<7;row++)for(let col=0;col<9;col++){
    const pixels=new Uint8Array(32*32*4),values=Array.from({length:64},()=>random()>.5?235:20);
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4,value=values[(y>>2)*8+(x>>2)];pixels.set([value,value,value,255],i);}
    tiles.push({x:(col-4)*.45,z:-3-row*.5,pixels});
  }
  const sourcePoints=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,32,0,32,32,0,32]),tile=new cv.Mat(32,32,cv.CV_8UC4);
  const backend=new VisualOdometryBackend(cv,{intrinsics,floorROI:{x:0,y:.6,width:1,height:.4}});let scale=null,plane=null;
  try{
    for(let frame=0;frame<75;frame++){
      const x=frame*.006,{data,view}=world.render(x);
      for(let y=310;y<480;y++)for(let col=0;col<640;col++){const i=(y*640+col)*4;data[i]=data[i+1]=data[i+2]=75;}
      const image=cv.matFromArray(480,640,cv.CV_8UC4,data);
      try{
        for(const patch of tiles){
          const corners=[[patch.x-.13,-1,patch.z-.13],[patch.x+.13,-1,patch.z-.13],[patch.x+.13,-1,patch.z+.13],[patch.x-.13,-1,patch.z+.13]].map(p=>projectWorld(p,view,intrinsics));
          const left=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[0])))),top=Math.max(0,Math.floor(Math.min(...corners.map(p=>p[1]))));
          const right=Math.min(640,Math.ceil(Math.max(...corners.map(p=>p[0])))),bottom=Math.min(480,Math.ceil(Math.max(...corners.map(p=>p[1]))));
          if(right<=left||bottom<=top)continue;
          const dst=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>[p[0]-left,p[1]-top])),h=cv.getPerspectiveTransform(sourcePoints,dst),roi=image.roi(new cv.Rect(left,top,right-left,bottom-top));
          tile.data.set(patch.pixels);cv.warpPerspective(tile,roi,h,new cv.Size(right-left,bottom-top),cv.INTER_LINEAR,cv.BORDER_TRANSPARENT);
          dst.delete();h.delete();roi.delete();
        }
        const result=backend.processFrame({rgba:new Uint8ClampedArray(image.data),width:640,height:480,timestampMs:frame*33});
        if(result.status==='tracked'){
          if(scale===null&&result.worldFromCamera[12]>.5)scale=x/result.worldFromCamera[12];
          if(result.groundPlane)plane=result.groundPlane;
        }
      }finally{image.delete();}
    }
    assert.ok(plane,'No se verificó un plano inferior');assert.ok(plane.inliers>=20);assert.ok(plane.worldFromPlane[5]>.95);
    assert.ok(Math.abs(plane.worldFromPlane[13]*scale+1)<.2);
  }finally{sourcePoints.delete();tile.delete();backend.reset();}
});


test('VO: la normal sigue el suelo visto desde una cámara inclinada',()=>{
  const world=floorScene(),backend=new VisualOdometryBackend(cv,{intrinsics,floorROI:{x:0,y:.55,width:1,height:.45}});
  let plane;
  try{
    for(let frame=0;frame<55;frame++){
      const {data}=world.render(frame*.012);
      const result=backend.processFrame({rgba:data,width:640,height:480,timestampMs:frame*33});
      if(result.status==='tracked'&&result.groundPlane)plane=result.groundPlane.worldFromPlane;
    }
    assert.ok(plane,'Debe verificar el plano inclinado');
    const dot=plane[5]*.8+plane[6]*.6;
    assert.ok(dot>Math.cos(8*Math.PI/180),`Normal del plano: ${Array.from(plane.slice(4,7))}`);
  }finally{backend.reset();}
});
