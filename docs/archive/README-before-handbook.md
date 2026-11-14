# mi-libreria-ar

> ARCHIVO HISTÓRICO. Este README precede al manual y puede contener límites o instrucciones sustituidos. No utilizarlo como contrato de API. La documentación vigente empieza en `docs/README.md` del repositorio y en `docs/ai-guide.md` para asistentes.

Librería WebAR abierta en TypeScript, con tracking de imágenes ORB en WebAssembly, WebXR hit-test y odometría monocular local como fallback. Cámara, cálculo y renderizado tienen ciclos de vida independientes. Sin claves, cuentas, servicios de tracking ni suscripciones.

## Inicio

Node >=22.18. Usar el lockfile para reproducir las versiones verificadas:

```sh
npm ci
npm run dev
```

Abrir la URL local que muestra Vite. Elegir un **JPG/PNG**, iniciar cámara y enfocar esa imagen: la aplicación genera los descriptores y metadatos automáticamente en un Worker. No exige calibración manual, medidas, `.dat` ni JSON. Sin selección usa `public/marker.png`. Puedes imprimir la imagen o mostrarla en otra pantalla, conservando su proporción.

La cámara necesita HTTPS o localhost. Para probar otro móvil, servir por HTTPS; `npm run dev` por defecto solo escucha en el equipo local. `dist/` contiene también el ejemplo y las herramientas, listos para servir como archivos estáticos.

`examples/cdn.html` conserva una variante con Three.js por CDN, como en el tutorial inicial. El ejemplo principal sirve también Three.js localmente para funcionar sin ese servicio externo; el cálculo de visión es local en ambas variantes.

En el ejemplo:

1. Elegir una imagen o usar la de ejemplo. Opcionalmente seleccionar webcam.
2. Iniciar cámara; la imagen se compila automáticamente. Apuntar al marcador. WebXR no es necesario.
3. El cubo sigue la imagen mientras está visible y vuelve a aparecer al reconocerla de nuevo.
4. Opcionalmente activar SLAM. Para conservar posición con visión local, mantener el marcador inmóvil y desplazar la cámara hasta reconstruir suficiente entorno. Al confirmarse el mapa se puede retirar el marcador.

`npm run dev` compila y prepara automáticamente la librería, OpenCV y Three.js antes de iniciar Vite. Esperar a que aparezca la URL local. No abrir `index.html` mediante `file://` ni copiarlo separado de sus recursos. Para distribuir archivos estáticos sin servidor de desarrollo, ejecutar `npm run build` y servir el directorio `dist/` completo.

## Qué está implementado y comprobado

| Módulo | Implementación | Verificación automática |
| --- | --- | --- |
| Cámara | Webcam o móvil, preferencia trasera y selección por deviceId, resolución, enfoque según capacidades, suspensión/reanudación, backpressure y ajuste de carga | Lifecycle, cancelación, foco y cámara virtual en Chrome |
| NFT | ORB WASM, Hamming, ratio test, homografía RANSAC, PnP, reproyección, LK forward/backward y redetección | PNG proyectado, escala, perspectiva, recorte, luz reducida, blur y ausencia de marcador |
| Compilador | JPG/PNG, orientación EXIF, pirámide precomputada, informe de calidad y WART v2 con CRC32 | CLI, compilador web en Chrome/WebKit, JPEG con EXIF y archivos corruptos |
| Calibración | ChArUco, detección automática, múltiples vistas, error por vista y rechazo de calibración degenerada | Tablero real generado por OpenCV y recuperación de intrínsecos conocidos |
| Fallback | Inicialización multivista, LK, PnP, triangulación, mapa local y relocalización ORB | Secuencias renderizadas desde geometría conocida; oclusión y retirada del marcador |
| WebXR | Sesión, hit-test, colocación, anclajes opcionales y alineación por cámara XR sincronizada | Contrato XR simulado y lectura de textura GL simulada; pendiente de hardware físico |
| Render | Three.js y A-Frame, matrices de mundo, fondo rectificado y recuperación de contexto en el ejemplo | Contrato de matrices y escena completa de Three.js en Chrome móvil emulado |

**Estas pruebas no certifican precisión física ni 60 FPS en todos los móviles.** La odometría es un mapa local experimental: no incluye cierre de bucle global, mapas persistentes ni fusión inercial. Ver los criterios y limitaciones en `docs/device-validation.md`.

## API

Para NPM, `mi-libreria-ar/core` no carga un renderer. Para usar el punto de entrada con wrappers, instalar Three.js y, en proyectos TypeScript, sus tipos (`three` y `@types/three`) en versiones compatibles. El runtime OpenCV ya se distribuye en `dist/vision`; no se descarga desde NPM o un CDN al ejecutar la aplicación.

```ts
import { WebAREngine } from 'mi-libreria-ar/core'; // No importa Three.js.

const engine = new WebAREngine({
  opencvURL: new URL('/vision/opencv.js', location.href),
  // calibration: intrínsecos medidos opcionales para mejorar precisión.
  camera: { maxFrameWidth: 640, focusMode: 'continuous', adaptive: true },
});

const unsubscribe = engine.onPose((modelView, pose) => {
  // modelView = T_camera_object; pose.worldMatrix = T_world_object.
  // pose.viewMatrix = T_camera_world; pose.projectionMatrix proviene del backend.
});
engine.onError(console.error);
await engine.startCamera();
const target = await engine.loadImageTarget('/mi-imagen.jpg');
// También acepta File/Blob de un input. No solicita .dat ni JSON.
// target.buffer puede exportarse como .dat; target.metadata como JSON.
// Para producción con descriptores ya compilados: await engine.loadTarget('/target.dat');

// Desde un clic: exigir continuidad, sin recolocar silenciosamente el objeto.
await engine.enableSLAM({ backend: 'optical-flow', placement: 'preserve' });

await engine.stop(); // Cancela operaciones y espera la liberación de XR.
unsubscribe();
engine.dispose();    // Definitivo e idempotente.
```

Por defecto se configura una proyección inicial desde el vídeo y se refina la focal con varias observaciones consistentes de un marcador inclinado. No requiere interacción del usuario. Las vistas frontales o degeneradas mantienen la aproximación inicial; el resultado sigue marcado como `projectionSource: 'estimated'`. La estimación asume píxeles cuadrados y centro óptico centrado, y no estima distorsión. En aplicaciones de precisión, la API avanzada permite aportar intrínsecos y usar `allowEstimatedCalibration: false` para exigirlos.

`onStatus`, `onSurface` y `onMetrics` también devuelven funciones de desuscripción. `onMetrics` informa lectura del canvas, duración de procesamiento, frames omitidos, ancho de análisis y frecuencia objetivo. Las operaciones de configuración son exclusivas; las llamadas concurrentes se rechazan. Un timeout o cancelación termina el Worker para interrumpir WASM síncrono.

## Crear aplicaciones propias

La librería se consume mediante su API pública. `index.html` es una demostración; no obliga a usar esa interfaz. `examples/custom-app.html` es una aplicación mínima editable con Three.js y módulos ESM: sustituye el cubo por modelos, animaciones, interacción o tu propia lógica. `mi-libreria-ar/core` no depende del renderizador.

```ts
import { WebAREngine } from 'mi-libreria-ar/core';
const engine = new WebAREngine({ opencvURL: '/vision/opencv.js' });
engine.onPose((modelView, pose) => { /* lógica de tu aplicación */ });
await engine.startCamera();
const { buffer, metadata } = await engine.loadImageTarget(file);
// Ambos se generan automáticamente; guardarlos es opcional.
const dat = new Blob([buffer], { type: 'application/octet-stream' });
const json = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
```

`loadImageTarget` acepta File, Blob o URL JPG/PNG, compila en Worker y activa el marcador. No descarga archivos sin que la aplicación lo solicite. Para producción también existe `loadTarget(url)` con descriptores precompilados. La proyección automática es el modo predeterminado: no hay paso de calibración en la aplicación de ejemplo.

El tamaño virtual de referencia es 0.2 por defecto y permite seguir la imagen sin medirla. Solo si tu aplicación necesita relacionar tamaños con metros reales puedes proporcionar `{ physicalWidthMeters: 0.2 }` y mostrar el marcador con ese ancho. Los intrínsecos medidos siguen admitidos en la API avanzada para usos de precisión; no se requieren para reconocer, seguir o recuperar un marcador. La estimación automática de proyección no equivale a medir la distorsión real de la lente.

La cámara automática prefiere la trasera disponible y acepta webcams. Se puede elegir un dispositivo con `camera: { deviceId }`, obteniendo sus IDs mediante `navigator.mediaDevices.enumerateDevices()`. El tracking de imágenes no requiere WebXR.

A-Frame acepta imágenes directamente: después de registrar `registerAFrameComponent(AFRAME, engine)`, usar `my-ar-tracker="target: /imagen.jpg; targetId: poster; physicalWidth: 0.2"`. La extensión `.dat` conserva la ruta precompilada. Cada ID puede tener su propio contenido. El motor admite hasta 8 marcadores simultáneos con una captura y un Worker compartidos; el rendimiento depende de cuántos se configuren.

## Un script y un index.html propio

`mi-libreria-ar.standalone.min.js` incluye Three.js y los wrappers. También expone `MiLibreriaAR.THREE` para crear geometrías, materiales y escenas propias sin otro script. La variante ES/NPM y `core` permanecen disponibles para quien ya tenga renderizador. Servir por HTTPS o localhost el directorio `dist/` completo, incluidos `vision/` y `decoders/`.

```html
<div id="scene" style="width:100%;height:70vh"></div>
<button id="start">Iniciar AR</button>
<script src="./mi-libreria-ar.standalone.min.js"></script>
<script>
const { ThreeARScene, ThreeARModel } = MiLibreriaAR;
const app = new ThreeARScene({
  container: document.querySelector('#scene'),
  engineOptions: { keepContentOnLost: true, imageLossGraceMs: 500 }
});
const content = new ThreeARModel();
app.addContent('poster', content);
document.querySelector('#start').onclick = async () => {
  await content.load('./modelo.glb');
  await app.engine.startCamera();
  await app.engine.addImageTarget('poster', './imagen.jpg');
};
</script>
```

Ejemplos completos editables: `examples/plain-script.html`, `examples/multi-target.html`, `examples/video.html`. `ThreeARScene` mantiene su bucle de render y las animaciones mientras el tracking está incierto. La escena, cámara y renderer son públicos para añadir lógica propia. `dispose()` libera cámara, renderer y modelos/vídeos registrados. Para objetos Three.js propios, la aplicación gestiona sus geometrías/materiales.

## Varios marcadores, eventos y contenido persistente

```ts
await engine.startCamera();
await engine.addImageTarget('poster', '/poster.jpg');
await engine.addImageTarget('tarjeta', '/tarjeta.png');
const first = new ThreeARGroup().bind(engine, 'poster');
const second = new ThreeARGroup().bind(engine, 'tarjeta');
scene.add(first, second); // Añadir modelo/vídeo/objetos independientes a cada grupo.

engine.on('targetFound', ({ targetId, pose }) => console.log('Encontrado', targetId));
engine.on('targetLost', ({ targetId, retained, reason }) => console.log('Perdido', targetId, retained, reason));
engine.on('trackingQuality', quality => console.log(quality.score, quality.issues));
engine.onTargetVisibility(({ targetId, visible }) => { /* integración con otro renderer */ });
engine.setKeepContentOnLost(true);         // Todos los marcadores actuales y futuros.
engine.setKeepContentOnLost(false, 'poster'); // Política individual.
await engine.removeTarget('tarjeta');
```

`onTargetFound`, `onTargetLost` y `onTrackingQuality` son alias de los eventos genéricos; todos devuelven una función para desuscribirse. `onPose` añade `pose.targetId`. `loadImageTarget`/`loadTarget` conservan la API de un solo marcador y sustituyen el conjunto por `default`; `addImageTarget(id, image)`/`addTarget(id, datURL)` añaden al conjunto. Configurar con `await`, no con llamadas simultáneas. Para pasar a superficies desde un marcador concreto: `enableSLAM({ targetId: 'poster', placement: 'preserve' })`.

Usar imágenes distintas para IDs distintos: este módulo devuelve una pose por imagen, no identifica por separado varias copias físicas de la misma imagen.

El tracking y la presentación tienen estados distintos. Una pérdida breve no genera `targetLost` ni una nueva pose. Pasada la tolerancia, `targetLost` se emite una vez; `retained` indica si el contenido sigue visible. Retener **congela la última transformación en el espacio de cámara**: no sigue el papel oculto ni crea un anclaje espacial. Las animaciones/vídeos continúan; no cargar el modelo ni reiniciar la animación en cada detección. `stop()`, quitar un marcador o suspender la página siguen ocultando/liberando según el ciclo de vida.

Los diagnósticos tienen `diagnosis: 'heuristic'`, `state`, `score` (0–1), `processingMs`, `targetSizePx`, `inliers`, `motionPixels`, gradiente y varianza de Laplaciano. `issues` puede incluir `low-texture`, `small-target`, `blur`, `high-motion`, `insufficient-matches`, `occlusion-or-out-of-view` y `device-load`. Son evidencias orientativas: sin rasgos no siempre se puede distinguir desenfoque, falta de textura u oclusión. La captura protege la resolución cuando el marcador es pequeño o el tracking débil y ajusta primero la frecuencia; las poses no se inventan para alcanzar un FPS.

## MP4 y chroma key

```ts
import { ThreeARVideo } from 'mi-libreria-ar';
const video = new ThreeARVideo({
  width: .2, orientation: 'flat', muted: true, loop: true,
  chromaKey: { color: '#00ff00', similarity: .12, smoothness: .08, spill: .3 }
});
await video.setSource('/personaje.mp4'); // También File/Blob del usuario.
app.addContent('poster', video);
playButton.onclick = () => video.play().catch(showError);
// video.setChromaKey(false); video.pause(); video.setWidth(.3); video.dispose();
```

La transparencia se calcula en GPU; MP4 no necesita canal alfa. `orientation: 'upright'` coloca un panel vertical. `play()` es explícito y su promesa permite manejar bloqueos de autoplay, especialmente en Safari. MP4 es un contenedor: usar un codec soportado por el teléfono, normalmente H.264. Los vídeos remotos requieren CORS del servidor. Perder el marcador no pausa ni rebobina; si la aplicación quiere ese comportamiento, puede usar los eventos.

Para A-Frame, registrar `registerAFrameVideoComponent(AFRAME)` y añadir un hijo al tracker:

```html
<a-entity my-ar-tracker="target: /imagen.jpg; targetId: poster">
  <a-entity my-ar-video="src: /personaje.mp4; chromaKey: true; keyColor: #00ff00; width: 0.2"></a-entity>
</a-entity>
```

Eventos del componente: `ar-video-loaded`, `ar-video-error` y `ar-video-playblocked`. Si se bloquea, llamar desde un botón a `entity.components['my-ar-video'].video.play()`. Un cambio de parámetros chroma no recarga el vídeo.

## Modelos GLB, Draco y Meshopt

En `index.html`, seleccionar el archivo en **Modelo 3D opcional**. Puede cargarse o sustituirse mientras la cámara sigue activa. El modelo reemplaza al cubo, se centra y se apoya sobre el marcador, y la primera animación se reproduce automáticamente. Las opciones avanzadas permiten cambiar tamaño y animación. Quitar el archivo vuelve al cubo.

```ts
import { ThreeARModel } from 'mi-libreria-ar';

const content = new ThreeARModel({ dracoDecoderPath: '/decoders/draco/' });
group.add(content); // group es el ThreeARGroup que recibe la pose.
await content.load('/modelo.glb', { fitSize: 0.16 }); // También File o Blob.
// Mismo método para GLB normal, KHR_draco_mesh_compression o EXT_meshopt_compression.

// En el bucle de render, delta en segundos:
content.update(clock.getDelta());
// content.playAnimation('Caminar'); content.stopAnimations();
// content.unload();  // Retirar el contenido conservando el cargador.
// content.dispose(); // Liberar recursos y workers al terminar.
```

El ajuste utiliza un grupo contenedor: no cambia la matriz de tracking ni destruye los transforms/animaciones del archivo. `fitSize: false` conserva las unidades y origen del modelo. Si una nueva carga falla, se conserva el modelo anterior. La API admite cancelación con `signal`; una carga posterior cancela la anterior.

Draco usa un Worker y los archivos locales de `dist/decoders/draco/`; el decoder Meshopt está incluido en el bundle. No se descarga un decoder desde un CDN. Al integrar por NPM, copiar `dist/decoders/draco/` a los recursos estáticos y configurar la ruta. Los GLB deben ser autocontenidos: geometría, texturas PNG/JPEG y animaciones embebidas. Límite codificado predeterminado 64MiB, configurable con `maxBytes`. KTX2/Basis requiere un cargador de texturas adicional y no está incluido en este wrapper. Una CSP estricta debe permitir los Workers Blob de Draco y la ejecución WASM.

Para A-Frame:

```ts
import { registerAFrameComponent, registerAFrameModelComponent } from 'mi-libreria-ar';
registerAFrameComponent(AFRAME, engine);
registerAFrameModelComponent(AFRAME, { dracoDecoderPath: '/decoders/draco/' });
```

```html
<a-entity my-ar-tracker="target: /imagen.jpg">
  <a-entity my-ar-model="src: /modelo.glb; fitSize: 0.16; autoplay: true"></a-entity>
</a-entity>
```

Los archivos originales `public/models/demo-plain.glb`, `demo-draco.glb` y `demo-meshopt.glb` incluyen textura y animación para comprobar los tres caminos. Se regeneran con `npm run generate:models` y se incluyen en `dist/models/`.

## Continuidad del seguimiento

El flujo óptico se valida con homografía RANSAC antes de resolver la pose. Una redetección ORB fallida no descarta un flujo que sigue siendo geométricamente consistente. Se mantienen hasta tres vistas verificadas del marcador para ayudar a recuperar cambios de apariencia; sus coordenadas permanecen ligadas a descriptores del marcador original.

Una pérdida aislada emite `tracking-uncertain`, conserva la última transformación visible durante 500ms por defecto y **no emite una pose nueva**. Pasada la tolerancia emite `not-found` y `targetLost`; los wrappers aplican `keepContentOnLost` (false por defecto en la API, true en el ejemplo principal). `imageLossGraceMs` admite 0–10000ms y `imageSmoothingMs` 0–500ms (65ms por defecto). Durante la incertidumbre no se permite sembrar SLAM desde una observación ausente. Un cambio significativo de focal reinicia el filtro de pose para evitar mezclar proyecciones incompatibles.

Esta tolerancia reduce el parpadeo; no representa seguimiento físico durante una oclusión total. La equivalencia con otras librerías requiere comparar los mismos videos y dispositivos, midiendo detecciones, redetección, error en pantalla, jitter y latencia. No se afirma equivalencia universal con AR.js o MindAR.

## Compilar imágenes (exportación opcional)

Herramienta web local: `tools/compile.html`. Usa un Worker para ORB. Si WebKit no ofrece decodificación de imágenes dentro del Worker, el decoder nativo y un canvas reducido trabajan en la página; los descriptores siguen calculándose fuera de UI.

CLI de desarrollo del repositorio:

```sh
npm run compile:marker -- mi-imagen.jpg public/mi-target.dat 0.2
npm run generate:demo
```

El CLI aplica EXIF, compone transparencia sobre blanco y limita la imagen a 1024px por lado. El compilador precalcula ORB a escalas 1, 1/2 y 1/4, normalizando puntos al tamaño original. Publica también un informe `.dat.json` con cantidad de puntos, cobertura, repetición y advertencias. Las imágenes uniformes o muy repetitivas se rechazan. Límites: 32MB codificados y 16 megapíxeles para decodificación.

WART **v2** incluye versión, dimensiones, ancho físico, extractor, puntos, descriptores y CRC32 de cabecera/payload. Los archivos v1 del scaffold anterior deben recompilarse. `simulate: true` existe únicamente para fixtures; nunca es el modo por defecto y el tracker rechaza esos archivos. El CRC detecta corrupción, no autentica el archivo.

## Calibrar

Abrir `tools/calibrate.html`, descargar el tablero e imprimirlo a **21×15cm**, con cuadrados de 30mm. Capturar 15–25 vistas nítidas que cubran distintos ángulos, distancias y regiones del encuadre. La herramienta exige al menos 10 vistas, evita duplicados y rechaza error RMS alto o intrínsecos mal condicionados.

Para fotografías existentes:

```sh
npm run calibrate -- camera-calibration.json vista01.jpg vista02.jpg ...
```

Cargar ese JSON en el ejemplo. Mantener la cámara, lente, zoom, enfoque y orientación usados durante la calibración. Si cambia la relación de aspecto, el motor pide una calibración adecuada; no adivina un recorte. `rotateIntrinsics()` permite transformar un perfil cuando se conoce la rotación aplicada. La calibración Brown implementada no es un modelo de cámara fisheye.

## Transiciones y superficies

`enableSLAM({ backend, placement })` acepta:

- Backend: `auto`, `webxr`, `optical-flow`.
- Colocación: `auto`, `preserve`, `hit-test`.

En `auto`, WebXR tiene prioridad si la aplicación proporciona `attachXRSession`. El ejemplo lo conecta con `renderer.xr.setSession`, configura reference space `local` y utiliza `renderer.setAnimationLoop`.

**Imagen → visión local:** una observación reciente contiene RGBA, pose, intrínsecos y correspondencias. Inicializa un mapa métrico con el marcador; se triangulan puntos fuera de él y se exige estabilidad antes de confirmar la transición. Después, los puntos del marcador se eliminan de la estimación de cámara. Si no hay observación reciente o entorno suficiente, `preserve` falla y recupera el modo de imagen. Durante VO no cambia automáticamente la resolución porque invalidaría el mapa.

**Imagen → WebXR:** se solicita Raw Camera Access y se usa una imagen sincronizada con su pose XR. El tracker reconoce el marcador en esa imagen y calcula `T_world_object = T_world_camera × T_camera_object`. Se preserva el objeto en reference space, creando XRAnchor si se concede. Hace falta `getXRContext` con WebGL2 y soporte real de `camera-access`. Si esa observación común no existe, no se inventa una alineación.

`preserve` exige alineación: puede recurrir a visión local si el backend es `auto`. `hit-test` permite una colocación nueva y explícita. En WebXR, tocar una superficie confirma la retícula. Los rechazos de permisos no se sustituyen por otra solicitud de cámara. Los resets de reference space invalidan transforms sin anchor nativo; los cambios de mapa local invalidan anclajes del mapa anterior.

Sin marcador, el fallback inicializa con paralaje y escala relativa. La región inferior de la imagen selecciona candidatos; un plano solo se publica tras triangulación, RANSAC y estabilidad temporal. Una cámara monocular sin gravedad no certifica que ese plano sea el suelo horizontal. Pure rotation, poca textura y escenas mayoritariamente móviles pueden impedir la reconstrucción.

## Mapas locales y relocalización

El fallback conserva hasta 8 keyframes con diversidad de vistas, mantiene una referencia antigua para facilitar el regreso y selecciona la relocalización por soporte geométrico y error. Refina puntos triangulados de forma local y acotada; los descriptores ORB se anclan en su propio rayo de imagen, evitando asociarlos a una esquina LK desplazada. Esto no implementa optimización global, fusión inercial ni cierre de bucle.

```ts
// Con visión local activa y mapa inicializado:
const snapshot = await engine.exportSLAMMap();
// Guardar snapshot con structured clone, por ejemplo en IndexedDB (contiene TypedArrays).
await engine.importSLAMMap(snapshot);
```

Importar requiere visión local activa, una proyección compatible y `maxFrameWidth` suficiente para la resolución guardada. El snapshot contiene descriptores, geometría, plano y transformación del contenido; no incluye frames RGBA ni vídeo de cámara. **No se emite una pose del archivo al importarlo**: es necesario volver a observar y relocalizar el entorno. Un mapa importado recibe una nueva revisión para invalidar estado anterior. `OpticalFlowSLAM` también ofrece `exportMap`/`importMap` para consumidores del backend. La persistencia no garantiza recuperación entre lentes, dispositivos o entornos modificados.

## Render y coordenadas

Matrices `Float32Array(16)`, column-major, sistema diestro WebGL. Metros cuando `scale === 'metric'`; unidades relativas en inicialización monocular sin referencia física. El núcleo convierte OpenCV → WebGL una sola vez.

```ts
import { ThreeARGroup, ThreeCameraBackground } from 'mi-libreria-ar';
const group = new ThreeARGroup();
scene.add(group); // Raíz de tracking con transform identidad.
const background = new ThreeCameraBackground(engine.videoElement, engine.calibration);
scene.add(background.object3D);
engine.onPose((matrix, pose) => {
  group.update(matrix, pose);
  if (pose.backend !== 'webxr') {
    camera.matrixAutoUpdate = false;
    camera.matrix.fromArray(pose.viewMatrix).invert();
    camera.updateMatrixWorld(true);
    camera.projectionMatrix.fromArray(pose.projectionMatrix!);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  background.object3D.visible = pose.backend !== 'webxr';
});
```

El fondo rectifica distorsión en GPU para que el vídeo y la proyección K coincidan. Ocultarlo desde `attachXRSession` al iniciar XR; el passthrough nativo sustituye el vídeo. El ejemplo contiene todo el ciclo de vida, corrección de aspecto, pérdida/restauración WebGL y liberación de recursos.

`ThreeARGroup.update(matrix)` sin metadata sigue siendo posible con cámara identidad. Con metadata se usa la pose de mundo. `registerAFrameComponent(AFRAME, engine)` registra `my-ar-tracker`, propiedad `target`; actualiza matrices, cámara de vídeo y fondo, se desuscribe y restaura configuración al quitarse. Usar una entidad objetivo por motor y conectar el renderer de A-Frame al configurar XR.

## Distribución y recursos locales

- `dist/mi-libreria-ar.js`: ES para bundlers, con wrappers y peer opcional Three.js.
- `dist/mi-libreria-ar.min.js`: IIFE, `window.MiLibreriaAR`; cargar THREE global antes.
- `dist/mi-libreria-ar.core.js` / `.core.min.js`: núcleo sin Three.js; NPM subpath `/core`.
- `dist/mi-libreria-ar.standalone.min.js`: script clásico completo con `MiLibreriaAR`, `THREE`, `ThreeARScene`, modelos y vídeos.
- `dist/types`: declaraciones estrictas.
- `dist/vision/opencv.js`: OpenCV.js/WASM autoalojado, necesario para visión.

Copiar `dist/vision` al despliegue y configurar `opencvURL`. No hay una descarga del runtime desde terceros durante el uso. Three.js del ejemplo también se sirve localmente. No se necesita SharedArrayBuffer ni aislamiento COOP/COEP.

Los Workers por defecto son inline de tipo módulo. El build OpenCV genera dinámicamente funciones Embind: necesita `unsafe-eval` dentro del Worker, además del permiso para WASM; los Workers `blob:` heredan la CSP de la página.

Para conservar una CSP estricta en la página, usar los Workers estáticos de `dist/workers/` y configurar su propia cabecera CSP en el servidor. La página puede mantener `script-src 'self'; worker-src 'self'`; la respuesta del Worker permite la evaluación que requiere OpenCV. Este aislamiento está cubierto por una prueba de navegador:

```ts
const engine = new WebAREngine({
  opencvURL: new URL('/vision/opencv.js', location.href),
  tracker: { workerFactory: () => new Worker('/workers/tracking.js', { type: 'module' }) },
  fallback: { intrinsics: calibration, floorROI: { x: 0, y: .35, width: 1, height: .65 },
    workerFactory: () => new Worker('/workers/odometry.js', { type: 'module' }) },
});
```

Copiar también los chunks junto a esos Workers. `MarkerCompiler` y `CalibrationSession` admiten `workerFactory` para `compiler.js` y `calibration.js`.

`prepare:vision` usa OpenCV 4.12.0-release.1 fijado por lockfile. Adapta el wrapper UMD a ESM y reduce a 32MiB tanto el heap inicial como el mínimo de memoria importada por WASM; conserva el crecimiento y comprueba el layout estático. La transformación es determinista, se valida y registra hashes en `vision/manifest.json`. No se afirma que el runtime incluya únicamente los módulos usados; el archivo local tiene aproximadamente 10.9MB antes de compresión HTTP.

## Verificación y rendimiento

```sh
npm run build
npm test
npm run test:browser
npm run benchmark
npm pack --dry-run
npm run check:package
```

Para WebKit, instalar `npx playwright install webkit` y ejecutar las pruebas con `TEST_WEBKIT=1`. En Windows las pruebas usan Chrome instalado; en Linux usan Chromium de Playwright (`npx playwright install --with-deps chromium webkit`). Se puede elegir el canal con `PLAYWRIGHT_CHANNEL`.

Los tests incluyen Workers reales, cálculo WASM real y escenas generadas con geometría conocida. Chrome ejecuta el recorrido completo de cámara virtual/Three.js/transición; WebKit verifica compilación, NFT y odometría en Worker. Cámara física y WebXR nativo se validan aparte.

`docs/verification.md` resume los resultados de esta entrega. El tarball se comprueba además como consumidor NPM independiente con tipos NodeNext estrictos, sin ocultar errores de declaraciones mediante `skipLibCheck`.

El benchmark de escritorio de referencia está en `benchmarks/latest.json`: 630 frames de una escena sintética, heap WASM de 32MiB estable y distribución de tiempos/errores. No representa un móvil ni certifica temperatura o FPS de render. `tools/benchmark.html` permite recopilar un JSON en cada dispositivo real. Ver `docs/device-validation.md` antes de declarar una versión estable.

Licencias y modificaciones de dependencias: `THIRD_PARTY_NOTICES.md`. Código propio bajo MIT. Los archivos históricos `packages/core/src/contracts.ts` y `docs/architecture.md` son diseños iniciales; la API implementada se exporta desde `src/core.ts` y `src/index.ts`.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
