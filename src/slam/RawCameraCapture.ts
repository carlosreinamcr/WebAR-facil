/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CameraFrame } from '../camera/CameraManager.ts';
import type { CameraIntrinsics } from '../Pose.ts';

interface XRCameraImage {width:number;height:number}
interface CameraBinding {getCameraImage(camera:XRCameraImage):WebGLTexture|null}
type CameraView=XRView & {camera?:XRCameraImage|null};

/** Lectura reducida pose-sincronizada. Solo se activa durante alineación imagen/XR. */
export class RawCameraCapture {
  private readonly gl:WebGL2RenderingContext;
  private readonly binding:CameraBinding;
  private readonly source:WebGLFramebuffer;
  private readonly output:WebGLFramebuffer;
  private readonly texture:WebGLTexture;
  private width=0;
  private height=0;
  constructor(session:XRSession,gl:WebGL2RenderingContext) {
    if(typeof gl.blitFramebuffer!=='function'||typeof XRWebGLBinding==='undefined')throw new Error('Alineación XR necesita WebGL2 y Raw Camera Access.');
    this.gl=gl;
    this.binding=new (XRWebGLBinding as unknown as new(session:XRSession,gl:WebGL2RenderingContext)=>CameraBinding)(session,gl);
    if(typeof this.binding.getCameraImage!=='function')throw new Error('Raw Camera Access no disponible.');
    const source=gl.createFramebuffer(),output=gl.createFramebuffer(),texture=gl.createTexture();
    if(!source||!output||!texture){if(source)gl.deleteFramebuffer(source);if(output)gl.deleteFramebuffer(output);if(texture)gl.deleteTexture(texture);throw new Error('No se pudieron reservar recursos XR.');}
    this.source=source;this.output=output;this.texture=texture;
  }
  read(view:XRView,timestampMs:number,sessionId:number):{frame:CameraFrame;intrinsics:CameraIntrinsics}|null {
    const camera=(view as CameraView).camera;if(!camera)return null;
    const texture=this.binding.getCameraImage(camera);if(!texture)return null;
    const gl=this.gl,width=Math.min(640,camera.width),height=Math.max(1,Math.round(camera.height*width/camera.width));
    const read=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer|null;
    const draw=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING) as WebGLFramebuffer|null;
    const boundTexture=gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture|null;
    try {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.source);
      gl.framebufferTexture2D(gl.READ_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      if(gl.checkFramebufferStatus(gl.READ_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('El navegador no permite leer la textura de cámara XR.');
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,this.output);
      if(this.width!==width||this.height!==height){
        gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.texture,0);
        this.width=width;this.height=height;
      }
      if(gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Framebuffer XR incompleto.');
      // Invertir Y en GPU: readPixels entrega el primer píxel en coordenadas CV (arriba).
      gl.blitFramebuffer(0,camera.height,camera.width,0,0,0,width,height,gl.COLOR_BUFFER_BIT,gl.LINEAR);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.output);
      const pixels=new Uint8ClampedArray(width*height*4);
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const p=view.projectionMatrix;
      const intrinsics:CameraIntrinsics={width,height,fx:p[0]!*width/2,fy:p[5]!*height/2,
        cx:(1-p[8]!)*width/2,cy:(1+p[9]!)*height/2};
      return {intrinsics,frame:{imageData:new ImageData(pixels,width,height),timestampMs,sessionId,
        mediaTimeSeconds:timestampMs/1000,sourceWidth:camera.width,sourceHeight:camera.height}};
    }finally{gl.bindFramebuffer(gl.READ_FRAMEBUFFER,read);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,draw);gl.bindTexture(gl.TEXTURE_2D,boundTexture);}
  }
  dispose():void{this.gl.deleteFramebuffer(this.source);this.gl.deleteFramebuffer(this.output);this.gl.deleteTexture(this.texture);}
}
