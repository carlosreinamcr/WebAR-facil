/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { OdometryBackend, OdometryConfig, OdometryEstimate,OdometryMapSnapshot,OdometryTimings,OdometryScanHint,VisualReferenceResult } from './OdometryBackend.ts';
import type { CV } from '../vision/runtime.ts';
import { loadOpenCV } from '../vision/runtime.ts';
import { createORB, detectCorners, extractORB, GrayBuffers, matchORB, trackLK } from '../vision/features.ts';
import { scaleIntrinsics, projectionFromIntrinsics,normalizedPixel,validateIntrinsics } from '../vision/calibration.ts';
import { fitPlane, stablePlane, initializeTwoView, projectWorld, triangulate, type PlaneFit, type Vec3 } from '../vision/geometry.ts';
import { identity, invertRigid,assertRigid } from '../spatial/matrices.ts';
import { solvePose } from '../vision/pose.ts';
import {FlowPointBudget,distributedIndices} from './FlowPointBudget.ts';
import {useWideFlow,type FlowMotionSample} from './OpticalFlowPolicy.ts';
import {measureFrame} from '../vision/frameQuality.ts';
import type { CameraIntrinsics } from '../Pose.ts';

const BOOTSTRAP_POINTS=40;
const MAX_KEYFRAMES=50;

interface Landmark { point: Vec3; pixel: [number,number]; marker: boolean; observations: number;stillPixel?:[number,number];reference?:{pixel:[number,number];view:Float32Array} }
interface Candidate { origin: [number,number]; pixel: [number,number]; view: Float32Array }
interface RelocalizationFrame { descriptors: Uint8Array; points: Vec3[];view:Float32Array;pixels?:[number,number][] }
interface MapHypothesis {score:number;view:Float32Array;landmarks:Landmark[];errorPx:number;ratio:number;cells:number;imageShiftPx:number|null}

/** Mapa local monocular: LK + PnP, triangulación y relocalización ORB. Sin cierre de bucle global. */
export class VisualOdometryBackend implements OdometryBackend {
  private readonly cv: CV;
  private readonly config: OdometryConfig;
  private readonly buffers: GrayBuffers;
  private readonly orb: InstanceType<CV['ORB']>;
  private previous: InstanceType<CV['Mat']> | null = null;
  private mapped: Landmark[] = [];
  private candidates: Candidate[] = [];
  private keyframes: RelocalizationFrame[] = [];
  private visualReference:{id:string;frame:RelocalizationFrame}|null=null;
  private origins: Float32Array = new Float32Array();
  private initializationPixels: Float32Array = new Float32Array();
  private view = identity();
  private k: CameraIntrinsics;
  private frame = 0;
  private serial = 1;
  private lost = false;
  private seeded = false;
  private environmentReady = false;
  private markerCorners: Float32Array | null = null;
  private scale: 'metric' | 'relative' = 'relative';
  private plane: { matrix: Float32Array; inliers: number } | null = null;
  private readonly planeCandidates:{fit:PlaneFit;timestamp:number}[]=[];
  private relocalizationCandidate:{view:Float32Array;count:number}|null=null;
  private recoveryHint:OdometryScanHint='return-to-map';
  private relocalized=false;
  private corrected=false;
  private lastTimestamp=-Infinity;
  private initializationAt=0;
  private rejectedInitializations=0;
  private lastMotion:FlowMotionSample|null=null;
  private lastRelocalization=-Infinity;
  private failedRelocalizations=0;
  private lastRelocalizationCost=0;
  private timings:OdometryTimings={};
  private pointBudget=new FlowPointBudget();

  constructor(cv: CV, config: OdometryConfig) {
    this.cv=cv; this.config=config; this.k=config.intrinsics;
    this.buffers=new GrayBuffers(cv); this.orb=createORB(cv);
    const seed=config.seed;
    if(seed) {
      this.k=scaleIntrinsics(seed.intrinsics,seed.width,seed.height);
      this.previous=this.buffers.frame(new Uint8ClampedArray(seed.rgba),seed.width,seed.height);
      this.view=seed.cameraFromMarker.slice();this.seeded=true;this.scale='metric';this.markerCorners=seed.markerCorners.slice();
      this.mapped=Array.from({length:seed.imagePoints.length/2},(_,i)=>({
        point:Array.from(seed.objectPoints.subarray(3*i,3*i+3)) as Vec3,
        pixel:[seed.imagePoints[2*i]!,seed.imagePoints[2*i+1]!] as [number,number],marker:true,observations:1,
      }));
      this.addCandidates(this.previous);
    }
  }

  reset(): void {
    this.pointBudget=new FlowPointBudget();
    this.buffers.dispose();this.previous=null;this.mapped=[];this.candidates=[];this.keyframes=[];
    this.visualReference=null;
    this.origins=new Float32Array();this.initializationPixels=new Float32Array();this.view=identity();
    this.frame=0;this.serial++;this.lost=false;this.seeded=false;this.environmentReady=false;
    this.markerCorners=null;this.scale='relative';this.plane=null;this.planeCandidates.length=0;
    this.relocalizationCandidate=null;this.recoveryHint='return-to-map';this.relocalized=false;this.corrected=false;
    this.lastTimestamp=-Infinity;this.lastMotion=null;this.lastRelocalization=-Infinity;this.failedRelocalizations=0;this.lastRelocalizationCost=0;
  }

  processFrame(input: { rgba: Uint8ClampedArray; width:number; height:number; timestampMs:number }): OdometryEstimate {
    const start=performance.now();this.frame++;this.relocalized=false;this.corrected=false;this.timings={};
    this.k=scaleIntrinsics(this.config.seed && this.seeded ? this.config.seed.intrinsics : this.config.intrinsics,input.width,input.height);
    if(this.previous&&(this.previous.cols!==input.width||this.previous.rows!==input.height))this.reset();
    const gap=input.timestampMs-this.lastTimestamp;
    this.lastTimestamp=input.timestampMs;
    const gray=this.measure('grayMs',()=>this.buffers.frame(input.rgba,input.width,input.height));
    const largeMotion=useWideFlow(this.lastMotion,gap,Math.min(input.width,input.height));
    if(!this.previous&&this.lost&&this.keyframes.length){
      this.previous=gray;
      if(!this.tryRelocalize(gray,input.timestampMs))return this.inactive('lost',start,this.recoveryHint);
      this.lost=false;this.addCandidates(gray);return this.estimate(start,0);
    }
    if(!this.previous) {
      this.restartInitialization(gray,input.timestampMs);this.previous=gray;
      return this.inactive('initializing',start,this.bootstrapHint());
    }
    if(!this.mapped.length&&!this.lost) {
      if(this.initializationPixels.length<BOOTSTRAP_POINTS*2||gap>900){
        if(gap>900||input.timestampMs-this.initializationAt>=150)this.restartInitialization(gray,input.timestampMs);
        this.previous=gray;
        return this.inactive('initializing',start,this.bootstrapHint());
      }
      if(this.initializationPixels.length/2>this.pointBudget.limit){
        const indices=distributedIndices(this.initializationPixels.length/2,this.pointBudget.limit,this.k,
          i=>[this.initializationPixels[i*2]!,this.initializationPixels[i*2+1]!]);
        this.initializationPixels=new Float32Array(indices.flatMap(i=>[this.initializationPixels[i*2]!,this.initializationPixels[i*2+1]!]));
        this.origins=new Float32Array(indices.flatMap(i=>[this.origins[i*2]!,this.origins[i*2+1]!]));
      }
      const enough=(result:ReturnType<typeof trackLK>)=>result.indices.length>=BOOTSTRAP_POINTS;
      const flow=this.follow(gray,this.initializationPixels,largeMotion,gap,enough);
      this.lastMotion=enough(flow)?this.flowMotion(this.initializationPixels,flow,gap):null;
      this.origins=new Float32Array(flow.indices.flatMap(i=>[this.origins[2*i]!,this.origins[2*i+1]!]));
      this.initializationPixels=flow.points;
      const displacement=flow.points.length ? Array.from({length:flow.points.length/2},(_,i)=>Math.hypot(
        flow.points[2*i]!-this.origins[2*i]!,flow.points[2*i+1]!-this.origins[2*i+1]!)).sort((a,b)=>a-b) : [];
      const hasMotion=(displacement[Math.floor(displacement.length/2)]??0)>Math.max(4,7*Math.min(input.width,input.height)/415);
      if(flow.indices.length>=BOOTSTRAP_POINTS&&hasMotion&&this.frame%3===0) {
        const map=this.measure('initializationMs',()=>initializeTwoView(this.origins,flow.points,this.k));
        if(!map)this.rejectedInitializations++;
        if(map) {
          this.view=map.viewMatrix;
          const initialView=identity();
          this.mapped=map.indices.map((index,i)=>({point:map.points[i]!,pixel:[flow.points[2*index]!,flow.points[2*index+1]!],marker:false,observations:3,
            reference:{pixel:[this.origins[2*index]!,this.origins[2*index+1]!],view:initialView}}));
          this.environmentReady=true;this.addCandidates(gray);this.measure('keyframesMs',()=>this.cacheRelocalization(gray));
        }
      }
      this.previous=gray;
      if(!this.mapped.length) {
        const age=input.timestampMs-this.initializationAt;
        if(flow.indices.length<BOOTSTRAP_POINTS||age>=4500||
          (age>=1600&&this.rejectedInitializations>=4)){
          this.restartInitialization(gray,input.timestampMs);
          return this.inactive('initializing',start,this.bootstrapHint());
        }
        return this.inactive('initializing',start,hasMotion?'map-initializing':'move-sideways');
      }
      return this.estimate(start,0);
    }

    let errorPx=0,stationary=false;
    if(!this.lost) {
      const limit=this.pointBudget.limit;
      const landmarks=distributedIndices(this.mapped.length,Math.max(limit-this.candidates.length,Math.floor(limit*2/3)),this.k,
        i=>this.mapped[i]!.pixel).map(i=>this.mapped[i]!);
      const proposals=distributedIndices(this.candidates.length,limit-landmarks.length,this.k,
        i=>this.candidates[i]!.pixel).map(i=>this.candidates[i]!);
      const count=landmarks.length;
      const all=new Float32Array([...landmarks.flatMap(p=>p.pixel),...proposals.flatMap(p=>p.pixel)]);
      const flow=this.follow(gray,all,largeMotion,gap,result=>result.indices.filter(index=>index<count).length>=12);
      const mapped:Landmark[]=[],candidates:Candidate[]=[];
      flow.indices.forEach((index,i)=>{
        const pixel:[number,number]=[flow.points[2*i]!,flow.points[2*i+1]!];
        if(index<count){
          const landmark=landmarks[index]!;
          mapped.push({...landmark,pixel,stillPixel:landmark.stillPixel??landmark.pixel});
        }
        else candidates.push({...proposals[index-count]!,pixel});
      });
      const solution=mapped.length>=12?this.measure('poseMs',()=>solvePose(this.cv,new Float32Array(mapped.flatMap(p=>p.point)),new Float32Array(mapped.flatMap(p=>p.pixel)),this.k,true)):null;
      if(solution&&solution.inliers.length>=12&&solution.inliers.length/mapped.length>.5&&
        ((this.seeded&&!this.environmentReady)||this.coverage(solution.inliers.map(i=>mapped[i]!.pixel))>=3)) {
        this.lastMotion=this.flowMotion(all,flow,gap);
        this.mapped=solution.inliers.map(i=>({...mapped[i]!,observations:mapped[i]!.observations+1}));this.candidates=candidates;
        const stillError=this.environmentReady&&gap>0&&gap<=150?this.stationaryError(solution.errorPx):null;
        stationary=stillError!==null;
        if(stillError===null){
          this.view=solution.matrix;errorPx=solution.errorPx;
          for(const point of this.mapped)delete point.stillPixel;
        }else errorPx=stillError;
      } else this.lost=true;
    }
    if(this.lost) {
      this.lastMotion=null;this.candidates=[];this.planeCandidates.length=0;
      if(!this.seeded&&!this.plane&&!this.keyframes.length){
        // Un mapa provisional sin referencias ni plano aún puede volver a empezar.
        this.mapped=[];this.view=identity();this.environmentReady=false;this.lost=false;
        this.visualReference=null;
        this.serial++;
        this.restartInitialization(gray,input.timestampMs);this.previous=gray;
        return this.inactive('initializing',start,this.bootstrapHint());
      }
      if(!this.tryRelocalize(gray,input.timestampMs)){this.previous=gray;return this.inactive('lost',start,this.recoveryHint);}
      this.lost=false;
    }
    if(!stationary)this.measure('mapUpdateMs',()=>{
      this.triangulateCandidates();
      if(this.frame%15===0)this.refineLandmarks();
    });
    const stable=this.mapped.filter(point=>!point.marker&&point.observations>=3);
    if(this.seeded&&!this.environmentReady&&stable.length>=30) {
      const xs=stable.map(p=>p.pixel[0]),ys=stable.map(p=>p.pixel[1]);
      if((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/(input.width*input.height)>.15) {
        this.environmentReady=true;
        // Tras desacoplar, el marcador deja de participar en la pose de cámara.
        this.mapped=this.mapped.filter(p=>!p.marker);this.keyframes=[];
      }
    }
    if(this.frame%5===0||this.candidates.length<40)this.addCandidates(gray);
    if(!stationary&&this.environmentReady&&this.config.keyframeCorrection===true&&this.frame%30===0)this.measure('keyframesMs',()=>this.correctFromKeyframe(gray));
    if((!stationary&&this.frame%12===0)||!this.keyframes.length)this.measure('keyframesMs',()=>this.cacheRelocalization(gray));
    if(!this.plane&&this.frame%5===0)this.measure('planeMs',()=>this.updatePlane(input.timestampMs));
    this.previous=gray;
    return this.estimate(start,errorPx,stationary);
  }

  private stationaryError(solvedError:number):number|null {
    const points=this.mapped.filter(point=>point.stillPixel);
    if(points.length<24||this.coverage(points.map(point=>point.pixel))<5)return null;
    const movement=points.map(point=>Math.hypot(point.pixel[0]-point.stillPixel![0],point.pixel[1]-point.stillPixel![1])).sort((a,b)=>a-b);
    // Fixed image references prevent small successive steps from being hidden as rest.
    const scale=Math.max(.65,Math.min(this.k.width,this.k.height)/480);
    if(movement[Math.floor(movement.length*.5)]!>.25*scale||movement[Math.floor(movement.length*.8)]!>.6*scale)return null;
    let sum=0;
    for(const point of points){
      const projected=projectWorld(point.point,this.view,this.k);
      if(projected[2]<=0)return null;
      sum+=(point.pixel[0]-projected[0])**2+(point.pixel[1]-projected[1])**2;
    }
    const error=Math.sqrt(sum/points.length);
    return error<=Math.min(2.5,solvedError+.35)?error:null;
  }

  private measure<T>(stage:keyof OdometryTimings,task:()=>T):T{
    const start=performance.now();
    try{return task();}
    finally{this.timings[stage]=(this.timings[stage]??0)+performance.now()-start;}
  }

  private bootstrapHint():OdometryScanHint{
    return this.initializationPixels.length>=BOOTSTRAP_POINTS*2?'move-sideways':'low-texture';
  }

  private restartInitialization(gray:InstanceType<CV['Mat']>,timestamp:number):void{
    this.initializationAt=timestamp;this.rejectedInitializations=0;this.lastMotion=null;
    this.initializationPixels=this.measure('cornersMs',()=>detectCorners(this.cv,gray,undefined,Math.min(350,this.pointBudget.limit)));
    this.origins=this.initializationPixels.slice();
  }

  private follow(gray:InstanceType<CV['Mat']>,pixels:Float32Array,largeMotion:boolean,gap:number,
    enough:(flow:ReturnType<typeof trackLK>)=>boolean):ReturnType<typeof trackLK>{
    const flow=this.measure('flowMs',()=>{
      const run=(wide:boolean)=>trackLK(this.cv,this.previous!,gray,pixels,{largeMotion:wide});
      if(largeMotion)return this.measure('flowWideMs',()=>run(true));
      const result=this.measure('flowNormalMs',()=>run(false));
      // Un cambio brusco puede aparecer sin una muestra previa de velocidad.
      // Si cae el soporte, repetir una vez siempre que la imagen aún tenga señal.
      if(gap<=0||gap>900||enough(result)||measureFrame(gray).gradient<1)return result;
      return this.measure('flowRetryMs',()=>run(true));
    });
    this.pointBudget.sample(this.timings.flowMs!,pixels.length/2);
    return flow;
  }

  private flowMotion(previous:Float32Array,flow:ReturnType<typeof trackLK>,intervalMs:number):FlowMotionSample|null{
    if(!flow.indices.length||intervalMs<=0||intervalMs>900)return null;
    const distances=flow.indices.map((index,i)=>Math.hypot(
      previous[index*2]!-flow.points[i*2]!,previous[index*2+1]!-flow.points[i*2+1]!)).sort((a,b)=>a-b);
    return {displacementPx:distances[Math.floor(distances.length/2)]!,intervalMs};
  }

  private tryRelocalize(gray:InstanceType<CV['Mat']>,timestamp:number):boolean{
    if(!this.keyframes.length)return false;
    const interval=Math.min(300,this.lastRelocalizationCost*2);
    if(this.failedRelocalizations>=3&&!this.relocalizationCandidate&&timestamp-this.lastRelocalization<interval)return false;
    this.lastRelocalization=timestamp;
    const recovered=this.measure('relocalizationMs',()=>this.relocalize(gray));
    this.lastRelocalizationCost=this.timings.relocalizationMs!;
    this.failedRelocalizations=recovered?0:this.failedRelocalizations+1;
    return recovered;
  }

  private inactive(status:'initializing'|'lost',start:number,scanHint:OdometryScanHint='return-to-map'):OdometryEstimate{
    this.timings.workerMs=performance.now()-start;
    return{status,mapId:String(this.serial),timings:this.timings,scanHint};
  }

  private estimate(start:number,errorPx:number,stationary=false):OdometryEstimate {
    this.timings.workerMs=performance.now()-start;
    return {status:'tracked',mapId:String(this.serial),worldFromCamera:invertRigid(this.view),
      projectionMatrix:projectionFromIntrinsics(this.k),scale:this.scale,trackedPoints:this.mapped.length,
      environmentReady:this.environmentReady,processingMs:this.timings.workerMs,timings:this.timings,reprojectionErrorPx:errorPx,
      relocalized:this.relocalized,keyframeCorrected:this.corrected,stationary,
      ...(this.plane?{groundPlane:{worldFromPlane:this.plane.matrix.slice(),inliers:this.plane.inliers}}:{}),
    };
  }

  private addCandidates(gray:InstanceType<CV['Mat']>):void {
    const limit=Math.min(300,Math.max(Math.ceil(this.pointBudget.limit/3),this.pointBudget.limit-this.mapped.length));
    if(this.mapped.length>=450||this.candidates.length>=limit)return;
    const existing=new Float32Array([...this.mapped.flatMap(p=>p.pixel),...this.candidates.flatMap(p=>p.pixel)]);
    const pixels=this.measure('cornersMs',()=>detectCorners(this.cv,gray,existing,limit-this.candidates.length));
    const originView=this.view.slice();
    const projected=this.markerCorners?Array.from({length:4},(_,i)=>projectWorld(Array.from(this.markerCorners!.subarray(3*i,3*i+3)) as Vec3,this.view,this.k)):null;
    for(let i=0;i<pixels.length;i+=2) {
      const pixel:[number,number]=[pixels[i]!,pixels[i+1]!];
      // No incorporar el papel del marcador al mapa ambiental.
      if(projected&&pixel[0]>Math.min(...projected.map(p=>p[0]))-10&&pixel[0]<Math.max(...projected.map(p=>p[0]))+10&&
          pixel[1]>Math.min(...projected.map(p=>p[1]))-10&&pixel[1]<Math.max(...projected.map(p=>p[1]))+10)continue;
      this.candidates.push({pixel,origin:pixel,view:originView});
    }
  }

  private triangulateCandidates():void {
    const retained:Candidate[]=[];
    for(const candidate of this.candidates) {
      const point=triangulate(candidate.origin,candidate.pixel,candidate.view,this.view,this.k,1.2);
      if(point&&this.mapped.length<450)this.mapped.push({point,pixel:candidate.pixel,marker:false,observations:1,reference:{pixel:candidate.origin,view:candidate.view}});
      else retained.push(candidate);
    }
    this.candidates=retained.slice(0,300);
  }

  private cacheRelocalization(gray:InstanceType<CV['Mat']>):void {
    const landmarks=this.mapped.filter(p=>!p.marker&&p.observations>=3);
    const frame=this.referenceFrame(gray,landmarks);
    if(!frame)return;
    const previous=this.keyframes.at(-1),camera=invertRigid(this.view);
    if(previous){const old=invertRigid(previous.view),distance=Math.hypot(camera[12]!-old[12]!,camera[13]!-old[13]!,camera[14]!-old[14]!);
      const rotation=[0,1,2,4,5,6,8,9,10].reduce((sum,i)=>sum+camera[i]!*old[i]!,0);
      const depths=landmarks.map(p=>projectWorld(p.point,this.view,this.k)[2]).sort((a,b)=>a-b),depth=depths[Math.floor(depths.length/2)]??1;
      if(distance<depth*.025&&rotation>2.94){
        if(frame.points.length<=previous.points.length*1.3)return;
        this.keyframes.pop();
      }
    }
    delete frame.pixels;
    this.keyframes.push(frame);
    if(this.keyframes.length>MAX_KEYFRAMES)this.pruneKeyframes();
  }

  private pruneKeyframes():void {
    const cameras=this.keyframes.map(frame=>invertRigid(frame.view));
    let index=1,smallest=Infinity;
    // Mantener la referencia inicial y la más reciente. Retirar una vista
    // redundante antes que una perspectiva poco cubierta del recorrido.
    for(let i=1;i<cameras.length-1;i++){
      const camera=cameras[i]!;
      for(let j=0;j<cameras.length;j++){
        if(i===j)continue;
        const other=cameras[j]!;
        const translation=Math.hypot(camera[12]!-other[12]!,camera[13]!-other[13]!,camera[14]!-other[14]!);
        const facing=camera[8]!*other[8]!+camera[9]!*other[9]!+camera[10]!*other[10]!;
        const score=translation+.5*Math.max(0,1-facing);
        if(score<smallest){smallest=score;index=i;}
      }
    }
    this.keyframes.splice(index,1);
  }

  private referenceFrame(gray:InstanceType<CV['Mat']>,landmarks:Landmark[]):RelocalizationFrame|null {
    if(landmarks.length<20)return null;
    const features=extractORB(this.cv,gray,this.orb),used=new Set<number>(),descriptors:number[]=[],points:Vec3[]=[],pixels:[number,number][]=[];
    const referenceWorld=invertRigid(this.view);
    for(const point of landmarks) {
      let selected=-1,best=36;
      for(let i=0;i<features.keypoints.length/4;i++) {
        const distance=(point.pixel[0]-features.keypoints[4*i]!)**2+(point.pixel[1]-features.keypoints[4*i+1]!)**2;
        if(distance<best&&!used.has(i)){selected=i;best=distance;}
      }
      if(selected>=0) {
        used.add(selected);
        // El descriptor ORB puede estar a varios píxeles de la esquina LK.
        // Anclar su propio rayo, manteniendo la profundidad triangulada, evita sesgo al relocalizar.
        const pixel:[number,number]=[features.keypoints[4*selected]!,features.keypoints[4*selected+1]!];
        const depth=projectWorld(point.point,this.view,this.k)[2],ray=normalizedPixel(...pixel,this.k),world=referenceWorld;
        const camera=[ray[0]*depth,-ray[1]*depth,-depth];
        points.push([0,1,2].map(row=>world[row]!*camera[0]!+world[4+row]!*camera[1]!+world[8+row]!*camera[2]!+world[12+row]!) as Vec3);
        descriptors.push(...features.descriptors.subarray(selected*32,selected*32+32));
        pixels.push(pixel);
      }
    }
    return points.length>=20?{descriptors:new Uint8Array(descriptors),points,view:this.view.slice(),pixels}:null;
  }

  checkVisualReference(action:'capture'|'verify',id:string,timestampMs:number):VisualReferenceResult {
    if(action==='capture')this.visualReference=null;
    if(!this.environmentReady||this.lost||!this.previous||!this.mapped.length||
      timestampMs-this.lastTimestamp>350)return {status:'unavailable'};
    if(action==='capture'){
      const frame=this.referenceFrame(this.previous,this.mapped.filter(point=>!point.marker&&point.observations>=3));
      if(!frame||frame.points.length<25||this.coverage(frame.pixels!)<5)return {status:'insufficient-support'};
      this.visualReference={id,frame};
      return {status:'captured',points:frame.points.length};
    }
    if(this.visualReference?.id!==id)return {status:'missing-reference'};
    const {frame}=this.visualReference;
    const match=this.matchReference(frame,extractORB(this.cv,this.previous,this.orb));
    if(!match||match.landmarks.length<25||match.ratio<.6||match.cells<5||match.errorPx>1.8||match.imageShiftPx===null)
      return {status:'insufficient-support'};
    const direct=invertRigid(match.view),reference=invertRigid(frame.view),tracked=invertRigid(this.view);
    const distance=(a:Float32Array,b:Float32Array)=>Math.hypot(a[12]!-b[12]!,a[13]!-b[13]!,a[14]!-b[14]!);
    return {status:'verified',inliers:match.landmarks.length,reprojectionErrorPx:match.errorPx,
      medianImageShiftPx:match.imageShiftPx,directReturnUnits:distance(direct,reference),trajectoryDeltaUnits:distance(direct,tracked)};
  }

  private refineLandmarks():void{
    let refined=0;
    for(const landmark of this.mapped){
      if(landmark.marker||landmark.observations<5||!landmark.reference||refined>=40)continue;
      const reference=landmark.reference,point=triangulate(reference.pixel,landmark.pixel,reference.view,this.view,this.k,2);
      if(!point)continue;
      const before=projectWorld(landmark.point,this.view,this.k),oldOrigin=projectWorld(landmark.point,reference.view,this.k);
      const after=projectWorld(point,this.view,this.k),newOrigin=projectWorld(point,reference.view,this.k);
      const oldError=Math.hypot(before[0]-landmark.pixel[0],before[1]-landmark.pixel[1])+Math.hypot(oldOrigin[0]-reference.pixel[0],oldOrigin[1]-reference.pixel[1]);
      const newError=Math.hypot(after[0]-landmark.pixel[0],after[1]-landmark.pixel[1])+Math.hypot(newOrigin[0]-reference.pixel[0],newOrigin[1]-reference.pixel[1]);
      if(newError<oldError*.95&&Math.hypot(...point.map((v,i)=>v-landmark.point[i]!))<before[2]*.05){landmark.point=point;refined++;}
    }
  }
  private coverage(pixels:[number,number][]):number{
    return new Set(pixels.map(([x,y])=>`${Math.min(3,Math.max(0,Math.floor(x/this.k.width*4)))}:${Math.min(2,Math.max(0,Math.floor(y/this.k.height*3)))}`)).size;
  }
  private mapHypothesis(gray:InstanceType<CV['Mat']>,anchorOnly=false,onMatches?:(count:number)=>void):MapHypothesis|null {
    if(!this.keyframes.length)return null;
    const features=extractORB(this.cv,gray,this.orb);
    let best:MapHypothesis|null=null;
    for(const frame of anchorOnly?[this.keyframes[0]!]:[...this.keyframes].reverse()){
      const hypothesis=this.matchReference(frame,features,onMatches);
      if(hypothesis&&(!best||hypothesis.score>best.score))best=hypothesis;
    }
    return best;
  }
  private matchReference(frame:RelocalizationFrame,features:ReturnType<typeof extractORB>,onMatches?:(count:number)=>void):MapHypothesis|null {
    const matches=matchORB(this.cv,frame.descriptors,features.descriptors);onMatches?.(matches.length);if(matches.length<15)return null;
    const pixels=new Float32Array(matches.flatMap(m=>[features.keypoints[4*m.train]!,features.keypoints[4*m.train+1]!]));
    const solution=solvePose(this.cv,new Float32Array(matches.flatMap(m=>frame.points[m.query]!)),pixels,this.k,true);
    if(!solution||solution.inliers.length<15||solution.inliers.length/matches.length<.4)return null;
    const xs=solution.inliers.map(i=>pixels[2*i]!),ys=solution.inliers.map(i=>pixels[2*i+1]!);
    if((Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/(this.k.width*this.k.height)<.08)return null;
    const cells=this.coverage(solution.inliers.map(i=>[pixels[2*i]!,pixels[2*i+1]!]));if(cells<4)return null;
    const score=solution.inliers.length/(solution.errorPx+.5);
    const shifts=frame.pixels?solution.inliers.map(i=>{const pixel=frame.pixels![matches[i]!.query]!;return Math.hypot(pixels[2*i]!-pixel[0],pixels[2*i+1]!-pixel[1]);}).sort((a,b)=>a-b):[];
    return {score,imageShiftPx:shifts[Math.floor(shifts.length/2)]??null,view:solution.matrix,errorPx:solution.errorPx,ratio:solution.inliers.length/matches.length,cells,landmarks:solution.inliers.map(i=>({point:[...frame.points[matches[i]!.query]!] as Vec3,
      pixel:[pixels[2*i]!,pixels[2*i+1]!] as [number,number],marker:false,observations:3}))};
  }
  private consistent(a:Float32Array,b:Float32Array,points:Landmark[],distanceRatio:number,angle:number):boolean{
    const first=invertRigid(a),second=invertRigid(b),depths=points.map(point=>projectWorld(point.point,a,this.k)[2]).filter(depth=>depth>0).sort((x,y)=>x-y);
    const depth=depths[Math.floor(depths.length/2)]??0;if(!depth)return false;
    const distance=Math.hypot(first[12]!-second[12]!,first[13]!-second[13]!,first[14]!-second[14]!);
    const trace=[0,1,2,4,5,6,8,9,10].reduce((sum,index)=>sum+first[index]!*second[index]!,0);
    return distance<depth*distanceRatio&&Math.acos(Math.max(-1,Math.min(1,(trace-1)/2)))<angle;
  }
  private relocalize(gray:InstanceType<CV['Mat']>):boolean {
    let mostMatches=0;
    const best=this.mapHypothesis(gray,false,count=>{mostMatches=Math.max(mostMatches,count);});
    if(!best){
      this.recoveryHint=mostMatches>=15?'map-pose-unverified':mostMatches>0?'map-matches-insufficient':'return-to-map';
      this.relocalizationCandidate=null;return false;
    }
    const strong=best.landmarks.length>=30&&best.ratio>=.65&&best.errorPx<1.5&&best.cells>=6;
    if(!strong){
      const previous=this.relocalizationCandidate,count=previous&&this.consistent(previous.view,best.view,best.landmarks,.15,Math.PI/9)?previous.count+1:1;
      this.relocalizationCandidate={view:best.view,count};if(count<2){this.recoveryHint='map-pose-confirming';return false;}
    }
    this.relocalizationCandidate=null;this.view=best.view;this.mapped=best.landmarks;this.relocalized=true;return true;
  }
  private correctFromKeyframe(gray:InstanceType<CV['Mat']>):void{
    const best=this.mapHypothesis(gray,true);
    if(!best||best.landmarks.length<25||best.ratio<.6||best.cells<6||best.errorPx>1.5||!this.consistent(this.view,best.view,best.landmarks,.03,Math.PI/36))return;
    const error=(points:Landmark[],view:Float32Array)=>Math.sqrt(points.reduce((sum,point)=>{const projected=projectWorld(point.point,view,this.k);return sum+(projected[0]-point.pixel[0])**2+(projected[1]-point.pixel[1])**2;},0)/points.length);
    const before=error(best.landmarks,this.view),after=error(best.landmarks,best.view);
    // Evidencia independiente: mejora reproyección del keyframe sin degradar los puntos LK.
    if(before-after<.1||after>before*.9||error(this.mapped,best.view)>Math.max(2,error(this.mapped,this.view)*1.25))return;
    this.view=best.view;this.corrected=true;
    this.mapped=this.mapped.filter(point=>{const pixel=projectWorld(point.point,this.view,this.k);return pixel[2]>0&&Math.hypot(pixel[0]-point.pixel[0],pixel[1]-point.pixel[1])<3;});
    for(const point of best.landmarks)if(this.mapped.length<450&&!this.mapped.some(old=>Math.hypot(old.pixel[0]-point.pixel[0],old.pixel[1]-point.pixel[1])<5))this.mapped.push(point);
  }
  exportMap(includeCurrentView=false):OdometryMapSnapshot{
    if(!this.environmentReady||!this.keyframes.length)throw new Error('El mapa aun no tiene referencias suficientes.');
    const current=includeCurrentView&&!this.lost&&this.previous
      ?this.referenceFrame(this.previous,this.mapped.filter(point=>!point.marker&&point.observations>=3)):null;
    const frames=current?[...this.keyframes.slice(0,MAX_KEYFRAMES-1),current]:this.keyframes;
    return{version:1,intrinsics:{...this.k},scale:this.scale,mapId:String(this.serial),
      keyframes:frames.map(frame=>({descriptors:frame.descriptors.slice(),points:new Float32Array(frame.points.flat()),view:frame.view.slice()})),
      ...(includeCurrentView?{currentViewCaptured:current!==null}:{}),
      ...(this.plane?{groundPlane:{worldFromPlane:this.plane.matrix.slice(),inliers:this.plane.inliers}}:{})};
  }
  importMap(snapshot:OdometryMapSnapshot):void{
    if(snapshot?.version!==1||!['metric','relative'].includes(snapshot.scale)||!Array.isArray(snapshot.keyframes)||!snapshot.keyframes.length||snapshot.keyframes.length>MAX_KEYFRAMES)throw new Error('Mapa local incompatible.');
    validateIntrinsics(snapshot.intrinsics);
    const expected=scaleIntrinsics(this.config.intrinsics,snapshot.intrinsics.width,snapshot.intrinsics.height);
    if(['fx','fy','cx','cy'].some(key=>Math.abs(expected[key as 'fx']-snapshot.intrinsics[key as 'fx'])>Math.max(1,expected.fx*.02)))throw new Error('El mapa requiere la misma proyeccion de camara.');
    const frames:RelocalizationFrame[]=snapshot.keyframes.map(frame=>{
      assertRigid(frame.view);
      if(!(frame.descriptors instanceof Uint8Array)||!(frame.points instanceof Float32Array)||frame.points.length<60||frame.points.length>1350||
        frame.descriptors.length!==frame.points.length/3*32||!Array.from(frame.points).every(Number.isFinite))throw new Error('Geometria de mapa invalida.');
      return{descriptors:frame.descriptors.slice(),points:Array.from({length:frame.points.length/3},(_,i)=>Array.from(frame.points.subarray(3*i,3*i+3)) as Vec3),view:frame.view.slice()};
    });
    if(snapshot.groundPlane){assertRigid(snapshot.groundPlane.worldFromPlane);if(!Number.isInteger(snapshot.groundPlane.inliers)||snapshot.groundPlane.inliers<20)throw new Error('Plano de mapa invalido.');}
    this.reset();this.keyframes=frames;this.k={...snapshot.intrinsics};this.scale=snapshot.scale;this.environmentReady=true;this.lost=true;
    if(snapshot.groundPlane)this.plane={matrix:snapshot.groundPlane.worldFromPlane.slice(),inliers:snapshot.groundPlane.inliers};
  }

  private updatePlane(timestamp:number):void {
    while(this.planeCandidates.length&&timestamp-this.planeCandidates[0]!.timestamp>2600)this.planeCandidates.shift();
    const roi=this.config.floorROI;
    const candidates=this.mapped.filter(p=>!p.marker&&p.observations>=3&&p.pixel[0]/this.k.width>=roi.x&&
      p.pixel[0]/this.k.width<=roi.x+roi.width&&p.pixel[1]/this.k.height>=roi.y&&p.pixel[1]/this.k.height<=roi.y+roi.height);
    if(candidates.length<20)return;
    const worldFromCamera=invertRigid(this.view),camera:Vec3=[worldFromCamera[12]!,worldFromCamera[13]!,worldFromCamera[14]!];
    const depths=candidates.map(p=>projectWorld(p.point,this.view,this.k)[2]).sort((a,b)=>a-b);
    const threshold=Math.max(.002,depths[Math.floor(depths.length/2)]!*.015);
    const plane=this.measure('planeFitMs',()=>fitPlane(candidates.map(p=>p.point),camera,threshold));
    if(!plane)return;
    this.planeCandidates.push({fit:plane,timestamp});
    if(this.planeCandidates.length>5)this.planeCandidates.shift();
    this.plane=this.measure('planeConsensusMs',()=>stablePlane(this.planeCandidates.map(candidate=>candidate.fit),threshold*2));
    if(this.plane)this.planeCandidates.length=0;
  }
}

export async function createOdometryBackend(config:OdometryConfig):Promise<OdometryBackend> {
  const {cv}=await loadOpenCV(config.opencvURL);return new VisualOdometryBackend(cv,config);
}
