# MP4 video and chroma key

```html
<webar-target src="./poster.jpg" target-id="poster">
  <webar-video src="./clip.mp4" width="0.3" orientation="upright"
    chroma-key muted loop></webar-video>
</webar-target>
```

Set `orientation="upright"` to stand the video up or `orientation="flat"` to lay it along the marker. Use `chroma-key` for a uniform key background and tune `key-color`, `similarity`, `smoothness` and `spill` using the actual footage. A compatible MP4 with a flat, evenly lit background produces a cleaner cutout. Muted playback works with more autoplay policies. For audio, provide a user action that starts playback and handle browser rejection.

In a custom Three.js scene, `ThreeARVideo` provides the equivalent programmatic content. Manage its playback and disposal with the scene lifecycle. If a remote video plays as a plain HTML element but fails as a texture, check its CORS response headers.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
