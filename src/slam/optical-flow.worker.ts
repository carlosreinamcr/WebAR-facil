/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/// <reference lib="webworker" />
import { ODOMETRY_STAGES, ODOMETRY_SCAN_HINTS, type OdometryBackend, type OdometryConfig, type OdometryModule, type OdometryMapSnapshot, type OdometryTimings } from './OdometryBackend';
import { assertMatrix, assertRigid } from '../spatial/matrices';
import { createOdometryBackend } from './VisualOdometryBackend';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let backend: OdometryBackend | null = null;
let busy = false;
let sessionId: number | null = null;
let dimensions = '';
let mapRevision = 0;
let lastTimestamp = -Infinity;

scope.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = event.data as {
    id?: number; type?: string; moduleURL?: string; config?: OdometryConfig;
    snapshot?:OdometryMapSnapshot;
    includeCurrentView?:boolean;
    action?:'capture'|'verify';referenceId?:string;
    buffer?: ArrayBuffer; width?: number; height?: number; timestampMs?: number; sessionId?: number;
  } | null;
  if (!message || !Number.isSafeInteger(message.id)) return;
  const id = message.id;
  const respond = (ok: boolean, result: unknown, transfer: Transferable[] = []) => {
    scope.postMessage(ok ? { id, ok, result } : { id, ok, error: String(result) }, transfer);
  };
  if (busy) { respond(false, 'Worker ocupado.'); return; }
  busy = true;
  void (async () => {
    if (message.type === 'INIT') {
      if (backend) throw new Error('Backend ya inicializado.');
      if (!message.config) throw new Error('Configuración WASM ausente.');
      // URL de código de confianza, configurada por la aplicación; no por un marcador.
      const module = message.moduleURL ? await import(/* @vite-ignore */ message.moduleURL) as OdometryModule : { createOdometryBackend };
      if (typeof module.createOdometryBackend !== 'function') throw new Error('ABI WASM incompatible.');
      backend = await module.createOdometryBackend(message.config);
      if (typeof backend?.processFrame !== 'function' || typeof backend.reset !== 'function') {
        backend = null; throw new Error('Backend WASM incompleto.');
      }
      respond(true, null); return;
    }
    if(!backend)throw new Error('Backend WASM no inicializado.');
    if(message.type==='VISUAL_REFERENCE'){
      if((message.action!=='capture'&&message.action!=='verify')||typeof message.referenceId!=='string'||
         !/^[a-zA-Z0-9_-]{1,40}$/.test(message.referenceId)||typeof message.timestampMs!=='number'||
         !Number.isFinite(message.timestampMs)||message.timestampMs<0)throw new Error('Referencia visual inválida.');
      respond(true,backend.checkVisualReference?.(message.action,message.referenceId,message.timestampMs)??{status:'unavailable'});return;
    }
    if(message.type==='EXPORT_MAP'){
      if(!backend.exportMap)throw new Error('Este backend no exporta mapas.');respond(true,backend.exportMap(message.includeCurrentView===true));return;
    }
    if(message.type==='IMPORT_MAP'){
      if(!backend.importMap||!message.snapshot)throw new Error('Este backend no importa mapas.');backend.importMap(message.snapshot);
      sessionId=null;dimensions='';lastTimestamp=-Infinity;mapRevision++;respond(true,null);return;
    }
    if (message.type !== 'FRAME') throw new Error('Mensaje de odometría desconocido.');
    const { buffer, width, height, timestampMs } = message;
    if (!(buffer instanceof ArrayBuffer) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        !width || !height || width < 1 || height < 1 || width * height > 4096 * 4096 ||
        buffer.byteLength !== width * height * 4 || !Number.isFinite(timestampMs) ||
        timestampMs! < 0 || !Number.isSafeInteger(message.sessionId) || message.sessionId! < 0) {
      throw new Error('Frame inválido.');
    }
    const size = `${width}x${height}`;
    if (sessionId !== null && (sessionId !== message.sessionId || dimensions !== size)) {
      await backend.reset(); mapRevision++; lastTimestamp = -Infinity;
    }
    if (timestampMs! <= lastTimestamp) throw new Error('Timestamp fuera de orden.');
    lastTimestamp = timestampMs!;
    sessionId = message.sessionId!; dimensions = size;
    const started=performance.now();
    const output = await backend.processFrame({
      rgba: new Uint8ClampedArray(buffer), width, height, timestampMs: timestampMs!,
    });
    if (!output) throw new Error('Resultado de odometría ausente.');
    const {scanHint,...estimate}=output;
    const guidance=scanHint&&ODOMETRY_SCAN_HINTS.includes(scanHint)?{scanHint}:{};
    if (typeof estimate.mapId !== 'string' || !estimate.mapId || estimate.mapId.length > 128) {
      throw new Error('mapId de odometría inválido.');
    }
    const timings:OdometryTimings={};
    for(const stage of ODOMETRY_STAGES){
      const value=estimate.timings?.[stage];
      if(typeof value==='number'&&Number.isFinite(value)&&value>=0)timings[stage]=value;
    }
    timings.workerMs??=performance.now()-started;
    if (estimate.status === 'tracked') {
      for(const key of ['relocalized','keyframeCorrected'] as const)if(estimate[key]!==undefined&&typeof estimate[key]!=='boolean')throw new Error('Diagnóstico de odometría inválido.');
      assertRigid(estimate.worldFromCamera); assertMatrix(estimate.projectionMatrix);
      if (!['metric', 'relative'].includes(estimate.scale) ||
          !Number.isSafeInteger(estimate.trackedPoints) || estimate.trackedPoints < 8) {
        throw new Error('Tracking sin suficientes correspondencias.');
      }
      if (estimate.groundPlane) {
        assertRigid(estimate.groundPlane.worldFromPlane);
        if (!Number.isSafeInteger(estimate.groundPlane.inliers) || estimate.groundPlane.inliers < 8) {
          throw new Error('Plano sin suficiente evidencia.');
        }
      }
      // Copiar desde el heap WASM antes de transferir: nunca desprender su memoria.
      const plane = estimate.groundPlane ? new Float32Array(estimate.groundPlane.worldFromPlane) : null;
      const result = { ...estimate, ...guidance, timings, mapId: `${mapRevision}:${estimate.mapId}`, worldFromCamera: estimate.worldFromCamera.slice(),
        projectionMatrix: estimate.projectionMatrix.slice(),
        ...(estimate.groundPlane ? { groundPlane: {
          ...estimate.groundPlane, worldFromPlane: plane!,
        } } : {}),
      };
      const transfer = [result.worldFromCamera.buffer, result.projectionMatrix.buffer];
      if (plane) transfer.push(plane.buffer);
      respond(true, result, transfer);
    } else if (estimate.status === 'initializing' || estimate.status === 'lost') {
      respond(true, { ...estimate, ...guidance, timings, mapId: `${mapRevision}:${estimate.mapId}` });
    } else throw new Error('Estado de odometría inválido.');
  })().catch(error => respond(false, error instanceof Error ? error.message : error))
    .finally(() => { busy = false; });
});
