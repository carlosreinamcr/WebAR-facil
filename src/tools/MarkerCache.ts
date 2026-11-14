/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { analyzeFeatures, decodeMarker, TARGET_MAX_BYTES } from '../tracking/ImageCompiler';
import { ORB_EXTRACTOR_ID } from '../vision/features';

type Compilation = {buffer:ArrayBuffer;quality:ReturnType<typeof analyzeFeatures>};
type CompileOptions = {physicalWidthMeters:number;maxDimension?:number;opencvURL:string};

// Incrementar si cambia la compilación o el preprocesamiento del mismo JPG/PNG.
const CACHE_NAME='mi-libreria-ar-markers-v1';
const MAX_MARKERS=12;
let writes=Promise.resolve();

export async function compileWithMarkerCache(
  image:Blob, options:CompileOptions, signal:AbortSignal, compile:()=>Promise<Compilation>,
):Promise<Compilation & {cacheHit?:true}>{
  const maxDimension=options.maxDimension??1024;
  if(!image.size||image.size>TARGET_MAX_BYTES||!Number.isInteger(maxDimension)||maxDimension<64||maxDimension>4096)
    return compile();

  let cache:Cache|undefined;
  let key:URL|undefined;
  let cached:Compilation|undefined;
  try{
    if(globalThis.caches&&globalThis.crypto?.subtle){
      const runtime=new URL(options.opencvURL,document.baseURI);
      const digest=await crypto.subtle.digest('SHA-256',await image.arrayBuffer());
      signal.throwIfAborted();
      const hex=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
      key=new URL('/.webar-marker-cache/'+hex,location.origin);
      key.search=new URLSearchParams({extractor:String(ORB_EXTRACTOR_ID),width:String(options.physicalWidthMeters),
        maxDimension:String(maxDimension),runtime:runtime.href}).toString();
      cache=await caches.open(CACHE_NAME);
      const hit=await cache.match(key);
      if(hit){
        try{
          const buffer=await hit.arrayBuffer();
          const marker=decodeMarker(buffer);
          if(marker.simulated||marker.extractorId!==ORB_EXTRACTOR_ID||marker.physicalWidthMeters!==options.physicalWidthMeters||
            Math.max(marker.width,marker.height)>maxDimension)throw new Error('Marcador en caché incompatible.');
          cached={buffer,quality:analyzeFeatures(marker)};
        }catch{await cache.delete(key);}
      }
    }
  }catch{/* El almacenamiento puede estar desactivado o sin cuota. */}
  signal.throwIfAborted();
  if(cached)return {...cached,cacheHit:true};
  const result=await compile();
  signal.throwIfAborted();
  if(cache&&key){
    const store=cache,request=key,entry=new Response(result.buffer);
    writes=writes.then(async()=>{
      await store.put(request,entry);
      const keys=await store.keys();
      for(const old of keys.slice(0,Math.max(0,keys.length-MAX_MARKERS)))await store.delete(old);
    }).catch(()=>{});
  }
  return result;
}
