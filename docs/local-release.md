# Identificación y distribución local

El alojamiento público y la web del proyecto se posponen. Esta revisión no publica un paquete ni crea un CDN. Los artefactos locales permiten identificar exactamente qué código probó cada dispositivo.

```sh
npm run build
npm run check:release
npm run check:package
```

El build genera LIBRARY_VERSION desde package.json y LIBRARY_BUILD como hash determinista del código/configuración del runtime. Ambos se exportan desde core/standalone y se incluyen en diagnósticos. No equivale a una firma criptográfica ni certificación.

Dist/release.json enumera archivos, tamaños y SHA-256; check:release comprueba su integridad. Cambiar archivos después de generarlo exige regenerar el manifest. Si solo regeneras documentación, ejecuta `node scripts/release-manifest.mjs` al terminar. El tarball local queda en artifacts con la versión del paquete.

Dos builds de desarrollo pueden conservar la misma versión y tener build ID distinto. Para comparar informes usa ambos identificadores. Cuando se publique una versión estable, habrá que definir releases inmutables y la política de cache junto al alojamiento elegido.

La distribución incluye Workers, OpenCV/WASM, decoders, medios originales, ejemplos y documentación. No basta copiar el JS suelto si los recursos no están alojados donde espera el SDK. [Instalación](installation.md) y [despliegue](deployment.md) describen su disposición; un servidor HTTP local no aporta por sí solo HTTPS para el teléfono.

Los HTML empaquetados que cargan el standalone llevan ?build=... para renovar la URL del recurso con cada compilación. La herramienta device-tests además compara el build esperado del HTML con el del SDK cargado y lo muestra antes de iniciar. Vite expande la misma marca en el HTML fuente. Copia el conjunto dist actualizado: cambiar solo el HTML no actualiza un JS antiguo alojado en otra carpeta.

La comprobación de build de device-tests es informativa cuando el SDK cargado sigue siendo compatible. La advertencia persiste durante la prueba y no bloquea la cámara; el informe conserva su build real. Un SDK no cargado o sin las APIs requeridas se distingue de una discrepancia de identificadores.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
