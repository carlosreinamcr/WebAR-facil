# Events, tracking continuity and diagnostics

## Track lifecycle and visibility

| Event | Main fields | Use |
| --- | --- | --- |
| `targetFound` | `targetId`, `timestampMs`, `pose` | First detection or reacquisition |
| `targetLost` | `targetId`, `timestampMs`, `retained`, `reason` | Confirmed loss, removal or stop |
| `targetVisibility` | `targetId`, `visible`, `reason` | Control visibility in a custom renderer |
| `trackingQuality` | `targetId`, `timestampMs`, `state`, `score`, `processingMs`, `issues`, `diagnosis` | Guide users and diagnose tracking |

Listen through `scene.addEventListener(name, callback)` and read `event.detail`, or subscribe via `engine.on(name, callback)`. The engine returns an unsubscribe function. `ar-ready` means the scene is prepared. Use target events to determine whether a marker is visible.

## Avoid flicker and restarts

The loss grace period absorbs brief interruptions. The target states are `tracking`, `recovering` and `lost`. Found/lost events occur on transitions, so load assets once and keep playback independent of these events. Enable `keep-content-on-lost` to retain the last displayed transform after confirmed loss. In a running scene, call `scene.engine.setKeepContentOnLost(enabled)` and update the attribute for the next session.

```js
const scene = document.querySelector('webar-scene');
scene.addEventListener('trackingQuality', ({detail}) => {
  if (detail.issues.includes('small-target')) console.log('Move closer');
  if (detail.issues.includes('blur')) console.log('Hold the camera steady');
});
```

Quality scores range from 0 to 1 and are heuristic. Use motion, inlier count and measured timings with the issue labels. [Diagnostics](diagnostics.md)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
