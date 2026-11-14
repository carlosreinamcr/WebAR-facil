/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { Object3D, Camera } from 'three';
import type { WebAREngine } from '../WebAREngine';
import {ThreeCameraBackground} from './ThreeCameraBackground';

interface ComponentInstance {
  data: { target: string; physicalWidth: number;targetId:string };
  el: HTMLElement & { object3D: Object3D; sceneEl?: { camera?: Camera;object3D?:Object3D } };
  unsubscribe?: () => void;
  originalAutoUpdate?: boolean;
  originalVisible?: boolean;
  removed?: boolean;
  camera?: Camera;
  cameraAutoUpdate?: boolean;
  background?:ThreeCameraBackground;
  releaseBackground?:()=>void;
  releaseCamera?:()=>void;
}
interface AFrameRegistry {
  registerComponent(name: string, definition: {
    schema: { target: { type: 'string'; default: string }; physicalWidth: { type: 'number'; default: number };targetId:{type:'string';default:string} };
    init(this: ComponentInstance): void;
    update(this: ComponentInstance, previous: { target?: string; physicalWidth?: number;targetId?:string }): void;
    remove(this: ComponentInstance): void;
  }): unknown;
}

/** Una instancia de motor por escena; configurar su cámara/renderer al crearla. */
export function registerAFrameComponent(AFRAME: AFrameRegistry, engine: WebAREngine): void {
  let configuring=Promise.resolve();
  const backgrounds=new WeakMap<Object3D,{view:ThreeCameraBackground;users:number}>();
  const cameras=new WeakMap<Camera,{users:number;autoUpdate:boolean}>();
  AFRAME.registerComponent('my-ar-tracker', {
    schema: { target: { type: 'string', default: '' }, physicalWidth: { type: 'number', default: 0.2 },targetId:{type:'string',default:'default'} },
    init() {
      this.originalAutoUpdate = this.el.object3D.matrixAutoUpdate;
      this.originalVisible = this.el.object3D.visible;
      this.el.object3D.matrixAutoUpdate = false;
      this.el.object3D.visible = false;
      if(this.el.sceneEl?.object3D){
        const root=this.el.sceneEl.object3D;let shared=backgrounds.get(root);
        if(!shared){shared={view:new ThreeCameraBackground(engine.videoElement,engine.calibration),users:0};backgrounds.set(root,shared);root.add(shared.view.object3D);}
        shared.users++;this.background=shared.view;const entry=shared;
        this.releaseBackground=()=>{if(--entry.users===0){entry.view.dispose();backgrounds.delete(root);}};
      }
      this.unsubscribe = engine.onPose((_matrix, pose) => {
        if (this.removed||(pose.targetId??'default')!==(this.data.targetId??'default')) return;
        this.el.object3D.matrix.fromArray(pose.worldMatrix);
        this.el.object3D.matrixWorldNeedsUpdate = true;
        this.el.object3D.visible = true;
        if(this.background)this.background.object3D.visible=pose.backend!=='webxr';
        const camera = this.el.sceneEl?.camera;
        if (camera && pose.backend !== 'webxr') {
          if (!this.camera) {
            this.camera=camera;this.cameraAutoUpdate=camera.matrixAutoUpdate;let shared=cameras.get(camera);
            if(!shared){shared={users:0,autoUpdate:camera.matrixAutoUpdate};cameras.set(camera,shared);}shared.users++;const entry=shared;
            this.releaseCamera=()=>{if(--entry.users===0){camera.matrixAutoUpdate=entry.autoUpdate;cameras.delete(camera);}};
          }
          camera.matrixAutoUpdate = false;
          camera.matrix.fromArray(pose.viewMatrix).invert(); camera.updateMatrixWorld(true);
          if (pose.projectionMatrix) {
            camera.projectionMatrix.fromArray(pose.projectionMatrix);
            camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
          }
        }
      });
      const unsubscribeVisibility=engine.onTargetVisibility?.(event=>{if(event.targetId===(this.data.targetId??'default'))this.el.object3D.visible=event.visible;});
      const unsubscribePose = this.unsubscribe;
      const unsubscribeStatus = engine.onStatus(message => {
        if ((!unsubscribeVisibility&&message==='not-found')||['odometry-lost','tracking-lost','stopped','xr-ended','camera-suspended','starting-webxr','select-surface','scan-marker-in-xr','scan-floor'].includes(message)) this.el.object3D.visible = false;
        if(this.background&&['starting-webxr','select-surface','scan-marker-in-xr','image-aligned-to-world','stopped','xr-ended'].includes(message))this.background.object3D.visible=false;
        if(this.background&&['camera-ready','camera-resumed','target-loaded'].includes(message))this.background.object3D.visible=true;
      });
      this.unsubscribe = () => { unsubscribePose(); unsubscribeStatus();unsubscribeVisibility?.(); };
    },
    update(previous) {
      if (!this.data.target || (previous.target === this.data.target && previous.physicalWidth === this.data.physicalWidth&&previous.targetId===this.data.targetId)) return;
      const id=this.data.targetId??'default',source=this.data.target,width=this.data.physicalWidth;
      configuring=configuring.catch(()=>{}).then(async()=>{
        if(this.removed)return;
        if(/\.dat(?:$|[?#])/i.test(source)){
          if(engine.addTarget)await engine.addTarget(id,source);else await engine.loadTarget(source);
        }else await engine.addImageTarget(id,source,{physicalWidthMeters:width});
      });
      void configuring.catch(error=>{if(!this.removed)this.el.dispatchEvent(new CustomEvent('ar-error',{detail:error}));});
    },
    remove() {
      this.removed = true; this.unsubscribe?.();
      this.el.object3D.matrixAutoUpdate = this.originalAutoUpdate ?? true;
      this.el.object3D.visible = this.originalVisible ?? true;
      this.releaseCamera?.();this.releaseBackground?.();
    },
  });
}
