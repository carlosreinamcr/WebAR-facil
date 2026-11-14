/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
// Utilidad opcional para reproducir el asset original incluido; no se ejecuta en build.
const channel=process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'chrome':undefined);
const browser=await chromium.launch({...(channel?{channel}:{}),headless:true});
try{
  const page=await browser.newPage();
  const bytes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=128;const context=canvas.getContext('2d');
    const mimeType=['video/mp4;codecs=avc1.42E01E','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mimeType)throw new Error('Se necesita encoder H.264/MP4.');
    let tick=0;const draw=()=>{context.fillStyle='#00ff00';context.fillRect(0,0,192,128);context.fillStyle='#ff0000';context.fillRect(60+tick++%8,24,64,80);};draw();
    const stream=canvas.captureStream(20),recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:500000}),chunks=[];
    const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject;});recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    const timer=setInterval(draw,50);recorder.start(100);await new Promise(resolve=>setTimeout(resolve,1000));recorder.stop();await done;
    clearInterval(timer);stream.getTracks().forEach(track=>track.stop());return [...new Uint8Array(await new Blob(chunks,{type:'video/mp4'}).arrayBuffer())];
  });
  await mkdir('public/videos',{recursive:true});await writeFile('public/videos/demo-chroma.mp4',new Uint8Array(bytes));
}finally{await browser.close();}
