/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {mkdir,mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
const npmCLI=process.env.npm_execpath;if(!npmCLI)throw new Error('Ejecutar mediante npm run check:package.');
function run(args,cwd=process.cwd(),capture=false){return new Promise((resolveResult,reject)=>{
  const child=spawn(process.execPath,args,{cwd,windowsHide:true,stdio:capture?['ignore','pipe','inherit']:'inherit'});let output='';
  if(capture)child.stdout.on('data',chunk=>{output+=chunk;});
  child.on('error',reject);child.on('exit',code=>code===0?resolveResult(output):reject(new Error(`Comando de validación terminó con código ${code}.`)));
});}
await run(['scripts/verify-release.mjs']);
await mkdir('artifacts',{recursive:true});
const packed=JSON.parse(await run([npmCLI,'pack','--ignore-scripts','--json','--pack-destination','artifacts'],process.cwd(),true))[0];
const packedFiles=new Set(packed.files.map(file=>file.path));
for(const directory of ['examples/PRUEBAS','examples/PRUEBAS/assets','examples/assets']){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(entry.isFile()&&!packedFiles.has(`dist/${directory}/${entry.name}`))throw new Error(`Falta receta/recurso en el paquete: ${directory}/${entry.name}`);
  }
}
for(const required of ['docs/README.md','docs/getting-started.md','docs/programmatic.md','docs/recipes-programmatic.md','docs/ai-guide.md','docs/api.json','llms.txt','llms-full.txt',
  'dist/docs/index.html','dist/docs/getting-started.html','dist/docs/declarative.html','dist/docs/search-index.json',
  'dist/examples/documented-app.html','dist/examples/declarative.html','dist/examples/declarative-slam.html',
  'dist/examples/declarative-video.html','dist/examples/declarative-interactive.html','dist/videos/demo-chroma.mp4',
  'docs/interaction.md','docs/odometry-validation.md','dist/benchmarks/odometry-comparison.json','docs/diagnostics.md',
  'docs/placement.md','docs/local-release.md','dist/tools/device-tests.html','dist/examples/declarative-placement.html','dist/release.json','dist/benchmarks/image-tracking-comparison.json','dist/types/tracking/profile.d.ts','dist/benchmarks/image-support-comparison.json','dist/vision/hamming.wat','dist/benchmarks/matching-exact.json','dist/benchmarks/image-matching-comparison.json']){
  if(!packedFiles.has(required))throw new Error(`La distribución no incluye la documentación requerida: ${required}`);
}
const artifact=resolve('artifacts',packed.filename),consumer=await mkdtemp(resolve('artifacts','consumer-'));
await writeFile(join(consumer,'package.json'),JSON.stringify({name:'webar-consumer-check',private:true,type:'module'}));
await run([npmCLI,'install','--ignore-scripts','--no-audit','--no-fund',artifact,'three@0.180.0','@types/three@0.180.0'],consumer);
await writeFile(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',
  lib:['ES2022','DOM','DOM.Iterable'],types:[],strict:true,noEmit:true,skipLibCheck:false},include:['check.ts']}));
const core=`import {WebAREngine,EngineState,type EngineOptions,type ARPose,CalibrationSession} from 'webar-facil/core';
const options:EngineOptions={attachXRSession:async session=>{await session.requestReferenceSpace('local');}};
function consume(pose:ARPose){const engine=new WebAREngine(options);engine.onPose((matrix,metadata)=>matrix.set(metadata.worldMatrix));return EngineState.Idle;}
async function compileImage(engine:WebAREngine,file:File){const result=await engine.loadImageTarget(file);return{data:result.buffer,json:JSON.stringify(result.metadata)};}
async function multi(engine:WebAREngine,file:File){await engine.addImageTarget('poster',file);engine.setKeepContentOnLost(true,'poster');engine.on('targetFound',event=>event.pose.matrix.slice());engine.on('trackingQuality',event=>event.issues.includes('blur'));engine.onTargetLost(event=>event.retained);}
export{consume,CalibrationSession};`;
await writeFile(join(consumer,'check.ts'),core);
const tsc=resolve('node_modules/typescript/bin/tsc');await run([tsc,'-p',join(consumer,'tsconfig.json')]);
await writeFile(join(consumer,'check.ts'),core+`\nimport{ThreeARGroup,ThreeARModel,ThreeARVideo,ThreeARScene,registerAFrameVideoComponent}from'webar-facil';const group=new ThreeARGroup();group.update(new Float32Array(16));const model=new ThreeARModel();group.add(model);model.load('/modelo.glb',{fitSize:.16});model.update(.016);const video=new ThreeARVideo({chromaKey:{color:'#00ff00'}});video.setSource('/video.mp4');const app=new ThreeARScene({container:document.body,engineOptions:{keepContentOnLost:true}});app.addContent('poster',video);\n`);
await run([tsc,'-p',join(consumer,'tsconfig.json')]);
await writeFile(join(consumer,'declarative.ts'),`import{registerARComponents,type ARSceneElement,type ARModelElement,type ARVideoElement,type ARAnimationOptions,ARDiagnostics,LIBRARY_VERSION,LIBRARY_BUILD}from'webar-facil';
function configure(){registerARComponents({assetBase:new URL('/sdk/',location.href)});}
async function consume(scene:ARSceneElement,model:ARModelElement,video:ARVideoElement){await scene.start();scene.engine?.onPose(matrix=>matrix.slice());const options:ARAnimationOptions={loop:'once',speed:2,crossFadeSeconds:.2};model.playAnimation(0,options);model.pauseAnimations();model.resumeAnimations();await model.updateComplete;await video.play();video.pause();await video.updateComplete;await scene.refresh();const report=scene.getDiagnosticsReport();scene.diagnostics?.setContext({platform:'android',execution:'automated'});console.log(report?.sdk.build,LIBRARY_VERSION,LIBRARY_BUILD,scene.placementState);await scene.stop();}
export{configure,consume};`);
await writeFile(join(consumer,'tsconfig.declarative.json'),JSON.stringify({extends:'./tsconfig.json',include:['declarative.ts']}));
await run([tsc,'-p',join(consumer,'tsconfig.declarative.json')]);
await run(['--input-type=module','--eval',"import{EngineState}from'webar-facil/core';if(EngineState.Idle!=='Idle')throw new Error('Export incorrecto.');"],consumer);
const source=await readFile('dist/webar-facil.core.js','utf8');if(/from\s*["']three["']/.test(source))throw new Error('Core depende del renderer.');
console.log(JSON.stringify({artifact:packed.filename,bytes:packed.size,types:'NodeNext strict / core and wrappers',nodeImport:'passed'},null,2));
