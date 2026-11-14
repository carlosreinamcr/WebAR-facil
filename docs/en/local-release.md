# Identifying and serving a local build

From a source checkout, build the distributable and serve it through HTTP on localhost or HTTPS on another device.

```sh
npm ci
npm run build
npm run docs:check
npm run dev
```

The build creates `dist/webar-facil.min.js`, the documentation and the example gallery. Use the local server URL printed by the development command and follow the example’s paths. To verify what a browser loaded, inspect the SDK script in the Network panel and use the exported `LIBRARY_VERSION` and `LIBRARY_BUILD` from the loaded SDK when troubleshooting a stale copy.

The hosted script URL is documented in [installation](installation.md). For a portable release, review [release preparation](alpha-release.md) and [implementation verification](verification.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
