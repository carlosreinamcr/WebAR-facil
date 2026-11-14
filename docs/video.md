# Vídeo MP4 y chroma key

## Vídeo declarativo recomendado

```html
<webar-scene>
  <webar-target src="./marcador.jpg">
    <webar-video src="./video.mp4" width="0.3" orientation="upright" chroma-key muted loop></webar-video>
  </webar-target>
</webar-scene>
```

Carga el standalone del [inicio](getting-started.md). La biblioteca gestiona reproducción y muestra un botón si el navegador la bloquea. Width, orientación y chroma se actualizan sin recargar; src puede reemplazarse esperando element.updateComplete sin reabrir cámara. Referencia de todos los atributos en [interacción](interaction.md); [ejemplo completo](../examples/declarative-video.html).

## API programática avanzada

Para los fragmentos siguientes parte de [integración programática](programmatic.md); `app` es un `ThreeARScene` creado por tu código. También existen componentes A-Frame. En esta API de bajo nivel setSource no reproduce automáticamente, a diferencia de la política predeterminada de la etiqueta.

```ts
const clip=new ThreeARVideo({
  width:0.2,
  orientation:'flat',
  muted:true,
  loop:true,
  chromaKey:{color:'#00ff00',similarity:0.12,smoothness:0.08,spill:0.3},
});
app.addContent('poster',clip);
await clip.setSource('./presentacion.mp4');
document.querySelector('#play').onclick=()=>{
  void clip.play().catch(error=>console.error('No se pudo reproducir',error));
};
```

El ejemplo es un fragmento que supone `app`, un target `poster` y un botón `#play` existentes. Ejemplo completo con selección de archivo: [vídeo y chroma](../examples/video.html).

## Reproducción

`setSource(Blob | string | URL)` espera metadata y establece el aspecto, pero **no inicia reproducción**. Usa `play()` desde una interacción; devuelve una promesa y puede ser rechazada por la política del navegador. `muted:true` facilita reproducción, sin eliminar la necesidad de manejar errores. `pause()` pausa sin destruir. `videoElement` permite controlar tiempo, volumen y eventos HTMLVideoElement.

No todos los MP4 tienen el mismo codec: la compatibilidad depende del navegador. Usa un perfil H.264 compatible con tu público y prueba el archivo real en los teléfonos objetivo. No existe una conversión automática de codec.

El flujo nativo del elemento de vídeo y su textura sigue avanzando aunque falte tracking. No llames `setSource`, `play` o `currentTime=0` desde `onPose`/`targetFound` para cada frame. Ocultar el contenido no pausa automáticamente el MP4: si quieres ahorrar batería al perder el target, decide esa política en tu aplicación y acepta sus efectos sobre continuidad.

## Geometría y opciones

`width` debe ser positivo. La altura se obtiene de la relación de aspecto del vídeo. `orientation:'flat'` coloca la pantalla en XZ sobre la imagen; `'upright'` la coloca vertical, con base Y=0. `setWidth(number)` cambia el tamaño. `mesh` expone la superficie renderizada.

```ts
clip.setChromaKey(false);
clip.setChromaKey({color:'#0000ff',similarity:0.15,smoothness:0.06,spill:0.2});
```

El chroma se calcula en GPU. `similarity` y `spill` van de 0 a 1; `smoothness` debe ser >0 y <=1. No elimina automáticamente cualquier fondo: necesita un fondo de color suficientemente uniforme y ajustes según iluminación. Eliminar verde no convierte un MP4 en un archivo con canal alfa ni resuelve oclusión con objetos del mundo.

Para reproducir archivos locales puedes pasar directamente el `File`. El wrapper gestiona sus blob URLs y las revoca al sustituir o disponer. Para URL remota el servidor debe permitir el uso de medios en WebGL mediante CORS; se recomienda mismo origen.

`dispose()` es final: pausa, libera textura/material/geometría y las URLs propias. Si usas `ThreeARScene`, registra el clip con `addContent` para que la escena gestione su ciclo de vida.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
