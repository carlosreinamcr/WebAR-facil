/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CameraIntrinsics } from '../Pose';
import type { ImageObservation } from '../tracking/types';

export interface OdometryConfig {
  intrinsics: CameraIntrinsics;
  opencvURL?: string;
  seed?: ImageObservation;
  /** Experimental, desactivada por defecto: reobservación de keyframes locales. */
  keyframeCorrection?:boolean;
  /** ROI normalizada para seleccionar esquinas candidatas del suelo. No prueba un plano. */
  floorROI: { x: number; y: number; width: number; height: number };
}
/** Snapshot local: no imágenes de cámara; solo descriptores y geometría verificada. */
export interface OdometryMapSnapshot {
  version:1;intrinsics:CameraIntrinsics;scale:'relative'|'metric';mapId:string;
  keyframes:{descriptors:Uint8Array;points:Float32Array;view:Float32Array}[];
  groundPlane?:{worldFromPlane:Float32Array;inliers:number};
  /** La exportación añadió un fotograma clave de la vista actual. */
  currentViewCaptured?:boolean;
}

export const ODOMETRY_STAGES=['grayMs','cornersMs','flowMs','flowNormalMs','flowWideMs','flowRetryMs','initializationMs','poseMs','mapUpdateMs','keyframesMs','planeMs','planeFitMs','planeConsensusMs','relocalizationMs','workerMs'] as const;
export type OdometryTimings = Partial<Record<typeof ODOMETRY_STAGES[number],number>>;

export const ODOMETRY_SCAN_HINTS=['low-texture','move-sideways','map-initializing','plane-unverified','return-to-map','map-matches-insufficient','map-pose-unverified','map-pose-confirming','surface-ready'] as const;
/** Indicio de escaneo derivado del estimador local. */
export type OdometryScanHint = typeof ODOMETRY_SCAN_HINTS[number];

export type OdometryEstimate = ({
  status: 'initializing' | 'lost';
  mapId: string;
} | {
  status: 'tracked';
  mapId: string;
  /** Pose acumulada T_world_camera, NO delta entre frames. Convención WebGL. */
  worldFromCamera: Float32Array;
  projectionMatrix: Float32Array;
  scale: 'relative' | 'metric';
  trackedPoints: number;
  environmentReady?: boolean;
  processingMs?: number;
  reprojectionErrorPx?: number;
  relocalized?:boolean;
  keyframeCorrected?:boolean;
  /** Pose held against distributed, near-static visual correspondences. */
  stationary?:boolean;
  /** Solo emitir tras triangulación y verificación geométrica de un plano. */
  groundPlane?: { worldFromPlane: Float32Array; inliers: number };
}) & {timings?:OdometryTimings;scanHint?:OdometryScanHint};

/** ABI JavaScript del módulo local que encapsula el WASM del usuario. */
export interface OdometryBackend {
  /**
   * Pipeline esperado en WASM: gris -> Shi-Tomasi/FAST -> Lucas-Kanade piramidal
   * -> comprobación forward/backward -> geometría robusta -> keyframes/mapa -> pose.
   * Reponer puntos, detectar falta de paralaje y declarar lost ante degeneración.
   * Intrínsecos se escalan al tamaño RGBA recibido. No inferir traslación 3D
   * simplemente sumando desplazamientos de píxeles.
   */
  processFrame(frame: {
    rgba: Uint8ClampedArray;
    width: number;
    height: number;
    timestampMs: number;
  }): OdometryEstimate | Promise<OdometryEstimate>;
  reset(): void | Promise<void>;
  exportMap?(includeCurrentView?:boolean):OdometryMapSnapshot;
  importMap?(snapshot:OdometryMapSnapshot):void;
  checkVisualReference?(action:'capture'|'verify',id:string,timestampMs:number):VisualReferenceResult;
}

export type VisualReferenceResult =
  | {status:'captured';points:number}
  | {status:'verified';inliers:number;reprojectionErrorPx:number;medianImageShiftPx:number;
      directReturnUnits:number;trajectoryDeltaUnits:number}
  | {status:'unavailable'|'insufficient-support'|'missing-reference'};

export interface OdometryModule {
  createOdometryBackend(config: OdometryConfig): Promise<OdometryBackend>;
}
