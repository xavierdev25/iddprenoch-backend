# ADR-030: Decisiones menores del módulo de votación

Decisiones tomadas durante la implementación (Sprints 2–4) que no ameritan un ADR propio, pero
que conviene poder rastrear.

| # | Decisión | Motivo |
|---|---|---|
| 1 | **Fotos de candidatos públicas y cacheables** (`GET /api/candidatos/:id/foto`, `max-age=3600`, ETag). | Al abrirse una elección, 200 celulares piden las mismas 3–4 fotos en el mismo segundo. Servirlas como imagen (no como base64 dentro de un JSON) deja que cada navegador la pida una sola vez. Las fotos no son reservadas: se proyectan en la asamblea. |
| 2 | **Las fotos se reducen en el navegador** a 480 px de lado (JPEG 0,82) antes de subirlas, y el backend rechaza más de ~1 MB y todo lo que no sea PNG/JPG/WEBP. | Una foto de celular de 3 MB pasa a ~40 KB. Sigue el patrón base64 en `LongText` del resto del repo, sin agregar almacenamiento de archivos. |
| 3 | **QR generado en el navegador** con `qrcode-generator` (MIT, sin dependencias, ~20 KB). | Evita una dependencia más en el backend, cuyo `npm install` en cPanel no se puede depurar (ADR-025). Corrección de errores nivel M: tolera papel arrugado o el reflejo del proyector. |
| 4 | **Código de acceso de 6 caracteres** sin 0/O, 1/I/L ni U/V. | Se dicta y se tipea desde el proyector sin confusiones. Unas 600 millones de combinaciones: no se adivina. |
| 5 | **El código del elector se escribe en un solo campo**, grande y espaciado, en lugar de 4 casillas. | Cuatro casillas con salto automático fallan con el pegado, el autocompletado del SMS y el teclado de algunos Android, justo con el público objetivo. Visualmente se mantiene el aspecto del prototipo. |
| 6 | **Un campo `detalle` opcional en el candidato** ("Distrito Huaura"). | Lo muestra la cédula del prototipo (Figura 16) para distinguir homónimos. |
| 7 | **El padrón se importa desde la membresía**, por defecto solo bautizados, y se puede completar en la mesa. | Es el criterio habitual de las asambleas. En una asamblea distrital solo se importa ese distrito, lo pida quien lo pida. |
| 8 | **Una asamblea con votos no se borra**, salvo que el Responsable del sistema lo fuerce (`?forzar=1`, auditado). | Es un acta. El forzado existe para limpiar la asamblea de la prueba de carga. |
| 9 | **La pestaña oculta del elector no consulta el estado**; al volver a verla, consulta al instante. | Ahorra batería y peticiones al hosting cuando el elector bloquea la pantalla esperando el siguiente cargo. |
| 10 | **La mesa la opera cualquier usuario con permiso `asambleas`** (no se creó un rol "Mesa"). | La matriz aprobada no lo contempla. Para el simulacro basta con crear un Obispo distrital u Obispo regional por cada mesa. |
