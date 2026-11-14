import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openCV} from '../scripts/opencv-node.mjs';
import {lowerImportedMemory} from '../scripts/wasm-memory.mjs';
const{cv}=await openCV();
test('WASM distribuido: heap inicial reducido y crecimiento seguro',()=>{
  assert.equal(cv.HEAPU8.buffer.byteLength,32*1024*1024);
  const large=new cv.Mat(4000,4000,cv.CV_8UC4);
  try{large.data.fill(73);assert.equal(large.data[large.data.length-1],73);assert.ok(cv.HEAPU8.buffer.byteLength>=64*1024*1024);}
  finally{large.delete();}
  const small=new cv.Mat(20,20,cv.CV_8UC1);small.data.fill(9);assert.equal(small.data[399],9);small.delete();
});
test('WASM patch: rechazar módulos cuyo import de memoria no sea el esperado',()=>{
  assert.throws(()=>lowerImportedMemory(new Uint8Array([0,97,115,109,1,0,0,0]),2048,512));
});
