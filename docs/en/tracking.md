# Tracking and placement

Image tracking uses visual features from a flat JPG or PNG marker. It works with a desktop webcam or a mobile camera. Use a sharp image with distinctive details distributed across it. Repeating patterns, glossy prints, blur and very small targets can reduce tracking quality. A guide shows while the engine searches for the marker.

To place content on a surface, use a SLAM scene:

```html
<webar-scene mode="slam" backend="optical-flow" placement="manual" surface-grid>
  <webar-model src="./model.glb" size="0.5"></webar-model>
</webar-scene>
```

Move the phone slowly across a textured area. Confirm placement when the control becomes available. The grid shows the engine's estimated placement plane. It does not measure the edges of a physical surface.

- `backend="webxr"` requests a native immersive AR session with hit testing on supported devices. Select the surface inside the session.
- `backend="optical-flow"` uses local visual odometry in a Worker. Without a metric reference it uses relative scale. Drift and tracking loss remain possible.
- The [experimental metric example](../../examples/PRUEBAS/28-escala-metrica.html) records evidence from the camera and motion sensors. Its physical accuracy has not been validated.

The optical backend can export and import local maps using `exportSLAMMap()` and `importSLAMMap()`. Imported content must wait for successful relocalization. The [local maps example](../../examples/PRUEBAS/13-mapas-locales.html) demonstrates persistence in IndexedDB. See the [spatial tracking reference](../spatial-tracking.md) for backend selection and transitions.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
