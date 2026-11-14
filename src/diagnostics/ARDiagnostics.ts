/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {TRACKING_STAGES,TRACKING_COUNTS,copyTrackingProfile} from '../tracking/profile.ts';
import type {WebAREngine} from '../WebAREngine';
import type {ARPose} from '../Pose';
import type {CameraMetrics} from '../camera/CameraManager';
import {ODOMETRY_STAGES} from '../slam/OdometryBackend.ts';
import {LIBRARY_VERSION,LIBRARY_BUILD} from '../build-info.ts';

export type DeviceTestResult='pending'|'pass'|'fail'|'not-supported';
export interface DiagnosticContext {
  platform?:'ios'|'android'|'desktop'|'other';
  execution?:'unspecified'|'automated'|'physical-user-reported';
  deviceModel?:string;osVersion?:string;browserVersion?:string;scenario?:string;
}
export interface DiagnosticConfiguration {mode?:string;backend?:string;performance?:string;maxFramePixels?:number;analysisWidth?:number;requestedFPS?:number;lossGraceMs?:number;keepContentOnLost?:boolean;manualPlacement?:boolean;keyframeCorrection?:boolean;renderPixelRatio?:number;antialias?:boolean;}
export interface DiagnosticOptions {context?:DiagnosticContext;configuration?:DiagnosticConfiguration;sampleLimit?:number;now?:()=>number;}
export interface DiagnosticStats {count:number;mean:number|null;min:number|null;max:number|null;p50:number|null;p95:number|null;quantileSamples:number;}
/** Contadores del renderer, no tiempo GPU ni bytes de VRAM. */
export interface DiagnosticRendererMetrics {drawCalls:number;triangles:number;geometries:number;textures:number;drawingBufferWidth:number;drawingBufferHeight:number;pixelRatio:number;}
export interface DiagnosticReport {
  schemaVersion:1;kind:'webar-diagnostics';sdk:{version:string;build:string};createdAt:string;durationMs:number;recording:boolean;
  context:Required<DiagnosticContext>;
  configuration:DiagnosticConfiguration;
  environment:{userAgent:string;secureContext:boolean;cameraAPI:boolean;webgl2API:boolean;xrAPI:boolean;immersiveAR:boolean|null};
  camera:Record<string,string|number|boolean>;state:string;targets:Record<string,{found:number;lost:number;ended:number;firstFoundMs:number|null;recoveriesMs:number[]}>;
  poses:{count:number;backends:Record<string,number>;scales:Record<string,number>;projectionSources:Record<string,number>;relocalized:number;keyframeCorrected:number;firstPoseMs:number|null};
  quality:{samples:Record<string,number>;issues:Record<string,number>;diagnosis:'heuristic'};
  metrics:{processingMs:DiagnosticStats;readbackMs:DiagnosticStats;consumerMs:DiagnosticStats;renderLoopMs:DiagnosticStats;poseStepTranslation:DiagnosticStats;poseStepRotationDegrees:DiagnosticStats;reprojectionErrorPx:DiagnosticStats;latestCamera:CameraMetrics|null};
  odometry:{frames:number;stages:Record<typeof ODOMETRY_STAGES[number],DiagnosticStats>};
  tracking:{frames:number;stages:Record<typeof TRACKING_STAGES[number],DiagnosticStats>;paths:Record<typeof TRACKING_COUNTS[number],number>};
  renderer:{latest:DiagnosticRendererMetrics|null;peakDrawCalls:number;peakTriangles:number};
  timeline:{atMs:number;event:string;detail:string}[];
  observations:{atMs:number;testId:string;result:DeviceTestResult;notes:string}[];
  limits:{sampleLimit:number;timelineLimit:number;observationLimit:number;quantiles:'latest bounded samples';poseSteps:'not physical jitter or drift';renderLoop:'callback interval, not completed GPU frames';physicalValidation:'operator-declared, not independently certified'};
}
class Stats {
  private values:number[]=[];private cursor=0;private count=0;private sum=0;private minimum=Infinity;private maximum=-Infinity;
  private readonly limit:number;
  constructor(limit:number){this.limit=limit;}
  add(value:number):void{if(!Number.isFinite(value)||value<0)return;this.count++;this.sum+=value;this.minimum=Math.min(this.minimum,value);this.maximum=Math.max(this.maximum,value);
    if(this.values.length<this.limit)this.values.push(value);else{this.values[this.cursor]=value;this.cursor=(this.cursor+1)%this.limit;}}
  snapshot():DiagnosticStats{const values=[...this.values].sort((a,b)=>a-b),q=(p:number)=>values[Math.min(values.length-1,Math.floor(values.length*p))]??null;
    return{count:this.count,mean:this.count?this.sum/this.count:null,min:this.count?this.minimum:null,max:this.count?this.maximum:null,p50:q(.5),p95:q(.95),quantileSamples:values.length};}
}
const clean=(value:string,limit=240)=>value.replace(/(?:https?:\/\/|file:\/\/\/)[^\s)]+/gi,'[url]').replace(/\b[A-Z]:[\\/][^\s]+/gi,'[path]').slice(0,limit);
const increment=(counts:Record<string,number>,key:string)=>{if(key in counts||Object.keys(counts).length<32)counts[key]=(counts[key]??0)+1;};
type Source=Pick<WebAREngine,'state'|'cameraSettings'|'targetIds'|'onPose'|'onStatus'|'onError'|'onMetrics'|'onTargetFound'|'onTargetLost'|'onTrackingQuality'>;

/** Telemetría local opt-in y acotada. No persiste frames/mapas ni exporta matrices/URLs de contenido. */
export class ARDiagnostics {
  private source:Source|null;
  private readonly subscriptions:(()=>void)[]=[];
  private readonly now:()=>number;
  private readonly started:number;
  private ended:number|null=null;
  private context:Required<DiagnosticContext>={platform:'other',execution:'unspecified',deviceModel:'',osVersion:'',browserVersion:'',scenario:''};
  private readonly sampleLimit:number;
  private readonly processing:Stats;private readonly readback:Stats;private readonly consumer:Stats;private readonly render:Stats;private readonly translation:Stats;private readonly rotation:Stats;private readonly reprojection:Stats;
  private odometryFrames=0;
  private odometryStages:Record<typeof ODOMETRY_STAGES[number],Stats>;
  private trackingFrames=0;
  private trackingStages:Record<typeof TRACKING_STAGES[number],Stats>;
  private trackingPaths=Object.fromEntries(TRACKING_COUNTS.map(key=>[key,0])) as DiagnosticReport['tracking']['paths'];
  private renderer:DiagnosticReport['renderer']={latest:null,peakDrawCalls:0,peakTriangles:0};
  private latestCamera:CameraMetrics|null=null;private camera:Record<string,string|number|boolean>={};
  private state:string;private lastRender:number|null=null;private active=false;
  private targets:DiagnosticReport['targets']=Object.create(null) as DiagnosticReport['targets'];
  private losses=new Map<string,number>();private previous=new Map<string,Float32Array>();
  private poses:DiagnosticReport['poses']={count:0,backends:Object.create(null),scales:Object.create(null),projectionSources:Object.create(null),relocalized:0,keyframeCorrected:0,firstPoseMs:null};
  private quality:DiagnosticReport['quality']={samples:Object.create(null),issues:Object.create(null),diagnosis:'heuristic'};
  private timeline:DiagnosticReport['timeline']=[];private observations:DiagnosticReport['observations']=[];
  private lastError:{message:string;at:number}|null=null;
  private readonly createdAt=new Date().toISOString();
  private immersiveAR:boolean|null=null;
  private readonly configuration:DiagnosticConfiguration={};
  constructor(source:Source,options:DiagnosticOptions={}){
    this.sampleLimit=options.sampleLimit??1024;if(!Number.isInteger(this.sampleLimit)||this.sampleLimit<16||this.sampleLimit>8192)throw new Error('sampleLimit debe estar entre 16 y 8192.');
    this.now=options.now??(()=>performance.now());this.started=this.now();this.source=source;this.state=source.state;
    this.trackingStages=Object.fromEntries(TRACKING_STAGES.map(key=>[key,new Stats(this.sampleLimit)])) as Record<typeof TRACKING_STAGES[number],Stats>;
    this.odometryStages=Object.fromEntries(ODOMETRY_STAGES.map(key=>[key,new Stats(this.sampleLimit)])) as typeof this.odometryStages;
    this.consumer=new Stats(this.sampleLimit);
    this.processing=new Stats(this.sampleLimit);this.readback=new Stats(this.sampleLimit);this.render=new Stats(this.sampleLimit);this.translation=new Stats(this.sampleLimit);this.rotation=new Stats(this.sampleLimit);this.reprojection=new Stats(this.sampleLimit);
    this.setContext(options.context??{});this.captureCamera();this.mark('diagnostics-start');
    for(const key of ['mode','backend','performance'] as const){const value=options.configuration?.[key];if(typeof value==='string')this.configuration[key]=clean(value,64);}
    for(const key of ['analysisWidth','maxFramePixels','requestedFPS','lossGraceMs','renderPixelRatio'] as const){const value=options.configuration?.[key];if(typeof value==='number'&&Number.isFinite(value)&&value>=0)this.configuration[key]=value;}
    for(const key of ['keepContentOnLost','manualPlacement','keyframeCorrection','antialias'] as const){const value=options.configuration?.[key];if(typeof value==='boolean')this.configuration[key]=value;}
    this.subscriptions.push(source.onMetrics(metrics=>{const profile=copyTrackingProfile(metrics.tracking);this.latestCamera={...metrics,...(profile?{tracking:profile}:{})};if(profile){this.trackingFrames++;for(const key of TRACKING_STAGES)this.trackingStages[key].add(profile.timings[key]);for(const key of TRACKING_COUNTS)this.trackingPaths[key]+=profile.counts[key];}if(metrics.odometry){
        this.odometryFrames++;
        for(const key of ODOMETRY_STAGES){const elapsed=metrics.odometry[key];if(elapsed!==undefined)this.odometryStages[key].add(elapsed);}
        this.latestCamera.odometry={...metrics.odometry};
      }
      this.processing.add(metrics.processingMs);this.readback.add(metrics.readbackMs);
      if(metrics.consumerMs!==undefined)this.consumer.add(metrics.consumerMs);this.captureCamera();}),
      source.onStatus(message=>{this.state=source.state;this.active=!['Idle','Disposed'].includes(source.state)&&!['stopped','camera-suspended','starting-webxr'].includes(message);this.lastRender=null;this.captureCamera();this.mark('status',message);
        if(['stopped','camera-suspended','odometry-lost','tracking-lost'].includes(message))this.previous.clear();}),
      source.onPose((_matrix,pose)=>this.pose(pose)),source.onError(error=>this.recordError(error)),
      source.onTargetFound(event=>{const target=this.target(event.targetId);target.found++;target.firstFoundMs??=this.elapsed();const lost=this.losses.get(event.targetId);if(lost!==undefined){target.recoveriesMs.push(this.elapsed()-lost);if(target.recoveriesMs.length>128)target.recoveriesMs.shift();this.losses.delete(event.targetId);}this.mark('targetFound',event.targetId);}),
      source.onTargetLost(event=>{const target=this.target(event.targetId);if(event.reason==='lost'){target.lost++;if(this.losses.size<32||this.losses.has(event.targetId))this.losses.set(event.targetId,this.elapsed());}else{target.ended++;this.losses.delete(event.targetId);}this.mark('targetLost',`${event.targetId}:${event.reason}`);}),
      source.onTrackingQuality(event=>{increment(this.quality.samples,event.state);event.issues.forEach(issue=>increment(this.quality.issues,issue));}));
  }
  private elapsed():number{return Math.max(0,(this.ended??this.now())-this.started);}
  private target(id:string):DiagnosticReport['targets'][string]{
    const value=clean(id,64),key=value in this.targets||Object.keys(this.targets).length<32?value:'[other]';return this.targets[key]??(this.targets[key]={found:0,lost:0,ended:0,firstFoundMs:null,recoveriesMs:[]});
  }
  private captureCamera():void{
    const settings=this.source?.cameraSettings;if(!settings)return;
    for(const key of ['width','height','frameRate','facingMode','resizeMode','focusMode'] as const){const value=(settings as unknown as Record<string,unknown>)[key];if(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))this.camera[key]=typeof value==='string'?clean(value,60):value;}
  }
  private pose(pose:ARPose):void{
    if(this.ended!==null)return;this.captureCamera();this.active=true;this.poses.count++;this.poses.firstPoseMs??=this.elapsed();
    increment(this.poses.backends,pose.backend);increment(this.poses.scales,pose.scale);increment(this.poses.projectionSources,pose.projectionSource??'unknown');
    if(pose.diagnostics?.relocalized)this.poses.relocalized++;if(pose.diagnostics?.keyframeCorrected)this.poses.keyframeCorrected++;
    if(pose.diagnostics)this.reprojection.add(pose.diagnostics.reprojectionErrorPx);
    const key=`${pose.backend}:${pose.targetId??'default'}`,last=this.previous.get(key),matrix=pose.matrix;
    if(last){this.translation.add(Math.hypot(matrix[12]!-last[12]!,matrix[13]!-last[13]!,matrix[14]!-last[14]!));
      const trace=[0,1,2,4,5,6,8,9,10].reduce((sum,index)=>sum+matrix[index]!*last[index]!,0);this.rotation.add(Math.acos(Math.max(-1,Math.min(1,(trace-1)/2)))*180/Math.PI);}
    if(this.previous.size<16||this.previous.has(key))this.previous.set(key,matrix.slice());
  }
  setContext(context:DiagnosticContext):void{
    if(context.platform!==undefined&&!['ios','android','desktop','other'].includes(context.platform))throw new Error('Plataforma declarada inválida.');
    if(context.platform)this.context.platform=context.platform;
    if(context.execution!==undefined&&!['unspecified','automated','physical-user-reported'].includes(context.execution))throw new Error('Tipo de ejecución inválido.');
    if(context.execution)this.context.execution=context.execution;
    for(const key of ['deviceModel','osVersion','browserVersion','scenario'] as const)if(context[key]!==undefined)this.context[key]=clean(context[key]!,160);
  }
  mark(event:string,detail=''):void{if(this.ended!==null)return;this.timeline.push({atMs:this.elapsed(),event:clean(event,64),detail:clean(detail)});if(this.timeline.length>256)this.timeline.shift();}
  observe(testId:string,result:DeviceTestResult,notes=''):void{
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(testId)||!['pending','pass','fail','not-supported'].includes(result))throw new Error('Observación de prueba inválida.');
    this.observations.push({atMs:this.elapsed(),testId,result,notes:clean(notes,500)});if(this.observations.length>128)this.observations.shift();
  }
  recordError(error:Error):void{const message=clean(`${error.name}: ${error.message}`),at=this.elapsed();if(this.lastError?.message===message&&at-this.lastError.at<100)return;this.lastError={message,at};this.mark('error',message);}
  recordRenderer(input:DiagnosticRendererMetrics):void{
    if(this.ended!==null)return;
    const latest={} as DiagnosticRendererMetrics;
    for(const key of ['drawCalls','triangles','geometries','textures','drawingBufferWidth','drawingBufferHeight','pixelRatio'] as const){
      const value=input[key];if(!Number.isFinite(value)||value<0)return;latest[key]=value;
    }
    this.renderer.latest=latest;this.renderer.peakDrawCalls=Math.max(this.renderer.peakDrawCalls,latest.drawCalls);this.renderer.peakTriangles=Math.max(this.renderer.peakTriangles,latest.triangles);
  }
  recordRenderFrame():void{
    const now=this.now();if(this.ended!==null||!this.active||typeof document!=='undefined'&&document.visibilityState==='hidden'){this.lastRender=null;return;}
    if(this.lastRender!==null&&now-this.lastRender<1000)this.render.add(now-this.lastRender);this.lastRender=now;
  }
  async probeCapabilities():Promise<void>{
    try{this.immersiveAR=typeof navigator!=='undefined'&&navigator.xr?await navigator.xr.isSessionSupported('immersive-ar'):false;}catch{this.immersiveAR=null;}
  }
  stop():void{if(this.ended!==null)return;this.captureCamera();this.state=this.source?.state??this.state;this.mark('diagnostics-stop');this.ended=this.now();this.subscriptions.forEach(off=>off());this.subscriptions.length=0;this.source=null;this.previous.clear();}
  snapshot():DiagnosticReport{
    return{schemaVersion:1,kind:'webar-diagnostics',sdk:{version:LIBRARY_VERSION,build:LIBRARY_BUILD},createdAt:this.createdAt,durationMs:this.elapsed(),recording:this.ended===null,context:{...this.context},configuration:{...this.configuration},
      environment:{userAgent:typeof navigator==='undefined'?'':clean(navigator.userAgent,500),secureContext:globalThis.isSecureContext??false,cameraAPI:typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getUserMedia,webgl2API:typeof WebGL2RenderingContext!=='undefined',xrAPI:typeof navigator!=='undefined'&&!!navigator.xr,immersiveAR:this.immersiveAR},
      camera:{...this.camera},state:this.source?.state??this.state,targets:Object.fromEntries(Object.entries(this.targets).map(([id,target])=>[id,{...target,recoveriesMs:[...target.recoveriesMs]}])),
      poses:{...this.poses,backends:{...this.poses.backends},scales:{...this.poses.scales},projectionSources:{...this.poses.projectionSources}},quality:{samples:{...this.quality.samples},issues:{...this.quality.issues},diagnosis:'heuristic'},
      metrics:{processingMs:this.processing.snapshot(),readbackMs:this.readback.snapshot(),consumerMs:this.consumer.snapshot(),renderLoopMs:this.render.snapshot(),poseStepTranslation:this.translation.snapshot(),poseStepRotationDegrees:this.rotation.snapshot(),reprojectionErrorPx:this.reprojection.snapshot(),latestCamera:this.latestCamera?{...this.latestCamera,...(this.latestCamera.tracking?{tracking:copyTrackingProfile(this.latestCamera.tracking)!}:{}),...(this.latestCamera.odometry?{odometry:{...this.latestCamera.odometry}}:{})}:null},
      odometry:{frames:this.odometryFrames,stages:Object.fromEntries(ODOMETRY_STAGES.map(key=>[key,this.odometryStages[key].snapshot()])) as DiagnosticReport['odometry']['stages']},
      tracking:{frames:this.trackingFrames,stages:Object.fromEntries(TRACKING_STAGES.map(key=>[key,this.trackingStages[key].snapshot()])) as DiagnosticReport['tracking']['stages'],paths:{...this.trackingPaths}},
      renderer:{...this.renderer,latest:this.renderer.latest?{...this.renderer.latest}:null},
      timeline:this.timeline.map(item=>({...item})),observations:this.observations.map(item=>({...item})),
      limits:{sampleLimit:this.sampleLimit,timelineLimit:256,observationLimit:128,quantiles:'latest bounded samples',poseSteps:'not physical jitter or drift',renderLoop:'callback interval, not completed GPU frames',physicalValidation:'operator-declared, not independently certified'}};
  }
  download(filename='webar-diagnostics.json'):void{
    const blob=new Blob([JSON.stringify(this.snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
