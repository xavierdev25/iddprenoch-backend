#!/usr/bin/env node
/**
 * Asamblea de demostración con datos FICTICIOS, para las capturas del informe.
 *
 *   node scripts/demo-asamblea.mjs crear  --url https://iddprenoch.com
 *   node scripts/demo-asamblea.mjs votos  --url https://iddprenoch.com   (14 votos en el cargo abierto)
 *   node scripts/demo-asamblea.mjs borrar --url https://iddprenoch.com
 *
 * Credenciales por variables de entorno (nunca en el repo): DEMO_USUARIO y DEMO_PASSWORD, de una
 * cuenta "Responsable del sistema" (borrar una asamblea con votos lo exige).
 *
 * `crear` arma:
 *   - "Asamblea de demostración" (regional), con 3 cargos y candidatos ficticios (los nombres del
 *     prototipo aprobado);
 *   - un padrón de 24 electores ficticios, con DNI 98000001–98000024 (fuera del rango de cualquier
 *     congregante cargado), de los que acredita 20;
 *   - y muestra el DNI y el código de 3 electores SIN VOTAR, para hacer las capturas en el celular.
 * `votos` emite 14 votos al azar en el cargo que esté abierto, con los electores 98000004–98000017,
 *   para que el panel en vivo muestre números. Los electores de las capturas no se usan.
 * `borrar` elimina la asamblea (y sus votos) por su nombre.
 *
 * Los códigos de los electores quedan en un archivo local ignorado por git (.demo-codigos.json),
 * para que `votos` pueda ingresar con ellos. `borrar` lo elimina.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [accion, ...resto] = process.argv.slice(2);
const args = Object.fromEntries(resto.reduce((p, a, i, arr) => (a.startsWith('--') ? [...p, [a.slice(2), arr[i + 1]]] : p), []));
const URL_BASE = String(args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const NOMBRE = 'Asamblea de demostración';
const CODIGOS = join(dirname(fileURLToPath(import.meta.url)), '.demo-codigos.json');

if (!['crear', 'votos', 'borrar'].includes(accion)) {
  console.error('Uso: node scripts/demo-asamblea.mjs <crear|votos|borrar> --url https://iddprenoch.com');
  process.exit(1);
}
const { DEMO_USUARIO, DEMO_PASSWORD } = process.env;
if (!DEMO_USUARIO || !DEMO_PASSWORD) {
  console.error('Faltan DEMO_USUARIO y DEMO_PASSWORD (cuenta "Responsable del sistema").');
  process.exit(1);
}

async function api(metodo, ruta, { body, cookie } = {}) {
  const res = await fetch(`${URL_BASE}/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : undefined;
  if (!res.ok) throw new Error(`${metodo} ${ruta} → ${res.status} ${datos?.error?.message ?? ''}`);
  return { datos, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

const sesion = (await api('POST', '/auth/login', { body: { nombre: DEMO_USUARIO, password: DEMO_PASSWORD } })).cookie;
const lista = (await api('GET', '/asambleas?limit=100', { cookie: sesion })).datos.data;
const existente = lista.find((a) => a.nombre === NOMBRE);

if (accion === 'borrar') {
  if (!existente) {
    console.log('No hay ninguna "Asamblea de demostración".');
  } else {
    await api('DELETE', `/asambleas/${existente.id}?forzar=1`, { cookie: sesion });
    console.log(`Eliminada "${NOMBRE}" (código ${existente.codigoAcceso}) con sus electores y votos.`);
  }
  if (existsSync(CODIGOS)) rmSync(CODIGOS);
  process.exit(0);
}

if (accion === 'crear') {
  if (existente) {
    console.error(`Ya existe (código ${existente.codigoAcceso}). Bórrala primero con "borrar".`);
    process.exit(1);
  }
  const asamblea = (await api('POST', '/asambleas', { cookie: sesion, body: { nombre: NOMBRE, tipo: 'REGIONAL', fecha: new Date(Date.now() + 86400000).toISOString() } })).datos;
  const cargos = {
    'Secretario Regional': [
      ['Samuel Quispe Torres', 'Distrito Barranca Centro'],
      ['Daniel Ríos Paredes', 'Distrito Huaura'],
      ['Abel Mendoza Luna', 'Distrito Huaral'],
    ],
    'Tesorero Regional': [
      ['Rubén Salas Ortiz', 'Distrito Medio Mundo'],
      ['Carmen Julia Ortiz Paz', 'Distrito Barranca Norte'],
    ],
    'Vocal Regional': [
      ['Pedro Pablo León Rojas', 'Distrito Barranca Sur'],
      ['Milagros Huamán Soto', 'Distrito Huaral'],
    ],
  };
  for (const [cargo, candidatos] of Object.entries(cargos)) {
    const eleccion = (await api('POST', `/asambleas/${asamblea.id}/elecciones`, { cookie: sesion, body: { cargo } })).datos;
    for (const [nombre, detalle] of candidatos) {
      await api('POST', `/elecciones/${eleccion.id}/candidatos`, { cookie: sesion, body: { nombre, detalle } });
    }
  }
  const nombres = ['Rosa Elvira Campos Díaz', 'Luis Alberto Ramos Vega', 'Jorge Antonio Silva Cruz', 'Ana Lucía Paredes Delgado', 'Carlos Alberto Ríos Tarazona', 'Gloria Mendoza Falcón', 'Valeria Soto Campos', 'Josué Llanos Bernal', 'María Esperanza Huamán', 'Pedro Santiago Vásquez', 'Luz Marina Torres', 'Elías Vargas León', 'Rebeca Quispe Ramos', 'Tomás Huerta Salas', 'Noemí Castillo Vega', 'Isaac Flores Huamán', 'Débora Rojas Pinto', 'Caleb Morales Soto', 'Ester Navarro Ruiz', 'Joel Cárdenas Paz', 'Raquel Torres Lima', 'Natán Aguilar Ríos', 'Lidia Romero Cruz', 'Simón Palacios Vera'];
  const codigos = {};
  for (const [i, nombre] of nombres.entries()) {
    const dni = String(98000001 + i);
    await api('POST', `/asambleas/${asamblea.id}/electores`, { cookie: sesion, body: { dni, nombre } });
    if (i < 20) codigos[dni] = (await api('POST', `/asambleas/${asamblea.id}/acreditar`, { cookie: sesion, body: { dni } })).datos.codigo;
  }
  writeFileSync(CODIGOS, JSON.stringify({ codigoAcceso: asamblea.codigoAcceso, codigos }, null, 2));
  console.log(`Creada "${NOMBRE}" — código de acceso ${asamblea.codigoAcceso}`);
  console.log(`Panel:      ${URL_BASE}/admin/asambleas/${asamblea.id}`);
  console.log(`Elector:    ${URL_BASE}/votar/${asamblea.codigoAcceso}`);
  console.log(`Proyección: ${URL_BASE}/proyeccion/${asamblea.codigoAcceso}`);
  console.log('Electores para las capturas en el celular (no usados por "votos"):');
  for (const dni of ['98000001', '98000002', '98000003']) console.log(`  DNI ${dni}  código ${codigos[dni]}`);
  console.log('Padrón: 24 electores, 20 acreditados (98000021–98000024 sin acreditar, para capturar la mesa).');
  process.exit(0);
}

// votos
if (!existente || !existsSync(CODIGOS)) {
  console.error('Primero corre "crear" (y abre un cargo desde el panel).');
  process.exit(1);
}
const { codigoAcceso, codigos } = JSON.parse(readFileSync(CODIGOS, 'utf8'));
let emitidos = 0;
for (let n = 4; n <= 17; n++) {
  const dni = String(98000000 + n);
  const elector = (await api('POST', `/votacion/${codigoAcceso}/ingresar`, { body: { dni, codigo: codigos[dni] } })).cookie;
  const cedula = await api('GET', `/votacion/${codigoAcceso}/cedula`, { cookie: elector }).catch(() => null);
  if (!cedula) {
    console.error('No hay un cargo abierto: ábrelo desde el panel y vuelve a correr "votos".');
    process.exit(1);
  }
  if (cedula.datos.yaVoto) continue;
  // Reparto con un favorito claro, para que el panel y la proyección muestren un ganador.
  const pesos = [0.55, 0.3, 0.15];
  let r = Math.random();
  const indice = cedula.datos.candidatos.findIndex((_, i) => (r -= pesos[i] ?? 0) < 0);
  const candidato = cedula.datos.candidatos[Math.max(0, indice)];
  await api('POST', `/votacion/${codigoAcceso}/votar`, { cookie: elector, body: { eleccionId: cedula.datos.eleccionId, candidatoId: candidato.id } });
  emitidos++;
}
console.log(`${emitidos} votos emitidos en el cargo abierto. Los electores 98000001–98000003 siguen sin votar.`);
