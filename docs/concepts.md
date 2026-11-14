# Conceptos y coordenadas

## Lo que declaras en HTML

`webar-scene` describe una aplicación y administra una sola cámara/renderer. `webar-target` describe una imagen; sus hijos `webar-model` son el contenido asociado. En modo SLAM sin imagen los modelos van directamente dentro de la escena. Es la ruta de [inicio recomendada](getting-started.md).

Las clases y matrices de las siguientes secciones explican lo que la capa HTML gestiona internamente y permiten crear integraciones avanzadas. No tienes que crearlas manualmente para usar las etiquetas.

## Motor, target y contenido

Un `WebAREngine` administra una cámara y el modo de tracking. Un **target** es una imagen conocida y sus descriptores, identificada por un ID estable. El **contenido** es un objeto Three.js, modelo, vídeo o tu propia escena, asociado al ID por un wrapper. No es necesario crear un motor por objeto o por marcador.

`ThreeARScene` combina el motor con un renderer Three.js y gestiona fondo de cámara, proyección, grupos por ID, luces y actualización de medios. `WebAREngine` por sí solo no dibuja nada. `ThreeARGroup` permite usar un renderer propio.

La misma imagen repetida físicamente no genera varias instancias independientes. Utiliza imágenes diferentes e IDs diferentes para contenido independiente; el máximo actual es 8 targets.

## Estados de modo y estados de visibilidad

`EngineState` contiene `Idle`, `Camera`, `TrackingImage`, `TrackingSurface`, `Disposed`. Describe el modo de la sesión; `TrackingImage` no significa que el marcador esté visible en ese instante. Para eso existen `targetFound`, `targetLost`, `targetVisibility` y `trackingQuality`.

```text
Idle -> startCamera -> Camera -> cargar target -> TrackingImage
TrackingImage / Camera -> enableSLAM -> TrackingSurface
cualquier modo activo -> stop -> Idle
dispose -> Disposed (final)
```

El cambio a seguimiento espacial puede requerir escanear o seleccionar una superficie antes de entregar poses. No emitas tu propia pose identidad para simular que ya quedó anclado.

## Contrato de matrices

Todas son `Float32Array(16)`, columna mayor, sistema diestro normalizado para WebGL. La conversión desde coordenadas de OpenCV se aplica en el motor. **No vuelvas a invertir ejes** en el wrapper.

| Campo de `ARPose` | Significado |
| --- | --- |
| `matrix` | Objeto a cámara: `T_camera_object` (ModelView) |
| `worldMatrix` | Objeto a mundo: `T_world_object` |
| `viewMatrix` | Mundo a cámara: `T_camera_world` |
| `projectionMatrix` | Proyección de cámara, o `null` si no está disponible |

Relación: `matrix = viewMatrix * worldMatrix`. Para un objeto en una escena con cámara móvil usa `worldMatrix` y la inversa de `viewMatrix` para la cámara. Inyectar `matrix` en el objeto y además mover la cámara aplica la vista dos veces.

En image tracking el mundo se toma en el espacio de la cámara: `viewMatrix` es identidad. El plano del marcador sigue la convención de los wrappers: contenido plano sobre XZ y altura sobre Y. Para personalizar el pivot, añade un hijo al grupo de tracking; no escribas la posición local del grupo que recibe la matriz.

`ARPose.backend` es `image`, `webxr` u `optical-flow`. `scale` es `metric` o `relative`; la precisión de una escala métrica basada en marcador depende de que su tamaño físico sea correcto. `projectionSource` permite distinguir `estimated`, `calibrated` y `webxr`. El campo `engine.calibration` devuelve la calibración configurada, no todas las estimaciones internas por frame.

## Tiempo, render y propiedad de memoria

`onPose` se llama al tener una observación aceptada, no a 60 Hz fijos. Mantén el bucle de render y las animaciones separados del detector. Durante una pérdida tolerada se conserva la última transformación sin inventar observaciones nuevas.

`timestampMs` corresponde al reloj monotónico de captura de la aplicación, no al reloj de exposición físico del sensor. Los buffers enviados con `postMessage(..., [buffer])` se transfieren: quedan separados del hilo emisor. En la API de bajo nivel no reutilices el `ImageData` transferido.

## Limpieza

En la capa HTML, `await scene.stop()` destruye la escena interna y sus recursos. El siguiente `scene.start()` vuelve a construirla leyendo el HTML, incluidos los targets. Retirar la etiqueta de la página también la detiene. `scene.app` y `scene.engine` son nulos antes de iniciar y tras parar; registra callbacks de motor dentro de cada `ar-ready`, porque la instancia cambia al reiniciar.

En la API programática, el contrato es diferente:

`await engine.stop()` termina captura, tracking y XR y elimina targets, pero conserva la instancia y sus callbacks. Para reiniciar debes volver a añadir las imágenes. `engine.dispose()` es final. `await app.dispose()` libera también recursos gestionados por `ThreeARScene`. Los listeners retornan una función para desuscribirse. Consulta [recetas programáticas](recipes-programmatic.md) para navegación entre pantallas con esas clases.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
