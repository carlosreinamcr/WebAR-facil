/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {CameraIntrinsics} from '../Pose';
export interface CalibrationObservation {width:number;height:number;objectPoints:Float32Array;imagePoints:Float32Array}
export interface CalibrationReport {calibration:CameraIntrinsics;rmsPx:number;perViewErrorsPx:number[];views:number;coverage:number;warnings:string[]}
export interface CalibrationCapture {accepted:boolean;corners:Float32Array;views:number;reason:string}
