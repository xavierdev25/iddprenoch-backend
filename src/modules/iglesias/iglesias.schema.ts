import { z } from 'zod';
import { idField, idOpcionalField, urlField } from '../../utils/schemaHelpers';
import { esEnlaceCortoDeMaps, extraerCoordenadas } from '../../utils/mapsUrl';

const latitudField = z.coerce.number().min(-90, 'latitud fuera de rango').max(90, 'latitud fuera de rango');
const longitudField = z.coerce
  .number()
  .min(-180, 'longitud fuera de rango')
  .max(180, 'longitud fuera de rango');

const camposIglesia = {
  nombre: z.string().min(1, 'nombre es requerido').max(255),
  direccion: z.string().min(1, 'direccion es requerida').max(500),
  distritoId: idField('distritoId'),
  ministerioId: idOpcionalField,
  foto: urlField('foto'),
  // `null` explícito borra la ubicación guardada. Hace falta distinguirlo de la ausencia: en un
  // PUT parcial, un campo ausente significa "no tocar", así que sin el null no habría forma de
  // quitarle las coordenadas a una iglesia mal ubicada.
  latitud: z.preprocess((v) => (v === '' ? undefined : v), latitudField.nullish()),
  longitud: z.preprocess((v) => (v === '' ? undefined : v), longitudField.nullish()),
  /**
   * Comodidad de entrada, no columna: el administrador pega el enlace de Google Maps y el backend
   * extrae las coordenadas. Solo se guardan `latitud`/`longitud`, así que el enlace nunca queda
   * desincronizado del punto ni atado al formato de URL que Google use hoy.
   */
  mapsUrl: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(2000).optional()),
};

/**
 * Resuelve `mapsUrl` a coordenadas y lo saca del payload, porque no es una columna de la tabla.
 *
 * Las coordenadas explícitas ganan sobre el enlace: si el formulario manda ambas, es porque el
 * usuario corrigió los números a mano después de pegar la URL.
 */
function resolverUbicacion<
  T extends { mapsUrl?: unknown; latitud?: number | null; longitud?: number | null },
>(datos: T, ctx: z.RefinementCtx) {
  const { mapsUrl, ...resto } = datos;

  // Borrado explícito: `null` en cualquiera de las dos limpia el par completo, porque media
  // coordenada guardada no ubicaría nada.
  if (resto.latitud === null || resto.longitud === null) {
    return { ...resto, latitud: null, longitud: null };
  }

  const tieneAmbas = resto.latitud !== undefined && resto.longitud !== undefined;

  if (typeof mapsUrl === 'string' && !tieneAmbas) {
    const coordenadas = extraerCoordenadas(mapsUrl);
    if (!coordenadas) {
      ctx.addIssue({
        code: 'custom',
        path: ['mapsUrl'],
        message: esEnlaceCortoDeMaps(mapsUrl)
          ? 'Ese es un enlace corto de Google Maps. Ábrelo en el navegador y copia la URL completa de la barra de direcciones, o pega las coordenadas como "-10.7539, -77.7614".'
          : 'No se encontraron coordenadas en el enlace. Pega la URL completa de Google Maps o las coordenadas como "-10.7539, -77.7614".',
      });
      return resto;
    }
    return { ...resto, latitud: coordenadas.latitud, longitud: coordenadas.longitud };
  }

  // Media coordenada no ubica nada y rompería el enlace al mapa; se rechaza en vez de guardar
  // una fila que aparenta tener ubicación.
  if (!tieneAmbas && (resto.latitud !== undefined || resto.longitud !== undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: [resto.latitud === undefined ? 'latitud' : 'longitud'],
      message: 'latitud y longitud deben indicarse juntas',
    });
  }

  return resto;
}

export const createIglesiaSchema = z.object(camposIglesia).transform(resolverUbicacion);

export const updateIglesiaSchema = z.object(camposIglesia).partial().transform(resolverUbicacion);
