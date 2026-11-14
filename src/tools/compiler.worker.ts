/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/// <reference lib="webworker" />
import { ImageCompiler,analyzeFeatures,decodeMarker,type CompilerOptions } from '../tracking/ImageCompiler';
const scope=self as unknown as DedicatedWorkerGlobalScope;
let busy=false;
scope.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const request=event.data as {id:number;type?:string;buffer:ArrayBuffer;rgba?:boolean;width?:number;height?:number;options:CompilerOptions};
  if(!request||!Number.isSafeInteger(request.id))return;
  if(request.type==='CAPABILITIES'){scope.postMessage({id:request.id,ok:true,result:{nativeDecode:typeof createImageBitmap==='function'&&typeof OffscreenCanvas!=='undefined'}});return;}
  if(busy){scope.postMessage({id:request.id,ok:false,error:'Compilador ocupado.'});return;}busy=true;
  const compiler=new ImageCompiler();
  const compiling=request.rgba?compiler.compileRGBA({data:new Uint8ClampedArray(request.buffer),width:request.width!,height:request.height!},request.options):compiler.compile(new Uint8Array(request.buffer),request.options);
  void compiling.then(buffer=>{
    const quality=analyzeFeatures(decodeMarker(buffer));scope.postMessage({id:request.id,ok:true,result:{buffer,quality}},[buffer]);
  },error=>scope.postMessage({id:request.id,ok:false,error:String(error)})).finally(()=>{busy=false;});
});
