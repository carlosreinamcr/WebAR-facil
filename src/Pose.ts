/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Todos los backends entregan el mismo contrato, sin tipos del renderer. */
export interface ARPose {
  targetId?:string;
  backend: 'image' | 'webxr' | 'optical-flow';
  timestampMs: number;
  scale: 'metric' | 'relative';
  /** Session-only metric estimate from the experimental optical/inertial mode. */
  scaleSource?: 'experimental-inertial';
  /** T_camera_object: column-major WebGL. */
  matrix: Float32Array;
  /** T_world_object. En imagen, el mundo de render es el espacio de cámara. */
  worldMatrix: Float32Array;
  /** T_camera_world. */
  viewMatrix: Float32Array;
  /** null si el backend no dispone de calibración; el renderer decide su FOV. */
  projectionMatrix: Float32Array | null;
  projectionSource?: 'calibrated' | 'estimated' | 'webxr';
  /** El ancla óptica coincide con el plano verificado por el estimador. */
  surfaceDetected?:boolean;
  diagnostics?: { processingMs: number; inliers: number; reprojectionErrorPx: number;relocalized?:boolean;keyframeCorrected?:boolean };
}

export interface CameraIntrinsics {
  width: number;
  height: number;
  fx: number;
  fy: number;
  cx: number;
  cy: number;
  distortion?: readonly number[];
}
