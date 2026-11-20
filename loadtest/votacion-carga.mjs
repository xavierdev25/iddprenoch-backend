#!/usr/bin/env node
/**
 * Prueba de carga real de la votación (HU16): N electores (por defecto 200) que ingresan,
 * consultan el estado cada 3 s ± 1 s y VOTAN, todos dentro del mismo minuto. Sin dependencias:
 * usa el fetch de Node 22, igual que el spike (ADR-028); ver ADR-030 #16.
 *
 * Fases:
 *   1. Preparación (cuenta de administrador): asamblea "PRUEBA DE CARGA", un cargo con 3
 *      candidatos y N electores en el padrón, acreditados (se guardan sus códigos en memoria).
 *   2. Ingreso escalonado de los N electores en 30 s, con polling del estado.
 *   3. Apertura de la votación y N votos repartidos al azar dentro de 60 s (polling incluido).
 *   4. Cierre y verificación: votos contados = votos aceptados = emisiones.
 *   5. Limpieza: se borra la asamblea de prueba (salvo --conservar).
 *
 * Reglas de parada (las mismas del spike): ante el PRIMER error de cualquier tipo —429, 403,
 * 5xx, timeout, conexión rechazada— se deja de enviar carga, se cierra la votación y se limpia.
 * Los errores se reportan separados: limiteApp (429), limiteHosting (503/508), conexion, otros.
 *
 * Uso:
 *   LOADTEST_USUARIO=… LOADTEST_PASSWORD=… node loadtest/votacion-carga.mjs --url https://iddprenoch.com
 * Opcionales: --electores 200  --conservar
 * El usuario debe ser "Responsable del sistema" (la limpieza borra una asamblea con votos).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pares, a, i, arr) => (a.startsWith('--') ? [...pares, [a.slice(2), arr[i + 1]?.startsWith('--') ? true : (arr[i + 1] ?? true)]] : pares), []),
);
const URL_BASE = String(args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const N = Number(args.electores ?? 200);
const CONSERVAR = Boolean(args.conservar);
const USUARIO = process.env.LOADTEST_USUARIO;
const PASSWORD = process.env.LOADTEST_PASSWORD;
if (!USUARIO || !PASSWORD) {
  console.error('Faltan LOADTEST_USUARIO y LOADTEST_PASSWORD (cuenta "Responsable del sistema").');
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const percentil = (arr, q) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]);
};
const log = (...m) => console.log(`[${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}]`, ...m);

function categoria(codigo) {
  if (codigo === 429) return 'limiteApp';
  if (codigo === 503 || codigo === 508) return 'limiteHosting';
  if (typeof codigo === 'string') return 'conexion';
  return 'otros';
}

let detener = false;
let motivoParada = '';
function parar(motivo) {
  if (detener) return;
  detener = true;
  motivoParada = motivo;
  log(`■ PARADA INMEDIATA: ${motivo}`);
}

/** Métricas por operación: latencias y códigos. */
const metricas = {};
function registrar(op, ms, codigo) {
  const m = (metricas[op] ??= { latencias: [], codigos: {} });
  if (ms !== null) m.latencias.push(ms);
  m.codigos[codigo] = (m.codigos[codigo] ?? 0) + 1;
}

/** Una petición medida. `ok` = códigos aceptables para esa operación; todo lo demás detiene. */
async function pedir(op, metodo, ruta, { body, cookie, headers = {}, ok = [200, 201, 204, 304] } = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${URL_BASE}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const texto = await res.text();
    registrar(op, performance.now() - t0, res.status);
    if (!ok.includes(res.status)) parar(`${op}: HTTP ${res.status} (${categoria(res.status)}) ${texto.slice(0, 120)}`);
    return { status: res.status, headers: res.headers, body: texto ? safeJson(texto) : undefined };
  } catch (err) {
    const tipo = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? 'red');
    registrar(op, null, tipo);
    parar(`${op}: error de conexión ${tipo}`);
    return { status: 0 };
  }
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/** Ejecuta tareas con concurrencia limitada (para la preparación: no saturar a propósito). */
async function enLotes(items, concurrencia, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrencia }, async () => {
      while (i < items.length && !detener) await fn(items[i++]);
    }),
  );
}

// ─── 1. Preparación ───────────────────────────────────────────────────────────────────────────
const inicio = new Date();
log(`Prueba de carga contra ${URL_BASE} con ${N} electores`);
const login = await pedir('admin.login', 'POST', '/api/auth/login', { body: { nombre: USUARIO, password: PASSWORD } });
if (login.status !== 200) process.exit(2);
const admin = login.headers.get('set-cookie').split(';')[0];
const sufijo = inicio.toISOString().slice(0, 16).replace('T', ' ');
const asamblea = (
  await pedir('admin.preparar', 'POST', '/api/asambleas', {
    cookie: admin,
    body: { nombre: `PRUEBA DE CARGA ${sufijo}`, tipo: 'REGIONAL', fecha: inicio.toISOString() },
  })
).body;
const eleccion = (await pedir('admin.preparar', 'POST', `/api/asambleas/${asamblea.id}/elecciones`, { cookie: admin, body: { cargo: 'Cargo de prueba' } })).body;
const candidatos = [];
for (const nombre of ['Candidato Uno', 'Candidato Dos', 'Candidato Tres']) {
  candidatos.push((await pedir('admin.preparar', 'POST', `/api/elecciones/${eleccion.id}/candidatos`, { cookie: admin, body: { nombre } })).body.id);
}
const electores = Array.from({ length: N }, (_, i) => ({ dni: String(99000000 + i), codigo: '' }));
log(`Asamblea ${asamblea.codigoAcceso} creada. Cargando y acreditando ${N} electores…`);
await enLotes(electores, 4, async (e) => {
  await pedir('admin.padron', 'POST', `/api/asambleas/${asamblea.id}/electores`, { cookie: admin, body: { dni: e.dni, nombre: `Elector de prueba ${e.dni}` } });
  const r = await pedir('admin.acreditar', 'POST', `/api/asambleas/${asamblea.id}/acreditar`, { cookie: admin, body: { dni: e.dni } });
  e.codigo = r.body?.codigo ?? '';
});

// ─── 2–3. Ingreso, polling y votos ───────────────────────────────────────────────────────────
const resultadoVotos = { aceptados: 0, porCandidato: Object.fromEntries(candidatos.map((c) => [c, 0])) };
let abiertaEn = 0;

async function elector(e) {
  // Ingreso escalonado en 30 s: así llegan a una asamblea real, no en el mismo milisegundo.
  await dormir(Math.random() * 30_000);
  if (detener) return;
  const r = await pedir('elector.ingresar', 'POST', `/api/votacion/${asamblea.codigoAcceso}/ingresar`, { body: { dni: e.dni, codigo: e.codigo } });
  if (r.status !== 200) return;
  const cookie = r.headers.get('set-cookie').split(';')[0];
  let etag = '';
  let voto = false;
  let votarEn = 0;
  // Polling hasta haber votado y 20 s más (como un celular que se queda en la pantalla de espera).
  for (let hasta = Infinity; !detener && Date.now() < hasta; ) {
    const est = await pedir('elector.estado', 'GET', `/api/votacion/${asamblea.codigoAcceso}/estado`, { cookie, headers: etag ? { 'If-None-Match': etag } : {} });
    etag = est.headers?.get('etag') ?? etag;
    const abierta = est.status === 200 ? est.body.estado === 'ABIERTA' && !est.body.yaVoto : abiertaEn > 0 && !voto;
    if (abierta && !voto) {
      votarEn ||= abiertaEn + Math.random() * 60_000; // cada uno vota en algún momento del minuto
      if (Date.now() >= votarEn) {
        const ced = await pedir('elector.cedula', 'GET', `/api/votacion/${asamblea.codigoAcceso}/cedula`, { cookie });
        const candidato = ced.body?.candidatos?.[Math.floor(Math.random() * 3)]?.id;
        if (candidato) {
          const v = await pedir('elector.votar', 'POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, {
            cookie,
            body: { eleccionId: eleccion.id, candidatoId: candidato },
            ok: [201],
          });
          if (v.status === 201) {
            voto = true;
            resultadoVotos.aceptados += 1;
            resultadoVotos.porCandidato[candidato] += 1;
            hasta = Date.now() + 20_000;
          }
        }
      }
    }
    await dormir(2000 + Math.random() * 2000);
  }
}

log('Ingreso escalonado de electores (30 s)…');
const tareas = electores.map((e) => elector(e));
await dormir(32_000);
if (!detener) {
  const r = await pedir('admin.abrir', 'POST', `/api/elecciones/${eleccion.id}/abrir`, { cookie: admin });
  if (r.status === 200) {
    abiertaEn = Date.now();
    log('Votación ABIERTA: los electores votan dentro de los próximos 60 s…');
  }
}
// Se espera a que todos voten (o a la parada), con un tope de 2 min por seguridad.
await Promise.race([Promise.all(tareas), dormir(150_000)]);
if (!detener && resultadoVotos.aceptados < N) parar(`solo ${resultadoVotos.aceptados} de ${N} electores lograron votar en el tiempo previsto`);
detener = true;

// ─── 4. Cierre y verificación ────────────────────────────────────────────────────────────────
let verificacion = null;
if (abiertaEn) {
  const cierre = await pedir('admin.cerrar', 'POST', `/api/elecciones/${eleccion.id}/cerrar`, { cookie: admin, ok: [200, 409] });
  const conteo = cierre.status === 200 ? cierre.body : (await pedir('admin.conteo', 'GET', `/api/elecciones/${eleccion.id}/conteo`, { cookie: admin })).body;
  verificacion = {
    votosAceptadosPorElCliente: resultadoVotos.aceptados,
    emisionesEnServidor: conteo?.emisiones,
    votosContadosEnServidor: conteo?.total,
    cuadra: conteo?.emisiones === resultadoVotos.aceptados && conteo?.total === resultadoVotos.aceptados,
    porCandidatoCuadra: (conteo?.candidatos ?? []).every((c) => c.votos === resultadoVotos.porCandidato[c.id]),
  };
  log('Verificación:', JSON.stringify(verificacion));
}

// ─── 5. Limpieza ─────────────────────────────────────────────────────────────────────────────
if (!CONSERVAR && asamblea?.id) {
  const borrado = await fetch(`${URL_BASE}/api/asambleas/${asamblea.id}?forzar=1`, { method: 'DELETE', headers: { Cookie: admin } }).catch(() => null);
  log(`Limpieza: asamblea de prueba ${borrado?.status === 204 ? 'eliminada' : `NO eliminada (HTTP ${borrado?.status ?? 'sin conexión'}); bórrala desde el panel`}.`);
}

// ─── Reporte ─────────────────────────────────────────────────────────────────────────────────
const errores = { limiteApp: 0, limiteHosting: 0, conexion: 0, otros: 0 };
const operaciones = Object.fromEntries(
  Object.entries(metricas).map(([op, m]) => {
    for (const [codigo, n] of Object.entries(m.codigos)) {
      const num = Number(codigo);
      const esOk = [200, 201, 204, 304].includes(num) || (op === 'admin.cerrar' && num === 409);
      if (!esOk) errores[categoria(Number.isNaN(num) ? codigo : num)] += n;
    }
    return [op, { peticiones: Object.values(m.codigos).reduce((a, b) => a + b, 0), codigos: m.codigos, ms: { p50: percentil(m.latencias, 0.5), p95: percentil(m.latencias, 0.95), p99: percentil(m.latencias, 0.99), max: Math.round(Math.max(0, ...m.latencias)) } }];
  }),
);
const reporte = {
  url: URL_BASE,
  electores: N,
  inicio,
  fin: new Date(),
  detenido: motivoParada || null,
  votosAceptados: resultadoVotos.aceptados,
  errores,
  verificacion,
  operaciones,
};
console.log('\n' + JSON.stringify({ detenido: reporte.detenido, votosAceptados: reporte.votosAceptados, errores, verificacion }, null, 2));
console.table(Object.fromEntries(Object.entries(operaciones).map(([op, o]) => [op, { peticiones: o.peticiones, p50: o.ms.p50, p95: o.ms.p95, p99: o.ms.p99, max: o.ms.max }])));
const dir = join(dirname(fileURLToPath(import.meta.url)), 'resultados');
mkdirSync(dir, { recursive: true });
const archivo = join(dir, `votacion-carga-${inicio.toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(archivo, JSON.stringify(reporte, null, 2));
log(`Reporte guardado en ${archivo}`);
process.exit(motivoParada ? 3 : 0);
