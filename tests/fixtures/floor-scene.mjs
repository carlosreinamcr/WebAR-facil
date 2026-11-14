import {scene,intrinsics} from './render-scene.mjs';
import {projectWorld} from '../../src/vision/geometry.ts';

/** Escena sin marcador: profundidad y plano inclinado como al mirar hacia suelo. */
export function floorScene(){
  const world=scene();
  for(const patch of world.patches){
    const [u,v]=projectWorld(patch.point,world.base,intrinsics);
    if(v<180)continue;
    const depth=1.5/(.6+.8*(v-intrinsics.cy)/intrinsics.fy);
    patch.point.splice(0,3,(u-intrinsics.cx)/intrinsics.fx*depth,-(v-intrinsics.cy)/intrinsics.fy*depth,-depth);
  }
  return world;
}
