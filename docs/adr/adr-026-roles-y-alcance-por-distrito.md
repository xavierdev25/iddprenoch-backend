# ADR-026: Control de acceso por rol y alcance por distrito

## Contexto

Hasta ahora `requireAuth` solo comprobaba que el JWT fuera válido: cualquier usuario con sesión podía
leer y modificar todo, incluida la membresía (DNI, teléfono, fecha de nacimiento de menores) y las
cuentas de usuario. Los roles del seed (`Administrador Regional`, `Secretario Regional`, `Tesorero
Regional`, `Editor`) no tenían ningún efecto en el código.

La región se organiza en distritos, y cada distrito tiene un obispo que debe gestionar la membresía de
sus iglesias sin ver la de los demás. El diseño aprobado en el informe de prácticas define tres roles
y esta matriz:

| Función | Responsable del sistema | Obispo regional | Obispo distrital |
|---|---|---|---|
| Usuarios y roles | Sí | No | No |
| Membresía y reportes | Región | Región | Su distrito |
| Asambleas y conteo en vivo | Sí | Sí | Solo las de su distrito |
| Auditoría | Sí | No | No |

Además: distritos, ministerios y cargos los gestionan solo el Responsable y el Obispo regional;
eventos y comunicados, el Responsable, el Obispo regional y el **Editor**. Este último se conserva
porque en producción tiene un usuario que publica contenido, y queda sin acceso a la membresía.

## Decisión

**Roles.** La migración `20261113000000_roles_alcance_auditoria` renombra `Administrador Regional` a
`Responsable del sistema` conservando su id (el único usuario que lo tenía conserva el acceso total) y
crea `Obispo regional` y `Obispo distrital`. `Secretario Regional` y `Tesorero Regional` no se borran
(no se destruyen datos), pero quedan sin permisos y `GET /api/roles` deja de ofrecerlos en el selector.

**Matriz en código.** `src/utils/permisos.ts` asigna a cada rol, **por nombre**, una lista de
permisos (`usuarios`, `auditoria`, `membresia`, `iglesias`, `organizacion`, `contenido`,
`asambleas`). Se usa el nombre y no el id porque los ids difieren entre desarrollo, CI y producción,
y la tabla `roles` no se edita desde el panel. Un rol ausente de la matriz no tiene ningún permiso:
denegar por defecto.

**El JWT no cambia.** Sigue llevando `{ id, nombre, rolId }`. `requireAuth` resuelve en cada request
rol, distrito y estado desde la base (una consulta por índice primario). Así, desactivar a un usuario
o cambiarle el rol o el distrito rige en la request siguiente, sin esperar a que venza el token
(2 h). `GET /auth/me` y `POST /auth/login` **agregan** `rol` y `distritoId` a su respuesta para
que el panel muestre solo lo que corresponde; los campos existentes no cambian.

**Distrito del usuario.** `usuarios.distrito_id` (nullable, FK `ON DELETE RESTRICT`): obligatorio
para el Obispo distrital y siempre `null` para los roles regionales (`usuarios.service` lo
normaliza). Restrict y no SetNull: borrar el distrito dejaría a su obispo sin alcance definido.

**Alcance.** El obispo distrital queda acotado a `iglesia.distritoId = user.distritoId`:

- *Listados* (congregantes, reportes, iglesias y pastores del panel, líderes): se agrega la
  condición al `where`. En congregantes y reportes el distrito se fuerza **sobre los filtros** que
  ambos comparten (`congregantes.filters.ts`), así el Excel/PDF imprime "Distrito = X" en la
  cabecera y la lista en pantalla y el archivo siguen devolviendo el mismo conjunto.
- *Detalle, edición y baja*: se lee el distrito del registro existente.
- *Alta y edición*: se valida el distrito de la iglesia destino; mudar un congregante a otra
  iglesia exige que **ambas** estén en su distrito.
- Pedir explícitamente otro distrito, o una iglesia de otro distrito, responde **403** y queda en la
  auditoría (ADR-027), en vez de devolver una lista vacía silenciosa.
- Un obispo distrital sin distrito asignado recibe 403: nunca se interpreta como alcance regional.

Todo esto vive en `buildCrudController` (opción `alcance: 'iglesia' | 'distrito'`), de modo que cada
módulo lo declara en una línea y no puede olvidar uno de los cinco handlers.

**GET públicos.** `GET /api/iglesias` y `GET /api/pastores` siguen públicos y **sin filtrar**: los
usa el sitio. La vista del panel se pide con `?ambito=panel`, que exige sesión y permiso y aplica
el alcance. Sin ese parámetro la request no lee la cookie, así que un obispo distrital con sesión
abierta ve el sitio público completo. El GET público de pastores deja de devolver `celular`, que es
un dato personal; el panel lo sigue recibiendo.

## Consecuencias

- Cada request autenticada hace una consulta más (usuario + rol + estado por clave primaria): costo
  despreciable a esta escala, a cambio de revocar accesos al instante.
- La matriz está duplicada en el frontend (`core/utils/permisos.util.ts`) **solo para mostrar u
  ocultar menús**. No protege nada: si divergen, lo peor que pasa es que el panel muestre un botón
  cuya llamada la API rechaza con 403.
- El despliegue tiene un orden obligatorio: primero el SQL de la migración en producción y después
  el código. El código nuevo lee `usuarios.distrito_id`; sin la columna, toda request autenticada
  fallaría con 500.
- Las pruebas de integración (`src/__integration__/alcance.int.test.ts`) recorren la matriz de punta
  a punta contra MySQL real, y corren en el CI.
