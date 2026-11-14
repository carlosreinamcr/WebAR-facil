/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
interface EmbeddedAssets {
  openCV:string;
  dracoJS:string;
  dracoWrapper:string;
  dracoWasmBase64:string;
}

let embedded:EmbeddedAssets|undefined;
let visionURL:string|undefined;
const dracoURLs=new Map<string,string>();

export function installEmbeddedAssets(assets:EmbeddedAssets):void {
  embedded=assets;
}

export function embeddedVisionURL():string|undefined {
  if(!embedded)return undefined;
  return visionURL??=URL.createObjectURL(new Blob([embedded.openCV],{type:'text/javascript'}));
}

/** The Draco loader asks its LoadingManager for the URL of each decoder file. */
export function embeddedDracoURL(name:string):string {
  if(!embedded)return name;
  const existing=dracoURLs.get(name);
  if(existing)return existing;
  const content=name==='draco_decoder.js'?embedded.dracoJS:name==='draco_wasm_wrapper.js'?embedded.dracoWrapper:null;
  if(content===null&&name!=='draco_decoder.wasm')return name;
  const url=content!==null?URL.createObjectURL(new Blob([content],{type:'text/javascript'})):
    URL.createObjectURL(new Blob([Uint8Array.from(atob(embedded.dracoWasmBase64),byte=>byte.charCodeAt(0))],{type:'application/wasm'}));
  dracoURLs.set(name,url);
  return url;
}

export function hasEmbeddedAssets():boolean {return embedded!==undefined;}
