# GLB models and animations

## Configure a model

```html
<webar-model src="./model.glb" size="0.3" scale="1"
  position="0 0 0" rotation="0 180 0" animation="Walk"></webar-model>
```

Provide a self-contained GLB. `size` fits its largest dimension and the wrapper positions its base and center. `scale` multiplies that result, with a single factor or XYZ factors. Rotation uses XYZ degrees in HTML. Position is local to the tracked group. Set size relative to your marker or placement backend and inspect it on the target device.

## Load and animate with JavaScript

```js
const model = new WebARFacil.ThreeARModel();
await model.load('./model.glb', { fitSize: 0.3, autoplay: false });
model.playAnimation('Walk', { loop: 'repeat', speed: 1 });
```

Use `fitSize:false` to preserve model units. The renderer should update animation every frame even if no fresh tracking pose arrived. Stop clips when required and dispose the model and scene when leaving a page or route.

## Compression and rendering cost

The standalone includes Draco and Meshopt. For custom builds, configure Draco decoder paths if external assets are used. Compression primarily reduces transfer size. Inspect triangles, texture sizes, materials, draw calls and animation complexity when a scene is slow. Compare the same experience with a lightweight GLB to isolate render cost. [Camera and performance](camera-performance.md)

Change `src` to replace content and await the element's `updateComplete`. Use the [animation example](../../examples/PRUEBAS/15-animaciones-glb.html) to inspect clips and the [interaction guide](interaction.md) for playback controls.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
