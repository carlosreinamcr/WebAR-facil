// Ejecutar explícitamente contra la instalación XAMPP de desarrollo.
// Todos los datos generados llevan execution=automated; no son evidencia física.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium,webkit,request} from 'playwright';
import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';

const base=process.env.WEBAR_COLLECTOR_URL||'http://localhost/2/';
let browser,http;
const api=new URL('diagnostics/api.php',base).href;
before(async()=>{
 const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
 browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 http=await request.newContext({ignoreHTTPSErrors:true});
});
after(async()=>{await browser?.close();await http?.dispose();});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function list(){const response=await http.get(api+'?action=list');assert.equal(response.status(),200);return(await response.json()).reports;}
async function until(predicate,timeout=15000){
 const limit=Date.now()+timeout;while(Date.now()<limit){const value=await predicate();if(value)return value;await pause(200);}throw new Error('No llegó la confirmación del recolector.');
}
async function pageFor(name,root=base){
 const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{
  const prefix='webar-local-reports-v1:';localStorage.setItem(prefix+'label',JSON.stringify('VERIFICACIÓN AUTOMÁTICA'));
  navigator.mediaDevices.getUserMedia=async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const context=canvas.getContext('2d');
   const image=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='./assets/marcador.jpg';});
   const draw=()=>{context.fillStyle='#26313a';context.fillRect(0,0,640,480);const scale=Math.min(320/image.width,300/image.height),w=image.width*scale,h=image.height*scale;context.drawImage(image,(640-w)/2,(480-h)/2,w,h);};
   draw();const timer=setInterval(draw,60),stream=canvas.captureStream(30);
   stream.getTracks().forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};});return stream;
  };
 });
 await page.goto(new URL('Examples/'+name,root).href);
 await page.waitForFunction(()=>globalThis.WebARLocalReports&&document.querySelector('#webar-local-reports [data-status]').textContent.startsWith('Conectado'));
 return page;
}

test('PHP local: validación, privacidad, secuencias y almacenamiento sin duplicar sesión',async()=>{
 const config=await(await http.get(api+'?action=config')).json();
 const id=randomUUID(),run=randomUUID();
 const data={token:config.token,client:{id,label:'VERIFICACIÓN API',platform:'desktop'},runId:run,sequence:1,example:'01-modelo-marcador.html',reason:'manual',report:{schemaVersion:1,kind:'webar-diagnostics',createdAt:new Date().toISOString(),sdk:{version:'test',build:'test'},state:'Camera',context:{execution:'automated'},poses:{count:1,backends:{image:1}},odometry:{frames:0},camera:{width:640,deviceId:'NO_GUARDAR',image:'data:image/png;base64,NO_GUARDAR'},timeline:[{atMs:1,event:'error',detail:'https://private.example/no C:/private/file'}],targets:{poster:{recoveriesMs:[1,2]}},image:'NO_GUARDAR'}};
 const denied=await http.post(api+'?action=report',{data:{...data,token:'wrong'}});assert.equal(denied.status(),403);
 const foreign=await http.post(api+'?action=report',{headers:{Origin:'https://foreign.example'},data});assert.equal(foreign.status(),403);
 const first=await(await http.post(api+'?action=report',{data})).json();assert.equal(first.ok,true);
 const response=await http.get(api+'?action=report&id='+first.id),saved=await response.json();
 assert.equal(saved.report.image,undefined);assert.equal(saved.report.camera.deviceId,undefined);assert.equal(saved.report.camera.image,undefined);
 assert.deepEqual(saved.report.poses.backends,{image:1});assert.equal(saved.report.odometry.frames,0);assert.deepEqual(saved.report.targets.poster.recoveriesMs,[1,2]);assert.ok(!JSON.stringify(saved).includes(config.token));
 const second=await http.post(api+'?action=report',{data:{...data,sequence:2,report:{...data.report,poses:{count:2}}}});assert.equal(second.status(),200);
 const old=await(await http.post(api+'?action=report',{data})).json();assert.equal(old.accepted,false);
 const latest=await(await http.get(api+'?action=report&id='+first.id)).json();assert.equal(latest.report.poses.count,2);
 assert.equal((await list()).filter(row=>row.id===first.id).length,1);
 const large=await http.post(api+'?action=report',{data:'x'.repeat(270000)});assert.equal(large.status(),413);
});

test('Comparación SLAM: el recolector guarda el intento sin colocación',{timeout:20000},async()=>{
 const page=await pageFor('slam-comparison.html');
 try{
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#ar').getDiagnosticsReport()?.observations.some(item=>item.testId==='slam-comparison-placement'));
  await page.getByRole('button',{name:'Finalizar prueba'}).click();
  const row=await until(async()=>(await list()).find(item=>item.client.id===client.id&&item.example==='slam-comparison.html'&&!item.recording));
  const saved=await(await http.get(api+'?action=report&id='+row.id)).json();
  assert.equal(saved.report.context.execution,'automated');
  assert.ok(saved.report.observations.some(item=>item.testId==='slam-comparison-placement'&&item.result==='fail'));
 }finally{await page.close();}
});

test('Cliente: inicio tras espera vacía, envío periódico, cierre y panel del PC',{timeout:45000},async()=>{
 const page=await pageFor('01-modelo-marcador.html');
 try{
  // Antes no hay informe: probar este caso evita bloquear futuros envíos tras una espera.
  await page.evaluate(()=>WebARLocalReports.send());
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  const interval=await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.reason==='interval'),23000);
  assert.equal(interval.execution,'automated');
  const snapshot=await(await http.get(api+'?action=report&id='+interval.id)).json();assert.ok(snapshot.report.metrics.processingMs.count>0);
  await page.getByRole('button',{name:'Detener',exact:true}).tap();
  await until(async()=>(await list()).find(row=>row.id===interval.id&&!row.recording));
  const panel=await browser.newPage();
  try{
   await panel.goto(new URL('diagnostics/',base).href);await panel.check('#automated');
   await until(async()=>await panel.locator('#device option').count()>1);
   await panel.selectOption('#device',client.id);
   assert.ok((await panel.locator('#rows').textContent()).includes('01-modelo-marcador.html'));
   await panel.getByRole('button',{name:'Ver JSON',exact:true}).first().click();await panel.locator('#detail:not([hidden])').waitFor();
  }finally{await panel.close();}
 }finally{await page.close();}
});

test('Cola sin red: último snapshot se conserva y se reintenta al cambiar de ejemplo',{timeout:30000},async()=>{
 const page=await pageFor('03-cambiar-modelo-marcador.html');
 const pattern=/\/diagnostics\/api\.php\?action=report$/;
 try{
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.route(pattern,route=>route.abort());
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await until(async()=>await page.evaluate(()=>JSON.parse(localStorage.getItem('webar-local-reports-v1:pending')||'[]').length>0));
  await page.getByRole('button',{name:'Detener',exact:true}).tap();
  await page.unroute(pattern);
  await page.goto(new URL('Examples/04-texto-marcador.html',base).href);
  const received=await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.example==='03-cambiar-modelo-marcador.html'&&!row.recording));
  assert.ok(received.sequence>=2);
  await until(async()=>await page.evaluate(()=>JSON.parse(localStorage.getItem('webar-local-reports-v1:pending')||'[]').length===0));
 }finally{await page.close();}
});

test('A-Frame y teléfono HTTPS: mismo recolector sin contenido mixto',{timeout:30000},async()=>{
 const secure=process.env.WEBAR_COLLECTOR_HTTPS||'https://192.168.1.16//2/';
 const page=await pageFor('25-aframe.html',secure),failures=[];
 page.on('requestfailed',request=>failures.push(request.url()));
 try{
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.locator('#start:enabled').waitFor();await page.click('#start');
  await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.example==='25-aframe.html'));
  await page.click('#stop');
  const ended=await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.example==='25-aframe.html'&&!row.recording));
  assert.equal(ended.execution,'automated');assert.deepEqual(failures,[]);
 }finally{await page.close();}
});

test('Guardar y siguiente: cierra cámara y conserva el equipo al avanzar',{timeout:20000},async()=>{
 const page=await pageFor('01-modelo-marcador.html');
 try{
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).tap();
  await page.waitForFunction(()=>document.querySelector('webar-scene').engine?.videoElement.readyState>=2);
  await page.locator('#webar-local-reports summary').click();
  await page.getByRole('button',{name:'Guardar y siguiente',exact:true}).click();
  await page.waitForURL('**/02-gestos-marcador.html');
  await page.waitForFunction(()=>globalThis.WebARLocalReports);
  assert.equal((await page.evaluate(()=>WebARLocalReports.getClient())).id,client.id);
  await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.example==='01-modelo-marcador.html'&&!row.recording));
 }finally{await page.close();}
});

test('WebKit: un fallo de permiso se recoge aunque no llegue ar-ready',{timeout:20000},async()=>{
 const wk=await webkit.launch({headless:true}),page=await wk.newPage();
 try{
  await page.addInitScript(()=>{
   Object.defineProperty(navigator,'webdriver',{configurable:true,get:()=>true});
   localStorage.setItem('webar-local-reports-v1:label',JSON.stringify('VERIFICACIÓN WebKit'));
   Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getSupportedConstraints:()=>({}),getUserMedia:async()=>{throw new DOMException('Permiso rechazado en prueba WebKit','NotAllowedError');}}});
  });
  await page.goto(new URL('Examples/01-modelo-marcador.html',base).href);
  await page.waitForFunction(()=>globalThis.WebARLocalReports);
  const client=await page.evaluate(()=>WebARLocalReports.getClient());
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
  const result=await until(async()=>(await list()).find(row=>row.client.id===client.id&&row.errors>0));
  assert.equal(result.poses,0);assert.equal(result.execution,'automated');
 }finally{await page.close();await wk.close();}
});
