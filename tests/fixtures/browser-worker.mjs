import { Worker as NodeWorker } from 'node:worker_threads';
import { resolveObjectURL } from 'node:buffer';
// Ejecuta los Workers generados por Vite en threads reales de Node.
export class BrowserWorker extends EventTarget {
  inner = null;
  queue = [];
  closed = false;
  constructor(url) {
    super();
    const blob = String(url).startsWith('blob:') ? resolveObjectURL(String(url)) : null;
    const content = blob ? blob.text() : Promise.resolve(decodeURIComponent(String(url).split(',').slice(1).join(',')));
    void content.then(source => {
      if (this.closed) return;
      const bootstrap = `
        import { parentPort as __port } from 'node:worker_threads';
        import { createRequire as __createRequire } from 'node:module';
        globalThis.require=__createRequire(${JSON.stringify(new URL('../../package.json',import.meta.url).href)});
        globalThis.__dirname='.';
        globalThis.self = globalThis;
        globalThis.postMessage = (data, transfer) => __port.postMessage(data, transfer);
        globalThis.addEventListener = (name, listener) => {
          if (name === 'message') __port.on('message', data => listener({data}));
        };
      `;
      this.inner = new NodeWorker(new URL('data:text/javascript,' + encodeURIComponent(bootstrap + source)));
      this.inner.on('message', data => this.dispatchEvent(new MessageEvent('message', { data })));
      this.inner.on('error', cause => {
        const event = new Event('error'); event.message = cause.message; this.dispatchEvent(event);
      });
      for (const item of this.queue.splice(0)) this.inner.postMessage(item.data, item.transfer);
    });
  }
  postMessage(data, transfer = []) {
    const cloned = structuredClone({ data, transfer }, { transfer });
    if (this.inner) this.inner.postMessage(cloned.data, cloned.transfer);
    else this.queue.push(cloned);
  }
  terminate() { this.closed = true; void this.inner?.terminate(); }
}