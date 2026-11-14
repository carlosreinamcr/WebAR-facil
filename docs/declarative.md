# Aplicaciones con HTML declarativo

El bundle standalone registra Web Components automáticamente. Cámara, renderer, controles de inicio/parada, carga de modelo, compilación de imágenes, animación y limpieza quedan dentro de la biblioteca. Para una aplicación básica no necesitas escribir JavaScript ni cargar A-Frame. Empieza con [el HTML para tu propio sitio](getting-started.md); esta página es la referencia completa de etiquetas y también muestra las rutas específicas del repositorio.

## Cámara, captura y pantalla completa

El [ejemplo 27](../examples/PRUEBAS/27-pantalla-completa.html) activa ambos atributos en `<webar-scene fullscreen-view media-menu>`. El botón Iniciar AR pide pantalla completa cuando está disponible. En los demás navegadores el visor ocupa la ventana visible. Pulsa Sesión para recuperar el modal y detener la cámara.

El menú permite elegir Automática, Equilibrada, Alta o Ahorro. Activar la casilla de ahorro aplica el perfil de menor carga. Cambiar la calidad durante una sesión reinicia la captura y el tracking para renegociar la cámara. En SLAM vuelve a colocar el contenido después del cambio.

La foto y el vídeo incluyen la cámara web y el contenido renderizado. El micrófono se solicita al pulsar Grabar. El vídeo usa MP4 cuando el navegador admite esa salida, o WebM como alternativa. Cuando el archivo está listo, usa Guardar archivo para descargarlo al dispositivo. En iPhone también puedes usar Abrir archivo o Compartir para acceder a las opciones del sistema. Compartir aparece habilitado si el navegador acepta ese archivo en su hoja de compartir. La cámara nativa de una sesión WebXR inmersiva se gestiona desde el sistema.

El evento `ar-media` entrega `{file}` a aplicaciones que quieran añadir sus propias acciones locales.

## Ejemplo completo

Abre [la aplicación declarativa](../examples/declarative.html) con el servidor del proyecto. Este es su HTML real:

<!-- example:examples/declarative.html -->
```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="data:,">
  <title>WebAR declarativo</title>
  <style>body{margin:0}</style>
  <script defer src="../dist/webar-facil.min.js"></script>
</head>
<body>
  <webar-scene>
    <p role="status">Cargando WebAR… Si este mensaje permanece, comprueba que el script existe y es el build actualizado con componentes declarativos. Abre este ejemplo mediante HTTP/HTTPS: npm run dev y http://127.0.0.1:5173/examples/declarative.html. No uses file://.</p>
    <webar-target src="./assets/marcador.jpg" target-id="poster" physical-width="0.2">
      <webar-model src="./assets/Kai-WebAR-Facil.glb" size="0.2" rotation="0 180 0"></webar-model>
    </webar-target>
  </webar-scene>
</body>
</html>

```
<!-- /example -->

Para tu sitio, coloca `webar-facil.min.js` junto a tu `index.html`. Cambia el script a `./webar-facil.min.js`, la imagen a `./marcador.jpg` y el modelo a `./Kai.glb`. Los controles los crea la biblioteca al registrar las etiquetas.

## Si la página queda en blanco

Las etiquetas solo adquieren controles cuando carga el **standalone actualizado** y registra `webar-scene`. Un archivo JS anterior a esta integración puede cargar sin error de red y no registrar las etiquetas. Sustituye el bundle de tu sitio por el build actual y actualiza la caché del navegador.

| Ubicación del HTML | Ruta de script |
| --- | --- |
| `examples/declarative.html` del repositorio | `../dist/webar-facil.min.js` |
| HTML en la raíz del repositorio | `./dist/webar-facil.min.js` |
| HTML junto al bundle en una copia de `dist/` | `./webar-facil.min.js` |

Ejecuta `npm run dev` y abre `http://127.0.0.1:5173/examples/declarative.html`. Abrir con doble clic produce una URL `file://`, que no es un modo soportado para cámara/Workers. Comprueba en Network que la URL del JS responde con JavaScript y estado 200, no con un HTML de fallback.

El párrafo de carga de los ejemplos es contenido de respaldo: se ve si no se registra el componente y se oculta automáticamente cuando aparece su shadow DOM. Puedes conservarlo en tu app para evitar una página vacía incluso si falla la descarga del SDK. En consola puedes verificar `customElements.get('webar-scene')`: debe devolver una clase, no `undefined`.

## Opciones de escena

| Atributo de `webar-scene` | Valor por defecto y significado |
| --- | --- |
| `mode` | `image`; `slam` inicia el flujo espacial sin imágenes |
| `backend` | `auto` en imagen; `optical-flow` en modo SLAM |
| `slam` | Añade botón de transición de imagen a seguimiento espacial |
| `keep-content-on-lost` | Ausente: false; presente: conserva visualmente la última transformación |
| `loss-grace` | 500 ms de tolerancia de pérdida |
| `performance` | auto; perfiles auto, balanced, battery y quality; límites y comportamiento en cámara/rendimiento |
| `camera-width`, `camera-height` | Preferencias de captura del perfil; el navegador puede conceder otro tamaño |
| `analysis-width` | Ancho máximo del perfil: 640 en auto/balanced, 480 en battery, 960 en quality |
| `analysis-pixels` | Presupuesto total por frame: 307200 en auto/balanced; limita también la orientación vertical |
| `pixel-ratio` | 2; tope de densidad de renderizado (mínimo entre DPR del dispositivo y este valor positivo). 1 reduce píxeles sin cambiar resolución del tracker |
| `antialias` | true; false desactiva MSAA al crear el renderer |
| `fps` | 30 en auto/balanced/quality, 20 en battery; objetivo de captura/análisis, no garantía de rendimiento |
| `asset-base` | Opcional. En el standalone, definirlo activa la carga externa para esa escena. En ESM, se usa el directorio configurado al registrar |
| `opencv-url` | OpenCV integrado en standalone. Si se configura, se resuelve respecto a asset-base |
| `draco-path` | Draco integrado en standalone. Si se configura, se resuelve respecto a asset-base |
| `gestures`, `min-scale`, `max-scale` | Gestos opt-in; límites iniciales 0.1 y 100 |
| `scan-guide` | Marco animado mientras busca marcadores. Predeterminado `true`. |
| `surface-grid` | Cuadrícula de referencia sobre la propuesta de superficie. Predeterminado `true`. |
| `media-menu` | Menú opcional de perfiles de cámara, foto, vídeo con micrófono, guardado y compartir. |
| `fullscreen-view` | Visor que cubre la pantalla disponible y modal de sesión. |
| `keyframe-correction` | false; corrección local de odometría experimental, ver comparación y límites |
| `diagnostics` | false; registro local acotado y botón para descargar JSON |
| `placement` | auto o manual; manual exige confirmar una propuesta óptica reciente |

Las opciones booleanas admiten atributo vacío, `true` o `false`. La escena ocupa 100dvh por defecto; puedes cambiar su altura con CSS, por ejemplo `webar-scene {height: 75vh}`. Los controles y mensajes están arriba del visor dentro de su shadow root; no necesitas bajar hasta el final de la cámara para iniciar. El inicio requiere pulsar el botón para solicitar la cámara.

## Marcadores y contenido

`webar-target` recibe `src` (JPG/PNG o WART `.dat`), `target-id` y `physical-width` en metros. Si omites el ID, se generan `target-0`, `target-1`, etc., según el orden del HTML. `physical-width` vale 0.2. La imagen se compila automáticamente; no necesitas suministrar JSON.

Puedes declarar hasta 8 imágenes diferentes y colocar modelos dentro de cada target. No repitas IDs ni uses la misma imagen para simular múltiples instancias físicas. No hay un motor/cámara por etiqueta de modelo.

```html
<webar-scene keep-content-on-lost>
  <webar-target src="./producto-a.jpg" target-id="a">
    <webar-model src="./producto-a.glb" size="0.3"></webar-model>
  </webar-target>
  <webar-target src="./producto-b.jpg" target-id="b">
    <webar-model src="./producto-b.glb" size="0.2"></webar-model>
  </webar-target>
</webar-scene>
```

## Tamaño, giro, posición y animación

| Atributo de `webar-model` | Contrato |
| --- | --- |
| `src` | GLB autocontenido normal, Draco o Meshopt |
| `size` | Dimensión máxima inicial; 0.16 por defecto; valor positivo |
| `scale` | Multiplicador uniforme (`2`) o XYZ (`2 2 2`); por defecto 1 |
| `rotation` | Grados XYZ separados por espacios; por defecto `0 0 0` |
| `position` | XYZ local al anclaje; por defecto `0 0 0` |
| `animation` | Nombre exacto, índice desde 0 o `none`; ausente reproduce la primera si existe |

```html
<webar-model
  src="./Kai.glb"
  size="0.5"
  scale="2"
  rotation="0 180 0"
  position="0 0.02 0"
  animation="Caminar"
></webar-model>
```

El GLB debe contener esa animación. Un nombre inexistente se informa como error. Scale, rotation, position, animation y size cambian en vivo; src carga el archivo de reemplazo sin cerrar cámara. Espera `element.updateComplete` tras cambiar src. La jerarquía y los targets se sincronizan con `scene.refresh()`. Las opciones de cámara/mode/backend siguen requiriendo parar y reiniciar. [Interacción y cambios en vivo](interaction.md) detalla cancelación, errores y propiedad de recursos.

## Vídeo, gestos y reproducción avanzada

Existe `webar-video` para MP4 y chroma, con width, orientation, muted, loop, autoplay, chroma-key y parámetros de color. Existe gestures en escena o contenido para arrastrar/girar, pellizcar/escalar y seleccionar. Los modelos aceptan animation-speed, animation-loop, animation-repetitions, animation-fade y animation-paused. Consulta [la referencia de interacción](interaction.md) para valores y ejemplos completos.

## SLAM con HTML

```html
<webar-scene mode="slam">
  <webar-model src="./Kai.glb" size="0.5" rotation="0 180 0"></webar-model>
</webar-scene>
```

El modo SLAM usa odometría WASM por defecto y no registra una imagen. El modelo aparece cuando exista una pose con plano verificado. Necesita textura y paralaje; la escala inicial es relativa, no se garantiza un metro físico. [Ejemplo ejecutable](../examples/declarative-slam.html).

Para una transición desde una imagen, añade `slam` a una escena de imagen: aparece el botón **Activar SLAM** después de cargar. El backend es automático salvo que lo configures. En `mode="slam" backend="auto"` o `backend="webxr"`, también se presenta ese segundo botón para solicitar la sesión nativa desde un gesto, después de preparar cámara y recursos. No se solicita WebXR tras una descarga asíncrona ocultando el requisito de activación del navegador.

Conservar contenido al perder imagen no es anclarlo. La misma biblioteca de tracking y las mismas limitaciones geométricas se aplican a esta capa. Lee [seguimiento espacial](spatial-tracking.md).

## Eventos y código propio

```js
const scene=document.querySelector('webar-scene');
scene.addEventListener('targetFound',event=>console.log(event.detail.targetId));
scene.addEventListener('targetLost',event=>console.log(event.detail.retained));
scene.addEventListener('trackingQuality',event=>console.log(event.detail.issues));
scene.addEventListener('ar-error',event=>console.error(event.detail));
scene.addEventListener('ar-ready',()=>console.log(scene.engine,scene.app));
scene.addEventListener('ar-slam',event=>console.log(event.detail.placement));
```

| Evento DOM | `detail` |
| --- | --- |
| `ar-ready` | `{app: ThreeARScene}`: contenido y configuración preparados; no confirma una detección o un plano |
| `ar-error` | `Error` |
| `ar-status` | `{message: string}` del motor |
| `ar-pose` | `ARPose` real aceptada |
| `ar-slam` | `SurfaceTransitionResult`; puede requerir escaneo o selección |
| `ar-stopped` | `null` |
| `modelLoaded` | `{animations: string[]}`; se emite desde webar-model y burbujea |
| `videoLoaded` | `{width, height}`: metadata del MP4 listo |
| `videoPlayBlocked` | Error de reproducción; se presenta un botón para autorizar |
| `animationFinished` | `{name}`: clip terminado |
| `ar-select`, `ar-gesture` | Selección y transformaciones por Pointer Events |
| `contentUpdated` | null: jerarquía/targets sincronizados; no confirma detección |
| `ar-placement` | `{state}`: idle/scanning/surface-found/placed/lost |
| `targetFound`, `targetLost`, `targetVisibility`, `trackingQuality` | Mismo payload que los eventos tipados del motor |

Los métodos de escena son `start()`, `stop()`, `refresh()` y `enableSLAM(options?)`; devuelven promesas. Scene.updateComplete expone la última sincronización encolada; para esperar un cambio de jerarquía que acabas de hacer llama a refresh explícitamente. `scene.app` y `scene.engine` son `null` antes de iniciar y tras parar. En esta capa `stop()` destruye la escena interna y libera render/modelos/cámara; el siguiente `start()` reconstruye desde el HTML. No es el mismo alcance que llamar solo a `engine.stop()`.

También expone diagnostics, getDiagnosticsReport(), downloadDiagnostics(), placementState y confirmPlacement(). [Diagnóstico](diagnostics.md) y [colocación](placement.md) especifican cuándo están disponibles. Un diagnóstico no aprueba hardware y una superficie candidata no confirma colocación.

`webar-model.model` expone `ThreeARModel` mientras existe. Sus métodos `playAnimation(nameOrIndex)` y `stopAnimations()` permiten controlar clips sin tocar el renderer. Los eventos de calidad, control de cámara y matrices avanzadas siguen disponibles en `scene.engine`. En una SPA se liberan los recursos al retirar la etiqueta de escena; también se detienen al abandonar la página.

## Script remoto y distribución

Puedes alojar el archivo standalone en un servidor estático y referenciar una versión fija mediante HTTPS. El archivo incluye OpenCV, Draco y los avisos de licencia. El proyecto todavía no tiene una URL pública publicada.

El standalone incluye **los recursos del motor** incluso si el script está alojado en otro dominio. Tus imágenes y modelos se resuelven respecto al HTML. Si eliges recursos externos para OpenCV o Draco, su servidor debe permitir las solicitudes CORS correspondientes. Esto se prueba con dos orígenes locales y permite publicar el mismo archivo desde un servidor compartido.

El JS ya incluye Three.js, sus loaders y Meshopt. OpenCV/WASM y los decoders Draco continúan como recursos auxiliares descargados automáticamente, sin que el desarrollador tenga que declarar sus rutas en cada aplicación. No afirmamos que todos sus bytes estén embebidos en un único archivo.

En ESM el registro es explícito:

```ts
import {registerARComponents} from 'webar-facil';
registerARComponents({assetBase:new URL('/vendor/webar/',location.href)});
```

La capa nativa registra cuatro etiquetas: webar-scene, webar-target, webar-model y webar-video. Para un framework o renderer existente siguen disponibles [A-Frame](aframe.md), [Three.js](threejs.md) y las clases de medios.

`pixel-ratio` y `antialias` se leen al iniciar; para cambiarlos, detén la escena y vuelve a iniciarla. Afectan al renderer de Three.js. WebXR inmersivo administra su framebuffer por separado: estos ajustes no controlan su resolución.

## Arranque de cámara y contenido

Al pulsar Iniciar AR, el componente pide cámara antes de cargar los modelos. Un GLB grande puede seguir descargándose con la vista previa activa; ar-ready llega cuando termina la preparación del contenido/targets. Un error de carga libera el stream. Detener permite cancelar una preparación pendiente. El botón nativo de la escena usa su propio controlador de inicio sin intermediarios de la herramienta de pruebas.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
