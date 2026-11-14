/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { ARPose } from '../Pose';
import { assertRigid, multiply } from '../spatial/matrices';
import { quaternionFromMatrix } from '../spatial/PoseFilter';
import { RawCameraCapture } from './RawCameraCapture';
import type { CameraFrame } from '../camera/CameraManager';
import type { CameraIntrinsics } from '../Pose';

export interface SLAMOptions {
  /** El renderer configura XRWebGLLayer y su propio bucle de renderizado. */
  attachSession: (session: XRSession) => Promise<void>;
  overlayRoot?: HTMLElement;
  onPose: (pose: ARPose) => void;
  onSurface?: (matrix: Float32Array) => void;
  onLost?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  getGLContext?: () => WebGL2RenderingContext;
  requireCameraAccess?: boolean;
  onCameraFrame?: (frame:CameraFrame,worldFromCamera:Float32Array,intrinsics:CameraIntrinsics,referenceEpoch:number)=>Promise<void>;
  onAlignmentUnavailable?: (error:Error)=>void;
}

/** Tracking nativo; las poses de hit-test no se presentan como una malla completa. */
export class SLAMManager {
  private session: XRSession | null = null;
  private space: XRReferenceSpace | null = null;
  private source: XRHitTestSource | null = null;
  private anchor: XRAnchor | null = null;
  private objectMatrix: Float32Array | null = null;
  private raf: number | null = null;
  private generation = 0;
  private starting = false;
  private signal: AbortSignal | undefined;
  private capture:RawCameraCapture|null=null;
  private captureBusy=false;
  private lastCapture=-Infinity;
  private referenceRevision=0;
  private pendingAnchor=false;
  private placementRevision=0;
  private closing:Promise<void>=Promise.resolve();
  get imageAlignmentAvailable():boolean{return this.capture!==null;}
  get hasPlacement():boolean{return this.objectMatrix!==null;}
  get referenceEpoch():number{return this.referenceRevision;}

  constructor(private readonly options: SLAMOptions) {}

  static async isSupported(): Promise<boolean> {
    try { return await navigator.xr?.isSessionSupported('immersive-ar') ?? false; }
    catch { return false; }
  }

  /** Llamar desde un gesto de usuario; requestSession se invoca antes del primer await. */
  async start(signal?: AbortSignal): Promise<void> {
    if (this.session || this.starting) throw new Error('WebXR ya iniciado.');
    if (!navigator.xr) throw new DOMException('WebXR no disponible.', 'NotSupportedError');
    signal?.throwIfAborted();
    this.starting = true;
    const generation = ++this.generation;
    let session: XRSession | null = null;
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test',...(this.options.requireCameraAccess?['camera-access']:[])],
        optionalFeatures: ['anchors',...(!this.options.requireCameraAccess&&this.options.onCameraFrame?['camera-access']:[]), ...(this.options.overlayRoot ? ['dom-overlay'] : [])],
        ...(this.options.overlayRoot ? { domOverlay: { root: this.options.overlayRoot } } : {}),
      });
      if (generation !== this.generation || signal?.aborted) {
        await session.end(); throw new DOMException('Inicio XR cancelado.', 'AbortError');
      }
      this.session = session;
      this.signal = signal;
      session.addEventListener('end', this.ended);
      session.addEventListener('select', this.select);
      signal?.addEventListener('abort', this.abort, { once: true });
      session.addEventListener('end', () => signal?.removeEventListener('abort', this.abort), { once: true });
      const [space, viewer] = await Promise.all([
        session.requestReferenceSpace('local'), session.requestReferenceSpace('viewer'),
      ]);
      this.assertCurrent(session, generation);
      this.space = space;
      space.addEventListener('reset', this.reset);
      const source = await session.requestHitTestSource?.({ space: viewer });
      if (!source) throw new Error('Hit-test no disponible en esta sesión.');
      if (this.session !== session) { source.cancel(); throw new DOMException('Cancelado.', 'AbortError'); }
      this.source = source;
      await this.options.attachSession(session);
      this.assertCurrent(session, generation);
      if(this.options.onCameraFrame&&this.options.getGLContext){
        try {this.capture=new RawCameraCapture(session,this.options.getGLContext());}
        catch(error){
          if(this.options.requireCameraAccess)throw error;
          this.options.onAlignmentUnavailable?.(error instanceof Error?error:new Error(String(error)));
        }
      } else if(this.options.requireCameraAccess)throw new Error('Falta getGLContext para alinear imagen y WebXR.');
      this.raf = session.requestAnimationFrame(this.frame);
    } catch (error) {
      if (this.session === session && session) this.stop();
      throw error;
    } finally { if (generation === this.generation) this.starting = false; }
  }

  /**
   * Solo preservar pose con T_world_camera alineada al MISMO frame del marcador.
   * Sin esa observación, habilitar hit-test y colocar mediante un gesto select.
   */
  switchToSLAM(currentMatrix: Float32Array, alignedWorldFromCamera?: Float32Array): void {
    if (!this.session) throw new Error('Sesión XR no iniciada.');
    if (!alignedWorldFromCamera) throw new Error('alignment-required: falta alineación imagen/WebXR.');
    assertRigid(currentMatrix); assertRigid(alignedWorldFromCamera);
    this.anchor?.delete(); this.anchor = null;
    this.objectMatrix = multiply(alignedWorldFromCamera, currentMatrix);
    this.pendingAnchor=true;this.placementRevision++;
  }

  stop(): Promise<void> {
    ++this.generation; this.starting = false;
    const session = this.session;
    this.clear();
    if (session) this.closing=session.end().catch(() => {});
    return this.closing;
  }

  private assertCurrent(session: XRSession, generation: number): void {
    if (this.session !== session || generation !== this.generation) throw new DOMException('Cancelado.', 'AbortError');
  }

  private readonly abort = (): void => { this.stop(); };
  private readonly reset = (): void => {
    this.referenceRevision++;
    // Un reset invalida el transform fijo si no hay XRAnchor para reubicarlo.
    if (!this.anchor) { this.objectMatrix = null; this.options.onLost?.(); }
  };
  private readonly ended = (): void => {
    ++this.generation; this.starting = false; this.clear(); this.options.onEnd?.();
  };

  private clear(): void {
    this.capture?.dispose();this.capture=null;this.captureBusy=false;this.pendingAnchor=false;this.referenceRevision++;
    this.signal?.removeEventListener('abort', this.abort); this.signal = undefined;
    if (this.session) {
      if (this.raf !== null) this.session.cancelAnimationFrame(this.raf);
      this.session.removeEventListener('end', this.ended);
      this.session.removeEventListener('select', this.select);
    }
    this.space?.removeEventListener('reset', this.reset);
    this.source?.cancel(); this.anchor?.delete();
    this.session = null; this.space = null; this.source = null; this.anchor = null;
    this.objectMatrix = null; this.raf = null;
  }

  private readonly select = (event: XRInputSourceEvent): void => {
    const session = this.session, space = this.space, source = this.source;
    if (!session || !space || !source) return;
    const hit = event.frame.getHitTestResults(source)[0];
    const pose = hit?.getPose(space);
    if (!pose || !hit) return;
    this.anchor?.delete(); this.anchor = null;
    this.objectMatrix = new Float32Array(pose.transform.matrix);
    this.placementRevision++;this.pendingAnchor=false;
    const selected = this.objectMatrix;
    if (typeof hit.createAnchor === 'function') {
      void hit.createAnchor().then(anchor => {
        if (this.session !== session || this.objectMatrix !== selected) { anchor.delete(); return; }
        this.anchor = anchor;
      }).catch(() => { /* Sin anchor nativo, mantener transform en el reference space. */ });
    }
  };

  private readonly frame: XRFrameRequestCallback = (timestampMs, frame): void => {
    const session = this.session, space = this.space;
    if (!session || !space) return;
    this.raf = session.requestAnimationFrame(this.frame);
    try {
      const viewer = frame.getViewerPose(space);
      if (!viewer) { this.options.onLost?.(); return; }
      const hit = this.source && frame.getHitTestResults(this.source)[0];
      const surface = hit && hit.getPose(space);
      if (surface) this.options.onSurface?.(new Float32Array(surface.transform.matrix));
      if(!this.objectMatrix&&this.capture&&this.options.onCameraFrame&&!this.captureBusy&&timestampMs-this.lastCapture>100&&viewer.views[0]) {
        this.lastCapture=timestampMs;
        try {
          const camera=this.capture.read(viewer.views[0],timestampMs,this.generation);
          if(camera){
            this.captureBusy=true;
            void this.options.onCameraFrame(camera.frame,new Float32Array(viewer.views[0].transform.matrix),camera.intrinsics,this.referenceRevision)
              .catch(error=>{if(this.session===session)this.options.onAlignmentUnavailable?.(error instanceof Error?error:new Error(String(error)));})
              .finally(()=>{if(this.session===session)this.captureBusy=false;});
          }
        }catch(error){this.capture.dispose();this.capture=null;this.options.onAlignmentUnavailable?.(error instanceof Error?error:new Error(String(error)));}
      }
      if(this.pendingAnchor&&this.objectMatrix&&typeof frame.createAnchor==='function') {
        this.pendingAnchor=false;
        const matrix=this.objectMatrix,revision=this.placementRevision,q=quaternionFromMatrix(matrix);
        void frame.createAnchor(new XRRigidTransform({x:matrix[12]!,y:matrix[13]!,z:matrix[14]!},{x:q[0],y:q[1],z:q[2],w:q[3]}),space)
          .then(anchor=>{if(this.session!==session||this.placementRevision!==revision){anchor.delete();return;}this.anchor?.delete();this.anchor=anchor;})
          .catch(()=>{/* Transform fijo como fallback si anchors no se concede. */});
      }
      if (this.anchor) {
        const pose = frame.getPose(this.anchor.anchorSpace, space);
        if (!pose) { this.options.onLost?.(); return; }
        this.objectMatrix = new Float32Array(pose.transform.matrix);
      }
      if (!this.objectMatrix) return;
      const view = new Float32Array(viewer.views[0]?.transform.inverse.matrix??viewer.transform.inverse.matrix);
      this.options.onPose({
        backend: 'webxr', timestampMs, scale: 'metric',
        projectionSource:'webxr',
        worldMatrix: this.objectMatrix.slice(), viewMatrix: view,
        matrix: multiply(view, this.objectMatrix),
        projectionMatrix: viewer.views[0] ? new Float32Array(viewer.views[0].projectionMatrix) : null,
      });
    } catch (error) {
      this.stop(); this.options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
