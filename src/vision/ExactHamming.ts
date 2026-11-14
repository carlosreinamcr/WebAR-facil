/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {HAMMING_WASM} from './hamming-binary.ts';
export interface ORBMatch {query:number;train:number;distance:number;}
const MAX_DESCRIPTORS=131_072;
/** Distancia exacta para coincidencias aceptadas; sin SIMD, threads ni índices aproximados. */
export class ExactHamming {
  private readonly memory:WebAssembly.Memory;
  private readonly run:(query:number,queries:number,train:number,trains:number,out:number)=>void;
  constructor(){
    const instance=new WebAssembly.Instance(new WebAssembly.Module(HAMMING_WASM));
    this.memory=instance.exports.memory as WebAssembly.Memory;this.run=instance.exports.match as typeof this.run;
  }
  match(query:Uint8Array,train:Uint8Array):ORBMatch[]{
    if(!(query instanceof Uint8Array)||!(train instanceof Uint8Array))throw new TypeError('Se requieren descriptores Uint8Array.');
    if(query.length%32||train.length%32||query.length/32>MAX_DESCRIPTORS||train.length/32>MAX_DESCRIPTORS)throw new RangeError('Descriptores ORB inválidos o demasiado grandes.');
    if(query.length<64||train.length<64)return[];
    const count=query.length/32,trainOffset=query.length,outOffset=trainOffset+train.length,required=outOffset+count*8;
    if(required>this.memory.buffer.byteLength)this.memory.grow(Math.ceil((required-this.memory.buffer.byteLength)/65536));
    // Una llamada por lote; refrescar vistas tras memory.grow evita buffers separados.
    const heap=new Uint8Array(this.memory.buffer);heap.set(query,0);heap.set(train,trainOffset);
    this.run(0,count,trainOffset,train.length/32,outOffset);
    const output=new Int32Array(this.memory.buffer,outOffset,count*2),candidates:ORBMatch[]=[];
    for(let i=0;i<count;i++){const target=output[2*i]!;if(target>=0)candidates.push({query:i,train:target,distance:output[2*i+1]!});}
    candidates.sort((a,b)=>a.distance-b.distance);const used=new Set<number>();
    return candidates.filter(match=>{if(used.has(match.train))return false;used.add(match.train);return true;});
  }
  get memoryBytes():number{return this.memory.buffer.byteLength;}
}
/** Fallo de compilación/CSP: el llamador conserva el matcher OpenCV como alternativa. */
export function createExactHamming():ExactHamming|null{try{return new ExactHamming();}catch{return null;}}
