# Desarrollo, pruebas y contribuciones

## Entorno

Node.js >=22.18, `npm ci` y `npm run build`. TypeScript estricto y Vite generan ESM, IIFE, standalone, core sin renderer, Workers estáticos y declaraciones. No edites `dist/` como fuente.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Build previo y servidor en 127.0.0.1:5173 |
| `npm run check` | TypeScript sin emitir |
| `npm run build` | Preparar recursos y generar distribución y documentación |
| `npm test` | Pruebas Node con CV real y contratos de pipeline |
| `npm run test:browser` | Pruebas de navegador con Playwright |
| `npm run check:package` | Instalar tarball en consumidor independiente y validar tipos/exports |
| `npm run check:release` | Comprobar archivos, tamaños y SHA-256 de la distribución local |
| `npm run reports:summarize -- ios.json android.json` | Resumir evidencia declarada sin certificar dispositivos |
| `npm run benchmark` | Benchmark sintético de odometría |
| `npm run docs:build` | Regenerar sitio, API y textos para IA; requiere declaraciones del build |
| `npm run docs:check` | Comprobar links, exports, ejemplos y documentación generada |
| `npm run docs:test-browser` | Probar lector del manual y aplicación documentada en Chrome |
| `npm run compile:marker -- input.jpg public/target.dat 0.2` | Precompilar un marcador |
| `npm run generate:demo` | Regenerar referencia y binario de ejemplo |
| `npm run generate:video` | Regenerar el MP4 original de chroma; requiere Chrome/Playwright con encoder H.264 |

Las pruebas de navegador necesitan Playwright y sus navegadores instalados (`npx playwright install chrome webkit`; en Linux puede requerir `--with-deps`). En PowerShell, para la matriz ampliada:

```powershell
$env:TEST_WEBKIT='1'
$env:PLAYWRIGHT_CHANNEL='chrome'
npm run test:browser
```

No atribuyas a una prueba sintética una certificación de cámara física. Los resultados y el protocolo están en [verificación](verification.md) y [dispositivos](device-validation.md).

## Cambiar documentación

Edita los `.md` de `docs/`, el HTML de `examples/` o este README del proyecto. El inicio, los capítulos de funcionalidad y la guía para IA deben presentar primero HTML declarativo; el código de motor/renderer se identifica como avanzado. La referencia nativa incluye webar-video, gestos y actualizaciones en vivo; no publiques atributos que no estén implementados. `docs/api-generated.md`, `docs/api.json`, `llms.txt`, `llms-full.txt`, `public/docs/` y `dist/docs/` se generan con `scripts/build-docs.mjs`. No corrijas una firma únicamente en el archivo generado: modifica el código/tipos y reconstruye.

El índice de capítulos del generador define qué se publica y qué recibe una IA. Para añadir una guía, regístrala allí y enlázala desde el manual. Los delimitadores `<!-- example:examples/documented-app.html -->` y `<!-- /example -->` mantienen el HTML real entre ambos en el Markdown fuente, el sitio y el texto para IA, evitando una copia divergente del ejemplo ejecutable. Modifica el HTML original y regenera.

## Cambios de API

Actualiza los exports de `src/core.ts` o `src/index.ts`, sus declaraciones y guías. El core debe seguir importándose sin Three.js. Conserva IDs, propiedad de buffers, cancelación y contratos de matrices; no presentes una pose inventada como recuperación. Añade pruebas que reproduzcan el fallo y validación apropiada al cambio.

Antes de distribuir, ejecuta los checks relevantes y `npm run check:package`. Incluye licencias de dependencias y no incorpores assets sin derechos de redistribución. Los cambios de tracking requieren medir calidad geométrica además de contar poses.

La prueba `tests/browser/declarative.test.mjs` valida la capa HTML y el servidor de recursos en otro origen. El registro automático se limita a `src/standalone.ts`; `registerARComponents` es opt-in en ESM y no debe tocar DOM al importar el paquete en Node.

`docs:test-browser` ejecuta el primer HTML completo de la guía de inicio como una aplicación servida junto a la distribución, además de comprobar el lector y las alternativas programáticas. No mantengas un ejemplo de inicio distinto del que consume esta comprobación.

El build genera src/build-info.ts desde las fuentes y package.json. No lo edites a mano. Las pruebas de informes escriben sus fixtures solo en tests/generated, no en la carpeta de resultados físicos del operador. La emulación móvil no aprueba hardware; en WebKit sin API de cámara se comprueba la exportación del error, no seguimiento físico.

Para medir NFT con etapas y precisión: `npm run benchmark:image` genera benchmarks/image-tracking-latest.json sin sobrescribir las capturas históricas before/after. Usa `node scripts/compare-image-tracking.mjs` para comparar las capturas conservadas. Mantén la misma fixture y entorno, y revisa detecciones, falsos positivos, recuperación y error de esquinas junto a los tiempos. Los números no certifican teléfonos.

La suite de soporte escaso se ejecuta con `npm run benchmark:image -- benchmarks/image-support-latest.json sparse`; el tercer argumento opcional del script Node permite cargar un módulo core de baseline local. Los informes históricos image-support-before/after conservan build, fixture y entorno; `node scripts/compare-image-tracking.mjs image-support` verifica compatibilidad y precisión acotada. Una media menor con p95 o error mayores debe documentarse como compromiso, no como mejora uniforme.


El kernel Hamming tiene fuente propia MIT en src/vision/wasm/hamming.wat. Tras editarlo ejecuta `npm run build:hamming`; `node scripts/build-hamming.mjs --check` comprueba el generado sin modificarlo. WABT es solo herramienta dev, no dependencia de ejecución. `npm run benchmark:matching` contrasta la lista completa de matches contra OpenCV y mide por separado el matcher aislado. El build regenera antes del hash; no edites manualmente hamming-binary.ts.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
