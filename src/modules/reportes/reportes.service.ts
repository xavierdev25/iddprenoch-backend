import { prisma } from '../../db/prisma';
import { ApiError } from '../../utils/ApiError';
import { GRUPOS_ETARIOS, GrupoEtario, calcularEdad, clasificarGrupoEtario, fechaCivilHoy } from '../../utils/edad';
import {
  CongregantesFiltros,
  construirWhereCongregantes,
} from '../congregantes/congregantes.filters';
import { Agrupacion, ReporteQuery } from './reportes.schema';

/**
 * Datos de los reportes de membresía.
 *
 * Dos formas del mismo universo de congregantes, siempre bajo los mismos filtros:
 *  - nominal: una fila por miembro (la "lista de miembros de una iglesia").
 *  - consolidado: una fila por iglesia o distrito con los conteos por sexo, grupo etario y estado
 *    eclesial (el reporte que se mira para evaluar la membresía).
 */

/**
 * Techo de filas de una exportación. Con 48 iglesias el universo real es de miles, no decenas de
 * miles: si se alcanza este límite es señal de un filtro mal puesto, y es mejor un error claro que
 * un proceso de Node agotando la memoria del hosting compartido mientras arma el archivo.
 */
const MAX_FILAS_EXPORTACION = 20_000;

/**
 * Columnas del congregante que necesita el reporte. El `select` explícito es deliberado: la tabla
 * tiene `foto` como LongText con base64, y un `findMany` sin `select` la traería para cada miembro,
 * convirtiendo un reporte de texto en decenas de MB de imágenes.
 */
const SELECT_MIEMBRO = {
  id: true,
  dni: true,
  nombre: true,
  apellido: true,
  telefono: true,
  correo: true,
  fechaNacimiento: true,
  fechaBautismo: true,
  fechaConversion: true,
  sexo: { select: { id: true, nombre: true } },
  estadoCivil: { select: { nombre: true } },
  estadoEclesial: { select: { id: true, nombre: true } },
  ministerio: { select: { nombre: true } },
  iglesia: { select: { id: true, nombre: true, distrito: { select: { id: true, nombre: true } } } },
} as const;

export interface FilaMiembro {
  dni: string;
  apellido: string;
  nombre: string;
  sexo: string;
  fechaNacimiento?: string;
  edad?: number;
  grupoEtario: GrupoEtario;
  estadoCivil: string;
  estadoEclesial: string;
  ministerio?: string;
  iglesia: string;
  distrito: string;
  telefono?: string;
  correo?: string;
  fechaBautismo?: string;
}

/** Conteos de un grupo (una iglesia, un distrito, o el total general). */
export interface Conteos {
  total: number;
  /** Clave = nombre del sexo en el catálogo (Masculino/Femenino), no un booleano hardcodeado. */
  porSexo: Record<string, number>;
  porGrupoEtario: Record<GrupoEtario, number>;
  porEstadoEclesial: Record<string, number>;
}

export interface FilaConsolidado extends Conteos {
  id: number;
  nombre: string;
  /** Solo al agrupar por iglesia; al agrupar por distrito la fila ya *es* el distrito. */
  distrito?: string;
}

export interface FiltroAplicado {
  etiqueta: string;
  valor: string;
}

export interface ReporteMembresia {
  generadoEn: Date;
  agruparPor: Agrupacion;
  /** Filtros en texto legible, para imprimirlos en la cabecera del Excel/PDF. */
  filtros: FiltroAplicado[];
  /** Nombres de los sexos y estados eclesiales del catálogo, en orden, = columnas del reporte. */
  columnasSexo: string[];
  columnasEstadoEclesial: string[];
  filas: FilaConsolidado[];
  totales: Conteos;
}

export interface ReporteNominal {
  generadoEn: Date;
  filtros: FiltroAplicado[];
  miembros: FilaMiembro[];
  totales: Conteos;
  columnasSexo: string[];
  columnasEstadoEclesial: string[];
}

function aFecha(valor: Date | null): string | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

function conteosVacios(sexos: string[], estados: string[]): Conteos {
  return {
    total: 0,
    porSexo: Object.fromEntries(sexos.map((s) => [s, 0])),
    porGrupoEtario: Object.fromEntries([
      ...GRUPOS_ETARIOS.map((g) => [g.clave, 0]),
      ['sin_fecha', 0],
    ]) as Record<GrupoEtario, number>,
    porEstadoEclesial: Object.fromEntries(estados.map((e) => [e, 0])),
  };
}

function acumular(conteos: Conteos, sexo: string, grupo: GrupoEtario, estadoEclesial: string): void {
  conteos.total += 1;
  conteos.porSexo[sexo] = (conteos.porSexo[sexo] ?? 0) + 1;
  conteos.porGrupoEtario[grupo] += 1;
  conteos.porEstadoEclesial[estadoEclesial] = (conteos.porEstadoEclesial[estadoEclesial] ?? 0) + 1;
}

/** Catálogos usados como columnas fijas del reporte, en el mismo orden que muestra el panel. */
async function columnasDeCatalogos() {
  const [sexos, estados] = await Promise.all([
    prisma.sexo.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true } }),
    prisma.estadoEclesial.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true } }),
  ]);
  return {
    columnasSexo: sexos.map((s) => s.nombre),
    columnasEstadoEclesial: estados.map((e) => e.nombre),
  };
}

/**
 * Describe los filtros activos en texto, resolviendo los ids a nombres. Va impreso en la cabecera
 * del archivo: un reporte descargado circula por correo y WhatsApp fuera de la app, y sin esta
 * línea nadie puede saber si mira la membresía completa o un subconjunto.
 */
async function describirFiltros(filtros: CongregantesFiltros): Promise<FiltroAplicado[]> {
  const descripcion: FiltroAplicado[] = [];

  const [iglesia, distrito, ministerio, sexo, estadoEclesial] = await Promise.all([
    filtros.iglesiaId
      ? prisma.iglesia.findUnique({ where: { id: filtros.iglesiaId }, select: { nombre: true } })
      : null,
    filtros.distritoId
      ? prisma.distrito.findUnique({ where: { id: filtros.distritoId }, select: { nombre: true } })
      : null,
    filtros.ministerioId
      ? prisma.ministerio.findUnique({
          where: { id: filtros.ministerioId },
          select: { nombre: true },
        })
      : null,
    filtros.sexoId
      ? prisma.sexo.findUnique({ where: { id: filtros.sexoId }, select: { nombre: true } })
      : null,
    filtros.estadoEclesialId
      ? prisma.estadoEclesial.findUnique({
          where: { id: filtros.estadoEclesialId },
          select: { nombre: true },
        })
      : null,
  ]);

  if (iglesia) descripcion.push({ etiqueta: 'Iglesia', valor: iglesia.nombre });
  if (distrito) descripcion.push({ etiqueta: 'Distrito', valor: distrito.nombre });
  if (ministerio) descripcion.push({ etiqueta: 'Ministerio', valor: ministerio.nombre });
  if (sexo) descripcion.push({ etiqueta: 'Sexo', valor: sexo.nombre });
  if (estadoEclesial)
    descripcion.push({ etiqueta: 'Estado eclesial', valor: estadoEclesial.nombre });
  if (filtros.grupoEtario) {
    descripcion.push({
      etiqueta: 'Grupo etario',
      valor:
        GRUPOS_ETARIOS.find((g) => g.clave === filtros.grupoEtario)?.etiqueta ??
        'Sin fecha de nacimiento',
    });
  }
  if (filtros.q) descripcion.push({ etiqueta: 'Búsqueda', valor: filtros.q });

  return descripcion;
}

/** Listado nominal: una fila por miembro, ordenado por iglesia y apellido como se lee en papel. */
export async function obtenerReporteNominal(query: ReporteQuery): Promise<ReporteNominal> {
  const where = construirWhereCongregantes(query);
  const hoy = fechaCivilHoy();

  const [total, columnas, filtros] = await Promise.all([
    prisma.congregante.count({ where }),
    columnasDeCatalogos(),
    describirFiltros(query),
  ]);

  if (total > MAX_FILAS_EXPORTACION) {
    throw new ApiError(
      400,
      `El reporte tiene ${total.toLocaleString('es-PE')} miembros y el máximo por archivo es ${MAX_FILAS_EXPORTACION.toLocaleString('es-PE')}. Filtra por distrito o iglesia y descarga por partes.`,
    );
  }

  const registros = await prisma.congregante.findMany({
    where,
    select: SELECT_MIEMBRO,
    orderBy: [{ iglesia: { nombre: 'asc' } }, { apellido: 'asc' }, { nombre: 'asc' }],
  });

  const totales = conteosVacios(columnas.columnasSexo, columnas.columnasEstadoEclesial);
  const miembros = registros.map((c) => {
    const edad = calcularEdad(c.fechaNacimiento, hoy);
    const grupoEtario = clasificarGrupoEtario(edad);
    acumular(totales, c.sexo.nombre, grupoEtario, c.estadoEclesial.nombre);
    return {
      dni: c.dni,
      apellido: c.apellido,
      nombre: c.nombre,
      sexo: c.sexo.nombre,
      fechaNacimiento: aFecha(c.fechaNacimiento),
      edad,
      grupoEtario,
      estadoCivil: c.estadoCivil.nombre,
      estadoEclesial: c.estadoEclesial.nombre,
      ministerio: c.ministerio?.nombre,
      iglesia: c.iglesia.nombre,
      distrito: c.iglesia.distrito.nombre,
      telefono: c.telefono ?? undefined,
      correo: c.correo ?? undefined,
      fechaBautismo: aFecha(c.fechaBautismo),
    };
  });

  return { generadoEn: new Date(), filtros, miembros, totales, ...columnas };
}

/**
 * Consolidado por iglesia o distrito.
 *
 * La agregación se hace en Node y no con `groupBy` de SQL a propósito: el grupo etario se deriva de
 * `fechaNacimiento` y no existe como columna, así que agruparlo en SQL exigiría una consulta por
 * tramo y por sexo. Con este volumen de datos (decenas de iglesias, miles de congregantes) una sola
 * lectura de columnas livianas es más rápida, y sobre todo garantiza que el consolidado y el
 * listado nominal clasifiquen con el mismo código — si divergieran, los totales no cuadrarían.
 */
export async function obtenerReporteMembresia(query: ReporteQuery): Promise<ReporteMembresia> {
  const where = construirWhereCongregantes(query);
  const hoy = fechaCivilHoy();

  const [columnas, filtros, registros] = await Promise.all([
    columnasDeCatalogos(),
    describirFiltros(query),
    prisma.congregante.findMany({
      where,
      select: {
        fechaNacimiento: true,
        sexo: { select: { nombre: true } },
        estadoEclesial: { select: { nombre: true } },
        iglesia: {
          select: { id: true, nombre: true, distrito: { select: { id: true, nombre: true } } },
        },
      },
    }),
  ]);

  const totales = conteosVacios(columnas.columnasSexo, columnas.columnasEstadoEclesial);
  const porGrupo = new Map<number, FilaConsolidado>();

  for (const c of registros) {
    const grupoEtario = clasificarGrupoEtario(calcularEdad(c.fechaNacimiento, hoy));
    const clave =
      query.agruparPor === 'distrito'
        ? { id: c.iglesia.distrito.id, nombre: c.iglesia.distrito.nombre, distrito: undefined }
        : { id: c.iglesia.id, nombre: c.iglesia.nombre, distrito: c.iglesia.distrito.nombre };

    let fila = porGrupo.get(clave.id);
    if (!fila) {
      fila = {
        ...clave,
        ...conteosVacios(columnas.columnasSexo, columnas.columnasEstadoEclesial),
      };
      porGrupo.set(clave.id, fila);
    }

    acumular(fila, c.sexo.nombre, grupoEtario, c.estadoEclesial.nombre);
    acumular(totales, c.sexo.nombre, grupoEtario, c.estadoEclesial.nombre);
  }

  // Se incluyen las iglesias/distritos sin ningún congregante cargado: una sede en cero es
  // precisamente lo que el reporte debe hacer visible, y omitir la fila la volvería invisible.
  await agregarGruposVacios(porGrupo, query, columnas);

  const filas = [...porGrupo.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return { generadoEn: new Date(), agruparPor: query.agruparPor, filtros, filas, totales, ...columnas };
}

/**
 * Completa con ceros las iglesias/distritos que no aparecieron porque no tienen congregantes.
 *
 * Solo se hace cuando no hay filtros de atributo del congregante (sexo, grupo etario, etc.): con
 * uno activo, una fila en cero sería ambigua — no distinguiría "esta iglesia no tiene miembros" de
 * "ninguno de sus miembros cumple el filtro".
 */
async function agregarGruposVacios(
  porGrupo: Map<number, FilaConsolidado>,
  query: ReporteQuery,
  columnas: { columnasSexo: string[]; columnasEstadoEclesial: string[] },
): Promise<void> {
  const filtraPorCongregante =
    query.sexoId !== undefined ||
    query.estadoCivilId !== undefined ||
    query.estadoEclesialId !== undefined ||
    query.ministerioId !== undefined ||
    query.grupoEtario !== undefined ||
    query.q !== undefined;
  if (filtraPorCongregante) return;

  if (query.agruparPor === 'distrito') {
    const distritos = await prisma.distrito.findMany({
      where: query.distritoId ? { id: query.distritoId } : undefined,
      select: { id: true, nombre: true },
    });
    for (const d of distritos) {
      if (!porGrupo.has(d.id)) {
        porGrupo.set(d.id, { id: d.id, nombre: d.nombre, ...conteosVacios(columnas.columnasSexo, columnas.columnasEstadoEclesial) });
      }
    }
    return;
  }

  const iglesias = await prisma.iglesia.findMany({
    where: {
      ...(query.iglesiaId ? { id: query.iglesiaId } : {}),
      ...(query.distritoId ? { distritoId: query.distritoId } : {}),
    },
    select: { id: true, nombre: true, distrito: { select: { nombre: true } } },
  });
  for (const i of iglesias) {
    if (!porGrupo.has(i.id)) {
      porGrupo.set(i.id, {
        id: i.id,
        nombre: i.nombre,
        distrito: i.distrito.nombre,
        ...conteosVacios(columnas.columnasSexo, columnas.columnasEstadoEclesial),
      });
    }
  }
}
