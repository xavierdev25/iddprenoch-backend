# ADR-027: Registro de auditoría con retención de 12 meses

## Contexto

Con el control de acceso por distrito (ADR-026) hace falta poder responder *quién* accedió o intentó
acceder a qué: los datos de membresía son personales y sensibles (Ley 29733, de Protección de Datos
Personales), y un acceso denegado repetido es la señal de un uso indebido. El ADR-009 descartó el
event sourcing porque "no hay requisito de auditoría histórica completa"; este ADR no lo contradice
—no se reconstruye estado a partir de eventos—, pero sí agrega un registro de seguridad acotado.

Restricciones: hosting compartido sin SSH ni cron, un solo proceso Node (Passenger) que se apaga
cuando no hay tráfico, y la propia auditoría guarda datos personales (IP, nombre de usuario).

## Decisión

Tabla `auditoria` (`usuario_id`, `usuario_nombre`, `accion`, `recurso`, `resultado`
PERMITIDO/DENEGADO, `detalle`, `ip`, `fecha`), escrita por `src/utils/auditoria.ts`. Se registran:

- **Inicios de sesión**, exitosos y fallidos. El fallido guarda el nombre con que se intentó (sin
  él, un ataque de fuerza bruta no se distingue de un olvido); la contraseña, nunca.
- **Cambios de membresía**: alta, edición (qué campos, no sus valores) y baja de congregantes.
- **Cambios de usuarios y roles**: quién creó, editó o borró qué cuenta, con el antes y el después
  de rol, distrito y estado (p. ej. `rol: Editor → Obispo distrital; distrito: ninguno → Huaral`).
- **Accesos denegados**: todo 403 por falta de permiso o por estar fuera del distrito.

Qué **no** se guarda: valores de datos personales del congregante, ni el query string de la URL
(puede traer una búsqueda por DNI). `usuario_id` es `ON DELETE SET NULL` para que borrar una cuenta
no borre el rastro de lo que hizo; `usuario_nombre` conserva quién era.

La escritura **nunca hace fallar la operación**: si la auditoría no se puede guardar, se registra en
el log de Passenger y la respuesta sigue su curso (un 403 sigue siendo 403).

Solo el Responsable del sistema la consulta (`GET /api/auditoria`, permiso `auditoria`), con
filtros por resultado, acción, usuario y rango de fechas. No hay endpoints de escritura ni de borrado.

**Retención: 12 meses.** La Ley 29733 exige no conservar datos personales más tiempo del necesario
para su finalidad; un año cubre la revisión de incidentes y el ciclo anual de asambleas. La limpieza
corre **dentro de la app** (`iniciarLimpiezaAuditoria`): al arrancar el proceso y luego cada 24 h,
borra los registros con `fecha` anterior a hoy menos 12 meses. Correr también al arrancar compensa
que Passenger apague el proceso por inactividad, lo que podría impedir que un intervalo de 24 h se
cumpla nunca.

## Consecuencias

- Sin cron, la limpieza depende de que la app reciba tráfico. En el peor caso (semanas sin ninguna
  visita) un registro puede sobrevivir unos días más de 12 meses; se borra en el primer arranque
  posterior.
- Cada operación auditada agrega un `INSERT` en la misma request. A esta escala es despreciable.
- El índice por `fecha` mantiene barata la limpieza diaria y el listado ordenado por fecha.
- La IP registrada depende de cómo Passenger entrega la conexión; el spike de tiempo real (ADR-028)
  verifica qué IP llega realmente detrás de Apache.
