# Persisting local optical maps

An optical map stores a bounded set of local keyframes used for relocalization. The engine keeps it in memory during the session. Applications may save it explicitly and restore it into a later optical session. Use the same physical space and revisit a mapped viewpoint under similar lighting.

```js
const snapshot = await engine.exportSLAMMap();
// Store snapshot with IndexedDB's structured clone support.
const restored = await readSavedMap();
await engine.importSLAMMap(restored);
```

The snapshot carries a schema version, an optical map, a target ID and an optional anchor transform. The map includes camera intrinsics, a scale, a map ID and keyframes with descriptors, points and view matrices. Preserve typed arrays and reject incompatible or corrupt snapshots. Snapshots contain scene geometry and descriptors. Keep them private by default and give users a way to delete them from application storage.

Use compatible camera, lens, capture dimensions and projection on restore. An imported anchor is eligible for display after the camera relocalizes against the environment. Native WebXR maps are managed by the platform and are outside this API. Unseeded optical maps use relative scale and may drift. See the [IndexedDB map example](../../examples/PRUEBAS/13-mapas-locales.html) and [odometry tests](odometry-validation.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
