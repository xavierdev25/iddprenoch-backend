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
  60 s por escalón) y **parada automática al primer 508** o con más del 5 % de respuestas 5xx.

El script corre desde un solo equipo y reutiliza conexiones (keep-alive). El límite de EP cuenta
peticiones concurrentes en el servidor, no clientes ni IPs, así que la medición es representativa de
la carga real; lo que no reproduce es la latencia de la red móvil del local.

### Resultados

_Pendiente: se completa tras la corrida en producción._

| Medición | Resultado |
|---|---|
| (a) ¿WebSocket pasa por Apache/Passenger? | |
| (b) pids distintos observados | |
| (c) 503/508 con 200 electores | |
| p95 cliente / p95 dentro de Node | |

## Consecuencias

- Los electores no necesitan cliente de Socket.IO: la vista `/votar/:codigo` queda más liviana y
  funciona igual en redes móviles inestables, porque cada consulta es independiente.
- Cuando el servidor tiene un cambio, el elector lo ve en hasta 4 s y no al instante. Es aceptable:
  la mesa anuncia en voz alta la apertura de cada elección.
- Un reinicio de Passenger pierde el estado en memoria. El módulo de votación debe reconstruirlo
  desde MySQL al arrancar (las elecciones ABIERTAS siguen en la base).
- Agregar `socket.io` obliga a ejecutar "Run NPM Install" en cPanel tras el despliegue (ADR-006).
