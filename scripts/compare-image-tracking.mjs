/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,writeFile} from 'node:fs/promises';
const prefix=process.argv[2]??'image-tracking';if(!/^[a-z0-9-]+$/.test(prefix))throw new Error('Prefijo inválido');
const before=JSON.parse(await readFile(`benchmarks/${prefix}-before.json`,'utf8')),after=JSON.parse(await readFile(`benchmarks/${prefix}-after.json`,'utf8'));
if(before.fixture!==after.fixture||JSON.stringify(before.environment)!==JSON.stringify(after.environment))throw new Error('Comparar misma fixture y entorno');
const cases=before.summaries.map(a=>{
 const b=after.summaries.find(b=>b.name===a.name);if(!b||a.frames!==b.frames||a.expected!==b.expected||a.warmup!==b.warmup)throw new Error('Casos incompatibles');
 if(b.tracked<a.tracked||b.falsePositive>a.falsePositive||b.maxCornerErrorPx>8||(a.recovered&&!b.recovered))throw new Error('Regresión: '+a.name);
 return{name:a.name,workerMeanMs:{before:a.stages.workerMs.mean,after:b.stages.workerMs.mean},workerP95Ms:{before:a.stages.workerMs.p95,after:b.stages.workerMs.p95},tracked:{before:a.tracked,after:b.tracked,expected:a.expected},maxCornerErrorPx:{before:a.maxCornerErrorPx,after:b.maxCornerErrorPx},falsePositives:{before:a.falsePositive,after:b.falsePositive},...(b.recovered!==undefined?{recovered:b.recovered}:{})};
});
const report={beforeBuild:before.sdk,afterBuild:after.sdk,createdAt:new Date().toISOString(),environment:after.environment,fixture:after.fixture,cases,limits:after.limits};
await writeFile(`benchmarks/${prefix}-comparison.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
