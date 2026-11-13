/** Lo que viaja firmado en el JWT. No cambia con el control de acceso (ADR-026). */
export interface JwtPayload {
  id: number;
  nombre: string;
  rolId: number;
}

/**
 * Usuario de la request, resuelto desde la base en cada petición por `requireAuth`: así un cambio
 * de rol, de distrito o una desactivación rigen al instante, sin esperar a que venza el token.
 */
export interface AuthUser extends JwtPayload {
  rol: string;
  distritoId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
