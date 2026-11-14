/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
// Recursos originales y ligeros para examples/PRUEBAS. Ejecutar con Node.
import {Document,NodeIO} from '@gltf-transform/core';
import {BoxGeometry,ConeGeometry,CylinderGeometry,SphereGeometry} from 'three';
import {mkdir,copyFile} from 'node:fs/promises';

const folder='examples/PRUEBAS/assets';await mkdir(folder,{recursive:true});
const io=new NodeIO();
for(const kind of ['robot','cohete']){
  const document=new Document(),buffer=document.createBuffer(),scene=document.createScene(kind);
  document.getRoot().setDefaultScene(scene);
  function part(name,geometry,color,position,rotation=[0,0,0,1]){
    const primitive=document.createPrimitive();
    for(const [semantic,attribute,type] of [['POSITION','position','VEC3'],['NORMAL','normal','VEC3'],['TEXCOORD_0','uv','VEC2']]){
      primitive.setAttribute(semantic,document.createAccessor().setType(type).setArray(geometry.getAttribute(attribute).array.slice()).setBuffer(buffer));
    }
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(geometry.index.array.slice()).setBuffer(buffer));geometry.dispose();
    primitive.setMaterial(document.createMaterial(name).setBaseColorFactor([...color,1]).setRoughnessFactor(.55).setMetallicFactor(.1));
    scene.addChild(document.createNode(name).setTranslation(position).setRotation(rotation).setMesh(document.createMesh(name).addPrimitive(primitive)));
  }
  if(kind==='robot'){
    part('cuerpo',new BoxGeometry(.6,.7,.35),[.05,.65,.7],[0,.85,0]);
    part('cabeza',new BoxGeometry(.48,.4,.4),[.1,.8,.8],[0,1.42,0]);
    for(const side of [-1,1]){
      part('ojo',new SphereGeometry(.055,10,8),[.02,.05,.12],[side*.12,1.46,.21]);
      part('brazo',new BoxGeometry(.16,.6,.22),[.05,.4,.5],[side*.43,.86,0]);
      part('pierna',new BoxGeometry(.19,.5,.25),[.05,.4,.5],[side*.19,.25,0]);
    }
  }else{
    part('fusaje',new CylinderGeometry(.25,.25,1,16),[.95,.6,.12],[0,.85,0]);
    part('punta',new ConeGeometry(.25,.48,16),[.9,.16,.07],[0,1.59,0]);
    part('motor',new ConeGeometry(.18,.3,12),[.95,.22,.05],[0,.2,0],[0,0,1,0]);
    for(const side of [-1,1])part('aleta',new BoxGeometry(.12,.5,.45),[.85,.15,.06],[side*.3,.48,0]);
    part('ventana',new SphereGeometry(.1,12,8),[.03,.25,.65],[0,1.06,.22]);
  }
  await io.write(`${folder}/${kind}.glb`,document);
}
await copyFile('public/marker.png',`${folder}/marcador.png`);
await copyFile('public/videos/demo-chroma.mp4',`${folder}/video.mp4`);
console.log('PRUEBAS: robot/cohete GLB originales, marcador y MP4 incluidos.');
