/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve('dist'),manifest=JSON.parse(await readFile(path.join(root,'release.json'),'utf8'));
if(manifest.schemaVersion!==1||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('Manifest inválido.');
for(const item of manifest.files){
  const filename=path.resolve(root,item.path);if(!filename.startsWith(root+path.sep))throw new Error('Ruta de manifest fuera de distribución.');
  if((await stat(filename)).size!==item.bytes||createHash('sha256').update(await readFile(filename)).digest('hex')!==item.sha256)throw new Error(`Integridad incorrecta: ${item.path}`);
}
console.log(`Integridad de ${manifest.files.length} archivos verificada (${manifest.sdk.version}/${manifest.sdk.build}).`);
