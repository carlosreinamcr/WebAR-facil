# Modelos GLB y animaciones

## Modelo en HTML

Dentro de `webar-target` (imagen) o directamente en `webar-scene mode="slam"`:

```html
<webar-model src="./Kai.glb" size="0.4" scale="2" rotation="0 180 0" position="0 0.02 0"></webar-model>
```

`size` ajusta la mayor dimensión inicial (0.16 por defecto). `scale` es un multiplicador uniforme o XYZ; `rotation` son grados XYZ, no radianes. En modo SLAM sin referencia física, las unidades del mapa son relativas. No se garantiza que size=1 represente un metro real.

La animación inicial es el primer clip si existe. Para seleccionar uno:

```html
<webar-model id="modelo" src="./Kai.glb" animation="Caminar"></webar-model>
```

El nombre debe existir. También se admite un índice desde 0 o `animation="none"`. Para conocer los nombres, registra `scene.addEventListener('modelLoaded', event => console.log(event.detail.animations))` antes de pulsar Iniciar AR.

Tras cargar, `document.querySelector('#modelo').setAttribute('animation','Bailar')` cambia el clip. Scale, rotation, position y size se aplican en vivo. Src reemplaza el GLB sin cerrar cámara; espera element.updateComplete y maneja su rechazo. Las animaciones admiten pausa, velocidad, once/pingpong, repeticiones y crossfade: [atributos de interacción](interaction.md). Se actualizan automáticamente, sin un loop propio.

## API programática avanzada

El resto de esta guía describe `ThreeARModel` para renderer propio, ajustes que no expone la etiqueta o integración con vídeo/contenido compuesto. `app` debe ser una escena creada como en [integración programática](programmatic.md).

```ts
const model=new ThreeARModel({
  dracoDecoderPath:new URL('./decoders/draco/',document.baseURI),
  maxBytes:64*1024*1024,
});
app.addContent('poster',model);
await model.load('./modelo.glb',{fitSize:0.16,autoplay:true});
```

`load()` acepta `Blob`/`File`, string o `URL` y devuelve `Promise<this>`. Los GLB deben ser versión 2 y autocontenidos: geometría y texturas embebidas o data URI. El límite predeterminado es 64 MiB. No es un cargador de `.gltf` con recursos externos. `KHR_texture_basisu`/KTX2 no está implementado por este wrapper.

## Compresión

- **GLB normal:** no requiere un decoder adicional.
- **Draco:** sirve el directorio `decoders/draco/`; la etiqueta lo localiza junto al SDK. Con la clase programática configura la URL si difiere del valor predeterminado; se utiliza un Worker de decodificación.
- **Meshopt:** decoder integrado; no se configura un directorio adicional.

Compresión geométrica no significa que las texturas consuman poca GPU. Reduce dimensiones de texturas, cantidad de materiales y complejidad del modelo según el dispositivo.

## Ajuste del tamaño

`fitSize` vale 0.16 por defecto: ajusta la mayor dimensión del modelo, centra XZ y coloca la base en Y=0 mediante un grupo padre, conservando las transformaciones y el rig del archivo. Usa `{fitSize:false}` para respetar las unidades del GLB.

```ts
await model.load(file,{fitSize:false,autoplay:false});
console.log(model.animations.map(clip=>clip.name));
model.playAnimation('Caminar'); // También acepta índice; sin argumento, 0.
model.stopAnimations();
```

`playAnimation(nameOrIndex, options?)` reinicia la acción elegida. Con crossFadeSeconds hace transición desde la anterior; sin fade la detiene inmediatamente. Options acepta loop (repeat/once/pingpong), speed positivo, repetitions, crossFadeSeconds de 0 a 10 y clampWhenFinished. No lo llames en cada pose.

`pauseAnimations()`/`resumeAnimations()` conservan el tiempo. `configureAnimation(options)` cambia parámetros sin reiniciar; `animationState` permite inspección. `onAnimationFinished(listener)` informa el clip terminado y devuelve desuscripción. `setSize(size)` reajusta la geometría cargada sin descargarla otra vez. Los wrappers declarativos usan estos métodos; el renderer propio conserva su obligación de llamar a update.

## Actualización y limpieza

`ThreeARScene.addContent()` registra los modelos y vídeos presentes en el árbol en ese momento para su actualización y disposición. Con renderer propio debes llamar a `model.update(deltaSeconds)` desde tu loop. El método limita pasos mayores de 0.1 s para evitar saltos extremos.

```ts
// Solo con renderer propio; ThreeARScene ya realiza esta actualización.
renderer.setAnimationLoop(()=>{
  model.update(clock.getDelta());
  renderer.render(scene,camera);
});
```

`model.model` expone el `Group` cargado o `null`. `unload()` libera el contenido manteniendo el cargador reutilizable; `dispose()` es final y libera geometrías, texturas y decoder. Una nueva carga cancela la pendiente anterior; una carga fallida no reemplaza un modelo válido por un falso éxito.

Si añades un modelo a un grupo después de que ese grupo fuese registrado con `addContent`, regístralo explícitamente mediante `addContent(id,model)` o administra tú su actualización y limpieza. No asumas que el contenedor observa cualquier mutación futura del árbol.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
