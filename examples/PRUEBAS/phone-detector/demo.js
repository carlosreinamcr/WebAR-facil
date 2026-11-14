const byId=id=>document.getElementById(id);
const start=byId('start'),stop=byId('stop'),status=byId('status'),view=byId('view');
const debug=byId('debug'),box=byId('box');
const sdk=globalThis.WebARFacil;
let active;

function overlap(a,b){
  const area=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0]))*
    Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));
  return area/(a[2]*a[3]+b[2]*b[3]-area);
}

function selectPhone(phones,previous){
  if(previous){
    const matches=phones.map(phone=>({phone,iou:overlap(phone.box,previous)}))
      .filter(item=>item.iou>=.14).sort((a,b)=>b.iou-a.iou);
    return matches[0]?.phone;
  }
  const centerDistance=({box:[x,y,w,h]})=>Math.hypot(x+w/2-.5,y+h/2-.5);
  return [...phones].sort((a,b)=>centerDistance(a)-centerDistance(b)||b.score-a.score)[0];
}

function dispose(message){
  const session=active;
  active=null;
  if(session){
    session.worker?.terminate();
    clearTimeout(session.timeout);
    session.camera?.dispose();
    session.renderer?.setAnimationLoop(null);
    session.model?.dispose();
    session.renderer?.dispose();
    session.renderer?.domElement.remove();
  }
  box.hidden=true;
  delete view.dataset.inference;
  start.disabled=!sdk;
  stop.disabled=true;
  status.textContent=message;
}

function startDemo(){
  start.disabled=true;
  stop.disabled=false;
  status.textContent='Abriendo cámara y cargando el detector…';
  const session={ready:false,busy:false,next:0,lastSeen:-Infinity};
  active=session;
  const fail=error=>{
    if(active===session)dispose(error instanceof Error?error.message:String(error));
  };
  try{
    const {THREE,CameraManager,ThreeARModel}=sdk;
    const renderer=session.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const world=new THREE.Scene();
    const camera=new THREE.OrthographicCamera(0,1,1,0,.1,2000);
    camera.position.z=900;
    const model=session.model=new ThreeARModel();
    model.visible=false;
    world.add(model,new THREE.HemisphereLight(0xffffff,0x627b90,2.5));

    const worker=session.worker=new Worker(new URL('./worker.js',import.meta.url));
    worker.onerror=event=>fail(event.message||'No se pudo cargar el detector.');
    worker.onmessage=({data})=>{
      if(active!==session)return;
      clearTimeout(session.timeout);
      if(data.type==='error'){fail(data.message);return;}
      if(data.type==='ready'){
        session.ready=true;
        status.textContent='Apunta a otro celular.';
        return;
      }
      session.busy=false;
      view.dataset.inference='complete';
      const now=performance.now();
      if(now-session.lastSeen>850)session.target=null;
      const found=selectPhone(data.phones,session.target);
      if(!found)return;
      session.target=found.box;
      session.lastSeen=now;
      session.score=found.score;
    };

    // Se reutiliza la cámara del SDK. Solo hay una inferencia en vuelo.
    const capture=session.camera=new CameraManager({
      performance:'battery',maxFrameWidth:384,maxFramePixels:147456,
      onError:fail,
      onFrame({imageData}){
        const now=performance.now();
        if(!session.ready||session.busy||now<session.next)return;
        session.busy=true;
        session.next=now+150;
        session.timeout=setTimeout(()=>fail('El detector dejó de responder.'),15000);
        const {width,height,data}=imageData;
        worker.postMessage({type:'frame',width,height,buffer:data.buffer},[data.buffer]);
      }
    });
    view.prepend(capture.videoElement,renderer.domElement);
    renderer.domElement.style.pointerEvents='none';
    session.timeout=setTimeout(()=>fail('El detector tardó demasiado en cargar.'),45000);
    worker.postMessage({type:'init'});
    void capture.start().catch(fail);
    void model.load(new URL('../../assets/Kai-WebAR-Facil.glb',import.meta.url),{fitSize:1,autoplay:false}).then(()=>{
      if(active!==session)return;
      const clip=model.animations.find(item=>item.name==='Waving')??model.animations[0];
      if(clip)model.playAnimation(clip.name);
      session.modelReady=true;
    }).catch(fail);

    let last=performance.now(),width=0,height=0,wasVisible=false;
    renderer.setAnimationLoop(now=>{
      const dt=Math.min(.1,Math.max(0,(now-last)/1000));
      last=now;
      if(width!==view.clientWidth||height!==view.clientHeight){
        width=view.clientWidth;height=view.clientHeight;
        renderer.setSize(width,height,false);
        camera.right=width;camera.top=height;
        camera.updateProjectionMatrix();
      }
      const detected=session.target&&now-session.lastSeen<=850;
      if(!detected)session.smooth=null;
      model.visible=Boolean(detected&&session.modelReady);
      if(model.visible!==wasVisible){
        status.textContent=model.visible?'Celular detectado.':'Buscando un celular…';
        wasVisible=model.visible;
      }
      box.hidden=!detected||!debug.checked;
      if(detected){
        session.smooth??=session.target.slice();
        const weight=1-Math.exp(-dt*15);
        session.smooth.forEach((value,i)=>{session.smooth[i]=value+(session.target[i]-value)*weight;});
        const video=capture.videoElement;
        const scale=Math.min(width/video.videoWidth,height/video.videoHeight);
        const w=video.videoWidth*scale,h=video.videoHeight*scale;
        const [x,y,bw,bh]=session.smooth;
        const left=(width-w)/2+x*w,top=(height-h)/2+y*h;
        box.style.left=left+'px';box.style.top=top+'px';
        box.style.width=bw*w+'px';box.style.height=bh*h+'px';
        box.firstElementChild.textContent='Celular · '+Math.round(session.score*100)+'%';
        const size=THREE.MathUtils.clamp(Math.max(bw*w,bh*h)*.75,26,height*.5);
        model.scale.setScalar(size);
        model.position.set(left+bw*w/2,height-top-bh*h*.24,0);
      }
      model.update(dt);
      renderer.render(world,camera);
    });
  }catch(error){fail(error);}
}

if(sdk)start.onclick=startDemo;
else{start.disabled=true;status.textContent='No se cargó WebAR Fácil.';}
stop.onclick=()=>dispose('Cámara detenida.');
addEventListener('pagehide',()=>dispose('Cámara detenida.'));
