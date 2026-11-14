# Integración con Three.js

Guía avanzada para una aplicación que ya necesita código Three.js o un renderer propio. Para imagen/GLB y SLAM básicos utiliza [HTML declarativo](getting-started.md), que ya configura estas clases. No crees otro renderer sobre una escena declarativa.

## Escena gestionada

```ts
const app=new ThreeARScene({
  container:document.querySelector('#view'),
  maxPixelRatio:2,
  lighting:true,
  engineOptions:{opencvURL:new URL('./vision/opencv.js',document.baseURI)},
});
const model=new ThreeARModel();
app.addContent('poster',model);
await model.load('./modelo.glb');
await app.engine.startCamera();
await app.engine.addImageTarget('poster','./poster.png');
```

En TypeScript valida que `querySelector` devuelve un `HTMLElement` antes de pasarlo al constructor. El ejemplo es un fragmento para insertar después de importar las clases. El HTML completo está en [integración programática](programmatic.md).

`app.engine`, `app.scene`, `app.camera` y `app.renderer` son públicos. `getAnchor(id)` devuelve un `ThreeARGroup` enlazado a ese ID. `addContent(id,object)` añade contenido y registra modelos/vídeos para su gestión; `removeContent(object)` lo separa sin destruirlo. `onRender(callback)` ejecuta lógica independiente del tracker y devuelve una función de retirada.

```js
const {THREE}=WebARFacil; // Con standalone; en ESM: import * as THREE from 'three'.
const box=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.05),new THREE.MeshNormalMaterial());
box.position.y=.025;
app.addContent('poster',box);
const off=app.onRender(dt=>{box.rotation.y+=dt;});
// Al retirar contenido de creación propia:
off();app.removeContent(box);box.geometry.dispose();box.material.dispose();
```

`ThreeARScene.dispose()` libera sus modelos y vídeos registrados, pero los recursos de mallas propias pertenecen a la aplicación. No instales un segundo `setAnimationLoop` en su renderer: usa `onRender`.

## Renderer existente

[Ejemplo 29 · Three.js con renderer propio](../examples/PRUEBAS/29-threejs.html) muestra un GLB animado sobre un marcador con la cámara, la proyección y el bucle de render controlados desde JavaScript.

Usa `WebAREngine`, `ThreeARGroup` y `ThreeCameraBackground`. [custom-app.html](../examples/custom-app.html) es una aplicación completa con control manual del viewport, fondo, matrices, animación y limpieza.

```ts
const tracked=new ThreeARGroup().bind(engine,'poster');
scene.add(tracked);
camera.matrixAutoUpdate=false;
const offPose=engine.onPose((_matrix,pose)=>{
  if(pose.backend==='webxr') return; // En XR el renderer XR controla las cámaras.
  camera.matrix.fromArray(pose.viewMatrix).invert();
  camera.updateMatrixWorld(true);
  if(pose.projectionMatrix){
    camera.projectionMatrix.fromArray(pose.projectionMatrix);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
});
```

`bind` sincroniza `worldMatrix`, visibilidad, tolerancia y estado del motor. `unbind()` retira los listeners. `dispose()` desuscribe el grupo, pero no destruye sus hijos. `update(matrix,pose?)` permite integración manual: con metadata usa la matriz de mundo; sin metadata solo dispones de ModelView y debes mantener la cámara identidad.

El fondo y la proyección deben representar el mismo recorte/aspecto del vídeo. No estires el feed con CSS mientras mantienes otra proyección. `ThreeARScene` hace letterbox con la proporción de la cámara. `ThreeCameraBackground` permite rectificación cuando se proporciona calibración con distorsión; no exige un proceso manual para tracking normal.

## XR y fallos de contexto

El wrapper gestionado configura el renderer XR. Un renderer propio debe suministrar `attachXRSession`, `getXRContext` y su bucle XR antes de usar el backend nativo. No dibujes el vídeo getUserMedia como fondo durante una sesión inmersiva: el compositor XR aporta la cámara real.

Al perderse el contexto WebGL, `ThreeARScene` detiene el motor. Tras restaurarlo vuelve el render, pero tu aplicación debe permitir reiniciar cámara y cargar targets otra vez. No se oculta este fallo con una pose artificial.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
