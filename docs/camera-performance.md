# Cámara, foco y rendimiento

## Configuración declarativa

```html
<webar-scene performance="auto">
  <webar-target src="./marcador.jpg">
    <webar-model src="./Kai.glb"></webar-model>
  </webar-target>
</webar-scene>
```

Estos son los valores predeterminados de la capa HTML. Los controles solicitan la cámara automáticamente al pulsar Iniciar AR. No implementes otro CameraManager para esta escena. Las opciones de escena se leen al iniciar; para cambiarlas, detén, modifica atributos y reinicia.

## Perfiles sin listas de dispositivos

El motor no clasifica iPhone/Android ni usa el tamaño del GLB para elegir la cámara. Parte de un presupuesto y adapta el análisis a los tiempos medidos y a la calidad del marcador. Ningún perfil garantiza temperatura, autonomía o precisión física.

| performance | Captura solicitada | FPS objetivo | Ancho máximo de análisis | Píxeles máximos de análisis |
| --- | --- | --- | --- | --- |
| auto (predeterminado) | 960×540 | 30 | 640 | 307200 |
| balanced | 1280×720 | 30 | 640 | 307200 |
| battery | 640×480 | 20 | 480 | 172800 |
| quality | 1920×1080 | 30 | 960 | 921600 |

Los tamaños de captura son preferencias: getSettings informa el modo realmente concedido. El presupuesto de píxeles escala toda la imagen conservando su proporción, sin recortar ni estirar. En auto, el análisis empieza con un máximo de 172 800 píxeles. Para una entrada vertical 720×1280 equivale aproximadamente a 311×553. Si el coste lo permite o falta detalle en un marcador visible, el presupuesto puede subir hasta 307 200 píxeles (aproximadamente 415×738). El máximo controla trabajo, no fija un rectángulo idéntico para todas las proporciones.

Puedes probar ahorro con performance="battery". Si el marcador es pequeño, más detalle puede resultar necesario: la resolución mínima no es siempre la que reconoce mejor. El render es independiente; pixel-ratio="1" y antialias="false" reducen coste gráfico sin cambiar la imagen analizada.

Las opciones explícitas tienen prioridad: camera-width/camera-height modifican la solicitud de captura; analysis-width, analysis-pixels y fps modifican los límites del tracker. En TypeScript sus equivalentes son camera.width, camera.height, camera.maxFrameWidth, camera.maxFramePixels y camera.fps. adaptive:false desactiva la adaptación temporal, no los límites estáticos del perfil.

La captura negociada no cambia automáticamente durante la sesión. En imagen se ajusta el ancho de análisis; en odometría se conserva la resolución con la que se construye el mapa y solo se adapta la frecuencia. Cambiar de perfil declarativo exige detener y reiniciar; la herramienta de pruebas lo hace al seleccionar el perfil. No conserva un mapa activo a través de ese reinicio.

## Configuración programática avanzada

El `CameraManager` admite objetivo de hasta 60 FPS; auto y la capa declarativa empiezan con 30. Con la [API programática](programmatic.md) puedes configurar dispositivo, resolución de captura y foco:

```ts
const engine=new WebAREngine({
  camera:{performance:'auto',maxFramePixels:307200,adaptive:true},
});
await engine.startCamera();
console.log(engine.cameraSettings);
const supported=await engine.setFocus('continuous');
```

La resolución pedida no es una garantía de resolución real: el navegador negocia las constraints. La cámara trasera se solicita como preferencia cuando no hay `deviceId`, lo que mantiene disponible la webcam de escritorio. Para elegir un dispositivo concreto usa `camera.deviceId`; la lista de cámaras se obtiene con `navigator.mediaDevices.enumerateDevices()` y puede necesitar permiso previo para mostrar etiquetas.

`fps` tiene máximo 60 y controla el objetivo de captura/análisis, no una garantía de que el dispositivo pueda ejecutar tracking a esa velocidad. `width` y `height` describen captura; `maxFrameWidth` limita la imagen entregada al analizador. `focusMode` puede ser `continuous`, `manual` o `none`; para foco manual `setFocus('manual',distance)` depende del soporte y las unidades del dispositivo. La ausencia de control de foco no impide seguir con foco automático del navegador.

## Mantener la entrada de cámara

La captura web abre una pista de vídeo, con preferencia por la cámara trasera. El rastreo de imagen y la odometría óptica reutilizan la pista durante la sesión. Si WebXR nativo obliga a liberar la captura y después se vuelve a vídeo web, el SDK solicita el mismo `deviceId` de forma exacta cuando el navegador lo expuso. Si esa entrada ya no está disponible, Detener e Iniciar permite volver a negociar la selección automática.

Para elegir una entrada que el navegador expone por separado, usa `camera.deviceId` en la API o `camera-device-id="ID_DEL_DISPOSITIVO"` en `<webar-scene>`. El atributo se lee al iniciar. El número de lentes físicas no determina cuántas entradas de vídeo enumera el navegador. El SDK puede fijar la entrada expuesta; si el sistema agrupa lentes en una cámara virtual, los cambios internos de esa cámara dependen de la plataforma. En WebXR nativo la entrada la gestiona la sesión XR.

## Apertura y esperas

El vídeo comienza a reproducirse antes de configurar el autoenfoque continuo. Esa mejora se intenta sin bloquear startCamera: un controlador con applyConstraints pendiente no debe impedir la cámara. Si solicitas focusMode manual, se espera su configuración con un límite de 8 segundos; Detener cancela esa espera. Si play no responde después de recibir el stream, el inicio falla a los 15 segundos y libera los tracks.

Los estados camera-requesting, camera-granted y camera-playing se reciben mediante engine.onStatus o el evento declarativo ar-status (detail.message). Distinguen solicitud al navegador, stream concedido e intento de reproducción; camera-ready confirma que play terminó. CameraManager también admite onStatus para esas tres etapas. Un permiso pendiente puede no resolverse hasta que el usuario responda: no se interpreta automáticamente como denegado. Detener cancela la espera local y cierra cualquier stream que llegue tarde.

## Adaptación

En auto el mínimo adaptativo de ancho es 240 px por defecto, acotado por el máximo y la resolución de origen. Los otros perfiles conservan su mínimo adaptativo anterior de hasta 320 px. `minFrameWidth` debe ser al menos 64 y no superar el máximo. Al detectar targets pequeños, pocos matches o desenfoque, la política protege detalle antes de bajar resolución; también ajusta frecuencia según carga y movimiento.

La adaptación no puede reconstruir detalle ausente ni exceder el límite configurado. Si un target ocupa muy pocos píxeles, acerca la cámara, mejora la captura o aumenta el máximo de análisis. Reducir siempre resolución para ahorrar CPU puede empeorar tanto el reconocimiento que aumente el coste de recuperación.

Las decisiones requieren al menos ocho muestras y 1.5 segundos desde la decisión anterior. El promedio suavizado de lectura y el de procesamiento evitan reaccionar a un solo frame caro. Si un marcador visible es pequeño, tiene soporte escaso o aparece desenfocado, se protege el detalle. Tras varios segundos sin detección, auto permite una ventana breve de búsqueda a mayor resolución. La frecuencia sigue limitada por el trabajo real: el objetivo solicitado no implica que el dispositivo lo alcance.

setAnalysisWidth es una operación avanzada para semillas/mapas y fuerza el ancho solicitado por encima del presupuesto de píxeles. Se conserva así la proyección de un mapa existente. Volver a setAdaptiveResolution(true) libera esa fijación. No uses estos métodos para cambiar dimensiones arbitrariamente dentro de una odometría activa.

## Métricas

En HTML, usa `scene.engine.onMetrics(listener)` después de `ar-ready`; la propiedad es `null` cuando la escena está parada. El siguiente fragmento utiliza un `engine` programático:

```ts
const off=engine.onMetrics(metrics=>{
  console.table({
    analysisWidth:metrics.analysisWidth,
    analysisHeight:metrics.analysisHeight,
    targetAnalysisFPS:metrics.targetAnalysisFPS,
    readbackMs:metrics.readbackMs,
    processingMs:metrics.processingMs,
    consumerMs:metrics.consumerMs,
    averageProcessingMs:metrics.averageProcessingMs,
    skippedFrames:metrics.skippedFrames,
  });
});
```

`processedFrames` cuenta procesados y `skippedFrames` incluye duplicados y frames omitidos por backpressure; no significa “marcador perdido”. `targetAnalysisFPS` es el objetivo del planificador, no una medición de FPS del renderer. Mide render por separado.

Un solo frame está en vuelo por consumidor; los nuevos se omiten mientras el Worker está ocupado. El transporte de `ArrayBuffer` evita copia entre hilos, pero lectura del canvas y copia al heap WASM siguen teniendo coste. No se promete un pipeline completamente sin copias.

## Recomendaciones operativas

1. Comienza con una imagen rica en textura, un GLB pequeño y 640 px de análisis.
2. Revisa `trackingQuality` para distinguir tamaño/nitidez de carga.
3. Reduce geometría, texturas y pixel ratio del renderer antes de sacrificar detalle necesario del target.
4. Añade targets progresivamente y mide el teléfono más limitado de tu público.
5. Detén cámara y libera medios al salir; mide temperatura y batería en sesiones largas.

La captura se suspende al ocultar la página; no asumas permiso o frames continuos al cambiar de app. El protocolo y los resultados publicados están en [verificación](verification.md) y [validación física](device-validation.md).

## Calibración opcional

No es un paso obligatorio del inicio. El motor usa intrínsecos estimados y refinamiento de focal a partir de observaciones consistentes. Para aplicaciones con exigencias de geometría o distorsión conocidas puedes proporcionar `CameraIntrinsics` o usar [la herramienta de calibración](../tools/calibrate.html).

El tablero ChArUco incluido es de 7×5 cuadrados de 30 mm, marcadores de 22 mm; imprime sin reescalado. Se requieren al menos 10 vistas diversas aceptadas; la herramienta recomienda 15–25. No reutilices una calibración de otra lente, recorte o zoom. La calibración opcional no resuelve oclusión ni falta de textura.


## Modelos grandes: separar renderizado y tracking

El peso GLB en MB no mide su coste por fotograma. Draco/Meshopt reducen transferencia; no reducen por sí solos la cantidad de triángulos dibujados tras decodificar. Texturas, materiales, transparencias, esqueletos y animaciones también influyen. No hay un límite universal de MB o polígonos que garantice fluidez.

Para comparar en el mismo teléfono, entorno y contenido:

```html
<webar-scene mode="slam" backend="optical-flow" gestures diagnostics
  pixel-ratio="1" antialias="false">
  <webar-model src="./model1.glb" size="5"></webar-model>
</webar-scene>
```

Estos atributos están disponibles en el standalone actualizado. En la API Three.js: `new ThreeARScene({container, maxPixelRatio:1, antialias:false})`. No cambian los 640 px/30 Hz iniciales del análisis. Reducir de ratio 2 a 1 divide por cuatro el número de píxeles del buffer a igual tamaño CSS; puede mejorar el rendimiento con una imagen menos nítida. No garantiza 60 FPS ni modifica la resolución de una sesión WebXR inmersiva.

1. Compara `pixel-ratio="2"` y `"1"` manteniendo el resto igual; reinicia la escena entre configuraciones.
2. Compara antialias true/false. Primero cambia una sola variable; puedes combinar ambas después.
3. Compara el mismo modelo con `animation="none"`, y después un modelo simple de demostración, sin cambiar el modo de tracking.
4. Exporta diagnósticos de cada sesión y anota si la pausa es solo al cargar, constante o aparece después de varios minutos.

`tools/device-tests.html` permite elegir el ratio y antialias antes de Aplicar configuración. El informe guarda los ajustes efectivos y contadores del renderer. Si reducir los píxeles mejora la fluidez, indica sensibilidad al coste de renderizar, pero no identifica por sí solo un cuello GPU. Si la pausa sigue el modelo y no aparece con contenido simple, revisa geometría, llamadas de dibujo, materiales, texturas y animaciones en la herramienta de autoría. Optimiza una copia y conserva el original.

Los contadores `renderer.latest` corresponden al render anterior: drawCalls y triangles incluyen fondo y ayudas; textures/geometries cuentan recursos, no bytes de memoria GPU. Los picos permiten ver la carga aunque el contenido desaparezca después. `renderLoopMs` mide intervalos de callbacks, no duración de GPU. Distingue un render fluido con poses espaciadas de un render entero entrecortado. Una frecuencia de tracking inferior a la del render no demuestra que el GLB sea pesado.


## Redetección con referencias verificadas

El tracker conserva LK bidireccional y homografía RANSAC entre redetecciones. La decisión usa soporte geométrico en el plano del marcador: mínimo 12 inliers, error <=1.8 px, retención >=55 %, envolvente convexa >=8 % del marcador, al menos cuatro celdas y puntos no colineales en plano e imagen. Tener 12–23 puntos no obliga por sí solo a redetectar; si son fiables se mantiene el seguimiento.

La caché se comprueba cada 4 u 8 frames si existe: 4 cuando la envolvente del soporte cubre menos de la mitad del marcador o su condición del plano es menor de 0.15; 8 con soporte más amplio. Tras un intento global se verifica también durante los dos frames siguientes para confirmar la recuperación. Una confirmación de caché exige soporte distribuido, envolvente >=15 %, condición del plano >=0.08, error <=1.5 px y ratio de inliers >=60 %. Ya no exige 30 inliers: conserva el mínimo de 12 acompañado por esas verificaciones. Guarda hasta 256 descriptores exactos de una detección global válida, con coordenadas del marcador original y sin aprenderlas de LK. Si la pose de caché discrepa de un LK fiable en las esquinas más de un límite de 2–4 px según el tamaño proyectado, se recurre al matching global.

La búsqueda completa se solicita al perder soporte fiable o alcanzar 24 frames o el plazo temporal. El plazo parte de 1 s y puede llegar a 2 s si los frames llegan despacio y LK conserva soporte fiable. Con varios marcadores se ejecuta como máximo una búsqueda global por frame y se rota la prioridad. La verificación con caché usa la región alrededor del soporte LK fiable cuando hay suficientes descriptores; las búsquedas globales usan el frame completo. Una comprobación de caché fallida puede conservar un LK fiable hasta esa revisión, en vez de forzar búsqueda completa en cada frame. Sin referencia de caché y con LK fiable tampoco es necesario extraer ORB en cada frame. Las revisiones son intentos de validación; no garantizan ausencia de deriva.

Los criterios anteriores deciden cuándo redetectar. Se mantienen los filtros forward/backward, consistencia RANSAC y validación de pose del motor. Cuando una revisión no consigue redetectar, se conserva la política previa de aceptar una pose LK que haya pasado las verificaciones originales; no se inventa una pose nueva ni se confunde retención visual con seguimiento.

Cada target tiene su propio estado y caché, reiniciados al cambiar sesión/resolución. El formato WART se conserva. Al cargar JPG/PNG, el motor guarda hasta 12 marcadores compilados por origen en Cache Storage. La clave incluye el contenido, la escala física, el tamaño de compilación y el runtime. El SDK vuelve a compilar si se borra la caché o el almacenamiento no está disponible. La aplicación sigue indicando el JPG/PNG como fuente.

Esto reduce los picos de matching de redetecciones periódicas. La primera detección, escenas difíciles y búsquedas fallidas aún pueden necesitar el pool completo; no se garantiza 60 FPS. Esta mejora corresponde al seguimiento de imágenes, no al coste de la odometría SLAM sin marcador.

La primera optimización de caché, anterior a la decisión geométrica actual, está conservada en la [comparación histórica](../benchmarks/image-tracking-comparison.json) usa Workers reales y OpenCV WASM con 320 imágenes sintéticas: 316 con marcador y 4 de oclusión. Se excluyen cuatro frames iniciales de los tiempos de cada caso. Ambos motores detectaron los mismos 316 frames y no produjeron pose en la oclusión; recuperaron el marcador al reaparecer. El error máximo de esquinas del motor nuevo fue menor de 1.6 px en estos casos (en movimiento subió de 1.24 a 1.59 px). No demuestra precisión física general ni rendimiento de iPhone/Android.

| Caso | Media Worker antes → después | p95 Worker antes → después |
| --- | --- | --- |
| Movimiento suave, marcas de tiempo a 33 ms | 19.56 → 9.37 ms | 118.73 → 26.14 ms |
| Movimiento suave, marcas de tiempo a 140 ms | 37.50 → 11.53 ms | 223.39 → 28.35 ms |
| Movimiento | 37.05 → 20.29 ms | 212.35 → 56.54 ms |
| Oclusión y recuperación | 37.61 → 18.89 ms | 212.97 → 51.46 ms |

Son medidas de una ejecución Node/Windows, sin cámara, compositor, GPU móvil ni control térmico. Los intervalos 33/140 ms son timestamps de entrada, no esperas de tiempo real del benchmark. Las colas de alta latencia aún pueden contener búsquedas completas. Repite la captura física con el mismo marcador, iluminación, modelo y ajustes, y compara los nuevos campos tracking.stages y tracking.paths.

Para reproducir la versión actual: `npm run build` y `npm run benchmark:image`. Los informes históricos antes/después están conservados en benchmarks; ejecuta `node scripts/compare-image-tracking.mjs` para validar sus casos y generar la comparación. La comparación comprueba detecciones, recuperación y error geométrico, no impone un umbral de velocidad dependiente del ordenador.


## Comparación con MindAR y AR.js NFT

MindAR separa el matching de targets que todavía no sigue del seguimiento de targets activos. Su tracker utiliza la pose anterior para proyectar la imagen y buscar correspondencias locales de plantillas mediante TensorFlow.js; el controlador vuelve al matching al perder seguimiento y gestiona tolerancias de aparición/pérdida y filtrado. Esto se observa en su [controlador](https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/controller.js) y [tracker](https://github.com/hiukim/mind-ar-js/blob/master/src/image-target/tracker/tracker.js).

[AR.js usa jsartoolkit5 para tracking](https://ar-js-org.github.io/AR.js-Docs/). En su ruta NFT, ARToolKit expone por separado inicialización y tracking de textura, con búsqueda local alrededor de la posición anterior y umbral de error de pose. La transformación inicial puede venir de KPM y debe restablecerse tras perder tracking. Ver la [API original ARToolKit NFT](https://www.artoolkitx.org/artoolkit5/doc/apiref/tracking_h/index.html). Los marcadores cuadrados de AR.js siguen otra ruta y no son equivalentes a NFT.

La decisión de esta biblioteca es propia: mantener adquisición, seguimiento y recuperación separados, conservar LK cuando su evidencia es suficiente y reservar búsquedas caras para degradación o validación acotada. No trasladar umbrales de MindAR/ARToolKit directamente a ORB/LK: usan estimadores y soportes diferentes.

Para medir soporte escaso: `npm run benchmark:image -- benchmarks/image-support-latest.json sparse`. La fixture proyecta el marcador a distancia mayor y usa LK real con 12–23 puntos en muchos frames. Los informes históricos de esta decisión se comparan con `node scripts/compare-image-tracking.mjs image-support`; ver [comparación](../benchmarks/image-support-comparison.json). La versión anterior se capturó desde el tarball local con build aef4ddad324066a2. Las imágenes son sintéticas, no registros de un teléfono; revisa tiempos, precisión, pérdidas y recuperación juntos. Puede haber picos mayores al ejecutar revisiones globales periódicas aunque baje la media. No extrapolar a 60 FPS ni a SLAM sin marcador.


### Resultado local de la política geométrica

Comparación conservada entre aef4ddad324066a2 y 7e52a3fa6b95a911 (80 frames por caso, cuatro iniciales excluidos de los tiempos):

| Caso de soporte escaso | Media Worker antes → después | p95 Worker antes → después | Error máximo de esquinas antes → después |
| --- | --- | --- | --- |
| Estático | 18.31 → 10.91 ms | 18.76 → 19.33 ms | 0.97 → 1.33 px |
| Timestamps separados 140 ms | 31.37 → 23.65 ms | 61.58 → 80.30 ms | 0.97 → 1.33 px |
| Movimiento | 34.24 → 21.37 ms | 48.97 → 46.38 ms | 2.46 → 3.52 px |
| Oclusión y recuperación | 31.08 → 24.83 ms | 38.91 → 140.57 ms | 2.20 → 4.19 px |

Los 316 frames con marcador se detectaron en ambas versiones y la recuperación se mantuvo. No hubo pose en los cuatro frames de oclusión. En el caso estático, ORB pasó de 76 a 25 extracciones en la ventana medida. Un test adicional con referencia de 23 descriptores verifica 20 poses con una sola búsqueda global; otro comprueba 60 frames con marcador pequeño y recuperación tras ocultarlo.

El cambio reduce trabajo repetido y la media en estos casos, pero no mejora todas las métricas: aumentan los picos de revisiones completas en algunos casos y el error máximo crece, aunque permanece bajo el límite original de 8 px. La comparación no demuestra precisión idéntica ni eliminación de jitter. Las decisiones de conflicto/recuperación conservan una vía de búsqueda cara para corregir estimaciones incompatibles. Debe repetirse en Windows/iPhone/Android con la misma imagen y condiciones; esta entrega no certifica una mejora física general.


## Matching ORB exacto especializado en WASM

El SDK utiliza automáticamente un kernel WASM propio para descriptores ORB de 32 bytes (WTA_K=2). Se conserva la lista de matches aceptados: distancia Hamming máxima 64, ratio estricto de 0.75, orden estable y unicidad del descriptor de destino. No se reducen los descriptores, la resolución ni los umbrales geométricos. El kernel se utiliza tanto en las verificaciones de caché como en las búsquedas completas. El matcher también se reutiliza en las rutas de odometría que llaman al matcher ORB compartido; los contadores por etapa siguen perteneciendo al tracker de imágenes.

El kernel calcula XOR/popcount con instrucciones WASM estándar. Omite el resto de una distancia solo cuando ya no puede modificar la aceptación. Acota la búsqueda interna porque el resultado público solo incluye matches con distancia <=64 y ratio <0.75: si la mejor distancia es <=64 y la segunda es >=87, el ratio estricto se cumple. Una distancia parcial solo aumenta; cuando ya no puede mejorar el segundo mejor valor acotado, se omiten sus palabras restantes sin cambiar el resultado aceptado. No es un índice aproximado ni una reducción de candidatos arbitraria. Las pruebas contrastan los matches ordenados contra BFMatcher de OpenCV, incluidas las fronteras 64/65, ratios exactos, empates y duplicados.

El módulo compilado ocupa 427 bytes y va embebido en los bundles/Workers. No requiere otro script, descarga ni cambio de HTML. Usa memoria independiente de OpenCV: 256 KiB en la fixture de 4538×1500 descriptores, crecimiento acotado por un máximo declarado de 16 MiB. El límite de entrada permite el pool máximo del compilador más apariencias verificadas. La memoria se reutiliza por Worker y se libera al terminarlo. No requiere SIMD, threads ni SharedArrayBuffer. Si la compilación del kernel no está disponible, se conserva la implementación OpenCV y el diagnóstico identifica esa alternativa. Los errores de ejecución/entrada no se ocultan como si fueran una compilación no soportada.

La fuente MIT está en src/vision/wasm/hamming.wat y se incluye en la distribución como [vision/hamming.wat](../vision/hamming.wat). `npm run build:hamming` la compila con WABT de desarrollo, fijado en el lockfile. El runtime de WABT no se distribuye dentro del SDK. `npm run build` regenera el kernel antes de calcular el identificador de build. Las pruebas verifican que el binario generado coincide con el WAT.

### Medición del matcher aislado

[Informe reproducible](../benchmarks/matching-exact.json), Node/Windows local, tres calentamientos y siete muestras por caso. Incluye subida y lectura de descriptores, no cámara/render:

| Caso | Descriptores query × train | Media OpenCV → kernel exacto | Matches aceptados |
| --- | --- | --- | --- |
| Marcador contra imagen redimensionada | 4538 × 1500 | 92.89 → 23.07 ms | 949, lista idéntica |
| Marcador contra descriptores aleatorios | 4538 × 1500 | 93.09 → 13.14 ms | 0, lista idéntica |
| Referencia pequeña | 23 × 1500 | 0.496 → 0.112 ms | 8, lista idéntica |

Ejecuta `npm run benchmark:matching` después de construir para reproducir la comparación. El caso aleatorio es sintético; la primera compilación/JIT no está incluida en esos tiempos calentados. No equivalen a FPS del tracker ni a rendimiento certificado de un teléfono.

### Comprobación del tracking completo

La [comparación con la versión anterior](../benchmarks/image-matching-comparison.json) conserva 316/316 poses con marcador, ningún positivo durante cuatro frames de oclusión y recuperación al reaparecer. Los errores máximos de esquinas son idénticos por caso a los del build anterior 7e52a3fa6b95a911. En la ejecución registrada, el p95 Worker pasó de 75.65 a 30.74 ms en la secuencia con timestamps separados 140 ms y de 76.61 a 30.36 ms con oclusión. Las rutas de redetección no cambiaron. Esto verifica la equivalencia en esas fixtures; no garantiza precisión física idéntica ni 60 FPS en Windows/iPhone/Android.

Para reproducir la fixture: `npm run benchmark:image -- benchmarks/image-matching-latest.json sparse`. Para comparar las capturas conservadas: `node scripts/compare-image-tracking.mjs image-matching`. En dispositivos reales, revisa matchingMs y workerMs junto con las pérdidas y la calidad; usa el mismo marcador, modelo y configuración. La lectura de cámara, ORB, RANSAC y el render conservan su propio coste.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
