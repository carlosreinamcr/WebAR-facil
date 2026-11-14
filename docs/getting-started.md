# Tu primera aplicación con HTML

La forma recomendada de empezar es **HTML declarativo**: cargas el standalone, indicas imagen y modelo y la biblioteca crea cámara, escena, controles y animación. No necesitas crear `WebAREngine`, gestionar frames ni escribir un bucle de render.

## Probar el repositorio

Requisitos: Node.js >=22.18 y navegador con cámara y WebGL. Desde la carpeta del proyecto:

```sh
npm ci
npm run dev
```

Abre `http://127.0.0.1:5173/examples/declarative.html`, pulsa **Iniciar AR** y concede acceso a cámara. Muestra `http://127.0.0.1:5173/examples/assets/marcador.jpg` en otra pantalla o impreso. En computadores se utiliza la webcam y en móviles se prefiere cámara trasera. El tracking de imágenes no necesita WebXR ni calibración manual.

`predev` compila el SDK y prepara recursos, ejemplos y documentación. No abras el archivo con doble clic ni uses `file://`.

## Crear tu sitio

Copia `webar-facil.min.js` a la carpeta de tu `index.html`. El archivo ya compilado incluye Three.js, OpenCV/WASM, los Workers, Draco y Meshopt. Añade tu marcador y tu modelo en las rutas que uses en el HTML. Las integraciones existentes pueden seguir usando `webar-facil.min.js`.

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" href="data:,">
  <title>Mi aplicación AR</title>
  <script defer src="./webar-facil.min.js"></script>
</head>
<body style="margin:0">
  <webar-scene>
    <p role="status">Cargando WebAR… Si no aparece Iniciar AR, revisa la ruta y la versión del script. Abre mediante HTTP/HTTPS.</p>
    <webar-target src="./marker.png" target-id="poster" physical-width="0.2">
      <webar-model src="./models/demo-draco.glb" size="0.3" rotation="0 180 0"></webar-model>
    </webar-target>
  </webar-scene>
</body>
</html>
```

Sirve esa carpeta por HTTP/HTTPS. Para teléfonos usa HTTPS confiable y accesible desde el dispositivo; el localhost del teléfono no es tu computador. Consulta [despliegue](deployment.md).

## Colocar tu imagen y tu modelo

Copia tus archivos a la carpeta del sitio y cambia únicamente los dos `src` del contenido:

```html
<webar-target src="./marcador.jpg" target-id="poster" physical-width="0.2">
  <webar-model src="./Kai.glb" size="0.3" rotation="0 180 0"></webar-model>
</webar-target>
```

La imagen JPG/PNG se compila automáticamente. No debes crear ni cargar un `.dat` o JSON. Apunta la cámara a **esa misma imagen** impresa o en otra pantalla. `physical-width="0.2"` significa 20 cm de ancho físico; si no conoces la medida, se usa como referencia de escala, sin exactitud métrica garantizada.

```text
mi-sitio/
  index.html
  webar-facil.min.js
  marcador.jpg
  Kai.glb
```

El standalone inicia los recursos integrados en el navegador. Si alojas el JS en un servidor común, varios sitios pueden referenciar la misma URL del script. Cada aplicación conserva sus propias rutas de imagen y modelo.

## Evitar una página en blanco

| Dónde está tu HTML | `src` del script |
| --- | --- |
| En cualquier proyecto con el SDK al lado del HTML | `./webar-facil.min.js` |
| En la raíz del repositorio fuente | `./dist/webar-facil.min.js` |
| Dentro de `examples/` del repositorio | `../dist/webar-facil.min.js` |

El HTML completo de arriba corresponde a la **primera fila**. No cambies el script de los ejemplos del repositorio a `./webar-facil...` si no copiaste el bundle junto al HTML. Actualiza también el JS de tu sitio: una versión anterior puede no registrar las etiquetas. El párrafo de respaldo se oculta cuando el componente carga correctamente. Más diagnóstico en [HTML declarativo](declarative.md) y [problemas frecuentes](troubleshooting.md).

## Continuar

- [Tamaño, giro y animaciones](models.md).
- [Varios marcadores](multiple-targets.md).
- [SLAM declarativo](spatial-tracking.md).
- [Eventos y retención](events.md).
- [Recetas declarativas](recipes.md).
- [Referencia completa de etiquetas](declarative.md).

Para vídeo/chroma, gestos, controles de animación y cambios de archivos sin reiniciar, continúa con [interacción declarativa](interaction.md). Si necesitas controlar el renderer, recursos Blob o sustituir piezas del motor, sigue la [integración programática avanzada](programmatic.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
