/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CV } from './runtime.ts';
import { CvScope } from './runtime.ts';
import type { CameraIntrinsics } from '../Pose.ts';
import { identity } from '../spatial/matrices.ts';

export interface PoseSolution {
  matrix: Float32Array;
  inliers: number[];
  errorPx: number;
}

/** Objetos en sistema diestro; imagen en coordenadas OpenCV. */
export function solvePose(cv: CV, object: Float32Array, pixels: Float32Array,
  k: CameraIntrinsics, robust = true): PoseSolution | null {
  if (object.length / 3 < 6 || object.length / 3 !== pixels.length / 2) return null;
  const scope = new CvScope();
  try {
    const points3 = scope.own(cv.matFromArray(object.length / 3, 1, cv.CV_32FC3, object));
    const points2 = scope.own(cv.matFromArray(pixels.length / 2, 1, cv.CV_32FC2, pixels));
    const camera = scope.own(cv.matFromArray(3, 3, cv.CV_64F, [k.fx, 0, k.cx, 0, k.fy, k.cy, 0, 0, 1]));
    const distortion = scope.own(cv.matFromArray(1, k.distortion?.length ?? 5, cv.CV_64F, k.distortion ?? [0, 0, 0, 0, 0]));
    const rvec = scope.own(new cv.Mat()), tvec = scope.own(new cv.Mat()), inliers = scope.own(new cv.Mat());
    const ok = robust
      ? cv.solvePnPRansac(points3, points2, camera, distortion, rvec, tvec, false, 100, 3, 0.995, inliers, cv.SOLVEPNP_EPNP)
      : cv.solvePnP(points3, points2, camera, distortion, rvec, tvec, false, cv.SOLVEPNP_ITERATIVE);
    if (!ok) return null;
    const selected = robust ? Array.from(inliers.data32S) : Array.from({ length: pixels.length / 2 }, (_, i) => i);
    if (selected.length < 6) return null;
    const refined3 = new Float32Array(selected.flatMap(i => Array.from(object.subarray(i * 3, i * 3 + 3))));
    const refined2 = new Float32Array(selected.flatMap(i => Array.from(pixels.subarray(i * 2, i * 2 + 2))));
    const p3 = scope.own(cv.matFromArray(selected.length, 1, cv.CV_32FC3, refined3));
    const p2 = scope.own(cv.matFromArray(selected.length, 1, cv.CV_32FC2, refined2));
    cv.solvePnP(p3, p2, camera, distortion, rvec, tvec, true, cv.SOLVEPNP_ITERATIVE);
    const rotation = scope.own(new cv.Mat()); cv.Rodrigues(rvec, rotation);
    const matrix = identity();
    for (let row = 0; row < 3; row++) {
      const sign = row === 0 ? 1 : -1; // OpenCV -> WebGL (F = diag(1,-1,-1)).
      for (let col = 0; col < 3; col++) matrix[col * 4 + row] = sign * rotation.data64F[row * 3 + col]!;
      matrix[12 + row] = sign * tvec.data64F[row]!;
    }
    const projected = scope.own(new cv.Mat());
    cv.projectPoints(p3, rvec, tvec, camera, distortion, projected);
    let squared = 0;
    for (let i = 0; i < selected.length; i++) {
      const x = refined3[3 * i]!, y = refined3[3 * i + 1]!, z = refined3[3 * i + 2]!;
      const depth = rotation.data64F[6]! * x + rotation.data64F[7]! * y + rotation.data64F[8]! * z + tvec.data64F[2]!;
      if (depth <= 0.001) return null;
      squared += (projected.data32F[2 * i]! - refined2[2 * i]!) ** 2 +
        (projected.data32F[2 * i + 1]! - refined2[2 * i + 1]!) ** 2;
    }
    const errorPx = Math.sqrt(squared / selected.length);
    if (!Number.isFinite(errorPx) || errorPx > 3.5) return null;
    return { matrix, inliers: selected, errorPx };
  } finally { scope.close(); }
}
