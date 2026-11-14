# Implementation verification

Use separate checks for the behavior and environment each layer needs.

| Check | What it covers |
| --- | --- |
| `npm run check` and `npm test` | Type contracts and unit regressions. |
| `npm run build` and `npm run check:package` | Compiled entry points, declarations and distribution artifacts. |
| `npm run docs:check` and `npm run docs:test-browser` | Documentation references, rendered navigation and browser smoke checks. |
| `npm run test:browser` | Browser integration and repeatable automation scenarios. |
| Physical-device run | Real camera permissions, focus, video decoding, gestures, heat and spatial behavior. |

Browser automation and prerecorded inputs make regressions repeatable. Collect live results separately for native XR and optical tracking. See [the device checklist](device-validation.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
