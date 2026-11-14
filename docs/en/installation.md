# Installation and distribution

The hosted standalone script registers custom elements and includes Three.js. Place it in the page head with `defer`, then declare the scene in the body.

The npm package is named `webar-facil`. Use `WebARFacil` in new classic-script integrations. Classic builds also expose the legacy `MiLibreriaAR` alias for existing integrations.

```html
<script defer src="https://realidad-aumentada.com.co/webar-facil/webar-facil.min.js"></script>
```

Choose the distribution based on how the application is built.

| Application | Use |
| --- | --- |
| Plain HTML | Hosted standalone script and declarative elements. |
| Existing JavaScript application | The standalone global or the package exports in a bundler. |
| Source checkout or GitHub ZIP | Run `npm ci` and `npm run build`, then inspect `dist/`. |

A model, marker or video URL in your HTML resolves against your page. Put assets beside your page or use absolute URLs served with compatible CORS headers. Use HTTPS for device testing. See [local release](local-release.md) and [deployment](deployment.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
