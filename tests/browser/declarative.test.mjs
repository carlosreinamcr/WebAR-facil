import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer as httpServer} from 'node:http';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {prepareFrames,virtualCamera,prepareVideo} from './helpers.mjs';

let server,cdn,browser,frames;
let fixtureHTML='';
const origin='http://127.0.0.1:5195',assetOrigin='http://127.0.0.1:5196';
before(async()=>{
  frames=await prepareFrames();
  server=await createServer({server:{host:'127.0.0.1',port:5195,strictPort:true},plugins:[{name:'declarative-fixture',configureServer(vite){
    vite.middlewares.use((request,response,next)=>{
      if(request.url!=='/tests/declarative.html'){next();return;}
      response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixtureHTML);
    });
  }}]});await server.listen();
  const directory=path.resolve('dist');
  cdn=httpServer(async(request,response)=>{
    try{
      const relative=decodeURIComponent(new URL(request.url,assetOrigin).pathname).slice(1);
      const absolute=path.resolve(directory,relative);
      if(!absolute.startsWith(directory+path.sep))throw new Error('Fuera de distribución');
      const bytes=await readFile(absolute);
      response.setHeader('Access-Control-Allow-Origin','*');
      response.setHeader('Content-Type',absolute.endsWith('.wasm')?'application/wasm':absolute.endsWith('.js')?'text/javascript':'application/octet-stream');
      response.end(bytes);
    }catch{response.statusCode=404;response.end();}
  });
  await new Promise((resolve,reject)=>{cdn.once('error',reject);cdn.listen(5196,'127.0.0.1',resolve);});
  const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
  browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await prepareVideo(browser,origin);
});
after(async()=>{await browser?.close();await server?.close();await new Promise(resolve=>cdn?.close(resolve)??resolve());});

async function pageFor(body,options={}){
  const page=await browser.newPage(options);
  page.on('pageerror',error=>console.error('Declarative page error:',error.message));
  page.on('console',message=>{if(message.type()==='error')console.error('Declarative console:',message.text());});
  page.on('requestfailed',request=>console.error('Declarative request failed:',request.url(),request.failure()?.errorText));
  await virtualCamera(page,[frames[0],'/tests/generated/multi/blank.png']);
  // Respuesta HTTP real: route.fulfill clasifica el documento como origen público
  // en Chrome y activaría la protección loopback en lugar de probar nuestro CDN.
  fixtureHTML=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><script defer src="${assetOrigin}/webar-facil.min.js"></script>${body}`;
  return page;
}

test('HTML declarativo: standalone remoto de un archivo, tracking y Draco sin recursos auxiliares',{timeout:60000},async()=>{
  const page=await pageFor(`<webar-scene id="ar" loss-grace="100" keep-content-on-lost><webar-target src="/marker.png" target-id="poster"><webar-model id="model" src="/models/demo-draco.glb" size="0.2" rotation="0 180 0"></webar-model></webar-target></webar-scene>`);
  const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  try{
    await page.route(/\/((vision|decoders|workers)\/)/,route=>route.fulfill({status:404,body:'Esta instalación solo tiene el SDK.'}));
    await page.goto(origin+'/tests/declarative.html');
    await page.evaluate(()=>{
      const scene=document.querySelector('#ar');window.__lost=0;
      scene.addEventListener('targetLost',()=>window.__lost++);
      scene.addEventListener('ar-status',({detail})=>{if(detail.message==='camera-playing')window.__camera.setIndex(1);});
    });
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.locator('#ar .marker-guide').waitFor({state:'visible'});
    assert.equal(await page.locator('#ar .marker-guide').evaluate(el=>getComputedStyle(el).pointerEvents),'none');
    assert.equal(await page.locator('#ar .marker-guide').evaluate(el=>{
      const guide=el.getBoundingClientRect(),video=el.parentElement.querySelector('canvas').getBoundingClientRect();
      return ['x','y','width','height'].every(key=>Math.abs(guide[key]-video[key])<1);
    }),true);
    await page.evaluate(()=>window.__camera.setIndex(0));
    await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    await page.locator('#ar .marker-guide').waitFor({state:'hidden'});
    assert.deepEqual(await page.evaluate(()=>[...document.querySelector('#ar').engine.targetIds]),['poster']);
    assert.equal(requests.some(url=>/^https?:/.test(url)&&/\/(vision|decoders|workers)\//.test(url)),false);
    assert.equal(await page.evaluate(()=>document.querySelector('#model').model.rotation.y),Math.PI);
    const selected=await page.evaluate(()=>{
      const el=document.querySelector('#model');el.setAttribute('scale','3');el.setAttribute('rotation','0 90 0');
      el.setAttribute('animation','none');el.playAnimation(0);
      return{scale:el.model.scale.x,rotation:el.model.rotation.y,clips:el.model.animations.length};
    });
    assert.deepEqual(selected,{scale:3,rotation:Math.PI/2,clips:1});
    await page.evaluate(()=>window.__camera.setIndex(1));await page.waitForFunction(()=>window.__lost===1);
    assert.equal(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('poster').visible),true);
    await page.locator('#ar .marker-guide').waitFor({state:'visible'});
    await page.evaluate(()=>{window.__engine=document.querySelector('#ar').engine;window.__content=document.querySelector('#model').model;});
    await page.getByRole('button',{name:'Detener',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#ar').engine===null&&window.__engine.state==='Disposed');
    assert.equal(await page.evaluate(()=>window.__content.model),null);
    await page.evaluate(()=>window.__camera.setIndex(0));
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.locator('#ar .marker-guide').waitFor({state:'visible'});
    await page.evaluate(()=>window.__camera.setIndex(0));
    await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    await page.evaluate(()=>{window.__engine=document.querySelector('#ar').engine;document.querySelector('#ar').remove();});
    await page.waitForFunction(()=>window.__engine.state==='Disposed');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('SLAM declarativo sin imagen y cancelación inmediata de arranque',{timeout:45000},async()=>{
  const page=await pageFor('<webar-scene id="ar" mode="slam"><webar-model src="/models/demo-meshopt.glb"></webar-model></webar-scene>');
  try{
    await page.goto(origin+'/tests/declarative.html');
    const cancelled=await page.evaluate(async()=>{
      const scene=document.querySelector('#ar');const starting=scene.start();await scene.stop();
      return{status:(await Promise.allSettled([starting]))[0].status,engine:scene.engine};
    });
    assert.deepEqual(cancelled,{status:'rejected',engine:null});
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#ar').engine?.state==='TrackingSurface');
    assert.deepEqual(await page.evaluate(()=>[...document.querySelector('#ar').engine.targetIds]),[]);
    await page.getByRole('button',{name:'Detener',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#ar').engine===null);
  }finally{await page.close();}
});

test('Errores declarativos: configuración y animaciones inexistentes se muestran sin poses ficticias',{timeout:30000},async()=>{
  const page=await pageFor('<webar-scene id="ar"><webar-target src="/marker.png"><webar-model src="/models/demo-plain.glb" animation="NoExiste"></webar-model></webar-target></webar-scene>');
  try{
    await page.goto(origin+'/tests/declarative.html');
    await page.evaluate(()=>{window.__errors=[];document.querySelector('#ar').addEventListener('ar-error',event=>window.__errors.push(event.detail.message));});
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>window.__errors.length>0);
    assert.match((await page.locator('webar-scene').getByRole('status').textContent()),/Animación no encontrada/);
    assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine),null);
    assert.equal(await page.evaluate(()=>window.__camera.stream.getTracks().every(track=>track.readyState==='ended')),true,'Libera la cámara si falla el contenido después de conceder permisos');
  }finally{await page.close();}
});

test('Ejemplos reales: controles visibles y respaldo cuando el SDK falta o es antiguo',{timeout:30000},async()=>{
  const page=await browser.newPage();
  try{
    for(const name of ['declarative','declarative-slam','declarative-video','declarative-interactive','declarative-placement']){
      await page.goto(`${origin}/examples/${name}.html`);
      await page.getByRole('button',{name:'Iniciar AR',exact:true}).waitFor();
      assert.equal(await page.locator('webar-scene > p').isVisible(),false,'El respaldo queda oculto al registrar el componente');
    }
    await page.route('**/webar-facil.min.js',route=>route.fulfill({contentType:'text/javascript',body:'window.WebARFacil={}; // Simula un SDK anterior a Web Components.'}));
    await page.goto(`${origin}/examples/declarative.html`);
    assert.equal(await page.evaluate(()=>customElements.get('webar-scene')===undefined),true);
    assert.equal(await page.locator('webar-scene > p').isVisible(),true);
    assert.match(await page.locator('webar-scene > p').textContent(),/script existe.*build actualizado/);
    await page.unroute('**/webar-facil.min.js');
    await page.route('**/webar-facil.min.js',route=>route.fulfill({status:404,contentType:'text/plain',body:'Not found'}));
    await page.goto(`${origin}/examples/declarative.html`);
    assert.equal(await page.locator('webar-scene > p').isVisible(),true);
  }finally{await page.close();}
});

test('Abrir con file:// muestra instrucciones y no intenta iniciar cámara',{timeout:15000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(pathToFileURL(path.resolve('examples/declarative-slam.html')).href);
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).waitFor();
    assert.match(await page.getByRole('status').textContent(),/HTTP\/HTTPS.*file:\/\//);
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('webar-scene').shadowRoot.querySelector('p').textContent.includes('Workers necesitan'));
    assert.equal(await page.evaluate(()=>document.querySelector('webar-scene').engine),null);
  }finally{await page.close();}
});

test('Contenido en caliente: GLB, tamaño, errores, targets y jerarquía conservan la cámara',{timeout:45000},async()=>{
  const page=await pageFor('<webar-scene id="ar"><webar-target src="/marker.png" target-id="poster"><webar-model id="model" src="/models/demo-plain.glb"></webar-model></webar-target></webar-scene>');
  try{
    await page.goto(origin+'/tests/declarative.html');await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    const state=await page.evaluate(async()=>{
      const scene=document.querySelector('#ar'),el=document.querySelector('#model'),engine=scene.engine,stream=engine.videoElement.srcObject;
      const old=el.model.model,scale=el.model.children[0].scale.x;el.setAttribute('size','0.64');
      const ratio=el.model.children[0].scale.x/scale;
      el.setAttribute('src','/models/demo-draco.glb');el.setAttribute('src','/models/demo-meshopt.glb');await el.updateComplete;
      const swapped=el.model.model!==old,valid=el.model.model;
      el.setAttribute('src','/missing.glb');let failed=false;try{await el.updateComplete;}catch{failed=true;}
      const preserved=el.model.model===valid;
      const extra=document.createElement('webar-model');extra.setAttribute('src','/models/demo-plain.glb');scene.querySelector('webar-target').append(extra);await scene.refresh();
      const added=!!extra.model?.model;extra.remove();await scene.refresh();const disposed=extra.model===null;
      const target=scene.querySelector('webar-target');target.setAttribute('src','/tests/generated/multi/b.png');await scene.refresh();
      target.remove();await scene.refresh();const empty=engine.targetIds.length===0;
      return{ratio,swapped,failed,preserved,added,disposed,empty,sameEngine:engine===scene.engine,sameStream:stream===engine.videoElement.srcObject,live:stream.getTracks()[0].readyState};
    });
    assert.deepEqual(state,{ratio:4,swapped:true,failed:true,preserved:true,added:true,disposed:true,empty:true,sameEngine:true,sameStream:true,live:'live'});
  }finally{await page.close();}
});

test('Animaciones: pausa, velocidad, once, evento final y crossfade sin reiniciar el renderer',{timeout:30000},async()=>{
  const page=await pageFor('<webar-scene id="ar"><webar-target src="/marker.png"><webar-model id="model" src="/models/demo-plain.glb" animation-paused></webar-model></webar-target></webar-scene>');
  try{
    await page.goto(origin+'/tests/declarative.html');await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#model').model?.animationState?.paused);
    const result=await page.evaluate(()=>{
      const el=document.querySelector('#model'),model=el.model,renderer=document.querySelector('#ar').app.renderer;
      const time=model.animationState.time;model.update(.1);const frozen=model.animationState.time===time;
      el.setAttribute('animation-speed','2');el.removeAttribute('animation-paused');model.update(.1);const advanced=model.animationState.time>time;
      let finished=0;el.addEventListener('animationFinished',()=>finished++);
      el.setAttribute('animation-loop','once');el.playAnimation(0);for(let i=0;i<25;i++)model.update(.1);
      const final=finished===1&&Math.abs(model.animationState.time-2)<.001;
      // Segundo clip original de prueba, para comprobar una transición real entre dos actions.
      const second=model.animations[0].clone();second.name='Segundo';model.animations.push(second);
      el.setAttribute('animation-loop','repeat');el.playAnimation(0);el.playAnimation('Segundo',{crossFadeSeconds:.2});model.update(.1);
      const blended=model.animationState.name==='Segundo';model.pauseAnimations();model.update(.1);model.resumeAnimations();model.update(.1);
      return{frozen,advanced,final,blended,speed:model.animationState.speed,sameRenderer:renderer===document.querySelector('#ar').app.renderer};
    });
    assert.deepEqual(result,{frozen:true,advanced:true,final:true,blended:true,speed:2,sameRenderer:true});
  }finally{await page.close();}
});

test('Vídeo declarativo: chroma, gesto de reproducción, parámetros vivos y sustitución fallida segura',{timeout:30000},async()=>{
  const page=await pageFor('<webar-scene id="ar"><webar-target src="/marker.png" target-id="poster"><webar-video id="clip" src="/tests/generated/chroma.mp4" chroma-key orientation="upright"></webar-video></webar-target></webar-scene>');
  await page.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(this.src.endsWith('chroma.mp4')&&!window.__allowVideo)return Promise.reject(new DOMException('Gesture required','NotAllowedError'));return play.call(this);};});
  try{
    await page.goto(origin+'/tests/declarative.html');await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.getByRole('button',{name:'Reproducir vídeos',exact:true}).waitFor();
    await page.evaluate(()=>{window.__allowVideo=true;});await page.getByRole('button',{name:'Reproducir vídeos',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#clip').video?.videoElement.paused===false);
    const result=await page.evaluate(async()=>{
      const scene=document.querySelector('#ar'),el=document.querySelector('#clip'),old=el.video,media=old.videoElement,engine=scene.engine;
      const keyed=old.mesh.material.uniforms.keyed.value;el.setAttribute('chroma-key','false');el.setAttribute('width','0.6');el.setAttribute('orientation','flat');
      const live=el.video===old&&!media.paused&&!old.mesh.material.uniforms.keyed.value&&Math.abs(old.mesh.rotation.x+Math.PI/2)<.0001;
      el.setAttribute('src','/missing.mp4');let failed=false;try{await el.updateComplete;}catch{failed=true;}
      return{keyed,live,failed,preserved:el.video===old&&!media.paused,sameEngine:engine===scene.engine,width:old.mesh.scale.x};
    });
    assert.deepEqual(result,{keyed:true,live:true,failed:true,preserved:true,sameEngine:true,width:.6});
  }finally{await page.close();}
});

test('Gestos opt-in: selección con raycast, arrastre y pellizco acotado actualizan el HTML',{timeout:30000},async()=>{
  const page=await pageFor('<webar-scene id="ar" gestures diagnostics pixel-ratio="1" antialias="false" min-scale="0.5" max-scale="2"><webar-target src="/marker.png" target-id="poster"><webar-model id="model" src="/models/demo-plain.glb" animation="none"></webar-model></webar-target></webar-scene>',{deviceScaleFactor:3});
  try{
    await page.goto(origin+'/tests/declarative.html');await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    await page.waitForFunction(()=>document.querySelector('#ar').getDiagnosticsReport()?.renderer.peakTriangles>=12);
    const rendering=await page.evaluate(()=>{const scene=document.querySelector('#ar'),r=scene.app.renderer;return{ratio:r.getPixelRatio(),antialias:r.getContext().getContextAttributes().antialias,config:scene.getDiagnosticsReport().configuration};});
    assert.equal(rendering.ratio,1);assert.equal(rendering.antialias,false);assert.equal(rendering.config.renderPixelRatio,1);assert.equal(rendering.config.antialias,false);
    const position=await page.evaluate(()=>{
      const scene=document.querySelector('#ar'),model=document.querySelector('#model');window.__selected=0;model.addEventListener('ar-select',()=>window.__selected++);
      model.model.updateWorldMatrix(true,true);const THREE=WebARFacil.THREE,center=new THREE.Box3().setFromObject(model.model).getCenter(new THREE.Vector3()).project(scene.app.camera),rect=scene.app.renderer.domElement.getBoundingClientRect();
      return{x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2};
    });
    await page.mouse.click(position.x,position.y);assert.equal(await page.evaluate(()=>window.__selected),1);
    await page.mouse.move(position.x,position.y);await page.mouse.down();await page.mouse.move(position.x+25,position.y,{steps:4});await page.mouse.up();
    assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('#model').model.rotation.y))>.01);
    const pinch=await page.evaluate(()=>{
      const scene=document.querySelector('#ar'),el=document.querySelector('#model'),canvas=scene.app.renderer.domElement,THREE=WebARFacil.THREE;
      el.model.updateWorldMatrix(true,true);const p=new THREE.Box3().setFromObject(el.model).getCenter(new THREE.Vector3()).project(scene.app.camera),rect=canvas.getBoundingClientRect(),x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2;
      const event=(type,id,clientX)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',button:0,clientX,clientY:y,bubbles:true,cancelable:true}));
      event('pointerdown',91,x);event('pointerdown',92,x+10);event('pointermove',92,x+500);event('pointerup',91,x);event('pointerup',92,x+500);
      return{scale:el.model.scale.x,attribute:el.getAttribute('scale')};
    });
    assert.equal(pinch.scale,2);assert.equal(pinch.attribute,'2 2 2');
  }finally{await page.close();}
});

test('Colocación manual con odometría real: guía, confirmación y pérdida sin cambiar la matriz',{timeout:45000},async()=>{
  const page=await pageFor('<webar-scene id="ar" slam backend="optical-flow" placement="manual" diagnostics><webar-target src="/marker.png" target-id="poster"><webar-model src="/models/demo-plain.glb"></webar-model></webar-target></webar-scene>');
  try{
    await virtualCamera(page,[...frames,'/tests/generated/multi/blank.png']);await page.goto(origin+'/tests/declarative.html');
    await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    await page.evaluate(()=>window.__camera.move());await page.getByRole('button',{name:'Activar SLAM',exact:true}).click();
    await page.getByRole('button',{name:'Colocar aquí',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#ar').shadowRoot.querySelector('.place').disabled,{},{timeout:25000});
    assert.equal(await page.evaluate(()=>document.querySelector('#ar').placementState),'surface-found');
    // La visibilidad se aplica antes de dibujar; una pose puede llegar entre renders.
    const before=await page.evaluate(()=>new Promise(resolve=>{const scene=document.querySelector('#ar');const unsubscribe=scene.app.onRender(()=>{unsubscribe();window.__placedMatrix=scene.app.getAnchor('poster').matrix.elements.slice();resolve(scene.app.getAnchor('poster').visible);});}));assert.equal(before,false);
    await page.getByRole('button',{name:'Colocar aquí',exact:true}).click();assert.equal(await page.evaluate(()=>document.querySelector('#ar').placementState),'placed');
    assert.deepEqual(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('poster').matrix.elements.slice()),await page.evaluate(()=>window.__placedMatrix));
    await page.evaluate(index=>window.__camera.setIndex(index),frames.length);await page.waitForFunction(()=>document.querySelector('#ar').placementState==='lost');
    assert.equal(await page.evaluate(()=>new Promise(resolve=>{const scene=document.querySelector('#ar');const unsubscribe=scene.app.onRender(()=>{unsubscribe();resolve(scene.app.getAnchor('poster').visible);});})),false);
    await page.getByRole('button',{name:'Detener',exact:true}).click();assert.equal(await page.evaluate(()=>document.querySelector('#ar').getDiagnosticsReport().recording),false);
  }finally{await page.close();}
});

test('Herramienta móvil: Android/Chrome e iOS/WebKit emulados exportan diagnóstico sin aprobar pruebas físicas',{timeout:60000},async()=>{
  const variants=[{platform:'android',browser,owned:false}];
  if(process.env.TEST_WEBKIT==='1')variants.push({platform:'ios',browser:await webkit.launch({headless:true}),owned:true});
  for(const variant of variants){
    const context=await variant.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,acceptDownloads:true}),page=await context.newPage();
    try{
      await page.goto(origin+'/examples/declarative-placement.html');
      const placementStart=await page.getByRole('button',{name:'Iniciar AR',exact:true}).boundingBox();
      assert.ok(placementStart&&placementStart.y>=0&&placementStart.y+placementStart.height<844,'Inicio visible en colocación móvil');
      await page.goto(origin+'/tools/device-tests.html');
      const quickStart=await page.getByRole('button',{name:'Iniciar cámara',exact:true}).boundingBox();
      assert.ok(quickStart&&quickStart.y>=0&&quickStart.y+quickStart.height<844,'Inicio visible antes del formulario móvil');
      const syntheticCamera=await page.evaluate(()=>!!navigator.mediaDevices?.getUserMedia&&typeof HTMLCanvasElement.prototype.captureStream==='function');
      if(syntheticCamera)await virtualCamera(page,[frames[0]]);
      else await page.addInitScript(()=>{if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Synthetic camera unavailable in this test environment','NotSupportedError');};});
      await page.reload();
      await page.selectOption('#platform',variant.platform);await page.fill('#device','Emulated '+variant.platform);await page.fill('#os','Automated fixture');await page.fill('#browser','Playwright');
      await page.getByRole('button',{name:'Iniciar cámara',exact:true}).tap();
      if(syntheticCamera)await page.waitForFunction(()=>document.querySelector('webar-scene').getDiagnosticsReport()?.poses.count>0,{},{timeout:15000});
      else{await page.waitForFunction(()=>document.querySelector('webar-scene').getDiagnosticsReport()?.recording===false);console.log(`${variant.platform}: camera API/capture unavailable in this automated environment; verified error report, not camera tracking.`);}
      const downloading=page.waitForEvent('download');await page.click('#export');const download=await downloading,suite=JSON.parse(await readFile(await download.path(),'utf8'));
      assert.equal(suite.kind,'webar-device-test-suite');assert.equal(suite.context.platform,variant.platform);assert.notEqual(suite.context.execution,'physical-user-reported');assert.equal(suite.reports[0].poses.count>0,syntheticCamera);
      if(syntheticCamera){assert.ok(suite.reports[0].tracking.frames>0);assert.ok(suite.reports[0].tracking.stages.workerMs.count>0);assert.ok(suite.reports[0].tracking.paths.fullDetections>0);assert.ok(suite.reports[0].tracking.paths.exactMatchingCalls>0);}
      assert.ok(suite.results.every(result=>result.result==='pending'));assert.match(suite.sdk.build,/^[a-f0-9]{16}$/);
      assert.equal(suite.reports[0].configuration.mode,'image');assert.equal(suite.reports[0].configuration.requestedFPS,30);
      assert.equal(JSON.stringify(suite).includes('deviceId'),false);
      if(syntheticCamera)await page.getByRole('button',{name:'Detener',exact:true}).click();assert.equal(await page.evaluate(()=>document.querySelector('webar-scene').engine),null);
      await page.screenshot({path:`tests/generated/device-${variant.platform}.png`,fullPage:true});
    }finally{await context.close();if(variant.owned)await variant.browser.close();}
  }
});


test('Móvil: controles arriba y gestos táctiles nativos sin scroll ni zoom del documento',{timeout:45000},async()=>{
  const page=await pageFor('<style>body{margin:0}webar-scene{height:650px}footer{height:1200px}</style><webar-scene id="ar" gestures keep-content-on-lost><webar-target src="/marker.png" target-id="poster"><webar-model id="model" src="/models/demo-plain.glb" size="0.16" animation="none"></webar-model></webar-target></webar-scene><footer>Fuera del visor se puede desplazar.</footer>',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
    await page.goto(origin+'/tests/declarative.html');
    const start=page.getByRole('button',{name:'Iniciar AR',exact:true}),startRect=await start.boundingBox();
    assert.ok(startRect.y>=0&&startRect.y+startRect.height<844,'Inicio accesible sin bajar hasta el final del visor');
    await start.tap();await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
    const center=()=>page.evaluate(()=>{
      const scene=document.querySelector('#ar'),el=document.querySelector('#model'),THREE=WebARFacil.THREE;
      el.model.updateWorldMatrix(true,true);const p=new THREE.Box3().setFromObject(el.model).getCenter(new THREE.Vector3()).project(scene.app.camera),r=scene.app.renderer.domElement.getBoundingClientRect();
      return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};
    });
    await page.evaluate(()=>{window.__touchSelected=0;document.querySelector('#model').addEventListener('ar-select',()=>window.__touchSelected++);});
    const cdp=await page.context().newCDPSession(page);
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({...p,id:i+1,radiusX:2,radiusY:2}))});
    let p=await center();await touch('touchStart',[p]);await touch('touchEnd',[]);
    await page.waitForFunction(()=>window.__touchSelected===1);
    const before=await page.evaluate(()=>({rotation:document.querySelector('#model').model.rotation.y,scale:document.querySelector('#model').model.scale.x,scroll:scrollY,zoom:visualViewport.scale}));
    p=await center();await touch('touchStart',[p]);
    for(let n=1;n<=5;n++)await touch('touchMove',[{x:p.x+8*n,y:p.y+5*n}]);
    await touch('touchEnd',[]);
    assert.ok(Math.abs(await page.evaluate(()=>document.querySelector('#model').model.rotation.y)-before.rotation)>.01);
    p=await center();await touch('touchStart',[p]);await touch('touchStart',[p,{x:p.x+15,y:p.y}]);
    await touch('touchMove',[{x:p.x-20,y:p.y},{x:p.x+45,y:p.y}]);await touch('touchEnd',[]);
    assert.ok(await page.evaluate(()=>document.querySelector('#model').model.scale.x)>before.scale);
    // El margen del visor también debe bloquear el desplazamiento del navegador.
    const view=await page.locator('#ar').evaluate(el=>{const r=el.shadowRoot.querySelector('.view').getBoundingClientRect();return{x:r.left+2,y:r.top+30};});
    await touch('touchStart',[view]);await touch('touchMove',[{x:view.x,y:view.y-25}]);await touch('touchEnd',[]);
    assert.deepEqual(await page.evaluate(()=>({scroll:scrollY,zoom:visualViewport.scale})),{scroll:before.scroll,zoom:before.zoom});
    await page.getByRole('button',{name:'Detener',exact:true}).tap();
    assert.equal(await page.locator('#ar').evaluate(el=>el.shadowRoot.querySelector('.view').style.touchAction),'');
    await touch('touchStart',[{x:195,y:790}]);for(let y=770;y>=690;y-=20)await touch('touchMove',[{x:195,y}]);await touch('touchEnd',[]);
    await page.waitForFunction(()=>scrollY>0); // Fuera del visor el scroll táctil sigue funcionando.
  }finally{await page.close();}
});


test('Matching WASM exacto en Chrome y WebKit: Worker real sin depender de getUserMedia',{timeout:60000},async()=>{
 const variants=[{browser,owned:false}];if(process.env.TEST_WEBKIT==='1')variants.push({browser:await webkit.launch({headless:true}),owned:true});
 for(const variant of variants){const page=await variant.browser.newPage();try{
  await page.route(/\/vision\/opencv\.js$/,route=>route.fulfill({status:404}));
  await page.goto(origin+'/examples/declarative.html');await page.waitForFunction(()=>!!globalThis.WebARFacil?.Tracker);
  const result=await page.evaluate(async()=>{
   const tracker=new WebARFacil.Tracker();
   try{
    await tracker.loadTarget(await(await fetch('/target.dat')).arrayBuffer());
    const bitmap=await createImageBitmap(await(await fetch('/marker.png')).blob()),canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,640,480);bitmap.close();
    const imageData=context.getImageData(0,0,640,480),pose=await tracker.processFrame({imageData,sessionId:1,timestampMs:performance.now(),mediaTimeSeconds:0,sourceWidth:640,sourceHeight:480});
    return{status:pose.status,profile:tracker.latestProfile,detached:imageData.data.buffer.byteLength===0};
   }finally{tracker.dispose();}
  });
  assert.equal(result.status,'tracked');assert.equal(result.detached,true);assert.equal(result.profile.counts.exactMatchingCalls,1);assert.equal(result.profile.counts.opencvMatchingCalls,0);
 }finally{await page.close();if(variant.owned)await variant.browser.close();}}
});


test('Herramienta móvil: cambiar modo aplica SLAM sin marcador y permite volver a imagen y pedir WebXR',{timeout:60000},async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),requests=[];
 try{
  await virtualCamera(page,[frames[0]]);page.on('request',request=>requests.push(new URL(request.url()).pathname));
  await page.goto(origin+'/tools/device-tests.html');
  await page.selectOption('#mode','flow');
  await page.waitForFunction(()=>document.querySelector('webar-scene').getAttribute('mode')==='slam'&&!document.querySelector('#start-camera').disabled);
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('webar-scene').engine?.state==='TrackingSurface');
  const flow=await page.evaluate(()=>{const scene=document.querySelector('webar-scene');return{targets:[...scene.engine.targetIds],children:scene.querySelectorAll('webar-target').length,configuration:scene.getDiagnosticsReport().configuration,guide:document.querySelector('#mode-guide').textContent};});
  assert.deepEqual(flow.targets,[]);assert.equal(flow.children,0);assert.equal(flow.configuration.mode,'slam');assert.equal(flow.configuration.backend,'optical-flow');assert.match(flow.guide,/sin marcador/i);
  assert.ok(!requests.includes('/marker.png')&&!requests.includes('/target.dat'),'El arranque espacial no carga marcador');
  await page.selectOption('#mode','image');await page.waitForFunction(()=>document.querySelector('webar-scene').getAttribute('mode')===null&&!document.querySelector('#start-camera').disabled);
  await page.locator('#start-camera').tap();await page.waitForFunction(()=>document.querySelector('webar-scene').app?.getAnchor('poster').visible);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelector('webar-scene').engine.targetIds]),['poster']);
  await page.locator('#start-flow').tap();await page.waitForFunction(()=>document.querySelector('webar-scene').engine?.state==='TrackingSurface');
  assert.deepEqual(await page.evaluate(()=>[...document.querySelector('webar-scene').engine.targetIds]),[]);
  await page.selectOption('#mode','webxr');await page.waitForFunction(()=>document.querySelector('webar-scene').getAttribute('backend')==='webxr'&&!document.querySelector('#start-camera').disabled);
  await page.evaluate(()=>{window.__xrRequest=null;Object.defineProperty(navigator,'xr',{configurable:true,value:{isSessionSupported:async()=>true,requestSession:async(mode,options)=>{window.__xrRequest={mode,options,activation:navigator.userActivation.isActive};throw new DOMException('XR_TEST_EXPECTED','NotAllowedError');}}});});
  await page.locator('#start-camera').tap();await page.getByRole('button',{name:'Activar SLAM',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__xrRequest),null,'La sesión XR espera su gesto dedicado');
  await page.getByRole('button',{name:'Activar SLAM',exact:true}).tap();await page.waitForFunction(()=>!!window.__xrRequest);
  const xr=await page.evaluate(()=>window.__xrRequest);assert.equal(xr.mode,'immersive-ar');assert.ok(xr.options.requiredFeatures.includes('hit-test'));assert.equal(xr.activation,true);
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('XR_TEST_EXPECTED'));
 }finally{await page.evaluate(()=>document.querySelector('webar-scene')?.stop());await context.close();}
});

test('Herramienta móvil: discrepancia de build avisa sin bloquear cámara compatible y permite reintentar permisos',{timeout:45000},async()=>{
 const variants=[{browser,owned:false}];if(process.env.TEST_WEBKIT==='1')variants.push({browser:await webkit.launch({headless:true}),owned:true});
 const code=await readFile('dist/webar-facil.min.js','utf8');
 for(const variant of variants){
  const context=await variant.browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  try{
   await page.addInitScript(()=>{
    window.__permissionRequests=0;
    const request=async()=>{window.__permissionRequests++;throw new DOMException('TEST_PERMISSION_DENIED','NotAllowedError');};
    if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=request;
    else Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getSupportedConstraints:()=>({}),getUserMedia:request}});
   });
   await page.goto(origin+'/dist/tools/device-tests.html');
   const installed=await page.evaluate(()=>({expected:document.querySelector('meta[name="webar-sdk-build"]').content,actual:WebARFacil.LIBRARY_BUILD,script:document.querySelector('script[src*="standalone"]').src,text:document.querySelector('#sdk-info').textContent}));
   assert.match(installed.expected,/^[a-f0-9]{16}$/);assert.equal(installed.expected,installed.actual);assert.ok(installed.script.includes('build='+installed.actual));assert.ok(installed.text.includes(installed.actual));
   await page.route(/webar-facil\.min\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:code+'\nglobalThis.WebARFacil={...globalThis.WebARFacil,LIBRARY_BUILD:"0000000000000000"};'}));
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#sdk-notice').hidden);
   assert.match(await page.locator('#sdk-notice').innerText(),/Puedes iniciar la cámara/);
   assert.equal(await page.locator('#start-camera').isDisabled(),false);assert.equal(await page.locator('#start-flow').isDisabled(),false);
   assert.equal(await page.evaluate(()=>window.__permissionRequests),0,'No solicitar cámara sin gesto');
   await page.locator('#start-camera').tap();await page.waitForFunction(()=>window.__permissionRequests===1&&document.querySelector('#message').textContent.includes('TEST_PERMISSION_DENIED'));
   await page.waitForFunction(()=>!document.querySelector('#start-camera').disabled);
   await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();await page.waitForFunction(()=>window.__permissionRequests===2);
   await page.waitForFunction(()=>!document.querySelector('#start-camera').disabled);
   assert.equal(await page.evaluate(()=>document.querySelector('webar-scene').engine),null);
   assert.equal(await page.locator('#sdk-notice').isVisible(),true);
  }finally{await context.close();if(variant.owned)await variant.browser.close();}
 }
});


test('Arranque móvil: pide cámara antes de un GLB lento; ambos botones funcionan y no duplican permisos',{timeout:45000},async()=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
 let releaseModel;const gate=new Promise(resolve=>{releaseModel=resolve;});
 try{
  await virtualCamera(page,[frames[0]]);
  await page.addInitScript(()=>{window.__permissionRequests=0;window.__activationAtRequest=[];const original=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=(constraints)=>{window.__permissionRequests++;window.__activationAtRequest.push(navigator.userActivation.isActive);return original(constraints);};});
  await page.route('**/models/demo-plain.glb',async route=>{await gate;await route.continue();});
  await page.goto(origin+'/tools/device-tests.html');
  await page.locator('#start-camera').tap();await page.waitForFunction(()=>window.__permissionRequests===1&&document.querySelector('webar-scene').engine?.videoElement.readyState>=2);
  assert.equal(await page.locator('#start-camera').isEnabled(),true);
  assert.equal(await page.evaluate(()=>!!document.querySelector('webar-model').model?.model),false,'La solicitud no espera a terminar el GLB');
  await page.locator('#start-camera').tap();assert.equal(await page.evaluate(()=>window.__permissionRequests),1,'Un segundo toque no abre otro stream');
  releaseModel();await page.waitForFunction(()=>document.querySelector('webar-scene').app?.getAnchor('poster').visible);
  await page.getByRole('button',{name:'Detener',exact:true}).tap();
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();await page.waitForFunction(()=>window.__permissionRequests===2&&document.querySelector('webar-scene').app?.getAnchor('poster').visible);
  assert.deepEqual(await page.evaluate(()=>window.__activationAtRequest),[true,true]);
 }finally{releaseModel();await page.evaluate(()=>document.querySelector('webar-scene')?.stop());await context.close();}
});

test('SDK ausente: los botones responden y muestran la causa sin pedir cámara',{timeout:30000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await page.addInitScript(()=>{window.__permissionRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.__permissionRequests++;throw new Error('Unexpected camera');};});
  await page.route(/webar-facil\.min\.js(?:\?.*)?$/,route=>route.fulfill({status:404,contentType:'text/plain',body:'not found'}));
  await page.goto(origin+'/tools/device-tests.html');assert.equal(await page.locator('#start-camera').isEnabled(),true);
  await page.locator('#start-camera').tap();assert.match(await page.locator('#message').innerText(),/No cargó el script/);
  await page.locator('#start-flow').tap();assert.match(await page.locator('#message').innerText(),/No se ha solicitado cámara/);
  assert.equal(await page.evaluate(()=>window.__permissionRequests),0);
 }finally{await page.close();}
});

test('Cámara nativa de Chrome: permiso, vídeo y reinicio móvil sin reemplazar getUserMedia',{timeout:45000},async()=>{
 const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
 const native=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const page=await native.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  // Hardware de prueba de Chromium: getUserMedia, constraints y play son nativos.
  // No es la cámara física de un Android y no certifica Safari/iPhone.
  await page.goto(origin+'/tools/device-tests.html');
  await page.evaluate(()=>{window.__phases=[];window.__ready=0;const scene=document.querySelector('webar-scene');scene.addEventListener('ar-status',event=>window.__phases.push(event.detail.message));scene.addEventListener('ar-ready',()=>window.__ready++);});
  for(const [index,button] of ['Iniciar cámara','Iniciar AR'].entries()){
   await page.getByRole('button',{name:button,exact:true}).tap();
   await page.waitForFunction(expected=>window.__ready===expected,index+1);
   await page.waitForFunction(()=>{const video=document.querySelector('webar-scene').engine?.videoElement;return video?.videoWidth>0&&video.currentTime>0&&!video.paused;});
   const state=await page.evaluate(()=>{const scene=document.querySelector('webar-scene'),video=scene.engine.videoElement;window.__tracks=video.srcObject.getTracks();return{phases:window.__phases,track:window.__tracks[0].readyState,width:scene.engine.cameraSettings.width};});
   assert.equal(state.track,'live');assert.ok(state.width>0);
   for(const phase of ['camera-requesting','camera-granted','camera-playing','camera-ready'])assert.ok(state.phases.includes(phase),phase);
   await page.getByRole('button',{name:'Detener',exact:true}).tap();
   assert.equal(await page.evaluate(()=>window.__tracks.every(track=>track.readyState==='ended')),true);
  }
 }finally{await page.close();await native.close();}
});

test('Perfiles declarativos: ahorro y auto aplican presupuestos y mantienen reconocimiento',{timeout:45000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await virtualCamera(page,[frames[0]]);await page.goto(origin+'/tools/device-tests.html');
  for(const [mode,fps,budget,maxWidth] of [['battery',20,172800,480],['auto',30,307200,640]]){
   await page.selectOption('#performance',mode);await page.locator('#start-camera').tap();
   await page.waitForFunction(()=>document.querySelector('webar-scene').getDiagnosticsReport()?.poses.count>0);
   const report=await page.evaluate(()=>document.querySelector('webar-scene').getDiagnosticsReport());
   assert.equal(report.configuration.performance,mode);assert.equal(report.configuration.requestedFPS,fps);
   assert.equal(report.configuration.maxFramePixels,budget);
   const sample=report.metrics.latestCamera;assert.equal(sample.performance,mode);
   assert.ok(sample.analysisWidth<=maxWidth);assert.ok(sample.analysisWidth*sample.analysisHeight<=budget);
   await page.getByRole('button',{name:'Detener',exact:true}).tap();
  }
 }finally{await page.close();}
});
