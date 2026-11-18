import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {prepareFrames,prepareExampleMarkerFrame,virtualCamera} from './helpers.mjs';

let server,browser,exampleMarker,files;
const origin='http://127.0.0.1:5199';
before(async()=>{
 await prepareFrames();exampleMarker=await prepareExampleMarkerFrame();
 files=(await readdir('examples/PRUEBAS')).filter(name=>/^(1[4-9]|2[0-5])-.*\.html$/.test(name)).sort();
 const a=await sharp('examples/assets/marcador.jpg').resize(240,180).png().toBuffer(),b=await sharp('examples/assets/marcador2.jpg').resize(240,180).png().toBuffer();
 for(const [name,showA] of [['extra-both',true],['extra-only-b',false]]){
  const overlays=[{input:b,left:360,top:140}];if(showA)overlays.push({input:a,left:40,top:140});
  await sharp({create:{width:640,height:480,channels:4,background:'#26313a'}}).composite(overlays).png().toFile(`tests/generated/${name}.png`);
 }
 server=await createServer({server:{host:'127.0.0.1',port:5199,strictPort:true}});await server.listen();
 const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
 browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async()=>{await browser?.close();await server?.close();});
async function open(number,images=[exampleMarker,'/tests/generated/multi/blank.png']){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 if(number===25)await page.addInitScript(()=>{window.__motionPermissionRequests=0;if(globalThis.DeviceOrientationEvent)DeviceOrientationEvent.requestPermission=async()=>{window.__motionPermissionRequests++;return 'granted';};});
 await virtualCamera(page,images);await page.goto(origin+'/examples/PRUEBAS/'+files[number-14]);return page;
}
async function start(page){
 await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
 await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible,null,{timeout:15000});
}

test('PRUEBAS 14–25: rutas solicitadas, controles móviles y recursos fuente/distribución',{timeout:60000},async()=>{
 assert.equal(files.length,12);const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const prefix of ['/examples/PRUEBAS/','/dist/examples/PRUEBAS/'])for(const file of files){
   if(prefix.startsWith('/examples/')){
    const html=await readFile('examples/PRUEBAS/'+file,'utf8');
    const sdk=file.startsWith('25-')?'webar-facil.browser.min.js':'webar-facil.min.js';
    assert.ok(html.includes('src="../dist/'+sdk+'"'),file);
    if(!file.startsWith('22-'))assert.ok(html.includes('../assets/marcador.jpg'),file);
   }
   await page.goto(origin+prefix+file);
   const aframe=file.startsWith('25-');
   if(aframe)await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   else await page.waitForFunction(()=>typeof document.querySelector('#ar')?.start==='function');
   const button=page.getByRole('button',{name:aframe?'Iniciar cámara':'Iniciar AR',exact:true}),rect=await button.boundingBox();
   assert.ok(await button.isEnabled(),file);assert.ok(rect.y>=0&&rect.y+rect.height<844,file+' inicio visible');
   const sources=await page.locator('webar-target,webar-model,webar-video').evaluateAll(elements=>elements.map(element=>new URL(element.getAttribute('src'),location.href).href));
   for(const source of sources)assert.equal((await page.request.get(source)).status(),200,source);
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('PRUEBAS 14–18: multimarcador, tres clips, chroma vivo, archivos locales y retención',{timeout:120000},async()=>{
 let page=await open(14,['/tests/generated/extra-both.png','/tests/generated/extra-only-b.png']);
 try{
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await page.waitForFunction(()=>{const app=document.querySelector('#ar').app;return app?.getAnchor('robot').visible&&app.getAnchor('cohete').visible;});
  await page.evaluate(()=>window.__camera.setIndex(1));await page.waitForFunction(()=>document.querySelector('#robot-state').textContent.includes('perdido'));
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('cohete').visible),true);
 }finally{await page.close();}
 page=await open(15);
 try{
  await start(page);assert.equal(await page.locator('#clip option').count(),3);await page.selectOption('#clip','Salto');
  assert.equal(await page.evaluate(()=>document.querySelector('#model').model.animationState.name),'Salto');
  await page.click('#pause');assert.equal(await page.evaluate(()=>document.querySelector('#model').model.animationState.paused),true);
  await page.click('#resume');assert.equal(await page.evaluate(()=>document.querySelector('#model').model.animationState.paused),false);
 }finally{await page.close();}
 page=await open(16);
 try{
  await start(page);await page.waitForFunction(()=>document.querySelector('#video').video.videoElement.currentTime>0);
  const source=await page.evaluate(()=>document.querySelector('#video').video.videoElement.currentSrc);
  await page.uncheck('#keyed');assert.equal(await page.evaluate(()=>document.querySelector('#video').video.mesh.material.uniforms.keyed.value),false);
  await page.locator('#similarity').evaluate(input=>{input.value='.25';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.check('#keyed');
  assert.equal(await page.evaluate(()=>document.querySelector('#video').video.mesh.material.uniforms.similarity.value),.25);
  assert.equal(await page.evaluate(()=>document.querySelector('#video').video.videoElement.currentSrc),source);
 }finally{await page.close();}
 page=await open(17);
 try{
  await page.setInputFiles('#image-file','examples/assets/marcador.jpg');await page.setInputFiles('#model-file','examples/assets/cohete.glb');
  await page.click('#apply-files');await page.waitForFunction(()=>document.querySelector('#ar').app?.getAnchor('poster').visible);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#model').model.model.getObjectByName('fusaje')),true);
  await page.getByRole('button',{name:'Detener',exact:true}).tap();await start(page);
 }finally{await page.close();}
 page=await open(18);
 try{
  await start(page);await page.check('#retain');await page.evaluate(()=>window.__camera.setIndex(1));
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('retenida'));
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('poster').visible),true);
  await page.uncheck('#retain');assert.equal(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('poster').visible),false);
 }finally{await page.close();}
});

test('PRUEBAS 19–24: picking, catálogo, transición real, rechazo XR, perfiles y contenido compuesto',{timeout:120000},async()=>{
 let page=await open(19);
 try{
  await start(page);
  const point=await page.evaluate(()=>{const {THREE}=WebARFacil,app=document.querySelector('#ar').app,head=document.querySelector('#model').model.model.getObjectByName('cabeza');head.updateWorldMatrix(true,true);const p=new THREE.Box3().setFromObject(head).getCenter(new THREE.Vector3()).project(app.camera),r=app.renderer.domElement.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2};});
  await page.touchscreen.tap(point.x,point.y);
  assert.match(await page.locator('#part-info').textContent(),/cabeza/);
 }finally{await page.close();}
 page=await open(20);
 try{
  await start(page);await page.evaluate(()=>{window.__stream=document.querySelector('#ar').engine.videoElement.srcObject;});
  await page.selectOption('#product','cohete.glb');await page.waitForFunction(()=>!!document.querySelector('#model').model.model.getObjectByName('fusaje'));
  await page.locator('#color').evaluate(input=>{input.value='#ff0000';input.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.evaluate(()=>document.querySelector('#model').model.model.getObjectByName('fusaje').material.color.getHexString()),'ff0000');
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine.videoElement.srcObject===window.__stream),true);
 }finally{await page.close();}
 page=await open(21,frames);
 try{
  await start(page);await page.evaluate(()=>window.__camera.move());await page.click('#transition');
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('transición: preserved'),null,{timeout:25000});
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine.state),'TrackingSurface');
 }finally{await page.close();}
 page=await open(22);
 try{
  await page.evaluate(()=>{window.__requests=[];Object.defineProperty(navigator,'xr',{configurable:true,value:{isSessionSupported:async()=>true,requestSession:async(mode,options)=>{window.__requests.push({mode,options,active:navigator.userActivation.isActive});throw new DOMException('XR test rejected','NotSupportedError');}}});});
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();await page.getByRole('button',{name:'Activar SLAM',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Odometría por cámara activa'));
  const requests=await page.evaluate(()=>window.__requests);assert.equal(requests.length,1);assert.ok(requests[0].options.requiredFeatures.includes('hit-test'));assert.equal(requests[0].active,true);
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine.state),'TrackingSurface');
  assert.ok(await page.evaluate(()=>document.querySelector('#ar').getDiagnosticsReport().timeline.some(event=>event.detail==='webxr-failed-using-fallback')));
 }finally{await page.close();}
 page=await open(23);
 try{
  await page.selectOption('#profile','battery');await page.click('#apply-profile');await page.waitForFunction(()=>document.querySelector('#ar').getDiagnosticsReport()?.poses.count>0);
  const download=page.waitForEvent('download');await page.click('#download');const file=await download,report=JSON.parse(await readFile(await file.path(),'utf8'));
  assert.equal(report.reports[0].configuration.performance,'battery');
 }finally{await page.close();}
 page=await open(24);
 try{
  await start(page);assert.equal(await page.evaluate(()=>document.querySelector('#ar').app.getAnchor('poster').children.length),3);
  await page.click('#toggle-model');assert.equal(await page.evaluate(()=>document.querySelector('#model').model.visible),false);
  await page.click('#toggle-video');assert.equal(await page.evaluate(()=>document.querySelector('#video').video.videoElement.paused),true);
  await page.fill('#caption','Contenido combinado');assert.equal(await page.evaluate(()=>!!document.querySelector('#ar').app.getAnchor('poster').getObjectByName('texto-compuesto')),true);
 }finally{await page.close();}
});

test('PRUEBAS 25: A-Frame 1.8.0 real, wrappers oficiales, cámara y reinicio',{timeout:45000},async()=>{
 const page=await open(25),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.locator('#start:enabled').waitFor();await page.click('#start');await page.waitForFunction(()=>document.querySelector('#anchor').object3D.visible);
  assert.equal(await page.evaluate(()=>!!document.querySelector('#content').components['my-ar-model'].model.model),true);
  await page.waitForFunction(()=>document.querySelector('#aframe-scene').renderer.info.render.calls>=2);
  assert.equal(await page.evaluate(()=>document.querySelector('#aframe-scene').renderer.getContext().getError()),0);
  assert.equal(await page.evaluate(()=>window.__motionPermissionRequests),0,'El tracker visual no necesita permiso de orientación');
  await page.click('#stop');assert.equal(await page.evaluate(()=>window.__camera.stream.getTracks().every(track=>track.readyState==='ended')),true);
  await page.click('#start');await page.waitForFunction(()=>document.querySelector('#anchor').object3D.visible);
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
