/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,writeFile,mkdir,readdir,copyFile,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';

const args=process.argv.slice(2),flag=args.indexOf('--site');
if(flag<0||!args[flag+1])throw new Error('Uso: node scripts/install-local-diagnostics.mjs --site RUTA [--apply]');
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'..'),site=resolve(args[flag+1]);
const applying=args.includes('--apply'),examples=join(site,'Examples');
const staged=join(workspace,'artifacts','local-diagnostics-install');
const source=join(workspace,'tools','local-diagnostics');
const siteId=createHash('sha256').update(site.toLowerCase()).digest('hex').slice(0,16);
const privateRoot=join(workspace,'reports','local-devices'),storage=join(privateRoot,'data',siteId);
const privateConfig=join(privateRoot,'config',siteId+'.json');
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
const files=(await readdir(examples)).filter(file=>/^(0[1-9]|1[0-9]|2[0-5])-.*\.html$/.test(file)||file==='index.html');
if(files.length!==26)throw new Error('Se esperan 25 ejemplos y su galería.');
await mkdir(join(staged,'Examples'),{recursive:true});await mkdir(join(staged,'diagnostics'),{recursive:true});
const comparison='slam-comparison.html';
const comparisonSource=await readFile(join(workspace,'examples',comparison),'utf8');
const releasePath=join(workspace,'dist','release.json');
const build=await exists(releasePath)?JSON.parse(await readFile(releasePath,'utf8')).sdk.build:null;
const versioned=build?comparisonSource.replace('standalone.min.js"',`standalone.min.js?build=${build}"`):comparisonSource;
const comparisonHTML=versioned.replace('</head>','  <script defer src="./local-reports.js"></script>\n</head>');
await writeFile(join(staged,'Examples',comparison),comparisonHTML);
const additions=[
  ['26-colocacion-con-mira.html','26. Colocación con mira y cuadrícula local'],
  ['27-pantalla-completa.html','27. Pantalla completa, foto y vídeo'],
  ['28-escala-metrica.html','28. Escala métrica experimental'],
];
for(const [name] of additions){
  const sourceHTML=await readFile(join(workspace,'examples','PRUEBAS',name),'utf8');
  const versionedHTML=build?sourceHTML.replace('standalone.min.js"',`standalone.min.js?build=${build}"`):sourceHTML;
  await writeFile(join(staged,'Examples',name),versionedHTML.replaceAll('../assets/','./assets/')
    .replace('</head>',`  <script defer src="./local-reports.js${build?`?build=${build}`:''}"></script>\n</head>`));
}
const changed=[];
for(const file of files){
  const original=await readFile(join(examples,file),'utf8');let html=original;
  if(!html.includes('src="./local-reports.js"'))html=html.replace('</head>','  <!-- Diagnóstico de desarrollo: envío al recolector local, sin imágenes. -->\n  <script defer src="./local-reports.js"></script>\n</head>');
  if(file.startsWith('25-')&&!html.includes('WebARLocalReports?.attachEngine')){
    const pattern=/const engine = new WebARFacil\.WebAREngine\(\{[\s\S]*?\n\s*\}\);/;
    if(!pattern.test(html))throw new Error('No se encontró el engine de A-Frame para conectar su diagnóstico.');
    html=html.replace(pattern,match=>match+'\n      // Diagnóstico local: el motor continúa siendo el mismo.\n      globalThis.WebARLocalReports?.attachEngine(engine, { configuration: { mode: \'image\', backend: \'image\', performance: \'auto\' }, getRenderer: () => frame.renderer });');
  }
  if(file==='index.html'){
    for(const [name,label] of additions)if(!html.includes(name))html=html.replace('</ol>',`<li><a href="./${name}">${label}</a></li>\n</ol>`);
    html=html.replace(/2[5-8] ejemplos para aprender WebAR/,'28 ejemplos de WebAR Fácil')
      .replace(/<title>PRUEBAS · 2[5-8] recetas WebAR<\/title>/,'<title>WebAR Fácil · 28 ejemplos</title>');
  }
  if(file==='index.html'&&!html.includes('diagnostics/mobile.html'))html=html.replace('</main>','<p><a href="../diagnostics/mobile.html">Recorrido móvil con envío automático de informes al PC</a></p></main>');
  if(html===original&& !html.includes('local-reports.js'))throw new Error('No se pudo conectar '+file);
  await writeFile(join(staged,'Examples',file),html);if(html!==original)changed.push(file);
}
await copyFile(join(source,'client.js'),join(staged,'Examples','local-reports.js'));
for(const file of ['api.php','index.html','mobile.html','style.css','dashboard.js','README.md']){
  if(await exists(join(source,file)))await copyFile(join(source,file),join(staged,'diagnostics',file));
}
let token;
if(await exists(privateConfig))token=JSON.parse(await readFile(privateConfig,'utf8')).token;
else token=randomBytes(32).toString('hex');
const php=value=>"'"+value.replaceAll('\\','/').replaceAll("'","\\'")+"'";
await writeFile(join(staged,'diagnostics','config.php'),'<?php\n// Configuración privada del recolector PHP; no se imprime al navegador.\nreturn [\'storage\' => '+php(storage)+', \'token\' => '+php(token)+'];\n');
let backup=null;
if(applying){
  backup=join(site,'_webar-backups','local-diagnostics-'+new Date().toISOString().replace(/[:.]/g,'-'));
  await mkdir(join(backup,'Examples'),{recursive:true});await mkdir(join(site,'diagnostics'),{recursive:true});
  await mkdir(dirname(privateConfig),{recursive:true});await mkdir(storage,{recursive:true});
  await writeFile(privateConfig,JSON.stringify({site,token},null,2),{mode:0o600});
  for(const file of changed){await copyFile(join(examples,file),join(backup,'Examples',file));await copyFile(join(staged,'Examples',file),join(examples,file));}
  if(await exists(join(examples,comparison)))await copyFile(join(examples,comparison),join(backup,'Examples',comparison));
  await copyFile(join(staged,'Examples',comparison),join(examples,comparison));
  for(const [name] of additions){
    if(await exists(join(examples,name)))await copyFile(join(examples,name),join(backup,'Examples',name));
    await copyFile(join(staged,'Examples',name),join(examples,name));
  }
  if(await exists(join(examples,'local-reports.js')))await copyFile(join(examples,'local-reports.js'),join(backup,'Examples','local-reports.js'));
  await copyFile(join(staged,'Examples','local-reports.js'),join(examples,'local-reports.js'));
  for(const file of await readdir(join(staged,'diagnostics'))){
    const destination=join(site,'diagnostics',file);
    if(await exists(destination)){await mkdir(join(backup,'diagnostics'),{recursive:true});await copyFile(destination,join(backup,'diagnostics',file));}
    await copyFile(join(staged,'diagnostics',file),destination);
  }
}
console.log(JSON.stringify({mode:applying?'installed':'prepared',site,examples:files.length,changed:changed.length,storage,backup,panel:'/2/diagnostics/',mobile:'/2/diagnostics/mobile.html'},null,2));
