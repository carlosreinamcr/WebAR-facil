/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import CompilerWorker from './compiler.worker.ts?worker&inline';
import { WorkerRPC } from '../internal/WorkerRPC';
import type { MarkerQuality } from '../tracking/ImageCompiler';
import {decodeImageBrowser} from '../tracking/ImageCompiler';

export class MarkerCompiler {
  private readonly rpc:WorkerRPC;
  constructor(options:{workerFactory?:()=>Worker}={}){this.rpc=new WorkerRPC(options.workerFactory?.()??new CompilerWorker(),30_000);}
  /** JPG/PNG original; decodificación EXIF, ORB y binario se calculan en Worker. */
  async compile(file:Blob,options:{physicalWidthMeters:number;opencvURL:string;maxDimension?:number},signal?:AbortSignal):Promise<{buffer:ArrayBuffer;quality:MarkerQuality}>{
    if(!file.size||file.size>32*1024*1024)throw new Error('Imagen vacía o demasiado grande.');
    const buffer=await file.arrayBuffer();signal?.throwIfAborted();
    const capabilities=await this.rpc.request({type:'CAPABILITIES'},[],signal) as {nativeDecode:boolean};
    if(!capabilities.nativeDecode){
      const image=await decodeImageBrowser(new Uint8Array(buffer),options.maxDimension??1024);signal?.throwIfAborted();
      return await this.rpc.request({rgba:true,buffer:image.data.buffer,width:image.width,height:image.height,options},[image.data.buffer],signal) as {buffer:ArrayBuffer;quality:MarkerQuality};
    }
    return await this.rpc.request({buffer,options},[buffer],signal) as {buffer:ArrayBuffer;quality:MarkerQuality};
  }
  dispose():void{this.rpc.dispose();}
}
