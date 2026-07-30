import PDFDocument from 'pdfkit';
import { etiquetaGrupoEtario } from '../../utils/edad';
import { Conteos, FiltroAplicado, ReporteMembresia, ReporteNominal } from './reportes.service';

/**
 * Generación de los archivos .pdf.
 *
 * Se usa `pdfkit` y no un renderizador de HTML: cualquier opción basada en navegador headless
 * (Puppeteer y similares) necesita descargar Chromium y lanzar un proceso aparte, algo que el
 * hosting compartido de cPanel donde vive esta API no permite. `pdfkit` dibuja el PDF en el mismo
 * proceso Node y sus tipografías estándar cubren los acentos y la ñ del castellano sin incrustar
 * fuentes.
 */

const AZUL = '#1e3a5f';
const GRIS_TEXTO = '#64748b';
const GRIS_FILA = '#f1f5f9';
const GRIS_BORDE = '#cbd5e1';

const MARGEN = 28;
const ALTO_FILA = 16;
// Da cabida a dos líneas: con doce columnas, rótulos como "Adolescentes" o "Sin fecha de
// nacimiento" no entran en una sola y quedarían recortados a la mitad.
const ALTO_ENCABEZADO = 28;
const PADDING = 4;
const CUERPO_FUENTE = 7.5;

interface ColumnaPdf<T> {
  encabezado: string;
  /** Peso relativo: los anchos se normalizan al ancho útil de la página. */
  peso: number;
  valor: (fila: T) => string;
  align?: 'left' | 'center' | 'right';
}

const texto = (valor: string | number | undefined): string =>
  valor === undefined || valor === '' ? '—' : String(valor);

function formatearFechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(fecha);
}

/** `YYYY-MM-DD` a `DD/MM/YYYY`, el formato en que se lee una fecha en Perú. */
function formatearFecha(iso: string | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

type Doc = PDFKit.PDFDocument;

/** Ancho útil de la página, ya descontados los márgenes. */
function anchoUtil(doc: Doc): number {
  return doc.page.width - MARGEN * 2;
}

function anchos<T>(doc: Doc, columnas: ColumnaPdf<T>[]): number[] {
  const pesoTotal = columnas.reduce((suma, c) => suma + c.peso, 0);
  return columnas.map((c) => (c.peso / pesoTotal) * anchoUtil(doc));
}

/**
 * Recorta el texto al ancho disponible midiéndolo con la fuente activa.
 *
 * Se hace a mano en vez de delegarlo a las opciones `ellipsis`/`lineBreak` de pdfkit porque con
 * ellas un valor largo (el nombre de un ministerio, una iglesia) igual salta de línea y se derrama
 * sobre la fila siguiente. Aquí la celda nunca puede pasar de una línea.
 */
function recortar(doc: Doc, texto: string, ancho: number): string {
  if (ancho <= 0) return '';
  if (doc.widthOfString(texto) <= ancho) return texto;

  let corte = texto.length;
  while (corte > 0 && doc.widthOfString(`${texto.slice(0, corte)}…`) > ancho) corte -= 1;
  return corte > 0 ? `${texto.slice(0, corte)}…` : '';
}

/** Dibuja una celda de una sola línea, recortada al ancho de su columna. */
function celda(
  doc: Doc,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  align: 'left' | 'center' | 'right',
): void {
  const util = ancho - PADDING * 2;
  doc.text(recortar(doc, texto, util), x + PADDING, y, { width: util, align, lineBreak: false });
}

/**
 * Título, fecha de generación y filtros aplicados. Los filtros se imprimen porque el PDF se
 * comparte fuera de la aplicación: sin esa línea, el reporte de una iglesia es indistinguible del
 * de toda la región.
 */
function dibujarCabecera(doc: Doc, titulo: string, generadoEn: Date, filtros: FiltroAplicado[]): void {
  doc.font('Helvetica-Bold').fontSize(16).fillColor(AZUL).text(titulo, MARGEN, MARGEN);
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(GRIS_TEXTO)
    .text(`Generado: ${formatearFechaHora(generadoEn)}`, MARGEN, doc.y + 2);
  doc.text(
    filtros.length
      ? `Filtros: ${filtros.map((f) => `${f.etiqueta} = ${f.valor}`).join('   ·   ')}`
      : 'Filtros: ninguno (membresía completa)',
    MARGEN,
    doc.y + 1,
    { width: anchoUtil(doc) },
  );
  doc.moveDown(0.6);
}

function dibujarEncabezadoTabla<T>(doc: Doc, columnas: ColumnaPdf<T>[], y: number): number {
  const ancho = anchos(doc, columnas);
  doc.rect(MARGEN, y, anchoUtil(doc), ALTO_ENCABEZADO).fill(AZUL);
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');

  let x = MARGEN;
  columnas.forEach((columna, i) => {
    const util = ancho[i] - PADDING * 2;
    // A diferencia del cuerpo, aquí sí se permiten dos líneas — y el bloque se centra vertical-
    // mente para que rótulos de una y de dos líneas queden alineados dentro de la misma banda.
    const alto = doc.heightOfString(columna.encabezado, { width: util });
    doc.text(columna.encabezado, x + PADDING, y + Math.max(3, (ALTO_ENCABEZADO - alto) / 2), {
      width: util,
      align: columna.align ?? 'left',
      height: ALTO_ENCABEZADO - 6,
      ellipsis: true,
    });
    x += ancho[i];
  });

  return y + ALTO_ENCABEZADO;
}

/**
 * Dibuja la tabla paginando sola: cuando la siguiente fila no cabe, abre página y repite el
 * encabezado, para que ninguna hoja impresa quede con columnas sin rótulo.
 */
function dibujarTabla<T>(doc: Doc, columnas: ColumnaPdf<T>[], datos: T[], yInicial: number): number {
  const ancho = anchos(doc, columnas);
  const limiteInferior = doc.page.height - MARGEN - ALTO_FILA;
  let y = dibujarEncabezadoTabla(doc, columnas, yInicial);

  datos.forEach((dato, indice) => {
    if (y + ALTO_FILA > limiteInferior) {
      doc.addPage();
      y = dibujarEncabezadoTabla(doc, columnas, MARGEN);
    }

    if (indice % 2 === 1) {
      doc.rect(MARGEN, y, anchoUtil(doc), ALTO_FILA).fill(GRIS_FILA);
    }

    doc.font('Helvetica').fontSize(CUERPO_FUENTE).fillColor('#1f2937');
    let x = MARGEN;
    columnas.forEach((columna, i) => {
      celda(doc, columna.valor(dato), x, y + 5, ancho[i], columna.align ?? 'left');
      x += ancho[i];
    });

    y += ALTO_FILA;
  });

  doc
    .moveTo(MARGEN, y)
    .lineTo(MARGEN + anchoUtil(doc), y)
    .strokeColor(GRIS_BORDE)
    .lineWidth(0.5)
    .stroke();

  return y;
}

function dibujarFilaTotales<T>(doc: Doc, columnas: ColumnaPdf<T>[], totales: T, y: number): number {
  const ancho = anchos(doc, columnas);
  if (y + ALTO_FILA > doc.page.height - MARGEN - ALTO_FILA) {
    doc.addPage();
    y = MARGEN;
  }

  doc.rect(MARGEN, y, anchoUtil(doc), ALTO_FILA + 2).fill('#e2e8f0');
  doc.font('Helvetica-Bold').fontSize(CUERPO_FUENTE).fillColor(AZUL);

  let x = MARGEN;
  columnas.forEach((columna, i) => {
    const valor = i === 0 ? 'TOTAL' : columna.valor(totales);
    celda(doc, valor, x, y + 6, ancho[i], columna.align ?? 'left');
    x += ancho[i];
  });

  return y + ALTO_FILA + 2;
}

/** Resumen en bloques al pie: los conteos que se leen primero, sin tener que sumar columnas. */
function dibujarResumen(
  doc: Doc,
  totales: Conteos,
  columnasSexo: string[],
  columnasEstadoEclesial: string[],
  y: number,
): void {
  const bloques: { titulo: string; datos: [string, number][] }[] = [
    { titulo: 'Por sexo', datos: columnasSexo.map((s) => [s, totales.porSexo[s] ?? 0]) },
    {
      titulo: 'Por grupo etario',
      datos: (['nino', 'adolescente', 'joven', 'adulto', 'sin_fecha'] as const).map((g) => [
        etiquetaGrupoEtario(g),
        totales.porGrupoEtario[g] ?? 0,
      ]),
    },
    {
      titulo: 'Por estado eclesial',
      datos: columnasEstadoEclesial.map((e) => [e, totales.porEstadoEclesial[e] ?? 0]),
    },
  ];

  const altoNecesario = 30 + Math.max(...bloques.map((b) => b.datos.length)) * 12;
  if (y + altoNecesario > doc.page.height - MARGEN) {
    doc.addPage();
    y = MARGEN;
  } else {
    y += 16;
  }

  doc.font('Helvetica-Bold').fontSize(10).fillColor(AZUL).text('Resumen', MARGEN, y);
  y += 16;

  const anchoBloque = anchoUtil(doc) / bloques.length;
  bloques.forEach((bloque, i) => {
    const x = MARGEN + anchoBloque * i;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(AZUL).text(bloque.titulo, x, y, {
      width: anchoBloque - 12,
    });
    let yDato = y + 13;
    for (const [etiqueta, valor] of bloque.datos) {
      doc.font('Helvetica').fontSize(8).fillColor('#1f2937');
      const anchoEtiqueta = anchoBloque - 60;
      doc.text(recortar(doc, etiqueta, anchoEtiqueta), x, yDato, {
        width: anchoEtiqueta,
        lineBreak: false,
      });
      doc
        .font('Helvetica-Bold')
        .text(String(valor), x + anchoBloque - 60, yDato, { width: 44, align: 'right' });
      yDato += 12;
    }
  });
}

/**
 * Numera las páginas al final, cuando ya se sabe el total. pdfkit permite volver a cualquier
 * página con `switchToPage`, así que el pie puede decir "Página 2 de 7" en la primera pasada.
 */
function numerarPaginas(doc: Doc): void {
  const rango = doc.bufferedPageRange();
  for (let i = 0; i < rango.count; i += 1) {
    doc.switchToPage(rango.start + i);
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(GRIS_TEXTO)
      .text(
        `Página ${i + 1} de ${rango.count}`,
        MARGEN,
        doc.page.height - MARGEN + 6,
        { width: anchoUtil(doc), align: 'right' },
      );
  }
}

function nuevoDocumento(): Doc {
  return new PDFDocument({
    size: 'A4',
    // Los reportes son tablas anchas: en vertical las columnas quedarían ilegibles.
    layout: 'landscape',
    margin: MARGEN,
    // Necesario para numerar las páginas al cerrar, cuando ya se conoce el total.
    bufferPages: true,
    info: { Title: 'Reporte de membresía', Author: 'IDDP' },
  });
}

function aBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Las columnas numéricas llevan un peso a la medida de su rótulo, no uno uniforme: el contenido
 * son cifras de una o dos cifras, así que el ancho lo decide el encabezado. Con pesos iguales,
 * "Adolescentes" partía en dos líneas dejando una "s" suelta debajo.
 */
const PESO_GRUPO_ETARIO: Record<string, number> = {
  nino: 7,
  adolescente: 11,
  joven: 8,
  adulto: 8,
  sin_fecha: 9,
};

function columnasConsolidadoPdf(reporte: ReporteMembresia): ColumnaPdf<ConteosConNombre>[] {
  const columnas: ColumnaPdf<ConteosConNombre>[] = [
    {
      encabezado: reporte.agruparPor === 'distrito' ? 'Distrito' : 'Iglesia',
      peso: 24,
      valor: (f) => f.nombre,
    },
  ];

  if (reporte.agruparPor === 'iglesia') {
    columnas.push({ encabezado: 'Distrito', peso: 13, valor: (f) => texto(f.distrito) });
  }

  columnas.push({ encabezado: 'Total', peso: 6, valor: (f) => String(f.total), align: 'center' });

  for (const sexo of reporte.columnasSexo) {
    columnas.push({
      encabezado: sexo,
      peso: 8,
      valor: (f) => String(f.porSexo[sexo] ?? 0),
      align: 'center',
    });
  }
  for (const grupo of ['nino', 'adolescente', 'joven', 'adulto', 'sin_fecha'] as const) {
    columnas.push({
      encabezado: etiquetaGrupoEtario(grupo),
      peso: PESO_GRUPO_ETARIO[grupo],
      valor: (f) => String(f.porGrupoEtario[grupo] ?? 0),
      align: 'center',
    });
  }
  for (const estado of reporte.columnasEstadoEclesial) {
    columnas.push({
      encabezado: estado,
      peso: 8,
      valor: (f) => String(f.porEstadoEclesial[estado] ?? 0),
      align: 'center',
    });
  }

  return columnas;
}

interface ConteosConNombre extends Conteos {
  nombre: string;
  distrito?: string;
}

/**
 * Columnas del listado nominal impreso. Es un subconjunto del Excel a propósito: en A4 horizontal
 * caben unas diez columnas legibles, así que se imprimen las que sirven para pasar lista y llamar
 * por teléfono, y el Excel queda como la versión con todos los campos (correo, estado civil,
 * fecha de bautismo).
 */
function columnasNominalPdf(mostrarIglesia: boolean): ColumnaPdf<ReporteNominal['miembros'][number]>[] {
  const columnas: ColumnaPdf<ReporteNominal['miembros'][number]>[] = [
    { encabezado: 'N°', peso: 4, valor: () => '', align: 'right' },
    { encabezado: 'DNI', peso: 8, valor: (m) => m.dni, align: 'center' },
    { encabezado: 'Apellidos y nombres', peso: 26, valor: (m) => `${m.apellido}, ${m.nombre}` },
    { encabezado: 'Sexo', peso: 8, valor: (m) => m.sexo, align: 'center' },
    { encabezado: 'F. nacim.', peso: 9, valor: (m) => formatearFecha(m.fechaNacimiento), align: 'center' },
    { encabezado: 'Edad', peso: 5, valor: (m) => texto(m.edad), align: 'center' },
    { encabezado: 'Grupo etario', peso: 11, valor: (m) => etiquetaGrupoEtario(m.grupoEtario), align: 'center' },
    { encabezado: 'Estado ecl.', peso: 10, valor: (m) => m.estadoEclesial, align: 'center' },
    { encabezado: 'Ministerio', peso: 16, valor: (m) => texto(m.ministerio) },
    { encabezado: 'Teléfono', peso: 9, valor: (m) => texto(m.telefono), align: 'center' },
  ];

  if (mostrarIglesia) {
    columnas.push({ encabezado: 'Iglesia', peso: 18, valor: (m) => m.iglesia });
  }
  return columnas;
}

export function generarPdfMembresia(reporte: ReporteMembresia): Promise<Buffer> {
  const doc = nuevoDocumento();
  const columnas = columnasConsolidadoPdf(reporte);
  const titulo =
    reporte.agruparPor === 'distrito' ? 'Membresía por distrito' : 'Membresía por iglesia';

  dibujarCabecera(doc, titulo, reporte.generadoEn, reporte.filtros);

  let y = dibujarTabla(doc, columnas, reporte.filas, doc.y);
  if (reporte.filas.length) {
    y = dibujarFilaTotales(doc, columnas, { ...reporte.totales, nombre: 'TOTAL' }, y);
  }
  dibujarResumen(doc, reporte.totales, reporte.columnasSexo, reporte.columnasEstadoEclesial, y);
  numerarPaginas(doc);

  return aBuffer(doc);
}

export function generarPdfNominal(reporte: ReporteNominal): Promise<Buffer> {
  const doc = nuevoDocumento();

  // Con una sola iglesia en el reporte, repetir su nombre en cada fila solo gasta ancho: ya está
  // en la línea de filtros de la cabecera.
  const iglesias = new Set(reporte.miembros.map((m) => m.iglesia));
  const columnas = columnasNominalPdf(iglesias.size > 1);

  // La numeración de filas se resuelve aquí: pasar lista en papel es el uso principal de este PDF.
  let numero = 0;
  columnas[0].valor = () => String((numero += 1));

  dibujarCabecera(doc, 'Lista de miembros', reporte.generadoEn, reporte.filtros);

  const y = dibujarTabla(doc, columnas, reporte.miembros, doc.y);
  dibujarResumen(doc, reporte.totales, reporte.columnasSexo, reporte.columnasEstadoEclesial, y);
  numerarPaginas(doc);

  return aBuffer(doc);
}
