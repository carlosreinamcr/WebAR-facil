/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Desplazamiento observado entre dos capturas del mismo mapa, en píxeles de análisis. */
export interface FlowMotionSample {
  displacementPx:number;
  intervalMs:number;
}

/** Proyección acotada del desplazamiento anterior a la cadencia de la captura actual. */
export function useWideFlow(previous:FlowMotionSample|null,intervalMs:number,shortSide:number):boolean{
  if(!previous||intervalMs<=0||intervalMs>900||previous.intervalMs<=0||previous.intervalMs>900)return false;
  const scale=Math.min(2,Math.max(.5,intervalMs/previous.intervalMs));
  return previous.displacementPx*scale>=Math.max(10,shortSide*.045);
}
