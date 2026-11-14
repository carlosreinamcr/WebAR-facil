/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Evidencia geométrica del soporte: no expresa certeza física ni sustituye RANSAC/LK. */
export interface PlanarSupport {reliable:boolean;reason:'valid'|'missing'|'reprojection'|'retention'|'distribution';points:number;coverage:number;planeCondition:number;imageCondition:number;cells:number;}
type Point=[number,number];
function condition(points:Point[]):number{
  let x=0,y=0;for(const p of points){x+=p[0];y+=p[1];}x/=points.length;y/=points.length;
  let xx=0,yy=0,xy=0;for(const p of points){const a=p[0]-x,b=p[1]-y;xx+=a*a;yy+=b*b;xy+=a*b;}
  const trace=xx+yy,delta=Math.hypot(xx-yy,2*xy);return trace>1e-12?Math.max(0,(trace-delta)/(trace+delta)):0;
}
function hullArea(points:Point[]):number{
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),lower:Point[]=[],upper:Point[]=[];
  const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(const p of sorted){while(lower.length>=2&&cross(lower[lower.length-2]!,lower[lower.length-1]!,p)<=0)lower.pop();lower.push(p);}
  for(let i=sorted.length-1;i>=0;i--){const p=sorted[i]!;while(upper.length>=2&&cross(upper[upper.length-2]!,upper[upper.length-1]!,p)<=0)upper.pop();upper.push(p);}
  const hull=lower.slice(0,-1).concat(upper.slice(0,-1));let area=0;
  for(let i=0;i<hull.length;i++){const a=hull[i]!,b=hull[(i+1)%hull.length]!;area+=a[0]*b[1]-a[1]*b[0];}return Math.abs(area)/2;
}
export function assessPlanarSupport(objects:Float32Array,pixels:Float32Array,indices:readonly number[],width:number,height:number,errorPx:number,previousCount:number):PlanarSupport{
  const result:PlanarSupport={reliable:false,reason:'missing',points:indices.length,coverage:0,planeCondition:0,imageCondition:0,cells:0};
  if(indices.length<12||!(width>0&&height>0)||!Number.isFinite(errorPx))return result;
  if(errorPx>1.8){result.reason='reprojection';return result;}
  if(previousCount>0&&indices.length/previousCount<.55){result.reason='retention';return result;}
  const plane:Point[]=[],image:Point[]=[],cells=new Set<number>(),unique=new Set<number>();
  for(const i of indices){
    if(!Number.isInteger(i)||i<0||i*3+2>=objects.length||i*2+1>=pixels.length||unique.has(i))return result;unique.add(i);
    const x=objects[3*i]!/width+.5,y=objects[3*i+2]!/height+.5,u=pixels[2*i]!,v=pixels[2*i+1]!;
    if(!Number.isFinite(x+y+u+v))return result;
    plane.push([x,y]);image.push([u,v]);cells.add(Math.min(3,Math.max(0,Math.floor(x*4)))+4*Math.min(3,Math.max(0,Math.floor(y*4))));
  }
  result.coverage=hullArea(plane);result.planeCondition=condition(plane);result.imageCondition=condition(image);result.cells=cells.size;
  result.reliable=result.coverage>=.08&&result.planeCondition>=.03&&result.imageCondition>=.003&&result.cells>=4;
  result.reason=result.reliable?'valid':'distribution';return result;
}
/** Revisión global acotada; la cadencia lenta puede ampliar la ventana temporal. */
export function descriptorDeadline(frame:number,timestampMs:number,lastFrame:number,lastTimestampMs:number,maxIntervalMs=1000):boolean{
  return lastFrame<0||frame-lastFrame>=24||timestampMs-lastTimestampMs>=maxIntervalMs||timestampMs<lastTimestampMs;
}

/** Acuerdo de dos estimaciones del mismo frame en las esquinas del marcador. */
export function planarPoseDisagreement(a:Float32Array,b:Float32Array,width:number,height:number,k:{fx:number;fy:number;cx:number;cy:number}):number{
  let maximum=0;
  for(const [x,z]of [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]]){
    const project=(m:Float32Array):[number,number]=>{const depth=-(m[2]!*x!+m[10]!*z!+m[14]!);return depth>0?[k.fx*(m[0]!*x!+m[8]!*z!+m[12]!)/depth+k.cx,-k.fy*(m[1]!*x!+m[9]!*z!+m[13]!)/depth+k.cy]:[Infinity,Infinity];};
    const p=project(a),q=project(b),distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(!Number.isFinite(distance))return Infinity;maximum=Math.max(maximum,distance);
  }return maximum;
}
