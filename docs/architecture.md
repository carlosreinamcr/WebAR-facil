# Arquitectura implementada

El núcleo es agnóstico al renderizador. Los wrappers son una capa opcional. No hay servicios externos de compilación o tracking.

La entrada recomendada es la capa webar-scene/target/model/video de `src/wrappers/web-components.ts`. El standalone la registra automáticamente; configura recursos, compila imágenes, selecciona clips y libera recursos. Un observador y una cola sincronizan cambios de targets/jerarquía; cada medio administra sus cargas cancelables. GestureController gestiona interacción opt-in sobre contenido visible sin modificar el anclaje. El núcleo y los wrappers programáticos se conservan para extensiones.

```text
Aplicación HTML / TypeScript / A-Frame
                 |
   ThreeARScene / ThreeARGroup / componentes (opcionales)
                 |
           WebAREngine
          /     |      \
 CameraManager Tracker  SLAMManager (WebXR)
          |     |            |
          |  Worker ORB/LK   compositor y hit-test nativos
          |
      OpticalFlowSLAM -> Worker de odometría -> OpenCV WASM

 JPG/PNG -> MarkerCompiler -> Worker -> WART v2 -> Tracker
```

## Carpetas fuente

| Ruta | Responsabilidad |
| --- | --- |
| `src/WebAREngine.ts` | Fachada, estados, eventos y transición espacial |
| `src/Pose.ts`, `src/core.ts`, `src/index.ts`, `src/standalone.ts` | Contratos y exports |
| `src/camera/` | Captura, lectura RGBA, negociación y adaptación |
| `src/tracking/` | Controlador, Worker, extracción, matching, pose y eventos |
| `src/tools/` | Compilador de marcador en Worker |
| `src/calibration/` | Captura ChArUco y solución opcional de cámara |
| `src/slam/` | WebXR, captura alineada, odometría y snapshots |
| `src/spatial/` | Matrices, filtrado y presentación temporal |
| `src/vision/` | Runtime CV, intrínsecos y algoritmos auxiliares |
| `src/wrappers/` | Scene, Group, Model, Video, fondo y A-Frame |
| `scripts/` | CLI, benchmark, empaquetado y manual |
| `public/` | Recursos estáticos que se copian al build |
| `examples/`, `tools/` | Aplicaciones y herramientas |
| `tests/` | Pruebas de CV, contratos y navegadores |
| `dist/` | Distribución generada; no editar como fuente |

El diseño inicial archivado propuso paquetes separados; la distribución vigente usa los entrypoints `webar-facil`, `webar-facil/core`, `webar-facil/browser` y `webar-facil/standalone`. No importes nombres de paquetes del diseño histórico.

## Flujo y concurrencia

La cámara negocia un MediaStream y entrega frames limitados por resolución/frecuencia. Cada frame tiene un identificador de sesión; respuestas tardías de una sesión cancelada no deben reaparecer como observaciones actuales.

El tracker transfiere un único RGBA por lote. El Worker comparte gris y extracción entre targets y conserva estados/descriptores para seguimiento y recuperación por ID. Las matrices aceptadas pasan a filtrado, tolerancia, eventos y visibilidad. Animación y render son independientes.

La fachada serializa configuración y utiliza backpressure para frames. Cancelar o detener cierra recursos y descarta mensajes tardíos. Los Workers no acceden al renderer ni escriben DOM.

## Marcos y extensiones

WebXR usa su propio origen. La odometría mantiene un mapa local. La transición requiere una transformación de cámara común y una observación reciente o una recolocación explícita. Conservar una matriz camera-space no demuestra anclaje world-space.

Un renderer nuevo consume `ARPose` y eventos de visibilidad. Un backend implementa `OdometryModule`. Un compilador alternativo debe producir descriptores compatibles e identificador/versionado propios si cambia el algoritmo. Preserva las verificaciones geométricas y declara pérdida cuando no haya evidencia.

El módulo NFT perfila etapas por frame y mantiene una referencia de descriptores ya verificados para redetección rápida. Recurre al pool global si falla esa ruta y periódicamente; no elimina RANSAC ni sustituye mediciones por poses inventadas. Las estadísticas llegan por CameraMetrics.tracking y ARDiagnostics; no dependen de Three.js. Ver [rendimiento y benchmark](camera-performance.md).

La redetección NFT considera cobertura convexa, distribución, error y retención del soporte. Un mínimo escaso pero bien distribuido no fuerza matching global por cantidad. Revisiones acotadas y desacuerdos entre estimaciones mantienen una vía de corrección independiente; ver política y límites en [rendimiento](camera-performance.md).

El matching ORB compartido usa un kernel Hamming WASM especializado con resultado equivalente al BFMatcher previo y alternativa OpenCV si no puede compilarse. El kernel está embebido, sus buffers son reutilizables/acotados y la fuente WAT se distribuye con el SDK. No altera los criterios geométricos, los datos WART ni la API declarativa.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
