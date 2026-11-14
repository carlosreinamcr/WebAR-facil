/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {RingGeometry,MeshBasicMaterial,Mesh,DoubleSide,GridHelper} from 'three';
import type {ARPose} from '../Pose';

export type PlacementState='idle'|'scanning'|'surface-found'|'placed'|'lost';
/** Guía de presentación; nunca genera una pose ni supone que un hit-test sea suelo semántico. */
export class SurfacePlacement {
  readonly reticle=new Mesh(new RingGeometry(.035,.05,48).rotateX(-Math.PI/2),new MeshBasicMaterial({color:0x38d9ff,transparent:true,opacity:.9,side:DoubleSide,depthWrite:false}));
  private readonly grid=new GridHelper(1,8,0x8bebff,0x38d9ff);
  private readonly showGrid:boolean;
  private gridSized=false;
  private previewUntil=-Infinity;
  private phase:PlacementState='idle';
  private confirmed=false;
  private poseAt=-Infinity;
  private surfaceAt=-Infinity;
  private backend:ARPose['backend']|null=null;
  private readonly manual:boolean;
  private readonly changed:(state:PlacementState)=>void;
  private readonly now:()=>number;
  private readonly onStale:(()=>void)|undefined;
  constructor(manual:boolean,changed:(state:PlacementState)=>void,now:()=>number=()=>performance.now(),onStale?:()=>void,showGrid=true){
    this.manual=manual;this.changed=changed;this.now=now;this.onStale=onStale;this.showGrid=showGrid;
    this.reticle.matrixAutoUpdate=false;this.reticle.visible=false;
    this.grid.material.transparent=true;this.grid.material.opacity=.7;this.grid.material.depthWrite=false;
    this.grid.visible=false;this.reticle.add(this.grid);
  }
  get state():PlacementState{return this.phase;}
  get canConfirm():boolean{return this.manual&&this.backend==='optical-flow'&&this.phase==='surface-found'&&this.now()-this.poseAt<=700;}
  private set(state:PlacementState):void{if(state!==this.phase){this.phase=state;this.changed(state);}}
  begin():void{this.confirmed=false;this.poseAt=-Infinity;this.surfaceAt=-Infinity;this.backend=null;this.gridSized=false;this.previewUntil=-Infinity;this.reticle.visible=false;this.set('scanning');}
  status(message:string):void{
    if(['stopped','xr-ended'].includes(message)){this.begin();this.set('idle');return;}
    if(['odometry-map-reset','starting-webxr','scan-floor','select-surface','scan-marker-in-xr'].includes(message)){this.begin();return;}
    if(['odometry-lost','tracking-lost','camera-suspended'].includes(message)&&
      (this.phase==='surface-found'||this.phase==='placed'||this.phase==='lost')){this.reticle.visible=false;this.previewUntil=-Infinity;this.poseAt=-Infinity;this.set('lost');}
  }
  observeSurface(matrix:Float32Array):void{
    this.backend='webxr';this.surfaceAt=this.now();if(this.confirmed)return;
    this.showProposal(matrix,true,.55);this.set('surface-found');
  }
  observePose(pose:ARPose):void{
    if(pose.backend==='image')return;this.backend=pose.backend;this.poseAt=Number.isFinite(pose.timestampMs)&&pose.timestampMs>=0?Math.min(this.now(),pose.timestampMs):-Infinity;
    if(this.now()-this.poseAt>1000){this.expire();return;}
    const verified=pose.surfaceDetected===true;
    const size=Math.min(12,Math.max(.15,Math.hypot(pose.matrix[12]!,pose.matrix[13]!,pose.matrix[14]!)*.7));
    if(pose.backend==='webxr'||!this.manual||this.confirmed){
      if(pose.backend==='optical-flow'&&!this.confirmed&&verified&&this.showGrid){
        this.previewUntil=this.now()+1500;
        this.showProposal(pose.worldMatrix,true,size,pose.viewMatrix);
      }
      this.confirmed=true;this.reticle.visible=this.now()<this.previewUntil;this.set('placed');return;
    }
    this.showProposal(pose.worldMatrix,verified,size,pose.viewMatrix);this.set('surface-found');
  }
  private showProposal(matrix:Float32Array,verified:boolean,size:number,view?:Float32Array):void{
    this.reticle.matrix.fromArray(matrix);this.reticle.matrixWorldNeedsUpdate=true;this.reticle.visible=true;
    this.grid.visible=this.showGrid&&verified;
    if(this.grid.visible&&!this.gridSized){
      this.gridSized=true;this.grid.scale.setScalar(size);this.grid.rotation.y=0;
      if(view){
        // Proyectar la derecha de la cámara dentro del plano. Solo gira alrededor de su normal.
        const x=view[0]!*matrix[0]!+view[4]!*matrix[1]!+view[8]!*matrix[2]!;
        const z=view[0]!*matrix[8]!+view[4]!*matrix[9]!+view[8]!*matrix[10]!;
        if(Math.hypot(x,z)>.1)this.grid.rotation.y=Math.atan2(-z,x);
      }
    }
  }
  confirm():void{if(!this.canConfirm)throw new Error('Espera una superficie con seguimiento reciente antes de colocar.');this.confirmed=true;this.reticle.visible=false;this.set('placed');}
  tick():void{
    if(this.phase==='placed'&&this.now()>=this.previewUntil)this.reticle.visible=false;
    const fresh=this.backend==='webxr'&&!this.confirmed?this.surfaceAt:this.poseAt;
    if(['placed','surface-found'].includes(this.phase)&&this.now()-fresh>1000)this.expire();
  }
  private expire():void{
    this.reticle.visible=false;this.previewUntil=-Infinity;
    if(this.phase!=='lost')this.onStale?.();
    this.set('lost');
  }
  dispose():void{this.reticle.removeFromParent();this.reticle.geometry.dispose();this.reticle.material.dispose();this.grid.dispose();}
}
