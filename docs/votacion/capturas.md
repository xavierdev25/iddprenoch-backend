# Capturas para el informe

Todas con **datos ficticios**. Hay dos fuentes:

- **Votación** (capturas 7–24): en producción, con la *Asamblea de demostración*: nombres y DNI
  inventados, creada y borrada con `scripts/demo-asamblea.mjs`.
- **Membresía, usuarios y auditoría** (capturas 1–6): en producción muestran **personas reales**
  (congregantes, IPs, cuentas). Se toman en el entorno local, cuyo seed es ficticio, o se pixelan
  las columnas indicadas.

Resolución sugerida: panel a 1440 × 900 (ventana del navegador); celular con un teléfono real, o
Chrome → DevTools → *Toggle device toolbar* → **iPhone 13** o **Pixel 7**; proyección a pantalla
completa (F11) en 1920 × 1080.

## 1. Preparar la Asamblea de demostración (producción)

Desde el repo backend, con la cuenta `carga.prueba` (Responsable del sistema):

```bash
export DEMO_USUARIO=carga.prueba DEMO_PASSWORD='…'
node scripts/demo-asamblea.mjs crear --url https://iddprenoch.com
```

Crea "Asamblea de demostración" (regional) con:

- 3 cargos: Secretario Regional (3 candidatos), Tesorero Regional (2) y Vocal Regional (2), con los
  nombres del prototipo aprobado;
- 24 electores ficticios (DNI **98000001–98000024**), 20 de ellos acreditados.

Imprime el código de acceso, las tres URL (panel, elector, proyección) y **DNI y código de los
electores 98000001, 98000002 y 98000003**, reservados para las capturas del celular. Los códigos
quedan en `scripts/.demo-codigos.json`, que git ignora.

Para que el panel en vivo tenga números (captura 17), con Secretario Regional abierto:

```bash
node scripts/demo-asamblea.mjs votos --url https://iddprenoch.com
```

Emite 14 votos con los electores 98000004–98000017. No usa los tres reservados.

**Para borrarla al terminar** (también se puede desde el panel: *Eliminar* → escribir el código):

```bash
node scripts/demo-asamblea.mjs borrar --url https://iddprenoch.com
```

Borra la asamblea con su padrón, sus votos y el archivo local de códigos. Queda registrado en la
auditoría como ELIMINAR ASAMBLEA (forzado).

## 2. Lista de capturas, en el orden de una sola pasada

`:id` es el número de la asamblea y `:codigo` su código de acceso; los imprime `crear`.

| # | Pantalla | Ruta | Usuario / dispositivo | Estado necesario | Figura |
|---|---|---|---|---|---|
| 1 | Usuarios y roles (listado con Alcance) | `/admin/usuarios` | Responsable · local | Seed local | 19 |
| 2 | Nuevo usuario: Obispo distrital + distrito + aviso | `/admin/usuarios/nuevo` | Responsable | Elegir *Obispo distrital* y *Huaral*, sin guardar | 19 |
| 3 | Membresía del distrito (aviso, filtros, DNI enmascarado) | `/admin/congregantes` | `obispo.huaral` · **local** | Seed local (en producción saldrían congregantes reales) | 20 |
| 4 | Menú reducido y pie "Obispo distrital · Huaral" | `/admin/dashboard` | `obispo.prueba` (producción) | — | 20 |
| 5 | Reportes del distrito (sin selector de distrito) | `/admin/reportes` | `obispo.prueba` | Solo totales e iglesias: sin datos personales | 20 |
| 6 | Auditoría: accesos denegados | `/admin/auditoria` → Resultado = Denegado | Responsable · local | Antes, con el obispo distrital, abrir `/admin/usuarios`. **Pixelar la columna IP** si es producción | — |
| 7 | Lista de asambleas | `/admin/asambleas` | `carga.prueba` | Tras `crear` | — |
| 8 | Panel de la asamblea, preparación (cargos y candidatos) | `/admin/asambleas/:id` | `carga.prueba` | Secretario Regional seleccionado, *Pendiente* | 17 |
| 9 | Código QR de ingreso | `/admin/asambleas/:id` → *Código QR de ingreso* | `carga.prueba` | — | — |
| 10 | Padrón | `/admin/asambleas/:id/padron` | `carga.prueba` | 20 acreditados, 4 pendientes | — |
| 11 | Mesa: buscar DNI | `/admin/asambleas/:id` → *Acreditar elector* | `carga.prueba` | DNI **98000021** → *Buscar* | — |
| 12 | Mesa: código entregado una sola vez | (misma) | `carga.prueba` | *Acreditar y generar código* | — |
| 13 | Elector: ingreso (DNI + código + aviso de privacidad) | `/votar/:codigo` | Celular · DNI 98000001 | Abrir el aviso de privacidad | 16-1 |
| 14 | Elector: espera ("Esperando a la mesa", siguiente cargo) | (misma) | Celular | Tras ingresar, con ningún cargo abierto | 16-4 |
| 15 | Elector: cédula con candidato elegido | (misma) | Celular | Panel: *Abrir votación* de Secretario Regional; tocar un candidato | 16-2 |
| 16 | Elector: confirmación | (misma) | Celular | *Continuar* | 16-3 |
| 17 | Panel EN VIVO (conteo, participación, barras) | `/admin/asambleas/:id` | `carga.prueba` | Correr `votos`; el celular de 98000001 aún sin confirmar | 17 |
| 18 | Elector: constancia | `/votar/:codigo` | Celular | *Sí, confirmar mi voto* | 16-4 |
| 19 | Panel: votación cerrada con ganador | `/admin/asambleas/:id` | `carga.prueba` | *Cerrar votación* | 17 |
| 20 | Proyección del ganador | `/proyeccion/:codigo` | Proyector / F11 | Abrirla antes; luego *Proyectar ganador* | 18 |
| 21 | Panel: empate | `/admin/asambleas/:id` | `carga.prueba` | Abrir Tesorero Regional; 98000001 vota por uno y 98000002 por el otro; *Cerrar* | — |
| 22 | Panel: segunda vuelta convocada | (misma) | `carga.prueba` | *Convocar segunda vuelta* → seleccionar "Tesorero Regional · ronda 2" | — |
| 23 | Elector: cédula de la segunda vuelta | `/votar/:codigo` | Celular · 98000003 | Abrir la ronda 2 | 16-2 |
| 24 | Acta (PDF) | `/admin/asambleas/:id` → *Acta (PDF)* | `carga.prueba` | Tras cerrar y proyectar al menos un cargo | — |
| 25 | Métricas (CSV) abiertas en Excel | → *Métricas (CSV)* | `carga.prueba` | — | — |
| 26 | Elector: "La asamblea terminó" | `/votar/:codigo` | Celular | *Finalizar asamblea* (cerrar antes lo que esté abierto) | — |

Al terminar: `node scripts/demo-asamblea.mjs borrar --url https://iddprenoch.com`.

## 3. Capturas 1, 3 y 6 en el entorno local

Con el backend (`npm run dev`) y el frontend (`npm start`) locales, el seed trae usuarios, iglesias y
congregantes ficticios (`admin`, `obispo.regional`, `obispo.huaral`, `editor`). Estas tres
pantallas se pueden generar automáticamente con Playwright, con la misma resolución que las demás.
