# Your first HTML application

## Put three files next to your HTML

```text
my-webar-app/
  index.html
  webar-facil.min.js
  poster.jpg
  model.glb
```

Copy the compiled `webar-facil.min.js` from the distribution. The script contains Three.js, OpenCV/WASM, workers, Draco and Meshopt. Alternatively, point the script tag at a hosted copy of the SDK. Marker and model paths are still relative to your HTML.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My first WebAR app</title>
  <script defer src="./webar-facil.min.js"></script>
</head>
<body style="margin:0">
  <webar-scene>
    <p role="status">Loading WebAR Fácil…</p>
    <webar-target src="./poster.jpg" target-id="poster" physical-width="0.2">
      <webar-model src="./model.glb" size="0.3" rotation="0 180 0"></webar-model>
    </webar-target>
  </webar-scene>
</body>
</html>
```

## Open the camera and find the marker

1. Serve the directory over localhost on your computer or trusted HTTPS on your phone.
2. Press the scene's camera start button.
3. Print the exact image or show it on another screen and point the camera at it.
4. Stop the scene when finished.

JPG and PNG targets compile on demand. The default marker width is 20 cm. Use the actual printed width in meters when you need scale relative to the marker. A large, sharp and well-lit image is easier to recognize.

## Run the repository

Use Node.js 22.18 or newer and run `npm ci`, then `npm run dev`. Open the [declarative example](../../examples/declarative.html) or the [gallery](../../examples/PRUEBAS/index.html). You only need a static server for a separate project with the compiled SDK.

| Where the HTML lives | Example script path |
| --- | --- |
| Next to the SDK | `./webar-facil.min.js` |
| Repository root | `./dist/webar-facil.min.js` |
| Inside the repository's `examples/` directory | `../dist/webar-facil.min.js` |

`webar-facil.min.js` remains a compatible filename. Both `WebARFacil` and `WebARFacil` expose the same standalone API. If the loading message stays on screen, check the script path and the browser console. [Troubleshooting](troubleshooting.md)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
