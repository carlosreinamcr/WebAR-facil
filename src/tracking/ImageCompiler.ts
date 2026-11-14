/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { loadOpenCV } from '../vision/runtime.ts';
import { createORB, extractORB, GrayBuffers, ORB_EXTRACTOR_ID } from '../vision/features.ts';

export const TARGET_HEADER_BYTES = 48;
export const TARGET_MAX_BYTES = 32 * 1024 * 1024;
export const TARGET_MAX_FEATURES = 100_000;
export const ORB_DESCRIPTOR_BYTES = 32;

export interface MarkerFeatures {
  width: number; height: number;
  /** x,y,ángulo en radianes,respuesta por punto; descriptores ORB de 32 bytes. */
  keypoints: Float32Array; descriptors: Uint8Array;
}
export interface CompiledMarker extends MarkerFeatures {
  simulated: boolean; physicalWidthMeters: number; extractorId: number;
}
export interface DecodedImage { data: Uint8ClampedArray; width: number; height: number }
export interface CompilerOptions {
  /** Precalcular vistas acortadas para inclinaciones fuertes. true por defecto. */
  affineViews?:boolean;
  physicalWidthMeters: number;
  opencvURL?: string;
  extractorId?: number;
  maxDimension?: number;
  /** Solo fixtures o compatibilidad: nunca se habilita implícitamente. */
  simulate?: boolean;
  extract?: (encoded: Uint8Array) => Promise<MarkerFeatures>;
  decode?: (encoded: Uint8Array) => Promise<DecodedImage>;
}
export interface MarkerQuality {
  featureCount: number; coverage: number; duplicateRatio: number;
  usable: boolean; warnings: string[];
}

/** CRC32 IEEE: corrupción de almacenamiento/transporte, no autenticación. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function analyzeFeatures(features: MarkerFeatures): MarkerQuality {
  const count = features.keypoints.length / 4, cells = new Set<number>();
  for (let i = 0; i < count; i++) {
    const x = Math.min(5, Math.floor(features.keypoints[4 * i]! / features.width * 6));
    const y = Math.min(5, Math.floor(features.keypoints[4 * i + 1]! / features.height * 6));
    cells.add(y * 6 + x);
  }
  let duplicates = 0;
  const sampled = Math.min(200, count);
  for (let i = 0; i < sampled; i++) {
    for (let j = i + 1; j < sampled; j++) {
      let distance = 0;
      for (let b = 0; b < 32 && distance < 10; b++) {
        let bits = features.descriptors[32 * i + b]! ^ features.descriptors[32 * j + b]!;
        while (bits) { distance++; bits &= bits - 1; }
      }
      if (distance < 10) { duplicates++; break; }
    }
  }
  const coverage = cells.size / 36, duplicateRatio = sampled ? duplicates / sampled : 1;
  const warnings: string[] = [];
  if (count < 80) warnings.push('Pocas características: usar una imagen con más textura y detalle.');
  if (coverage < 0.35) warnings.push('Las características están concentradas en una zona pequeña.');
  if (duplicateRatio > 0.3) warnings.push('Patrones repetitivos: riesgo de coincidencias ambiguas.');
  return { featureCount: count, coverage, duplicateRatio,
    usable: count >= 40 && coverage >= 0.2 && duplicateRatio < 0.7, warnings };
}

/** Compilador real; usar en un Worker de preprocesamiento o con el CLI de Node. */
export class ImageCompiler {
  async compile(source: Uint8Array | Blob, options: CompilerOptions): Promise<ArrayBuffer> {
    const size = source instanceof Uint8Array ? source.byteLength : source.size;
    if (!size || size > TARGET_MAX_BYTES) throw new RangeError('Imagen vacía o demasiado grande.');
    const encoded = source instanceof Uint8Array ? source : new Uint8Array(await source.arrayBuffer());
    const png = [137,80,78,71,13,10,26,10].every((byte, i) => encoded[i] === byte);
    const jpeg = encoded[0] === 255 && encoded[1] === 216 && encoded[2] === 255;
    if (!png && !jpeg) throw new TypeError('Se requiere un JPG o PNG.');
    if (options.simulate) return encodeMarker({ width: 0, height: 0, keypoints: new Float32Array(), descriptors: new Uint8Array() }, options, true);
    if (options.extract) return encodeMarker(await options.extract(encoded), options);
    const image = options.decode ? await options.decode(encoded) : await decodeImageBrowser(encoded, options.maxDimension ?? 1024);
    return this.compileRGBA(image, options);
  }

  async compileRGBA(image: DecodedImage, options: CompilerOptions): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width < 32 || image.height < 32 ||
        image.width * image.height > 4096 * 4096 || image.data.length !== image.width * image.height * 4) {
      throw new Error('Imagen RGBA inválida; usar entre 32px y 16 megapíxeles.');
    }
    const { cv } = await loadOpenCV(options.opencvURL);
    const buffers = new GrayBuffers(cv), orb = createORB(cv);
    try {
      const gray=buffers.frame(image.data,image.width,image.height),base=extractORB(cv,gray,orb);
      const layers=[base];
      // Pirámide offline adicional: conservar rasgos de contexto cuando el marcador
      // ocupa pocos píxeles en la cámara. Los puntos se normalizan al tamaño base.
      for(const scale of [.5,.25]){
        if(Math.min(image.width,image.height)*scale<64)continue;
        const small=new cv.Mat();
        try{cv.resize(gray,small,new cv.Size(Math.round(image.width*scale),Math.round(image.height*scale)),0,0,cv.INTER_AREA);
          const layer=extractORB(cv,small,orb);
          for(let i=0;i<layer.keypoints.length;i+=4){layer.keypoints[i]!*=image.width/small.cols;layer.keypoints[i+1]!*=image.height/small.rows;}
          layers.push(layer);
        }finally{small.delete();}
      }
      if(options.affineViews!==false)for(const [sx,sy]of [[.6,1],[1,.6]]){
        const tilted=new cv.Mat();
        try{
          cv.resize(gray,tilted,new cv.Size(Math.round(image.width*sx!),Math.round(image.height*sy!)),0,0,cv.INTER_AREA);
          const features=extractORB(cv,tilted,orb),count=Math.min(500,features.descriptors.length/32);
          const keypoints=features.keypoints.slice(0,count*4),descriptors=features.descriptors.slice(0,count*32);
          for(let i=0;i<keypoints.length;i+=4){keypoints[i]!*=image.width/tilted.cols;keypoints[i+1]!*=image.height/tilted.rows;}
          layers.push({width:image.width,height:image.height,keypoints,descriptors});
        }finally{tilted.delete();}
      }
      const keypoints=new Float32Array(layers.reduce((sum,layer)=>sum+layer.keypoints.length,0));
      const descriptors=new Uint8Array(layers.reduce((sum,layer)=>sum+layer.descriptors.length,0));
      let p=0,d=0;for(const layer of layers){keypoints.set(layer.keypoints,p);descriptors.set(layer.descriptors,d);p+=layer.keypoints.length;d+=layer.descriptors.length;}
      const features={width:image.width,height:image.height,keypoints,descriptors};
      const quality = analyzeFeatures(features);
      if (!quality.usable) throw new Error(`Marcador no rastreable: ${quality.warnings.join(' ')}`);
      return encodeMarker(features, { ...options, extractorId: ORB_EXTRACTOR_ID });
    } finally { orb.delete(); buffers.dispose(); }
  }
}

export async function decodeImageBrowser(encoded: Uint8Array, max: number): Promise<DecodedImage> {
  if (!Number.isInteger(max) || max < 64 || max > 4096) throw new Error('maxDimension inválido.');
  validateEncodedDimensions(encoded);
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    if(typeof document==='undefined')throw new Error('Usar MarkerCompiler para decodificar este archivo fuera del Worker, o proporcionar options.decode en Node.');
    // WebKit puede carecer de createImageBitmap dentro de Workers. El decoder
    // nativo de imagen es asíncrono; solo el canvas de preprocesamiento va aquí.
    // Toda la extracción ORB continúa en el Worker de MarkerCompiler.
    const image=document.createElement('img'),url=URL.createObjectURL(new Blob([new Uint8Array(encoded)]));
    try{
      image.src=url;await image.decode();
      const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Canvas de decodificación no disponible.');
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      return{data:context.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};
    }finally{URL.revokeObjectURL(url);}
  }
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(encoded)]), { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale), height = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No se pudo decodificar la imagen en canvas.');
    // Componer transparencia sobre blanco para tener descriptores reproducibles.
    context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.drawImage(bitmap, 0, 0, width, height);
    return { data: context.getImageData(0, 0, width, height).data, width, height };
  } finally { bitmap.close(); }
}

/** Limitar bombas de descompresión antes de invocar el decoder nativo. */
function validateEncodedDimensions(bytes:Uint8Array):void{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let width=0,height=0;
  if(bytes[0]===137&&bytes.length>=24){width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes[0]===255&&bytes[1]===216){
    let offset=2;
    while(offset+4<=bytes.length){
      if(bytes[offset]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++]!;
      if(marker===0xd9||marker===0xda)break;
      const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}
      offset+=length;
    }
  }
  if(!width||!height||width*height>16_777_216)throw new Error('JPG/PNG inválido o mayor de 16 megapíxeles. Reducir la imagen antes de compilar.');
}

export function encodeMarker(features: MarkerFeatures, options: CompilerOptions, simulated = false): ArrayBuffer {
  if (!Number.isFinite(options.physicalWidthMeters) || options.physicalWidthMeters <= 0) throw new Error('Ancho físico inválido.');
  const count = features.keypoints.length / 4, extractorId = options.extractorId ?? 0;
  if (!Number.isInteger(count) || count > TARGET_MAX_FEATURES || features.descriptors.length !== count * 32 ||
      !Number.isInteger(extractorId) || extractorId < 0 || extractorId > 0xffffffff) throw new Error('Características inválidas.');
  const buffer = new ArrayBuffer(TARGET_HEADER_BYTES + count * 48), view = new DataView(buffer);
  view.setUint32(0, 0x54524157, true); view.setUint16(4, 2, true); view.setUint16(6, simulated ? 1 : 0, true);
  view.setUint32(8, buffer.byteLength, true); view.setUint32(12, features.width, true); view.setUint32(16, features.height, true);
  view.setUint32(20, count, true); view.setFloat64(24, options.physicalWidthMeters, true);
  view.setUint32(32, extractorId, true); view.setUint32(36, 32, true);
  features.keypoints.forEach((value, i) => view.setFloat32(TARGET_HEADER_BYTES + i * 4, value, true));
  new Uint8Array(buffer, TARGET_HEADER_BYTES + count * 16).set(features.descriptors);
  view.setUint32(40, crc32(new Uint8Array(buffer, TARGET_HEADER_BYTES)), true);
  view.setUint32(44, crc32(new Uint8Array(buffer, 0, 44)), true);
  const decoded = decodeMarker(buffer);
  if (decoded.width !== features.width || decoded.height !== features.height) throw new Error('Dimensiones inválidas.');
  return buffer;
}

/** Valida antes de reservar arrays. El llamador conserva el buffer de entrada. */
export function decodeMarker(buffer: ArrayBuffer): CompiledMarker {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < TARGET_HEADER_BYTES ||
      buffer.byteLength > TARGET_MAX_BYTES) throw new RangeError('Tamaño de marcador inválido.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x54524157 || view.getUint16(4, true) !== 2) {
    throw new Error('Formato o versión de marcador incompatible.');
  }
  const flags = view.getUint16(6, true);
  const width = view.getUint32(12, true);
  const height = view.getUint32(16, true);
  const count = view.getUint32(20, true);
  const physicalWidthMeters = view.getFloat64(24, true);
  const extractorId = view.getUint32(32, true);
  const simulated = flags === 1;
  if (view.getUint32(44, true) !== crc32(new Uint8Array(buffer, 0, 44)) ||
      view.getUint32(40, true) !== crc32(new Uint8Array(buffer, TARGET_HEADER_BYTES))) {
    throw new Error('Marcador corrupto (CRC32).');
  }
  if (flags > 1 || count > TARGET_MAX_FEATURES ||
      view.getUint32(8, true) !== buffer.byteLength ||
      buffer.byteLength !== TARGET_HEADER_BYTES + count * 48 ||
      view.getUint32(36, true) !== ORB_DESCRIPTOR_BYTES ||
      !Number.isFinite(physicalWidthMeters) || physicalWidthMeters <= 0 ||
      (simulated ? count !== 0 || width !== 0 || height !== 0 :
        count < 4 || !width || !height || width > 32768 || height > 32768 || extractorId === 0)) {
    throw new Error('Cabecera de marcador inválida.');
  }
  const keypoints = new Float32Array(count * 4);
  for (let i = 0; i < keypoints.length; i++) {
    keypoints[i] = view.getFloat32(TARGET_HEADER_BYTES + i * 4, true);
    if (!Number.isFinite(keypoints[i])) throw new Error('Punto no finito.');
  }
  for (let i = 0; i < count; i++) {
    const x = keypoints[i * 4]!;
    const y = keypoints[i * 4 + 1]!;
    if (x < 0 || y < 0 || x >= width || y >= height) throw new Error('Punto fuera de la imagen.');
  }
  return {
    simulated, width, height, physicalWidthMeters, extractorId, keypoints,
    descriptors: new Uint8Array(buffer, TARGET_HEADER_BYTES + count * 16).slice(),
  };
}

