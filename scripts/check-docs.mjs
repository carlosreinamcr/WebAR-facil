/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import assert from 'node:assert/strict';
import {readFile,access,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import MarkdownIt from 'markdown-it';

const get=filename=>readFile(filename,'utf8');
const index=JSON.parse(await get('dist/docs/search-index.json'));
const english=JSON.parse(await get('dist/docs/en/search-index.json'));
assert.deepEqual(english.map(page=>page.href),index.map(page=>page.href),'English and Spanish chapters must match');
const api=JSON.parse(await get('docs/api.json'));
const md=new MarkdownIt();
let links=0,snippets=0;
function syntax(text,name,kind=ts.ScriptKind.TS){
  const file=ts.createSourceFile(name,text,ts.ScriptTarget.Latest,true,kind);
  assert.deepEqual(file.parseDiagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[],`Sintaxis inválida en ${name}`);
}
for(const [directory,pages,language] of [['dist/docs',index,'es'],['dist/docs/en',english,'en']])for(const page of pages){
  const filename=path.join(directory,page.href),html=await get(filename);
  assert.ok(html.includes(`<html lang="${language}">`),`Idioma incorrecto: ${filename}`);
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const href=match[1];if(/^[a-z]+:|^\/\//i.test(href))continue;
    const [relative,anchor]=href.split('#');
    const target=relative?path.resolve(path.dirname(filename),decodeURIComponent(relative)):path.resolve(filename);
    await access(target).catch(()=>{throw new Error(`Enlace inexistente: ${filename} -> ${href}`);});
    if(anchor&&target.endsWith('.html'))assert.ok((await get(target)).includes(`id="${decodeURIComponent(anchor)}"`),`Ancla inválida ${href}`);
    links++;
  }
  const source=await get(filename.replace(/\.html$/,'.md').replace(/index\.md$/,'README.md'));
  assert.ok(!/^\{\{example:/m.test(source),'No se expandió un ejemplo');
  for(const token of md.parse(source,{})){
    if(token.type!=='fence')continue;
    if(['ts','typescript','js','javascript'].includes(token.info)){syntax(token.content,page.href+' snippet');snippets++;}
    if(token.info==='html'){
      for(const script of token.content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
        if(/type\s*=\s*['"](?:importmap|application\/json)['"]/i.test(script[1])){JSON.parse(script[2]);continue;}
        syntax(script[2],page.href+' script',ts.ScriptKind.JS);snippets++;
      }
    }
  }
}
const program=ts.createProgram(['dist/types/index.d.ts','dist/types/core.d.ts'],{
  noEmit:true,strict:true,skipLibCheck:false,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022,
});
const checker=program.getTypeChecker();
for(const [file,entrypoint] of [['index','webar-facil'],['core','webar-facil/core']]){
  const source=program.getSourceFile(`dist/types/${file}.d.ts`);
  const actual=checker.getExportsOfModule(checker.getSymbolAtLocation(source)).map(symbol=>symbol.name).sort();
  const documented=api.exports.filter(item=>item.entrypoints.includes(entrypoint)).map(item=>item.name).sort();
  assert.deepEqual(documented,actual,`Exports documentados distintos del contrato ${entrypoint}`);
}
// Comprobar un consumidor real de las recetas, sin ejecutar cámara ni DOM.
const contract=`import {WebAREngine,ThreeARScene,ThreeARModel,ThreeARVideo,ThreeARGroup,EngineState,type ARPose,type SLAMMapSnapshot} from '../../dist/types/index.js';
declare const container:HTMLElement;
declare const file:File;
const app=new ThreeARScene({container,engineOptions:{imageLossGraceMs:500,keepContentOnLost:false,camera:{maxFrameWidth:640,adaptive:true}}});
const model=new ThreeARModel({dracoDecoderPath:new URL('./decoders/draco/',document.baseURI)});
app.addContent('poster',model);
await model.load(file,{fitSize:0.16,autoplay:true});
await app.engine.startCamera();
const target=await app.engine.addImageTarget('poster',file,{physicalWidthMeters:0.2,maxDimension:1024});
target.metadata.quality.warnings.forEach(console.log);
app.engine.on('targetFound',event=>console.log(event.pose.matrix,event.targetId));
app.engine.on('targetLost',event=>console.log(event.retained,event.reason));
app.engine.on('trackingQuality',event=>console.log(event.state,event.issues,event.score));
app.engine.on('targetVisibility',event=>console.log(event.visible));
app.engine.onPose((matrix:Float32Array,pose:ARPose)=>console.log(matrix,pose.worldMatrix));
app.engine.setKeepContentOnLost(true,'poster');
const group=new ThreeARGroup().bind(app.engine,'poster');
const clip=new ThreeARVideo({orientation:'upright',chromaKey:{color:'#00ff00',similarity:0.12,smoothness:0.08,spill:0.3}});
await clip.setSource(file);await clip.play();clip.setChromaKey(false);clip.pause();clip.dispose();
await app.engine.enableSLAM({targetId:'poster',backend:'optical-flow',placement:'preserve'});
const snapshot:SLAMMapSnapshot=await app.engine.exportSLAMMap();await app.engine.importSLAMMap(snapshot);
const engine=new WebAREngine();console.log(engine.state===EngineState.Idle);
group.dispose();await app.dispose();engine.dispose();`;
await mkdir('tests/generated',{recursive:true});await writeFile('tests/generated/docs-api.ts',contract);
const consumer=ts.createProgram(['tests/generated/docs-api.ts'],{noEmit:true,strict:true,skipLibCheck:false,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,target:ts.ScriptTarget.ES2022,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true});
const diagnostics=ts.getPreEmitDiagnostics(consumer);
assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
assert.equal(await get('llms-full.txt'),await get('dist/llms-full.txt'));
assert.ok((await get('llms-full.txt')).includes(await get('examples/documented-app.html')));
assert.ok((await get('docs/programmatic.md')).includes(await get('examples/documented-app.html')),'El ejemplo avanzado debe seguir sincronizado con su archivo');
const gettingStarted=await get('docs/getting-started.md');
assert.ok(gettingStarted.includes('<webar-scene>')&&!gettingStarted.includes('new ThreeARScene'),'La guía de inicio debe enseñar etiquetas HTML');
assert.equal(api.usage.recommendedIntegration,'declarative');
assert.ok(!api.declarations.some(item=>/\bprivate\s+(?:readonly\s+)?[a-z]/.test(item.code)));
console.log(`Documentación validada: ${index.length} capítulos en español y ${english.length} en inglés, ${links} enlaces, ${snippets} bloques con sintaxis válida, ${api.exports.length} exports y consumidor TypeScript estricto.`);
