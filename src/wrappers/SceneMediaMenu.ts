/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
import type {ThreeARScene} from './ThreeARScene';
import {SceneMediaCapture} from './SceneMediaCapture';

type CameraProfileName='auto'|'balanced'|'battery'|'quality';

/** Controles de captura locales. Mantiene el último archivo disponible tras detener la cámara. */
export class SceneMediaMenu {
  readonly element=document.createElement('details');
  private readonly profile:HTMLSelectElement;
  private readonly economy:HTMLInputElement;
  private readonly photo:HTMLButtonElement;
  private readonly record:HTMLButtonElement;
  private readonly share:HTMLButtonElement;
  private readonly download:HTMLAnchorElement;
  private readonly preview:HTMLAnchorElement;
  private readonly status:HTMLElement;
  private capture:SceneMediaCapture|null=null;
  private unsubscribe:(()=>void)|null=null;
  private file:File|null=null;
  private url:string|null=null;
  private active=false;
  private immersive=false;
  private busy=false;
  private recording=false;
  private changing=false;
  private selected=false;

  constructor(onQuality:()=>Promise<void>,onFile:(file:File)=>void){
    this.element.className='media-menu';
    this.element.hidden=true;
    this.element.innerHTML=`<summary>Foto, vídeo y cámara</summary>
      <div class="media-panel">
        <label>Calidad de cámara <select class="profile"><option value="auto">Automática</option><option value="balanced">Equilibrada</option><option value="quality">Alta</option><option value="battery">Ahorro</option></select></label>
        <label><input class="economy" type="checkbox"> Activar ahorro si hay lag</label>
        <div><button class="photo" type="button" disabled>Tomar foto</button><button class="record" type="button" disabled>Grabar con micrófono</button></div>
        <div class="media-file" hidden><a class="download">Guardar archivo</a><a class="preview" target="_blank" rel="noopener">Abrir archivo</a><button class="share" type="button">Compartir</button></div>
        <small class="media-status" role="status"></small>
      </div>`;
    this.profile=this.element.querySelector<HTMLSelectElement>('.profile')!;
    this.economy=this.element.querySelector<HTMLInputElement>('.economy')!;
    this.photo=this.element.querySelector<HTMLButtonElement>('.photo')!;
    this.record=this.element.querySelector<HTMLButtonElement>('.record')!;
    this.share=this.element.querySelector<HTMLButtonElement>('.share')!;
    this.download=this.element.querySelector<HTMLAnchorElement>('.download')!;
    this.preview=this.element.querySelector<HTMLAnchorElement>('.preview')!;
    this.status=this.element.querySelector<HTMLElement>('.media-status')!;
    const change=()=>{
      this.selected=true;this.changing=true;this.update();
      void onQuality().catch(error=>this.error(error)).finally(()=>{this.changing=false;this.update();});
    };
    this.profile.onchange=change;this.economy.onchange=change;
    this.photo.onclick=()=>{
      const capture=this.capture;if(!capture)return;
      this.busy=true;this.update();
      void capture.takePhoto().then(file=>{if(this.element.isConnected){this.store(file);onFile(file);}},error=>{if(this.capture===capture)this.error(error);})
        .finally(()=>{if(this.capture===capture){this.busy=false;this.update();}});
    };
    this.record.onclick=()=>{
      const capture=this.capture;if(!capture)return;
      if(this.recording){this.busy=true;this.update();void capture.stopVideo().catch(error=>this.error(error));return;}
      this.busy=true;this.say('Solicitando micrófono…');this.update();
      void capture.startVideo().then(({done})=>{
        if(this.capture===capture){this.busy=false;this.recording=true;this.say('Grabando con micrófono.');this.update();}
        return done.then(file=>{if(this.element.isConnected){this.store(file);onFile(file);}},error=>this.error(error));
      },error=>{if(this.capture===capture)this.error(error);})
        .finally(()=>{if(this.capture===capture){this.busy=false;this.recording=false;this.update();}});
    };
    this.share.onclick=()=>{
      if(!this.file||!this.canShare(this.file))return;
      void navigator.share({files:[this.file],title:'Mi experiencia WebAR'}).catch(error=>{
        if(!(error instanceof DOMException&&error.name==='AbortError'))this.error(error);
      });
    };
  }

  get quality():CameraProfileName|null{
    return this.selected?(this.economy.checked?'battery':this.profile.value as CameraProfileName):null;
  }

  configure(visible:boolean,profile:string):void{
    this.element.hidden=!visible;
    if(!this.selected)this.profile.value=profile;
  }

  attach(app:ThreeARScene,viewport:HTMLElement,cover:boolean):void{
    const capture=new SceneMediaCapture(app.renderer.domElement,viewport,cover);
    this.capture=capture;
    this.unsubscribe=app.onAfterRender(()=>{
      if(this.immersive!==app.renderer.xr.isPresenting){
        this.immersive=app.renderer.xr.isPresenting;
        if(this.immersive)void capture.stopVideo().catch(error=>this.error(error));
        this.update();
      }
      if(!this.immersive)capture.frame(performance.now());
    });
    this.update();
  }

  ready():void{
    this.active=true;this.update();
    if(!this.capture?.canRecord)this.say('Puedes tomar fotos. Este navegador no admite grabación del visor.');
  }

  detach():Promise<void>{
    const capture=this.capture;
    this.unsubscribe?.();this.unsubscribe=null;this.capture=null;
    this.active=false;this.immersive=false;this.busy=false;this.recording=false;this.update();
    return capture?.close()??Promise.resolve();
  }

  clearFile():void{
    if(this.url)URL.revokeObjectURL(this.url);
    this.url=null;this.file=null;
    this.download.removeAttribute('href');this.preview.removeAttribute('href');
    this.download.parentElement!.hidden=true;
  }

  private store(file:File):void{
    this.clearFile();
    this.file=file;this.url=URL.createObjectURL(file);
    this.download.href=this.preview.href=this.url;this.download.download=file.name;
    const shareable=this.canShare(file);
    this.share.disabled=!shareable;
    this.download.parentElement!.hidden=false;
    this.say(shareable?'Archivo listo. Puedes guardarlo o compartirlo.':'Archivo listo para guardar.');
  }

  private canShare(file:File):boolean{
    return typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});
  }

  private say(message:string):void{this.status.textContent=message;}
  private error(error:unknown):void{this.say(error instanceof Error?error.message:String(error));}
  private update():void{
    const ready=this.active&&!!this.capture&&!this.immersive&&!this.busy&&!this.changing;
    this.photo.disabled=!ready;
    this.record.disabled=!ready||!this.capture?.canRecord;
    this.record.textContent=this.recording?'Detener grabación':'Grabar con micrófono';
    this.economy.disabled=this.busy||this.recording||this.immersive||this.changing;
    this.profile.disabled=this.economy.checked||this.economy.disabled;
    if(this.immersive)this.say('La cámara nativa de WebXR se captura desde el sistema.');
  }
}
