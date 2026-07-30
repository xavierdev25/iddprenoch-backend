/**
 * Extracción de coordenadas desde un enlace de Google Maps.
 *
 * La mayoría de las sedes no figura como lugar registrado en Google Maps, así que el flujo real
 * del administrador no es buscar el nombre de la iglesia: es soltar un pin en el punto exacto y
 * copiar el enlace. Este módulo acepta ese enlace pegado tal cual y saca la latitud/longitud, para
 * no obligar a nadie a identificar a mano qué número de la URL es cada coordenada.
 */

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

const LATITUD_MAX = 90;
const LONGITUD_MAX = 180;

/** Enlaces cortos: la coordenada solo existe tras seguir la redirección, no en el texto. */
const HOSTS_ENLACE_CORTO = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

export function esEnlaceCortoDeMaps(texto: string): boolean {
  return HOSTS_ENLACE_CORTO.some((host) => texto.includes(host));
}

function coordenadasValidas(latitud: number, longitud: number): Coordenadas | null {
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  if (Math.abs(latitud) > LATITUD_MAX || Math.abs(longitud) > LONGITUD_MAX) return null;
  return { latitud, longitud };
}

// Los patrones van de más a menos preciso. `!3d/!4d` es el punto del lugar; `@` es solo el centro
// del encuadre del mapa, que puede estar a cuadras del pin si el usuario movió la vista.
const PATRONES: readonly RegExp[] = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, //            .../data=...!3d-11.04!4d-77.60
  /[?&](?:q|query|ll|center|destination)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/, // ?q=lat,lng
  /\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, //              .../maps/@-11.04,-77.60,17z
  /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/, //   coordenadas pegadas sueltas
];

/**
 * Devuelve las coordenadas contenidas en el texto, o `null` si no hay ninguna reconocible
 * (incluidos los enlaces cortos, que habría que resolver por red).
 */
export function extraerCoordenadas(texto: string): Coordenadas | null {
  const entrada = decodificar(texto.trim());
  if (!entrada) return null;

  for (const patron of PATRONES) {
    const coincidencia = entrada.match(patron);
    if (!coincidencia) continue;
    const coordenadas = coordenadasValidas(Number(coincidencia[1]), Number(coincidencia[2]));
    if (coordenadas) return coordenadas;
  }
  return null;
}

// Al pegar desde el navegador la URL suele venir percent-encoded (`%2C` en vez de `,`), lo que
// rompería los patrones. Un texto con `%` suelto hace lanzar a decodeURIComponent, así que se cae
// al original en vez de descartar la entrada.
function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

/**
 * Enlace canónico al punto exacto. Se genera a partir de las coordenadas guardadas en vez de
 * almacenar la URL: así el enlace nunca queda desincronizado del dato ni depende del formato de
 * URL que Google use hoy.
 */
export function enlaceMapa({ latitud, longitud }: Coordenadas): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}
