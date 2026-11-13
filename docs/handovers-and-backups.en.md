# Handovers and backups

[Versión en español](traspasos-y-copias.es.md) · [User guide](guide.en.md)

This guide explains, step by step, how to keep copies of the data and how to change people without losing
the history: a member leaving, handing over a task, and handing over the team lead to another project
manager (PM).

Read it all before handing over the team lead: it is the only operation that **cannot be undone**.

---

## 1. Where the data lives

Everything is in the `datos` folder, next to the tool's file:

| File | Contents | Written by | Encrypted |
|---|---|---|---|
| `equipo-pm.json` | Projects, team, settings, holidays and what the PM records | The PM | No |
| `miembro-<id>.json` | What each member records: progress of their tasks, absences, meetings | Each member | No |
| `evaluaciones-cifradas.json` | Quality evaluations | The PM | Yes, with the PM password |
| `privado-pm.json` | The PM's private projects | The PM | Yes, with the PM password |
| `diario-<id>.json` | Each person's work diary | Each person | Yes, with their own key |
| `thunderbird-<name>.ics` | Invitations accepted in Thunderbird | Thunderbird | No |
| `calendario-….ics` | Calendars to subscribe to | The tool | No |

Two important consequences:

- **Encrypted data depends on a password nobody can reset.** If the PM password is lost, the evaluations and
  private projects are lost. If someone forgets their diary password, that diary is lost.
- **The PM's diary** is encrypted with the PM password; each member's, with their diary password.

---

## 2. Backups

There are four ways to keep a copy. They complement each other; use at least the first two.

### 2.1 Full backup from the tool (PM)

This is the main backup. It saves everything the team manages in one file.

1. Sign in as PM.
2. Go to **Projects & team** and scroll to **Backup 🔒**.
3. Click **Download backup (.json)**. A file `copia-gantt-YYYY-MM-DD.json` is downloaded.
4. Move it somewhere **private and outside the shared folder** (your personal drive, an external disk).

**Included:** projects, tasks, team, meetings, absences, holidays, extra working days, settings, your private
projects and **the evaluations, unencrypted**.

**Not included:** the diaries (they belong to each person) and the Thunderbird files.

**When to do it:**
- once a week, or after a long planning session;
- **before installing a new version** of the tool;
- **before handing over the team lead**, and right after (done by the new PM);
- before deleting a project or restoring another backup.

> As it carries the evaluations unencrypted, treat this file as confidential.

### 2.2 Copy of the whole `datos` folder

The most complete copy: it also includes the diaries (encrypted) and the Thunderbird files.

1. Ask the team not to edit for a minute and wait for the cloud drive to finish syncing.
2. In the file explorer, copy the whole `datos` folder and paste it somewhere private, with the date in the
   name (for example `datos 2026-11-13`).

To recover it, replace the `datos` folder with the copy. Encrypted files still need the passwords in use
**on the day of the copy**.

### 2.3 Version history of the cloud drive

Useful to recover **one specific file** that was damaged or deleted.

1. In OneDrive (web) or the file explorer, right-click the file, for example `equipo-pm.json`.
2. Choose **Version history** and restore the version of the day you need.
3. In the tool, click ↻ to read the folder again.

### 2.4 Each person's diary

Everyone saves their own. Nobody else can do it for them.

1. **Diary** tab → **Download…**
2. Choose the period (**The whole diary** for a full copy) and the format, **Word (.docx)** or **Text**.
3. Click **Download**. The downloaded file is **not encrypted**: keep it somewhere private.

To load it back into the tool: **Diary → Import…** and choose that file. Notes that already exist with the
same text are not duplicated.

### 2.5 Restoring a `.json` backup into the team

1. Sign in as PM and first make a backup of the current state (2.1), just in case.
2. **Projects & team → Backup → Restore from backup…** and choose the file.
3. Check the Gantt and ask the team to reload the page (F5).

What happens: the items contained in the backup go back to how they were that day, **even if someone changed
them later**. What was created after the backup is kept. The evaluations and private projects in the backup
are encrypted again with your current password.

### 2.6 Browsing a backup in a separate folder (personal copy)

Useful to keep and browse your history without touching the team's data, for example after stepping down.

1. Create a new folder **of your own** (not the team's) with the tool's file and an empty `datos` folder.
2. Open the tool with Edge or Chrome and choose that `datos` folder.
3. In **Empty folder: create the team**, type your name and a new password, and **untick** «Load the sample
   data».
4. Go to **Projects & team → Backup → Restore from backup…** and choose your `.json` copy.
5. You will have the Gantt, the calendar, the tasks and your private projects as they were on the day of the
   copy — and the evaluations, if the copy included them.
6. For your diary: **Diary → Import…** and choose the Word file you downloaded.

---

## 3. A member leaves the team

**Before their last day**

1. Ask them to download their diary if they want to keep it (2.4). Nobody else can open it.
2. Go through their open tasks with them and update the real progress of each.

**The PM records the leave**

3. **Projects & team →** click their name under **Team**.
4. In **Leave date**, enter their **last day in the team** and click **Save**.
5. The list of that person's **Open tasks** appears. On each one, click **Hand over…** and follow section 4.
   You can close the list and come back later: tasks not handed over show in the 🔔 bell as «Owner has left».

**What changes from the day after the leave date**

- They are not offered in «Who are you?» or in the lists to assign tasks, absences or meetings.
- They do not count in the load or forecast dates, and drop out of later recurring meetings.
- Their history is kept under their name: finished tasks, meetings, absences and evaluations.

**Afterwards**

6. If they were a participant in ongoing projects, remove them in each project's form if you want them to
   stop being listed.
7. Their `diario-<id>.json` file can be deleted from the `datos` folder once they no longer need it.
8. Remove their access to the shared folder.

**If they come back:** clear the leave date in their form. Everything is restored.

> Do not remove the member with the **Delete** button: the reference in their history would be lost. The tool
> prevents it while they have tasks or absences.

---

## 4. Handing over a task to someone else

Use it when someone leaves a task halfway and another person continues it. If the task has not started, or
you want to pass it whole, just change the **Owner** in its form.

1. Open the task and, under **Status**, click **⇄ Hand over…** (only the PM sees it, and only when the task is
   active: if it is paused, resume it first).
2. **New owner:** the person who continues.
3. **Last day of** the current owner: up to that date the work counts under their name.
4. **Start of the continuation:** the new person's first working day is proposed; you can change it.
5. **Planned end:** the original task's end is proposed. If it is no longer possible, the tool proposes the
   one that is needed.
6. **Hours remaining to hand over:** check the figure; it is what was left to do.
7. **Dedication:** the share of their working time the new person will spend.
8. Read the check line: it tells how many working days and hours the new person has in that period. If
   **«It will not make the planned end»** shows in red, extend the date or the dedication.
9. Click **Hand over**.

**What you get**

| | First part | Continuation |
|---|---|---|
| Owner | The previous owner | The new person |
| Dates | Original start → last day | Start of the continuation → planned end |
| Status | Done, with the label «Handed over to …» | To do |
| Hours | Those already done | Those remaining |
| In the Gantt | Label «⇄ part 1» | Label «⇄ continuation», linked to the previous one |

- Tasks that depended on the original now depend on the continuation.
- The first part can be evaluated like any finished task.
- Each form has a link to jump to the other.

**Example.** A task from 1 June to 22 December, owned by Carlos, who leaves on 5 September. Handed over to
Iván with last day 5 September: Carlos's task runs from 1 June to 5 September, done; Iván gets the
continuation from 7 September (his first working day) to 22 December, with the hours remaining.

**If you make a mistake:** there is no undo button. Open the continuation and fix the owner, dates or hours;
or delete it, and in the first part set the status back to «In progress», restore the original planned end
and clear the actual end date.

---

## 5. Recurring meetings when a person changes

- **Whoever leaves** drops out of the recurring meetings after their date automatically.
- **To add their replacement from a date on:** open that day's meeting, choose **This and following ones**
  under **Apply the changes to**, tick the new person and save. Earlier ones do not change.
- **For several meetings at once:** **Meetings → Select several**, filter by project and «From today», and
  use **Add as attendees** or **Remove from attendees**.
- **Project participants** meetings follow the participants: just change the list in the project's form.

---

## 6. Changing the project manager password

1. Check that the cloud drive is synced and that no other window of the tool is open as PM.
2. **Projects & team → Team lead 🔒 → Change the password…**
3. Type the current password and the new one twice (8 characters or more). Click **Change**.
4. Wait for the «Password changed» notice.

The evaluations, your private projects and your diary are encrypted again with the new one. Members notice
nothing. **Write the new password down somewhere safe**: nobody can reset it.

---

## 7. Handing over the team lead to another PM

It is done by **the outgoing PM**, signed in. Ideally the new PM is present to type their password.

### 7.1 Before you start

- [ ] The new PM is already a team member. If not, add them in **Projects & team → + Member**.
- [ ] The cloud drive is synced and the rest of the team is not editing.
- [ ] You have updated the progress of your tasks. Those you will not continue, hand over (section 4) or
      leave: they stay under your name and the new PM will see them in the alerts if you leave the team.
- [ ] You have decided what to do with your **private projects**: they are removed from the team folder in
      the handover. If one should continue in the team, untick «Private (only me)» on it first.
- [ ] You have your current password at hand.

### 7.2 The handover, step by step

Go to **Projects & team → Team lead 🔒 → Hand over the team lead…**

**Step 1 · Save your personal copy.** Do it now: you will not be able to later.
- Tick **Include the team's evaluations** only if you need them and your organisation's rules allow it.
- Click **Download backup (.json)**: it holds the team data and your private projects.
- Click **Download my diary (Word)**.
- Check both files are in your downloads folder and move them somewhere private.

**Step 2 · New project manager.** Choose the person. They type their password twice (8 characters or more).
If they are not present, set a temporary one and give it to them through a safe channel: they must change it
as soon as they sign in (section 6).

**Step 3 · You.** Choose **I stay in the team as a member** or **I am leaving the team**; in that case enter
your last day.

**Step 4 · Your personal data.**
- Your private projects are removed from the team folder.
- Your diary: **Keep it with a password of my own** (type it; it is the one you will use as a member) or
  **Remove it from the team folder**. If you leave the team, it is removed.

**Step 5 · Confirmation.** Type your current password, tick the box and click **Hand over the lead**. The
page reloads on its own and asks «Who are you?».

### 7.3 What happens to each thing

| Data | After the handover |
|---|---|
| Projects, tasks, planning, meetings, absences, holidays, settings | Go to the new PM as they are |
| Evaluations | Encrypted again with the new PM's password; they see all of them |
| Ongoing projects you owned | Now owned by the new PM |
| Your tasks | Stay under your name |
| Your PM password | Stops working |
| Your private projects | Removed from the folder (you have them in your personal copy) |
| Your diary | Kept under your own password, or removed |
| The new PM's diary | Unchanged: they keep opening it with their diary password |

### 7.4 After the handover

**The new PM:**
1. In «Who are you?», chooses their name and signs in with their password.
2. Checks they see the **Performance** tab with the evaluations and the **Team lead** card.
3. If the password was temporary, changes it (section 6).
4. Makes a **full backup** (2.1): the first one with their password.
5. Checks the 🔔 bell: if the outgoing PM has left the team, their open tasks show as «Owner has left», to be
   handed over.

**The outgoing PM, if staying in the team:**
1. Signs in by choosing their name, now without a password.
2. Opens **Diary** with the password chosen in step 4.

**The whole team:** reload the page (F5).

### 7.5 If something goes wrong

- **The page closed in the middle of the handover.** Sign in again: if your old password still works, the
  handover did not happen and you can repeat it. If it does not, try the new PM's. If neither opens the
  evaluations, restore `equipo-pm.json` and `evaluaciones-cifradas.json` with the version history (2.3) to
  the time before the handover.
- **The new PM forgot their password.** It cannot be recovered. With a copy of the `datos` folder (2.2) from
  before the handover, the outgoing PM can go back to that state with the old password and repeat it.
- **You left without handing over.** Shared data is not encrypted and is kept, but the evaluations cannot be
  recovered without your password. The team needs you to do the handover, or to give them the password to
  do it themselves.

---

## 8. Summary: which copy for which case

| Situation | What to do first |
|---|---|
| Normal use | Full backup (2.1) every week |
| Installing a new version | Full backup (2.1) |
| A member leaves | They download their diary (2.4) |
| Changing the PM password | Full backup (2.1) |
| Handing over the team lead | Copy of the `datos` folder (2.2), personal copy and diary (step 1 of the handover) |
| Restoring a backup | Full backup of the current state (2.1) |
