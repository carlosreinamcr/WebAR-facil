/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {openCV} from './opencv-node.mjs';
import {decodeMarker} from '../src/tracking/ImageCompiler.ts';
import {createORB,extractORB,matchORBOpenCV} from '../src/vision/features.ts';
import {ExactHamming} from '../src/vision/ExactHamming.ts';
import {LIBRARY_BUILD} from '../src/build-info.ts';
const {cv}=await openCV(),bytes=await readFile('public/target.dat'),marker=decodeMarker(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const raw=await sharp('public/marker.png').resize(640,480).grayscale().raw().toBuffer(),gray=cv.matFromArray(480,640,cv.CV_8UC1,raw),orb=createORB(cv);
let frame;try{frame=extractORB(cv,gray,orb);}finally{gray.delete();orb.delete();}
let seed=9321;const random=new Uint8Array(frame.descriptors.length);for(let i=0;i<random.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;random[i]=seed>>>24;}
const exact=new ExactHamming(),cases=[];
const stats=values=>{const ordered=[...values].sort((a,b)=>a-b);return{mean:values.reduce((a,b)=>a+b,0)/values.length,p50:ordered[Math.floor(values.length*.5)],p95:ordered[Math.floor(values.length*.95)]};};
for(const [name,query,train]of [['marker-vs-resized-image',marker.descriptors,frame.descriptors],['marker-vs-random-descriptors',marker.descriptors,random],['small-reference',marker.descriptors.subarray(0,23*32),frame.descriptors]]){
 const oldTimes=[],newTimes=[];let accepted=0;
 for(let i=0;i<10;i++){
  let oldResult,newResult;
  // Alternar orden para no atribuir sistemáticamente el calentamiento a una ruta.
  const legacy=()=>{const start=performance.now();oldResult=matchORBOpenCV(cv,query,train);if(i>=3)oldTimes.push(performance.now()-start);};
  const fast=()=>{const start=performance.now();newResult=exact.match(query,train);if(i>=3)newTimes.push(performance.now()-start);};
  if(i%2){fast();legacy();}else{legacy();fast();}
  assert.deepEqual(newResult,oldResult);accepted=oldResult.length;
 }
 cases.push({name,queries:query.length/32,trains:train.length/32,accepted,identicalMatches:true,samples:7,warmup:3,opencvMs:stats(oldTimes),exactWasmMs:stats(newTimes)});
}
const report={sdk:LIBRARY_BUILD,createdAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},cases,kernelMemoryBytes:exact.memoryBytes,limits:'Real ORB descriptors and actual WASM, local Node timings. Random descriptor case is synthetic. No physical camera, GPU/compositor, browser scheduling or phone thermals. Includes upload/readout and preserves ordered accepted matches; not a tracker FPS measurement.'};
await mkdir('benchmarks',{recursive:true});await writeFile('benchmarks/matching-exact.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
