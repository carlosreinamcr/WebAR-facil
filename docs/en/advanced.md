# Advanced API and extensions

Choose the level of integration that matches the application.

| Need | Entry point |
| --- | --- |
| Camera stream and frames only | `CameraManager` |
| Image processing and target matching | `Tracker` |
| Precompile an image target | `ImageCompiler` |
| Native immersive AR and hit testing | `SLAMManager` |
| Optical odometry and local relocalization | `OpticalFlowSLAM` |
| Coordinate camera, targets and backend switching | `WebAREngine` |

When driving `Tracker` directly, respect frame ownership for transferred pixel buffers and the worker's backpressure. Stop frame production and dispose of workers when the application ends. Preserve camera intrinsics when adjusting the frame dimensions. For custom pose consumption, start with [coordinate conventions](concepts.md), then read the signatures in the [generated API](api-generated.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
