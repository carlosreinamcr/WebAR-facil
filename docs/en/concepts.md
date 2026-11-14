# Concepts and coordinate systems

| Term | Meaning in WebAR Fácil |
| --- | --- |
| Target | Reference image and its precomputed features. |
| Model-view matrix | Target or anchor transform expressed in camera coordinates. |
| Projection matrix | Camera intrinsics expressed for the renderer, including the near and far planes. |
| Anchor | A content transform retained relative to a spatial reference. |
| Content transform | The model's local position, scale and rotation relative to the tracked parent. |

Pose matrices have 16 elements in column-major order. Treat the projection and model-view as a pair and let the wrapper apply the conventions it expects. With a custom renderer, align the projected viewport with the displayed video crop. Apply visual offsets to a child of the tracked group so a new pose can update the parent independently. The optical backend uses relative units until initialized with a metric reference.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
