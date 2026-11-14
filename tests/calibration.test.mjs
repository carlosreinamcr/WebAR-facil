import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openCV } from '../scripts/opencv-node.mjs';
import { CameraCalibrator } from '../src/calibration/CameraCalibrator.ts';
import { projectWorld } from '../src/vision/geometry.ts';
import { matrixFromPose } from '../src/spatial/PoseFilter.ts';

const {cv}=await openCV();
test('calibración WASM: genera y detecta tablero ChArUco real',()=>{
  const calibrator=new CameraCalibrator(cv);
  try {
    const image=calibrator.boardRGBA(),first=calibrator.addRGBA(image.data,image.width,image.height);
    assert.equal(first.accepted,true);assert.equal(first.corners.length,48);
    assert.equal(calibrator.addRGBA(image.data,image.width,image.height).reason,'duplicate-view');
    assert.throws(()=>calibrator.solve(),/10 vistas/);
  }finally{calibrator.dispose();}
});
test('calibración WASM: recupera intrínsecos de múltiples poses conocidas',()=>{
  const calibrator=new CameraCalibrator(cv);
  const k={width:640,height:480,fx:700,fy:710,cx:317,cy:241};
  const points=Array.from({length:24},(_,i)=>[(i%6-2.5)*.03,(Math.floor(i/6)-1.5)*.03,0]);
  try {
    for(let i=0;i<16;i++) {
      const ax=(i%4-1.5)*.16,ay=(Math.floor(i/4)-1.5)*.16;
      const q=[Math.sin(ax/2)*Math.cos(ay/2),Math.cos(ax/2)*Math.sin(ay/2),-Math.sin(ax/2)*Math.sin(ay/2),Math.cos(ax/2)*Math.cos(ay/2)];
      const view=matrixFromPose([((i%4)-1.5)*.04,(Math.floor(i/4)-1.5)*.03,-.45-(i%3)*.06],q);
      const pixels=new Float32Array(points.flatMap(p=>projectWorld(p,view,k).slice(0,2)));
      calibrator.addObservation({width:640,height:480,objectPoints:new Float32Array(points.flat()),imagePoints:pixels});
    }
    const report=calibrator.solve();
    assert.ok(Math.abs(report.calibration.fx-k.fx)/k.fx<.01);
    assert.ok(Math.abs(report.calibration.fy-k.fy)/k.fy<.01);
    assert.ok(report.rmsPx<.1);
  }finally{calibrator.dispose();}
});

test('calibración: rechazar vistas frontales sin diversidad angular',()=>{
  const calibrator=new CameraCalibrator(cv),k={width:640,height:480,fx:700,fy:710,cx:320,cy:240};
  const points=Array.from({length:24},(_,i)=>[(i%6-2.5)*.03,(Math.floor(i/6)-1.5)*.03,0]);
  try{
    for(let i=0;i<12;i++){
      const view=matrixFromPose([(i%4-1.5)*.04,(Math.floor(i/4)-1)*.05,-.5],[0,0,0,1]);
      calibrator.addObservation({width:640,height:480,objectPoints:new Float32Array(points.flat()),imagePoints:new Float32Array(points.flatMap(p=>projectWorld(p,view,k).slice(0,2)))});
    }
    assert.throws(()=>calibrator.solve(),/condicionada|imprecisa|inválida/);
  }finally{calibrator.dispose();}
});
