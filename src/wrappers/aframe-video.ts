/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {Object3D} from 'three';
import {ThreeARVideo} from './ThreeARVideo';
interface Instance {
  data:{src:string;width:number;chromaKey:boolean;keyColor:string;similarity:number;smoothness:number;spill:number;muted:boolean;loop:boolean};
  el:HTMLElement&{object3D:Object3D};video?:ThreeARVideo;generation?:number;
}
interface Registry {registerComponent(name:string,definition:{schema:Record<string,{type:string;default:string|number|boolean}>;
  init(this:Instance):void;update(this:Instance,previous:Partial<Instance['data']>):void;remove(this:Instance):void;}):unknown;}
export function registerAFrameVideoComponent(AFRAME:Registry):void{
  AFRAME.registerComponent('my-ar-video',{
    schema:{src:{type:'string',default:''},width:{type:'number',default:.2},chromaKey:{type:'boolean',default:false},keyColor:{type:'color',default:'#00ff00'},
      similarity:{type:'number',default:.12},smoothness:{type:'number',default:.08},spill:{type:'number',default:.3},muted:{type:'boolean',default:true},loop:{type:'boolean',default:true}},
    init(){this.video=new ThreeARVideo();this.el.object3D.add(this.video);this.generation=0;},
    update(previous){
      const video=this.video;if(!video)return;video.setWidth(this.data.width);video.videoElement.muted=this.data.muted;video.videoElement.loop=this.data.loop;
      video.setChromaKey(this.data.chromaKey?{color:this.data.keyColor,similarity:this.data.similarity,smoothness:this.data.smoothness,spill:this.data.spill}:false);
      if(previous.src===this.data.src)return;const generation=(this.generation??0)+1;this.generation=generation;
      video.pause();if(!this.data.src)return;
      void video.setSource(this.data.src).then(()=>{if(this.generation!==generation)return;
        this.el.dispatchEvent(new CustomEvent('ar-video-loaded'));return video.play().catch(error=>{
          this.el.dispatchEvent(new CustomEvent('ar-video-playblocked',{detail:error}));
        });
      },error=>{if(this.generation===generation)this.el.dispatchEvent(new CustomEvent('ar-video-error',{detail:error}));});
    },
    remove(){this.generation=(this.generation??0)+1;this.video?.dispose();delete this.video;},
  });
}
