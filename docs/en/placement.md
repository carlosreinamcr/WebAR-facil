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
## Environment mesh (example 32)

The [mesh and occlusion example](../../examples/PRUEBAS/32-malla-entorno.html) uses optical tracking with an RGB camera. Move the phone sideways over a textured surface, tap a triangle to place Kai, then change your viewpoint. “Mostrar malla” shows the geometry and “Oclusión” enables depth writes so the geometry can hide parts of the model.

The scene uses `ThreeARScene` and calls `exportSLAMMap()` at most once every 500 ms, after the previous export has completed. It triangulates only new keyframes by projecting their points onto a grid and connecting neighbors at similar depths. Triangles accumulate in floor-aligned 3D blocks, with duplicate triangles filtered by quantized vertex positions. Blocks remain in memory for the session after keyframes are replaced. A raycast places Kai and scanning continues until you pause it.

The coverage panel shows a top view of blocks with triangles and the current camera position. Individual blocks can contain gaps. The demo budgets 96 blocks and 256 triangles per block, for a theoretical maximum of 24,576. Other blocks can still grow when a block is full. Block size comes from the first camera-to-surface distance and uses relative map units.

The reconstruction is experimental, partial, and relative in scale. Smooth walls can have gaps, and edges, glass, and moving objects can produce poor estimates. Tracking loss hides the mesh and model. If the map resets, scan again and place the model again.

After pointing the camera away and returning, compare the mesh with an identifiable physical edge. A shift while tracking stays active may come from pose drift or errors in the estimated geometry. The demo enables local keyframe correction and reports when the engine adjusts or relocalizes the camera. It corrects the pose when enough verified matches are available. Stored blocks keep their geometry, and the counter measures coverage rather than accuracy.
## Object point cloud (example 33)

In [example 33](../../examples/PRUEBAS/33-mapa-3d-objeto.html), keep a textured object still and capture up to 24 views from different positions. Move around it while keeping shared details in frame. Use the lower viewer to rotate and zoom the cloud. Each color shows which view first contributed those points. After each capture, the app reports how many new points were added.

The scene requests the current keyframe via `exportSLAMMap({includeCurrentView:true})`, selects landmarks within the framing guide, and keeps the 3D cluster connected to the center. Each additional view must share points with the accumulated cloud. It accumulates landmarks in map coordinates and merges duplicates by 3D cell. The cloud is sparse, uses relative scale, and may include the background. It remains in memory while the page is open. This demo does not yet use the cloud to recognize the object in a new session.
## Cylindrical label (example 34)

[Example 34](../../examples/PRUEBAS/34-etiqueta-curva.html) accepts an unwrapped JPG or PNG label and includes a printable 100 mm sample. Measure the outer diameter across the straight section and the label width along the curve, using the visible width if the paper overlaps. Label height follows the image aspect ratio.

Call `engine.addImageTarget('label', image, {physicalWidthMeters: 0.1, cylinderDiameterMeters: 0.066})`. The anchor sits on the cylinder axis at the label's mid-height. Curvature is applied at registration and WART retains the flat image descriptors. Tracking is experimental and requires a textured label on a constant-diameter section. Conical bottles and transfer from a curved-label pose to a SLAM anchor are outside this example.
## Hand interaction (example 35)

In [example 35](../../examples/PRUEBAS/35-interaccion-manos.html), MediaPipe Hand Landmarker tracks the index fingertip on the same video stream as AR. Add `<webar-hands cursor gesture="pinch"></webar-hands>` to the scene and mark selectable models with `hand-target`. Aim at a model and bring your index finger and thumb together. The model emits `ar-hand-tap` with `detail.element`, `detail.object`, `detail.point` (the 3D hit position) and `detail.gesture`. With `gesture="dwell"`, holding the cursor over the same model for 650 ms triggers an interaction.

The fingertip is projected onto the 3D scene from its camera image coordinates. This supports mid-air pointing and does not measure physical distance between the finger and the virtual object. The component uses the video of a declarative Three.js scene and suspends detection during immersive WebXR.

Use `runtime-src`, `wasm-path`, and `model-src` to self-host the ESM module, its WASM directory, and `hand_landmarker.task`. By default they load when a scene with hand interaction starts. Camera frames are processed in the browser. Listen for `hand-ready` and `hand-error` to report status. Synchronous inference uses reduced-resolution video and an `fps` limit (12 by default, range 1 to 20). On `webar-scene`, `facing-mode="user"` requests the front camera and `facing-mode="environment"` requests the rear camera.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
