# Image markers and compilation

## Choose an image

Use a sharp JPG or PNG with distinctive features distributed across the image. A planar print or a static screen works best. Large blank areas, repeating motifs, glare, blur and a very small image in the camera all make matching harder.

```html
<webar-target src="./poster.jpg" target-id="poster" physical-width="0.2">
  <webar-model src="./model.glb"></webar-model>
</webar-target>
```

The scene compiles the target automatically. Use the actual width in meters for physical scale. The tracking transform applies to the image plane and content can be repositioned locally.

## Use the engine compiler

```js
const result = await engine.addImageTarget('poster', './poster.jpg', {
  physicalWidthMeters: 0.2,
  maxDimension: 1024,
});
console.log(result.metadata.quality);
```

The source can be a URL or a Blob/File. The compiler checks input size and format, constrains the working resolution, and extracts features in a worker. The result includes a WART binary buffer and metadata. Quality warnings describe properties such as low texture or weak feature distribution. They are indicators, not a guarantee of real-world detection.

## Compile once and reuse

For a deployment that needs deterministic precompiled assets, use the repository's compiler script or `MarkerCompiler`. Save the binary as `.dat` and load it through `addTarget()` or a declarative target source. The JSON metadata is optional. Keep marker IDs and scale consistent when replacing assets. Use a new URL for a changed image when cache behavior matters.

See the [API reference](api-generated.md) for compiler options, the [quality events](events.md) for live detection, and [multiple markers](multiple-targets.md) for independent targets.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
