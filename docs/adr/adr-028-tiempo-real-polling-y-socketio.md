# ADR-028: Tiempo real de la votación — polling corto para electores, Socket.IO solo para el panel y la proyección

## Contexto

El módulo de votación para asambleas presenciales necesita tres canales en vivo:

- **Electores** (hasta 200 celulares a la vez): saber cuándo se abre y se cierra cada elección.
- **Panel del administrador**: el conteo, que debe reflejar cada voto en menos de 2 s.
- **Proyección** (la pantalla de la asamblea): el ganador proclamado.

El diseño inicial era Socket.IO para los tres, en el mismo proceso de Express. El hosting es un cPanel
compartido sobre **CloudLinux**, cuyo límite de **Entry Processes (EP) es 20**: como máximo 20
peticiones atendidas a la vez por la cuenta, y por encima de eso Apache responde **508 Resource Limit
Is Reached**. Una conexión WebSocket, o un long polling de Socket.IO, ocupa su petición durante toda
la sesión, así que 200 electores conectados superarían el límite diez veces antes de emitir un solo
voto.

## Decisión

**Electores: sin Socket.IO.** Consultan `GET /api/votacion/:codigo/estado` cada **3 s con una
variación aleatoria de ±1 s**, para que 200 teléfonos no consulten en el mismo instante. La petición
es corta y no queda abierta:

- respuesta mínima: `{ estado, eleccionId, version, yaVoto }`;
- se sirve **desde memoria**, sin tocar la base de datos;
- lleva `ETag` = versión del estado, y responde **304 sin cuerpo** si nada cambió;
- objetivo: **< 50 ms** por petición dentro de Node.

Con 200 electores a ~1 consulta cada 3 s salen ~67 peticiones/s de pocos milisegundos cada una. Por
la ley de Little, la concurrencia media es de ~67 × 0,005 s ≈ 0,3 peticiones simultáneas, muy por
debajo de 20 EP. Una apertura de elección llega al elector en ≤ 4 s, suficiente para una asamblea
presencial.

**Panel del administrador y proyección: Socket.IO**, con respaldo automático a long polling si el
WebSocket no atraviesa Apache/Passenger. Son 2 o 3 conexiones como máximo, que sí caben en el
límite y dan la latencia < 2 s que pide el conteo en vivo. El conteo nunca viaja a los electores ni a
la proyección.

**Un solo proceso.** El estado en memoria y el long polling de Socket.IO (que sin "sticky sessions"
no tolera varios procesos) exigen que Passenger use un único proceso de Node. Si el spike encuentra
más de un pid, se evaluará `PassengerStickySessions on` o mover el estado a MySQL con caché corta.

## Spike de verificación

Antes de construir el módulo, un spike en producción (`src/spike/`, apagado salvo que `SPIKE_TOKEN`
esté definido) mide:

- **(a)** si el WebSocket atraviesa Apache/Passenger: página `/api/spike/socket?t=TOKEN` y
  `loadtest/spike-sockets.mjs`;
- **(b)** el pid de cada respuesta (cabecera `X-Spike-Pid`), para detectar más de un proceso;
- **(c)** cuántos 503/508 aparecen con 200 electores consultando cada 3 s:
  `loadtest/spike-electores.mjs`, de madrugada, con carga escalonada (25 → 50 → 100 → 150 → 200,
  60 s por escalón) y **parada inmediata ante el primer error de cualquier tipo** (429, 403, 5xx,
  timeout, conexión rechazada): una IP bloqueada por el firewall del hosting dejaría sin acceso al
  propio administrador. Los errores se reportan separados por origen: `limiteApp` (429 de nuestro
  rate limiter), `limiteHosting` (503/508) y `conexion` (timeouts y rechazos, típicos de un firewall).

Las rutas del spike no pasan por ningún rate limiter de la API (el único es el de
`POST /api/auth/login`), así que un 429 en la corrida vendría del hosting, no de la aplicación.

El script corre desde un solo equipo y reutiliza conexiones (keep-alive). El límite de EP cuenta
peticiones concurrentes en el servidor, no clientes ni IPs, así que la medición es representativa de
la carga real; lo que no reproduce es la latencia de la red móvil del local.

### Resultados

Verificación previa, 12/11/2026 23:30 (una sola conexión, sin carga):

- **(a) WebSocket NO pasa.** El handshake llega a Node, que responde `101 Switching Protocols`,
  pero Apache entrega esa respuesta **sin la cabecera `Connection: Upgrade` y con
  `Transfer-Encoding: chunked`**. Ningún cliente acepta un upgrade así ("Unexpected server
  response: 101"), y Socket.IO se queda en long polling. Es configuración del servidor, no se corrige
  desde la aplicación. Sobre long polling la conexión funciona: ping de ida y vuelta de 650–750 ms
  desde Lima.
- **(b) Un solo proceso** (`pid` 2931933 en todas las respuestas). `PASSENGER_BASE_URI=/api`.
- **IP del cliente:** Passenger entrega todas las requests desde `127.0.0.1`; la IP real llega en
  `X-Forwarded-For`. Sin `trust proxy`, el rate limiter del login era uno solo para toda la región
  y la auditoría registraba 127.0.0.1. Corregido con `app.set('trust proxy', 'loopback')`.

Corrida de carga (c), 13/11/2026 00:01–00:08 (adelantada desde las 03:00), desde un solo equipo
en Lima. Detalle en `loadtest/resultados/spike-electores-2026-11-13T05-02-05-852Z.json`.

| Electores | Peticiones/s | 200 / 304 | Errores | p50 / p95 / p99 (ms) | Node p95 (ms) |
|---|---|---|---|---|---|
| 25 | 7,7 | 63 / 400 | 0 | 229 / 343 / 707 | 0,09 |
| 50 | 15,4 | 150 / 776 | 0 | 227 / 628 / 764 | 0,07 |
| 100 | 31,2 | 300 / 1572 | 0 | 224 / 291 / 674 | 0,06 |
| 150 | 46,2 | 450 / 2321 | 0 | 223 / 297 / 693 | 0,07 |
| 200 | 62,1 | 600 / 3125 | 0 | 221 / 292 / 690 | 0,05 |

Socket.IO con 3 clientes (panel + proyección): los 3 en long polling; 60/60 difusiones recibidas,
latencia servidor → cliente p50 976 ms, p95 1189 ms (dentro del objetivo de < 2 s). El sitio y la
API respondieron 200 antes, entre pruebas y después.

El tiempo de respuesta lo domina la red (~220 ms de ida y vuelta Lima → hosting) y no la carga: la
mediana no cambia de 25 a 200 electores, y dentro de Node cada consulta tarda < 0,5 ms.

| Medición | Resultado |
|---|---|
| (a) ¿WebSocket pasa por Apache/Passenger? | No: 101 sin `Connection: Upgrade`; Socket.IO en long polling |
| (b) pids distintos observados | 1 |
| (c) Electores sostenidos sin errores | 200 (el máximo probado), 60 s, 3725 peticiones |
| Errores por tipo (429 / 503-508 / conexión / otros) | 0 / 0 / 0 / 0 |
| Tiempo de respuesta p50 / p95 / p99 (cliente) | 221 / 292 / 690 ms con 200 electores |
| Tiempo dentro de Node p95 | 0,05 ms (objetivo < 50 ms) |
| Difusión Socket.IO (long polling) p50 / p95 | 976 / 1189 ms |

## Consecuencias

- **Panel y proyección van por long polling**, no por WebSocket (resultado (a)). Para el Sprint 3:
  configurar el cliente con `transports: ['polling']` para que no intente un upgrade que siempre
  falla, y contar que cada pestaña abierta del panel o de la proyección mantiene **una petición
  colgada todo el tiempo**, es decir un Entry Process ocupado de los 20.
- **Sprint 2 — límite de peticiones por sesión de elector, no por IP.** En la asamblea, todos los
  celulares pueden salir a internet por el mismo Wi-Fi del local, es decir por una sola IP pública
  (igual que la corrida del spike, que sale de un solo equipo). Un rate limit por IP en
  `GET /api/votacion/:codigo/estado` o en `POST /votar` bloquearía a la asamblea entera. Esos
  endpoints deben limitar por sesión de elector (la cookie de elector). Solo el ingreso con DNI +
  código, que ocurre antes de tener sesión, puede limitar por DNI + IP, con un tope holgado.
- Los electores no necesitan cliente de Socket.IO: la vista `/votar/:codigo` queda más liviana y
  funciona igual en redes móviles inestables, porque cada consulta es independiente.
- Cuando el servidor tiene un cambio, el elector lo ve en hasta 4 s y no al instante. Es aceptable:
  la mesa anuncia en voz alta la apertura de cada elección.
- Un reinicio de Passenger pierde el estado en memoria. El módulo de votación debe reconstruirlo
  desde MySQL al arrancar (las elecciones ABIERTAS siguen en la base).
- Agregar `socket.io` obliga a ejecutar "Run NPM Install" en cPanel tras el despliegue (ADR-006).

## Prueba de carga real (HU16), 21/11/2026 18:35, producción

`loadtest/votacion-carga.mjs`: 200 electores sintéticos ingresan escalonados en 30 s, consultan el
estado cada 3 s ± 1 s y **votan todos dentro del mismo minuto**. Las reglas de parada son las del
spike: se detiene ante el primer error. Corrió desde un solo equipo en Lima (misma IP para todos,
como un Wi-Fi de local) y dejó el reporte en
`loadtest/resultados/votacion-carga-2026-11-21T23-35-42-066Z.json`.

| Resultado | Valor |
|---|---|
| Votos aceptados | **200 de 200** |
| Errores (429 / 503-508 / conexión / otros) | 0 / 0 / 0 / 0 |
| Verificación en el servidor | emisiones = votos contados = votos aceptados = 200, y cuadra por candidato |
| Detenido por las reglas de parada | No |

| Operación | Peticiones | p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) |
|---|---|---|---|---|---|
| `elector.ingresar` | 200 | 290 | 452 | 743 | 995 |
| `elector.estado` | 4254 | 225 | 298 | 669 | 793 |
| `elector.cedula` | 200 | 224 | 291 | 654 | 685 |
| `elector.votar` | 200 | 245 | 338 | 702 | 817 |
| `admin.acreditar` | 200 | 299 | 455 | 785 | 790 |

Los tiempos incluyen ~220 ms de red Lima → hosting (ver la corrida del spike). En el recorrido
completo del mismo día, el panel mostró un voto a los **567 ms** del toque de confirmación (objetivo:
< 2 s) y la proyección mostró al ganador a los **300 ms** de publicarlo.
