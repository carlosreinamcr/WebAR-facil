# Video, gestures, animation and live content

## Play MP4 and remove a color

```html
<webar-scene gestures>
  <webar-target src="./poster.jpg" target-id="poster">
    <webar-video src="./clip.mp4" width="0.3" orientation="upright"
      autoplay muted loop chroma-key key-color="#00ff00"
      similarity="0.12" smoothness="0.08" spill="0.3"></webar-video>
  </webar-target>
</webar-scene>
```

Use `orientation="flat"` for a plane lying on its anchor and `upright` for a vertical plane. The color, similarity, smoothness and spill controls affect the shader. Try a well-lit, even background. Muted video is more likely to autoplay. When the browser blocks playback, use the scene's play control or start playback from a click. [Video reference](video.md)

## Enable touch gestures

Add `gestures` to the scene or content. Tap a model to select it, drag to rotate it, and pinch to change scale. `min-scale` and `max-scale` bound the multiplier. The gesture transform is local to the content and does not modify the tracked camera pose. Use `ar-select` and `ar-gesture` for custom interaction.

## Choose and control animations

```html
<webar-model src="./avatar.glb" size="0.3" animation="Walk"
  animation-loop="repeat" animation-speed="1.25" animation-fade="0.2"></webar-model>
```

Loop modes are `repeat`, `once` and `pingpong`. `animation-repetitions`, `animation-paused`, and `animation-fade` control repeat count, pause and blending. Listen to `modelLoaded` for clip names and `animationFinished` for completion. The element also exposes `playAnimation(nameOrIndex)` and `stopAnimations()`.

## Replace assets without closing the camera

```js
const model = document.querySelector('webar-model');
model.setAttribute('src', './replacement.glb');
await model.updateComplete;
```

Transforms and playback settings can be updated live. A failed load can be handled with the content error event. When replacing the hierarchy or editing targets, update the DOM and await `scene.refresh()`. Replacing a target can trigger image compilation and change visibility. Changing capture settings or tracking backend follows the session lifecycle.

Try the [live content example](../../examples/declarative-interactive.html), the [video example](../../examples/declarative-video.html), and the [declarative recipes](recipes.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
