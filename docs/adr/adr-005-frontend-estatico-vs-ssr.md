# ADR-005: Frontend desplegado como sitio estático puro, en vez de Angular Universal SSR en Node.js App

## Contexto

El proyecto se construyó originalmente con SSR completo: prerenderizado de las rutas públicas en build, más un servidor Express embebido (`src/server.ts`, generado por el esquema estándar de Angular SSR) para resolver en tiempo real las rutas verdaderamente dinámicas — en particular `liderazgo/:slug`, declarada en `src/app/app.routes.server.ts` con `renderMode: RenderMode.Server`. Se desplegó inicialmente como una **segunda Node.js App en cPanel**, en paralelo al backend de la API, gestionada también por Phusion Passenger.

## Problemas reales encontrados, en el orden en que aparecieron

1. **El punto de entrada no arrancaba el servidor.** `src/server.ts` (generado por Angular CLI) decide si escuchar en un puerto con esta condición:

   ```ts
   if (isMainModule(import.meta.url) || process.env['pm_id']) {
     app.listen(port, ...);
   }
   ```

   `isMainModule` comprueba si el archivo se ejecutó directamente como punto de entrada del proceso Node. Passenger, sin embargo, no ejecuta el `.mjs` compilado directamente: requiere un archivo `.cjs` puente como entrypoint. Bajo ese esquema, `isMainModule` nunca se cumplía — el proceso cargaba sin errores (Passenger lo reportaba como "iniciado"), pero nunca abría ningún puerto, y toda petición terminaba en timeout sin ningún error visible en los logs de arranque.

2. **`allowedHosts` bloqueaba el dominio real, no solo pruebas locales.** Una vez resuelto el punto anterior con un archivo puente (`deploy/start.cjs`) que importa `server.mjs` y invoca manualmente el `reqHandler` exportado:

   ```js
   import('./server.mjs').then((mod) => {
     const app = mod.reqHandler;
     app.listen(port, ...);
   });
   ```

   apareció un segundo bloqueador: `angular.json` traía configurado

   ```json
   "security": { "allowedHosts": ["localhost", "nuevo.iddprenoch.com", "iddprenoch.com"] }
   ```

   Angular SSR interpreta esta lista de forma estricta — cualquier `Host` de la petición HTTP que no calce exactamente se rechaza. Esto no solo afectaba pruebas locales (donde es el comportamiento esperado), sino que, mal configurado, también podía rechazar peticiones legítimas al dominio real de producción según el `Host` exacto con el que Apache reenviaba la petición internamente.

3. **Bloqueador operativo irrecuperable.** Finalmente, un error del selector de Node.js de cPanel (`Can't acquire lock for app`) dejó la Node.js App del frontend completamente inadministrable desde el panel: ni reiniciarla ni destruirla funcionaba desde la interfaz. Sin acceso SSH en este plan de hosting, no había forma de diagnosticar ni liberar el lock manualmente desde fuera del panel.

## Decisión

Dado que el proyecto no tiene ninguna ruta que dependa genuinamente de SSR en tiempo real —las rutas públicas ya se resuelven con prerenderizado en tiempo de build (`RenderMode.Prerender`), y el panel admin ya corre 100% en el navegador (`RenderMode.Client`, ver [ADR-004](adr-004-rendermode-client-admin.md))— se decidió eliminar por completo la dependencia de un proceso Node vivo para el frontend:

- Se sirve `dist/iglesia/browser` como archivos estáticos directamente por Apache.
- Un `.htaccess` (versionado en `public/`, copiado automáticamente por Angular a cada build) redirige cualquier ruta que no sea un archivo real a `index.csr.html`, para que Angular Router resuelva la navegación en el cliente:

  ```apache
  RewriteEngine On
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_URI} !^/api/
  RewriteRule ^ /index.csr.html [L]
  ```

- `ng build` sigue generando `dist/iglesia/server` (incluyendo el `server.ts` con SSR) porque el proyecto lo soporta y no se eliminó el código, pero ese artefacto ya no se despliega — el workflow de CI/CD sube únicamente `dist/iglesia/browser` (ver [ADR-006](adr-006-cicd-ftp.md)).

Nota de estado: `liderazgo/:slug` permanece declarada como `RenderMode.Server` en `app.routes.server.ts`, un residuo de configuración del diseño SSR original. En producción no tiene efecto — al no correr ningún proceso Node para el frontend, esa ruta se resuelve por el mismo fallback de SPA (`index.csr.html`) que el resto de rutas no-prerenderizadas, es decir, en el cliente. No rompe nada, pero es una inconsistencia de configuración pendiente de limpieza (debería declararse como `Client` o `Prerender` para reflejar la realidad del despliegue).

## Consecuencias

- Se simplifica la operación: sin Passenger para el frontend, sin un segundo proceso Node que pueda quedar en un estado inadministrable, deploy más simple (solo archivos estáticos por FTP).
- El contenido prerenderizado queda "congelado" al momento del build hasta el siguiente deploy — aceptable dado el ritmo de cambio de este proyecto (actualizaciones administrativas esporádicas, no contenido que cambie varias veces al día).
- El `.htaccess` correcto debe sobrevivir a futuros despliegues sin intervención manual: por eso se versiona dentro de `public/`, que Angular copia automáticamente a `dist/iglesia/browser` en cada build, en vez de depender de configurarlo manualmente en cPanel después de cada subida.
- El código de SSR (`server.ts`, `deploy/start.cjs`) queda en el repositorio sin desplegarse — es historia útil para este ADR y para quien retome SSR en el futuro, pero representa código muerto en producción que vale la pena tener presente al leer el proyecto.
