# Phone recognition

[Example 31](../../examples/PRUEBAS/31-reconocer-celular.html) uses an optional object detector. Point at another phone and enable «Mostrar detección y confianza» to see the detected box and confidence. Kai follows the box on screen. Inference runs locally in a worker.

## Install the phone detector (example 31)

The detector is optional and distributed separately from `webar-facil.min.js`. To add it to your project, copy `31-reconocer-celular.html`, the entire `phone-detector/` folder alongside the HTML, and the GLB model you want to show.

- Keep `demo.js`, `worker.js`, `tf.min.js`, `coco-ssd.min.js`, `model.json`, and all five files from `group1-shard1of5` through `group1-shard5of5` together. The weights manifest uses those exact names. Include `LICENSE.txt` and keep `README.md` for reference.
- In the HTML, point the first `<script>` to your copy of `webar-facil.min.js` and keep `<script type="module" src="./phone-detector/demo.js"></script>`. If you change the GLB or folder layout, update the path in `demo.js`. The model path resolves relative to `demo.js`, not the HTML.
- Serve the files over HTTPS or use `localhost` during development. The worker loads the weights from its own folder and processes camera frames locally.

Apps that only use markers or SLAM can use the SDK without copying the detector.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
