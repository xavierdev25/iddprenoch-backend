import { describe, expect, it } from 'vitest';
import { enlaceMapa, esEnlaceCortoDeMaps, extraerCoordenadas } from '../mapsUrl';

describe('extraerCoordenadas', () => {
  it('lee el formato /@lat,lng,zoom de la barra de direcciones', () => {
    expect(extraerCoordenadas('https://www.google.com/maps/@-10.7539,-77.7614,17z')).toEqual({
      latitud: -10.7539,
      longitud: -77.7614,
    });
  });

  it('lee el parámetro ?q=lat,lng', () => {
    expect(extraerCoordenadas('https://maps.google.com/?q=-10.7539,-77.7614')).toEqual({
      latitud: -10.7539,
      longitud: -77.7614,
    });
  });

  it('lee el formato de enlace compartido ?api=1&query=lat,lng', () => {
    expect(
      extraerCoordenadas('https://www.google.com/maps/search/?api=1&query=-10.7539,-77.7614'),
    ).toEqual({ latitud: -10.7539, longitud: -77.7614 });
  });

  it('acepta coordenadas pegadas sueltas, sin URL', () => {
    expect(extraerCoordenadas('-10.7539, -77.7614')).toEqual({
      latitud: -10.7539,
      longitud: -77.7614,
    });
  });

  it('decodifica una URL pegada con %2C en lugar de la coma', () => {
    expect(extraerCoordenadas('https://maps.google.com/?q=-10.7539%2C-77.7614')).toEqual({
      latitud: -10.7539,
      longitud: -77.7614,
    });
  });

  // El `@` es el centro del encuadre y puede estar a cuadras del pin si el usuario movió la vista;
  // el `!3d/!4d` es el punto del lugar. Cuando la URL trae ambos, gana el segundo.
  it('prefiere el punto del lugar (!3d/!4d) sobre el centro del encuadre (@)', () => {
    const url =
      'https://www.google.com/maps/place/IDDP/@-10.7000,-77.7000,15z/data=!4m6!3m5!1s0x0!3d-10.7539!4d-77.7614';
    expect(extraerCoordenadas(url)).toEqual({ latitud: -10.7539, longitud: -77.7614 });
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(extraerCoordenadas('https://maps.google.com/?q=-200,-77.7614')).toBeNull();
    expect(extraerCoordenadas('https://maps.google.com/?q=-10.75,-400')).toBeNull();
  });

  it('devuelve null para texto sin coordenadas', () => {
    expect(extraerCoordenadas('Jr. Ejemplo 123, Barranca')).toBeNull();
    expect(extraerCoordenadas('')).toBeNull();
  });

  it('devuelve null para un enlace corto, cuya coordenada no está en el texto', () => {
    expect(extraerCoordenadas('https://maps.app.goo.gl/aBcDeF12345')).toBeNull();
  });

  it('no lanza con un % suelto que rompería decodeURIComponent', () => {
    expect(() => extraerCoordenadas('https://maps.google.com/?q=100%')).not.toThrow();
  });

  it('preserva la precisión decimal completa del pin', () => {
    expect(extraerCoordenadas('-10.7539123,-77.7614987')).toEqual({
      latitud: -10.7539123,
      longitud: -77.7614987,
    });
  });
});

describe('esEnlaceCortoDeMaps', () => {
  it('reconoce los hosts de enlace corto', () => {
    expect(esEnlaceCortoDeMaps('https://maps.app.goo.gl/aBcDeF12345')).toBe(true);
    expect(esEnlaceCortoDeMaps('https://goo.gl/maps/aBcDeF')).toBe(true);
  });

  it('no marca una URL completa como enlace corto', () => {
    expect(esEnlaceCortoDeMaps('https://www.google.com/maps/@-10.75,-77.76,17z')).toBe(false);
  });
});

describe('enlaceMapa', () => {
  it('genera un enlace que vuelve a leerse con las mismas coordenadas', () => {
    const coordenadas = { latitud: -10.7539, longitud: -77.7614 };
    expect(extraerCoordenadas(enlaceMapa(coordenadas))).toEqual(coordenadas);
  });
});
