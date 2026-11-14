import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ExactHamming,createExactHamming} from '../src/vision/ExactHamming.ts';
import {matchORBOpenCV,matchORBProfiled} from '../src/vision/features.ts';
import {openCV} from '../scripts/opencv-node.mjs';
const {cv}=await openCV();
const kernel=new ExactHamming();
function bytes(count,seed){const data=new Uint8Array(count*32);for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed>>>24;}return data;}
function distance(bits){const row=new Uint8Array(32);for(let i=0;i<bits;i++)row[i>>3]|=1<<(i&7);return row;}
function equal(query,train){const expected=matchORBOpenCV(cv,query,train);assert.deepEqual(kernel.match(query,train),expected);return expected;}
test('Hamming exacto: mismos matches ordenados que OpenCV en descriptores aleatorios y perturbados',()=>{
 for(let seed=1;seed<=40;seed++){
  const q=bytes(20+seed,seed),t=bytes(30+seed,seed+200);
  for(let i=0;i<15;i++){t.set(q.subarray(i*32,i*32+32),i*32);for(let bit=0;bit<(i*7)%90;bit++)t[i*32+(bit>>3)]^=1<<(bit&7);}
  equal(q,t);
 }
});
test('Hamming exacto: umbrales 64/65, ratio estricto, duplicados, empates y unicidad',()=>{
 const q=new Uint8Array(64);q.fill(255,32);
 for(const [first,second,accepted]of [[64,85,false],[64,86,true],[65,100,false],[63,84,false],[63,85,true],[0,0,false],[0,256,true]]){
  const train=new Uint8Array(64);train.set(distance(first));train.set(distance(second),32);
  const result=equal(q,train);assert.equal(result.some(m=>m.query===0),accepted,`${first}/${second}`);
 }
 const query=new Uint8Array(64),train=new Uint8Array(64);train.fill(255,32);
 assert.deepEqual(equal(query,train),[{query:0,train:0,distance:0}]);
 assert.deepEqual(equal(new Uint8Array(),train),[]);assert.deepEqual(equal(query,new Uint8Array(32)),[]);
});
test('Hamming exacto: offsets de vistas, crecimiento y límites de memoria sin buffers obsoletos',()=>{
 const q=bytes(40,1),t=bytes(60,2),backingQ=new Uint8Array(q.length+3),backingT=new Uint8Array(t.length+5);backingQ.set(q,3);backingT.set(t,5);
 equal(backingQ.subarray(3),backingT.subarray(5));
 assert.deepEqual(kernel.match(new Uint8Array(100324*32),new Uint8Array(64)),[]);assert.ok(kernel.memoryBytes<=16*1024*1024);
 equal(q,t);assert.equal(backingQ.byteLength,q.length+3);
 assert.throws(()=>kernel.match(new Uint8Array(65),t),RangeError);assert.throws(()=>kernel.match(new Uint8Array(131073*32),t),RangeError);
});
test('Hamming exacto: compilación no disponible conserva una alternativa explícita',()=>{
 const original=WebAssembly.Module;try{WebAssembly.Module=class{constructor(){throw new WebAssembly.CompileError('Unavailable');}};assert.equal(createExactHamming(),null);}finally{WebAssembly.Module=original;}
 assert.ok(createExactHamming() instanceof ExactHamming);
});
test('Matching automático: usa el kernel exacto y mantiene los resultados de la referencia',()=>{
 const q=bytes(80,9),t=bytes(100,10);t.set(q.subarray(0,32));const result=matchORBProfiled(cv,q,t);
 assert.equal(result.backend,'wasm-exact');assert.deepEqual(result.matches,matchORBOpenCV(cv,q,t));
 assert.equal(matchORBProfiled(cv,new Uint8Array(),t).backend,'empty');
});
test('Kernel WASM reproducible desde su fuente WAT',()=>{
 execFileSync(process.execPath,['scripts/build-hamming.mjs','--check'],{stdio:'pipe',windowsHide:true});
});
