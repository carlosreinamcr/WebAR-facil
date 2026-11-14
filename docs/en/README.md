# WebAR Fácil documentation

**[Español](../README.md)** · **English**

WebAR Fácil is an MIT-licensed TypeScript library for building browser-based augmented reality. The standalone build includes the renderer, vision runtime, workers and model decoders. Start with HTML or use the JavaScript API to control the camera, tracking and rendering yourself.

## Start here

1. [Your first HTML app](getting-started.md) gets a JPG or PNG marker and a GLB on screen.
2. [Declarative HTML](declarative.md) describes scene attributes, content and events.
3. [Declarative recipes](recipes.md) adds transforms, animations and transitions.
4. [Installation and distribution](installation.md) explains the standalone, ESM and core builds.

| Goal | Where to start |
| --- | --- |
| Add a model, video, gestures or several image targets | [Declarative HTML](declarative.md), [Interaction](interaction.md), [Multiple markers](multiple-targets.md) |
| Show a model when the camera detects a phone | [Phone recognition](phone-detection.md) |
| Control rendering and the engine in JavaScript | [Programmatic integration](programmatic.md), [WebAREngine](api-engine.md), [Three.js](threejs.md), [A-Frame](aframe.md) |
| Place content in space and recover a saved map | [Spatial tracking](spatial-tracking.md), [Placement](placement.md), [Local maps](maps.md) |
| Tune capture and diagnose tracking | [Camera and performance](camera-performance.md), [Events](events.md), [Diagnostics](diagnostics.md) |
| Check what is implemented and tested | [Generated API](api-generated.md), [Verification](verification.md), [Physical-device acceptance](device-validation.md) |
| Generate a working example with an AI assistant | [AI integration contract](ai-guide.md), [JSON API contract](../api.json) |

## Run an example

The [gallery of 31 examples](../../examples/PRUEBAS/index.html) covers markers, gestures, 3D models, video, surfaces and local maps. Use the [image example](../../examples/declarative.html) for a first test, the [video example](../../examples/declarative-video.html) for chroma key, or the [placement example](../../examples/declarative-placement.html) for a surface.

Image tracking and optical odometry work with ordinary camera capture. Native immersive WebXR depends on the browser and device. Optical placement without a metric reference uses relative scale. [Tracking modes](spatial-tracking.md)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
