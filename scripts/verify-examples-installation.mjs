/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
// Prueba la instalación HTTP real, sin Vite ni sustituciones de rutas.
// La cámara es sintética: valida inicio/recursos/lifecycle, no sensores físicos.
import {chromium} from 'playwright';
import {readdir,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';

const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
const directory=option('--directory'),base=new URL(option('--url'));
if(!directory||!['http:','https:'].includes(base.protocol))throw new Error('Indica --directory y --url HTTP/HTTPS.');
const files=(await readdir(directory)).filter(name=>name.endsWith('.html')).sort();
const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
const browser=await chromium.launch({...(channel?{channel}:{}),headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{
 for(const name of files){
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const errors=[],missing=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)missing.push({url:response.url(),status:response.status()});});
  try{
    await page.addInitScript(()=>{
      let image;
      navigator.mediaDevices.getUserMedia=async()=>{
        if(!image)image=await new Promise((resolve,reject)=>{const item=new Image();item.onload=()=>resolve(item);item.onerror=reject;item.src=new URL('./assets/marcador.jpg',location.href);});
        const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
        const context=canvas.getContext('2d');
        const draw=()=>{context.fillStyle='#26313a';context.fillRect(0,0,640,480);const ratio=Math.min(320/image.width,300/image.height);const w=image.width*ratio,h=image.height*ratio;context.drawImage(image,(640-w)/2,(480-h)/2,w,h);};
        draw();const stream=canvas.captureStream(30),timer=setInterval(draw,60);
        for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
        window.__testStream=stream;return stream;
      };
    });
    const response=await page.goto(new URL(name,base).href);assert.equal(response.status(),200);
    const sources=await page.locator('[src],[href],[data-model]').evaluateAll(elements=>elements.flatMap(element=>['src','href','data-model'].map(key=>element.getAttribute(key)).filter(value=>value&&!/^(data:|blob:|#)/.test(value)).map(value=>new URL(value,location.href).href)));
    for(const url of new Set(sources)){
      if(new URL(url).origin!==base.origin)continue;
      const response=await page.request.get(url);assert.equal(response.status(),200,`${name}: ${url}`);
    }
    if(name!=='index.html'){
      const aframe=name.startsWith('25-');
      if(aframe){
        await page.locator('#start:enabled').waitFor();await page.click('#start');
        await page.waitForFunction(()=>/Marcador preparado|Modelo seguido/.test(document.querySelector('#message').textContent));
      }else{
        await page.waitForFunction(()=>typeof document.querySelector('webar-scene')?.start==='function');
        await page.evaluate(()=>{window.__ready=false;window.__arError=null;const scene=document.querySelector('webar-scene');scene.addEventListener('ar-ready',()=>{window.__ready=true;});scene.addEventListener('ar-error',event=>{window.__arError=event.detail.message;});});
        const button=page.getByRole('button',{name:'Iniciar AR',exact:true});
        const rect=await button.boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<844,'Inicio visible: '+name);
        await button.tap();await page.waitForFunction(()=>window.__ready||window.__arError,null,{timeout:25000});
        assert.equal(await page.evaluate(()=>window.__arError),null,name);
        const state=await page.evaluate(()=>{const video=document.querySelector('webar-scene').engine.videoElement;return{ready:video.readyState,playing:!video.paused};});
        assert.ok(state.ready>=2&&state.playing,name+' vídeo activo');
      }
      await page.getByRole('button',{name:'Detener',exact:true}).tap();
      assert.equal(await page.evaluate(()=>window.__testStream.getTracks().every(track=>track.readyState==='ended')),true,name+' cámara liberada');
    }
    assert.deepEqual(errors,[],name);assert.deepEqual(missing,[],name);
    results.push({name,status:'passed'});
  }catch(error){results.push({name,status:'failed',error:error.message,missing,errors});}
  finally{await page.close();}
 }
}finally{await browser.close();}
await mkdir('artifacts/examples-configured',{recursive:true});
await writeFile('artifacts/examples-configured/verification.json',JSON.stringify({base:base.href,camera:'synthetic',results},null,2));
console.log(JSON.stringify({html:results.length,passed:results.filter(item=>item.status==='passed').length,failures:results.filter(item=>item.status==='failed')},null,2));
if(results.some(item=>item.status==='failed'))process.exitCode=1;
