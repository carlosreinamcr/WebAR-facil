/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
type Vector = readonly [number, number, number];
interface Sample {time: number; acceleration: Vector}
interface Observation {time: number; position: Vector; rotation: Float32Array}
interface Pair {visual: Vector; inertial: Vector}
type WindowRejection = 'visualCoverage' | 'sensorCoverage' | 'sensorGap' | 'weakVisualMotion' | 'weakInertialMotion';
type Interruption = 'poseGap' | 'trackingLost' | 'relocalized' | 'keyframeCorrection' | 'mapReset';
type Integration = {value:Vector} | {reason:'sensorCoverage'|'sensorGap'|'visualCoverage'};
type AxisValues = {x:number;y:number;z:number};
interface MotionSignal {
  windows:number;
  deviceAccelerationRmsMps2:AxisValues;
  worldAccelerationRmsMps2:AxisValues;
  integratedRmsMeters:AxisValues;
  meanAbsoluteIntegralMeters:AxisValues;
}
interface SignalTotals {
  windows:number;
  device:[number,number,number];
  world:[number,number,number];
  integrated:[number,number,number];
  absolute:[number,number,number];
}
interface GuidedPhase {
  firstPosition:Vector|null;
  lastPosition:Vector|null;
  firstPoseTime:number|null;
  lastPoseTime:number|null;
  mapRevision:number;
  visualPoses:number;
  stationaryPoses:number;
  maxExcursionUnits:number;
  started:number;
  ended:number|null;
  samples:number;
  usableSamples:number;
  sum:[number,number,number];
  squares:[number,number,number];
  peak:[number,number,number];
  integratedWindows:number;
  weakWindows:number;
}
interface GuidedPhaseDiagnostics {
  visualPoses:number;
  visualDisplacementUnits:number|null;
  visualDisplacementMeters:number|null;
  visualCoverageMs:number;
  stationaryPoses:number;
  maxExcursionUnits:number|null;
  durationMs:number;
  samples:number;
  usableSamples:number;
  accelerationPeakMps2:AxisValues|null;
  accelerationRmsMps2:AxisValues|null;
  accelerationStdDevMps2:AxisValues|null;
  integratedWindows:number;
  weakWindows:number;
}
const signalTotals=():SignalTotals=>({windows:0,device:[0,0,0],world:[0,0,0],integrated:[0,0,0],absolute:[0,0,0]});
interface OffsetWindow {visual:Vector; inertial:Vector[]}

export interface MetricScaleDiagnostics {
  permission: 'idle' | 'listening' | 'denied' | 'unavailable';
  motionEvents: number;
  samples: number;
  usableSamples: number;
  medianIntervalMs: number | null;
  largestGapMs: number;
  visualFrames: number;
  medianVisualIntervalMs: number | null;
  pairedWindows: number;
  relativeResidual: number | null;
  metersPerUnit: number | null;
  windowsEvaluated: number;
  windowsAccepted: number;
  rejectedWindows: Record<WindowRejection,number>;
  interruptions: Record<Interruption,number>;
  fitState: 'waiting' | 'inconsistent' | 'accepted';
  fitAttempts: number;
  timing: {
    comparableWindows: number;
    estimatedOffsetMs: number | null;
    zeroOffsetResidual: number | null;
    bestResidual: number | null;
  };
  lastTimingFit: MetricScaleDiagnostics['timing'] | null;
  motionSignal: {all:MotionSignal|null;weak:MotionSignal|null;guided:MotionSignal|null;guidedWeak:MotionSignal|null};
  guidedPhases: Record<string,GuidedPhaseDiagnostics>;
}

const halfWindowMs = 400;
const maxSensorGapMs = 65;
const maxPoseGapMs = 150;
const offsetsMs = [-120,-90,-60,-30,0,30,60,90,120] as const;
const emptyTiming = ():MetricScaleDiagnostics['timing'] => ({
  comparableWindows:0,estimatedOffsetMs:null,zeroOffsetResidual:null,bestResidual:null,
});
const axes = [0, 1, 2] as const;
const dot = (a: Vector, b: Vector): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

/** Experimental alignment of metric inertial and relative visual displacements. */
export class ExperimentalMetricScale {
  private samples: Sample[] = [];
  private observations: Observation[] = [];
  private pairs: Pair[] = [];
  private offsetWindows: OffsetWindow[] = [];
  private lastCenter = -Infinity;
  private lastAcceptedCenter = -Infinity;
  private lastSensorTime: number | null = null;
  private intervals: number[] = [];
  private visualIntervals: number[] = [];
  private signal=signalTotals();
  private weakSignal=signalTotals();
  private guidedSignal=signalTotals();
  private guidedWeakSignal=signalTotals();
  private guidedSince:number|null=null;
  private guidedPhases=new Map<string,GuidedPhase>();
  private activeGuidedPhase:GuidedPhase|null=null;
  private visualSince:number|null=null;
  private lastVisualTime:number|null=null;
  private mapRevision=0;
  private state: MetricScaleDiagnostics = {
    permission:'idle', motionEvents:0, samples:0, usableSamples:0, medianIntervalMs:null, largestGapMs:0,
    visualFrames:0, medianVisualIntervalMs:null, pairedWindows:0, relativeResidual:null, metersPerUnit:null,
    windowsEvaluated:0,windowsAccepted:0,
    rejectedWindows:{visualCoverage:0,sensorCoverage:0,sensorGap:0,weakVisualMotion:0,weakInertialMotion:0},
    interruptions:{poseGap:0,trackingLost:0,relocalized:0,keyframeCorrection:0,mapReset:0},
    fitState:'waiting',fitAttempts:0,timing:emptyTiming(),lastTimingFit:null,motionSignal:{all:null,weak:null,guided:null,guidedWeak:null},guidedPhases:{},
  };
  private generation = 0;

  /** Call directly from a user gesture, before awaiting camera startup. */
  async start(): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    this.state.metersPerUnit=null;
    this.clearAlignment();
    this.state.visualFrames=0;
    this.visualIntervals=[];
    this.samples=[];
    this.state.windowsEvaluated=0;
    this.state.windowsAccepted=0;
    this.state.fitAttempts=0;
    this.state.lastTimingFit=null;
    this.signal=signalTotals();
    this.weakSignal=signalTotals();
    this.guidedSignal=signalTotals();
    this.guidedWeakSignal=signalTotals();
    this.guidedPhases.clear();
    for(const reason of Object.keys(this.state.rejectedWindows) as WindowRejection[])this.state.rejectedWindows[reason]=0;
    for(const reason of Object.keys(this.state.interruptions) as Interruption[])this.state.interruptions[reason]=0;
    this.intervals = [];
    this.lastSensorTime = null;
    Object.assign(this.state,{permission:'idle',motionEvents:0,samples:0,usableSamples:0,medianIntervalMs:null,largestGapMs:0});
    if (typeof window === 'undefined' || !window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
      this.state.permission = 'unavailable';
      return false;
    }
    const api = DeviceMotionEvent as typeof DeviceMotionEvent & {requestPermission?:()=>Promise<string>};
    try {
      const granted = !api.requestPermission || await api.requestPermission() === 'granted';
      if (generation !== this.generation) return false;
      if (!granted) { this.state.permission = 'denied'; return false; }
    } catch {
      if (generation === this.generation) this.state.permission = 'denied';
      return false;
    }
    this.state.permission = 'listening';
    window.addEventListener('devicemotion', this.onMotion);
    return true;
  }

  /** Keep the last diagnostic available after stopping. */
  stop(): void {
    this.generation++;
    this.setGuidedMotionCapture(false);
    this.visualSince=null;this.lastVisualTime=null;
    if (typeof window !== 'undefined') window.removeEventListener('devicemotion', this.onMotion);
  }

  /** Aggregate the windows entirely contained in the current guided exercise. */
  setGuidedMotionCapture(active:boolean):void {
    this.pauseGuidedMotionPhase();
    this.guidedSince=active?performance.now():null;
    if(active){this.guidedSignal=signalTotals();this.guidedWeakSignal=signalTotals();this.guidedPhases.clear();}
  }

  /** True after a continuous interval of fresh optical poses, including poses before plane detection. */
  hasStableVisualTracking(now=performance.now()):boolean {
    return this.lastVisualTime!==null && this.visualSince!==null &&
      this.lastVisualTime-this.visualSince>=700 && now-this.lastVisualTime<=maxPoseGapMs;
  }

  pauseGuidedMotionPhase():void {
    if(this.activeGuidedPhase)this.activeGuidedPhase.ended=performance.now();
    this.activeGuidedPhase=null;
  }

  /** Mark the start of a named exercise phase on the same clock as sensor delivery. */
  setGuidedMotionPhase(id:string):void {
    if(this.guidedSince===null || !/^[a-z][a-zA-Z0-9]{0,31}$/.test(id) ||
      this.guidedPhases.has(id) || this.guidedPhases.size>=20)return;
    const now=performance.now();
    this.pauseGuidedMotionPhase();
    const phase:GuidedPhase={started:now,ended:null,samples:0,usableSamples:0,
      sum:[0,0,0],squares:[0,0,0],peak:[0,0,0],integratedWindows:0,weakWindows:0,
      firstPosition:null,lastPosition:null,firstPoseTime:null,lastPoseTime:null,mapRevision:this.mapRevision,
      visualPoses:0,stationaryPoses:0,maxExcursionUnits:0};
    this.guidedPhases.set(id,phase);
    this.activeGuidedPhase=phase;
  }

  diagnostics(): MetricScaleDiagnostics {
    const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]??null;
    return {...this.state,medianIntervalMs:median(this.intervals),medianVisualIntervalMs:median(this.visualIntervals),
      rejectedWindows:{...this.state.rejectedWindows},interruptions:{...this.state.interruptions},timing:{...this.state.timing},
      lastTimingFit:this.state.lastTimingFit?{...this.state.lastTimingFit}:null,
      motionSignal:{all:this.signalSnapshot(this.signal),weak:this.signalSnapshot(this.weakSignal),
        guided:this.signalSnapshot(this.guidedSignal),guidedWeak:this.signalSnapshot(this.guidedWeakSignal)},
      guidedPhases:Object.fromEntries([...this.guidedPhases].map(([id,phase])=>[id,this.phaseSnapshot(phase)]))};
  }

  private phaseSnapshot(phase:GuidedPhase):GuidedPhaseDiagnostics {
    const {samples}=phase;
    const ended=phase.ended??performance.now();
    const displacement=phase.firstPosition&&phase.lastPosition&&phase.visualPoses>1
      ?Math.hypot(...axes.map(axis=>phase.lastPosition![axis]-phase.firstPosition![axis])):null;
    const coverage=phase.firstPoseTime!==null&&phase.lastPoseTime!==null?phase.lastPoseTime-phase.firstPoseTime:0;
    const endpointsCovered=coverage>=700&&phase.ended!==null&&phase.firstPoseTime!==null&&phase.lastPoseTime!==null&&
      phase.firstPoseTime-phase.started<=250&&ended-phase.lastPoseTime<=250;
    const scale=this.state.metersPerUnit;
    const values=(read:(axis:0|1|2)=>number):AxisValues|null=>samples?{x:read(0),y:read(1),z:read(2)}:null;
    return {durationMs:Math.round(ended-phase.started),samples,usableSamples:phase.usableSamples,
      accelerationPeakMps2:values(axis=>phase.peak[axis]),
      accelerationRmsMps2:values(axis=>Math.sqrt(phase.squares[axis]/samples)),
      accelerationStdDevMps2:values(axis=>Math.sqrt(Math.max(0,phase.squares[axis]/samples-(phase.sum[axis]/samples)**2))),
      integratedWindows:phase.integratedWindows,weakWindows:phase.weakWindows,visualPoses:phase.visualPoses,
      visualDisplacementUnits:displacement,visualCoverageMs:Math.round(coverage),
      stationaryPoses:phase.stationaryPoses,maxExcursionUnits:phase.visualPoses>1?phase.maxExcursionUnits:null,
      visualDisplacementMeters:endpointsCovered&&phase.mapRevision===this.mapRevision&&scale!==null&&displacement!==null
        ?displacement*scale:null};
  }

  /** Compare the observed positions at the beginning and end of a completed round trip. */
  guidedReturnError(outboundId:string,inboundId:string):number|null {
    const outbound=this.guidedPhases.get(outboundId),inbound=this.guidedPhases.get(inboundId);
    if(!outbound?.firstPosition||!inbound?.lastPosition||outbound.mapRevision!==inbound.mapRevision||
       outbound.ended===null||inbound.ended===null||outbound.ended>inbound.started||
       outbound.firstPoseTime===null||outbound.lastPoseTime===null||inbound.firstPoseTime===null||inbound.lastPoseTime===null||
       outbound.lastPoseTime-outbound.firstPoseTime<700||inbound.lastPoseTime-inbound.firstPoseTime<700||
       outbound.firstPoseTime-outbound.started>250||inbound.ended-inbound.lastPoseTime>250)return null;
    return Math.hypot(...axes.map(axis=>inbound.lastPosition![axis]-outbound.firstPosition![axis]));
  }

  resetMap(): void {
    this.mapRevision++;
    this.state.metersPerUnit=null;
    this.interrupt('mapReset');
    this.clearAlignment();
    this.visualIntervals=[];
    Object.assign(this.state,{visualFrames:0,pairedWindows:0,relativeResidual:null,metersPerUnit:null});
  }

  /** Exclude windows that cross a lost pose, correction, or relocalization. */
  interrupt(reason:Interruption='trackingLost'): void {
    this.visualSince=null;this.lastVisualTime=null;
    this.pauseGuidedMotionPhase();
    if (!this.observations.length && !this.pairs.length) return;
    this.state.interruptions[reason]++;
    this.clearAlignment();
  }

  private clearAlignment(): void {
    this.observations = [];
    this.pairs = [];
    this.offsetWindows=[];
    this.lastCenter = -Infinity;
    this.lastAcceptedCenter = -Infinity;
    this.state.pairedWindows=0;
    this.state.relativeResidual=null;
    this.state.fitState=this.state.metersPerUnit===null?'waiting':'accepted';
    this.state.timing=emptyTiming();
  }

  private readonly onMotion = (event: DeviceMotionEvent): void => {
    this.state.motionEvents++;
    const angle = screen.orientation?.angle ?? (window as Window & {orientation?:number}).orientation ?? 0;
    const acceleration = event.acceleration;
    const rotation = event.rotationRate;
    // Rear-camera portrait axes. Keep samples only during modest rotation to limit lever-arm error.
    const x=acceleration?.x,y=acceleration?.y,z=acceleration?.z;
    const alpha=rotation?.alpha,beta=rotation?.beta,gamma=rotation?.gamma;
    if (typeof x!=='number'||typeof y!=='number'||typeof z!=='number'||
        typeof alpha!=='number'||typeof beta!=='number'||typeof gamma!=='number'||
        ![x,y,z,alpha,beta,gamma].every(Number.isFinite)) return;
    const time = performance.now();
    if (this.lastSensorTime !== null) {
      const gap = time-this.lastSensorTime;
      this.state.largestGapMs = Math.max(this.state.largestGapMs,gap);
      this.intervals.push(gap);
      if (this.intervals.length>240) this.intervals.shift();
    }
    this.lastSensorTime=time;
    this.state.samples++;
    const phase=this.activeGuidedPhase;
    const linear:Vector=[x,y,z];
    if(phase){
      phase.samples++;
      for(const axis of axes){
        phase.sum[axis]+=linear[axis];
        phase.squares[axis]+=linear[axis]**2;
        phase.peak[axis]=Math.max(phase.peak[axis],Math.abs(linear[axis]));
      }
    }
    if (angle!==0 || Math.hypot(alpha,beta,gamma)>50 || Math.hypot(x,y,z)>15) return;
    this.state.usableSamples++;
    if(phase)phase.usableSamples++;
    this.samples.push({time,acceleration:linear});
    while(this.samples.length && (this.samples.length>800 || this.samples[0]!.time<time-3200)) this.samples.shift();
  };

  /** Receives unfiltered T_world_camera and the frame read time on the same page clock. */
  observe(time: number, worldFromCamera: Float32Array, stationary=false): number | null {
    if(this.lastVisualTime!==null && (time<=this.lastVisualTime || time-this.lastVisualTime>maxPoseGapMs))this.interrupt('poseGap');
    this.visualSince??=time;
    this.lastVisualTime=time;
    const position:Vector=[worldFromCamera[12]!,worldFromCamera[13]!,worldFromCamera[14]!];
    const phase=this.activeGuidedPhase;
    if(phase && time>=phase.started){
      phase.firstPosition??=position;
      phase.firstPoseTime??=time;
      phase.lastPosition=position;
      phase.lastPoseTime=time;
      phase.visualPoses++;
      if(stationary)phase.stationaryPoses++;
      phase.maxExcursionUnits=Math.max(phase.maxExcursionUnits,
        Math.hypot(...axes.map(axis=>position[axis]-phase.firstPosition![axis])));
    }
    if (this.state.metersPerUnit!==null) return this.state.metersPerUnit;
    this.state.visualFrames++;
    const previous=this.observations.at(-1);
    if (previous && time>previous.time) {
      this.visualIntervals.push(time-previous.time);
      if(this.visualIntervals.length>120)this.visualIntervals.shift();
    }
    this.observations.push({time,position,rotation:worldFromCamera});
    while(this.observations.length && this.observations[0]!.time<time-2200) this.observations.shift();
    if (this.state.permission!=='listening') return null;
    // Leave enough headroom to compare all offsets on the same visual window.
    const end=time-135;
    const center=end-halfWindowMs;
    if(center-this.lastCenter<2*halfWindowMs) return null;
    const start=end-2*halfWindowMs;
    if(this.lastCenter===-Infinity&&start<=this.observations[0]!.time)return null;
    this.lastCenter=center;
    if(this.pairs.length && center-this.lastAcceptedCenter>5000){
      this.pairs=[];
      this.state.pairedWindows=0;
      this.state.relativeResidual=null;
      this.state.fitState='waiting';
    }
    this.state.windowsEvaluated++;
    const a=this.visualAt(start),b=this.visualAt(center),c=this.visualAt(end);
    if(!a||!b||!c) {this.state.rejectedWindows.visualCoverage++;return null;}
    const visual: Vector=[a[0]-2*b[0]+c[0],a[1]-2*b[1]+c[1],a[2]-2*b[2]+c[2]];
    if(Math.hypot(...visual)<1e-5){this.state.rejectedWindows.weakVisualMotion++;return null;}
    const signal=signalTotals();
    const inertial=this.integrate(start,center,end,0,signal);
    if('reason' in inertial){this.state.rejectedWindows[inertial.reason]++;return null;}
    const weak=Math.hypot(...inertial.value)<.025;
    this.accumulateSignal(this.signal,signal,inertial.value);
    if(weak)this.accumulateSignal(this.weakSignal,signal,inertial.value);
    if(this.guidedSince!==null && start>=this.guidedSince){
      this.accumulateSignal(this.guidedSignal,signal,inertial.value);
      if(weak)this.accumulateSignal(this.guidedWeakSignal,signal,inertial.value);
      for(const phase of this.guidedPhases.values()){
        if(start>=phase.started && (phase.ended===null || end<=phase.ended)){
          phase.integratedWindows++;
          if(weak)phase.weakWindows++;
          break;
        }
      }
    }
    this.measureOffset(visual,start,center,end,inertial.value);
    if(weak){this.state.rejectedWindows.weakInertialMotion++;return null;}
    this.pairs.push({visual,inertial:inertial.value});
    this.lastAcceptedCenter=center;
    this.state.windowsAccepted++;
    if(this.pairs.length>12) this.pairs.shift();
    this.state.pairedWindows=this.pairs.length;
    if(this.pairs.length<6) return null;
    this.state.fitAttempts++;
    const split=Math.floor(this.pairs.length/2);
    const all=this.fit(this.pairs);
    const first=this.fit(this.pairs.slice(0,split));
    const second=this.fit(this.pairs.slice(split));
    this.state.relativeResidual=all?.residual??null;
    this.state.fitState='inconsistent';
    if(all&&first&&second&&all.residual<.32&&first.residual<.4&&second.residual<.4&&
       Math.abs(first.scale-second.scale)/all.scale<.22) {
      this.state.metersPerUnit=all.scale;
      this.state.fitState='accepted';
    }
    return this.state.metersPerUnit;
  }

  private visualAt(time: number): Vector | null {
    const index=this.observations.findIndex(item=>item.time>=time);
    if(index<1) return null;
    const a=this.observations[index-1]!,b=this.observations[index]!;
    const t=(time-a.time)/(b.time-a.time);
    return axes.map(axis=>a.position[axis]+(b.position[axis]-a.position[axis])*t) as unknown as Vector;
  }

  private worldAcceleration(sample: Sample): Vector | null {
    const index=this.observations.findIndex(pose=>pose.time>=sample.time);
    if(index<1) return null;
    const a=this.observations[index-1]!,b=this.observations[index]!;
    const t=(sample.time-a.time)/(b.time-a.time);
    const [x,y,z]=sample.acceleration;
    const row=(m: Float32Array, axis: number)=>m[axis]!*x+m[axis+4]!*y+m[axis+8]!*z;
    return axes.map(axis=>row(a.rotation,axis)*(1-t)+row(b.rotation,axis)*t) as unknown as Vector;
  }

  private integrate(start: number, center: number, end: number, offset=0, signal?:SignalTotals): Integration {
    const index=this.samples.findIndex(sample=>sample.time>=start+offset);
    if(index<1) return {reason:'sensorCoverage'};
    const sum:[number,number,number]=[0,0,0];
    let time=start;
    for(let i=index;i<this.samples.length&&time<end;i++){
      const a=this.samples[i-1]!,b=this.samples[i]!;
      if(b.time-a.time>maxSensorGapMs) return {reason:'sensorGap'};
      const next=Math.min(b.time-offset,end);
      if(next<=time) continue;
      const midpoint=(time+next)/2;
      const fraction=(midpoint+offset-a.time)/(b.time-a.time);
      const acceleration=axes.map(axis=>a.acceleration[axis]+(b.acceleration[axis]-a.acceleration[axis])*fraction) as unknown as Vector;
      const world=this.worldAcceleration({time:midpoint,acceleration});
      if(!world) return {reason:'visualCoverage'};
      const weight=(halfWindowMs-Math.abs(midpoint-center))*(next-time)/1e6;
      for(const axis of axes) {
        const contribution=world[axis]*weight;
        sum[axis]+=contribution;
        if(signal){
          const portion=(next-time)/(end-start);
          signal.device[axis]+=acceleration[axis]**2*portion;
          signal.world[axis]+=world[axis]**2*portion;
          signal.absolute[axis]+=Math.abs(contribution);
        }
      }
      time=next;
    }
    return time===end?{value:sum}:{reason:'sensorCoverage'};
  }

  private accumulateSignal(total:SignalTotals,window:SignalTotals,integrated:Vector):void {
    total.windows++;
    for(const axis of axes){
      total.device[axis]+=window.device[axis];
      total.world[axis]+=window.world[axis];
      total.integrated[axis]+=integrated[axis]**2;
      total.absolute[axis]+=window.absolute[axis];
    }
  }

  private signalSnapshot(total:SignalTotals):MotionSignal|null {
    if(!total.windows)return null;
    const values=(data:Vector,rms:boolean):AxisValues=>{
      const component=(axis:0|1|2)=>rms?Math.sqrt(data[axis]/total.windows):data[axis]/total.windows;
      return {x:component(0),y:component(1),z:component(2)};
    };
    return {windows:total.windows,deviceAccelerationRmsMps2:values(total.device,true),
      worldAccelerationRmsMps2:values(total.world,true),integratedRmsMeters:values(total.integrated,true),
      meanAbsoluteIntegralMeters:values(total.absolute,false)};
  }

  private measureOffset(visual:Vector,start:number,center:number,end:number,baseline:Vector):void {
    const inertial:Vector[]=[];
    for(const offset of offsetsMs){
      const result=offset===0?{value:baseline}:this.integrate(start,center,end,offset);
      if('reason' in result)return;
      inertial.push(result.value);
    }
    this.offsetWindows.push({visual,inertial});
    if(this.offsetWindows.length>16)this.offsetWindows.shift();
    const windows=this.offsetWindows;
    this.state.timing={...emptyTiming(),comparableWindows:windows.length};
    if(windows.length<6)return;
    type Score={offset:number;residual:number};
    const rank=(items:OffsetWindow[]):Score[]=>offsetsMs.flatMap((offset,index)=>{
      const fit=this.fit(items.map(window=>({visual:window.visual,inertial:window.inertial[index]!})));
      return fit?[{offset,residual:fit.residual}]:[];
    });
    const best=(scores:Score[])=>scores.reduce<Score|null>((winner,item)=>
      !winner || item.residual<winner.residual ?item:winner,null);
    const all=rank(windows),winner=best(all);
    const split=Math.floor(windows.length/2);
    const first=best(rank(windows.slice(0,split))),second=best(rank(windows.slice(split)));
    const alternative=best(all.filter(item=>Math.abs(item.offset-(winner?.offset??0))>=60));
    this.state.timing.zeroOffsetResidual=all.find(item=>item.offset===0)?.residual??null;
    this.state.timing.bestResidual=winner?.residual??null;
    if(winner&&first&&second&&alternative&&Math.abs(winner.offset)<120&&winner.residual<.4&&
      alternative.residual-winner.residual>.025&&Math.abs(first.offset-winner.offset)<=30&&Math.abs(second.offset-winner.offset)<=30){
      this.state.timing.estimatedOffsetMs=winner.offset;
    }
    this.state.lastTimingFit={...this.state.timing};
  }

  private fit(pairs: Pair[]): {scale:number;residual:number} | null {
    // Remove the mean to reduce the effect of a constant world-frame acceleration bias.
    const mean=(key:'visual'|'inertial')=>axes.map(axis=>pairs.reduce((sum,pair)=>sum+pair[key][axis],0)/pairs.length);
    const v=mean('visual'),a=mean('inertial');
    let vv=0,va=0,aa=0;
    for(const pair of pairs){
      const visual=axes.map(i=>pair.visual[i]-v[i]!) as unknown as Vector;
      const inertial=axes.map(i=>pair.inertial[i]-a[i]!) as unknown as Vector;
      vv+=dot(visual,visual);va+=dot(visual,inertial);aa+=dot(inertial,inertial);
    }
    const scale=va/vv;
    if(!(aa/pairs.length>.0004 && scale>.001 && scale<1000)) return null;
    return {scale,residual:Math.sqrt(Math.max(0,1-va*va/(vv*aa)))};
  }
}
