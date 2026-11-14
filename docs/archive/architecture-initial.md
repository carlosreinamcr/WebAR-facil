# Arquitectura de la librería WebAR

Estado: diseño inicial de referencia. La implementación actual está en `src/`: cámara con control de carga, NFT ORB/LK/PnP real en WASM, compilador WART v2, calibración ChArUco, WebXR, odometría monocular local, transiciones, fachada y wrappers. `index.html` integra la biblioteca completa. Consultar `README.md` para el comportamiento implementado y `docs/device-validation.md` para la validación física pendiente. La estructura monorepo y los contratos de `packages/core/src/contracts.ts` de este documento son históricos; no sustituyen la API exportada por `src/core.ts`.

## Objetivo y límites

Núcleo TypeScript sin dependencias de renderizado, procesamiento C++/WASM en Worker y adaptadores opcionales para Three.js y A-Frame. Todos los recursos se sirven desde el propio despliegue. Propuesta de licencia MIT para el código original; las dependencias deberán conservar sus licencias y avisos. No se copiará una implementación SLAM sin revisar su licencia.

Una imagen a color no requiere bordes artificiales, pero sí textura suficiente, contraste y puntos distintivos. Una imagen uniforme o repetitiva puede no ser rastreable. La primera versión soportará objetivos planos y rígidos. El compilador producirá un informe de calidad y solicitará el ancho físico para recuperar escala métrica.

60 FPS es un objetivo de renderizado, no una garantía de procesamiento CV. Se medirán latencia captura-pose, p50/p95 de procesamiento, memoria, consumo térmico y recuperación del tracking en móviles reales. La frecuencia y resolución de análisis serán adaptables.

## Estructura propuesta

```text
packages/
  core/src/
    WebAREngine.ts             # API pública, estados y exclusión de operaciones
    contracts.ts              # Contratos iniciales incluidos en este proyecto
    camera/CameraController.ts
    scheduling/FrameScheduler.ts
    worker/WorkerClient.ts
    tracking/ImageTracker.ts
    tracking/VisualOdometryTracker.ts
    tracking/WebXRSurfaceTracker.ts
    spatial/CoordinateSystem.ts
    spatial/AnchorManager.ts
    spatial/PoseFilter.ts
  worker/src/
    vision.worker.ts          # Buzón, recursos, errores y ejecución de WASM
    WasmRuntime.ts
  vision-wasm/
    CMakeLists.txt
    include/webar.h           # ABI C versionada; buffers y handles explícitos
    src/features.cpp
    src/matching.cpp
    src/pose.cpp
    src/optical_flow.cpp
    src/odometry.cpp
    src/map.cpp
  target-format/src/          # Lector, escritor y validación compartidos
  target-compiler/src/        # CLI local JPG/PNG -> .wartarget (nombre provisional)
  three/src/ThreeAdapter.ts
  aframe/src/register.ts
examples/
  camera/index.html
  image-three/index.html
  surface-three/index.html
  image-to-surface/index.html
tests/
  geometry/                  # Convenciones, reproyección y conversión de matrices
  lifecycle/                 # Carreras, cancelación, errores y liberación de recursos
  fixtures/                  # Secuencias y marcadores con licencia compatible
benchmarks/                  # Secuencias reproducibles y mediciones en dispositivos
docs/
  architecture.md
  coordinates.md
  target-format.md
  compatibility.md
```

## Responsabilidades de las clases

| Clase | Responsabilidad |
| --- | --- |
| `WebAREngine` | Iniciar/detener, cargar targets, elegir backend, publicar poses y coordinar transiciones. |
| `CameraController` | Poseer y liberar MediaStream, resolver permisos, configurar resolución y enfoque según capacidades reales. |
| `FrameScheduler` | Leer nuevos frames con requestVideoFrameCallback cuando exista, reducir resolución y mantener un máximo de un frame en vuelo. |
| `WorkerClient` | Correlacionar mensajes, aplicar timeout, gestionar transferibles y descartar respuestas de sesiones antiguas. |
| `WasmRuntime` | Cargar un build local, gestionar memoria, ABI y buffers persistentes. Seleccionar variantes SIMD/threads solo si están soportadas. |
| `ImageTracker` | Detección, matching, verificación geométrica, pose, seguimiento temporal y recuperación. |
| `VisualOdometryTracker` | Inicialización multivista, keyframes, triangulación, mapa local, pose y relocalización. |
| `WebXRSurfaceTracker` | Sesión immersive-ar, reference spaces, hit tests y planos/anclajes opcionales; usa el reloj de XRSession. |
| `AnchorManager` | Asociar objetos a espacios, mantener identidad y comunicar pérdida, refinamiento o invalidación de anclajes. |
| `PoseFilter` | Filtrar traslación y rotación usando tiempo real de captura; interpolar cuaterniones, nunca elementos de matrices. |
| `ThreeAdapter` | Inyectar matrices, visibilidad y viewport; integrar el camino WebXR del renderer. |
| `AFrameAdapter` | Exponer componentes sobre el adaptador de Three.js y respetar el ciclo de vida de la escena. |

Los backends se inyectan. El core no importa Three.js, A-Frame ni un proveedor de servicios. La capa WebXR requiere integración con el renderer para XRWebGLLayer o layers equivalentes; no es un reemplazo directo del bucle de vídeo.

## Estados y ciclo de vida

Estados estables: `Idle`, `TrackingImage`, `TrackingSurface`, `Disposed`. El progreso de una operación se publica por separado (`starting`, `switching`, `stopping`); la calidad de tracking también (`initializing`, `tracked`, `limited`, `lost`). Estar en `TrackingImage` significa que el backend está activo, no que el marcador esté visible.

```text
Idle -> TrackingImage -> TrackingSurface
Idle -----------------> TrackingSurface
TrackingImage   -> Idle
TrackingSurface -> Idle
Idle            -> Disposed
```

`dispose()` detiene primero una sesión activa. Para volver de superficies a imagen en la primera versión: `stop()` y `startImage()`. Las operaciones públicas se serializan o rechazan con `BusyError`; no se permiten dos propietarios de cámara. Cada inicio obtiene un epoch creciente. Las respuestas cuyo epoch no coincide se descartan.

Un fallo de inicio libera recursos y vuelve a Idle. En una transición se prepara el destino antes de confirmar el nuevo estado cuando el hardware lo permite. Si hay que cerrar la cámara antes de abrir XR y luego falla XR, se intenta recuperar el origen; si no es posible se vuelve a Idle y se publica el error. Nunca se comunica éxito por haber solicitado solamente una sesión.

`stop()` cancela callbacks, captura pendiente y RPC, cierra frames/bitmaps, termina tracks propios o la sesión XR propia y reinicia el contexto de tracking. `dispose()` también termina el Worker y libera WASM. Ambos son idempotentes. Un timeout de Worker puede exigir terminarlo y recrearlo: un algoritmo WASM síncrono no atiende mensajes de cancelación mientras ejecuta.

## Pipeline de imágenes y compilador

Compilación offline, en CLI local o eventualmente en un Worker de una herramienta local:

1. Decodificar JPG/PNG, aplicar orientación EXIF y normalizar dimensiones.
2. Convertir a gris y construir una pirámide multiescala.
3. Extraer esquinas orientadas y descriptores ORB; distribuir puntos espacialmente.
4. Calcular calidad: cobertura, densidad, repetición y estabilidad entre escalas.
5. Guardar pirámide necesaria, puntos, orientaciones, descriptores y metadatos en formato binario.

El formato contendrá magic, versión, endianness, dimensiones, escalas, ancho físico opcional, identificador y parámetros exactos del extractor, longitudes de secciones y checksum de integridad. Se validarán límites de tamaño y offsets antes de reservar memoria. Compilador y runtime comparten extractor y versión; descriptores incompatibles se rechazan.

En ejecución: frame reducido -> gris -> detección/descriptores -> distancia Hamming y filtrado de ambigüedad -> homografía RANSAC -> pose planar PnP con intrínsecos -> reproyección, cheirality y continuidad temporal -> pose. Entre detecciones se usa flujo óptico y se reextraen características según calidad. Se distinguirán búsqueda inicial, seguimiento y relocalización.

El ancho físico proporciona escala del objetivo. Los intrínsecos deben corresponder a resolución, orientación y recorte efectivos. Si se usa un FOV estimado en ausencia de calibración, se etiqueta la proyección como aproximada. La conversión entre coordenadas OpenCV y WebGL es explícita.

## Worker y transporte

```text
getUserMedia -> <video> -> FrameScheduler -> transfer ImageBitmap
                                            |
                                      vision.worker
                                  OffscreenCanvas reducido
                                  píxeles -> memoria WASM
                                  features / matching / pose
                                            |
                          resultado + timestamp + epoch
                                            |
                         core -> adaptador -> renderer
```

El primer camino usa ImageBitmap transferible y OffscreenCanvas en Worker tras comprobar capacidades. VideoFrame será una optimización opcional, también con detección de soporte. No se envían URLs arbitrarias al Worker para cargar código: las rutas del módulo y WASM son configuración de la aplicación.

Existe como máximo un frame en vuelo: si CV está ocupado se omiten frames nuevos. La captura asíncrona también ocupa ese cupo. Los bitmaps se cierran en `finally`, incluso al fallar. No se acumulan colas de vídeo. El resultado reutiliza el timestamp de captura; la duración de procesamiento se informa aparte.

Los mensajes de control usan requestId y epoch; las respuestas son ack/error tipados. INIT carga WASM, LOAD_TARGET valida descriptores, SET_MODE reinicia el contexto correspondiente, FRAME procesa y RESET/DISPOSE libera recursos. No basta con publicar mensajes: el cliente espera el ack antes de habilitar captura. Un Worker es inicialmente suficiente; compilar targets mientras se rastrea requerirá otro Worker para no competir por su buzón.

WASM SIMD se detecta antes de cargar su build. Los threads de WASM y SharedArrayBuffer son opcionales y necesitan el entorno de aislamiento apropiado; el build base funciona sin ellos. WASM no elimina el coste de copia ni garantiza aceleración por sí solo.

## Superficies: WebXR y odometría

Se prueba immersive-ar y luego se solicita `hit-test` como capacidad requerida para el camino de colocación; `plane-detection` y `anchors` son opcionales. La disponibilidad de la sesión no implica disponibilidad de todas las extensiones. El rechazo de permisos o cancelación de usuario se comunica; no se cambia de cámara silenciosamente para eludir esa elección.

XRSession posee la captura/passthrough en el camino nativo. No se presupone acceso a sus píxeles por getUserMedia ni compatibilidad automática con todos los navegadores sobre ARKit. El adaptador usa proyección y vista de cada XRView, incluyendo multiview.

El fallback WASM es odometría visual monocular con mapa local, no SLAM completo inicialmente. Requiere paralaje, suficientes puntos estáticos, estimación robusta de movimiento, triangulación y optimización local. La escala es relativa salvo que se inicialice con geometría métrica conocida, por ejemplo un marcador de tamaño conocido. El ajuste de planos por RANSAC solo se expone si existe mapa 3D suficiente y evidencia geométrica. Pérdida de tracking invalida la confianza de colocación.

Loop closure, mapa persistente y recuperación global corresponden a una fase posterior. No se promete equivalencia con ARCore/ARKit ni estabilidad absoluta sin deriva.

## Matrices y transición imagen -> superficie

Matrices Float32Array de longitud 16, column-major, sistema diestro WebGL, vectores columna; metros cuando `scale` sea `metric`. `T_A_B` transforma coordenadas de B a A.

```text
modelViewMatrix = T_camera_world * T_world_object
clipPosition    = projectionMatrix * modelViewMatrix * objectPosition
```

La pose de imagen entrega T_camera_marker. Si hay una pose del mismo instante T_world_camera:

```text
T_world_object = T_world_camera * T_camera_marker * T_marker_object
```

El contrato expone matrices por vista, timestamp, espacio, epoch, calidad y escala. Las matrices de un resultado son propiedad del consumidor; el backend no las sobrescribe. En Three.js se usa una cámara con la proyección correspondiente y la vista para esa misma pose; si se emplea una cámara identidad y modelView como matriz del objeto, no se vuelve a aplicar la vista.

`switchToSLAM({ placement: 'preserve' })` intenta conservar la pose solo si hay alineación observable y temporalmente consistente entre los espacios. Imagen -> VO puede compartir frames y usar el marcador métrico para inicializar el mapa; no basta una sola homografía para obtener un mapa del entorno.

Imagen -> WebXR necesita observaciones comunes mediante una ruta de cámara XR compatible o una alineación externa válida. El acceso a cámara XR es una capacidad aparte y puede requerir lectura GPU costosa. Si no hay alineación, se devuelve `alignment-required` y se mantiene/recupera el modo anterior. La aplicación puede pedir `placement: 'hit-test'`, mostrar retícula y confirmar una nueva colocación. Una animación visual no sustituye la alineación espacial.

Al confirmar una colocación se crea XRAnchor si existe soporte. En caso contrario se mantiene un transform en el reference space de la sesión, etiquetado como `reference-space`; no se presenta como anclaje nativo ni persistente. Se atienden resets del reference space. En VO, el objeto queda ligado al mapa local. Refinamientos visuales pequeños usan interpolación de traslación y slerp de rotación durante un intervalo configurable; nunca se interpola la matriz de proyección para ocultar diferencias de cámara.

## Orden de implementación y aceptación

1. Core, cámara, Worker y ejemplo de vídeo: lifecycle, backpressure y liberación verificables, sin poses inventadas.
2. Compilador y tracking de una imagen: corpus de prueba, calibración y error de reproyección medido.
3. Adaptador Three.js y componente A-Frame: igualdad de encuadre y coordenadas.
4. WebXR hit test: colocación, fin de sesión y capacidades opcionales.
5. VO experimental: error de trayectoria, deriva, recuperación y alineación con marcador.
6. Transiciones: continuidad espacial medida; degradación explícita cuando falte alineación.

## Referencias técnicas

- [WebXR Hit Test](https://www.w3.org/TR/webxr-hit-test-1/)
- [WebXR Plane Detection](https://immersive-web.github.io/plane-detection/)
- [WebXR Raw Camera Access](https://github.com/immersive-web/raw-camera-access/blob/main/explainer.md)
- [requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [Restricciones de cámara](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)
- [OpenCV: pose y homografía](https://docs.opencv.org/4.0.0/d9/dab/tutorial_homography.html)
- [Escala en odometría monocular](https://arxiv.org/abs/2101.05995)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
