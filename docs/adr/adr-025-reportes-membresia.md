# ADR-025: Reportes de membresía generados en el servidor con `write-excel-file` y `pdfkit`

## Contexto

La dirección regional pide un reporte descargable con la lista de miembros de una iglesia y un
consolidado de membresía por iglesia y por distrito, con el desglose de varones, mujeres, jóvenes y
niños. Los formatos pedidos son Excel y PDF: el Excel se usa para trabajar los datos, el PDF para
imprimirlo y pasar lista.

Tres restricciones acotan la decisión:

1. El backend se despliega por FTP a un **cPanel sin acceso SSH**. Las dependencias de producción no
   viajan en el paquete: las instala el propio panel con su "Run NPM Install". Cada dependencia
   transitiva es, por tanto, un riesgo de instalación que nadie puede depurar desde una terminal.
2. Es un **hosting compartido**: no se puede lanzar un proceso aparte ni descargar un navegador.
3. Los datos son **sensibles** (DNI, teléfono, correo, fecha de nacimiento de menores incluidos).

## Decisión

Los archivos se generan **en el servidor**, en un módulo `reportes` bajo `/api/reportes/*`, con
`write-excel-file` para el `.xlsx` y `pdfkit` para el `.pdf`.

Se descartó **generar los archivos en el navegador**: obligaría a bajar toda la membresía al cliente
para armarlos, duplicaría en el frontend la lógica de clasificación por edad —con el riesgo de que
las cifras del Excel no coincidan con las de la pantalla— y dejaría el reporte atado a que quien lo
pide tenga el panel abierto.

Se descartó **`exceljs`**, la opción más conocida para `.xlsx`: arrastra `archiver` → `glob` →
`minimatch` → `brace-expansion`, con un aviso de severidad alta en la cadena y decenas de paquetes
transitivos. `write-excel-file` depende de un solo paquete (`fflate`), no reporta vulnerabilidades y
cubre lo que el reporte necesita: varias hojas, fila de encabezados fija, anchos de columna y
formato de fecha real.

Se descartó **cualquier renderizador de PDF basado en navegador headless** (Puppeteer y similares)
por la restricción 2. `pdfkit` dibuja el PDF en el mismo proceso Node y sus tipografías estándar ya
cubren los acentos y la ñ del castellano sin incrustar fuentes.

Todos los endpoints del módulo, incluidas las descargas, exigen sesión — el mismo criterio que
`/api/congregantes`, por la restricción 3.

## Consecuencias

- Los filtros son una sola pieza compartida (`congregantes.filters.ts`) entre el listado en pantalla
  y las descargas, de modo que la lista que se ve y el archivo que se baja con los mismos criterios
  no pueden devolver conjuntos distintos.
- El grupo etario no existe como columna: se deriva de `fecha_nacimiento`. El consolidado agrega en
  Node en vez de con `GROUP BY`, porque agrupar en SQL exigiría una consulta por tramo y por sexo, y
  porque así el consolidado y el listado nominal clasifican con el mismo código. Es una decisión
  atada al volumen actual (decenas de iglesias, miles de congregantes); si la membresía creciera un
  orden de magnitud, habría que revisarla.
- Una exportación está topada en 20 000 filas y devuelve un 400 explicativo por encima de ese
  número, en vez de arriesgar la memoria del proceso en un hosting compartido.
- Las consultas del módulo usan `select` explícito para no traer la columna `foto`, que guarda
  imágenes en base64 y convertiría un reporte de texto en decenas de MB.
- El PDF imprime un subconjunto de columnas del Excel: en A4 horizontal caben unas diez legibles, así
  que lleva las que sirven para pasar lista y llamar por teléfono, y el Excel queda como la versión
  con todos los campos.
- Se añaden dos dependencias de producción que el cPanel deberá instalar en el próximo despliegue.
