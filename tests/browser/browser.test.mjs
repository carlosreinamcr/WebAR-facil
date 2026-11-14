import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {createServer} from 'vite';
import {prepareFrames,prepareExampleMarkerFrame,virtualCamera,prepareVideo} from './helpers.mjs';
import {decodeMarker} from '../../src/tracking/ImageCompiler.ts';
import sharp from 'sharp';

let server,browser,frames,exampleMarker;
const origin='http://127.0.0.1:5187';
before(async()=>{
  frames=await prepareFrames();
  exampleMarker=await prepareExampleMarkerFrame();
  server=await createServer({server:{host:'127.0.0.1',port:5187,strictPort:true}});await server.listen();
  const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
  browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await prepareVideo(browser,origin);
});
after(async()=>{await browser?.close();await server?.close();});

test('script único: tolerancia, eventos y retención sin cortar la animación GLB',{timeout:45_000},async()=>{
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
  try{
    await virtualCamera(page,[exampleMarker,'/tests/generated/multi/blank.png']);await page.goto(origin+'/examples/plain-script.html');
    await page.evaluate(()=>{window.__found=0;window.__lost=0;window.__poses=0;app.engine.on('targetFound',()=>window.__found++);app.engine.on('targetLost',event=>{window.__lost++;window.__retained=event.retained;});app.engine.onPose(()=>window.__poses++);});
    await page.click('#start');await page.waitForFunction(()=>window.__found===1);
    await page.evaluate(()=>window.__camera.setIndex(1));await page.waitForFunction(()=>window.__lost===1);
    const state=await page.evaluate(()=>({visible:app.getAnchor('poster').visible,retained:window.__retained,poses:window.__poses}));
    assert.equal(state.visible,true);assert.equal(state.retained,true);
    const transform=await page.evaluate(()=>{model.updateMatrixWorld(true);let mesh;model.traverse(object=>{if(object.isMesh)mesh=object;});return [...mesh.matrixWorld.elements];});
    await page.waitForTimeout(200);
    const later=await page.evaluate(()=>{model.updateMatrixWorld(true);let mesh;model.traverse(object=>{if(object.isMesh)mesh=object;});return{poses:window.__poses,transform:[...mesh.matrixWorld.elements]};});
    assert.equal(later.poses,state.poses);assert.ok(later.transform.some((value,i)=>Math.abs(value-transform[i])>.0001),'la animación debe seguir con el marcador ausente');
    assert.equal(await page.evaluate(()=>{app.engine.setKeepContentOnLost(false);return app.getAnchor('poster').visible;}),false);
    assert.equal(await page.evaluate(()=>{app.engine.setKeepContentOnLost(true);return app.getAnchor('poster').visible;}),true);
    await page.evaluate(()=>window.__camera.setIndex(0));await page.waitForFunction(()=>window.__found===2);
    assert.equal(requests.some(url=>url.includes('/vendor/three.')),false,'standalone no requiere otro script Three.js');
    await page.click('#stop');assert.equal(await page.evaluate(()=>app.getAnchor('poster').visible),false);assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('MP4 real y chroma key: elimina verde en GPU y preserva el sujeto',{timeout:30_000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(origin);await page.locator('#start:enabled').waitFor();
    const result=await page.evaluate(async()=>{
      const THREE=window.THREE,{ThreeARVideo}=window.WebARFacil;
      const video=new ThreeARVideo({width:2,orientation:'upright',chromaKey:{color:'#00ff00',similarity:.12,smoothness:.08}});
      const renderer=new THREE.WebGLRenderer({preserveDrawingBuffer:true});renderer.setSize(192,128);
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x0000ff);scene.add(video);
      const camera=new THREE.OrthographicCamera(-1,1,4/3,0,.01,10);camera.position.z=2;
      try{
        await video.setSource('/tests/generated/chroma.mp4');await video.play();
        await new Promise(resolve=>video.videoElement.requestVideoFrameCallback(resolve));
        const gl=renderer.getContext(),pixel=(x,y)=>{const bytes=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return[...bytes];};
        renderer.render(scene,camera);const keyed=pixel(20,64),subject=pixel(96,64);
        video.setChromaKey(false);renderer.render(scene,camera);const original=pixel(20,64);
        return{keyed,subject,original,playing:!video.videoElement.paused};
      }finally{video.dispose();renderer.dispose();}
    });
    assert.equal(result.playing,true);assert.ok(result.keyed[2]>200&&result.keyed[1]<50,JSON.stringify(result));
    assert.ok(result.subject[0]>180&&result.subject[1]<80);assert.ok(result.original[1]>180&&result.original[2]<80);
  }finally{await page.close();}
});

test('MP4: no se pausa ni recarga durante pérdida del marcador',{timeout:35_000},async()=>{
  const page=await browser.newPage();
  try{
    await virtualCamera(page,[exampleMarker,'/tests/generated/multi/blank.png']);await page.goto(origin+'/examples/video.html');
    await page.setInputFiles('#file','tests/generated/chroma.mp4');await page.locator('#play:enabled').waitFor();await page.click('#play');
    await page.evaluate(()=>{window.__lost=0;window.__metadata=0;video.videoElement.addEventListener('loadedmetadata',()=>window.__metadata++);app.engine.on('targetLost',()=>window.__lost++);});
    await page.click('#start');await page.waitForFunction(()=>app.getAnchor('poster').visible);
    await page.evaluate(()=>window.__camera.setIndex(1));await page.waitForFunction(()=>window.__lost===1);
    const first=await page.evaluate(()=>video.videoElement.getVideoPlaybackQuality().totalVideoFrames);await page.waitForTimeout(200);
    const last=await page.evaluate(()=>({frames:video.videoElement.getVideoPlaybackQuality().totalVideoFrames,paused:video.videoElement.paused,visible:app.getAnchor('poster').visible,metadata:window.__metadata}));
    assert.equal(last.paused,false);assert.equal(last.visible,true);assert.equal(last.metadata,0);assert.ok(last.frames>first);
  }finally{await page.close();}
});

test('A-Frame vídeo: componente carga MP4, cambia chroma sin recargar y libera recursos',{timeout:30_000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(origin);await page.locator('#start:enabled').waitFor();
    const result=await page.evaluate(async()=>{
      let definition;window.WebARFacil.registerAFrameVideoComponent({registerComponent(name,value){definition=value;}});
      const el=document.createElement('div');el.object3D=new window.THREE.Group();
      const instance={el,data:{src:'/tests/generated/chroma.mp4',width:.2,chromaKey:true,keyColor:'#00ff00',similarity:.12,smoothness:.08,spill:.3,muted:true,loop:true}};
      definition.init.call(instance);let loads=0;instance.video.videoElement.addEventListener('loadedmetadata',()=>loads++);
      const loaded=new Promise((resolve,reject)=>{el.addEventListener('ar-video-loaded',resolve,{once:true});el.addEventListener('ar-video-error',event=>reject(event.detail),{once:true});});
      definition.update.call(instance,{});await loaded;await instance.video.play();
      const element=instance.video.videoElement,source=element.currentSrc;instance.data.similarity=.2;definition.update.call(instance,{...instance.data,similarity:.12});
      const state={loaded:loads,sourceSame:element.currentSrc===source,playing:!element.paused,attached:el.object3D.children.length===1};
      definition.remove.call(instance);return{...state,released:el.object3D.children.length===0&&element.paused};
    });
    assert.deepEqual(result,{loaded:1,sourceSame:true,playing:true,attached:true,released:true});
  }finally{await page.close();}
});

test('multiusuario de API: dos marcadores mantienen contenido y pérdida independientes',{timeout:45_000},async()=>{
  const page=await browser.newPage();
  try{
    await virtualCamera(page,['/tests/generated/multi/both.png','/tests/generated/multi/only-a.png']);
    await page.goto(origin+'/examples/multi-target.html');
    await page.setInputFiles('#image-a','public/marker.png');await page.setInputFiles('#image-b','tests/generated/multi/b.png');
    await page.evaluate(()=>{window.__seen=new Set();window.__losses=[];app.engine.on('targetFound',event=>window.__seen.add(event.targetId));app.engine.on('targetLost',event=>window.__losses.push(event.targetId));});
    await page.click('#start');await page.waitForFunction(()=>window.__seen.has('a')&&window.__seen.has('b'));
    const before=await page.evaluate(()=>({a:app.getAnchor('a').matrix.elements[12],b:app.getAnchor('b').matrix.elements[12]}));assert.ok(before.a<0&&before.b>0);
    await page.uncheck('#keep');await page.evaluate(()=>window.__camera.setIndex(1));await page.waitForFunction(()=>window.__losses.includes('b'));
    const after=await page.evaluate(()=>({a:app.getAnchor('a').visible,b:app.getAnchor('b').visible,ids:[...app.engine.targetIds]}));
    assert.deepEqual(after,{a:true,b:false,ids:['a','b']});
    await page.evaluate(()=>app.engine.removeTarget('b'));assert.deepEqual(await page.evaluate(()=>[...app.engine.targetIds]),['a']);
  }finally{await page.close();}
});

test('GLB real: geometría, textura y animación en normal, Draco y Meshopt',{timeout:60_000},async()=>{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(origin);await page.locator('#start:enabled').waitFor();
    const results=await page.evaluate(async()=>{
      const{ThreeARModel}=window.WebARFacil,THREE=window.THREE,results=[];
      for(const format of ['plain','draco','meshopt']){
        const model=new ThreeARModel();
        try{
          await model.load(`/models/demo-${format}.glb`);
          const box=new THREE.Box3().setFromObject(model,true),size=box.getSize(new THREE.Vector3());
          let mesh=null;model.traverse(object=>{if(object.isMesh)mesh=object;});
          model.updateMatrixWorld(true);const transform=mesh.matrixWorld.toArray();model.update(.1);model.updateMatrixWorld(true);
          let released=0;mesh.geometry.addEventListener('dispose',()=>released++);
          const result={format,size:Math.max(size.x,size.y,size.z),bottom:box.min.y,
            vertices:mesh.geometry.getAttribute('position').count,texture:mesh.material.map.image.width,
            animations:model.animations.length,animated:transform.some((v,i)=>Math.abs(v-mesh.matrixWorld.toArray()[i])>1e-5)};
          model.dispose();model.dispose();result.released=released;results.push(result);
        }finally{model.dispose();}
      }
      return results;
    });
    for(const result of results){assert.ok(Math.abs(result.size-.16)<1e-5,result.format);assert.ok(Math.abs(result.bottom)<1e-5);
      assert.ok(result.vertices>=8);assert.equal(result.texture,8);assert.equal(result.animations,1);
      assert.equal(result.animated,true,result.format);assert.equal(result.released,1);}
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('interfaz: modelo comprimido sustituye cubo, conserva tracking y permite cambiar contenido',{timeout:45_000},async()=>{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await virtualCamera(page,[frames[0]]);await page.goto(origin);await page.locator('#start:enabled').waitFor();
    await page.click('#start');await page.waitForFunction(()=>document.querySelector('#stage').dataset.tracked==='true');
    await page.click('#open-options');await page.locator('#model:visible').waitFor();
    for(const format of ['draco','meshopt']){
      await page.setInputFiles('#model',`public/models/demo-${format}.glb`);
      await page.waitForFunction(()=>document.querySelector('#model-info').textContent.includes('listo'));
      assert.equal(await page.locator('#stage').getAttribute('data-content'),'glb');
      assert.equal(await page.locator('#animation option').count(),2);
    }
    await page.setInputFiles('#model',[]);
    assert.equal(await page.locator('#stage').getAttribute('data-content'),'cube');
    await page.click('#open-options');
    await page.click('#stop');assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test('GLB: errores y cancelación conservan el modelo previo; componente A-Frame libera recursos',{timeout:40_000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(origin);await page.locator('#start:enabled').waitFor();
    const result=await page.evaluate(async()=>{
      const{ThreeARModel,registerAFrameModelComponent}=window.WebARFacil,THREE=window.THREE;
      const model=new ThreeARModel();await model.load('/models/demo-plain.glb');const original=model.model;
      let rejected=false,cancelled=false;
      try{await model.load(new Blob(['invalid']));}catch{rejected=true;}
      const abort=new AbortController();abort.abort();
      try{await model.load('/models/demo-draco.glb',{signal:abort.signal});}catch(error){cancelled=error.name==='AbortError';}
      const retained=model.model===original;model.dispose();
      const definitions={};registerAFrameModelComponent({registerComponent(name,definition){definitions[name]=definition;}});
      const el=document.createElement('div');el.object3D=new THREE.Group();
      const instance={el,data:{src:'/models/demo-meshopt.glb',fitSize:.1,autoplay:true}};
      const definition=definitions['my-ar-model'];definition.init.call(instance);
      const loaded=new Promise((resolve,reject)=>{el.addEventListener('ar-model-loaded',resolve,{once:true});el.addEventListener('ar-model-error',event=>reject(event.detail),{once:true});});
      definition.update.call(instance,{});await loaded;definition.tick.call(instance,0,16);
      const attached=el.object3D.children.length===1&&instance.model.animations.length===1;
      definition.remove.call(instance);
      return{rejected,cancelled,retained,attached,released:el.object3D.children.length===0};
    });
    assert.deepEqual(result,{rejected:true,cancelled:true,retained:true,attached:true,released:true});
  }finally{await page.close();}
});

test('Chrome móvil emulado: cámara → ORB/WASM → cubo → mapa local sin marcador', {timeout:60_000},async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('BROWSER:',error.message);});
  try{
    await virtualCamera(page,frames);await page.goto(origin);
    await page.locator('#start:enabled').waitFor();
    await page.click('#start');
    await page.waitForFunction(()=>document.querySelector('#stage').dataset.tracked==='true',{},{timeout:25_000});
    assert.equal(await page.locator('#stage').getAttribute('data-backend'),'image');
    await page.screenshot({path:'tests/generated/example-image.png'});
    await page.click('summary');
    await page.selectOption('#backend','optical-flow');await page.selectOption('#placement','preserve');
    await page.click('summary');
    await page.evaluate(()=>window.__camera.move());await page.click('#slam');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Puedes retirar el marcador'),{},{timeout:20_000});
    await page.waitForFunction(()=>window.__camera&&document.querySelector('#stage').dataset.backend==='optical-flow');
    await page.waitForTimeout(3500);
    assert.equal(await page.locator('#stage').getAttribute('data-tracked'),'true');
    await page.screenshot({path:'tests/generated/example-flow.png'});
    await page.click('#stop');await page.locator('#start:enabled').waitFor();
    assert.equal(await page.locator('#stage').getAttribute('data-tracked'),'false');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('compilador web: genera .dat real en Worker sin servicios externos',{timeout:40_000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(origin+'/tools/compile.html');await page.setInputFiles('#image','public/marker.png');
    const downloading=page.waitForEvent('download');await page.click('#compile');const download=await downloading;
    const bytes=await readFile(await download.path()),marker=decodeMarker(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
    assert.equal(marker.simulated,false);assert.ok(marker.keypoints.length/4>100);
    assert.match(await page.locator('#status').textContent(),/compilado/);
    await page.setInputFiles('#image','tests/generated/rotated-exif.jpg');
    const rotatedDownload=page.waitForEvent('download');await page.click('#compile');
    const rotated=await readFile(await (await rotatedDownload).path()),oriented=decodeMarker(rotated.buffer.slice(rotated.byteOffset,rotated.byteOffset+rotated.length));
    assert.equal(oriented.width,600);assert.equal(oriented.height,800);
  }finally{await page.close();}
});

test('calibrador web: carga WASM y descarga tablero imprimible',{timeout:40_000},async()=>{
  const page=await browser.newPage();
  try{
    await page.goto(origin+'/tools/calibrate.html');await page.locator('#board:enabled').waitFor({timeout:25_000});
    const downloading=page.waitForEvent('download');await page.click('#board');const download=await downloading;
    assert.equal(download.suggestedFilename(),'charuco-21x15cm.png');assert.ok((await readFile(await download.path())).length>1000);
  }finally{await page.close();}
});

test('medición en dispositivo: genera informe local con latencia y rAF separados',{timeout:30_000},async()=>{
  const page=await browser.newPage();
  try{
    await virtualCamera(page,[frames[0]]);await page.goto(origin+'/tools/benchmark.html');await page.click('#start');
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='tracked');
    await page.click('#stop');await page.locator('#download:visible').waitFor();
    const report=JSON.parse(await page.locator('#report').textContent());assert.ok(report.poses>0);assert.ok(report.captureToPoseMs.p50>=0);assert.ok(report.tenSecondBuckets.length>0);
    const downloading=page.waitForEvent('download');await page.click('#download');assert.equal((await downloading).suggestedFilename(),'webar-device-benchmark.json');
  }finally{await page.close();}
});

test('GPU: rectifica distorsión y permite reiniciar después de perder WebGL',{timeout:40_000},async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await virtualCamera(page,['/tests/generated/gradient.png']);await page.goto(origin);await page.locator('#start:enabled').waitFor();
    await page.click('#start');await page.locator('#slam:enabled').waitFor();
    // Verify the advanced GPU API independently; the user-facing demo has no calibration step.
    const encoded=await page.evaluate(async()=>{
      const THREE=window.THREE,{ThreeCameraBackground}=window.WebARFacil;
      const calibration=await(await fetch('/tests/generated/distorted-calibration.json')).json();
      const background=new ThreeCameraBackground(document.querySelector('#stage video'),calibration);
      const renderer=new THREE.WebGLRenderer(),scene=new THREE.Scene(),camera=new THREE.Camera();
      renderer.setSize(320,240);scene.add(background.object3D);
      await new Promise(resolve=>document.querySelector('#stage video').requestVideoFrameCallback(resolve));
      try{renderer.render(scene,camera);return renderer.domElement.toDataURL().split(',')[1];}
      finally{background.dispose();renderer.dispose();}
    });
    const {data,info}=await sharp(Buffer.from(encoded,'base64')).raw().toBuffer({resolveWithObject:true});
    const x=Math.round(80/640*info.width),y=Math.round(100/480*info.height),u=(x+.5)/info.width*640,v=(y+.5)/info.height*480;
    const a=(u-320)/650,b=(v-240)/650,r2=a*a+b*b,factor=1+.6*r2-.05*r2*r2;
    const dx=2*.001*a*b-.002*(r2+2*a*a),dy=.001*(r2+2*b*b)-.004*a*b;
    const expectedR=((a*factor+dx)*650+320)/639*255,expectedG=((b*factor+dy)*650+240)/479*255;
    const offset=(y*info.width+x)*info.channels;
    assert.ok(Math.abs(data[offset]-expectedR)<3,`Canal R ${data[offset]} vs ${expectedR}`);
    assert.ok(Math.abs(data[offset+1]-expectedG)<3,`Canal G ${data[offset+1]} vs ${expectedG}`);
    await page.evaluate(()=>{window.__lostGL=document.querySelector('#stage canvas').getContext('webgl2').getExtension('WEBGL_lose_context');window.__lostGL.loseContext();});
    await page.waitForFunction(()=>document.querySelector('#start').disabled&&document.querySelector('#status').textContent.includes('WebGL perdido'));
    await page.waitForTimeout(250);await page.evaluate(()=>window.__lostGL.restoreContext());
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('WebGL recuperado'));
    await page.click('#start');await page.locator('#slam:enabled').waitFor();await page.click('#stop');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('WebKit: compilador WASM funciona sin dependencias del renderer',{timeout:40_000,skip:process.env.TEST_WEBKIT!=='1'},async()=>{
  const webkitBrowser=await webkit.launch({headless:true});
  const page=await webkitBrowser.newPage();
  page.on('pageerror',error=>console.error('WEBKIT:',error.message));
  try{
    await page.goto(origin+'/tools/compile.html');await page.setInputFiles('#image','public/marker.png');
    const downloading=page.waitForEvent('download');await page.click('#compile');
    const download=await downloading;
    assert.ok((await readFile(await download.path())).length>10_000);
    // Verificar también tracking y mapa local con el mismo Worker real en WebKit.
    const result=await page.evaluate(async()=>{
      const{Tracker,OpticalFlowSLAM}=await import('/dist/webar-facil.core.js');
      const k={width:640,height:480,fx:650,fy:650,cx:320,cy:240},url=new URL('/vision/opencv.js',location.href).href;
      const tracker=new Tracker({opencvURL:url,calibration:k});
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d',{willReadFrequently:true});
      const frame=async i=>{const image=new Image();image.src=`/tests/generated/frame-${String(i).padStart(2,'0')}.png`;await image.decode();context.drawImage(image,0,0);return{imageData:context.getImageData(0,0,640,480),sessionId:1,timestampMs:i*33,mediaTimeSeconds:i/30,sourceWidth:640,sourceHeight:480};};
      let flow;
      try{
        await tracker.loadTarget(await(await fetch('/target.dat')).arrayBuffer());
        const detected=await tracker.processFrame(await frame(0));if(detected.status!=='tracked')throw new Error('No se detectó imagen en WebKit.');
        flow=new OpticalFlowSLAM({intrinsics:k,floorROI:{x:0,y:.35,width:1,height:.65},opencvURL:url,seed:detected.reference});await flow.start();tracker.dispose();
        let last,ready=false;for(let i=1;i<42;i++){last=await flow.processFrame(await frame(i));ready ||= last?.status==='tracked'&&last.environmentReady;}
        return{status:last.status,ready,scale:last.scale,x:last.worldFromCamera?.[12]};
      }finally{tracker.dispose();flow?.dispose();}
    });
    assert.equal(result.status,'tracked');assert.equal(result.ready,true);assert.equal(result.scale,'metric');assert.ok(Math.abs(result.x-.082)<.04,JSON.stringify(result));
    const models=await page.evaluate(async()=>{
      window.THREE=await import('/vendor/three.module.js');
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/dist/webar-facil.browser.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
      const results=[];
      for(const format of ['plain','draco','meshopt']){
        const model=new window.WebARFacil.ThreeARModel({dracoDecoderPath:'/decoders/draco/'});
        try{await model.load(`/models/demo-${format}.glb`);results.push({format,loaded:!!model.model,animations:model.animations.length});}
        finally{model.dispose();}
      }
      return results;
    });
    assert.ok(models.every(model=>model.loaded&&model.animations===1));
  }finally{await webkitBrowser.close();}
});

test('CSP: Workers estáticos funcionan sin permitir eval en la página',{timeout:30_000},async()=>{
  const context=await browser.newContext();
  await context.route(origin+'/tests/csp.html',route=>route.fulfill({contentType:'text/html',headers:{
    'Content-Security-Policy':"script-src 'self'; worker-src 'self'; connect-src 'self'",
  },body:'<!doctype html><title>CSP test</title><p>Worker isolation</p>'}));
  await context.route(origin+'/dist/workers/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),
    'Content-Security-Policy':"script-src 'self' 'unsafe-eval'; connect-src 'self'",
  }});});
  const page=await context.newPage();
  try{
    await page.goto(origin+'/tests/csp.html');
    const result=await page.evaluate(async()=>{
      const violations=[];document.addEventListener('securitypolicyviolation',event=>violations.push(event.violatedDirective));
      const{Tracker}=await import('/dist/webar-facil.core.js');
      const tracker=new Tracker({opencvURL:new URL('/vision/opencv.js',location.href),workerFactory:()=>new Worker('/dist/workers/tracking.js',{type:'module'})});
      try{await tracker.loadTarget(await(await fetch('/target.dat')).arrayBuffer());return{loaded:tracker.hasTarget,violations};}finally{tracker.dispose();}
    });
    assert.equal(result.loaded,true);assert.deepEqual(result.violations,[]);
  }finally{await context.close();}
});

test('WebKit: MP4 nativo con playsinline y reproducción explícita',{timeout:35_000,skip:process.env.TEST_WEBKIT!=='1'},async()=>{
  const engine=await webkit.launch({headless:true}),page=await engine.newPage();
  try{
    await page.goto(origin+'/tools/compile.html');
    const result=await page.evaluate(async()=>{
      window.THREE=await import('/vendor/three.module.js');
      await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/dist/webar-facil.browser.min.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
      const video=new window.WebARFacil.ThreeARVideo({chromaKey:{color:'#00ff00'}});
      try{
        await video.setSource('/tests/generated/chroma.mp4');await video.play();await new Promise(resolve=>setTimeout(resolve,200));
        return{width:video.videoElement.videoWidth,time:video.videoElement.currentTime,inline:video.videoElement.playsInline,muted:video.videoElement.muted};
      }finally{video.dispose();}
    });
    assert.equal(result.width,192);assert.equal(result.inline,true);assert.equal(result.muted,true);assert.ok(result.time>0);
  }finally{await engine.close();}
});

test('escritorio sin WebXR: subir JPG compila y activa el marcador sin .dat ni JSON',{timeout:60_000},async()=>{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await virtualCamera(page,[frames[0]]);
    await page.addInitScript(()=>{
      Object.defineProperty(navigator,'xr',{configurable:true,value:undefined});
      const supported=navigator.mediaDevices.getSupportedConstraints.bind(navigator.mediaDevices);
      navigator.mediaDevices.getSupportedConstraints=()=>({...supported(),facingMode:false});
    });
    await page.goto(origin);await page.locator('#start:enabled').waitFor();
    assert.equal(await page.locator('#calibration').count(),0);
    await page.setInputFiles('#target','public/marker.jpg');await page.click('#start');
    await page.waitForFunction(()=>document.querySelector('#stage').dataset.tracked==='true',null,{timeout:40_000});
    assert.equal(await page.locator('#stage').getAttribute('data-backend'),'image');
    assert.match(await page.locator('#target-info').textContent(),/No necesitas cargar/);
    await page.click('summary');
    const metadata=await page.locator('#download-json').evaluate(async link=>JSON.parse(await(await fetch(link.href)).text()));
    assert.equal(metadata.format,'WART');assert.ok(metadata.quality.featureCount>100);assert.ok(Math.abs(metadata.physicalWidthMeters-.2)<1e-6);
    const data=await page.locator('#download-dat').evaluate(async link=>Array.from(new Uint8Array(await(await fetch(link.href)).arrayBuffer())));
    const decoded=decodeMarker(new Uint8Array(data).buffer);assert.equal(decoded.simulated,false);
    await page.click('#stop');await page.locator('#start:enabled').waitFor();assert.deepEqual(errors,[]);
    await page.waitForFunction(async()=>await caches.has('webar-facil-markers-v1')&&
      (await (await caches.open('webar-facil-markers-v1')).keys()).length===1);
    const hits=await page.evaluate(async()=>{
      const engine=new WebARFacil.WebAREngine(),statuses=[];
      engine.onStatus(status=>statuses.push(status));
      try{
        const image=await (await fetch('/marker.jpg')).blob();
        const same=await engine.loadImageTarget(image);
        const cached=statuses.includes('target-cache-hit');
        statuses.length=0;
        const resized=await engine.loadImageTarget(image,{physicalWidthMeters:.3});
        return {cached,otherCached:statuses.includes('target-cache-hit'),widths:[same.metadata.physicalWidthMeters,resized.metadata.physicalWidthMeters]};
      }finally{engine.dispose();}
    });
    assert.deepEqual(hits,{cached:true,otherCached:false,widths:[.2,.3]});
  }finally{await page.close();}
});

test('API ESM: una aplicacion propia usa loadImageTarget sin la interfaz de demostracion',{timeout:40_000},async()=>{
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await virtualCamera(page,[exampleMarker]);await page.goto(origin+'/examples/custom-app.html');
    await page.click('#start');await page.waitForFunction(()=>document.querySelector('#status').textContent==='tracked');
    await page.click('#stop');await page.locator('#start:enabled').waitFor();assert.deepEqual(errors,[]);
  }finally{await page.close();}
});
