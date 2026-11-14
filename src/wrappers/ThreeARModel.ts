/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {AnimationMixer,Box3,Group,LoadingManager,Vector3,Texture,LoopOnce,LoopRepeat,LoopPingPong,type AnimationAction,type AnimationClip,type Material,type Mesh,type Object3D} from 'three';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {embeddedDracoURL,hasEmbeddedAssets} from '../internal/EmbeddedAssets';

export interface ARModelOptions {
  /** Carpeta local con draco_wasm_wrapper.js, draco_decoder.wasm y draco_decoder.js. */
  dracoDecoderPath?:string|URL;
  maxBytes?:number;
}
export interface ARModelLoadOptions {
  /** Ajustar dimensión máxima, centrar X/Z y apoyar base en Y=0. false conserva unidades originales. */
  fitSize?:number|false;
  autoplay?:boolean;
  signal?:AbortSignal;
}
export interface ARAnimationOptions {
  loop?:'repeat'|'once'|'pingpong';
  repetitions?:number;
  speed?:number;
  crossFadeSeconds?:number;
  clampWhenFinished?:boolean;
}

function release(gltf:GLTF):void {
  const geometries=new Set<Mesh['geometry']>(),materials=new Set<Material>(),textures=new Set<Texture>(),images=new Set<ImageBitmap>();
  for(const scene of gltf.scenes)scene.traverse(object=>{
    const mesh=object as Mesh;if(mesh.geometry)geometries.add(mesh.geometry);
    if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      materials.add(material);
      for(const value of Object.values(material))if(value instanceof Texture)textures.add(value);
    }
    const skeleton=(object as Object3D&{skeleton?:{boneTexture?:Texture}}).skeleton;
    if(skeleton?.boneTexture)textures.add(skeleton.boneTexture);
  });
  textures.forEach(texture=>{const image=texture.source?.data as unknown;
    if(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap)images.add(image);texture.dispose();});
  images.forEach(image=>image.close());materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
}

/** GLB autocontenido, sin CDN. Añadirlo a ThreeARGroup o a una entidad A-Frame. */
export class ThreeARModel extends Group {
  private readonly loader=new GLTFLoader();
  private readonly draco:DRACOLoader;
  private readonly limit:number;
  private gltf:GLTF|null=null;
  private mixer:AnimationMixer|null=null;
  private pending:AbortController|null=null;
  private closed=false;
  private readonly fitted=new Group();
  private bounds:{maximum:number;center:Vector3;minY:number}|null=null;
  private action:AnimationAction|null=null;
  private fades:{action:AnimationAction;remaining:number}[]=[];
  private readonly finishedListeners=new Set<(name:string)=>void>();
  private readonly finished=(event:{action:AnimationAction}):void=>{
    if(event.action!==this.action)return;
    this.finishedListeners.forEach(listener=>{try{listener(event.action.getClip().name);}catch(error){console.error(error);}});
  };

  constructor(options:ARModelOptions={}){
    super();this.limit=options.maxBytes??64*1024*1024;
    if(!Number.isSafeInteger(this.limit)||this.limit<20)throw new Error('Límite de GLB inválido.');
    if(options.dracoDecoderPath===undefined&&hasEmbeddedAssets()){
      this.draco=new DRACOLoader(new LoadingManager().setURLModifier(embeddedDracoURL));
    }else{
      const path=options.dracoDecoderPath?.toString()??new URL('./decoders/draco/',document.baseURI).href;
      this.draco=new DRACOLoader().setDecoderPath(path.endsWith('/')?path:path+'/');
    }
    this.draco.setWorkerLimit(1);
    this.loader.setDRACOLoader(this.draco).setMeshoptDecoder(MeshoptDecoder);this.add(this.fitted);
  }
  get model():Group|null{return this.gltf?.scene??null;}

  /** Una carga nueva cancela la anterior. El modelo previo se mantiene si la nueva falla. */
  async load(source:Blob|string|URL,options:ARModelLoadOptions={}):Promise<this>{
    if(this.closed)throw new Error('ThreeARModel eliminado.');
    const size=options.fitSize??.16;
    if(size!==false&&(!Number.isFinite(size)||size<=0))throw new Error('fitSize debe ser positivo o false.');
    this.pending?.abort();const controller=new AbortController();this.pending=controller;
    const signal=controller.signal,abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted)controller.abort();
    let next:GLTF|null=null;
    try{
      signal.throwIfAborted();let data:ArrayBuffer;
      if(source instanceof Blob){if(source.size>this.limit)throw new Error('GLB demasiado grande.');data=await source.arrayBuffer();}
      else{
        const response=await fetch(source,{signal});if(!response.ok)throw new Error(`GLB: HTTP ${response.status}.`);
        if(Number(response.headers.get('content-length'))>this.limit)throw new Error('GLB demasiado grande.');
        const reader=response.body?.getReader();
        if(reader){const chunks:Uint8Array[]=[];let length=0;
          try{for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;
            if(length>this.limit)throw new Error('GLB demasiado grande.');chunks.push(value);}}
          catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
          const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}data=bytes.buffer;
        }else data=await response.arrayBuffer();
      }
      signal.throwIfAborted();this.validate(data);
      // parseAsync no es cancelable: rechazar pronto y liberar cualquier resultado tardío.
      next=await new Promise<GLTF>((resolve,reject)=>{
        const cancel=()=>reject(new DOMException('Carga GLB cancelada.','AbortError'));
        signal.addEventListener('abort',cancel,{once:true});
        void this.loader.parseAsync(data,'').then(result=>{signal.removeEventListener('abort',cancel);
          if(signal.aborted){release(result);cancel();}else resolve(result);
        },error=>{signal.removeEventListener('abort',cancel);reject(error);});
      });
      signal.throwIfAborted();
      const bounds=new Box3().setFromObject(next.scene,true),extent=bounds.getSize(new Vector3()),center=bounds.getCenter(new Vector3());
      if(bounds.isEmpty()||!Number.isFinite(extent.length())||Math.max(extent.x,extent.y,extent.z)<=0)throw new Error('GLB sin geometría visible.');
      this.clearModel();this.gltf=next;next=null;this.animations=[...this.gltf.animations];this.fitted.add(this.gltf.scene);
      this.bounds={maximum:Math.max(extent.x,extent.y,extent.z),center,minY:bounds.min.y};this.setSize(size);
      this.mixer=new AnimationMixer(this.gltf.scene);this.mixer.addEventListener('finished',this.finished);
      if(options.autoplay!==false&&this.animations.length)this.playAnimation(0);
      return this;
    }finally{if(next)release(next);options.signal?.removeEventListener('abort',abort);if(this.pending===controller)this.pending=null;}
  }
  /** Llamar con delta en segundos desde el bucle del renderer. */
  update(deltaSeconds:number):void{
    if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)return;const delta=Math.min(deltaSeconds,.1);this.mixer?.update(delta);
    if(!this.action?.paused)this.fades=this.fades.filter(fade=>{fade.remaining-=delta;if(fade.remaining<=0){fade.action.stop();return false;}return true;});
  }
  setSize(size:number|false):void{
    if(size!==false&&(!Number.isFinite(size)||size<=0))throw new Error('size debe ser positivo o false.');
    if(!this.bounds)return;const scale=size===false?1:size/this.bounds.maximum;
    this.fitted.scale.setScalar(scale);this.fitted.position.set(size===false?0:-this.bounds.center.x*scale,size===false?0:-this.bounds.minY*scale,size===false?0:-this.bounds.center.z*scale);
  }
  playAnimation(nameOrIndex:string|number=0,options:ARAnimationOptions={}):void{
    const clip=typeof nameOrIndex==='number'?this.animations[nameOrIndex]:this.animations.find(clip=>clip.name===nameOrIndex);
    if(!clip||!this.mixer)throw new Error('Animación no encontrada.');this.validateAnimation(options);
    const next=this.mixer.clipAction(clip),previous=this.action,fade=options.crossFadeSeconds??0;
    if(!previous||previous===next||fade===0){this.mixer.stopAllAction();this.fades=[];}
    else{this.fades.forEach(item=>{if(item.action===next)item.action.stop();});this.fades=this.fades.filter(item=>item.action!==next);}
    this.mixer.timeScale=1;next.reset().setEffectiveWeight(1).play();this.action=next;this.configureAnimation({loop:'repeat',speed:1,...options});
    if(previous&&previous!==next&&fade>0){previous.crossFadeTo(next,fade,false);this.fades.push({action:previous,remaining:fade});}
  }
  private validateAnimation(options:ARAnimationOptions):void{
    if(options.loop!==undefined&&!['repeat','once','pingpong'].includes(options.loop))throw new Error('Bucle de animación inválido.');
    if(options.speed!==undefined&&(!Number.isFinite(options.speed)||options.speed<=0))throw new Error('Velocidad de animación debe ser positiva.');
    if(options.repetitions!==undefined&&(!Number.isInteger(options.repetitions)||options.repetitions<1))throw new Error('repetitions debe ser entero positivo.');
    if(options.crossFadeSeconds!==undefined&&(!Number.isFinite(options.crossFadeSeconds)||options.crossFadeSeconds<0||options.crossFadeSeconds>10))throw new Error('crossFadeSeconds debe estar entre 0 y 10.');
  }
  configureAnimation(options:ARAnimationOptions):void{
    this.validateAnimation(options);if(!this.action)return;
    if(options.speed!==undefined)this.action.setEffectiveTimeScale(options.speed);
    if(options.loop!==undefined){this.action.setLoop(options.loop==='once'?LoopOnce:options.loop==='pingpong'?LoopPingPong:LoopRepeat,options.loop==='once'?1:options.repetitions??Infinity);this.action.clampWhenFinished=options.clampWhenFinished??options.loop==='once';}
    else if(options.repetitions!==undefined)this.action.setLoop(this.action.loop,options.repetitions);
    if(options.clampWhenFinished!==undefined)this.action.clampWhenFinished=options.clampWhenFinished;
  }
  pauseAnimations():void{if(this.action)this.action.paused=true;if(this.mixer)this.mixer.timeScale=0;this.fades.forEach(item=>{item.action.paused=true;});}
  resumeAnimations():void{if(this.action)this.action.paused=false;if(this.mixer)this.mixer.timeScale=1;this.fades.forEach(item=>{item.action.paused=false;});}
  get animationState():{name:string;time:number;paused:boolean;speed:number;running:boolean}|null{
    return this.action?{name:this.action.getClip().name,time:this.action.time,paused:this.action.paused,speed:this.action.timeScale,running:this.action.isRunning()}:null;
  }
  onAnimationFinished(listener:(name:string)=>void):()=>void{this.finishedListeners.add(listener);return()=>{this.finishedListeners.delete(listener);};}
  stopAnimations():void{this.mixer?.stopAllAction();this.action=null;this.fades=[];}
  unload():void{this.pending?.abort();this.pending=null;this.clearModel();}
  private clearModel():void{
    if(this.gltf){this.mixer?.removeEventListener('finished',this.finished);this.mixer?.stopAllAction();this.mixer?.uncacheRoot(this.gltf.scene);release(this.gltf);}
    this.mixer=null;this.gltf=null;this.animations=[];this.action=null;this.fades=[];this.bounds=null;this.fitted.clear();
  }
  dispose():void{if(this.closed)return;this.closed=true;this.pending?.abort();this.pending=null;this.clearModel();this.finishedListeners.clear();this.draco.dispose();this.removeFromParent();}
  private validate(data:ArrayBuffer):void{
    if(data.byteLength<20||data.byteLength>this.limit)throw new Error('GLB vacío o demasiado grande.');
    const view=new DataView(data);
    if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw new Error('Se requiere GLB binario versión 2.');
    const length=view.getUint32(12,true);if(length>data.byteLength-20)throw new Error('Cabecera GLB truncada.');
    const json=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length))) as {buffers?:{uri?:string}[];images?:{uri?:string}[];extensionsRequired?:string[]};
    if([...json.buffers??[],...json.images??[]].some(resource=>resource.uri&&!resource.uri.startsWith('data:')))throw new Error('Usa un GLB autocontenido, con texturas y buffers embebidos.');
    if(json.extensionsRequired?.includes('KHR_texture_basisu'))throw new Error('Texturas KTX2 requieren un cargador adicional; exportar PNG/JPEG para este wrapper.');
  }
}
