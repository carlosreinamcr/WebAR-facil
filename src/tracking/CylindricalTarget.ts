/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** La etiqueta desplegada ocupa un arco sobre un cilindro de eje Y. */
export function validateCylinder(diameter:number,width:number):void {
  if(!Number.isFinite(diameter)||diameter<=0||!Number.isFinite(width)||width<=0||width>Math.PI*diameter*(1+1e-6))
    throw new Error('El ancho de la etiqueta debe ser positivo y no superar la circunferencia del cilindro.');
  if(width<diameter*.2)throw new Error('La etiqueta ocupa un arco demasiado estrecho para el seguimiento cilíndrico.');
}

export function cylinderPoints(points:Float32Array,pixelWidth:number,pixelHeight:number,width:number,diameter:number):Float32Array {
  const radius=diameter/2,height=width*pixelHeight/pixelWidth;
  const objects=new Float32Array(points.length/2*3);
  for(let i=0;i<points.length/2;i++){
    const angle=(points[i*2]!/pixelWidth-.5)*width/radius;
    objects[i*3]=radius*Math.sin(angle);
    objects[i*3+1]=(.5-points[i*2+1]!/pixelHeight)*height;
    objects[i*3+2]=radius*Math.cos(angle);
  }
  return objects;
}

/** Rechaza correspondencias por detrás de la superficie y conjuntos casi colineales. */
export function cylinderSupport(matrix:Float32Array,objects:Float32Array,pixels:Float32Array,indices:readonly number[],diameter:number,height:number):number[] {
  const cameraX=-(matrix[0]!*matrix[12]!+matrix[1]!*matrix[13]!+matrix[2]!*matrix[14]!);
  const cameraZ=-(matrix[8]!*matrix[12]!+matrix[9]!*matrix[13]!+matrix[10]!*matrix[14]!);
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,minY=Infinity,maxY=-Infinity;
  let minArc=Infinity,maxArc=-Infinity;
  const heading=Math.atan2(cameraX,cameraZ);
  const front=indices.filter(i=>{
    const x=objects[i*3]!,z=objects[i*3+2]!;
    if(x*cameraX+z*cameraZ<=diameter*diameter/4)return false;
    const angle=Math.atan2(x,z)-heading,arc=Math.atan2(Math.sin(angle),Math.cos(angle));
    minArc=Math.min(minArc,arc);maxArc=Math.max(maxArc,arc);
    const y=objects[i*3+1]!,u=pixels[i*2]!,v=pixels[i*2+1]!;
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    left=Math.min(left,u);right=Math.max(right,u);top=Math.min(top,v);bottom=Math.max(bottom,v);
    return true;
  });
  return front.length>=12&&front.length>=indices.length*.75&&maxY-minY>=height*.12&&
    maxArc-minArc>=.16&&right-left>=12&&bottom-top>=12?front:[];
}
