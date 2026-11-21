# Carga de trabajo y fecha prevista: cómo se calculan

[English](workload-and-forecast.en.md) · Manual de usuario: [manual.es.md](manual.es.md)

Este documento explica, con las fórmulas que usa la herramienta, de dónde salen tres cosas:

1. las **horas disponibles** de cada persona cada día;
2. la **carga** (el porcentaje de ocupación) y los avisos de *Al límite* y *Sobrecarga*;
3. el **fin previsto** de cada tarea y el **retraso previsto**.

En GitHub las fórmulas se ven con formato matemático; en otros visores aparecen como texto LaTeX.

---

## 1. Notación

| Símbolo | Significado | Dónde se define |
|---|---|---|
| $p$ | una persona del equipo | |
| $d$ | un día | |
| $t$ | una tarea | |
| $T$ | hoy | |
| $J_p$ | horas disponibles por día de la persona (jornada). Por defecto, 8 | Ficha del miembro |
| $L_p(d)$ | 1 si $d$ es un **día laborable normal** de $p$; 0 si no | Ver 2.1 |
| $a_p(d)$ | **disponibilidad** de $p$ ese día por ausencias, entre 0 y 1 | Ver 2.2 |
| $X_p(d)$ | horas de **jornada extra** de $p$ ese día (un sábado, un festivo…) | Ausencias → Jornada extra |
| $X^{t}_p(d)$ | parte de esa jornada extra dedicada a la tarea $t$ | |
| $X^{\text{libre}}_p(d)$ | parte de la jornada extra sin tarea concreta | |
| $\mathrm{ded}_{t,p}$ | dedicación (%) de $p$ en la tarea $t$: la del responsable o la de cada colaborador | Ficha de la tarea |
| $R_p(d)$ | horas de reunión de $p$ ese día | Reuniones |

---

## 2. Horas disponibles

### 2.1 Día laborable normal

$L_p(d) = 1$ cuando se cumplen las cuatro condiciones:

- es de lunes a viernes;
- es uno de los días de su horario (por ejemplo, un becario que solo trabaja lunes, miércoles y viernes);
- no es festivo para su centro de trabajo (nacional, autonómico, local o de empresa);
- no es posterior a su fecha de baja en el equipo.

### 2.2 Disponibilidad por ausencias

```math
a_p(d) =
\begin{cases}
1 & \text{sin ausencia ese día} \\[4pt]
\dfrac{\text{disponibilidad de la ausencia}}{100} & \text{ausencia de días completos} \\[10pt]
\max\!\left(0,\; 1 - \dfrac{h_{\text{ausencia}}}{J_p}\right) & \text{ausencia por horas}
\end{cases}
```

La disponibilidad por defecto de cada tipo de ausencia es 0 %, salvo *Viaje de proyecto*, que es 50 %. Se
puede cambiar en cada ausencia.

### 2.3 Horas disponibles de un día

```math
C_p(d) \;=\; J_p \cdot a_p(d) \cdot L_p(d) \;+\; X_p(d)
```

*Ejemplo:* Lucía, jornada de 8 h, con una cita médica de 10:00 a 12:00 (2 h):
$a = 1 - 2/8 = 0{,}75$, así que $C = 8 \cdot 0{,}75 = 6$ h.

---

## 3. Carga

### 3.1 Horas de una tarea para una persona

Para el responsable y para cada colaborador, en cada día $d$ entre el inicio de la tarea y su fin:

```math
h_{t,p}(d) \;=\; J_p \cdot \frac{\mathrm{ded}_{t,p}}{100} \cdot L_p(d)
\;+\; X^{t}_p(d)
\;+\; \bigl(1 - L_p(d)\bigr) \cdot X^{\text{libre}}_p(d) \cdot \frac{\mathrm{ded}_{t,p}}{100}
```

- El **fin** es el fin planificado; si la tarea está terminada, su fin real.
- No cuentan los días en que la tarea estuvo **en pausa**, ni las tareas **canceladas** o de **proyectos privados**.
- La ausencia **no reduce** $h$: el plan sigue pidiendo esas horas. Lo que baja es $C$, por eso una semana con ausencias aparece con más carga. Es intencionado: avisa de que el plan no cabe.
- En la vista diaria del **Calendario** no se muestran las tareas ya terminadas; en la carga semanal cuentan hasta su fin real.

### 3.2 Horas de reunión

```math
R_p(d) = \sum_{\substack{m \,:\, p \,\text{asiste a}\, m \\ m \,\text{es el día}\, d}} \frac{\text{duración}_m\ (\text{min})}{60}
```

Solo cuentan las reuniones en días de trabajo de la persona (laborable normal o con jornada extra). Las de
fin de semana o festivo son opcionales y no suman. Una reunión privada cuenta igual, aunque no veas sus
detalles.

### 3.3 Carga de un día

```math
H_p(d) = \sum_{t} h_{t,p}(d) + R_p(d)
\qquad\qquad
O_p(d) = 100 \cdot \frac{H_p(d)}{C_p(d)}\ \%
```

Si $C_p(d) = 0$ y hay horas previstas, la ocupación es $\infty$.

En el **Calendario**, cada día se colorea así:

| Condición | Color / estado |
|---|---|
| fin de semana, festivo, fuera de su horario o ausente todo el día (sin jornada extra) | gris, con su etiqueta |
| $O > 100\ \%$ | rojo · sobrecarga |
| $85\ \% \le O \le 100\ \%$ | naranja · alta ocupación |
| hay tareas | verde · tareas |
| solo reuniones | reuniones |

### 3.4 Carga de una semana

Se suman los cinco días de **lunes a viernes**:

```math
O^{\text{sem}}_p = 100 \cdot \frac{\sum_{d=\text{lun}}^{\text{vie}} H_p(d)}{\sum_{d=\text{lun}}^{\text{vie}} C_p(d)}
\qquad\qquad
\text{pico} = \max_{d=\text{lun}\dots\text{vie}} O_p(d)
```

| $O^{\text{sem}}$ | Nivel |
|---|---|
| $> 100\ \%$ | **Sobrecarga** (rojo) |
| $\ge 85\ \%$ | **Al límite** (naranja) |
| $> 0\ \%$ | Disponible (verde) |
| $0\ \%$ | Libre |

Es la carga que se ve en la vista **Por persona** del Gantt y en *Proyectos y equipo*.

### 3.5 Aviso de sobrecarga en la ficha de la tarea

Al editar una tarea, la herramienta calcula $O^{\text{sem}}$ del responsable y de cada colaborador **con la
tarea tal como está en el formulario**, en las semanas que cubren sus fechas (desde una semana antes de hoy
como mucho). Toma la semana con la carga más alta:

- si pasa de 100 %: «⚠ … queda en **sobrecarga**»;
- si llega al 85 %: «… queda al límite».

Se puede guardar igualmente.

---

## 4. Horas estimadas y pendientes

### 4.1 Horas estimadas

Si la tarea tiene **horas estimadas**, se usan tal cual. Si el campo está vacío:

```math
E_t \;=\; J_{\text{resp}} \cdot \frac{\mathrm{ded}_{t}}{100} \cdot \max(1,\, n_{\text{resp}})
\;+\; \sum_{c\,\in\,\text{colaboradores}} J_c \cdot \frac{\mathrm{ded}_{t,c}}{100} \cdot n_c
```

donde $n_p$ es el número de días laborables normales de $p$ entre el inicio y el fin planificados.

### 4.2 Horas pendientes

```math
P_t =
\begin{cases}
0 & \text{tarea terminada} \\
\text{horas pendientes} & \text{si el campo está relleno} \\
E_t \cdot \left(1 - \dfrac{\text{avance}}{100}\right) & \text{si está vacío}
\end{cases}
```

---

## 5. Fin previsto

La herramienta **simula día a día**, desde hoy y hasta dentro de dos años, cómo cada persona va gastando
sus horas en sus tareas abiertas. El fin previsto de una tarea es el día en que sus horas pendientes llegan
a cero.

### 5.1 Qué tareas avanzan un día

Una tarea está **activa** el día $d$ si:

- no está terminada, bloqueada, en pausa ni cancelada;
- $d \ge \max(\text{inicio planificado},\, T)$: no empieza antes de lo planificado;
- todas las tareas de las que depende tienen su fin previsto **antes** de $d$ (salvo que el PM haya permitido avanzar).

### 5.2 Horas que una persona puede dar ese día

```math
D_p(d) \;=\; \max\Bigl(0,\;
J_p \cdot a_p(d) \cdot L_p(d) \;+\; X^{\text{libre}}_p(d)
\;-\; R_p(d) \;-\; K_p(d)\Bigr)
```

$K_p(d)$ son las horas que $p$ tiene **reservadas como colaborador** en tareas de otros (5.4).

### 5.3 Reparto entre sus tareas: prioridad y dedicación

Cada tarea tiene un **ritmo** según la dedicación de su responsable:

```math
r_t = J_{\text{resp}} \cdot \frac{\mathrm{ded}_t}{100}
```

Las horas $D_p(d)$ se reparten primero entre las tareas activas de **prioridad alta**, después **media** y
después **baja**. Dentro de cada grupo $g$:

```math
\text{Dem}_g = \sum_{t \in g} r_t
\qquad
G_g = \min(D_p,\ \text{Dem}_g)
\qquad
g_t = G_g \cdot \frac{r_t}{\text{Dem}_g}
\qquad
D_p \leftarrow D_p - G_g
```

Si hay horas de sobra, cada tarea recibe su ritmo completo ($g_t = r_t$); si faltan, todas las del grupo
se frenan en la misma proporción y las de menor prioridad esperan. Los días en que una tarea recibe menos
que su ritmo se cuentan como «sobrecarga o prioridad de otras tareas».

### 5.4 Ayuda de los colaboradores

Para cada colaborador $c$, en cada día laborable normal suyo en que la tarea está activa (5.1), **hasta que
la tarea termina**:

```math
k_{t,c}(d) = J_c \cdot \frac{\mathrm{ded}_{t,c}}{100} \cdot a_c(d)
```

Esas horas se **reservan** en el día del colaborador (forman su $K_c(d)$, que reduce lo que puede dar a sus
propias tareas) y se **restan** de la tarea.

Si la tarea **no tiene horas estimadas**, su tamaño $E_t$ (4.1) ya incluye lo que aportan los colaboradores:
añadir uno sin bajar la dedicación del responsable hace la tarea más grande, no más corta. Para que la ayuda
adelante la tarea, pon sus **horas estimadas** o baja la dedicación del responsable.

### 5.5 Avance de la tarea y fin previsto

Cada día activo:

```math
P_t \;\leftarrow\; P_t \;-\; g_t \;-\; \sum_c k_{t,c}(d) \;-\; X^{t}_{\text{resp}}(d)
```

```math
\text{fin previsto}_t = \text{primer día } d \text{ en que } P_t \le 0
```

Si la tarea ya no tiene horas pendientes, su fin previsto es ayer (o su inicio, si es posterior). Si en dos
años no termina, queda «sin fecha prevista».

### 5.6 Retraso previsto

```math
\text{desvío}_t =
\begin{cases}
+\,\#\{\text{días laborables de } p \text{ en } (\text{fin plan},\ \text{fin previsto}]\} & \text{si acaba después} \\
-\,\#\{\text{días laborables de } p \text{ en } (\text{fin previsto},\ \text{fin plan}]\} & \text{si acaba antes} \\
0 & \text{si coincide}
\end{cases}
```

Un desvío positivo genera el aviso **«Retraso previsto +N días»**. La ficha de la tarea explica las causas:
espera a dependencias, festivos, ausencias, sobrecarga o prioridad de otras tareas, reuniones o «aún sin
empezar».

### 5.7 Tareas privadas

Las tareas de proyectos privados del PM usan un recurso aparte con las horas al día que se indiquen en
*Proyectos privados*, todos los días. No cuentan en la carga del equipo.

---

## 6. Ejemplo completo

Carlos tiene jornada de 8 h y, cada día, 1 h de reuniones. Tiene dos tareas activas de **prioridad media**:

| Tarea | Dedicación | Ritmo $r_t$ | Horas pendientes |
|---|---|---|---|
| A | 60 % | $8 \cdot 0{,}6 = 4{,}8$ h/día | 48 h |
| B | 60 % | 4,8 h/día | 60 h |

**Carga de un día:**

```math
H = 4{,}8 + 4{,}8 + 1 = 10{,}6\ \text{h}
\qquad
O = 100 \cdot \frac{10{,}6}{8} = 132{,}5\ \% \;\Rightarrow\; \text{Sobrecarga}
```

**Reparto en la previsión:**

```math
D = 8 - 1 = 7\ \text{h}
\qquad
\text{Dem} = 9{,}6
\qquad
G = \min(7,\ 9{,}6) = 7
\qquad
g_A = g_B = 7 \cdot \frac{4{,}8}{9{,}6} = 3{,}5\ \text{h/día}
```

La tarea A tardaría $48 / 3{,}5 \approx 13{,}7$, es decir **14 días laborables**.

**Con Lucía colaborando en A al 25 %** (jornada de 8 h, sin ausencias):

```math
k = 8 \cdot 0{,}25 = 2\ \text{h/día}
\qquad
\text{A avanza } 3{,}5 + 2 = 5{,}5\ \text{h/día}
\qquad
48 / 5{,}5 \approx 8{,}7 \;\Rightarrow\; \textbf{9 días laborables}
```

Lucía tiene esas 2 h reservadas cada día mientras A está abierta, así que sus propias tareas disponen de
2 h menos y su carga sube $2/8 = 25$ puntos.

Si el fin planificado de A estaba a 10 días laborables, sin Lucía el desvío sería de **+4 días** (aviso de
retraso) y con Lucía de **−1 día** (sin aviso).

---

## 7. Resumen de umbrales

| Qué | Valor |
|---|---|
| Al límite | carga ≥ 85 % |
| Sobrecarga | carga > 100 % |
| «Vence pronto» | fin planificado en los próximos 5 días laborables del responsable |
| Retraso previsto | fin previsto posterior al planificado (desvío > 0) |
| Horizonte de la previsión | 2 años |
| Jornada por defecto | 8 h |
| Disponibilidad por defecto de *Viaje de proyecto* | 50 % (resto de ausencias, 0 %) |
