import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const embeddedModule='virtual:webar-embedded-assets';
const localAsset=(path:string)=>readFile(new URL(path,import.meta.url));
const authorBanner=`/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */`;

export default defineConfig(({mode})=>({
  // Los bundles ya construidos son código de distribución. Servirlos literalmente:
  // import-analysis de Vite no debe inyectar imports ESM en un script IIFE clásico.
  plugins:[{name:'serve-built-library',async transformIndexHtml(html){
    const source=await readFile(new URL('./src/build-info.ts',import.meta.url),'utf8');
    const build=/LIBRARY_BUILD="([a-f0-9]{16})"/.exec(source)?.[1];return build?html.replaceAll('__WEBAR_BUILD__',build):html;
  },configureServer(server){
    server.middlewares.use((request,response,next)=>{
      // Recetas 14–25: conservar ../dist/ desde examples/PRUEBAS sin duplicar el SDK.
      if(request.url?.startsWith('/examples/dist/'))request.url='/dist/'+request.url.slice('/examples/dist/'.length);
      const path=request.url?.split('?')[0];
      // Vite no aplica el index de un directorio public antes del fallback SPA.
      if(['/docs','/docs/','/docs/en','/docs/en/'].includes(path??'')){
        response.statusCode=302;response.setHeader('Location',path?.startsWith('/docs/en')?'/docs/en/index.html':'/docs/index.html');response.end();return;
      }
      if(!path?.startsWith('/dist/')){next();return;}
      const name=path.slice(6);if(name.includes('..')||!/^([a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.js(?:\.map)?$/.test(name)){next();return;}
      void readFile(new URL(`./dist/${name}`,import.meta.url)).then(bytes=>{
        response.setHeader('Cache-Control','no-store');
        response.setHeader('Content-Type',name.endsWith('.map')?'application/json':'text/javascript');response.end(bytes);
      },()=>next());
    });
  }}, {
    name:'webar-author-credit',
    generateBundle: {order:'post',handler(_options,bundle){
      const header=authorBanner+'\n';
      const mapOffset=';'.repeat(header.split('\n').length-1);
      for(const file of Object.values(bundle)){
        if(file.type!=='chunk')continue;
        file.code=header+file.code;
        if(file.map)file.map.mappings=mapOffset+file.map.mappings;
      }
      for(const file of Object.values(bundle)){
        if(file.type!=='asset'||!file.fileName.endsWith('.js.map')||typeof file.source!=='string')continue;
        const map=JSON.parse(file.source);
        map.mappings=mapOffset+map.mappings;
        file.source=JSON.stringify(map);
      }
    }},
  }, ...(mode==='standalone'?[{
    name:'embed-standalone-assets',
    resolveId(id:string){return id===embeddedModule?'\0'+id:null;},
    async load(id:string){
      if(id!=='\0'+embeddedModule)return null;
      const assets=await Promise.all([
        localAsset('./public/vision/opencv.js'),
        localAsset('./public/decoders/draco/draco_decoder.js'),
        localAsset('./public/decoders/draco/draco_wasm_wrapper.js'),
        localAsset('./public/decoders/draco/draco_decoder.wasm'),
      ]);
      return ['openCV','dracoJS','dracoWrapper','dracoWasmBase64'].map((name,index)=>
        `export const ${name}=${JSON.stringify(assets[index]!.toString(index===3?'base64':'utf8'))};`).join('\n');
    },
  }]:[])],
  ...(mode==='standalone'?{esbuild:{legalComments:'inline' as const}}:{}),
  build: mode==='workers'?{
    target:'es2022',minify:'esbuild',sourcemap:true,emptyOutDir:false,copyPublicDir:false,
    rollupOptions:{input:{
      tracking:fileURLToPath(new URL('./src/tracking/worker.js',import.meta.url)),
      odometry:fileURLToPath(new URL('./src/slam/optical-flow.worker.ts',import.meta.url)),
      compiler:fileURLToPath(new URL('./src/tools/compiler.worker.ts',import.meta.url)),
      calibration:fileURLToPath(new URL('./src/calibration/calibration.worker.ts',import.meta.url)),
    },output:{format:'es',entryFileNames:'workers/[name].js',chunkFileNames:'workers/chunks/[name]-[hash].js'}},
  }:{
    target: 'es2022',
    minify: 'esbuild',
    sourcemap: mode==='standalone'?'hidden':true,
    emptyOutDir: mode!=='core'&&mode!=='standalone',
    lib: {
      entry: fileURLToPath(new URL(mode==='core'?'./src/core.ts':mode==='standalone'?'./src/standalone.ts':'./src/index.ts', import.meta.url)),
      name: mode==='core'?'WebARFacilCore':'WebARFacil',
      formats: mode==='standalone'?['iife']:['es', 'iife'],
      fileName: format => mode==='standalone'?'webar-facil.min.js':`${mode==='core'?'webar-facil.core':'webar-facil'}${format==='iife'?(mode==='core'?'.min':'.browser.min'):''}.js`,
    },
    rollupOptions: { external: mode==='standalone'?[]:['three'], output: { globals: { three: 'THREE' },
      footer:mode==='core'?'if (typeof WebARFacilCore !== "undefined") globalThis.MiLibreriaARCore = WebARFacilCore;':
        'if (typeof WebARFacil !== "undefined") globalThis.MiLibreriaAR = WebARFacil;',
      ...(mode==='standalone'?{banner:async()=>{
        const notices=await Promise.all(['./LICENSE','./THIRD_PARTY_NOTICES.md','./public/vision/LICENSE.opencv.txt',
          './public/vendor/LICENSE.three.txt','./public/vendor/LICENSE.meshoptimizer.txt'].map(localAsset));
        return '/*!\n'+notices.map(file=>file.toString('utf8').replaceAll('*/','* /')).join('\n\n')+'\n*/';
      }}:{}) } },
  },
  // Workers inline: el bundle clásico no depende de import.meta.url en el navegador.
  worker: { format: 'es' },
  // Consumidores temporales del empaquetado no deben recargar una app/cámara activa.
  server: { watch: { ignored: ['**/artifacts/**'] } },
}));
