# Acceptance on physical devices

Run the same scenarios on desktop, iPhone and Android where supported. Keep camera/browser versions, tested backend and assets with each result. For weaker devices, repeat a run with `performance="battery"` and compare both the render experience and detection reliability.

- **Camera.** Grant and deny permission, stop, restart, and return from a background tab.
- **Images.** Acquire both a large and a small marker, tilt it, obscure it and bring it back.
- **Interaction.** Select a model, drag and pinch while keeping the page controls usable.
- **Content.** Play an animated GLB and a video, then swap content during the session.
- **Spatial.** Place on a textured surface, walk around it, lose tracking and try to recover.
- **Maps.** Save a local optical map, restart and revisit the same viewpoint.
- **Capture.** Try saving a photo and a recording when the device and browser offer capture.

Record unavailable native features separately from failed tests. The optical backend and WebXR may produce different scale and recovery results. See [diagnostics](diagnostics.md) for collecting reproducible evidence.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
