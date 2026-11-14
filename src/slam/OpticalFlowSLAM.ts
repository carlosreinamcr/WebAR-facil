/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import FlowWorker from './optical-flow.worker.ts?worker&inline';
import type { CameraFrame } from '../camera/CameraManager';
import type { OdometryConfig, OdometryEstimate,OdometryMapSnapshot,VisualReferenceResult } from './OdometryBackend';
import { WorkerRPC } from '../internal/WorkerRPC';
import {validateIntrinsics} from '../vision/calibration';

export interface OpticalFlowOptions extends OdometryConfig {
  /** Módulo ESM local que exporta createOdometryBackend; carga su propio .wasm. */
  moduleURL?: URL;
  workerFactory?: () => Worker;
}

/** Cliente del backend WASM. No simula una pose si el backend no está disponible. */
export class OpticalFlowSLAM {
  private rpc: WorkerRPC | null = null;
  private ready = false;
  private pendingFrame:Promise<unknown>|null=null;

  constructor(private readonly options: OpticalFlowOptions) {
    const k = options.intrinsics;
    if(options.keyframeCorrection!==undefined&&typeof options.keyframeCorrection!=='boolean')throw new Error('keyframeCorrection debe ser booleano.');
    validateIntrinsics(k);
    if(options.moduleURL&&!(options.moduleURL instanceof URL))throw new Error('moduleURL debe ser una URL absoluta.');
    if (![k.width, k.height, k.fx, k.fy, k.cx, k.cy].every(Number.isFinite) ||
        k.width <= 0 || k.height <= 0 || k.fx <= 0 || k.fy <= 0) throw new Error('Intrínsecos inválidos.');
    const roi = options.floorROI;
    if (![roi.x, roi.y, roi.width, roi.height].every(Number.isFinite) || roi.x < 0 || roi.y < 0 ||
        roi.width <= 0 || roi.height <= 0 || roi.x + roi.width > 1 || roi.y + roi.height > 1) {
      throw new Error('ROI normalizada inválida.');
    }
  }

  async start(signal?: AbortSignal): Promise<void> {
    if (this.rpc) throw new Error('Odometría ya iniciada.');
    const rpc = new WorkerRPC(this.options.workerFactory?.() ?? new FlowWorker());
    this.rpc = rpc;
    try {
      const seed = this.options.seed ? { ...this.options.seed, rgba: this.options.seed.rgba.slice(0) } : undefined;
      await rpc.request({ type: 'INIT', moduleURL: this.options.moduleURL?.href,
        config: { intrinsics: this.options.intrinsics, floorROI: this.options.floorROI,
          ...(this.options.opencvURL ? { opencvURL: this.options.opencvURL } : {}),
          ...(this.options.keyframeCorrection!==undefined?{keyframeCorrection:this.options.keyframeCorrection}:{}), ...(seed ? { seed } : {}) } },
        seed ? [seed.rgba] : [], signal);
      if (this.rpc !== rpc) throw new DOMException('Cancelado.', 'AbortError');
      this.ready = true;
    } catch (error) {
      // Un inicio cancelado no debe cerrar un reinicio posterior de la misma clase.
      if (this.rpc === rpc) this.stop();
      throw error;
    }
  }

  async processFrame(frame: CameraFrame, signal?: AbortSignal): Promise<OdometryEstimate | null> {
    const rpc = this.rpc;
    if (!rpc || !this.ready) throw new Error('Odometría no iniciada.');
    if (rpc.busy) return null;
    const { width, height, data } = frame.imageData;
    if (!(data instanceof Uint8ClampedArray) || !(data.buffer instanceof ArrayBuffer) ||
        data.byteOffset !== 0 || data.byteLength !== data.buffer.byteLength ||
        !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
        width * height > 4096 * 4096 || data.byteLength !== width * height * 4 ||
        !Number.isFinite(frame.timestampMs) || frame.timestampMs < 0 ||
        !Number.isSafeInteger(frame.sessionId) || frame.sessionId < 0) throw new Error('Frame inválido.');
    const pending=rpc.request({ type: 'FRAME', width, height, buffer: data.buffer,
      sessionId: frame.sessionId, timestampMs: frame.timestampMs }, [data.buffer], signal);this.pendingFrame=pending;
    try{return await pending as OdometryEstimate;}finally{if(this.pendingFrame===pending)this.pendingFrame=null;}
  }
  async checkVisualReference(action:'capture'|'verify',referenceId:string,signal?:AbortSignal):Promise<VisualReferenceResult>{
    await this.pendingFrame;
    const rpc=this.rpc;
    if(!rpc||!this.ready)throw new Error('Odometría no iniciada.');
    return await rpc.request({type:'VISUAL_REFERENCE',action,referenceId,timestampMs:performance.now()},[],signal) as VisualReferenceResult;
  }
  async exportMap(signal?:AbortSignal,includeCurrentView=false):Promise<OdometryMapSnapshot>{
    await this.pendingFrame;const rpc=this.rpc;if(!rpc||!this.ready)throw new Error('Odometría no iniciada.');
    return await rpc.request({type:'EXPORT_MAP',includeCurrentView},[],signal) as OdometryMapSnapshot;
  }
  async importMap(snapshot:OdometryMapSnapshot,signal?:AbortSignal):Promise<void>{
    await this.pendingFrame;const rpc=this.rpc;if(!rpc||!this.ready)throw new Error('Odometría no iniciada.');
    await rpc.request({type:'IMPORT_MAP',snapshot},[],signal);
  }

  stop(): void { this.ready = false; this.rpc?.dispose(); this.rpc = null; }
  dispose(): void { this.stop(); }
}
