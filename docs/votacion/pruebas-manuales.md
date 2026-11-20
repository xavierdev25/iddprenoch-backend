# Pruebas manuales — votación electrónica

Hacerlas en producción después del despliegue, con una asamblea de prueba que se borra al final.
Se necesitan: una PC con el panel, **dos celulares** (uno Android con Chrome y un iPhone con
Safari) y, si es posible, un proyector o una segunda pantalla.

Marcar cada fila: ✅ correcto · ❌ falla (anotar qué se vio).

## A. Preparación (panel, como Responsable del sistema)

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| A1 | Asambleas → + Nueva asamblea, tipo Regional, fecha de hoy. | Abre el panel de la asamblea con estado **Programada** y un código de 6 caracteres. | |
| A2 | Agregar el cargo "Prueba Secretario" y 3 candidatos; a uno subirle una foto tomada con el celular. | Los 3 aparecen; el de foto la muestra; los otros, sus iniciales. | |
| A3 | Ver y cargar el padrón → Importar desde la membresía → una iglesia. | Mensaje "Se agregaron N de M…" y la lista con esas personas. | |
| A4 | Código QR de ingreso → Imprimir. | El QR se imprime y, escaneado, abre `iddprenoch.com/votar/<código>`. | |

## B. Mesa de acreditación

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| B1 | Acreditar elector → DNI de alguien del padrón → Acreditar. | Aparece un código grande de 4 dígitos y el aviso "no se volverá a mostrar". | |
| B2 | Acreditar el mismo DNI otra vez. | Dice que ya está acreditado y ofrece **Generar código nuevo**. | |
| B3 | Un DNI que no está en el padrón. | Ofrece agregarlo; si es congregante, sugiere su nombre. Al agregar, entrega el código. | |
| B4 | La tarjeta "Acreditación" del panel. | "X de Y electores" sube con cada acreditación. | |

## C. Elector (en cada celular)

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| C1 | Escanear el QR. | Pantalla "Ingresa para votar" con el nombre de la asamblea, letra grande. | |
| C2 | DNI correcto y código equivocado. | Mensaje claro de DNI o código incorrectos, sin decir cuál de los dos falló. | |
| C3 | Cinco intentos equivocados con el mismo DNI. | Al quinto: "Superaste los 5 intentos. Acércate a la mesa". | |
| C4 | DNI y código correctos (usar otro elector). | Pantalla "Esperando a la mesa" con el siguiente cargo. | |
| C5 | Recargar la página. | Sigue dentro, sin volver a pedir el código. | |
| C6 | Abrir "Aviso de privacidad (Ley N.º 29733)". | Se despliega el texto del aviso. | |

## D. Votación en vivo

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| D1 | Panel → Abrir votación. | "EN VIVO" en el panel; en **≤ 4 s** los celulares muestran la cédula sin tocar nada. | |
| D2 | Celular: tocar un candidato → Continuar → Sí, confirmar mi voto. | 3 toques; aparece "¡Tu voto fue registrado!" con N.º de constancia **sin el nombre del candidato**. | |
| D3 | Mirar el panel mientras se vota. | "Votos emitidos" sube en **menos de 2 s** tras cada voto. | |
| D4 | Celular: volver atrás e intentar votar otra vez. | No aparece la cédula; si se fuerza, "Ya votaste en esta elección". | |
| D5 | En el celular que votó, revisar todas las pantallas. | En ningún momento se ve un conteo ni un porcentaje. | |
| D6 | Panel → Cerrar votación con un elector a mitad de la confirmación; él confirma después. | El elector ve "La votación de este cargo ya se cerró. Tu voto no se registró". | |

## E. Resultado, proyección y acta

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| E1 | Abrir pantalla de proyección en la segunda pantalla. | Fondo verde, nombre de la asamblea, "Los resultados oficiales aparecerán aquí". | |
| E2 | Panel → Proyectar ganador. | La proyección muestra cargo, foto o iniciales y nombre del ganador **en 1–2 s**, sin votos. | |
| E3 | Provocar un empate (otro cargo, 2 candidatos, un voto a cada uno) y cerrarlo. | El panel dice "Empate entre A y B" y ofrece **Convocar segunda vuelta**. | |
| E4 | Convocar segunda vuelta y abrirla. | Nuevo cargo "· ronda 2" con solo A y B; los celulares muestran la cédula de la segunda vuelta. | |
| E5 | Acta (PDF). | Se descarga: cargos, votos por candidato, ganador o empate, horas y líneas de firma. | |
| E6 | Métricas (CSV), abierto en Excel. | Una fila por elección con horas, segundos y cantidades; **sin nombres ni DNI**; tildes bien. | |
| E7 | Finalizar asamblea. | Estado **Finalizada**; los celulares muestran "La asamblea terminó". | |

## F. Permisos

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| F1 | Con un **Obispo distrital**: Asambleas. | Solo ve asambleas distritales de su distrito; solo puede crear del tipo Distrital. | |
| F2 | Con el Obispo distrital, abrir a mano la URL de la asamblea regional de prueba. | Error de acceso; en Auditoría aparece el intento como DENEGADO. | |
| F3 | Con el **Editor**. | No ve el menú Votación. | |

## G. Limpieza

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| G1 | Como Responsable: Eliminar → escribir el código de la asamblea para confirmar. | Avisa que tiene votos; al confirmar, la asamblea desaparece y queda en Auditoría como ELIMINAR ASAMBLEA (forzado). | |
