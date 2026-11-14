# Multiple image markers

Use distinct target images and IDs. The same session can track up to eight targets. Different instances of the exact same print are not independent image IDs.

```html
<webar-scene>
  <webar-target src="./poster-a.jpg" target-id="a">
    <webar-model src="./model-a.glb" size="0.3"></webar-model>
  </webar-target>
  <webar-target src="./poster-b.jpg" target-id="b">
    <webar-model src="./model-b.glb" size="0.2"></webar-model>
  </webar-target>
</webar-scene>
```

With JavaScript, bind groups to their IDs or add the models through `app.addContent(id, model)`. Then register targets using `engine.addImageTarget(id, source, options)`. Subscribe to `targetFound`, `targetLost` and `targetVisibility` and route each event using `targetId`. When transitioning from an image to a surface, explicitly choose the target you intend to preserve.

Large images and multiple simultaneous targets can increase matching cost. Check quality per target, choose visually distinct artwork and test at the distance visitors will use. [Multiple-marker example](../../examples/PRUEBAS/14-varios-marcadores.html)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
