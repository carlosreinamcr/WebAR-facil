# Validating odometry, relocalization and drift

Treat acquisition, tracking and recovery as separate measurements. Repeat each test several times on the same textured surface, with the same route and lighting, and record conditions such as glare and autofocus hunting.

| Test | Procedure | Record |
| --- | --- | --- |
| Initialization | Move laterally until a surface can be selected. | Time to first valid placement. |
| Drift | Place an object, walk a short loop and return to the starting view. | Offset from the original placement and tracking interruptions. |
| Recovery | Briefly cover the camera or look away, then return to the mapped view. | Whether the pose recovers and how long recovery takes. |
| Reload | Save and restore an optical map, then revisit the original viewpoint. | Whether the environment relocalizes and the anchor returns. |

For optical sessions initialized without metric scale, compare alignment visually or in relative units. For measurements in meters, use a known-size reference and check the result against a physical measurement. Compare like-for-like backends and keep failed runs in the record. See [local maps](maps.md) and [physical-device acceptance](device-validation.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
