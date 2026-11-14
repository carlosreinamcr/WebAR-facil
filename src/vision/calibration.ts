/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type { CameraIntrinsics } from '../Pose.ts';

export function validateIntrinsics(k: CameraIntrinsics): void {
  if (![k.width, k.height, k.fx, k.fy, k.cx, k.cy].every(Number.isFinite) ||
      !Number.isSafeInteger(k.width) || !Number.isSafeInteger(k.height) || k.width <= 0 || k.height <= 0 ||
      k.fx <= 0 || k.fy <= 0 || (k.distortion && (!([4, 5, 8].includes(k.distortion.length)) ||
        !k.distortion.every(Number.isFinite)))) throw new Error('Calibración de cámara inválida.');
}

/** No corregir silenciosamente un recorte o una rotación no observados. */
export function scaleIntrinsics(k: CameraIntrinsics, width: number, height: number): CameraIntrinsics {
  validateIntrinsics(k);
  if (Math.abs(width / height / (k.width / k.height) - 1) > 0.015) {
    throw new Error('La calibración no coincide con el aspecto/orientación del vídeo. Recalibrar o rotar sus intrínsecos.');
  }
  const sx = width / k.width, sy = height / k.height;
  return { ...k, width, height, fx: k.fx * sx, fy: k.fy * sy, cx: k.cx * sx, cy: k.cy * sy };
}

export function estimateIntrinsics(width: number, height: number, verticalFovDegrees = 60): CameraIntrinsics {
  const f = height / (2 * Math.tan(verticalFovDegrees * Math.PI / 360));
  return { width, height, fx: f, fy: f, cx: width / 2, cy: height / 2 };
}

/** Proyección OpenGL/WebGL, píxeles sin distorsión, origen superior izquierdo. */
export function projectionFromIntrinsics(k: CameraIntrinsics, near = 0.01, far = 1000): Float32Array {
  validateIntrinsics(k);
  if (!(near > 0 && far > near)) throw new Error('Planos de recorte inválidos.');
  return new Float32Array([
    2 * k.fx / k.width, 0, 0, 0,
    0, 2 * k.fy / k.height, 0, 0,
    1 - 2 * k.cx / k.width, 2 * k.cy / k.height - 1, -(far + near) / (far - near), -1,
    0, 0, -2 * far * near / (far - near), 0,
  ]);
}

export function rotateIntrinsics(k: CameraIntrinsics, degrees: 0 | 90 | 180 | 270): CameraIntrinsics {
  validateIntrinsics(k);
  let result = { ...k, distortion: k.distortion ? [...k.distortion] : undefined };
  for (let turn = 0; turn < degrees / 90; turn++) {
    const d = result.distortion;
    // Rotación horaria de los términos tangenciales (p1', p2') = (p2, -p1).
    if (d) { const p1 = d[2]!; d[2] = d[3]!; d[3] = -p1; }
    result = { ...result, width: result.height, height: result.width,
      fx: result.fy, fy: result.fx, cx: result.height - 1 - result.cy, cy: result.cx };
  }
  const { distortion, ...rest } = result;
  return { ...rest, ...(distortion ? { distortion } : {}) };
}

export function normalizedPixel(x: number, y: number, k: CameraIntrinsics): [number, number] {
  const xd = (x - k.cx) / k.fx, yd = (y - k.cy) / k.fy;
  let u = xd, v = yd;
  const d = k.distortion;
  if (d) for (let iteration = 0; iteration < 8; iteration++) {
    const r2 = u * u + v * v, r4 = r2 * r2, r6 = r4 * r2;
    const radial = (1 + d[0]! * r2 + d[1]! * r4 + (d[4] ?? 0) * r6) /
      (1 + (d[5] ?? 0) * r2 + (d[6] ?? 0) * r4 + (d[7] ?? 0) * r6);
    const dx = 2 * d[2]! * u * v + d[3]! * (r2 + 2 * u * u);
    const dy = d[2]! * (r2 + 2 * v * v) + 2 * d[3]! * u * v;
    u = (xd - dx) / radial; v = (yd - dy) / radial;
  }
  return [u, v];
}
