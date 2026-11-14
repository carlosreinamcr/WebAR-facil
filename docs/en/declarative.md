# Applications with declarative HTML

Use `webar-scene` for the camera, renderer and controls. Put each model or video inside its `webar-target` in image mode. In surface mode, put the content directly in the scene. See the [complete first app](getting-started.md).

## Scene attributes

| Attribute | Default or effect |
| --- | --- |
| `mode` | `image`; use `slam` for markerless placement |
| `backend` | `auto` in image mode; `optical-flow` in SLAM mode |
| `slam` | Adds the transition control to an image scene |
| `keep-content-on-lost` | Holds the last displayed transform when enabled |
| `loss-grace` | 500 ms |
| `performance` | `auto`, `balanced`, `battery` or `quality` |
| `camera-width`, `camera-height`, `fps` | Requested capture settings; the browser negotiates the stream |
| `analysis-width`, `analysis-pixels` | Analysis limits; auto/balanced cap at 640 px wide and 307,200 pixels |
| `pixel-ratio`, `antialias` | Renderer controls; default maximum pixel ratio 2 and MSAA enabled |
| `asset-base`, `opencv-url`, `draco-path` | Optional explicit paths for external runtime and decoder assets |
| `gestures`, `min-scale`, `max-scale` | Opt-in selection, rotation and scaling; initial bounds 0.1 and 100 |
| `scan-guide`, `surface-grid` | Marker scan guide and surface grid, enabled by default |
| `placement` | `auto` or `manual`; manual optical placement needs a recent proposal |
| `media-menu`, `fullscreen-view` | Optional capture menu and full-viewport session controls |
| `diagnostics`, `keyframe-correction` | Optional local reports and experimental optical keyframe correction |

Boolean attributes accept an empty value, `true` or `false`. Use CSS to override the default `100dvh` height. Camera/backend configuration is read at startup. Stop, apply the new values and start again when changing those settings. [Camera details](camera-performance.md)

## Image and content attributes

`webar-target` takes a JPG, PNG or compiled WART file through `src`, a `target-id`, and `physical-width` in meters. Omitted IDs become `target-0`, `target-1` and so on. The default physical width is 0.2 m. Use up to eight different images. [Multiple markers](multiple-targets.md)

`webar-model` loads a self-contained GLB, including Draco and Meshopt. Use `size` for the largest dimension (default 0.16), `scale` for uniform or XYZ scaling, `rotation` for XYZ degrees, and `position` for local XYZ coordinates. `animation` accepts an exact name, zero-based index or `none`. By default the first available clip plays.

`webar-video` accepts MP4, `width`, `orientation`, `autoplay`, `muted`, `loop` and chroma options. [Interaction reference](interaction.md)

## Camera and media controls

Use `media-menu` for camera presets, photo and microphone video. Saving and sharing use browser capabilities. The composited recording path applies to web camera scenes. Native immersive WebXR camera imagery is outside that path. Use `fullscreen-view` for full-viewport viewing and a session dialog.

## Use JavaScript with HTML elements

```js
const scene = document.querySelector('webar-scene');
scene.addEventListener('targetFound', event => console.log(event.detail.targetId));
scene.addEventListener('trackingQuality', event => console.log(event.detail.issues));
scene.addEventListener('ar-error', event => console.error(event.detail));
```

| Event | Payload or meaning |
| --- | --- |
| `ar-ready`, `ar-stopped` | Prepared `{app}`, or `null` after stopping |
| `ar-error`, `ar-status` | Error, or `{message}` |
| `ar-pose`, `ar-slam` | Accepted `ARPose`, or transition result |
| `modelLoaded`, `animationFinished` | `{animations}`, or `{name}` |
| `videoLoaded`, `videoPlayBlocked` | `{width,height}`, or playback error |
| `ar-select`, `ar-gesture` | Pointer selection and transforms |
| `contentUpdated`, `ar-placement` | Synchronized content, or placement `{state}` |
| `targetFound`, `targetLost`, `targetVisibility`, `trackingQuality` | Same payloads as the [engine events](events.md) |

`start()`, `stop()`, `refresh()` and `enableSLAM(options?)` return promises. Await `model.updateComplete` after changing a model source. Use `scene.refresh()` after changing the hierarchy. `scene.app` and `scene.engine` are available during the session. Scene `stop()` disposes the managed renderer and resources. Removing the element in an SPA also frees resources.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
