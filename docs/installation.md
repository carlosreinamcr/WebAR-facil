# Instalación y distribución

## HTML directo: opción recomendada

Sigue [inicio con HTML](getting-started.md). Copia solo `webar-facil.min.js` y úsalo con `webar-scene`, `webar-target` y `webar-model`. El archivo compilado incluye OpenCV/WASM, Workers, Draco, Meshopt y Three.js.

El paquete npm se llama `webar-facil`. En código nuevo, usa `WebARFacil` al cargar el script clásico. Los scripts clásicos también conservan el alias anterior `MiLibreriaAR` para integraciones existentes que ya lo usan.

Si alojas el SDK en otro dominio HTTPS, apunta el script a ese servidor. En la capa declarativa OpenCV/Draco se localizan junto al script, mientras las URLs de imagen/modelo se interpretan respecto al HTML. El servidor de recursos debe permitir CORS; [referencia declarativa](declarative.md) y [despliegue](deployment.md) detallan rutas y actualización de caché. La biblioteca no publica por sí sola una URL CDN.

## Formatos disponibles

| Archivo / import | Uso | Three.js |
| --- | --- | --- |
| `webar-facil.min.js` | `<script>` clásico, global `WebARFacil` | Incluido; accesible como `WebARFacil.THREE` |
| `webar-facil.browser.min.js` | IIFE clásico, global `WebARFacil` | Debe existir `window.THREE` antes de cargarlo |
| `webar-facil.js` | ESM con wrappers | Resuelve el import externo `three` |
| `webar-facil.core.js` | ESM sin renderer | No depende de Three.js |
| `dist/types/` | Declaraciones TypeScript | Wrappers requieren los tipos de Three |

Para HTML directo se recomienda **standalone**. No mezcles accidentalmente dos copias de Three.js: si usas ese archivo, crea tus objetos con `WebARFacil.THREE`. El IIFE sin Three se reserva a aplicaciones que ya suministran un global compatible.

El standalone registra automáticamente las etiquetas de [HTML declarativo](declarative.md) y usa sus recursos integrados. Las opciones explícitas de URL y directorio siguen disponibles para proyectos que quieran servir sus propios recursos.

## Consumir con NPM y Vite

Esta alternativa es para aplicaciones con bundler. Si quieres mantener las etiquetas, importa `registerARComponents` y regístralas una vez con `assetBase` apuntando a una copia estática de la distribución. Los imports de `ThreeARScene` de abajo se reservan para control programático.

```ts
import {registerARComponents} from 'webar-facil';
registerARComponents({assetBase:new URL('/vendor/webar/',location.href)});
```

La existencia del paquete local no significa que esté publicado en el registro NPM. Para instalar tu propia distribución:

```sh
# En este repositorio, después de npm ci:
npm run build
npm pack

# En la aplicación consumidora; ajusta la ruta real del tarball:
npm install /ruta/webar-facil-0.1.0.tgz three
npm install --save-dev @types/three
```

```ts
import {ThreeARScene, ThreeARModel} from 'webar-facil';
import {WebAREngine} from 'webar-facil/core';
```

Son ejemplos de importaciones alternativas; no necesitas crear dos motores. La distribución validada utiliza Three.js 0.180. La declaración de peers admite `>=0.170.0 <1`, sin afirmar que cada versión intermedia esté certificada.

Para el ejemplo declarativo con `assetBase: '/vendor/webar/'`, copia el contenido completo de `node_modules/webar-facil/dist/` a `public/vendor/webar/` de tu app. No basta con escribir el import: Vite no copia automáticamente esos recursos auxiliares.

En una integración programática con los defaults relativos al documento, puedes copiar `dist/vision/` y `dist/decoders/` a `public/vision/` y `public/decoders/`, o configurar sus URLs explícitamente. Los Workers se resuelven respecto al bundle de la biblioteca; conserva `dist/workers/` al distribuir los bundles sin transformación. Si tu bundler reubica el JS y no copia sus referencias de Worker, sirve la distribución completa como recursos estáticos e impórtala desde allí, o configura explícitamente el copiado.

## ESM sin empaquetador

Integración avanzada. Para una app HTML básica usa el standalone, que evita este importmap y la construcción manual de escena.

En un sitio cuya carpeta raíz contiene el contenido de `dist/`:

```html
<script type="importmap">
{"imports":{"three":"./vendor/three.module.js"}}
</script>
<script type="module">
  import {ThreeARScene} from './webar-facil.js';
  const app=new ThreeARScene({container:document.querySelector('#view')});
</script>
```

El contenedor `#view` debe existir y tener altura. Los ejemplos ESM del repositorio usan las rutas adecuadas a su subcarpeta. No uses `require()` para estos exports ESM.

## Recursos y licencias

`vision/opencv.js` contiene el runtime OpenCV/WASM de esta distribución; conserva su archivo de licencias. Draco necesita `draco_wasm_wrapper.js` y `draco_decoder.wasm` en la ruta configurada; se distribuye también el decoder JS. Meshopt está integrado en el cargador. No hace falta un servicio remoto de compilación ni de tracking.

Al redistribuir conserva `LICENSE`, `THIRD_PARTY_NOTICES.md` y los avisos de `vision/`, `decoders/` y `vendor/`. Los modelos y marcadores del ejemplo pueden sustituirse sin cambiar la API.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
