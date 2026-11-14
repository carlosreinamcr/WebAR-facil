# Spatial tracking with WebXR and optical fallback

WebXR and optical tracking both expose placement poses. Select the backend with `backend="auto"`, `backend="webxr"`, or `backend="optical-flow"`. Auto can use WebXR when immersive AR and hit testing are available. Use the optical backend to test camera-based tracking explicitly, including on iOS browsers where immersive AR is unavailable. A declarative SLAM scene defaults to optical tracking.

```html
<webar-scene mode="slam" backend="optical-flow" placement="manual">
  <webar-model src="./chair.glb" size="0.5"></webar-model>
</webar-scene>
```

1. Open the page over HTTPS and start AR with the scene button.
2. Aim at a textured surface and move the phone slowly to produce parallax.
3. Wait for a placement guide and confirm the position.
4. Move sideways and return to the initial view to inspect drift.

In native WebXR, accept the browser’s immersive prompt and confirm placement inside the session. Optical tracking estimates camera motion and a local surface from frames. Its scale is relative when no metric reference is available. A marker with a known physical width can seed metric scale under suitable conditions. Markerless metric tracking remains experimental. Use [device validation](device-validation.md) to compare backends.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
