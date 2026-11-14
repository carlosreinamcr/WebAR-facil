import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {BrowserWorker} from './fixtures/browser-worker.mjs';
import {prepareMultiTargets} from './fixtures/multi-target.mjs';
globalThis.self=globalThis;globalThis.Worker=BrowserWorker;
const {Tracker}=await import('../dist/webar-facil.core.js');
test('NFT multi: un frame transferido, dos poses independientes y pérdida por ID',{timeout:40_000},async()=>{
  const targets=await prepareMultiTargets(),tracker=new Tracker({opencvURL:new URL('../public/vision/opencv.js',import.meta.url)});
  try{
    await tracker.loadTargets(Object.entries(targets).map(([id,bytes])=>({id,buffer:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)})));
    let time=0;
    for(const name of ['acquire','both','only-a','both','only-b','blank']){
      const data=await sharp(`tests/generated/multi/${name==='acquire'?'both':name}.png`).ensureAlpha().raw().toBuffer();
      const frame={imageData:{data:new Uint8ClampedArray(data),width:640,height:480},sessionId:1,timestampMs:time+=33,mediaTimeSeconds:time/1000,sourceWidth:640,sourceHeight:480};
      const result=await tracker.processTargetsFrame(frame);assert.equal(frame.imageData.data.buffer.byteLength,0);
      assert.ok(result.profile.counts.fullDetections<=1);
      if(name==='acquire'){
        assert.equal(result.results.filter(target=>target.status==='tracked').length,1);
        continue;
      }
      const a=result.results.find(r=>r.targetId==='a'),b=result.results.find(r=>r.targetId==='b');
      assert.equal(a.status,['both','only-a'].includes(name)?'tracked':'not-found',`${name}/a`);
      assert.equal(b.status,['both','only-b'].includes(name)?'tracked':'not-found',`${name}/b`);
      if(name==='both'){assert.ok(a.matrix[12]<0);assert.ok(b.matrix[12]>0);assert.deepEqual(a.projectionMatrix,b.projectionMatrix);assert.equal(a.reference.rgba,b.reference.rgba);}
    }
  }finally{tracker.dispose();}
});
