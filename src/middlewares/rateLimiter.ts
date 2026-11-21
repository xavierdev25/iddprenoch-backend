import rateLimit from 'express-rate-limit';

// In-memory store (express-rate-limit's default): counts live in this process only. On cPanel/
// Passenger this resets on every process restart (deploy, idle spin-down, crash), so a determined
// attacker who forces/waits for a restart gets a fresh 5-attempt window. Acceptable at this scale
// (single Passenger instance, no horizontal scaling to desync anyway) — if that stops being true,
// swap the `store` option for a persistent one (e.g. a Postgres-backed store) rather than assuming
// this is a complete brute-force defense.
//
// Solo cuentan los intentos FALLIDOS (`skipSuccessfulRequests`): el límite frena a quien prueba
// contraseñas, no a quien entra bien. Contar también los exitosos dejaba a toda una mesa de
// asamblea —varias personas tras el mismo Wi-Fi, es decir la misma IP— con 5 ingresos en total
// cada 15 minutos (visto en producción el 21/11/2026; ADR-030 #18).
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 429, message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.' } },
});
