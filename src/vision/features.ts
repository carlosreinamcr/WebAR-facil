/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import {createExactHamming,type ExactHamming,type ORBMatch} from './ExactHamming.ts';
import type { CV } from './runtime.ts';
import { CvScope } from './runtime.ts';
import type { MarkerFeatures } from '../tracking/ImageCompiler.ts';

// ORB 4.12 / scale=1.2 / levels=8 / edge=19 / WTA=2 / patch=31 / FAST=15.
export const ORB_EXTRACTOR_ID = 0x4120b031;
export const ORB_MAX_FEATURES = 1500;
export function createORB(cv: CV): InstanceType<CV['ORB']> {
  return new cv.ORB(ORB_MAX_FEATURES, 1.2, 8, 19, 0, 2, cv.ORB_HARRIS_SCORE, 31, 15);
}

export function extractORB(cv: CV, gray: InstanceType<CV['Mat']>, orb: InstanceType<CV['ORB']>): MarkerFeatures {
  const scope = new CvScope();
  try {
    const keypoints = scope.own(new cv.KeyPointVector());
    const descriptors = scope.own(new cv.Mat());
    const mask = scope.own(new cv.Mat());
    orb.detectAndCompute(gray, mask, keypoints, descriptors);
    const points = new Float32Array(keypoints.size() * 4);
    for (let i = 0; i < keypoints.size(); i++) {
      const point = keypoints.get(i);
      points.set([point.pt.x, point.pt.y, point.angle * Math.PI / 180, point.response], i * 4);
    }
    return { width: gray.cols, height: gray.rows, keypoints: points, descriptors: descriptors.data.slice() };
  } finally { scope.close(); }
}

/** Query=marcador/mapa; train=frame. Ratio + distancia + unicidad de destino. */
let exactHamming:ExactHamming|null|undefined;
export function matchORBProfiled(cv:CV,query:Uint8Array,train:Uint8Array):{matches:ORBMatch[];backend:'wasm-exact'|'opencv'|'empty'}{
  if(query.length<64||train.length<64)return{matches:[],backend:'empty'};
  if(exactHamming===undefined)exactHamming=createExactHamming();
  return exactHamming?{matches:exactHamming.match(query,train),backend:'wasm-exact'}:{matches:matchORBOpenCV(cv,query,train),backend:'opencv'};
}
export function matchORB(cv:CV,query:Uint8Array,train:Uint8Array):ORBMatch[]{return matchORBProfiled(cv,query,train).matches;}
/** Referencia exacta y alternativa de compatibilidad si no se puede compilar el kernel propio. */
export function matchORBOpenCV(cv: CV, query: Uint8Array, train: Uint8Array): ORBMatch[] {
  if (query.length < 64 || train.length < 64) return [];
  const scope = new CvScope();
  try {
    const a = scope.own(cv.matFromArray(query.length / 32, 32, cv.CV_8UC1, query));
    const b = scope.own(cv.matFromArray(train.length / 32, 32, cv.CV_8UC1, train));
    const matcher = scope.own(new cv.BFMatcher(cv.NORM_HAMMING, false));
    const neighbors = scope.own(new cv.DMatchVectorVector());
    matcher.knnMatch(a, b, neighbors, 2);
    const candidates: { query: number; train: number; distance: number }[] = [];
    for (let i = 0; i < neighbors.size(); i++) {
      const matches = neighbors.get(i);
      try {
        if (matches.size() < 2) continue;
        const first = matches.get(0), second = matches.get(1);
        if (first.distance <= 64 && first.distance < 0.75 * second.distance) {
          candidates.push({ query: first.queryIdx, train: first.trainIdx, distance: first.distance });
        }
      } finally { matches.delete(); }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const used = new Set<number>();
    return candidates.filter(match => {
      if (used.has(match.train)) return false;
      used.add(match.train); return true;
    });
  } finally { scope.close(); }
}

export class GrayBuffers {
  private rgba: InstanceType<CV['Mat']> | null = null;
  private gray: InstanceType<CV['Mat']>[] = [];
  private next = 0;
  private readonly cv: CV;
  constructor(cv: CV) { this.cv = cv; }
  frame(data: Uint8ClampedArray, width: number, height: number): InstanceType<CV['Mat']> {
    if (!this.rgba || this.rgba.cols !== width || this.rgba.rows !== height) {
      this.dispose();
      this.rgba = new this.cv.Mat(height, width, this.cv.CV_8UC4);
      this.gray = [new this.cv.Mat(), new this.cv.Mat()];
    }
    this.rgba.data.set(data);
    const gray = this.gray[this.next]!; this.next = 1 - this.next;
    this.cv.cvtColor(this.rgba, gray, this.cv.COLOR_RGBA2GRAY);
    return gray;
  }
  dispose(): void {
    this.rgba?.delete(); this.gray.forEach(mat => mat.delete()); this.rgba = null; this.gray = []; this.next = 0;
  }
}

/** Lucas–Kanade piramidal con consistencia forward/backward y error fotométrico. */
export function trackLK(cv: CV, previous: InstanceType<CV['Mat']>, current: InstanceType<CV['Mat']>,
  points: Float32Array,options:{largeMotion?:boolean}={}): { points: Float32Array; indices: number[] } {
  const scope = new CvScope();
  try {
    if (!points.length) return { points: new Float32Array(), indices: [] };
    const input = scope.own(cv.matFromArray(points.length / 2, 1, cv.CV_32FC2, points));
    const output = scope.own(new cv.Mat()), backward = scope.own(new cv.Mat());
    const status = scope.own(new cv.Mat()), errors = scope.own(new cv.Mat());
    const reverseStatus = scope.own(new cv.Mat()), reverseErrors = scope.own(new cv.Mat());
    const window = new cv.Size(options.largeMotion?31:21, options.largeMotion?31:21);
    const criteria = new cv.TermCriteria(cv.TermCriteria_COUNT + cv.TermCriteria_EPS, 30, 0.01);
    cv.calcOpticalFlowPyrLK(previous, current, input, output, status, errors, window, options.largeMotion?4:3, criteria);
    cv.calcOpticalFlowPyrLK(current, previous, output, backward, reverseStatus, reverseErrors, window, options.largeMotion?4:3, criteria);
    const accepted: number[] = [], indices: number[] = [];
    for (let i = 0; i < input.rows; i++) {
      const x = output.data32F[2 * i]!, y = output.data32F[2 * i + 1]!;
      if (!status.data[i] || !reverseStatus.data[i] || errors.data32F[i]! > 35 ||
          !Number.isFinite(x + y) || x < 4 || y < 4 || x >= current.cols - 4 || y >= current.rows - 4 ||
          Math.hypot(points[2 * i]! - backward.data32F[2 * i]!, points[2 * i + 1]! - backward.data32F[2 * i + 1]!) > 1.25) continue;
      indices.push(i); accepted.push(x, y);
    }
    return { points: new Float32Array(accepted), indices };
  } finally { scope.close(); }
}

export function detectCorners(cv: CV, gray: InstanceType<CV['Mat']>, existing = new Float32Array(), max = 350): Float32Array {
  const scope = new CvScope();
  try {
    const mask = scope.own(new cv.Mat(gray.rows, gray.cols, cv.CV_8UC1, new cv.Scalar(255)));
    for (let i = 0; i < existing.length; i += 2) {
      cv.circle(mask, new cv.Point(existing[i]!, existing[i + 1]!), 9, new cv.Scalar(0), -1);
    }
    const points = scope.own(new cv.Mat());
    cv.goodFeaturesToTrack(gray, points, max, 0.01, 9, mask, 3, false, 0.04);
    return points.data32F.slice();
  } finally { scope.close(); }
}
