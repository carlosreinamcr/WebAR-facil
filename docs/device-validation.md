# Aceptación en dispositivos físicos

Para probar la integración recomendada utiliza `examples/declarative.html` y `examples/declarative-slam.html` mediante HTTP/HTTPS. `index.html` conserva controles programáticos de diagnóstico; sus campos no son pasos obligatorios para una aplicación declarativa. El protocolo físico siguiente aplica al mismo motor de visión en ambas integraciones.

Estado: el agente no ejecutó el protocolo en hardware físico. Se recibieron informes de imagen declarados por el usuario para iPhone y Android con un SDK anterior; ver evidencia parcial al final. Las pruebas automáticas y la emulación no sustituyen estos resultados. No publicar una certificación de 60FPS o precisión métrica universal con datos de escritorio.

## Matriz mínima

Registrar modelo, SO, versión exacta de navegador, orientación, lente usada, resolución real y calibración. Cubrir Android con WebXR, Android sin WebXR, iPhone/iPad con fallback y al menos un móvil de prestaciones limitadas. Probar también Chrome/Edge de escritorio donde haya cámara trasera seleccionable. Detectar capacidades en ejecución; no decidir por user-agent.

| Prueba | Procedimiento | Evidencia requerida |
| --- | --- | --- |
| NFT | Tres imágenes distintas, ancho físico medido, marcador >=150px de ancho en análisis; varias distancias e inclinaciones | Tiempo de primera detección, tasa de detección, inliers y error de reproyección |
| Escala | Cubo con dimensiones conocidas sobre imagen impresa sin reescalar | Diferencia de tamaño y posición frente a referencia física |
| Estabilidad | Cámara y marcador inmóviles durante 60s | Jitter en píxeles y orientación; guardar vídeo sin datos sensibles |
| Recuperación | Ocluir marcador, salir del encuadre y volver; movimiento rápido y blur | Tiempo y tasa de recuperación; ausencia de poses falsas |
| Luz | Interior iluminado, penumbra, reflejos y luz variable | Intervalos de tracking/lost, degradación explicable |
| Fallback | Traslación lateral con textura; rotación pura; superficie uniforme; personas en movimiento | Inicialización solo con evidencia suficiente; estado initializing/lost en degeneración |
| Transición local | Marcador inmóvil, mover cámara, esperar mapa listo y retirar marcador | Continuidad de pose y estabilidad sobre puntos del entorno |
| Transición XR | Dispositivo con camera-access, luego sin esa feature | Preservación con observación sincronizada o recolocación explícita; nunca conservar pose ficticia |
| Lifecycle | Denegar permisos, revocarlos, ocultar página, bloquear pantalla, rotar, salir de XR y reiniciar | Cámara liberada; callbacks/Workers detenidos o suspendidos; recuperación controlada |
| GPU | Forzar pérdida de contexto si es posible | Restauración y reinicio sin escena ni stream huérfanos |
| Sostenido | 2–5 minutos por dispositivo y configuración | Percentiles de latencia, FPS de poses/rAF/render por separado, memoria disponible y degradación temporal |
| Persistencia | Ocluir 200ms, luego 2s; alternar `keepContentOnLost` durante la pérdida | Found/lost una sola vez por transición; última pose retenida sin simular tracking; stop siempre oculta |
| Animación y vídeo | GLB animado y MP4 en bucle, con el marcador visible y oculto | La reproducción avanza sin recarga, pausa ni rebobinado causados por tracking |
| Chroma key | MP4 verde/azul, ajustar color/tolerancia, sujeto con bordes finos | Transparencia y spill, sujeto preservado, codec y gesto de reproducción en Safari |
| Multimarcador | Dos imágenes distintas simultáneas, ocultar cada una por separado; subir progresivamente hasta 8 | ID y contenido correctos; sin visibilidad cruzada; latencia y calidad por marcador |
| Adaptación | Alejar el marcador hasta ocupar pocos píxeles y aumentar carga | Conservar detalle útil; evitar oscilaciones de resolución; informar baja calidad/carga sin inventar causas |
| Mapas | Exportar snapshot, reiniciar visión local, importar y volver a observar el entorno | Sin pose hasta relocalizar; revisión de mapa nueva; continuidad del espacio y del contenido tras reconocerlo |

## Criterios

Elegir umbrales antes de medir en los dispositivos objetivo. Como objetivos iniciales de producto: detección en menos de 1s en condiciones favorables, reproyección <3px, recuperación <2s y tracking sostenido sin crecimiento de recursos. Son objetivos pendientes de aceptación física, no resultados ya obtenidos.

La estabilidad métrica debe evaluarse con calibración y marcador medido. Si se usa proyección estimada, registrar esa limitación. La escala relativa de VO sin referencia física no se puede comparar directamente con metros. Para anclaje ambiental, comprobar deriva tras un recorrido y al regresar a una zona conocida.

## Herramientas

- `tools/calibrate.html`: tablero y captura ChArUco, JSON de intrínsecos y errores.
- `tools/compile.html`: marcadores locales y calidad de características.
- `tools/benchmark.html`: informe local, sin subir datos a servidores.
- `benchmarks/latest.json`: referencia de escritorio con entrada sintética y cálculo real.
- `tools/device-tests.html`: protocolo guiado común a iPhone y Android, registro por escenario y exportación local. [Uso y campos](diagnostics.md).
- `examples/declarative-placement.html`: anillo válido y confirmación manual en odometría.
- `npm run reports:summarize -- iphone.json android.json`: resumen por dispositivo/build, sin certificar automáticamente.

El navegador no proporciona una lectura portátil de temperatura ni una medida universal de memoria del proceso. Registrar calentamiento o throttling mediante herramientas del dispositivo, anotando el método. Separar cambios térmicos de diferencias de batería, ahorro de energía o carga de otras aplicaciones.

## Límites conocidos

Objetivos planos y rígidos; una imagen uniforme no es rastreable. VO local depende de paralaje, textura y una escena mayoritariamente estática. No hay cierre de bucle global; existen snapshots locales que necesitan relocalización, no anclas universales persistentes. Un plano visual inferior no garantiza suelo horizontal sin gravedad. Intrínsecos, lente y recorte deben corresponder a la captura. Raw Camera Access, anchors y WebXR requieren soporte y permisos específicos.

## Cobertura pendiente de hardware

| Plataforma física | Cobertura mínima | Estado inicial |
| --- | --- | --- |
| iPhone/iPad | Safari y navegador habitual; imagen, vídeo/gestos, fallback, transición, recuperación y sesión prolongada | Informe parcial de imagen del usuario con build anterior; SDK actual y SLAM pendientes |
| Android gama media | Navegador habitual; los mismos casos y native hit-test si se concede | Pendiente de informes físicos |
| Android de prestaciones limitadas | Imagen pequeña, carga, adaptación, vídeo y sesión prolongada | Informe parcial de imagen del usuario con build anterior; falta modelo exacto y SDK actual/SLAM |

No se elige backend por esa tabla: se consulta soporte real. El caso WebXR no compatible debe marcarse explícitamente, sin convertirlo en éxito. La herramienta no inventa modelo exacto ni versión del navegador a partir del user-agent; anótalos. Mantén separados navegador/SO/build del SDK y los resultados de emulación. La casilla físico es una declaración del operador, no una verificación independiente.

Marcar cada dispositivo como `pendiente`, `aprobado con límites` o `falló`, vinculando su informe. La ausencia de un dispositivo nunca cuenta como aprobación.

En `tools/device-tests.html`, el botón **Iniciar cámara** aparece antes del formulario y lleva al visor. También puedes iniciar desde **Iniciar AR**, en la barra superior de la escena. Con `gestures`, los toques dentro del visor manipulan contenido sin desplazar la página; fuera del visor puedes seguir desplazando el formulario.


## Informes aportados el 10 de noviembre de 2026

Se revisaron dos registros declarados por el operador como físicos: iPhone 17 Pro/Safari (7.51 s, 40 frames perfilados) y Android descrito como de prestaciones bajas (64.76 s, 35 frames perfilados, sin modelo exacto ni versiones declaradas). Ambos usaban build 7e52a3fa6b95a911, modo image y backend auto, con hasta 490102 triángulos. No ejecutaban el matcher WASM exacto introducido después. No se conservan aquí las capturas crudas ni identificadores privados.

| Medida en la captura anterior | iPhone | Android |
| --- | --- | --- |
| Matching medio | 92.33 ms | 993.52 ms |
| Worker medio | 133.80 ms | 1339.56 ms |
| Lectura de cámara media | 6.80 ms | 74.30 ms |
| Consulta immersive-ar | false | true |

En Android, los 35 frames hicieron búsqueda completa y los 35 vencieron el plazo de revisión: el procesamiento superaba 1 s incluso en su mínimo. Esto explica una realimentación de coste en esa versión; se necesita repetir con el matcher actualizado antes de atribuir mejoras al cambio. También hay costes de ORB (177.97 ms de media) y lectura. La captura de iPhone es demasiado corta para aceptación sostenida. Los flags de desenfoque/movimiento son heurísticos, no causas confirmadas.

El usuario no pudo probar SLAM desde la herramienta. Se corrigió la selección para aplicarse automáticamente y se añadió Probar SLAM sin marcador, guía por modo y comprobación del build antes de pedir cámara. La regresión automatizada verifica arranque óptico sin targets ni peticiones de marcador, vuelta a imagen y solicitud nativa hit-test con gesto, simulando el rechazo de la sesión. No sustituye una sesión XR física ni valida la calidad del anclaje.

Repetir 30–60 s con SDK actual, mismo modelo/marcador, anotando dispositivo y versiones. Probar por separado imagen, óptico sin marcador y WebXR si se concede. En estos registros, el iPhone declaró que no tenía XR; el Android declaró immersive-ar compatible, pero todavía debe verificarse la sesión real. No elegir backend basándose solo en el nombre del teléfono.

Corrección de acceso a cámara: una diferencia entre el build esperado por la herramienta y el del SDK compatible genera aviso, sin impedir iniciar. En pruebas Chrome/WebKit con viewport móvil se verifican solicitud solo tras toque y recuperación de botones después de rechazar permisos. Los permisos se simulan en esa regresión; no representa una concesión real en un teléfono.

La regresión de acceso a cámara incluye una descarga GLB retenida: se observa getUserMedia y vídeo activo antes de liberar el modelo, sin solicitudes duplicadas. Se prueban el botón superior y el nativo del componente. Los mensajes de inicio/error se muestran antes del formulario. La prueba usa cámara sintética y no permite afirmar que un problema en un teléfono físico esté resuelto sin repetirlo allí.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
