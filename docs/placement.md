# Guía visual y confirmación de colocación

Después de colocar contenido en el ejemplo 30, puedes moverte con normalidad. El mapa incorpora automáticamente perspectivas del recorrido. Si se pierde el seguimiento, el ejemplo intenta recuperar la colocación original. «Otra zona» inicia un mapa nuevo.

El [ejemplo 30](../examples/PRUEBAS/30-explorar-superficies.html) permite elegir con un toque dónde inspeccionar el plano del SLAM óptico. La mira amarilla señala la zona en evaluación, los puntos azules resaltan contraste en la cámara y los amarillos muestran referencias del mapa cercanas al plano. El área verde delimita la región respaldada por el mapa. Toca el área o pulsa «Usar zona» para previsualizar un GLB o MP4 y confirma con «Colocar». Pellizca para ampliar la cuadrícula dentro del área verde o para escalar el contenido.

La guía distingue escaneo, superficie candidata, contenido colocado y pérdida. No sustituye la evidencia geométrica ni convierte el hit-test en reconocimiento semántico de suelo.

## Coincidencias y recuperación en el ejemplo 30

El SLAM óptico compara cada fotograma de recuperación con hasta **50 vistas guardadas**. Evalúa cada vista por separado. Una coincidencia visual vincula dos descriptores ORB parecidos. Un punto coherente con la geometría (*inlier*) es una coincidencia que también encaja con la posición y orientación estimadas de la cámara.

| Mensaje del ejemplo | Qué significa |
| --- | --- |
| No se encontraron coincidencias | Ninguna vista guardada produjo coincidencias. |
| Se encontraron pocas coincidencias | La mejor vista produjo entre 1 y 14. El motor necesita 15 para intentar estimar la posición. |
| Hay coincidencias, pero aún no bastan | Alguna vista produjo 15 o más, pero ninguna superó la verificación geométrica. |
| Posición candidata encontrada | La estimación superó la verificación básica y necesita una segunda observación compatible. |

La **verificación básica** exige al menos 15 puntos geométricamente coherentes, que representen al menos el 40 % de las coincidencias de esa vista y ocupen al menos 4 celdas de la imagen. El rectángulo que abarca esos puntos debe cubrir al menos el 8 % del fotograma analizado.

La **confirmación en un solo fotograma** exige al menos 30 puntos coherentes, un 65 % de coincidencias coherentes, 6 celdas y un error de reproyección inferior a 1,5 píxeles. Si la estimación solo cumple la verificación básica, el motor requiere dos observaciones compatibles. Una mesa con poca textura puede ofrecer más referencias si encuadras también sus bordes y alrededores.

## Odometría óptica con confirmación

```html
<webar-scene mode="slam" backend="optical-flow" placement="manual" diagnostics>
  <webar-model src="./Kai.glb" size="0.4"></webar-model>
</webar-scene>
```

Carga el standalone como en [inicio](getting-started.md). [Ejemplo completo](../examples/declarative-placement.html), para iPhone o Android con cámara/WebGL disponibles.

1. Pulsa Iniciar AR y desplaza la cámara sobre un entorno con textura y paralaje.
2. Espera una pose de superficie verificada: aparecen una cuadrícula y un anillo de propuesta.
3. Pulsa **Colocar aquí** cuando se habilite. Confirmar solo cambia presentación; no crea una matriz identidad ni modifica el anclaje calculado.
4. Si se pierde seguimiento, se oculta el indicador/contenido. Vuelve hacia una zona observada; una nueva pose válida puede recuperar el contenido.

No se habilita confirmación mientras se inicializa, cambia de backend o falta una pose reciente. Se usa el timestamp de captura, no el momento de llegada del Worker: una respuesta tardía no renueva su frescura. El límite de confirmación es 700 ms; la guía declara pérdida tras más de un segundo sin datos válidos. Eso no garantiza precisión física. La escala del fallback sin referencia sigue siendo relativa y puede haber deriva.

El anillo representa la propuesta del motor, no una malla reconstruida. En una transición sembrada desde imagen puede corresponder a su posición conservada, no a un suelo reconocido. Solo el target seleccionado se hace visible al confirmar; los demás no se convierten en anclajes.

## Referencias visuales en la escena

`<webar-scene>` muestra un marco de encuadre al buscar imágenes. Se oculta cuando reconoce cualquier marcador, permanece oculto durante la tolerancia de pérdida y reaparece si se pierden todos los marcadores. El marco deja pasar los gestos y respeta la preferencia de movimiento reducido. Para ocultarlo usa `scan-guide="false"`.

En odometría, el motor consolida tres estimaciones recientes compatibles de la superficie antes de fijar el ancla, incluso si una observación intermedia resulta insuficiente. La cuadrícula se dibuja sobre ese plano y su giro dentro del plano toma como referencia la cámara en el momento de detectarlo. En WebXR se centra y orienta con la propuesta del hit-test. Su tamaño es una referencia visual, sin estimación de los bordes físicos. En colocación manual permanece hasta confirmar o perder la propuesta. En colocación óptica automática aparece brevemente. `surface-grid="false"` oculta la cuadrícula y conserva el anillo de colocación.

## Guía de escaneo en odometría óptica

`engine.on('scanGuidance', listener)` y el evento declarativo `ar-scan-guidance` publican `{hint, timestampMs}` cuando cambia la indicación. El componente explica cuándo buscar más textura (`low-texture`), desplazarse lateralmente (`move-sideways`), continuar construyendo el mapa (`map-initializing`), encuadrar una superficie con más evidencia (`plane-unverified`) o volver a una zona observada (`return-to-map`). `surface-ready` indica que existe una pose para el ancla. Son indicaciones derivadas del estimador óptico.

El flujo óptico ajusta su cupo de puntos cuando el coste se mantiene alto. Selecciona puntos de distintas zonas y reserva parte del cupo para ampliar el mapa, manteniendo los criterios geométricos de pose, triangulación y plano.

La ventana inicial de flujo óptico se elige con el desplazamiento medido en la captura anterior y el intervalo entre capturas. Si la pasada normal deja pocos puntos y el frame conserva textura, se permite un reintento con ventana amplia.

Si se pierden las referencias iniciales, la odometría repone esquinas y vuelve a intentar construir el mapa. Una vez colocado el objeto, una relocalización en el mismo mapa recupera el ancla confirmada. Un reinicio de mapa invalida la confirmación y exige una colocación nueva.

## Estados y eventos

`scene.placementState` es idle, scanning, surface-found, placed o lost. El evento DOM ar-placement lleva `{state}` en detail. Puedes llamar a `scene.confirmPlacement()` desde un botón propio; rechaza si la colocación no es válida/reciente.

Por defecto placement es auto para conservar las aplicaciones anteriores. En ese modo una pose aceptada coloca el contenido sin este botón. Cambiar la política requiere reiniciar la escena.

## WebXR nativo

En backend webxr/auto, el hit-test muestra la propuesta. La selección se hace mediante el evento select de la sesión XR; el botón DOM Colocar aquí se reserva al fallback óptico. La pose nativa posterior confirma colocación. No se promete que los controles DOM estén disponibles dentro de todos los modos inmersivos.

Con backend auto, un rechazo de la configuración de sesión activa la odometría por cámara si está habilitada. Un rechazo de permisos se comunica a la aplicación. Con backend webxr explícito, el error se devuelve al llamador. El ejemplo 22 permite comprobar el modo automático o forzar el nativo con `?backend=webxr`. Si una transición automática desde imagen no consigue conservar la pose, vuelve a buscar superficie. Una solicitud explícita con `placement: "preserve"` devuelve un error y permite reintentar desde el marcador.

Comprueba las capacidades en ejecución. Android no implica que WebXR esté disponible y iPhone no implica que todos los navegadores tengan las mismas capacidades. Si no hay soporte nativo, usa el escenario óptico; no marques una prueba nativa como aprobada.


En móviles los controles están arriba del visor, antes de la imagen de cámara. Si el ejemplo incluye un formulario anterior, desplázate hasta el inicio de la escena. Con `gestures`, toca el modelo y arrastra para girar o pellizca para escalar; los márgenes del visor tampoco desplazan la página.

En tools/device-tests.html, Probar SLAM sin marcador configura e inicia el modo óptico directamente; no requiere imagen. La opción Imagen → odometría sí requiere imagen para la transición. En WebXR, el botón Activar SLAM solicita la sesión nativa con gesto del usuario, y la selección de superficie se realiza dentro de XR.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
