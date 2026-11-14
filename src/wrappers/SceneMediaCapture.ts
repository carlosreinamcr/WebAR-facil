/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
type VideoCapture = {recorder:MediaRecorder;done:Promise<File>;abort:()=>void;timeout:number|undefined};
type PhotoRequest = {resolve:(file:File)=>void;reject:(error:Error)=>void};

function captureFile(blob:Blob,extension:string):File{
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  return new File([blob],`webar-${stamp}.${extension}`,{type:blob.type});
}

/** Copia la escena compuesta justo después de dibujarla en WebGL. */
export class SceneMediaCapture {
  private readonly canvas=document.createElement('canvas');
  private readonly context=this.canvas.getContext('2d');
  private closed=false;
  private pendingMic=false;
  private photo:PhotoRequest|null=null;
  private video:VideoCapture|null=null;
  private lastVideoFrame=-Infinity;

  constructor(private readonly source:HTMLCanvasElement,private readonly viewport:HTMLElement,private readonly cover:boolean){}

  get canRecord():boolean{
    return typeof MediaRecorder!=='undefined'&&typeof this.canvas.captureStream==='function'&&
      typeof navigator.mediaDevices?.getUserMedia==='function';
  }

  takePhoto():Promise<File>{
    if(this.closed||this.photo)return Promise.reject(new Error('La captura de foto no está disponible en este momento.'));
    return new Promise((resolve,reject)=>{this.photo={resolve,reject};});
  }

  frame(now:number):void{
    if(this.closed)return;
    const recording=this.video?.recorder.state==='recording';
    if(!this.photo&&(!recording||now-this.lastVideoFrame<1000/30-2))return;
    const request=this.photo;this.photo=null;
    try{
      if(!this.context)throw new Error('Este navegador no puede componer la captura.');
      const source=this.source;
      const {width,height}=this.captureSize();
      if(!recording)this.resizeCanvas(width,height);
      const scale=Math.min(this.canvas.width/width,this.canvas.height/height);
      this.context.fillStyle='#000';this.context.fillRect(0,0,this.canvas.width,this.canvas.height);
      this.context.drawImage(source,(source.width-width)/2,(source.height-height)/2,width,height,
        (this.canvas.width-width*scale)/2,(this.canvas.height-height*scale)/2,width*scale,height*scale);
      if(recording)this.lastVideoFrame=now;
      if(request)this.canvas.toBlob(blob=>blob
        ?request.resolve(captureFile(blob,blob.type==='image/jpeg'?'jpg':'png'))
        :request.reject(new Error('No se pudo generar la foto.')),'image/jpeg',.92);
    }catch(error){
      request?.reject(error instanceof Error?error:new Error(String(error)));
      if(recording)void this.stopVideo().catch(()=>{});
    }
  }

  private captureSize():{width:number;height:number}{
    const source=this.source;
    const width=this.cover?source.width*Math.min(1,this.viewport.clientWidth/Math.max(1,source.clientWidth)):source.width;
    const height=this.cover?source.height*Math.min(1,this.viewport.clientHeight/Math.max(1,source.clientHeight)):source.height;
    if(width<1||height<1)throw new Error('Espera a que el visor termine de cargar.');
    return {width,height};
  }

  private resizeCanvas(width:number,height:number):void{
    const scale=Math.min(1,1280/Math.max(width,height));
    const w=Math.max(2,Math.floor(width*scale/2)*2),h=Math.max(2,Math.floor(height*scale/2)*2);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  }

  async startVideo():Promise<{done:Promise<File>}>{
    if(this.closed||this.pendingMic||this.video||!this.canRecord)throw new Error('La grabación con micrófono no está disponible en este navegador.');
    this.pendingMic=true;
    const owned:MediaStreamTrack[]=[];
    try{
      const microphone=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      owned.push(...microphone.getTracks());
      if(this.closed)throw new DOMException('Captura cancelada.','AbortError');
      if(!microphone.getAudioTracks().some(track=>track.readyState==='live'))throw new Error('No hay una pista de micrófono activa.');
      const {width,height}=this.captureSize();
      this.resizeCanvas(width,height);
      const stream=this.canvas.captureStream(30);
      owned.push(...stream.getTracks());
      for(const track of microphone.getAudioTracks())stream.addTrack(track);
      const preferred=['video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,preferred?{mimeType:preferred}:undefined);
      const chunks:Blob[]=[];
      let abort!:()=>void;
      const done=new Promise<File>((resolve,reject)=>{
        abort=()=>reject(new Error('El navegador no terminó de guardar el vídeo.'));
        recorder.addEventListener('dataavailable',event=>{if(event.data.size)chunks.push(event.data);});
        recorder.addEventListener('stop',()=>{
          const type=chunks[0]?.type||recorder.mimeType||'video/webm';
          if(chunks.length)resolve(captureFile(new Blob(chunks,{type}),type.includes('mp4')?'mp4':'webm'));
          else reject(new Error('No se recibió vídeo. Intenta grabar durante unos segundos.'));
        },{once:true});
        recorder.addEventListener('error',()=>reject(new Error('El navegador interrumpió la grabación.')),{once:true});
      }).finally(()=>{
        owned.forEach(track=>track.stop());
        if(this.video?.recorder===recorder){clearTimeout(this.video.timeout);this.video=null;}
      });
      this.lastVideoFrame=-Infinity;
      recorder.start(1000);
      this.video={recorder,done,abort,timeout:undefined};
      return{done};
    }catch(error){owned.forEach(track=>track.stop());throw error;}
    finally{this.pendingMic=false;}
  }

  async stopVideo():Promise<File|null>{
    const video=this.video;
    if(!video)return null;
    if(video.recorder.state!=='inactive')video.recorder.stop();
    video.timeout??=window.setTimeout(video.abort,5000);
    return video.done;
  }

  async close():Promise<void>{
    this.closed=true;
    this.photo?.reject(new DOMException('Captura cancelada.','AbortError'));
    this.photo=null;
    try{await this.stopVideo();}catch{/* La grabación comunica su propio resultado. */}
  }
}
