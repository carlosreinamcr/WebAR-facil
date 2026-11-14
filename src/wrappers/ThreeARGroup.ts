/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { Group } from 'three';
import type { ARPose } from '../Pose';
import { assertMatrix } from '../spatial/matrices';
import type {WebAREngine} from '../WebAREngine';

export class ThreeARGroup extends Group {
  private subscriptions:(()=>void)[]=[];
  constructor() {
    super(); this.matrixAutoUpdate = false; this.visible = false;
  }
  /** Contenido independiente por marcador; no reinicia animaciones al perderlo. */
  bind(engine:WebAREngine,targetId='default'):this{
    this.unbind();
    this.subscriptions.push(engine.onPose((matrix,pose)=>{if((pose.targetId??'default')===targetId)this.update(matrix,pose);}),
      engine.onTargetVisibility(event=>{if(event.targetId===targetId)this.visible=event.visible;}),
      engine.onStatus(status=>{if(['stopped','xr-ended','camera-suspended','starting-webxr','odometry-lost','tracking-lost','scan-floor','select-surface','scan-marker-in-xr'].includes(status))this.visible=false;}));
    return this;
  }
  unbind():void{this.subscriptions.forEach(unsubscribe=>unsubscribe());this.subscriptions=[];}
  dispose():void{this.unbind();this.removeFromParent();}

  /**
   * Con metadata, usar pose de mundo: sirve con cámara normal y cámara XR.
   * Sin metadata, matrix es modelView y requiere una cámara identidad.
   * El core ya normalizó OpenCV -> WebGL; no repetir la conversión aquí.
   */
  update(matrix: Float32Array, pose?: ARPose): void {
    const model = pose?.worldMatrix ?? matrix;
    assertMatrix(model);
    this.matrix.fromArray(model); this.matrixWorldNeedsUpdate = true; this.visible = true;
  }
}
