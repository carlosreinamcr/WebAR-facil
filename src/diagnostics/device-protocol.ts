/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
export interface DeviceTestCase {id:string;title:string;instructions:string;seconds:number;modes:readonly ('image'|'flow'|'transition'|'webxr')[];}
/** Pasos manuales comunes a iOS y Android. Ninguno se aprueba automáticamente. */
export const DEVICE_TEST_PROTOCOL:readonly DeviceTestCase[]=[
  {id:'first-detection',title:'Primera detección',instructions:'Imagen bien iluminada y grande en vista. Repite tres veces y anota el tiempo percibido y errores.',seconds:20,modes:['image','transition']},
  {id:'inclination',title:'Inclinación',instructions:'Inclina la imagen gradualmente hasta unos 60°. Anota dónde pierde y si recupera al volver.',seconds:30,modes:['image','transition']},
  {id:'small-target',title:'Marcador pequeño',instructions:'Aléjate de forma gradual. Registra tamaño/distancia aproximados y si el diagnóstico indica marcador pequeño.',seconds:30,modes:['image']},
  {id:'brief-occlusion',title:'Oclusión breve',instructions:'Tapa brevemente y destapa. La tolerancia debe evitar parpadeo y no reiniciar animación/vídeo.',seconds:20,modes:['image']},
  {id:'recovery',title:'Pérdida y recuperación',instructions:'Oculta imagen o entorno por dos segundos y vuelve a observar. Anota recuperación y saltos.',seconds:30,modes:['image','flow','transition','webxr']},
  {id:'fast-motion',title:'Movimiento rápido y desenfoque',instructions:'Mueve la cámara progresivamente más rápido y vuelve a una vista estable. No debe presentar una pose inventada.',seconds:30,modes:['image','flow','transition','webxr']},
  {id:'stationary',title:'Estabilidad con cámara fija',instructions:'Apoya el dispositivo y mantén referencia inmóvil. Observa vibración; los cambios de pose del informe no son una medida física de jitter.',seconds:60,modes:['image','flow','transition','webxr']},
  {id:'sustained',title:'Sesión prolongada',instructions:'Mantén la experiencia tres minutos. Anota calentamiento, consumo percibido y degradación; no hay termómetro portable del navegador.',seconds:180,modes:['image','flow','transition','webxr']},
  {id:'media',title:'Animación y MP4/chroma',instructions:'Prueba GLB y vídeo. Al perder seguimiento no deben reiniciarse. Comprueba audio/gesto y transparencia con tu archivo real.',seconds:30,modes:['image','flow','transition','webxr']},
  {id:'gestures',title:'Toque, arrastre y pellizco',instructions:'Selecciona, gira y escala contenido visible; comprueba límites y que los controles de página sigan utilizables.',seconds:30,modes:['image','flow','transition']},
  {id:'flow-init',title:'Inicialización óptica',instructions:'Traslada la cámara sobre una zona con textura y paralaje. En una zona lisa o con rotación pura debe seguir inicializando o perderse.',seconds:45,modes:['flow','transition']},
  {id:'placement',title:'Superficie y colocación',instructions:'Espera indicador válido, confirma y mueve la cámara. Retira o tapa el entorno; no confirmes con una pose antigua.',seconds:45,modes:['flow','webxr']},
  {id:'return-path',title:'Recorrido y deriva',instructions:'Tras colocar, recorre una trayectoria corta y vuelve al punto inicial. Registra distancia/rotación aparente frente a una referencia externa.',seconds:60,modes:['flow','transition','webxr']},
  {id:'native-hit-test',title:'WebXR nativo',instructions:'Si immersive-ar está disponible, inicia sesión, observa el retículo y selecciona. Si no hay soporte, marca No compatible, no Aprobado.',seconds:45,modes:['webxr']},
  {id:'lifecycle',title:'Permisos y ciclo de vida',instructions:'Detén, reinicia, cambia de pestaña, rota y bloquea/desbloquea. Comprueba cámara liberada y recuperación controlada.',seconds:45,modes:['image','flow','transition','webxr']},
];
