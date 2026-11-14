/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { assertRigid } from './matrices.ts';
export type Quaternion = [number,number,number,number];
export function quaternionFromMatrix(m:Float32Array):Quaternion {
  const trace=m[0]!+m[5]!+m[10]!;let x:number,y:number,z:number,w:number;
  if(trace>0){const s=Math.sqrt(trace+1)*2;w=.25*s;x=(m[6]!-m[9]!)/s;y=(m[8]!-m[2]!)/s;z=(m[1]!-m[4]!)/s;}
  else if(m[0]!>m[5]!&&m[0]!>m[10]!){const s=Math.sqrt(1+m[0]!-m[5]!-m[10]!)*2;w=(m[6]!-m[9]!)/s;x=.25*s;y=(m[4]!+m[1]!)/s;z=(m[8]!+m[2]!)/s;}
  else if(m[5]!>m[10]!){const s=Math.sqrt(1+m[5]!-m[0]!-m[10]!)*2;w=(m[8]!-m[2]!)/s;x=(m[4]!+m[1]!)/s;y=.25*s;z=(m[9]!+m[6]!)/s;}
  else{const s=Math.sqrt(1+m[10]!-m[0]!-m[5]!)*2;w=(m[1]!-m[4]!)/s;x=(m[8]!+m[2]!)/s;y=(m[9]!+m[6]!)/s;z=.25*s;}
  const length=Math.hypot(x,y,z,w);return[x/length,y/length,z/length,w/length];
}
export function matrixFromPose(position:readonly number[],q:Quaternion):Float32Array {
  const[x,y,z,w]=q,x2=x+x,y2=y+y,z2=z+z;
  return new Float32Array([1-y*y2-z*z2,x*y2+w*z2,x*z2-w*y2,0,
    x*y2-w*z2,1-x*x2-z*z2,y*z2+w*x2,0,x*z2+w*y2,y*z2-w*x2,1-x*x2-y*y2,0,
    position[0]!,position[1]!,position[2]!,1]);
}
export function slerp(a:Quaternion,b:Quaternion,t:number):Quaternion {
  let dot=a.reduce((sum,v,i)=>sum+v*b[i]!,0);let end=b;
  if(dot<0){end=b.map(v=>-v) as Quaternion;dot=-dot;}
  let u=1-t,v=t;
  if(dot<.9995){const angle=Math.acos(Math.min(1,dot)),s=Math.sin(angle);u=Math.sin((1-t)*angle)/s;v=Math.sin(t*angle)/s;}
  const q=a.map((value,i)=>u*value+v*end[i]!) as Quaternion,length=Math.hypot(...q);
  return q.map(value=>value/length) as Quaternion;
}
/** Suavizado temporal en SE(3), sin interpolar elementos de una matriz. */
export class PoseFilter {
  private previous:Float32Array|null=null;
  private time=0;
  private readonly tau:number;
  constructor(timeConstantSeconds=.045){if(!(timeConstantSeconds>0))throw new Error('Constante de filtro inválida.');this.tau=timeConstantSeconds;}
  reset():void{this.previous=null;this.time=0;}
  filter(matrix:Float32Array,timestampMs:number):Float32Array {
    assertRigid(matrix);
    const dt=(timestampMs-this.time)/1000;
    if(!this.previous||dt<=0||dt>.5){this.previous=matrix.slice();this.time=timestampMs;return matrix.slice();}
    const previous=this.previous;
    const speed=Math.hypot(matrix[12]!-previous[12]!,matrix[13]!-previous[13]!,matrix[14]!-previous[14]!)/dt;
    const alpha=1-Math.exp(-dt/(this.tau/(1+Math.min(10,speed)*3)));
    const position=[12,13,14].map(i=>previous[i]!+(matrix[i]!-previous[i]!)*alpha);
    const filtered=matrixFromPose(position,slerp(quaternionFromMatrix(previous),quaternionFromMatrix(matrix),alpha));
    this.previous=filtered;this.time=timestampMs;return filtered.slice();
  }
}
