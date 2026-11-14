/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { lowerImportedMemory } from './wasm-memory.mjs';

// El runtime se obtiene exclusivamente del paquete fijado en package-lock.json.
const require = createRequire(import.meta.url);
const sourcePath = require.resolve('@techstark/opencv-js');
const source = await readFile(sourcePath, 'utf8');
// El UMD oficial usa `this` para el global, que es undefined al importar un ESM.
// Cambiar solo ese punto permite cargarlo mediante import() en un Module Worker.
let esm = source.replace('}(this, function () {', '}(globalThis, function () {')
  .replace('Module["TOTAL_MEMORY"]||134217728','Module["TOTAL_MEMORY"]||33554432');
// El módulo oficial declara 128MiB mínimos aunque su región estática ocupa <7MiB.
// Ajustar también el contrato de import (2048 -> 512 páginas), conservando grow.
const base=Number(/DYNAMIC_BASE=(\d+)/.exec(source)?.[1]);
if(!(base>0&&base<16*1024*1024))throw new Error('Layout WASM desconocido; revisar tamaño del heap inicial.');
const embedded=/var wasmBinaryFile="data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)"/.exec(esm);
if(!embedded)throw new Error('No se encontró el WASM embebido esperado.');
const wasm=lowerImportedMemory(Buffer.from(embedded[1],'base64'),2048,512);
esm=esm.replace(embedded[0],`var wasmBinaryFile="data:application/octet-stream;base64,${Buffer.from(wasm).toString('base64')}"`);
if (esm === source) throw new Error('Cambió el wrapper de OpenCV; revisar antes de distribuir.');
await mkdir('public/vision', { recursive: true });
let existing='';try{existing=await readFile('public/vision/opencv.js','utf8');}catch{}
if(existing!==esm)await writeFile('public/vision/opencv.js', esm);
const licensePath = resolve(dirname(sourcePath), '../LICENSE');
// OpenCV.js está publicado bajo Apache-2.0. Conservar el aviso de distribución.
const license = await readFile(new URL('../node_modules/@techstark/opencv-js/package.json', import.meta.url), 'utf8');
await writeFile('public/vision/manifest.json', JSON.stringify({
  package: '@techstark/opencv-js', version: JSON.parse(license).version,
  upstream: 'https://github.com/opencv/opencv/tree/4.12.0',
  originalSHA256: createHash('sha256').update(source).digest('hex'),
  distributedSHA256: createHash('sha256').update(esm).digest('hex'),
  modification: 'UMD root this -> globalThis; initial growing heap and WASM memory import minimum 128MiB -> 32MiB; static memory layout verified',
}, null, 2));
await copyFile(licensePath, 'public/vision/LICENSE.opencv.txt');
await mkdir('public/vision/licenses',{recursive:true});
for(const name of ['ml-matrix','ml-array-max','ml-array-min','ml-array-rescale','is-any-array']) {
  await copyFile(`node_modules/${name}/LICENSE`,`public/vision/licenses/${name}.txt`);
}
await mkdir('public/vendor', { recursive: true });
const threeRoot=resolve(dirname(require.resolve('three')),'.');
for(const name of ['three.module.js','three.core.js'])await copyFile(resolve(threeRoot,name),`public/vendor/${name}`);
await copyFile(resolve(threeRoot,'../LICENSE'),'public/vendor/LICENSE.three.txt');
await mkdir('public/decoders/draco',{recursive:true});
for(const name of ['draco_wasm_wrapper.js','draco_decoder.wasm','draco_decoder.js']){
  await copyFile(resolve(threeRoot,'../examples/jsm/libs/draco/gltf',name),`public/decoders/draco/${name}`);
}
await copyFile('public/vision/LICENSE.opencv.txt','public/decoders/draco/LICENSE.Apache-2.0.txt');
await copyFile('node_modules/meshoptimizer/LICENSE.md','public/vendor/LICENSE.meshoptimizer.txt');
console.log('OpenCV WASM local preparado (4.12.0).');
