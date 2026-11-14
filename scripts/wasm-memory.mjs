/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Ajuste reproducible del mínimo de memoria importada de un WASM de Emscripten. */
export function lowerImportedMemory(bytes,expectedPages,newPages){
  const result=new Uint8Array(bytes);let offset=8,patched=0;
  const read=()=>{let value=0,shift=0,byte;do{byte=result[offset++];value|=(byte&127)<<shift;shift+=7;}while(byte&128);return value>>>0;};
  const name=()=>{const length=read(),value=new TextDecoder().decode(result.subarray(offset,offset+length));offset+=length;return value;};
  const limits=(memory=false)=>{const flags=read(),start=offset,minimum=read(),end=offset;if(flags&1)read();
    if(memory){if(minimum!==expectedPages)throw new Error('Cambió el mínimo importado del WASM; revisar build.');
      let remaining=newPages,index=start;do{let value=remaining&127;remaining>>>=7;if(remaining)value|=128;result[index++]=value;}while(remaining);
      if(index!==end)throw new Error('El ajuste no conserva la longitud de LEB128.');patched++;}
  };
  while(offset<result.length){const id=result[offset++],length=read(),end=offset+length;
    if(id===2){const count=read();for(let i=0;i<count;i++){
      const module=name(),field=name(),kind=result[offset++];
      if(kind===0)read();
      else if(kind===1){offset++;limits();}
      else if(kind===2)limits(module==='env'&&field==='memory');
      else if(kind===3)offset+=2;
      else if(kind===4){read();read();}
      else throw new Error('Tipo de import WASM desconocido.');
    }}offset=end;
  }
  if(patched!==1||!WebAssembly.validate(result))throw new Error('No se pudo validar el ajuste de memoria WASM.');
  return result;
}
