/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/// <reference lib="webworker" />
import { CameraCalibrator } from './CameraCalibrator';
const scope=self as unknown as DedicatedWorkerGlobalScope;
let calibrator:CameraCalibrator|null=null,busy=false;
scope.addEventListener('message',(event:MessageEvent<unknown>)=>{
  const request=event.data as {id:number;type:string;opencvURL?:string;buffer?:ArrayBuffer;width?:number;height?:number};
  if(!request||!Number.isSafeInteger(request.id))return;
  if(busy){scope.postMessage({id:request.id,ok:false,error:'Calibrador ocupado.'});return;}busy=true;
  void(async()=>{
    if(request.type==='INIT'){calibrator?.dispose();calibrator=await CameraCalibrator.create(request.opencvURL);return null;}
    if(!calibrator)throw new Error('Inicializar calibrador.');
    if(request.type==='FRAME'){
      if(!(request.buffer instanceof ArrayBuffer)||!Number.isInteger(request.width)||!Number.isInteger(request.height)||
          !request.width||!request.height||request.width*request.height>4096*4096||request.buffer.byteLength!==request.width*request.height*4)throw new Error('Frame inválido.');
      return calibrator.addRGBA(new Uint8ClampedArray(request.buffer),request.width,request.height);
    }
    if(request.type==='BOARD')return calibrator.boardRGBA();
    if(request.type==='SOLVE')return calibrator.solve();
    if(request.type==='RESET'){calibrator.reset();return null;}
    throw new Error('Mensaje desconocido.');
  })().then(result=>{
    if(result&&'data'in result)scope.postMessage({id:request.id,ok:true,result},[result.data.buffer]);
    else if(result&&'corners'in result)scope.postMessage({id:request.id,ok:true,result},[result.corners.buffer]);
    else scope.postMessage({id:request.id,ok:true,result});
  },error=>scope.postMessage({id:request.id,ok:false,error:String(error)}))
    .finally(()=>{busy=false;});
});
