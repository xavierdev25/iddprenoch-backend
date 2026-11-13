#!/usr/bin/env node
/**
 * Spike (c): N electores consultando GET /api/spike/estado cada 3 s ± 1 s (ADR-028).
 *
 * La carga sube por escalones (por defecto 25 → 50 → 100 → 150 → 200 electores, 60 s cada uno) y el
 * script se DETIENE ante el PRIMER error de cualquier tipo: es el sitio en producción, y una IP
 * bloqueada por el firewall del hosting dejaría sin acceso al propio administrador. Solo 200 y 304
 * cuentan como respuesta correcta. Los errores se separan por origen:
 *   - limiteApp:     429 (rate limiter de la API; las rutas del spike no lo usan, ver ADR-028)
 *   - limiteHosting: 503 / 508 (Entry Processes de CloudLinux, Passenger saturado)
 *   - conexion:      timeout, conexión rechazada o cortada (típico de un bloqueo de firewall)
 *   - otros:         cualquier otro código (403 de mod_security, 404, 500…)
 *
 * Uso (de madrugada):
 *   node loadtest/spike-electores.mjs --url https://iddprenoch.com --token <SPIKE_TOKEN>
 * Opcionales: --escalones 25,50,100,150,200  --duracion 60
 *
 * Sin dependencias: usa el fetch de Node 22. Deja el resultado en loadtest/resultados/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, a, i, arr) => (a.startsWith('--') ? [...pares, [a.slice(2), arr[i + 1]]] : pares), []),
);
const URL_BASE = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = args.token;
const ESCALONES = (args.escalones ?? '25,50,100,150,200').split(',').map(Number);
const DURACION_S = Number(args.duracion ?? 60);

/** Clasifica un código HTTP o un error de red por su origen probable. */
function categoria(codigo) {
  if (codigo === 200 || codigo === 304) return 'ok';
  if (codigo === 429) return 'limiteApp';
  if (codigo === 503 || codigo === 508) return 'limiteHosting';
  if (typeof codigo === 'string') return 'conexion';
  return 'otros';
}

if (!TOKEN) {
  console.error('Falta --token (el SPIKE_TOKEN configurado en cPanel).');
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const percentil = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

let detener = false;
let motivoParada = '';

function parar(motivo) {
  if (!detener) {
    detener = true;
    motivoParada = motivo;
    console.log(`\n■ PARADA INMEDIATA: ${motivo}`);
  }
}

/** Un elector: consulta, espera 3 s ± 1 s, repite. Guarda en `m` lo que observa. */
async function elector(m, hasta) {
  let etag = '';
  // Arranque escalonado: si los N empezaran en el mismo milisegundo, mediríamos una ráfaga
  // artificial que en una asamblea real no ocurre.
  await dormir(Math.random() * 3000);
  while (!detener && Date.now() < hasta) {
    const t0 = performance.now();
    try {
      const res = await fetch(`${URL_BASE}/api/spike/estado`, {
        headers: { 'x-spike-token': TOKEN, ...(etag ? { 'If-None-Match': etag } : {}) },
        signal: AbortSignal.timeout(10_000),
      });
      await res.arrayBuffer();
      const ms = performance.now() - t0;
      m.latencias.push(ms);
      m.codigos[res.status] = (m.codigos[res.status] ?? 0) + 1;
      const pid = res.headers.get('x-spike-pid');
      if (pid) m.pids.add(pid);
      const msServidor = Number(res.headers.get('x-spike-ms'));
      if (!Number.isNaN(msServidor)) m.msServidor.push(msServidor);
      etag = res.headers.get('etag') ?? etag;
      if (categoria(res.status) !== 'ok') parar(`HTTP ${res.status} (${categoria(res.status)})`);
    } catch (err) {
      // fetch envuelve el error de red en `cause` (ECONNREFUSED, ECONNRESET, ETIMEDOUT…).
      const tipo = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? 'red');
      m.codigos[tipo] = (m.codigos[tipo] ?? 0) + 1;
      parar(`error de conexión: ${tipo}`);
    }
    await dormir(2000 + Math.random() * 2000);
  }
}

async function escalon(n) {
  const m = { latencias: [], msServidor: [], codigos: {}, pids: new Set() };
  const hasta = Date.now() + DURACION_S * 1000;
  console.log(`\n▶ ${n} electores durante ${DURACION_S} s…`);
  await Promise.all(Array.from({ length: n }, () => elector(m, hasta)));

  const total = Object.values(m.codigos).reduce((a, b) => a + b, 0);
  const errores = { limiteApp: 0, limiteHosting: 0, conexion: 0, otros: 0 };
  for (const [codigo, cantidad] of Object.entries(m.codigos)) {
    const cat = categoria(/^\d+$/.test(codigo) ? Number(codigo) : codigo);
    if (cat !== 'ok') errores[cat] += cantidad;
  }
  const fallos = Object.values(errores).reduce((a, b) => a + b, 0);
  const resumen = {
    electores: n,
    completo: !detener,
    peticiones: total,
    porSegundo: +(total / DURACION_S).toFixed(1),
    codigos: m.codigos,
    errores,
    tasaFallos: total ? +(fallos / total).toFixed(4) : 0,
    msCliente: {
      p50: +percentil(m.latencias, 0.5).toFixed(0),
      p95: +percentil(m.latencias, 0.95).toFixed(0),
      p99: +percentil(m.latencias, 0.99).toFixed(0),
      max: +Math.max(0, ...m.latencias).toFixed(0),
    },
    // Tiempo dentro de Node: el objetivo de < 50 ms se mide aquí; el resto es red y Apache.
    msServidor: { p95: +percentil(m.msServidor, 0.95).toFixed(2), max: +Math.max(0, ...m.msServidor).toFixed(2) },
    pids: [...m.pids],
  };
  console.log(JSON.stringify(resumen));
  if (resumen.pids.length > 1) console.log('  ⚠ Más de un pid: Passenger está usando varios procesos.');
  return resumen;
}

const resultados = [];
const inicio = new Date();
for (const n of ESCALONES) {
  resultados.push(await escalon(n));
  if (detener) {
    console.log(`\n■ Detenido: ${motivoParada}.`);
    break;
  }
  await dormir(10_000); // Respiro entre escalones para que el hosting se recupere.
}

const dir = join(dirname(fileURLToPath(import.meta.url)), 'resultados');
mkdirSync(dir, { recursive: true });
const archivo = join(dir, `spike-electores-${inicio.toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(archivo, JSON.stringify({ url: URL_BASE, inicio, detenido: motivoParada || null, resultados }, null, 2));
console.log(`\nResultado guardado en ${archivo}`);
