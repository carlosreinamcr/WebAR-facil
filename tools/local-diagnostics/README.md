# Recolector local WebAR para XAMPP

Los teléfonos envían el snapshot estadístico del SDK al mismo servidor del ejemplo. PHP escribe los JSON en el computador, fuera de htdocs. No se envían frames, imágenes, vídeos, matrices de pose, descriptores ni mapas. El SDK distribuido no incorpora este cliente: se instala en los ejemplos de desarrollo elegidos.

## Instalación

Desde el repositorio:

```sh
node scripts/install-local-diagnostics.mjs --site C:/xampp/htdocs/2
node scripts/install-local-diagnostics.mjs --site C:/xampp/htdocs/2 --apply
```

La primera llamada prepara una copia en artifacts/local-diagnostics-install. --apply respalda los HTML y conecta los 25 ejemplos y la galería. Instala diagnostics/ en el sitio y Examples/local-reports.js. El 25 conecta su engine mediante WebARLocalReports.attachEngine; las etiquetas propias reutilizan su ARDiagnostics existente. No se abre una segunda cámara ni se crea otro motor.

PHP requiere escritura en la carpeta configurada en diagnostics/config.php. La instalación crea informes en reports/local-devices/data/<instalación>/ dentro del repositorio y mantiene las claves de instalación aparte. Ambos quedan fuera de htdocs y excluidos de Git. El panel permite consultar los JSON mediante PHP; no hay enlaces públicos al directorio de almacenamiento.

## Usar desde los teléfonos

Abre **https://192.168.1.16/2/diagnostics/mobile.html**. El host será el mismo que ya utilizas para tus ejemplos HTTPS. Escribe una etiqueta como iPhone o Android económico; si corresponde, marca que pruebas un equipo físico. Se conservan en ese navegador. Cambiar de navegador/origen crea otra identidad local, no identifica el hardware mediante fingerprinting.

Abre un ejemplo, inicia cámara y prueba su contenido. Los informes se envían al preparar la sesión, cada 15 segundos mientras se registra, al detener y al salir/ocultar la página. El panel inferior muestra cuándo el PC confirma la recepción. **Guardar y siguiente** detiene la sesión y avanza al próximo HTML. Para SLAM sigue siendo necesario mover el teléfono y colocar el contenido manualmente.

La URL del API se calcula desde el script, así que HTTPS usa HTTPS y no hay mezcla de contenido. Nunca se envía a localhost desde el teléfono: localhost sería el propio teléfono. No requiere cambiar certificados, abrir otro puerto ni ejecutar un servicio Node adicional.

## Ver y analizar desde el computador

Abre **http://localhost/2/diagnostics/**. Se actualiza cada cinco segundos, permite filtrar por equipo/ejemplo, ver el JSON y consultar intentos anteriores. Las pruebas automatizadas se ocultan por defecto y siempre conservan execution=automated. Tener informe no significa que la experiencia haya aprobado una prueba física.

Los JSON quedan disponibles para el asistente en reports/local-devices/data/<instalación>/. Cada archivo contiene client, example, reason y report; el snapshot original está en report. index.json resume las sesiones. El asistente puede leerlos cuando se le pida; este recolector no inicia ni notifica por sí mismo un chat o análisis automático.

## Recuperación y límites

- Un JSON por sesión se actualiza, no se crea otro archivo cada 15 segundos. La secuencia impide que un envío tardío sobrescriba uno más reciente.
- Ante fallos de red se conserva la última captura pendiente por sesión, hasta 16 sesiones y aproximadamente 700 KB en localStorage. No es una garantía de almacenamiento ilimitado; si el navegador no permite escribir, la cola queda solo en memoria y se indica en el panel.
- sendBeacon al salir no confirma recepción: la copia pendiente permanece hasta obtener respuesta del servidor. El siguiente ejemplo reintenta. Puede faltar el último instante si se cierra el navegador sin aviso o se pierde el almacenamiento.
- El servidor acepta hasta 256 KB por envío y 2000 sesiones. No borra informes antiguos automáticamente. Archiva los archivos fuera del directorio antes de superar el límite.
- Solo se aceptan conexiones de red privada/loopback, mismo origen y un token de instalación para escribir. Es una herramienta de laboratorio local, no un servicio para publicar en Internet.
- El backend nativo puede ocultar el DOM durante XR. Al salir de XR o volver a la página se envía otro snapshot. A-Frame aporta métricas del renderer muestreadas, pero no se inventa una frecuencia de render cuando no se ha medido.
- Reinstalar conserva el token, el historial y los recursos del usuario. Copiar HTML nuevos sobre la instalación exige volver a ejecutar el instalador para reconectarlos.


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
