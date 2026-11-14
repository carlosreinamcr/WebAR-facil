/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,writeFile,mkdir,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import MarkdownIt from 'markdown-it';
import {englishApiMarkdown} from './docs-english.mjs';

// Lista explícita: el archivo histórico no define el contrato vigente.
export const chapters=[
  'README','getting-started','phone-detection','declarative','interaction','image-targets','models','multiple-targets','events','recipes',
  'spatial-tracking','placement','diagnostics','odometry-validation','installation','local-release','alpha-release','camera-performance','deployment','troubleshooting','concepts',
  'programmatic','recipes-programmatic','video','threejs','aframe','maps','api-engine','api-generated',
  'advanced','architecture','contributing','verification','device-validation',
  'ai-guide','glossary',
];
const root=path.resolve(import.meta.dirname,'..');
const get=relative=>readFile(path.join(root,relative),'utf8');
const put=async(relative,text)=>{await mkdir(path.dirname(path.join(root,relative)),{recursive:true});await writeFile(path.join(root,relative),text,'utf8');};
const pkg=JSON.parse(await get('package.json'));
const files=new Map(),exports=new Map();
async function collect(relative,entry){
  const source=ts.createSourceFile(relative,await get(relative),ts.ScriptTarget.Latest,true);
  for(const statement of source.statements){
    if(!ts.isExportDeclaration(statement)||!statement.moduleSpecifier||!ts.isStringLiteral(statement.moduleSpecifier))continue;
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),statement.moduleSpecifier.text))+'.ts';
    if(!statement.exportClause){await collect(target,entry);continue;}
    if(!ts.isNamedExports(statement.exportClause))continue;
    const declarationFile=target.replace(/^src\//,'dist/types/').replace(/\.ts$/,'.d.ts');files.set(declarationFile,true);
    for(const item of statement.exportClause.elements){
      const name=item.name.text;
      const value=exports.get(name)??{name,typeOnly:statement.isTypeOnly||item.isTypeOnly,module:target,declarationFile,entrypoints:[]};
      if(!value.entrypoints.includes(entry))value.entrypoints.push(entry);exports.set(name,value);
    }
  }
}
await collect('src/core.ts','webar-facil/core');
await collect('src/index.ts','webar-facil');
files.set('dist/types/tracking/types.d.ts',true);
const printer=ts.createPrinter({newLine:ts.NewLineKind.LineFeed});
const declarations=[];
for(const filename of [...files.keys()].sort()){
  const file=ts.createSourceFile(filename,await get(filename),ts.ScriptTarget.Latest,true);
  const result=ts.transform(file,[context=>node=>{
    const visit=current=>{
      if(ts.isClassDeclaration(current)){
        const members=current.members.filter(member=>!member.modifiers?.some(modifier=>modifier.kind===ts.SyntaxKind.PrivateKeyword||modifier.kind===ts.SyntaxKind.ProtectedKeyword));
        return context.factory.updateClassDeclaration(current,current.modifiers,current.name,current.typeParameters,current.heritageClauses,members);
      }
      return ts.visitEachChild(current,visit,context);
    };
    return ts.visitNode(node,visit);
  }]);
  const code=printer.printFile(result.transformed[0]);result.dispose();
  declarations.push({file:filename.replace('dist/types/',''),code});
}
const manifest={schemaVersion:1,name:pkg.name,version:pkg.version,
  usage:{recommendedIntegration:'declarative',startGuide:'docs/getting-started.md',tagReference:'docs/declarative.md',
    advancedGuide:'docs/programmatic.md',tags:['webar-scene','webar-target','webar-model','webar-video'],
    standaloneRegistration:'automatic',esmRegistration:'registerARComponents'},
  entrypoints:{'webar-facil':'ESM y wrappers; peer three','webar-facil/core':'ESM sin renderizador',standalone:'Global WebARFacil; incluye THREE'},
  exports:[...exports.values()].sort((a,b)=>a.name.localeCompare(b.name)),standaloneAdditionalExports:['THREE'],declarations};
await put('docs/api.json',JSON.stringify(manifest,null,2)+'\n');
const signatureDoc=`# API pública generada\n\nVersión ${pkg.version}. Generada desde los exports fuente y las declaraciones TypeScript del build. No editar a mano.\n\nLos imports relativos se muestran en su contexto original. Estos bloques describen contratos, no son implementaciones para pegar en una app. Las interfaces auxiliares describen parámetros y resultados; solo los nombres de la tabla son exports del entrypoint público.\n\n| Export | Clase de export | Entrypoints |\n| --- | --- | --- |\n${manifest.exports.map(item=>`| \`${item.name}\` | ${item.typeOnly?'Tipo':'Valor y/o tipo'} | ${item.entrypoints.map(e=>'`'+e+'`').join(', ')} |`).join('\n')}\n\nEl bundle standalone añade el namespace \`THREE\`. Consulta [API del motor](api-engine.md), [Three.js](threejs.md) y [API avanzada](advanced.md) para ejemplos y valores iniciales.\n\n${declarations.map(item=>`## ${item.file}\n\n\`\`\`ts\n${item.code}\`\`\`\n`).join('\n')}`;
await put('docs/api-generated.md',signatureDoc);
await put('docs/en/api-generated.md',englishApiMarkdown({exports:manifest.exports,declarations})+"\n\n## Autoría / Credits\n\n**Creador / Creator:** IngCarlosReina. - Realidad Aumentada Empezando Desde Cero\n\n- [Web](https://realidad-aumentada.com.co)\n- [Blog](https://blog.realidad-aumentada.com.co)\n- [YouTube](https://www.youtube.com/@carlosreinamcr)\n");
const md=new MarkdownIt({html:false});
const headingRule=md.renderer.rules.heading_open??((tokens,index,options,env,self)=>self.renderToken(tokens,index,options));
const slug=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'seccion';
md.renderer.rules.heading_open=(tokens,index,options,env,self)=>{
  const base=slug(tokens[index+1].content),count=env.headings.get(base)??0;env.headings.set(base,count+1);
  tokens[index].attrSet('id',base+(count?'-'+count:''));return headingRule(tokens,index,options,env,self);
};
const linkRule=md.renderer.rules.link_open??((tokens,index,options,env,self)=>self.renderToken(tokens,index,options));
md.renderer.rules.link_open=(tokens,index,options,env,self)=>{
  const token=tokens[index],href=token.attrGet('href');
  if(href&&!/^(?:[a-z]+:|\/\/)/i.test(href))token.attrSet('href',href.replace(/(^|\/)README\.md(?=$|#)/,'$1index.html').replace(/\.md(?=$|#)/,'.html'));
  return linkRule(tokens,index,options,env,self);
};
const pages=[];
for(const name of chapters){
  let markdown=await get(`docs/${name}.md`);
  for(const include of [...markdown.matchAll(/^<!-- example:([a-zA-Z0-9_./-]+) -->[\s\S]*?^<!-- \/example -->/gm)]){
    if(!include[1].startsWith('examples/')||include[1].includes('..'))throw new Error('Ruta de ejemplo inválida');
    markdown=markdown.replace(include[0],`<!-- example:${include[1]} -->\n`+'```html\n'+await get(include[1])+'\n```\n<!-- /example -->');
  }
  // La fuente también contiene el HTML real: sirve para GitHub y lectores de Markdown.
  await put(`docs/${name}.md`,markdown);
  markdown=markdown.replace(/^<!-- (?:example:[^>]+|\/example) -->\n?/gm,'');
  pages.push({name,title:markdown.match(/^# (.+)$/m)?.[1]??name,markdown,href:name==='README'?'index.html':name+'.html'});
}
const escape=value=>md.utils.escapeHtml(value);
const english=[];
for(const name of chapters){
  const markdown=await get(`docs/en/${name}.md`);
  english.push({name,title:markdown.match(/^# (.+)$/m)?.[1]??name,markdown,href:name==='README'?'index.html':name+'.html'});
}
const locales=[
  {lang:'es',pages,dir:'docs',other:'en/index.html',otherLang:'en',otherLabel:'English',root:'..',
    search:'Buscar',placeholder:'Eventos, GLB, cámara…',results:'Resultados de búsqueda',chapters:'Capítulos',
    example:'Abrir ejemplo',source:'Fuente Markdown',contract:'Contrato JSON',ai:'Texto para IA',api:'api.json',manual:'../llms-full.txt'},
  {lang:'en',pages:english,dir:'docs/en',other:'../index.html',otherLang:'es',otherLabel:'Español',root:'../..',
    search:'Search',placeholder:'Events, GLB, camera…',results:'Search results',chapters:'Chapters',
    example:'Open example',source:'Markdown source',contract:'JSON API',ai:'AI guide',api:'../api.json',manual:'ai-guide.html'},
];
for(const locale of locales)for(const base of ['public','dist']){
  const directory=`${base}/${locale.dir}`;
  const nav=locale.pages.map(page=>`<a href="${page.href}">${escape(page.title)}</a>`).join('\n');
  await mkdir(path.join(root,directory),{recursive:true});
  for(const page of locale.pages){
    const html=`<!doctype html><html lang="${locale.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>${escape(page.title)} · WebAR Fácil</title><link rel="stylesheet" href="docs.css"><script src="docs.js" defer></script></head><body><header><a href="index.html">WebAR Fácil · ${escape(pkg.version)}</a><label>${locale.search} <input type="search" id="search" placeholder="${locale.placeholder}" autocomplete="off"></label><a href="${locale.root}/examples/declarative.html">${locale.example}</a><a href="${locale.lang==='en'?'../'+page.href:'en/'+page.href}" lang="${locale.otherLang}" hreflang="${locale.otherLang}">${locale.otherLabel}</a></header><div id="results" role="region" aria-label="${locale.results}" hidden></div><div class="layout"><nav aria-label="${locale.chapters}">${nav}</nav><main id="content">${md.render(page.markdown,{headings:new Map()})}<footer><a href="${page.name}.md">${locale.source}</a> · <a href="${locale.api}">${locale.contract}</a> · <a href="${locale.manual}">${locale.ai}</a></footer></main></div></body></html>\n`;
    await put(directory+'/'+page.href,html);await put(directory+'/'+page.name+'.md',page.markdown);
  }
  if(locale.lang==='es')await copyFile(path.join(root,'docs/api.json'),path.join(root,directory,'api.json'));
  await put(directory+'/search-index.json',JSON.stringify(locale.pages.map(page=>({title:page.title,href:page.href,text:page.markdown.replace(/[#*`|]/g,' ').replace(/\s+/g,' ')}))));
  for(const name of ['docs.css','docs.js'])await copyFile(path.join(root,'scripts/docs-assets',name),path.join(root,directory,name));
}
const llms=`# WebAR Fácil ${pkg.version}\n\n> Biblioteca WebAR TypeScript open-source. Imágenes en escritorio/móvil, WebXR y odometría local. Índice del contrato implementado.\n\nEmpieza por docs/ai-guide.md y docs/getting-started.md. No usar docs/archive como API.\n\n## Documentación\n\n${pages.map(page=>`- [${page.title}](docs/${page.name}.md)`).join('\n')}\n\n## English documentation\n\n${english.map(page=>`- [${page.title}](docs/en/${page.name}.md)`).join('\n')}\n\n## Contrato estructurado\n\n- [API JSON](docs/api.json)\n- [Manual completo](llms-full.txt)\n`;
const full=`# WebAR Fácil ${pkg.version} · manual completo\n\nGenerado desde documentación vigente y HTML de ejemplo. Lee primero el contrato de IA. Las rutas de ejemplo no son universales.\n\n${[pages.find(p=>p.name==='ai-guide'),...pages.filter(p=>p.name!=='ai-guide')].map(page=>`---\nFuente: docs/${page.name}.md\n\n${page.markdown}`).join('\n\n')}\n\n## English documentation\n\n${english.map(page=>`---\nSource: docs/en/${page.name}.md\n\n${page.markdown}`).join('\n\n')}\n`;
for(const directory of ['','public/','dist/']){await put(directory+'llms.txt',llms);await put(directory+'llms-full.txt',full);}
for(const name of await readdir(path.join(root,'benchmarks')))if(name.endsWith('.json'))for(const directory of ['public','dist']){
  await mkdir(path.join(root,directory,'benchmarks'),{recursive:true});await copyFile(path.join(root,'benchmarks',name),path.join(root,directory,'benchmarks',name));
}
console.log(`Documentación: ${pages.length} capítulos; ${manifest.exports.length} exports; HTML, Markdown, JSON y llms generados.`);
