# Workload and forecast date: how they are calculated

[Español](carga-y-prevision.es.md) · User guide: [guide.en.md](guide.en.md)

This document explains, with the formulas the tool uses, where three things come from:

1. each person's **available hours** every day;
2. the **load** (occupancy percentage) and the *At the limit* and *Overload* warnings;
3. each task's **forecast end** and **forecast delay**.

On GitHub the formulas are rendered as maths; other viewers show them as LaTeX text.

---

## 1. Notation

| Symbol | Meaning | Where it is set |
|---|---|---|
| $p$ | a team member | |
| $d$ | a day | |
| $t$ | a task | |
| $T$ | today | |
| $J_p$ | available hours per day (working day). Default 8 | Member form |
| $L_p(d)$ | 1 if $d$ is a **regular working day** for $p$; 0 otherwise | See 2.1 |
| $a_p(d)$ | **availability** of $p$ that day because of absences, between 0 and 1 | See 2.2 |
| $X_p(d)$ | **extra working day** hours of $p$ that day (a Saturday, a holiday…) | Absences → Extra working day |
| $X^{t}_p(d)$ | the part of that extra day assigned to task $t$ | |
| $X^{\text{free}}_p(d)$ | the part of that extra day with no specific task | |
| $\mathrm{ded}_{t,p}$ | dedication (%) of $p$ on task $t$: the owner's or each collaborator's | Task form |
| $R_p(d)$ | meeting hours of $p$ that day | Meetings |

---

## 2. Available hours

### 2.1 Regular working day

$L_p(d) = 1$ when all four conditions hold:

- it is Monday to Friday;
- it is one of the days in their schedule (for example, an intern who only works Monday, Wednesday and Friday);
- it is not a holiday for their work centre (national, regional, local or company);
- it is not after their leave date.

### 2.2 Availability because of absences

```math
a_p(d) =
\begin{cases}
1 & \text{no absence that day} \\[4pt]
\dfrac{\text{availability of the absence}}{100} & \text{whole-day absence} \\[10pt]
\max\!\left(0,\; 1 - \dfrac{h_{\text{absence}}}{J_p}\right) & \text{absence by hours}
\end{cases}
```

The default availability of every absence type is 0 %, except *Project trip*, which is 50 %. It can be
changed in each absence.

### 2.3 Available hours in a day

```math
C_p(d) \;=\; J_p \cdot a_p(d) \cdot L_p(d) \;+\; X_p(d)
```

*Example:* Lucía, 8-hour working day, with a doctor's appointment from 10:00 to 12:00 (2 h):
$a = 1 - 2/8 = 0.75$, so $C = 8 \cdot 0.75 = 6$ h.

---

## 3. Load

### 3.1 Hours of a task for a person

For the owner and for each collaborator, on each day $d$ between the task's start and end:

```math
h_{t,p}(d) \;=\; J_p \cdot \frac{\mathrm{ded}_{t,p}}{100} \cdot L_p(d)
\;+\; X^{t}_p(d)
\;+\; \bigl(1 - L_p(d)\bigr) \cdot X^{\text{free}}_p(d) \cdot \frac{\mathrm{ded}_{t,p}}{100}
```

- The **end** is the planned end; for a finished task, its actual end.
- Days when the task was **paused** do not count, nor do **cancelled** tasks or tasks in **private projects**.
- An absence does **not** reduce $h$: the plan still asks for those hours. What goes down is $C$, so a week with absences shows a higher load. This is on purpose: it warns that the plan does not fit.
- The **Calendar** daily view does not show finished tasks; in the weekly load they count until their actual end.

### 3.2 Meeting hours

```math
R_p(d) = \sum_{\substack{m \,:\, p \,\text{attends}\, m \\ m \,\text{is on day}\, d}} \frac{\text{duration}_m\ (\text{min})}{60}
```

Only meetings on the person's working days (regular or extra) count. Weekend or holiday meetings are
optional and add nothing. A private meeting counts the same, even if you cannot see its details.

### 3.3 Load of a day

```math
H_p(d) = \sum_{t} h_{t,p}(d) + R_p(d)
\qquad\qquad
O_p(d) = 100 \cdot \frac{H_p(d)}{C_p(d)}\ \%
```

If $C_p(d) = 0$ and hours are planned, the occupancy is $\infty$.

In the **Calendar**, each day is coloured like this:

| Condition | Colour / state |
|---|---|
| weekend, holiday, outside their schedule or absent all day (no extra day) | grey, with its label |
| $O > 100\ \%$ | red · overload |
| $85\ \% \le O \le 100\ \%$ | orange · high load |
| there are tasks | green · tasks |
| meetings only | meetings |

### 3.4 Load of a week

The five days from **Monday to Friday** are added up:

```math
O^{\text{week}}_p = 100 \cdot \frac{\sum_{d=\text{Mon}}^{\text{Fri}} H_p(d)}{\sum_{d=\text{Mon}}^{\text{Fri}} C_p(d)}
\qquad\qquad
\text{peak} = \max_{d=\text{Mon}\dots\text{Fri}} O_p(d)
```

| $O^{\text{week}}$ | Level |
|---|---|
| $> 100\ \%$ | **Overload** (red) |
| $\ge 85\ \%$ | **At the limit** (orange) |
| $> 0\ \%$ | Available (green) |
| $0\ \%$ | Free |

This is the load shown in the Gantt **By person** view and in *Projects & team*.

### 3.5 Overload warning in the task form

When a task is edited, the tool computes $O^{\text{week}}$ for the owner and for each collaborator **with the
task as it is in the form**, over the weeks its dates cover (starting one week before today at most). It
takes the week with the highest load:

- above 100 %: an **overload** warning (red);
- from 85 %: an **at the limit** warning (orange).

You can still save.

---

## 4. Estimated and remaining hours

### 4.1 Estimated hours

If the task has **estimated hours**, they are used as they are. If the field is empty:

```math
E_t \;=\; J_{\text{owner}} \cdot \frac{\mathrm{ded}_{t}}{100} \cdot \max(1,\, n_{\text{owner}})
\;+\; \sum_{c\,\in\,\text{collaborators}} J_c \cdot \frac{\mathrm{ded}_{t,c}}{100} \cdot n_c
```

where $n_p$ is the number of regular working days of $p$ between the planned start and end.

### 4.2 Remaining hours

```math
P_t =
\begin{cases}
0 & \text{finished task} \\
\text{hours remaining} & \text{if the field is filled in} \\
E_t \cdot \left(1 - \dfrac{\text{progress}}{100}\right) & \text{if it is empty}
\end{cases}
```

---

## 5. Forecast end

The tool **simulates day by day**, from today up to two years ahead, how each person spends their hours on
their open tasks. A task's forecast end is the day its remaining hours reach zero.

### 5.1 Which tasks progress on a day

A task is **active** on day $d$ if:

- it is not finished, blocked, paused or cancelled;
- $d \ge \max(\text{planned start},\, T)$: it does not start before it was planned;
- every task it depends on has its forecast end **before** $d$ (unless the PM allowed it to progress).

### 5.2 Hours a person can give that day

```math
D_p(d) \;=\; \max\Bigl(0,\;
J_p \cdot a_p(d) \cdot L_p(d) \;+\; X^{\text{free}}_p(d)
\;-\; R_p(d) \;-\; K_p(d)\Bigr)
```

$K_p(d)$ are the hours $p$ has **reserved as a collaborator** on other people's tasks (5.4).

### 5.3 Sharing among their tasks: priority and dedication

Each task has a **pace** given by its owner's dedication:

```math
r_t = J_{\text{owner}} \cdot \frac{\mathrm{ded}_t}{100}
```

The hours $D_p(d)$ go first to the active **high-priority** tasks, then **medium**, then **low**. Within
each group $g$:

```math
\text{Dem}_g = \sum_{t \in g} r_t
\qquad
G_g = \min(D_p,\ \text{Dem}_g)
\qquad
g_t = G_g \cdot \frac{r_t}{\text{Dem}_g}
\qquad
D_p \leftarrow D_p - G_g
```

If there are hours to spare, each task gets its full pace ($g_t = r_t$); if not, every task in the group is
slowed down in the same proportion and lower priorities wait. Days when a task gets less than its pace are
counted as "overload or priority of other tasks".

### 5.4 Collaborators' help

For each collaborator $c$, on their regular working days between $\max(\text{start}, T)$ and the **planned
end**:

```math
k_{t,c}(d) = J_c \cdot \frac{\mathrm{ded}_{t,c}}{100} \cdot a_c(d)
```

Those hours are **reserved** in the collaborator's day (they make up their $K_c(d)$, reducing what they can
give to their own tasks) and **taken off** the task on the days it is active.

### 5.5 Task progress and forecast end

On each active day:

```math
P_t \;\leftarrow\; P_t \;-\; g_t \;-\; \sum_c k_{t,c}(d) \;-\; X^{t}_{\text{owner}}(d)
```

```math
\text{forecast end}_t = \text{first day } d \text{ when } P_t \le 0
```

If the task has no hours left, its forecast end is yesterday (or its start, if later). If it does not
finish within two years, it is shown with "no forecast date".

### 5.6 Forecast delay

```math
\text{slip}_t =
\begin{cases}
+\,\#\{\text{working days of } p \text{ in } (\text{planned end},\ \text{forecast end}]\} & \text{if it ends later} \\
-\,\#\{\text{working days of } p \text{ in } (\text{forecast end},\ \text{planned end}]\} & \text{if it ends earlier} \\
0 & \text{if they match}
\end{cases}
```

A positive slip raises the **"Forecast delay +N days"** alert. The task form explains the causes: waiting
for dependencies, holidays, absences, overload or priority of other tasks, meetings or "not started yet".

### 5.7 Private tasks

Tasks in the PM's private projects use a separate resource with the hours per day set in *Private
projects*, every day. They do not count in the team's load.

---

## 6. Worked example

Carlos has an 8-hour day and 1 h of meetings every day. He has two active **medium-priority** tasks:

| Task | Dedication | Pace $r_t$ | Remaining hours |
|---|---|---|---|
| A | 60 % | $8 \cdot 0.6 = 4.8$ h/day | 48 h |
| B | 60 % | 4.8 h/day | 60 h |

**Load of a day:**

```math
H = 4.8 + 4.8 + 1 = 10.6\ \text{h}
\qquad
O = 100 \cdot \frac{10.6}{8} = 132.5\ \% \;\Rightarrow\; \text{Overload}
```

**Sharing in the forecast:**

```math
D = 8 - 1 = 7\ \text{h}
\qquad
\text{Dem} = 9.6
\qquad
G = \min(7,\ 9.6) = 7
\qquad
g_A = g_B = 7 \cdot \frac{4.8}{9.6} = 3.5\ \text{h/day}
```

Task A would take $48 / 3.5 \approx 13.7$, that is **14 working days**.

**With Lucía collaborating on A at 25 %** (8-hour day, no absences):

```math
k = 8 \cdot 0.25 = 2\ \text{h/day}
\qquad
\text{A progresses } 3.5 + 2 = 5.5\ \text{h/day}
\qquad
48 / 5.5 \approx 8.7 \;\Rightarrow\; \textbf{9 working days}
```

Lucía has those 2 h reserved every day within A's planned dates, so her own tasks get 2 h less and her load
goes up by $2/8 = 25$ points.

If A's planned end was 10 working days away, without Lucía the slip would be **+4 days** (delay alert) and
with Lucía **−1 day** (no alert).

---

## 7. Thresholds at a glance

| What | Value |
|---|---|
| At the limit | load ≥ 85 % |
| Overload | load > 100 % |
| "Due soon" | planned end within the owner's next 5 working days |
| Forecast delay | forecast end later than planned (slip > 0) |
| Forecast horizon | 2 years |
| Default working day | 8 h |
| Default availability of *Project trip* | 50 % (other absences, 0 %) |
