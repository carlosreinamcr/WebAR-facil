# Declarative HTML recipes

## Size, rotation and animation

```html
<webar-model id="avatar" src="./avatar.glb" size="0.3"
  rotation="0 180 0" animation="Walk" animation-loop="repeat"></webar-model>
```

```js
const avatar = document.querySelector('#avatar');
avatar.setAttribute('size', '0.45');
avatar.setAttribute('rotation', '0 90 0');
avatar.addEventListener('modelLoaded', ({detail}) => console.log(detail.animations));
```

To retain content after the marker disappears, enable `keep-content-on-lost` on the scene. During a running session use the engine method and keep the markup in sync if the choice should survive restart. A retained object stays on the last known transform.

## Change a model from a button

```js
document.querySelector('#change-model').onclick = async () => {
  const avatar = document.querySelector('#avatar');
  avatar.setAttribute('src', './second.glb');
  await avatar.updateComplete;
};
```

Use a different target ID when the physical image changes. Use `scene.refresh()` after DOM hierarchy changes. When you only update a model source, retain the original target and camera.

## Place content on a surface

```html
<webar-scene mode="slam" backend="optical-flow" placement="manual">
  <webar-model src="./model.glb" size="0.5"></webar-model>
</webar-scene>
```

To transition from image mode, add `slam` to the scene. Start on the marker, then use the transition control. Confirm the proposed location if the chosen placement mode requires confirmation. [Spatial transitions](spatial-tracking.md)

For hands-on examples, see the [gallery](../../examples/PRUEBAS/index.html) and the [advanced recipes](recipes-programmatic.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
