/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CV } from '../vision/runtime.ts';
import { CvScope, loadOpenCV } from '../vision/runtime.ts';
import { GrayBuffers as Buffers } from '../vision/features.ts';
import type { CameraIntrinsics } from '../Pose.ts';
import { validateIntrinsics } from '../vision/calibration.ts';
import type {CalibrationObservation,CalibrationReport,CalibrationCapture} from './types.ts';
export type {CalibrationObservation,CalibrationReport,CalibrationCapture} from './types.ts';

interface Disposable { delete():void }
type Mat=InstanceType<CV['Mat']>;
interface Board extends Disposable {
  getChessboardCorners():Disposable & {get(i:number):{x:number;y:number;z:number}};
  generateImage(size:InstanceType<CV['Size']>,image:Mat,margin:number,border:number):void;
}
interface CharucoRuntime {
  DICT_4X4_50:number;
  getPredefinedDictionary(id:number):Disposable;
  aruco_CharucoBoard:new(size:InstanceType<CV['Size']>,square:number,marker:number,dictionary:Disposable,ids:Mat)=>Board;
  aruco_CharucoParameters:new()=>Disposable;
  aruco_DetectorParameters:new()=>Disposable;
  aruco_RefineParameters:new(distance:number,error:number,allOrders:boolean)=>Disposable;
  aruco_CharucoDetector:new(board:Board,charuco:Disposable,detector:Disposable,refine:Disposable)=>Disposable & {
    detectBoard(gray:Mat,corners:Mat,ids:Mat,markerCorners:InstanceType<CV['MatVector']>,markerIds:Mat):void;
  };
  calibrateCameraExtended(objects:InstanceType<CV['MatVector']>,pixels:InstanceType<CV['MatVector']>,size:InstanceType<CV['Size']>,
    camera:Mat,distortion:Mat,rvecs:InstanceType<CV['MatVector']>,tvecs:InstanceType<CV['MatVector']>,stdIntrinsic:Mat,stdExtrinsic:Mat,
    perView:Mat,flags:number,criteria:InstanceType<CV['TermCriteria']>):number;
}

/** Sesión local de calibración ChArUco 7x5, cuadrados de 30mm, marcadores de 22mm. */
export class CameraCalibrator {
  private readonly cv:CV;
  private readonly dynamic:CharucoRuntime;
  private readonly buffers:Buffers;
  private readonly resources=new CvScope();
  private readonly board:Board;
  private readonly detector:InstanceType<CharucoRuntime['aruco_CharucoDetector']>;
  private views:CalibrationObservation[]=[];
  private disposed=false;
  constructor(cv:CV) {
    this.cv=cv;this.dynamic=cv as unknown as CharucoRuntime;this.buffers=new Buffers(cv);
    const dictionary=this.resources.own(this.dynamic.getPredefinedDictionary(this.dynamic.DICT_4X4_50));
    const ids=this.resources.own(new cv.Mat());
    this.board=this.resources.own(new this.dynamic.aruco_CharucoBoard(new cv.Size(7,5),.03,.022,dictionary,ids));
    const cp=this.resources.own(new this.dynamic.aruco_CharucoParameters());
    const dp=this.resources.own(new this.dynamic.aruco_DetectorParameters());
    const rp=this.resources.own(new this.dynamic.aruco_RefineParameters(10,3,true));
    this.detector=this.resources.own(new this.dynamic.aruco_CharucoDetector(this.board,cp,dp,rp));
  }
  static async create(opencvURL?:string):Promise<CameraCalibrator>{const{cv}=await loadOpenCV(opencvURL);return new CameraCalibrator(cv);}

  boardRGBA():{data:Uint8ClampedArray;width:number;height:number} {
    this.assertOpen();const scope=new CvScope();
    try {
      const gray=scope.own(new this.cv.Mat()),rgba=scope.own(new this.cv.Mat());
      this.board.generateImage(new this.cv.Size(1400,1000),gray,0,1);
      this.cv.cvtColor(gray,rgba,this.cv.COLOR_GRAY2RGBA);
      return{data:new Uint8ClampedArray(rgba.data),width:rgba.cols,height:rgba.rows};
    }finally{scope.close();}
  }

  addRGBA(data:Uint8ClampedArray,width:number,height:number):CalibrationCapture {
    this.assertOpen();const scope=new CvScope();
    try {
      const gray=this.buffers.frame(data,width,height),corners=scope.own(new this.cv.Mat()),ids=scope.own(new this.cv.Mat());
      const markerCorners=scope.own(new this.cv.MatVector()),markerIds=scope.own(new this.cv.Mat());
      this.detector.detectBoard(gray,corners,ids,markerCorners,markerIds);
      if(ids.rows<12)return{accepted:false,corners:corners.data32F.slice(),views:this.views.length,reason:'insufficient-corners'};
      const boardCorners=scope.own(this.board.getChessboardCorners());
      const objects=new Float32Array(ids.rows*3);
      for(let i=0;i<ids.rows;i++){const p=boardCorners.get(ids.data32S[i]!);objects.set([p.x,p.y,p.z??0],3*i);}
      const pixels=corners.data32F.slice();
      const accepted=this.addObservation({width,height,objectPoints:objects,imagePoints:pixels});
      return{accepted,corners:pixels,views:this.views.length,reason:accepted?'accepted':'duplicate-view'};
    }finally{scope.close();}
  }

  addObservation(view:CalibrationObservation):boolean {
    this.assertOpen();
    if(!Number.isSafeInteger(view.width)||!Number.isSafeInteger(view.height)||view.width<64||view.height<64||
        view.objectPoints.length/3!==view.imagePoints.length/2||view.imagePoints.length<24||
        !view.objectPoints.every(Number.isFinite)||!view.imagePoints.every(Number.isFinite))throw new Error('Observación de calibración inválida.');
    if(this.views.length&&(this.views[0]!.width!==view.width||this.views[0]!.height!==view.height))throw new Error('Mantener resolución y orientación durante toda la calibración.');
    if(this.views.length>=40)throw new Error('Máximo 40 vistas por sesión.');
    for(const previous of this.views) {
      let sum=0,count=0;
      for(let i=0;i<view.objectPoints.length/3;i++)for(let j=0;j<previous.objectPoints.length/3;j++) {
        if(Math.hypot(...[0,1,2].map(axis=>view.objectPoints[3*i+axis]!-previous.objectPoints[3*j+axis]!))<1e-6) {
          sum+=(view.imagePoints[2*i]!-previous.imagePoints[2*j]!)**2+(view.imagePoints[2*i+1]!-previous.imagePoints[2*j+1]!)**2;count++;break;
        }
      }
      if(count>=10&&Math.sqrt(sum/count)/Math.hypot(view.width,view.height)<.012)return false;
    }
    this.views.push({...view,objectPoints:view.objectPoints.slice(),imagePoints:view.imagePoints.slice()});return true;
  }

  solve():CalibrationReport {
    this.assertOpen();if(this.views.length<10)throw new Error('Se necesitan al menos 10 vistas diferentes; se recomiendan 15–25.');
    const cv=this.cv,scope=new CvScope();
    try {
      const objects=scope.own(new cv.MatVector()),pixels=scope.own(new cv.MatVector());
      const cells=new Set<number>(),first=this.views[0]!;
      for(const view of this.views) {
        const o=scope.own(cv.matFromArray(view.objectPoints.length/3,1,cv.CV_32FC3,view.objectPoints));
        const p=scope.own(cv.matFromArray(view.imagePoints.length/2,1,cv.CV_32FC2,view.imagePoints));
        objects.push_back(o);pixels.push_back(p);
        for(let i=0;i<view.imagePoints.length;i+=2)cells.add(Math.min(5,Math.floor(view.imagePoints[i]!/first.width*6))+
          Math.min(5,Math.floor(view.imagePoints[i+1]!/first.height*6))*6);
      }
      const camera=scope.own(cv.Mat.eye(3,3,cv.CV_64F)),distortion=scope.own(cv.Mat.zeros(1,5,cv.CV_64F));
      const rvecs=scope.own(new cv.MatVector()),tvecs=scope.own(new cv.MatVector());
      const standardI=scope.own(new cv.Mat()),standardE=scope.own(new cv.Mat()),errors=scope.own(new cv.Mat());
      const rmsPx=this.dynamic.calibrateCameraExtended(objects,pixels,new cv.Size(first.width,first.height),camera,distortion,rvecs,tvecs,
        standardI,standardE,errors,cv.CALIB_FIX_K3,new cv.TermCriteria(cv.TermCriteria_COUNT+cv.TermCriteria_EPS,100,1e-8));
      const calibration:CameraIntrinsics={width:first.width,height:first.height,fx:camera.data64F[0]!,fy:camera.data64F[4]!,
        cx:camera.data64F[2]!,cy:camera.data64F[5]!,distortion:Array.from(distortion.data64F).slice(0,5)};
      validateIntrinsics(calibration);
      const maxDimension=Math.max(first.width,first.height),standard=standardI.data64F;
      if(calibration.fx<maxDimension*.1||calibration.fy<maxDimension*.1||calibration.fx>maxDimension*10||calibration.fy>maxDimension*10||
          calibration.cx<-.1*first.width||calibration.cx>1.1*first.width||calibration.cy<-.1*first.height||calibration.cy>1.1*first.height||
          !Number.isFinite(standard[0])||!Number.isFinite(standard[1])||standard[0]!/calibration.fx>.15||standard[1]!/calibration.fy>.15) {
        throw new Error('Calibración mal condicionada: capturar inclinaciones y distancias diferentes, no solo trasladar el tablero de frente.');
      }
      if(!Number.isFinite(rmsPx)||rmsPx>2)throw new Error(`Calibración imprecisa (${rmsPx.toFixed(2)}px). Repetir con imágenes nítidas y más ángulos.`);
      const coverage=cells.size/36,warnings:string[]=[];
      if(coverage<.5)warnings.push('Capturar también las esquinas y bordes del encuadre.');
      if(rmsPx>1)warnings.push('Error mayor de 1px: revisar desenfoque, movimiento o impresión del tablero.');
      return{calibration,rmsPx,perViewErrorsPx:Array.from(errors.data64F),views:this.views.length,coverage,warnings};
    }finally{scope.close();}
  }
  reset():void{this.views=[];}
  dispose():void{if(this.disposed)return;this.disposed=true;this.buffers.dispose();this.resources.close();this.views=[];}
  private assertOpen():void{if(this.disposed)throw new Error('Calibrador eliminado.');}
}
