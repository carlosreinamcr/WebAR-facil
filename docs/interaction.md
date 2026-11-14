# Vídeo, gestos, animaciones y contenido en vivo

Estas capacidades utilizan el mismo standalone del [inicio](getting-started.md). No necesitan otro renderer ni otra cámara. Los atributos de contenido se aplican en vivo; los ajustes de captura siguen requiriendo reiniciar.

## Recetas completas para copiar

La [galería PRUEBAS](../examples/PRUEBAS/index.html) contiene 25 HTML independientes con recursos locales y comentarios. Los ejemplos [02](../examples/PRUEBAS/02-gestos-marcador.html) y [08](../examples/PRUEBAS/08-gestos-slam.html) añaden movimiento sobre el plano mediante Raycaster/Plane: el modo Mover es código de aplicación. El atributo gestures del SDK sigue controlando selección, giro y pellizco. No se añade un atributo de traslación inexistente ni se escribe en la matriz del anchor.

Los ejemplos [04](../examples/PRUEBAS/04-texto-marcador.html) y [10](../examples/PRUEBAS/10-texto-slam.html) usan CanvasTexture/Sprite para mostrar texto real en la escena; [06](../examples/PRUEBAS/06-iluminacion-marcador.html) y [12](../examples/PRUEBAS/12-iluminacion-slam.html) mueven una luz direccional alrededor del contenido. Son extensiones mediante scene.app y Three.js incluido en el standalone, no nuevas etiquetas de la biblioteca. Se liberan sus callbacks, texturas y materiales al detener.

## MP4 y chroma con HTML

```html
<webar-scene keep-content-on-lost>
  <webar-target src="./marcador.jpg" target-id="poster">
    <webar-video src="./video.mp4" width="0.3" orientation="upright" chroma-key key-color="#00ff00" muted loop></webar-video>
  </webar-target>
</webar-scene>
```

`webar-video` puede ir dentro de un target o directamente en una escena SLAM. [Ejemplo completo con MP4 original incluido](../examples/declarative-video.html).

| Atributo | Inicial y significado |
| --- | --- |
| `src` | URL del vídeo relativa al HTML |
| `width` | 0.2; ancho positivo |
| `orientation` | `flat` sobre XZ o `upright` vertical; inicial flat |
| `muted`, `loop`, `autoplay` | true; escribir `false` para desactivar |
| `chroma-key` | false; presente activa transparencia por color |
| `key-color` | #00ff00 |
| `similarity`, `smoothness`, `spill` | 0.12, 0.08, 0.3 |
| `position`, `rotation`, `scale` | Igual que en modelos; rotación en grados |

Similarity y spill van de 0 a 1; smoothness es >0 y <=1. Cambiarlos no recarga el vídeo. Tampoco lo hacen width, orientación o transformaciones. La compatibilidad MP4 depende del codec/dispositivo: prueba el archivo real.

La biblioteca intenta autoplay cuando se permite. Si se bloquea, emite `videoPlayBlocked` y muestra **Reproducir vídeos**; ese botón llama a play dentro del gesto. `autoplay="false"` evita el intento y presenta ese botón; también puedes usar uno propio con `element.play().catch(...)`. `element.pause()` pausa; `element.video.videoElement` expone el elemento nativo mientras está cargado.

## Gestos optativos

```html
<webar-scene gestures min-scale="0.1" max-scale="20">
  <webar-target src="./marcador.jpg">
    <webar-model src="./Kai.glb" size="0.3" animation="none"></webar-model>
  </webar-target>
</webar-scene>
```

Solo actúan cuando se toca geometría visible mediante raycast. Arrastrar horizontalmente gira sobre Y; pellizcar escala; el giro de dos dedos también modifica Y. Un toque corto sin arrastre emite `ar-select`. No es traslación 3D ni reconocimiento de manos.

`gestures` puede habilitarse por contenido o heredarse de escena; `gestures="false"` excluye un elemento. Los límites son magnitudes de escala: 0.1 y 100 por defecto. Se conserva la relación entre componentes XYZ. El estado se escribe en los atributos scale/rotation, por lo que una lectura posterior del HTML refleja el gesto.

Con gestos activados, todo el visor (incluidos los márgenes del canvas) reserva el toque para AR: no desplaza ni amplía la página. Empieza tocando el modelo visible para seleccionarlo; después arrastra o añade el segundo dedo para escalar. Los botones y el resto del documento siguen siendo utilizables y desplazables. Al detener se restaura la interacción normal. No necesitas desactivar el zoom de toda la página.

Los gestos usan Pointer Events sobre el visor, con raycast respecto al canvas en tracking de imagen y fallback óptico. Se deshabilitan durante WebXR inmersivo: allí la interacción requiere eventos XR específicos. Se liberan capturas y listeners al detener la escena. Para cambiar la habilitación/límites de elementos activos llama a `await scene.refresh()`.

`ar-gesture.detail` contiene `{scale: [x,y,z], rotation: [x,y,z]}` en grados. `ar-select.detail` contiene `{element, object}`. [Ejemplo de gestos y cambios de modelo](../examples/declarative-interactive.html).

## Animaciones sin boilerplate

```html
<webar-model src="./Kai.glb" animation="Caminar" animation-loop="once" animation-speed="1.5" animation-fade="0.25"></webar-model>
```

| Atributo | Contrato |
| --- | --- |
| `animation` | Nombre exacto, índice desde 0 o none; ausente usa el primer clip si existe |
| `animation-loop` | repeat (inicial), once o pingpong |
| `animation-speed` | Positivo, inicial 1 |
| `animation-repetitions` | Entero positivo; ausente repite sin límite salvo once |
| `animation-fade` | Segundos de transición entre clips; 0 a 10, inicial 0 |
| `animation-paused` | Pausa; quitarlo continúa |

Once mantiene la última pose al terminar y emite `animationFinished` con `{name}`. Cambiar velocidad, pausa o bucle no reinicia el clip. Cambiar animation sí selecciona/reinicia, aplicando el crossfade configurado si corresponde. No lo hagas en cada pose del tracker.

La etiqueta ofrece `playAnimation(nameOrIndex, options?)`, `pauseAnimations()`, `resumeAnimations()` y `stopAnimations()`. La clase ThreeARModel añade `configureAnimation(options)`, `animationState` y `onAnimationFinished(listener)`. En código, las opciones usan `loop`, `speed`, `repetitions`, `crossFadeSeconds` y `clampWhenFinished`.

## Cambiar archivos sin cerrar cámara

```js
const model=document.querySelector('webar-model');
model.setAttribute('src','./otro.glb');
await model.updateComplete;
model.setAttribute('size','0.8'); // Ajusta sin descargar otra vez.

const video=document.querySelector('webar-video');
video.setAttribute('src','./otro.mp4');
await video.updateComplete;
```

El código presupone escena iniciada y elementos existentes. El último src solicitado prevalece; una carga anterior se cancela/descarta. Si falla descarga/formato/decodificación, se conserva el contenido anterior. El vídeo anterior sigue reproduciéndose mientras se prepara el nuevo; un nuevo archivo comienza una reproducción nueva. Las promesas rechazan en caso de error y también se informa `ar-error`. No se detiene cámara, renderer ni mapa por cambiar un modelo/vídeo.

## Añadir o retirar contenido y targets

```js
const scene=document.querySelector('webar-scene');
const model=document.createElement('webar-model');
model.setAttribute('src','./otro.glb');
scene.querySelector('webar-target').append(model);
await scene.refresh();
// Más adelante:
model.remove();
await scene.refresh();
```

Un MutationObserver sincroniza automáticamente jerarquía y atributos de targets. Para esperar explícitamente un cambio del DOM, usa `await scene.refresh()`; leer scene.updateComplete antes de que corra el observer podría devolver la operación anterior. El evento `contentUpdated` indica sincronización de la configuración, no una detección nueva. La adición/carga y retirada se serializan y liberan sus recursos.

Cambiar src/physical-width/target-id de un target recompila o recarga sus datos sin reabrir la cámara; el seguimiento puede necesitar recuperar ese marcador. Las actualizaciones son por operación, no una transacción atómica de todos los targets. Usa IDs explícitos y conserva el límite de 8 imágenes diferentes. Se permite retirar todos y añadir otros después.

Durante SLAM puedes cambiar modelos/vídeos, pero no los targets de imagen: cambia esos targets al volver al modo imagen. Para cambiar mode, backend, calibración, rutas de runtime o configuración de cámara sigue siendo necesario parar y reiniciar. Las actualizaciones de contenido no emiten ar-ready otra vez: usa modelLoaded, videoLoaded o contentUpdated.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
