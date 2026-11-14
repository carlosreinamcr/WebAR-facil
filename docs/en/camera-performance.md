# Camera, focus and performance

Set `performance` on the scene. The preset influences capture and processing budgets. Actual video dimensions, frame rate and focus capabilities depend on the camera track and browser.

```html
<webar-scene performance="auto">
  <webar-target src="./poster.jpg" target-id="poster">
    <webar-model src="./model.glb" size="0.35"></webar-model>
  </webar-target>
</webar-scene>
```

| Profile | Typical use |
| --- | --- |
| `auto` | Start here when the device capabilities are unknown. |
| `battery` | Reduce processing load for long sessions or constrained hardware. |
| `balanced` | Compare tracking and render cadence under a consistent workload. |
| `quality` | Test whether additional detail helps a small or distant marker. |

Compare a lightweight model and the production GLB with the same marker and profile. If tracking remains steady while rendering slows, inspect geometry, texture sizes and draw calls. If detection worsens as resolution falls, let the marker occupy more of the image. Test camera switching and autofocus on the physical device before drawing conclusions from a desktop webcam. See [diagnostics](diagnostics.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
