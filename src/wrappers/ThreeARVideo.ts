/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {Group,Mesh,PlaneGeometry,ShaderMaterial,VideoTexture,NoColorSpace,DoubleSide,Color,type ColorRepresentation} from 'three';
export interface ChromaKeyOptions {color?:ColorRepresentation;similarity?:number;smoothness?:number;spill?:number;}
export interface ARVideoOptions {
  width?:number;orientation?:'flat'|'upright';muted?:boolean;loop?:boolean;
  chromaKey?:ChromaKeyOptions|false;
}
/** MP4 a través del decoder nativo. Reproducción independiente del estado del marcador. */
export class ThreeARVideo extends Group {
  readonly videoElement:HTMLVideoElement;
  readonly mesh:Mesh<PlaneGeometry,ShaderMaterial>;
  private readonly texture:VideoTexture;
  private width:number;
  private url:string|null=null;
  private closed=false;
  private cancelLoad:(()=>void)|null=null;
  private upright:boolean;
  constructor(options:ARVideoOptions={}){
    super();this.width=options.width??.2;this.upright=options.orientation==='upright';
    if(!Number.isFinite(this.width)||this.width<=0)throw new Error('Ancho de vídeo inválido.');
    const video=document.createElement('video');this.videoElement=video;
    video.muted=options.muted??true;video.defaultMuted=video.muted;video.loop=options.loop??true;video.playsInline=true;
    video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');video.crossOrigin='anonymous';video.preload='auto';
    this.texture=new VideoTexture(video);this.texture.colorSpace=NoColorSpace;
    const material=new ShaderMaterial({transparent:true,depthWrite:false,side:DoubleSide,toneMapped:false,
      uniforms:{map:{value:this.texture},videoOpacity:{value:1},keyed:{value:false},keyColor:{value:new Color(0,1,0)},similarity:{value:.12},smoothness:{value:.08},spill:{value:.3}},
      vertexShader:'varying vec2 videoUV; void main(){videoUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`precision highp float;
        uniform sampler2D map;uniform float videoOpacity;uniform bool keyed;uniform vec3 keyColor;uniform float similarity;uniform float smoothness;uniform float spill;varying vec2 videoUV;
        vec2 chroma(vec3 c){float y=dot(c,vec3(.299,.587,.114));return vec2((c.b-y)*.565,(c.r-y)*.713);}
        void main(){vec4 color=texture2D(map,videoUV);float alpha=1.0;
          if(keyed){float distance=length(chroma(color.rgb)-chroma(keyColor));alpha=smoothstep(similarity,similarity+smoothness,distance);
            float luma=dot(color.rgb,vec3(.299,.587,.114));color.rgb=mix(color.rgb,vec3(luma),(1.0-alpha)*spill);}
          alpha*=videoOpacity;if(alpha<.001)discard;gl_FragColor=vec4(color.rgb,alpha*color.a);}`,
    });
    this.mesh=new Mesh(new PlaneGeometry(1,1),material);this.add(this.mesh);
    if(!this.upright){this.mesh.rotation.x=-Math.PI/2;this.mesh.position.y=.001;}
    video.addEventListener('loadedmetadata',this.resize);this.resize();this.setChromaKey(options.chromaKey??false);
  }
  setChromaKey(options:ChromaKeyOptions|false):void{
    if(this.closed)throw new Error('Vídeo eliminado.');
    const uniforms=this.mesh.material.uniforms;uniforms.keyed!.value=options!==false;if(options===false)return;
    const similarity=options.similarity??.12,smoothness=options.smoothness??.08,spill=options.spill??.3;
    if(![similarity,smoothness,spill].every(Number.isFinite)||similarity<0||similarity>1||smoothness<=0||smoothness>1||spill<0||spill>1)throw new Error('Parámetros de chroma inválidos.');
    (uniforms.keyColor!.value as Color).set(options.color??'#00ff00').convertLinearToSRGB();
    uniforms.similarity!.value=similarity;uniforms.smoothness!.value=smoothness;uniforms.spill!.value=spill;
  }
  setWidth(width:number):void{if(!Number.isFinite(width)||width<=0)throw new Error('Ancho inválido.');this.width=width;this.resize();}
  setOrientation(orientation:'flat'|'upright'):void{
    if(!['flat','upright'].includes(orientation))throw new Error('Orientación inválida.');this.upright=orientation==='upright';
    this.mesh.rotation.x=this.upright?0:-Math.PI/2;this.mesh.position.y=this.upright?0:.001;this.resize();
  }
  /** No reproduce ni rebobina automáticamente al recuperar un marcador. */
  async setSource(source:Blob|string|URL):Promise<void>{
    if(this.closed)throw new Error('Vídeo eliminado.');this.cancelLoad?.();this.videoElement.pause();
    if(this.url)URL.revokeObjectURL(this.url);this.url=source instanceof Blob?URL.createObjectURL(source):null;
    const src=this.url??source.toString();
    return new Promise((resolve,reject)=>{
      const video=this.videoElement;
      const cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadedmetadata',loaded);video.removeEventListener('error',error);if(this.cancelLoad===cancel)this.cancelLoad=null;};
      const loaded=()=>{cleanup();this.resize();resolve();};
      const error=()=>{cleanup();reject(new Error(`No se pudo decodificar el vídeo (${video.error?.code??'error'}). Usa MP4 con un codec soportado por el navegador.`));};
      const cancel=()=>{cleanup();reject(new DOMException('Carga de vídeo cancelada.','AbortError'));};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Timeout cargando vídeo.'));},30_000);
      this.cancelLoad=cancel;video.addEventListener('loadedmetadata',loaded,{once:true});video.addEventListener('error',error,{once:true});video.src=src;video.load();
    });
  }
  /** Invocar desde un gesto del usuario; propaga bloqueos de autoplay para mostrar un botón. */
  play():Promise<void>{if(this.closed)return Promise.reject(new Error('Vídeo eliminado.'));return this.videoElement.play();}
  pause():void{this.videoElement.pause();}
  private readonly resize=():void=>{
    const video=this.videoElement,height=this.width*(video.videoHeight&&video.videoWidth?video.videoHeight/video.videoWidth:9/16);
    this.mesh.scale.set(this.width,height,1);if(this.upright)this.mesh.position.y=height/2;
  };
  dispose():void{
    if(this.closed)return;this.closed=true;this.cancelLoad?.();this.videoElement.pause();this.videoElement.removeEventListener('loadedmetadata',this.resize);
    this.videoElement.removeAttribute('src');this.videoElement.load();if(this.url)URL.revokeObjectURL(this.url);this.url=null;
    this.texture.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();this.videoElement.remove();this.removeFromParent();
  }
}
