/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CameraIntrinsics } from '../Pose.ts';
import type {ImageTrackingProfile} from './profile.ts';
import type {FrameQuality} from './events';
export interface ImageObservation {
  rgba: ArrayBuffer;
  width: number; height: number; timestampMs: number; sessionId: number;
  intrinsics: CameraIntrinsics;
  projectionSource?: 'calibrated'|'estimated';
  cameraFromMarker: Float32Array;
  imagePoints: Float32Array;
  objectPoints: Float32Array;
  markerCorners: Float32Array;
}
export type TrackingResult = { sessionId: number; timestampMs: number; processingMs: number; quality?:FrameQuality;targetId?:string;profile?:ImageTrackingProfile } & (
  | { status: 'not-found'; matrix: null }
  | { status: 'tracked'; matrix: Float32Array; projectionMatrix: Float32Array;
      projectionSource: 'calibrated' | 'estimated'; inliers: number; reprojectionErrorPx: number;
      reference: ImageObservation }
);
export interface TrackingFrameRequest {
  type: 'FRAME'|'FRAME_BATCH'; id: number; buffer: ArrayBuffer; width: number; height: number;
  sessionId: number; timestampMs: number; intrinsics: CameraIntrinsics;
  projectionSource: 'calibrated' | 'estimated';
}

export interface TrackingBatchResult {results:TrackingResult[];processingMs:number;profile?:ImageTrackingProfile;}
