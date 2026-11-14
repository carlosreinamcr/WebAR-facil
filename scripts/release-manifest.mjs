/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LIBRARY_VERSION,LIBRARY_BUILD} from '../src/build-info.ts';
const files=[];
async function walk(directory){
  for(const item of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const file=`${directory}/${item.name}`;if(item.isDirectory())await walk(file);
    else if(file!=='dist/release.json')files.push({path:file.slice(5),bytes:(await stat(file)).size,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
  }
}
await walk('dist');await writeFile('dist/release.json',JSON.stringify({schemaVersion:1,sdk:{version:LIBRARY_VERSION,build:LIBRARY_BUILD},publication:'local-only',files},null,2));
console.log(`Distribución local ${LIBRARY_VERSION} / ${LIBRARY_BUILD}: ${files.length} archivos con SHA-256. No publicada.`);
