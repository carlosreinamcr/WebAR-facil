/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {copyTrackingProfile,type ImageTrackingProfile} from './profile.ts';
import type { CameraFrame } from '../camera/CameraManager.ts';
import type { CameraIntrinsics } from '../Pose.ts';
import { decodeMarker } from './ImageCompiler.ts';
import VisionWorker from './worker.js?worker&inline';
import { WorkerRPC } from '../internal/WorkerRPC.ts';
import { embeddedVisionURL } from '../internal/EmbeddedAssets.ts';
import { ORB_EXTRACTOR_ID } from '../vision/features.ts';
import { estimateIntrinsics, scaleIntrinsics } from '../vision/calibration.ts';
import { assertRigid, assertMatrix } from '../spatial/matrices.ts';
import type { TrackingResult,TrackingBatchResult } from './types.ts';
export type { TrackingResult, ImageObservation } from './types.ts';

export interface TrackerOptions {
  opencvURL?: string | URL;
  calibration?: CameraIntrinsics;
  allowEstimatedCalibration?: boolean;
  timeoutMs?: number;
  workerFactory?:()=>Worker;
}

export class Tracker {
  private readonly rpc: WorkerRPC;
  private readonly opencvURL: string;
  private profile:ImageTrackingProfile|null=null;
  get latestProfile():ImageTrackingProfile|null{return copyTrackingProfile(this.profile);}
  private loaded = false;
  private ids:string[]=[];
  private closed = false;
  constructor(private readonly options: TrackerOptions = {}) {
    const timeout = options.timeoutMs ?? 30_000;
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647) throw new Error('Timeout inválido.');
    this.opencvURL = options.opencvURL?.toString() ?? embeddedVisionURL() ?? new URL('./vision/opencv.js', document.baseURI).href;
    this.rpc = new WorkerRPC(options.workerFactory?.()??new VisionWorker(), timeout);
  }
  get state(): 'idle' | 'busy' | 'disposed' { return this.closed ? 'disposed' : this.rpc.busy ? 'busy' : 'idle'; }
  get hasTarget(): boolean { return this.loaded; }
  async loadTarget(buffer: ArrayBuffer, signal?: AbortSignal,targetId='default'): Promise<void> {
    this.assertOpen();
    this.profile=null;
    const marker = decodeMarker(buffer);
    if (marker.simulated) throw new Error('Marcador simulado. Compilar una imagen real.');
    if (marker.extractorId !== ORB_EXTRACTOR_ID) throw new Error('Extractor incompatible con este runtime ORB.');
    await this.rpc.request({ type: 'LOAD_TARGET', targetId,buffer, opencvURL: this.opencvURL }, [buffer], signal);
    this.assertOpen(); this.loaded = true;this.ids=[targetId];
  }
  get targetIds():readonly string[]{return [...this.ids];}
  async loadTargets(targets:readonly {id:string;buffer:ArrayBuffer}[],signal?:AbortSignal):Promise<void>{
    if(!targets.length||targets.length>8||new Set(targets.map(t=>t.id)).size!==targets.length||targets.some(t=>!/^[a-zA-Z0-9_-]{1,64}$/.test(t.id)))throw new Error('Usar entre 1 y 8 IDs unicos de marcador.');
    for(const[index,target]of targets.entries()){
      if(index===0){await this.loadTarget(target.buffer,signal,target.id);continue;}
      const marker=decodeMarker(target.buffer);
      if(marker.simulated||marker.extractorId!==ORB_EXTRACTOR_ID)throw new Error('Marcador incompatible.');
      await this.rpc.request({type:'ADD_TARGET',targetId:target.id,buffer:target.buffer,opencvURL:this.opencvURL},[target.buffer],signal);
      this.ids.push(target.id);
    }
  }
  processFrame(frame:CameraFrame,signal?:AbortSignal,calibrationOverride?:CameraIntrinsics):Promise<TrackingResult|null>{
    return this.process(frame,signal,calibrationOverride,false) as Promise<TrackingResult|null>;
  }
  /** Un RGBA y un Worker para todos los marcadores. No duplicar el frame por target. */
  processTargetsFrame(frame:CameraFrame,signal?:AbortSignal):Promise<TrackingBatchResult|null>{
    return this.process(frame,signal,undefined,true) as Promise<TrackingBatchResult|null>;
  }
  /** Transferir propiedad del RGBA; null significa frame descartado por backpressure. */
  private async process(frame: CameraFrame, signal: AbortSignal|undefined, calibrationOverride: CameraIntrinsics|undefined,batch:boolean): Promise<TrackingResult|TrackingBatchResult|null> {
    this.assertOpen(); signal?.throwIfAborted();this.profile=null;
    if (this.rpc.busy) return null;
    const { data, width, height } = frame.imageData;
    if (!(data instanceof Uint8ClampedArray) || !(data.buffer instanceof ArrayBuffer) || data.byteOffset !== 0 ||
        data.byteLength !== data.buffer.byteLength || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < 1 || height < 1 || width * height > 4096 * 4096 || data.length !== width * height * 4 ||
        !Number.isSafeInteger(frame.sessionId) || frame.sessionId < 0 || !Number.isFinite(frame.timestampMs) || frame.timestampMs < 0) {
      throw new Error('Frame RGBA inválido.');
    }
    if (!this.loaded&&batch)return{results:[],processingMs:0};
    if (!this.loaded) return { status: 'not-found', matrix: null, sessionId: frame.sessionId, timestampMs: frame.timestampMs, processingMs: 0 };
    const source = calibrationOverride ?? this.options.calibration;
    if (!source && this.options.allowEstimatedCalibration === false) throw new Error('Se requiere calibración de cámara.');
    const intrinsics = source ? scaleIntrinsics(source, width, height) : estimateIntrinsics(width, height);
    const sent=performance.now();
    const result = await this.rpc.request({ type: batch?'FRAME_BATCH':'FRAME', buffer: data.buffer, width, height,
      sessionId: frame.sessionId, timestampMs: frame.timestampMs, intrinsics,
      projectionSource: source ? 'calibrated' : 'estimated' }, [data.buffer], signal) as TrackingResult|TrackingBatchResult;
    if(!result||typeof result!=='object')throw new Error('Resultado NFT inválido.');
    const profile=copyTrackingProfile(result.profile);
    if(result.profile&&!profile)throw new Error('Perfil NFT inválido.');
    if(profile){profile.timings.roundTripMs=performance.now()-sent;profile.timings.transportAndSchedulingMs=Math.max(0,profile.timings.roundTripMs-profile.timings.workerMs);}
    this.profile=profile;if(profile)result.profile=copyTrackingProfile(profile)!;
    if(batch&&(!('results'in result)||!Array.isArray(result.results)||!Number.isFinite(result.processingMs)||
      result.results.length!==this.ids.length||new Set(result.results.map(item=>item.targetId)).size!==this.ids.length||result.results.some(item=>!this.ids.includes(item.targetId??''))))throw new Error('Batch inválido.');
    const results='results'in result?result.results:[result];
    for(const result of results){
    if (!result || result.sessionId !== frame.sessionId || result.timestampMs !== frame.timestampMs ||
        !Number.isFinite(result.processingMs)) throw new Error('Resultado NFT inválido.');
    if (result.status === 'tracked') {
      assertRigid(result.matrix); assertMatrix(result.projectionMatrix);
      if (result.inliers < 10 || !Number.isFinite(result.reprojectionErrorPx)) throw new Error('Pose NFT sin evidencia suficiente.');
    } else if (result.status !== 'not-found' || result.matrix !== null) throw new Error('Estado NFT inválido.');
    }
    return result;
  }
  dispose(): void { if (this.closed) return; this.closed = true; this.loaded = false;this.profile=null; this.rpc.dispose(); }
  private assertOpen(): void { if (this.closed) throw new Error('Tracker cerrado.'); }
}
