import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessPlanarSupport,descriptorDeadline,planarPoseDisagreement} from '../src/tracking/PlanarSupport.ts';
function support(count,{cluster=false,line=false,error=1,previous=count}={}){
 const objects=new Float32Array(count*3),pixels=new Float32Array(count*2);
 for(let i=0;i<count;i++){const x=(i%5)/4,y=line?x:Math.floor(i/5)/Math.max(1,Math.ceil(count/5)-1),scale=cluster?.05:.8;
  objects[3*i]=(x-.5)*scale*.2;objects[3*i+2]=(y-.5)*scale*.15;pixels[2*i]=100+x*200;pixels[2*i+1]=100+y*150;
 }return assessPlanarSupport(objects,pixels,Array.from({length:count},(_,i)=>i),.2,.15,error,previous);
}
test('Soporte: 12–23 puntos repartidos pueden ser fiables; concentrados o colineales no',()=>{
 for(const count of [12,16,20,23])assert.equal(support(count).reliable,true,String(count));
 assert.equal(support(50,{cluster:true}).reliable,false);assert.equal(support(50,{line:true}).reliable,false);
 assert.equal(support(11).reliable,false);
});
test('Soporte: error y caída de correspondencias obligan a revisar; plazos no dependen del número',()=>{
 assert.equal(support(23,{error:2}).reason,'reprojection');assert.equal(support(23,{previous:80}).reason,'retention');
 assert.equal(descriptorDeadline(20,600,0,0),false);assert.equal(descriptorDeadline(24,800,0,0),true);
 assert.equal(descriptorDeadline(8,1000,0,0),true);assert.equal(descriptorDeadline(1,10,-1,0),true);assert.equal(descriptorDeadline(1,0,0,10),true);
});

test('Soporte: dos poses en desacuerdo no se consideran confirmación independiente',()=>{
 const a=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-.5,1]),b=a.slice(),k={fx:650,fy:650,cx:320,cy:240};
 assert.equal(planarPoseDisagreement(a,b,.2,.15,k),0);b[12]=.01;assert.ok(planarPoseDisagreement(a,b,.2,.15,k)>10);b[14]=1;assert.equal(planarPoseDisagreement(a,b,.2,.15,k),Infinity);
});
