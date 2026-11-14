/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
/* Recolector de desarrollo para los ejemplos. Independiente del SDK de producción. */
(() => {
  'use strict';
  if (globalThis.WebARLocalReports) return;
  const script = document.currentScript;
  if (!script?.src) return;
  const endpoint = new URL('../diagnostics/api.php', script.src);
  const dashboard = new URL('../diagnostics/', script.src);
  endpoint.pathname = endpoint.pathname.replace(/\/{2,}/g, '/');
  dashboard.pathname = dashboard.pathname.replace(/\/{2,}/g, '/');
  const example = decodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  const PREFIX = 'webar-local-reports-v1:';
  const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch { return false; } };
  const uuid = () => crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  const ua = navigator.userAgent;
  const platform = /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop';
  const client = { id: load('clientId', null) || uuid(), label: load('label', '') || (platform === 'ios' ? 'iPhone/iPad' : platform === 'android' ? 'Android' : 'Computador'), platform };
  save('clientId', client.id);
  let enabled = load('enabled', true), physical = load('physical', false);
  let config = null, running = null, lastAck = null, failure = false, timer = null, retry = null;
  let networkDelay = 1500, memoryOnly = false, statusText = 'Conectando al PC…';
  const queue = new Map(load('pending', []).filter(item => item?.runId && item?.report).map(item => [item.runId, item]));
  const providers = new Map(), sessions = new Map();

  const panel = document.createElement('aside');
  panel.id = 'webar-local-reports';
  panel.style.cssText = 'position:fixed;bottom:6px;left:6px;right:6px;max-width:510px;z-index:10000;background:#102a43;color:#fff;padding:7px 10px;border-radius:8px;font:13px/1.35 system-ui;box-shadow:0 2px 12px #0005';
  panel.innerHTML = '<details><summary style="cursor:pointer" aria-live="polite">Diagnóstico local: conectando…</summary><div style="padding-top:8px">' +
    '<label>Equipo <input data-label maxlength="80" style="max-width:180px;padding:5px"></label> ' +
    '<label><input type="checkbox" data-enabled>Envío automático</label><br>' +
    '<label><input type="checkbox" data-physical>Estoy probando un equipo físico</label>' +
    '<p style="margin:6px 0">Solo estadísticas. Sin imágenes, vídeo ni mapas. Se guardan en tu computador.</p>' +
    '<button type="button" data-send>Enviar ahora</button> <button type="button" data-next>Guardar y siguiente</button> ' +
    '<a data-home style="color:#8edbff">Recorrido</a><p data-status style="margin:6px 0"></p></div></details>';
  document.body.append(panel);
  const summary = panel.querySelector('summary'), detail = panel.querySelector('[data-status]');
  panel.querySelector('[data-home]').href = new URL('mobile.html', dashboard).href;
  panel.querySelector('[data-label]').value = client.label;
  panel.querySelector('[data-enabled]').checked = enabled;
  panel.querySelector('[data-physical]').checked = physical;
  function render() {
    const pending = queue.size;
    summary.textContent = !enabled ? 'Diagnóstico local: pausado' : failure ? `PC sin conexión · ${pending} pendiente(s)` : lastAck ? `PC: recibido · ${client.label}${pending ? ' · pendientes: ' + pending : ''}` : 'Diagnóstico local: ' + statusText;
    detail.textContent = statusText + (memoryOnly ? ' La cola está solo en memoria: almacenamiento del navegador no disponible.' : '');
  }
  function persist() {
    while (queue.size > 16 || JSON.stringify([...queue.values()]).length > 700000) queue.delete(queue.keys().next().value);
    memoryOnly = !save('pending', [...queue.values()]); render();
  }
  function context() {
    return { platform, execution: navigator.webdriver ? 'automated' : physical ? 'physical-user-reported' : 'unspecified', scenario: example.replace(/\.html$/, '') };
  }
  function registerScene(scene) {
    if (providers.has(scene)) return;
    providers.set(scene, { snapshot: () => scene.getDiagnosticsReport?.(), setContext: value => scene.diagnostics?.setContext(value), stop: () => scene.stop() });
  }
  document.querySelectorAll('webar-scene').forEach(registerScene);
  for (const event of ['ar-status', 'ar-ready', 'ar-error', 'ar-stopped']) {
    document.addEventListener(event, message => {
      const scene = message.target?.closest?.('webar-scene');
      if (!scene) return;
      registerScene(scene);
      if (event !== 'ar-status' || ['camera-ready', 'xr-ended'].includes(message.detail?.message)) collect(event === 'ar-stopped' ? 'stopped' : event === 'ar-error' ? 'error' : message.detail?.message === 'xr-ended' ? 'xr-ended' : 'ready');
    }, true);
  }
  function collect(reason, transmit = true) {
    if (!enabled) return;
    for (const [key, provider] of providers) {
      provider.setContext(context());
      const report = provider.snapshot();
      if (!report || (reason === 'interval' && !report.recording)) continue;
      let session = sessions.get(key);
      if (!session || session.createdAt !== report.createdAt) {
        session = { createdAt: report.createdAt, id: uuid(), sequence: 0 }; sessions.set(key, session);
      }
      const item = { schemaVersion: 1, client: { ...client }, runId: session.id, sequence: ++session.sequence, example, reason, sentAt: new Date().toISOString(), report };
      queue.set(item.runId, item);
    }
    persist(); if (transmit) void drain();
  }
  function scheduleRetry() {
    if (retry || !enabled || !queue.size) return;
    retry = setTimeout(() => { retry = null; void drain(); }, networkDelay);
    networkDelay = Math.min(30000, networkDelay * 2);
  }
  async function connect() {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(new URL('?action=config', endpoint), { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Recolector HTTP ' + response.status);
      config = await response.json();
    } finally { clearTimeout(timeout); }
    if (!config.token || !Array.isArray(config.examples)) throw new Error('Recolector no disponible');
    failure = false; statusText = 'Conectado. Envío cada 15 s y al detener o salir.'; render();
  }
  function drain() {
    if (running || !enabled) return running || Promise.resolve();
    if (config && !queue.size) return Promise.resolve();
    running = (async () => {
      try {
        if (!config) await connect();
        for (const item of [...queue.values()]) {
          const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 6000);
          try {
            const response = await fetch(new URL('?action=report', endpoint), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...item, token: config.token }), signal: controller.signal,
            });
            const body = await response.json();
            if (!response.ok || !body.ok) {
              if (response.status === 403) config = null;
              throw new Error(body.error || 'No se pudo guardar en el PC');
            }
            if (queue.get(item.runId)?.sequence === item.sequence) queue.delete(item.runId);
            lastAck = Date.now(); failure = false; networkDelay = 1500;
            statusText = 'PC confirmó recepción: ' + new Date(lastAck).toLocaleTimeString(); persist();
          } finally { clearTimeout(deadline); }
        }
      } catch (error) {
        failure = true; statusText = 'Pendiente de envío: ' + error.message; render();
      } finally { running = null; if (queue.size) scheduleRetry(); }
    })();
    return running;
  }
  function beacon(reason) {
    collect(reason, false);
    if (!enabled || !config) return;
    // sendBeacon no confirma recepción: la copia pendiente se conserva hasta un ACK.
    for (const item of queue.values()) {
      const compact = { ...item, report: { ...item.report } };
      let body = JSON.stringify({ ...compact, token: config.token });
      if (new TextEncoder().encode(body).byteLength > 56000) {
        const timeline = item.report.timeline || [];
        compact.report.timeline = timeline.length > 40 ? [...timeline.slice(0, 8), ...timeline.slice(-24)] : timeline;
        compact.report.observations = (item.report.observations || []).slice(-5);
        body = JSON.stringify({ ...compact, token: config.token });
      }
      if (new TextEncoder().encode(body).byteLength <= 56000) navigator.sendBeacon?.(new URL('?action=report', endpoint), new Blob([body], { type: 'application/json' }));
    }
  }
  panel.querySelector('[data-label]').onchange = event => { client.label = event.target.value.trim().slice(0, 80) || platform; save('label', client.label); render(); };
  panel.querySelector('[data-enabled]').onchange = event => { enabled = event.target.checked; save('enabled', enabled); render(); if (enabled) collect('manual'); };
  panel.querySelector('[data-physical]').onchange = event => { physical = event.target.checked; save('physical', physical); };
  panel.querySelector('[data-send]').onclick = () => collect('manual');
  panel.querySelector('[data-next]').onclick = async event => {
    event.target.disabled = true;
    try {
      for (const provider of providers.values()) await provider.stop();
      collect('next', false);
      await Promise.race([drain(), new Promise(resolve => setTimeout(resolve, 4000))]);
      if (!config) { statusText = 'Sin conexión: utiliza la galería cuando vuelva la red.'; render(); return; }
      const index = config.examples.indexOf(example), next = config.examples[index + 1];
      const destination = next ? new URL(next, script.src) : new URL('mobile.html', dashboard);
      destination.pathname = destination.pathname.replace(/\/{2,}/g, '/');
      location.href = destination.href;
    } finally { event.target.disabled = false; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') beacon('hidden'); else void drain(); });
  addEventListener('pagehide', () => beacon('pagehide'));
  addEventListener('online', () => { networkDelay = 1500; void drain(); });

  // Puente opcional para ejemplos que crean su engine fuera de webar-scene (A-Frame).
  function attachEngine(engine, options = {}) {
    let recorder = null;
    const provider = {
      snapshot: () => {
        const renderer = options.getRenderer?.();
        if (recorder && renderer) {
          const size = renderer.getDrawingBufferSize(new WebARFacil.THREE.Vector2());
          recorder.recordRenderer({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, drawingBufferWidth: size.x, drawingBufferHeight: size.y, pixelRatio: renderer.getPixelRatio() });
        }
        const report = recorder?.snapshot();
        const metricScale = options.metricScale?.();
        return report && metricScale ? {...report, metricScale} : report;
      },
      setContext: value => recorder?.setContext(value), stop: () => engine.stop(),
    };
    providers.set(engine, provider);
    const off = engine.onStatus(status => {
      if (['camera-requesting', 'starting-webxr'].includes(status) && (!recorder || !recorder.snapshot().recording)) {
        recorder = new WebARFacil.ARDiagnostics(engine, { configuration: options.configuration || {}, context: context() });
        void recorder.probeCapabilities();
      }
      if (status === 'camera-ready') collect('ready');
      if (status === 'stopped') { recorder?.stop(); collect('stopped'); }
    });
    const offError = engine.onError(error => { recorder?.recordError(error); recorder?.stop(); collect('error'); });
    const reportError = event => { if (event.target?.closest?.('webar-scene')) return; recorder?.recordError(event.detail instanceof Error ? event.detail : new Error(String(event.detail))); collect('error'); };
    document.addEventListener('ar-error', reportError, true); document.addEventListener('ar-model-error', reportError, true);
    return () => { recorder?.stop(); collect('stopped'); off(); offError(); document.removeEventListener('ar-error', reportError, true); document.removeEventListener('ar-model-error', reportError, true); providers.delete(engine); };
  }
  globalThis.WebARLocalReports = Object.freeze({ attachEngine, send: () => collect('manual'), getClient: () => ({ ...client }) });
  timer = setInterval(() => collect('interval'), 15000);
  void drain(); render();
})();
