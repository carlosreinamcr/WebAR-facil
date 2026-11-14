/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { createRequire } from 'node:module';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { installOpenCV } from '../src/vision/runtime.ts';
const require = createRequire(import.meta.url);
export async function openCV() {
  let cv;
  const prepared=new URL('../public/vision/opencv.js',import.meta.url);
  try{
    await access(prepared);globalThis.require=require;globalThis.__dirname=dirname(require.resolve('@techstark/opencv-js'));
    await import(prepared.href);cv=globalThis.cv;
  }catch(error){if(error.code!=='ENOENT')throw error;cv=require('@techstark/opencv-js');}
  // OpenCV 4.12 es un thenable no estándar: NO hacer await cv (bucle de asimilación).
  await new Promise((resolve, reject) => {
    if (cv.Mat) resolve();
    else { cv.onRuntimeInitialized = resolve; cv.onAbort = reject; }
  });
  installOpenCV(cv);
  return { cv };
}
