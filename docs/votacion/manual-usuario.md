# Manual de usuario — Votación electrónica en asambleas

Plataforma: **iddprenoch.com** · Panel: **iddprenoch.com/admin**

Hay tres roles en una asamblea:

| Quién | Qué hace | Dónde |
|---|---|---|
| **Administrador** | Prepara la asamblea y conduce la votación. | Panel, en una PC conectada al proyector. |
| **Mesa de acreditación** | Verifica la identidad y entrega el código de 4 dígitos. | Panel, en otra PC o tablet. |
| **Elector** | Vota desde su celular. | Escanea el QR; no instala nada. |

El administrador y la mesa usan una cuenta del panel con permiso de asambleas: Responsable del
sistema, Obispo regional u Obispo distrital (este último, solo para asambleas de su distrito).

---

## 1. Administrador: antes de la asamblea

1. **Crear la asamblea.** Menú *Votación → Asambleas → + Nueva asamblea*. Nombre, tipo (regional o
   distrital), distrito si es distrital, fecha y hora.
2. **Cargos.** En el panel de la asamblea, cuadro *Cargos a elegir*: escribir el cargo (p. ej.
   "Secretario Regional") y **+ Agregar**. Un cargo por elección.
3. **Candidatos.** Elegir el cargo y **+ Agregar candidato**: nombre completo, un detalle opcional
   (p. ej. "Distrito Huaura") y una foto opcional. La foto se reduce sola antes de subirla. Los
   candidatos solo se pueden cambiar mientras el cargo está *Pendiente*.
4. **Padrón.** *Ver y cargar el padrón → Importar desde la membresía*: elegir una iglesia, o todas
   las de su alcance. Por defecto solo bautizados. También se pueden agregar personas una por una
   desde la mesa.
5. **QR de ingreso.** *Código QR de ingreso → Imprimir*. Ponerlo a la entrada y proyectarlo al
   inicio. Debajo del QR está el código de 6 letras, por si alguien prefiere escribirlo.

## 2. Mesa de acreditación: durante el ingreso

1. Abrir la asamblea en el panel → **Acreditar elector**.
2. Pedir el **DNI** al elector, escribirlo y pulsar **Buscar** (o Enter).
3. Si está en el padrón: **Acreditar y generar código**. Si no está: revisar el nombre que sugiere
   el sistema y **Agregar al padrón y acreditar**.
4. Aparece un **código de 4 dígitos**: díctaselo o anótaselo en un papel. **No se vuelve a
   mostrar.**
5. **Siguiente elector** limpia la pantalla para el próximo.

**Si alguien perdió su código:** buscar su DNI → *Generar código nuevo*. El anterior deja de
funcionar, y queda registrado en la auditoría quién lo generó.

## 3. Elector: cómo votar

1. **Escanear el QR** con la cámara del celular. Se abre la página de votación; no hay que instalar
   nada.
2. Escribir el **DNI** y el **código de 4 dígitos** que entregó la mesa → **Ingresar**.
3. Esperar: la pantalla dice *"Esperando a la mesa"* y se actualiza sola. **No hace falta tocar
   nada.**
4. Cuando la mesa abre la votación, aparece la **cédula**:
   - **Toque 1:** tocar la foto del candidato elegido.
   - **Toque 2:** *Continuar*.
   - **Toque 3:** *Sí, confirmar mi voto* (o *No, quiero cambiar* para volver).
5. Aparece *"¡Tu voto fue registrado!"* con un número de constancia. El voto es secreto: la
   constancia no dice por quién votó.
6. Dejar la página abierta: cuando se abra el siguiente cargo, la cédula aparece sola.

**Si se equivoca 5 veces con el código**, el ingreso se bloquea 15 minutos: acercarse a la mesa.

## 4. Administrador: conducir la votación

1. Elegir el cargo en *Cargos a elegir* → **Abrir votación**. En unos 3 segundos los celulares
   muestran la cédula.
2. El panel muestra **EN VIVO**: acreditados, votos emitidos, cuántos faltan, participación y el
   conteo por candidato. **El conteo solo lo ve el panel**; ni los celulares ni la proyección lo
   muestran.
3. Cuando ya votaron todos (o vence el tiempo acordado): **Cerrar votación**. Desde ese momento no
   se acepta ningún voto más.
4. Según el resultado:
   - **Hay ganador:** *Proyectar ganador*. La pantalla de proyección muestra el cargo, la foto y el
     nombre.
   - **Hay empate:** *Convocar segunda vuelta*. Se crea el mismo cargo como "ronda 2" solo con los
     empatados; abrirla igual que una votación normal.
5. Repetir con cada cargo. **Solo puede haber una votación abierta a la vez.**
6. Al terminar: **Acta (PDF)** para imprimir y firmar, **Métricas (CSV)** para el informe y
   **Finalizar asamblea**.

## 5. Pantalla de proyección

*Abrir pantalla de proyección* abre una pestaña nueva. Llevarla al proyector y ponerla en pantalla
completa (tecla **F11**). Muestra solo los ganadores que la mesa publica. Si se corta internet, se
pone al día sola cuando vuelve.

## 6. Problemas frecuentes

| Problema | Qué hacer |
|---|---|
| El elector no ve la cédula después de abrir la votación. | Esperar 5 segundos. Si no aparece, recargar la página: no pierde su ingreso. |
| "DNI o código incorrectos". | Revisar que el DNI tenga 8 números y el código 4. Si lo perdió, la mesa genera uno nuevo. |
| "Ya votaste en esta elección". | Su voto ya está registrado; no se cuenta dos veces. |
| "La votación de este cargo ya se cerró". | Llegó tarde: ese voto no se registró. |
| El panel dice "reconectando…". | Revisar internet en la PC del panel. El conteo se pone al día al reconectar. |
| La proyección no cambia. | Recargar la página de proyección (F5). |

## 7. Privacidad (Ley N.º 29733)

- El sistema guarda el DNI y el nombre del elector solo para verificar que puede votar y que vota
  una vez.
- El **voto** se guarda separado de la identidad: no hay forma de saber quién votó por quién.
- El acta y el CSV de métricas no contienen datos de los electores.
- La pantalla de ingreso muestra el aviso de privacidad.
