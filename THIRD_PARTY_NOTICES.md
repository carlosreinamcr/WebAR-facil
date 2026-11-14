# Third-party notices

El código original de esta librería usa MIT. Las dependencias conservan sus licencias.

| Componente | Versión fijada / origen | Licencia / distribución |
| --- | --- | --- |
| OpenCV.js | @techstark/opencv-js 4.12.0-release.1; upstream OpenCV 4.12.0 | Apache-2.0, texto en `dist/vision/LICENSE.opencv.txt` |
| ml-matrix y utilidades ml-array-* / is-any-array | Versiones e integridades de `package-lock.json` | MIT, textos en `dist/vision/licenses/` |
| Three.js | 0.180.0 en el ejemplo; peer del wrapper | MIT, texto en `dist/vendor/LICENSE.three.txt` |
| A-Frame | 1.8.0; copia oficial de https://aframe.io/releases/1.8.0/aframe.min.js, solo receta 25 | MIT, `examples/assets/AFRAME-LICENSE.txt` y copia distribuida en `dist/examples/assets/` |
| Draco | Decodificadores glTF distribuidos con Three.js | Apache-2.0, texto en `dist/decoders/draco/LICENSE.Apache-2.0.txt` |
| meshoptimizer | Decoder 0.22 incluido con Three.js; herramientas de generación fijadas en lockfile | MIT, texto en `dist/vendor/LICENSE.meshoptimizer.txt`; copyright original conservado en el decoder |
| glTF Transform y draco3dgltf | Herramientas abiertas para generar fixtures GLB, no SDKs de tracking | MIT y Apache-2.0; versiones fijadas en lockfile |
| Sharp | Herramienta de desarrollo local | Apache-2.0; ver licencia y avisos de su paquete y binarios instalados |
| Vite, TypeScript y Playwright | Herramientas de desarrollo/pruebas | Sus licencias se conservan en los paquetes instalados; no forman el motor CV distribuido |

Modificaciones al runtime OpenCV distribuido, efectuadas por `scripts/prepare-vision.mjs`:

1. El global UMD `this` se sustituye por `globalThis` para importarlo desde Module Workers.
2. El heap inicial de 128MiB y el mínimo importado del módulo WASM se reducen a 32MiB. Se comprueba que la región estática cabe, se conserva el crecimiento de memoria y se valida el WASM. Las pruebas verifican crecimiento y acceso a memoria después de ampliarla.

Se registra el hash del original y del resultado en `dist/vision/manifest.json`. No se modifican los algoritmos OpenCV. Conservar estos avisos y los textos de licencia al redistribuir recursos. El arte del marcador de ejemplo fue generado mediante código original determinista del repositorio.

Fuentes: https://github.com/opencv/opencv/tree/4.12.0, https://github.com/TechStark/opencv-js, https://github.com/mljs/matrix, https://github.com/mrdoob/three.js.

## Herramienta de compilación del kernel Hamming

WABT 1.0.37 (WebAssembly Binary Toolkit), Apache-2.0: https://github.com/WebAssembly/wabt. Se utiliza solo durante desarrollo para compilar el WAT propio; su runtime no se incorpora al SDK. El kernel src/vision/wasm/hamming.wat es código original de esta biblioteca bajo MIT.
