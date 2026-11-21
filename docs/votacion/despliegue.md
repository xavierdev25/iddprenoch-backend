# Despliegue de la votación electrónica (Sprints 2–4)

Requisito: el **Sprint 1 desplegado** (roles, alcance y auditoría) y el spike apagado (sin
`SPIKE_TOKEN`). Ver `docs/sql/2026-11-sprint-1-roles-alcance-auditoria.sql`.

Hacerlo **fuera de horario** (de noche o de madrugada): el despliegue reinicia la API y por unos
segundos el panel no responde.

## 1. Base de datos (tú, en cPanel)

Los SQL empiezan con `USE \`iddpreno_main\`;`, no consultan `information_schema` y se pueden
ejecutar más de una vez (ver `docs/sql/diagnostico.sql` para saber en qué estado está la base).
**No hace falta elegir la base en phpMyAdmin**: se pega todo en la pestaña SQL de la portada.

1. phpMyAdmin → base de producción → **Exportar → Rápido → SQL**. Guardar el archivo.
2. Pestaña **SQL** → pegar `docs/sql/diagnostico.sql` → **Continuar**. Comprobar:
   `auditoria` y `distrito_id` existen (Sprint 1 aplicado).
3. Pegar `docs/sql/2026-11-sprints-2-4-votacion.sql` completo → **Continuar**. Debe terminar sin
   errores (las "advertencias" son normales si algo ya existía).
4. Revisar los resultados del final: seis tablas nuevas, y `votos` con exactamente `id`,
   `eleccion_id`, `candidato_id`.
5. Avisar **"SQL 2–4 listo"**.

El SQL solo crea tablas nuevas. El código que está hoy en producción las ignora, así que el sitio
sigue funcionando entre este paso y el siguiente. El PASO 2 (registro en `_prisma_migrations`)
ya viene activo y no se duplica.

Por qué falló la primera vez (#1044 sobre `information_schema`): phpMyAdmin, al ejecutar una
consulta que nombra otra base (`information_schema.COLUMNS`), cambia la base activa para las
sentencias siguientes, y el `CREATE TABLE` quedó apuntando a `information_schema`. Reproducido en
local con phpMyAdmin 5.2.3, MariaDB 10.11 y un usuario con permisos solo sobre `iddpreno_main`.

Los SQL se validaron el 21/11/2026 sobre el backup real cargado en **MariaDB 10.11**, pegados en
phpMyAdmin sin elegir base: sin errores, repetibles, y con un esquema idéntico (`SHOW CREATE
TABLE` de las 22 tablas) al de las migraciones de Prisma.

## 2. Código (lo hago yo, al recibir "SQL 2–4 listo")

1. Integrar `feat/sprint-4-pruebas` (que contiene los Sprints 2, 3 y 4) en `main`, en ambos
   repositorios, con el CI en verde: tsc, pruebas unitarias, pruebas de integración contra MariaDB 10.11 y
   build.
2. El CI despliega solo por FTP y reinicia Passenger (`tmp/restart.txt`).
3. **No hace falta "Run NPM Install"**. La única dependencia nueva de producción del backend,
   `socket.io`, se instaló durante el spike. Las del frontend (`socket.io-client` y
   `qrcode-generator`) van dentro del sitio estático compilado.

## 2b. Reiniciar (tú, siempre)

**cPanel → Setup Node.js App → Restart** después de cada despliegue del backend: Passenger ignora el
`tmp/restart.txt` que toca el CI (ADR-032). El cliente de Prisma ya llega generado por el CI; no
hace falta "Run NPM Install" salvo que cambien las dependencias.

## 3. Verificación inmediata (5 minutos)

| Comprobación | Esperado |
|---|---|
| `https://iddprenoch.com/` | El sitio público carga igual que antes. |
| `https://iddprenoch.com/api/proyeccion/AAAAAA` | `404` con `{"error":{"code":404,…}}`. La ruta existe y responde. |
| `https://iddprenoch.com/api/socket.io/?EIO=4&transport=polling` | `200`, con un texto que empieza por `0{"sid":` (Socket.IO activo). |
| Panel → menú **Votación → Asambleas** | La lista vacía y el botón "+ Nueva asamblea". |
| Crear una asamblea de prueba, abrir **Código QR de ingreso** | El QR apunta a `https://iddprenoch.com/votar/XXXXXX`. |

Después, la lista completa de `docs/votacion/pruebas-manuales.md`.

## 4. Prueba de carga real (de madrugada, después del despliegue)

1. Crear una cuenta **Responsable del sistema** solo para la prueba (p. ej. `carga.prueba`).
   La prueba crea una asamblea "PRUEBA DE CARGA", acredita 200 electores sintéticos (DNI
   99000000–99000199) y la borra al terminar.
2. Pasarme usuario y contraseña. Corro:
   ```
   LOADTEST_USUARIO=… LOADTEST_PASSWORD=… node loadtest/votacion-carga.mjs --url https://iddprenoch.com
   ```
3. Mismas reglas de parada del spike: ante el primer 429, 5xx, timeout o conexión rechazada, deja
   de enviar carga, cierra la votación y limpia.
4. Desactivar la cuenta `carga.prueba` al terminar.

## Reversión

- **Código:** revertir el merge en ambos repositorios. El código anterior ignora las tablas nuevas.
- **Base:** no hace falta tocarla. La reversión del esquema está comentada al final del SQL y
  **borra los datos de votación**; usarla solo si no hubo ninguna asamblea real.
