# Recetas con HTML declarativo

Parte del [HTML completo de inicio](getting-started.md). Estos fragmentos reemplazan las etiquetas de contenido o añaden interacción opcional; conserva el script standalone y sus recursos. Las rutas `./` de esta guía suponen que tu HTML está junto al bundle en tu propio sitio.

Para aprender con archivos completos, abre [PRUEBAS: 27 recetas](../examples/PRUEBAS/index.html). Incluye modelos GLB distintos, botones de sustitución, movimiento/giro/pellizco, texto editable, MP4 e iluminación, cada uno con marcador o SLAM óptico, persistencia de mapas y [colocación con mira](../examples/PRUEBAS/26-colocacion-con-mira.html). Los GLB, imagen y MP4 originales están en su carpeta assets. La escala de los ejemplos ópticos es relativa; sus tamaños iniciales son ajustables.

Las recetas 14–25 amplían la galería con multimarcador, selección de clips, chroma ajustable, archivos del usuario, retención, picking de piezas, catálogo/colores, transición verificada a odometría, WebXR nativo, perfiles de rendimiento, contenido compuesto y A-Frame. Sus rutas fuente son ../dist/webar-facil.min.js y ../assets/marcador.jpg; [la guía de PRUEBAS](../examples/PRUEBAS/README.md) detalla los ocho recursos necesarios y el árbol de carpetas. Los archivos 01–13 conservan sus rutas previas.

## Una imagen y un modelo

```html
<webar-scene>
  <webar-target src="./marcador.jpg" target-id="poster">
    <webar-model src="./Kai.glb" size="0.4"></webar-model>
  </webar-target>
</webar-scene>
```

El modelo reproduce su primera animación si la tiene. La biblioteca añade los botones de cámara; no escribas otros listeners de inicio para el caso básico.

## Tamaño, orientación y clip

```html
<webar-model src="./Kai.glb" size="0.5" scale="2" rotation="0 180 0" animation="Caminar"></webar-model>
```

`size` ajusta la mayor dimensión inicial; `scale` la multiplica. `rotation` son grados XYZ. `animation` debe existir en el GLB; usa `none` para detener o el índice `0` para seleccionar el primero si existe. En SLAM sin referencia física la escala es relativa.

## Control de tamaño y giro en vivo

En tu escena, asigna `id="modelo"` a `webar-model`. Añade los controles **fuera de webar-scene**: la escena no presenta sus hijos como UI, sino como descripciones de contenido.

```html
<label>Tamaño <input id="size" type="range" min="0.1" max="100" step="0.1" value="1"></label>
<label>Giro <input id="rotation" type="range" min="-180" max="180" value="0"></label>
<script>
  const modelElement=document.querySelector('#modelo');
  document.querySelector('#size').oninput=event=>modelElement.setAttribute('scale',event.currentTarget.value);
  document.querySelector('#rotation').oninput=event=>modelElement.setAttribute('rotation',`0 ${event.currentTarget.value} 0`);
</script>
```

Coloca este script después de las etiquetas y controles. Cambiar `scale`, `rotation`, `position` o `animation` se aplica en vivo y no modifica el anclaje.

## Ver los nombres de animación

```js
const scene=document.querySelector('webar-scene');
scene.addEventListener('modelLoaded',event=>console.log(event.detail.animations));
// Una vez cargado, desde un botón o una acción de aplicación:
// document.querySelector('#modelo').setAttribute('animation','Caminar');
```

No selecciones la misma animación en cada pose: la reiniciarías. En [modelos](models.md) se muestra cómo seleccionarla por nombre o índice.

## Conservar contenido al perder imagen

```html
<webar-scene keep-content-on-lost loss-grace="650">
  <webar-target src="./marcador.jpg">
    <webar-model src="./Kai.glb"></webar-model>
  </webar-target>
</webar-scene>
```

`loss-grace` es tolerancia en milisegundos. Retención mantiene la última transformación, no crea un anclaje espacial. Para una política en vivo, después de `ar-ready` puedes usar `scene.engine.setKeepContentOnLost(enabled)`. El atributo de escena se lee al iniciar; si quieres conservar la política al reiniciar, actualiza también ese atributo.

## SLAM y transición

```html
<webar-scene mode="slam">
  <webar-model src="./Kai.glb" size="0.5"></webar-model>
</webar-scene>
```

Inicia odometría óptica sin marcador. Para pasar desde una imagen, usa una escena de imagen y añade `slam`: la biblioteca muestra el botón de transición. [Seguimiento espacial](spatial-tracking.md) explica escaneo, WebXR y los resultados que todavía requieren selección o paralaje.

## Sustituir archivos sin reiniciar

Con la escena ya registrada y fuera de otra operación:

```js
async function replaceContent(){
  const scene=document.querySelector('webar-scene');
  const model=scene.querySelector('webar-model');
  model.setAttribute('src','./otro-modelo.glb');
  await model.updateComplete;
  scene.querySelector('webar-target').setAttribute('src','./otra-imagen.jpg');
  await scene.refresh();
}
// Desde un botón: void replaceContent().catch(console.error);
```

La cámara y el renderer se conservan. Los cambios de targets están disponibles en modo imagen; durante SLAM puedes cambiar modelos/vídeos. Size es inmediato. La jerarquía se sincroniza automáticamente y puedes esperar scene.refresh(). Captura, mode y backend sí requieren parar y reiniciar. Bloquea controles incompatibles mientras una actualización esté pendiente; [interacción](interaction.md) define las promesas, cancelación y errores.

## Código avanzado

Selección de archivos `File`, descarga opcional de `.dat`/JSON, contenido Three.js compuesto, mapas en IndexedDB y gestión manual de una SPA se documentan en [recetas programáticas](recipes-programmatic.md). Vídeo/chroma, gestos y reproducción avanzada ya tienen [integración declarativa](interaction.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
