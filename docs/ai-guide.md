# Contrato para asistentes de IA

Para la instalación XAMPP de desarrollo existe un recolector opcional: scripts/install-local-diagnostics.mjs conecta los ejemplos y guarda envelopes en reports/local-devices/data/<instalación>/. El diagnóstico está en envelope.report. Estos datos privados no se incluyen en Git ni en el SDK distribuido. El teléfono usa el mismo origen HTTPS del ejemplo, nunca su propio localhost. El panel está en diagnostics/ y el recorrido en diagnostics/mobile.html. No clasifiques registros execution=automated como evidencia física ni interpretes recibido como aprobado. La instalación no activa análisis autónomos del asistente.

Este documento describe **webar-facil 0.1.0 implementada**. La ruta predeterminada para nuevas aplicaciones es **HTML declarativo**, con referencia en [inicio](getting-started.md) y [etiquetas](declarative.md). La API programática sigue disponible para casos avanzados; no es un requisito de una aplicación básica.

## Cómo decidir qué generar

La carpeta [PRUEBAS](../examples/PRUEBAS/index.html) proporciona 25 HTML completos y comentados para GLB, mover/girar/pellizcar, botones de contenido, texto, MP4 y luz con marcador o SLAM óptico, y un mapa guardado en IndexedDB. Sus recursos multimedia son locales y originales; la receta 25 añade A-Frame con su licencia. Cada HTML tiene sus propios listeners; el movimiento sobre el plano, el Sprite de texto y la iluminación son código de aplicación mediante Three.js, no etiquetas nuevas del SDK. Los ejemplos ópticos utilizan colocación manual y escala relativa.

Para presupuestos de rendimiento usa performance="auto" (predeterminado), battery, balanced o quality en webar-scene; consulta cámara/rendimiento para límites. camera-width/camera-height son preferencias de captura; analysis-width/analysis-pixels y fps limitan el análisis. El motor mide carga en lugar de mantener una lista de modelos de móvil. No prometas selección óptima universal, control térmico ni que menor resolución siempre reconozca mejor. En odometría no cambies dimensiones dentro del mapa; un cambio de perfil exige reiniciar. Los mapas ópticos son referencias dispersas locales en memoria; guardarlos es optativo, no una malla ni un mapa exportado de ARCore/ARKit.

| Petición | Entrega recomendada |
| --- | --- |
| GLB, varios marcadores, giro/tamaño/clip | HTML con webar-scene, webar-target y webar-model |
| MP4/chroma | webar-video dentro del target o directamente en SLAM |
| Gestos | atributo gestures; consultar interacción y límites de escala |
| SLAM sin marcador | webar-scene mode="slam" con webar-model directo; fallback óptico por defecto |
| Despegar contenido de imagen a espacio | Escena de imagen con atributo slam; explicar resultado de transición |
| Botones propios, diagnóstico o interacción | Etiquetas más listeners DOM opcionales |
| Blob, renderer propio o modificación del backend | [Programática](programmatic.md), [API avanzada](advanced.md) |
| Proyecto A-Frame existente | [Wrapper A-Frame](aframe.md); no confundir su schema con las etiquetas propias |

## Flujo predeterminado

1. Usa un `<script defer>` del **standalone actualizado**. Registra las etiquetas automáticamente e incluye Three.js y loaders. No añadas A-Frame, importmap ni otro script Three para el caso básico.
2. Para una imagen, genera `webar-scene > webar-target[src] > webar-model[src]`. Usa JPG/PNG directamente: se compila en Worker sin requerir `.dat`, JSON o calibración manual.
3. Explica en qué carpeta se guarda el HTML y usa la ruta correcta del script. Junto al bundle es `./webar-facil.min.js`; desde examples del repositorio es `../dist/webar-facil.min.js`; desde la raíz fuente es `./dist/webar-facil.min.js`.
4. Conserva el párrafo de respaldo dentro de la escena. Si falta el SDK o está anticuado, debe quedar un mensaje en vez de una página vacía.
5. La biblioteca ya crea cámara, renderer, controles, mensajes y animación. No generes startCamera, model.load, bucle de render ni limpieza manual para reproducir esos mismos pasos.
6. Usa `size`, `scale`, `rotation` (grados XYZ), `position` y `animation` para personalizar contenido. El primer clip se reproduce si existe; un nombre explícito debe existir en el GLB. `animation="none"` lo detiene.
7. Explica HTTP/HTTPS y el botón integrado Iniciar AR. En teléfono hace falta HTTPS accesible; file:// no es un modo soportado.
8. Si hay JavaScript opcional, coloca la UI fuera de webar-scene y registra listeners antes de que el usuario inicie. Los hijos de escena describen contenido y no son una ranura de controles visibles.

## Contrato declarativo

- Existen `webar-scene`, `webar-target`, `webar-model` y `webar-video`. Usa la [referencia de interacción](interaction.md) para vídeo, gestos y animaciones avanzadas. No inventes otros atributos.
- `physical-width` es el atributo de target en metros; en el motor se llama `physicalWidthMeters` y en A-Frame `physicalWidth`.
- El ID de imagen omitido se genera como `target-0`, `target-1`, etc. La integración programática singular usa `default`; no asumas que son el mismo contrato.
- Transformaciones, size y controles de animación cambian en vivo. Src usa cargas cancelables: setAttribute y await element.updateComplete; una carga fallida conserva el contenido válido anterior. Para cambios de jerarquía o targets usa await scene.refresh(), sin reiniciar cámara. Los targets solo cambian en modo imagen, no durante SLAM. Cámara/mode/backend sí requieren stop/start.
- Los gestos son opt-in, con raycast sobre contenido visible: arrastre gira, pellizco escala y toque selecciona. No son traslación 3D ni interacción XR inmersiva. Respeta min-scale y max-scale.
- Vídeo intenta autoplay (muted por defecto). Si se bloquea emite videoPlayBlocked y muestra botón; no ocultes ni ignores ese rechazo. Element.play() permite un botón propio. Chroma no es segmentación semántica.
- El nombre de animación debe existir. animation-loop admite repeat/once/pingpong, animation-paused pausa y animation-fade permite crossfade. No reinicies clips en cada pose.
- `scene.app`/`scene.engine` son null antes de iniciar y tras parar. Un reinicio crea instancias nuevas: conecta listeners de motor dentro de cada `ar-ready` si los necesitas.
- `scene.stop()` libera escena, renderer, modelos y cámara; el siguiente start reconstruye los targets desde HTML. `engine.stop()` tiene alcance distinto y elimina targets de una instancia programática.
- Eventos DOM: targetFound, targetLost, targetVisibility y trackingQuality llevan el payload del motor en `event.detail`. ar-pose lleva ARPose; ar-error lleva Error; ar-status lleva `{message}`; modelLoaded lleva `{animations}`.
- ar-ready significa contenido/configuración preparados, no que se haya detectado el marcador o verificado un plano. ar-slam lleva SurfaceTransitionResult y puede requerir escaneo o selección.
- mode="slam" usa optical-flow por defecto y no permite targets de imagen dentro. Para transición desde imagen utiliza una escena de imagen con atributo slam.
- keyframe-correction es experimental y está desactivado por defecto. La comparación sintética no demuestra mejora general de deriva: no lo actives automáticamente como una optimización garantizada. Las hipótesis de relocalización débiles necesitan confirmación temporal.
- Con backend auto/webxr en modo SLAM se prepara contenido y se ofrece un segundo botón para pedir XR desde un gesto. No esperes una descarga y después afirmes que se conserva la activación transitoria.
- El standalone incluye los recursos del motor. Las imágenes y modelos se resuelven respecto al HTML. Una URL pública requiere alojar el JS en un servidor accesible para los proyectos que lo usen.
- En ESM las etiquetas se registran explícitamente con `registerARComponents({assetBase})`. Tipos: ARSceneElement, ARModelElement, ARComponentsOptions.

## Cuándo utilizar código programático

Parte de [la aplicación programática](programmatic.md) si el usuario lo pide o la capacidad necesita esa API. No uses un `app` suelto en un ejemplo declarativo; obtén `scene.app` cuando exista, o crea tú una escena programática con propiedad de recursos clara.

- `engine.onPose(callback)` recibe `(matrix, pose)`. No existe `engine.on('pose',...)`.
- Los únicos nombres de `engine.on(...)` son targetFound, targetLost, trackingQuality, targetVisibility.
- loadImageTarget reemplaza todos por default; addImageTarget(id,source,options) es aditivo. Espera configuración secuencialmente.
- loadTarget/addTarget consumen WART .dat; no aceptan formatos de otros SDKs.
- La fachada utiliza enableSLAM. No inventes engine.switchToSLAM, disableSLAM, loadModel o setMarker.
- ThreeARScene actualiza modelos registrados. Solo con renderer propio llama a model.update(deltaSeconds).
- ThreeARVideo.setSource no reproduce automáticamente; play puede necesitar gesto y rechazar.
- A-Frame se registra con registerAFrameComponent, registerAFrameModelComponent y registerAFrameVideoComponent. El componente se llama my-ar-tracker.

## Precisión y verificación

Diagnostics es opt-in y descarga JSON local; no guarda frames/mapas/matrices/URLs/IDs de cámara. User-agent y metadatos declarados sí se exportan. No llames jitter físico a poseStepTranslation/Rotation ni FPS de GPU al intervalo del loop. LIBRARY_VERSION/BUILD identifican código, no una certificación. En pruebas de dispositivo usa el protocolo común iOS/Android y mantén pendientes las plataformas sin datos físicos. Webdriver se etiqueta automatizado; una casilla manual no prueba hardware.

Placement manual exige una propuesta reciente; confirmPlacement no debe escribir una identidad ni cambiar worldMatrix. En WebXR la selección se realiza dentro de la sesión; no inventes soporte universal de DOM overlay. El alojamiento público está pospuesto: genera artefactos locales sin publicar ni crear una web hasta que el usuario lo solicite.

No prometas 60 FPS, tracking perfecto, soporte universal de WebXR, suelo semántico, malla completa, oclusión del mundo ni metros absolutos sin referencia física. WebKit automatizado no equivale a Safari físico en iPhone.

Retener contenido no es anclarlo. No uses identidades como detección, desplazamiento de píxeles como traslación 3D ni un mapa importado como pose actual: necesita relocalizarse. Matrices columna mayor, diestras, WebGL: `matrix = viewMatrix * worldMatrix`; no repitas la conversión de OpenCV.

Consulta [las firmas generadas](api-generated.md), [api.json](api.json), [verificación](verification.md) y dist/types. Entrega rutas concretas, HTML ejecutable, explicación de recursos y lo realmente probado. No atribuyas pruebas sintéticas a hardware físico.

Usa `/llms.txt` para descubrir guías y `/llms-full.txt` para el manual consolidado. `docs/archive/` solo contiene material histórico y no define la API actual.

Para investigar saltos del modelo, consulta tracking.stages y tracking.paths en el diagnóstico actualizado. processingMs es la duración del ciclo de cámara/consumidor, no CPU pura del Worker; renderLoopMs no es FPS GPU. No atribuyas el coste a MB del GLB ni extrapoles los benchmarks sintéticos de NFT a iPhone/Android o a odometría sin marcador. El motor reutiliza descriptores verificados con fallback completo; el usuario no tiene que habilitar esta optimización ni regenerar targets.

El tracker admite 12–23 inliers fiables sin redetectar automáticamente por cantidad. Consulta flowSparseReliable, weakDistribution/weakReprojection/weakRetention, cacheConflicts y redetectDeadline. No describas una verificación de caché omitida/fallida como confirmación, ni prometas ausencia de deriva. Sigue existiendo revisión global a 24 frames o 1000 ms desde el último intento.

El SDK actual acelera Hamming mediante un kernel WASM exacto propio embebido; no es matching aproximado ni reduce el número de descriptores. Verifica exactMatchingCalls/opencvMatchingCalls y build en el diagnóstico. No añadas scripts ni archivos WASM externos para activarlo; no requiere atributos nuevos ni recompilar el marcador. Conserva resolución, ratio/distancia y filtros de pose. Las mediciones de Node son locales y no garantizan FPS móviles.

En device-tests las selecciones se aplican automáticamente antes de iniciar. Para SLAM independiente usa Probar SLAM sin marcador o modo Odometría sin marcador; Imagen → odometría exige marcador al comienzo. WebXR solicita sesión con un segundo gesto Activar SLAM. Comprueba el build mostrado antes de comparar teléfonos: los informes aportados el 10/11/2026 todavía eran 7e52a3fa6b95a911 y no probaban el matcher exacto posterior. No presentes esos datos como fallo de la versión nueva ni como validación de SLAM físico.

En device-tests una diferencia de build es un aviso persistente cuando el SDK mantiene las APIs requeridas; no requiere confirmación ni desactiva por sí sola la cámara. Distingue esa advertencia de un SDK ausente/incompatible, inicio en curso o rechazo de permisos del navegador.

La escena pide cámara antes de descargar GLB; una carga fallida cierra el stream. ar-ready mantiene su significado de preparación completa. device-tests no intercepta clicks del botón de la escena ni desactiva sus botones superiores durante la carga. SDK ausente se presenta como error accionable, sin afirmar AR activo. No atribuyas una incidencia de móvil a su URL sin comprobar el caso.

Las recetas 14–25 usan exactamente ../dist/webar-facil.min.js y ../assets/marcador.jpg (marcador2.jpg para el segundo). En el repositorio Vite resuelve /examples/dist a /dist; al empaquetar se adapta la ruta del SDK. Respeta los HTML 01–13 editados por el usuario. La lista de recursos y la estructura portátil están en examples/PRUEBAS/README.md.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
