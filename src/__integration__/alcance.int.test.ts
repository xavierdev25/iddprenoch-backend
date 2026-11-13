import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { catalogos, cliente, levantarApi } from './helpers';

/**
 * Control de acceso por rol y distrito de punta a punta (HU01–HU05): request HTTP real, middleware,
 * controladores y MySQL. Dos distritos, una iglesia y un congregante en cada uno.
 */

let server: Server;
let pedir: ReturnType<typeof cliente>;

type U = { id: number; nombre: string; rolId: number };
let responsable: U, regional: U, distrital: U, editor: U, inactivo: U, sinDistrito: U, secretario: U;
let distA: number, distB: number;
let iglesiaA: number, iglesiaB: number;
let congreganteA: number, congreganteB: number;
let cat: Awaited<ReturnType<typeof catalogos>>;

function congregante(dni: string, iglesiaId: number) {
  return {
    dni,
    nombre: 'Nombre',
    apellido: 'Apellido',
    iglesiaId,
    sexoId: cat.sexo.id,
    estadoCivilId: cat.civil.id,
    estadoEclesialId: cat.eclesial.id,
  };
}

async function denegacionesDe(usuarioId: number) {
  return prisma.auditoria.findMany({ where: { usuarioId, resultado: 'DENEGADO' } });
}

beforeAll(async () => {
  cat = await catalogos();
  distA = (await prisma.distrito.create({ data: { nombre: 'Distrito A' } })).id;
  distB = (await prisma.distrito.create({ data: { nombre: 'Distrito B' } })).id;
  iglesiaA = (await prisma.iglesia.create({ data: { nombre: 'Iglesia A', direccion: 'Calle A', distritoId: distA } })).id;
  iglesiaB = (await prisma.iglesia.create({ data: { nombre: 'Iglesia B', direccion: 'Calle B', distritoId: distB } })).id;
  congreganteA = (await prisma.congregante.create({ data: congregante('10000001', iglesiaA) })).id;
  congreganteB = (await prisma.congregante.create({ data: congregante('10000002', iglesiaB) })).id;
  for (const [iglesiaId, celular] of [[iglesiaA, '999000111'], [iglesiaB, '999000222']] as const) {
    await prisma.pastor.create({ data: { nombrePastor: `Pastor ${iglesiaId}`, celular, iglesiaId, cargoId: cat.cargo.id } });
  }

  const passwordHash = await bcrypt.hash('clave-correcta', 4);
  const usuario = (nombre: string, rolId: number, distritoId: number | null, estadoId = cat.activo.id) =>
    prisma.usuario.create({ data: { nombre, passwordHash, rolId, estadoId, distritoId } });
  responsable = await usuario('responsable', cat.roles.responsable.id, null);
  regional = await usuario('regional', cat.roles.regional.id, null);
  distrital = await usuario('distrital.a', cat.roles.distrital.id, distA);
  editor = await usuario('editor', cat.roles.editor.id, null);
  inactivo = await usuario('inactivo', cat.roles.distrital.id, distA, cat.inactivo.id);
  sinDistrito = await usuario('distrital.sin', cat.roles.distrital.id, null);
  secretario = await usuario('secretario', cat.roles.secretario.id, null);

  const api = await levantarApi();
  server = api.server;
  pedir = cliente(api.base);
});

afterAll(async () => {
  server?.close();
  await prisma.$disconnect();
});

describe('HU02 — el obispo distrital ve solo su distrito', () => {
  it('lista solo los congregantes de su distrito', async () => {
    const r = await pedir('GET', '/api/congregantes?limit=100', { como: distrital });
    expect(r.status).toBe(200);
    expect(r.body.data.map((c: { id: number }) => c.id)).toEqual([congreganteA]);
    expect(r.body.total).toBe(1);
  });

  it('403 al abrir un congregante de otro distrito, y queda auditado', async () => {
    const antes = (await denegacionesDe(distrital.id)).length;
    const r = await pedir('GET', `/api/congregantes/${congreganteB}`, { como: distrital });
    expect(r.status).toBe(403);
    const despues = await denegacionesDe(distrital.id);
    expect(despues.length).toBe(antes + 1);
    expect(despues.at(-1)?.recurso).toBe(`/api/congregantes/${congreganteB}`);
  });

  it('403 si filtra por otro distrito o por una iglesia de otro distrito', async () => {
    expect((await pedir('GET', `/api/congregantes?distritoId=${distB}`, { como: distrital })).status).toBe(403);
    expect((await pedir('GET', `/api/congregantes?iglesiaId=${iglesiaB}`, { como: distrital })).status).toBe(403);
  });

  it('los reportes nominales y consolidados quedan acotados a su distrito', async () => {
    const nominal = await pedir('GET', '/api/reportes/miembros', { como: distrital });
    expect(nominal.status).toBe(200);
    expect(nominal.body.miembros.every((m: { distrito: string }) => m.distrito === 'Distrito A')).toBe(true);
    expect(nominal.body.filtros).toContainEqual({ etiqueta: 'Distrito', valor: 'Distrito A' });

    const consolidado = await pedir('GET', '/api/reportes/membresia?agruparPor=distrito', { como: distrital });
    expect(consolidado.body.filas.map((f: { nombre: string }) => f.nombre)).toEqual(['Distrito A']);

    expect((await pedir('GET', `/api/reportes/miembros?iglesiaId=${iglesiaB}`, { como: distrital })).status).toBe(403);
    expect((await pedir('GET', `/api/reportes/membresia.xlsx?distritoId=${distB}`, { como: distrital })).status).toBe(403);
  });

  it('en el panel ve solo las iglesias y pastores de su distrito', async () => {
    const iglesias = await pedir('GET', '/api/iglesias?ambito=panel&limit=100', { como: distrital });
    expect(iglesias.body.data.map((i: { id: number }) => i.id)).toEqual([iglesiaA]);
    const pastores = await pedir('GET', '/api/pastores?ambito=panel&limit=100', { como: distrital });
    expect(pastores.body.data.map((p: { iglesiaId: number }) => p.iglesiaId)).toEqual([iglesiaA]);
  });

  it('un obispo distrital sin distrito asignado no recibe la región: 403', async () => {
    expect((await pedir('GET', '/api/congregantes', { como: sinDistrito })).status).toBe(403);
  });
});

describe('HU03 — crea y edita solo en su distrito', () => {
  it('crea un congregante en su distrito y el cambio queda auditado', async () => {
    const r = await pedir('POST', '/api/congregantes', { como: distrital, body: congregante('10000003', iglesiaA) });
    expect(r.status).toBe(201);
    const fila = await prisma.auditoria.findFirst({ where: { usuarioId: distrital.id, accion: 'CREAR' } });
    expect(fila?.resultado).toBe('PERMITIDO');
  });

  it('403 al crear un congregante en una iglesia de otro distrito', async () => {
    const r = await pedir('POST', '/api/congregantes', { como: distrital, body: congregante('10000004', iglesiaB) });
    expect(r.status).toBe(403);
    expect(await prisma.congregante.findUnique({ where: { dni: '10000004' } })).toBeNull();
  });

  it('403 al mudar a su congregante a una iglesia de otro distrito', async () => {
    const r = await pedir('PUT', `/api/congregantes/${congreganteA}`, { como: distrital, body: { iglesiaId: iglesiaB } });
    expect(r.status).toBe(403);
    expect((await prisma.congregante.findUniqueOrThrow({ where: { id: congreganteA } })).iglesiaId).toBe(iglesiaA);
  });

  it('403 al editar o borrar un congregante de otro distrito', async () => {
    expect((await pedir('PUT', `/api/congregantes/${congreganteB}`, { como: distrital, body: { nombre: 'X' } })).status).toBe(403);
    expect((await pedir('DELETE', `/api/congregantes/${congreganteB}`, { como: distrital })).status).toBe(403);
    expect(await prisma.congregante.findUnique({ where: { id: congreganteB } })).not.toBeNull();
  });

  it('403 al editar una iglesia ajena o crear una iglesia en otro distrito', async () => {
    expect((await pedir('PUT', `/api/iglesias/${iglesiaB}`, { como: distrital, body: { nombre: 'X' } })).status).toBe(403);
    const nueva = { nombre: 'Nueva', direccion: 'Dir', distritoId: distB };
    expect((await pedir('POST', '/api/iglesias', { como: distrital, body: nueva })).status).toBe(403);
    expect((await pedir('POST', '/api/iglesias', { como: distrital, body: { ...nueva, distritoId: distA } })).status).toBe(201);
  });

  it('no puede tocar distritos, ministerios, eventos ni usuarios', async () => {
    expect((await pedir('POST', '/api/distritos', { como: distrital, body: { nombre: 'Z' } })).status).toBe(403);
    expect((await pedir('POST', '/api/ministerios', { como: distrital, body: { nombre: 'Z' } })).status).toBe(403);
    expect((await pedir('POST', '/api/comunicados', { como: distrital, body: { titulo: 'Z' } })).status).toBe(403);
    expect((await pedir('GET', '/api/usuarios', { como: distrital })).status).toBe(403);
  });
});

describe('HU04 — el obispo regional ve toda la región', () => {
  it('lista los congregantes de todos los distritos', async () => {
    const r = await pedir('GET', '/api/congregantes?limit=100', { como: regional });
    const ids = r.body.data.map((c: { id: number }) => c.id);
    expect(ids).toEqual(expect.arrayContaining([congreganteA, congreganteB]));
  });

  it('puede filtrar por cualquier distrito y editar en cualquiera', async () => {
    expect((await pedir('GET', `/api/congregantes?distritoId=${distB}`, { como: regional })).status).toBe(200);
    expect((await pedir('PUT', `/api/congregantes/${congreganteB}`, { como: regional, body: { nombre: 'Editado' } })).status).toBe(200);
  });

  it('no administra usuarios ni consulta la auditoría', async () => {
    expect((await pedir('GET', '/api/usuarios', { como: regional })).status).toBe(403);
    expect((await pedir('GET', '/api/auditoria', { como: regional })).status).toBe(403);
  });
});

describe('Roles sin acceso a membresía', () => {
  it('el Editor publica comunicados pero no ve congregantes, reportes ni el panel de iglesias', async () => {
    expect((await pedir('POST', '/api/comunicados', { como: editor, body: { titulo: 'Aviso' } })).status).toBe(201);
    expect((await pedir('GET', '/api/congregantes', { como: editor })).status).toBe(403);
    expect((await pedir('GET', '/api/reportes/miembros', { como: editor })).status).toBe(403);
    expect((await pedir('GET', '/api/iglesias?ambito=panel', { como: editor })).status).toBe(403);
  });

  it('un rol sin permisos (Secretario) no accede a nada administrativo', async () => {
    expect((await pedir('GET', '/api/congregantes', { como: secretario })).status).toBe(403);
    expect((await pedir('POST', '/api/eventos', { como: secretario, body: {} })).status).toBe(403);
  });

  it('un usuario inactivo queda bloqueado aunque su token siga vigente', async () => {
    expect((await pedir('GET', '/api/congregantes', { como: inactivo })).status).toBe(401);
  });

  it('sin sesión: 401', async () => {
    expect((await pedir('GET', '/api/congregantes')).status).toBe(401);
    expect((await pedir('GET', '/api/iglesias?ambito=panel')).status).toBe(401);
  });
});

describe('GET públicos (sitio)', () => {
  it('iglesias y pastores siguen públicos y sin filtrar, aun con sesión de obispo distrital', async () => {
    const iglesias = await pedir('GET', '/api/iglesias?limit=100', { como: distrital });
    expect(iglesias.body.data.map((i: { id: number }) => i.id)).toEqual(expect.arrayContaining([iglesiaA, iglesiaB]));
  });

  it('el GET público de pastores no expone el celular; el del panel sí', async () => {
    const publico = await pedir('GET', '/api/pastores?limit=100');
    expect(publico.body.data.length).toBeGreaterThanOrEqual(2);
    for (const p of publico.body.data) expect(p).not.toHaveProperty('celular');
    const detalle = await pedir('GET', `/api/pastores/${publico.body.data[0].id}`);
    expect(detalle.body).not.toHaveProperty('celular');

    const panel = await pedir('GET', '/api/pastores?ambito=panel&limit=100', { como: regional });
    expect(panel.body.data.some((p: { celular?: string }) => p.celular)).toBe(true);
  });
});

describe('HU01 — usuarios con rol y distrito', () => {
  it('exige distrito para crear un Obispo distrital', async () => {
    const base = { nombre: 'nuevo.obispo', password: 'clave12345', rolId: cat.roles.distrital.id, estadoId: cat.activo.id };
    expect((await pedir('POST', '/api/usuarios', { como: responsable, body: base })).status).toBe(400);
    const r = await pedir('POST', '/api/usuarios', { como: responsable, body: { ...base, distritoId: distB } });
    expect(r.status).toBe(201);
    expect(r.body.distritoId).toBe(distB);
  });

  it('audita quién cambió el rol de quién', async () => {
    const r = await pedir('PUT', `/api/usuarios/${editor.id}`, { como: responsable, body: { rolId: cat.roles.regional.id } });
    expect(r.status).toBe(200);
    const fila = await prisma.auditoria.findFirst({ where: { accion: 'EDITAR USUARIO' }, orderBy: { id: 'desc' } });
    expect(fila).toMatchObject({ usuarioId: responsable.id, resultado: 'PERMITIDO' });
    expect(fila?.detalle).toContain('rol: Editor → Obispo regional');
    // Devolverlo a Editor para no alterar el resto de pruebas.
    await pedir('PUT', `/api/usuarios/${editor.id}`, { como: responsable, body: { rolId: cat.roles.editor.id } });
  });

  it('el Responsable no puede quitarse su propio rol ni desactivarse', async () => {
    const rol = await pedir('PUT', `/api/usuarios/${responsable.id}`, { como: responsable, body: { rolId: cat.roles.editor.id } });
    expect(rol.status).toBe(400);
    const estado = await pedir('PUT', `/api/usuarios/${responsable.id}`, { como: responsable, body: { estadoId: cat.inactivo.id } });
    expect(estado.status).toBe(400);
  });
});

describe('HU05 — auditoría', () => {
  it('registra el login fallido con el nombre intentado y el exitoso con rol y distrito', async () => {
    const malo = await pedir('POST', '/api/auth/login', { body: { nombre: 'distrital.a', password: 'incorrecta' } });
    expect(malo.status).toBe(401);
    const fallo = await prisma.auditoria.findFirst({ where: { accion: 'LOGIN', resultado: 'DENEGADO' } });
    expect(fallo?.usuarioNombre).toBe('distrital.a');

    const bueno = await pedir('POST', '/api/auth/login', { body: { nombre: 'distrital.a', password: 'clave-correcta' } });
    expect(bueno.status).toBe(200);
    expect(bueno.body).toMatchObject({ rol: 'Obispo distrital', distritoId: distA });
    expect(await prisma.auditoria.count({ where: { accion: 'LOGIN', resultado: 'PERMITIDO', usuarioId: distrital.id } })).toBe(1);
  });

  it('solo el Responsable la consulta, filtrando por resultado', async () => {
    const r = await pedir('GET', '/api/auditoria?resultado=DENEGADO&limit=100', { como: responsable });
    expect(r.status).toBe(200);
    expect(r.body.total).toBeGreaterThan(0);
    expect(r.body.data.every((a: { resultado: string }) => a.resultado === 'DENEGADO')).toBe(true);
    // Los denegados de este archivo incluyen los intentos del obispo distrital fuera de su distrito.
    expect(r.body.data.some((a: { usuarioId?: number }) => a.usuarioId === distrital.id)).toBe(true);
  });

  it('la búsqueda de un congregante por DNI no se copia a la auditoría', async () => {
    await pedir('GET', `/api/congregantes?distritoId=${distB}&q=10000002`, { como: distrital });
    const filas = await prisma.auditoria.findMany({ where: { usuarioId: distrital.id } });
    expect(filas.every((f) => !f.recurso.includes('10000002') && !(f.detalle ?? '').includes('10000002'))).toBe(true);
  });
});

describe('Catálogo de roles', () => {
  it('oculta del selector los roles sin permisos (Secretario y Tesorero)', async () => {
    const r = await pedir('GET', '/api/roles', { como: responsable });
    const nombres = r.body.map((x: { nombre: string }) => x.nombre);
    expect(nombres).toEqual(expect.arrayContaining(['Responsable del sistema', 'Obispo regional', 'Obispo distrital', 'Editor']));
    expect(nombres).not.toContain('Secretario Regional');
  });
});
