# Troubleshooting

| Symptom | Check | Action |
| --- | --- | --- |
| Page shows “Loading SDK” | Network panel, SDK response and console. | Correct the script URL and confirm the response contains JavaScript. |
| Camera button does nothing | Secure context, browser permissions and other apps using the camera. | Open the HTTPS page directly and retry from a fresh tab. |
| Module fetch fails | Exact URL, response status and content type. | Serve the current standalone build or copy the runtime files required by an older build. |
| Model never appears | Marker detected event, model URL and size. | Verify the original marker, then test the GLB in the simplest example. |
| Video appears black | Codec support, autoplay policy and CORS. | Use a supported MP4 and start it from a user interaction if required. |
| SLAM guide appears but content does not | Placement confirmation. | Use the scene’s placement button or select within native WebXR. |
| Content jumps or drifts | Backend, texture, motion and scale. | Test a textured area and follow the [odometry procedure](odometry-validation.md). |

For reproducible reports, include the browser, device, exact page, backend and steps to trigger the issue. Capture the first console error and check its URL before chasing subsequent failures.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
