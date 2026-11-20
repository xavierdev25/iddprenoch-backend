import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/ApiError';
import { EstadoVotacion, estadoParaElector, estadoPorCodigo, registrarEmision } from './votacion.estado';
import { eventosVotacion } from './votacion.eventos';
import { fallosIngreso, ingresosPorIp } from './votacion.limites';

/** Hash con el mismo costo que los reales: un DNI inexistente tarda lo mismo que uno válido. */
const HASH_SEÑUELO = bcrypt.hashSync('0000', 8);

export async function asambleaPorCodigo(codigo: string): Promise<EstadoVotacion> {
  const estado = await estadoPorCodigo(codigo);
  if (!estado) throw new ApiError(404, 'No encontramos esa asamblea. Revisa el código del QR.');
  return estado;
}

/** Lo que muestra la pantalla de ingreso y la de espera. Sale de memoria: sin consultas. */
export function info(e: EstadoVotacion) {
  return {
    nombre: e.nombre,
    estado: estadoParaElector(e),
    eleccion: e.eleccion ? { id: e.eleccion.id, cargo: e.eleccion.cargo, ronda: e.eleccion.ronda } : null,
    siguienteCargo: e.siguienteCargo,
  };
}

/**
 * Ingreso con DNI + código de 4 dígitos. El mismo mensaje para "DNI no está" y "código errado":
 * distinguirlos permitiría averiguar quién está en el padrón.
 */
export async function ingresar(e: EstadoVotacion, dni: string, codigo: string, ip: string | undefined) {
  if (e.estadoAsamblea === 'FINALIZADA') throw new ApiError(409, 'Esta asamblea ya terminó.');
  if (!ingresosPorIp.consumir(ip ?? 'sin-ip')) {
    throw new ApiError(429, 'Demasiados intentos desde esta red. Espera unos minutos.');
  }
  const clave = `${e.asambleaId}:${dni}`;
  if (fallosIngreso.bloqueado(clave)) {
    throw new ApiError(429, 'Superaste los 5 intentos. Acércate a la mesa de acreditación.');
  }

  const elector = await prisma.elector.findUnique({
    where: { asambleaId_dni: { asambleaId: e.asambleaId, dni } },
    select: { id: true, nombre: true, acreditado: true, codigoHash: true, acreditadoEn: true },
  });
  const valido =
    (await bcrypt.compare(codigo, elector?.codigoHash ?? HASH_SEÑUELO)) &&
    Boolean(elector?.acreditado && elector.codigoHash);

  if (!valido || !elector) {
    fallosIngreso.consumir(clave);
    if (fallosIngreso.bloqueado(clave)) {
      throw new ApiError(429, 'Superaste los 5 intentos. Acércate a la mesa de acreditación.');
    }
    throw new ApiError(401, 'DNI o código incorrectos. Revisa los números e inténtalo de nuevo.');
  }
  fallosIngreso.reiniciar(clave);
  return {
    sesion: { electorId: elector.id, asambleaId: e.asambleaId, acreditadoEn: elector.acreditadoEn!.getTime() },
    elector: { nombre: elector.nombre },
  };
}

interface CandidatoCedula {
  id: number;
  nombre: string;
  detalle: string | null;
  tieneFoto: boolean;
}

/** Candidatos por elección: no cambian una vez abierta (solo se editan en PENDIENTE). */
const cedulas = new Map<number, CandidatoCedula[]>();

async function candidatosDe(eleccionId: number): Promise<CandidatoCedula[]> {
  const enCache = cedulas.get(eleccionId);
  if (enCache) return enCache;
  const filas = await prisma.candidato.findMany({
    where: { eleccionId },
    select: { id: true, nombre: true, detalle: true, foto: true },
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
  });
  const lista = filas.map((c) => ({ id: c.id, nombre: c.nombre, detalle: c.detalle, tieneFoto: Boolean(c.foto) }));
  if (cedulas.size > 100) cedulas.clear();
  cedulas.set(eleccionId, lista);
  return lista;
}

/** La cédula existe solo con una elección ABIERTA. Nunca lleva conteos. */
export async function cedula(e: EstadoVotacion, electorId: number) {
  if (!e.eleccion) throw new ApiError(409, 'Todavía no hay una votación abierta. Espera a la mesa.');
  return {
    eleccionId: e.eleccion.id,
    cargo: e.eleccion.cargo,
    ronda: e.eleccion.ronda,
    yaVoto: e.votaron.has(electorId),
    candidatos: await candidatosDe(e.eleccion.id),
  };
}

/**
 * Emite el voto (ADR-029): Emision + Voto en una sola transacción.
 *
 * - `SELECT … LOCK IN SHARE MODE` sobre la elección: un voto en curso y el cierre no se cruzan. Cerrar hace
 *   un UPDATE de esa fila, que espera a que terminen los votos que ya la leyeron como ABIERTA, y
 *   todo voto posterior la ve CERRADA. El conteo al cierre es exacto.
 * - El UNIQUE (eleccion_id, elector_id) de `emisiones` es la única defensa contra el doble voto:
 *   dos pedidos simultáneos del mismo elector chocan ahí y el segundo recibe P2002 → "ya votaste".
 * - El Voto no guarda ni fecha ni elector: la Emision dice que votó, el Voto dice por quién, y no
 *   hay forma de unirlos.
 */
export async function votar(
  e: EstadoVotacion,
  sesion: { electorId: number; asambleaId: number; acreditadoEn?: number },
  eleccionId: number,
  candidatoId: number,
) {
  try {
    const emision = await prisma.$transaction(async (tx) => {
      const [eleccion] = await tx.$queryRaw<{ estado: string; asamblea_id: number; cargo: string; ronda: number }[]>`
        SELECT estado, asamblea_id, cargo, ronda FROM elecciones WHERE id = ${eleccionId} LOCK IN SHARE MODE`;
      if (!eleccion || eleccion.asamblea_id !== e.asambleaId) throw new ApiError(404, 'Esa elección no existe.');
      if (eleccion.estado !== 'ABIERTA') {
        throw new ApiError(409, 'La votación de este cargo ya se cerró. Tu voto no se registró.');
      }

      const elector = await tx.elector.findUnique({
        where: { id: sesion.electorId },
        select: { asambleaId: true, acreditado: true, acreditadoEn: true },
      });
      // Si la mesa le generó un código nuevo (perdió el anterior), las sesiones viejas dejan de servir.
      const sesionVigente =
        elector?.acreditado &&
        elector.asambleaId === e.asambleaId &&
        (sesion.acreditadoEn === undefined || elector.acreditadoEn?.getTime() === sesion.acreditadoEn);
      if (!sesionVigente) throw new ApiError(401, 'Tu sesión ya no es válida. Vuelve a ingresar con tu código.');

      const candidato = await tx.candidato.findFirst({ where: { id: candidatoId, eleccionId }, select: { id: true } });
      if (!candidato) throw new ApiError(400, 'Ese candidato no pertenece a esta elección.');

      const nueva = await tx.emision.create({
        data: { eleccionId, electorId: sesion.electorId },
        select: { id: true, emitidoEn: true },
      });
      await tx.voto.create({ data: { eleccionId, candidatoId } });
      return { ...nueva, cargo: eleccion.cargo, ronda: eleccion.ronda };
    });

    registrarEmision(e.asambleaId, eleccionId, sesion.electorId);
    eventosVotacion.emit('voto', { asambleaId: e.asambleaId, eleccionId });

    // La constancia prueba que votó, no por quién: mostrar el candidato facilitaría la compra o la
    // coacción del voto ("enséñame la pantalla").
    return {
      constancia: {
        numero: `${e.codigo}-${emision.id}`,
        cargo: emision.cargo,
        ronda: emision.ronda,
        emitidoEn: emision.emitidoEn,
      },
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      registrarEmision(e.asambleaId, eleccionId, sesion.electorId);
      throw new ApiError(409, 'Ya votaste en esta elección. Tu primer voto es el que vale.');
    }
    throw err;
  }
}
