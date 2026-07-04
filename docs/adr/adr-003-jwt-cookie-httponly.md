# ADR-003: JWT en cookie httpOnly en vez de localStorage

## Contexto

El panel administrativo requiere autenticación (`Usuario` + `Rol`). Un enfoque común en SPAs es guardar el token JWT en `localStorage` y adjuntarlo manualmente en cada request vía header `Authorization`. Ese enfoque expone el token a cualquier script que corra en la página — incluyendo una inyección XSS exitosa, que podría leer `localStorage` y robar la sesión sin que el usuario lo note.

## Decisión

El backend emite el JWT en una cookie (`auth_token`) con:
- `httpOnly: true` — inaccesible desde JavaScript del cliente, elimina el vector de robo por XSS.
- `sameSite: 'lax'` — mitiga el envío de la cookie en navegación cross-site iniciada por terceros (CSRF básico), sin romper la navegación normal de enlaces.
- `secure: env.COOKIE_SECURE` — forzado a `true` en producción (solo se envía sobre HTTPS).

`requireAuth` (`src/middlewares/auth.middleware.ts`) lee esa cookie con `cookie-parser`, verifica el JWT con `jwt.verify` y adjunta `req.user` a la request antes de llegar al controlador.

## Consecuencias

- El frontend no maneja el token directamente en ningún momento: el navegador la adjunta automáticamente en cada request al mismo origen, y el guard de rutas (`authGuard`) confirma la sesión con una llamada async a `GET /auth/me` en vez de inspeccionar un token local.
- Esto tiene un efecto colateral documentado en [ADR-004](adr-004-rendermode-client-admin.md): al no poder leer el token desde JavaScript ni reenviar la cookie manualmente durante un render en servidor, las rutas `/admin/**` se resolvieron como render 100% en cliente.
- Las contraseñas se almacenan con `bcryptjs` (implementación en JavaScript puro, sin binarios nativos) precisamente para no arrastrar el mismo tipo de problema de compatibilidad de binarios nativos que sí afectó a Prisma en este hosting (ver [ADR-002](adr-002-mysql-vs-postgresql.md) y [ADR-006](adr-006-cicd-ftp.md)).
