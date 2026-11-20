import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/ApiError';
import { generarCodigoAcceso, generarCodigoElector } from '../../utils/codigos';
import { invalidarAsamblea } from '../votacion/votacion.estado';

/**
 * Costo bcrypt del código de 4 dígitos (ADR-029). Más bajo que el de las contraseñas (12) a
 * propósito: con solo 10 000 combinaciones, ningún costo protege el código de un ataque offline;
 * lo que lo protege es el límite de 5 intentos por DNI. Con 12, bcryptjs (JavaScript puro) tarda
 * ~300 ms por verificación y 200 ingresos simultáneos ocuparían el único proceso un minuto entero.
 */
export const COSTO_BCRYPT_CODIGO = 8;

const SELECT_ASAMBLEA = {
  id: true,
  nombre: true,
  tipo: true,
  distritoId: true,
  fecha: true,
  codigoAcceso: true,
  estado: true,
  distrito: { select: { nombre: true } },
} as const;

type AsambleaBase = Prisma.AsambleaGetPayload<{ select: typeof SELECT_ASAMBLEA }>;

function aRespuesta(a: AsambleaBase) {
  return {
    id: a.id,
    nombre: a.nombre,
    tipo: a.tipo,
    distritoId: a.distritoId,
    distrito: a.distrito?.nombre ?? null,
    fecha: a.fecha,
    codigoAcceso: a.codigoAcceso,
    estado: a.estado,
  };
}

// ─── Asambleas ─────────────────────────────────────────────────────────────────────────────────

export async function listar(where: Record<string, unknown>, page: number, limit: number) {
  const [filas, total] = await Promise.all([
    prisma.asamblea.findMany({
      where,
      select: {
        ...SELECT_ASAMBLEA,
        _count: { select: { elecciones: true, electores: true } },
      },
      orderBy: { fecha: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.asamblea.count({ where }),
  ]);
  return {
    data: filas.map((a) => ({ ...aRespuesta(a), elecciones: a._count.elecciones, electores: a._count.electores })),
    total,
    page,
    limit,
  };
}

/** Solo lo necesario para decidir permisos y estado; no trae relaciones. */
export async function cabecera(id: number) {
  const a = await prisma.asamblea.findUnique({
    where: { id },
    select: { id: true, tipo: true, distritoId: true, estado: true, codigoAcceso: true, nombre: true },
  });
  if (!a) throw new ApiError(404, 'Asamblea no encontrada');
  return a;
}

export async function detalle(id: number) {
  const a = await prisma.asamblea.findUnique({
    where: { id },
    select: {
      ...SELECT_ASAMBLEA,
      elecciones: {
        orderBy: [{ id: 'asc' }],
        select: {
          id: true,
          cargo: true,
          ronda: true,
          estado: true,
          abiertaEn: true,
          cerradaEn: true,
          publicadaEn: true,
          ganadorId: true,
          ganador: { select: { nombre: true } },
          _count: { select: { emisiones: true } },
          // Sin `foto`: es base64 y viaja aparte por /api/candidatos/:id/foto, cacheable.
          candidatos: {
            orderBy: [{ orden: 'asc' }, { id: 'asc' }],
            select: { id: true, nombre: true, detalle: true, orden: true },
          },
        },
      },
    },
  });
  if (!a) throw new ApiError(404, 'Asamblea no encontrada');
  const [padron, acreditados] = await Promise.all([
    prisma.elector.count({ where: { asambleaId: id } }),
    prisma.elector.count({ where: { asambleaId: id, acreditado: true } }),
  ]);
  return {
    ...aRespuesta(a),
    padron,
    acreditados,
    elecciones: a.elecciones.map(({ _count, ganador, ...e }) => ({
      ...e,
      emisiones: _count.emisiones,
      ganador: ganador?.nombre ?? null,
    })),
  };
}

export async function crear(datos: { nombre: string; tipo: 'REGIONAL' | 'DISTRITAL'; distritoId?: number | null; fecha: Date }) {
  // El código es aleatorio; ante el improbable choque con uno existente (UNIQUE), se reintenta.
  for (let intento = 0; intento < 5; intento++) {
    try {
      const a = await prisma.asamblea.create({
        data: {
          nombre: datos.nombre,
          tipo: datos.tipo,
          distritoId: datos.tipo === 'DISTRITAL' ? datos.distritoId : null,
          fecha: datos.fecha,
          codigoAcceso: generarCodigoAcceso(),
        },
        select: SELECT_ASAMBLEA,
      });
      return aRespuesta(a);
    } catch (err) {
      const choque =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        String(err.meta?.target ?? '').includes('codigo');
      if (!choque) throw err;
    }
  }
  throw new ApiError(500, 'No se pudo generar un código de acceso único');
}

export async function actualizar(id: number, datos: { nombre?: string; fecha?: Date }) {
  const a = await prisma.asamblea.update({ where: { id }, data: datos, select: SELECT_ASAMBLEA });
  invalidarAsamblea(id);
  return aRespuesta(a);
}

/**
 * Una asamblea con votos registrados es un acta: no se borra salvo pedido explícito (`forzar`),
 * que solo se ofrece al Responsable del sistema y queda auditado (lo usa la prueba de carga).
 */
export async function eliminar(id: number, forzar: boolean) {
  const emisiones = await prisma.emision.count({ where: { eleccion: { asambleaId: id } } });
  if (emisiones > 0 && !forzar) {
    throw new ApiError(409, 'La asamblea ya tiene votos registrados y no puede eliminarse.');
  }
  // El ganador referencia a un candidato de la misma asamblea: se suelta antes del borrado en
  // cascada para no depender del orden en que MySQL recorre la relación circular.
  await prisma.$transaction([
    prisma.eleccion.updateMany({ where: { asambleaId: id }, data: { ganadorId: null } }),
    prisma.asamblea.delete({ where: { id } }),
  ]);
  invalidarAsamblea(id);
}

function exigirNoFinalizada(estado: string) {
  if (estado === 'FINALIZADA') throw new ApiError(409, 'La asamblea ya finalizó: no admite cambios.');
}

// ─── Elecciones (cargos) y candidatos ─────────────────────────────────────────────────────────

export async function cabeceraEleccion(id: number) {
  const e = await prisma.eleccion.findUnique({
    where: { id },
    select: {
      id: true,
      asambleaId: true,
      cargo: true,
      ronda: true,
      estado: true,
      ganadorId: true,
      publicadaEn: true,
      asamblea: { select: { id: true, tipo: true, distritoId: true, estado: true, codigoAcceso: true, nombre: true } },
    },
  });
  if (!e) throw new ApiError(404, 'Elección no encontrada');
  return e;
}

function exigirPendiente(estado: string) {
  if (estado !== 'PENDIENTE') {
    throw new ApiError(409, 'Esa elección ya se abrió: sus datos y candidatos no pueden cambiar.');
  }
}

export async function crearEleccion(asamblea: { id: number; estado: string }, cargo: string) {
  exigirNoFinalizada(asamblea.estado);
  try {
    return await prisma.eleccion.create({
      data: { asambleaId: asamblea.id, cargo, ronda: 1 },
      select: { id: true, cargo: true, ronda: true, estado: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, `Ya existe la elección de "${cargo}" en esta asamblea.`);
    }
    throw err;
  }
}

export async function actualizarEleccion(eleccion: { id: number; estado: string }, cargo: string) {
  exigirPendiente(eleccion.estado);
  return prisma.eleccion.update({ where: { id: eleccion.id }, data: { cargo }, select: { id: true, cargo: true } });
}

export async function eliminarEleccion(eleccion: { id: number; estado: string }) {
  exigirPendiente(eleccion.estado);
  await prisma.eleccion.delete({ where: { id: eleccion.id } });
}

export async function cabeceraCandidato(id: number) {
  const c = await prisma.candidato.findUnique({
    where: { id },
    select: { id: true, eleccionId: true, eleccion: { select: { estado: true, asamblea: { select: { tipo: true, distritoId: true } } } } },
  });
  if (!c) throw new ApiError(404, 'Candidato no encontrado');
  return c;
}

interface DatosCandidato {
  nombre?: string;
  detalle?: string | null;
  foto?: string | null;
  orden?: number;
}

export async function crearCandidato(eleccion: { id: number; estado: string }, datos: DatosCandidato & { nombre: string }) {
  exigirPendiente(eleccion.estado);
  const orden = datos.orden ?? (await prisma.candidato.count({ where: { eleccionId: eleccion.id } }));
  return prisma.candidato.create({
    data: { eleccionId: eleccion.id, nombre: datos.nombre, detalle: datos.detalle, foto: datos.foto, orden },
    select: { id: true, nombre: true, detalle: true, orden: true },
  });
}

export async function actualizarCandidato(id: number, estadoEleccion: string, datos: DatosCandidato) {
  exigirPendiente(estadoEleccion);
  olvidarFoto(id);
  return prisma.candidato.update({
    where: { id },
    data: datos,
    select: { id: true, nombre: true, detalle: true, orden: true },
  });
}

export async function eliminarCandidato(id: number, estadoEleccion: string) {
  exigirPendiente(estadoEleccion);
  olvidarFoto(id);
  await prisma.candidato.delete({ where: { id } });
}

// ─── Fotos de candidatos ──────────────────────────────────────────────────────────────────────

interface FotoDecodificada {
  tipo: string;
  datos: Buffer;
  etag: string;
}

/**
 * Las fotos se decodifican una vez y quedan en memoria: al abrirse una elección, 200 celulares
 * piden las mismas 3 o 4 fotos en el mismo segundo. `null` = el candidato no tiene foto.
 */
const fotos = new Map<number, FotoDecodificada | null>();
const MAX_FOTOS_EN_MEMORIA = 200;

function olvidarFoto(id: number) {
  fotos.delete(id);
}

export async function fotoCandidato(id: number): Promise<FotoDecodificada | null> {
  if (fotos.has(id)) return fotos.get(id)!;
  const c = await prisma.candidato.findUnique({ where: { id }, select: { foto: true } });
  if (!c) return null;
  const m = c.foto?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  const foto = m ? { tipo: m[1], datos: Buffer.from(m[2], 'base64'), etag: `"c${id}-${m[2].length}"` } : null;
  if (fotos.size >= MAX_FOTOS_EN_MEMORIA) fotos.clear();
  fotos.set(id, foto);
  return foto;
}

// ─── Padrón y acreditación ────────────────────────────────────────────────────────────────────

export async function listarElectores(asambleaId: number, q: string | undefined, page: number, limit: number) {
  const where: Prisma.ElectorWhereInput = {
    asambleaId,
    ...(q ? { OR: [{ dni: { contains: q } }, { nombre: { contains: q } }] } : {}),
  };
  const [filas, total] = await Promise.all([
    prisma.elector.findMany({
      where,
      select: {
        id: true,
        dni: true,
        nombre: true,
        acreditado: true,
        acreditadoEn: true,
        iglesia: { select: { nombre: true } },
        _count: { select: { emisiones: true } },
      },
      orderBy: { nombre: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.elector.count({ where }),
  ]);
  return {
    data: filas.map(({ iglesia, _count, ...e }) => ({ ...e, iglesia: iglesia?.nombre ?? null, votos: _count.emisiones })),
    total,
    page,
    limit,
  };
}

export async function agregarElector(
  asamblea: { id: number; estado: string },
  datos: { dni: string; nombre: string; iglesiaId?: number },
) {
  exigirNoFinalizada(asamblea.estado);
  try {
    return await prisma.elector.create({
      data: { asambleaId: asamblea.id, dni: datos.dni, nombre: datos.nombre, iglesiaId: datos.iglesiaId },
      select: { id: true, dni: true, nombre: true, acreditado: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'Ese DNI ya está en el padrón de esta asamblea.');
    }
    throw err;
  }
}

export async function eliminarElector(asambleaId: number, electorId: number) {
  const e = await prisma.elector.findFirst({
    where: { id: electorId, asambleaId },
    select: { _count: { select: { emisiones: true } } },
  });
  if (!e) throw new ApiError(404, 'Elector no encontrado en esta asamblea');
  if (e._count.emisiones > 0) throw new ApiError(409, 'Ese elector ya votó: no puede quitarse del padrón.');
  await prisma.elector.delete({ where: { id: electorId } });
}

/**
 * Carga al padrón los congregantes de una iglesia o distrito. `whereAlcance` acota a lo que el
 * usuario puede ver (ADR-026). Los DNI que ya están se saltan (skipDuplicates sobre el UNIQUE).
 */
export async function importarPadron(
  asamblea: { id: number; estado: string },
  filtro: { iglesiaId?: number; distritoId?: number; soloBautizados: boolean },
  whereAlcance: Record<string, unknown>,
) {
  exigirNoFinalizada(asamblea.estado);
  const congregantes = await prisma.congregante.findMany({
    where: {
      AND: [
        whereAlcance,
        filtro.iglesiaId ? { iglesiaId: filtro.iglesiaId } : {},
        filtro.distritoId ? { iglesia: { distritoId: filtro.distritoId } } : {},
        filtro.soloBautizados ? { estadoEclesial: { nombre: 'Bautizado' } } : {},
      ],
    },
    select: { dni: true, nombre: true, apellido: true, iglesiaId: true },
  });
  const { count } = await prisma.elector.createMany({
    data: congregantes.map((c) => ({
      asambleaId: asamblea.id,
      dni: c.dni,
      nombre: `${c.nombre} ${c.apellido}`.slice(0, 191),
      iglesiaId: c.iglesiaId,
    })),
    skipDuplicates: true,
  });
  return { encontrados: congregantes.length, agregados: count };
}

/** Para la mesa: ¿el DNI está en el padrón? Si no, ¿es un congregante registrado? */
export async function buscarDni(asambleaId: number, dni: string, whereAlcanceCongregante: Record<string, unknown>) {
  const elector = await prisma.elector.findUnique({
    where: { asambleaId_dni: { asambleaId, dni } },
    select: { id: true, dni: true, nombre: true, acreditado: true, acreditadoEn: true, iglesia: { select: { nombre: true } } },
  });
  if (elector) return { enPadron: true, elector: { ...elector, iglesia: elector.iglesia?.nombre ?? null } };
  const congregante = await prisma.congregante.findFirst({
    where: { AND: [{ dni }, whereAlcanceCongregante] },
    select: { dni: true, nombre: true, apellido: true, iglesiaId: true, iglesia: { select: { nombre: true } } },
  });
  return {
    enPadron: false,
    sugerencia: congregante
      ? { dni: congregante.dni, nombre: `${congregante.nombre} ${congregante.apellido}`, iglesiaId: congregante.iglesiaId, iglesia: congregante.iglesia.nombre }
      : null,
  };
}

/**
 * Acredita a un elector del padrón: genera su código de 4 dígitos, guarda solo el hash y devuelve
 * el código en claro UNA vez, para que la mesa se lo entregue. Si ya estaba acreditado, solo se
 * genera otro con `regenerar` (perdió el papel): el código anterior deja de servir.
 */
export async function acreditar(asamblea: { id: number; estado: string }, dni: string, regenerar = false) {
  exigirNoFinalizada(asamblea.estado);
  const elector = await prisma.elector.findUnique({
    where: { asambleaId_dni: { asambleaId: asamblea.id, dni } },
    select: { id: true, nombre: true, acreditado: true },
  });
  if (!elector) throw new ApiError(404, 'Ese DNI no está en el padrón de la asamblea.');
  if (elector.acreditado && !regenerar) {
    throw new ApiError(409, 'Ese elector ya está acreditado. Si perdió su código, genera uno nuevo.');
  }
  const codigo = generarCodigoElector();
  const actualizado = await prisma.elector.update({
    where: { id: elector.id },
    data: {
      codigoHash: await bcrypt.hash(codigo, COSTO_BCRYPT_CODIGO),
      acreditado: true,
      acreditadoEn: new Date(),
    },
    select: { id: true, dni: true, nombre: true, acreditadoEn: true },
  });
  return { elector: actualizado, codigo, regenerado: elector.acreditado };
}
