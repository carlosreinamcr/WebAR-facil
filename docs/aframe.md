# Integración con A-Frame

Integración opcional para proyectos que ya usan A-Frame. Las etiquetas `webar-scene`, `webar-target` y `webar-model` de [inicio](getting-started.md) son Web Components propios y no requieren este framework. No mezcles sus schemas ni crees dos motores para el mismo contenido.

Los wrappers registran tres componentes: `my-ar-tracker`, `my-ar-model` y `my-ar-video`. A-Frame es una dependencia opcional para estas aplicaciones; el ejemplo 25 incluye una copia local. Utiliza una versión compatible y prueba tu combinación concreta. Se verifica el contrato de componentes y la combinación concreta del ejemplo, no todas las versiones del framework.

La [receta completa 25](../examples/PRUEBAS/25-aframe.html) incorpora ahora una copia local opcional de A-Frame 1.8.0 en examples/assets y utiliza el standalone solicitado. Su prueba ejecuta el framework real, los wrappers de tracking/modelo, renderizado, cierre de tracks y reinicio con cámara sintética. No añade look-controls: la cámara recibe matrices del tracker. Esta combinación concreta no implica compatibilidad con todas las versiones ni certificación de cámara física. La variante siguiente con el bundle externo permite compartir AFRAME.THREE en integraciones avanzadas.

## Configuración de una página

Ejemplo de integración de imagen. Copia la distribución a la raíz del sitio, añade tu propia copia compatible de `vendor/aframe.min.js`, `poster.jpg` y `modelo.glb`. Se reutiliza `AFRAME.THREE` para que renderer y wrappers compartan la misma copia de Three.js.

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <script src="./vendor/aframe.min.js"></script>
  <script>window.THREE=AFRAME.THREE;</script>
  <script src="./webar-facil.browser.min.js"></script>
  <script>
    const engine=new WebARFacil.WebAREngine({
      opencvURL:new URL('./vision/opencv.js',location.href),
    });
    WebARFacil.registerAFrameComponent(AFRAME,engine);
    WebARFacil.registerAFrameModelComponent(AFRAME,{
      dracoDecoderPath:new URL('./decoders/draco/',location.href),
    });
    WebARFacil.registerAFrameVideoComponent(AFRAME);
  </script>
</head>
<body>
  <button id="start">Iniciar cámara</button><p id="status"></p>
  <a-scene embedded vr-mode-ui="enabled: false">
    <a-entity camera look-controls="enabled: false" wasd-controls="enabled: false"></a-entity>
    <a-entity light="type: ambient; intensity: 1"></a-entity>
    <a-entity id="anchor" my-ar-tracker="targetId: poster">
      <a-entity my-ar-model="src: ./modelo.glb; fitSize: 0.16; autoplay: true"></a-entity>
    </a-entity>
  </a-scene>
  <script>
    const button=document.querySelector('#start'),message=document.querySelector('#status');
    const report=error=>{message.textContent=error.message;};
    engine.onError(report);
    document.querySelector('#anchor').addEventListener('ar-error',event=>report(event.detail));
    document.querySelector('[my-ar-model]').addEventListener('ar-model-error',event=>report(event.detail));
    button.onclick=async()=>{
      button.disabled=true;
      try{
        await engine.startCamera();
        // El componente inicia una carga asíncrona y emite ar-error si falla.
        document.querySelector('#anchor').setAttribute('my-ar-tracker',{
          target:'./poster.jpg',targetId:'poster',physicalWidth:0.2,
        });
      }catch(error){report(error);button.disabled=false;}
    };
    addEventListener('pagehide',()=>engine.dispose());
  </script>
</body>
</html>
```

El ejemplo gestiona imágenes. Para WebXR hace falta integrar explícitamente la sesión con el renderer A-Frame: el registro de componentes no instala por sí solo los hooks XR del motor. Para una escena XR gestionada usa `ThreeARScene` o implementa esos hooks de acuerdo con tu versión de A-Frame.

## Propiedades exactas

| Componente | Propiedades y valores iniciales |
| --- | --- |
| `my-ar-tracker` | `target: ''`, `targetId: 'default'`, `physicalWidth: 0.2` |
| `my-ar-model` | `src: ''`, `fitSize: 0.16`, `autoplay: true` |
| `my-ar-video` | `src: ''`, `width: 0.2`, `chromaKey: false`, `keyColor: '#00ff00'`, `similarity: 0.12`, `smoothness: 0.08`, `spill: 0.3`, `muted: true`, `loop: true` |

La propiedad A-Frame `physicalWidth` corresponde a `physicalWidthMeters` del motor. Respeta mayúsculas y nombres del schema: no existe una propiedad `marker`, `modelUrl` ni `orientation` en el schema del componente de vídeo.

El tracker reconoce `.dat` por extensión y usa `addTarget`; otras rutas se compilan como imagen. Sus configuraciones se serializan entre entidades. No hagas cargas manuales simultáneas del motor mientras los componentes están configurándose. No cambies el `targetId` de una entidad activa para administrar propiedad de targets implícitamente: retira explícitamente el target anterior cuando corresponda.

Al retirarse un componente se restauran sus matrices y listeners. La retirada de la entidad no elimina automáticamente el target del motor: si esa entidad era su propietaria, usa `await engine.removeTarget(id)`.

## Eventos y vídeo

`ar-error`, `ar-model-error`, `ar-video-error` y `ar-video-playblocked` llevan el `Error` en `event.detail`. `ar-model-loaded` lleva `{animations: string[]}`; `ar-video-loaded` indica metadata lista. Son eventos DOM del componente, distintos de `engine.on(...)`.

```html
<a-entity my-ar-tracker="target: ./poster.jpg; targetId: poster">
  <a-entity id="clip" my-ar-video="src: ./video.mp4; chromaKey: true"></a-entity>
</a-entity>
```

El componente intenta reproducir tras cargar; si la política lo bloquea, ofrece un botón que llame a `document.querySelector('#clip').components['my-ar-video'].video.play()` y gestione el rechazo. La instancia del componente de modelo expone `.model`; la de vídeo, `.video`.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
