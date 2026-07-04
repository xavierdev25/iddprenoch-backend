import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Script de un solo uso: reemplaza en producción la data mock de iglesias, pastores,
// líderes y congregantes (nunca fue real) por los 48 registros reales de la organización,
// extraídos del sitio legacy (ubicaciones.html). No toca prisma/seed.ts ni su propósito
// (poblar bases de desarrollo con data de ejemplo).

const ASSETS_DIR = path.join(__dirname, '..', 'assets-legacy', 'iglesias');

interface IglesiaReal {
  nombre: string;
  pastor: string;
  direccion: string;
  distrito: string;
  foto?: string;
}

const iglesias: IglesiaReal[] = [
  // Barranca Norte
  { nombre: 'Cristo Viene Pronto', pastor: 'Jonas Cotrina Herrera', direccion: 'Bella Esperanza - Caraqueño', distrito: 'Barranca Norte' },
  { nombre: 'Getsemaní', pastor: 'Arcadio Benedicto Mory Ortiz', direccion: 'San Mateo de Churlín - San Pedro de Choque', distrito: 'Barranca Norte', foto: 'churlin.jpeg' },
  { nombre: 'Ríos de Agua Viva', pastor: 'Ronal Romero Zorrilla', direccion: 'Cc poblado la paz s/n', distrito: 'Barranca Norte' },
  { nombre: 'La Hermosa', pastor: 'Lister Denies Sánchez Morales', direccion: 'Calle Apurímac s/n, Paramonga', distrito: 'Barranca Norte' },
  { nombre: 'Centro de Misiones', pastor: 'Rómulo Ayala Chávez', direccion: 'Huayto', distrito: 'Barranca Norte' },
  { nombre: 'Jesucristo Rey de Reyes', pastor: 'Pedro Giraldo Pajuelo', direccion: 'Urb. 7 de Junio Mz.D Lte.14, Paramonga', distrito: 'Barranca Norte' },
  { nombre: 'Cristo la única esperanza', pastor: 'Gonzalo Cotrina Cristóbal', direccion: 'CP Puente Bolívar, Pativilca', distrito: 'Barranca Norte' },
  { nombre: 'Nueva Vida', pastor: 'Sinaí Vega Rodríguez', direccion: 'Pativilca, jirón Sucre N.340', distrito: 'Barranca Norte' },

  // Barranca Centro
  { nombre: 'La Gloria de Dios', pastor: 'Macdonio Conqui Cotrina', direccion: 'Pampas de Velarde s/n', distrito: 'Barranca Centro' },
  { nombre: 'Misión: El Faro', pastor: 'Liliana Huamán Collao', direccion: 'Puerto Supe', distrito: 'Barranca Centro' },
  { nombre: 'Camino de Santidad', pastor: 'Andrés Rodríguez Huerta', direccion: 'Santa Elena Norte', distrito: 'Barranca Centro', foto: 'santa-elena-1.jpeg' },
  { nombre: 'Monte de los Olivos (Atarri)', pastor: 'Timoteo Casariego Flores', direccion: 'Cerro de Pasamayo, Puerto Supe', distrito: 'Barranca Centro' },
  { nombre: 'Monte de los Olivos (Barranca)', pastor: 'Elía García Lada / Manuel Bustamante', direccion: 'Las Casuarinas, Barranca', distrito: 'Barranca Centro', foto: 'barranca.jpeg' },
  { nombre: 'Monte de los Olivos', pastor: 'Pedro Sánchez Tadeo', direccion: 'Andrés de los 492, Barranca', distrito: 'Barranca Centro' },

  // Barranca Sur
  { nombre: 'Misión: Vida eterna', pastor: 'Eldy Magdalena Segura Saavedra', direccion: 'Tablada Chica/Pje. San Martín, Supe', distrito: 'Barranca Sur' },
  { nombre: 'Príncipe de Paz', pastor: 'Aquilino Cerna Gregorio', direccion: 'Laderas de San Nicolás comité 2', distrito: 'Barranca Sur', foto: 'principe-de-paz.jpeg' },
  { nombre: 'Emmanuel', pastor: 'Jhon Vega Pichilingue', direccion: 'San Pedro Mártir s/n, Puerto Supe', distrito: 'Barranca Sur', foto: 'emanuel.jpeg' },
  { nombre: 'Andares el Camino', pastor: 'Jesús Isaac Gonzales Rojas', direccion: 'Jr. Chimú Cápac N°760, Supe Pueblo', distrito: 'Barranca Sur' },
  { nombre: 'Elim', pastor: 'Florisa Esther Calisto de Cerna', direccion: 'Leticia, Puerto Supe', distrito: 'Barranca Sur' },
  { nombre: 'Casa de Paz', pastor: 'Martín Rojas Trinidad', direccion: 'San Juan de Dios, Supe', distrito: 'Barranca Sur' },
  { nombre: 'Agua Viva', pastor: 'Paul Nieto Tolentino', direccion: 'Jr. Espinar s/n, Supe Pueblo', distrito: 'Barranca Sur' },
  { nombre: 'Camino a la Salvación', pastor: 'Claudio Luna Espinoza', direccion: 'San Juan de Dios, Supe', distrito: 'Barranca Sur' },
  { nombre: 'Shadai', pastor: 'Jani Alejo Ramos', direccion: 'San Juan de Dios, Supe', distrito: 'Barranca Sur' },

  // Medio Mundo
  { nombre: 'Sendas de vida eterna', pastor: 'Natalia Paquina Palomino', direccion: 'Av. Dos de Mayo Mz.Q Lt.19, Medio Mundo', distrito: 'Medio Mundo', foto: 'senda-de-vida-eterna.jpeg' },
  { nombre: 'Fuente de vida', pastor: 'Eliseo Arquimio Zamudio', direccion: 'Av. Ramón Castilla Mz.97 Lt.2, Santa Cruz, Medio Mundo', distrito: 'Medio Mundo', foto: 'fuente-de-vida.jpeg' },
  { nombre: 'Cristo es el camino', pastor: 'Marcelina Villadeza Landa', direccion: 'Calle Huánuco Mz.H Lt.1, San Felipe', distrito: 'Medio Mundo', foto: 'cristo-es-el-camino.jpeg' },
  { nombre: 'Sendas al Cielo', pastor: 'Valentín Requelme Dino', direccion: 'Av. Buenos Aires, Tres Piedras', distrito: 'Medio Mundo' },
  { nombre: 'Camino al Cielo', pastor: 'Gremen Carrillo Obregón', direccion: 'Bellavista, Vegueta', distrito: 'Medio Mundo' },

  // Huaura
  { nombre: 'Luz y Vida', pastor: 'Lemuel Elmer Pacheco Claros', direccion: 'Av. Pedro P. Herrera s/n, Hualmay, Huacho', distrito: 'Huaura' },
  { nombre: 'Libertad en Cristo', pastor: 'Ricardo Vilca Jaimes', direccion: 'Jr. Simón Bolívar 170, Huaura', distrito: 'Huaura' },
  { nombre: 'Nueva Jerusalén (Carquín)', pastor: 'Ronald Arturo Córdova Arroyo', direccion: 'Las Brisas s/n, Carquín', distrito: 'Huaura' },
  { nombre: 'Nueva Jerusalén (Sta. Rosa)', pastor: 'Juan Lorenzo Alva López', direccion: 'CP Casa Blanca y anexos, Santa Rosa', distrito: 'Huaura' },
  { nombre: 'Manantial de vida', pastor: 'Héctor Loyola', direccion: 'C. San Martín s/n, Santa Elvira, Sayán', distrito: 'Huaura' },
  { nombre: 'Monte Sión (Primavera)', pastor: 'Ricardo Vilca Jaimes (resp.)', direccion: 'CP Primavera', distrito: 'Huaura' },
  { nombre: 'El Buen Pastor', pastor: 'Wagner Edino Olivas Zuluaga', direccion: 'CP Cañaverales s/n, Huaura', distrito: 'Huaura' },
  { nombre: 'Casa de Dios', pastor: 'Wagner Edino Olivas Zuluaga', direccion: 'CP El Sol de Loza, Huaura', distrito: 'Huaura' },

  // Huaral
  { nombre: 'Fe y Vida', pastor: 'Toribio Ledesma Esteban', direccion: 'La Ladera de Montalva, Huaral', distrito: 'Huaral', foto: 'fe-y-vida.jpeg' },
  { nombre: 'Impacto de Amor y Poder', pastor: 'Dionisio Jara Melgarejo', direccion: 'Calle Jorge Montalvo, Huaral', distrito: 'Huaral' },
  { nombre: 'Embajadores de Cristo', pastor: 'Ezequiel Tarazona Luna', direccion: 'CP Retes, Huaral', distrito: 'Huaral', foto: 'embajadores-de-cristo.jpeg' },
  { nombre: 'Manantial de vida', pastor: 'José Ávila Cruz', direccion: 'CP Macatón, Huaral', distrito: 'Huaral' },
  { nombre: 'Clínica de Cristo', pastor: 'Lázaro Morales David Alex', direccion: 'CP Caporala II, Huaral', distrito: 'Huaral' },
  { nombre: 'Nueva Visión', pastor: 'Jhon Hernán Roca Changa', direccion: 'CP La Ladrillera, Huaral', distrito: 'Huaral' },
  { nombre: 'Monte Sinaí', pastor: 'Nabaro Lucio Camacho Leiva', direccion: 'CP Pueblo Libre, Chancay', distrito: 'Huaral' },
  { nombre: 'Bethel', pastor: 'Eli Nehemías Asencios Saavedra', direccion: 'CP Contigo Perú, Huaral', distrito: 'Huaral' },
  { nombre: 'Roca Eterna', pastor: 'Víctor Rodrigo Pacheco Alarcón', direccion: 'Prolong. José Olaya Mz.K Lte.27-28, Urb. Las Casuarinas', distrito: 'Huaral' },
  { nombre: 'Salem', pastor: 'Franklin Quiñones Cifuentes', direccion: 'CP La Caleta Centenario, Chancay', distrito: 'Huaral', foto: 'salem.jpeg' },
  { nombre: 'Monte de Horeb', pastor: 'Jacinto Orbegoso Bravo', direccion: 'Calle La Capilla Mz.C Lt.4, CP La Candelaria, Chancay', distrito: 'Huaral' },
  { nombre: 'Misión: Legado de Fe', pastor: 'Tito Grover Pacheco Claros', direccion: 'Urb. Abisov, Chancay Cercado', distrito: 'Huaral' },
];

const CANTIDAD_ESPERADA = 48;
const FOTOS_ESPERADAS = 11;

function buscarArchivo(nombreArchivo: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `No existe la carpeta de assets: ${ASSETS_DIR}\n` +
        `Coloca ahí las subcarpetas por distrito (barranca-norte/, barranca-centro/, barranca-sur/, medio-mundo/, huaral/) antes de correr este script.`,
    );
  }

  const directo = path.join(ASSETS_DIR, nombreArchivo);
  if (fs.existsSync(directo)) return directo;

  const subcarpetas = fs.readdirSync(ASSETS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const sub of subcarpetas) {
    const candidato = path.join(ASSETS_DIR, sub.name, nombreArchivo);
    if (fs.existsSync(candidato)) return candidato;
  }

  throw new Error(`No se encontró la foto "${nombreArchivo}" en ninguna subcarpeta de ${ASSETS_DIR}`);
}

function encodeImagen(nombreArchivo: string): string {
  const ruta = buscarArchivo(nombreArchivo);
  const buffer = fs.readFileSync(ruta);
  const ext = path.extname(nombreArchivo).slice(1).toLowerCase();
  return `data:image/${ext};base64,${buffer.toString('base64')}`;
}

async function main() {
  if (iglesias.length !== CANTIDAD_ESPERADA) {
    throw new Error(`Se esperaban ${CANTIDAD_ESPERADA} iglesias en el array, hay ${iglesias.length}`);
  }
  const cantidadConFoto = iglesias.filter((i) => i.foto).length;
  if (cantidadConFoto !== FOTOS_ESPERADAS) {
    throw new Error(`Se esperaban ${FOTOS_ESPERADAS} iglesias con foto, hay ${cantidadConFoto}`);
  }

  const distritosDb = await prisma.distrito.findMany();
  const distritoIdByNombre = new Map(distritosDb.map((d) => [d.nombre, d.id]));
  for (const nombreDistrito of new Set(iglesias.map((i) => i.distrito))) {
    if (!distritoIdByNombre.has(nombreDistrito)) {
      throw new Error(`Distrito no encontrado en la tabla distritos: "${nombreDistrito}"`);
    }
  }

  const cargoNinguno = await prisma.cargo.findUnique({ where: { nombre: 'Ninguno' } });
  if (!cargoNinguno) {
    throw new Error('No se encontró el cargo "Ninguno" en la tabla cargos');
  }

  // Resuelve y lee todas las fotos ANTES de borrar nada: si falta un archivo, el script
  // debe fallar aquí, sin haber tocado la base de datos todavía.
  const fotosPorArchivo = new Map<string, string>();
  for (const item of iglesias) {
    if (item.foto && !fotosPorArchivo.has(item.foto)) {
      fotosPorArchivo.set(item.foto, encodeImagen(item.foto));
    }
  }

  console.log(`Iglesias a migrar: ${iglesias.length} (${cantidadConFoto} con foto)`);
  console.log('Limpiando tablas mock: congregantes, lideres, pastores, iglesias...');
  await prisma.congregante.deleteMany();
  await prisma.lider.deleteMany();
  await prisma.pastor.deleteMany();
  await prisma.iglesia.deleteMany();

  for (const item of iglesias) {
    const distritoId = distritoIdByNombre.get(item.distrito)!;
    const foto = item.foto ? fotosPorArchivo.get(item.foto) : undefined;

    const iglesia = await prisma.iglesia.create({
      data: {
        nombre: item.nombre,
        direccion: item.direccion,
        distritoId,
        ...(foto ? { foto } : {}),
      },
    });

    await prisma.pastor.create({
      data: {
        nombrePastor: item.pastor,
        iglesiaId: iglesia.id,
        cargoId: cargoNinguno.id,
      },
    });
  }

  console.log(`Listo: ${iglesias.length} iglesias y ${iglesias.length} pastores insertados (${cantidadConFoto} con foto).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
