/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {Object3D} from 'three';
import {ThreeARScene} from './ThreeARScene';
import {ThreeARModel,type ARAnimationOptions} from './ThreeARModel';
import {ThreeARVideo} from './ThreeARVideo';
import {GestureController,type GestureContent} from './GestureController';
import {SurfacePlacement,type PlacementState} from './SurfacePlacement';
import {SceneMediaMenu} from './SceneMediaMenu';
import {ARDiagnostics,type DiagnosticReport} from '../diagnostics/ARDiagnostics';
import {cameraProfile} from '../camera/performance';
import {registerHandInteraction} from './HandInteraction';
import {hasEmbeddedAssets} from '../internal/EmbeddedAssets';
import type {WebAREngine,SurfaceTransitionOptions,SurfaceTransitionResult} from '../WebAREngine';

export interface ARComponentsOptions {assetBase?:string|URL;}
export interface ARSceneElement extends HTMLElement {
  readonly app:ThreeARScene|null;
  readonly engine:WebAREngine|null;
  readonly updateComplete:Promise<void>;
  readonly diagnostics:ARDiagnostics|null;
  readonly placementState:PlacementState;
  confirmPlacement():void;
  getDiagnosticsReport():DiagnosticReport|null;
  downloadDiagnostics():void;
  start():Promise<void>;
  stop():Promise<void>;
  refresh():Promise<void>;
  enableSLAM(options?:SurfaceTransitionOptions):Promise<SurfaceTransitionResult>;
}
export interface ARModelElement extends HTMLElement {
  readonly model:ThreeARModel|null;
  readonly updateComplete:Promise<void>;
  reload():Promise<void>;
  playAnimation(nameOrIndex:string|number,options?:ARAnimationOptions):void;
  pauseAnimations():void;
  resumeAnimations():void;
  stopAnimations():void;
}
export interface ARVideoElement extends HTMLElement {
  readonly video:ThreeARVideo|null;
  readonly updateComplete:Promise<void>;
  reload():Promise<void>;
  play():Promise<void>;
  pause():void;
}
function numberAttribute(el:Element,name:string,fallback:number):number {
  const raw=el.getAttribute(name);if(raw===null)return fallback;
  if(!raw.trim()||!Number.isFinite(Number(raw)))throw new Error(`${name}: se esperaba un número finito.`);return Number(raw);
}
function flag(el:Element,name:string,fallback=false):boolean {
  const value=el.getAttribute(name);if(value===null)return fallback;
  if(value===''||value==='true')return true;if(value==='false')return false;throw new Error(`${name}: usar el atributo vacío, true o false.`);
}
function vector(el:Element,name:string,fallback:[number,number,number],scalar=false):[number,number,number] {
  const raw=el.getAttribute(name);if(raw===null)return fallback;const parts=raw.trim().split(/\s+/).map(Number);
  if(scalar&&parts.length===1&&Number.isFinite(parts[0]))return[parts[0]!,parts[0]!,parts[0]!];
  if(parts.length!==3||parts.some(value=>!Number.isFinite(value))||!raw.trim())throw new Error(`${name}: usar tres números separados por espacios.`);
  return[parts[0]!,parts[1]!,parts[2]!];
}
function transform(el:Element,object:Object3D):void{
  const position=vector(el,'position',[0,0,0]),rotation=vector(el,'rotation',[0,0,0]),scale=vector(el,'scale',[1,1,1],true);
  object.position.set(...position);object.scale.set(...scale);object.rotation.set(...rotation.map(value=>value*Math.PI/180) as [number,number,number]);
}
function emit(el:HTMLElement,name:string,detail:unknown):void{el.dispatchEvent(new CustomEvent(name,{detail,bubbles:true,composed:true}));}
function report(el:HTMLElement,error:unknown):void{emit(el,'ar-error',error instanceof Error?error:new Error(String(error)));}
function observePromise(task:Promise<void>):Promise<void>{void task.catch(()=>{});return task;}

/** Opt-in en ESM; standalone registra automáticamente. No toca DOM al importar en Node. */
export function registerARComponents(options:ARComponentsOptions={}):void {
  if(typeof window==='undefined'||!window.customElements)throw new Error('Web Components requiere un navegador.');
  const names=['webar-scene','webar-target','webar-model','webar-video'];
  const existing=names.filter(name=>customElements.get(name));if(existing.length===names.length){registerHandInteraction();return;}
  if(existing.length)throw new Error('Registro parcial: no mezcles versiones del SDK WebAR.');
  const assetBase=new URL(options.assetBase?.toString()??'./',document.baseURI);if(!assetBase.pathname.endsWith('/'))assetBase.pathname+='/';

  class ModelElement extends HTMLElement implements ARModelElement {
    private content:ThreeARModel|null=null;
    private signal:AbortSignal|undefined;
    private sequence=0;
    private ready:Promise<void>=Promise.resolve();
    private finished:(()=>void)|null=null;
    static get observedAttributes():string[]{return['position','rotation','scale','animation','animation-speed','animation-loop','animation-repetitions','animation-fade','animation-paused','src','size'];}
    get model():ThreeARModel|null{return this.content;}
    get updateComplete():Promise<void>{return this.ready;}
    bind(model:ThreeARModel|null,signal?:AbortSignal):void{
      ++this.sequence;this.finished?.();this.finished=null;this.content=model;this.signal=signal;
      if(model){transform(this,model);this.finished=model.onAnimationFinished(name=>emit(this,'animationFinished',{name}));}
    }
    private playback():ARAnimationOptions{
      const loop=this.getAttribute('animation-loop')??'repeat';if(!['repeat','once','pingpong'].includes(loop))throw new Error('animation-loop debe ser repeat, once o pingpong.');
      return{loop:loop as 'repeat'|'once'|'pingpong',speed:numberAttribute(this,'animation-speed',1),crossFadeSeconds:numberAttribute(this,'animation-fade',0),
        ...(this.hasAttribute('animation-repetitions')?{repetitions:numberAttribute(this,'animation-repetitions',1)}:{})};
    }
    applyAnimation(select=true):void{
      if(!this.content?.model)return;const name=this.getAttribute('animation'),playback=this.playback();
      if(name==='none'){this.content.stopAnimations();return;}
      if(select){if(name!==null)this.content.playAnimation(/^\d+$/.test(name)?Number(name):name,playback);else if(this.content.animations.length)this.content.playAnimation(0,playback);}
      else this.content.configureAnimation(playback);
      if(flag(this,'animation-paused'))this.content.pauseAnimations();else this.content.resumeAnimations();
    }
    reload(notify=true):Promise<void>{
      const model=this.content;if(!model)return Promise.reject(new Error('Inicia primero la escena.'));
      const sequence=++this.sequence;
      const task=(async()=>{
        try{
          const src=this.getAttribute('src');if(!src)throw new Error('Falta src en webar-model.');
          await model.load(new URL(src,this.baseURI),{fitSize:numberAttribute(this,'size',.16),autoplay:false,...(this.signal?{signal:this.signal}:{})});
          if(sequence!==this.sequence||model!==this.content)return;
          model.setSize(numberAttribute(this,'size',.16));transform(this,model);this.applyAnimation();
          emit(this,'modelLoaded',{animations:model.animations.map(clip=>clip.name)});
        }catch(error){if(notify&&sequence===this.sequence&&model===this.content&&!this.signal?.aborted)report(this,error);throw error;}
      })();this.ready=observePromise(task);return task;
    }
    attributeChangedCallback(name:string,previous:string|null,value:string|null):void{
      if(previous===value||!this.content)return;
      try{
        if(name==='src'){void this.reload();return;}
        if(name==='size')this.content.setSize(numberAttribute(this,'size',.16));
        else if(name.startsWith('animation'))this.applyAnimation(name==='animation');else transform(this,this.content);
      }catch(error){report(this,error);}
    }
    playAnimation(nameOrIndex:string|number,options:ARAnimationOptions={}):void{if(!this.content)throw new Error('Modelo no cargado.');this.content.playAnimation(nameOrIndex,{...this.playback(),...options});}
    pauseAnimations():void{this.content?.pauseAnimations();}
    resumeAnimations():void{this.content?.resumeAnimations();}
    stopAnimations():void{this.content?.stopAnimations();}
  }
  class VideoElement extends HTMLElement implements ARVideoElement {
    private content:ThreeARVideo|null=null;
    private candidate:ThreeARVideo|null=null;
    private signal:AbortSignal|undefined;
    private replace:((next:ThreeARVideo)=>void)|null=null;
    private ready:Promise<void>=Promise.resolve();
    private sequence=0;
    private readonly abort=():void=>{this.candidate?.dispose();this.candidate=null;};
    static get observedAttributes():string[]{return['src','width','orientation','position','rotation','scale','chroma-key','key-color','similarity','smoothness','spill','muted','loop','autoplay'];}
    get video():ThreeARVideo|null{return this.content;}
    get updateComplete():Promise<void>{return this.ready;}
    create():ThreeARVideo{
      const orientation=this.getAttribute('orientation')??'flat';if(!['flat','upright'].includes(orientation))throw new Error('orientation debe ser flat o upright.');
      const video=new ThreeARVideo({width:numberAttribute(this,'width',.2),orientation:orientation as 'flat'|'upright',muted:flag(this,'muted',true),loop:flag(this,'loop',true)});
      try{this.apply(video);return video;}catch(error){video.dispose();throw error;}
    }
    bind(video:ThreeARVideo|null,signal?:AbortSignal,replace?:((next:ThreeARVideo)=>void)):void{
      ++this.sequence;this.signal?.removeEventListener('abort',this.abort);this.abort();this.content=video;this.signal=signal;this.replace=replace??null;
      signal?.addEventListener('abort',this.abort,{once:true});
    }
    private apply(video:ThreeARVideo):void{
      const orientation=this.getAttribute('orientation')??'flat';if(!['flat','upright'].includes(orientation))throw new Error('orientation debe ser flat o upright.');video.setOrientation(orientation as 'flat'|'upright');
      video.setWidth(numberAttribute(this,'width',.2));video.videoElement.muted=flag(this,'muted',true);video.videoElement.loop=flag(this,'loop',true);
      video.setChromaKey(flag(this,'chroma-key')?{color:this.getAttribute('key-color')??'#00ff00',similarity:numberAttribute(this,'similarity',.12),smoothness:numberAttribute(this,'smoothness',.08),spill:numberAttribute(this,'spill',.3)}:false);
      transform(this,video);
    }
    reload(notify=true):Promise<void>{
      if(!this.content||!this.replace)return Promise.reject(new Error('Inicia primero la escena.'));
      const sequence=++this.sequence;this.abort();
      const task=(async()=>{
        let next:ThreeARVideo|null=null;
        try{
          const src=this.getAttribute('src');if(!src)throw new Error('Falta src en webar-video.');
          next=this.create();this.candidate=next;await next.setSource(new URL(src,this.baseURI));this.signal?.throwIfAborted();
          if(sequence!==this.sequence){next.dispose();return;}
          this.apply(next);this.replace!(next);this.content=next;this.candidate=null;next=null;
          emit(this,'videoLoaded',{width:this.content.videoElement.videoWidth,height:this.content.videoElement.videoHeight});
          if(flag(this,'autoplay',true))await this.tryPlay();
        }catch(error){next?.dispose();if(this.candidate===next)this.candidate=null;
          if(notify&&sequence===this.sequence&&!this.signal?.aborted)report(this,error);throw error;}
      })();this.ready=observePromise(task);return task;
    }
    private async tryPlay():Promise<void>{try{await this.play();}catch(error){emit(this,'videoPlayBlocked',error);}}
    attributeChangedCallback(name:string,previous:string|null,value:string|null):void{
      if(previous===value||!this.content)return;
      try{if(name==='src'){void this.reload();return;}this.apply(this.content);if(name==='autoplay'&&flag(this,'autoplay',true))void this.tryPlay();}
      catch(error){report(this,error);}
    }
    play():Promise<void>{return this.content?.play()??Promise.reject(new Error('Vídeo no cargado.'));}
    pause():void{this.content?.pause();}
  }
  class TargetElement extends HTMLElement {}
  type ContentElement=ModelElement|VideoElement;
  type TargetSource={el:Element;id:string;src:string;width:number};
  class SceneElement extends HTMLElement implements ARSceneElement {
    private current:ThreeARScene|null=null;
    private bindings=new Map<ContentElement,{id:string;object:ThreeARModel|ThreeARVideo}>();
    private targets=new Map<string,string>();
    private pending:Promise<void>|null=null;
    private closing:Promise<void>=Promise.resolve();
    private updates:Promise<void>=Promise.resolve();
    private controller:AbortController|null=null;
    private revision=0;
    private running=false;
    private switching=false;
    private gestures:GestureController|null=null;
    private recorder:ARDiagnostics|null=null;
    private placement:SurfacePlacement|null=null;
    private placementTargetId='default';
    private renderSubscription:(()=>void)|null=null;
    private readonly observer:MutationObserver;
    private readonly view:HTMLElement;
    private readonly statusLabel:HTMLElement;
    private readonly startButton:HTMLButtonElement;
    private readonly stopButton:HTMLButtonElement;
    private readonly slamButton:HTMLButtonElement;
    private readonly playButton:HTMLButtonElement;
    private readonly diagnosticButton:HTMLButtonElement;
    private readonly placeButton:HTMLButtonElement;
    private readonly placementLabel:HTMLElement;
    private readonly scanLabel:HTMLElement;
    private readonly markerGuide:HTMLElement;
    private readonly layout:HTMLElement;
    private readonly controls:HTMLElement;
    private readonly sessionDialog:HTMLDialogElement;
    private readonly sessionButton:HTMLButtonElement;
    private readonly mediaMenu:SceneMediaMenu;
    private fullScreenView=false;
    private qualityDeviceId:string|undefined;
    private changingQuality=false;
    private imageSearching=false;
    private mode:'image'|'slam'='image';
    private backend:'auto'|'webxr'|'optical-flow'='auto';
    constructor(){
      super();const root=this.attachShadow({mode:'open'});
      root.innerHTML=`<style>:host{display:block;height:100dvh;min-height:320px;background:#102231;color:white;font:15px system-ui}.layout{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr)}.view{min-width:0;min-height:0;overflow:hidden;position:relative}.controls{grid-row:1}.view{grid-row:2}.controls{padding:12px 16px;padding-top:max(12px,env(safe-area-inset-top));position:sticky;top:0;z-index:2;background:#102231}button{font:inherit;padding:10px 16px;margin:0 6px 8px 0;border:0;border-radius:6px;cursor:pointer}button:disabled{opacity:.55;cursor:default}p{margin:0;min-height:2.6em;line-height:1.4}[hidden]{display:none!important}
      .marker-guide{position:absolute;inset:0 0 auto;margin-inline:auto;z-index:1;display:grid;place-items:center;pointer-events:none}
      .marker-frame{position:relative;width:min(74%,460px);height:min(62%,340px);color:var(--webar-guide-color,#8bebff);
        background:linear-gradient(currentColor,currentColor) left top/26px 2px,linear-gradient(currentColor,currentColor) left top/2px 26px,
        linear-gradient(currentColor,currentColor) right top/26px 2px,linear-gradient(currentColor,currentColor) right top/2px 26px,
        linear-gradient(currentColor,currentColor) left bottom/26px 2px,linear-gradient(currentColor,currentColor) left bottom/2px 26px,
        linear-gradient(currentColor,currentColor) right bottom/26px 2px,linear-gradient(currentColor,currentColor) right bottom/2px 26px;
        background-repeat:no-repeat;filter:drop-shadow(0 1px 2px #08141c);overflow:hidden}
      .marker-frame::after{content:"";position:absolute;left:8%;right:8%;top:5%;height:2px;
        background:linear-gradient(90deg,transparent,currentColor,transparent);animation:webar-scan 2.4s ease-in-out infinite alternate}
      @keyframes webar-scan{to{top:94%}}@media(prefers-reduced-motion:reduce){.marker-frame::after{animation:none;top:50%}}
      .media-menu{margin:4px 0 8px}.media-menu summary{cursor:pointer;font-weight:600}
      .media-panel{display:grid;gap:7px;padding:10px;background:#102231;color:white;border-radius:8px}
      .media-panel a{color:#b9efff;display:inline-block;padding:8px}.media-file{display:flex;align-items:center;flex-wrap:wrap;gap:3px}
      .media-panel select{font:inherit;max-width:100%}
      .session-dialog{padding:0;border:0;border-radius:14px;color:white;background:#102231;width:min(92vw,420px);max-height:85dvh}
      .session-dialog::backdrop{background:#09141a99}.session-dialog .controls{position:static}
      :host([data-webar-fullscreen]){position:fixed;inset:0;width:100%;height:100dvh;min-height:0;overscroll-behavior:none;z-index:2147483000}
      :host([data-webar-fullscreen]) .layout{display:block;position:relative}
      :host([data-webar-fullscreen]) .view{position:absolute;inset:0;touch-action:none;overscroll-behavior:none}
      :host([data-webar-fullscreen]) .view canvas{position:absolute;top:50%;left:50%;translate:-50% -50%}
      :host([data-webar-fullscreen]) .marker-guide{inset:0;width:100%!important;height:100%!important}
      .session-toggle,.layout>.media-menu{position:absolute;z-index:3;top:max(10px,env(safe-area-inset-top))}
      .session-toggle{left:max(10px,env(safe-area-inset-left));z-index:4}
      .layout>.media-menu{right:max(10px,env(safe-area-inset-right));max-width:min(340px,calc(100% - 110px));margin:0;color:white}
      .layout>.media-menu summary{padding:10px;border-radius:8px;background:#102231}
      .layout>.media-menu .media-panel{max-height:70dvh;overflow:auto;overscroll-behavior:contain}
      </style>
      <div class="layout"><div class="view"><div class="marker-guide" aria-hidden="true" hidden><div class="marker-frame"></div></div></div><div class="controls"><button class="start" type="button">Iniciar AR</button><button class="stop" type="button" disabled>Detener</button><button class="slam" type="button" hidden>Activar SLAM</button><button class="play" type="button" hidden>Reproducir vídeos</button><button class="place" type="button" hidden>Colocar aquí</button><button class="diagnostic" type="button" hidden>Descargar diagnóstico</button><div class="placement" role="status" hidden></div><p role="status">Pulsa Iniciar AR para usar la cámara.</p><div class="scan" role="status" hidden></div></div><button class="session-toggle" type="button" hidden>Sesión</button></div>
      <dialog class="session-dialog" aria-label="Controles de la sesión WebAR"></dialog>`;
      this.layout=root.querySelector<HTMLElement>('.layout')!;this.controls=root.querySelector<HTMLElement>('.controls')!;
      this.sessionDialog=root.querySelector<HTMLDialogElement>('.session-dialog')!;this.sessionButton=root.querySelector<HTMLButtonElement>('.session-toggle')!;
      this.mediaMenu=new SceneMediaMenu(()=>this.applyQuality(),file=>emit(this,'ar-media',{file}));
      this.controls.append(this.mediaMenu.element);
      this.sessionButton.onclick=()=>this.showSession();
      this.sessionDialog.addEventListener('cancel',event=>{event.preventDefault();if(this.running)this.hideSession();});
      this.view=root.querySelector<HTMLElement>('.view')!;this.statusLabel=root.querySelector<HTMLElement>('p')!;this.scanLabel=root.querySelector<HTMLElement>('.scan')!;this.markerGuide=root.querySelector<HTMLElement>('.marker-guide')!;
      this.view.addEventListener('touchmove',event=>{if(this.fullScreenView&&event.cancelable)event.preventDefault();},{passive:false});
      this.startButton=root.querySelector<HTMLButtonElement>('.start')!;this.stopButton=root.querySelector<HTMLButtonElement>('.stop')!;
      this.slamButton=root.querySelector<HTMLButtonElement>('.slam')!;this.playButton=root.querySelector<HTMLButtonElement>('.play')!;
      this.diagnosticButton=root.querySelector<HTMLButtonElement>('.diagnostic')!;this.placeButton=root.querySelector<HTMLButtonElement>('.place')!;this.placementLabel=root.querySelector<HTMLElement>('.placement')!;
      this.diagnosticButton.onclick=()=>{try{this.downloadDiagnostics();}catch(error){this.report(error);}};
      this.placeButton.onclick=()=>{try{this.confirmPlacement();}catch(error){this.report(error);}};
      this.startButton.onclick=()=>{
        if(this.fullScreenView&&typeof this.requestFullscreen==='function'&&!document.fullscreenElement)
          void this.requestFullscreen().catch(()=>{});
        void this.start().catch(()=>{});
      };this.stopButton.onclick=()=>{void this.stop().catch(error=>this.report(error));};this.slamButton.onclick=()=>{void this.enableSLAM().catch(()=>{});};
      this.playButton.onclick=()=>{const clips=[...this.bindings.keys()].filter((el):el is VideoElement=>el instanceof VideoElement);void Promise.all(clips.map(el=>el.play())).then(()=>{this.playButton.hidden=true;},error=>this.report(error));};
      this.addEventListener('videoPlayBlocked',()=>{this.playButton.hidden=false;this.say('Pulsa Reproducir vídeos para autorizar la reproducción.');});
      this.addEventListener('videoLoaded',event=>{if(event.target instanceof VideoElement&&!flag(event.target,'autoplay',true))this.playButton.hidden=false;});
      this.addEventListener('ar-error',event=>{const error=(event as CustomEvent<unknown>).detail;if(error instanceof Error){this.say(error.message);this.recorder?.recordError(error);}});
      this.observer=new MutationObserver(records=>{
        if(!this.running||this.pending)return;
        const contentChange=records.some(record=>record.type==='childList'&&[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&(node.matches('webar-model,webar-video,webar-target')||node.querySelector('webar-model,webar-video,webar-target')))||record.type==='attributes'&&record.target instanceof TargetElement);
        const retry=records.some(record=>record.type==='attributes'&&(record.target instanceof ModelElement||record.target instanceof VideoElement)&&!this.bindings.has(record.target));
        if(contentChange||retry)void this.refresh().catch(()=>{});
      });
    }
    get app():ThreeARScene|null{return this.current;}
    get engine():WebAREngine|null{return this.current?.engine??null;}
    get updateComplete():Promise<void>{return this.updates;}
    get diagnostics():ARDiagnostics|null{return this.recorder;}
    get placementState():PlacementState{return this.placement?.state??'idle';}
    getDiagnosticsReport():DiagnosticReport|null{return this.recorder?.snapshot()??null;}
    downloadDiagnostics():void{if(!this.recorder)throw new Error('Añade diagnostics a la escena e inicia una sesión.');this.recorder.download();}
    confirmPlacement():void{
      if(this.pending||this.switching)throw new Error('Espera a que termine la inicialización.');this.placement?.confirm();
      if(!this.placement)throw new Error('No hay una colocación espacial pendiente.');
      const anchor=this.current?.getAnchor(this.placementTargetId);if(anchor)anchor.visible=true;
    }
    connectedCallback():void{
      this.fullScreenView=flag(this,'fullscreen-view');this.toggleAttribute('data-webar-fullscreen',this.fullScreenView);
      this.mediaMenu.configure(flag(this,'media-menu'),this.getAttribute('performance')??'auto');
      if(this.fullScreenView){this.sessionDialog.append(this.controls);this.showSession();}
      else{this.layout.append(this.controls);this.controls.append(this.mediaMenu.element);}
      addEventListener('pagehide',this.pagehide);this.observer.observe(this,{subtree:true,childList:true,attributes:true,attributeFilter:['src','physical-width','target-id']});
      if(location.protocol==='file:')this.say('Abre esta aplicación mediante HTTP/HTTPS, no con file://. En el proyecto: npm run dev y http://127.0.0.1:5173/examples/declarative.html.');}
    disconnectedCallback():void{
      removeEventListener('pagehide',this.pagehide);this.observer.disconnect();
      this.sessionDialog.close();void this.stop().catch(error=>this.report(error)).finally(()=>{if(!this.isConnected)this.mediaMenu.clearFile();});
    }
    private showSession():void{
      if(!this.fullScreenView||!this.isConnected)return;
      this.controls.append(this.mediaMenu.element);
      if(!this.sessionDialog.open)this.sessionDialog.showModal();
      this.sessionButton.hidden=true;
    }
    private hideSession():void{
      if(!this.fullScreenView)return;
      this.sessionDialog.close();
      this.layout.append(this.mediaMenu.element);
      this.sessionButton.hidden=false;
    }
    private async applyQuality():Promise<void>{
      if(!this.running&&!this.pending)return;
      this.changingQuality=true;this.qualityDeviceId=this.current?.engine.cameraSettings?.deviceId;
      try{await this.stop();if(this.isConnected)await this.start();}
      finally{this.qualityDeviceId=undefined;this.changingQuality=false;}
    }
    private readonly pagehide=():void=>{void this.stop().catch(error=>this.report(error));};
    private say(message:string):void{if(this.statusLabel.textContent!==message)this.statusLabel.textContent=message;}
    private report(error:unknown):void{this.say(error instanceof Error?error.message:String(error));report(this,error);}
    private readTargets(allowEmpty=false):TargetSource[]{
      const sources=[...this.querySelectorAll('webar-target')].filter(el=>el.closest('webar-scene')===this).map((el,index)=>({el,id:el.getAttribute('target-id')??`target-${index}`,src:el.getAttribute('src')??'',width:numberAttribute(el,'physical-width',.2)}));
      if(this.mode==='image'&&!sources.length&&!allowEmpty)throw new Error('Añade al menos un webar-target con src.');
      if(this.mode==='slam'&&sources.length)throw new Error('En mode=slam no se cargan marcadores. Para transición usa mode=image y el atributo slam.');
      if(sources.length>8||new Set(sources.map(item=>item.id)).size!==sources.length)throw new Error('Usa hasta 8 targets con IDs distintos.');
      for(const item of sources)if(!item.src||!/^[a-zA-Z0-9_-]{1,64}$/.test(item.id)||item.width<=0)throw new Error('Target inválido: revisa src, target-id y physical-width.');return sources;
    }
    private content(sources:TargetSource[]):{el:ContentElement;id:string}[]{
      return[...this.querySelectorAll('webar-model,webar-video')].filter((el):el is ContentElement=>(el instanceof ModelElement||el instanceof VideoElement)&&el.closest('webar-scene')===this).map(el=>{
        const owner=sources.find(item=>item.el===el.closest('webar-target'));
        if(this.mode==='image'&&!owner&&sources.length!==1)throw new Error('Coloca cada contenido dentro de su webar-target.');
        if(!el.getAttribute('src'))throw new Error(`Falta src en ${el.localName}.`);
        return{el,id:owner?.id??(this.mode==='slam'?'default':sources[0]!.id)};
      });
    }
    private base():URL{const base=new URL(this.getAttribute('asset-base')??assetBase.href,this.baseURI);if(!base.pathname.endsWith('/'))base.pathname+='/';return base;}
    private async attach(el:ContentElement,id:string,app:ThreeARScene,signal:AbortSignal):Promise<void>{
      if(el instanceof ModelElement){
        const dracoPath=this.getAttribute('draco-path');
        const model=new ThreeARModel(dracoPath!==null||this.hasAttribute('asset-base')||!hasEmbeddedAssets()
          ?{dracoDecoderPath:new URL(dracoPath??'decoders/draco/',this.base())}:{});
        app.addContent(id,model);this.bindings.set(el,{id,object:model});el.bind(model,signal);await el.reload(false);
      }else{
        const video=el.create();app.addContent(id,video);this.bindings.set(el,{id,object:video});
        el.bind(video,signal,next=>{
          if(this.current!==app||signal.aborted){next.dispose();throw new DOMException('Escena retirada.','AbortError');}
          const previous=this.bindings.get(el),currentId=previous?.id??id;app.addContent(currentId,next);this.bindings.set(el,{id:currentId,object:next});
          if(previous){app.removeContent(previous.object);previous.object.dispose();}this.gestures?.reset();
        });await el.reload(false);
      }
    }
    private detachContent(el:ContentElement,app:ThreeARScene):void{
      const binding=this.bindings.get(el);if(!binding)return;el.bind(null);app.removeContent(binding.object);binding.object.dispose();this.bindings.delete(el);this.gestures?.reset();
    }
    private gestureContents():GestureContent[]{
      const contents:GestureContent[]=[];
      for(const[el,binding]of this.bindings){
        if(!flag(el,'gestures',flag(this,'gestures')))continue;
        const minScale=numberAttribute(el,'min-scale',numberAttribute(this,'min-scale',.1)),maxScale=numberAttribute(el,'max-scale',numberAttribute(this,'max-scale',100));
        if(minScale<=0||maxScale<minScale)throw new Error('Límites de escala inválidos.');contents.push({element:el,object:binding.object,minScale,maxScale});
      }return contents;
    }
    private configureGestures(app:ThreeARScene):void{
      this.gestures?.dispose();this.gestures=null;
      // Un solo controlador; la función consulta los elementos vigentes tras una sustitución.
      if(this.gestureContents().length)this.gestures=new GestureController(app.renderer.domElement,app.camera,()=>app.renderer.xr.isPresenting?[]:this.gestureContents(),this.view);
    }
    private targetKey(item:TargetSource):string{return new URL(item.src,this.baseURI).href+'|'+item.width;}
    private async syncTargets(sources:TargetSource[],app:ThreeARScene,signal:AbortSignal):Promise<void>{
      const changed=sources.length!==this.targets.size||sources.some(item=>this.targets.get(item.id)!==this.targetKey(item));
      if(!changed)return;
      if(app.engine.state==='TrackingSurface')throw new Error('Los targets de imagen solo pueden cambiar en modo de tracking de imagen. El contenido 3D/vídeo sí puede cambiar durante SLAM.');
      for(const id of [...this.targets.keys()])if(!sources.some(item=>item.id===id)){await app.engine.removeTarget(id);signal.throwIfAborted();this.targets.delete(id);}
      for(const item of sources){if(this.targets.get(item.id)===this.targetKey(item))continue;const url=new URL(item.src,this.baseURI);
        if(/\.dat$/i.test(url.pathname))await app.engine.addTarget(item.id,url);else await app.engine.addImageTarget(item.id,url,{physicalWidthMeters:item.width});
        signal.throwIfAborted();this.targets.set(item.id,this.targetKey(item));}
    }
    refresh():Promise<void>{
      const app=this.current,signal=this.controller?.signal;if(!app||!this.running||!signal)return Promise.reject(new Error('Inicia primero la escena.'));
      const task=this.updates.catch(()=>{}).then(async()=>{
        signal.throwIfAborted();if(this.current!==app)return;const sources=this.readTargets(true),content=this.content(sources);
        await this.syncTargets(sources,app,signal);
        for(const[el]of this.bindings)if(!content.some(item=>item.el===el))this.detachContent(el,app);
        for(const item of content){const old=this.bindings.get(item.el);
          if(old&&old.id!==item.id){app.removeContent(old.object);app.addContent(item.id,old.object);old.id=item.id;}
          if(!old){try{await this.attach(item.el,item.id,app,signal);}catch(error){this.detachContent(item.el,app);throw error;}}
          signal.throwIfAborted();
        }
        this.configureGestures(app);emit(this,'contentUpdated',null);
      }).catch(error=>{if(this.current===app&&!signal.aborted)this.report(error);throw error;});
      this.updates=observePromise(task);return task;
    }
    start():Promise<void>{
      if(this.pending)return this.pending;if(this.running)return Promise.resolve();const revision=++this.revision,controller=new AbortController();this.controller=controller;
      this.startButton.disabled=true;this.stopButton.disabled=false;this.slamButton.hidden=true;
      const task=this.launch(revision,controller.signal,this.closing);this.pending=task;const clear=()=>{if(this.pending===task)this.pending=null;};task.then(clear,clear);return task;
    }
    private async launch(revision:number,signal:AbortSignal,previousClosing:Promise<void>):Promise<void>{
      let app:ThreeARScene|null=null;const assertCurrent=()=>{signal.throwIfAborted();if(!this.isConnected||revision!==this.revision)throw new DOMException('Escena retirada.','AbortError');};
      try{
        await previousClosing;assertCurrent();this.updates=Promise.resolve();if(location.protocol==='file:')throw new Error('La cámara y los Workers necesitan HTTP/HTTPS. Inicia npm run dev y abre la URL del servidor; no abras el HTML con doble clic.');
        const mode=this.getAttribute('mode')??'image';if(mode!=='image'&&mode!=='slam')throw new Error('mode debe ser image o slam.');this.mode=mode;
        const backend=this.getAttribute('backend')??(mode==='slam'?'optical-flow':'auto');if(!['auto','webxr','optical-flow'].includes(backend))throw new Error('backend debe ser auto, webxr u optical-flow.');this.backend=backend as typeof this.backend;
        const placement=this.getAttribute('placement')??'auto';if(!['auto','manual'].includes(placement))throw new Error('placement debe ser auto o manual.');
        const sources=this.readTargets(),content=this.content(sources);
        const mediaEnabled=flag(this,'media-menu'),selected=mediaEnabled?this.mediaMenu.quality:null;
        const performanceMode=selected??this.getAttribute('performance')??'auto',preset=cameraProfile(performanceMode);
        const deviceId=this.getAttribute('camera-device-id')??this.qualityDeviceId;
        const read=(name:string,value:number)=>selected?value:numberAttribute(this,name,value);
        const facingMode=this.getAttribute('facing-mode')??'environment';
        if(facingMode!=='environment'&&facingMode!=='user')throw new Error('facing-mode debe ser environment o user.');
        const camera={...(deviceId?{deviceId}:{}),facingMode:facingMode as 'environment'|'user',performance:performanceMode as 'auto'|'balanced'|'battery'|'quality',
          maxFrameWidth:read('analysis-width',preset.maxFrameWidth),maxFramePixels:read('analysis-pixels',preset.maxFramePixels),
          fps:read('fps',preset.fps),width:read('camera-width',preset.width),height:read('camera-height',preset.height)};
        const opencvPath=this.getAttribute('opencv-url');
        const visionOptions=opencvPath!==null||this.hasAttribute('asset-base')||!hasEmbeddedAssets()
          ?{opencvURL:new URL(opencvPath??'vision/opencv.js',this.base())}:{};
        const cover=this.fullScreenView||this.getAttribute('fit')==='cover';
        app=new ThreeARScene({container:this.view,fit:cover?'cover':'contain',maxPixelRatio:numberAttribute(this,'pixel-ratio',2),antialias:flag(this,'antialias',true),engineOptions:{...visionOptions,keyframeCorrection:flag(this,'keyframe-correction'),
          imageLossGraceMs:numberAttribute(this,'loss-grace',500),keepContentOnLost:flag(this,'keep-content-on-lost'),camera}});this.current=app;
        if(mediaEnabled)this.mediaMenu.attach(app,this.view,this.fullScreenView);
        this.recorder?.stop();this.recorder=flag(this,'diagnostics')?new ARDiagnostics(app.engine,{configuration:{mode,backend,performance:performanceMode,analysisWidth:camera.maxFrameWidth,maxFramePixels:camera.maxFramePixels,requestedFPS:camera.fps,lossGraceMs:numberAttribute(this,'loss-grace',500),keepContentOnLost:flag(this,'keep-content-on-lost'),manualPlacement:placement==='manual',keyframeCorrection:flag(this,'keyframe-correction'),renderPixelRatio:app.renderer.getPixelRatio(),antialias:app.renderer.getContext().getContextAttributes()?.antialias??false}}):null;
        this.diagnosticButton.hidden=!this.recorder;if(this.recorder)void this.recorder.probeCapabilities();
        this.placement=new SurfacePlacement(placement==='manual',state=>{
          const labels:Record<PlacementState,string>={idle:'',scanning:'Escaneando: desplaza la cámara sobre una zona con textura.','surface-found':'Superficie detectada. Confirma con Colocar aquí; en WebXR selecciona dentro de la sesión.',placed:'Contenido colocado · seguimiento activo.',lost:'Seguimiento perdido. Vuelve a una zona observada.'};
          this.placementLabel.hidden=state==='idle';this.placementLabel.textContent=labels[state];this.placementLabel.dataset.state=state;
          this.recorder?.mark('placement',state);emit(this,'ar-placement',{state});
        },undefined,()=>{
          this.recorder?.mark('placement-stale','pose-expired');emit(this,'ar-placement-stale',{reason:'pose-expired'});
        },flag(this,'surface-grid',true));app.scene.add(this.placement.reticle);if(mode==='slam')this.placement.begin();
        const managedApp=app;
        this.renderSubscription=app.onRender(()=>{
          this.recorder?.recordRenderFrame();
          if(this.recorder){const renderer=managedApp.renderer,info=renderer.info;
            // Contadores del render anterior; no se espera a la GPU ni se consulta su memoria.
            this.recorder.recordRenderer({drawCalls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,drawingBufferWidth:renderer.domElement.width,drawingBufferHeight:renderer.domElement.height,pixelRatio:renderer.getPixelRatio()});}
          this.placement?.tick();
          const hideGuide=!this.imageSearching||managedApp.engine.state!=='TrackingImage'||!flag(this,'scan-guide',true);
          if(!hideGuide){
            const {width,height}=cover?{width:'100%',height:'100%'}:managedApp.renderer.domElement.style;
            if(this.markerGuide.style.width!==width)this.markerGuide.style.width=width;
            if(this.markerGuide.style.height!==height)this.markerGuide.style.height=height;
          }
          if(this.markerGuide.hidden!==hideGuide)this.markerGuide.hidden=hideGuide;
          if(managedApp.engine.state==='TrackingSurface'&&this.placement?.state!=='placed')for(const binding of this.bindings.values())managedApp.getAnchor(binding.id).visible=false;
          this.placeButton.hidden=!this.placement?.canConfirm;this.placeButton.disabled=!!this.pending||this.switching;
        });
        app.engine.onError(error=>{if(this.current!==app)return;void this.stop().then(()=>this.report(error),cause=>this.report(cause));});
        app.engine.onStatus(message=>{if(this.current!==app)return;this.placement?.status(message);
          if(['camera-suspended','starting-webxr','odometry-map-reset'].includes(message))this.scanLabel.hidden=true;
          if(message==='not-found'||message==='camera-resumed')this.imageSearching=true;
          if(['tracked','camera-suspended','starting-webxr','stopped'].includes(message))this.imageSearching=false;
          const labels:Record<string,string>={'camera-requesting':'Solicitando permiso de cámara al navegador…','camera-granted':'Permiso concedido. Preparando vídeo…','camera-playing':'Iniciando reproducción de cámara…','camera-ready':'Cámara lista.','target-loaded':'Apunta al marcador.','tracked':'Seguimiento activo.','not-found':'Busca el marcador con la cámara.',
            'tracking-uncertain':'Recuperando seguimiento…',
            'webxr-failed-using-fallback':'WebXR rechazó la sesión. Iniciando seguimiento por cámara.',
            'alignment-unavailable-scan-floor':'Se perdió la alineación con el marcador. Busca una superficie para volver a colocar.',
            'odometry-relocalized':'Zona reconocida. Seguimiento recuperado.',
            'surface-tracked':'Seguimiento de superficie activo.',
            'target-cache-hit':'Marcador recuperado de la caché local.',
            'scan-floor':'Desplaza la cámara sobre un entorno con textura; no solo la gires.','initializing-environment':'Construyendo mapa: mueve la cámara manteniendo marcador y entorno visibles.',
            'odometry-initializing':'Inicializando mapa: desplaza lentamente la cámara.','odometry-lost':'Seguimiento perdido. Vuelve hacia una zona ya observada.','select-surface':'Apunta a una superficie y selecciónala.',
            'scan-marker-in-xr':'Vuelve a mostrar el marcador dentro de XR.','tracking-lost':'Seguimiento espacial perdido.','camera-suspended':'Cámara suspendida. Vuelve a esta pestaña.'};
          if(labels[message])this.say(labels[message]);emit(this,'ar-status',{message});if(message==='xr-ended'){this.slamButton.disabled=false;this.slamButton.hidden=false;}
        });
        app.engine.on('scanGuidance',event=>{
          if(this.current!==app)return;
          const labels:Record<typeof event.hint,string>={
            'low-texture':'Apunta a una zona bien iluminada con bordes o detalles visibles.',
            'move-sideways':'Desplaza el teléfono lentamente hacia un lado. Mantén la zona visible.',
            'map-initializing':'El mapa se está construyendo. Continúa el desplazamiento lentamente.',
            'plane-unverified':'El mapa ya tiene puntos. Encuadra una superficie con textura en la parte baja del visor.',
            'return-to-map':'Vuelve lentamente hacia una zona que ya escaneaste.',
            'map-matches-insufficient':'Se encontraron pocas coincidencias con el mapa.',
            'map-pose-unverified':'Hay coincidencias, pero aún no se puede confirmar la posición.',
            'map-pose-confirming':'Mantén el teléfono quieto para confirmar la posición.',
            'surface-ready':'',
          };
          this.scanLabel.textContent=labels[event.hint];this.scanLabel.hidden=event.hint==='surface-ready';
          this.recorder?.mark('scan-guidance',event.hint);emit(this,'ar-scan-guidance',event);
        });
        for(const name of ['targetFound','targetLost','targetVisibility','trackingQuality'] as const)app.engine.on(name,event=>emit(this,name,event));
        app.engine.onPose((_matrix,pose)=>{if(pose.backend!=='image')this.placementTargetId=pose.targetId??'default';this.placement?.observePose(pose);emit(this,'ar-pose',pose);});
        app.engine.onSurface(matrix=>this.placement?.observeSurface(matrix));
        // Pedir cámara antes de descargar/decodificar GLB: el permiso y la vista
        // previa no deben quedar esperando a un modelo grande o a una red lenta.
        this.say('Solicitando cámara…');await app.engine.startCamera();assertCurrent();
        this.say('Cámara activa. Cargando contenido…');
        for(const item of content){await this.attach(item.el,item.id,app,signal);assertCurrent();}
        this.imageSearching=mode==='image';
        await this.syncTargets(sources,app,signal);assertCurrent();this.running=true;
        this.configureGestures(app);
        if(mode==='slam'&&this.backend==='optical-flow'){await app.engine.enableSLAM({backend:'optical-flow'});assertCurrent();}
        else this.slamButton.hidden=mode!=='slam'&&!flag(this,'slam');
        if(mediaEnabled)this.mediaMenu.ready();this.hideSession();emit(this,'ar-ready',{app});
      }catch(error){
        if(this.current===app){void this.mediaMenu.detach();this.gestures?.dispose();this.gestures=null;this.renderSubscription?.();this.renderSubscription=null;this.placement?.dispose();this.placement=null;this.placementLabel.hidden=true;this.scanLabel.hidden=true;this.imageSearching=false;this.markerGuide.hidden=true;this.recorder?.recordError(error instanceof Error?error:new Error(String(error)));this.recorder?.stop();this.current=null;this.bindings.forEach((_binding,el)=>el.bind(null));this.bindings.clear();this.targets.clear();}
        await app?.dispose();if(revision===this.revision){this.running=false;this.startButton.disabled=false;this.stopButton.disabled=true;this.slamButton.hidden=true;this.showSession();this.report(error);}throw error;
      }
    }
    stop():Promise<void>{
      ++this.revision;this.controller?.abort();this.controller=null;this.running=false;this.switching=false;this.gestures?.dispose();this.gestures=null;this.renderSubscription?.();this.renderSubscription=null;this.placement?.dispose();this.placement=null;this.placementLabel.hidden=true;this.scanLabel.hidden=true;this.imageSearching=false;this.markerGuide.hidden=true;this.placeButton.hidden=true;this.recorder?.mark('scene-stop');
      const app=this.current,pending=this.pending;this.current=null;this.bindings.forEach((_binding,el)=>el.bind(null));this.bindings.clear();this.targets.clear();
      this.startButton.disabled=true;this.stopButton.disabled=true;this.slamButton.hidden=true;this.playButton.hidden=true;const revision=this.revision;
      const captureClosed=this.mediaMenu.detach(),disposed=app?.dispose();this.recorder?.stop();
      if(!this.changingQuality&&document.fullscreenElement===this)void document.exitFullscreen().catch(()=>{});
      this.showSession();
      this.closing=Promise.all([this.closing,captureClosed,disposed,pending?.catch(()=>{}),this.updates.catch(()=>{})]).then(()=>{if(revision===this.revision){this.startButton.disabled=false;this.say('Sesión detenida.');emit(this,'ar-stopped',null);}});return this.closing;
    }
    enableSLAM(options:SurfaceTransitionOptions={}):Promise<SurfaceTransitionResult>{
      const app=this.current;if(!app||!this.running)return Promise.reject(new Error('Inicia primero la escena.'));if(this.switching)return Promise.reject(new Error('La transición SLAM ya está en curso.'));
      this.switching=true;this.slamButton.disabled=true;this.placement?.begin();const task=app.engine.enableSLAM({backend:this.backend,...options});
      return task.then(result=>{if(this.current===app){this.slamButton.hidden=true;emit(this,'ar-slam',result);}return result;},error=>{if(this.current===app){this.slamButton.disabled=false;this.report(error);}throw error;}).finally(()=>{if(this.current===app)this.switching=false;});
    }
  }
  customElements.define('webar-model',ModelElement);customElements.define('webar-video',VideoElement);customElements.define('webar-target',TargetElement);customElements.define('webar-scene',SceneElement);
  registerHandInteraction();
}
