# Despliegue de la votación electrónica (Sprints 2–4)

Requisito: el **Sprint 1 desplegado** (roles, alcance y auditoría) y el spike apagado (sin
`SPIKE_TOKEN`). Ver `docs/sql/2026-11-sprint-1-roles-alcance-auditoria.sql`.

Hacerlo **fuera de horario** (de noche o de madrugada): el despliegue reinicia la API y por unos
segundos el panel no responde.

## 1. Base de datos (tú, en cPanel)

1. phpMyAdmin → base de producción → **Exportar → Rápido → SQL**. Guardar el archivo.
2. Abrir `docs/sql/2026-11-sprints-2-4-votacion.sql`.
3. **PASO 0**: debe devolver una fila (`distrito_id`). Si devuelve 0, el Sprint 1 no está aplicado:
   detenerse.
4. **PASO 1** completo, de una sola vez, en la pestaña SQL.
5. **PASO 2** solo si existe la tabla `_prisma_migrations`.
6. **PASO 3**: seis tablas con 0 filas, y `votos` con exactamente `id`, `eleccion_id`,
   `candidato_id`.
7. Avisar **"SQL 2–4 listo"**.

El SQL solo crea tablas nuevas. El código que está hoy en producción las ignora, así que el sitio
sigue funcionando entre este paso y el siguiente.

## 2. Código (lo hago yo, al recibir "SQL 2–4 listo")

1. Integrar `feat/sprint-4-pruebas` (que contiene los Sprints 2, 3 y 4) en `main`, en ambos
   repositorios, con el CI en verde: tsc, pruebas unitarias, pruebas de integración contra MySQL y
   build.
2. El CI despliega solo por FTP y reinicia Passenger (`tmp/restart.txt`).
3. **No hace falta "Run NPM Install"**. La única dependencia nueva de producción del backend,
   `socket.io`, se instaló durante el spike. Las del frontend (`socket.io-client` y
   `qrcode-generator`) van dentro del sitio estático compilado.

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
