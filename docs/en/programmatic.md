# Advanced programmatic integration

Use `ThreeARScene` when the application needs buttons, application state or runtime content changes while delegating rendering and camera composition to the library. The scene owns a renderer, camera, lights and animation loop. Load your assets, start the camera from a user action and register the image target.

```js
const { ThreeARScene, ThreeARModel } = window.WebARFacil;
const app = new ThreeARScene({ container: document.querySelector('#view') });
const model = new ThreeARModel();
app.addContent('poster', model);
document.querySelector('#start').addEventListener('click', async () => {
  try {
    await app.engine.startCamera();
    await app.engine.addImageTarget('poster', './poster.jpg', { physicalWidthMeters: 0.2 });
    await model.load('./robot.glb');
  } catch (error) {
    console.error(error);
    await app.engine.stop();
  }
});
```

Match the target ID used by `addContent` and `addImageTarget`. Call `app.dispose()` on unmount. If you stop and restart the engine, register your targets again. For the declarative equivalent see [first application](getting-started.md). For an existing renderer see [Three.js](threejs.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
