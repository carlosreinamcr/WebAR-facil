/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
export function assertMatrix(matrix: Float32Array): void {
  if (!(matrix instanceof Float32Array) || matrix.length !== 16 || !matrix.every(Number.isFinite)) {
    throw new TypeError('Se requiere una matriz Float32Array(16) finita.');
  }
}

export function identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

/** Column-major; T_A_C = T_A_B * T_B_C. */
export function multiply(a: Float32Array, b: Float32Array): Float32Array {
  assertMatrix(a); assertMatrix(b);
  const result = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[col * 4 + k]!;
    result[col * 4 + row] = sum;
  }
  return result;
}

/** Rechazar escalas, reflexión y matrices degeneradas en poses de cámara/anclaje. */
export function assertRigid(matrix: Float32Array): void {
  assertMatrix(matrix);
  const tolerance = 0.01;
  for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) {
    let dot = 0;
    for (let row = 0; row < 3; row++) dot += matrix[a * 4 + row]! * matrix[b * 4 + row]!;
    if (Math.abs(dot - (a === b ? 1 : 0)) > tolerance) throw new Error('Pose no rígida.');
  }
  const det = matrix[0]! * (matrix[5]! * matrix[10]! - matrix[9]! * matrix[6]!) -
    matrix[4]! * (matrix[1]! * matrix[10]! - matrix[9]! * matrix[2]!) +
    matrix[8]! * (matrix[1]! * matrix[6]! - matrix[5]! * matrix[2]!);
  if (Math.abs(det - 1) > tolerance || Math.abs(matrix[3]!) > tolerance ||
      Math.abs(matrix[7]!) > tolerance || Math.abs(matrix[11]!) > tolerance ||
      Math.abs(matrix[15]! - 1) > tolerance) throw new Error('Pose no rígida.');
}

export function invertRigid(matrix: Float32Array): Float32Array {
  assertRigid(matrix);
  const result = identity();
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) {
    result[col * 4 + row] = matrix[row * 4 + col]!;
  }
  for (let row = 0; row < 3; row++) {
    result[12 + row] = -(result[row]! * matrix[12]! + result[4 + row]! * matrix[13]! +
      result[8 + row]! * matrix[14]!);
  }
  return result;
}
