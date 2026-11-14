// BACKEND DE PRUEBA: poses sintéticas para verificar el protocolo, nunca para producción.
export async function createOdometryBackend() {
  let map = 0;
  return {
    reset() { map++; },
    processFrame({ timestampMs }) {
      const worldFromCamera = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, timestampMs / 1000,0,0,1]);
      return {
        status: 'tracked', mapId: `test-${map}`, worldFromCamera,
        projectionMatrix: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
        scale: 'relative', trackedPoints: 30,
        groundPlane: { inliers: 20, worldFromPlane:
          new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,-1,-2,1]) },
      };
    },
  };
}
