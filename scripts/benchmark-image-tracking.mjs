/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {BrowserWorker} from '../tests/fixtures/browser-worker.mjs';
import {openCV} from './opencv-node.mjs';
import {projectWorld} from '../src/vision/geometry.ts';
import {matrixFromPose} from '../src/spatial/PoseFilter.ts';
import {multiply} from '../src/spatial/matrices.ts';
globalThis.self=globalThis;globalThis.Worker=BrowserWorker;
const mode=process.argv[3]??'standard';if(!['standard','sparse'].includes(mode))throw new Error('Modo standard o sparse');
const sdk=await import(process.argv[4]?pathToFileURL(path.resolve(process.argv[4])).href:new URL('../dist/webar-facil.core.js',import.meta.url).href);
const {Tracker}=sdk,{cv}=await openCV();
const k={width:640,height:480,fx:650,fy:650,cx:320,cy:240};
const {data}=await sharp('public/marker.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const corners=[[-.1,0,-.075],[.1,0,-.075],[.1,0,.075],[-.1,0,.075]];
function render(view,blank){
 if(blank)return new Uint8ClampedArray(640*480*4).fill(255);
 const input=cv.matFromArray(600,800,cv.CV_8UC4,data),output=new cv.Mat();
 const a=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,800,0,800,600,0,600]);
 const b=cv.matFromArray(4,1,cv.CV_32FC2,corners.flatMap(p=>projectWorld(p,view,k).slice(0,2)));
 const h=cv.getPerspectiveTransform(a,b);cv.warpPerspective(input,output,h,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_CONSTANT,new cv.Scalar(35,35,35,255));
 const result=new Uint8ClampedArray(output.data);for(const resource of[input,output,a,b,h])resource.delete();return result;
}
const summaries=[];
const cases=mode==='sparse'?[['sparse-static',33,0,false],['sparse-140ms',140,0,false],['sparse-motion',33,.003,false],['sparse-occlusion',33,.001,true]]:[['steady-33ms',33,.001,false],['steady-140ms',140,.001,false],['motion',33,.035,false],['occlusion',33,.005,true]];
for(const [name,interval,motion,occlusion]of cases){
 const tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url),calibration:k});
 try{
  const bytes=await readFile('public/target.dat');await tracker.loadTarget(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  let tracked=0,falsePositive=0,expected=0,maxCornerErrorPx=0,recovered=false;const samples=[],counts={};
  for(let i=0;i<80;i++){
   const blank=occlusion&&i>=18&&i<22,angle=mode==='sparse'?0:.2*Math.sin(i*.1),x=motion*Math.sin(i*.3);
   const view=multiply(matrixFromPose([x,0,mode==='sparse'?-1.05:-.5],[Math.SQRT1_2,0,0,Math.SQRT1_2]),matrixFromPose([0,0,0],[Math.sin(angle/2),0,0,Math.cos(angle/2)]));
   const result=await tracker.processFrame({imageData:{data:render(view,blank),width:640,height:480},sessionId:1,timestampMs:i*interval,mediaTimeSeconds:i*interval/1000,sourceWidth:640,sourceHeight:480});
   if(!blank)expected++;
   if(result.status==='tracked'){
    if(blank)falsePositive++;else tracked++;
    for(const point of corners){const a=projectWorld(point,result.matrix,k),b=projectWorld(point,view,k);maxCornerErrorPx=Math.max(maxCornerErrorPx,Math.hypot(a[0]-b[0],a[1]-b[1]));}
   }
   if(occlusion&&i===22)recovered=result.status==='tracked';
   const profile=tracker.latestProfile;if(!profile)throw new Error('Falta instrumentación del Worker');
   if(i>=4){samples.push(profile.timings);for(const[key,n]of Object.entries(profile.counts))counts[key]=(counts[key]??0)+n;}
  }
  if(tracked!==expected||falsePositive||maxCornerErrorPx>8||(occlusion&&!recovered))throw new Error('Regresión geométrica: '+name);
  const stages=Object.fromEntries(Object.keys(samples[0]).map(key=>{const values=samples.map(s=>s[key]).sort((a,b)=>a-b);return[key,{mean:values.reduce((a,b)=>a+b,0)/values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)]}];}));
  summaries.push({name,frames:80,warmup:4,expected,tracked,falsePositive,maxCornerErrorPx,...(occlusion?{recovered}:{}),counts,stages});
 }finally{tracker.dispose();}
}
const report={sdk:sdk.LIBRARY_BUILD,createdAt:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},fixture:`Synthetic projected marker (${mode}), actual Worker/OpenCV WASM, 640x480; 4 warm-up frames excluded from timings in each case`,summaries,limits:'No physical camera, browser compositor, device thermals or GPU. Timings vary by host; correctness and path counts must be compared too.'};
const output=process.argv[2]??'benchmarks/image-tracking-latest.json';await mkdir('benchmarks',{recursive:true});await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,summaries:summaries.map(s=>({name:s.name,tracked:s.tracked,expected:s.expected,maxCornerErrorPx:s.maxCornerErrorPx,counts:s.counts,worker:s.stages.workerMs,lk:s.stages.opticalFlowMs,matching:s.stages.matchingMs}))},null,2));
