# Visual guidance and placement confirmation

After placing content in example 30, walk normally. The map automatically collects viewpoints along the route. If tracking is lost, the example attempts to recover the original placement. «Otra zona» starts a new map.

In [example 30](../../examples/PRUEBAS/30-explorar-superficies.html), tap to choose an area of the optical SLAM plane to inspect. Blue dots highlight contrast in the camera feed and yellow dots show map points near the plane. The green area marks the extent supported by those points. Tap the area or select «Usar zona» to preview a GLB or MP4. Pinch to resize the grid within the detected area or to scale the content.

The image scan guide tells users where to aim. The surface guide previews where spatial content will be placed. With `placement="manual"` the user confirms before the model becomes anchored.

| State | What to do |
| --- | --- |
| Scanning for image | Put the whole marker in view and avoid glare. |
| Searching for a surface | Aim at a textured area and move sideways gently. |
| Surface proposed | Inspect the grid and confirm placement. |
| Content anchored | Walk around the model and verify that it stays near the selected point. |

The optical grid reflects a local estimate. If it straddles a tabletop and an object, move the view until the intended area fills the center and reacquire a proposal. Use the [spatial tracking chapter](spatial-tracking.md) to choose the backend.

## Matches and recovery in example 30

Optical SLAM compares each recovery frame against up to **50 saved views**. It evaluates each view separately. A visual match pairs similar ORB descriptors. A geometrically consistent point (*inlier*) is a match that also fits the estimated camera position and orientation.

| Message in the example | Meaning |
| --- | --- |
| No matches found | None of the saved views produced any matches. |
| Few matches found | The best view produced 1 to 14 matches. The engine needs 15 before attempting pose estimation. |
| Matches found, but insufficient to confirm | At least one view produced 15 or more matches, but none passed geometric validation. |
| Candidate pose found | The estimate passed basic validation and needs a second compatible observation. |

**Basic validation** requires at least 15 geometrically consistent points, at least 40% of that view's matches, and coverage across at least 4 image cells. The bounding rectangle of those points must cover at least 8% of the analyzed frame.

**Single-frame confirmation** requires at least 30 inliers, a 65% inlier ratio, coverage across 6 cells, and reprojection error below 1.5 pixels. If the estimate only passes basic validation, the engine requires two compatible observations. If a tabletop has little texture, frame its edges and surroundings to give the engine more visual references.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
