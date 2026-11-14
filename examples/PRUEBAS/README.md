# PRUEBAS: 28 aplicaciones WebAR

Empieza por **index.html**, la galería que enlaza las 28 recetas. Todos los HTML tienen comentarios y su propio código: no dependen de un script de aplicación oculto. Los archivos 01–13 se conservan; las recetas 14–25 utilizan las rutas indicadas por el usuario.

## Abrir

1. Desde la raíz del proyecto ejecuta `npm run dev` (compila el SDK antes de servir).
2. En el computador visita `http://127.0.0.1:5173/examples/PRUEBAS/index.html`.
3. Para teléfonos utiliza el servidor HTTPS que ya empleas. `localhost` en el teléfono no apunta al computador.
4. Si distribuyes `dist/`, la galería está en `examples/PRUEBAS/index.html` dentro de esa distribución. Copia `dist/` completo; el empaquetado adapta las rutas del SDK y conserva los recursos.

No abras los archivos con doble clic/file://. Los ejemplos no solicitan cámara al cargarse: pulsa **Iniciar AR** dentro de la escena.

## Qué contiene cada HTML

| Archivo | Qué enseña |
| --- | --- |
| 01-modelo-marcador.html | GLB con una imagen JPG/PNG como marcador |
| 02-gestos-marcador.html | Mover sobre el plano, girar y pellizcar con marcador |
| 03-cambiar-modelo-marcador.html | Botones robot/cohete sin reiniciar la cámara |
| 04-texto-marcador.html | Campo de texto convertido en contenido AR mediante CanvasTexture/Sprite |
| 05-video-marcador.html | MP4 sobre el marcador y comentario para activar chroma |
| 06-iluminacion-marcador.html | Slider para mover una luz direccional alrededor del GLB |
| 07-modelo-slam.html | GLB sin marcador y colocación manual |
| 08-gestos-slam.html | Mover sobre el plano, girar y pellizcar tras colocar |
| 09-cambiar-modelo-slam.html | Botones robot/cohete conservando la sesión espacial |
| 10-texto-slam.html | Texto en un anchor espacial respetando colocación y pérdida |
| 11-video-slam.html | MP4 espacial sin marcador |
| 12-iluminacion-slam.html | Luz móvil alrededor del GLB colocado |
| 13-mapas-locales.html | Guardar, recuperar y borrar snapshots en IndexedDB |
| 14-varios-marcadores.html | Dos JPG distintos con contenido y estados independientes |
| 15-animaciones-glb.html | Giro, Salto y Asentir; pausa, reproducción y velocidad |
| 16-video-chroma.html | Color clave, tolerancia, suavizado y bordes sin recargar |
| 17-archivos-del-usuario.html | Elegir JPG/PNG y GLB con campos de archivo locales |
| 18-perdida-y-retencion.html | Tolerancia, eventos y conservación de última transformación |
| 19-seleccionar-partes.html | Tocar una malla, identificarla y resaltarla |
| 20-catalogo-colores.html | Cambiar robot/cohete y color del cuerpo sin otra cámara |
| 21-imagen-a-espacio.html | Exigir preservación de posición al pasar de imagen a odometría |
| 22-webxr-nativo.html | WebXR desde un gesto con fallback óptico; añade `?backend=webxr` para forzar el nativo |
| 23-comparar-rendimiento.html | Perfiles, marcador/odometría y descarga de informes comparables |
| 24-contenido-compuesto.html | GLB animado, Sprite de texto y MP4 con controles independientes |
| 25-aframe.html | A-Frame 1.8.0 local y wrappers oficiales de tracking/modelo |
| 26-colocacion-con-mira.html | Región central de escaneo, cuadrícula respaldada por puntos locales y confirmación |
| 27-pantalla-completa.html | Visor a pantalla completa y menú de calidad, foto y vídeo con micrófono |
| 28-escala-metrica.html | Barra de 2 m, diagnóstico visual-inercial experimental y comparación con WebXR. La barra se genera por código |

## Elegir una superficie con la mira

El ejemplo 26 solo requiere `../assets/robot.glb` y el SDK con su runtime local. Inicia la cámara, apunta al interior de la superficie y pulsa Escanear aquí. La región central acota los puntos que el motor considera para ajustar el plano. La app calcula un cuadrado pequeño dentro de la envolvente de puntos del mapa cercanos a la mira. Esta referencia no mide los bordes físicos de la mesa. Colocar aquí sitúa el modelo donde apuntaste. Otra zona inicia un escaneo nuevo.

## Rutas de los ejemplos 14–25: qué poner después de assets

Estos HTML contienen exactamente `../dist/webar-facil.min.js`. El marcador principal es `../assets/marcador.jpg` y el segundo `../assets/marcador2.jpg`.

Los recursos ya incluidos están en **examples/assets/**, una carpeta hermana de PRUEBAS. Copia esos archivos a la carpeta assets de tu aplicación, manteniendo sus nombres, o cambia los src correspondientes:

| Ruta escrita en los HTML | Uso |
| --- | --- |
| ../assets/marcador.jpg | Imagen principal, ejemplos con marcador |
| ../assets/marcador2.jpg | Imagen distinta, solamente 14 |
| ../assets/robot.glb | Modelo base y piezas identificables por nombre |
| ../assets/cohete.glb | Segundo producto de 20; también puedes usarlo en 17 |
| ../assets/animaciones.glb | GLB con Giro, Salto y Asentir, ejemplos 15 y 24 |
| ../assets/video.mp4 | Vídeo verde/rojo original para 16 y 24 |
| ../assets/aframe.min.js | A-Frame 1.8.0 local, solamente 25 |
| ../assets/AFRAME-LICENSE.txt | Licencia de la copia local de A-Frame |

Estructura portátil si copias los HTML nuevos a tu sitio:

```text
mi-sitio/
  PRUEBAS/
    14-varios-marcadores.html
    ...
    25-aframe.html
  assets/
    marcador.jpg
    marcador2.jpg
    robot.glb
    cohete.glb
    animaciones.glb
    video.mp4
    aframe.min.js
    AFRAME-LICENSE.txt
  dist/
    webar-facil.min.js
    vision/
    workers/
    decoders/
    ...resto de la distribución
```

No necesitas .dat ni JSON de marcadores. `marcador2.jpg` debe ser otra imagen, no una copia de la primera. Para el 15 utiliza un GLB que tenga clips reales: los nombres se consultan del archivo. Para el 19 conserva nombres de piezas útiles en el GLB. El vídeo de chroma necesita un fondo de color uniforme; no elimina cualquier fondo automáticamente.

Dentro del repositorio, npm run dev resuelve /examples/dist al SDK de /dist mediante Vite, sin duplicar la librería. Un servidor estático genérico no instala ese alias: usa la estructura portátil anterior o la distribución empaquetada. El build adapta las rutas del script en dist/examples/PRUEBAS y copia examples/assets a dist/examples/assets.

El perfil/objetivo de medición de 23 no certifica consumo, temperatura ni precisión física. El ejemplo 21 puede rechazar la transición si no hay pose reciente o entorno suficiente; no inventa un ancla. El 22 exige WebXR y no activa el fallback cuando falta soporte: usa 07/08 para odometría óptica en esos navegadores.

A-Frame está separado del SDK; 25 usa el standalone solicitado y los wrappers oficiales con A-Frame 1.8.0. No añadas otro script Three.js. La comprobación de esa combinación no certifica todas las versiones de A-Frame ni una cámara física. La copia local procede de https://aframe.io/releases/1.8.0/aframe.min.js; se eliminó únicamente su comentario sourceMappingURL para no solicitar un mapa de depuración ausente. Su licencia procede de la etiqueta v1.8.0 del repositorio oficial.

## Recursos y personalización

- `assets/robot.glb` y `assets/cohete.glb`: modelos originales ligeros y distintos. Reemplaza `src` por tu GLB autocontenido. La librería también admite GLB con Draco/Meshopt.
- `assets/marcador.png`: mostrar en otra pantalla o imprimir. No se reconoce la imagen desde el mismo teléfono que la está mostrando. Si imprimes a otro ancho, cambia `physical-width` (metros).
- `assets/video.mp4`: MP4 original incluido; cambia `src` por un vídeo con codec compatible. `muted` facilita el inicio móvil. El SDK muestra Reproducir vídeos cuando el navegador exige otra interacción.
- El SDK local se carga con `../../dist/webar-facil.min.js` en los fuentes. No necesitas otro Three.js ni un CDN.
- `performance="auto"` utiliza el presupuesto adaptativo. Puedes probar `battery`, `balanced` o `quality`; el perfil se lee al iniciar.

## Gestos

En 02/08 elige **Mover** y arrastra el propio modelo con un dedo. Para **Girar y escalar**, arrastra con un dedo, pellizca con dos o gira los dos dedos. El giro/escala utilizan el controlador del SDK. El arrastre sobre el plano se explica en el HTML con Raycaster/Plane y actualiza `position` del contenido; nunca sobrescribe la matriz del anchor. En escritorio puedes mover/girar con ratón; el pellizco requiere entrada táctil de dos dedos.

## Seguimiento espacial y mapas

07–13 usan **odometría óptica** para poder probar la misma receta en iPhone, Android y un computador con cámara. No usan un marcador ni necesitan soporte immersive-ar. Mueve la cámara con traslación sobre una zona con textura; girarla sin desplazarte puede impedir inicialización. Espera el anillo y pulsa **Colocar aquí**.

La escala es relativa y puede haber deriva o pérdidas. Una superficie propuesta no demuestra reconocimiento semántico de suelo/mesa. Estos ejemplos no certifican rendimiento móvil ni equivalencia con ARCore/ARKit. Cambiar a WebXR requiere el flujo nativo y adaptar interacciones; los gestos del visor no son controladores XR.

13 conserva los typed arrays del mapa con IndexedDB. Tras recuperar espera relocalización real; no presenta una pose guardada como medición actual. Usa la misma cámara, orientación y configuración. El mapa no es una malla completa ni se garantiza recuperación entre dispositivos. **Eliminar guardado** borra almacenamiento; no interrumpe el mapa activo en memoria.

El texto y la iluminación muestran cómo añadir Three.js propio a una escena declarativa. Sus callbacks y recursos se liberan al detener para poder reiniciar sin duplicarlos.

Recursos originales regenerables con `node scripts/generate-pruebas-models.mjs`. El marcador/MP4 se copian de los recursos originales del proyecto.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
