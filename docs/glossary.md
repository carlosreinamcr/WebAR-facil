# Glosario

| Término | Significado en esta librería |
| --- | --- |
| HTML declarativo | Etiquetas webar-scene/target/model que configuran la aplicación sin montar manualmente el motor |
| Web Component | Elemento HTML registrado por el SDK; no requiere A-Frame |
| API programática | Clases y callbacks para control explícito; alternativa avanzada |
| Target / marcador | Imagen de referencia conocida; no requiere borde negro |
| NFT | Seguimiento mediante características naturales de una imagen |
| ORB / FAST / descriptor | Detección y representación compacta de características visuales |
| LK / optical flow | Seguimiento de puntos entre frames mediante Lucas–Kanade |
| WASM | Runtime de cálculo compilado a WebAssembly |
| Worker | Hilo de procesamiento independiente de la UI |
| WART / .dat | Formato binario versionado de marcador de esta biblioteca |
| Pose | Transformación aceptada, con backend, tiempo, escala y matrices |
| ModelView | Transformación de objeto al espacio de cámara |
| Intrínsecos | Resolución de referencia, focal y centro óptico; distorsión opcional |
| Backpressure | No enviar otro frame mientras el consumidor sigue ocupado |
| Tolerancia de pérdida | Intervalo antes de confirmar la desaparición del target |
| Retención | Mantener visible la última transformación sin nueva medición |
| Hit-test | Consulta de intersección del sistema XR con superficies del entorno |
| Ancla | Transformación situada en un marco espacial; no equivale a retención |
| VO / odometría visual | Estimación de movimiento a partir de imágenes |
| SLAM | Localización y construcción de mapa; aquí el fallback ofrece un mapa local |
| Paralaje | Cambio de posición aparente por traslación de cámara que aporta profundidad |
| Keyframe | Observación seleccionada para mantener geometría y descriptores del mapa |
| Relocalización | Reconocer el lugar en un mapa para recuperar una pose válida |
| Deriva | Error acumulado de una trayectoria estimada |
| GLB | Contenedor binario de glTF; el wrapper requiere recursos autocontenidos |
| Draco / Meshopt | Compresión geométrica soportada por el cargador de modelos |
| Chroma key | Transparencia por comparación de color, calculada en GPU |
| Standalone | Bundle clásico que incluye Three.js y wrappers |


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
