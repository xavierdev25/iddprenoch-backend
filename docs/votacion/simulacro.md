# Kit del simulacro de votación electrónica

Objetivo: probar la plataforma con personas reales antes de una asamblea oficial, medir los
tiempos (HU17) y recoger la opinión de los participantes con la escala SUS. Fecha límite: antes
del 11 de diciembre.

## 1. Preparación (un día antes)

| Qué | Detalle |
|---|---|
| Participantes | 20–40 personas, **incluyendo adultos mayores** (el público prioritario). Cada uno con su celular y su DNI. |
| Equipo | Administrador (PC y proyector), 1–2 personas en la mesa de acreditación (PC o tablet con el panel), 1 observador que toma tiempos y notas. |
| Conectividad | Wi-Fi del local probado, más datos móviles de respaldo. Anotar el operador de cada celular que falle. |
| Asamblea | "Simulacro Asamblea Regional 2026". Padrón importado con los participantes o cargado en la mesa. |
| Cargos | (1) **Secretario Regional**: 3 candidatos con foto. (2) **Tesorero Regional**: 2 candidatos, con **empate acordado en secreto** con el observador para probar la segunda vuelta. (3) **Vocal**: 2 candidatos. |
| Material | QR impreso en tamaño A4, encuestas SUS impresas (sección 4), lapiceros, este guion. |

Los candidatos son ficticios o voluntarios: es un simulacro, sin efectos reales.

## 2. Guion paso a paso (60–75 minutos)

| Min. | Paso | Quién | Qué observar y anotar |
|---|---|---|---|
| 0 | Bienvenida: qué se va a probar, que es un simulacro y que el voto es secreto. Leer el aviso de privacidad. | Administrador | — |
| 5 | **Acreditación**: cada participante pasa por la mesa con su DNI y recibe su código. | Mesa | Tiempo por persona (cronometrar 5 al azar). DNI no encontrados. |
| 5 | Proyectar el QR. Cada participante ingresa con DNI y código y queda en "Esperando a la mesa". | Participantes | Quiénes necesitan ayuda y en qué paso. Errores de código. |
| 20 | Caso a propósito: un participante escribe mal el código 2 veces y luego bien. | Observador | ¿El mensaje se entendió sin ayuda? |
| 22 | Caso a propósito: alguien "pierde" su código; la mesa genera uno nuevo. | Mesa | ¿Cuánto tarda? ¿El código viejo deja de servir? |
| 25 | **Elección 1 — Secretario Regional**: *Abrir votación*. | Administrador | Segundos hasta que la cédula aparece en todos los celulares. |
| 25 | Todos votan. | Participantes | Toques, dudas, quién pidió ayuda. El panel debe sumar cada voto en menos de 2 s. |
| 30 | *Cerrar votación* → *Proyectar ganador*. | Administrador | Segundos entre cierre y proyección (también queda en el CSV). Reacción de la sala. |
| 33 | **Elección 2 — Tesorero Regional** con el empate acordado. Abrir, votar y cerrar. | Todos | ¿El panel muestra "Empate"? |
| 38 | *Convocar segunda vuelta* → abrir → votar → cerrar → proyectar. | Todos | ¿Entendieron que es una nueva votación del mismo cargo? |
| 45 | **Elección 3 — Vocal**. Caso a propósito: un participante intenta votar después del cierre. | Todos | ¿Se entendió el mensaje "ya se cerró"? |
| 50 | *Acta (PDF)*, *Métricas (CSV)* y *Finalizar asamblea*. | Administrador | ¿El acta se puede firmar tal cual? |
| 52 | **Encuesta SUS** en papel (sección 4), anónima. | Participantes | Tiempo para completarla. |
| 65 | Ronda de comentarios libres. | Todos | Anotar frases textuales. |

## 3. Métricas: cómo exportarlas

1. Al terminar, en el panel de la asamblea: **Métricas (CSV)**. Se descarga
   `metricas-<código>.csv`. Una fila por elección (incluida la segunda vuelta), sin datos
   personales:

   | Columna | Significado |
   |---|---|
   | `abierta_en`, `cerrada_en`, `publicada_en` | Hora de Lima (ISO 8601, `-05:00`). |
   | `segundos_votacion` | Cuánto estuvo abierta la votación. |
   | `segundos_cierre_a_publicacion` | Cuánto tardó el resultado oficial en proyectarse tras el cierre. |
   | `acreditados`, `emisiones`, `votos_contabilizados`, `participacion_pct` | Debe cumplirse `emisiones = votos_contabilizados` en todas las filas. |

2. Abrir el CSV en Excel o LibreOffice y comparar con lo que cronometró el observador.
3. **Acta (PDF)**: se adjunta al informe como evidencia del resultado.
4. Para comparar con la asamblea tradicional: anotar cuánto toma hoy, a mano alzada o con
   papeletas, el conteo y el anuncio de un cargo.

## 4. Encuesta SUS (System Usability Scale) — 10 ítems + 2 de satisfacción

Anónima. Para cada frase, marcar de **1 (Totalmente en desacuerdo)** a **5 (Totalmente de
acuerdo)**. Edad aproximada: ☐ menos de 40 · ☐ 40–59 · ☐ 60 o más.

| # | Afirmación | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 1 | Creo que me gustaría usar este sistema para votar en las asambleas. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | El sistema me pareció innecesariamente complicado. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | El sistema me pareció fácil de usar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | Creo que necesitaría la ayuda de otra persona para poder usar este sistema. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Las distintas partes del sistema (ingreso, cédula, confirmación) estaban bien integradas. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | Encontré demasiadas cosas incoherentes en el sistema. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | Creo que la mayoría de las personas aprendería a usar este sistema muy rápido. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | El sistema me resultó muy engorroso de usar. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | Me sentí muy seguro(a) al usar el sistema. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Necesité aprender muchas cosas antes de poder usar el sistema. | ☐ | ☐ | ☐ | ☐ | ☐ |

**Satisfacción** (misma escala de 1 a 5):

| # | Afirmación | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 11 | Confío en que mi voto fue secreto y se contó correctamente. | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | Prefiero votar de esta forma antes que a mano alzada o con papeleta. | ☐ | ☐ | ☐ | ☐ | ☐ |

Comentario (opcional): ____________________________________________

### Cómo calcular el puntaje SUS

Por cada encuesta:

- **Ítems impares** (1, 3, 5, 7, 9): aporte = respuesta − 1.
- **Ítems pares** (2, 4, 6, 8, 10): aporte = 5 − respuesta.
- **Puntaje SUS** = suma de los 10 aportes × 2,5 (de 0 a 100).

El resultado del simulacro es el **promedio** de todas las encuestas; reportar también la mediana y
el promedio del grupo de 60 años o más. Referencia habitual: **68** es el promedio de la industria;
**más de 80** es una usabilidad muy buena. Los ítems 11 y 12 se reportan aparte, como porcentaje de
respuestas 4 y 5.

Ejemplo: respuestas 4, 2, 5, 1, 4, 2, 5, 1, 4, 2 → impares (3+4+3+4+3) + pares (3+4+3+4+3) = 34 →
34 × 2,5 = **85**.
