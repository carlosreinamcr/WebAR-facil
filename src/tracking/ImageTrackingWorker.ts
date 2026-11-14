/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {assessPlanarSupport,descriptorDeadline,planarPoseDisagreement} from './PlanarSupport.ts';
import {createTrackingProfile,measureTracking,type ImageTrackingProfile} from './profile.ts';
/// <reference lib="webworker" />
import { decodeMarker, type CompiledMarker } from './ImageCompiler.ts';
import { loadOpenCV, CvScope, type CV } from '../vision/runtime.ts';
import { createORB, extractORB, matchORBProfiled, trackLK, GrayBuffers, ORB_EXTRACTOR_ID } from '../vision/features.ts';
import { solvePose } from '../vision/pose.ts';
import { projectionFromIntrinsics } from '../vision/calibration.ts';
import { PlanarCameraEstimator } from '../vision/PlanarCameraEstimator.ts';
import type { TrackingResult, TrackingFrameRequest } from './types.ts';
import {measureFrame} from '../vision/frameQuality';
import type {FrameQuality} from './events';
import type {MarkerFeatures} from './ImageCompiler';
function objectsForPixels(points: Float32Array, target: CompiledMarker): Float32Array {
  const physicalHeight = target.physicalWidthMeters * target.height / target.width;
  const objects = new Float32Array(points.length / 2 * 3);
  for (let i = 0; i < points.length / 2; i++) objects.set([
    (points[i * 2]! / target.width - 0.5) * target.physicalWidthMeters, 0,
    (points[i * 2 + 1]! / target.height - 0.5) * physicalHeight], i * 3);
  return objects;
}

function consistentFlow(cv:CV,pixels:Float32Array,objects:Float32Array):{pixels:Float32Array;objects:Float32Array}{
  if(!cv||pixels.length<24)return{pixels:new Float32Array(),objects:new Float32Array()};
  const resources=new CvScope();
  try{
    const count=pixels.length/2,plane=new Float32Array(count*2);
    for(let i=0;i<count;i++){plane[2*i]=objects[3*i]!;plane[2*i+1]=objects[3*i+2]!;}
    const a=resources.own(cv.matFromArray(count,1,cv.CV_32FC2,plane));
    const b=resources.own(cv.matFromArray(count,1,cv.CV_32FC2,pixels)),mask=resources.own(new cv.Mat());
    const h=resources.own(cv.findHomography(a,b,cv.RANSAC,2.5,mask,500,.995));
    if(h.empty())return{pixels:new Float32Array(),objects:new Float32Array()};
    const indices=Array.from({length:count},(_,i)=>i).filter(i=>mask.data[i]);
    if(indices.length<12||indices.length/count<.55)return{pixels:new Float32Array(),objects:new Float32Array()};
    return{pixels:new Float32Array(indices.flatMap(i=>[pixels[2*i]!,pixels[2*i+1]!])),
      objects:new Float32Array(indices.flatMap(i=>Array.from(objects.subarray(3*i,3*i+3))))};
  }finally{resources.close();}
}

class ImageTargetState {
  private previous:InstanceType<CV['Mat']>|null=null;
  private previousPixels:Float32Array=new Float32Array();
  private previousObjects:Float32Array=new Float32Array();
  private epoch=-1;private size='';private frames=0;
  private appearances:{keypoints:Float32Array;descriptors:Uint8Array}[]=[];
  private lastAppearance=-100;
  // Subconjunto exacto de descriptores de una detección global geométricamente válida.
  private verifiedReference:{descriptors:Uint8Array;keypoints:Float32Array}|null=null;
  private pool:{descriptors:Uint8Array;keypoints:Float32Array}|null=null;
  private lastMotion=0;private lastTimestamp=0;
  private lastSequence=-1;
  private lastGlobalFrame=-1;private lastGlobalTimestamp=0;
  private readonly cv:CV;private readonly marker:CompiledMarker;
  constructor(cv:CV,marker:CompiledMarker){this.cv=cv;this.marker=marker;}
  private targetSize(matrix:Float32Array,k:TrackingFrameRequest['intrinsics']):number{
    const width=this.marker.physicalWidthMeters,height=width*this.marker.height/this.marker.width;
    const points=[[-width/2,0,-height/2],[width/2,0,-height/2],[width/2,0,height/2],[-width/2,0,height/2]];
    const projected=points.map(p=>{const z=-(matrix[2]!*p[0]!+matrix[10]!*p[2]!+matrix[14]!);
      return[k.fx*(matrix[0]!*p[0]!+matrix[8]!*p[2]!+matrix[12]!)/z+k.cx,-k.fy*(matrix[1]!*p[0]!+matrix[9]!*p[2]!+matrix[13]!)/z+k.cy];});
    return Math.max(...projected.map((p,i)=>Math.hypot(p[0]!-projected[(i+1)%4]![0]!,p[1]!-projected[(i+1)%4]![1]!)));
  }
process(frame:TrackingFrameRequest,gray:InstanceType<CV['Mat']>,featuresForFrame:()=>MarkerFeatures,statistics:ReturnType<typeof measureFrame>,observe:(h:Float64Array)=>void,sequence:number,profile:ImageTrackingProfile,reserveGlobal:()=>boolean):TrackingResult {
  // Si el consumidor alterna FRAME y FRAME_BATCH, no usar un buffer gris sobrescrito.
  if(this.lastSequence!==sequence-1)this.previous=null;this.lastSequence=sequence;
  if (!this.marker) throw new Error('Cargar un target antes de procesar.');
  const start = performance.now(), currentSize = `${frame.width}x${frame.height}`;
  if (frame.sessionId !== this.epoch || currentSize !== this.size) {
    this.previous = null; this.previousPixels = new Float32Array(); this.previousObjects = new Float32Array(); this.frames = 0;
    this.epoch = frame.sessionId; this.size = currentSize;
    this.lastGlobalFrame=-1;this.lastGlobalTimestamp=0;this.appearances=[];this.verifiedReference=null;this.lastAppearance=-100;this.pool=null;this.lastMotion=0;this.lastTimestamp=0;
  }

  let motionPixels=0;
  let pixels: Float32Array = new Float32Array(), objects: Float32Array = new Float32Array();
  let intrinsics=frame.intrinsics;
  // Flujo óptico entre redetecciones; ORB periódico evita acumular deriva.
  if (this.previous && this.previousPixels.length >= 24) {
    profile.counts.flowAttempts++;profile.counts.flowInputPoints+=this.previousPixels.length/2;
    const tracked = measureTracking(profile,'opticalFlowMs',()=>{
      const largeMotion=this.lastMotion>10;
      const flow=trackLK(this.cv,this.previous!,gray,this.previousPixels,{largeMotion});
      // Una cámara lenta no implica movimiento grande. Ampliar la búsqueda si cae el soporte.
      if(largeMotion||flow.indices.length>=Math.max(12,this.previousPixels.length*.275)||frame.timestampMs-this.lastTimestamp<=80)return flow;
      return trackLK(this.cv,this.previous!,gray,this.previousPixels,{largeMotion:true});
    });
    const displacements=tracked.indices.map((original,i)=>Math.hypot(tracked.points[2*i]!-this.previousPixels[2*original]!,tracked.points[2*i+1]!-this.previousPixels[2*original+1]!)).sort((a,b)=>a-b);
    motionPixels=displacements[Math.floor(displacements.length/2)]??0;
    pixels = tracked.points;
    objects = new Float32Array(tracked.indices.flatMap(i => Array.from(this.previousObjects.subarray(3 * i, 3 * i + 3))));
    ({pixels,objects}=measureTracking(profile,'flowValidationMs',()=>consistentFlow(this.cv,pixels,objects)));
  }
  // LK ya filtra ida/vuelta. Resolver el plano con ITERATIVE usa todo su soporte;
  // EPNP/RANSAC puede conservar un subconjunto ambiguo y desalinear los bordes.
  // Si la reproyección no es consistente, se redetecta con ORB + homografía RANSAC.
  let solution = pixels.length >= 24 ? measureTracking(profile,'poseMs',()=>solvePose(this.cv, objects, pixels, intrinsics, false)) : null;
  if(solution)profile.counts.flowAccepted++;
  const support=measureTracking(profile,'supportMs',()=>assessPlanarSupport(objects,pixels,solution?.inliers??[],this.marker.physicalWidthMeters,this.marker.physicalWidthMeters*this.marker.height/this.marker.width,solution?.errorPx??Infinity,this.previousPixels.length/2));
  if(support.reliable){profile.counts.flowReliable++;if(support.points<24)profile.counts.flowSparseReliable++;}
  const frameInterval=frame.timestampMs-this.lastTimestamp;
  const reviewInterval=support.reliable?Math.min(2000,Math.max(1000,8*frameInterval)):1000;
  const deadline=descriptorDeadline(this.frames,frame.timestampMs,this.lastGlobalFrame,this.lastGlobalTimestamp,reviewInterval);
  // Menor cobertura o peor condición: confirmar con descriptores más a menudo,
  // sin confundir ese apoyo débil con un número insuficiente de puntos.
  const verifyEvery=support.coverage<.5||support.planeCondition<.15?4:8;
  const warming=this.lastGlobalFrame>=0&&this.frames-this.lastGlobalFrame<=2;
  const verify=(warming||this.frames%verifyEvery===0)&&!!this.verifiedReference;
  if(!support.reliable||deadline||verify){
    if(!solution)profile.counts.redetectMissing++;else if(!support.reliable)profile.counts.redetectWeakSupport++;
    if(solution&&!support.reliable){if(support.reason==='distribution')profile.counts.weakDistribution++;if(support.reason==='reprojection')profile.counts.weakReprojection++;if(support.reason==='retention')profile.counts.weakRetention++;}
    if(deadline)profile.counts.redetectDeadline++;
    if(verify&&support.reliable&&!deadline)profile.counts.redetectVerification++;
    profile.counts.redetections++;
    // Una redetección fallida no invalida un LK que conserva evidencia geométrica.
    const flowSolution=solution,flowPixels=pixels,flowObjects=objects,flowIntrinsics=intrinsics;
    solution=null;
    if(!this.pool){
      const sources=[this.marker,...this.appearances];
      const descriptors=new Uint8Array(sources.reduce((sum,source)=>sum+source.descriptors.length,0));
      const keypoints=new Float32Array(sources.reduce((sum,source)=>sum+source.keypoints.length,0));let p=0,d=0;
      for(const source of sources){descriptors.set(source.descriptors,d);d+=source.descriptors.length;keypoints.set(source.keypoints,p);p+=source.keypoints.length;}
      this.pool={descriptors,keypoints};
    }
    let cacheConflict=false;
    const detect=(reference:{descriptors:Uint8Array;keypoints:Float32Array},cached:boolean):void=>{
    if(cached)profile.counts.cachedAttempts++;else{profile.counts.fullDetections++;this.lastGlobalFrame=this.frames;this.lastGlobalTimestamp=frame.timestampMs;}
    const allFeatures=featuresForFrame();
    let features=allFeatures;
    if(cached&&support.reliable&&flowPixels.length){
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(let i=0;i<flowPixels.length;i+=2){
        left=Math.min(left,flowPixels[i]!);right=Math.max(right,flowPixels[i]!);
        top=Math.min(top,flowPixels[i+1]!);bottom=Math.max(bottom,flowPixels[i+1]!);
      }
      const margin=Math.max(24,.35*Math.max(right-left,bottom-top));
      const indices=[];
      for(let i=0;i<allFeatures.keypoints.length;i+=4){
        const x=allFeatures.keypoints[i]!,y=allFeatures.keypoints[i+1]!;
        if(x>=left-margin&&x<=right+margin&&y>=top-margin&&y<=bottom+margin)indices.push(i/4);
      }
      if(indices.length>=32&&indices.length<allFeatures.keypoints.length/4){
        features={...allFeatures,keypoints:new Float32Array(indices.length*4),descriptors:new Uint8Array(indices.length*32)};
        indices.forEach((index,i)=>{
          features.keypoints.set(allFeatures.keypoints.subarray(index*4,index*4+4),i*4);
          features.descriptors.set(allFeatures.descriptors.subarray(index*32,index*32+32),i*32);
        });
      }
    }
    const referenceDescriptors=reference.descriptors,referencePoints=reference.keypoints;
    profile.counts.matchingQueryDescriptors+=referenceDescriptors.length/32;
    const matching=measureTracking(profile,'matchingMs',()=>matchORBProfiled(this.cv,referenceDescriptors,features.descriptors));
    profile.counts[matching.backend==='wasm-exact'?'exactMatchingCalls':matching.backend==='opencv'?'opencvMatchingCalls':'emptyMatchingCalls']++;
    const matches=matching.matches;
    pixels = new Float32Array(); objects = new Float32Array();
    if (matches.length >= 12) {
      const targetPoints = new Float32Array(matches.flatMap(m => [referencePoints[m.query * 4]!, referencePoints[m.query * 4 + 1]!]));
      const framePoints = new Float32Array(matches.flatMap(m => [features.keypoints[m.train * 4]!, features.keypoints[m.train * 4 + 1]!]));
      const resources = new CvScope();
      try {
        const a = resources.own(this.cv.matFromArray(matches.length, 1, this.cv.CV_32FC2, targetPoints));
        const b = resources.own(this.cv.matFromArray(matches.length, 1, this.cv.CV_32FC2, framePoints));
        const mask = resources.own(new this.cv.Mat());
        const homography = resources.own(measureTracking(profile,'homographyMs',()=>this.cv.findHomography(a, b, this.cv.RANSAC, 3, mask, 1500, 0.995)));
        if (!homography.empty()) {
          const indices = matches.map((_, i) => i).filter(i => mask.data[i]);
          const targetInliers = new Float32Array(indices.flatMap(i => [targetPoints[i * 2]!, targetPoints[i * 2 + 1]!]));
          if (indices.length >= 12 && indices.length / matches.length >= 0.4) {
            const xs = indices.map(i => targetPoints[i * 2]!), ys = indices.map(i => targetPoints[i * 2 + 1]!);
            const coverage = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) / (this.marker.width * this.marker.height);
            if (coverage > 0.08) {
              if(frame.projectionSource==='estimated'&&indices.length>=20&&coverage>.15){
                observe(homography.data64F.slice());
              }
              pixels = new Float32Array(indices.flatMap(i => [framePoints[i * 2]!, framePoints[i * 2 + 1]!]));
              objects = objectsForPixels(targetInliers, this.marker);
              solution = measureTracking(profile,'poseMs',()=>solvePose(this.cv, objects, pixels, intrinsics, false));
              if(cached&&solution){
                const evidence=measureTracking(profile,'supportMs',()=>assessPlanarSupport(objects,pixels,solution!.inliers,this.marker.physicalWidthMeters,this.marker.physicalWidthMeters*this.marker.height/this.marker.width,solution!.errorPx,0));
                if(!evidence.reliable||evidence.coverage<.15||evidence.planeCondition<.08||solution.errorPx>1.5||indices.length/matches.length<.6)solution=null;
                else if(support.reliable&&flowSolution&&planarPoseDisagreement(solution.matrix,flowSolution.matrix,this.marker.physicalWidthMeters,this.marker.physicalWidthMeters*this.marker.height/this.marker.width,intrinsics)>Math.max(2,Math.min(4,this.targetSize(flowSolution.matrix,intrinsics)*.03))){
                  cacheConflict=true;profile.counts.cacheConflicts++;solution=null;
                }
              }
              if(solution&&!cached){
                // Mismos bits y coordenadas del pool completo, sin propagar correspondencias LK.
                const selected=indices.slice(0,256);
                this.verifiedReference=selected.length>=12?{
                  keypoints:new Float32Array(selected.flatMap(i=>[targetPoints[2*i]!,targetPoints[2*i+1]!,0,0])),
                  descriptors:new Uint8Array(selected.flatMap(i=>Array.from(referenceDescriptors.subarray(matches[i]!.query*32,matches[i]!.query*32+32))))}:null;
              }
              if(solution&&!cached&&solution.errorPx<1.8&&coverage>.2&&indices.length>=30&&this.frames-this.lastAppearance>=24){
                const cells=new Map<number,number>(),chosen=indices.filter(i=>{
                  // No encadenar referencias aprendidas: anclar siempre al descriptor original.
                  if(matches[i]!.query>=this.marker!.keypoints.length/4)return false;
                  const cell=Math.floor(targetPoints[2*i]!/this.marker!.width*6)+6*Math.floor(targetPoints[2*i+1]!/this.marker!.height*6);
                  const count=cells.get(cell)??0;if(count>=3)return false;cells.set(cell,count+1);return true;
                });
                if(chosen.length>=24){this.appearances.push({
                  keypoints:new Float32Array(chosen.flatMap(i=>[targetPoints[2*i]!,targetPoints[2*i+1]!,0,0])),
                  descriptors:new Uint8Array(chosen.flatMap(i=>Array.from(features.descriptors.subarray(matches[i]!.train*32,matches[i]!.train*32+32))))});
                  if(this.appearances.length>3)this.appearances.shift();this.lastAppearance=this.frames;this.pool=null;}
              }
            }
          }
        }
      } finally { resources.close(); }
    }
    };
    // Una verificación de caché fallida no obliga a matching global si LK conserva
    // soporte distribuido y preciso. La revisión global acotada limita la deriva.
    if(this.verifiedReference&&!deadline)detect(this.verifiedReference,true);
    if(!solution){
      if((!support.reliable||deadline||cacheConflict)&&reserveGlobal())detect(this.pool!,false);
      else profile.counts.globalDeferred++;
    }
    if(!solution&&flowSolution){solution=flowSolution;pixels=flowPixels;objects=flowObjects;intrinsics=flowIntrinsics;}
  }
  this.previous = gray; this.frames++;this.lastMotion=motionPixels;this.lastTimestamp=frame.timestampMs;
  if (!solution || solution.inliers.length < 12) {
    this.previousPixels = new Float32Array(); this.previousObjects = new Float32Array();
    return {quality:{...statistics,motionPixels,targetSizePx:0,featureCount:0,inliers:0,reprojectionErrorPx:0}, status: 'not-found', matrix: null, timestampMs: frame.timestampMs,
      sessionId: frame.sessionId, processingMs: performance.now() - start };
  }
  const cells=new Map<number,number>();
  const retained=solution.inliers.filter(i=>{const cell=Math.floor(pixels[2*i]!/frame.width*12)+12*Math.floor(pixels[2*i+1]!/frame.height*9),count=cells.get(cell)??0;
    if(count>=6)return false;cells.set(cell,count+1);return true;}).slice(0,384);
  this.previousPixels = new Float32Array(retained.flatMap(i => [pixels[i * 2]!, pixels[i * 2 + 1]!]));
  this.previousObjects = new Float32Array(retained.flatMap(i => Array.from(objects.subarray(i * 3, i * 3 + 3))));
  return {
    quality:{...statistics,motionPixels,targetSizePx:this.targetSize(solution.matrix,intrinsics),featureCount:pixels.length/2,inliers:solution.inliers.length,reprojectionErrorPx:solution.errorPx},
    status: 'tracked', timestampMs: frame.timestampMs, sessionId: frame.sessionId,
    processingMs: performance.now() - start, matrix: solution.matrix,
    projectionMatrix: projectionFromIntrinsics(intrinsics), projectionSource: frame.projectionSource,
    inliers: solution.inliers.length, reprojectionErrorPx: solution.errorPx,
    reference: { rgba: frame.buffer, width: frame.width, height: frame.height,
      sessionId: frame.sessionId, timestampMs: frame.timestampMs, intrinsics,
      projectionSource:frame.projectionSource,
      cameraFromMarker: solution.matrix.slice(),
      imagePoints:new Float32Array(solution.inliers.flatMap(i=>[pixels[2*i]!,pixels[2*i+1]!])),
      objectPoints:new Float32Array(solution.inliers.flatMap(i=>Array.from(objects.subarray(3*i,3*i+3)))),
      markerCorners: objectsForPixels(new Float32Array([0, 0, this.marker.width, 0, this.marker.width, this.marker.height, 0, this.marker.height]), this.marker) },
  };
}

}

const scope=self as unknown as DedicatedWorkerGlobalScope;
let cv:CV|null=null,buffers:GrayBuffers|null=null,orb:InstanceType<CV['ORB']>|null=null,busy=false;
const targets=new Map<string,ImageTargetState>();
let sceneSignature='',cameraEstimator=new PlanarCameraEstimator();
let frameSequence=0;
scope.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const message=event.data as TrackingFrameRequest|{id:number;type:'LOAD_TARGET'|'ADD_TARGET';buffer:ArrayBuffer;opencvURL:string;targetId?:string};
  if(!message||!Number.isSafeInteger(message.id))return;
  if(busy){scope.postMessage({id:message.id,ok:false,error:'Worker ocupado.'});return;}busy=true;
  void(async()=>{
    if(message.type==='LOAD_TARGET'||message.type==='ADD_TARGET'){
      const targetId=message.targetId??'default';
      if(!/^[a-zA-Z0-9_-]{1,64}$/.test(targetId))throw new Error('ID de marcador invalido.');
      if(message.type==='ADD_TARGET'&&!targets.has(targetId)&&targets.size>=8)throw new Error('Maximo 8 marcadores por Worker.');
      const decoded=decodeMarker(message.buffer);
      if(decoded.simulated||decoded.extractorId!==ORB_EXTRACTOR_ID)throw new Error('Extractor incompatible.');
      const runtime=await loadOpenCV(message.opencvURL);cv=runtime.cv;
      if(message.type==='LOAD_TARGET'){sceneSignature='';cameraEstimator=new PlanarCameraEstimator();targets.clear();buffers?.dispose();buffers=new GrayBuffers(cv);orb?.delete();orb=createORB(cv);}
      if(!buffers||!orb)throw new Error('Cargar primero un marcador.');
      targets.set(targetId,new ImageTargetState(cv,decoded));
      scope.postMessage({id:message.id,ok:true,result:null});return;
    }
    if(!cv||!buffers||!orb)throw new Error('Cargar marcadores primero.');
    if((message.type!=='FRAME'&&message.type!=='FRAME_BATCH')||!(message.buffer instanceof ArrayBuffer)||
      !Number.isSafeInteger(message.width)||!Number.isSafeInteger(message.height)||message.width<1||message.height<1||
      message.width*message.height>4096*4096||message.buffer.byteLength!==message.width*message.height*4||
      !Number.isSafeInteger(message.sessionId)||!Number.isFinite(message.timestampMs))throw new Error('Frame invalido.');
    const started=performance.now(),profile=createTrackingProfile();
    const gray=measureTracking(profile,'grayMs',()=>buffers!.frame(new Uint8ClampedArray(message.buffer),message.width,message.height));
    const statistics=measureTracking(profile,'qualityMs',()=>measureFrame(gray));
    let features:MarkerFeatures|null=null;
    const getFeatures=()=>{if(!features){profile.counts.orbExtractions++;features=measureTracking(profile,'orbMs',()=>extractORB(cv!,gray,orb!));}return features;};
    const signature=`${message.sessionId}:${message.width}x${message.height}`;
    if(signature!==sceneSignature){cameraEstimator=new PlanarCameraEstimator();sceneSignature=signature;}
    const frame={...message,intrinsics:message.projectionSource==='estimated'?cameraEstimator.current(message.intrinsics):message.intrinsics};
    const observations:Float64Array[]=[];
    const results:TrackingResult[]=[];
    frameSequence++;
    const entries=[...targets];
    const count=message.type==='FRAME'?1:entries.length;
    const offset=count>1?(frameSequence-1)%count:0;
    let globalUsed=false;
    const reserveGlobal=()=>{
      if(globalUsed)return false;
      globalUsed=true;return true;
    };
    for(let i=0;i<count;i++){
      const index=(offset+i)%count;
      const [targetId,state]=entries[index]!;
      results[index]={...state.process(frame,gray,getFeatures,statistics,h=>observations.push(h),frameSequence,profile,reserveGlobal),targetId};
    }
    const featureCount=(features as MarkerFeatures|null)?.descriptors.length??0;
    for(const result of results)if(result.status==='not-found'&&result.quality)result.quality.featureCount=featureCount/32;
    for(const h of observations)cameraEstimator.observe(h,message.intrinsics);
    const transfer=new Set<ArrayBuffer>();
    for(const result of results)if(result.status==='tracked'){
      for(const value of[result.matrix.buffer,result.projectionMatrix.buffer,result.reference.rgba,result.reference.cameraFromMarker.buffer,
        result.reference.imagePoints.buffer,result.reference.objectPoints.buffer,result.reference.markerCorners.buffer])transfer.add(value as ArrayBuffer);
    }
    profile.timings.workerMs=performance.now()-started;
    const result=message.type==='FRAME'?{...results[0],profile}:{results,processingMs:profile.timings.workerMs,profile};
    scope.postMessage({id:message.id,ok:true,result},[...transfer]);
  })().catch(error=>scope.postMessage({id:message.id,ok:false,error:error instanceof Error?error.message:String(error)})).finally(()=>{busy=false;});
});
