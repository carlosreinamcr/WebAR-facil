/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {readFile,writeFile} from 'node:fs/promises';
const read=async file=>JSON.parse(await readFile(file,'utf8'));
const baseline=await read(process.argv[2]??'benchmarks/baseline-2026-11-09.json'),current=await read(process.argv[3]??'benchmarks/latest.json'),experimental=await read(process.argv[4]??'benchmarks/experimental-2026-11-09.json');
if([current,experimental].some(report=>report.frames!==baseline.frames||report.fixture!==baseline.fixture))throw new Error('Los informes no describen el mismo protocolo.');
const keys=['p50','p95','max'],same=keys.every(key=>Math.abs(current.scaleAlignedTrajectoryError[key]-baseline.scaleAlignedTrajectoryError[key])<1e-12);
const median=experimental.scaleAlignedTrajectoryError.p50<baseline.scaleAlignedTrajectoryError.p50?'reduces':'does not reduce';
const tail=experimental.scaleAlignedTrajectoryError.p95>baseline.scaleAlignedTrajectoryError.p95?'increases':'does not increase';
const report={protocol:`${baseline.frames} deterministic 640x480 frames; real WASM; single-run observations, not mobile certification`,baseline,current,experimental,
  conclusion:`Default trajectory error ${same?'is unchanged':'differs; inspect the reported measurements'}. Experimental keyframe correction ${median} median error and ${tail} p95 error on this fixture; it remains opt-in. Timing differences are not proof of a speed improvement.`};
await writeFile('benchmarks/odometry-comparison.json',JSON.stringify(report,null,2));console.log(report.conclusion);
