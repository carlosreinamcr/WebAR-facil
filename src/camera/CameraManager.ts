/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {ImageTrackingProfile} from '../tracking/profile.ts';
import type {TrackingQualityEvent} from '../tracking/events';
import {cameraProfile} from './performance';
export interface CameraFrame {
  /** RGBA; el consumidor puede transferir imageData.data.buffer al Worker. */
  imageData: ImageData;
  /** Tiempo de extracción, en el reloj performance.now(); no es tiempo del sensor. */
  timestampMs: number;
  mediaTimeSeconds: number;
  sessionId: number;
  sourceWidth: number;
  sourceHeight: number;
}

export interface CameraManagerOptions {
  /** Resolver al terminar de procesar el frame, no solamente al enviarlo. */
  onFrame: (frame: CameraFrame, signal: AbortSignal) => void | Promise<void>;
  onError?: (error: Error) => void;
  /** Etapas reales de apertura; no confundir permiso concedido con vídeo reproduciéndose. */
  onStatus?: (status: 'camera-requesting' | 'camera-granted' | 'camera-playing') => void;
  /** Visor opcional para montar el vídeo debajo del renderer durante la captura. */
  playbackContainer?: HTMLElement;
  /** Presupuesto inicial; las opciones explícitas tienen prioridad. */
  performance?: 'auto' | 'balanced' | 'battery' | 'quality';
  width?: number;
  height?: number;
  /** Preferencia, no requisito: permite webcams sin cámara trasera. */
  facingMode?: 'environment' | 'user';
  /** Selección explícita; tiene prioridad sobre facingMode. */
  deviceId?: string;
  /** Objetivo de captura, hasta 60; limitado por cámara, pantalla y CPU. */
  fps?: number;
  /** Limita el coste de lectura RGBA conservando la relación de aspecto. */
  maxFrameWidth?: number;
  /** Límite de píxeles analizados en cualquier orientación; no recorta la imagen. */
  maxFramePixels?: number;
  focusMode?: 'continuous' | 'manual' | 'none';
  focusDistance?: number;
  adaptive?: boolean;
  minFrameWidth?: number;
  onMetrics?: (metrics: CameraMetrics) => void;
  onSuspend?: () => void;
  onResume?: () => void;
}

export interface CameraMetrics {
  tracking?:ImageTrackingProfile;
  odometry?:import('../slam/OdometryBackend').OdometryTimings;
  consumerMs?:number;
  processedFrames: number; skippedFrames: number; readbackMs: number;
  processingMs: number; averageProcessingMs: number; analysisWidth: number; targetAnalysisFPS: number;
  analysisHeight?:number;
  performance?:CameraManagerOptions['performance'];
}

interface CaptureSession {
  id: number;
  controller: AbortController;
  ready: Promise<void> | null;
  stream: MediaStream | null;
  raf: number | null;
  busy: boolean;
  lastCapture: number;
  lastMediaTime: number;
  paused: boolean;
  started: boolean;
}

/** Webcam o cámara móvil. Usar con HTTPS o localhost. */
export class CameraManager {
  private readonly video: HTMLVideoElement;
  private playbackHost: {element:HTMLDivElement; videoStyle:string; restorePosition?:()=>void} | null = null;
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement;
  private readonly context:
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D;
  private readonly options: CameraManagerOptions & Required<Pick<CameraManagerOptions,'width'|'height'|'fps'|'maxFrameWidth'|'maxFramePixels'>>;
  private session: CaptureSession | null = null;
  private selectedDeviceId: string | undefined;
  private sequence = 0;
  private disposed = false;
  private analysisWidth: number;
  private analysisFPS: number;
  private analysisPixels: number;
  private averageReadbackMs=0;
  private needsDetail=false;
  private hasTrackingFeedback=false;
  private seesTarget=false;
  private lastDetailProbe=-Infinity;
  private detailProbeBudget:number|null=null;
  private adaptiveResolution = true;
  private preserveDetail=false;
  private motionPriority=false;
  private detailFloor=0;
  private processed = 0;
  private skipped = 0;
  private averageProcessingMs = 0;
  private pinnedWidth=false;
  private adaptationAt=0;
  private adaptationSamples=0;

  constructor(options: CameraManagerOptions) {
    const preset=cameraProfile(options.performance);
    this.options = {
      ...options,
      width: options.width ?? preset.width,
      height: options.height ?? preset.height,
      fps: options.fps ?? preset.fps,
      maxFrameWidth: options.maxFrameWidth ?? preset.maxFrameWidth,
      maxFramePixels:options.maxFramePixels??preset.maxFramePixels,
    };
    this.analysisWidth=this.options.maxFrameWidth;this.analysisFPS=this.options.fps;
    this.analysisPixels=this.usesAutoBudget
      ? Math.min(this.options.maxFramePixels,172800) : this.options.maxFramePixels;
    if(options.minFrameWidth!==undefined&&(!Number.isInteger(options.minFrameWidth)||options.minFrameWidth<64||options.minFrameWidth>this.analysisWidth)) {
      throw new Error('minFrameWidth inválido.');
    }

    for (const key of ['width', 'height', 'maxFrameWidth'] as const) {
      const value = this.options[key];
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError(`${key} debe ser un entero positivo.`);
      }
    }
    if(!Number.isSafeInteger(this.options.maxFramePixels)||this.options.maxFramePixels<4096||this.options.maxFramePixels>4096*4096)throw new RangeError('maxFramePixels debe estar entre 4096 y 16777216.');
    if (!Number.isFinite(this.options.fps) || this.options.fps <= 0 ||
        this.options.fps > 60) {
      throw new RangeError('fps debe estar entre 0 (excluido) y 60.');
    }
    if (typeof options.onFrame !== 'function') {
      throw new TypeError('onFrame es obligatorio.');
    }

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('muted', '');

    // El canvas nunca se inserta en el DOM. Fallback para motores sin 2D offscreen.
    const offscreen = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(1, 1)
      : null;
    const offscreenContext = offscreen?.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    });
    if (offscreen && offscreenContext) {
      this.canvas = offscreen;
      this.context = offscreenContext;
    } else {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {
        alpha: false,
        willReadFrequently: true,
      });
      if (!context) throw new Error('Canvas 2D no está disponible.');
      this.canvas = canvas;
      this.context = context;
    }
    document.addEventListener('visibilitychange',this.visibility);
  }

  get state(): 'idle' | 'starting' | 'running' | 'paused' | 'disposed' {
    if (this.disposed) return 'disposed';
    if (!this.session) return 'idle';
    return this.session.paused ? 'paused' : this.session.started ? 'running' : 'starting';
  }

  /** Vista previa del stream; la propiedad srcObject pertenece al gestor. */
  get videoElement(): HTMLVideoElement { return this.video; }
  get settings(): MediaTrackSettings | null { return this.session?.stream?.getVideoTracks()[0]?.getSettings() ?? null; }
  private get usesAutoBudget():boolean {
    return (this.options.performance??'auto')==='auto'&&this.options.adaptive!==false;
  }
  /** Fijar resolución durante VO: cambiarla invalidaría el mapa. La frecuencia sí se adapta. */
  setAdaptiveResolution(enabled:boolean):void{
    this.adaptiveResolution=enabled;
    if(this.detailProbeBudget!==null){this.analysisPixels=this.detailProbeBudget;this.detailProbeBudget=null;}
    if(enabled)this.pinnedWidth=false;
  }
  /** Priorizar detalle si bajar resolución puede hacer perder el marcador. */
  setTrackingFeedback(qualities:readonly TrackingQualityEvent[],frameWidth=this.analysisWidth):void{
    this.hasTrackingFeedback=qualities.length>0;
    const visible=qualities.filter(q=>q.state==='tracking'&&q.targetSizePx>0);
    this.seesTarget=visible.length>0;
    this.needsDetail=visible.some(q=>q.targetSizePx<150);
    this.preserveDetail=visible.some(q=>q.targetSizePx<150||q.inliers<30||q.issues.includes('blur'))||
      qualities.some(q=>q.state==='recovering');
    this.motionPriority=qualities.some(q=>q.issues.includes('high-motion'));
    // Histeresis: no oscilar alrededor del tamaño mínimo útil del marcador.
    const observed=qualities.filter(q=>q.state==='tracking'&&q.targetSizePx>0);
    this.detailFloor=observed.length?Math.min(this.options.maxFrameWidth,Math.ceil(Math.max(...observed.map(q=>frameWidth*160/q.targetSizePx)))):0;
    if(!this.usesAutoBudget&&this.preserveDetail&&this.adaptiveResolution&&this.options.adaptive!==false)
      this.analysisWidth=Math.min(this.options.maxFrameWidth,Math.ceil(this.analysisWidth*1.15));
  }
  /** Ancho explícito para semillas/mapas: prima sobre el presupuesto de píxeles. */
  setAnalysisWidth(width:number):void{
    if(!Number.isInteger(width)||width<1||width>this.options.maxFrameWidth)throw new Error('Ancho de análisis inválido.');
    this.analysisWidth=width;this.pinnedWidth=true;
  }

  async setFocus(mode:'continuous'|'manual',distance?:number):Promise<boolean> {
    const track=this.session?.stream?.getVideoTracks()[0];if(!track)throw new Error('Cámara no iniciada.');
    const capabilities=track.getCapabilities() as MediaTrackCapabilities & {focusMode?:string[];focusDistance?:{min:number;max:number}};
    if(!capabilities.focusMode?.includes(mode))return false;
    const constraints:MediaTrackConstraintSet & {focusMode:string;focusDistance?:number}={focusMode:mode};
    if(mode==='manual'&&distance!==undefined){
      const range=capabilities.focusDistance;
      if(!Number.isFinite(distance)||!range||distance<range.min||distance>range.max)throw new RangeError('Distancia de enfoque fuera de rango.');
      constraints.focusDistance=distance;
    }
    await track.applyConstraints({advanced:[constraints]});return true;
  }

  /** Idempotente durante una sesión. Los errores de arranque rechazan la promesa. */
  start(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('CameraManager eliminado.'));
    if (this.session?.ready) return this.session.ready;
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      return Promise.reject(new Error('La cámara requiere HTTPS o localhost y getUserMedia.'));
    }

    const session: CaptureSession = {
      id: ++this.sequence,
      controller: new AbortController(),
      ready: null,
      stream: null,
      raf: null,
      busy: false,
      lastCapture: -Infinity,
      lastMediaTime: -1,
      paused: false,
      started: false,
    };
    this.session = session;
    this.adaptationAt=performance.now();this.adaptationSamples=0;
    this.lastDetailProbe=this.adaptationAt;
    this.averageProcessingMs=0;this.averageReadbackMs=0;
    session.ready = this.open(session);
    return session.ready;
  }

  /** Cancela y libera la captura. retainDevice conserva la entrada para una transición interna. */
  stop({retainDevice=false}:{retainDevice?:boolean}={}): void {
    if(!retainDevice)this.selectedDeviceId=undefined;
    const session = this.session;
    if (!session) return;
    this.session = null;
    session.controller.abort();
    if (session.raf !== null) cancelAnimationFrame(session.raf);
    session.raf = null;
    this.video.pause();
    this.video.srcObject = null;
    if (this.playbackHost) {
      this.playbackHost.element.remove();
      this.video.style.cssText = this.playbackHost.videoStyle;
      this.playbackHost.restorePosition?.();
      this.playbackHost = null;
    }
    session.stream?.getTracks().forEach(track => track.stop());
    session.stream = null;
    // Libera el backing store; un ImageData ya entregado es independiente.
    this.canvas.width = this.canvas.height = 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    document.removeEventListener('visibilitychange',this.visibility);
    this.video.remove();
  }

  private async open(session: CaptureSession): Promise<void> {
    const signal = session.controller.signal;
    try {
      this.notify('camera-requesting');
      // Tras una transición interna, pedir exactamente la entrada ya negociada.
      const deviceId=this.options.deviceId||this.selectedDeviceId;
      // Una webcam de escritorio puede no anunciar facingMode.
      const pendingStream = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } :
            navigator.mediaDevices.getSupportedConstraints().facingMode ?
              { facingMode: { ideal: this.options.facingMode ?? 'environment' } } : {}),
          width: { ideal: this.options.width },
          height: { ideal: this.options.height },
          frameRate: { ideal: this.options.fps, max: 60 },
        },
      }).then(stream => {
        // getUserMedia no acepta AbortSignal; cerrar una concesión tardía es obligatorio.
        if (signal.aborted) {
          stream.getTracks().forEach(track => track.stop());
          throw new DOMException('Inicio cancelado.', 'AbortError');
        }
        // Registrar propiedad antes de resolver: stop() puede adelantarse al await.
        session.stream = stream;
        return stream;
      });
      const stream = await this.abortable(pendingStream, signal);
      // stop() puede ejecutarse entre resolver getUserMedia y esta continuación.
      if (signal.aborted) {
        stream.getTracks().forEach(track => track.stop());
        throw new DOMException('Inicio cancelado.', 'AbortError');
      }
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState !== 'live') {
        throw new Error('La cámara no devolvió un track de vídeo activo.');
      }
      this.selectedDeviceId=track.getSettings().deviceId||deviceId;
      this.notify('camera-granted');
      track.addEventListener('ended', () => {
        if (this.session !== session) return;
        this.stop();
        this.report(new Error('El dispositivo interrumpió la cámara.'));
      }, { once: true, signal });
      this.video.srcObject = stream;
      this.notify('camera-playing');
      if (!this.video.isConnected && document.body) {
        // Keep the camera in the visible viewport on mobile, underneath the AR renderer.
        const container=this.options.playbackContainer;
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = container
          ? 'position:absolute;inset:0;pointer-events:none;overflow:hidden'
          : 'position:fixed;inset:0;opacity:0;pointer-events:none;overflow:hidden';
        this.playbackHost = {element:host, videoStyle:this.video.style.cssText};
        if(container&&getComputedStyle(container).position==='static'){
          const previous=container.style.position;
          container.style.position='relative';
          this.playbackHost.restorePosition=()=>{if(container.style.position==='relative')container.style.position=previous;};
        }
        this.video.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
        host.append(this.video);
        (container??document.body).prepend(host);
      }
      await this.abortable(this.video.play(), signal,15_000,'El permiso de cámara fue concedido, pero el navegador no inició el vídeo. Pulsa Detener e intenta iniciar de nuevo.');
      signal.throwIfAborted();
      // El enfoque es una mejora opcional, no una condición para arrancar vídeo.
      // Algunos controladores dejan applyConstraints pendiente indefinidamente.
      if(this.options.focusMode!=='none'&&typeof track.getCapabilities==='function') {
        const focus=this.setFocus(this.options.focusMode??'continuous',this.options.focusDistance);
        if(this.options.focusMode==='manual')await this.abortable(focus,signal,8_000,'La cámara no terminó de configurar el enfoque manual.');
        else void focus.catch(()=>{});
        signal.throwIfAborted();
      }
      session.started=true;
      session.raf = requestAnimationFrame(time => this.tick(session, time));
      this.visibility();
    } catch (error) {
      if (this.session === session) this.stop({retainDevice:true});
      throw error;
    }
  }

  private tick(session: CaptureSession, timestampMs: number): void {
    if (this.session !== session||session.paused) return;
    session.raf = requestAnimationFrame(time => this.tick(session, time));

    // No duplicar frames, acumular promesas ni capturar mientras el consumidor trabaja.
    const mediaTime = this.video.currentTime;
    const interval = 1000 / this.analysisFPS;
    if (session.busy || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        mediaTime === session.lastMediaTime ||
        timestampMs - session.lastCapture < interval - 0.5) {this.skipped++;return;}

    const sourceWidth = this.video.videoWidth;
    const sourceHeight = this.video.videoHeight;
    if (!sourceWidth || !sourceHeight) return;

    const pixelRatio=this.pinnedWidth?1:Math.sqrt(this.analysisPixels/(sourceWidth*sourceHeight));
    const minimumRatio=this.usesAutoBudget&&this.options.minFrameWidth!==undefined
      ? Math.min(this.options.minFrameWidth/sourceWidth,Math.sqrt(this.options.maxFramePixels/(sourceWidth*sourceHeight))) : 0;
    const ratio = Math.min(1, this.analysisWidth / sourceWidth,Math.max(minimumRatio,pixelRatio));
    // Derivar alto del ancho final conserva el mismo tamaño al restaurar una semilla.
    const width = Math.max(1, Math.floor(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * width/sourceWidth));
    session.busy = true;
    const started=performance.now();

    try {
      // Redimensionar solo cuando cambian las dimensiones reales del vídeo.
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.context.drawImage(this.video, 0, 0, width, height);
      const imageData = this.context.getImageData(0, 0, width, height);
      const readbackMs=performance.now()-started;
      session.lastCapture = timestampMs;
      session.lastMediaTime = mediaTime;

      // ImageData posee su buffer: transferirlo no afecta al siguiente frame.
      const processing = this.options.onFrame({
        imageData,
        timestampMs: started,
        mediaTimeSeconds: mediaTime,
        sessionId: session.id,
        sourceWidth,
        sourceHeight,
      }, session.controller.signal);

      void Promise.resolve(processing)
        .catch(error => {
          if (this.session === session) this.report(error);
        })
        .finally(() => {
          session.busy = false;
          if(this.session!==session)return;
          const processingMs=performance.now()-started;this.processed++;
          this.averageProcessingMs=this.averageProcessingMs*.9+processingMs*.1;
          this.averageReadbackMs=this.averageReadbackMs*.9+readbackMs*.1;
          this.adaptationSamples++;
          // Ventana temporal y varias muestras: no reaccionar a un único frame caro
          // ni esperar 20 frames (varios segundos) en un dispositivo lento.
          if(this.options.adaptive!==false&&this.adaptationSamples>=8&&performance.now()-this.adaptationAt>=1500){
            this.adaptationAt=performance.now();this.adaptationSamples=0;
            this.analysisFPS=Math.min(this.options.fps,Math.max(this.motionPriority?20:10,1000/Math.max(16,this.averageProcessingMs*1.15)));
            if(this.adaptiveResolution&&!this.pinnedWidth&&this.usesAutoBudget){
              const busy=this.averageReadbackMs>22||this.averageProcessingMs>85;
              const headroom=this.hasTrackingFeedback&&this.averageReadbackMs<10&&this.averageProcessingMs<38;
              const minWidth=this.options.minFrameWidth??Math.min(240,this.options.maxFrameWidth);
              const floor=Math.max(minWidth,this.detailFloor);
              const minimumPixels=Math.min(this.options.maxFramePixels,Math.ceil(floor*floor*sourceHeight/sourceWidth));
              if(this.seesTarget||this.preserveDetail)this.detailProbeBudget=null;
              if(this.needsDetail||headroom){
                this.detailProbeBudget=null;
                this.analysisPixels=Math.min(this.options.maxFramePixels,Math.ceil(this.analysisPixels*1.2));
              }else if(this.detailProbeBudget!==null){
                this.analysisPixels=this.detailProbeBudget;this.detailProbeBudget=null;
              }else if(this.hasTrackingFeedback&&!this.seesTarget&&!this.preserveDetail&&this.adaptationAt-this.lastDetailProbe>6000&&this.analysisPixels<this.options.maxFramePixels){
                // Una ventana de búsqueda a mayor resolución ayuda si un marcador pequeño nunca llegó a verse.
                this.lastDetailProbe=this.adaptationAt;this.detailProbeBudget=this.analysisPixels;
                this.analysisPixels=Math.min(this.options.maxFramePixels,Math.ceil(this.analysisPixels*1.45));
              }else if(busy&&!this.preserveDetail){
                this.analysisPixels=Math.min(this.analysisPixels,Math.max(minimumPixels,Math.floor(this.analysisPixels*.8)));
              }
            }else if(this.adaptiveResolution&&!this.usesAutoBudget&&!this.preserveDetail&&this.averageProcessingMs>45)this.analysisWidth=Math.max(this.detailFloor,this.options.minFrameWidth??Math.min(320,this.options.maxFrameWidth),Math.floor(width*.85));
            else if(this.adaptiveResolution&&!this.usesAutoBudget&&this.averageProcessingMs<18)this.analysisWidth=Math.min(this.options.maxFrameWidth,Math.ceil(this.analysisWidth*1.1));
          }
          try {this.options.onMetrics?.({processedFrames:this.processed,skippedFrames:this.skipped,readbackMs,
            processingMs,consumerMs:Math.max(0,processingMs-readbackMs),averageProcessingMs:this.averageProcessingMs,analysisWidth:width,analysisHeight:height,performance:this.options.performance??'auto',targetAnalysisFPS:this.analysisFPS});}
          catch(error){this.report(error);}
        });
    } catch (error) {
      session.busy = false;
      // Un fallo síncrono persistente no debe generar un error por cada rAF.
      if (this.session === session) {
        this.stop();
        this.report(error);
      }
    }
  }

  private readonly visibility=():void=>{
    const session=this.session;if(!session||!session.started)return;
    const hidden=document.visibilityState==='hidden';
    if(hidden&&!session.paused){session.paused=true;if(session.raf!==null)cancelAnimationFrame(session.raf);session.raf=null;try{this.options.onSuspend?.();}catch(error){this.report(error);}}
    else if(!hidden&&session.paused){
      session.paused=false;session.lastCapture=-Infinity;session.lastMediaTime=-1;
      void this.video.play().then(()=>{
        if(this.session!==session||session.paused)return;
        session.raf=requestAnimationFrame(time=>this.tick(session,time));this.options.onResume?.();
      }).catch(error=>{if(this.session===session){this.stop();this.report(error);}});
    }
  };

  private notify(status: 'camera-requesting' | 'camera-granted' | 'camera-playing'):void{
    try{this.options.onStatus?.(status);}catch(error){this.report(error);}
  }

  private abortable<T>(pending: Promise<T>, signal: AbortSignal,timeoutMs?:number,message?:string): Promise<T> {
    return new Promise((resolve, reject) => {
      let timer:ReturnType<typeof setTimeout>|undefined;
      const cleanup=()=>{if(timer!==undefined)clearTimeout(timer);signal.removeEventListener('abort',abort);};
      const abort = () => {cleanup();reject(new DOMException('Operación cancelada.', 'AbortError'));};
      if(timeoutMs!==undefined)timer=setTimeout(()=>{cleanup();reject(new Error(message??'La cámara no respondió a tiempo.'));},timeoutMs);
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
      // Ambos handlers siguen instalados aunque se cancele: evitan rechazos huérfanos.
      pending.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
    });
  }

  private report(cause: unknown): void {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    try {
      if (this.options.onError) this.options.onError(error);
      else console.error('[CameraManager]', error);
    } catch (callbackError) {
      console.error('[CameraManager:onError]', callbackError);
    }
  }
}
