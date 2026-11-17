# Manual de WebAR Fácil

**Español** · **[English](en/README.md)**

Puedes crear tu propio `index.html`, cargar una imagen JPG/PNG, asociarle contenido y programar la interacción. El seguimiento de imágenes funciona con webcam de escritorio y cámara móvil sin calibración manual.

## Empieza aquí

El recorrido recomendado utiliza **HTML declarativo**. Un script y etiquetas para imagen/modelo; cámara y controles incluidos, sin JavaScript de aplicación.

1. [Primera aplicación con HTML](getting-started.md): probar el repositorio y copiar un HTML completo para tu sitio.
2. [Referencia de etiquetas](declarative.md): atributos de escena, marcador y modelo; rutas y errores de carga.
3. [Recetas declarativas](recipes.md): tamaño, giro, clips, retención y reinicio.
4. [Instalación y distribución](installation.md): archivos locales, alojamiento remoto, ESM y NPM.

## Elegir una integración

| Tu aplicación | Ruta recomendada |
| --- | --- |
| Imagen y GLB, varios marcadores o SLAM con controles incluidos | [HTML declarativo](getting-started.md) |
| Mostrar un modelo al detectar un celular | [Reconocimiento de celulares](phone-detection.md) |
| Botones e interacción propios sobre las etiquetas | [Recetas](recipes.md), [eventos DOM](events.md) |
| MP4/chroma, gestos y cambios de contenido sin reiniciar | [Interacción declarativa](interaction.md) |
| Recursos Blob o control explícito del motor | [Programática avanzada](programmatic.md), [recetas avanzadas](recipes-programmatic.md) |
| Renderer Three.js o proyecto A-Frame existente | [Three.js](threejs.md), [A-Frame](aframe.md) |
| Sustituir captura, tracking, WASM u odometría | [API avanzada](advanced.md) |

## Referencia y guías

| Necesidad | Documento |
| --- | --- |
| Escenas, marcadores y modelos mediante etiquetas | [Referencia declarativa](declarative.md) |
| Inicializar, cargar targets y cambiar de modo | [WebAREngine](api-engine.md) |
| Clases, tipos y firmas exactas | [API generada](api-generated.md), [contrato JSON](api.json) |
| Crear y compilar imágenes | [Marcadores](image-targets.md) |
| Contenido independiente por imagen | [Varios marcadores](multiple-targets.md) |
| Eventos, tolerancia y calidad | [Eventos y diagnóstico](events.md) |
| GLB, Draco, Meshopt y animaciones | [Modelos](models.md) |
| MP4 y chroma key | [Vídeo](video.md) |
| Gestos, crossfade y actualizaciones en vivo | [Interacción](interaction.md) |
| Evidencia de deriva y recuperación | [Validación de odometría](odometry-validation.md) |
| Medir y comparar iPhone/Android | [Diagnósticos](diagnostics.md), [protocolo físico](device-validation.md) |
| Indicador de superficie y confirmación | [Colocación](placement.md) |
| Escena automática o renderer propio | [Three.js](threejs.md) |
| Integración con el framework A-Frame | [A-Frame](aframe.md) |
| WebXR y odometría WASM | [Seguimiento espacial](spatial-tracking.md) |
| Guardar y relocalizar un mapa local | [Mapas](maps.md) |
| Cámara, foco y presupuesto de CPU | [Cámara y rendimiento](camera-performance.md) |
| HTTPS, CSP y publicación estática | [Despliegue](deployment.md) |
| Fallos conocidos y soluciones | [Problemas frecuentes](troubleshooting.md) |
| Módulos internos y extensiones | [Arquitectura](architecture.md), [API avanzada](advanced.md) |
| Contrato para agentes y asistentes | [Guía para IA](ai-guide.md) |
| Vocabulario | [Glosario](glossary.md) |

## Ejemplos ejecutables

Con el servidor iniciado, abre:

- [Galería de 35 ejemplos](../examples/PRUEBAS/index.html). GLB, gestos, vídeo, mapas locales, colocación y escala métrica experimental.

- [HTML declarativo](../examples/declarative.html): imagen y GLB sin JavaScript propio.
- [SLAM declarativo](../examples/declarative-slam.html): odometría sin marcador.
- [Vídeo/chroma declarativo](../examples/declarative-video.html): MP4 original incluido.
- [Gestos y contenido en vivo](../examples/declarative-interactive.html): cambios de modelo, pausa y velocidad.
- [Colocación guiada](../examples/declarative-placement.html): propuesta de superficie y confirmación.
- [Pruebas iPhone/Android](../tools/device-tests.html): diagnóstico y resultados manuales.

- [Aplicación programática](../examples/documented-app.html): alternativa avanzada con ciclo de vida explícito.
- [Script clásico programático](../examples/plain-script.html).
- [Renderer propio con ESM](../examples/custom-app.html): avanzado.
- [Dos marcadores con API programática](../examples/multi-target.html).
- [MP4 con chroma mediante API](../examples/video.html).
- [Compilador de imágenes](../tools/compile.html), [calibración opcional](../tools/calibrate.html), [benchmark](../tools/benchmark.html).

Los enlaces a ejemplos requieren HTTP/HTTPS. Abrir un HTML con `file://` no inicia correctamente módulos, Workers ni cámara. Para consultar el manual como sitio: `npm run dev` y `http://127.0.0.1:5173/docs/`.

## Alcance real

La biblioteca es MIT; los componentes de terceros conservan sus licencias. No utiliza un SDK cerrado ni suscripciones. No garantiza 60 FPS de análisis en todos los dispositivos, ni tracking perfecto. WebXR depende del navegador y hardware. El fallback ofrece odometría y mapa local, con deriva posible; no certifica un suelo semántico ni reconstruye una malla completa del entorno.

La referencia de firmas se genera desde las declaraciones TypeScript del build. El documento histórico de diseño en `archive/` no define la API vigente.

## Contribuir al desarrollo de la librería

Consulta la [arquitectura](architecture.md), la [guía de contribución](contributing.md) y las [pruebas en dispositivos](device-validation.md). Para preparar una distribución, consulta [compilación local](local-release.md) y [publicación](alpha-release.md).


## Autoría / Credits

**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero

- [Web](https://realidad-aumentada.com.co)
- [Blog](https://blog.realidad-aumentada.com.co)
- [YouTube](https://www.youtube.com/@carlosreinamcr)
