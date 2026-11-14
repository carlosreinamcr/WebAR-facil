# A-Frame integration

Load A-Frame first, create an engine and register the official components before A-Frame initializes the associated scene. The tracker component binds the entity to a target ID, while model and video components provide content helpers.

```js
const { WebAREngine, registerAFrameComponent, registerAFrameModelComponent,
  registerAFrameVideoComponent } = window.WebARFacil;
const engine = new WebAREngine();
registerAFrameComponent(AFRAME, engine);
registerAFrameModelComponent(AFRAME);
registerAFrameVideoComponent(AFRAME);
```

```html
<a-entity my-ar-tracker="targetId: poster">
  <a-entity gltf-model="url(./robot.glb)" scale="0.2 0.2 0.2"></a-entity>
</a-entity>
```

Start the engine from a button and register the same `poster` ID. Put authored transforms on a child entity, because tracking controls the parent's matrix. If another A-Frame component also drives the camera, resolve that ownership before starting AR. See [engine API](api-engine.md).

| Component | Properties |
| --- | --- |
| `my-ar-tracker` | `target`, `targetId`, `physicalWidth` |
| `my-ar-model` | `src`, `fitSize`, `autoplay` |
| `my-ar-video` | `src`, `width`, `chromaKey`, `keyColor`, `similarity`, `smoothness`, `spill`, `muted`, `loop` |

Set the tracker component's `target` after the camera starts if you want it to load the reference. A `.dat` file goes through compiled target loading. An image URL is compiled by the engine. Listen for `ar-error` on the tracker and `ar-model-error` on the model. If you remove the entity that owns a marker, remove its target explicitly with `engine.removeTarget(id)`. See the [complete A-Frame example](../../examples/PRUEBAS/25-aframe.html).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
