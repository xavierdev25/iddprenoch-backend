# ADR-022: Blue-Green Deployment — no implementado

## Contexto

Un solo servidor cPanel compartido, sin capacidad de levantar un entorno paralelo idéntico (un segundo "production" completo) dentro del mismo plan de hosting.

## Decisión

No se implementa despliegue blue-green.

## Consecuencias

El despliegue actual (build → FTP → restart de Passenger, ver [ADR-006](adr-006-cicd-ftp.md)) implica una ventana breve de indisponibilidad durante el reinicio. Blue-green eliminaría esa ventana, pero requeriría duplicar infraestructura que este hosting compartido no soporta sin contratar recursos adicionales.
