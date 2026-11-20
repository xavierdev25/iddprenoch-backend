import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';

/**
 * Límites de peticiones del elector (ADR-028): por SESIÓN o por DNI, nunca por IP sola.
 *
 * En la asamblea todos los celulares pueden salir por el Wi-Fi del local, es decir por una sola IP
 * pública; un límite por IP bloquearía a la asamblea entera. Ventana fija en memoria: suficiente con
 * un solo proceso de Passenger (mismo supuesto que el estado en memoria).
 */
export class LimiteVentana {
  private readonly cuentas = new Map<string, { inicio: number; n: number }>();

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number,
  ) {}

  /** Suma un intento; devuelve false si con este se supera el máximo. */
  consumir(clave: string, ahora = Date.now()): boolean {
    const c = this.cuentas.get(clave);
    if (!c || ahora - c.inicio >= this.ventanaMs) {
      this.cuentas.set(clave, { inicio: ahora, n: 1 });
      this.limpiarSiCrece(ahora);
      return true;
    }
    c.n += 1;
    return c.n <= this.maximo;
  }

  bloqueado(clave: string, ahora = Date.now()): boolean {
    const c = this.cuentas.get(clave);
    return Boolean(c && ahora - c.inicio < this.ventanaMs && c.n >= this.maximo);
  }

  reiniciar(clave: string): void {
    this.cuentas.delete(clave);
  }

  /** Evita que el Map crezca sin fin con DNIs o sesiones que ya no vuelven. */
  private limpiarSiCrece(ahora: number): void {
    if (this.cuentas.size < 10_000) return;
    for (const [k, c] of this.cuentas) if (ahora - c.inicio >= this.ventanaMs) this.cuentas.delete(k);
  }
}

const QUINCE_MIN = 15 * 60 * 1000;
const UN_MIN = 60 * 1000;

/** 5 intentos fallidos de ingreso por DNI y asamblea (el código tiene solo 10 000 combinaciones). */
export const fallosIngreso = new LimiteVentana(5, QUINCE_MIN);

/**
 * Tope por IP solo para el ingreso (antes de tener sesión), holgado para que 200 electores detrás
 * del mismo Wi-Fi entren sin problema, pero que corte un barrido masivo de DNIs desde un equipo.
 */
export const ingresosPorIp = new LimiteVentana(600, QUINCE_MIN);

/** Polling cada 3 s ± 1 s ≈ 20/min; 90/min deja margen a recargas y redes que reintentan. */
const consultasEstado = new LimiteVentana(90, UN_MIN);
/** Un elector vota una vez por elección; 10/min cubre reintentos por mala señal. */
const votos = new LimiteVentana(10, UN_MIN);

function porSesion(limite: LimiteVentana) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.elector && !limite.consumir(`e${req.elector.electorId}`)) {
      next(new ApiError(429, 'Demasiadas solicitudes seguidas. Espera unos segundos.'));
      return;
    }
    next();
  };
}

export const limitarEstado = porSesion(consultasEstado);
export const limitarVoto = porSesion(votos);
