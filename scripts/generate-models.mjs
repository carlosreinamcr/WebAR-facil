/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
// Fixtures originales: misma geometría, textura y animación en los tres formatos.
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {draco,meshopt} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import {MeshoptEncoder} from 'meshoptimizer';
import {BoxGeometry} from 'three';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';

await MeshoptEncoder.ready;
const encoder=await draco3d.createEncoderModule({wasmBinary:await readFile('node_modules/draco3dgltf/draco_encoder.wasm')});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.encoder':encoder,'meshopt.encoder':MeshoptEncoder});
await mkdir('public/models',{recursive:true});
const texture=await sharp({create:{width:8,height:8,channels:4,background:'#2ec4b6'}}).png().toBuffer();
for(const format of ['plain','draco','meshopt']){
  const document=new Document(),buffer=document.createBuffer(),box=new BoxGeometry(1,1.4,.7);
  const primitive=document.createPrimitive();
  for(const [semantic,name,type]of [['POSITION','position','VEC3'],['NORMAL','normal','VEC3'],['TEXCOORD_0','uv','VEC2']]){
    primitive.setAttribute(semantic,document.createAccessor().setType(type).setArray(box.getAttribute(name).array.slice()).setBuffer(buffer));
  }
  primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(box.index.array.slice()).setBuffer(buffer));box.dispose();
  const image=document.createTexture('textura original').setImage(texture).setMimeType('image/png');
  primitive.setMaterial(document.createMaterial('turquesa').setBaseColorTexture(image).setMetallicFactor(0).setRoughnessFactor(.6));
  const node=document.createNode('modelo animado').setMesh(document.createMesh().addPrimitive(primitive));
  document.getRoot().setDefaultScene(document.createScene().addChild(node));
  const input=document.createAccessor().setType('SCALAR').setArray(new Float32Array([0,1,2])).setBuffer(buffer);
  const output=document.createAccessor().setType('VEC4').setArray(new Float32Array([0,0,0,1,0,1,0,0,0,0,0,-1])).setBuffer(buffer);
  const sampler=document.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
  document.createAnimation('Giro').addSampler(sampler).addChannel(document.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler));
  if(format==='draco')await document.transform(draco());
  if(format==='meshopt')await document.transform(meshopt({encoder:MeshoptEncoder,level:'medium'}));
  await writeFile(`public/models/demo-${format}.glb`,await io.writeBinary(document));
}
console.log('GLB de prueba generados: plain, Draco y Meshopt; textura y animación embebidas.');
