/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
// Recursos originales para 14–25; nunca sobrescribir archivos elegidos por el usuario.
import {mkdir,access,copyFile,readFile,writeFile} from 'node:fs/promises';
import {NodeIO} from '@gltf-transform/core';
import sharp from 'sharp';
const folder='examples/assets';await mkdir(folder,{recursive:true});
async function exists(name){try{await access(`${folder}/${name}`);return true;}catch{return false;}}
for(const name of ['robot.glb','cohete.glb'])if(!await exists(name))await copyFile(`examples/PRUEBAS/assets/${name}`,`${folder}/${name}`);
if(!await exists('video.mp4'))await copyFile('examples/PRUEBAS/assets/video.mp4',`${folder}/video.mp4`);
if(!await exists('marcador.jpg'))await sharp('public/marker.png').jpeg({quality:96}).toFile(`${folder}/marcador.jpg`);
if(!await exists('marcador2.jpg')){
  let seed=913;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const shapes=Array.from({length:240},(_,i)=>{
    const x=Math.round(random()*760+20),y=Math.round(random()*560+20),r=Math.round(random()*18+5);
    return `<rect x="${x}" y="${y}" width="${r*2}" height="${r}" transform="rotate(${i*17} ${x} ${y})" fill="hsl(${i*73%360} 80% 45%)" stroke="#172e45" stroke-width="3"/>`;
  });
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#faf4dc"/>${shapes.join('')}<path d="M80 70L690 500M710 80L100 510" stroke="#172e45" stroke-width="18"/><text x="180" y="315" font-size="80" fill="#ad2338">MARCADOR 2</text></svg>`;
  await sharp(Buffer.from(svg)).jpeg({quality:96}).toFile(`${folder}/marcador2.jpg`);
}
if(!await exists('animaciones.glb')){
  const io=new NodeIO(),doc=await io.read(`${folder}/robot.glb`),buffer=doc.getRoot().listBuffers()[0],scene=doc.getRoot().getDefaultScene();
  const root=doc.createNode('robot-animado');for(const node of scene.listChildren())root.addChild(node);scene.addChild(root);
  const input=doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0,1,2])).setBuffer(buffer);
  function clip(name,node,path,values,type){
    const output=doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buffer);
    const sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    doc.createAnimation(name).addSampler(sampler).addChannel(doc.createAnimationChannel().setSampler(sampler).setTargetNode(node).setTargetPath(path));
  }
  clip('Giro',root,'rotation',[0,0,0,1,0,1,0,0,0,0,0,-1],'VEC4');
  clip('Salto',root,'translation',[0,0,0,0,.5,0,0,0,0],'VEC3');
  const head=doc.getRoot().listNodes().find(node=>node.getName()==='cabeza');
  clip('Asentir',head,'rotation',[0,0,0,1,Math.sin(.35),0,0,Math.cos(.35),0,0,0,1],'VEC4');
  await io.write(`${folder}/animaciones.glb`,doc);
}
console.log('Recursos originales 14–25 preparados en examples/assets (existentes conservados).');
