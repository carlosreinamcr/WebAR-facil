/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {CameraIntrinsics} from '../Pose.ts';

const MAX_POINTS=750;
const MIN_POINTS=96;

/** Límite de trabajo por sesión a partir del tiempo real del flujo óptico. */
export class FlowPointBudget {
  limit=MAX_POINTS;
  private slow=0;
  private fast=0;

  sample(elapsedMs:number,points:number):void{
    this.slow=elapsedMs>85?this.slow+1:0;
    this.fast=elapsedMs<24&&points>=this.limit*.8?this.fast+1:0;
    if(this.slow>=3){
      this.limit=Math.max(MIN_POINTS,Math.min(this.limit,Math.floor(points*.7)));
      this.slow=0;
    }else if(this.fast>=12){
      this.limit=Math.min(MAX_POINTS,Math.ceil(this.limit*1.2));
      this.fast=0;
    }
  }
}

/** Repartir el cupo entre celdas, conservando la prioridad original dentro de cada una. */
export function distributedIndices(count:number,limit:number,k:Pick<CameraIntrinsics,'width'|'height'>,
  pixel:(index:number)=>readonly [number,number]):number[]{
  if(count<=limit)return Array.from({length:count},(_,i)=>i);
  const columns=8,rows=6,cells=Array.from({length:columns*rows},()=>[] as number[]);
  for(let i=0;i<count;i++){
    const [x,y]=pixel(i);
    const col=Math.max(0,Math.min(columns-1,Math.floor(x/k.width*columns)));
    const row=Math.max(0,Math.min(rows-1,Math.floor(y/k.height*rows)));
    cells[row*columns+col]!.push(i);
  }
  const selected:number[]=[];
  for(let depth=0;selected.length<limit;depth++){
    for(const cell of cells){
      const index=cell[depth];
      if(index!==undefined)selected.push(index);
      if(selected.length===limit)break;
    }
  }
  return selected;
}
