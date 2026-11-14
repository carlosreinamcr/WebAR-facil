/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {Mesh,PlaneGeometry,ShaderMaterial,VideoTexture,Vector2,Vector3,Vector4,NoColorSpace} from 'three';
import type {CameraIntrinsics} from '../Pose';
import {scaleIntrinsics} from '../vision/calibration';

/** Fondo de cámara rectificado en GPU: la proyección K debe coincidir con la escena 3D. */
export class ThreeCameraBackground {
  readonly object3D:Mesh;
  private readonly texture:VideoTexture;
  private readonly material:ShaderMaterial;
  private readonly video:HTMLVideoElement;
  private calibration:CameraIntrinsics|undefined;
  constructor(video:HTMLVideoElement,calibration?:CameraIntrinsics) {
    this.video=video;this.calibration=calibration;
    this.texture=new VideoTexture(video);this.texture.colorSpace=NoColorSpace;
    this.material=new ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{video:{value:this.texture},size:{value:new Vector2(1,1)},intrinsics:{value:new Vector4(1,1,0,0)},
        radial:{value:new Vector3()},rational:{value:new Vector3()},tangent:{value:new Vector2()},rectify:{value:false}},
      vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,0.9999,1.0);}',
      fragmentShader:`precision highp float;
        uniform sampler2D video;uniform vec2 size;uniform vec4 intrinsics;
        uniform vec3 radial;uniform vec3 rational;uniform vec2 tangent;uniform bool rectify;varying vec2 screenUV;
        void main(){vec2 sampleUV=screenUV;
          if(rectify){vec2 pixel=vec2(screenUV.x,1.0-screenUV.y)*size;
            vec2 p=(pixel-intrinsics.zw)/intrinsics.xy;float r2=dot(p,p);float r4=r2*r2;float r6=r4*r2;
            float factor=(1.0+radial.x*r2+radial.y*r4+radial.z*r6)/(1.0+rational.x*r2+rational.y*r4+rational.z*r6);
            vec2 offset=vec2(2.0*tangent.x*p.x*p.y+tangent.y*(r2+2.0*p.x*p.x),tangent.x*(r2+2.0*p.y*p.y)+2.0*tangent.y*p.x*p.y);
            vec2 distorted=(intrinsics.xy*(p*factor+offset)+intrinsics.zw)/size;sampleUV=vec2(distorted.x,1.0-distorted.y);
          }
          if(any(lessThan(sampleUV,vec2(0.0)))||any(greaterThan(sampleUV,vec2(1.0)))){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}
          else{gl_FragColor=texture2D(video,sampleUV);}
        }`,
    });
    this.object3D=new Mesh(new PlaneGeometry(2,2),this.material);this.object3D.frustumCulled=false;this.object3D.renderOrder=-10000;
    video.addEventListener('resize',this.resize);this.resize();
  }
  setCalibration(calibration?:CameraIntrinsics):void{this.calibration=calibration;this.updateCalibration();}
  private readonly resize=():void=>{
    try{this.updateCalibration();}catch(error){this.object3D.visible=false;this.video.dispatchEvent(new CustomEvent('ar-calibration-error',{detail:error}));}
  };
  private updateCalibration():void{
    const width=this.video.videoWidth,height=this.video.videoHeight;if(!width||!height)return;
    const uniforms=this.material.uniforms;
    uniforms.rectify!.value=!!this.calibration;
    if(!this.calibration)return;
    const k=scaleIntrinsics(this.calibration,width,height),d=k.distortion??[];
    (uniforms.size!.value as Vector2).set(width,height);
    (uniforms.intrinsics!.value as Vector4).set(k.fx,k.fy,k.cx,k.cy);
    (uniforms.radial!.value as Vector3).set(d[0]??0,d[1]??0,d[4]??0);
    (uniforms.rational!.value as Vector3).set(d[5]??0,d[6]??0,d[7]??0);
    (uniforms.tangent!.value as Vector2).set(d[2]??0,d[3]??0);
  }
  dispose():void{this.video.removeEventListener('resize',this.resize);this.object3D.geometry.dispose();this.material.dispose();this.texture.dispose();this.object3D.removeFromParent();}
}
