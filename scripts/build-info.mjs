/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=createHash('sha256');
async function walk(directory){
  for(const item of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)){
    const file=`${directory}/${item.name}`;if(item.isDirectory())await walk(file);
    else if(/\.(ts|js)$/.test(file)&&file!=='src/build-info.ts'){hash.update(file);hash.update(await readFile(file));}
  }
}
await walk('src');for(const file of ['package.json','package-lock.json','vite.config.ts']){hash.update(file);hash.update(await readFile(file));}
const{version}=JSON.parse(await readFile('package.json','utf8'));
const code=`// Generado por scripts/build-info.mjs; identificador determinista del código/configuración.\nexport const LIBRARY_VERSION=${JSON.stringify(version)};\nexport const LIBRARY_BUILD=${JSON.stringify(hash.digest('hex').slice(0,16))};\n`;
await writeFile('src/build-info.ts',code);
