/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {ARPose} from '../Pose';
import type {TrackingResult} from './types';
import type {TrackingQualityEvent,TargetFoundEvent,TargetLostEvent,TargetVisibilityEvent,TrackingIssue} from './events';
import {TrackingContinuity} from './TrackingContinuity.ts';
import {PoseFilter} from '../spatial/PoseFilter.ts';
import {identity} from '../spatial/matrices.ts';

export class TargetPresentation {
  private readonly continuity:TrackingContinuity;
  private readonly filter:PoseFilter;
  private projection:Float32Array|null=null;
  private seen=false;
  private visible=false;
  private lastPose:ARPose|null=null;
  private state:'tracking'|'recovering'|'lost'='lost';
  private readonly smoothingMs:number;
  private keep:boolean;
  readonly id:string;
  constructor(id:string,options:{graceMs?:number;keep?:boolean;smoothingMs?:number}={}){
    this.id=id;this.keep=options.keep??false;this.smoothingMs=options.smoothingMs??65;
    if(!Number.isFinite(this.smoothingMs)||this.smoothingMs<0||this.smoothingMs>500)throw new Error('imageSmoothingMs debe estar entre 0 y 500.');
    this.continuity=new TrackingContinuity(options.graceMs);this.filter=new PoseFilter(Math.max(.001,this.smoothingMs/1000));
  }
  get isVisible():boolean{return this.visible;}
  get isTracked():boolean{return this.state==='tracking';}
  resetSmoothing():void{this.filter.reset();}
  setKeep(value:boolean):TargetVisibilityEvent|null{
    this.keep=value;const visible=!!this.lastPose&&(this.state!=='lost'||value);
    if(visible===this.visible)return null;this.visible=visible;return{targetId:this.id,visible,reason:'policy'};
  }
  end(reason:'removed'|'stopped',timestampMs:number):{lost?:TargetLostEvent;visibility:TargetVisibilityEvent}{
    const wasSeen=this.seen;this.seen=false;this.visible=false;this.lastPose=null;this.state='lost';this.continuity.reset();this.filter.reset();
    return{...(wasSeen?{lost:{targetId:this.id,timestampMs,retained:false,reason}}:{}),visibility:{targetId:this.id,visible:false,reason}};
  }
  update(result:TrackingResult,processingMs=result.processingMs):{pose?:ARPose;found?:TargetFoundEvent;lost?:TargetLostEvent;visibility?:TargetVisibilityEvent;quality:TrackingQualityEvent}{
    const timestampMs=result.timestampMs,transition=this.continuity.update(result.status==='tracked',timestampMs);
    this.state=transition==='tracked'?'tracking':transition==='recovering'?'recovering':'lost';
    const q=result.quality??{gradient:0,laplacianVariance:0,motionPixels:0,targetSizePx:0,featureCount:0,inliers:result.status==='tracked'?result.inliers:0,reprojectionErrorPx:result.status==='tracked'?result.reprojectionErrorPx:0};
    const issues:TrackingIssue[]=[];
    if(result.quality){
      if(q.gradient<3)issues.push('low-texture');
      else if(q.laplacianVariance<80)issues.push('blur');
      if(q.targetSizePx>0&&q.targetSizePx<110)issues.push('small-target');
      if(q.motionPixels>24)issues.push('high-motion');
      if(result.status!=='tracked'){issues.push('insufficient-matches');if(this.lastPose&&q.gradient>=3)issues.push('occlusion-or-out-of-view');}
    }
    if(processingMs>50)issues.push('device-load');
    const quality:TrackingQualityEvent={...q,targetId:this.id,timestampMs,state:this.state,processingMs,issues,diagnosis:'heuristic',
      score:result.status==='tracked'?Math.max(0,Math.min(1,q.inliers/60)*(1-Math.min(1,q.reprojectionErrorPx/5))):0};
    let pose:ARPose|undefined,found:TargetFoundEvent|undefined,lost:TargetLostEvent|undefined;
    if(result.status==='tracked'){
      if(this.projection&&[0,5].some(i=>Math.abs(result.projectionMatrix[i]!/this.projection![i]!-1)>.002))this.filter.reset();
      this.projection=result.projectionMatrix.slice();
      const matrix=this.smoothingMs===0?result.matrix.slice():this.filter.filter(result.matrix,timestampMs);
      pose={targetId:this.id,backend:'image',timestampMs,scale:'metric',matrix,worldMatrix:matrix.slice(),viewMatrix:identity(),
        projectionMatrix:result.projectionMatrix,projectionSource:result.projectionSource,
        diagnostics:{processingMs,inliers:result.inliers,reprojectionErrorPx:result.reprojectionErrorPx}};
      this.lastPose=pose;if(!this.seen){this.seen=true;found={targetId:this.id,timestampMs,pose};}
    }else if(this.state==='lost'){
      this.filter.reset();
      if(this.seen){this.seen=false;lost={targetId:this.id,timestampMs,retained:this.keep,reason:'lost'};}
    }
    const visible=!!this.lastPose&&(this.state!=='lost'||this.keep),changed=visible!==this.visible;this.visible=visible;
    return{...(pose?{pose}:{}),...(found?{found}:{}),...(lost?{lost}:{}),...(changed?{visibility:{targetId:this.id,visible,reason:result.status==='tracked'?'tracked' as const:this.state==='recovering'?'recovering' as const:'lost' as const}}:{}),quality};
  }
}
