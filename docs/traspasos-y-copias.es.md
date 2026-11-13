# Traspasos y copias de seguridad

[English version](handovers-and-backups.en.md) · [Guía de uso](guia.es.md)

Esta guía explica, paso a paso, cómo guardar copias de los datos y cómo hacer los cambios de personas sin
perder el histórico: la baja de un miembro, el traspaso de una tarea y el traspaso de la dirección del
equipo a otro project manager (PM).

Léela entera antes de hacer un traspaso de la dirección: es la única operación que **no se puede deshacer**.

---

## 1. Dónde están los datos

Todo está en la carpeta `datos`, junto al archivo de la herramienta:

| Archivo | Qué contiene | Quién lo escribe | Cifrado |
|---|---|---|---|
| `equipo-pm.json` | Proyectos, equipo, ajustes, festivos y lo que registra el PM | El PM | No |
| `miembro-<id>.json` | Lo que registra cada miembro: avance de sus tareas, ausencias, reuniones | Cada miembro | No |
| `evaluaciones-cifradas.json` | Evaluaciones de calidad | El PM | Sí, con la contraseña de PM |
| `privado-pm.json` | Proyectos privados del PM | El PM | Sí, con la contraseña de PM |
| `diario-<id>.json` | Diario de trabajo de cada persona | Cada persona | Sí, con su propia clave |
| `thunderbird-<nombre>.ics` | Convocatorias aceptadas en Thunderbird | Thunderbird | No |
| `calendario-….ics` | Calendarios para suscribirse | La herramienta | No |

Dos consecuencias importantes:

- **Lo cifrado depende de una contraseña que nadie puede restablecer.** Si se pierde la contraseña de PM, se
  pierden las evaluaciones y los proyectos privados. Si alguien olvida la contraseña de su diario, se pierde
  ese diario.
- **El diario del PM** se cifra con la contraseña de PM. El de cada miembro, con la contraseña de su diario.

---

## 2. Copias de seguridad

Hay cuatro formas de guardar copia. Se complementan; usa al menos las dos primeras.

### 2.1 Copia completa desde la herramienta (PM)

Es la copia principal. Guarda en un solo archivo todo lo que gestiona el equipo.

1. Entra como PM.
2. Ve a **Proyectos y equipo** y baja hasta **Copia de seguridad 🔒**.
3. Pulsa **Descargar copia (.json)**. Se descarga `copia-gantt-AAAA-MM-DD.json`.
4. Mueve el archivo a un sitio **privado y fuera de la carpeta compartida** (tu OneDrive personal, un disco
   externo).

**Qué incluye:** proyectos, tareas, equipo, reuniones, ausencias, festivos, jornadas extra, ajustes, tus
proyectos privados y **las evaluaciones sin cifrar**.

**Qué no incluye:** los diarios (son de cada persona) ni los archivos de Thunderbird.

**Cuándo hacerla:**
- una vez por semana, o tras una sesión larga de planificación;
- **antes de instalar una versión nueva** de la herramienta;
- **antes de un traspaso de la dirección** y justo después (la hace el nuevo PM);
- antes de borrar un proyecto o de restaurar otra copia.

> Como lleva las evaluaciones sin cifrar, trata este archivo como confidencial.

### 2.2 Copia de la carpeta `datos` entera

Es la copia más completa: incluye también los diarios (cifrados) y los archivos de Thunderbird.

1. Pide al equipo que no edite durante un minuto y espera a que OneDrive termine de sincronizar (icono con
   la marca verde).
2. En el Explorador de archivos, copia la carpeta `datos` completa y pégala en un sitio privado, con la
   fecha en el nombre (por ejemplo `datos 2026-11-13`).

Para recuperarla, se sustituye la carpeta `datos` por la copia. Los archivos cifrados siguen necesitando
las contraseñas que estaban en uso **el día de la copia**.

### 2.3 Historial de versiones de OneDrive

Sirve para recuperar **un archivo concreto** si se ha estropeado o borrado.

1. En OneDrive (web) o en el Explorador, clic derecho sobre el archivo, por ejemplo `equipo-pm.json`.
2. Elige **Historial de versiones** y restaura la versión del día que necesites.
3. En la herramienta, pulsa ↻ para volver a leer la carpeta.

### 2.4 El diario de cada persona

Cada uno guarda el suyo. Nadie más puede hacerlo por él.

1. Pestaña **Diario** → **Descargar…**
2. Elige el periodo (**Todo el diario** para una copia completa) y el formato **Word (.docx)** o **Texto**.
3. Pulsa **Descargar**. El archivo descargado **no va cifrado**: guárdalo en un sitio privado.

Para volver a cargarlo en la herramienta: **Diario → Importar…** y elige ese archivo. Las anotaciones que
ya existan con el mismo texto no se duplican.

### 2.5 Restaurar una copia `.json` en el equipo

1. Entra como PM y haz antes una copia del estado actual (2.1), por si acaso.
2. **Proyectos y equipo → Copia de seguridad → Restaurar desde copia…** y elige el archivo.
3. Comprueba el Gantt y pide al equipo que recargue la página (F5).

Qué ocurre: los elementos que contiene la copia vuelven a como estaban ese día, **aunque alguien los haya
cambiado después**. Lo que se creó después de la copia se conserva. Las evaluaciones y los proyectos
privados de la copia se vuelven a cifrar con tu contraseña actual.

### 2.6 Consultar una copia en una carpeta aparte (copia personal)

Sirve para conservar y consultar tu histórico sin tocar los datos del equipo, por ejemplo después de dejar
la dirección.

1. Crea una carpeta nueva **tuya** (no la del equipo), con el archivo de la herramienta y una carpeta
   `datos` vacía.
2. Abre la herramienta con Edge o Chrome y elige esa carpeta `datos`.
3. En **Carpeta vacía: crear el equipo**, escribe tu nombre y una contraseña nueva, y **desmarca** «Cargar
   los datos de ejemplo».
4. Ve a **Proyectos y equipo → Copia de seguridad → Restaurar desde copia…** y elige tu copia `.json`.
5. Tendrás el Gantt, el calendario, las tareas y tus proyectos privados tal como estaban el día de la copia.
   Si la copia llevaba evaluaciones, también.
6. Para tu diario: **Diario → Importar…** y elige el Word que descargaste.

---

## 3. Un miembro deja el equipo

**Antes de su último día**

1. Pídele que descargue su diario si quiere conservarlo (2.4). Nadie más puede abrirlo.
2. Repasa con él sus tareas abiertas y el avance real de cada una, para que quede actualizado.

**El PM registra la baja**

3. **Proyectos y equipo →** pulsa su nombre en **Equipo**.
4. En **Fecha de baja**, pon su **último día en el equipo** y pulsa **Guardar**.
5. Se abre la lista **Tareas abiertas** de esa persona. En cada una, pulsa **Traspasar…** y sigue el
   apartado 4. Puedes cerrar la lista y volver más tarde: las tareas sin traspasar aparecen en la campana 🔔
   como «Responsable de baja».

**Qué cambia desde el día siguiente a la baja**

- No aparece en «¿Quién eres?» ni en las listas para asignar tareas, ausencias o reuniones.
- No cuenta en la carga ni en las fechas previstas, y sale de las reuniones periódicas posteriores.
- Su histórico se conserva con su nombre: tareas terminadas, reuniones, ausencias y evaluaciones.

**Después**

6. Si era participante de proyectos en curso, quítalo en la ficha de cada proyecto si quieres que deje de
   figurar.
7. Su archivo `diario-<id>.json` puede borrarse de la carpeta `datos` cuando ya no lo necesite.
8. Retírale el acceso a la carpeta compartida en OneDrive.

**Si vuelve al equipo:** borra la fecha de baja en su ficha. Recupera todo.

> No elimines al miembro con el botón **Eliminar**: se perdería la referencia en su histórico. La herramienta
> lo impide mientras tenga tareas o ausencias.

---

## 4. Traspasar una tarea a otra persona

Úsalo cuando alguien deja una tarea a medias y otra persona la continúa. Si la tarea aún no ha empezado,
o quieres pasarla entera, basta con cambiar el **Responsable** en su ficha.

1. Abre la tarea y, en **Estado**, pulsa **⇄ Traspasar…** (solo lo ve el PM, y solo si la tarea está activa:
   si está en pausa, reanúdala antes).
2. **Nuevo responsable:** la persona que continúa.
3. **Último día de** quien la llevaba: hasta esa fecha el trabajo cuenta a su nombre.
4. **Inicio de la continuación:** se propone el primer día laborable de la nueva persona; puedes cambiarlo.
5. **Fin planificado:** se propone el de la tarea original. Si ya no es posible, la herramienta propone el
   que hace falta.
6. **Horas pendientes que se traspasan:** revisa la cifra; es lo que quedaba por hacer.
7. **Dedicación:** el porcentaje de jornada que la nueva persona dedicará.
8. Lee la línea de comprobación: indica cuántos días laborables y horas tiene la nueva persona en ese
   periodo. Si aparece en rojo **«No llega al fin planificado»**, amplía la fecha o la dedicación.
9. Pulsa **Traspasar**.

**Qué queda después**

| | Primera parte | Continuación |
|---|---|---|
| Responsable | Quien la llevaba | La nueva persona |
| Fechas | Inicio original → último día | Inicio de la continuación → fin planificado |
| Estado | Completada, con la etiqueta «Traspasada a …» | Pendiente |
| Horas | Las que llevaba hechas | Las pendientes |
| En el Gantt | Etiqueta «⇄ 1.ª parte» | Etiqueta «⇄ continuación», enlazada a la anterior |

- Las tareas que dependían de la original pasan a depender de la continuación.
- La primera parte se puede evaluar como cualquier tarea completada.
- En la ficha de cada una hay un enlace para saltar a la otra.

**Ejemplo.** Tarea del 1 de junio al 22 de diciembre, de Carlos, que deja el equipo el 5 de septiembre.
Traspaso a Iván con último día 5 de septiembre: la tarea de Carlos queda del 1 de junio al 5 de septiembre,
completada; Iván recibe la continuación del 7 de septiembre (su primer día laborable) al 22 de diciembre, con
las horas pendientes.

**Si te equivocas:** no hay un botón para deshacer. Abre la continuación y corrige el responsable, las
fechas o las horas; o bórrala, y en la primera parte vuelve a poner el estado «En curso», el fin
planificado original y quita la fecha de fin real.

---

## 5. Reuniones periódicas cuando cambia una persona

- **Quien causa baja** sale sola de las reuniones periódicas posteriores a su fecha.
- **Para añadir a quien le sustituye desde una fecha:** abre la reunión de ese día, en **Aplicar los
  cambios a** elige **Esta y las siguientes**, marca a la nueva persona y guarda. Las anteriores no cambian.
- **Para varias reuniones a la vez:** pestaña **Reuniones → Seleccionar varias**, filtra por proyecto y
  «Desde hoy», y usa **Añadir como asistentes** o **Quitar de los asistentes**.
- Las reuniones de **Participantes del proyecto** siguen a los participantes: basta con cambiar la lista en
  la ficha del proyecto.

---

## 6. Cambiar la contraseña de project manager

1. Comprueba que OneDrive está sincronizado y que no hay otra ventana de la herramienta abierta como PM.
2. **Proyectos y equipo → Dirección del equipo 🔒 → Cambiar la contraseña…**
3. Escribe la contraseña actual y la nueva dos veces (8 caracteres o más). Pulsa **Cambiar**.
4. Espera el aviso «Contraseña cambiada».

Las evaluaciones, tus proyectos privados y tu diario se vuelven a cifrar con la nueva. Los miembros no
notan nada. **Apunta la contraseña nueva en un sitio seguro**: nadie puede restablecerla.

---

## 7. Traspasar la dirección del equipo a otro PM

Lo hace **el PM saliente**, con su sesión abierta. Lo ideal es que el nuevo PM esté presente para escribir
su contraseña.

### 7.1 Antes de empezar

- [ ] El nuevo PM ya es miembro del equipo. Si no, dalo de alta en **Proyectos y equipo → + Miembro**.
- [ ] OneDrive está sincronizado y el resto del equipo no está editando.
- [ ] Has actualizado el avance de tus tareas. Las que no vayas a continuar, traspásalas (apartado 4) o
      déjalas: quedarán a tu nombre y el nuevo PM las verá en los avisos si causas baja.
- [ ] Has decidido qué hacer con tus **proyectos privados**: se eliminan de la carpeta del equipo en el
      traspaso. Si quieres que alguno continúe en el equipo, quítale antes la marca «Privado (solo yo)».
- [ ] Tienes a mano tu contraseña actual.

### 7.2 El traspaso, paso a paso

Ve a **Proyectos y equipo → Dirección del equipo 🔒 → Traspasar la dirección del equipo…**

**Paso 1 · Guarda tu copia personal.** Hazlo ahora: después no podrás.
- Marca **Incluir las evaluaciones del equipo** solo si las necesitas y las normas de tu organización lo
  permiten.
- Pulsa **Descargar copia (.json)**: contiene los datos del equipo y tus proyectos privados.
- Pulsa **Descargar mi diario (Word)**.
- Comprueba que los dos archivos están en tu carpeta de descargas y muévelos a un sitio privado.

**Paso 2 · Nuevo project manager.** Elige a la persona. Ella escribe su contraseña dos veces (8 caracteres o
más). Si no está presente, pon una provisional y dásela por un canal seguro: debe cambiarla en cuanto entre
(apartado 6).

**Paso 3 · Tú.** Elige **Sigo en el equipo como miembro** o **Dejo el equipo**; en ese caso indica tu
último día.

**Paso 4 · Lo personal tuyo.**
- Tus proyectos privados se eliminan de la carpeta del equipo.
- Tu diario: **Conservarlo con una contraseña solo mía** (escríbela; es la que usarás como miembro) o
  **Eliminarlo de la carpeta del equipo**. Si dejas el equipo, se elimina.

**Paso 5 · Confirmación.** Escribe tu contraseña actual, marca la casilla y pulsa **Traspasar la
dirección**. La página se recarga sola y pregunta «¿Quién eres?».

### 7.3 Qué pasa con cada cosa

| Dato | Después del traspaso |
|---|---|
| Proyectos, tareas, planificación, reuniones, ausencias, festivos, ajustes | Pasan tal cual al nuevo PM |
| Evaluaciones | Se vuelven a cifrar con la contraseña del nuevo PM, que las ve todas |
| Proyectos en curso de los que eras responsable | Pasan a nombre del nuevo PM |
| Tus tareas | Siguen a tu nombre |
| Tu contraseña de PM | Deja de funcionar |
| Tus proyectos privados | Se eliminan de la carpeta (los tienes en tu copia personal) |
| Tu diario | Se conserva con tu contraseña propia, o se elimina |
| Diario del nuevo PM | No cambia: sigue abriéndolo con la contraseña de su diario |

### 7.4 Después del traspaso

**El nuevo PM:**
1. En «¿Quién eres?», elige su nombre y entra con su contraseña.
2. Comprueba que ve la pestaña **Cumplimiento** con las evaluaciones y la tarjeta **Dirección del equipo**.
3. Si la contraseña era provisional, la cambia (apartado 6).
4. Hace una **copia completa** (2.1): es la primera con su contraseña.
5. Revisa la campana 🔔: si el PM saliente ha causado baja, sus tareas abiertas aparecen como «Responsable de
   baja» para traspasarlas.

**El PM saliente, si sigue en el equipo:**
1. Entra eligiendo su nombre, ya sin contraseña.
2. Abre **Diario** con la contraseña que eligió en el paso 4.

**Todo el equipo:** recarga la página (F5).

### 7.5 Si algo va mal

- **La página se cerró a mitad del traspaso.** Entra de nuevo: si tu contraseña antigua sigue funcionando,
  el traspaso no se llegó a hacer y puedes repetirlo. Si no funciona, prueba con la del nuevo PM. Si
  ninguna abre las evaluaciones, restaura `equipo-pm.json` y `evaluaciones-cifradas.json` con el historial
  de versiones de OneDrive (2.3) a la hora anterior al traspaso.
- **El nuevo PM olvidó su contraseña.** No se puede recuperar. Con una copia de la carpeta `datos` (2.2)
  anterior al traspaso, el PM saliente puede volver a ese estado con su contraseña antigua y repetirlo.
- **Te fuiste sin hacer el traspaso.** Los datos compartidos no están cifrados y se conservan, pero las
  evaluaciones no se pueden recuperar sin tu contraseña. El equipo necesita que hagas el traspaso, o que
  les des la contraseña para hacerlo ellos.

---

## 8. Resumen: qué copia hace falta en cada caso

| Situación | Qué hacer antes |
|---|---|
| Uso normal | Copia completa (2.1) cada semana |
| Instalar una versión nueva | Copia completa (2.1) |
| Baja de un miembro | Que descargue su diario (2.4) |
| Cambiar la contraseña de PM | Copia completa (2.1) |
| Traspasar la dirección | Copia de la carpeta `datos` (2.2), copia personal y diario (paso 1 del traspaso) |
| Restaurar una copia | Copia completa del estado actual (2.1) |
