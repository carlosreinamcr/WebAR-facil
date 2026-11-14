import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlanarCameraEstimator} from '../src/vision/PlanarCameraEstimator.ts';
import {estimateIntrinsics} from '../src/vision/calibration.ts';

// Homografía de un plano inclinado con principal point centrado y píxeles cuadrados.
function homography(focal,tilt){
  const k=estimateIntrinsics(640,480),c=Math.cos(tilt),s=Math.sin(tilt);
  return [focal, k.cx*s, k.cx*4, 0, focal*c+k.cy*s, k.cy*4, 0, s, 4];
}
test('cámara automática: infiere focal con varias vistas, sin parámetros del usuario',()=>{
  for(const focal of [520,900]){
    const initial=estimateIntrinsics(640,480),estimator=new PlanarCameraEstimator();
    estimator.observe(homography(focal,.3),initial);
    assert.equal(estimator.current(initial).fx,initial.fx);
    estimator.observe(homography(focal,.4),initial);estimator.observe(homography(focal,.5),initial);
    const result=estimator.current(initial);
    assert.ok(Math.abs(result.fx-focal)<1e-6);assert.equal(result.fx,result.fy);
    assert.equal(result.cx,initial.cx);assert.equal(result.cy,initial.cy);
  }
});
test('cámara automática: ignora frontalidad, datos inválidos y focales inconsistentes',()=>{
  const initial=estimateIntrinsics(640,480),estimator=new PlanarCameraEstimator();
  for(let i=0;i<10;i++)estimator.observe(homography(650,0),initial);
  estimator.observe([NaN],initial);estimator.observe(Array(9).fill(0),initial);
  assert.equal(estimator.current(initial).fx,initial.fx);
  for(const focal of [500,900,1400])estimator.observe(homography(focal,.5),initial);
  assert.equal(estimator.current(initial).fx,initial.fx);
});
