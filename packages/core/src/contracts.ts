/** Design contracts only. No tracking implementation is supplied yet. */
export type EngineState =
  | 'Idle'
  | 'TrackingImage'
  | 'TrackingSurface'
  | 'Disposed';

export type TrackingQuality = 'initializing' | 'tracked' | 'limited' | 'lost';
export type BackendKind = 'image-wasm' | 'webxr' | 'vo-wasm';
export type ScaleKind = 'metric' | 'relative';

/** Column-major, 16 elements, right-handed WebGL convention. */
export type Matrix4 = Float32Array;

export interface CameraOptions {
  width?: number;
  height?: number;
  facingMode?: 'environment' | 'user';
  focus?: 'continuous' | 'manual';
  focusDistance?: number;
  calibration?: {
    width: number;
    height: number;
    fx: number;
    fy: number;
    cx: number;
    cy: number;
    distortion: readonly number[];
  };
}

export interface EngineOptions {
  video: HTMLVideoElement;
  camera?: CameraOptions;
  workerURL: URL;
  wasmURL: URL;
  maxAnalysisWidth?: number;
  /** Resource optimization, independent of render refresh rate. */
  maxAnalysisFPS?: number;
}

export interface ViewMatrices {
  viewId: string;
  projectionMatrix: Matrix4;
  /** T_camera_world. */
  viewMatrix: Matrix4;
  /** T_camera_object. Null when object pose is unavailable. */
  modelViewMatrix: Matrix4 | null;
  viewport: { x: number; y: number; width: number; height: number };
}

export interface TrackingResult {
  epoch: number;
  /** Capture timestamp normalized to the session's performance time origin. */
  timestampMs: number;
  backend: BackendKind;
  quality: TrackingQuality;
  scale: ScaleKind;
  spaceId: string;
  targetId?: string;
  anchorId?: string;
  /** No pose is represented by null, never a fabricated identity matrix. */
  worldFromObject: Matrix4 | null;
  views: readonly ViewMatrices[];
  projectionSource: 'calibrated' | 'estimated' | 'webxr';
  diagnostics: {
    processingMs: number;
    inliers?: number;
    reprojectionErrorPx?: number;
  };
}

export interface SurfaceOptions {
  backend?: 'auto' | 'webxr' | 'vo-wasm';
  /** Require measurable planes; reject if the chosen backend cannot supply them. */
  requirePlanes?: boolean;
}

export interface TransitionOptions extends SurfaceOptions {
  placement: 'preserve' | 'hit-test';
  /** Applies to visual pose correction after valid spatial alignment only. */
  smoothingMs?: number;
}

export type TransitionResult =
  | { status: 'switched'; backend: 'webxr' | 'vo-wasm' }
  | { status: 'alignment-required'; recoveryState: EngineState }
  | { status: 'placement-required'; backend: 'webxr' | 'vo-wasm' };

/** Opaque token obtained from a current surface hit; never a screen coordinate. */
export interface SurfaceHit {
  id: string;
  epoch: number;
  spaceId: string;
  timestampMs: number;
  worldFromHit: Matrix4;
}

export interface AnchorHandle {
  id: string;
  spaceId: string;
  kind: 'xr-anchor' | 'reference-space' | 'vo-map';
}

export interface EngineEvents {
  statechange: { previous: EngineState; current: EngineState };
  operation: { phase: 'starting' | 'switching' | 'stopping' | 'complete' };
  tracking: TrackingResult;
  surfacehit: SurfaceHit;
  error: { code: string; message: string; recoverable: boolean };
}

/** Public interface to be implemented by WebAREngine. */
export interface WebAREngineAPI {
  readonly state: EngineState;
  loadTarget(data: ArrayBuffer): Promise<{ targetId: string }>;
  startImage(targetId: string): Promise<void>;
  /** Invoke directly from a user gesture when it may open immersive AR. */
  startSurface(options?: SurfaceOptions): Promise<void>;
  /** Invoke directly from a user gesture when it may open immersive AR. */
  switchToSLAM(options: TransitionOptions): Promise<TransitionResult>;
  /** Rejects stale hits or hits from another reference space. */
  placeOnSurface(hit: SurfaceHit): Promise<AnchorHandle>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  on<K extends keyof EngineEvents>(
    type: K,
    listener: (event: EngineEvents[K]) => void,
  ): () => void;
}

export interface WorkerRequestBase {
  requestId: number;
  epoch: number;
}

export type WorkerRequest = WorkerRequestBase & (
  | { type: 'INIT'; wasmURL: string; abiVersion: number }
  | { type: 'LOAD_TARGET'; data: ArrayBuffer }
  | { type: 'SET_MODE'; mode: 'image' | 'odometry'; targetId?: string }
  | { type: 'FRAME'; frame: ImageBitmap; timestampMs: number }
  | { type: 'RESET' }
  | { type: 'DISPOSE' }
);

export type WorkerResponse = WorkerRequestBase & (
  | { type: 'ACK'; targetId?: string }
  | { type: 'RESULT'; result: TrackingResult }
  | { type: 'ERROR'; code: string; message: string }
);
