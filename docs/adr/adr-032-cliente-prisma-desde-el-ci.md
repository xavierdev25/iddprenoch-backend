# ADR-032: El CI sube el cliente de Prisma generado; cada despliegue necesita Restart manual

## Contexto

El ADR-006 dejó el cliente de Prisma del servidor (`node_modules/.prisma/client`) como algo
"generado y subido a mano una vez". El servidor no tiene la CLI de Prisma (es una devDependency),
así que "Run NPM Install" no lo regenera.

Al desplegar el Sprint 1 (21/11/2026), el código nuevo pidió `usuarios.distrito_id` a ese cliente
viejo, que no conocía la columna. Resultado: el login funcionaba, pero `/auth/me` y toda ruta con
sesión respondían 500, y **el panel quedó inaccesible**.

Además, el toque de `tmp/restart.txt` que hace el CI llega bien (el archivo tiene la hora del
despliegue), pero Passenger en este hosting lo ignora: la app sigue con el código anterior hasta un
Restart desde cPanel.

## Decisión

- El job de despliegue genera el cliente con el `schema.prisma` del commit y **sube solo
  `node_modules/.prisma/client`** por FTP. Excluye el motor del runner (`debian-openssl-3.0.x`) y
  los archivos WASM y edge, que la app no usa en Node (se verificó que las pruebas de integración
  pasan sin ellos).
- La acción de FTP no borra archivos que ella no subió: el motor de consultas que el servidor ya
  tenía se conserva, sea de la plataforma que sea. La versión de Prisma es la misma (6.19.3).
- **Todo despliegue del backend termina con "Restart" en cPanel → Setup Node.js App**. El paso de
  `restart.txt` queda en el CI, pero no se cuenta con él.

## Consecuencias

- Un cambio de esquema ya no requiere regenerar el cliente a mano: llega con el despliegue.
- El primer despliegue con este paso sube unos 20 MB; los siguientes, solo lo que cambió.
- Queda un paso manual (Restart) por despliegue, documentado en `docs/votacion/despliegue.md`.

## Actualización (21/11/2026): la ruta correcta es el entorno virtual

La primera versión subía el cliente a `iglesia-api/node_modules/.prisma/client`, y no surtió
efecto: en CloudLinux la app carga sus dependencias del entorno virtual
`/home/iddpreno/nodevenv/iglesia-api/22/lib/node_modules`. Ahí el cliente era del 30/07, con dos
motores: `debian-openssl-1.1.x` y `rhel-openssl-3.0.x`. El que usa el servidor es
**`rhel-openssl-3.0.x`** (familia RHEL).

Se restableció el panel a mano: se subió el cliente nuevo a esa carpeta, se copió el motor
`rhel-openssl-3.0.x` (misma versión de motor, `c2990dca…`) y se reinició. Desde entonces:

- `binaryTargets` incluye `rhel-openssl-3.0.x`, para que el cliente generado traiga ese motor;
- el CI sube a `${FTP_SERVER_DIR}/../nodevenv/iglesia-api/22/lib/node_modules/.prisma/client/`;
- si se cambia la versión de Node en cPanel, hay que actualizar el `22` de esa ruta.
