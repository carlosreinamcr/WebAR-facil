import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BrowserWorker} from './fixtures/browser-worker.mjs';
import {scene,intrinsics} from './fixtures/render-scene.mjs';
globalThis.self=globalThis;globalThis.Worker=BrowserWorker;
const{OpticalFlowSLAM}=await import('../dist/webar-facil.core.js');
test('Worker VO: snapshot transportable, importación y relocalización sin pose antigua',{timeout:35_000},async()=>{
  const flow=new OpticalFlowSLAM({intrinsics,floorROI:{x:0,y:.4,width:1,height:.6},opencvURL:new URL('../public/vision/opencv.js',import.meta.url).href});
  try{
    await flow.start();const world=scene();let result;
    const process=(pixels,time)=>flow.processFrame({imageData:{data:pixels,width:640,height:480},timestampMs:time,sessionId:1,mediaTimeSeconds:time/1000,sourceWidth:640,sourceHeight:480});
    for(let i=0;i<65;i++)result=await process(world.render(i*.005).data,performance.now());
    assert.equal(result.status,'tracked');const previousMap=result.mapId;
    assert.equal((await flow.checkVisualReference('capture','round1')).status,'captured');
    const direct=await flow.checkVisualReference('verify','round1');
    assert.equal(direct.status,'verified');
    assert.ok(direct.medianImageShiftPx<1);
    const snapshot=await flow.exportMap();assert.ok(snapshot.keyframes[0].descriptors instanceof Uint8Array);
    await flow.importMap(snapshot);
    const missing=await process(new Uint8ClampedArray(640*480*4).fill(255),performance.now());assert.equal(missing.status,'lost');assert.notEqual(missing.mapId,previousMap);
    const found=await process(world.render(.32).data,performance.now());assert.equal(found.status,'tracked');assert.equal(found.scale,snapshot.scale);assert.equal(found.relocalized,true);
    assert.equal((await flow.checkVisualReference('verify','round1')).status,'missing-reference');
    assert.ok(snapshot.keyframes[0].descriptors.byteLength>0,'la importación no desprende el snapshot del usuario');
  }finally{flow.dispose();}
});
