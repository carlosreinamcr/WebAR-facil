/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/** Un request en vuelo; timeout/abort termina el Worker para interrumpir WASM. */
export class WorkerRPC {
  private nextId = 0;
  private closed = false;
  private pending: {
    id: number;
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    cleanup: () => void;
  } | null = null;

  constructor(private readonly worker: Worker, private readonly timeoutMs = 15_000) {
    worker.addEventListener('message', this.message);
    worker.addEventListener('error', this.error);
    worker.addEventListener('messageerror', this.messageError);
  }

  get busy(): boolean { return this.pending !== null; }

  request(payload: Record<string, unknown>, transfer: Transferable[] = [], signal?: AbortSignal): Promise<unknown> {
    if (this.closed) return Promise.reject(new Error('Worker cerrado.'));
    if (this.pending) return Promise.reject(new Error('Worker ocupado.'));
    if (signal?.aborted) return Promise.reject(new DOMException('Cancelado.', 'AbortError'));
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      const abort = () => this.dispose(new DOMException('Cancelado.', 'AbortError'));
      const timer = setTimeout(() => this.dispose(new Error('Timeout WASM.')), this.timeoutMs);
      this.pending = { id, resolve, reject, cleanup: () => {
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
      } };
      signal?.addEventListener('abort', abort, { once: true });
      try { this.worker.postMessage({ ...payload, id }, transfer); }
      catch (error) { this.dispose(error instanceof Error ? error : new Error(String(error))); }
    });
  }

  dispose(error: Error = new DOMException('Worker eliminado.', 'AbortError')): void {
    if (this.closed) return;
    this.closed = true;
    this.worker.removeEventListener('message', this.message);
    this.worker.removeEventListener('error', this.error);
    this.worker.removeEventListener('messageerror', this.messageError);
    this.worker.terminate();
    const pending = this.pending; this.pending = null;
    pending?.cleanup(); pending?.reject(error);
  }

  private readonly message = (event: MessageEvent<unknown>): void => {
    const pending = this.pending;
    if (!pending) return;
    const value = event.data as { id?: unknown; ok?: unknown; result?: unknown; error?: unknown } | null;
    if (!value || value.id !== pending.id || typeof value.ok !== 'boolean') {
      this.dispose(new Error('Protocolo WASM inválido.')); return;
    }
    this.pending = null; pending.cleanup();
    if (value.ok) pending.resolve(value.result);
    else pending.reject(new Error(typeof value.error === 'string' ? value.error : 'Fallo WASM.'));
  };
  private readonly error = (event: ErrorEvent): void => { this.dispose(new Error(event.message)); };
  private readonly messageError = (): void => { this.dispose(new Error('Mensaje WASM ilegible.')); };
}
