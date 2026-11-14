import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {DEVICE_TEST_PROTOCOL} from '../src/diagnostics/device-protocol.ts';
import {LIBRARY_VERSION,LIBRARY_BUILD} from '../src/build-info.ts';

test('Resumen de dispositivos: emulación no aprueba hardware y falta Android sigue pendiente',async()=>{
  await mkdir('tests/generated',{recursive:true});const file='tests/generated/device-report-unit.json';
  const sdk={version:LIBRARY_VERSION,build:LIBRARY_BUILD};
  const suite={schemaVersion:1,kind:'webar-device-test-suite',sdk,context:{platform:'ios',execution:'automated',deviceModel:'fixture',osVersion:'fixture',browserVersion:'fixture'},
    reports:[{kind:'webar-diagnostics',schemaVersion:1,sdk,poses:{count:1},environment:{immersiveAR:false}}],results:DEVICE_TEST_PROTOCOL.flatMap(test=>test.modes.map(scenario=>({testId:test.id,scenario,result:'pass'})))};
  suite.reports[0].context=suite.context;await writeFile(file,JSON.stringify(suite));
  const output='tests/generated/validation-summary-unit.json';
  const run=()=>spawnSync(process.execPath,['scripts/summarize-device-reports.mjs',file,'--output',output],{encoding:'utf8',windowsHide:true});
  let result=run();assert.equal(result.status,0,result.stderr);let summary=JSON.parse(await readFile(output,'utf8'));
  assert.equal(summary.certification,false);assert.equal(summary.reports[0].status,'not-physical-evidence');assert.equal(summary.matrix[0].physicalReports,0);
  suite.context.execution='physical-user-reported';await writeFile(file,JSON.stringify(suite));result=run();assert.equal(result.status,0,result.stderr);summary=JSON.parse(await readFile(output,'utf8'));assert.equal(summary.reports[0].status,'missing-scenario-evidence');
  suite.reports=['image','flow','transition'].map(scenario=>({kind:'webar-diagnostics',schemaVersion:1,sdk,context:{...suite.context,scenario},poses:{count:1,backends:{[scenario==='image'?'image':'optical-flow']:1}},environment:{immersiveAR:false}}));
  await writeFile(file,JSON.stringify(suite));result=run();assert.equal(result.status,0,result.stderr);summary=JSON.parse(await readFile(output,'utf8'));
  assert.equal(summary.reports[0].status,'operator-reported-pass');assert.equal(summary.matrix.find(item=>item.platform==='android').status,'pending-or-limited');assert.equal(summary.certification,false);
  suite.results[0].result='forged-success';await writeFile(file,JSON.stringify(suite));assert.notEqual(run().status,0);
});
