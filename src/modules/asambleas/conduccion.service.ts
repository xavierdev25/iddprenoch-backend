import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/ApiError';
import { invalidarAsamblea } from '../votacion/votacion.estado';
import { Proclamacion, eventosVotacion } from '../votacion/votacion.eventos';
import { calcularResultado, porcentaje } from './resultados';

/**
 * Conducción de la votación por la mesa (HU12–HU15): abrir, cerrar, segunda vuelta, publicar y
 * finalizar. Cada paso invalida el estado en memoria que consultan los electores y avisa al panel.
 */

function avisar(asambleaId: number) {
  invalidarAsamblea(asambleaId);
  eventosVotacion.emit('cambioEstado', { asambleaId });
}

/** Conteo de una elección: SOLO para el panel del administrador, nunca para electores ni proyección. */
export async function conteo(eleccionId: number) {
  const eleccion = await prisma.eleccion.findUnique({
    where: { id: eleccionId },
    select: {
      id: true,
      cargo: true,
      ronda: true,
      estado: true,
      ganadorId: true,
      publicadaEn: true,
      asambleaId: true,
      candidatos: { select: { id: true, nombre: true, detalle: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!eleccion) throw new ApiError(404, 'Elección no encontrada');
  const [agrupado, emisiones, acreditados] = await Promise.all([
    prisma.voto.groupBy({ by: ['candidatoId'], where: { eleccionId }, _count: { _all: true } }),
    prisma.emision.count({ where: { eleccionId } }),
    prisma.elector.count({ where: { asambleaId: eleccion.asambleaId, acreditado: true } }),
  ]);
  const votosDe = new Map(agrupado.map((g) => [g.candidatoId, g._count._all]));
  const total = agrupado.reduce((s, g) => s + g._count._all, 0);
  const resultado = calcularResultado(eleccion.candidatos.map((c) => ({ candidatoId: c.id, votos: votosDe.get(c.id) ?? 0 })));
  return {
    eleccionId: eleccion.id,
    asambleaId: eleccion.asambleaId,
    cargo: eleccion.cargo,
    ronda: eleccion.ronda,
    estado: eleccion.estado,
    ganadorId: eleccion.ganadorId,
    publicada: eleccion.publicadaEn !== null,
    acreditados,
    emisiones,
    total,
    candidatos: eleccion.candidatos.map((c) => {
      const votos = votosDe.get(c.id) ?? 0;
      return { ...c, votos, porcentaje: porcentaje(votos, total) };
    }),
    // Solo tiene sentido al cerrar; mientras está abierta es un "si se cerrara ahora".
    empatados: eleccion.estado === 'CERRADA' && !eleccion.ganadorId ? resultado.empatados : [],
  };
}

export async function abrir(eleccionId: number) {
  const e = await prisma.eleccion.findUnique({
    where: { id: eleccionId },
    select: {
      estado: true,
      asambleaId: true,
      asamblea: { select: { estado: true } },
      _count: { select: { candidatos: true } },
    },
  });
  if (!e) throw new ApiError(404, 'Elección no encontrada');
  if (e.asamblea.estado === 'FINALIZADA') throw new ApiError(409, 'La asamblea ya finalizó.');
  if (e.estado !== 'PENDIENTE') throw new ApiError(409, 'Esa elección ya se abrió antes.');
  if (e._count.candidatos < 1) throw new ApiError(409, 'Agrega al menos un candidato antes de abrir la votación.');

  // Una sola elección abierta por asamblea: la cédula del elector muestra una a la vez. El
  // UPDATE condicionado evita que dos clics simultáneos abran dos cargos a la vez.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM asambleas WHERE id = ${e.asambleaId} FOR UPDATE`;
    const abiertas = await tx.eleccion.count({ where: { asambleaId: e.asambleaId, estado: 'ABIERTA' } });
    if (abiertas > 0) throw new ApiError(409, 'Ya hay una votación abierta en esta asamblea. Ciérrala primero.');
    await tx.eleccion.update({ where: { id: eleccionId }, data: { estado: 'ABIERTA', abiertaEn: new Date() } });
    await tx.asamblea.updateMany({ where: { id: e.asambleaId, estado: 'PROGRAMADA' }, data: { estado: 'EN_CURSO' } });
  });
  avisar(e.asambleaId);
  return conteo(eleccionId);
}

/**
 * Cierra la elección y calcula el ganador. El UPDATE espera a que terminen los votos que ya
 * leyeron la elección como ABIERTA (FOR SHARE en votacion.service), así que el conteo es exacto:
 * ningún voto aceptado queda fuera y ninguno entra después.
 */
export async function cerrar(eleccionId: number) {
  const asambleaId = await prisma.$transaction(async (tx) => {
    const [fila] = await tx.$queryRaw<{ estado: string; asamblea_id: number }[]>`
      SELECT estado, asamblea_id FROM elecciones WHERE id = ${eleccionId} FOR UPDATE`;
    if (!fila) throw new ApiError(404, 'Elección no encontrada');
    if (fila.estado !== 'ABIERTA') throw new ApiError(409, 'Esa elección no está abierta.');
    const agrupado = await tx.voto.groupBy({ by: ['candidatoId'], where: { eleccionId }, _count: { _all: true } });
    const candidatos = await tx.candidato.findMany({ where: { eleccionId }, select: { id: true } });
    const votosDe = new Map(agrupado.map((g) => [g.candidatoId, g._count._all]));
    const { ganadorId } = calcularResultado(candidatos.map((c) => ({ candidatoId: c.id, votos: votosDe.get(c.id) ?? 0 })));
    await tx.eleccion.update({
      where: { id: eleccionId },
      data: { estado: 'CERRADA', cerradaEn: new Date(), ganadorId },
    });
    return fila.asamblea_id;
  });
  avisar(asambleaId);
  return conteo(eleccionId);
}

/** Segunda vuelta (HU15): otra elección del mismo cargo, ronda + 1, solo con los empatados. */
export async function segundaVuelta(eleccionId: number) {
  const actual = await conteo(eleccionId);
  if (actual.estado !== 'CERRADA') throw new ApiError(409, 'Primero hay que cerrar la votación.');
  if (actual.ganadorId) throw new ApiError(409, 'Esta elección tiene ganador: no corresponde segunda vuelta.');
  if (actual.empatados.length < 2) throw new ApiError(409, 'No hay empate entre dos o más candidatos.');

  const originales = await prisma.candidato.findMany({
    where: { id: { in: actual.empatados } },
    select: { nombre: true, detalle: true, foto: true, orden: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  try {
    const nueva = await prisma.eleccion.create({
      data: {
        asambleaId: actual.asambleaId,
        cargo: actual.cargo,
        ronda: actual.ronda + 1,
        candidatos: { create: originales.map((c, i) => ({ nombre: c.nombre, detalle: c.detalle, foto: c.foto, orden: i })) },
      },
      select: { id: true, cargo: true, ronda: true },
    });
    avisar(actual.asambleaId);
    return nueva;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'La segunda vuelta de este cargo ya fue convocada.');
    }
    throw err;
  }
}

/** Publica el ganador: lo proyecta en la pantalla de la asamblea y fija `publicadaEn` (métrica). */
export async function publicar(eleccionId: number) {
  const e = await prisma.eleccion.findUnique({
    where: { id: eleccionId },
    select: {
      id: true,
      cargo: true,
      ronda: true,
      estado: true,
      publicadaEn: true,
      asambleaId: true,
      ganador: { select: { id: true, nombre: true, detalle: true, foto: true } },
    },
  });
  if (!e) throw new ApiError(404, 'Elección no encontrada');
  if (e.estado !== 'CERRADA' || !e.ganador) throw new ApiError(409, 'Solo se publica una elección cerrada y con ganador.');
  if (e.publicadaEn) throw new ApiError(409, 'El resultado ya fue publicado.');

  const publicadaEn = new Date();
  // Condicionado a `publicada_en IS NULL`: dos clics seguidos no reescriben la métrica.
  const { count } = await prisma.eleccion.updateMany({ where: { id: eleccionId, publicadaEn: null }, data: { publicadaEn } });
  if (count === 0) throw new ApiError(409, 'El resultado ya fue publicado.');

  const proclamacion: Proclamacion = {
    asambleaId: e.asambleaId,
    eleccionId: e.id,
    cargo: e.cargo,
    ronda: e.ronda,
    candidato: { id: e.ganador.id, nombre: e.ganador.nombre, detalle: e.ganador.detalle, tieneFoto: Boolean(e.ganador.foto) },
    publicadaEn,
  };
  eventosVotacion.emit('proclamado', proclamacion);
  avisar(e.asambleaId);
  return proclamacion;
}

export async function finalizar(asambleaId: number) {
  const abiertas = await prisma.eleccion.count({ where: { asambleaId, estado: 'ABIERTA' } });
  if (abiertas > 0) throw new ApiError(409, 'Hay una votación abierta. Ciérrala antes de finalizar la asamblea.');
  await prisma.asamblea.update({ where: { id: asambleaId }, data: { estado: 'FINALIZADA' } });
  avisar(asambleaId);
}

/** Lo que ve la pantalla de proyección al cargar: el último ganador publicado. Nunca conteos. */
export async function ultimaProclamacion(asambleaId: number) {
  const e = await prisma.eleccion.findFirst({
    where: { asambleaId, publicadaEn: { not: null } },
    orderBy: { publicadaEn: 'desc' },
    select: {
      id: true,
      cargo: true,
      ronda: true,
      publicadaEn: true,
      ganador: { select: { id: true, nombre: true, detalle: true, foto: true } },
    },
  });
  if (!e?.ganador) return null;
  return {
    eleccionId: e.id,
    cargo: e.cargo,
    ronda: e.ronda,
    candidato: { id: e.ganador.id, nombre: e.ganador.nombre, detalle: e.ganador.detalle, tieneFoto: Boolean(e.ganador.foto) },
    publicadaEn: e.publicadaEn,
  };
}
