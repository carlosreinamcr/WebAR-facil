# Recetas programáticas avanzadas

Estos fragmentos se insertan en la [aplicación programática completa](programmatic.md). `app` es un `ThreeARScene` existente; en standalone las clases se obtienen de `WebARFacil`, y con NPM se importan del paquete. Para etiquetas HTML utiliza [recetas declarativas](recipes.md); no mezcles un `app` inexistente con una escena declarativa.

## Imagen y modelo elegidos por el usuario

```html
<input id="marker" type="file" accept="image/jpeg,image/png">
<input id="model" type="file" accept=".glb">
<button id="apply">Usar estos archivos</button>
```

```js
const content=new ThreeARModel();
app.addContent('usuario',content);
document.querySelector('#apply').onclick=async event=>{
  const button=event.currentTarget;
  const image=document.querySelector('#marker').files[0];
  const file=document.querySelector('#model').files[0];
  if(!image||!file) return;
  button.disabled=true;
  try{
    await content.load(file);
    await app.engine.startCamera();
    const result=await app.engine.addImageTarget('usuario',image);
    console.log(result.metadata.quality.warnings);
  }catch(error){console.error(error);}
  finally{button.disabled=false;}
};
```

Para un flujo de reemplazo con cámara ya activa, no vuelvas a invocar `startCamera()` sin gestionar el estado; sustituye solo el modelo y el target. Bloquea también los controles de configuración incompatibles mientras haya una operación en curso.

## Descargar .dat y JSON opcionalmente

```js
function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const compiled=await app.engine.addImageTarget('poster',file);
download(new Blob([compiled.buffer],{type:'application/octet-stream'}),'poster.dat');
download(new Blob([JSON.stringify(compiled.metadata,null,2)],{type:'application/json'}),'poster.dat.json');
```

`file` debe ser un `File` JPG/PNG elegido previamente. Para iniciar tracking basta con la llamada a `addImageTarget`; las descargas son una función optativa de tu aplicación.

## Contenido compuesto e interacción

```js
const {THREE}=WebARFacil;
const contentRoot=new THREE.Group();
const model=new ThreeARModel();
contentRoot.add(model);
app.addContent('poster',contentRoot);
await model.load('./modelo.glb');
const off=app.onRender(dt=>{contentRoot.rotation.y+=dt*0.2;});
```

Modifica hijos del anchor, no el anchor que recibe matrices. Para picking, crea un `THREE.Raycaster`, calcula NDC respecto a `app.renderer.domElement.getBoundingClientRect()` y utiliza `app.camera`; el vídeo puede tener letterbox. Tu aplicación define qué hacer al pulsar el modelo.

## Checkbox de retención

```html
<label><input id="retain" type="checkbox">Conservar contenido al perder imagen</label>
```

```js
document.querySelector('#retain').onchange=event=>{
  app.engine.setKeepContentOnLost(event.currentTarget.checked);
};
```

## Persistir mapas en IndexedDB

Adaptador mínimo para `SLAMMapSnapshot`, con clones que conservan typed arrays:

```js
async function openMaps(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('webar-local',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('maps');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function mapStore(mode,operation){
  const db=await openMaps();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('maps',mode);
      const request=operation(tx.objectStore('maps'));
      let value;
      request.onsuccess=()=>{value=request.result;};
      tx.oncomplete=()=>resolve(value);
      tx.onabort=()=>reject(tx.error??new Error('Transacción abortada'));
      tx.onerror=()=>reject(tx.error??request.error);
    });
  }finally{db.close();}
}
// Con odometría activa y un mapa válido:
const snapshot=await app.engine.exportSLAMMap();
await mapStore('readwrite',store=>store.put(snapshot,'mi-escena'));
const restored=await mapStore('readonly',store=>store.get('mi-escena'));
if(restored) await app.engine.importSLAMMap(restored);
// Espera relocalización antes de mostrarlo como posición válida.
```

Es JavaScript de aplicación, no una API de la librería. Gestiona errores de cuota, contenido obsoleto y permisos de almacenamiento en tu UI. Lee [compatibilidad de mapas](maps.md) antes de restaurar otra sesión.

## SPA o cambio de pantalla

```js
const subscriptions=[
  app.engine.onError(console.error),
  app.engine.on('targetFound',event=>console.log(event.targetId)),
];
async function unmount(){
  subscriptions.forEach(off=>off());
  await app.dispose();
  // Libera aquí mallas propias, listeners DOM y URLs que creó tu aplicación.
}
```

No confíes únicamente en `pagehide` en una SPA: llama a tu limpieza al desmontar. Para pausar conservando la escena usa `await app.engine.stop()`; al volver, reinicia cámara y targets. El renderizador y los medios tienen ciclo de vida propio y no equivalen a la captura de cámara.


## Texto editable en realidad aumentada

Dibuja el texto en un canvas y úsalo como `THREE.CanvasTexture` en un `THREE.Sprite`. Cuando cambia el campo de texto, vuelve a dibujar y marca la textura con `needsUpdate = true`. Añade el sprite al ancla del marcador o al ancla espacial después de `ar-ready`.

[Ejemplo 4](../examples/PRUEBAS/04-texto-marcador.html) · [Ejemplo 10](../examples/PRUEBAS/10-texto-slam.html)


## Controlar la iluminación

En `ar-ready`, obtén la escena de Three.js desde `scene.app.scene`. Busca la luz direccional y usa el valor del deslizador para cambiar su posición. Aplica el valor inicial al cargar la escena y vuelve a aplicarlo en el evento `input`.

[Ejemplo 6](../examples/PRUEBAS/06-iluminacion-marcador.html) · [Ejemplo 12](../examples/PRUEBAS/12-iluminacion-slam.html)


## Seleccionar partes del modelo

Convierte la posición del puntero a coordenadas normalizadas del canvas y usa `THREE.Raycaster` con la cámara de la escena. Busca la primera malla intersectada y resalta su material. Guarda el estado original para restaurarlo al limpiar la selección.

[Ejemplo 19](../examples/PRUEBAS/19-seleccionar-partes.html)


## Cambiar colores del catálogo

Actualiza el atributo `src` del modelo y espera `updateComplete`. Después recorre el GLB para buscar las mallas que quieres teñir y aplica `material.color.set(...)`. Repite el ajuste al cambiar el selector de color.

[Ejemplo 20](../examples/PRUEBAS/20-catalogo-colores.html)


## Combinar modelo texto y vídeo

Coloca el GLB y el MP4 dentro del mismo `webar-target`. Añade el sprite de texto a esa misma ancla. Cada contenido conserva su propio control de visibilidad o reproducción.

[Ejemplo 24](../examples/PRUEBAS/24-contenido-compuesto.html)


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
