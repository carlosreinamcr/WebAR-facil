// Escena geométrica de prueba: texturas originales, profundidad conocida y cámara móvil.
import { seededRandom, projectWorld } from '../../src/vision/geometry.ts';
import { identity, invertRigid } from '../../src/spatial/matrices.ts';
export const intrinsics = {width:640,height:480,fx:650,fy:650,cx:320,cy:240};

export function scene(seed=208,seeded=false) {
  const random=seededRandom(seed),patches=[];
  const base=identity();
  if(seeded){base.set([1,0,0,0,0,0,1,0,0,-1,0,0,0,0,-.5,1]);}
  const worldFromCamera=invertRigid(base);
  for(let row=0;row<12;row++)for(let col=0;col<16;col++) {
    const u=30+col*38,v=28+row*38;
    if(seeded&&u>175&&u<465&&v>125&&v<355)continue;
    const depth=seeded?.63+random()*.3:3+random()*4;
    const camera=[(u-320)/650*depth,-(v-240)/650*depth,-depth];
    const point=[0,1,2].map(r=>worldFromCamera[r]*camera[0]+worldFromCamera[4+r]*camera[1]+worldFromCamera[8+r]*camera[2]+worldFromCamera[12+r]);
    const bits=Array.from({length:64},()=>random()>.5?230:30);
    patches.push({point,bits});
  }
  function render(cameraX=0) {
    const view=base.slice();view[12]=-cameraX;
    const data=new Uint8ClampedArray(640*480*4);
    for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=75;data[i+3]=255;}
    for(const patch of patches) {
      const [u,v,depth]=projectWorld(patch.point,view,intrinsics);if(depth<=0)continue;
      for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
        const px=Math.round(u)+x-8,py=Math.round(v)+y-8;
        if(px<0||py<0||px>=640||py>=480)continue;
        const offset=(py*640+px)*4,value=patch.bits[(y>>1)*8+(x>>1)];
        data[offset]=value;data[offset+1]=value;data[offset+2]=value;
      }
    }
    return {data,view};
  }
  return {render,patches,base};
}

export function renderMarker(cv,rgba,markerData,cameraX=0) {
  const offset=-cameraX/.5*650;
  const input=cv.matFromArray(600,800,cv.CV_8UC4,markerData);
  const src=cv.matFromArray(4,1,cv.CV_32FC2,[0,0,800,0,800,600,0,600]);
  const dst=cv.matFromArray(4,1,cv.CV_32FC2,[190+offset,142.5,450+offset,142.5,450+offset,337.5,190+offset,337.5]);
  const h=cv.getPerspectiveTransform(src,dst),output=cv.matFromArray(480,640,cv.CV_8UC4,rgba);
  cv.warpPerspective(input,output,h,new cv.Size(640,480),cv.INTER_LINEAR,cv.BORDER_TRANSPARENT);
  const result=new Uint8ClampedArray(output.data);
  input.delete();src.delete();dst.delete();h.delete();output.delete();return result;
}
