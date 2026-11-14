/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {DEVICE_TEST_PROTOCOL} from '../src/diagnostics/device-protocol.ts';
const files=process.argv.slice(2),outputIndex=files.indexOf('--output');let outputFile='artifacts/device-validation-summary.json';
if(outputIndex!==-1){if(!files[outputIndex+1])throw new Error('Falta ruta para --output.');outputFile=files[outputIndex+1];files.splice(outputIndex,2);}
if(!files.length)throw new Error('Indica uno o más informes JSON exportados.');
const summaries=[];
for(const filename of files){
  if((await stat(filename)).size>2*1024*1024)throw new Error('Informe demasiado grande.');
  const suite=JSON.parse(await readFile(filename,'utf8'));
  if(suite.schemaVersion!==1||suite.kind!=='webar-device-test-suite'||!Array.isArray(suite.reports)||!suite.reports.length||suite.reports.length>16||!Array.isArray(suite.results)||suite.results.length>128)throw new Error('Formato de suite incompatible.');
  const context=suite.context??{},sdk=suite.sdk;
  if(typeof sdk?.version!=='string'||sdk.version.length>64||!/^[a-f0-9]{16}$/.test(sdk?.build??''))throw new Error('Identidad SDK inválida.');
  if(!['ios','android','desktop','other'].includes(context.platform)||!['unspecified','automated','physical-user-reported'].includes(context.execution))throw new Error('Contexto de ejecución inválido.');
  if(['deviceModel','osVersion','browserVersion'].some(key=>typeof context[key]!=='string'||context[key].length>160))throw new Error('Metadatos de dispositivo inválidos.');
  for(const report of suite.reports){
    if(report.kind!=='webar-diagnostics'||report.schemaVersion!==1||report.sdk?.build!==sdk.build||!Number.isSafeInteger(report.poses?.count)||report.poses.count<0)throw new Error('Sesión incompatible con la suite.');
    if(['platform','execution','deviceModel','osVersion','browserVersion'].some(key=>report.context?.[key]!==context[key]))throw new Error('No mezclar dispositivos, SO, navegadores o tipos de ejecución en una suite.');
  }
  for(const result of suite.results)if(!DEVICE_TEST_PROTOCOL.some(test=>test.id===result.testId&&test.modes.includes(result.scenario))||!['pending','pass','fail','not-supported'].includes(result.result))throw new Error('Resultado de caso inválido.');
  const xr=suite.reports.some(report=>report.environment?.immersiveAR===true),modes=['image','flow','transition',...(xr?['webxr']:[])];
  const expected=modes.flatMap(mode=>DEVICE_TEST_PROTOCOL.filter(test=>test.modes.includes(mode)).map(test=>({scenario:mode,testId:test.id})));
  const cases=expected.map(test=>({...test,result:[...suite.results].reverse().find(result=>result.scenario===test.scenario&&result.testId===test.testId)?.result??'pending'}));
  const counts=Object.fromEntries(['pending','pass','fail','not-supported'].map(result=>[result,cases.filter(test=>test.result===result).length]));
  const missingEvidence=modes.filter(mode=>cases.some(test=>test.scenario===mode&&test.result==='pass')&&!suite.reports.some(report=>{
    const scenario=report.context?.scenario?.split(':')[0],backend=mode==='image'?'image':mode==='webxr'?'webxr':'optical-flow';
    return scenario===mode&&report.poses.count>0&&(report.poses.backends?.[backend]??0)>0;
  }));
  const physical=context.execution==='physical-user-reported',metadata=['deviceModel','osVersion','browserVersion'].every(key=>context[key].trim());
  const status=!physical?'not-physical-evidence':!metadata?'incomplete-device-info':counts.fail?'reported-fail':counts.pending?'pending':missingEvidence.length?'missing-scenario-evidence':counts['not-supported']?'reported-with-limits':'operator-reported-pass';
  summaries.push({sdk,platform:context.platform,deviceModel:context.deviceModel,osVersion:context.osVersion,browserVersion:context.browserVersion,execution:context.execution,status,counts,cases,missingEvidence,evaluatedModes:modes});
}
const matrix=['ios','android'].map(platform=>({platform,physicalReports:summaries.filter(report=>report.platform===platform&&report.execution==='physical-user-reported').length,
  status:summaries.some(report=>report.platform===platform&&report.status==='operator-reported-pass')?'operator-reported-pass':'pending-or-limited'}));
const output={schemaVersion:1,kind:'webar-device-summary',certification:false,matrix,reports:summaries};
await mkdir(path.dirname(outputFile),{recursive:true});await writeFile(outputFile,JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
