/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Conveniencia exclusiva del script clásico; core continúa sin dependencia de renderer. */
export * from './index';
export * as THREE from 'three';
import {registerARComponents} from './wrappers/web-components';
import {installEmbeddedAssets} from './internal/EmbeddedAssets';
import {openCV,dracoJS,dracoWrapper,dracoWasmBase64} from 'virtual:webar-embedded-assets';

installEmbeddedAssets({openCV,dracoJS,dracoWrapper,dracoWasmBase64});

// Capturar durante la evaluación del script; no depende de dónde viva index.html.
if(typeof document!=='undefined'&&typeof customElements!=='undefined'){
  const script=document.currentScript;
  registerARComponents({assetBase:script instanceof HTMLScriptElement&&script.src?new URL('.',script.src):new URL('./',document.baseURI)});
}
