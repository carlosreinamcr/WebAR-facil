/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {openCV} from './opencv-node.mjs';
import {VisualOdometryBackend} from '../src/slam/VisualOdometryBackend.ts';
import {scene,intrinsics} from '../tests/fixtures/render-scene.mjs';

const frames=Number(process.argv[2]??630);
const mode=process.argv[3]??'default';if(!['default','experimental'].includes(mode))throw new Error('Modo default o experimental.');
if(!Number.isInteger(frames)||frames<60||frames>36000)throw new Error('Usar entre 60 y 36000 frames.');
const{cv}=await openCV(),world=scene(),backend=new VisualOdometryBackend(cv,{intrinsics,floorROI:{x:0,y:.4,width:1,height:.6},keyframeCorrection:mode==='experimental'});
const timings=[],errors=[];let tracked=0,scale=null,warmHeap=0,last=null;
const started=performance.now();
for(let i=0;i<frames;i++){
  const x=.25*Math.sin(i*.01),image=world.render(x),start=performance.now();
  const result=backend.processFrame({rgba:image.data,width:640,height:480,timestampMs:i*33});timings.push(performance.now()-start);
  if(result.status==='tracked'){
    tracked++;last=result;if(scale===null&&Math.abs(result.worldFromCamera[12])>.1)scale=x/result.worldFromCamera[12];
    if(scale!==null)errors.push(Math.hypot(result.worldFromCamera[12]*scale-x,result.worldFromCamera[13]*scale,result.worldFromCamera[14]*scale));
  }
  if(i===100)warmHeap=cv.HEAPU8.buffer.byteLength;
}
timings.sort((a,b)=>a-b);errors.sort((a,b)=>a-b);
const quantile=(array,p)=>array[Math.min(array.length-1,Math.floor(array.length*p))]??null;
const report={timestamp:new Date().toISOString(),environment:{node:process.version,platform:process.platform,arch:process.arch},
  fixture:'Deterministic textured 3D scene, 640x480; synthetic input, actual OpenCV WASM computation',
  frames,keyframeCorrection:mode==='experimental',trackedFrames:tracked,elapsedMs:performance.now()-started,
  processingMs:{p50:quantile(timings,.5),p95:quantile(timings,.95),max:timings.at(-1)},
  scaleAlignedTrajectoryError:{p50:quantile(errors,.5),p95:quantile(errors,.95),max:errors.at(-1),units:'fixture units'},
  wasmHeapBytes:{warm:warmHeap,end:cv.HEAPU8.buffer.byteLength},finalMap:last?.mapId??null,
  limitation:'No physical camera, thermal measurement, browser compositor or mobile GPU is included.'};
backend.reset();await mkdir('benchmarks',{recursive:true});await writeFile(mode==='experimental'?'benchmarks/experimental-latest.json':'benchmarks/latest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
