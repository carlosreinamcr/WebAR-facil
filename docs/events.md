# Eventos, continuidad y diagnóstico

## Detección sin parpadeo

La detección y la presentación tienen ritmos distintos. Por defecto el motor tolera **500 ms** de pérdida antes de confirmar `targetLost`. Durante ese intervalo el contenido conserva su última transformación y las animaciones siguen avanzando. En HTML configúralo en la escena:

```html
<webar-scene loss-grace="650" keep-content-on-lost>
  <webar-target src="./marcador.jpg">
    <webar-model src="./Kai.glb"></webar-model>
  </webar-target>
</webar-scene>
```

Omite `keep-content-on-lost` para ocultar tras la pérdida confirmada. Un intervalo demasiado alto conserva contenido desactualizado durante más tiempo. El filtrado temporal se configura con `imageSmoothingMs` en la [API programática](api-engine.md); no existe un atributo de filtrado en esta versión.

## Eventos DOM en etiquetas

```js
const scene=document.querySelector('webar-scene');
scene.addEventListener('targetFound',event=>console.log('Encontrado',event.detail.targetId));
scene.addEventListener('targetLost',event=>console.log('Perdido',event.detail.targetId));
scene.addEventListener('trackingQuality',event=>console.log(event.detail.issues));
scene.addEventListener('ar-error',event=>console.error(event.detail));
```

Coloca este JavaScript opcional después del HTML de la escena. `ar-pose` lleva `ARPose` en `event.detail`; `ar-ready` significa contenido preparado, no detección confirmada. Todos los eventos están en [referencia declarativa](declarative.md). Los payloads de tracking de la tabla siguiente son los mismos en DOM y motor.

## Eventos tipados

| Evento | Campos | Uso |
| --- | --- | --- |
| `targetFound` | `targetId`, `timestampMs`, `pose` | Primera detección o recuperación tras pérdida confirmada |
| `targetLost` | `targetId`, `timestampMs`, `retained`, `reason` | Pérdida confirmada, retirada o parada |
| `targetVisibility` | `targetId`, `visible`, `reason` | Mostrar/ocultar contenido en un renderer propio |
| `trackingQuality` | `targetId`, `timestampMs`, `state`, `score`, `processingMs`, `issues`, `diagnosis` y métricas | Diagnóstico continuo |

`targetLost.reason`: `lost`, `removed`, `stopped`. `targetVisibility.reason`: `tracked`, `recovering`, `lost`, `removed`, `stopped`, `policy`. `trackingQuality.state`: `tracking`, `recovering`, `lost`. `score` va de 0 a 1; es una puntuación heurística, no probabilidad calibrada.

No se emite `targetFound` en cada frame. Una pérdida breve que se recupera durante la tolerancia no produce la pareja lost/found. No cargues el GLB ni reinicies el MP4 en estos eventos; cárgalos una vez y controla solo la lógica de tu aplicación.

```js
const qualityListener=event=>{
  const quality=event.detail;
  if(quality.issues.includes('small-target')) showHelp('Acerca la cámara');
  else if(quality.issues.includes('blur')) showHelp('Enfoca y reduce movimiento');
  else hideHelp();
};
scene.addEventListener('trackingQuality',qualityListener);
// Al retirar este listener: scene.removeEventListener('trackingQuality',qualityListener);
// showHelp/hideHelp son funciones de UI que implementa tu aplicación.
```

## Retener contenido tras la pérdida

El atributo de escena se lee al iniciar. Para cambiar política durante una sesión declarativa, después de `ar-ready`, usa `scene.engine.setKeepContentOnLost(enabled)`. Si quieres que la próxima sesión utilice la misma opción, actualiza también el atributo. [Recetas](recipes.md) muestra el flujo.

Con la API programática y un `engine` ya inicializado:

```ts
engine.setKeepContentOnLost(true);             // Global y targets actuales.
engine.setKeepContentOnLost(false,'producto'); // Solo un ID ya registrado.
```

La opción global define también la política inicial de targets futuros. Con retención activa se confirma la pérdida y `retained` es verdadero, pero el objeto permanece visible en su última transformación de cámara. **No es un anclaje en el mundo**: si mueves la cámara con el marcador ausente no hay información nueva para colocarlo correctamente en el entorno.

Detener, retirar el target o suspender la cámara oculta el contenido aunque se haya activado retención. Cambiar la política no recarga el modelo o vídeo. `onPose` deja de emitir observaciones del target perdido; no asumas que una matriz retenida es una observación actual.

## Diagnósticos

| `TrackingIssue` | Interpretación orientativa |
| --- | --- |
| `low-texture` | Contraste o distribución de estructura insuficientes |
| `small-target` | Referencia muy pequeña dentro del frame analizado |
| `blur` | Medida de nitidez baja |
| `high-motion` | Desplazamiento alto entre frames |
| `insufficient-matches` | Pocas correspondencias geométricas fiables |
| `occlusion-or-out-of-view` | Pérdida compatible con oclusión o salida de vista |
| `device-load` | Tiempo de procesamiento elevado |

`diagnosis` es siempre `heuristic`. Las métricas incluyen `gradient`, `laplacianVariance`, `motionPixels`, `targetSizePx`, `featureCount`, `inliers` y `reprojectionErrorPx`. Durante seguimiento `featureCount` refleja soporte de correspondencias; durante búsqueda puede describir características del frame. No presentes el diagnóstico como identificación infalible de la causa.

`onError` informa errores operativos; una simple ausencia del marcador es un estado de tracking, no un error fatal. `onMetrics` informa captura/carga: [rendimiento](camera-performance.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
