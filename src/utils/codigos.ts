import { randomInt } from 'node:crypto';

/**
 * Alfabeto del código de acceso de una asamblea (va en el QR y en la URL /votar/:codigo). Sin
 * 0/O, 1/I/L ni U/V: si alguien tiene que dictarlo o tipearlo a mano desde el proyector, no hay
 * pares que se confundan.
 */
const ALFABETO_ACCESO = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
export const LARGO_CODIGO_ACCESO = 6;

/** 29^6 ≈ 600 millones de combinaciones: no se adivina, y la unicidad la garantiza la base. */
export function generarCodigoAcceso(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_CODIGO_ACCESO; i++) codigo += ALFABETO_ACCESO[randomInt(ALFABETO_ACCESO.length)];
  return codigo;
}

export function esCodigoAccesoValido(codigo: string): boolean {
  return codigo.length === LARGO_CODIGO_ACCESO && [...codigo].every((c) => ALFABETO_ACCESO.includes(c));
}

/** Código de 4 dígitos del elector, con ceros a la izquierda ("0042"). `randomInt` es criptográfico. */
export function generarCodigoElector(): string {
  return String(randomInt(10_000)).padStart(4, '0');
}
