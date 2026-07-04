# ADR-006: CI/CD por FTP en vez de SSH/Git deploy

## Contexto

El plan de hosting cPanel contratado (`Personal_DA`) no ofrece acceso SSH — la única vía de transferencia de archivos disponible es FTP, y la única forma de instalar dependencias de producción o ejecutar migraciones en el propio servidor es manualmente desde el panel ("Setup Node.js App" → "Run NPM Install") o, en el caso de las migraciones, desde una máquina externa apuntando a la base de datos de producción.

## Decisión

GitHub Actions (`.github/workflows/ci.yml` en ambos repos) ejecuta build + test en cada push y pull request contra `main`, y en un job separado de deploy (solo en push a `main`):

**Backend:**
1. `npm ci`, `npx prisma generate`, `npm run build`.
2. Se arma una carpeta `deploy-package/` con únicamente `dist/`, `package.json`, `package-lock.json` y `prisma/schema.prisma` + `prisma/migrations` — **nunca** `node_modules` del runner, que se instala directamente en el servidor porque el entorno de build (GitHub Actions, Linux x64 glibc) no necesariamente coincide con el del hosting.
3. Un paso explícito verifica que `node_modules` no viaje por accidente en el paquete (`find deploy-package -iname node_modules` debe fallar la build si encuentra algo).
4. Sube `deploy-package/` por FTP (`SamKirkland/FTP-Deploy-Action`).
5. Como no hay SSH para correr `prisma migrate deploy` en el servidor, cualquier migración nueva debe aplicarse manualmente contra la base de datos de producción antes de mergear a `main` (documentado como comentario explícito en el propio workflow).
6. Un `curl` final toca `tmp/restart.txt` vía FTP para forzar el reinicio de Passenger — el mecanismo estándar de cPanel para Node.js Apps.

**Frontend:**
1. `npm ci`, `npm run build` (genera tanto `dist/iglesia/browser` como `dist/iglesia/server`, aunque solo el primero se despliega — ver [ADR-005](adr-005-frontend-estatico-vs-ssr.md)).
2. Sube únicamente `dist/iglesia/browser/` por FTP.
3. No hay paso de reinicio: al ser archivos estáticos servidos por Apache, no hay ningún proceso que reiniciar.

## Consecuencias

- El pipeline no puede automatizar `npm install` de producción ni migraciones de base de datos — ambos pasos manuales quedan documentados directamente como comentarios en el workflow para que no se olviden en cada release.
- El guardrail que verifica la ausencia de `node_modules` en el paquete de deploy previene un error de despliegue costoso (subir cientos de MB con devDependencies como `vitest`/`fast-check` por FTP) de forma automática, sin depender de que quien revise el PR lo note a simple vista.
- Los binarios nativos de Prisma (`@prisma/client` con su motor de query) se generaron y subieron manualmente una vez para este hosting específico — no se regeneran en cada deploy, lo que exige atención si cambia la versión de Prisma o el `binaryTargets` del schema.
- Cualquier fallo del build o los tests bloquea el job de deploy (`needs: ci`), evitando subir código roto por FTP incluso sin posibilidad de rollback automático en el servidor.
