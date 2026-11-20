import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { invalidarAsamblea } from '../modules/votacion/votacion.estado';
import { catalogos, cliente, levantarApi } from './helpers';

/**
 * Votación de punta a punta (HU06–HU11): asamblea, cargos, candidatos, padrón, acreditación,
 * ingreso del elector con DNI + código, polling del estado, cédula y voto. La apertura de la
 * elección (Sprint 3) se simula escribiendo el estado directo en la base.
 */

let server: Server;
let base: string;
let pedir: ReturnType<typeof cliente>;
type U = { id: number; nombre: string; rolId: number };
let responsable: U, distrital: U, regional: U;
let cat: Awaited<ReturnType<typeof catalogos>>;
let distA: number, distB: number, iglesiaA: number;

/** Cliente con su propio "frasco" de cookies, como un celular: guarda la cookie del elector. */
function celular() {
  let cookie = '';
  return async (metodo: string, ruta: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie?.startsWith('elector_token=')) cookie = setCookie.split(';')[0];
    const texto = await res.text();
    return { status: res.status, headers: res.headers, body: texto ? JSON.parse(texto) : undefined };
  };
}

async function crearAsambleaConEleccion(como: U, extra: Record<string, unknown> = { tipo: 'REGIONAL' }) {
  const a = await pedir('POST', '/api/asambleas', {
    como,
    body: { nombre: `Asamblea ${Math.random().toString(36).slice(2, 7)}`, fecha: '2026-12-05T10:00:00-05:00', ...extra },
  });
  expect(a.status).toBe(201);
  const e = await pedir('POST', `/api/asambleas/${a.body.id}/elecciones`, { como, body: { cargo: 'Secretario Regional' } });
  const c1 = await pedir('POST', `/api/elecciones/${e.body.id}/candidatos`, { como, body: { nombre: 'Samuel Quispe', detalle: 'Distrito A' } });
  const c2 = await pedir('POST', `/api/elecciones/${e.body.id}/candidatos`, { como, body: { nombre: 'Daniel Ríos' } });
  return { asamblea: a.body, eleccionId: e.body.id as number, candidatos: [c1.body.id as number, c2.body.id as number] };
}

async function electorAcreditado(asambleaId: number, dni: string) {
  await pedir('POST', `/api/asambleas/${asambleaId}/electores`, { como: responsable, body: { dni, nombre: `Elector ${dni}` } });
  const r = await pedir('POST', `/api/asambleas/${asambleaId}/acreditar`, { como: responsable, body: { dni } });
  expect(r.status).toBe(200);
  return r.body.codigo as string;
}

async function abrir(asambleaId: number, eleccionId: number) {
  await prisma.eleccion.update({ where: { id: eleccionId }, data: { estado: 'ABIERTA', abiertaEn: new Date() } });
  invalidarAsamblea(asambleaId);
}

beforeAll(async () => {
  cat = await catalogos();
  distA = (await prisma.distrito.create({ data: { nombre: 'Votación A' } })).id;
  distB = (await prisma.distrito.create({ data: { nombre: 'Votación B' } })).id;
  iglesiaA = (await prisma.iglesia.create({ data: { nombre: 'Iglesia VA', direccion: 'x', distritoId: distA } })).id;
  const passwordHash = await bcrypt.hash('x', 4);
  const u = (nombre: string, rolId: number, distritoId: number | null) =>
    prisma.usuario.create({ data: { nombre, passwordHash, rolId, estadoId: cat.activo.id, distritoId } });
  responsable = await u('v.responsable', cat.roles.responsable.id, null);
  regional = await u('v.regional', cat.roles.regional.id, null);
  distrital = await u('v.distrital', cat.roles.distrital.id, distA);
  const api = await levantarApi();
  server = api.server;
  base = api.base;
  pedir = cliente(base);
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

describe('HU06 — asambleas con cargos, y alcance', () => {
  it('crea una asamblea con código de acceso de 6 caracteres sin ambiguos', async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    expect(asamblea.codigoAcceso).toMatch(/^[ABCDEFGHJKMNPQRSTWXYZ2-9]{6}$/);
    expect(asamblea.estado).toBe('PROGRAMADA');
  });

  it('exige distrito en una distrital y lo prohíbe en una regional', async () => {
    const base = { nombre: 'Mal formada', fecha: '2026-12-05' };
    expect((await pedir('POST', '/api/asambleas', { como: responsable, body: { ...base, tipo: 'DISTRITAL' } })).status).toBe(400);
    expect((await pedir('POST', '/api/asambleas', { como: responsable, body: { ...base, tipo: 'REGIONAL', distritoId: distA } })).status).toBe(400);
  });

  it('el obispo distrital solo crea y ve asambleas distritales de su distrito', async () => {
    const base = { nombre: 'Distrital', fecha: '2026-12-05' };
    expect((await pedir('POST', '/api/asambleas', { como: distrital, body: { ...base, tipo: 'REGIONAL' } })).status).toBe(403);
    expect((await pedir('POST', '/api/asambleas', { como: distrital, body: { ...base, tipo: 'DISTRITAL', distritoId: distB } })).status).toBe(403);
    const propia = await pedir('POST', '/api/asambleas', { como: distrital, body: { ...base, tipo: 'DISTRITAL', distritoId: distA } });
    expect(propia.status).toBe(201);

    const regionalA = await crearAsambleaConEleccion(regional);
    expect((await pedir('GET', `/api/asambleas/${regionalA.asamblea.id}`, { como: distrital })).status).toBe(403);
    expect((await pedir('POST', `/api/asambleas/${regionalA.asamblea.id}/acreditar`, { como: distrital, body: { dni: '12345678' } })).status).toBe(403);
    const lista = await pedir('GET', '/api/asambleas?limit=100', { como: distrital });
    expect(lista.body.data.every((a: { tipo: string; distritoId: number }) => a.tipo === 'DISTRITAL' && a.distritoId === distA)).toBe(true);
  });

  it('no deja repetir un cargo en la misma asamblea', async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    const r = await pedir('POST', `/api/asambleas/${asamblea.id}/elecciones`, { como: responsable, body: { cargo: 'Secretario Regional' } });
    expect(r.status).toBe(409);
  });
});

describe('HU07 — candidatos con foto', () => {
  const PNG_1PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  it('guarda la foto y la sirve como imagen pública y cacheable', async () => {
    const { eleccionId } = await crearAsambleaConEleccion(responsable);
    const c = await pedir('POST', `/api/elecciones/${eleccionId}/candidatos`, { como: responsable, body: { nombre: 'Con Foto', foto: PNG_1PX } });
    expect(c.status).toBe(201);
    const res = await fetch(`${base}/api/candidatos/${c.body.id}/foto`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age');
    const etag = res.headers.get('etag')!;
    expect((await fetch(`${base}/api/candidatos/${c.body.id}/foto`, { headers: { 'If-None-Match': etag } })).status).toBe(304);
  });

  it('rechaza algo que no es una imagen', async () => {
    const { eleccionId } = await crearAsambleaConEleccion(responsable);
    const r = await pedir('POST', `/api/elecciones/${eleccionId}/candidatos`, {
      como: responsable,
      body: { nombre: 'Malo', foto: 'data:text/html;base64,PHNjcmlwdD4=' },
    });
    expect(r.status).toBe(400);
  });

  it('no deja tocar candidatos de una elección ya abierta', async () => {
    const { asamblea, eleccionId, candidatos } = await crearAsambleaConEleccion(responsable);
    await abrir(asamblea.id, eleccionId);
    expect((await pedir('PUT', `/api/candidatos/${candidatos[0]}`, { como: responsable, body: { nombre: 'Cambiado' } })).status).toBe(409);
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/candidatos`, { como: responsable, body: { nombre: 'Tardío' } })).status).toBe(409);
  });
});

describe('HU08 — padrón y acreditación con código', () => {
  it('genera un código de 4 dígitos, guarda solo su hash y lo muestra una sola vez', async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    const codigo = await electorAcreditado(asamblea.id, '40000001');
    expect(codigo).toMatch(/^\d{4}$/);
    const fila = await prisma.elector.findUniqueOrThrow({ where: { asambleaId_dni: { asambleaId: asamblea.id, dni: '40000001' } } });
    expect(fila.acreditado).toBe(true);
    expect(fila.codigoHash).not.toContain(codigo);
    expect(await bcrypt.compare(codigo, fila.codigoHash!)).toBe(true);
    // Acreditar de nuevo no devuelve el código: hay que pedir uno nuevo explícitamente.
    expect((await pedir('POST', `/api/asambleas/${asamblea.id}/acreditar`, { como: responsable, body: { dni: '40000001' } })).status).toBe(409);
  });

  it('no acredita a quien no está en el padrón', async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    expect((await pedir('POST', `/api/asambleas/${asamblea.id}/acreditar`, { como: responsable, body: { dni: '49999999' } })).status).toBe(404);
  });

  it('importa al padrón solo congregantes del distrito de una asamblea distrital', async () => {
    const igB = await prisma.iglesia.create({ data: { nombre: 'Iglesia VB', direccion: 'x', distritoId: distB } });
    const datos = { nombre: 'C', apellido: 'D', sexoId: cat.sexo.id, estadoCivilId: cat.civil.id, estadoEclesialId: cat.eclesial.id };
    await prisma.congregante.create({ data: { ...datos, dni: '41000001', iglesiaId: iglesiaA } });
    await prisma.congregante.create({ data: { ...datos, dni: '41000002', iglesiaId: igB.id } });
    const a = await pedir('POST', '/api/asambleas', {
      como: distrital,
      body: { nombre: 'Distrital A', tipo: 'DISTRITAL', distritoId: distA, fecha: '2026-12-05' },
    });
    const r = await pedir('POST', `/api/asambleas/${a.body.id}/electores/importar`, { como: distrital, body: { distritoId: distA } });
    expect(r.status).toBe(200);
    const dnis = (await prisma.elector.findMany({ where: { asambleaId: a.body.id } })).map((e) => e.dni);
    expect(dnis).toContain('41000001');
    expect(dnis).not.toContain('41000002');
  });

  it('la mesa encuentra el DNI en el padrón o lo sugiere desde la membresía', async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    const r = await pedir('GET', `/api/asambleas/${asamblea.id}/electores/dni/41000001`, { como: responsable });
    expect(r.body).toMatchObject({ enPadron: false, sugerencia: { dni: '41000001' } });
  });
});

describe('HU09 — ingreso del elector con DNI y código', () => {
  let codigoAsamblea: string;
  let asambleaId: number;
  let codigo: string;

  beforeAll(async () => {
    const { asamblea } = await crearAsambleaConEleccion(responsable);
    codigoAsamblea = asamblea.codigoAcceso;
    asambleaId = asamblea.id;
    codigo = await electorAcreditado(asambleaId, '42000001');
    await pedir('POST', `/api/asambleas/${asambleaId}/electores`, { como: responsable, body: { dni: '42000009', nombre: 'Sin acreditar' } });
  });

  it('la pantalla de ingreso obtiene el nombre de la asamblea sin sesión', async () => {
    const r = await celular()('GET', `/api/votacion/${codigoAsamblea}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ estado: 'ESPERA', eleccion: null });
  });

  it('ingresa con DNI y código correctos y recibe una cookie de elector restringida', async () => {
    const tel = celular();
    const r = await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni: '42000001', codigo });
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie')).toMatch(/elector_token=.*Path=\/api\/votacion.*HttpOnly/i);
    expect((await tel('GET', `/api/votacion/${codigoAsamblea}/estado`)).status).toBe(200);
  });

  it('rechaza un código errado y un elector no acreditado con el mismo mensaje', async () => {
    const tel = celular();
    const malo = await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni: '42000001', codigo: codigo === '0000' ? '1111' : '0000' });
    const sinAcreditar = await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni: '42000009', codigo: '1234' });
    expect(malo.status).toBe(401);
    expect(sinAcreditar.status).toBe(401);
    expect(malo.body.error.message).toBe(sinAcreditar.body.error.message);
  });

  it('bloquea el DNI tras 5 intentos fallidos, aunque luego ponga el código correcto', async () => {
    const dni = '42000002';
    const bueno = await electorAcreditado(asambleaId, dni);
    const tel = celular();
    const malo = bueno === '0000' ? '1111' : '0000';
    for (let i = 0; i < 4; i++) expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo: malo })).status).toBe(401);
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo: malo })).status).toBe(429);
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo: bueno })).status).toBe(429);
  });

  it('un código regenerado invalida el anterior', async () => {
    const dni = '42000003';
    const viejo = await electorAcreditado(asambleaId, dni);
    const nuevo = (await pedir('POST', `/api/asambleas/${asambleaId}/acreditar`, { como: responsable, body: { dni, regenerar: true } })).body.codigo;
    const tel = celular();
    if (viejo !== nuevo) expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo: viejo })).status).toBe(401);
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo: nuevo })).status).toBe(200);
  });

  it('la sesión de elector y la de administrador no sirven una por la otra', async () => {
    const tel = celular();
    const r = await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni: '42000001', codigo });
    const token = r.headers.get('set-cookie')!.split(';')[0].split('=')[1];
    const comoAdmin = await fetch(`${base}/api/asambleas`, { headers: { Cookie: `auth_token=${token}` } });
    expect(comoAdmin.status).toBe(401);
    expect((await celular()('GET', `/api/votacion/${codigoAsamblea}/estado`)).status).toBe(401);
  });
});

describe('HU10/HU11 — estado, cédula, voto y constancia', () => {
  let asambleaId: number;
  let codigoAsamblea: string;
  let eleccionId: number;
  let candidatos: number[];

  beforeAll(async () => {
    const r = await crearAsambleaConEleccion(responsable);
    asambleaId = r.asamblea.id;
    codigoAsamblea = r.asamblea.codigoAcceso;
    eleccionId = r.eleccionId;
    candidatos = r.candidatos;
  });

  async function electorConSesion(dni: string) {
    const codigo = await electorAcreditado(asambleaId, dni);
    const tel = celular();
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/ingresar`, { dni, codigo })).status).toBe(200);
    return tel;
  }

  it('sin elección abierta: estado ESPERA y la cédula no existe', async () => {
    const tel = await electorConSesion('43000001');
    const e = await tel('GET', `/api/votacion/${codigoAsamblea}/estado`);
    expect(e.body).toMatchObject({ estado: 'ESPERA', eleccionId: null, yaVoto: false });
    expect((await tel('GET', `/api/votacion/${codigoAsamblea}/cedula`)).status).toBe(409);
  });

  it('el estado responde 304 si nada cambió, y cambia al abrirse la elección', async () => {
    const tel = await electorConSesion('43000002');
    const primero = await tel('GET', `/api/votacion/${codigoAsamblea}/estado`);
    const etag = primero.headers.get('etag')!;
    expect((await tel('GET', `/api/votacion/${codigoAsamblea}/estado`, undefined, { 'If-None-Match': etag })).status).toBe(304);
    await abrir(asambleaId, eleccionId);
    const despues = await tel('GET', `/api/votacion/${codigoAsamblea}/estado`, undefined, { 'If-None-Match': etag });
    expect(despues.status).toBe(200);
    expect(despues.body).toEqual({ estado: 'ABIERTA', eleccionId, version: expect.any(Number), yaVoto: false });
  });

  it('la cédula trae los candidatos y ningún conteo', async () => {
    const tel = await electorConSesion('43000003');
    const c = await tel('GET', `/api/votacion/${codigoAsamblea}/cedula`);
    expect(c.status).toBe(200);
    expect(c.body.candidatos.map((x: { id: number }) => x.id)).toEqual(candidatos);
    expect(JSON.stringify(c.body)).not.toMatch(/votos|conteo|total/i);
  });

  it('vota, recibe una constancia sin el candidato, y el estado pasa a yaVoto', async () => {
    const tel = await electorConSesion('43000004');
    const v = await tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: candidatos[0] });
    expect(v.status).toBe(201);
    expect(v.body.constancia).toMatchObject({ cargo: 'Secretario Regional', ronda: 1, numero: expect.stringContaining(codigoAsamblea) });
    expect(JSON.stringify(v.body)).not.toContain('Samuel');
    expect((await tel('GET', `/api/votacion/${codigoAsamblea}/estado`)).body.yaVoto).toBe(true);
  });

  it('el voto guardado no tiene fecha ni elector: solo elección y candidato', async () => {
    const columnas = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'votos'`;
    expect(columnas.map((c) => c.COLUMN_NAME).sort()).toEqual(['candidato_id', 'eleccion_id', 'id']);
  });

  it('un segundo voto del mismo elector: 409 "ya votaste"', async () => {
    const tel = await electorConSesion('43000005');
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: candidatos[0] })).status).toBe(201);
    const otra = await tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: candidatos[1] });
    expect(otra.status).toBe(409);
    expect(otra.body.error.message).toMatch(/ya votaste/i);
  });

  it('doble voto SIMULTÁNEO: de 8 pedidos a la vez, cuenta exactamente uno', async () => {
    const tel = await electorConSesion('43000006');
    const elector = await prisma.elector.findUniqueOrThrow({ where: { asambleaId_dni: { asambleaId, dni: '43000006' } } });
    const votosAntes = await prisma.voto.count({ where: { eleccionId } });
    const respuestas = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: candidatos[i % 2] }),
      ),
    );
    const codigos = respuestas.map((r) => r.status).sort();
    expect(codigos.filter((c) => c === 201)).toHaveLength(1);
    expect(codigos.filter((c) => c === 409)).toHaveLength(7);
    expect(await prisma.emision.count({ where: { eleccionId, electorId: elector.id } })).toBe(1);
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(votosAntes + 1);
  });

  it('emisiones y votos cuadran siempre', async () => {
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(await prisma.emision.count({ where: { eleccionId } }));
  });

  it('rechaza un candidato de otra elección', async () => {
    const otra = await crearAsambleaConEleccion(responsable);
    const tel = await electorConSesion('43000007');
    expect((await tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: otra.candidatos[0] })).status).toBe(400);
  });

  it('con la elección cerrada, el voto se rechaza y no se registra nada', async () => {
    const tel = await electorConSesion('43000008');
    await prisma.eleccion.update({ where: { id: eleccionId }, data: { estado: 'CERRADA', cerradaEn: new Date() } });
    invalidarAsamblea(asambleaId);
    const antes = await prisma.voto.count({ where: { eleccionId } });
    const r = await tel('POST', `/api/votacion/${codigoAsamblea}/votar`, { eleccionId, candidatoId: candidatos[0] });
    expect(r.status).toBe(409);
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(antes);
    expect((await tel('GET', `/api/votacion/${codigoAsamblea}/estado`)).body.estado).toBe('ESPERA');
  });

  it('una sesión de otra asamblea no vota en esta', async () => {
    const otra = await crearAsambleaConEleccion(responsable);
    await abrir(otra.asamblea.id, otra.eleccionId);
    const tel = await electorConSesion('43000009');
    const r = await tel('POST', `/api/votacion/${otra.asamblea.codigoAcceso}/votar`, { eleccionId: otra.eleccionId, candidatoId: otra.candidatos[0] });
    expect(r.status).toBe(401);
  });

  it('limita el polling por sesión de elector (no por IP)', async () => {
    const tel = await electorConSesion('43000010');
    const otro = await electorConSesion('43000011');
    let ultimo = 0;
    for (let i = 0; i < 95; i++) ultimo = (await tel('GET', `/api/votacion/${codigoAsamblea}/estado`)).status;
    expect(ultimo).toBe(429);
    // Mismo equipo (misma IP), otra sesión: no se ve afectada.
    expect((await otro('GET', `/api/votacion/${codigoAsamblea}/estado`)).status).toBe(200);
  });
});
