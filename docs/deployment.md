# Despliegue y seguridad del navegador

## Publicación estática

```sh
npm ci
npm run build
```

Publica tu HTML, tus recursos y `webar-facil.min.js` en un servidor HTTP/HTTPS. El standalone incluye el motor y sus dependencias. Publica el contenido de `dist/` completo si también quieres servir los ejemplos, el manual o las variantes con recursos separados.

Puedes alojar el standalone en otro origen HTTPS y referenciar la misma URL desde distintos sitios. Las imágenes y los modelos se resuelven respecto al HTML. Las variantes ESM y core siguen usando recursos separados. En ellas, las opciones `opencvURL` y `dracoDecoderPath` permiten configurar sus rutas.

El [inicio rápido](getting-started.md) utiliza un HTML junto al bundle. Los archivos de `examples/` del repositorio emplean `../dist/`; no intercambies esas rutas sin cambiar la ubicación del HTML. Comprueba el standalone actualizado, no solo su nombre de archivo: un bundle antiguo no registra los nuevos componentes.

## HTTPS y teléfono

`getUserMedia` requiere contexto seguro: HTTPS o localhost en desarrollo. Una página `http://192.168.x.x` normalmente no es un contexto seguro. En un teléfono `localhost` apunta al teléfono. Utiliza un dominio HTTPS accesible, un túnel HTTPS configurado por ti o una red local con certificado confiable para ese dispositivo.

Para exponer el servidor de desarrollo en red puedes usar `npm run dev -- --host 0.0.0.0`, pero eso por sí solo no añade HTTPS. Revisa firewall y acceso de red. No desactives la seguridad del navegador para simular un despliegue correcto.

En iframe el sitio superior debe conceder los permisos pertinentes, por ejemplo `allow="camera; xr-spatial-tracking"`, y su Permissions-Policy no debe bloquearlos. Un rechazo de permisos requiere una acción clara del usuario o cambios de configuración, no reintentos infinitos.

## MIME, rutas y cache

El servidor debe entregar JS como JavaScript, WASM como `application/wasm`, JSON como JSON y medios con su MIME. No redirijas una ruta JS que falta a `index.html`: producirá errores de sintaxis o MIME en lugar de cargar el Worker. Comprueba estado HTTP, URL y contenido en Network.

Actualiza bundles y recursos como una sola versión. Los nombres actuales no incluyen un hash de contenido en cada archivo; configura cache acorde y evita mezclar un Worker viejo con un binario de otro build. Para operación sin conexión, descarga previamente todos los recursos y gestiona tú el service worker; la librería no registra uno automáticamente.

## CSP

Punto de partida para una app con todo en mismo origen y su código en un JS externo:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self'; object-src 'none'; base-uri 'self'
```

Adapta la política a tu navegador, host y dependencias. Los ejemplos didácticos tienen scripts y estilos inline. La capa declarativa también crea estilos embebidos en shadow DOM: una política `style-src 'self'` los bloquea si no se autorizan, aunque el JS haya cargado. Configura los hashes o la política de estilos correspondientes; esta versión no expone un atributo de nonce para ese estilo interno. Draco puede crear un Worker con blob URL. No hay requisito general de COOP/COEP ni `SharedArrayBuffer` para este pipeline.

## CORS y datos

Prefiere recursos de mismo origen. Para imágenes, GLB o vídeos remotos el servidor remoto debe autorizar las peticiones y el uso en WebGL con CORS; una URL que se reproduce como enlace no garantiza que pueda subirse como textura. El prefijo `file://` y origen `null` no son un modo de despliegue soportado.

Por defecto captura y compilación se procesan localmente. Tu aplicación sigue siendo responsable de sus propias descargas, analytics, almacenamiento, permisos y tratamiento de datos. No cargues un módulo de odometría arbitrario indicado por un archivo de marcador: los plugins de código deben proceder de una configuración confiable.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
