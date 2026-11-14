import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { openCV } from '../scripts/opencv-node.mjs';
import { createORB, extractORB, matchORB, GrayBuffers, trackLK } from '../src/vision/features.ts';
import { solvePose } from '../src/vision/pose.ts';
import { decodeMarker, ImageCompiler } from '../src/tracking/ImageCompiler.ts';
import { projectionFromIntrinsics, rotateIntrinsics, scaleIntrinsics } from '../src/vision/calibration.ts';
import { initializeTwoView, projectWorld, triangulate, fitPlane, stablePlane, seededRandom } from '../src/vision/geometry.ts';
import { identity, invertRigid } from '../src/spatial/matrices.ts';

const { cv } = await openCV();
const { data, info } = await sharp('public/marker.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const k = { width: 640, height: 480, fx: 650, fy: 650, cx: 320, cy: 240 };
const markerBytes = await readFile('public/target.dat');
const marker = decodeMarker(markerBytes.buffer.slice(markerBytes.byteOffset, markerBytes.byteOffset+markerBytes.byteLength));

function warped(offset = 0) {
  const input = cv.matFromArray(info.height, info.width, cv.CV_8UC4, data);
  const src = cv.matFromArray(4, 1, cv.CV_32FC2, [0,0,800,0,800,600,0,600]);
  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [190+offset,142.5,450+offset,142.5,450+offset,337.5,190+offset,337.5]);
  const h = cv.getPerspectiveTransform(src,dst), result = new cv.Mat();
  cv.warpPerspective(input,result,h,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(30,30,30,255));
  const pixels = new Uint8ClampedArray(result.data);
  input.delete();src.delete();dst.delete();h.delete();result.delete();return pixels;
}

test('WASM real: ORB y pose métrica sobre PNG proyectado', () => {
  const buffers = new GrayBuffers(cv), orb = createORB(cv);
  try {
    const gray = buffers.frame(warped(),640,480), features = extractORB(cv,gray,orb);
    const matches = matchORB(cv, marker.descriptors, features.descriptors);
    assert.ok(matches.length >= 12, `Solo ${matches.length} matches`);
    const points = new Float32Array(matches.flatMap(m=>[features.keypoints[m.train*4],features.keypoints[m.train*4+1]]));
    const objects = new Float32Array(matches.flatMap(m=>[(marker.keypoints[m.query*4]/800-.5)*.2,0,(marker.keypoints[m.query*4+1]/600-.5)*.15]));
    const solution = solvePose(cv,objects,points,k,true);
    assert.ok(solution, 'PnP no devolvió solución');
    assert.ok(Math.abs(solution.matrix[14]+.5)<.025, `Profundidad: ${solution.matrix[14]}`);
    assert.ok(solution.errorPx < 3.5);
  } finally { buffers.dispose();orb.delete(); }
});

test('WASM real: LK sigue movimiento y rechaza desaparición del marcador', () => {
  const buffers = new GrayBuffers(cv), orb = createORB(cv);
  try {
    const first = buffers.frame(warped(),640,480), features = extractORB(cv,first,orb);
    const points = new Float32Array(Array.from({length:features.keypoints.length/4},(_,i)=>[features.keypoints[i*4],features.keypoints[i*4+1]]).flat());
    const second = buffers.frame(warped(3),640,480), tracked = trackLK(cv,first,second,points);
    assert.ok(tracked.indices.length > 50);
    const dx = tracked.indices.map((index,i)=>tracked.points[i*2]-points[index*2]).sort((a,b)=>a-b);
    assert.ok(Math.abs(dx[Math.floor(dx.length/2)]-3)<.3);
    const blank=buffers.frame(new Uint8ClampedArray(640*480*4).fill(255),640,480);
    assert.ok(trackLK(cv,second,blank,tracked.points).indices.length<20);
  } finally { buffers.dispose();orb.delete(); }
});

test('geometría: triangulación y plano con outliers', () => {
  const first=identity(),second=identity();second[12]=-.3;
  const point=[.2,-.5,-4],a=projectWorld(point,first,k),b=projectWorld(point,second,k);
  const reconstructed=triangulate(a.slice(0,2),b.slice(0,2),first,second,k);
  assert.ok(Math.hypot(...reconstructed.map((v,i)=>v-point[i]))<1e-4);
  const random=seededRandom(),cloud=Array.from({length:100},(_,i)=>[random()*3-1.5,i<80?-1:random()*2,-random()*4-2]);
  const plane=fitPlane(cloud,[0,0,0],.02);
  assert.ok(plane.inliers>=80);assert.ok(Math.abs(plane.matrix[13]+1)<.02);assert.ok(plane.matrix[5]>.99);
  const thin=Array.from({length:50},(_,i)=>[i*.1,-1,Math.sin(i)*.0001]);
  assert.equal(fitPlane(thin,[0,0,0],.01),null);
});

test('geometría: inicialización 3D robusta; rechazar rotación pura', () => {
  const random=seededRandom(37),world=Array.from({length:90},()=>[random()*3-1.5,random()*2-1,-random()*4-3]);
  const first=identity(),second=identity();second[12]=-.3;
  const a=new Float32Array(world.flatMap(p=>projectWorld(p,first,k).slice(0,2)));
  const b=new Float32Array(world.flatMap((p,i)=>i%8===0?[random()*640,random()*480]:projectWorld(p,second,k).slice(0,2)));
  const map=initializeTwoView(a,b,k);
  assert.ok(map,'No se inicializó mapa multivista');assert.ok(map.indices.length>50);
  assert.ok(invertRigid(map.viewMatrix)[12]>.8);
  const rotation=identity();rotation[0]=Math.cos(.1);rotation[2]=-Math.sin(.1);rotation[8]=Math.sin(.1);rotation[10]=Math.cos(.1);
  const pure=new Float32Array(world.flatMap(p=>projectWorld(p,rotation,k).slice(0,2)));
  assert.equal(initializeTwoView(a,pure,k),null);
});

test('compilador real: rechaza textura uniforme y corrupción de .dat', async () => {
  await assert.rejects(new ImageCompiler().compileRGBA({data:new Uint8ClampedArray(128*128*4).fill(255),width:128,height:128},{physicalWidthMeters:.2}),/no rastreable/);
  const bytes = await readFile('public/target.dat'); const corrupt = new Uint8Array(bytes);corrupt[corrupt.length-1]^=1;
  assert.throws(()=>decodeMarker(corrupt.buffer),/CRC32/);
});

test('calibración: proyección y rotaciones coherentes; rechazar recorte implícito', () => {
  const projection = projectionFromIntrinsics(k);
  assert.equal(projection[11],-1); assert.ok(Math.abs(projection[0]-2*k.fx/640)<1e-6);
  const portrait=rotateIntrinsics(k,90); assert.equal(portrait.width,480);assert.equal(portrait.cx,239);
  assert.throws(()=>scaleIntrinsics(k,480,640),/orientación/);
});


test('Plano: rechaza una inclinación acumulada aunque dos estimaciones vecinas coincidan',()=>{
  const proposal=(degrees,y=0)=>{
    const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    return {matrix:new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,y,0,1]),inliers:40};
  };
  assert.equal(stablePlane([proposal(0),proposal(6),proposal(12)],.05),null);
  assert.equal(stablePlane([proposal(0),proposal(1),proposal(2,.2)],.05),null);
  const fit=stablePlane([proposal(1),proposal(3),proposal(5)],.05);
  assert.ok(fit);
  assert.ok(Math.abs(Math.atan2(-fit.matrix[4],fit.matrix[5])*180/Math.PI-3)<.01);
  const withMisses=stablePlane([proposal(1),proposal(25),proposal(3),proposal(-20),proposal(5)],.05);
  assert.deepEqual(withMisses,fit);
});
