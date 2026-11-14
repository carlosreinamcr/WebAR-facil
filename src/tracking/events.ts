/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {ARPose} from '../Pose';
import type {OdometryScanHint} from '../slam/OdometryBackend';
export type TrackingIssue='low-texture'|'small-target'|'blur'|'high-motion'|'insufficient-matches'|'occlusion-or-out-of-view'|'device-load';
/** Indicadores heurísticos: una imagen sin rasgos no permite distinguir siempre blur y poca textura. */
export interface FrameQuality {
  gradient:number; laplacianVariance:number; motionPixels:number; targetSizePx:number;
  featureCount:number; inliers:number; reprojectionErrorPx:number;
}
export interface TrackingQualityEvent extends FrameQuality {
  targetId:string;timestampMs:number;state:'tracking'|'recovering'|'lost';score:number;
  processingMs:number;issues:TrackingIssue[];diagnosis:'heuristic';
}
export interface TargetFoundEvent {targetId:string;timestampMs:number;pose:ARPose;}
export interface TargetLostEvent {targetId:string;timestampMs:number;retained:boolean;reason:'lost'|'removed'|'stopped';}
export interface TargetVisibilityEvent {targetId:string;visible:boolean;reason:'tracked'|'recovering'|'lost'|'removed'|'stopped'|'policy';}
export interface AREventMap {
  scanGuidance:{hint:OdometryScanHint;timestampMs:number};
  targetFound:TargetFoundEvent;targetLost:TargetLostEvent;trackingQuality:TrackingQualityEvent;targetVisibility:TargetVisibilityEvent;
}
