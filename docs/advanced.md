# API avanzada y extensiones

Para una aplicación normal utiliza [HTML declarativo](getting-started.md). Esta guía es para sustituir piezas del pipeline o construir una integración propia sobre `WebAREngine` y sus wrappers. Las firmas y todos los tipos públicos están en [la referencia generada](api-generated.md).

## CameraManager + Tracker

Ejemplo de composición de bajo nivel; sustituye el registro en consola por tu consumidor de poses:

```ts
import {CameraManager,Tracker} from 'webar-facil/core';
const tracker=new Tracker({opencvURL:new URL('./vision/opencv.js',document.baseURI)});
const response=await fetch('./target.dat');
if(!response.ok) throw new Error(`HTTP ${response.status}`);
await tracker.loadTarget(await response.arrayBuffer());
const camera=new CameraManager({
  maxFrameWidth:640,
  onFrame:async(frame,signal)=>{
    const result=await tracker.processFrame(frame,signal);
    if(result?.status==='tracked') console.log(result.matrix,result.projectionMatrix);
  },
  onError:console.error,
});
// Llamar desde el botón de inicio de tu aplicación:
await camera.start();
// Al terminar:
camera.dispose();tracker.dispose();
```

La última línea ilustra la limpieza al desmontar, no debe ejecutarse inmediatamente tras iniciar si quieres mantener la sesión. El callback `onFrame` debe resolver **cuando termine** el procesamiento, no cuando se haya enviado un mensaje. Eso proporciona backpressure.

`Tracker.state` puede ser `idle`, `busy` o `disposed`. `processFrame` devuelve `null` si omite un frame por estar ocupado, o un resultado `not-found`/`tracked`; no conviertas `null` en una pérdida real. `loadTarget(buffer,signal?,id?)` y `loadTargets([{id,buffer}],signal?)` transfieren los binarios. Para varios targets usa `processTargetsFrame`: una sola transferencia RGBA y un lote de resultados. El método singular no es un pipeline de multimarcador.

En el nivel bajo el buffer `frame.imageData.data.buffer` se transfiere al Worker y queda separado del emisor. Si un consumidor adicional necesita los píxeles, coordina propiedad explícitamente. Duplicar el frame por cada target anula el beneficio del pipeline compartido.

La `ImageObservation` de un resultado aceptado incluye correspondencias, intrínsecos y la referencia RGBA para sembrar odometría. El RGBA puede compartirse en el lote: no intentes transferir el mismo buffer varias veces.

## Compilación y calibración

`MarkerCompiler.compile(file,{physicalWidthMeters,opencvURL,maxDimension?},signal?)` gestiona la compilación de imagen en Worker y devuelve `{buffer,quality}`. `dispose()` libera ese Worker. `ImageCompiler` expone métodos estáticos con adaptadores `decode` y `extract` para herramientas propias/Node.

`CalibrationSession` permite `initialize`, `board`, `addFrame`, `solve`, `reset` y `dispose`. `addFrame` transfiere el ImageData. `solve()` devuelve `CalibrationReport`: `calibration`, `rmsPx`, `perViewErrorsPx`, `views`, `coverage`, `warnings`. Es una herramienta opcional de precisión, no un requisito para detectar imágenes.

Las utilidades públicas `projectionFromIntrinsics`, `scaleIntrinsics`, `rotateIntrinsics` y `validateIntrinsics` validan y convierten la cámara. `scaleIntrinsics` conserva la proporción y rechaza cambios de aspecto incompatibles; no la uses para justificar un crop distinto sin ajustar el modelo de cámara. `estimateIntrinsics` es interno, no un export público.

## SLAMManager nativo

`SLAMManager.isSupported()` comprueba soporte. El constructor exige `attachSession` y `onPose`; admite hooks de superficie, pérdida, finalización, errores y alineación de cámara. `start(signal?)` se invoca desde una interacción y `stop()` termina la sesión.

`switchToSLAM(matrix,alignedWorldFromCamera?)` es un método de bajo nivel que requiere un marco de cámara alineado. No acepta una ModelView de getUserMedia como sustituto de un marco XR común. Los getters `imageAlignmentAvailable`, `hasPlacement` y `referenceEpoch` informan del estado de alineación y colocación. No existe `SLAMManager.dispose()` ni un método `enableSurfaceTracking()` en esta versión.

## OpticalFlowSLAM y un backend propio

`OpticalFlowSLAM` requiere `intrinsics` y `floorROI` normalizado; admite una semilla `ImageObservation`. Gestiona `start`, `processFrame`, `exportMap`, `importMap`, `stop` y `dispose`. Puede recibir `moduleURL` para un módulo JS confiable que encapsule tu WASM.

El módulo implementa `OdometryModule.createOdometryBackend(config)`. El backend debe implementar `processFrame` y `reset`; puede ofrecer `exportMap`/`importMap`. El resultado es la unión `OdometryEstimate`:

- `initializing` o `lost`, con `mapId`.
- `tracked`, con `worldFromCamera`, `projectionMatrix`, `scale`, `trackedPoints` y métricas opcionales.

`worldFromCamera` es una pose acumulada, **no un delta** de movimiento. Solo comunica `groundPlane` cuando esté verificado geométricamente. No estimes una traslación 3D sumando desplazamientos de píxeles. Debes declarar pérdida ante degeneración, reinicio de mapa o falta de paralaje.

El ABI no obliga a un renderer ni a una biblioteca C++ concreta. Mantén validación, límites de recursos, protocolo de cancelación y convenciones de matrices para que los wrappers puedan consumir las poses de forma transparente.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
