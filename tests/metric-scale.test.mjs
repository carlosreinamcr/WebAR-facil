import assert from 'node:assert/strict';
import test from 'node:test';
import {ExperimentalMetricScale} from '../src/slam/ExperimentalMetricScale.ts';

function run(t, motion, {sensorStep=10, poseStep=40, sensorDelayMs=0, onTime}={}) {
  let time=0;
  let listener;
  t.mock.method(performance,'now',()=>time);
  const globals={
    window:{
      isSecureContext:true,
      addEventListener:(_event, callback)=>{listener=callback;},
      removeEventListener:()=>{listener=undefined;},
    },
    screen:{orientation:{angle:0}},
    DeviceMotionEvent:{requestPermission:async()=>'granted'},
  };
  for(const [key,value] of Object.entries(globals)){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>old?Object.defineProperty(globalThis,key,old):Reflect.deleteProperty(globalThis,key));
  }
  return (async()=>{
    const estimate=new ExperimentalMetricScale();
    assert.equal(await estimate.start(),true);
    // A fixed camera orientation maps device +X to world +Y.
    for(time=0;time<=15000;time+=10){
      onTime?.(estimate,time);
      const {position}=motion(time/1000);
      const {acceleration}=motion((time-sensorDelayMs)/1000);
      if(time%sensorStep===0)listener({acceleration:{x:acceleration,y:0,z:0},rotationRate:{alpha:0,beta:0,gamma:0}});
      if(time%poseStep===0)estimate.observe(time,new Float32Array([0,1,0,0,-1,0,0,0,0,0,1,0,0,position,0,1]));
    }
    return estimate;
  })();
}

const omega=3.3;
const moving=(t, sign=1)=>({
  position:.3*Math.sin(omega*t)/.8,
  acceleration:sign*(-.3*omega*omega*Math.sin(omega*t))+.18,
});

test('guided phases report rest noise and movement peaks independently', async t=>{
  const estimate=await run(t,time=>({
    position:.1*time*time,
    acceleration:time<4?.1:1.2*Math.sin(8*time),
  }),{onTime(metric,time){
    if(time===0){metric.setGuidedMotionCapture(true);metric.setGuidedMotionPhase('baseline');}
    if(time===4000)metric.setGuidedMotionPhase('right1');
    if(time===6000)metric.setGuidedMotionCapture(false);
  }});
  const {baseline,right1}=estimate.diagnostics().guidedPhases;
  assert.equal(baseline.durationMs,4000);
  assert.equal(baseline.samples,400);
  assert.ok(baseline.accelerationStdDevMps2.x<1e-6);
  assert.equal(baseline.accelerationPeakMps2.x,.1);
  assert.equal(right1.durationMs,2000);
  assert.equal(right1.samples,200);
  assert.ok(right1.accelerationPeakMps2.x>1.1);
  assert.ok(right1.integratedWindows>0);
  assert.ok(right1.visualDisplacementUnits>0);
  estimate.stop();
});

test('visual readiness waits for continuous poses and clears on loss',async t=>{
  const readiness=[];
  const estimate=await run(t,moving,{onTime(metric,time){
    if([400,800,1000,1040,1800].includes(time)){
      if(time===1000)metric.interrupt();
      readiness.push(metric.hasStableVisualTracking());
    }
  }});
  assert.deepEqual(readiness,[false,true,false,false,true]);
  assert.equal(estimate.hasStableVisualTracking(16000),false);
  estimate.stop();
});

test('metric scale recovers a synthetic translation and clears on a new map', async t=>{
  const estimate=await run(t,moving);
  const diagnostics=estimate.diagnostics();
  assert.ok(Math.abs(diagnostics.metersPerUnit-.8)<.03,JSON.stringify(diagnostics));
  assert.equal(diagnostics.medianIntervalMs,10);
  estimate.resetMap();
  assert.equal(estimate.diagnostics().metersPerUnit,null);
  estimate.stop();
});

test('guided displacement uses an accepted scale only for the same map and complete pose coverage',async t=>{
  const estimate=await run(t,moving,{onTime(metric,time){
    if(time===8000){metric.setGuidedMotionCapture(true);metric.setGuidedMotionPhase('right1');}
    if(time===10000)metric.setGuidedMotionPhase('left1');
    if(time===10080)metric.setGuidedMotionCapture(false);
  }});
  const d=estimate.diagnostics();
  const {right1,left1}=d.guidedPhases;
  assert.ok(right1.visualCoverageMs>=1900);
  assert.ok(right1.visualDisplacementMeters>0);
  assert.ok(Math.abs(right1.visualDisplacementMeters-right1.visualDisplacementUnits*.8)<.01);
  assert.equal(left1.visualDisplacementMeters,null);
  estimate.resetMap();
  assert.equal(estimate.diagnostics().guidedPhases.right1.visualDisplacementMeters,null);
  estimate.stop();
});

test('motion diagnostics separate axis rotation and cancellation inside a window',async t=>{
  const estimate=await run(t,time=>({
    position:.1*time*time,
    acceleration:Math.sin(2*Math.PI*(time-.425)/.8),
  }));
  const signal=estimate.diagnostics().motionSignal.weak;
  assert.ok(signal?.windows>0);
  assert.ok(signal.deviceAccelerationRmsMps2.x>.6);
  assert.equal(signal.deviceAccelerationRmsMps2.y,0);
  assert.ok(signal.worldAccelerationRmsMps2.y>.6);
  assert.ok(signal.meanAbsoluteIntegralMeters.y>.08);
  assert.ok(signal.integratedRmsMeters.y<.005);
  estimate.stop();
});

test('metric scale rejects insufficient motion', async t=>{
  const estimate=await run(t,time=>({position:time,acceleration:0}));
  assert.equal(estimate.diagnostics().metersPerUnit,null);
  estimate.stop();
});

test('metric scale rejects sensor gaps', async t=>{
  const estimate=await run(t,moving,{sensorStep:80});
  assert.equal(estimate.diagnostics().metersPerUnit,null);
  assert.equal(estimate.diagnostics().largestGapMs,80);
  assert.ok(estimate.diagnostics().rejectedWindows.sensorGap>0);
  estimate.stop();
});

test('metric scale diagnoses an effective sensor delay without applying it to the scale', async t=>{
  const estimate=await run(t,time=>({
    position:.2*Math.sin(7*time)/.8,
    acceleration:-.2*49*Math.sin(7*time),
  }),{sensorDelayMs:90});
  const d=estimate.diagnostics();
  assert.ok(Math.abs(d.timing.estimatedOffsetMs-90)<=30,JSON.stringify(d));
  assert.ok(d.timing.bestResidual<d.timing.zeroOffsetResidual);
  assert.equal(d.metersPerUnit,null);
  estimate.interrupt('relocalized');
  const interrupted=estimate.diagnostics();
  assert.equal(interrupted.relativeResidual,null);
  assert.equal(interrupted.pairedWindows,0);
  assert.equal(interrupted.timing.comparableWindows,0);
  assert.deepEqual(interrupted.lastTimingFit,d.timing);
  assert.equal(interrupted.interruptions.relocalized,1);
  estimate.stop();
});

test('metric scale rejects inconsistent axes instead of accepting a negative scale', async t=>{
  const estimate=await run(t,time=>moving(time,-1));
  assert.equal(estimate.diagnostics().metersPerUnit,null);
  estimate.stop();
});
