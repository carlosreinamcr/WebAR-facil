# Local diagnostics for iPhone and Android

Use diagnostics in development to reproduce camera, rendering and tracking problems. For a controlled comparison, use the same marker or surface, camera distance, scene and sequence of movements on both phones. Record the browser, backend and performance preset with each run.

1. Open the development diagnostics tool over HTTPS.
2. Start one scene and let the camera settle before collecting a baseline.
3. Repeat the action that causes the issue, such as covering the marker or moving the phone sideways.
4. Export the report and identify the run by device and scenario.

| Observation | Signals to compare |
| --- | --- |
| Model stutters while marker stays visible | Render cadence, frame time, model complexity and device load. |
| Model jumps after occlusion | Target loss and recovery events, pose quality and marker size in frame. |
| Optical anchor moves with camera motion | Backend, initialization, parallax and relocalization. |

Development diagnostics use structured measurements. The public gallery omits the report controls. See [camera and performance](camera-performance.md) and [odometry validation](odometry-validation.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
