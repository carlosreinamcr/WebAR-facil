/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import CalibrationWorker from './calibration.worker.ts?worker&inline';
import { WorkerRPC } from '../internal/WorkerRPC';
import type { CalibrationCapture, CalibrationReport } from './types';

/** API de calibración sin cómputo WASM en el hilo de UI. */
export class CalibrationSession {
  private readonly rpc:WorkerRPC;
  constructor(options:{workerFactory?:()=>Worker}={}){this.rpc=new WorkerRPC(options.workerFactory?.()??new CalibrationWorker(),30_000);}
  async initialize(opencvURL:string,signal?:AbortSignal):Promise<void>{await this.rpc.request({type:'INIT',opencvURL},[],signal);}
  async addFrame(frame:ImageData,signal?:AbortSignal):Promise<CalibrationCapture>{
    if(!(frame.data.buffer instanceof ArrayBuffer))throw new Error('Buffer de calibración inválido.');
    return await this.rpc.request({type:'FRAME',buffer:frame.data.buffer,width:frame.width,height:frame.height},[frame.data.buffer],signal) as CalibrationCapture;
  }
  async board():Promise<{data:Uint8ClampedArray;width:number;height:number}>{return await this.rpc.request({type:'BOARD'}) as {data:Uint8ClampedArray;width:number;height:number};}
  async solve():Promise<CalibrationReport>{return await this.rpc.request({type:'SOLVE'}) as CalibrationReport;}
  async reset():Promise<void>{await this.rpc.request({type:'RESET'});}
  dispose():void{this.rpc.dispose();}
}
