/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
const search=document.querySelector('#search'),results=document.querySelector('#results');
const english=document.documentElement.lang==='en';
const labels=english
  ?{empty:'No results. Try another search.',error:'Search is unavailable. Open the manual over HTTP or HTTPS.',copy:'Copy',copied:'Copied',select:'Select the code',copyCode:'Copy code'}
  :{empty:'Sin resultados. Prueba otra palabra.',error:'No se pudo cargar el índice. Abre el manual mediante HTTP/HTTPS.',copy:'Copiar',copied:'Copiado',select:'Selecciona el código',copyCode:'Copiar código'};
let indexPromise;
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
document.querySelectorAll('nav a').forEach(link=>{
  if(new URL(link.href).pathname===location.pathname||(location.pathname.endsWith('/')&&link.getAttribute('href')==='index.html'))link.setAttribute('aria-current','page');
});
search.addEventListener('input',async()=>{
  const query=search.value.trim();results.replaceChildren();results.hidden=!query;
  if(!query)return;
  try{
    indexPromise??=fetch('search-index.json').then(response=>{if(!response.ok)throw new Error('Índice no disponible');return response.json();});
    const entries=await indexPromise;if(search.value.trim()!==query)return;
    const terms=normalize(query).split(/\s+/);
    const matches=entries.filter(entry=>terms.every(term=>normalize(entry.title+' '+entry.text).includes(term))).slice(0,12);
    if(!matches.length)results.textContent=labels.empty;
    for(const match of matches){const link=document.createElement('a');link.href=match.href;link.textContent=match.title;const summary=document.createElement('small');const position=Math.max(0,normalize(match.text).indexOf(terms[0])-70);summary.textContent=match.text.slice(position,position+200)+'…';link.append(summary);results.append(link);}
  }catch{results.textContent=labels.error;}
});
addEventListener('keydown',event=>{if(event.key==='Escape'){results.hidden=true;search.blur();}});
document.querySelectorAll('pre').forEach(pre=>{
  const code=pre.querySelector('code');if(!code)return;
  const button=document.createElement('button');button.type='button';button.textContent=labels.copy;button.setAttribute('aria-label',labels.copyCode);
  button.onclick=async()=>{try{await navigator.clipboard.writeText(code.textContent);button.textContent=labels.copied;}catch{button.textContent=labels.select;}setTimeout(()=>{button.textContent=labels.copy;},1800);};pre.prepend(button);
});
