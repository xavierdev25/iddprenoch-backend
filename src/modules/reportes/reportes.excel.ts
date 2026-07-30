import writeXlsxFile, { Row, Sheet, SheetData } from 'write-excel-file/node';
import { etiquetaGrupoEtario } from '../../utils/edad';
import { Conteos, FiltroAplicado, ReporteMembresia, ReporteNominal } from './reportes.service';

/**
 * Generación de los archivos .xlsx.
 *
 * Se usa `write-excel-file` en vez de una librería más completa por el destino del proyecto: el
 * backend se despliega en un cPanel sin SSH que instala las dependencias por su cuenta, así que
 * cada dependencia transitiva es riesgo de instalación. Esta trae una sola (`fflate`) y cubre lo
 * que el reporte necesita: varias hojas, encabezados fijos, anchos de columna y formato de fecha.
 */

const AZUL = '#1e3a5f';
const GRIS_SUAVE = '#f1f5f9';
const BLANCO = '#ffffff';

const TITULO: Partial<Row[number] & object> = { fontSize: 14, fontWeight: 'bold' };

interface Columna<T> {
  encabezado: string;
  ancho: number;
  valor: (fila: T) => string | number | Date | undefined;
  align?: 'left' | 'center' | 'right';
}

function celdaEncabezado(texto: string) {
  return {
    value: texto,
    fontWeight: 'bold' as const,
    textColor: BLANCO,
    backgroundColor: AZUL,
    align: 'center' as const,
    wrap: true,
    borderStyle: 'thin' as const,
    borderColor: AZUL,
  };
}

/**
 * Cabecera del reporte: título, momento de generación y filtros aplicados.
 *
 * Los filtros van impresos porque el archivo se descarga y circula fuera de la aplicación; sin
 * ellos, un Excel de una sola iglesia es indistinguible de uno de la región completa.
 */
function filasCabecera(titulo: string, generadoEn: Date, filtros: FiltroAplicado[]): SheetData {
  const filas: SheetData = [
    [{ value: titulo, ...TITULO }],
    [{ value: `Generado: ${formatearFechaHora(generadoEn)}`, textColor: '#64748b' }],
  ];
  filas.push([
    {
      value: filtros.length
        ? `Filtros: ${filtros.map((f) => `${f.etiqueta} = ${f.valor}`).join('  ·  ')}`
        : 'Filtros: ninguno (membresía completa)',
      textColor: '#64748b',
    },
  ]);
  filas.push([]);
  return filas;
}

function formatearFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(fecha);
}

function filasDeTabla<T>(columnas: Columna<T>[], datos: T[]): SheetData {
  const filas: SheetData = [columnas.map((c) => celdaEncabezado(c.encabezado))];

  datos.forEach((dato, indice) => {
    // Bandeado: con decenas de iglesias por hoja, seguir una fila a lo ancho sin esto es incómodo.
    const fondo = indice % 2 === 1 ? GRIS_SUAVE : undefined;
    filas.push(
      columnas.map((columna) => {
        const valor = columna.valor(dato);
        if (valor === undefined || valor === '') {
          return { value: undefined, backgroundColor: fondo };
        }
        if (valor instanceof Date) {
          return { value: valor, type: Date, format: 'dd/mm/yyyy', backgroundColor: fondo, align: 'center' as const };
        }
        return typeof valor === 'number'
          ? { value: valor, type: Number, backgroundColor: fondo, align: columna.align ?? 'center' }
          : { value: valor, type: String, backgroundColor: fondo, align: columna.align ?? 'left' };
      }),
    );
  });

  return filas;
}

function filaTotales<T>(columnas: Columna<T>[], totales: T): Row {
  return columnas.map((columna, indice) => {
    const valor = indice === 0 ? 'TOTAL' : columna.valor(totales);
    return {
      value: valor === undefined || valor === '' ? undefined : (valor as string | number),
      type: typeof valor === 'number' ? Number : String,
      fontWeight: 'bold' as const,
      backgroundColor: '#e2e8f0',
      topBorderStyle: 'thin' as const,
      topBorderColor: AZUL,
      align: indice === 0 ? ('left' as const) : ('center' as const),
    };
  });
}

/** Fecha ISO (`YYYY-MM-DD`) a Date, para que Excel la reciba como fecha real y no como texto. */
function aFechaExcel(iso: string | undefined): Date | undefined {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : undefined;
}

/** Columnas del consolidado: fijas + una por sexo y una por estado eclesial del catálogo. */
function columnasConsolidado(reporte: ReporteMembresia): Columna<ConteosConNombre>[] {
  const columnas: Columna<ConteosConNombre>[] = [
    { encabezado: reporte.agruparPor === 'distrito' ? 'Distrito' : 'Iglesia', ancho: 34, valor: (f) => f.nombre, align: 'left' },
  ];

  if (reporte.agruparPor === 'iglesia') {
    columnas.push({ encabezado: 'Distrito', ancho: 20, valor: (f) => f.distrito, align: 'left' });
  }

  columnas.push({ encabezado: 'Total', ancho: 9, valor: (f) => f.total });

  for (const sexo of reporte.columnasSexo) {
    columnas.push({ encabezado: sexo, ancho: 12, valor: (f) => f.porSexo[sexo] ?? 0 });
  }
  for (const grupo of ['nino', 'adolescente', 'joven', 'adulto', 'sin_fecha'] as const) {
    columnas.push({
      encabezado: etiquetaGrupoEtario(grupo),
      ancho: grupo === 'sin_fecha' ? 16 : 13,
      valor: (f) => f.porGrupoEtario[grupo] ?? 0,
    });
  }
  for (const estado of reporte.columnasEstadoEclesial) {
    columnas.push({ encabezado: estado, ancho: 13, valor: (f) => f.porEstadoEclesial[estado] ?? 0 });
  }

  return columnas;
}

interface ConteosConNombre extends Conteos {
  nombre: string;
  distrito?: string;
}

const COLUMNAS_NOMINAL: Columna<ReporteNominal['miembros'][number]>[] = [
  { encabezado: 'DNI', ancho: 11, valor: (m) => m.dni, align: 'center' },
  { encabezado: 'Apellidos', ancho: 22, valor: (m) => m.apellido },
  { encabezado: 'Nombres', ancho: 22, valor: (m) => m.nombre },
  { encabezado: 'Sexo', ancho: 11, valor: (m) => m.sexo },
  { encabezado: 'Fecha de nacimiento', ancho: 14, valor: (m) => aFechaExcel(m.fechaNacimiento) },
  { encabezado: 'Edad', ancho: 7, valor: (m) => m.edad },
  { encabezado: 'Grupo etario', ancho: 15, valor: (m) => etiquetaGrupoEtario(m.grupoEtario) },
  { encabezado: 'Estado civil', ancho: 14, valor: (m) => m.estadoCivil },
  { encabezado: 'Estado eclesial', ancho: 14, valor: (m) => m.estadoEclesial },
  { encabezado: 'Ministerio', ancho: 24, valor: (m) => m.ministerio, align: 'left' },
  { encabezado: 'Iglesia', ancho: 30, valor: (m) => m.iglesia, align: 'left' },
  { encabezado: 'Distrito', ancho: 18, valor: (m) => m.distrito, align: 'left' },
  { encabezado: 'Teléfono', ancho: 13, valor: (m) => m.telefono, align: 'center' },
  { encabezado: 'Correo', ancho: 26, valor: (m) => m.correo, align: 'left' },
  { encabezado: 'Fecha de bautismo', ancho: 14, valor: (m) => aFechaExcel(m.fechaBautismo) },
];

/** Hoja de resumen con los conteos globales, en vertical: se lee de un vistazo sin desplazarse. */
function hojaResumen(
  titulo: string,
  totales: Conteos,
  columnasSexo: string[],
  columnasEstadoEclesial: string[],
  generadoEn: Date,
  filtros: FiltroAplicado[],
): Sheet<never> {
  const data: SheetData = filasCabecera(titulo, generadoEn, filtros);

  const seccion = (encabezado: string) => {
    data.push([{ value: encabezado, fontWeight: 'bold', textColor: AZUL }]);
  };
  const dato = (etiqueta: string, valor: number) => {
    data.push([
      { value: etiqueta, type: String },
      { value: valor, type: Number, align: 'right', fontWeight: 'bold' },
    ]);
  };

  seccion('Total de miembros');
  dato('Total', totales.total);
  data.push([]);

  seccion('Por sexo');
  for (const sexo of columnasSexo) dato(sexo, totales.porSexo[sexo] ?? 0);
  data.push([]);

  seccion('Por grupo etario');
  for (const grupo of ['nino', 'adolescente', 'joven', 'adulto', 'sin_fecha'] as const) {
    dato(etiquetaGrupoEtario(grupo), totales.porGrupoEtario[grupo] ?? 0);
  }
  data.push([]);

  seccion('Por estado eclesial');
  for (const estado of columnasEstadoEclesial) dato(estado, totales.porEstadoEclesial[estado] ?? 0);

  return { sheet: 'Resumen', data, columns: [{ width: 30 }, { width: 12 }] };
}

/** Consolidado por iglesia o distrito: hoja de detalle + hoja de resumen. */
export function generarExcelMembresia(reporte: ReporteMembresia): Promise<Buffer> {
  const columnas = columnasConsolidado(reporte);
  const titulo =
    reporte.agruparPor === 'distrito'
      ? 'Membresía por distrito'
      : 'Membresía por iglesia';

  const data: SheetData = [
    ...filasCabecera(titulo, reporte.generadoEn, reporte.filtros),
    ...filasDeTabla(columnas, reporte.filas),
  ];
  if (reporte.filas.length) {
    data.push(filaTotales(columnas, { ...reporte.totales, nombre: 'TOTAL' }));
  }

  const hojas: Sheet<never>[] = [
    {
      sheet: reporte.agruparPor === 'distrito' ? 'Por distrito' : 'Por iglesia',
      data,
      columns: columnas.map((c) => ({ width: c.ancho })),
      // Fija la fila de encabezados: sin esto, al bajar por 48 iglesias se pierde qué columna es cuál.
      stickyRowsCount: filasCabecera(titulo, reporte.generadoEn, reporte.filtros).length + 1,
      orientation: 'landscape',
    },
    hojaResumen(
      `${titulo} — resumen`,
      reporte.totales,
      reporte.columnasSexo,
      reporte.columnasEstadoEclesial,
      reporte.generadoEn,
      reporte.filtros,
    ),
  ];

  return writeXlsxFile(hojas).toBuffer();
}

/** Listado nominal: hoja con una fila por miembro + hoja de resumen. */
export function generarExcelNominal(reporte: ReporteNominal): Promise<Buffer> {
  const titulo = 'Lista de miembros';
  const cabecera = filasCabecera(titulo, reporte.generadoEn, reporte.filtros);

  const hojas: Sheet<never>[] = [
    {
      sheet: 'Miembros',
      data: [...cabecera, ...filasDeTabla(COLUMNAS_NOMINAL, reporte.miembros)],
      columns: COLUMNAS_NOMINAL.map((c) => ({ width: c.ancho })),
      stickyRowsCount: cabecera.length + 1,
      orientation: 'landscape',
    },
    hojaResumen(
      `${titulo} — resumen`,
      reporte.totales,
      reporte.columnasSexo,
      reporte.columnasEstadoEclesial,
      reporte.generadoEn,
      reporte.filtros,
    ),
  ];

  return writeXlsxFile(hojas).toBuffer();
}
