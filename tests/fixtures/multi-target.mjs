import {mkdir,readFile,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {ImageCompiler} from '../../src/tracking/ImageCompiler.ts';
import {openCV} from '../../scripts/opencv-node.mjs';
export async function prepareMultiTargets(){
  await openCV();await mkdir('tests/generated/multi',{recursive:true});
  let seed=913;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const shapes=Array.from({length:240},(_,i)=>{const x=Math.round(random()*760+20),y=Math.round(random()*560+20),r=Math.round(random()*18+5);
    return `<rect x="${x}" y="${y}" width="${r*2}" height="${r}" rx="${i%5}" transform="rotate(${i*17} ${x} ${y})" fill="hsl(${i*73%360} 80% 45%)" stroke="#172e45" stroke-width="3"/>`;});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#faf4dc"/>${shapes.join('')}<path d="M80 70L690 500M710 80L100 510" stroke="#172e45" stroke-width="18"/><text x="220" y="315" font-size="80" font-family="sans-serif" fill="#ad2338">TARGET B</text></svg>`;
  const second=await sharp(Buffer.from(svg)).png().toBuffer();await writeFile('tests/generated/multi/b.png',second);
  const compiler=new ImageCompiler();const buffer=await compiler.compile(new Uint8Array(second),{physicalWidthMeters:.2,opencvURL:new URL('../../public/vision/opencv.js',import.meta.url).href,
    decode:async encoded=>{const{data,info}=await sharp(encoded).ensureAlpha().raw().toBuffer({resolveWithObject:true});return{data:new Uint8ClampedArray(data),width:info.width,height:info.height};}});
  await writeFile('tests/generated/multi/b.dat',new Uint8Array(buffer));
  const a=await sharp('public/marker.png').resize(240,180).png().toBuffer(),b=await sharp(second).resize(240,180).png().toBuffer();
  for(const[name,showA,showB]of [['both',true,true],['only-a',true,false],['only-b',false,true],['blank',false,false]]){
    const overlays=[];if(showA)overlays.push({input:a,left:40,top:140});if(showB)overlays.push({input:b,left:360,top:140});
    await sharp({create:{width:640,height:480,channels:4,background:'#26313a'}}).composite(overlays).png().toFile(`tests/generated/multi/${name}.png`);
  }
  return{a:await readFile('public/target.dat'),b:new Uint8Array(buffer)};
}
