/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {openCV} from './opencv-node.mjs';
import {CameraCalibrator} from '../src/calibration/CameraCalibrator.ts';
const [output,...images]=process.argv.slice(2);
if(!output||images.length<10)throw new Error('Uso: npm run calibrate -- camera.json vista1.jpg ... vista10.jpg (o más)');
const{cv}=await openCV(),calibrator=new CameraCalibrator(cv);
try{
  for(const image of images){const{data,info}=await sharp(image,{limitInputPixels:16_777_216}).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const result=calibrator.addRGBA(new Uint8ClampedArray(data),info.width,info.height);console.log(image,result.reason,result.views);}
  const report=calibrator.solve();await writeFile(output,JSON.stringify(report,null,2));console.log(output,`RMS ${report.rmsPx.toFixed(3)}px`);
}finally{calibrator.dispose();}
