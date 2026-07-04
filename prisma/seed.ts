import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_COST_FACTOR = 12;

// NOTA: excepto donde se indica explícitamente "dato real", toda la información de iglesias,
// pastores, líderes, congregantes, eventos y comunicados generada aquí es de ejemplo para
// desarrollo — no representa datos reales de la organización.

async function seedCatalogs() {
  const distritos = ['Barranca Norte', 'Barranca Centro', 'Barranca Sur', 'Medio Mundo', 'Huaura', 'Huaral'];
  await prisma.distrito.createMany({ data: distritos.map((nombre) => ({ nombre })), skipDuplicates: true });

  const cargos = [
    'Ninguno',
    'Obispo Regional',
    'Obispo Distrital',
    'Secretario Regional',
    'Tesorero Regional',
    'Vocal Regional',
    'Secretario Distrital',
    'Tesorero Distrital',
    'Vocal Distrital',
  ];
  await prisma.cargo.createMany({ data: cargos.map((nombre) => ({ nombre })), skipDuplicates: true });

  await prisma.rol.createMany({
    data: ['Administrador Regional', 'Secretario Regional', 'Tesorero Regional', 'Editor'].map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });

  await prisma.estadoUsuario.createMany({
    data: ['Activo', 'Inactivo'].map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });

  await prisma.sexo.createMany({
    data: ['Masculino', 'Femenino'].map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });

  await prisma.estadoCivil.createMany({
    data: ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)'].map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });

  await prisma.estadoEclesial.createMany({
    data: ['Bautizado', 'Asistente'].map((nombre) => ({ nombre })),
    skipDuplicates: true,
  });

  await prisma.ministerio.createMany({
    data: [
      {
        nombre: 'Ministerio de la Mujer',
        slug: 'mujer',
        descripcion:
          'Espacio de crecimiento espiritual, comunidad y servicio para las hermanas de la región. Promueve el liderazgo femenino y la formación bíblica desde la perspectiva de la mujer.',
      },
      {
        nombre: 'Ministerio de Varones',
        slug: 'varones',
        descripcion:
          'Comunidad de hombres comprometidos con su familia, su iglesia y su comunidad. Se reúnen para edificarse mutuamente en la fe y servir con integridad.',
      },
      {
        nombre: 'Jóvenes y Adolescentes',
        slug: 'jovenes',
        descripcion:
          'Ministerio dinámico que acompaña a jóvenes y adolescentes de la región en su desarrollo espiritual, social y vocacional.',
      },
      {
        nombre: 'Ministerio Infantil',
        slug: 'infantil',
        descripcion: 'Dedicado a la formación bíblica y espiritual de los niños de las congregaciones.',
      },
      {
        nombre: 'Ministerio de Música',
        slug: 'musica',
        descripcion: 'Equipos de alabanza y adoración que guían el culto en cada congregación local y en los eventos regionales.',
      },
      {
        nombre: 'Proyección Social',
        slug: 'social',
        descripcion: 'Iniciativas de servicio comunitario que llevan asistencia a los sectores más vulnerables de la región.',
      },
    ],
    skipDuplicates: true,
  });
}

async function seedIglesiasYPastores() {
  const distritos = await prisma.distrito.findMany();
  const distritoIdByNombre = new Map(distritos.map((d) => [d.nombre, d.id]));
  const cargos = await prisma.cargo.findMany();
  const cargoIdByNombre = new Map(cargos.map((c) => [c.nombre, c.id]));

  interface IglesiaSeed {
    nombre: string;
    direccion: string;
    distrito: string;
    pastor: string;
    cargo: string;
    esReal: boolean;
  }

  // Las dos primeras son datos reales confirmados del distrito Huaral; el resto es data de
  // ejemplo para completar el desarrollo, distribuida entre los 6 distritos reales.
  const iglesias: IglesiaSeed[] = [
    { nombre: 'Embajadores de Cristo', direccion: 'Calle Las Casuarinas - Retes', distrito: 'Huaral', pastor: 'Ezequiel Tarazona Luna', cargo: 'Ninguno', esReal: true },
    { nombre: 'Fe y Vida', direccion: 'Pasaje El Porvenir 245', distrito: 'Huaral', pastor: 'Esteban Felipe Toribio Ledesma', cargo: 'Ninguno', esReal: true },
    { nombre: 'IDDP "El Calvario"', direccion: 'Jr. Moquegua 312, Barranca', distrito: 'Barranca Norte', pastor: 'Marco Antonio Flores Huamán', cargo: 'Obispo Distrital', esReal: false },
    { nombre: 'IDDP "El Buen Pastor"', direccion: 'Av. Progreso 101, Supe', distrito: 'Barranca Norte', pastor: 'Segundo Natividad Torres Llanos', cargo: 'Ninguno', esReal: false },
    { nombre: 'IDDP "Bethel"', direccion: 'Av. Lima 540, Barranca', distrito: 'Barranca Centro', pastor: 'Juan Carlos Mendoza Ríos', cargo: 'Obispo Regional', esReal: false },
    { nombre: 'IDDP "Monte Sinaí"', direccion: 'Jr. Arequipa 178, Barranca', distrito: 'Barranca Centro', pastor: 'Rosa Elena Castillo de Vega', cargo: 'Obispo Distrital', esReal: false },
    { nombre: 'IDDP "Emmanuel"', direccion: 'Psj. Los Álamos 45, Paramonga', distrito: 'Barranca Sur', pastor: 'David Enrique Morales Soto', cargo: 'Obispo Distrital', esReal: false },
    { nombre: 'IDDP "Fuente de Vida"', direccion: 'Jr. Tacna 58, Pativilca', distrito: 'Medio Mundo', pastor: 'Abel Raúl Quispe Palacios', cargo: 'Ninguno', esReal: false },
    { nombre: 'IDDP "Getsemaní"', direccion: 'Av. Pacífico 220, Végueta', distrito: 'Medio Mundo', pastor: 'Samuel Augusto Ramos Cruz', cargo: 'Obispo Distrital', esReal: false },
    { nombre: 'IDDP "Roca de Salvación"', direccion: 'Jr. Grau 89, Huaura', distrito: 'Huaura', pastor: 'Elías Benjamín Vargas León', cargo: 'Ninguno', esReal: false },
    { nombre: 'IDDP "Monte Sión"', direccion: 'Calle Bolívar 412, Huacho', distrito: 'Huaura', pastor: 'Ezequiel Norabuena Campos', cargo: 'Obispo Distrital', esReal: false },
    { nombre: 'IDDP "La Esperanza"', direccion: 'Calle San Martín 300, Aucallama', distrito: 'Huaral', pastor: 'Josué Emmanuel Llanos Bernal', cargo: 'Ninguno', esReal: false },
  ];

  for (const seedIglesia of iglesias) {
    const distritoId = distritoIdByNombre.get(seedIglesia.distrito);
    if (!distritoId) throw new Error(`Distrito no encontrado en catálogo: ${seedIglesia.distrito}`);

    let iglesia = await prisma.iglesia.findFirst({ where: { nombre: seedIglesia.nombre } });
    if (!iglesia) {
      iglesia = await prisma.iglesia.create({
        data: {
          nombre: seedIglesia.nombre,
          direccion: seedIglesia.direccion,
          distritoId,
        },
      });
    }

    const cargoId = cargoIdByNombre.get(seedIglesia.cargo);
    if (!cargoId) throw new Error(`Cargo no encontrado en catálogo: ${seedIglesia.cargo}`);

    const existingPastor = await prisma.pastor.findFirst({ where: { iglesiaId: iglesia.id } });
    if (!existingPastor) {
      await prisma.pastor.create({
        data: {
          nombrePastor: seedIglesia.pastor,
          iglesiaId: iglesia.id,
          cargoId,
        },
      });
    }
  }
}

async function seedLideres() {
  const iglesias = await prisma.iglesia.findMany();
  const ministerios = await prisma.ministerio.findMany();
  const iglesiaId = (nombre: string) => iglesias.find((i) => i.nombre === nombre)!.id;
  const ministerioId = (slug: string) => ministerios.find((m) => m.slug === slug)!.id;

  const lideres = [
    { dni: '47821345', nombre: 'María Esperanza', apellido: 'Huamán Cárdenas', telefono: '987111222', correo: 'mhuaman@iddp.pe', ministerio: 'mujer', iglesia: 'IDDP "Bethel"' },
    { dni: '38745621', nombre: 'Carlos Alberto', apellido: 'Ríos Tarazona', telefono: '976222333', ministerio: 'varones', iglesia: 'IDDP "El Calvario"' },
    { dni: '52198743', nombre: 'Ana Lucía', apellido: 'Paredes Delgado', correo: 'aparedes@iddp.pe', ministerio: 'jovenes', iglesia: 'IDDP "Monte Sinaí"' },
    { dni: '44562187', nombre: 'Pedro Santiago', apellido: 'Vásquez Muñoz', telefono: '954444555', ministerio: 'infantil', iglesia: 'IDDP "Emmanuel"' },
    { dni: '61239874', nombre: 'Luz Marina', apellido: 'Torres Espinoza', telefono: '943555666', correo: 'ltorres@iddp.pe', ministerio: 'musica', iglesia: 'IDDP "Bethel"' },
    { dni: '39874521', nombre: 'Josué Emmanuel', apellido: 'Llanos Bernal', ministerio: 'social', iglesia: 'IDDP "La Esperanza"' },
  ];

  for (const l of lideres) {
    await prisma.lider.upsert({
      where: { dni: l.dni },
      update: {},
      create: {
        dni: l.dni,
        nombre: l.nombre,
        apellido: l.apellido,
        telefono: l.telefono,
        correo: l.correo,
        ministerioId: ministerioId(l.ministerio),
        iglesiaId: iglesiaId(l.iglesia),
      },
    });
  }
}

async function seedCongregantes() {
  const iglesias = await prisma.iglesia.findMany();
  const sexos = await prisma.sexo.findMany();
  const estadosCiviles = await prisma.estadoCivil.findMany();
  const estadosEclesiales = await prisma.estadoEclesial.findMany();

  const iglesiaId = (nombre: string) => iglesias.find((i) => i.nombre === nombre)!.id;
  const sexoId = (nombre: string) => sexos.find((s) => s.nombre === nombre)!.id;
  const civilId = (nombre: string) => estadosCiviles.find((e) => e.nombre === nombre)!.id;
  const eclesialId = (nombre: string) => estadosEclesiales.find((e) => e.nombre === nombre)!.id;

  const congregantes = [
    { dni: '72345618', nombre: 'María Esperanza', apellido: 'Huamán Cárdenas', telefono: '987111222', correo: 'mhuaman@gmail.com', iglesia: 'IDDP "Bethel"', sexo: 'Femenino', civil: 'Casado(a)', eclesial: 'Bautizado', fechaConversion: '2012-03-15', fechaBautismo: '2012-06-10' },
    { dni: '38745699', nombre: 'Carlos Alberto', apellido: 'Ríos Tarazona', telefono: '976222333', iglesia: 'IDDP "El Calvario"', sexo: 'Masculino', civil: 'Casado(a)', eclesial: 'Bautizado', fechaConversion: '2008-07-22', fechaBautismo: '2008-10-05' },
    { dni: '52198711', nombre: 'Ana Lucía', apellido: 'Paredes Delgado', correo: 'aparedes@gmail.com', iglesia: 'IDDP "Monte Sinaí"', sexo: 'Femenino', civil: 'Soltero(a)', eclesial: 'Bautizado', fechaConversion: '2019-01-14', fechaBautismo: '2019-04-20' },
    { dni: '44562155', nombre: 'Pedro Santiago', apellido: 'Vásquez Muñoz', telefono: '954444555', iglesia: 'IDDP "Emmanuel"', sexo: 'Masculino', civil: 'Divorciado(a)', eclesial: 'Bautizado', fechaConversion: '2005-11-08', fechaBautismo: '2006-02-12' },
    { dni: '72345633', nombre: 'Valeria', apellido: 'Soto Campos', iglesia: 'IDDP "Bethel"', sexo: 'Femenino', civil: 'Soltero(a)', eclesial: 'Asistente' },
    { dni: '61239811', nombre: 'Luz Marina', apellido: 'Torres Espinoza', telefono: '943555666', correo: 'ltorres@gmail.com', iglesia: 'IDDP "Bethel"', sexo: 'Femenino', civil: 'Casado(a)', eclesial: 'Bautizado', fechaConversion: '2010-05-20', fechaBautismo: '2010-08-15' },
    { dni: '39874588', nombre: 'Josué Emmanuel', apellido: 'Llanos Bernal', iglesia: 'IDDP "La Esperanza"', sexo: 'Masculino', civil: 'Soltero(a)', eclesial: 'Bautizado', fechaConversion: '2015-09-03', fechaBautismo: '2016-01-10' },
    { dni: '85647311', nombre: 'Gloria', apellido: 'Mendoza Falcón', telefono: '932666777', iglesia: 'IDDP "Monte Sión"', sexo: 'Femenino', civil: 'Viudo(a)', eclesial: 'Bautizado', fechaConversion: '2003-08-18', fechaBautismo: '2004-01-25' },
  ];

  for (const c of congregantes) {
    await prisma.congregante.upsert({
      where: { dni: c.dni },
      update: {},
      create: {
        dni: c.dni,
        nombre: c.nombre,
        apellido: c.apellido,
        telefono: c.telefono,
        correo: c.correo,
        iglesiaId: iglesiaId(c.iglesia),
        sexoId: sexoId(c.sexo),
        estadoCivilId: civilId(c.civil),
        estadoEclesialId: eclesialId(c.eclesial),
        fechaConversion: c.fechaConversion ? new Date(c.fechaConversion) : undefined,
        fechaBautismo: c.fechaBautismo ? new Date(c.fechaBautismo) : undefined,
      },
    });
  }
}

async function seedEventosYComunicados() {
  const eventos = [
    { nombre: 'Conferencia Regional de Jóvenes', fechaConHora: '2026-07-19T09:00:00', ubicacion: 'IDDP "Bethel" Barranca Centro — Av. Lima 540', descripcion: 'Un día de encuentro para los jóvenes de toda la región con talleres, alabanza y un mensaje central.' },
    { nombre: 'Semana de Oración Regional', fechaConHora: '2026-07-21T19:00:00', ubicacion: 'Cada congregación local — ver su pastor', descripcion: 'Siete días de intercesión unificada en todas las iglesias de la región.' },
    { nombre: 'Convención Ministerio de la Mujer', fechaConHora: '2026-08-02T10:00:00', ubicacion: 'IDDP "Monte Sión" Huacho — Calle Bolívar 412', descripcion: 'Convención anual para las hermanas de la región con predicación y talleres de formación.' },
    { nombre: 'Culto de Unidad Regional', fechaConHora: '2026-09-06T10:30:00', ubicacion: 'Por confirmar — Barranca', descripcion: 'El gran culto que reúne a todas las congregaciones de la región.' },
  ];

  for (const e of eventos) {
    const exists = await prisma.evento.findFirst({ where: { nombre: e.nombre } });
    if (!exists) {
      await prisma.evento.create({ data: { ...e, fechaConHora: new Date(e.fechaConHora) } });
    }
  }

  const comunicados = [
    { titulo: 'Actualización del Padrón de Miembros 2026', descripcion: 'Se convoca a todas las iglesias a completar la actualización de datos de sus miembros antes del 31 de julio.' },
    { titulo: 'Convocatoria a Asamblea Regional Ordinaria', descripcion: 'La directiva regional convoca a la Asamblea Ordinaria para el 30 de agosto a las 10:00 a.m.' },
    { titulo: 'Nuevo horario de atención — Secretaría Regional', descripcion: 'A partir de agosto la secretaría atenderá martes y jueves de 9 a.m. a 1 p.m. en el local central de Barranca.' },
  ];

  for (const c of comunicados) {
    const exists = await prisma.comunicado.findFirst({ where: { titulo: c.titulo } });
    if (!exists) {
      await prisma.comunicado.create({ data: c });
    }
  }
}

async function seedAdminUsuario() {
  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'Administrador Regional' } });
  const estadoActivo = await prisma.estadoUsuario.findUniqueOrThrow({ where: { nombre: 'Activo' } });

  const passwordHash = await bcrypt.hash('admin123', BCRYPT_COST_FACTOR);

  await prisma.usuario.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: {
      nombre: 'admin',
      email: 'admin@iddp.pe',
      passwordHash,
      rolId: rolAdmin.id,
      estadoId: estadoActivo.id,
    },
  });
}

async function main() {
  await seedCatalogs();
  await seedIglesiasYPastores();
  await seedLideres();
  await seedCongregantes();
  await seedEventosYComunicados();
  await seedAdminUsuario();
  console.log('Seed completado.');
}

main()
  .catch((err) => {
    console.error('Seed falló:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
