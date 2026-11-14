# Reconocimiento de celulares

El [ejemplo 31](../examples/PRUEBAS/31-reconocer-celular.html) usa un detector de objetos opcional. Apunta a otro celular y activa «Mostrar detección y confianza» para ver el rectángulo detectado. Kai sigue ese rectángulo en pantalla. La detección se ejecuta localmente en un Worker.

## Instalar el detector de celulares (ejemplo 31)

El detector es opcional y se distribuye por separado de `webar-facil.min.js`. Para incorporarlo a tu proyecto, copia `31-reconocer-celular.html`, la carpeta completa `phone-detector/` junto al HTML y el modelo GLB que quieras mostrar.

- Conserva `demo.js`, `worker.js`, `tf.min.js`, `coco-ssd.min.js`, `model.json` y los cinco archivos `group1-shard1of5` a `group1-shard5of5` juntos. El manifiesto de pesos usa esos nombres exactos. Incluye también `LICENSE.txt` y conserva `README.md` como referencia.
- En el HTML, apunta el primer `<script>` a tu copia de `webar-facil.min.js` y conserva `<script type="module" src="./phone-detector/demo.js"></script>`. Si cambias el GLB o la estructura de carpetas, ajusta la ruta en `demo.js`. La ruta del modelo se resuelve desde `demo.js`, no desde el HTML.
- Sirve los archivos por HTTPS o en `localhost` durante el desarrollo. El Worker carga los pesos desde la misma carpeta y procesa la cámara localmente.

Las aplicaciones que solo usan marcadores o SLAM pueden usar el SDK sin copiar el detector.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
