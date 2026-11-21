import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { catalogos, cliente, cookieDe, levantarApi } from './helpers';

/**
 * Pruebas de seguridad del Sprint 4 (E5), reunidas en un solo lugar para el informe:
 *  1. API sin sesión: toda ruta administrativa responde 401.
 *  2. Acceso fuera de distrito: el obispo distrital recibe 403 en asambleas ajenas, y queda auditado.
 *  3. Sesiones cruzadas: la cookie de elector no abre el panel y la del panel no vota.
 *  4. Doble voto simultáneo desde varias sesiones del mismo elector.
 *  5. El conteo nunca es visible para el elector: ni en sus respuestas ni pidiéndolo directo.
 */

let server: Server;
let base: string;
let pedir: ReturnType<typeof cliente>;
type U = { id: number; nombre: string; rolId: number };
let responsable: U, distrital: U;
let asamblea: { id: number; codigoAcceso: string };
let eleccionId: number;
let candidatoId: number;

async function ingresar(dni: string, codigo: string): Promise<string> {
  const res = await fetch(`${base}/api/votacion/${asamblea.codigoAcceso}/ingresar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dni, codigo }),
  });
  expect(res.status).toBe(200);
  return res.headers.get('set-cookie')!.split(';')[0];
}

async function acreditado(dni: string): Promise<string> {
  await pedir('POST', `/api/asambleas/${asamblea.id}/electores`, { como: responsable, body: { dni, nombre: `Elector ${dni}` } });
  return (await pedir('POST', `/api/asambleas/${asamblea.id}/acreditar`, { como: responsable, body: { dni } })).body.codigo;
}

beforeAll(async () => {
  const cat = await catalogos();
  const distA = (await prisma.distrito.create({ data: { nombre: 'Seguridad A' } })).id;
  const passwordHash = await bcrypt.hash('x', 4);
  responsable = await prisma.usuario.create({ data: { nombre: 's.responsable', passwordHash, rolId: cat.roles.responsable.id, estadoId: cat.activo.id } });
  distrital = await prisma.usuario.create({ data: { nombre: 's.distrital', passwordHash, rolId: cat.roles.distrital.id, estadoId: cat.activo.id, distritoId: distA } });
  const api = await levantarApi();
  server = api.server;
  base = api.base;
  pedir = cliente(base);

  asamblea = (await pedir('POST', '/api/asambleas', { como: responsable, body: { nombre: 'Seguridad', tipo: 'REGIONAL', fecha: '2026-12-05' } })).body;
  eleccionId = (await pedir('POST', `/api/asambleas/${asamblea.id}/elecciones`, { como: responsable, body: { cargo: 'Vocal' } })).body.id;
  candidatoId = (await pedir('POST', `/api/elecciones/${eleccionId}/candidatos`, { como: responsable, body: { nombre: 'Ana Vocal' } })).body.id;
  await pedir('POST', `/api/elecciones/${eleccionId}/candidatos`, { como: responsable, body: { nombre: 'Beto Vocal' } });
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

describe('1. API sin sesión', () => {
  // {a} asamblea, {e} elección, {c} candidato: se resuelven al correr (se crean en beforeAll).
  const rutas: [string, string][] = [
    ['GET', '/api/asambleas'],
    ['POST', '/api/asambleas'],
    ['GET', '/api/asambleas/{a}'],
    ['DELETE', '/api/asambleas/{a}'],
    ['GET', '/api/asambleas/{a}/electores'],
    ['POST', '/api/asambleas/{a}/acreditar'],
    ['GET', '/api/asambleas/{a}/acta.pdf'],
    ['GET', '/api/asambleas/{a}/metricas.csv'],
    ['POST', '/api/elecciones/{e}/abrir'],
    ['POST', '/api/elecciones/{e}/cerrar'],
    ['GET', '/api/elecciones/{e}/conteo'],
    ['POST', '/api/elecciones/{e}/publicar'],
    ['PUT', '/api/candidatos/{c}'],
    ['GET', '/api/congregantes'],
    ['GET', '/api/usuarios'],
    ['GET', '/api/auditoria'],
    ['GET', '/api/reportes/miembros'],
    ['GET', '/api/votacion/ABCDEF/estado'],
    ['POST', '/api/votacion/ABCDEF/votar'],
  ];
  for (const [metodo, plantilla] of rutas) {
    it(`${metodo} ${plantilla} → 401`, async () => {
      const ruta = plantilla
        .replace('{a}', String(asamblea.id))
        .replace('{e}', String(eleccionId))
        .replace('{c}', String(candidatoId));
      expect((await pedir(metodo, ruta, { body: metodo === 'GET' ? undefined : {} })).status).toBe(401);
    });
  }
});

describe('2. Acceso fuera de distrito', () => {
  it('el obispo distrital no lee, ni acredita, ni conduce una asamblea regional; queda auditado', async () => {
    const antes = await prisma.auditoria.count({ where: { usuarioId: distrital.id, resultado: 'DENEGADO' } });
    const intentos = await Promise.all([
      pedir('GET', `/api/asambleas/${asamblea.id}`, { como: distrital }),
      pedir('POST', `/api/asambleas/${asamblea.id}/acreditar`, { como: distrital, body: { dni: '12345678' } }),
      pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: distrital }),
      pedir('GET', `/api/elecciones/${eleccionId}/conteo`, { como: distrital }),
      pedir('GET', `/api/asambleas/${asamblea.id}/acta.pdf`, { como: distrital }),
    ]);
    expect(intentos.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(await prisma.auditoria.count({ where: { usuarioId: distrital.id, resultado: 'DENEGADO' } })).toBe(antes + 5);
  });
});

describe('3. Sesiones cruzadas', () => {
  it('la cookie de elector no abre el panel, y la del panel no sirve para votar', async () => {
    const cookieElector = await ingresar('60000001', await acreditado('60000001'));
    const token = cookieElector.split('=')[1];
    expect((await fetch(`${base}/api/asambleas`, { headers: { Cookie: `auth_token=${token}` } })).status).toBe(401);

    const panel = cookieDe(responsable).split('=')[1];
    const voto = await fetch(`${base}/api/votacion/${asamblea.codigoAcceso}/votar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `elector_token=${panel}` },
      body: JSON.stringify({ eleccionId, candidatoId }),
    });
    expect(voto.status).toBe(401);
  });
});

describe('4. Doble voto simultáneo', () => {
  it('el mismo elector con 3 sesiones distintas y 15 pedidos a la vez: cuenta un solo voto', async () => {
    const codigo = await acreditado('60000002');
    const sesiones = [await ingresar('60000002', codigo), await ingresar('60000002', codigo), await ingresar('60000002', codigo)];
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    const respuestas = await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        fetch(`${base}/api/votacion/${asamblea.codigoAcceso}/votar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: sesiones[i % 3] },
          body: JSON.stringify({ eleccionId, candidatoId }),
        }).then((r) => r.status),
      ),
    );
    // Uno entra; el resto choca con el UNIQUE (409 "ya votaste") o, pasados los 10 intentos por
    // minuto del mismo elector, con el límite por sesión (429). Ninguno cuenta.
    expect(respuestas.filter((s) => s === 201)).toHaveLength(1);
    expect(respuestas.every((s) => s === 201 || s === 409 || s === 429)).toBe(true);
    const elector = await prisma.elector.findUniqueOrThrow({ where: { asambleaId_dni: { asambleaId: asamblea.id, dni: '60000002' } } });
    expect(await prisma.emision.count({ where: { eleccionId, electorId: elector.id } })).toBe(1);
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(await prisma.emision.count({ where: { eleccionId } }));
  });
});

describe('5. El conteo no es visible para electores', () => {
  it('ninguna respuesta del elector trae votos, y el conteo directo le responde 401', async () => {
    const cookie = await ingresar('60000003', await acreditado('60000003'));
    const get = (ruta: string) => fetch(`${base}${ruta}`, { headers: { Cookie: cookie } }).then(async (r) => ({ status: r.status, texto: await r.text() }));
    const respuestas = [
      await get(`/api/votacion/${asamblea.codigoAcceso}`),
      await get(`/api/votacion/${asamblea.codigoAcceso}/estado`),
      await get(`/api/votacion/${asamblea.codigoAcceso}/cedula`),
      await get(`/api/proyeccion/${asamblea.codigoAcceso}`),
    ];
    for (const r of respuestas) {
      expect(r.status).toBe(200);
      expect(r.texto).not.toMatch(/"votos"|"total"|"emisiones"|"porcentaje"/);
    }
    expect((await get(`/api/elecciones/${eleccionId}/conteo`)).status).toBe(401);
  });
});

describe('6. Límite de intentos de login', () => {
  it('cuenta solo los fallidos: muchos ingresos correctos desde la misma IP no bloquean', async () => {
    const cat = await catalogos();
    const passwordHash = await bcrypt.hash('clave-correcta-1', 4);
    await prisma.usuario.create({ data: { nombre: 's.login', passwordHash, rolId: cat.roles.editor.id, estadoId: cat.activo.id } });
    const intentar = (password: string) =>
      fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 's.login', password }),
      }).then((r) => r.status);

    for (let i = 0; i < 8; i++) expect(await intentar('clave-correcta-1')).toBe(200);
    for (let i = 0; i < 5; i++) expect(await intentar('equivocada')).toBe(401);
    expect(await intentar('equivocada')).toBe(429);
  });
});
