# ADR-029: Votación electrónica — modelo de datos, voto secreto y sesión del elector

## Contexto

Las asambleas presenciales de la región eligen cargos (Secretario Regional, Tesorero, Vocal…) a
mano alzada o con papeletas. El diseño aprobado en el informe de prácticas pide votar desde el
celular del propio elector, con voto secreto, un solo voto por elector y por elección, y
resultados en vivo solo para la mesa. Los electores son en su mayoría adultos mayores, y el
hosting tiene un límite de 20 Entry Processes (ADR-028).

## Decisión

### Modelo

`Asamblea` (código de acceso único para el QR) → `Eleccion` (un cargo, una ronda) → `Candidato`.
`Elector` es el **padrón** de la asamblea (`@@unique([asambleaId, dni])`): se carga antes
(importándolo desde la membresía o uno por uno) y la mesa **acredita** a cada persona que llega. El
prototipo aprobado (Figura 17) muestra "52 de 58 electores", es decir, acreditados sobre un padrón.

El voto se reparte en dos tablas que no se pueden unir:

- `Emision` (elección, elector, hora): **que** votó. `@@unique([eleccionId, electorId])`.
- `Voto` (UUID, elección, candidato): **por quién**. Sin fecha, sin elector y con clave primaria
  UUID aleatoria, así que ni una columna ni el orden de inserción permiten asociarlo a una emisión.

Emitir es una transacción `Emision + Voto`. El UNIQUE de `emisiones` es la única defensa contra el
doble voto: dos pedidos simultáneos chocan ahí, el segundo recibe P2002 y responde "ya votaste".
La elección se lee con `SELECT … FOR SHARE` dentro de la transacción. Así, un voto en curso y el
cierre (un UPDATE de esa fila) no se cruzan, y el conteo al cierre es exacto.

El cargo de la elección es texto libre: no reutiliza el modelo `Cargo` de los pastores.

### Elector

- **Acreditación:** la mesa genera un código de 4 dígitos (`crypto.randomInt`). Solo se guarda su
  bcrypt y se muestra en claro una sola vez. Si el elector lo pierde, se genera otro (auditado), y
  las sesiones abiertas con el anterior dejan de servir: el token lleva la hora de acreditación.
- **bcrypt con costo 8** para el código, no 12. Con 10 000 combinaciones ningún costo resiste un
  ataque offline, así que la protección real es el límite de **5 intentos por DNI**. Con costo 12,
  bcryptjs tarda ~300 ms por verificación y 200 ingresos simultáneos bloquearían el único proceso
  cerca de un minuto. Las contraseñas del panel siguen con 12.
- **Sesión separada** de la del panel:
  - otra cookie (`elector_token`, httpOnly, limitada a la ruta `/api/votacion`, 8 h);
  - otra clave de firma, derivada de `JWT_SECRET`.

  Un token no sirve en el lugar del otro, y el contrato del JWT del panel no cambia (ADR-026).
- **Límites por sesión o por DNI, nunca por IP sola** (ADR-028):
  - 5 fallos por DNI y asamblea cada 15 min;
  - 90 consultas de estado por minuto y por sesión;
  - 10 intentos de voto por minuto y por sesión;
  - un tope holgado de 600 ingresos por IP cada 15 min, que corta un barrido masivo de DNIs sin
    afectar a 200 personas en el mismo Wi-Fi.
- El mismo mensaje para "DNI no está en el padrón" y "código errado", y el mismo tiempo de respuesta
  (bcrypt contra un hash señuelo): no se puede averiguar quién está en el padrón.

### Qué ve el elector

Solo `{ estado, eleccionId, version, yaVoto }` (polling con ETag, ADR-028), la cédula de la
elección abierta y su constancia. **Nunca** un conteo. La constancia dice que votó, para qué cargo
y a qué hora, **no por quién**: mostrar el candidato facilitaría la compra o la coacción del voto
("enséñame la pantalla").

### Ganador

Mayoría simple: gana quien tiene más votos. Si dos o más empatan en el primer lugar, no hay ganador
y la mesa convoca una segunda vuelta solo con los empatados (Sprint 3). No hay voto en blanco: la
cédula del diseño aprobado no lo contempla.

## Consecuencias

- Las pruebas de integración cubren: doble voto simultáneo (8 pedidos, cuenta 1), voto con la
  elección cerrada, elector no acreditado, bloqueo tras 5 intentos, código regenerado y sesiones
  cruzadas entre elector y panel.
- Que `votos` no tenga ni fecha ni elector es una propiedad del esquema, y una prueba la verifica
  leyendo `information_schema`.
- Límite conocido: el log binario de MySQL, si el hosting lo tuviera activo, registra el orden de
  las transacciones. El secreto del voto frente al administrador del servidor de base de datos no
  está garantizado; frente a cualquier usuario de la aplicación, sí.
- Los límites y el estado viven en memoria del único proceso de Passenger. Un reinicio en plena
  asamblea los reconstruye desde MySQL (estado) o los reinicia (contadores de intentos).
