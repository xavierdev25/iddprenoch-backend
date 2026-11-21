# Pruebas manuales — Sprint 1 (roles, alcance por distrito y auditoría)

Hacerlas en producción justo después del despliegue. Se necesitan la cuenta del **Responsable del
sistema** (`admin`), una ventana de incógnito para las otras cuentas y, para la prueba A4, el
celular.

Marcar cada fila: ✅ correcto · ❌ falla (anotar qué se vio).

## A. Ingreso y sesión

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| A1 | Abrir `/admin/login`. | Ya **no** aparece el texto "Demo: admin / admin123". | |
| A2 | Ingresar con `admin` (contraseña nueva). | Entra; abajo del menú dice **admin · Responsable del sistema**. | |
| A3 | La sesión anterior al despliegue (si había otra pestaña abierta). | Pide ingresar de nuevo: el `JWT_SECRET` rotado invalida los tokens viejos. | |
| A4 | Desde el celular con datos móviles, intentar 2 veces una contraseña equivocada de `admin`; luego, desde la PC, ingresar bien. | La PC entra normal: el límite de 5 intentos ahora es **por IP real** y no uno solo para toda la región. | |

## B. Usuarios y roles (HU01)

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| B1 | Menú **Usuarios**. | Columnas Usuario, Rol, **Alcance**, Estado. `admin`: Responsable del sistema, Región. `pastor`: Editor, Región. | |
| B2 | + Nuevo usuario → Rol. | El selector ofrece Responsable, Obispo regional, Obispo distrital y Editor. **No** ofrece Secretario ni Tesorero. | |
| B3 | Elegir **Obispo distrital**. | Aparece el selector de Distrito; al elegir Huaral, se muestra el aviso amarillo de alcance. | |
| B4 | Guardar sin distrito. | No deja guardar: el distrito es obligatorio. | |
| B5 | Crear `obispo.prueba` (Obispo distrital, Huaral) y `carga.prueba` (Responsable del sistema). | Aparecen en la lista con su alcance: "Huaral" y "Región". | |
| B6 | Editar tu propio usuario (`admin`) e intentar cambiarte el rol. | Error: "No puedes cambiar tu propio rol". | |

## C. Obispo distrital (HU02, HU03) — en incógnito, con `obispo.prueba`

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| C1 | Ingresar. | Menú: Dashboard, Reportes, Iglesias, Pastores, Líderes, Congregantes. Abajo: **Obispo distrital · Huaral**. | |
| C2 | Congregantes. | Aviso "Estás viendo solo la información de las iglesias del distrito Huaral". Solo congregantes de Huaral; DNI con 4 dígitos visibles. | |
| C3 | Filtro Iglesia. | Solo ofrece iglesias de Huaral. | |
| C4 | Reportes. | No aparece el selector de Distrito; el consolidado por distrito muestra solo Huaral. | |
| C5 | Iglesias → editar una iglesia de Huaral → guardar sin cambios. | Guarda bien. | |
| C6 | Iglesias → Nueva iglesia. | El selector de distrito solo ofrece Huaral. | |
| C7 | Escribir a mano `/admin/usuarios`. | Vuelve al Dashboard. | |
| C8 | Escribir a mano `/admin/congregantes/<id>` de un congregante **de otro distrito** (verlo antes con `admin`). | Error de acceso; no muestra sus datos. | |

## D. Editor y roles sin permisos (HU04, matriz)

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| D1 | Ingresar como `pastor` (Editor). | Menú: Dashboard, Eventos, Comunicados. | |
| D2 | Publicar un comunicado de prueba y luego borrarlo. | Funciona igual que antes. | |
| D3 | Escribir a mano `/admin/congregantes`. | Vuelve al Dashboard. | |

## E. Auditoría (HU05) — con `admin`

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| E1 | Menú **Auditoría**. | Aparecen los LOGIN de esta sesión de pruebas, con la **IP real** de cada equipo (no 127.0.0.1). | |
| E2 | Filtrar Resultado = Denegado. | Aparecen los intentos de C7, C8 y D3, con usuario, ruta y motivo. | |
| E3 | Filtrar Acción = USUARIO. | Aparecen CREAR USUARIO de B5, con rol y distrito en el detalle. | |
| E4 | Un login fallido (contraseña equivocada). | Aparece LOGIN Denegado con el nombre de usuario intentado. | |

## F. Sitio público (no debe cambiar)

| # | Paso | Resultado esperado | ✓ |
|---|---|---|---|
| F1 | Inicio, Ubícanos y Directiva, sin sesión. | Se ven igual que antes: 48 iglesias, sus pastores y fotos. | |
| F2 | Las mismas páginas con la sesión de `obispo.prueba` abierta en otra pestaña. | Siguen mostrando **todas** las iglesias, no solo Huaral. | |
| F3 | `https://iddprenoch.com/api/pastores` | Ningún pastor trae el campo `celular`. | |

## Si algo falla

Revertir es revertir el merge en **ambos** repositorios; la base no se toca (ADR-026,
"Reversión"). Antes de revertir, desactivar `obispo.prueba`: el código anterior no tiene
permisos y le daría acceso total.
