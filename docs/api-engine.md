# WebAREngine

Referencia práctica. Las firmas completas y tipos de opciones están en [API generada](api-generated.md).

Esta es la API programática avanzada. Para aplicaciones básicas empieza con [HTML declarativo](getting-started.md). Una escena HTML expone su motor como `scene.engine` tras `ar-ready`, sin que debas construirlo. Recuerda que el motor se reemplaza al parar/reiniciar la escena declarativa.

```ts
const engine=new WebAREngine({
  opencvURL:new URL('./vision/opencv.js',document.baseURI),
  imageLossGraceMs:500,
  keepContentOnLost:false,
  imageSmoothingMs:65,
  camera:{width:1280,height:720,fps:60,maxFrameWidth:640},
});
```

## Opciones principales

| Opción | Valor inicial / contrato |
| --- | --- |
| `opencvURL` | `./vision/opencv.js`, relativo a `document.baseURI`; configurar si el HTML está en subcarpeta |
| `camera` | Opciones de `CameraManager` salvo callbacks `onFrame` y `onError` |
| `tracker` | Opciones de `Tracker` |
| `imageLossGraceMs` | 500 ms; entre 0 y 10000; 0 confirma pérdida inmediatamente |
| `keepContentOnLost` | `false`; permite conservar visualmente la última transformación |
| `imageSmoothingMs` | 65 ms; entre 0 y 500; 0 desactiva filtrado temporal |
| `calibration` | Intrínsecos opcionales; no se exigen para uso normal |
| `fallback` | Opciones de odometría o `false`; por defecto se usa el backend incluido |
| `keyframeCorrection` | false; corrección local experimental, no cierre de bucle global |
| `attachXRSession`, `getXRContext`, `overlayRoot` | Hooks para integrar XR con un renderer propio |

`ThreeARScene` conecta los hooks XR automáticamente. El núcleo sin renderer requiere que la aplicación los suministre para WebXR. Si proporcionas opciones explícitas de fallback respeta el contrato `OpticalFlowOptions`, incluidos `intrinsics` y `floorROI`; no son simples flags de calidad.

## Ciclo de vida y targets

| Método | Resultado y comportamiento |
| --- | --- |
| `startCamera()` | `Promise<void>`; abre la cámara |
| `loadImageTarget(source, options?)` | Compila JPG/PNG y **reemplaza todos** los targets por `default` |
| `addImageTarget(id, source, options?)` | Compila y añade/reemplaza solo ese ID |
| `loadTarget(url)` | Carga `.dat` y reemplaza todos por `default` |
| `addTarget(id, url)` | Añade/reemplaza un `.dat` por ID |
| `removeTarget(id)` | Elimina tracking y visibilidad de ese target |
| `setKeepContentOnLost(enabled, targetId?)` | Cambia política global o de un target existente |
| `setFocus(mode, distance?)` | `Promise<boolean>`; `false` si no existe soporte |
| `stop()` | `Promise<void>`; cierra sesión y elimina targets; instancia reutilizable |
| `dispose()` | `void`; liberación definitiva |

`source` acepta `Blob`/`File`, string URL o `URL`. `ImageTargetOptions` tiene `physicalWidthMeters` (por defecto 0.2) y `maxDimension` (por defecto 1024). Los métodos de imagen devuelven `{buffer, metadata}`. El JSON no es un argumento requerido del tracker.

Los IDs deben cumplir `^[a-zA-Z0-9_-]{1,64}$`. Se admiten hasta 8. Espera las operaciones de configuración en orden; si ejecutas `startCamera()`, carga, retirada o transición simultáneamente, el motor puede rechazar la operación concurrente.

```ts
await engine.startCamera();
const result=await engine.addImageTarget('producto','./producto.jpg',{
  physicalWidthMeters:0.15,
});
console.log(result.metadata.quality);
// No usar Promise.all para estas operaciones de configuración del motor.
```

## Propiedades de consulta

`state`, `videoElement`, `cameraSettings`, `calibration` y `targetIds` son de lectura. `targetIds` permite comprobar qué IDs están registrados; no es una lista de marcadores visibles. `cameraSettings` puede ser `null` sin captura activa.

## Observación y eventos

```ts
const unsubscribe=engine.onPose((matrix,pose)=>{
  // matrix === pose.matrix; usar el contrato completo si la cámara se mueve.
  console.log(pose.targetId,pose.backend,pose.scale);
});
const unsubscribeError=engine.onError(error=>console.error(error));
// Al abandonar esta pantalla:
unsubscribe();unsubscribeError();
```

`onStatus(listener)`, `onSurface(listener)` y `onMetrics(listener)` también devuelven una función de retirada. `onSurface` recibe una matriz de la superficie propuesta; no implica que un objeto ya esté colocado.

`on(name,listener)` acepta únicamente `targetFound`, `targetLost`, `trackingQuality` y `targetVisibility`; existen los atajos `onTargetFound`, `onTargetLost`, `onTrackingQuality` y `onTargetVisibility`. No existe un evento genérico `pose` en `on`: usa `onPose`. Las cadenas de `onStatus` son diagnósticos abiertos; no sustituyen los eventos tipados de detección.

## Seguimiento espacial

`enableSLAM(options?)` devuelve `Promise<SurfaceTransitionResult>`. Opciones: `targetId`, `backend: 'auto' | 'webxr' | 'optical-flow'`, `placement: 'auto' | 'preserve' | 'hit-test'`, `initializationTimeoutMs` (12000 por defecto, >0 y <=120000).

Resultados `backend: 'webxr' | 'optical-flow'` y `placement: 'preserved' | 'scan-marker' | 'select-surface' | 'scan-floor'`. Solo `preserved` confirma continuidad ya conseguida. Lee [transiciones y límites](spatial-tracking.md) antes de conectar el botón.

`exportSLAMMap()` e `importSLAMMap(snapshot)` operan sobre la odometría activa; consulta [persistencia](maps.md). No existe un método público del motor llamado `switchToSLAM`: esa función pertenece a la clase avanzada `SLAMManager`, con otro contrato.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
