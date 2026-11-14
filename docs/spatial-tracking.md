# Seguimiento espacial: WebXR y fallback

El seguimiento de imágenes funciona en escritorio sin WebXR. La detección de superficies y el seguimiento espacial son modos adicionales que dependen del backend disponible.

Ahora puedes añadir placement="manual" para recibir un indicador y confirmar una propuesta óptica reciente; [guía visual](placement.md). Para pruebas comparables de iPhone y Android, [diagnósticos](diagnostics.md) registra sesiones y observaciones sin subir datos.

Las nuevas validaciones de distribución espacial y confirmación temporal de relocalizaciones débiles se describen en [odometría y deriva](odometry-validation.md). La corrección local periódica está disponible de forma experimental y desactivada por defecto: el benchmark no demuestra una mejora general de precisión.

## SLAM con etiquetas HTML

Con el standalone del [inicio rápido](getting-started.md), utiliza:

```html
<webar-scene mode="slam">
  <webar-model src="./Kai.glb" size="0.5" rotation="0 180 0"></webar-model>
</webar-scene>
```

La biblioteca crea cámara y controles. `mode="slam"` utiliza odometría WASM por defecto, sin marcador. El objeto aparece cuando existen mapa y plano válidos; la escala inicial es relativa. [Ejemplo HTML completo](../examples/declarative-slam.html).

## Escala métrica óptica experimental

El [ejemplo 28](../examples/PRUEBAS/28-escala-metrica.html) compara WebXR nativo con un modo óptico que estima metros usando la aceleración lineal del teléfono. Se activa mediante `EngineOptions.experimentalMetricScale`, pasando una instancia de `ExperimentalMetricScale`. Llama a `start()` en el gesto de usuario antes de iniciar `enableSLAM({backend:'optical-flow', placement:'hit-test'})`. El motor cancela la escucha al detenerse. El protocolo inicial apunta al iPhone 17 Pro en vertical. Valida cualquier otro teléfono antes de anunciar compatibilidad.

El estimador compara desplazamientos visuales e inerciales en varias ventanas. Usa la orientación visual para expresar la aceleración en coordenadas del mapa y descarta ventanas con huecos, rotaciones bruscas o movimiento insuficiente. Los tiempos corresponden a la lectura del fotograma y la llegada del evento en la página. La alineación de hardware, el retardo exacto de captura y la calibración cámara–IMU siguen pendientes de validación. El giroscopio sirve para descartar giros rápidos. Esta versión estima un factor de escala y no corrige la trayectoria con fusión visual-inercial completa.

Cuando las ventanas concuerdan, la pose anuncia `scale: 'metric'` y `scaleSource: 'experimental-inertial'`. El factor se fija hasta que cambia el mapa. La exportación conserva las unidades internas del mapa. Un mapa óptico relativo importado tiene que volver a estimar escala. La aplicación puede seguir mostrando contenido relativo mientras no exista una estimación. El ejemplo mantiene oculta la barra de 2 m hasta que también hay un plano y una pose reciente.

Para probarlo, permite cámara y movimiento, apunta al suelo y realiza varios desplazamientos laterales con pausas. Mide por separado el error entre los extremos de la barra y una cinta, el desplazamiento al caminar alrededor y el salto al recuperar el seguimiento. El diagnóstico guarda intervalos y huecos de sensores, poses, ventanas y residuo. El residuo indica consistencia interna y no sustituye la medición física.

El diagnóstico cuenta ventanas evaluadas, descartes por huecos, cobertura o movimiento insuficiente, e interrupciones por pérdida, salto o reinicio. También compara la misma trayectoria con desfases de −120 a +120 ms en pasos de 30 ms. Un resultado positivo indica que las muestras de movimiento que mejor encajan llegaron después del tiempo de vídeo. Es un desfase efectivo en el reloj de la página y su estimación queda vacía si el mejor ajuste es ambiguo. El diagnóstico conserva el último análisis de desfase de la sesión. El ajuste de escala vigente se invalida cuando se interrumpe su conjunto de ventanas. El desfase se registra para diagnóstico y no se aplica a las poses ni al criterio de colocación.

Con la cámara abierta y el permiso de movimiento concedido, mueve el teléfono despacio hasta que se habilite **Iniciar prueba guiada**. La guía espera poses ópticas recientes y continuas. Si se pierde el seguimiento, espera a recuperarlo y repite el tramo. La secuencia dura 28 segundos sin repeticiones y empieza con cuatro segundos de reposo, que se repiten si se detecta movimiento. Luego pide tres recorridos de ida y vuelta de 20 cm, con arranque y frenado claros, y una pausa tras cada desplazamiento.

Puedes medir dos posiciones separadas por 20 cm antes del ejercicio y marcar **Medí 20 cm entre las dos posiciones del teléfono**. La referencia queda en el informe y no participa en el ajuste. La comparación usa los desplazamientos completados y muestra el error absoluto cuando confirmaste la medida y hay escala del mismo mapa con poses cerca de ambos extremos. `guidedPhases` guarda la cobertura de poses y el desplazamiento visual en unidades del mapa, además de las muestras válidas y utilizables, pico absoluto, RMS y desviación estándar de aceleración por eje. La desviación estándar de la fase inicial mide el ruido y el movimiento involuntario durante el reposo. Las ventanas integradas se atribuyen a una fase cuando caben enteras en ella.

El informe también agrega, por eje, la aceleración RMS del teléfono y del mapa, la integral neta RMS y la suma media de las contribuciones absolutas. Guarda resultados de la sesión y del ejercicio, incluyendo un resumen de las ventanas descartadas por señal débil. Una integral neta baja con contribuciones absolutas altas apunta a cancelación dentro de la ventana. El informe contiene estadísticas agregadas y no almacena muestras crudas.

La odometría conserva temporalmente la pose si los puntos repartidos por la imagen permanecen casi inmóviles y su reproyección sigue siendo compatible con la pose anterior. Compara con referencias fijas durante el reposo para detectar desplazamientos pequeños acumulados. El ejemplo 28 informa cuántas poses se conservaron en reposo, la excursión máxima y el error al regresar a la posición inicial en cada ida y vuelta con cobertura. Esas distancias siguen en unidades del mapa hasta que se valida una escala.

El ejemplo también solicita al Worker fijar una referencia de salida y compararla con el vídeo al final de la pausa de retorno. `checkSLAMVisualReference('capture', id)` y `checkSLAMVisualReference('verify', id)` devuelven evidencia del emparejamiento cuando hay soporte suficiente. El informe muestra el desplazamiento mediano de puntos en píxeles, el retorno estimado mediante la referencia y la diferencia con la trayectoria seguida por flujo óptico. Los dos últimos valores usan unidades del mapa. La verificación vuelve a observar la imagen, aunque comparte la geometría del mapa. El Worker conserva una referencia temporal con descriptores y puntos; el informe solo guarda estadísticas y la verificación no corrige la pose en vivo.

## Pasar desde una imagen

```html
<webar-scene slam backend="optical-flow">
  <webar-target src="./marcador.jpg" target-id="poster">
    <webar-model src="./Kai.glb" size="0.3"></webar-model>
  </webar-target>
</webar-scene>
```

Tras iniciar y detectar la imagen, pulsa el botón **Activar SLAM** que crea la biblioteca. `backend="optical-flow"` permite probar la odometría; `backend="auto"` intenta el camino nativo disponible y admite fallback. Mantén marcador y entorno con textura en vista durante la inicialización.

Para solicitar WebXR sin imagen puedes usar `mode="slam" backend="auto"` o `backend="webxr"`. Tras preparar recursos se muestra un segundo botón para solicitar la sesión desde un gesto del usuario. Comprueba soporte real; `webxr` no fuerza una capacidad inexistente.

La transición declarativa publica `ar-slam` con el resultado en `event.detail`; `ar-status` indica pasos de escaneo y `ar-pose` lleva las poses aceptadas. `ar-ready` solo confirma preparación. La tabla siguiente se aplica también a los resultados declarativos.

## Activación programática avanzada

Si necesitas controlar botones y motor, [slam-iphone.html](../examples/slam-iphone.html) conserva el ejemplo programático completo. El siguiente fragmento supone una aplicación de [integración programática](programmatic.md), con `ThreeARScene`, target `poster` y botón `#slam`:

```js
document.querySelector('#slam').onclick=async()=>{
  try{
    const result=await app.engine.enableSLAM({
      targetId:'poster',backend:'auto',placement:'auto',
      initializationTimeoutMs:12000,
    });
    console.log(result.backend,result.placement);
  }catch(error){console.error(error);}
};
app.engine.onStatus(message=>console.log('Estado espacial:',message));
```

Invoca el método directamente en el click. No hagas antes una descarga ni esperes otro frame dentro de ese handler: la sesión XR puede necesitar la activación transitoria del usuario. Registra listeners y carga recursos previamente.

## Resultados de la transición

| `placement` devuelto | Qué hacer |
| --- | --- |
| `preserved` | El contenido ya se transfirió a un marco espacial compatible |
| `scan-marker` | Vuelve a mostrar el marcador dentro de XR para alinear los marcos |
| `select-surface` | Espera un hit-test válido y selecciona la superficie |
| `scan-floor` | Mueve la cámara con traslación sobre una zona con textura y paralaje |

La promesa puede resolverse antes de que exista una colocación final. Observa `onPose`/`onSurface`, estados y errores; no muestres “anclado” solo porque `enableSLAM()` resolvió.

`placement:'preserve'` exige una observación reciente del marcador (menos de 750 ms) y una alineación real. Una matriz que se quedó visible por retención no basta. `placement:'hit-test'` permite recolocar explícitamente; no conserva necesariamente la posición anterior. En modo automático puede pedirse escaneo o selección.

## Backend WebXR

Comprueba soporte con `await SLAMManager.isSupported()`. Internamente usa `navigator.xr.isSessionSupported('immersive-ar')`. La sesión requiere `hit-test`, solicita `dom-overlay` si hay raíz de overlay y utiliza `anchors` cuando está disponible.

Una pose de hit-test no es una malla del entorno ni garantiza que sea el suelo. Para preservar la posición desde getUserMedia hace falta un marco de cámara común: el motor puede usar `camera-access`/Raw Camera Access para alinear la imagen dentro de XR. Esta capacidad no está disponible en todos los navegadores que soportan hit-test.

No puedes copiar una matriz de webcam al espacio XR y llamarlo continuidad. Si no hay alineación, la operación debe pedir recolocación o fallar según la opción. El renderer debe integrarse con la sesión; `ThreeARScene` ya lo hace.

`backend:'webxr'` exige ese backend; no interpreta la ausencia como permiso para inventar un anclaje. Una denegación explícita de permisos no debe resolverse con reintentos automáticos para volver a abrir la cámara.

## Backend óptico

`backend:'auto'` intenta el camino apropiado y permite odometría WASM cuando XR no está disponible. Para probar explícitamente el fallback: `backend:'optical-flow'`. Se ejecuta en Worker con Lucas–Kanade, correspondencias, triangulación, mapa local y relocalización.

Si existe una observación útil del marcador, puede sembrar el mapa y su escala de referencia. Aun así necesita geometría del entorno para mantener la cámara al retirar el marcador. Sin esa semilla, la escala es relativa y se requiere suficiente traslación y paralaje; rotar el teléfono sin desplazarse no revela profundidad.

El ROI inferior propone puntos candidatos de suelo. Solo se entrega un plano cuando hay verificación geométrica; no existe reconocimiento semántico infalible del piso, escala métrica absoluta sin referencia, ni oclusión automática del contenido con el entorno. La deriva, la pérdida en superficies lisas y las limitaciones monoculares siguen presentes.

## iPhone y pruebas físicas

Sirve por HTTPS el [ejemplo SLAM declarativo](../examples/declarative-slam.html), acepta cámara y desplázala lentamente sobre un entorno con textura para dar paralaje. Para sembrar desde imagen, utiliza el HTML de transición anterior y pulsa Activar SLAM tras detectar. Si no hay mapa utilizable el motor debe declarar pérdida en lugar de congelar una falsa estimación.

No presupongas disponibilidad de `immersive-ar` por el nombre del navegador: compruébala en ejecución. WebKit de escritorio automatizado no certifica Safari en iPhone. La matriz de validación pendiente está en [pruebas físicas](device-validation.md).

## Volver a seguimiento de imágenes

Si empezaste con una escena de imagen y su botón SLAM, `await scene.stop(); await scene.start();` reconstruye la configuración HTML original y vuelve a cargar la imagen. Si tu HTML utiliza `mode="slam"`, debes cambiar su configuración y añadir targets válidos antes de reiniciar para obtener una escena de imagen.

Con API programática el flujo es `await engine.stop()`, `await engine.startCamera()` y volver a cargar targets. No existe `disableSLAM()` público que conserve todos los targets implícitamente.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
