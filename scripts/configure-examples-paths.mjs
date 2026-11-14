/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
// Normaliza una instalación estática: sitio/Examples/*.html, sitio/Examples/assets,
// sitio/dist/SDK. Por defecto prepara una copia revisable; --apply la instala con backup.
import {readFile,writeFile,readdir,mkdir,copyFile,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const args=process.argv.slice(2),siteFlag=args.indexOf('--site');
if(siteFlag<0||!args[siteFlag+1])throw new Error('Uso: node scripts/configure-examples-paths.mjs --site RUTA_DEL_SITIO [--apply]');
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=resolve(args[siteFlag+1]),examples=join(site,'Examples');
const staging=join(workspace,'artifacts','examples-configured','Examples');
const applying=args.includes('--apply');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=join(site,'_webar-backups',stamp,'Examples');
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const sdk=join(site,'dist','webar-facil.min.js');
for(const path of [sdk,join(site,'dist','vision','opencv.js'),join(site,'dist','workers','tracking.js')]){
  if(!await exists(path))throw new Error('Falta un recurso del SDK: '+path);
}
let build='';
try{build=JSON.parse(await readFile(join(site,'dist','release.json'),'utf8')).sdk.build;}catch{}
const sdkURL='../dist/webar-facil.min.js'+(/^[a-f0-9]{16}$/.test(build)?'?build='+build:'');
const plan={site,sdk:sdkURL,mode:applying?'applied':'prepared',backup:applying?backup:null,html:[],addedAssets:[],preservedAssets:[]};
await mkdir(staging,{recursive:true});
const files=(await readdir(examples)).filter(name=>name.endsWith('.html')).sort();
if(files.filter(name=>/^\d\d-/.test(name)).length!==25)throw new Error('Se esperan los 25 HTML numerados dentro de Examples.');
for(const name of files){
  const source=await readFile(join(examples,name),'utf8');
  const html=source
    // Sustituir únicamente la URL del SDK; conservar lógica y opciones del usuario.
    .replace(/(src=["'])[^"']*webar-facil\.min\.js\s*(?:\?[^"']*)?\s*(["'])/g,`$1${sdkURL}$2`)
    // Incluye atributos HTML, enlaces y rutas escritas dentro de JavaScript.
    .replace(/(?:\.\.\/)+assets\//g,'./assets/')
    .replace(/\.\/assets\/marcador\.png/g,'./assets/marcador.jpg')
    .replaceAll('Los 13 ejemplos','Los 25 ejemplos')
    .replaceAll('Esta ruta es para examples/PRUEBAS. El build la adapta en dist/examples/PRUEBAS.','SDK en ../dist/; recursos de esta carpeta en ./assets/.');
  await writeFile(join(staging,name),html);
  plan.html.push({name,changed:source!==html,sha256:createHash('sha256').update(html).digest('hex')});
}
// Solo reponer recursos que faltan. Nunca sustituir los JPG/GLB/MP4 del usuario.
const resources=['robot.glb','cohete.glb','animaciones.glb','video.mp4','aframe.min.js','AFRAME-LICENSE.txt'];
await mkdir(join(staging,'assets'),{recursive:true});
for(const name of resources){
  if(await exists(join(examples,'assets',name)))plan.preservedAssets.push(name);
  else{
    const source=join(workspace,'examples','assets',name);
    if(!await exists(source))throw new Error('No está disponible el recurso de ejemplo: '+source);
    await copyFile(source,join(staging,'assets',name));plan.addedAssets.push(name);
  }
}
for(const name of ['marcador.jpg','marcador2.jpg']){
  if(!await exists(join(examples,'assets',name)))throw new Error('Falta tu imagen: '+join(examples,'assets',name));
  plan.preservedAssets.push(name);
}
// Verificar referencias estáticas antes de tocar la instalación.
for(const {name} of plan.html){
  const html=await readFile(join(staging,name),'utf8');
  for(const match of html.matchAll(/(?:src|href|data-model)=["']([^"']+)["']/g)){
    const url=match[1].trim();if(/^(?:https?:|data:|blob:|#)/.test(url)||url.includes('${'))continue;
    const relative=url.split(/[?#]/)[0];
    if(!relative)continue;
    const target=resolve(examples,relative),prepared=resolve(staging,relative);
    if(!await exists(target)&&!await exists(prepared))throw new Error(`${name}: referencia inexistente ${url}`);
  }
}
const readme=`# Rutas verificadas de esta instalación\n\n`+
  `Los 25 ejemplos están en Examples y sus recursos en Examples/assets.\n\n`+
  `- SDK: ${sdkURL}\n- Marcador: ./assets/marcador.jpg\n- Segundo marcador: ./assets/marcador2.jpg\n`+
  `- Modelos: ./assets/robot.glb, ./assets/cohete.glb y ./assets/animaciones.glb\n`+
  `- Vídeo: ./assets/video.mp4\n- A-Frame (25): ./assets/aframe.min.js\n\n`+
  `Se utiliza la distribución completa de dist; su propio directorio vision y decoders se resuelve desde el script.\n`+
  `La copia del SDK situada fuera de dist no se utiliza desde estos ejemplos.\n\n`+
  `El GLB pequeño animaciones.glb incluye Giro, Salto y Asentir para 15/24. `+
  `Tu archivo Animacion.glb permanece disponible y puedes seleccionarlo en 17.\n\n`+
  `Abre /2/Examples/index.html desde tu servidor. En teléfonos usa HTTPS. No abras por file://.\n`;
await writeFile(join(staging,'RUTAS.md'),readme);
if(applying){
  await mkdir(backup,{recursive:true});
  for(const {name,changed} of plan.html){
    if(!changed)continue;
    await copyFile(join(examples,name),join(backup,name));
    await copyFile(join(staging,name),join(examples,name));
  }
  for(const name of plan.addedAssets)await copyFile(join(staging,'assets',name),join(examples,'assets',name));
  if(await exists(join(examples,'RUTAS.md')))await copyFile(join(examples,'RUTAS.md'),join(backup,'RUTAS.md'));
  await copyFile(join(staging,'RUTAS.md'),join(examples,'RUTAS.md'));
}
await writeFile(join(workspace,'artifacts','examples-configured','plan.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({site:plan.site,mode:plan.mode,html:plan.html.length,changed:plan.html.filter(file=>file.changed).length,addedAssets:plan.addedAssets,preservedAssets:plan.preservedAssets,backup:plan.backup},null,2));
