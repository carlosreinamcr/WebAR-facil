/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {Raycaster,Vector2,type Object3D,type Camera} from 'three';

export interface GestureContent {element:HTMLElement;object:Object3D;minScale:number;maxScale:number;}
/** Gestos opt-in sobre contenido visible: arrastrar gira, pellizcar escala y tocar selecciona. */
export class GestureController {
  private readonly ray=new Raycaster();
  private readonly pointers=new Map<number,{x:number;y:number}>();
  private selected:GestureContent|null=null;
  private moved=false;
  private started=0;
  private origin={x:0,y:0};
  private originalTouchAction:string;
  constructor(private readonly canvas:HTMLElement,private readonly camera:Camera,private readonly contents:()=>GestureContent[],private readonly surface:HTMLElement=canvas){
    this.originalTouchAction=surface.style.touchAction;surface.style.touchAction='none';
    surface.addEventListener('pointerdown',this.down,{passive:false});
    // Safari puede iniciar zoom/scroll con eventos táctiles incluso entre canvas y borde.
    for(const name of ['touchstart','touchmove','gesturestart','gesturechange'])surface.addEventListener(name,this.preventBrowserGesture,{passive:false});
    surface.addEventListener('pointermove',this.move,{passive:false});
    surface.addEventListener('pointerup',this.up);surface.addEventListener('pointercancel',this.cancel);surface.addEventListener('lostpointercapture',this.cancel);
  }
  private readonly preventBrowserGesture=(event:Event):void=>{if(event.cancelable)event.preventDefault();};
  private valid():boolean{return !!this.selected&&this.contents().some(item=>item.object===this.selected!.object&&item.element===this.selected!.element);}
  private readonly down=(event:PointerEvent):void=>{
    if(event.button!==0)return;
    if(!this.selected){
      const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
      this.camera.updateMatrixWorld(true);this.ray.setFromCamera(new Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),this.camera);
      const candidates=this.contents().filter(item=>{let object:Object3D|null=item.object;while(object){if(!object.visible)return false;object=object.parent;}item.object.updateWorldMatrix(true,true);return true;});
      const hit=this.ray.intersectObjects(candidates.map(item=>item.object),true)[0];if(!hit)return;
      this.selected=candidates.find(item=>{let object:Object3D|null=hit.object;while(object){if(object===item.object)return true;object=object.parent;}return false;})??null;
      if(!this.selected)return;this.origin={x:event.clientX,y:event.clientY};this.started=performance.now();this.moved=false;
    }
    this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(this.pointers.size>1)this.moved=true;
    try{this.surface.setPointerCapture(event.pointerId);}catch{/* Eventos sintéticos pueden no tener captura nativa. */}
    event.preventDefault();
  };
  private readonly move=(event:PointerEvent):void=>{
    const old=this.pointers.get(event.pointerId);if(!old)return;
    if(!this.valid()){this.reset();return;}
    const before=[...this.pointers.values()];this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const content=this.selected!,object=content.object;
    if(Math.hypot(event.clientX-this.origin.x,event.clientY-this.origin.y)>6)this.moved=true;
    if(this.pointers.size===1)object.rotation.y+=(event.clientX-old.x)/Math.max(1,this.canvas.clientWidth)*Math.PI*2;
    else{
      const after=[...this.pointers.values()];
      const distance=(points:{x:number;y:number}[])=>Math.hypot(points[1]!.x-points[0]!.x,points[1]!.y-points[0]!.y);
      const initial=distance(before),current=distance(after),maximum=Math.max(...object.scale.toArray().map(Math.abs));
      if(initial>1&&maximum>0){const next=Math.max(content.minScale,Math.min(content.maxScale,maximum*current/initial));object.scale.multiplyScalar(next/maximum);}
      const angle=(points:{x:number;y:number}[])=>Math.atan2(points[1]!.y-points[0]!.y,points[1]!.x-points[0]!.x);
      const delta=angle(after)-angle(before);object.rotation.y+=Math.atan2(Math.sin(delta),Math.cos(delta));
    }
    // Mantener el HTML como estado: los cambios programáticos posteriores no deshacen el gesto.
    const scale=object.scale.toArray(),rotation=[object.rotation.x,object.rotation.y,object.rotation.z].map(value=>value*180/Math.PI);
    content.element.setAttribute('scale',scale.join(' '));content.element.setAttribute('rotation',rotation.join(' '));
    content.element.dispatchEvent(new CustomEvent('ar-gesture',{detail:{scale,rotation},bubbles:true,composed:true}));
    event.preventDefault();
  };
  private readonly up=(event:PointerEvent):void=>{
    if(!this.pointers.has(event.pointerId))return;
    const selected=this.selected,select=this.valid()&&!this.moved&&performance.now()-this.started<500;
    this.pointers.delete(event.pointerId);
    if(!this.pointers.size){this.selected=null;if(select&&selected)selected.element.dispatchEvent(new CustomEvent('ar-select',{detail:{element:selected.element,object:selected.object},bubbles:true,composed:true}));}
  };
  private readonly cancel=(event:PointerEvent):void=>{this.pointers.delete(event.pointerId);this.moved=true;if(!this.pointers.size)this.selected=null;};
  reset():void{for(const id of this.pointers.keys())try{this.surface.releasePointerCapture(id);}catch{}this.pointers.clear();this.selected=null;}
  dispose():void{this.reset();for(const name of ['touchstart','touchmove','gesturestart','gesturechange'])this.surface.removeEventListener(name,this.preventBrowserGesture);this.surface.style.touchAction=this.originalTouchAction;this.surface.removeEventListener('pointerdown',this.down);this.surface.removeEventListener('pointermove',this.move);this.surface.removeEventListener('pointerup',this.up);this.surface.removeEventListener('pointercancel',this.cancel);this.surface.removeEventListener('lostpointercapture',this.cancel);}
}
