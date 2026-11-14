# Programmatic integration

Use the standalone script with a regular HTML page. `WebARFacil` exposes the same classes as the legacy `WebARFacil` global.

```js
const { ThreeARScene, ThreeARModel } = WebARFacil;
const app = new ThreeARScene({ container: document.querySelector('#view') });
const model = new ThreeARModel();
app.addContent('poster', model);

document.querySelector('#start').onclick = async () => {
  await app.engine.startCamera();
  await model.load('./model.glb', { fitSize: 0.3 });
  await app.engine.addImageTarget('poster', './poster.jpg', {
    physicalWidthMeters: 0.2,
  });
};
document.querySelector('#stop').onclick = () => app.engine.stop();
addEventListener('pagehide', () => { void app.dispose(); });
```

Provide a container with a visible height and buttons with the IDs shown above. In a production app, catch failures and report them to the user. After stopping, register the targets again when restarting.

With your own Three.js scene, use `ThreeARGroup.bind(engine, targetId)` or subscribe to `engine.onPose((matrix, pose) => { … })`. The pose includes model-view, world, view and projection matrices. When applying a tracked world matrix directly, disable automatic matrix updates for the tracked group and apply the camera view separately.

For an existing A-Frame application, use the [A-Frame component](../aframe.md) and the [working A-Frame example](../../examples/PRUEBAS/25-aframe.html). The [Three.js guide](../threejs.md) and [full API reference](../api-generated.md) provide exact signatures. Existing package imports use the package identifier `webar-facil`.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
