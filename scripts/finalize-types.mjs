/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
// NodeNext exige extensiones en imports relativos de declaraciones ESM.
async function visit(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,entry.name);
    if(entry.isDirectory())await visit(path);
    else if(entry.name.endsWith('.d.ts')){
      const source=await readFile(path,'utf8');
      const result=source.replace(/((?:from\s+|import\s*\()\s*['"])(\.[^'"]+)(['"])/g,(_match,start,specifier,end)=>{
        const normalized=specifier.endsWith('.ts')?specifier.slice(0,-3)+'.js':specifier.endsWith('.js')?specifier:specifier+'.js';
        return start+normalized+end;
      });
      await writeFile(path,result);
    }
  }
}
await visit('dist/types');
