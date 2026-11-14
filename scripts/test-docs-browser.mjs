/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {prepareFrames,prepareExampleMarkerFrame,virtualCamera} from '../tests/browser/helpers.mjs';

let server,browser;
try{
  const frames=await prepareFrames();
  const startGuide=await readFile('docs/getting-started.md','utf8');
  const starter=startGuide.match(/```html\r?\n([\s\S]*?)```/)?.[1];
  assert.ok(starter?.includes('<!doctype html>')&&starter.includes('<webar-scene>'),'La guía debe comenzar con un HTML declarativo completo');
  server=await createServer({server:{host:'127.0.0.1',port:5191,strictPort:true},plugins:[{name:'docs-starter-fixture',configureServer(vite){
    vite.middlewares.use((request,response,next)=>{
      if(request.url!=='/dist/docs-starter.html'){next();return;}
      // Respuesta HTTP real para probar literalmente las rutas relativas del tutorial.
      response.setHeader('Content-Type','text/html; charset=utf-8');response.end(starter);
    });
  }}]});await server.listen();
  const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
  browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  let page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5191/docs/');
  assert.equal(await page.locator('main h1').textContent(),'Manual de WebAR Fácil');
  await page.fill('#search','chroma');await page.locator('#results a').first().waitFor();
  assert.ok(await page.locator('#results a').count()>0);
  await page.press('#search','Escape');
  await page.locator('header').getByRole('link',{name:'English'}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(await page.locator('main h1').textContent(),'WebAR Fácil documentation');
  await page.fill('#search','chroma');await page.locator('#results a').first().waitFor();
  await page.locator('header').getByRole('link',{name:'Español'}).click();
  assert.equal(await page.locator('html').getAttribute('lang'),'es');
  await page.goto('http://127.0.0.1:5191/docs/getting-started.html');
  const guideCode=await page.locator('pre code').allTextContents();
  assert.ok(guideCode.some(code=>code.includes('<webar-scene>')&&code.includes('webar-facil.min.js')));
  assert.equal(guideCode.some(code=>code.includes('new ThreeARScene')),false,'El inicio no debe exigir construir renderer/motor');
  assert.ok(await page.locator('pre button').count()>0);
  await mkdir('tests/generated',{recursive:true});
  await page.screenshot({path:'tests/generated/docs-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'El manual no debe desbordar horizontalmente en móvil');
  await page.screenshot({path:'tests/generated/docs-mobile.png',fullPage:true});
  await virtualCamera(page,[frames[0]]);
  await page.goto('http://127.0.0.1:5191/dist/docs-starter.html');
  await page.waitForFunction(()=>globalThis.WebARFacil&&globalThis.WebARFacil===globalThis.MiLibreriaAR);
  await page.getByRole('button',{name:'Iniciar AR',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('webar-scene').app?.getAnchor('poster').visible,{},{timeout:45000});
  assert.equal(await page.evaluate(()=>document.querySelector('webar-model').model.animations.length>0),true);
  await page.getByRole('button',{name:'Detener',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('webar-scene').engine===null);
  // Conservar la alternativa avanzada como regresión independiente.
  await page.close();
  page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await virtualCamera(page,[await prepareExampleMarkerFrame()]);
  await page.goto('http://127.0.0.1:5191/examples/documented-app.html');
  await page.click('#start');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Visible:'),{},{timeout:45000});
  assert.equal(await page.evaluate(()=>app.getAnchor('poster').visible),true);
  assert.equal(await page.evaluate(()=>model.animations.length>0),true);
  await page.click('#stop');
  await page.waitForFunction(()=>document.querySelector('#start').disabled===false);
  assert.equal(await page.evaluate(()=>app.getAnchor('poster').visible),false);
  await page.goto('http://127.0.0.1:5191/examples/slam-iphone.html');
  await page.click('#start');
  await page.waitForFunction(()=>app.engine.state==='TrackingSurface'&&!document.querySelector('#stop').disabled,{},{timeout:45000});
  assert.deepEqual(await page.evaluate(()=>[...app.engine.targetIds]),[],'El ejemplo SLAM no registra ningún marcador');
  await page.click('#stop');
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  assert.equal(await page.evaluate(()=>app.engine.state),'Idle');
  assert.deepEqual(errors,[]);
  console.log('Manual desktop/móvil, búsqueda, HTML declarativo literal de inicio, alternativas avanzadas y tracking WASM real: OK. Cámara sintética; no certifica hardware físico.');
}catch(error){
  console.error(error instanceof Error?error.stack:String(error));process.exitCode=1;
}finally{await browser?.close();await server?.close();}
