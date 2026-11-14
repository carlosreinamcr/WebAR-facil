# Persistencia de mapas locales

## Qué es un mapa en esta biblioteca

Al mover el teléfono, el backend óptico sigue detalles de la imagen, estima puntos 3D y conserva algunas vistas de referencia (keyframes). Es una memoria local y dispersa del entorno: permite relacionar observaciones nuevas con lugares ya vistos y estimar la cámara respecto a ellos. No es una fotografía, un marcador compilado ni una malla completa de la habitación.

El ancla describe dónde se colocó el contenido dentro de ese sistema de coordenadas. Si se pierde el seguimiento, la relocalización intenta reconocer las referencias guardadas y comprobar geométricamente una pose. Guardar un ancla por sí sola no permite saber dónde está ahora el teléfono.

Durante una sesión el mapa se mantiene en memoria automáticamente. Persistirlo entre sesiones es optativo mediante exportSLAMMap/importSLAMMap y almacenamiento de la aplicación. El mapa conserva hasta 50 fotogramas clave y usa referencias locales para relocalizarse. Su escala es relativa al iniciar sin referencia métrica; una semilla válida de marcador con tamaño físico conocido puede establecer escala métrica.

Por ejemplo: colocas un modelo sobre una mesa, mueves el teléfono y vuelves a mirar la mesa. Las referencias del mapa pueden ayudar a recuperar el seguimiento. Si cambió la apariencia, falta textura o la cámara/proyección no es compatible, esa recuperación puede fallar. No se garantiza reconocer la misma habitación en otro móvil o al día siguiente.

## Guardar de forma optativa

El [HTML completo 13-mapas-locales](../examples/PRUEBAS/13-mapas-locales.html) muestra guardar, recuperar y borrar mediante IndexedDB. Usa el backend óptico y colocación manual; oculta el contenido recuperado hasta recibir una relocalización real. Permite detener/reiniciar con cámara y configuración compatibles. Eliminar guardado borra la copia persistida, sin destruir el mapa activo en memoria.

Función avanzada con código de aplicación. Si iniciaste mediante etiquetas, accede a la instancia actual con `scene.engine` después de `ar-ready`; espera además a disponer de un mapa exportable antes de guardarlo. `ar-ready` no garantiza geometría suficiente. El motor interno cambia en cada reinicio declarativo.

`exportSLAMMap()` e `importSLAMMap()` operan únicamente con el backend óptico activo. No son exportaciones de mapas ARCore/ARKit. El seguimiento debe haber construido un mapa local exportable con keyframes válidos.

```ts
const snapshot=await engine.exportSLAMMap();
// snapshot contiene typed arrays. IndexedDB conserva esos tipos por structured clone.
await saveToIndexedDB('escena-1',snapshot); // Adaptador de tu aplicación.
```

`saveToIndexedDB` no es un método de la biblioteca. Implementa almacenamiento, consentimiento, cuota y borrado según tu producto; [recetas programáticas](recipes-programmatic.md) incluye un adaptador IndexedDB completo. No conviertas directamente `Float32Array` y `Uint8Array` mediante JSON y esperes recibir los mismos tipos al cargar.

## Contrato del snapshot

`SLAMMapSnapshot` incluye `version:1`, `map`, `anchor:Float32Array | null` y `targetId`. El mapa incluye intrínsecos, `scale`, `mapId`, keyframes con descriptores, puntos 3D y matrices de vista, y opcionalmente un plano verificado.

No almacena imágenes de cámara en el snapshot, pero la geometría y descriptores pueden seguir siendo información sensible del lugar. No los publiques por defecto. La biblioteca no sube mapas a un servidor.

## Restaurar

```ts
// Primero inicia cámara y backend óptico con configuración compatible.
await engine.importSLAMMap(snapshot);
// A continuación debe observar el entorno y relocalizarse.
// No publiques snapshot.anchor como pose actual de cámara.
```

La importación valida dimensiones, versión, geometría, IDs y proyección, restablece el estado y espera relocalización. No se emite una pose guardada como si fuese una observación nueva. El entorno tiene que conservar suficiente apariencia y geometría.

Utiliza la misma cámara, lente, modo de captura y proyección compatibles. En una instancia nueva puedes configurar `calibration: snapshot.map.intrinsics` para conservar la proyección de ese mapa, con `camera.maxFrameWidth` suficiente para sus dimensiones. Esto no convierte unos intrínsecos estimados en calibración física medida y no garantiza portabilidad entre dispositivos. Si el mapa es incompatible, recházalo y vuelve a mapear.

Conserva también el perfil y los límites de análisis compatibles. El motor fuerza el ancho del mapa importado y no lo reduce para satisfacer un presupuesto menor: hacerlo invalidaría sus referencias. Cambiar perfil durante la sesión declarativa reinicia el motor; no transforma automáticamente un mapa entre resoluciones, cámaras o lentes.

El mapa es local y acotado; no ofrece cierre de bucle global, fusión IMU ni anclas compartidas multijugador. Guardar y recuperar un mapa no elimina por sí mismo la deriva. Consulta [API avanzada](advanced.md) para extender el backend.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
