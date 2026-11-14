/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Tolerancia visual acotada: nunca crea poses ni prolonga indefinidamente un tracking perdido. */
export class TrackingContinuity {
  private lastSeen=-Infinity;
  private lastTime=-Infinity;
  private readonly graceMs:number;
  constructor(graceMs=500){
    this.graceMs=graceMs;
    if(!Number.isFinite(graceMs)||graceMs<0||graceMs>10000)throw new Error('imageLossGraceMs debe estar entre 0 y 10000.');
  }
  reset():void{this.lastSeen=this.lastTime=-Infinity;}
  update(tracked:boolean,timestampMs:number):'tracked'|'recovering'|'lost'{
    if(!Number.isFinite(timestampMs))throw new Error('Timestamp de tracking inválido.');
    if(timestampMs<this.lastTime)this.reset();this.lastTime=timestampMs;
    if(tracked){this.lastSeen=timestampMs;return'tracked';}
    return timestampMs-this.lastSeen<this.graceMs?'recovering':'lost';
  }
}
