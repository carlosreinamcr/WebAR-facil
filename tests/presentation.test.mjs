import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TargetPresentation} from '../src/tracking/TargetPresentation.ts';
import {identity} from '../src/spatial/matrices.ts';
const frame=(status,time)=>status==='tracked'?{status,sessionId:1,timestampMs:time,processingMs:20,matrix:identity(),projectionMatrix:identity(),projectionSource:'estimated',inliers:50,reprojectionErrorPx:1,
  quality:{gradient:12,laplacianVariance:40,motionPixels:30,targetSizePx:80,featureCount:60,inliers:50,reprojectionErrorPx:1},reference:{}}:
  {status,sessionId:1,timestampMs:time,processingMs:20,matrix:null};
test('presentación: found/lost una sola vez y retención configurable sin poses inventadas',()=>{
  const target=new TargetPresentation('a',{graceMs:500,keep:true});
  const first=target.update(frame('tracked',0));assert.equal(first.found.targetId,'a');assert.equal(first.visibility.visible,true);
  const gap=target.update(frame('not-found',250));assert.equal(gap.pose,undefined);assert.equal(gap.lost,undefined);assert.equal(gap.quality.state,'recovering');assert.equal(target.isVisible,true);
  assert.equal(target.update(frame('tracked',300)).found,undefined);
  const lost=target.update(frame('not-found',800));assert.equal(lost.lost.retained,true);assert.equal(lost.pose,undefined);assert.equal(target.isVisible,true);
  assert.equal(target.update(frame('not-found',900)).lost,undefined);
  assert.equal(target.setKeep(false).visible,false);assert.equal(target.setKeep(true).visible,true);
  assert.equal(target.update(frame('tracked',1000)).found.targetId,'a');assert.equal(target.end('stopped',1010).visibility.visible,false);
});
test('diagnóstico: flags heurísticos y calidad separados de visibilidad',()=>{
  const target=new TargetPresentation('a',{graceMs:0});const event=target.update(frame('tracked',1),80).quality;
  for(const issue of ['blur','small-target','high-motion','device-load'])assert.ok(event.issues.includes(issue));assert.equal(event.diagnosis,'heuristic');
  const lost=target.update(frame('not-found',2));assert.equal(lost.visibility.visible,false);assert.equal(lost.quality.score,0);
});
