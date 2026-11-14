/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { openCV } from './opencv-node.mjs';
import { ImageCompiler, decodeMarker, analyzeFeatures } from '../src/tracking/ImageCompiler.ts';

export async function compileMarker(input, output, physicalWidthMeters) {
  await openCV();
  const bytes = new Uint8Array(await readFile(input));
  const compiler = new ImageCompiler();
  const buffer = await compiler.compile(bytes, { physicalWidthMeters,
    decode: async encoded => {
      const { data, info } = await sharp(encoded, { limitInputPixels: 16_777_216 })
        .rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    },
  });
  const quality = analyzeFeatures(decodeMarker(buffer));
  await writeFile(output, new Uint8Array(buffer));
  await writeFile(`${output}.json`, JSON.stringify({ input, physicalWidthMeters, format: 'WART v2', ...quality }, null, 2));
  console.log(`${output}: ${quality.featureCount} puntos, cobertura ${(quality.coverage * 100).toFixed(0)}%.`);
  for (const warning of quality.warnings) console.warn(warning);
  return { buffer, quality };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, width] = process.argv.slice(2);
  if (!input || !output || !width) throw new Error('Uso: npm run compile:marker -- imagen.png target.dat ancho-en-metros');
  await compileMarker(input, output, Number(width));
}
