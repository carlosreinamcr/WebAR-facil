/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type * as OpenCV from '@techstark/opencv-js';
export type CV = typeof OpenCV;
let runtime: Promise<{ cv: CV }> | null = null;
let installedURL: string | null = null;

/** Inyección para Node/CLI. El objeto se envuelve para evitar asimilar su thenable. */
export function installOpenCV(cv: CV): void { runtime = Promise.resolve({ cv }); }

export function loadOpenCV(url?: string): Promise<{ cv: CV }> {
  if (runtime) {
    if (url && installedURL && installedURL !== url) return Promise.reject(new Error('Runtime OpenCV ya fijado a otra URL.'));
    return runtime;
  }
  if (!url) return Promise.reject(new Error('Falta opencvURL local. Ejecutar npm run prepare:vision.'));
  installedURL = url;
  runtime = (async () => {
    await import(/* @vite-ignore */ url);
    const cv = (globalThis as unknown as { cv?: CV & { onRuntimeInitialized?: () => void; onAbort?: (error: unknown) => void } }).cv;
    if (!cv) throw new Error('OpenCV no publicó su runtime.');
    await new Promise<void>((resolve, reject) => {
      if (cv.Mat) { resolve(); return; }
      const timer = setTimeout(() => reject(new Error('Timeout al inicializar WASM.')), 25_000);
      cv.onRuntimeInitialized = () => { clearTimeout(timer); resolve(); };
      cv.onAbort = error => { clearTimeout(timer); reject(new Error(String(error))); };
    });
    for (const name of ['ORB', 'BFMatcher', 'solvePnP', 'calcOpticalFlowPyrLK'] as const) {
      if (typeof cv[name] !== 'function') throw new Error(`Build WASM incompatible: falta ${name}.`);
    }
    return { cv };
  })().catch(error => { runtime = null; installedURL = null; throw error; });
  return runtime;
}

/** Contenedor RAII: liberar en orden inverso incluso si OpenCV lanza una excepción. */
export class CvScope {
  private resources: { delete(): void }[] = [];
  own<T extends { delete(): void }>(resource: T): T { this.resources.push(resource); return resource; }
  close(): void { for (const resource of this.resources.reverse()) resource.delete(); this.resources = []; }
}
