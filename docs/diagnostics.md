# Diagnóstico local para iPhone y Android

La misma API sirve para ambos sistemas. El SDK no decide capacidades por user-agent: se consulta el soporte disponible. Modelo, SO y navegador exactos se declaran al ejecutar el protocolo físico.

## Recoger los 28 ejemplos automáticamente en XAMPP

La carpeta del proyecto contiene el código fuente, los ejemplos, la documentación y las pruebas automatizadas. Corrige ahí cualquier fallo y ejecuta `npm run build` para generar `dist/`. Usa `C:/xampp/htdocs/2` como instalación de pruebas para servir el SDK por HTTPS y recibir informes de los teléfonos. Al actualizar esa instalación, copia la distribución generada y conserva las rutas de recursos y la configuración del recolector.

El recolector local opcional evita descargar JSON en cada teléfono. Se instala en la copia estática de Examples y conserva las rutas existentes:

```sh
node scripts/install-local-diagnostics.mjs --site C:/xampp/htdocs/2
node scripts/install-local-diagnostics.mjs --site C:/xampp/htdocs/2 --apply
```

La primera llamada prepara la instalación; --apply respalda los HTML e instala diagnostics/ y Examples/local-reports.js. Requiere PHP en Apache. La biblioteca de producción no envía telemetría por incluir el SDK; el cliente local solo está conectado a esta instalación de desarrollo.

En el teléfono abre https://192.168.1.16/2/diagnostics/mobile.html (sustituye el host por el que ya utilizas). Pon una etiqueta para distinguir iPhone y Android. Abre un ejemplo e inicia cámara; el panel inferior confirma los envíos. Guardar y siguiente detiene y avanza. Los gestos, el movimiento de cámara y la colocación SLAM siguen siendo acciones de la prueba física.

En el computador abre http://localhost/2/diagnostics/. Los snapshots se envían al mismo origen HTTPS de cada ejemplo al iniciar, cada 15 segundos y al detener/salir. No se utiliza localhost como destino desde el teléfono. PHP guarda un archivo por sesión y actualiza su última secuencia; un paquete retrasado no sustituye una medición posterior. El panel permite conservar el historial o mostrar el último intento por equipo/ejemplo.

Los JSON quedan en reports/local-devices/data/<instalación>/ del repositorio, fuera de htdocs y excluidos de Git. El snapshot está dentro de report, acompañado por client, example, sequence y receivedAt. El asistente puede leerlos cuando se le pida; el recolector no inicia chats ni análisis por sí mismo. No incluye imágenes, vídeo, matrices de pose ni mapas.

La cola del navegador conserva hasta 16 sesiones pendientes y aproximadamente 700 KB, y reintenta al recuperar red o abrir otro ejemplo. sendBeacon al salir no garantiza recepción: se mantiene la copia hasta obtener confirmación. No se promete recuperar datos si se cierra el navegador sin aviso o se borra su almacenamiento. El servidor limita los envíos a 256 KB y el historial a 2000 sesiones, sin borrar resultados automáticamente.

El endpoint es solo para red privada/loopback, verifica origen y token de instalación. Es una herramienta de laboratorio local. No requiere otro puerto, WebSocket ni servicio de terceros. En 25 se usa el mismo engine A-Frame con un ARDiagnostics propio; sus contadores de render se muestrean, sin inventar intervalos de render no observados.

Las verificaciones automatizadas se identifican como execution=automated y se ocultan por defecto en el panel. Un informe recibido no demuestra aprobación física, precisión ni 60 FPS. El marcador de prueba físico es una declaración opcional del operador, no una certificación.

## Un atributo y un botón

```html
<webar-scene diagnostics>
  <webar-target src="./marcador.jpg">
    <webar-model src="./Kai.glb"></webar-model>
  </webar-target>
</webar-scene>
```

Con el standalone actualizado, aparece **Descargar diagnóstico** al iniciar. El informe sigue disponible después de Detener y se sustituye al iniciar una sesión nueva. No se habilita por defecto: la instrumentación es opt-in y puede añadir coste.

Para una aplicación declarativa:

```js
const scene=document.querySelector('webar-scene');
scene.addEventListener('ar-ready',()=>{
  scene.diagnostics.setContext({platform:'android',execution:'physical-user-reported',
    deviceModel:'Modelo declarado por operador',osVersion:'Versión exacta',browserVersion:'Versión exacta',scenario:'image'});
});
// Desde un botón:
// scene.downloadDiagnostics();
// const report=scene.getDiagnosticsReport();
```

No copies el ejemplo de plataforma o ejecución sin adaptarlo al dispositivo real. `platform` admite ios, android, desktop u other; execution admite unspecified, automated o physical-user-reported. No significa certificación independiente.

## Qué contiene

- Versión SDK y build determinista, fecha y duración de registro.
- Configuración inicial declarada: modo/backend, resolución de análisis, objetivo FPS, tolerancia/retención, colocación y pixel ratio. No es un historial completo de cambios dinámicos.
- User-agent, contexto seguro, existencia de APIs y resultado de la consulta immersive-ar (true/false/null si no pudo comprobarse).
- Última resolución/frecuencia efectiva getUserMedia y opciones disponibles. No representa necesariamente la cámara del compositor XR. No se incluyen deviceId ni groupId.
- Tiempos separados de lectura de cámara y consumo posterior del frame (`metrics.readbackMs` y `metrics.consumerMs`). En odometría local integrada, `odometry.stages` separa gris, esquinas, flujo óptico, inicialización, pose, mapa, keyframes, plano, relocalización y total del Worker. Cada etapa cuenta solo los frames donde se ejecutó. `planeFitMs` mide los intentos de ajuste del plano y `planeConsensusMs` cuenta los casos que produjeron una estimación candidata para comparar con las anteriores. `flowMs` incluye la pasada principal y, si se realiza, el reintento. `flowNormalMs` mide la pasada principal con ventana normal, `flowWideMs` mide la pasada principal con ventana amplia y `flowRetryMs` mide solo el reintento con esa ventana.
- Poses por backend, escala y origen de proyección; primera pose desde el inicio del registro, relocalizaciones y correcciones experimentales.
- Found/lost por ID y recuperación desde una pérdida confirmada; los finales por stop/removed se cuentan por separado.
- Tiempos de procesamiento/lectura y del loop de render; estadísticas de cambios entre poses y reproyección.
- Diagnósticos heurísticos, cronología acotada y observaciones manuales.

La primera pose incluye la preparación que ocurrió durante ese registro: no es un benchmark puro de detección. Recuperación se mide desde targetLost confirmado, excluyendo parte de la tolerancia previa. Los cambios entre poses **no equivalen a jitter o deriva física**: incluyen movimiento de cámara/contenido y dependen de escala y coordenadas. El loop mide intervalos de callbacks, no finalización de GPU.

Las muestras de trackingQuality son por target, no un contador de frames de render. ProcessingMs incluye el tiempo del consumidor de frames, no una medición exclusiva de CPU WASM. Para comparaciones físicas mantén configuración y contenido equivalentes.

No se persisten ni exportan frames, mapas, matrices, URLs de contenido o IDs de cámara. Para calcular pasos se conserva temporalmente la pose anterior de hasta 16 IDs/backends en memoria, y se descarta al finalizar. Las URLs y rutas de errores se redactan. Los campos escritos por el operador y el user-agent sí forman parte del informe; revisa el JSON antes de compartirlo. No hay subida automática.

## Límites de memoria y estadísticas

Hasta 1024 muestras recientes por métrica por defecto (configurable de 16 a 8192), 256 eventos, 128 observaciones y registros acotados de targets/recuperaciones. P50/p95 describen la ventana reciente; media/min/max/count agregan las muestras aceptadas durante toda la sesión. No interpretes un percentile reciente como toda una prueba de varios minutos.

## API programática

```ts
import {ARDiagnostics} from 'webar-facil/core';
const diagnostics=new ARDiagnostics(engine,{sampleLimit:1024,
  context:{platform:'ios',execution:'unspecified',scenario:'image'}});
await diagnostics.probeCapabilities(); // No solicita una sesión XR ni permisos adicionales.
// Conecta desde tu propio render loop, si quieres medir sus callbacks:
// diagnostics.recordRenderFrame();
diagnostics.mark('test-start','stationary');
diagnostics.observe('stationary','pending','Pendiente de evaluar por operador');
const report=diagnostics.snapshot();
diagnostics.stop(); // Desuscribe y conserva el informe; no detiene el motor.
```

`engine` debe existir. Con ThreeARScene puedes llamar recordRenderFrame desde onRender y retirar esa suscripción al cerrar. Las etiquetas ya lo hacen. Una instancia de ARDiagnostics registra una sesión; crea otra si deseas reiniciar estadísticas.

## Herramienta de pruebas y comparación

Abre [pruebas iPhone/Android](../tools/device-tests.html) mediante HTTPS en cada teléfono. Hay escenarios de imagen, odometría, transición y WebXR. Introduce versiones, realiza cada paso y marca resultado manualmente; el temporizador no aprueba nada.

Se exportan hasta 16 sesiones por página y resultados por escenario como `webar-device-tests.json`. Context.scenario identifica modo y formato (por ejemplo image:draco). Completa metadatos antes de iniciar: las sesiones cerradas no se reetiquetan al elegir otra configuración. Utiliza una página/suite diferente por dispositivo/build/SO/navegador; el comparador rechaza mezclas. Automatización detectada por webdriver se etiqueta automated, incluso si se marca la casilla de dispositivo físico. Eso no identifica hardware de forma infalible: evita confundir emulación con aceptación física.

En el repositorio, con los JSON descargados:

```sh
npm run reports:summarize -- informe-iphone.json informe-android.json
```

Se escribe artifacts/device-validation-summary.json (puedes elegir otra ruta con --output). El resumen distingue pendientes, fallos, límites y aprobaciones **declaradas por operador**; certification siempre es false. Los escenarios marcados pass requieren sesiones con poses del backend correspondiente, o quedan como missing-scenario-evidence. Esto no demuestra precisión física. Una plataforma sin evidencia sigue pendiente. No se agrupan como si fueran iguales builds, modelos o versiones diferentes.

Consulta [protocolo físico](device-validation.md), [colocación guiada](placement.md) y [comparación de odometría](odometry-validation.md).

## Contadores de renderizado

En escenas declarativas con `diagnostics`, `report.renderer` incluye latest (drawCalls, triangles, geometries, textures, drawingBufferWidth, drawingBufferHeight, pixelRatio) y peakDrawCalls/peakTriangles. Se muestrea el render anterior sin esperar a la GPU. No son bytes de VRAM ni tiempos GPU. Antes del primer render latest puede ser null. `configuration.antialias` y renderPixelRatio indican los ajustes efectivos. Ver [comparación de rendimiento de modelos](camera-performance.md). El núcleo sin renderer puede aportar estos contadores mediante `diagnostics.recordRenderer(...)`; no inspecciona escenas ni modelos automáticamente.


## Perfil del tracker de imágenes

El standalone actualizado añade `report.tracking` y `metrics.latestCamera.tracking` para separar el coste interno del Worker de los tiempos de cámara/render. No necesitas modificar el HTML: activa `diagnostics`. `tools/device-tests.html` muestra Worker, LK, matching y contadores de rutas.

| `tracking.stages` | Qué mide |
| --- | --- |
| grayMs | Copia al heap y conversión RGBA a gris |
| supportMs | Evaluación de distribución y calidad del soporte LK/caché |
| qualityMs | Muestreo de textura/desenfoque |
| opticalFlowMs | LK piramidal forward/backward y sus filtros |
| flowValidationMs | Consistencia geométrica de correspondencias LK |
| orbMs | Extracción ORB; compartida entre targets del mismo frame |
| matchingMs | Emparejamiento binario, incluidas caché y búsqueda completa si ambas se intentan |
| homographyMs | Homografía RANSAC de las coincidencias ORB |
| poseMs | Resoluciones de pose de LK y ORB |
| workerMs | Tiempo total de procesamiento dentro del Worker, antes de postMessage |
| roundTripMs | Envío hasta reanudación en Tracker, en el reloj del hilo principal |
| transportAndSchedulingMs | Máximo entre cero y roundTripMs - workerMs; incluye transporte y planificación, no es coste puro de copiar |

Cada etapa tiene count/mean/p50/p95 con el mismo límite de muestras del diagnóstico. Los tiempos de etapas no usadas son cero. La media/p95 es por frame perfilado, no solo por invocación de esa función. workerMs contiene las etapas y preparación adicional: no sumes workerMs a sus componentes ni roundTripMs al total. processingMs de cámara incluye lectura y consumo completo del frame; no equivale a tiempo CPU de visión puro.

`tracking.frames` cuenta frames perfilados. `tracking.paths` acumula flowAttempts, flowAccepted, redetections, orbExtractions, flowInputPoints, cachedAttempts, fullDetections y matchingQueryDescriptors. Las rutas no son excluyentes: un mismo target puede usar LK, intentar caché y terminar en búsqueda global. flowInputPoints y matchingQueryDescriptors suman puntos/descriptores procesados, no objetos únicos. En lotes, las etapas se agregan entre todos los targets y la extracción compartida se cuenta una sola vez.

`Tracker.latestProfile` expone una copia del último frame procesado; es null antes de procesar, tras descarte por backpressure o al cargar otra sesión/target. Los resultados FRAME/FRAME_BATCH incluyen profile cuando está disponible; Workers de prueba anteriores pueden omitirlo. Los perfiles se validan y no contienen imágenes, coordenadas ni matrices. El módulo de imagen proporciona este perfil. El backend de odometría integrado informa sus propias etapas en `odometry.stages`. Una caducidad de la pose para colocación se registra como `placement-stale` y una pérdida declarada por el estimador como `odometry-lost`.


## Motivos de redetección

Los nuevos contadores tracking.paths incluyen flowReliable, flowSparseReliable (12–23 inliers fiables), redetectMissing, redetectWeakSupport, redetectDeadline, redetectVerification y globalDeferred. weakDistribution, weakReprojection y weakRetention detallan la degradación; cacheConflicts registra desacuerdos entre dos estimaciones del mismo frame. globalDeferred significa conservar LK fiable tras una verificación de caché fallida, con revisión global todavía pendiente. No significa que una pose se haya confirmado mediante descriptores.

Los contadores no son excluyentes: puede coincidir un plazo vencido con falta de soporte. Un soporte fiable es una decisión heurística comprobada geométricamente, no una medida de error físico. Los perfiles de Workers y SDK deben pertenecer a la misma distribución. tools/device-tests.html muestra seguimiento fiable con pocos puntos para comprobar que el cambio está activo.


## Backend de matching

tracking.paths.exactMatchingCalls cuenta llamadas al kernel WASM exacto, opencvMatchingCalls llamadas a la alternativa OpenCV y emptyMatchingCalls llamadas omitidas por no haber al menos dos descriptores en cada entrada. Una redetección puede intentar caché y pool completo, así que no son equivalentes a frames ni a fullDetections. matchingMs mide la ruta ejecutada, incluyendo preparación y lectura. No se mezclan estas llamadas con un tiempo GPU.

La herramienta device-tests.html muestra esos contadores. Con el SDK actualizado y matching ejecutado normalmente debe aumentar WASM exacto. Si aumenta OpenCV, está activa la alternativa de compatibilidad. Un JSON de un build anterior no permite evaluar esta optimización. Ver [mediciones y límites](camera-performance.md).


## Elegir el escenario en la herramienta móvil

El selector Perfil de cámara ofrece Automático, Ahorro, Equilibrado y Más detalle. Aplica el perfil y detiene la sesión anterior antes de iniciar otra; no cambia dimensiones dentro de un mapa activo. El informe registra configuration.performance y maxFramePixels, además de analysisWidth/analysisHeight reales en metrics.latestCamera. Compara el mismo escenario y movimientos; no interpretes un menor tiempo a menor resolución como prueba de igual precisión. Los ajustes de render siguen siendo independientes.

En tools/device-tests.html, cambiar Modo, Contenido o ajustes de render aplica automáticamente la selección y detiene la sesión anterior. No necesitas pulsar Aplicar configuración para que el siguiente inicio use lo elegido; ese botón permite reiniciar/aplicar explícitamente. Los selectores aplican su configuración al cambiar. El inicio del encabezado espera cualquier aplicación pendiente; el botón Iniciar AR de la escena conserva su controlador nativo, sin interceptación de clicks por la herramienta. Cambiar opciones no solicita cámara ni inicia una sesión por sí solo.

- **Probar SLAM sin marcador**: acceso directo que selecciona el backend óptico e inicia sin webar-target. Desplaza lentamente la cámara sobre textura, espera evidencia de superficie y pulsa Colocar aquí. No es una garantía de mapa correcto ni de ausencia de deriva.
- **Odometría sin marcador**: el mismo modo óptico desde el selector; pulsa Iniciar SLAM sin marcador o Iniciar AR.
- **WebXR nativo si está disponible**: inicia la cámara y después pulsa Activar SLAM. La petición immersive-ar/hit-test se hace con ese gesto dedicado. El soporte se consulta en ejecución; un true de isSessionSupported no garantiza que se concedan sesión/features.
- **Imagen → odometría**: requiere reconocer el marcador inicialmente para conservar su posición. Es distinto de arrancar sin marcador.

El encabezado muestra el build cargado antes de iniciar. En la distribución, el script lleva ?build=... y el HTML declara la compilación esperada. Si el bundle y el HTML tienen builds diferentes pero el SDK ofrece las APIs necesarias, la herramienta muestra ambos identificadores en una advertencia persistente y permite iniciar la cámara. Para medir las últimas optimizaciones, copia dist completo. Una diferencia de build por sí sola no desactiva los botones. El servidor Vite expande la misma marca al servir el HTML fuente. Esto evita confundir caché o archivos mezclados con una regresión de rendimiento. Si se cambia el modo sin iniciar otra sesión, las métricas anteriores se etiquetan como última sesión registrada.

Una advertencia de build no exige confirmación para iniciar. Los botones del encabezado permanecen disponibles durante el inicio; aria-busy señala trabajo en curso y otro toque informa del progreso sin abrir una segunda cámara. El botón nativo del componente conserva su estado de inicio/parada. Si el SDK no cargó o faltan las APIs que requiere la herramienta, se muestra un mensaje específico de carga/incompatibilidad. El navegador sigue decidiendo los permisos reales de cámara.


## Comparar SLAM por cámara en una página

Abre `/2/Examples/slam-comparison.html` desde ambos teléfonos después de actualizar el recolector local. Selecciona Automático, recorre la misma zona con luz y distancia similares, confirma con Colocar aquí y luego cubre la cámara durante tres segundos. Vuelve al mismo encuadre y finaliza. El informe incluye tiempo hasta la superficie y la primera colocación, pérdidas de odometría, poses caducadas y recuperación del ancla. Una pérdida de odometría puede ocurrir después de una caducidad en el mismo episodio. El reloj comienza cuando se activa el escaneo, después de iniciar cámara. Los 45 segundos son una referencia de comparación, la sesión puede continuar después.

En el panel del PC filtra por `slam-comparison.html`. El intento queda en el informe de cada equipo, junto al perfil y al identificador de compilación. La recuperación exige volver a colocar solo si se reinició el mapa. Para probar otro perfil en el mismo teléfono, detén la sesión antes de cambiarlo. Usa el iPhone 17 Pro como referencia de gama alta y el Android actual como prueba de estrés. Para comprobar la continuidad de cámara, repite la transición de imagen a odometría y observa si el encuadre salta al acercarte o alejarte. Si se prueba WebXR nativo, registra ese recorrido por separado.

## Repetir la comparación en teléfonos

Usa la misma compilación, marcador, modelo, luz y recorrido de cámara. En la primera apertura del ejemplo 01 mide la carga inicial y en la segunda verifica el estado `target-cache-hit`. En el 14 apunta a ambos marcadores y observa matching, poses por ID y pérdida/recuperación. En el 07 anota si se detecta y confirma la superficie, y vuelve a una zona conocida tras una pérdida. Usa el 21 para comprobar la conservación explícita de la posición y el 22 para comprobar qué backend obtuvo la sesión. Compara `auto` y `battery` en el 23 con el mismo encuadre y duración. Las pruebas físicas no requieren repetir las 25 páginas.

## Inicio y carga lenta

El componente solicita cámara antes de descargar/decodificar los modelos; ar-ready sigue significando que contenido/targets y modo están preparados, no que haya pose ni superficie colocada. Mientras carga un GLB, la vista previa puede estar activa y el estado indica Cámara activa. Cargando contenido. Si falla el contenido, se cierra la cámara y se emite ar-error. Las validaciones estructurales y el rechazo de file:// ocurren antes de pedir permisos.

La herramienta muestra por separado camera-requesting (solicitud enviada), camera-granted (stream recibido) y camera-playing (esperando play). El autoenfoque continuo se intenta después de reproducir y no bloquea el inicio. Si play no termina en 15 segundos, la sesión falla con un mensaje específico y libera cámara. Mientras el permiso sigue pendiente, Detener permite cancelar sin dejar abierto un stream concedido posteriormente. Estas etapas permiten localizar la espera sin asumir su causa a partir de que el botón se ve activo.

La herramienta no captura el click del botón Iniciar AR dentro de la escena. Los botones superiores llaman a scene.start directamente con configuración lista. La página muestra el mensaje de progreso/error inmediatamente debajo de esos botones. Antes de cargar el SDK, un toque informa de la carga; si el script falta, el botón muestra la causa en lugar de quedar gris y sin respuesta. Esa respuesta de error no significa que se haya concedido cámara ni que AR esté funcionando sin SDK.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
