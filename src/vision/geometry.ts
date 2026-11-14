/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import { Matrix, SingularValueDecomposition, EigenvalueDecomposition, determinant } from 'ml-matrix';
import type { CameraIntrinsics } from '../Pose.ts';
import { normalizedPixel } from './calibration.ts';
import { identity, invertRigid } from '../spatial/matrices.ts';

export type Vec3 = [number, number, number];
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const unit = (a: Vec3): Vec3 => { const length = Math.hypot(...a); return a.map(x=>x/length) as Vec3; };
export function seededRandom(seed = 0x5f3759df): () => number {
  return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
}
function sample(random: () => number, count: number, size: number): number[] {
  const selected = new Set<number>(); while (selected.size < size) selected.add(Math.floor(random() * count)); return [...selected];
}

/** Proyecta un punto de mundo utilizando una pose WebGL y distorsión Brown. */
export function projectWorld(point: Vec3, view: Float32Array, k: CameraIntrinsics): [number, number, number] {
  const x = view[0]!*point[0]+view[4]!*point[1]+view[8]!*point[2]+view[12]!;
  const y = -(view[1]!*point[0]+view[5]!*point[1]+view[9]!*point[2]+view[13]!);
  const z = -(view[2]!*point[0]+view[6]!*point[1]+view[10]!*point[2]+view[14]!);
  let u=x/z,v=y/z; const d=k.distortion;
  if (d) {
    const r2=u*u+v*v,r4=r2*r2,r6=r4*r2;
    const radial=(1+d[0]!*r2+d[1]!*r4+(d[4]??0)*r6)/(1+(d[5]??0)*r2+(d[6]??0)*r4+(d[7]??0)*r6);
    const du=2*d[2]!*u*v+d[3]!*(r2+2*u*u),dv=d[2]!*(r2+2*v*v)+2*d[3]!*u*v;
    u=u*radial+du;v=v*radial+dv;
  }
  return [k.fx*u+k.cx,k.fy*v+k.cy,z];
}

/** DLT multivista, seguido de cheirality, error de reproyección y paralaje. */
export function triangulate(p0: [number,number], p1: [number,number], view0: Float32Array,
  view1: Float32Array, k: CameraIntrinsics, minAngleDegrees=1): Vec3 | null {
  const n0=normalizedPixel(...p0,k),n1=normalizedPixel(...p1,k);
  // El ángulo entre rayos se conoce antes de resolver la SVD. Descartar casos
  // claramente degenerados evita cientos de matrices temporales por fotograma.
  const ray=(view:Float32Array,p:[number,number]):Vec3=>[
    view[0]!*p[0]-view[1]!*p[1]-view[2]!,view[4]!*p[0]-view[5]!*p[1]-view[6]!,view[8]!*p[0]-view[9]!*p[1]-view[10]!,
  ];
  const ray0=ray(view0,n0),ray1=ray(view1,n1);
  const cosine=dot(ray0,ray1)/(Math.hypot(...ray0)*Math.hypot(...ray1));
  if(minAngleDegrees>0&&cosine>Math.cos(minAngleDegrees*.5*Math.PI/180))return null;
  const rows: number[][]=[];
  for(const [view,p] of [[view0,n0],[view1,n1]] as const) {
    const pmat=[0,1,2].map(row=>[0,1,2,3].map(col=>view[col*4+row]!*(row===0?1:-1)));
    rows.push(pmat[2]!.map((v,i)=>p[0]*v-pmat[0]![i]!),pmat[2]!.map((v,i)=>p[1]*v-pmat[1]![i]!));
  }
  const svd=new SingularValueDecomposition(new Matrix(rows)),v=svd.rightSingularVectors;
  const w=v.get(3,3);if(Math.abs(w)<1e-9)return null;
  const point:Vec3=[v.get(0,3)/w,v.get(1,3)/w,v.get(2,3)/w];
  if(!point.every(Number.isFinite))return null;
  for(const [view,p] of [[view0,p0],[view1,p1]] as const) {
    const predicted=projectWorld(point,view,k);
    if(predicted[2]<=0.001||Math.hypot(predicted[0]-p[0],predicted[1]-p[1])>2.5)return null;
  }
  const c0=invertRigid(view0),c1=invertRigid(view1);
  const a=unit([point[0]-c0[12]!,point[1]-c0[13]!,point[2]-c0[14]!]);
  const b=unit([point[0]-c1[12]!,point[1]-c1[13]!,point[2]-c1[14]!]);
  const angle=Math.acos(Math.max(-1,Math.min(1,dot(a,b))))*180/Math.PI;
  return angle>=minAngleDegrees?point:null;
}

function normalizePoints(points: [number,number][]): { points: [number,number][]; transform: Matrix } {
  const mean=points.reduce((sum,p)=>[sum[0]!+p[0]/points.length,sum[1]!+p[1]/points.length],[0,0]);
  const distance=points.reduce((sum,p)=>sum+Math.hypot(p[0]-mean[0]!,p[1]-mean[1]!)/points.length,0);
  const scale=Math.SQRT2/Math.max(distance,1e-9);
  return { points:points.map(p=>[(p[0]-mean[0]!)*scale,(p[1]-mean[1]!)*scale]),
    transform:new Matrix([[scale,0,-scale*mean[0]!],[0,scale,-scale*mean[1]!],[0,0,1]]) };
}

function eightPoint(a: [number,number][],b: [number,number][]): Matrix {
  const na=normalizePoints(a),nb=normalizePoints(b);
  const rows=na.points.map(([x,y],i)=>{const [u,v]=nb.points[i]!;return[u*x,u*y,u,v*x,v*y,v,x,y,1];});
  // A es 8x9 en muestras mínimas: usar autovector de A^T A conserva su espacio nulo.
  const matrix=new Matrix(rows),eigen=new EigenvalueDecomposition(matrix.transpose().mmul(matrix),{assumeSymmetric:true});
  const values=eigen.realEigenvalues;let index=0;for(let i=1;i<values.length;i++)if(values[i]!<values[index]!)index=i;
  const f=Matrix.from1DArray(3,3,eigen.eigenvectorMatrix.getColumn(index));
  const essential=nb.transform.transpose().mmul(f).mmul(na.transform);
  const svd=new SingularValueDecomposition(essential),s=(svd.diagonal[0]!+svd.diagonal[1]!)/2;
  return svd.leftSingularVectors.mmul(Matrix.diag([s,s,0])).mmul(svd.rightSingularVectors.transpose());
}

function sampson(e: number[][],a:[number,number],b:[number,number]):number {
  const x=[...a,1],y=[...b,1];const ex=e.map(row=>dot(row,x));
  const ety=[0,1,2].map(col=>e.reduce((sum,row,i)=>sum+row[col]!*y[i]!,0));
  const numerator=dot(y,ex);return numerator*numerator/Math.max(1e-15,ex[0]!**2+ex[1]!**2+ety[0]!**2+ety[1]!**2);
}

export interface InitialMap {
  viewMatrix: Float32Array;
  indices: number[];
  points: Vec3[];
}

/** Inicialización monocular robusta. Rechaza rotación pura y geometría degenerada. */
export function initializeTwoView(pixels0: Float32Array,pixels1: Float32Array,k:CameraIntrinsics):InitialMap|null {
  const count=pixels0.length/2;if(count<30||pixels1.length!==pixels0.length)return null;
  const a=Array.from({length:count},(_,i)=>normalizedPixel(pixels0[2*i]!,pixels0[2*i+1]!,k));
  const b=Array.from({length:count},(_,i)=>normalizedPixel(pixels1[2*i]!,pixels1[2*i+1]!,k));
  const random=seededRandom(),threshold=(2/Math.min(k.fx,k.fy))**2;
  let best:number[]=[],bestE:Matrix|null=null;
  for(let iteration=0;iteration<180;iteration++) {
    const selected=sample(random,count,8);
    try {
      const e=eightPoint(selected.map(i=>a[i]!),selected.map(i=>b[i]!)),data=e.to2DArray();
      const inliers=Array.from({length:count},(_,i)=>i).filter(i=>sampson(data,a[i]!,b[i]!)<threshold);
      if(inliers.length>best.length){best=inliers;bestE=e;}
      if(iteration>=32&&best.length>count*.9)break;
    } catch { /* Muestra degenerada: probar la siguiente. */ }
  }
  if(!bestE||best.length<30||best.length/count<.55)return null;
  bestE=eightPoint(best.map(i=>a[i]!),best.map(i=>b[i]!));
  const svd=new SingularValueDecomposition(bestE),u=svd.leftSingularVectors,v=svd.rightSingularVectors;
  if(determinant(u)<0)for(let row=0;row<3;row++)u.set(row,2,-u.get(row,2));
  if(determinant(v)<0)for(let row=0;row<3;row++)v.set(row,2,-v.get(row,2));
  const w=new Matrix([[0,-1,0],[1,0,0],[0,0,1]]);
  let chosen:InitialMap|null=null;
  for(const rotation of [u.mmul(w).mmul(v.transpose()),u.mmul(w.transpose()).mmul(v.transpose())])for(const sign of [1,-1]) {
    const view=identity();
    for(let row=0;row<3;row++) {
      for(let col=0;col<3;col++)view[col*4+row]=rotation.get(row,col)*(row===0?1:-1)*(col===0?1:-1);
      view[12+row]=sign*u.get(row,2)*(row===0?1:-1);
    }
    const indices:number[]=[],points:Vec3[]=[];
    for(const i of best) {
      const point=triangulate([pixels0[2*i]!,pixels0[2*i+1]!],[pixels1[2*i]!,pixels1[2*i+1]!],identity(),view,k,1.2);
      if(point){indices.push(i);points.push(point);}
    }
    if(indices.length>(chosen?.indices.length??0))chosen={viewMatrix:view,indices,points};
  }
  return chosen&&chosen.indices.length>=25&&chosen.indices.length/best.length>.6?chosen:null;
}

export interface PlaneFit {matrix:Float32Array;inliers:number}

function planeMatrix(center:Vec3,normal:Vec3):Float32Array{
  const tangent=unit(cross(Math.abs(normal[2])<.9?[0,0,1]:[1,0,0],normal)),z=cross(tangent,normal);
  const matrix=identity();matrix.set(tangent,0);matrix.set(normal,4);matrix.set(z,8);matrix.set(center,12);
  return matrix;
}

function fitPlaneSupport(points:Vec3[],indices:number[]):{center:Vec3;normal:Vec3}|null{
  const center:Vec3=[0,0,0];
  for(const i of indices)for(let axis=0;axis<3;axis++)center[axis]!+=points[i]![axis]!/indices.length;
  const covariance=Matrix.zeros(3,3);
  for(const i of indices)for(let row=0;row<3;row++)for(let col=0;col<3;col++)covariance.set(row,col,
    covariance.get(row,col)+(points[i]![row]!-center[row]!)*(points[i]![col]!-center[col]!));
  const eigen=new EigenvalueDecomposition(covariance,{assumeSymmetric:true});
  const [normalSpread,minor,major]=[...eigen.realEigenvalues].sort((a,b)=>a-b);
  // Una franja estrecha no da soporte suficiente para estimar la normal.
  if(!(minor!>0)||minor!<major!*.01)return null;
  const index=eigen.realEigenvalues.indexOf(normalSpread!);
  return {center,normal:unit(eigen.eigenvectorMatrix.getColumn(index) as Vec3)};
}

/** Plano visual dominante. Los bordes y la gravedad no se infieren del conjunto. */
export function fitPlane(points:Vec3[],camera:Vec3,threshold:number):PlaneFit|null{
  if(points.length<20||!(threshold>0))return null;
  const random=seededRandom();
  let best:number[]=[],bestError=Infinity;
  for(let iteration=0;iteration<120;iteration++){
    const [i,j,l]=sample(random,points.length,3),a=points[i!]!,b=points[j!]!,c=points[l!]!;
    const normal=unit(cross([b[0]-a[0],b[1]-a[1],b[2]-a[2]],[c[0]-a[0],c[1]-a[1],c[2]-a[2]]));
    if(!normal.every(Number.isFinite))continue;
    const offset=dot(normal,a),inliers:number[]=[];
    let error=0;
    points.forEach((point,index)=>{
      const distance=Math.abs(dot(normal,point)-offset);
      if(distance<threshold){inliers.push(index);error+=distance*distance;}
    });
    if(inliers.length>best.length||(inliers.length===best.length&&error<bestError)){best=inliers;bestError=error;}
  }
  const minimum=Math.max(20,Math.ceil(points.length*.55));
  if(best.length<minimum)return null;
  const initial=fitPlaneSupport(points,best);
  if(!initial)return null;
  const offset=dot(initial.normal,initial.center);
  const refined=points.map((_,index)=>index).filter(index=>Math.abs(dot(initial.normal,points[index]!)-offset)<threshold*.8);
  const improvement=refined.length>=minimum?fitPlaneSupport(points,refined):null;
  const fit=improvement??initial;
  const {center}=fit;
  const towardCamera:Vec3=[camera[0]-center[0],camera[1]-center[1],camera[2]-center[2]];
  const normal=dot(fit.normal,towardCamera)<0?fit.normal.map(value=>-value) as Vec3:fit.normal;
  return {matrix:planeMatrix(center,normal),inliers:improvement?refined.length:best.length};
}

function compatiblePlanes(a:PlaneFit,b:PlaneFit,offsetLimit:number):boolean{
  const x=a.matrix,y=b.matrix;
  const normalX:Vec3=[x[4]!,x[5]!,x[6]!],normalY:Vec3=[y[4]!,y[5]!,y[6]!];
  const separation:Vec3=[x[12]!-y[12]!,x[13]!-y[13]!,x[14]!-y[14]!];
  return dot(normalX,normalY)>=Math.cos(9*Math.PI/180)&&
    Math.abs(dot(normalX,separation))<=offsetLimit&&Math.abs(dot(normalY,separation))<=offsetLimit;
}

/** Buscar tres estimaciones compatibles, incluida la actual. */
export function stablePlane(planes:readonly PlaneFit[],offsetLimit:number):PlaneFit|null{
  const latest=planes.at(-1);
  if(!latest)return null;
  for(let i=planes.length-2;i>0;i--){
    const first=planes[i]!;
    if(!compatiblePlanes(latest,first,offsetLimit))continue;
    for(let j=i-1;j>=0;j--){
      const second=planes[j]!;
      if(!compatiblePlanes(latest,second,offsetLimit)||!compatiblePlanes(first,second,offsetLimit))continue;
      const center:Vec3=[0,0,0],normal:Vec3=[0,0,0];
      for(const {matrix} of [latest,first,second]){
        for(let axis=0;axis<3;axis++){normal[axis]!+=matrix[4+axis]!;center[axis]!+=matrix[12+axis]!/3;}
      }
      return {matrix:planeMatrix(center,unit(normal)),inliers:Math.min(latest.inliers,first.inliers,second.inliers)};
    }
  }
  return null;
}
