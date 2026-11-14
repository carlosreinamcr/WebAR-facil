/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {Object3D} from 'three';
import {ThreeARModel,type ARModelOptions} from './ThreeARModel';
interface Instance {
  data:{src:string;fitSize:number;autoplay:boolean};
  el:HTMLElement&{object3D:Object3D};
  model?:ThreeARModel;
  generation?:number;
}
interface Registry {
  registerComponent(name:string,definition:{
    schema:{src:{type:'string';default:string};fitSize:{type:'number';default:number};autoplay:{type:'boolean';default:boolean}};
    init(this:Instance):void;update(this:Instance,previous:Partial<Instance['data']>):void;
    tick(this:Instance,time:number,delta:number):void;remove(this:Instance):void;
  }):unknown;
}
/** Usar en un hijo de la entidad my-ar-tracker; mantiene separada la pose del contenido. */
export function registerAFrameModelComponent(AFRAME:Registry,options:ARModelOptions={}):void{
  AFRAME.registerComponent('my-ar-model',{
    schema:{src:{type:'string',default:''},fitSize:{type:'number',default:.16},autoplay:{type:'boolean',default:true}},
    init(){this.model=new ThreeARModel(options);this.el.object3D.add(this.model);this.generation=0;},
    update(previous){
      if(previous.src===this.data.src&&previous.fitSize===this.data.fitSize&&previous.autoplay===this.data.autoplay)return;
      const generation=(this.generation??0)+1;this.generation=generation;const model=this.model;
      if(!model)return;if(!this.data.src){model.unload();return;}
      void model.load(this.data.src,{fitSize:this.data.fitSize,autoplay:this.data.autoplay}).then(()=>{
        if(this.generation===generation)this.el.dispatchEvent(new CustomEvent('ar-model-loaded',{detail:{animations:model.animations.map(clip=>clip.name)}}));
      },error=>{if(this.generation===generation)this.el.dispatchEvent(new CustomEvent('ar-model-error',{detail:error}));});
    },
    tick(_time,delta){this.model?.update(delta/1000);},
    remove(){this.generation=(this.generation??0)+1;this.model?.dispose();delete this.model;},
  });
}
