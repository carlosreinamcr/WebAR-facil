import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import { identity, multiply, invertRigid } from '../src/spatial/matrices.ts';

import { BrowserWorker } from './fixtures/browser-worker.mjs';

globalThis.self = globalThis;
globalThis.Worker = BrowserWorker;
const { Tracker, ImageCompiler, OpticalFlowSLAM, SLAMManager, WebAREngine, ThreeARGroup, EngineState,registerAFrameComponent } =
  await import('../dist/webar-facil.js');

const fallback = {
  moduleURL: new URL('./fixtures/mock-odometry.mjs', import.meta.url),
  intrinsics: { width: 640, height: 480, fx: 500, fy: 500, cx: 320, cy: 240 },
  floorROI: { x: 0, y: 0.5, width: 1, height: 0.5 },
};
const opencvURL=new URL('../public/vision/opencv.js',import.meta.url).href;
const frame = (sessionId = 1, timestampMs = 10) => ({
  imageData: { data: new Uint8ClampedArray(16), width: 2, height: 2 },
  sessionId, timestampMs, mediaTimeSeconds: 0, sourceWidth: 2, sourceHeight: 2,
});
const marker=async()=>{const bytes=await readFile('public/target.dat');return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);};

test('poses: composición e inversa rígida; rechazar reflexión y escala', () => {
  const camera = identity(); camera[12] = 2; camera[13] = 3;
  const object = identity(); object[12] = 5;
  const view = invertRigid(camera);
  assert.equal(multiply(view, object)[12], 3);
  assert.deepEqual(multiply(view, camera), identity());
  const invalid = identity(); invalid[0] = -1;
  assert.throws(() => invertRigid(invalid));
});

test('NFT: transferir buffer, limitar frames y no publicar una pose ficticia', async () => {
  const tracker = new Tracker({opencvURL});
  try {
    const dat = await marker(); await tracker.loadTarget(dat); assert.equal(dat.byteLength, 0);
    const first = frame(); const result = tracker.processFrame(first);
    assert.equal(first.imageData.data.byteLength, 0);
    const dropped = frame(); assert.equal(await tracker.processFrame(dropped), null);
    assert.equal(dropped.imageData.data.byteLength, 16);
    assert.equal((await result).status, 'not-found');
    assert.equal((await tracker.processFrame(frame())).matrix, null);
  } finally { tracker.dispose(); }
});

test('odometría: Worker real, pose acumulada, reset de sesión y ABI ausente', async () => {
  const flow = new OpticalFlowSLAM(fallback);
  try {
    await flow.start();
    const input = frame(); const estimate = flow.processFrame(input);
    assert.equal(input.imageData.data.byteLength, 0);
    assert.equal(await flow.processFrame(frame()), null);
    assert.equal((await estimate).worldFromCamera[12], Math.fround(0.01));
    assert.equal((await flow.processFrame(frame(2))).mapId, '1:test-1');
  } finally { flow.dispose(); }
  const bad = new OpticalFlowSLAM({ ...fallback, moduleURL: new URL('data:text/javascript,export const x=1') });
  await assert.rejects(bad.start(), /ABI WASM incompatible/);
  bad.dispose();
});

test('odometría: cancelar durante inicialización termina el Worker', async () => {
  const flow = new OpticalFlowSLAM(fallback);
  const controller = new AbortController();
  const starting = flow.start(controller.signal); controller.abort();
  await assert.rejects(starting, { name: 'AbortError' }); flow.dispose();
});

test('odometría: un inicio cancelado no termina un reinicio nuevo', async () => {
  const flow = new OpticalFlowSLAM(fallback);
  const first = flow.start();
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  flow.stop();
  const second = flow.start();
  try {
    await cancelled; await second;
    assert.equal((await flow.processFrame(frame())).status, 'tracked');
  } finally { flow.dispose(); }
});

test('Three.js: misma matriz de mundo para los diferentes backends', () => {
  const group = new ThreeARGroup();
  const world = identity(); world[12] = 4;
  const modelView = identity(); modelView[12] = 2;
  group.update(modelView, { worldMatrix: world });
  assert.equal(group.matrix.elements[12], 4); assert.equal(group.matrixAutoUpdate, false);
  group.update(modelView); assert.equal(group.matrix.elements[12], 2);
});

test('A-Frame: matrices, pérdida de tracking, target y restauración al quitar componente',async()=>{
  let definition,poseListener,statusListener,unsubscribed=0;const targets=[];
  const video=Object.assign(new EventTarget(),{videoWidth:0,videoHeight:0});
  const engine={videoElement:video,onPose:fn=>{poseListener=fn;return()=>unsubscribed++;},onStatus:fn=>{statusListener=fn;return()=>unsubscribed++;},loadTarget:async url=>{targets.push(url);}};
  registerAFrameComponent({registerComponent:(name,value)=>{assert.equal(name,'my-ar-tracker');definition=value;}},engine);
  const camera=new THREE.PerspectiveCamera(),root=new THREE.Group(),el=Object.assign(new EventTarget(),{object3D:new THREE.Group(),sceneEl:{camera,object3D:root}});
  const component={data:{target:'/marker.dat'},el};definition.init.call(component);definition.update.call(component,{target:''});await new Promise(resolve=>setTimeout(resolve,0));
  const world=identity(),view=identity();world[12]=3;view[12]=-1;
  poseListener(identity(),{backend:'image',worldMatrix:world,viewMatrix:view,projectionMatrix:null});
  assert.equal(el.object3D.matrix.elements[12],3);assert.equal(camera.matrix.elements[12],1);assert.equal(el.object3D.matrixAutoUpdate,false);
  statusListener('not-found');assert.equal(el.object3D.visible,false);
  definition.remove.call(component);assert.equal(el.object3D.matrixAutoUpdate,true);assert.equal(camera.matrixAutoUpdate,true);assert.equal(root.children.length,0);assert.equal(unsubscribed,2);assert.deepEqual(targets,['/marker.dat']);
});

function mockBrowser(supported = false, requestSession = async () => { throw new Error('No XR'); }) {
  const callbacks = new Map(); let id = 0;
  const videos = [], streams = [];
  globalThis.isSecureContext = true;
  globalThis.HTMLMediaElement = { HAVE_CURRENT_DATA: 2 };
  globalThis.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => callbacks.delete(key);
  globalThis.OffscreenCanvas = class {
    width; height;
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }) }; }
  };
  globalThis.document = Object.assign(new EventTarget(), { baseURI:new URL('../index.html',import.meta.url).href,visibilityState:'visible',createElement() {
    const video = new EventTarget();
    Object.assign(video, { currentTime: 0, readyState: 2, videoWidth: 2, videoHeight: 2,
      setAttribute() {}, play: async () => {}, pause() {}, remove() {} });
    videos.push(video); return video;
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    xr: { isSessionSupported: async () => supported, requestSession },
    mediaDevices: { getSupportedConstraints: () => ({ facingMode: true }), getUserMedia: async constraints => {
      const deviceId=constraints.video.deviceId?.exact??`camera-${streams.length}`;
      const track = new EventTarget(); track.readyState = 'live'; track.stop = () => { track.stopped = true; };track.getSettings=()=>({width:2,height:2,deviceId});
      track.request=constraints.video;
      streams.push(track); return { getTracks: () => [track], getVideoTracks: () => [track] };
    } },
  } });
  return { videos, streams, tick(time) {
    const [key, callback] = callbacks.entries().next().value;
    callbacks.delete(key); videos.at(-1).currentTime += 0.1; callback(time);
  } };
}

test('fachada: WebXR ausente inicia fallback y publica modelView coherente', async () => {
  const browser = mockBrowser();
  const engine = new WebAREngine({ fallback,opencvURL });
  try {
    await engine.startCamera();
    assert.equal((await engine.enableSLAM()).backend, 'optical-flow');
    assert.equal(browser.streams.length,1,'La odometría reutiliza el track de vídeo existente');
    const pose = new Promise((resolve, reject) => { engine.onPose((matrix, metadata) => resolve(metadata)); engine.onError(reject); });
    browser.tick(10);
    const result = await pose;
    assert.equal(result.backend, 'optical-flow'); assert.equal(result.worldMatrix[13], -1);
    assert.ok(result.matrix[12] < 0); assert.equal(result.scale, 'relative');
    engine.stop(); assert.equal(engine.state, EngineState.Idle); assert.equal(browser.streams[0].stopped, true);
  } finally { engine.dispose(); }
});

test('fachada: fallo WebXR recupera el marcador con otro Worker y cámara', async () => {
  const browser = mockBrowser(true, async () => { throw new DOMException('XR falló', 'NotSupportedError'); });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(await marker());
  const engine = new WebAREngine({ attachXRSession: async () => {},opencvURL });
  try {
    await engine.startCamera(); await engine.loadTarget('https://example.test/target.dat');
    browser.tick(1); // Un frame puede estar en vuelo cuando se cierra la cámara.
    await assert.rejects(engine.enableSLAM({backend:'webxr'}), /XR falló/);
    assert.equal(engine.state, EngineState.TrackingImage); assert.equal(browser.streams.length, 2);
    assert.deepEqual(browser.streams[1].request.deviceId,{exact:'camera-0'});
    const status = new Promise(resolve => engine.onStatus(value => { if (value === 'not-found') resolve(value); }));
    browser.tick(30); await status;
    await engine.stop();await engine.startCamera();
    assert.equal(browser.streams[2].request.deviceId,undefined);
    assert.equal(browser.streams[2].request.facingMode.ideal,'environment');
  } finally { engine.dispose(); globalThis.fetch = originalFetch; }
});

test('fachada: rechazo de permisos XR no inicia otra captura', async () => {
  const browser = mockBrowser(true, async () => { throw new DOMException('Permiso denegado', 'NotAllowedError'); });
  const engine = new WebAREngine({ fallback, attachXRSession: async () => {},opencvURL });
  try {
    await engine.startCamera();
    await assert.rejects(engine.enableSLAM(), { name: 'NotAllowedError' });
    assert.equal(browser.streams.length, 1); assert.equal(engine.state, EngineState.Idle);
  } finally { engine.dispose(); }
});

test('fachada: await stop espera la cancelación de una operación y permite reiniciar',async()=>{
  mockBrowser();
  const engine=new WebAREngine({opencvURL,fallback});
  const starting=engine.startCamera();const cancelled=assert.rejects(starting,{name:'AbortError'});
  await engine.stop();await cancelled;
  try{await engine.startCamera();assert.equal(engine.state,EngineState.Camera);}finally{engine.dispose();}
});

test('WebXR: hit-test y select colocan objeto; conservar pose exige alineación', async () => {
  const session = new EventTarget(); const callbacks = new Map(); let id = 0;
  Object.assign(session, {
    requestReferenceSpace: async () => new EventTarget(),
    requestHitTestSource: async () => ({ cancel() {} }),
    requestAnimationFrame: cb => { callbacks.set(++id, cb); return id; },
    cancelAnimationFrame: key => callbacks.delete(key),
    end: async () => session.dispatchEvent(new Event('end')),
  });
  mockBrowser(true, async (_mode, options) => {
    assert.deepEqual(options.requiredFeatures, ['hit-test']); return session;
  });
  const poses = [];
  const slam = new SLAMManager({ attachSession: async () => {}, onPose: pose => poses.push(pose) });
  await slam.start();
  const surface = identity(); surface[12] = 4;
  const view = identity(); view[12] = -1;
  const xrFrame = { getHitTestResults: () => [{ getPose: () => ({ transform: { matrix: surface } }) }],
    getViewerPose: () => ({ transform: { inverse: { matrix: view } }, views: [{ transform:{inverse:{matrix:view},matrix:invertRigid(view)},projectionMatrix: identity() }] }) };
  const select = new Event('select'); select.frame = xrFrame; session.dispatchEvent(select);
  callbacks.values().next().value(10, xrFrame);
  assert.equal(poses[0].worldMatrix[12], 4); assert.equal(poses[0].matrix[12], 3);
  assert.throws(() => slam.switchToSLAM(identity()), /alignment-required/);
  slam.stop();
});

test('IIFE: consumible mediante script con THREE global', async () => {
  const script = await readFile(new URL('../dist/webar-facil.browser.min.js', import.meta.url), 'utf8');
  const context = vm.createContext({ THREE, console });
  vm.runInContext(script, context);
  assert.equal(typeof context.WebARFacil.WebAREngine, 'function');
  assert.equal(typeof context.WebARFacil.ThreeARGroup, 'function');
});
