# Marcadores y compilación

## Flujo recomendado

Indica la imagen original en el HTML del [inicio rápido](getting-started.md):

```html
<webar-target src="./cartel.jpg" target-id="cartel" physical-width="0.3">
  <webar-model src="./modelo.glb" size="0.2"></webar-model>
</webar-target>
```

La etiqueta se coloca dentro de `webar-scene`. `physical-width` está en metros y corresponde a `physicalWidthMeters` del motor. El mismo archivo que indicas en `src` debe mostrarse a la cámara; no se necesita un formulario de compilación ni cargar JSON.

## Compilación mediante API avanzada

Para recibir el binario y la metadata desde tu propio código, utiliza un `engine` como en [integración programática](programmatic.md):

```ts
const target=await engine.addImageTarget('cartel','./cartel.jpg',{
  physicalWidthMeters:0.3,
  maxDimension:1024,
});
console.log(target.metadata.quality);
```

Acepta JPG/PNG en URL o `File`. La compilación genera descriptores ORB y vistas adicionales en un Worker. Se realiza al cargar el target, no vuelve a analizarse la imagen de referencia en cada frame. Durante tracking se analizan los frames de cámara, se siguen puntos con flujo óptico y se recuperan correspondencias cuando hace falta.

No necesitas bordes negros ni calibración manual. Una imagen a color se procesa por contraste y estructura; los cambios de color sin contraste de luminancia aportan pocas correspondencias. No todas las imágenes sirven igual: evita superficies lisas, texto repetido, rejillas, reflejos, transparencias y dibujos con muy pocos detalles. Reparte textura por toda la imagen.

## Límites de entrada

- Archivos de imagen de hasta 32 MiB; guardas de decodificación de 16 megapíxeles.
- `maxDimension`: 64 a 4096; 1024 como valor habitual.
- Usa una imagen que represente exactamente lo que verá la cámara. No añadas márgenes o recortes diferentes al imprimir.
- `physicalWidthMeters` es el ancho de la imagen física, sin contar un marco ajeno al target.

Las imágenes pequeñas dentro del feed necesitan suficiente detalle después del reescalado de análisis. Aumentar `maxDimension` del compilador no recupera detalle que la cámara no está viendo.

## Resultado de compilación

`ImageTargetResult` contiene:

| Campo | Contenido |
| --- | --- |
| `buffer` | `ArrayBuffer` del marcador WART v2 (`.dat`) |
| `metadata.format`, `version` | `WART`, `2` |
| `width`, `height` | Dimensiones de la referencia procesada |
| `physicalWidthMeters` | Escala indicada al compilar |
| `extractorId` | Identificador de compatibilidad del descriptor |
| `quality` | `featureCount`, `coverage`, `duplicateRatio`, `usable`, `warnings` |

La evaluación de calidad ayuda a seleccionar imágenes; no certifica todas las condiciones de iluminación o inclinación. Para permitir al usuario descargar los resultados, consulta [recetas programáticas](recipes-programmatic.md). No hay caché persistente automática entre visitas: si quieres evitar recompilación, guarda el buffer en tu aplicación o distribuye un `.dat`.

## Compilar una vez y distribuir

```sh
npm run compile:marker -- mi-imagen.jpg public/mi-target.dat 0.2
```

El CLI genera el binario y su metadata JSON. También puedes abrir [el compilador web](../tools/compile.html). Para reutilizarlo:

```html
<webar-target src="./mi-target.dat" target-id="cartel">
  <webar-model src="./modelo.glb"></webar-model>
</webar-target>
```

En la API programática, la operación equivalente es:

```ts
await engine.addTarget('cartel','./mi-target.dat');
```

El `.dat` contiene los datos necesarios para tracking. El `.json` es para inspección o herramientas, no se necesita al cargar. Este formato es propio: no acepta `.mind`, `.iset` o bases de otros SDKs. WART v2 incorpora cabecera, checksum y versión de extractor; no edites bytes ni omitas la validación para forzar compatibilidad.

## API de compilación sin motor

`ImageCompiler.compile(bytesOrBlob, options)` y `compileRGBA({data,width,height}, options)` devuelven el binario. En esta API avanzada **sí es obligatorio** `physicalWidthMeters`. Para no bloquear UI con operaciones OpenCV utiliza `MarkerCompiler`, que gestiona el Worker; Node puede usar un adaptador de decodificación como el CLI incluido.

Las opciones `simulate` y `extract` existen para pruebas o backends propios. Los descriptores simulados no son marcadores rastreables y no deben publicarse como resultados reales.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
