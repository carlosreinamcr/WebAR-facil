# Problemas frecuentes

## HTML dentro de Examples y recursos dentro de Examples/assets

Para una instalación estática con Examples, dist y recursos propios, las rutas dependen del directorio del HTML. Con esta estructura:

```text
mi-sitio/
  dist/webar-facil.min.js
  Examples/index.html
  Examples/01-modelo-marcador.html
  Examples/assets/marcador.jpg
  Examples/assets/robot.glb
```

usa `../dist/webar-facil.min.js` para el SDK y `./assets/marcador.jpg` para la imagen. `../assets` apuntaría a `mi-sitio/assets`, otra carpeta. Si un standalone antiguo solicita `vision/opencv.js` y falla, sustituye el JS por la versión que incorpora OpenCV y Draco. Revisa también si el HTML define una ruta externa mediante `asset-base`, `opencv-url` o `draco-path`.

La herramienta scripts/configure-examples-paths.mjs prepara los 25 ejemplos de una instalación existente, conserva opciones/código y recursos del usuario, repone solo recursos de ejemplo ausentes y verifica enlaces antes de aplicar. --apply guarda los HTML anteriores en _webar-backups dentro del sitio. La copia preparada y el plan quedan en artifacts/examples-configured del repositorio. No es una exportación completa de imágenes/modelos privados.

```sh
node scripts/configure-examples-paths.mjs --site ./mi-sitio
node scripts/configure-examples-paths.mjs --site ./mi-sitio --apply
```

scripts/verify-examples-installation.mjs permite comprobar el servidor HTTP real con cámara sintética, recursos, inicio y cierre. Esa comprobación no certifica cámara física, precisión o rendimiento de teléfono. El informe local queda en artifacts/examples-configured/verification.json.

| Síntoma | Comprobación y solución |
| --- | --- |
| CORS con `file:///...` y origen `null` | Inicia `npm run dev` y abre la URL HTTP; no abras el archivo con doble click |
| “Ejecuta npm run build” / bundle 404 | Ejecuta el build y verifica la ruta exacta del script; `standalone` y bundle peer son archivos diferentes |
| `Unexpected token '<'` en un Worker o JS | El servidor entregó HTML para una ruta inexistente; publica los Workers y corrige el fallback del servidor |
| `WebARFacil` no existe | El script no se descargó, se ejecutó después de tu código o cargaste un ESM como script clásico |
| `THREE is not defined` | Usa standalone o carga un global Three compatible antes del IIFE sin Three |
| No resuelve `three` en ESM | Instala el peer en NPM o configura un importmap; no mezcles copias incompatibles |
| Cámara no disponible | Revisa HTTPS, permisos del sistema/navegador, iframe y si otra app ocupa la cámara |
| Funciona en PC pero no al abrir una IP desde teléfono | Necesitas HTTPS confiable; el localhost del PC no es el del teléfono |
| Pantalla vacía sin errores | Da dimensiones al contenedor, pulsa Iniciar y comprueba iluminación y la visibilidad del target |
| HTML declarativo vacío, sin botón Iniciar AR | Comprueba la ruta del standalone, actualiza el JS del sitio y verifica `customElements.get('webar-scene')`; un bundle antiguo no registra estas etiquetas. Conserva el párrafo de respaldo del ejemplo |
| Reconoce pero el objeto tiembla o parpadea | Revisa calidad, tamaño/nitidez, tolerancia y filtrado; no alternes `visible` cada vez que no llegue una pose |
| El GLB se reinicia al detectar | Carga una sola vez; no llames `load()` o `playAnimation()` desde cada `onPose` |
| Se queda en pantalla al retirar marcador | Desactiva `setKeepContentOnLost(true)` si no deseas retención; retención no es SLAM |
| GLB Draco no aparece | Verifica ruta `dracoDecoderPath` y descarga del decoder JS/WASM; observa el rechazo de `load()` |
| Modelo gigante, pequeño o fuera de plano | Revisa `physicalWidthMeters`, `fitSize`, pivot y escala interna del GLB |
| KTX2 o recursos GLTF externos rechazados | Usa GLB autocontenido con texturas compatibles; ese cargador no implementa KTX2 |
| Vídeo no reproduce | Espera metadata, usa un botón para `play()`, captura su rechazo y prueba el codec real |
| El verde no se elimina bien | Ajusta color, similarity, smoothness y spill; usa iluminación uniforme del fondo |
| Segundo marcador reemplaza al primero | Usa `addImageTarget(id,...)`; `loadImageTarget` reemplaza todos por `default` |
| Error de operación concurrente | Espera cada configuración del motor en orden; no uses Promise.all en cargas/configuración del motor |
| Después de stop no rastrea | `stop()` borra targets; abre cámara y vuelve a registrarlos |
| Matrices parecen invertidas | Usa el contrato ModelView/mundo/vista; no apliques dos veces conversiones OpenCV ni la matriz de vista |
| “SLAM activado” pero no hay objeto | Inspecciona `result.placement`: puede pedir escaneo, selección o suelo con paralaje |
| Al retirar el marcador falla el fallback | Necesita estructura 3D del entorno; textura solo en un plano o rotación sin traslación no bastan |
| Mapas restaurados sin pose | Espera relocalización y comprueba proyección/cámara compatibles; no uses la pose almacenada como medición |
| Favicon 404 | Añade un icono o `<link rel="icon" href="data:,">`; ese 404 no explica un fallo de tracking |

## Qué adjuntar al reportar un problema

Versión de la librería, navegador y SO, modelo de dispositivo, protocolo/URL de alojamiento, backend seleccionado, pasos mínimos, errors de consola y rutas HTTP fallidas. Añade resolución efectiva de cámara, opciones de análisis, `trackingQuality` y métricas de procesamiento. Incluye una imagen de referencia y un GLB de prueba redistribuibles cuando sea posible.

Separa “no se detecta”, “pose inestable”, “render incorrecto” y “medio no carga”. Cada caso tiene fuentes distintas. Evita enviar frames o mapas sensibles sin consentimiento. Usa [verificación](verification.md) para distinguir una prueba sintética de una limitación confirmada en hardware real.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
