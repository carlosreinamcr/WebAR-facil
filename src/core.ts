/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/// <reference types="webxr" preserve="true" />
export {LIBRARY_VERSION,LIBRARY_BUILD} from './build-info';
export {ARDiagnostics} from './diagnostics/ARDiagnostics';
export type {DiagnosticContext,DiagnosticConfiguration,DiagnosticOptions,DiagnosticReport,DiagnosticStats,DiagnosticRendererMetrics,DeviceTestResult} from './diagnostics/ARDiagnostics';
export {DEVICE_TEST_PROTOCOL} from './diagnostics/device-protocol';
export type {DeviceTestCase} from './diagnostics/device-protocol';
export { WebAREngine,EngineState } from './WebAREngine';
export type { EngineOptions,SurfaceTransitionOptions,SurfaceTransitionResult,ImageTargetOptions,ImageTargetMetadata,ImageTargetResult,SLAMMapSnapshot } from './WebAREngine';
export type { ARPose,CameraIntrinsics } from './Pose';
export type {AREventMap,FrameQuality,TrackingQualityEvent,TargetFoundEvent,TargetLostEvent,TargetVisibilityEvent,TrackingIssue} from './tracking/events';
export { CameraManager } from './camera/CameraManager';
export type { CameraFrame,CameraManagerOptions,CameraMetrics } from './camera/CameraManager';
export { Tracker } from './tracking/Tracker';
export type { TrackerOptions,TrackingResult,ImageObservation } from './tracking/Tracker';
export { ImageCompiler } from './tracking/ImageCompiler';
export type { CompilerOptions,MarkerFeatures,MarkerQuality } from './tracking/ImageCompiler';
export { MarkerCompiler } from './tools/MarkerCompiler';
export { CalibrationSession } from './calibration/CalibrationSession';
export type { CalibrationReport } from './calibration/types';
export { SLAMManager } from './slam/SLAMManager';
export type { SLAMOptions } from './slam/SLAMManager';
export { OpticalFlowSLAM } from './slam/OpticalFlowSLAM';
export { ExperimentalMetricScale } from './slam/ExperimentalMetricScale';
export type { MetricScaleDiagnostics } from './slam/ExperimentalMetricScale';
export type { OpticalFlowOptions } from './slam/OpticalFlowSLAM';
export type { OdometryBackend,OdometryConfig,OdometryEstimate,OdometryScanHint,OdometryModule,OdometryMapSnapshot,VisualReferenceResult } from './slam/OdometryBackend';
export { projectionFromIntrinsics,scaleIntrinsics,rotateIntrinsics,validateIntrinsics } from './vision/calibration';

export type {ImageTrackingProfile} from './tracking/profile';
