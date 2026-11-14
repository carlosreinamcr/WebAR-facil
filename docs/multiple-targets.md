# Varios marcadores

Un motor puede seguir hasta **8 imágenes distintas** con un frame compartido y estados independientes. Dos copias del mismo cartel no se convierten en dos anclajes diferentes.

## HTML recomendado

```html
<webar-scene>
  <webar-target src="./imagen-a.jpg" target-id="a">
    <webar-model src="./producto-a.glb" size="0.3"></webar-model>
  </webar-target>
  <webar-target src="./imagen-b.png" target-id="b">
    <webar-model src="./producto-b.glb" size="0.3"></webar-model>
  </webar-target>
</webar-scene>
```

Usa el script standalone del [HTML completo](getting-started.md). La biblioteca inicia una sola cámara y carga los targets secuencialmente. Los eventos DOM incluyen `event.detail.targetId`; no crees un motor por etiqueta.

Puedes cambiar jerarquía y retirar/añadir marcadores sin reiniciar cámara; modifica el DOM y espera `scene.refresh()`. La sincronización es por operación y los targets pueden necesitar redetección. Solo se permite cambiar targets en modo imagen; durante SLAM se permite cambiar el contenido. Para control directo de objetos y recursos sigue disponible la API avanzada.

## API programática avanzada

Los siguientes fragmentos suponen un `app` de [integración programática](programmatic.md).

```ts
const first=new ThreeARModel();
const second=new ThreeARModel();
app.addContent('a',first);
app.addContent('b',second);
await first.load('./producto-a.glb');
await second.load('./producto-b.glb');
await app.engine.startCamera();
await app.engine.addImageTarget('a','./imagen-a.jpg');
await app.engine.addImageTarget('b','./imagen-b.png');

app.engine.on('targetFound',({targetId})=>console.log('Apareció',targetId));
app.engine.setKeepContentOnLost(true,'a');
app.engine.setKeepContentOnLost(false,'b');
```

Con varios targets usa `addImageTarget` o `addTarget`. `loadImageTarget` y `loadTarget` reemplazan todos los targets por `default` y no son operaciones aditivas. El ID distingue contenido, eventos y política de retención; no utiliza el nombre de archivo automáticamente.

Para retirar uno:

```ts
await app.engine.removeTarget('b');
app.removeContent(second);
second.dispose();
```

`removeContent()` solo separa el objeto y su actualización automática; debes disponerlo si no lo reutilizarás. `getAnchor(id)` devuelve el grupo de contenido, no una prueba de que el target esté cargado.

El Worker comparte conversión gris, detección y extracción cuando corresponde; no se crea una cámara ni un Worker completo por imagen. El coste de matching y seguimiento aumenta con los targets. El límite de ocho es un límite de API, no una promesa de rendimiento con ocho marcadores en un móvil.

En seguimiento espacial se selecciona un solo target para la transición. Los demás contenidos de imagen se ocultan; no se convierten todos en anclajes SLAM automáticamente. Ejemplo ejecutable: [multimarcador](../examples/multi-target.html).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
