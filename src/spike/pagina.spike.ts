/**
 * Página de diagnóstico del spike (/api/spike/socket?t=TOKEN). Se abre desde un celular o una PC
 * en la red real y muestra en vivo transporte, pid y latencias. El JS va en un archivo aparte
 * porque la CSP de helmet (script-src 'self') bloquea los scripts inline.
 */
export const PAGINA_SPIKE = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spike tiempo real</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 16px; background: #f8f7f4; color: #1c2b28; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  section { background: #fff; border: 1px solid #dcd8cf; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .06em; color: #5b6b67; margin: 0 0 8px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; margin: 0; }
  dt { color: #5b6b67; } dd { margin: 0; font-weight: 600; word-break: break-all; }
  .ok { color: #11743f; } .mal { color: #b42318; }
  button { font: inherit; padding: 10px 16px; border-radius: 8px; border: 0; background: #0f5c4d; color: #fff; min-height: 48px; width: 100%; }
  pre { font-size: 12px; overflow-x: auto; background: #f1efe9; padding: 8px; border-radius: 8px; }
</style>
</head>
<body>
<h1>Spike de tiempo real — iddprenoch.com</h1>
<section>
  <h2>Socket.IO (panel admin y proyección)</h2>
  <dl>
    <dt>Estado</dt><dd id="estado">conectando…</dd>
    <dt>Transporte inicial</dt><dd id="t-inicial">—</dd>
    <dt>Transporte actual</dt><dd id="t-actual">—</dd>
    <dt>¿Pasa WebSocket?</dt><dd id="ws">esperando…</dd>
    <dt>pids vistos</dt><dd id="pids">—</dd>
    <dt>Ping (último / p50 / p95 / máx)</dt><dd id="rtt">—</dd>
    <dt>Difusión (última)</dt><dd id="difusion">—</dd>
  </dl>
  <p><button id="difundir" type="button">Difundir a todos los conectados</button></p>
</section>
<section>
  <h2>Polling del elector (GET cada 3 s)</h2>
  <dl>
    <dt>Respuestas</dt><dd id="poll-codigos">—</dd>
    <dt>pids vistos</dt><dd id="poll-pids">—</dd>
    <dt>Tiempo (último / p95)</dt><dd id="poll-ms">—</dd>
  </dl>
</section>
<section>
  <h2>Servidor (/api/spike/info)</h2>
  <pre id="info">cargando…</pre>
</section>
<script src="/api/socket.io/socket.io.js"></script>
<script src="/api/spike/socket.js"></script>
</body>
</html>`;

export const SCRIPT_SPIKE = `(() => {
  const token = new URLSearchParams(location.search).get('t') || '';
  const $ = (id) => document.getElementById(id);
  const p = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  const rtts = [], pids = new Set(), pollMs = [], pollPids = new Set(), codigos = {};

  const socket = io({ path: '/api/socket.io', auth: { token } });
  socket.on('connect', () => { $('estado').textContent = 'conectado'; $('estado').className = 'ok'; });
  socket.on('connect_error', (e) => { $('estado').textContent = 'error: ' + e.message; $('estado').className = 'mal'; });
  socket.on('disconnect', (r) => { $('estado').textContent = 'desconectado: ' + r; $('estado').className = 'mal'; });
  socket.on('spike:hola', (d) => { $('t-inicial').textContent = d.transporte; pids.add(d.pid); $('pids').textContent = [...pids].join(', '); });
  socket.io.on('open', () => {
    const engine = socket.io.engine;
    $('t-actual').textContent = engine.transport.name;
    engine.on('upgrade', (t) => { $('t-actual').textContent = t.name; $('ws').textContent = 'SÍ (upgrade a ' + t.name + ')'; $('ws').className = 'ok'; });
  });
  // Si a los 10 s seguimos en polling, el upgrade a WebSocket no pasó por Apache/Passenger.
  setTimeout(() => {
    if ($('ws').textContent === 'esperando…') { $('ws').textContent = 'NO — sigue en ' + (socket.io.engine ? socket.io.engine.transport.name : '?'); $('ws').className = 'mal'; }
  }, 10000);

  setInterval(() => {
    if (!socket.connected) return;
    const t = performance.now();
    socket.timeout(5000).emit('spike:ping', Date.now(), (err, r) => {
      if (err) return;
      const ms = performance.now() - t; rtts.push(ms); if (rtts.length > 300) rtts.shift();
      pids.add(r.pid); $('pids').textContent = [...pids].join(', ') + (pids.size > 1 ? '  ⚠ MÁS DE UN PROCESO' : '');
      $('t-actual').textContent = r.transporte;
      $('rtt').textContent = [ms, p(rtts, .5), p(rtts, .95), Math.max(...rtts)].map((x) => x.toFixed(0) + ' ms').join(' / ');
    });
  }, 1000);

  socket.on('spike:difusion', (d) => { $('difusion').textContent = (Date.now() - d.t) + ' ms (si la emitiste desde este equipo) · pid ' + d.pid; });
  $('difundir').addEventListener('click', () => socket.emit('spike:difundir', Date.now()));

  let etag = '';
  async function sondear() {
    const t = performance.now();
    try {
      const r = await fetch('/api/spike/estado?t=' + encodeURIComponent(token), { headers: etag ? { 'If-None-Match': etag } : {}, cache: 'no-store' });
      etag = r.headers.get('etag') || etag;
      codigos[r.status] = (codigos[r.status] || 0) + 1;
      pollPids.add(r.headers.get('x-spike-pid'));
    } catch (e) { codigos.red = (codigos.red || 0) + 1; }
    const ms = performance.now() - t; pollMs.push(ms); if (pollMs.length > 300) pollMs.shift();
    $('poll-codigos').textContent = Object.entries(codigos).map(([k, v]) => k + ': ' + v).join(' · ');
    $('poll-pids').textContent = [...pollPids].join(', ');
    $('poll-ms').textContent = ms.toFixed(0) + ' ms / ' + p(pollMs, .95).toFixed(0) + ' ms';
    setTimeout(sondear, 2000 + Math.random() * 2000);
  }
  sondear();

  fetch('/api/spike/info?t=' + encodeURIComponent(token)).then((r) => r.json()).then((d) => { $('info').textContent = JSON.stringify(d, null, 2); });
})();`;
