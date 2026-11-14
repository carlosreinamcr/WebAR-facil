/*! Creador: IngCarlosReina. - Realidad Aumentada Empezando Desde Cero
 * Web: https://realidad-aumentada.com.co
 * Blog: https://blog.realidad-aumentada.com.co
 * YouTube: https://www.youtube.com/@carlosreinamcr
 */
(() => {
  const api = new URL('api.php', location.href), mobile = document.body.dataset.view === 'mobile';
  const $ = selector => document.querySelector(selector), PREFIX = 'webar-local-reports-v1:';
  const get = (key, fallback) => { try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback; } catch { return fallback; } };
  const set = (key, value) => { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {} };
  const id = get('clientId', null) || crypto.randomUUID(); set('clientId', id);
  const number = value => typeof value === 'number' ? value.toFixed(1) + ' ms' : '—';
  let data = null, loading = false;
  function node(tag, value) { const element = document.createElement(tag); element.textContent = value; return element; }
  if (mobile) {
    const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computador';
    $('#label').value = get('label', platform); $('#physical').checked = get('physical', false);
    $('#label').onchange = event => set('label', event.target.value.trim());
    $('#physical').onchange = event => set('physical', event.target.checked);
  } else {
    for (const selector of ['#device', '#example', '#latest', '#automated']) $(selector).onchange = render;
    $('#close').onclick = () => { $('#detail').hidden = true; };
  }
  async function detail(id) {
    try {
      const url = new URL('?action=report&id=' + encodeURIComponent(id), api);
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo abrir el informe');
      $('#json').textContent = JSON.stringify(await response.json(), null, 2);
      url.searchParams.set('download', '1'); $('#download').href = url.href;
      $('#detail').hidden = false; $('#detail').scrollIntoView({ block: 'start' });
    } catch (error) { $('#connection').textContent = error.message; }
  }
  function render() {
    if (!data) return;
    if (mobile) {
      const reports = data.reports.filter(report => report.client.id === id);
      $('#recipes').replaceChildren();
      for (const file of data.examples) {
        const report = reports.find(report => report.example === file), li = document.createElement('li');
        const link = node('a', file.replace('.html', '').replaceAll('-', ' ')); link.href = new URL('../Examples/' + file, location.href).href;
        const state = node('small', report ? `Recibido en el PC · ${report.poses} poses · ${new Date(report.receivedAt).toLocaleTimeString()}` : 'Todavía sin informe de este equipo');
        state.className = report ? 'ok' : 'pending'; li.append(link, state); $('#recipes').append(li);
      }
      $('#counts').textContent = `${new Set(reports.map(report => report.example)).size} de ${data.examples.length} ejemplos con datos recibidos de este equipo.`;
      return;
    }
    let reports = data.reports.filter(report => $('#automated').checked || report.execution !== 'automated');
    const current = $('#device').value;
    const clients = new Map(reports.map(report => [report.client.id, report.client.label || report.client.platform]));
    $('#device').replaceChildren(new Option('Todos', ''));
    for (const [id, label] of clients) $('#device').add(new Option(label + ' · ' + id.slice(0, 6), id));
    if (clients.has(current)) $('#device').value = current;
    if ($('#example').options.length === 1) for (const file of data.examples) $('#example').add(new Option(file, file));
    if ($('#device').value) reports = reports.filter(report => report.client.id === $('#device').value);
    if ($('#example').value) reports = reports.filter(report => report.example === $('#example').value);
    if ($('#latest').checked) {
      const seen = new Set(); reports = reports.filter(report => { const key = report.client.id + ':' + report.example; if (seen.has(key)) return false; seen.add(key); return true; });
    }
    $('#rows').replaceChildren();
    for (const report of reports) {
      const row = document.createElement('tr'), age = Math.max(0, Math.round((Date.now() - Date.parse(report.receivedAt)) / 1000));
      const backends = Object.keys(report.backends || {}).join(', ') || 'Sin poses';
      const values = [new Date(report.receivedAt).toLocaleString() + ` · hace ${age}s`, report.client.label + ' · ' + report.client.platform,
        report.example, report.state + ' / ' + report.reason, backends, String(report.poses), number(report.firstPoseMs), number(report.processingP95), number(report.readbackP95),
        report.performance + ' / ' + (report.sdk.build || '—'), String(report.errors)];
      for (const value of values) row.append(node('td', value));
      const cell = document.createElement('td'), button = node('button', 'Ver JSON'); button.onclick = () => detail(report.id); cell.append(button); row.append(cell); $('#rows').append(row);
    }
    const automated = data.reports.filter(report => report.execution === 'automated').length;
    $('#counts').textContent = `${reports.length} informes mostrados · ${clients.size} equipos · ${automated} registros automatizados identificados aparte. Recibido no equivale a aprobado.`;
  }
  async function refresh() {
    if (loading) return; loading = true;
    try {
      const response = await fetch(new URL('?action=list', api), { cache: 'no-store' });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Error del recolector');
      data = body; $('#connection').textContent = 'Conectado al servidor local · ' + new Date().toLocaleTimeString(); render();
    } catch (error) { $('#connection').textContent = 'Sin conexión: ' + error.message; }
    finally { loading = false; }
  }
  void refresh(); setInterval(() => { if (document.visibilityState !== 'hidden') void refresh(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void refresh(); });
})();
