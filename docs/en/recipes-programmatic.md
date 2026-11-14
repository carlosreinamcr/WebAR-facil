# Advanced programmatic recipes

## Use files picked by the user

Pass an image File to `addImageTarget`. For a GLB, create an object URL and release it when loading has finished. Load a replacement on the existing model so it stays associated with the target ID.

```js
await app.engine.addImageTarget('poster', imageInput.files[0], { physicalWidthMeters: 0.2 });
const url = URL.createObjectURL(modelInput.files[0]);
try {
  await model.load(url);
} finally {
  URL.revokeObjectURL(url);
}
```

In production, check that the inputs contain files and surface load failures near the corresponding control. Use a single controller to serialize start, stop and content changes.

## Export descriptors or preserve a local map

The [marker chapter](image-targets.md) describes how to export precomputed targets. When using optical SLAM, persist the structured snapshot described in [local maps](maps.md). Store typed arrays using IndexedDB's structured clone support.

## Unmount an experience

Remove listeners created by your page, revoke object URLs you still own, then await `app.dispose()` so the camera, renderer and owned content are released. When mounting another route, create a fresh scene.


## Editable text in AR

Draw the text on a canvas and use it as a `THREE.CanvasTexture` on a `THREE.Sprite`. Redraw on input and set `needsUpdate = true`. Add the sprite to the image or spatial anchor after `ar-ready`.

[Example 4](../../examples/PRUEBAS/04-texto-marcador.html) · [Example 10](../../examples/PRUEBAS/10-texto-slam.html)

## Control scene lighting

On `ar-ready`, get the Three.js scene from `scene.app.scene`. Find the directional light and use the slider value to update its position. Apply the initial value when the scene is ready and update it on `input`.

[Example 6](../../examples/PRUEBAS/06-iluminacion-marcador.html) · [Example 12](../../examples/PRUEBAS/12-iluminacion-slam.html)

## Select model parts

Convert the pointer position to normalized canvas coordinates and use `THREE.Raycaster` with the scene camera. Highlight the first intersected mesh and save its original material state so you can clear the selection.

[Example 19](../../examples/PRUEBAS/19-seleccionar-partes.html)

## Change catalog colors

Update the model's `src` and await `updateComplete`. Then traverse the GLB, find the meshes you want to tint and call `material.color.set(...)`. Reapply the tint when the color input changes.

[Example 20](../../examples/PRUEBAS/20-catalogo-colores.html)

## Combine model text and video

Put the GLB and MP4 in the same `webar-target`. Add the text sprite to the same anchor. Each item has its own visibility or playback control.

[Example 24](../../examples/PRUEBAS/24-contenido-compuesto.html)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
