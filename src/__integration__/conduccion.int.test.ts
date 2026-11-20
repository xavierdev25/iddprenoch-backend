import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { io as ioCliente, Socket } from 'socket.io-client';
import { prisma } from '../db/prisma';
import { catalogos, cliente, cookieDe, levantarApi } from './helpers';

/**
 * Conducción y tiempo real (HU12–HU15): abrir y cerrar, conteo en vivo por Socket.IO, empate y
 * segunda vuelta, publicación en la proyección, acta PDF y CSV de métricas.
 */

let server: Server;
let base: string;
let pedir: ReturnType<typeof cliente>;
type U = { id: number; nombre: string; rolId: number };
let responsable: U, distrital: U;
const sockets: Socket[] = [];

function celular() {
  let cookie = '';
  return async (metodo: string, ruta: string, body?: unknown) => {
    const res = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie?.startsWith('elector_token=')) cookie = setCookie.split(';')[0];
    const texto = await res.text();
    return { status: res.status, body: texto ? JSON.parse(texto) : undefined };
  };
}

function conectar(cookie?: string): Promise<Socket> {
  const s = ioCliente(base, {
    path: '/api/socket.io',
    transports: ['polling'],
    extraHeaders: cookie ? { Cookie: cookie } : {},
    reconnection: false,
  });
  sockets.push(s);
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function unirse(s: Socket, evento: string, datos: unknown): Promise<{ ok: boolean; error?: string }> {
  return s.timeout(5000).emitWithAck(evento, datos);
}

function esperarEvento<T>(s: Socket, evento: string, ms = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sin ${evento} en ${ms} ms`)), ms);
    s.once(evento, (d: T) => {
      clearTimeout(t);
      resolve(d);
    });
  });
}

/** Asamblea con un cargo y N candidatos, y M electores acreditados con sesión abierta. */
async function escenario(candidatos: number, electores: number) {
  const a = await pedir('POST', '/api/asambleas', {
    como: responsable,
    body: { nombre: `Conducción ${Math.random().toString(36).slice(2, 7)}`, tipo: 'REGIONAL', fecha: '2026-12-05' },
  });
  const e = await pedir('POST', `/api/asambleas/${a.body.id}/elecciones`, { como: responsable, body: { cargo: 'Tesorero Regional' } });
  const ids: number[] = [];
  for (let i = 0; i < candidatos; i++) {
    ids.push((await pedir('POST', `/api/elecciones/${e.body.id}/candidatos`, { como: responsable, body: { nombre: `Candidato ${i + 1}` } })).body.id);
  }
  const tels: ReturnType<typeof celular>[] = [];
  for (let i = 0; i < electores; i++) {
    const dni = String(50000000 + a.body.id * 1000 + i);
    await pedir('POST', `/api/asambleas/${a.body.id}/electores`, { como: responsable, body: { dni, nombre: `Elector ${i}` } });
    const codigo = (await pedir('POST', `/api/asambleas/${a.body.id}/acreditar`, { como: responsable, body: { dni } })).body.codigo;
    const tel = celular();
    expect((await tel('POST', `/api/votacion/${a.body.codigoAcceso}/ingresar`, { dni, codigo })).status).toBe(200);
    tels.push(tel);
  }
  return { asamblea: a.body, eleccionId: e.body.id as number, candidatos: ids, tels };
}

beforeAll(async () => {
  const cat = await catalogos();
  const distA = (await prisma.distrito.create({ data: { nombre: 'Conducción A' } })).id;
  const passwordHash = await bcrypt.hash('x', 4);
  responsable = await prisma.usuario.create({ data: { nombre: 'c.responsable', passwordHash, rolId: cat.roles.responsable.id, estadoId: cat.activo.id } });
  distrital = await prisma.usuario.create({ data: { nombre: 'c.distrital', passwordHash, rolId: cat.roles.distrital.id, estadoId: cat.activo.id, distritoId: distA } });
  const api = await levantarApi();
  server = api.server;
  base = api.base;
  pedir = cliente(base);
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  server?.close();
  await prisma.$disconnect();
});

describe('HU12 — abrir y cerrar la votación', () => {
  it('no abre un cargo sin candidatos ni dos cargos a la vez', async () => {
    const { asamblea, eleccionId } = await escenario(2, 0);
    const vacia = await pedir('POST', `/api/asambleas/${asamblea.id}/elecciones`, { como: responsable, body: { cargo: 'Vocal' } });
    expect((await pedir('POST', `/api/elecciones/${vacia.body.id}/abrir`, { como: responsable })).status).toBe(409);
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable })).status).toBe(200);
    await pedir('POST', `/api/elecciones/${vacia.body.id}/candidatos`, { como: responsable, body: { nombre: 'Único Vocal' } });
    const segunda = await pedir('POST', `/api/elecciones/${vacia.body.id}/abrir`, { como: responsable });
    expect(segunda.status).toBe(409);
    expect((await pedir('GET', `/api/asambleas/${asamblea.id}`, { como: responsable })).body.estado).toBe('EN_CURSO');
  });

  it('al abrir, el elector pasa a ver la cédula; al cerrar, ya no puede votar', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(2, 2);
    expect((await tels[0]('GET', `/api/votacion/${asamblea.codigoAcceso}/estado`)).body.estado).toBe('ESPERA');
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    expect((await tels[0]('GET', `/api/votacion/${asamblea.codigoAcceso}/estado`)).body.estado).toBe('ABIERTA');
    expect((await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[0] })).status).toBe(201);
    const cierre = await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    expect(cierre.body).toMatchObject({ estado: 'CERRADA', total: 1, ganadorId: candidatos[0] });
    expect((await tels[1]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[1] })).status).toBe(409);
    expect((await tels[1]('GET', `/api/votacion/${asamblea.codigoAcceso}/estado`)).body.estado).toBe('ESPERA');
  });

  it('cierre con votos en vuelo: todo voto aceptado se cuenta y ninguno entra después', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(3, 25);
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    const votos = tels.map((tel, i) => tel('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[i % 3] }));
    // El cierre se dispara en medio de la ráfaga de votos.
    await new Promise((r) => setTimeout(r, 15));
    const cierre = pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    const respuestas = await Promise.all(votos);
    const resultado = (await cierre).body;
    const aceptados = respuestas.filter((r) => r.status === 201).length;
    expect(respuestas.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(resultado.total).toBe(aceptados);
    expect(await prisma.emision.count({ where: { eleccionId } })).toBe(aceptados);
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(aceptados);
  });
});

describe('HU13 — conteo en vivo (solo para el panel)', () => {
  it('el panel recibe el conteo por Socket.IO en menos de 2 s tras cada voto', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(2, 2);
    const panel = await conectar(cookieDe(responsable));
    expect(await unirse(panel, 'admin:unirse', { asambleaId: asamblea.id })).toEqual({ ok: true });
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    const llega = esperarEvento<{ total: number; candidatos: { id: number; votos: number }[] }>(panel, 'conteo:actualizado', 2000);
    const t0 = Date.now();
    await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[1] });
    const c = await llega;
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(c.total).toBe(1);
    expect(c.candidatos.find((x) => x.id === candidatos[1])?.votos).toBe(1);
  });

  it('sin sesión, sin permiso o fuera de alcance, no se une a la sala del panel', async () => {
    const { asamblea } = await escenario(1, 0);
    expect((await unirse(await conectar(), 'admin:unirse', { asambleaId: asamblea.id })).ok).toBe(false);
    const fuera = await unirse(await conectar(cookieDe(distrital)), 'admin:unirse', { asambleaId: asamblea.id });
    expect(fuera).toEqual({ ok: false, error: 'Fuera de tu alcance' });
  });

  it('la proyección nunca recibe el conteo', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(2, 1);
    const proyeccion = await conectar();
    expect(await unirse(proyeccion, 'proyeccion:unirse', { codigo: asamblea.codigoAcceso })).toEqual({ ok: true });
    const panel = await conectar(cookieDe(responsable));
    await unirse(panel, 'admin:unirse', { asambleaId: asamblea.id });
    const recibidos: string[] = [];
    proyeccion.onAny((evento) => recibidos.push(evento));
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    const enPanel = esperarEvento(panel, 'conteo:actualizado');
    await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[0] });
    await enPanel;
    await new Promise((r) => setTimeout(r, 300));
    expect(recibidos).toEqual([]);
  });

  it('el conteo por REST exige el panel: un elector no puede pedirlo', async () => {
    const { eleccionId, tels } = await escenario(1, 1);
    expect((await tels[0]('GET', `/api/elecciones/${eleccionId}/conteo`)).status).toBe(401);
    expect((await pedir('GET', `/api/elecciones/${eleccionId}/conteo`, { como: distrital })).status).toBe(403);
  });
});

describe('HU14 — proyección del ganador', () => {
  it('publica el ganador: llega a la proyección con cargo y nombre, sin votos', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(2, 1);
    const proyeccion = await conectar();
    await unirse(proyeccion, 'proyeccion:unirse', { codigo: asamblea.codigoAcceso });
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[1] });
    await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    const llega = esperarEvento<Record<string, unknown>>(proyeccion, 'ganador:proclamado');
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/publicar`, { como: responsable })).status).toBe(200);
    const g = await llega;
    expect(g).toMatchObject({ cargo: 'Tesorero Regional', ronda: 1, candidato: { id: candidatos[1], nombre: 'Candidato 2' } });
    expect(JSON.stringify(g)).not.toMatch(/votos|total|emisiones/);
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/publicar`, { como: responsable })).status).toBe(409);

    const pantalla = await fetch(`${base}/api/proyeccion/${asamblea.codigoAcceso}`).then((r) => r.json());
    expect(pantalla.proclamado.candidato.nombre).toBe('Candidato 2');
    expect(JSON.stringify(pantalla)).not.toMatch(/votos|total|emisiones/);
    const fila = await prisma.eleccion.findUniqueOrThrow({ where: { id: eleccionId } });
    expect(fila.publicadaEn!.getTime()).toBeGreaterThanOrEqual(fila.cerradaEn!.getTime());
  });
});

describe('HU15 — empate, segunda vuelta, acta y métricas', () => {
  it('con empate no hay ganador; la segunda vuelta lleva solo a los empatados', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(3, 4);
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    // 2 – 2 – 0: empatan los dos primeros; el tercero queda fuera.
    for (const [i, c] of [0, 0, 1, 1].entries()) {
      expect((await tels[i]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[c] })).status).toBe(201);
    }
    const cierre = (await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable })).body;
    expect(cierre.ganadorId).toBeNull();
    expect(cierre.empatados.sort()).toEqual([candidatos[0], candidatos[1]].sort());
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/publicar`, { como: responsable })).status).toBe(409);

    const ronda2 = await pedir('POST', `/api/elecciones/${eleccionId}/segunda-vuelta`, { como: responsable });
    expect(ronda2.status).toBe(201);
    expect(ronda2.body).toMatchObject({ cargo: 'Tesorero Regional', ronda: 2 });
    expect((await pedir('POST', `/api/elecciones/${eleccionId}/segunda-vuelta`, { como: responsable })).status).toBe(409);
    const nuevos = await prisma.candidato.findMany({ where: { eleccionId: ronda2.body.id }, orderBy: { orden: 'asc' } });
    expect(nuevos.map((c) => c.nombre)).toEqual(['Candidato 1', 'Candidato 2']);

    // Ronda 2: los mismos electores vuelven a votar (es otra elección) y ahora hay ganador.
    await pedir('POST', `/api/elecciones/${ronda2.body.id}/abrir`, { como: responsable });
    const cedula = await tels[0]('GET', `/api/votacion/${asamblea.codigoAcceso}/cedula`);
    expect(cedula.body).toMatchObject({ ronda: 2, yaVoto: false });
    for (const i of [0, 1, 2]) {
      await tels[i]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId: ronda2.body.id, candidatoId: nuevos[1].id });
    }
    const final = (await pedir('POST', `/api/elecciones/${ronda2.body.id}/cerrar`, { como: responsable })).body;
    expect(final.ganadorId).toBe(nuevos[1].id);
  });

  it('el acta es un PDF y el CSV trae métricas sin datos personales', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(2, 2);
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[0] });
    await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    await pedir('POST', `/api/elecciones/${eleccionId}/publicar`, { como: responsable });

    const acta = await fetch(`${base}/api/asambleas/${asamblea.id}/acta.pdf`, { headers: { Cookie: cookieDe(responsable) } });
    expect(acta.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await acta.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');

    const csv = await fetch(`${base}/api/asambleas/${asamblea.id}/metricas.csv`, { headers: { Cookie: cookieDe(responsable) } }).then((r) => r.text());
    const [encabezado, fila] = csv.replace('﻿', '').trim().split('\r\n');
    expect(encabezado).toBe(
      'eleccion_id,cargo,ronda,estado,abierta_en,cerrada_en,publicada_en,segundos_votacion,segundos_cierre_a_publicacion,acreditados,emisiones,votos_contabilizados,participacion_pct',
    );
    expect(fila).toMatch(/^\d+,Tesorero Regional,1,CERRADA,.+-05:00,.+-05:00,.+-05:00,\d+,\d+,2,1,1,50\.0$/);
    // Ni electores (nombre, DNI) ni candidatos.
    expect(csv).not.toMatch(/Elector|Candidato|5\d{7}/);

    expect((await pedir('GET', `/api/asambleas/${asamblea.id}/acta.pdf`, { como: distrital })).status).toBe(403);
  });

  it('no finaliza con una votación abierta; finalizada, el elector ve FINALIZADA', async () => {
    const { asamblea, eleccionId, tels } = await escenario(1, 1);
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    expect((await pedir('POST', `/api/asambleas/${asamblea.id}/finalizar`, { como: responsable })).status).toBe(409);
    await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    expect((await pedir('POST', `/api/asambleas/${asamblea.id}/finalizar`, { como: responsable })).status).toBe(200);
    expect((await tels[0]('GET', `/api/votacion/${asamblea.codigoAcceso}/estado`)).body.estado).toBe('FINALIZADA');
  });

  it('una asamblea con votos no se borra salvo forzado por el Responsable', async () => {
    const { asamblea, eleccionId, candidatos, tels } = await escenario(1, 1);
    await pedir('POST', `/api/elecciones/${eleccionId}/abrir`, { como: responsable });
    await tels[0]('POST', `/api/votacion/${asamblea.codigoAcceso}/votar`, { eleccionId, candidatoId: candidatos[0] });
    await pedir('POST', `/api/elecciones/${eleccionId}/cerrar`, { como: responsable });
    expect((await pedir('DELETE', `/api/asambleas/${asamblea.id}`, { como: responsable })).status).toBe(409);
    expect((await pedir('DELETE', `/api/asambleas/${asamblea.id}?forzar=1`, { como: responsable })).status).toBe(204);
    expect(await prisma.voto.count({ where: { eleccionId } })).toBe(0);
  });
});
