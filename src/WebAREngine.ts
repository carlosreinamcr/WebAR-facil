/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { CameraManager, type CameraFrame, type CameraManagerOptions, type CameraMetrics } from './camera/CameraManager';
import { Tracker, type TrackerOptions } from './tracking/Tracker';
import {validateCylinder} from './tracking/CylindricalTarget';
import type { ImageObservation } from './tracking/types';
import { TARGET_MAX_BYTES, decodeMarker, type MarkerQuality } from './tracking/ImageCompiler';
import { compileWithMarkerCache } from './tools/MarkerCache';
import { MarkerCompiler } from './tools/MarkerCompiler';
import { SLAMManager } from './slam/SLAMManager';
import { OpticalFlowSLAM, type OpticalFlowOptions } from './slam/OpticalFlowSLAM';
import type { ExperimentalMetricScale } from './slam/ExperimentalMetricScale';
import type { ARPose, CameraIntrinsics } from './Pose';
import { identity, invertRigid, multiply,assertRigid } from './spatial/matrices';
import type {OdometryMapSnapshot,VisualReferenceResult} from './slam/OdometryBackend';
import { PoseFilter } from './spatial/PoseFilter';
import { embeddedVisionURL } from './internal/EmbeddedAssets';
import { estimateIntrinsics, validateIntrinsics } from './vision/calibration';

import {TargetPresentation} from './tracking/TargetPresentation';
import type {AREventMap,TrackingQualityEvent} from './tracking/events';
import type {TrackingResult} from './tracking/types';
export enum EngineState {Idle='Idle',Camera='Camera',TrackingImage='TrackingImage',TrackingSurface='TrackingSurface',Disposed='Disposed'}
export interface EngineOptions {
  /** Optional session-only conversion of relative optical poses into estimated meters. */
  experimentalMetricScale?:ExperimentalMetricScale;
  /** Corrección local experimental; desactivada por defecto. No es cierre de bucle global. */
  keyframeCorrection?:boolean;
  /** Ocultar tras una pérdida sostenida; sin publicar poses durante la incertidumbre. 0 desactiva la tolerancia. */
  imageLossGraceMs?:number;
  keepContentOnLost?:boolean;
  imageSmoothingMs?:number;
  camera?:Omit<CameraManagerOptions,'onFrame'|'onError'>;
  tracker?:TrackerOptions;
  opencvURL?:string|URL;
  calibration?:CameraIntrinsics;
  /** false deshabilita el fallback. Por defecto se usa el backend local integrado. */
  fallback?:OpticalFlowOptions|false;
  attachXRSession?:(session:XRSession)=>Promise<void>;
  getXRContext?:()=>WebGL2RenderingContext;
  overlayRoot?:HTMLElement;
}
export interface ImageTargetOptions {
  /** Opcional: escala de referencia de 0.2 m por defecto; no requiere medir el marcador. */
  physicalWidthMeters?: number;
  maxDimension?: number;
  /** Experimental. Diámetro exterior de la zona cilíndrica de la etiqueta, en metros. */
  cylinderDiameterMeters?:number;
}
export interface ImageTargetMetadata {
  format: 'WART'; version: 2; width: number; height: number;
  physicalWidthMeters: number; extractorId: number; quality: MarkerQuality;
}
export interface ImageTargetResult {
  /** Copia independiente: puede guardarse como .dat sin afectar al motor. */
  buffer: ArrayBuffer;
  /** Datos listos para JSON.stringify; no se necesita cargar ningún JSON. */
  metadata: ImageTargetMetadata;
}
export interface SurfaceTransitionOptions {
  targetId?:string;
  backend?:'auto'|'webxr'|'optical-flow';
  placement?:'auto'|'preserve'|'hit-test';
  initializationTimeoutMs?:number;
}
export interface SurfaceTransitionResult {backend:'webxr'|'optical-flow';placement:'preserved'|'scan-marker'|'select-surface'|'scan-floor'}
export interface SLAMMapSnapshot {version:1;map:OdometryMapSnapshot;anchor:Float32Array|null;targetId:string;}
interface Deferred {promise:Promise<void>;resolve:()=>void;reject:(error:Error)=>void}
function deferred():Deferred {
  let resolve!:()=>void,reject!:(error:Error)=>void;
  const promise=new Promise<void>((res,rej)=>{resolve=res;reject=rej;});
  void promise.catch(()=>{});return{promise,resolve,reject};
}

/** Fachada: cámara, tracking de imagen y espacios nativos/locales comparten ARPose. */
export class WebAREngine {
  private readonly options:EngineOptions;
  private readonly camera:CameraManager;
  private tracker:Tracker|null=null;
  private readonly targetSources=new Map<string,{buffer:ArrayBuffer;cylinderDiameterMeters?:number}>();
  private trackingSources(sources:Iterable<[string,{buffer:ArrayBuffer;cylinderDiameterMeters?:number}]>){
    return Array.from(sources,([id,source])=>({...source,id,buffer:source.buffer.slice(0)}));
  }
  private readonly presentations=new Map<string,TargetPresentation>();
  private readonly observations=new Map<string,ImageObservation>();
  private activeTargetId='default';
  private keepContentOnLost:boolean;
  private readonly eventHandlers:{[K in keyof AREventMap]:Set<(event:AREventMap[K])=>void>}={targetFound:new Set(),targetLost:new Set(),trackingQuality:new Set(),targetVisibility:new Set(),scanGuidance:new Set()};
  private alignmentTracker:Tracker|null=null;
  private targetData:ArrayBuffer|null=null;
  private imageReference:ImageObservation|null=null;
  private flow:OpticalFlowSLAM|null=null;
  private xr:SLAMManager|null=null;
  private controller=new AbortController();
  private busy=false;
  private activeOperation:Promise<unknown>|null=null;
  private mode:'camera'|'image'|'flow'|'xr'='camera';
  private currentState=EngineState.Idle;
  private flowAnchor:Float32Array|null=null;
  private mapId:string|null=null;
  private readonly cameraFilter=new PoseFilter();
  private readiness:Deferred|null=null;
  private alignment:Deferred|null=null;
  private referenceWaiter:Deferred|null=null;
  private preservingFlow=false;
  private scanHint:AREventMap['scanGuidance']['hint']|null=null;
  private odometryTimings:import('./slam/OdometryBackend').OdometryTimings|undefined;
  private flowProjectionSource:'calibrated'|'estimated'='estimated';
  private readonly poses=new Set<(matrix:Float32Array,pose:ARPose)=>void>();
  private readonly statuses=new Set<(message:string)=>void>();
  private readonly errors=new Set<(error:Error)=>void>();
  private readonly surfaces=new Set<(matrix:Float32Array)=>void>();
  private readonly metrics=new Set<(metrics:CameraMetrics)=>void>();
  private lastStatus='';
  private releasing:Promise<void>=Promise.resolve();

  constructor(options:EngineOptions={}) {
    this.keepContentOnLost=options.keepContentOnLost??false;
    new TargetPresentation('default',{...(options.imageLossGraceMs!==undefined?{graceMs:options.imageLossGraceMs}:{}),...(options.imageSmoothingMs!==undefined?{smoothingMs:options.imageSmoothingMs}:{})});
    this.options=options;if(options.calibration)validateIntrinsics(options.calibration);
    this.camera=new CameraManager({...options.camera,
      onFrame:(frame,signal)=>this.consume(frame,signal),
      onStatus:status=>{this.status(status);options.camera?.onStatus?.(status);},
      onError:error=>{this.stop();this.emitError(error);},
      onSuspend:()=>{this.scanHint=null;for(const id of this.presentations.keys())this.endPresentation(id,'stopped');this.observations.clear();this.imageReference=null;options.camera?.onSuspend?.();this.status('camera-suspended');},
      onResume:()=>{this.presentations.forEach(target=>target.resetSmoothing());this.cameraFilter.reset();options.camera?.onResume?.();this.status('camera-resumed');},
      onMetrics:cameraMetrics=>{const profile=this.mode==='image'?this.tracker?.latestProfile:null;const metrics={...cameraMetrics,...(profile?{tracking:profile}:{}),...(this.odometryTimings?{odometry:this.odometryTimings}:{})};this.odometryTimings=undefined;options.camera?.onMetrics?.(metrics);this.metrics.forEach(fn=>this.safely(()=>fn({...metrics})));},
    });
  }
  get state():EngineState{return this.currentState;}
  get videoElement():HTMLVideoElement{return this.camera.videoElement;}
  get cameraSettings():MediaTrackSettings|null{return this.camera.settings;}
  get calibration():CameraIntrinsics|undefined{
    const k=this.options.calibration??this.options.tracker?.calibration??(this.options.fallback||undefined)?.intrinsics;
    return k?{...k,...(k.distortion?{distortion:[...k.distortion]}:{})}:undefined;
  }
  setFocus(mode:'continuous'|'manual',distance?:number):Promise<boolean>{return this.camera.setFocus(mode,distance);}
  onPose(fn:(matrix:Float32Array,pose:ARPose)=>void):()=>void{this.poses.add(fn);return()=>{this.poses.delete(fn);};}
  onStatus(fn:(message:string)=>void):()=>void{this.statuses.add(fn);return()=>{this.statuses.delete(fn);};}
  onError(fn:(error:Error)=>void):()=>void{this.errors.add(fn);return()=>{this.errors.delete(fn);};}
  onSurface(fn:(matrix:Float32Array)=>void):()=>void{this.surfaces.add(fn);return()=>{this.surfaces.delete(fn);};}
  onMetrics(fn:(metrics:CameraMetrics)=>void):()=>void{this.metrics.add(fn);return()=>{this.metrics.delete(fn);};}

  get targetIds():readonly string[]{return [...this.targetSources.keys()];}
  on<K extends keyof AREventMap>(name:K,listener:(event:AREventMap[K])=>void):()=>void{
    const set=this.eventHandlers[name] as Set<(event:AREventMap[K])=>void>;set.add(listener);return()=>{set.delete(listener);};
  }
  onTargetFound(listener:(event:AREventMap['targetFound'])=>void):()=>void{return this.on('targetFound',listener);}
  onTargetLost(listener:(event:AREventMap['targetLost'])=>void):()=>void{return this.on('targetLost',listener);}
  onTrackingQuality(listener:(event:AREventMap['trackingQuality'])=>void):()=>void{return this.on('trackingQuality',listener);}
  onTargetVisibility(listener:(event:AREventMap['targetVisibility'])=>void):()=>void{return this.on('targetVisibility',listener);}
  /** Retener es congelar la ultima transformacion, no crear un anclaje SLAM. */
  setKeepContentOnLost(value:boolean,targetId?:string):void{
    if(typeof value!=='boolean')throw new Error('Usar true o false.');
    if(targetId&&!this.presentations.has(targetId))throw new Error('Marcador desconocido.');
    if(!targetId)this.keepContentOnLost=value;
    for(const[id,presentation]of this.presentations)if(!targetId||id===targetId){const event=presentation.setKeep(value);if(event)this.emitEvent('targetVisibility',event);}
  }
  private emitEvent<K extends keyof AREventMap>(name:K,event:AREventMap[K]):void{
    const set=this.eventHandlers[name] as Set<(event:AREventMap[K])=>void>;set.forEach(listener=>this.safely(()=>listener(event)));
  }
  private endPresentation(id:string,reason:'removed'|'stopped'):void{
    const presentation=this.presentations.get(id);if(!presentation)return;const ended=presentation.end(reason,performance.now());
    if(ended.lost)this.emitEvent('targetLost',ended.lost);this.emitEvent('targetVisibility',ended.visibility);
  }
  /** Compare a fresh optical frame against the pinned reference without correcting the live pose. */
  checkSLAMVisualReference(action:'capture'|'verify',id:string):Promise<VisualReferenceResult>{
    return this.operation(async signal=>{
      if(this.mode!=='flow'||!this.flow)return {status:'unavailable'};
      return this.flow.checkVisualReference(action,id,signal);
    });
  }
  exportSLAMMap({includeCurrentView=false}:{includeCurrentView?:boolean}={}):Promise<SLAMMapSnapshot>{return this.operation(async signal=>{
    if(this.mode!=='flow'||!this.flow)throw new Error('Exportación disponible en visión local.');
    const map=await this.flow.exportMap(signal,includeCurrentView);signal.throwIfAborted();
    return{version:1,map,anchor:this.flowAnchor?.slice()??null,targetId:this.activeTargetId};
  });}
  importSLAMMap(snapshot:SLAMMapSnapshot):Promise<void>{return this.operation(async signal=>{
    if(this.mode!=='flow'||!this.flow)throw new Error('Activar visión local antes de importar el mapa.');
    if(snapshot?.version!==1||!/^[a-zA-Z0-9_-]{1,64}$/.test(snapshot.targetId))throw new Error('Snapshot incompatible.');
    if(snapshot.anchor)assertRigid(snapshot.anchor);
    if(snapshot.map.intrinsics.width>(this.options.camera?.maxFrameWidth??640))throw new Error('Aumentar maxFrameWidth para recuperar este mapa.');
    await this.flow.importMap(snapshot.map,signal);signal.throwIfAborted();this.camera.setAnalysisWidth(snapshot.map.intrinsics.width);
    this.options.experimentalMetricScale?.resetMap();
    this.flowAnchor=snapshot.anchor?.slice()??null;this.activeTargetId=snapshot.targetId;this.mapId=null;this.scanHint=null;this.cameraFilter.reset();this.status('odometry-map-reset');this.status('odometry-lost');
  });}

  async startCamera():Promise<void>{return this.operation(async signal=>{
    if(this.mode==='xr')throw new Error('Detener WebXR antes de abrir vídeo.');
    await this.releasing;signal.throwIfAborted();await this.camera.start();signal.throwIfAborted();
    if(this.currentState===EngineState.Idle)this.currentState=EngineState.Camera;this.status('camera-ready');
  });}

  loadTarget(url:string|URL):Promise<void>{return this.fetchTarget('default',url,false);}
  addTarget(id:string,url:string|URL):Promise<void>{return this.fetchTarget(id,url,true);}
  private fetchTarget(id:string,url:string|URL,additive:boolean):Promise<void>{return this.operation(async signal=>{
    if(this.mode==='xr'||this.mode==='flow')throw new Error('Detener superficies antes de cargar un marcador.');
    const response=await fetch(url,{signal});if(!response.ok)throw new Error(`Marcador: HTTP ${response.status}.`);
    if(Number(response.headers.get('content-length'))>TARGET_MAX_BYTES)throw new Error('Marcador demasiado grande.');
    const reader=response.body?.getReader();let data:ArrayBuffer;
    if(reader){
      const chunks:Uint8Array[]=[];let size=0;
      try{for(;;){const{value,done}=await reader.read();if(done)break;signal.throwIfAborted();size+=value.byteLength;
        if(size>TARGET_MAX_BYTES)throw new Error('Marcador demasiado grande.');chunks.push(value);}}
      catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}data=bytes.buffer;
    }else data=await response.arrayBuffer();
    await this.installTarget(data,signal,id,additive);
  });}

  /** Compila JPG/PNG en Worker y activa el marcador sin archivos intermedios. */
  loadImageTarget(source:Blob|string|URL,options:ImageTargetOptions={}):Promise<ImageTargetResult>{return this.compileTarget('default',source,options,false);}
  addImageTarget(id:string,source:Blob|string|URL,options:ImageTargetOptions={}):Promise<ImageTargetResult>{return this.compileTarget(id,source,options,true);}
  private async compileTarget(id:string,source:Blob|string|URL,options:ImageTargetOptions,additive:boolean):Promise<ImageTargetResult>{
    return this.operation(async signal=>{
      if(this.mode==='xr'||this.mode==='flow')throw new Error('Detener superficies antes de cargar un marcador.');
      const physicalWidthMeters=options.physicalWidthMeters??0.2;
      if(!Number.isFinite(physicalWidthMeters)||physicalWidthMeters<=0)throw new Error('Ancho físico inválido.');
      const diameter=options.cylinderDiameterMeters;
      if(diameter!==undefined)validateCylinder(diameter,physicalWidthMeters);
      let image:Blob;
      if(source instanceof Blob)image=source;
      else{
        const response=await fetch(source,{signal});if(!response.ok)throw new Error(`Imagen: HTTP ${response.status}.`);
        if(Number(response.headers.get('content-length'))>TARGET_MAX_BYTES)throw new Error('Imagen demasiado grande.');
        const reader=response.body?.getReader();
        if(reader){
          const chunks:Uint8Array<ArrayBuffer>[]=[];let size=0;
          try{for(;;){const{value,done}=await reader.read();if(done)break;signal.throwIfAborted();size+=value.byteLength;
            if(size>TARGET_MAX_BYTES)throw new Error('Imagen demasiado grande.');chunks.push(new Uint8Array(value));}}
          catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
          image=new Blob(chunks);
        }else image=await response.blob();
      }
      signal.throwIfAborted();this.status('compiling-target');
      const compileOptions={...options,physicalWidthMeters,opencvURL:this.runtimeURL()};
      const result=await compileWithMarkerCache(image,compileOptions,signal,async()=>{
        const compiler=new MarkerCompiler();
        const cancel=()=>compiler.dispose();
        signal.addEventListener('abort',cancel,{once:true});
        try{return await compiler.compile(image,compileOptions,signal);}
        finally{signal.removeEventListener('abort',cancel);compiler.dispose();}
      });
      if(result.cacheHit)this.status('target-cache-hit');
      const marker=decodeMarker(result.buffer);
      const metadata:ImageTargetMetadata={format:'WART',version:2,width:marker.width,height:marker.height,
        physicalWidthMeters:marker.physicalWidthMeters,extractorId:marker.extractorId,quality:result.quality};
      await this.installTarget(result.buffer,signal,id,additive,diameter);
      return{buffer:result.buffer,metadata};
    });
  }

  private async installTarget(data:ArrayBuffer,signal:AbortSignal,id='default',additive=false,cylinderDiameterMeters?:number):Promise<void>{
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id))throw new Error('ID de marcador invalido.');
    const sources=new Map(additive?this.targetSources:[]);
    sources.set(id,{buffer:data.slice(0),...(cylinderDiameterMeters!==undefined?{cylinderDiameterMeters}:{})});
    if(sources.size>8)throw new Error('Maximo 8 marcadores por motor.');
    signal.throwIfAborted();const next=this.createTracker();
    try{await next.loadTargets(this.trackingSources(sources),signal);signal.throwIfAborted();}
    catch(error){next.dispose();throw error;}
    if(!additive){for(const key of this.presentations.keys())this.endPresentation(key,'removed');this.presentations.clear();this.observations.clear();}
    else if(this.presentations.has(id)){this.endPresentation(id,'removed');this.observations.delete(id);}
    this.presentations.set(id,new TargetPresentation(id,{keep:this.keepContentOnLost,
      ...(this.options.imageLossGraceMs!==undefined?{graceMs:this.options.imageLossGraceMs}:{}),
      ...(this.options.imageSmoothingMs!==undefined?{smoothingMs:this.options.imageSmoothingMs}:{})}));
    this.targetSources.clear();sources.forEach((buffer,key)=>this.targetSources.set(key,buffer));
    this.tracker?.dispose();this.tracker=next;this.activeTargetId=id;this.targetData=this.targetSources.get(id)!.buffer;this.imageReference=null;
    this.mode='image';this.currentState=EngineState.TrackingImage;this.status('target-loaded');
  }
  async removeTarget(id:string):Promise<void>{return this.operation(async signal=>{
    if(this.mode==='flow'||this.mode==='xr')throw new Error('Detener superficies antes de quitar marcadores.');
    if(!this.targetSources.has(id))return;
    const remaining=[...this.targetSources].filter(([key])=>key!==id);let next:Tracker|null=null;
    if(remaining.length){next=this.createTracker();try{await next.loadTargets(this.trackingSources(remaining),signal);signal.throwIfAborted();}catch(error){next.dispose();throw error;}}
    this.endPresentation(id,'removed');this.presentations.delete(id);this.targetSources.delete(id);this.observations.delete(id);
    this.tracker?.dispose();this.tracker=next;this.activeTargetId=remaining[0]?.[0]??'default';this.targetData=remaining[0]?.[1].buffer??null;this.imageReference=null;
    if(!remaining.length){this.mode='camera';this.currentState=this.camera.state==='running'?EngineState.Camera:EngineState.Idle;}
  });}

  /** Llamar desde un clic. preserve exige una observación reciente y una alineación verificable. */
  async enableSLAM(options:SurfaceTransitionOptions={}):Promise<SurfaceTransitionResult>{
    return this.operation(async signal=>{
      if(this.mode==='xr'||this.mode==='flow')throw new Error('Superficies ya habilitadas.');
      if(options.targetId&&!this.targetSources.has(options.targetId))throw new Error('Marcador desconocido.');
      this.activeTargetId=options.targetId??this.activeTargetId;this.targetData=this.targetSources.get(this.activeTargetId)?.buffer??this.targetData;this.imageReference=this.observations.get(this.activeTargetId)??null;
      const previousMode=this.mode,hadCamera=this.currentState!==EngineState.Idle;
      const placement=options.placement??'auto',backend=options.backend??'auto';
      if(!['auto','preserve','hit-test'].includes(placement)||!['auto','webxr','optical-flow'].includes(backend))throw new Error('Backend o colocación desconocidos.');
      const timeout=options.initializationTimeoutMs??12_000;
      if(!Number.isFinite(timeout)||timeout<=0||timeout>120_000)throw new Error('Timeout de inicialización inválido.');
      let seed=this.imageReference&&performance.now()-this.imageReference.timestampMs<750?this.imageReference:null;
      if(placement==='preserve'&&!seed)throw new Error('Se necesita un marcador visible y una pose reciente para conservar la posición.');
      // requestSession debe ejecutarse dentro del gesto. El resultado de la sesión es la comprobación definitiva.
      signal.throwIfAborted();
      let nativeFailure:unknown=null;
      try {
        if(backend!=='optical-flow'&&navigator.xr&&this.options.attachXRSession){
          try{return await this.startNative(seed,placement,timeout,signal);}
          catch(error){
            await this.xr?.stop();this.xr=null;this.alignmentTracker?.dispose();this.alignmentTracker=null;
            signal.throwIfAborted();
            if(error instanceof DOMException&&['NotAllowedError','SecurityError','AbortError'].includes(error.name)){
              this.mode='camera';this.currentState=EngineState.Idle;throw error;
            }
            nativeFailure=error;this.mode=previousMode;
            if(backend==='webxr')throw error;
            this.status('webxr-failed-using-fallback');
            // Se pudo mover el dispositivo mientras abría XR: obtener un frame nuevo.
            if(placement==='preserve'&&seed&&performance.now()-seed.timestampMs>750){
              await this.restoreCamera('image',signal);this.imageReference=null;
              const waiter=deferred();this.referenceWaiter=waiter;
              try{await this.wait(waiter.promise,signal,timeout);seed=this.imageReference;}
              finally{if(this.referenceWaiter===waiter)this.referenceWaiter=null;}
            }
          }
        }else if(backend==='webxr')throw new Error('WebXR no está disponible o falta attachXRSession.');
        if(this.options.fallback===false)throw nativeFailure??new Error('Fallback deshabilitado.');
        if(placement==='preserve'&&(!seed||performance.now()-seed.timestampMs>=750))
          throw new Error('Se necesita volver a detectar el marcador para conservar la posición.');
        const useSeed=placement!=='hit-test'&&seed&&performance.now()-seed.timestampMs<750?seed:null;
        let result:SurfaceTransitionResult;
        try{result=await this.startFlow(useSeed,timeout,signal);}
        catch(error){
          if(!useSeed||placement!=='auto'||!this.readiness||signal.aborted||
            (error instanceof DOMException&&['NotAllowedError','SecurityError','AbortError'].includes(error.name)))throw error;
          this.readiness=null;this.flow?.stop();this.flow=null;
          this.camera.setAdaptiveResolution(true);
          this.status('alignment-unavailable-scan-floor');
          result=await this.startFlow(null,timeout,signal);
        }
        this.tracker?.dispose();this.tracker=null;
        return result;
      }catch(error){
        this.readiness=null;this.flow?.stop();this.flow=null;this.preservingFlow=false;this.camera.setAdaptiveResolution(true);
        if(!signal.aborted&&!(error instanceof DOMException&&['NotAllowedError','SecurityError','AbortError'].includes(error.name))){
          this.mode=previousMode;
          if(hadCamera)await this.restoreCamera(previousMode,signal);
          else{this.camera.stop();this.mode='camera';this.currentState=EngineState.Idle;}
        }
        throw error;
      }
    });
  }

  private async startFlow(seed:ImageObservation|null,timeout:number,signal:AbortSignal):Promise<SurfaceTransitionResult>{
    const video=this.videoElement,calibrated=this.calibration;
    if(!seed&&!calibrated&&this.options.tracker?.allowEstimatedCalibration===false)throw new Error('Se requiere calibración para la odometría.');
    const cameraWasRunning=this.camera.state==='running'||this.camera.state==='paused';
    signal.throwIfAborted();
    await this.releasing;signal.throwIfAborted();
    await this.camera.start();signal.throwIfAborted();
    if(!cameraWasRunning)this.status('camera-ready');
    // play() exposes the actual capture dimensions, which may be portrait on mobile.
    const intrinsics=seed?.intrinsics??calibrated??estimateIntrinsics(video.videoWidth,video.videoHeight);
    this.flowProjectionSource=seed?.projectionSource??(calibrated?'calibrated':'estimated');
    const flow=new OpticalFlowSLAM({intrinsics,floorROI:{x:0,y:.35,width:1,height:.65},...(this.options.fallback||{}),
      ...(this.options.keyframeCorrection!==undefined?{keyframeCorrection:this.options.keyframeCorrection}:{}),
      opencvURL:this.runtimeURL(),...(seed?{seed}:{})});
    this.flow=flow;
    await flow.start(signal);signal.throwIfAborted();
    for(const id of this.presentations.keys())if(id!==this.activeTargetId||!seed)this.endPresentation(id,'stopped');
    this.options.experimentalMetricScale?.resetMap();
    this.mode='flow';this.flowAnchor=seed?identity():null;this.mapId=null;
    this.scanHint=null;this.preservingFlow=!!seed;if(seed)this.camera.setAnalysisWidth(seed.width);
    this.camera.setAdaptiveResolution(false);this.cameraFilter.reset();
    this.currentState=EngineState.TrackingSurface;
    const ready=seed?deferred():null;this.readiness=ready;
    this.status(seed?'initializing-environment':'scan-floor');
    if(ready)await this.wait(ready.promise,signal,timeout);
    signal.throwIfAborted();this.readiness=null;
    return{backend:'optical-flow',placement:seed?'preserved':'scan-floor'};
  }

  stop():Promise<void> {
    this.options.experimentalMetricScale?.stop();
    if(this.currentState===EngineState.Disposed)return this.releasing;
    const abort=new DOMException('Operación cancelada.','AbortError');
    this.readiness?.reject(abort);this.alignment?.reject(abort);this.referenceWaiter?.reject(abort);
    this.readiness=null;this.alignment=null;this.referenceWaiter=null;
    this.controller.abort();this.controller=new AbortController();this.camera.stop();
    const nativeClosing=this.xr?.stop()??Promise.resolve(),operation=this.activeOperation;
    this.releasing=Promise.all([nativeClosing,operation?.catch(()=>{})]).then(()=>{});
    this.flow?.stop();this.tracker?.dispose();this.alignmentTracker?.dispose();
    this.xr=null;this.flow=null;this.tracker=null;this.alignmentTracker=null;
    this.mode='camera';this.flowAnchor=null;this.mapId=null;this.targetData=null;this.imageReference=null;
    this.preservingFlow=false;
    for(const id of this.presentations.keys())this.endPresentation(id,'stopped');this.presentations.clear();this.targetSources.clear();this.observations.clear();
    this.presentations.forEach(target=>target.resetSmoothing());this.cameraFilter.reset();this.camera.setTrackingFeedback([]);this.camera.setAdaptiveResolution(true);
    this.currentState=EngineState.Idle;this.status('stopped');
    return this.releasing;
  }
  dispose():void{if(this.currentState===EngineState.Disposed)return;this.stop();this.camera.dispose();this.currentState=EngineState.Disposed;
    Object.values(this.eventHandlers).forEach(set=>set.clear());this.poses.clear();this.statuses.clear();this.errors.clear();this.surfaces.clear();this.metrics.clear();}

  private async startNative(seed:ImageObservation|null,placement:'auto'|'preserve'|'hit-test',timeout:number,signal:AbortSignal):Promise<SurfaceTransitionResult>{
    for(const id of this.presentations.keys())this.endPresentation(id,'stopped');
    this.status('starting-webxr');
    const needsImage=placement!=='hit-test'&&!!seed&&!!this.targetData;
    const rawTracker=needsImage?this.createTracker():null;this.alignmentTracker=rawTracker;
    const loading=rawTracker&&this.targetData?rawTracker.loadTarget(this.targetData.slice(0),signal):Promise.resolve();
    // loading tiene handler desde el inicio aunque la sesión XR tarde en concederse.
    void loading.catch(()=>{});
    const aligned=deferred();this.alignment=aligned;
    const xr=new SLAMManager({attachSession:this.options.attachXRSession!,
      ...(this.options.overlayRoot?{overlayRoot:this.options.overlayRoot}:{}),
      ...(this.options.getXRContext?{getGLContext:this.options.getXRContext}:{}),
      requireCameraAccess:placement==='preserve',
      onPose:pose=>this.emitPose(pose),onSurface:matrix=>this.surfaces.forEach(fn=>this.safely(()=>fn(matrix.slice()))),
      onLost:()=>this.status('tracking-lost'),
      onEnd:()=>{if(this.mode==='xr'){this.mode='camera';this.currentState=EngineState.Idle;this.status('xr-ended');}
        aligned.reject(new DOMException('Sesión XR finalizada.','AbortError'));rawTracker?.dispose();},
      onError:error=>{this.mode='camera';this.currentState=EngineState.Idle;aligned.reject(error);this.emitError(error);},
      onAlignmentUnavailable:error=>{if(placement==='preserve')aligned.reject(error);else this.status('alignment-unavailable-select-surface');},
      ...(rawTracker?{onCameraFrame:async(frame:CameraFrame,world:Float32Array,k:CameraIntrinsics,referenceEpoch:number)=>{
        if(!rawTracker.hasTarget||this.xr!==xr||xr.hasPlacement)return;
        const result=await rawTracker.processFrame(frame,signal,k);
        if(this.xr!==xr||signal.aborted||xr.referenceEpoch!==referenceEpoch||xr.hasPlacement||result?.status!=='tracked')return;
        xr.switchToSLAM(result.matrix,world);aligned.resolve();this.status('image-aligned-to-world');
      }}:{}),
    });
    this.xr=xr;
    const opening=xr.start(signal);this.camera.stop({retainDevice:true});
    await Promise.all([opening,loading]);signal.throwIfAborted();
    this.mode='xr';this.currentState=EngineState.TrackingSurface;this.tracker?.dispose();this.tracker=null;
    if(placement==='preserve'){
      try{await this.wait(aligned.promise,signal,timeout);}finally{this.alignment=null;}
      return{backend:'webxr',placement:'preserved'};
    }
    const scanning=needsImage&&xr.imageAlignmentAvailable;
    this.status(scanning?'scan-marker-in-xr':'select-surface');
    if(scanning){
      void this.wait(aligned.promise,signal,timeout).catch(()=>{
        if(this.xr===xr&&!xr.hasPlacement){rawTracker?.dispose();this.status('alignment-unavailable-select-surface');}
      }).finally(()=>{if(this.alignment===aligned)this.alignment=null;});
    }else{rawTracker?.dispose();this.alignment=null;}
    return{backend:'webxr',placement:scanning?'scan-marker':'select-surface'};
  }

  private async consume(frame:CameraFrame,signal:AbortSignal):Promise<void>{
    this.odometryTimings=undefined;
    const mode=this.mode,tracker=this.tracker,flow=this.flow;
    try{
      if(mode==='image'&&tracker){
        const batch=await tracker.processTargetsFrame(frame,signal);
        if(this.tracker!==tracker||this.mode!=='image'||signal.aborted||this.camera.state==='paused'||!batch)return;
        let anyTracked=false,anyRecovering=false;const qualities:TrackingQualityEvent[]=[];
        for(const result of batch.results){
          const id=result.targetId??'default',presentation=this.presentations.get(id);if(!presentation)continue;
          const output=presentation.update(result,batch.processingMs);qualities.push(output.quality);
          if(result.status==='tracked'){
            anyTracked=true;
            if(this.targetSources.get(id)?.cylinderDiameterMeters===undefined){
              this.observations.set(id,result.reference);
              if(id===this.activeTargetId){this.imageReference=result.reference;this.referenceWaiter?.resolve();}
            }
          }else{this.observations.delete(id);if(id===this.activeTargetId)this.imageReference=null;}
          anyRecovering ||= output.quality.state==='recovering';
          if(output.found)this.emitEvent('targetFound',output.found);
          if(output.lost)this.emitEvent('targetLost',output.lost);
          if(output.visibility)this.emitEvent('targetVisibility',output.visibility);
          this.emitEvent('trackingQuality',output.quality);
          if(output.pose)this.emitPose(output.pose,false);
        }
        this.camera.setTrackingFeedback(qualities,frame.imageData.width);
        this.status(anyTracked?'tracked':anyRecovering?'tracking-uncertain':'not-found');
      }else if(mode==='flow'&&flow){
        const result=await flow.processFrame(frame,signal);
        if(this.flow!==flow||this.mode!=='flow'||signal.aborted||this.camera.state==='paused'||!result)return;
        this.odometryTimings=result.timings;
        const metric=this.options.experimentalMetricScale;
        if(result.mapId!==this.mapId){
          metric?.resetMap();
          if(this.mapId!==null){this.flowAnchor=null;this.cameraFilter.reset();this.scanHint=null;this.status('odometry-map-reset');}
          this.mapId=result.mapId;
        }
        if(result.status!=='tracked'){
          metric?.interrupt();
          this.cameraFilter.reset();
          this.status(result.status==='lost'?'odometry-lost':'odometry-initializing');
          this.guideScan(result.scanHint??(result.status==='lost'?'return-to-map':'map-initializing'),frame.timestampMs);
          return;
        }
        if(this.readiness&&this.preservingFlow&&result.scale!=='metric'){
          this.readiness.reject(new Error('Cambió la captura al inicializar el mapa; volver a escanear el marcador.'));return;
        }
        if(this.readiness&&result.environmentReady)this.readiness.resolve();
        if(result.relocalized)metric?.interrupt('relocalized');
        else if(result.keyframeCorrected)metric?.interrupt('keyframeCorrection');
        const factor=result.scale==='relative'&&result.environmentReady
          ?metric?.observe(frame.timestampMs,result.worldFromCamera,result.stationary)??null:null;
        if(!this.flowAnchor&&result.groundPlane)this.flowAnchor=result.groundPlane.worldFromPlane.slice();
        if(!this.flowAnchor){this.status('scan-floor');this.guideScan('plane-unverified',frame.timestampMs);return;}
        this.guideScan(this.readiness&&!result.environmentReady?'map-initializing':'surface-ready',frame.timestampMs);
        const filteredCamera=this.cameraFilter.filter(result.worldFromCamera,frame.timestampMs);
        const camera=factor===null?filteredCamera:filteredCamera.slice();
        const anchor=this.flowAnchor.slice();
        if(factor!==null)for(let axis=12;axis<15;axis++){camera[axis]=camera[axis]!*factor;anchor[axis]=anchor[axis]!*factor;}
        const view=invertRigid(camera);
        this.emitPose({backend:'optical-flow',timestampMs:frame.timestampMs,scale:factor===null?result.scale:'metric',
          ...(factor!==null?{scaleSource:'experimental-inertial' as const}:{}),
          matrix:multiply(view,anchor),worldMatrix:anchor,viewMatrix:view,projectionMatrix:result.projectionMatrix,
          projectionSource:this.flowProjectionSource,
          ...(result.groundPlane?.worldFromPlane.every((value,index)=>value===this.flowAnchor![index])
            ?{surfaceDetected:true}:{}),
          diagnostics:{processingMs:result.processingMs??0,inliers:result.trackedPoints,reprojectionErrorPx:result.reprojectionErrorPx??0,
            ...(result.relocalized!==undefined?{relocalized:result.relocalized}:{}),...(result.keyframeCorrected!==undefined?{keyframeCorrected:result.keyframeCorrected}:{})}},false);
        if(this.readiness&&!result.environmentReady)this.status('initializing-environment');
        else this.status(result.relocalized?'odometry-relocalized':'surface-tracked');
      }
    }catch(cause){
      const error=cause instanceof Error?cause:new Error(String(cause));
      if(!signal.aborted&&((mode==='image'&&this.tracker===tracker)||(mode==='flow'&&this.flow===flow))){
        if(this.readiness)this.readiness.reject(error);
        else{this.stop();this.emitError(error);}
      }
    }
  }
  private guideScan(hint:AREventMap['scanGuidance']['hint'],timestampMs:number):void{
    if(this.scanHint===hint)return;
    this.scanHint=hint;
    this.emitEvent('scanGuidance',{hint,timestampMs});
  }
  private runtimeURL():string{return this.options.opencvURL?.toString()??this.options.tracker?.opencvURL?.toString()??embeddedVisionURL()??new URL('./vision/opencv.js',document.baseURI).href;}
  private createTracker():Tracker{return new Tracker({...this.options.tracker,opencvURL:this.runtimeURL(),
    ...(this.calibration?{calibration:this.calibration}:{})});}
  private async restoreCamera(mode:'camera'|'image',signal:AbortSignal):Promise<void>{
    if(mode==='image'&&this.targetData){
      const tracker=this.createTracker();
      try{await tracker.loadTargets(this.trackingSources(this.targetSources),signal);signal.throwIfAborted();}catch(error){tracker.dispose();throw error;}
      this.tracker?.dispose();this.tracker=tracker;this.imageReference=null;this.mode='image';this.currentState=EngineState.TrackingImage;
    }else{this.mode='camera';this.currentState=EngineState.Camera;}
    this.presentations.forEach(target=>target.resetSmoothing());await this.camera.start();signal.throwIfAborted();this.status('camera-ready');
  }
  private wait(promise:Promise<void>,signal:AbortSignal,timeout:number):Promise<void>{return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(error?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
    const abort=()=>finish(new DOMException('Cancelado.','AbortError'));
    const timer=setTimeout(()=>finish(new Error('No se pudo inicializar el mapa/alineación: mantener el marcador quieto y mover la cámara sobre un entorno con textura.')),timeout);
    if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
    promise.then(()=>finish(),error=>finish(error));
  });}
  private operation<T>(action:(signal:AbortSignal)=>Promise<T>):Promise<T>{
    if(this.currentState===EngineState.Disposed)return Promise.reject(new Error('Motor eliminado.'));if(this.busy)return Promise.reject(new Error('Hay otra operación en curso.'));
    this.busy=true;const signal=this.controller.signal;
    const running=(async()=>{try{const result=await action(signal);signal.throwIfAborted();return result;}finally{this.busy=false;}})();
    this.activeOperation=running;
    const clear=()=>{if(this.activeOperation===running)this.activeOperation=null;};running.then(clear,clear);return running;
  }
  private emitPose(pose:ARPose,reportTracked=true):void{
    if(pose.backend!=='image')pose={...pose,targetId:this.activeTargetId};
    if(reportTracked)this.status('tracked');this.poses.forEach(fn=>this.safely(()=>fn(pose.matrix.slice(),{...pose,matrix:pose.matrix.slice(),
      worldMatrix:pose.worldMatrix.slice(),viewMatrix:pose.viewMatrix.slice(),projectionMatrix:pose.projectionMatrix?.slice()??null})));
  }
  private status(message:string):void{if(message===this.lastStatus)return;this.lastStatus=message;this.statuses.forEach(fn=>this.safely(()=>fn(message)));}
  private emitError(error:Error):void{if(!this.errors.size)console.error('[WebAREngine]',error);this.errors.forEach(fn=>{try{fn(error);}catch(cause){console.error(cause);}});}
  private safely(callback:()=>void):void{try{callback();}catch(cause){this.emitError(cause instanceof Error?cause:new Error(String(cause)));}}
}
