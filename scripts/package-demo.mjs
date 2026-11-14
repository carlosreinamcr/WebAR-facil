/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {LIBRARY_BUILD} from '../src/build-info.ts';
import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {posix} from 'node:path';
const stamp=html=>html.replaceAll('__WEBAR_BUILD__',LIBRARY_BUILD).replace(/(src=["'][^"']*webar-facil\.min\.js)(?:\?[^"']*)?(["'])/g,`$1?build=${LIBRARY_BUILD}$2`);
await writeFile('dist/index.html',stamp((await readFile('index.html','utf8')).replaceAll('./dist/','./')));
await mkdir('dist/tools',{recursive:true});
for(const name of await readdir('tools'))if(name.endsWith('.html'))await writeFile(`dist/tools/${name}`,stamp((await readFile(`tools/${name}`,'utf8')).replaceAll('../dist/','../')));
// Copiar también colecciones anidadas (PRUEBAS) y sus recursos locales.
async function packageExamples(source='examples',destination='dist/examples'){
  await mkdir(destination,{recursive:true});
  for(const entry of await readdir(source,{withFileTypes:true})){
    const from=`${source}/${entry.name}`,to=`${destination}/${entry.name}`;
    if(entry.isDirectory())await packageExamples(from,to);
    else if(entry.isFile()){
      if(entry.name.endsWith('.html')){
        const html=(await readFile(from,'utf8')).replaceAll('../dist/','../')
          .replace(/(src=["'])[^"']*(webar-facil\.(?:browser\.)?min\.js)/g,
            (_,prefix,filename)=>prefix+posix.relative(posix.dirname(to),'dist/'+filename));
        await writeFile(to,stamp(html));
      }
      else await copyFile(from,to);
    }
  }
}
await packageExamples();

await mkdir('dist/vision',{recursive:true});await copyFile('src/vision/wasm/hamming.wat','dist/vision/hamming.wat');
await copyFile('src/vision/wasm/hamming.wat','public/vision/hamming.wat');
