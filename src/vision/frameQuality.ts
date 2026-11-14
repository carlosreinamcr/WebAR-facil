/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {CV} from './runtime';
/** Muestreo compartido por todos los targets, sin otro canvas ni copia de imagen. */
export function measureFrame(gray:InstanceType<CV['Mat']>):{gradient:number;laplacianVariance:number}{
  const bytes=gray.data,width=gray.cols,height=gray.rows;let sum=0,squares=0,gradient=0,n=0;
  for(let y=2;y<height-2;y+=4)for(let x=2;x<width-2;x+=4){
    const i=y*width+x,c=bytes[i]!,lap=bytes[i-1]!+bytes[i+1]!+bytes[i-width]!+bytes[i+width]!-4*c;
    sum+=lap;squares+=lap*lap;gradient+=Math.abs(bytes[i+1]!-bytes[i-1]!)+Math.abs(bytes[i+width]!-bytes[i-width]!);n++;
  }
  return{gradient:n?gradient/(2*n):0,laplacianVariance:n?Math.max(0,squares/n-(sum/n)**2):0};
}
