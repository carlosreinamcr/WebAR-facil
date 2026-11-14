import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RawCameraCapture} from '../src/slam/RawCameraCapture.ts';
import {projectionFromIntrinsics} from '../src/vision/calibration.ts';
test('Raw Camera: intrínsecos sincronizados, flip Y y restauración de estado WebGL',()=>{
  const originalBinding=globalThis.XRWebGLBinding,originalImage=globalThis.ImageData;
  globalThis.XRWebGLBinding=class{getCameraImage(){return{};}};
  globalThis.ImageData=class{constructor(data,width,height){Object.assign(this,{data,width,height});}};
  const constants=['READ_FRAMEBUFFER_BINDING','DRAW_FRAMEBUFFER_BINDING','TEXTURE_BINDING_2D','READ_FRAMEBUFFER','DRAW_FRAMEBUFFER','COLOR_ATTACHMENT0','TEXTURE_2D','FRAMEBUFFER_COMPLETE','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR','TEXTURE_WRAP_S','TEXTURE_WRAP_T','CLAMP_TO_EDGE','RGBA8','RGBA','UNSIGNED_BYTE','COLOR_BUFFER_BIT'];
  const gl=Object.fromEntries(constants.map((key,i)=>[key,i+1])),initialRead={},initialDraw={},initialTexture={};
  let read=initialRead,draw=initialDraw,texture=initialTexture,blit;
  Object.assign(gl,{createFramebuffer:()=>({}),createTexture:()=>({}),deleteFramebuffer(){},deleteTexture(){},
    getParameter:value=>value===gl.READ_FRAMEBUFFER_BINDING?read:value===gl.DRAW_FRAMEBUFFER_BINDING?draw:texture,
    bindFramebuffer:(target,value)=>{if(target===gl.READ_FRAMEBUFFER)read=value;else draw=value;},bindTexture:(_target,value)=>{texture=value;},
    framebufferTexture2D(){},checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,texParameteri(){},texImage2D(){},
    blitFramebuffer:(...args)=>{blit=args;},readPixels:(_x,_y,_w,_h,_format,_type,pixels)=>pixels.fill(127)});
  try{
    const capture=new RawCameraCapture({},gl),k={width:640,height:480,fx:650,fy:640,cx:319,cy:238};
    const result=capture.read({camera:{width:640,height:480},projectionMatrix:projectionFromIntrinsics(k)},10,1);
    assert.ok(Math.abs(result.intrinsics.cx-k.cx)<1e-4);assert.ok(Math.abs(result.intrinsics.cy-k.cy)<1e-4);
    assert.deepEqual(blit.slice(0,4),[0,480,640,0]);assert.equal(read,initialRead);assert.equal(draw,initialDraw);assert.equal(texture,initialTexture);
    capture.dispose();
  }finally{globalThis.XRWebGLBinding=originalBinding;globalThis.ImageData=originalImage;}
});
