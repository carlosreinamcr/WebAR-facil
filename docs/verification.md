# Verificación de la implementación

Resultados locales de la entrega actual:

El recolector XAMPP opcional tiene seis verificaciones explícitas en tests/integration/local-diagnostics.test.mjs: validación/token/origen y privacidad, secuencias fuera de orden, envío periódico y panel, cola sin red entre páginas, A-Frame por HTTPS, avance al siguiente ejemplo y captura de errores de permiso en WebKit. Se ejecutan contra Apache/PHP real con cámara sintética o permiso denegado simulado; los datos quedan etiquetados como automatizados. No forman parte de npm test porque requieren una instalación XAMPP activa.

- `npm run build`: TypeScript estricto, ES/IIFE, script standalone con Three.js, core sin renderer, Workers estáticos y declaraciones ESM.
- `npm test`: **68 pruebas aprobadas**, con visión real, cámara/XR simulados, perfiles de captura, presupuesto vertical/horizontal, adaptación por carga sin degradar marcadores débiles ni cambiar dimensiones del mapa, autoenfoque pendiente sin bloqueo, cancelación de play/foco, diagnóstico acotado, privacidad del informe, colocación fresca y clasificación de evidencia declarada.
- `TEST_WEBKIT=1 node --test --test-skip-pattern="Abrir con file" --test-concurrency=1 tests/browser/browser.test.mjs tests/browser/declarative.test.mjs`: **36 pruebas HTTP aprobadas**, con regresiones Chrome/WebKit y herramientas móviles; el caso de navegación local se omite en esta ejecución. Android/Chrome con viewport/tacto móvil registra cámara sintética y exporta. Se comprueba reconocimiento y diagnóstico después de cambiar entre ahorro y auto. Otra prueba usa getUserMedia y play nativos de Chromium con su dispositivo virtual, sin reemplazarlos en JavaScript: verifica vídeo, estados, ambos botones, cierre de tracks y reinicio. En este WebKit de escritorio faltan getUserMedia/captureStream: se verifica el informe del error, no seguimiento iPhone. No se simula el SO ni se certifica hardware físico.
- `node --test tests/browser/pruebas.test.mjs`: **4 pruebas de integración aprobadas** para los 13 HTML fuente y empaquetados, inicio visible en móvil, recursos locales, GLB originales, traslación sobre plano, giro/pellizco, sustitución sin reiniciar, CanvasTexture reutilizada, MP4, iluminación y mapa exportado/recuperado tras reiniciar con relocalización real. Usa OpenCV real y cámara sintética con una superficie geométrica; no certifica hardware físico.
- `node --test tests/browser/pruebas-extra.test.mjs`: **4 pruebas de integración aprobadas** para 14–25: rutas y recursos fuente/distribución, multimarcador, clips reales, chroma vivo, archivos locales, retención, picking táctil, catálogo, transición óptica preservada, petición XR con rechazo simulado (sin certificar sesión física), comparaciones descargables y composición. A-Frame 1.8.0 se ejecuta realmente con wrappers, render y reinicio, sin pedir orientación; cámara sintética. Las 8 pruebas de ambas colecciones se ejecutaron juntas, conservando 01–13.
- `npm run check:package`: tarball instalado en un consumidor independiente; tipos NodeNext estrictos con `skipLibCheck: false`, core y wrappers; API tipada de eventos, vídeo, escena, GLB y multimarcador; importación del core en Node.
- `npm run benchmark`: 630 frames sintéticos con OpenCV real, 580 poses tras inicialización; mediana aproximada **41.1ms**, p95 **79.1ms**, heap WASM estable en **32MiB**. [Comparación de trayectoria y opción experimental](odometry-validation.md). No demuestra mejora general de deriva ni rendimiento móvil.

## Continuidad, calidad y marcadores

La regresión sostenida exige al menos 42/44 observaciones visibles aceptadas, error de registro de las cuatro esquinas <8px en las poses brutas aceptadas y recuperación tras desaparición total. Hay pruebas adicionales de inclinación cercana a 60°, cambios bruscos de posición y compilación de vistas acortadas, sin aportar intrínsecos manuales.

`targetFound`/`targetLost` no se repiten por cada frame. Durante incertidumbre o retención no se emiten poses inventadas. La prueba de navegador comprueba que el contador de poses se detiene mientras la transformación visible se conserva y la animación GLB continúa. Cambiar `keepContentOnLost` modifica visibilidad sin recargar contenido; detener la cámara oculta.

La prueba multimarcador transfiere un solo RGBA, obtiene dos poses con la misma proyección, verifica posiciones independientes y pierde cada ID por separado. La API admite hasta 8; no se ha certificado rendimiento con 8 en móviles. Los diagnósticos de blur/textura/tamaño/movimiento/carga son heurísticos, no una clasificación infalible.

## Vídeo y modelos

El MP4 H.264 de prueba es original, generado mediante MediaRecorder a partir de un canvas. Se decodifica en Chrome y WebKit. La prueba GPU comprueba píxeles: el verde se elimina, el sujeto rojo se conserva y desactivar chroma restaura el fondo. Otra prueba comprueba que durante pérdida del marcador no hay recarga ni pausa y siguen aumentando los frames de vídeo.

Los GLB normal, Draco y Meshopt incluyen textura y animación reales. Se comprueban tamaño, base, transformación animada, textura, disposición de geometría, sustitución en escena y cancelación. Los componentes A-Frame se verifican mediante su contrato de registro/ciclo de vida y objetos Three.js; no se presenta esto como una certificación de todas las versiones de A-Frame.

## Mapas y límites físicos

Los snapshots se prueban tanto en el backend como a través del Worker: no hay pose guardada publicada al importar, el mapa debe relocalizarse, mantiene geometría/escala y rechaza datos corruptos. La exportación contiene geometría y descriptores, no frames de cámara.

No se midió temperatura ni se utilizaron cámaras físicas en estas verificaciones. WebKit de Playwright no equivale a certificar Safari en un iPhone. Raw Camera Access, WebXR y anclajes nativos requieren hardware real. El fallback es odometría con mapa local, sin cierre de bucle global ni fusión inercial. El protocolo pendiente está en `device-validation.md`.

La herramienta tools/device-tests.html usa el mismo protocolo para iOS y Android y no aprueba por temporizador. El resumen distingue datos automáticos de declaraciones físicas, mantiene pendiente la plataforma sin evidencia y no genera certificaciones. Los fixtures de validación se guardan solo en tests/generated para no confundirse con resultados del operador.

## Documentación

La documentación tiene una comprobación independiente de enlaces locales, sintaxis de bloques, correspondencia entre exports documentados y declaraciones reales, y un consumidor TypeScript estricto de las recetas. `npm run docs:test-browser` prueba el lector en desktop/móvil, búsqueda, ausencia de desbordamiento y el primer HTML literal de la guía de inicio: compila una imagen, sigue el marcador mediante OpenCV real con cámara sintética, carga un GLB animado y detiene la sesión declarativa. Conserva además las alternativas programáticas como regresiones. Esto tampoco certifica una cámara física.

El empaquetado verifica que el tarball incluya manual, contrato JSON, textos para IA, sitio estático y el ejemplo documentado. Estas comprobaciones no sustituyen las pruebas de tracking y hardware descritas arriba.

## HTML declarativo

Las pruebas específicas sirven el HTML y el SDK desde dos servidores HTTP de distinto origen, manteniendo CORS del navegador. Verifican compilación/detección real, descarga de OpenCV y Draco respecto al script remoto, retención, transformaciones, selección de animación, reinicio, disposición al retirar la etiqueta, cancelación de arranque y errores de configuración. Otra prueba inicia el modo óptico sin targets y comprueba su parada; esto no demuestra estabilidad de un plano físico sin marcador ni una certificación de iPhone.

La suite declarativa específica también comprueba los cinco HTML reales del repositorio: los controles aparecen con el bundle actual y el texto de respaldo permanece visible si se sirve un SDK antiguo o un 404. Abrir con file:// presenta instrucciones y no crea una cámara al pulsar Iniciar. La suite declarativa incluye además visibilidad de inicio en viewport móvil y entrada táctil nativa de Chrome: selección, arrastre, pellizco, bloqueo de scroll/zoom dentro del visor y restauración al detener.

Las nuevas regresiones verifican que GLB, tamaño, jerarquía y targets cambien conservando la misma instancia de motor y MediaStream; que los archivos fallidos conserven contenido anterior; y que vídeo/chroma no se recarguen al modificar parámetros. Se verifican pausa, velocidad, finalización y crossfade con dos clips, y raycast/arrastre/pellizco acotado mediante Pointer Events. El MP4 original incluido puede regenerarse con generate:video.

## Perfil y caché NFT

Se verifican perfiles numéricos, copias de diagnóstico sin memoria compartida, uso de caché/global en Worker real, rechazo de textura ajena y reinicio de caché entre sesiones. El benchmark de imagen conserva 316/316 poses esperadas con recuperación tras oclusión; ver [resultados y límites](camera-performance.md).

La decisión geométrica se comprueba con soportes repartidos, concentrados y colineales; error, retención, plazos y conflicto de poses. Workers WASM reales verifican un marcador pequeño con 16 puntos y una referencia de 23 descriptores, manteniendo el límite original de 8 px de error de esquinas, pérdida real y recuperación.

## Matching Hamming exacto

Pruebas diferenciales contra OpenCV verifican listas ordenadas, aleatorios/perturbados, límites de ratio y distancia, empates, unicidad, vistas con offset, crecimiento y límites de memoria, compilación no disponible y reproducibilidad WAT. Chrome y WebKit ejecutan un Worker NFT real con el kernel nuevo a partir de un canvas, sin exigir getUserMedia para esa prueba. El benchmark completo conserva detecciones, recuperación y los errores de esquinas de la versión anterior en las fixtures comparadas.

La herramienta móvil aplica selectores antes de ambos botones de inicio, arranca óptico sin targets/peticiones de marcador, vuelve a imagen y pide immersive-ar con hit-test desde un gesto dedicado. Un test móvil de distribución verifica script versionado y advertencia persistente ante builds distintos, permitiendo getUserMedia tras un toque cuando el SDK sigue siendo compatible. Chrome/WebKit verifican que un rechazo de permisos no deja bloqueados los botones de reintento. La petición XR se simula y rechaza expresamente: no se certifica una sesión nativa en hardware.

Arranque móvil: se retiene una descarga GLB, se observa cámara/vídeo antes de liberarla, se comprueba activación del usuario en las dos solicitudes legítimas y se evitan duplicados. Un fallo de contenido posterior cierra el stream. Se prueban respuesta de botones con SDK ausente, aviso de builds distintos y reintento tras rechazo de permisos. En esta revisión se ejecuta la regresión HTTP; la prueba histórica de file:// se conserva aparte.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
