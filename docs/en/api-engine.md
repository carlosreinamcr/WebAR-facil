# WebAREngine

`WebAREngine` manages camera access, image tracking, spatial tracking and event subscriptions. Create a scene wrapper for a managed renderer, or supply your own renderer and consume the engine's poses.

| Task | Public method |
| --- | --- |
| Start camera | `startCamera()` |
| Register an image | `addImageTarget(id, source, options)` |
| Load a compiled target | `loadTarget(url)` |
| Start spatial tracking | `enableSLAM(options)` |
| Listen for transforms | `onPose(callback)` |
| Listen for visibility or quality | `on('targetFound', callback)`, `on('targetLost', callback)`, `on('trackingQuality', callback)` |
| Persist an optical map | `exportSLAMMap()`, `importSLAMMap(snapshot)` |
| Release the session | `stop()` |

Pass a measured `physicalWidthMeters` when size matters. Set `imageLossGraceMs` and `keepContentOnLost` to control temporary loss and final visibility. Await operations that change tracking state and dispose of application listeners on unmount. See the [generated reference](api-generated.md) for exact types.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
