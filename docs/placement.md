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
## Malla del entorno (ejemplo 32)

El [ejemplo de malla y oclusión](../examples/PRUEBAS/32-malla-entorno.html) usa el seguimiento óptico con cámara RGB. Mueve el teléfono de lado sobre una mesa o superficie con textura. Toca un triángulo para colocar a Kai y cambia de ángulo. «Mostrar malla» controla la visualización de la geometría y «Oclusión» controla si esta escribe profundidad y oculta partes del modelo.

La escena usa `ThreeARScene` y consulta `exportSLAMMap()` como máximo una vez cada 500 ms, cuando la consulta anterior ya terminó. Solo triangula fotogramas clave nuevos. Proyecta sus puntos a una rejilla y conecta vecinos con profundidades similares. Acumula los triángulos en bloques 3D alineados con el suelo y descarta duplicados por proximidad de vértices. Los bloques se conservan en memoria durante la sesión aunque cambien los fotogramas clave. Un raycast sobre la malla coloca a Kai y el escaneo sigue activo hasta que lo pauses.

El panel de cobertura muestra una vista superior de las zonas con triángulos y la posición de la cámara. Cada cuadro puede contener huecos. Hay un presupuesto de 96 bloques y 256 triángulos por bloque, con un máximo teórico de 24.576. Si un bloque se llena, otras zonas todavía pueden incorporar geometría. El tamaño de bloque se calcula a partir de la primera distancia a la superficie y usa las unidades relativas del mapa.

La reconstrucción es experimental, parcial y de escala relativa. Puede dejar huecos en paredes lisas y estimar mal los bordes, el vidrio o los objetos en movimiento. Durante una pérdida de seguimiento se ocultan la malla y el modelo. Si se reinicia el mapa, vuelve a escanear y coloca el modelo de nuevo.

Al apartar la cámara y volver, compara la malla contra un borde físico identificable. Si se desplaza con el seguimiento activo, puede haber deriva de la pose o errores en la geometría estimada. El ejemplo activa la corrección local con fotogramas clave e indica cuándo el motor ajusta o relocaliza la cámara. Esto corrige la pose cuando hay suficientes coincidencias verificadas. Los bloques ya guardados conservan su geometría y el contador mide cobertura, no precisión.
## Mapa 3D de un objeto (ejemplo 33)

En el [ejemplo 33](../examples/PRUEBAS/33-mapa-3d-objeto.html), mantén quieto un objeto con textura y captura hasta 24 vistas desde distintas posiciones. Desplázate alrededor manteniendo detalles en común entre tomas. El visor inferior permite girar y ampliar la nube. Cada color indica qué vista aportó los puntos por primera vez. Después de cada toma se indica cuántos puntos nuevos se incorporaron.

La escena solicita el fotograma clave actual con `exportSLAMMap({includeCurrentView:true})`, selecciona los puntos que caen dentro de la guía y retiene el grupo de puntos 3D conectado al centro. Cada vista adicional debe compartir puntos con la nube acumulada. Acumula los puntos en el sistema de coordenadas del mapa y agrupa duplicados por celda 3D. La nube es dispersa y de escala relativa. Puede incluir fondo y se conserva mientras la página está abierta. Este ejemplo todavía no usa esa nube para reconocer el objeto en otra sesión.
## Etiqueta cilíndrica (ejemplo 34)

El [ejemplo 34](../examples/PRUEBAS/34-etiqueta-curva.html) permite cargar el JPG o PNG de una etiqueta desplegada o imprimir una muestra de 100 mm de ancho. Mide el diámetro exterior en la parte recta del envase y el ancho de la etiqueta siguiendo la curva. Si el papel se solapa, mide la parte visible. El alto se calcula con la proporción de la imagen.

Llama a `engine.addImageTarget('etiqueta', imagen, {physicalWidthMeters: 0.1, cylinderDiameterMeters: 0.066})`. El origen está en el eje del cilindro a mitad de la altura de la etiqueta. La curvatura se aplica al registrar la imagen y el archivo WART conserva los descriptores de la imagen desplegada. El seguimiento es experimental. Necesita una etiqueta con detalles visibles y una sección de diámetro constante. Las botellas cónicas y la transferencia de pose de la etiqueta curva a un anclaje SLAM quedan fuera de esta prueba.
## Interacción con las manos (ejemplo 35)

En el [ejemplo 35](../examples/PRUEBAS/35-interaccion-manos.html), MediaPipe Hand Landmarker sigue el índice en el vídeo de la misma cámara AR. Añade `<webar-hands cursor gesture="pinch"></webar-hands>` dentro de la escena y marca los modelos seleccionables con `hand-target`. Apunta al modelo con el índice y junta el índice con el pulgar. El modelo emite `ar-hand-tap` con `detail.element`, `detail.object`, `detail.point` (coordenadas 3D del impacto) y `detail.gesture`. Con `gesture="dwell"`, mantener el cursor sobre el mismo modelo durante 650 ms dispara una interacción.

El punto del índice se proyecta sobre la escena 3D. Esto permite apuntar a un modelo desde el aire. La coincidencia se calcula en la imagen de la cámara y no mide la distancia real entre el dedo y el objeto virtual. El componente funciona con el vídeo de una escena Three.js declarativa. La detección se omite mientras una sesión WebXR inmersiva controla el visor.

Los atributos opcionales `runtime-src`, `wasm-path` y `model-src` permiten alojar localmente el módulo ESM, su carpeta WASM y `hand_landmarker.task`. Los valores predeterminados descargan MediaPipe y el modelo al iniciar la escena. Los fotogramas se procesan en el navegador. Escucha `hand-ready` o `hand-error` para mostrar el estado. La inferencia síncrona usa un vídeo reducido y una frecuencia máxima configurable por `fps` (12 por defecto, de 1 a 20). En `webar-scene`, `facing-mode="user"` solicita la cámara frontal y `facing-mode="environment"` la trasera.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
