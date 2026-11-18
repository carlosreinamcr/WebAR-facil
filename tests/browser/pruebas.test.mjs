import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium,webkit} from 'playwright';
import {prepareFrames,prepareExampleMarkerFrame,virtualCamera} from './helpers.mjs';
import {floorScene} from '../fixtures/floor-scene.mjs';
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

let server,browser,frames,floorFrames,exampleMarker;
const origin='http://127.0.0.1:5198';
let recipes,galleryCount;
before(async()=>{
 frames=await prepareFrames();
 exampleMarker=await prepareExampleMarkerFrame();
 const numbered=(await readdir('examples/PRUEBAS')).filter(name=>/^\d\d-.*\.html$/.test(name)).sort();
 galleryCount=numbered.length;recipes=numbered.filter(name=>Number(name.slice(0,2))<=13);
 const world=floorScene();floorFrames=[];
 for(let index=0;index<55;index++){
  const file=`tests/generated/floor-${index}.png`,image=world.render(index*.012);
  await writeFile(file,await sharp(image.data,{raw:{width:640,height:480,channels:4}}).png().toBuffer());floorFrames.push('/'+file);
 }
 server=await createServer({server:{host:'127.0.0.1',port:5198,strictPort:true}});await server.listen();
 const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
 browser=process.env.WEBAR_TEST_WEBKIT==='1'?await webkit.launch({headless:true}):
  await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async()=>{await browser?.close();await server?.close();});

test('PRUEBAS: 13 HTML fuente y distribuidos cargan SDK, recursos y controles móviles',{timeout:60000},async()=>{
 assert.equal(recipes.length,13);
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  for(const prefix of ['/examples/PRUEBAS/','/dist/examples/PRUEBAS/']){
   await page.goto(origin+prefix+'index.html');assert.equal(await page.locator('ol a').count(),galleryCount);
   for(const name of recipes){
    await page.goto(origin+prefix+name);
    await page.waitForFunction(()=>typeof document.querySelector('webar-scene')?.start==='function');
    const button=page.getByRole('button',{name:'Iniciar AR',exact:true});assert.ok(await button.isEnabled(),name);
    const bounds=await button.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<844,'Inicio visible: '+name);
    assert.equal(await page.evaluate(()=>document.querySelector('webar-scene').engine),null);
    const sources=await page.locator('webar-model,webar-video,webar-target').evaluateAll(elements=>elements.map(element=>new URL(element.getAttribute('src'),location.href).href));
    for(const src of sources){const response=await page.request.get(src);assert.equal(response.status(),200,src);}
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

async function runningRecipe(number){
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await virtualCamera(page,number<7?[frames[0]]:floorFrames);
 await page.goto(origin+'/examples/PRUEBAS/'+recipes[number-1]);
 await page.evaluate(()=>{window.__ready=false;document.querySelector('#ar').addEventListener('ar-ready',()=>{window.__ready=true;});});
 await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();await page.waitForFunction(()=>window.__ready);
 if(number>=7){
  await page.evaluate(()=>window.__camera.move());
  await page.waitForFunction(()=>document.querySelector('#ar').placementState==='surface-found',null,{timeout:25000});
  await page.getByRole('button',{name:'Colocar aquí',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('#ar').placementState==='placed');
  await page.evaluate(()=>window.__camera.freeze());
 }else await page.waitForFunction(()=>document.querySelector('#ar').app.getAnchor('poster').visible);
 return page;
}

async function contentChecks(page,number){
 const kind=(number-1)%6+1;
 if(kind===1){assert.equal(await page.evaluate(()=>!!document.querySelector('#model').model.model.getObjectByName('cabeza')),true);}
 if(kind===2){
  async function center(){
   await page.locator('webar-scene canvas').scrollIntoViewIfNeeded();
   return page.evaluate(()=>{
   const {THREE}=WebARFacil,app=document.querySelector('#ar').app,model=document.querySelector('#model').model;
   model.updateWorldMatrix(true,true);const point=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()).project(app.camera),rect=app.renderer.domElement.getBoundingClientRect();
   const cx=rect.left+(point.x+1)/2*rect.width,cy=rect.top+(1-point.y)/2*rect.height;
   const clip=app.renderer.domElement.parentElement.getBoundingClientRect();
   const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
   for(let radius=0;radius<=90;radius+=3){
    for(let angle=0;angle<Math.PI*2;angle+=Math.PI/6){
     const x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle);
     if(x<Math.max(0,clip.left)+3||x>Math.min(innerWidth,clip.right)-26||
       y<Math.max(0,clip.top)+3||y>Math.min(innerHeight,clip.bottom)-3)continue;
     ray.setFromCamera(ndc.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),app.camera);
     if(ray.intersectObject(model,true).length)return {x,y};
    }
   }
   return null;
  });}
  await page.getByRole('button',{name:'Mover',exact:true}).tap();let point=await center();
  assert.ok(point,'El modelo tiene una zona visible para mover');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+22,point.y,{steps:5});await page.mouse.up();
  assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('#model').model.position.x)+Math.abs(document.querySelector('#model').model.position.z)>.001),'Mover cambia posición local');
  await page.getByRole('button',{name:'Girar y escalar',exact:true}).tap();point=await center();
  assert.ok(point,'El modelo tiene una zona visible para girar');
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+22,point.y,{steps:5});await page.mouse.up();
  assert.ok(await page.evaluate(()=>Math.abs(document.querySelector('#model').model.rotation.y)>.01),'Arrastrar gira');
  point=await center();
  assert.ok(point,'El modelo tiene una zona visible para pellizcar');
  const scale=await page.evaluate(({x,y})=>{
   const scene=document.querySelector('#ar'),canvas=scene.app.renderer.domElement,model=document.querySelector('#model').model;
   const before=model.scale.x;
   const send=(type,id,clientX)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX,clientY:y,button:0,pointerType:'touch',bubbles:true,cancelable:true}));
   send('pointerdown',31,x);send('pointerdown',32,x+10);send('pointermove',32,x+22);send('pointerup',32,x+22);send('pointerup',31,x);
   return{before,after:model.scale.x};
  },point);assert.ok(scale.after>scale.before,'Pellizcar escala');
 }
 if(kind===3){
  await page.evaluate(()=>{const scene=document.querySelector('#ar');window.__app=scene.app;window.__stream=scene.engine.videoElement.srcObject;});
  await page.getByRole('button',{name:'Cohete',exact:true}).tap();await page.waitForFunction(()=>!!document.querySelector('#model').model.model?.getObjectByName('fusaje'));
  assert.equal(await page.evaluate(()=>{const scene=document.querySelector('#ar');return scene.app===window.__app&&scene.engine.videoElement.srcObject===window.__stream;}),true);
 }
 if(kind===4){
  const before=await page.evaluate(()=>{const anchor=document.querySelector('#ar').app.getAnchor(document.querySelector('webar-target')?'poster':'default'),text=anchor.getObjectByName('texto-del-usuario');return{uuid:text.material.map.uuid,pixels:text.material.map.image.toDataURL()};});
  await page.fill('#text','Mi texto AR de prueba');await page.getByRole('button',{name:'Mostrar texto',exact:true}).tap();
  const after=await page.evaluate(()=>{const anchor=document.querySelector('#ar').app.getAnchor(document.querySelector('webar-target')?'poster':'default'),text=anchor.getObjectByName('texto-del-usuario');return{uuid:text.material.map.uuid,pixels:text.material.map.image.toDataURL(),visible:anchor.visible};});
  assert.equal(after.uuid,before.uuid);assert.notEqual(after.pixels,before.pixels);assert.equal(after.visible,true);
 }
 if(kind===5){await page.waitForFunction(()=>{const video=document.querySelector('#video').video?.videoElement;return video&&!video.paused&&video.currentTime>0;});}
 if(kind===6){
  const before=await page.evaluate(()=>document.querySelector('#ar').app.scene.children.find(object=>object.isDirectionalLight).position.toArray());
  await page.locator('#light-angle').evaluate(input=>{input.value='180';input.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>{const light=document.querySelector('#ar').app.scene.children.find(object=>object.isDirectionalLight);return Math.abs(light.position.x-light.target.position.x)<.01;});
  const after=await page.evaluate(()=>document.querySelector('#ar').app.scene.children.find(object=>object.isDirectionalLight).position.toArray());
  assert.notDeepEqual(after,before);assert.equal(await page.locator('#angle-value').textContent(),'180°');
 }
}

test('PRUEBAS 01–06: marcador real, GLB, traslación/giro/pellizco, sustitución, texto, MP4 y luz',{timeout:120000},async()=>{
 for(let number=1;number<=6;number++){
  const page=await runningRecipe(number);
  try{await contentChecks(page,number);await page.getByRole('button',{name:'Detener',exact:true}).tap();assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine),null);}
  finally{await page.close();}
 }
});

test('Comparación SLAM: guía por textura, colocación manual y medidas en el informe',{timeout:45000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await virtualCamera(page,[...floorFrames,'/tests/generated/multi/blank.png']);
  await page.goto(origin+'/examples/slam-comparison.html');
  await page.evaluate(()=>document.querySelector('#ar').addEventListener('ar-status',({detail})=>{
   if(detail.message==='camera-playing')window.__camera.setIndex(Number(document.body.dataset.blankIndex));
  }));
  await page.evaluate(index=>document.body.dataset.blankIndex=String(index),floorFrames.length);
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await page.getByText('Apunta a una zona bien iluminada con bordes o detalles visibles.').waitFor();
  await page.evaluate(()=>window.__camera.setIndex(0));
  await page.getByText('Desplaza el teléfono lentamente hacia un lado. Mantén la zona visible.').waitFor();
  await page.evaluate(()=>window.__camera.move());
  const place=page.getByRole('button',{name:'Colocar aquí',exact:true});
  await place.waitFor({timeout:25000});
  const gridVisible=()=>page.evaluate(()=>{
   const grid=document.querySelector('#ar').app.scene.getObjectByProperty('type','GridHelper');
   return !!grid?.visible&&!!grid.parent?.visible;
  });
  assert.equal(await gridVisible(),true);
  await place.tap();
  assert.equal(await gridVisible(),false);
  assert.match(await page.locator('#surface').textContent(),/^[0-9.]+ s$/);
  assert.match(await page.locator('#placed').textContent(),/^[0-9.]+ s$/);
  await page.getByRole('button',{name:'Finalizar prueba'}).tap();
  const report=await page.evaluate(()=>document.querySelector('#ar').getDiagnosticsReport());
  assert.equal(report.recording,false);
  assert.ok(report.observations.some(item=>item.testId==='slam-comparison-placement'&&item.result==='pass'));
  assert.ok(report.timeline.some(item=>item.event==='scan-guidance'&&item.detail==='low-texture'));
  assert.equal(report.timeline.filter(item=>item.detail==='surface-tracked').length,1);
  assert.equal(report.timeline.filter(item=>item.detail==='tracked').length,0);
 }finally{await page.close();}
});

test('PRUEBA 27: modal, visor completo, calidad, foto, grabación con audio y guardado',{timeout:60000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 try{
  await virtualCamera(page,[exampleMarker]);
  await page.goto(origin+'/dist/examples/PRUEBAS/27-pantalla-completa.html');
  await page.evaluate(()=>{
   const scene=document.querySelector('webar-scene');window.files=[];window.requests=[];window.micStops=0;
   scene.addEventListener('ar-media',event=>window.files.push(event.detail.file));
   const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{
    window.requests.push(constraints);
    if(!constraints.audio)return original(constraints);
    const audio=new AudioContext(),oscillator=audio.createOscillator(),gain=audio.createGain(),output=audio.createMediaStreamDestination();
    gain.gain.value=.05;oscillator.connect(gain);gain.connect(output);oscillator.start();await audio.resume();
    const track=output.stream.getAudioTracks()[0],stop=track.stop.bind(track);
    track.stop=()=>{stop();window.micStops++;void audio.close();};
    return output.stream;
   };
   Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.length===1});
   Object.defineProperty(navigator,'share',{configurable:true,value:async({files})=>{window.shared=files[0].name;}});
  });
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('webar-scene').app?.getAnchor('poster').visible);
  assert.equal(await page.evaluate(()=>{
   const scene=document.querySelector('webar-scene'),view=scene.shadowRoot.querySelector('.view'),canvas=scene.app.renderer.domElement;
   const a=view.getBoundingClientRect(),b=canvas.getBoundingClientRect();
   const touch=new Event('touchmove',{cancelable:true});view.dispatchEvent(touch);
   return a.width===innerWidth&&a.height>=innerHeight-1&&b.width>=a.width-1&&b.height>=a.height-1&&touch.defaultPrevented&&scrollY===0;
  }),true);
  const media=page.locator('webar-scene .media-menu');
  await media.locator('summary').tap();
  await media.getByRole('checkbox',{name:/Activar ahorro/}).check();
  await page.waitForFunction(()=>window.requests.length>=2&&document.querySelector('webar-scene').app?.getAnchor('poster').visible);
  assert.equal(await page.evaluate(()=>window.requests[1].video.height.ideal),480);
  if(!(await media.evaluate(el=>el.open)))await media.locator('summary').tap();
  await media.getByRole('button',{name:'Tomar foto'}).tap();
  await page.waitForFunction(()=>window.files.length===1);
  const photo=await page.evaluate(async()=>{
   const file=window.files[0],image=await createImageBitmap(file),canvas=document.createElement('canvas');
   canvas.width=canvas.height=16;const context=canvas.getContext('2d');context.drawImage(image,0,0,16,16);
   const pixels=context.getImageData(0,0,16,16).data;
   return{type:file.type,width:image.width,height:image.height,lit:pixels.some((value,i)=>i%4!==3&&value>30)};
  });
  assert.equal(photo.type,'image/jpeg');assert.ok(photo.height>photo.width);assert.equal(photo.lit,true);
  await media.getByRole('button',{name:'Compartir',exact:true}).tap();
  assert.match(await page.evaluate(()=>window.shared),/\.jpg$/);
  await media.getByRole('button',{name:'Grabar con micrófono'}).tap();
  const finish=media.getByRole('button',{name:'Detener grabación'});
  await finish.waitFor();await page.waitForTimeout(900);await finish.tap();
  await page.waitForFunction(()=>window.files.length===2&&window.micStops===1);
  const movie=await page.evaluate(async()=>{
   const file=window.files[1],bytes=new TextDecoder('latin1').decode(await file.arrayBuffer());
   return{type:file.type,size:file.size,request:window.requests[2],audio:/soun|A_OPUS|A_VORBIS/.test(bytes)};
  });
  assert.match(movie.type,/^video\/(mp4|webm)/);assert.ok(movie.size>1000);assert.deepEqual(movie.request,{audio:true,video:false});
  assert.equal(movie.audio,true);
  await page.getByRole('button',{name:'Sesión',exact:true}).tap();
  await page.getByRole('dialog').getByRole('button',{name:'Detener',exact:true}).tap();
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).waitFor();
  if(!(await media.evaluate(el=>el.open)))await media.locator('summary').tap();
  const download=page.waitForEvent('download');await media.getByRole('link',{name:'Guardar archivo'}).click();
  assert.match((await download).suggestedFilename(),/\.(mp4|webm)$/);
 }finally{await page.close();}
});

test('PRUEBA 28: la cámara vertical sigue visible y sin permiso de movimiento se bloquea la barra',{timeout:45000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 try{
  await virtualCamera(page,floorFrames,{width:480,height:640});
  await page.addInitScript(()=>{
   Object.defineProperty(DeviceMotionEvent,'requestPermission',{value:async()=> 'denied',configurable:true});
  });
  await page.goto(origin+'/dist/examples/PRUEBAS/28-escala-metrica.html');
  await page.getByRole('button',{name:'Probar cámara y sensores'}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('modo relativo'));
  await page.waitForTimeout(750);
  assert.equal(await page.evaluate(()=>window.__camera.stream.getVideoTracks()[0].readyState),'live');
  const {channels}=await sharp(await page.locator('#view canvas').screenshot()).stats();
  assert.ok(channels.slice(0,3).some(channel=>channel.mean>20),'el fondo muestra vídeo real');
  assert.ok(await page.getByRole('button',{name:'Mostrar barra de 2 m'}).isDisabled());
  await page.getByRole('button',{name:'Detener',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Sesión detenida.');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Guardar diagnóstico'}).click()]);
  const diagnostic=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(diagnostic.metricScale.permission,'denied');
  assert.equal(diagnostic.metricScale.metersPerUnit,null);
  assert.equal(diagnostic.metricScale.windowsEvaluated,0);
  assert.equal(diagnostic.metricScale.timing.estimatedOffsetMs,null);
  assert.equal(diagnostic.metricScale.rejectedWindows.sensorGap,0);
  assert.equal(diagnostic.metricScale.guidedMotion,null);
  assert.ok(diagnostic.odometry.frames>0);
  assert.equal(diagnostic.timeline.some(item=>item.event==='error'),false);
 }finally{await page.close();}
});

test('PRUEBA 28: la guía espera el seguimiento, repite el tramo perdido y registra la referencia',{timeout:45000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 try{
  await virtualCamera(page,floorFrames,{width:480,height:640});
  await page.addInitScript(()=>{
   Object.defineProperty(DeviceMotionEvent,'requestPermission',{value:async()=> 'granted',configurable:true});
  });
  await page.goto(origin+'/dist/examples/PRUEBAS/28-escala-metrica.html');
  await page.evaluate(()=>{
   window.__stableForGuide=false;
   const estimator=window.WebARFacil.ExperimentalMetricScale.prototype;
   // Keep the UI test deterministic while the virtual camera stays still.
   estimator.hasStableVisualTracking=()=>window.__stableForGuide;
   estimator.interrupt=()=>{};
   window.WebARFacil.WebAREngine.prototype.checkSLAMVisualReference=async (action,id)=>{
    if(action==='capture')return {status:'captured',points:30};
    assertReferenceId(id);
    return {status:'verified',directReturnUnits:.1,trajectoryDeltaUnits:.2,medianImageShiftPx:1};
   };
   function assertReferenceId(id){if(id!=='right1Retry1')throw new Error('Referencia del tramo incorrecta');}
  });
  await page.getByRole('button',{name:'Probar cámara y sensores'}).click();
  const guide=page.getByRole('button',{name:'Iniciar prueba guiada'});
  await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Buscando seguimiento estable'));
  assert.ok(await guide.isDisabled());
  await page.getByLabel('Medí 20 cm entre las dos posiciones del teléfono').check();
  await page.evaluate(()=>{window.__stableForGuide=true;});
  await guide.click();
  await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('derecha'));
  await page.evaluate(()=>{window.__stableForGuide=false;});
  await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('Seguimiento perdido'));
  await page.evaluate(()=>{window.__stableForGuide=true;});
  await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('derecha'));
  await page.waitForFunction(()=>document.querySelector('#guide').textContent.includes('quieto en esta posición'));
  await page.waitForFunction(()=>document.querySelector('#metrics').textContent.includes('referencia directa: 0.100 unidades'));
  await page.getByRole('button',{name:'Detener',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Sesión detenida.');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Guardar diagnóstico'}).click()]);
  const report=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(report.metricScale.guidedMotion.state,'interrupted');
  assert.ok(report.metricScale.guidedMotion.phasesShown>=2);
  assert.ok(report.metricScale.guidedPhases.baseline.durationMs>=3900);
  assert.ok(report.metricScale.guidedPhases.right1);
  assert.ok(report.metricScale.guidedPhases.right1Retry1);
  assert.equal(report.metricScale.guidedMotion.retries,1);
  assert.equal(report.metricScale.guidedMotion.referenceMeters,.2);
  assert.equal(report.metricScale.guidedMotion.referenceVerified,true);
  assert.equal(report.metricScale.guidedMotion.comparison.right1,undefined);
  assert.equal(report.metricScale.guidedMotion.comparison.right1Retry1.estimatedMeters,null);
  assert.equal(report.metricScale.guidedMotion.comparison.right1Retry1.absoluteErrorMeters,null);
  assert.equal(report.metricScale.guidedMotion.returnChecks.roundTrip1.visualReference.verification.trajectoryDeltaUnits,.2);
 }finally{await page.close();}
});

test('PRUEBA 26: apunta a una zona, confirma una propuesta local y permite volver a escanear',{timeout:45000},async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  await virtualCamera(page,floorFrames);
  await page.goto(origin+'/dist/examples/PRUEBAS/26-colocacion-con-mira.html');
  await page.getByRole('button',{name:'Iniciar cámara'}).tap();
  await page.locator('#aim').waitFor({state:'visible'});
  await page.getByRole('button',{name:'Escanear aquí'}).tap();
  await page.evaluate(()=>window.__camera.move());
  await page.getByRole('button',{name:'Colocar aquí'}).tap({timeout:25000});
  assert.match(await page.locator('#message').textContent(),/Modelo colocado/);
  await page.getByRole('button',{name:'Otra zona'}).tap();
  await page.locator('#aim').waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Colocar aquí'}).isDisabled(),true);
 }finally{await page.close();}
});

test('PRUEBAS 07–12: odometría real, colocación y contenido interactivo sin marcador',{timeout:180000},async()=>{
 for(let number=7;number<=12;number++){
  const page=await runningRecipe(number);
  try{await contentChecks(page,number);assert.equal(await page.evaluate(()=>document.querySelector('#ar').getDiagnosticsReport().poses.backends['optical-flow']>0),true);}
  finally{await page.close();}
 }
});

test('PRUEBAS 13: guardar typed arrays, recuperar mapa tras reiniciar y relocalizar; borrar copia',{timeout:60000},async()=>{
 const page=await runningRecipe(13);
 try{
  await page.getByRole('button',{name:'Guardar mapa',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('#map-info').textContent.startsWith('Mapa guardado:'));
  const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const request=indexedDB.open('webar-pruebas-mapas',1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{
    const database=request.result,tx=database.transaction('maps'),read=tx.objectStore('maps').get('mesa-de-prueba');
    read.onsuccess=()=>{const value=read.result;resolve({typed:value.map.keyframes[0].points instanceof Float32Array,keys:value.map.keyframes.length});};tx.oncomplete=()=>database.close();
   };
  }));assert.equal(stored.typed,true);assert.ok(stored.keys>0);
  await page.getByRole('button',{name:'Detener',exact:true}).tap();
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();await page.waitForFunction(()=>!document.querySelector('#restore-map').disabled);
  await page.getByRole('button',{name:'Recuperar mapa',exact:true}).tap();
  await page.waitForFunction(()=>/Mapa cargado|Mapa relocalizado/.test(document.querySelector('#message').textContent));
  await page.evaluate(()=>window.__camera.setIndex(8));
  await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Mapa relocalizado'),null,{timeout:20000});
  await page.getByRole('button',{name:'Eliminar guardado',exact:true}).tap();await page.waitForFunction(()=>document.querySelector('#map-info').textContent.startsWith('No hay mapa'));
  assert.equal(await page.evaluate(()=>document.querySelector('#ar').engine.state),'TrackingSurface');
 }finally{await page.close();}
});
