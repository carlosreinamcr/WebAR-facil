# Three.js integration

Use the standalone bundle's `THREE` namespace together with its wrappers, or import the module build and Three.js through the same bundler setup. Keep objects and loaders on a compatible Three.js instance.

| Wrapper | Responsibility |
| --- | --- |
| `ThreeARScene` | Managed camera, renderer, render loop and pose application. |
| `ThreeARGroup` | Tracked transform for an existing scene graph. |
| `ThreeARModel` | GLB loading, model normalization and animation. |
| `ThreeARVideo` | Video texture and optional chroma material. |

## Use an existing renderer

[Example 29 · Three.js with a custom renderer](../../examples/PRUEBAS/29-threejs.html) shows an animated GLB on an image target with the camera, projection and render loop managed in JavaScript.

Bind the tracked group to the target ID. The group applies the world matrix and follows engine visibility. Derive the camera transform from the inverse view matrix and apply the matching projection.

```js
const tracked = new ThreeARGroup().bind(engine, 'poster');
scene.add(tracked);
camera.matrixAutoUpdate = false;
const unsubscribe = engine.onPose((_matrix, pose) => {
  if (pose.backend === 'webxr') return;
  camera.matrix.fromArray(pose.viewMatrix).invert();
  camera.updateMatrixWorld(true);
  if (pose.projectionMatrix) {
    camera.projectionMatrix.fromArray(pose.projectionMatrix);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
});
```

Use a child for local transforms. Keep the viewport and video crop aligned. If you only have model-view and update the group manually, use an identity camera. In immersive WebXR the renderer owns the XR camera and frame loop. On teardown, call `unsubscribe()` and `tracked.dispose()`, then release your own scene objects. See [the complete custom app](../../examples/custom-app.html) and [coordinates](concepts.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
