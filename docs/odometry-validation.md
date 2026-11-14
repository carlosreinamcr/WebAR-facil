# Validación de odometría, relocalización y deriva

La odometría sigue siendo monocular y de mapa local. Esta revisión añade validaciones, no SLAM global ni fusión IMU. No se atribuye a una cámara física lo medido con imágenes sintéticas.

## Cambios implementados

- El seguimiento de puntos ambientales exige distribución espacial, además del número y proporción de inliers. La semilla planar de marcador tiene su propia excepción durante inicialización; no se le exige cubrir todo el frame.
- La relocalización verifica reproyección, proporción de inliers y distribución en una rejilla. Las hipótesis débiles necesitan dos observaciones consecutivas con poses compatibles. Las fuertes (al menos 30 inliers, ratio >=0.65, error <1.5 px y seis celdas) pueden aceptarse directamente.
- Se conserva la revisión del mapa al recuperar una pose; no se publica una identidad ni el anchor guardado como sustituto de una medición.
- Los resultados ópticos incluyen relocalized y keyframeCorrected. El Worker los valida y la fachada los transmite en pose.diagnostics. En HTML se consultan en event.detail.diagnostics de ar-pose.

Las pruebas incluyen mapa importado, ausencia de imagen, escena distinta, confirmación temporal débil, continuidad tras retirar marcador y un plano triangulado. Consulta [verificación](verification.md) y [protocolo físico](device-validation.md).

## Corrección local experimental

`keyframe-correction` en webar-scene o `keyframeCorrection:true` en EngineOptions/OdometryConfig habilita una reobservación acotada del keyframe antiguo. Está **desactivada por defecto**.

Solo se acepta una corrección con soporte suficiente, movimiento/rotación acotados y mejora de reproyección sin degradar demasiado los puntos LK. No cambia el origen del mapa ni constituye cierre de bucle global. Puede añadir coste, errores y saltos; el filtrado visual no demuestra que la geometría haya mejorado.

```html
<webar-scene mode="slam" keyframe-correction>
  <webar-model src="./Kai.glb" size="0.5"></webar-model>
</webar-scene>
```

No actives ese atributo suponiendo mayor precisión. Es una opción para experimentar con un protocolo propio y comparar resultados; cambiarla requiere reiniciar el backend.

## Comparación registrada

Protocolo: 630 imágenes deterministas de 640×480, trayectoria sinusoidal de traslación, OpenCV/WASM real en Node. Se alinea una escala de referencia para medir error en unidades de la escena de prueba; no son errores físicos medidos en metros. Son ejecuciones individuales y no un estudio de rendimiento móvil.

| Medida | Antes | Actual por defecto | Corrección experimental |
| --- | --- | --- | --- |
| Poses / frames | 580 / 630 | 580 / 630 | 580 / 630 |
| Error de trayectoria p50 | 0.005136 | 0.005136 | 0.004975 |
| Error de trayectoria p95 | 0.011150 | 0.011150 | 0.013269 |
| Error máximo | 0.012635 | 0.012635 | 0.014603 |
| Procesamiento p50 | 41.12 ms | 41.14 ms | 40.37 ms |
| Procesamiento p95 | 77.02 ms | 79.12 ms | 81.18 ms |
| Heap WASM caliente/final | 32 / 32 MiB | 32 / 32 MiB | 32 / 32 MiB |

**El error de la configuración predeterminada no mejoró en esta trayectoria.** La corrección experimental reduce la mediana, pero empeora p95 y máximo, por eso no se activa automáticamente. Las diferencias de tiempo no prueban una mejora de velocidad. El rechazo de falsas relocalizaciones y la recuperación se verifican con pruebas específicas, no con esta tabla de deriva.

[Informe completo con las tres ejecuciones](../benchmarks/odometry-comparison.json). Los archivos baseline-2026-11-09.json y experimental-2026-11-09.json conservan las observaciones iniciales; latest.json es el resultado predeterminado más reciente.

## Repetir el protocolo

```sh
node scripts/benchmark.mjs 630
node scripts/benchmark.mjs 630 experimental
node scripts/compare-odometry.mjs benchmarks/baseline-2026-11-09.json benchmarks/latest.json benchmarks/experimental-latest.json
```

Ejecuta secuencialmente y registra hardware/carga. Se puede usar un baseline histórico para referencia, pero para evaluar otra modificación conviene medir antes/después en el mismo entorno. El benchmark no incluye compositor, GPU móvil, sensor, rolling shutter, temperatura ni consumo energético.

## Lo que sigue pendiente

Validar trayectorias con rotación y cambios de iluminación, recorridos más largos, oclusión prolongada y dispositivos reales; medir error relativo y absoluto con referencia externa. Ajustar mapas o resolver un cierre de bucle global necesita más trabajo y no se considera terminado por añadir la corrección local experimental.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
