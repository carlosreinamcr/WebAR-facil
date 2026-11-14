# Integración programática avanzada

Esta alternativa permite controlar explícitamente el motor, los modelos y el ciclo de vida mediante JavaScript. Para una primera aplicación con imagen y GLB sigue [inicio con HTML](getting-started.md). No tienes que reproducir este código si utilizas `webar-scene`.

## Ejecutar este repositorio

Requisitos: Node.js **22.18 o posterior**, NPM, navegador con WebGL y cámara. Desde la carpeta del proyecto:

```sh
npm ci
npm run dev
```

`predev` compila la librería, prepara OpenCV, los modelos de ejemplo, Workers, tipos y documentación. La primera ejecución tarda más que las siguientes. Abre `http://127.0.0.1:5173/examples/documented-app.html`, pulsa **Iniciar cámara** y concede el permiso. Muestra `http://127.0.0.1:5173/marker.png` en otra pantalla o imprímelo. No intentes escanear una miniatura demasiado pequeña.

En un computador se utiliza su webcam disponible; en móviles se solicita preferentemente la trasera. El tracking de imágenes no requiere `immersive-ar`.

## Mi propio index.html

Ejecuta `npm run build` y copia **todo el contenido de `dist/`** a la carpeta de tu sitio. Puedes cambiar su `index.html` por tu aplicación. No copies únicamente el JS: hacen falta los Workers, OpenCV y, para modelos Draco, sus decoders.

```text
mi-sitio/
  index.html
  webar-facil.min.js
  workers/                         # copiar completo desde dist
  vision/opencv.js
  decoders/draco/                  # conservar nombres de archivos
  imagen.jpg
  modelo.glb
```

En el HTML completo de abajo las rutas corresponden a `examples/documented-app.html` de este repositorio. Para usarlo como `mi-sitio/index.html`, sustituye:

| Ruta del ejemplo | Ruta de tu sitio |
| --- | --- |
| `../dist/webar-facil.min.js` | `./webar-facil.min.js` |
| `../vision/opencv.js` | `./vision/opencv.js` |
| `../decoders/draco/` | `./decoders/draco/` |
| `../marker.png` | `./imagen.jpg` |
| `../models/demo-draco.glb` | `./modelo.glb` |

<!-- example:examples/documented-app.html -->
```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="data:,">
  <title>Mi aplicación WebAR</title>
  <style>
    body{margin:0;background:#15202a;color:white;font:16px system-ui}
    header{padding:12px}#view{width:100%;height:75vh;height:75dvh}button{padding:10px}
  </style>
</head>
<body>
  <header>
    <button id="start">Iniciar cámara</button>
    <button id="stop" disabled>Detener</button>
    <p id="status" role="status">Apunta al marcador de ejemplo.</p>
  </header>
  <div id="view"></div>
  <!-- En dist/examples el empaquetador cambia ../dist/ por ../. -->
  <script src="../dist/webar-facil.min.js"></script>
  <script>
    // 1. El script standalone incluye Three.js y publica WebARFacil.
    const {ThreeARScene,ThreeARModel}=WebARFacil;
    const start=document.querySelector('#start');
    const stop=document.querySelector('#stop');
    const status=document.querySelector('#status');
    const report=error=>{status.textContent=error instanceof Error?error.message:String(error);};

    // 2. La escena crea cámara, fondo, luces, renderer y bucle de animación.
    const app=new ThreeARScene({
      container:document.querySelector('#view'),
      engineOptions:{
        opencvURL:new URL('../vision/opencv.js',location.href),
        imageLossGraceMs:500,
        keepContentOnLost:false,
      },
    });

    // 3. El ID enlaza el contenido con su marcador; no es el nombre del GLB.
    const model=new ThreeARModel({
      dracoDecoderPath:new URL('../decoders/draco/',location.href),
    });
    app.addContent('poster',model);
    app.engine.onError(report);
    app.engine.on('targetFound',event=>{status.textContent=`Visible: ${event.targetId}`;});
    app.engine.on('targetLost',event=>{status.textContent=`Fuera de vista: ${event.targetId}`;});
    app.engine.on('trackingQuality',event=>{
      // Diagnóstico heurístico: registrar o presentar ayuda sin reiniciar el modelo.
      if(event.issues.length) console.debug(event.targetId,event.state,event.issues);
    });

    // 4. Carga bajo demanda. Las operaciones del motor se esperan en orden.
    start.onclick=async()=>{
      start.disabled=true;stop.disabled=true;
      try{
        await model.load('./assets/Kai-WebAR-Facil.glb');
        await app.engine.startCamera();
        // Basta JPG/PNG. El Worker compila los descriptores automáticamente.
        const target=await app.engine.addImageTarget('poster','./assets/marcador.jpg',{
          physicalWidthMeters:0.2,
        });
        console.info('Calidad del marcador',target.metadata.quality);
        status.textContent='Busca el marcador con la cámara.';
        stop.disabled=false;
      }catch(error){
        await app.engine.stop();report(error);start.disabled=false;
      }
    };
    stop.onclick=async()=>{
      stop.disabled=true;
      try{await app.engine.stop();status.textContent='Cámara detenida.';}
      catch(error){report(error);}
      finally{start.disabled=false;}
      // stop() elimina los targets: Iniciar vuelve a registrarlos.
    };
    // 5. El contenedor actualiza las animaciones aunque falte una pose nueva.
    // dispose() libera recursos que pertenecen a la escena y sus modelos.
    addEventListener('pagehide',()=>{void app.dispose();});
  </script>
</body>
</html>

```
<!-- /example -->

`addContent('poster', model)` y `addImageTarget('poster', imagen)` deben utilizar el mismo ID. La imagen se convierte internamente en descriptores: no tienes que cargar `.dat` ni JSON. La anchura física de `0.2` significa 20 cm; ajustarla da una escala coherente con el marcador real. Si desconoces su tamaño, puedes usarla como referencia de escala, sin atribuir exactitud métrica a la escena.

## Qué modificar después

- Sustituye las rutas de imagen y GLB o usa archivos de un formulario: [recetas programáticas](recipes-programmatic.md).
- Usa un MP4 en lugar del modelo: [vídeo](video.md).
- Añade un segundo marcador con otro ID: [multimarcador](multiple-targets.md).
- Activa retención visual con `app.engine.setKeepContentOnLost(true)`.
- Añade SLAM siguiendo [la guía espacial](spatial-tracking.md); la disponibilidad y la continuidad al cambiar de modo son diferentes del tracking de imágenes.

Para publicar o probar desde un teléfono utiliza HTTPS. `localhost` de un teléfono es el propio teléfono, no tu computador. Consulta [despliegue](deployment.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
