import { prisma } from '../../db/prisma';

/**
 * Estado de la votación en memoria (ADR-028): lo que consultan los electores cada 3 s.
 *
 * Con 200 celulares son ~67 consultas por segundo; si cada una fuera a MySQL, el estado sería el
 * cuello de botella. Aquí se arma una vez por asamblea y se sirve desde un Map. Funciona porque
 * Passenger corre un solo proceso (medido en el spike); si eso cambiara, este caché quedaría
 * desincronizado entre procesos.
 *
 * Toda acción del panel que cambia lo que ve el elector (abrir, cerrar, publicar, finalizar) llama
 * a `invalidarAsamblea`; la siguiente consulta recarga desde la base con una versión nueva. Un TTL
 * de 5 minutos cubre cualquier cambio hecho por fuera de la API.
 */

export type EstadoParaElector = 'ESPERA' | 'ABIERTA' | 'FINALIZADA';

export interface EstadoVotacion {
  asambleaId: number;
  codigo: string;
  nombre: string;
  estadoAsamblea: 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA';
  /** La elección ABIERTA de la asamblea (a lo sumo una a la vez), o null. */
  eleccion: { id: number; cargo: string; ronda: number } | null;
  /** Próximo cargo pendiente, para la pantalla de espera ("Siguiente cargo", Figura 16). */
  siguienteCargo: string | null;
  version: number;
  /** Electores que ya votaron en la elección abierta. */
  votaron: Set<number>;
  cargadoEn: number;
}

const TTL_MS = 5 * 60 * 1000;
const TTL_INEXISTENTE_MS = 30 * 1000;
// Va en el ETag: tras un reinicio el contador vuelve a 0, y sin esto un ETag viejo ("v3") podría
// coincidir con un estado nuevo distinto y el celular recibiría un 304 equivocado.
const ARRANQUE = Date.now().toString(36);

let contador = 0;
const porCodigo = new Map<string, EstadoVotacion>();
const codigoDeAsamblea = new Map<number, string>();
const inexistentes = new Map<string, number>();
const cargasEnCurso = new Map<string, Promise<EstadoVotacion | null>>();

async function cargar(codigo: string): Promise<EstadoVotacion | null> {
  const asamblea = await prisma.asamblea.findUnique({
    where: { codigoAcceso: codigo },
    select: {
      id: true,
      nombre: true,
      estado: true,
      elecciones: {
        where: { estado: { in: ['ABIERTA', 'PENDIENTE'] } },
        select: { id: true, cargo: true, ronda: true, estado: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!asamblea) {
    inexistentes.set(codigo, Date.now());
    return null;
  }
  const abierta = asamblea.elecciones.find((e) => e.estado === 'ABIERTA');
  const eleccion = abierta ? { id: abierta.id, cargo: abierta.cargo, ronda: abierta.ronda } : null;
  const siguiente = asamblea.elecciones.find((e) => e.estado === 'PENDIENTE');
  const emisiones = eleccion
    ? await prisma.emision.findMany({ where: { eleccionId: eleccion.id }, select: { electorId: true } })
    : [];
  const estado: EstadoVotacion = {
    asambleaId: asamblea.id,
    codigo,
    nombre: asamblea.nombre,
    estadoAsamblea: asamblea.estado,
    eleccion,
    siguienteCargo: siguiente?.cargo ?? null,
    version: ++contador,
    votaron: new Set(emisiones.map((e) => e.electorId)),
    cargadoEn: Date.now(),
  };
  porCodigo.set(codigo, estado);
  codigoDeAsamblea.set(asamblea.id, codigo);
  return estado;
}

/** Estado de una asamblea por su código de acceso; null si no existe. */
export async function estadoPorCodigo(codigo: string): Promise<EstadoVotacion | null> {
  const enCache = porCodigo.get(codigo);
  if (enCache && Date.now() - enCache.cargadoEn < TTL_MS) return enCache;

  // Códigos inventados no deben llegar a MySQL en cada intento.
  const negativo = inexistentes.get(codigo);
  if (negativo && Date.now() - negativo < TTL_INEXISTENTE_MS) return null;

  // Si 200 celulares preguntan a la vez justo después de una invalidación, una sola consulta.
  let carga = cargasEnCurso.get(codigo);
  if (!carga) {
    carga = cargar(codigo).finally(() => cargasEnCurso.delete(codigo));
    cargasEnCurso.set(codigo, carga);
  }
  return carga;
}

export function invalidarAsamblea(asambleaId: number): void {
  const codigo = codigoDeAsamblea.get(asambleaId);
  if (codigo) porCodigo.delete(codigo);
}

/** Tras confirmar un voto: el elector ya no debe ver la cédula de esa elección. */
export function registrarEmision(asambleaId: number, eleccionId: number, electorId: number): void {
  const codigo = codigoDeAsamblea.get(asambleaId);
  const estado = codigo ? porCodigo.get(codigo) : undefined;
  if (estado?.eleccion?.id === eleccionId) estado.votaron.add(electorId);
}

export function estadoParaElector(e: EstadoVotacion): EstadoParaElector {
  if (e.estadoAsamblea === 'FINALIZADA') return 'FINALIZADA';
  return e.eleccion ? 'ABIERTA' : 'ESPERA';
}

/**
 * La respuesta del polling, mínima a propósito (ADR-028). Nunca lleva conteos: el elector solo
 * necesita saber si hay algo que votar y si ya lo hizo.
 */
export function vistaElector(e: EstadoVotacion, electorId: number) {
  return {
    estado: estadoParaElector(e),
    eleccionId: e.eleccion?.id ?? null,
    version: e.version,
    yaVoto: e.eleccion ? e.votaron.has(electorId) : false,
  };
}

/** Cambia si cambia el estado de la asamblea o si este elector acaba de votar. */
export function etagElector(e: EstadoVotacion, electorId: number): string {
  const yaVoto = e.eleccion && e.votaron.has(electorId) ? 1 : 0;
  return `"${ARRANQUE}-${e.version}-${yaVoto}"`;
}

/** Solo para pruebas. */
export function _reiniciarEstado(): void {
  porCodigo.clear();
  codigoDeAsamblea.clear();
  inexistentes.clear();
  cargasEnCurso.clear();
}
