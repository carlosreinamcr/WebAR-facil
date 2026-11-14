# Preparar la alfa pública

La compilación candidata es v0.1.0-alpha.6. Ofrece seguimiento de marcadores, GLB, vídeo con chroma y colocación por cámara. La odometría monocular se considera experimental y puede acumular deriva. WebXR nativo se prueba aparte porque la disponibilidad depende del navegador y del dispositivo.

## Probar la distribución

Genera y verifica el paquete desde la carpeta del proyecto:

```sh
npm ci
npm run build
npm test
npm run docs:check
npm run check:release
python scripts/package-alpha.py
```

En Windows también puedes ejecutar el último comando con `py -3`. El ZIP y su SHA-256 quedan en `artifacts/`. Descomprime el ZIP y sirve `dist/` mediante HTTP en localhost o HTTPS en el teléfono. Abre `examples/alpha.html` desde ese servidor para elegir una de las tres demos. El ZIP contiene los modelos, los marcadores, el vídeo, OpenCV, los decodificadores y las licencias.

## Antes de etiquetar en GitHub

1. Repite la [comparación móvil](diagnostics.md) con el build candidato. Registra iPhone 17 Pro como referencia de gama alta y el Android actual como prueba de estrés. Registra Android de gama media cuando haya evidencia de ese segmento.
2. Configura la identidad Git local y prepara el primer commit con el código del proyecto. Verifica que el índice excluya `reports/local-devices/`, `artifacts/`, `dist/` y configuraciones o recursos del sitio XAMPP. La distribución se adjunta al release como ZIP.
3. Verifica el build y CI desde un clon limpio. Los medios de demo y las dependencias tienen su procedencia en los avisos de terceros y en la guía de recursos de los ejemplos.
4. Una vez elegido el repositorio remoto, publica el código, etiqueta `v0.1.0-alpha.6` y adjunta el ZIP y su SHA-256 a una release preliminar. Enlaza las tres demos cuando estén servidas por HTTPS.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
