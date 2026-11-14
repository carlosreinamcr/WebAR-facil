/* global tf, cocoSsd */
// Los scripts y pesos se sirven desde la misma carpeta que este Worker.
let detector;
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      importScripts('./tf.min.js','./coco-ssd.min.js');
      const gpu=typeof OffscreenCanvas!=='undefined'&&await tf.setBackend('webgl').catch(()=>false);
      if (!gpu) {
        await tf.setBackend('cpu');
      }
      await tf.ready();
      detector = await cocoSsd.load({base:'lite_mobilenet_v2',modelUrl:new URL('model.json',self.location.href).href});
      self.postMessage({type:'ready'});
      return;
    }
    const image = new ImageData(new Uint8ClampedArray(data.buffer),data.width,data.height);
    const predictions = await detector.detect(image,12,.35);
    self.postMessage({type:'result',phones:predictions.filter(item=>item.class==='cell phone')
      .map(({bbox,score})=>({score,box:bbox.map((value,i)=>value/(i%2?data.height:data.width))}))});
  } catch (error) {
    self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)});
  }
};
