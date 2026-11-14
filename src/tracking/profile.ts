/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Tiempos monotónicos por frame; el total Worker incluye las etapas y su preparación. */
export const TRACKING_STAGES=['grayMs','qualityMs','supportMs','opticalFlowMs','flowValidationMs','orbMs','matchingMs','homographyMs','poseMs','workerMs','roundTripMs','transportAndSchedulingMs'] as const;
export const TRACKING_COUNTS=['flowAttempts','flowAccepted','redetections','orbExtractions','flowInputPoints','cachedAttempts','fullDetections','matchingQueryDescriptors','flowReliable','redetectMissing','redetectWeakSupport','redetectDeadline','redetectVerification','globalDeferred','flowSparseReliable','weakDistribution','weakReprojection','weakRetention','cacheConflicts','exactMatchingCalls','opencvMatchingCalls','emptyMatchingCalls'] as const;
export interface ImageTrackingProfile {
  timings:Record<typeof TRACKING_STAGES[number],number>;
  counts:Record<typeof TRACKING_COUNTS[number],number>;
}
export function createTrackingProfile():ImageTrackingProfile{
  return{timings:Object.fromEntries(TRACKING_STAGES.map(key=>[key,0])) as ImageTrackingProfile['timings'],counts:Object.fromEntries(TRACKING_COUNTS.map(key=>[key,0])) as ImageTrackingProfile['counts']};
}
export function copyTrackingProfile(value:unknown):ImageTrackingProfile|null{
  if(!value||typeof value!=='object')return null;
  const input=value as ImageTrackingProfile,result=createTrackingProfile();
  for(const group of ['timings','counts'] as const){
    for(const key of Object.keys(result[group])){
      const number=(input[group] as Record<string,unknown>|undefined)?.[key];
      if(typeof number!=='number'||!Number.isFinite(number)||number<0||(group==='counts'&&!Number.isSafeInteger(number)))return null;
      (result[group] as Record<string,number>)[key]=number;
    }
  }return result;
}
export function measureTracking<T>(profile:ImageTrackingProfile,key:typeof TRACKING_STAGES[number],run:()=>T):T{
  const started=performance.now();try{return run();}finally{profile.timings[key]+=performance.now()-started;}
}
