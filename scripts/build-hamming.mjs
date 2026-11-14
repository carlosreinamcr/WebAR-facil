/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import wabtFactory from 'wabt';
import {readFile,writeFile} from 'node:fs/promises';
const wabt=await wabtFactory(),source=await readFile('src/vision/wasm/hamming.wat','utf8');
const module=wabt.parseWat('hamming.wat',source);try{
 module.resolveNames();module.validate();const {buffer}=module.toBinary({canonicalize_lebs:true,write_debug_names:false});
 if(!WebAssembly.validate(buffer))throw new Error('Kernel WASM inválido');
 const generated='// Generado desde wasm/hamming.wat mediante npm run build:hamming. Código propio MIT.\nexport const HAMMING_WASM=new Uint8Array('+JSON.stringify([...buffer])+');\n';
 let existing='';try{existing=await readFile('src/vision/hamming-binary.ts','utf8');}catch{}
 if(process.argv.includes('--check')){if(existing!==generated)throw new Error('Regenerar kernel con npm run build:hamming');}else if(existing!==generated)await writeFile('src/vision/hamming-binary.ts',generated);
 console.log('Kernel Hamming WASM: '+buffer.length+' bytes');
}finally{module.destroy();}
