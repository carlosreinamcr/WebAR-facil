# Implemented architecture

| Layer | Owns |
| --- | --- |
| Camera | Permission, video track, frame scheduling and capture settings. |
| Workers and WASM | Feature extraction, matching and optical processing away from the UI thread. |
| Image tracker | Marker compilation, frame-to-frame tracking, geometric checks and redetection. |
| Spatial tracking | Native XR hit testing or optical motion and surface estimates. |
| Engine | Lifecycle, target events, pose delivery and backend coordination. |
| Wrappers | Three.js and A-Frame scene updates, models, video and declarative elements. |

Workers report transforms and diagnostics to the engine. Rendering may continue between tracking updates, which allows animations to remain smooth while pose processing runs at a different cadence. The public API can be integrated without the declarative layer. See [advanced API](advanced.md) and [implementation checks](verification.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
