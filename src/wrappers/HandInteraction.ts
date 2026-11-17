/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {Raycaster,Vector2,type Object3D,type Vector3} from 'three';
import type {ARSceneElement,ARModelElement} from './web-components';
import type {ThreeARScene} from './ThreeARScene';

type Landmark={x:number;y:number;z?:number};
type Detector={detectForVideo(input:HTMLCanvasElement,time:number):{landmarks:Landmark[][]};close():void};
type MediaPipeModule={
  FilesetResolver:{forVisionTasks(path:string):Promise<unknown>};
  HandLandmarker:{createFromOptions(files:unknown,options:{
    baseOptions:{modelAssetPath:string};runningMode:'VIDEO';numHands:number;
  }):Promise<Detector>};
};
export interface ARHandTapDetail {
  readonly element:ARModelElement;
  readonly object:Object3D;
  readonly point:Vector3;
  readonly gesture:'pinch'|'dwell';
}

const packageURL='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const modelURL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

function visible(object:Object3D):boolean{
  for(let item:Object3D|null=object;item;item=item.parent)if(!item.visible)return false;
  return true;
}

/** Registra únicamente el adaptador; MediaPipe se descarga al iniciar una escena con manos. */
export function registerHandInteraction():void{
  if(customElements.get('webar-hands'))return;
  customElements.define('webar-hands',class extends HTMLElement{
    private scene:ARSceneElement|null=null;
    private generation=0;
    private detector:Detector|null=null;
    private unsubscribe:(()=>void)|null=null;
    private cursor:HTMLSpanElement|null=null;
    private ray=new Raycaster();
    private ndc=new Vector2();
    private target:ARModelElement|null=null;
    private since=0;
    private pinched=false;
    private fired=false;

    connectedCallback():void{
      this.hidden=true;
      this.scene=this.closest<ARSceneElement>('webar-scene');
      this.scene?.addEventListener('ar-ready',this.ready);
      this.scene?.addEventListener('ar-stopped',this.end);
      if(this.scene?.app&&(this.scene.engine?.videoElement.readyState??0)>=2)void this.start(this.scene.app);
    }
    disconnectedCallback():void{
      this.scene?.removeEventListener('ar-ready',this.ready);
      this.scene?.removeEventListener('ar-stopped',this.end);
      this.end();this.scene=null;
    }
    private readonly ready=(event:Event):void=>{void this.start((event as CustomEvent<{app:ThreeARScene}>).detail.app);};
    private readonly end=():void=>{
      this.generation++;this.unsubscribe?.();this.unsubscribe=null;
      this.detector?.close();this.detector=null;
      this.cursor?.remove();this.cursor=null;
      this.target=null;this.pinched=false;this.fired=false;
    };
    private url(name:string,fallback:string):string{return new URL(this.getAttribute(name)??fallback,this.baseURI).href;}
    private report(name:string,detail?:unknown):void{
      this.dispatchEvent(new CustomEvent(name,{detail,bubbles:true,composed:true}));
    }

    private async start(app:ThreeARScene):Promise<void>{
      this.end();
      const version=this.generation;
      const current=()=>version===this.generation&&this.scene?.app===app;
      try{
        const gesture=this.getAttribute('gesture')??'pinch';
        if(gesture!=='pinch'&&gesture!=='dwell')throw new Error('webar-hands: gesture debe ser pinch o dwell.');
        const rate=Number(this.getAttribute('fps')??12);
        if(!Number.isFinite(rate)||rate<1||rate>20)throw new Error('webar-hands: fps debe estar entre 1 y 20.');
        const moduleURL=this.url('runtime-src',packageURL+'/vision_bundle.mjs');
        const runtime=await import(/* @vite-ignore */moduleURL) as MediaPipeModule;
        if(!current())return;
        const files=await runtime.FilesetResolver.forVisionTasks(this.url('wasm-path',packageURL+'/wasm'));
        if(!current())return;
        const detector=await runtime.HandLandmarker.createFromOptions(files,{
          baseOptions:{modelAssetPath:this.url('model-src',modelURL)},runningMode:'VIDEO',numHands:1,
        });
        if(!current()){detector.close();return;}
        this.detector=detector;
        const input=document.createElement('canvas');
        const context=input.getContext('2d');
        if(!context)throw new Error('No se pudo crear el búfer para detectar la mano.');
        const canvas=app.renderer.domElement;
        const video=app.engine.videoElement;
        if(this.hasAttribute('cursor')&&canvas.parentElement){
          const pointer=document.createElement('span');
          pointer.hidden=true;pointer.setAttribute('aria-hidden','true');
          pointer.style.cssText='position:absolute;z-index:3;pointer-events:none;width:18px;height:18px;border-radius:50%;border:2px solid #fff;background:#00a8a8aa;box-shadow:0 0 9px #58fff2;transform:translate(-50%,-50%)';
          canvas.parentElement.append(pointer);this.cursor=pointer;
        }
        let next=0,lastVideoTime=-1;
        this.unsubscribe=app.onAfterRender(()=>{
          if(!current()){if(version===this.generation)this.end();return;}
          if(app.renderer.xr.isPresenting||document.hidden||video.readyState<2||!video.videoWidth||!video.videoHeight){
            this.observe(app,undefined,performance.now(),gesture);return;
          }
          const now=performance.now();
          if(now<next||video.currentTime===lastVideoTime)return;
          next=now+1000/rate;lastVideoTime=video.currentTime;
          try{
            const scale=Math.min(1,384/Math.max(video.videoWidth,video.videoHeight));
            const width=Math.max(1,Math.round(video.videoWidth*scale)),height=Math.max(1,Math.round(video.videoHeight*scale));
            if(input.width!==width||input.height!==height){input.width=width;input.height=height;}
            context.drawImage(video,0,0,width,height);
            this.observe(app,detector.detectForVideo(input,now).landmarks[0],now,gesture);
          }catch(error){this.end();this.report('hand-error',error);}
        });
        this.report('hand-ready');
      }catch(error){if(current()){this.end();this.report('hand-error',error);}}
    }
    private observe(app:ThreeARScene,hand:Landmark[]|undefined,now:number,gesture:'pinch'|'dwell'):void{
      const tip=hand?.[8],thumb=hand?.[4],wrist=hand?.[0],middle=hand?.[9];
      if(!tip||!thumb||!wrist||!middle||!Number.isFinite(tip.x+tip.y)||tip.x<0||tip.x>1||tip.y<0||tip.y>1){
        if(this.cursor)this.cursor.hidden=true;
        this.target=null;this.since=now;this.fired=false;
        return;
      }
      const canvas=app.renderer.domElement,rect=canvas.getBoundingClientRect();
      const viewport=canvas.parentElement?.getBoundingClientRect();
      const x=rect.left+tip.x*rect.width,y=rect.top+tip.y*rect.height;
      const onScreen=!!viewport&&rect.width>0&&rect.height>0&&x>=viewport.left&&x<=viewport.right&&y>=viewport.top&&y<=viewport.bottom;
      if(this.cursor&&viewport){
        this.cursor.hidden=!onScreen;
        this.cursor.style.left=x-viewport.left+'px';this.cursor.style.top=y-viewport.top+'px';
      }
      const targets=new Map<Object3D,ARModelElement>();
      if(onScreen)for(const model of this.scene!.querySelectorAll<ARModelElement>('webar-model[hand-target]')){
        if(model.model&&visible(model.model))targets.set(model.model,model);
      }
      this.ndc.set(tip.x*2-1,1-tip.y*2);
      this.ray.setFromCamera(this.ndc,app.camera);
      const hit=this.ray.intersectObjects([...targets.keys()],true).find(item=>visible(item.object));
      let root=hit?.object;
      while(root&&!targets.has(root))root=root.parent??undefined;
      const element=root?targets.get(root)??null:null;
      if(element!==this.target){this.target=element;this.since=now;this.fired=false;}
      const aspect=rect.width/Math.max(1,rect.height);
      const palm=Math.hypot((middle.x-wrist.x)*aspect,middle.y-wrist.y);
      const ratio=palm>.015?Math.hypot((tip.x-thumb.x)*aspect,tip.y-thumb.y)/palm:Infinity;
      const wasPinched=this.pinched;
      this.pinched=ratio<(wasPinched ? .43 : .29);
      const activated=gesture==='pinch'?this.pinched&&!wasPinched:!this.fired&&now-this.since>=650;
      if(hit&&element&&activated){
        this.fired=true;
        const detail:ARHandTapDetail={element,object:hit.object,point:hit.point.clone(),gesture};
        element.dispatchEvent(new CustomEvent('ar-hand-tap',{detail,bubbles:true,composed:true}));
      }
    }
  });
}
