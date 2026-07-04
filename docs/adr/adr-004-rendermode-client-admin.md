# ADR-004: `RenderMode.Client` para las rutas `/admin/**`

## Contexto

El proyecto Angular usa `ServerRoute[]` (`src/app/app.routes.server.ts`) para declarar, ruta por ruta, cómo debe resolverse el contenido: prerenderizado en build, renderizado en servidor por request, o 100% en el navegador. El panel `/admin/**` está detrás de `authGuard` y no tiene ninguna página indexable por buscadores — no hay beneficio de SEO en prerenderizarlo ni en renderizarlo en servidor.

Además, la autenticación vive en una cookie `httpOnly` (ver [ADR-003](adr-003-jwt-cookie-httponly.md)): si `/admin/**` se hubiera resuelto con `RenderMode.Server`, habría sido necesario reenviar manualmente esa cookie de la request original durante el server-side rendering para que el guard pudiera confirmar la sesión — complejidad añadida sin ningún beneficio real, dado que el contenido de este panel nunca debe ser público ni indexado.

## Decisión

```ts
// src/app/app.routes.server.ts
{ path: 'admin/**', renderMode: RenderMode.Client }
```

Todo lo bajo `/admin/**` se renderiza enteramente en el navegador. El guard de rutas confirma la sesión con una llamada asíncrona a `GET /auth/me`, que sí lleva la cookie automáticamente al ser same-origin.

## Consecuencias

- Se evita la complejidad de reenviar cookies de sesión entre el request original y el motor de SSR.
- El panel admin tiene una carga inicial ligeramente más lenta (debe hidratarse y luego pedir datos), aceptable porque es una herramienta interna de uso administrativo, no contenido público de cara al usuario final.
- Esta decisión es consistente con la posterior eliminación completa del SSR en producción ([ADR-005](adr-005-frontend-estatico-vs-ssr.md)): para cuando se decidió no correr Node vivo en absoluto, `/admin/**` ya no dependía de él.
