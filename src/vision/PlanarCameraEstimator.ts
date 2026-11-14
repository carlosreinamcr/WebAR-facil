/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {CameraIntrinsics} from '../Pose';

/** Focal estimada desde una homografía planar; mantiene centro óptico y píxeles cuadrados.
 * Las vistas frontales no aportan focal observable y conservan la aproximación inicial.
 * No estima distorsión ni sustituye una calibración métrica de la lente.
 */
export class PlanarCameraEstimator {
  private readonly samples:number[]=[];
  private focal:number|null=null;

  current(initial:CameraIntrinsics):CameraIntrinsics {
    return this.focal===null?initial:{...initial,fx:this.focal,fy:this.focal};
  }

  observe(h:ArrayLike<number>,initial:CameraIntrinsics):void {
    if(h.length!==9||Array.from(h).some(value=>!Number.isFinite(value)))return;
    const x1=h[0]!-initial.cx*h[6]!,y1=h[3]!-initial.cy*h[6]!,z1=h[6]!;
    const x2=h[1]!-initial.cx*h[7]!,y2=h[4]!-initial.cy*h[7]!,z2=h[7]!;
    // K^-1 h1 y K^-1 h2 son columnas ortogonales con igual norma.
    const a=x1*x2+y1*y2,b=z1*z2,c=x1*x1+y1*y1-x2*x2-y2*y2,d=z1*z1-z2*z2;
    const denominator=b*b+d*d;if(denominator<1e-24)return;
    const squared=-(a*b+c*d)/denominator;
    if(!(squared>0))return;
    const focal=Math.sqrt(squared),extent=Math.max(initial.width,initial.height);
    if(focal<extent*.45||focal>extent*3)return;
    const norm=x1*x1+y1*y1+x2*x2+y2*y2;
    if(!(norm>0)||Math.hypot(b,d)*squared/norm<.015)return;
    if(Math.hypot(a+b*squared,c+d*squared)/norm>.025)return;
    this.samples.push(focal);if(this.samples.length>7)this.samples.shift();
    // Una sola homografía ruidosa no debe cambiar la proyección de la cámara.
    if(this.samples.length<3)return;
    const sorted=[...this.samples].sort((left,right)=>left-right),median=sorted[Math.floor(sorted.length/2)]!;
    if(this.samples.length>=3){
      const deviations=this.samples.map(value=>Math.abs(value-median)).sort((left,right)=>left-right);
      if(deviations[Math.floor(deviations.length/2)]!/median>.15)return;
    }
    // Limitar cambios posteriores para mantener continuidad de pose.
    this.focal=this.focal===null?median:this.focal+Math.max(-this.focal*.1,Math.min(this.focal*.1,(median-this.focal)*.35));
  }
}
