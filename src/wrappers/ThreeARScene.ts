/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {Scene,PerspectiveCamera,WebGLRenderer,HemisphereLight,DirectionalLight,type Object3D} from 'three';
import {WebAREngine,type EngineOptions} from '../WebAREngine';
import {ThreeARGroup} from './ThreeARGroup';
import {ThreeARModel} from './ThreeARModel';
import {ThreeARVideo} from './ThreeARVideo';
import {ThreeCameraBackground} from './ThreeCameraBackground';
export interface ARSceneOptions {
  container:HTMLElement;
  engineOptions?:EngineOptions;
  maxPixelRatio?:number;
  lighting?:boolean;
  fit?:'contain'|'cover';
  /** MSAA al crear el contexto; cambiar exige recrear la escena. */
  antialias?:boolean;
}
/** Wrapper opcional: script clásico + API propia, sin editor ni framework obligatorio. */
export class ThreeARScene {
  readonly engine:WebAREngine;
  readonly scene=new Scene();
  readonly camera=new PerspectiveCamera(60,1,.01,1000);
  readonly renderer:WebGLRenderer;
  private readonly background:ThreeCameraBackground;
  private readonly options:ARSceneOptions;
  private readonly anchors=new Map<string,ThreeARGroup>();
  private readonly models=new Set<ThreeARModel>();
  private readonly videos=new Set<ThreeARVideo>();
  private readonly afterCallbacks=new Set<()=>void>();
  private readonly callbacks=new Set<(deltaSeconds:number)=>void>();
  private readonly subscriptions:(()=>void)[]=[];
  private previousTime:number|null=null;
  private closed=false;
  private closing:Promise<void>|null=null;
  private readonly observer:ResizeObserver|null;
  constructor(options:ARSceneOptions){
    this.options=options;const ratio=options.maxPixelRatio??2;
    if(!Number.isFinite(ratio)||ratio<=0)throw new Error('maxPixelRatio inválido.');
    this.renderer=new WebGLRenderer({alpha:true,antialias:options.antialias??true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,ratio));
    this.renderer.xr.enabled=true;this.renderer.xr.setReferenceSpaceType('local');this.camera.matrixAutoUpdate=false;
    options.container.append(this.renderer.domElement);this.renderer.domElement.style.display='block';this.renderer.domElement.style.margin='auto';
    const canvasStyle=this.renderer.domElement.style;
    if(options.fit==='cover'){
      Object.assign(canvasStyle,{position:'absolute',top:'50%',left:'50%',translate:'-50% -50%',margin:'0'});
    }else if(getComputedStyle(this.renderer.domElement).position==='static')canvasStyle.position='relative';
    this.engine=new WebAREngine({...options.engineOptions,
      camera:{playbackContainer:options.container,...options.engineOptions?.camera},
      attachXRSession:options.engineOptions?.attachXRSession??(session=>this.renderer.xr.setSession(session)),
      getXRContext:options.engineOptions?.getXRContext??(()=>{const context=this.renderer.getContext();if(!(context instanceof WebGL2RenderingContext))throw new Error('WebXR requiere WebGL2.');return context;}),
    });
    this.background=new ThreeCameraBackground(this.engine.videoElement,this.engine.calibration);this.scene.add(this.background.object3D);
    if(options.lighting!==false){this.scene.add(new HemisphereLight(0xffffff,0x566070,2));const light=new DirectionalLight(0xffffff,3);light.position.set(1,2,1);this.scene.add(light);}
    this.subscriptions.push(this.engine.onPose((_matrix,pose)=>{
      if(pose.backend==='webxr'){this.background.object3D.visible=false;return;}
      this.background.object3D.visible=true;this.camera.matrix.fromArray(pose.viewMatrix).invert();this.camera.updateMatrixWorld(true);
      if(pose.projectionMatrix){this.camera.projectionMatrix.fromArray(pose.projectionMatrix);this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();}
    }),this.engine.onStatus(status=>{
      if(['starting-webxr','stopped','xr-ended'].includes(status))this.background.object3D.visible=false;
      if(['camera-ready','camera-resumed'].includes(status)){this.background.object3D.visible=true;this.resize();}
    }));
    this.engine.videoElement.addEventListener('resize',this.resize);addEventListener('resize',this.resize);
    this.observer=typeof ResizeObserver==='function'?new ResizeObserver(this.resize):null;this.observer?.observe(options.container);
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
    this.resize();this.renderer.setAnimationLoop(this.render);
  }
  getAnchor(targetId='default'):ThreeARGroup{
    let group=this.anchors.get(targetId);if(!group){group=new ThreeARGroup().bind(this.engine,targetId);this.scene.add(group);this.anchors.set(targetId,group);}return group;
  }
  addContent(targetId:string,content:Object3D):void{
    if(this.closed)throw new Error('Escena eliminada.');this.getAnchor(targetId).add(content);
    content.traverse(object=>{if(object instanceof ThreeARModel)this.models.add(object);if(object instanceof ThreeARVideo)this.videos.add(object);});
  }
  removeContent(content:Object3D):void{content.removeFromParent();content.traverse(object=>{if(object instanceof ThreeARModel)this.models.delete(object);if(object instanceof ThreeARVideo)this.videos.delete(object);});}
  onRender(callback:(deltaSeconds:number)=>void):()=>void{this.callbacks.add(callback);return()=>{this.callbacks.delete(callback);};}
  onAfterRender(callback:()=>void):()=>void{this.afterCallbacks.add(callback);return()=>{this.afterCallbacks.delete(callback);};}
  private readonly render=(time:number):void=>{
    if(this.closed)return;const delta=this.previousTime===null?0:Math.min(.1,Math.max(0,(time-this.previousTime)/1000));this.previousTime=time;
    this.models.forEach(model=>model.update(delta));this.callbacks.forEach(callback=>{try{callback(delta);}catch(error){console.error(error);}});
    this.renderer.render(this.scene,this.camera);
    this.afterCallbacks.forEach(callback=>{try{callback();}catch(error){console.error(error);}});
  };
  private readonly resize=():void=>{
    if(this.closed||this.renderer.xr.isPresenting)return;const video=this.engine.videoElement;
    const aspect=video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:4/3;
    const fit=this.options.fit==='cover'?Math.max:Math.min;
    const width=Math.max(1,fit(this.options.container.clientWidth||innerWidth,(this.options.container.clientHeight||innerHeight)*aspect));
    this.renderer.setSize(width,width/aspect);
  };
  private readonly contextLost=(event:Event):void=>{event.preventDefault();this.renderer.setAnimationLoop(null);void this.engine.stop();};
  private readonly contextRestored=():void=>{if(!this.closed){this.previousTime=null;this.resize();this.renderer.setAnimationLoop(this.render);}};
  dispose():Promise<void>{
    if(this.closing)return this.closing;this.closed=true;this.renderer.setAnimationLoop(null);
    this.closing=(async()=>{await this.engine.stop();this.engine.dispose();this.subscriptions.forEach(unsubscribe=>unsubscribe());this.callbacks.clear();this.afterCallbacks.clear();
      this.anchors.forEach(group=>group.dispose());this.anchors.clear();this.models.forEach(model=>model.dispose());this.videos.forEach(video=>video.dispose());this.models.clear();this.videos.clear();
      this.background.dispose();this.observer?.disconnect();removeEventListener('resize',this.resize);this.engine.videoElement.removeEventListener('resize',this.resize);
      this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);
      this.renderer.dispose();this.renderer.domElement.remove();})();return this.closing;
  }
}
