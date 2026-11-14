# Recursos de las recetas 14–25

Los HTML están en examples/PRUEBAS y usan rutas ../assets/nombre. Copia estos archivos a la carpeta assets que ya utilizas:

- marcador.jpg: imagen principal. JPG original del proyecto; si usas tu propia imagen, conserva el nombre.
- marcador2.jpg: segunda imagen distinta para el ejemplo 14. No debe ser una copia de marcador.jpg.
- robot.glb: modelo original ligero con piezas nombradas cabeza, cuerpo, ojo, brazo y pierna. El ejemplo 19 usa esas piezas.
- cohete.glb: segundo modelo original para el catálogo; el cuerpo se llama fusaje en este recurso.
- animaciones.glb: robot con los clips Giro, Salto y Asentir. El ejemplo 15 consulta nombres reales del GLB.
- video.mp4: recurso original H.264 rojo sobre verde para los ejemplos 16 y 24. Puedes sustituirlo por otro MP4 compatible.
- aframe.min.js: A-Frame 1.8.0 local, solo para 25. No se necesita en las otras recetas.
- AFRAME-LICENSE.txt: licencia MIT oficial de esa copia de A-Frame.

No se necesitan archivos .dat/JSON adicionales ni fuentes externas. El SDK y su runtime WASM permanecen en la carpeta dist, junto con vision, workers, decoders y el resto de la distribución.

Los recursos multimedia originales usan la licencia MIT del proyecto. A-Frame conserva su propia licencia. Procedencia: https://aframe.io/releases/1.8.0/aframe.min.js y https://raw.githubusercontent.com/aframevr/aframe/v1.8.0/LICENSE. Solo se retiró el comentario sourceMappingURL del JS para evitar solicitar un archivo de depuración no incluido.

Los modelos y JPG/MP4 originales se preparan con node scripts/generate-pruebas-extra-assets.mjs. El script conserva los archivos que ya existan, para no sustituir recursos elegidos por el usuario. A-Frame se conserva como recurso local fijado; el build no lo descarga de Internet.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
