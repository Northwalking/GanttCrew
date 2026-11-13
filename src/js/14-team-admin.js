/* ---------- dirección del equipo: cambiar la contraseña de PM y traspasar el cargo ---------- */
// The PM password derives the key that encrypts the evaluations, the PM's private projects and the
// PM's diary. Changing it re-encrypts all three; handing the role over re-encrypts only what the team
// keeps (the evaluations) and removes the outgoing PM's personal data from the folder.
async function pmPasswordOk(pw) {
  const c = FILES[PMFILE]?.data.crypto;
  if (!c) return false;
  try {
    return (await dec(await deriveKey(pw, ub64(c.salt)), c.check)) === 'gantt-ok';
  } catch (e) {
    return false;
  }
}
async function removeFile(name) {
  try {
    await dirH.removeEntry(name);
  } catch (e) {}
  delete FILES[name];
}
async function setPmPassword(pw, stage) {
  // read with the old key whatever has to be written with the new one
  if (D.who !== ME.memberId || D.st === 'init' || D.st === 'loading') await dOpen();
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    key = await deriveKey(pw, salt),
    pmDiary = D.st === 'open' && !D.salt;
  EVKEY = key;
  if (FILES[EVFILE] || Object.keys(EVDATA).length) await writeEvals();
  if (FILES[PRFILE]) await writePriv();
  if (pmDiary) {
    D.key = key;
    await dWrite();
  }
  myRecords().crypto = { salt: b64(salt), check: await enc(key, 'gantt-ok') };
  if (stage) stage(myRecords()); // changes that must land in the same write as the new password
  await writeMine();
}
function openChangePw() {
  if (!ME.owner) return;
  openDlg(
    'Cambiar la contraseña de project manager',
    `<label class="full">Contraseña actual<input type="password" id="cO" autocomplete="current-password"></label>
     <label>Contraseña nueva<input type="password" id="cN" minlength="8" autocomplete="new-password"></label>
     <label>Repítela<input type="password" id="cN2" minlength="8" autocomplete="new-password"></label>
     <div class="full note warn">Las evaluaciones, tus proyectos privados y tu diario se vuelven a cifrar con la contraseña nueva. <b>Guárdala bien:</b> si la pierdes, no se pueden recuperar.</div>`,
    async () => {
      if (!(await pmPasswordOk($('#cO').value))) {
        toast('La contraseña actual no es correcta.');
        return false;
      }
      const pw = $('#cN').value;
      if (pw.length < 8 || pw !== $('#cN2').value) {
        toast('La contraseña debe tener 8 caracteres o más y coincidir.');
        return false;
      }
      await setPmPassword(pw);
      toast('Contraseña cambiada.');
    },
  );
  $('#mSave').textContent = 'Cambiar';
}
function openPmHandover() {
  if (!ME.owner) return;
  const me = S.members[ME.memberId],
    cands = activeMembers().filter((m) => m.id !== ME.memberId && !m.isPM),
    nPriv = Object.values(PRDATA.projects || {}).filter((p) => !p._del).length;
  if (!cands.length) return toast('Añade antes al equipo a la persona que será el nuevo project manager.');
  const body = `<div class="full note info">El nuevo project manager recibe todo lo compartido tal como está: proyectos, tareas, planificación, reuniones, festivos, ajustes y evaluaciones. Tu contraseña deja de servir y lo personal tuyo (proyectos privados y diario) no se traspasa.</div>
   <div class="sect">1 · Guarda tu copia personal</div>
   <div class="full"><p class="hint" style="margin:0 0 6px">Para conservar tu histórico. La copia incluye los proyectos y tareas del equipo y <b>tus proyectos privados</b>. Para consultarla, pon la herramienta en una carpeta tuya y usa «Restaurar desde copia…».</p>
     <label style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="hoEv" style="width:auto"> Incluir las evaluaciones del equipo (sin cifrar)</label>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn" id="hoBk">Descargar copia (.json)</button><button type="button" class="btn" id="hoDi">Descargar mi diario (Word)</button></div></div>
   <div class="sect">2 · Nuevo project manager</div>
   <label class="full">Persona<select id="hoM">${opt(
     cands.map((m) => [m.id, m.name]),
     '',
     '—',
   )}</select></label>
   <label>Su contraseña de project manager<input type="password" id="hoP" minlength="8" autocomplete="new-password"></label>
   <label>Repítela<input type="password" id="hoP2" minlength="8" autocomplete="new-password"></label>
   <div class="full hint" style="margin-top:-4px">Lo mejor es que la escriba la propia persona. Después puede cambiarla en «Cambiar la contraseña».</div>
   <div class="sect">3 · Tú, ${esc(me.name)}</div>
   <label class="full"><select id="hoStay"><option value="stay">Sigo en el equipo como miembro</option><option value="leave">Dejo el equipo</option></select></label>
   <label class="full hoL" style="display:none">Mi último día en el equipo<input type="date" id="hoL" value="${todayS()}"></label>
   <div class="sect">4 · Lo personal tuyo</div>
   <div class="full hint" style="margin:0">${nPriv ? `Tus <b>${nPriv}</b> proyecto(s) privado(s) se eliminan de la carpeta del equipo.` : 'No tienes proyectos privados.'}</div>
   <label class="full">Tu diario<select id="hoD"><option value="keep">Conservarlo con una contraseña solo mía</option><option value="del">Eliminarlo de la carpeta del equipo</option></select></label>
   <label class="full hoK">Contraseña para tu diario<input type="password" id="hoDp" minlength="8" autocomplete="new-password"></label>
   <div class="sect">5 · Confirmación</div>
   <label class="full">Tu contraseña actual de project manager<input type="password" id="hoO" autocomplete="current-password"></label>
   <label class="full" style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="hoOk" style="width:auto"> He guardado mi copia personal y entiendo que el traspaso no se puede deshacer.</label>`;
  openDlg('Traspasar la dirección del equipo', body, async () => {
    const mid = val('hoM'),
      pw = $('#hoP').value,
      leave = val('hoStay') === 'leave',
      keep = val('hoD') === 'keep' && !leave,
      dpw = $('#hoDp').value;
    if (!mid) {
      toast('Elige al nuevo project manager.');
      return false;
    }
    if (pw.length < 8 || pw !== $('#hoP2').value) {
      toast('La contraseña debe tener 8 caracteres o más y coincidir.');
      return false;
    }
    if (leave && !val('hoL')) {
      toast('Indica tu último día en el equipo.');
      return false;
    }
    if (keep && dpw.length < 8) {
      toast('La contraseña del diario debe tener 8 caracteres o más.');
      return false;
    }
    if (!$('#hoOk').checked) {
      toast('Marca la casilla de confirmación.');
      return false;
    }
    if (!(await pmPasswordOk($('#hoO').value))) {
      toast('Tu contraseña actual no es correcta.');
      return false;
    }
    await pmHandover({ mid, pw, leftOn: leave ? val('hoL') : '', diaryPw: keep ? dpw : '' });
    try {
      localStorage.removeItem(meKey());
    } catch (e) {}
    toast(`Traspaso hecho. ${S.members[mid].name} es ahora el project manager y entra con su contraseña.`);
    setTimeout(() => {
      location.hash = '';
      location.reload();
    }, 2500);
  });
  $('#mSave').textContent = 'Traspasar la dirección';
  $('#hoBk').onclick = () => exportBackup({ evals: $('#hoEv').checked });
  $('#hoDi').onclick = async () => {
    if (D.who !== ME.memberId || D.st !== 'open') await dOpen();
    const days = D.st === 'open' ? dDaysWith() : [];
    if (!days.length) return toast('Tu diario está vacío.');
    dDownload(
      dDocx(days, LAx('Diario de trabajo', 'Work diary')),
      `${LAx('Diario de trabajo', 'Work diary')} ${days[0]}_${days[days.length - 1]}.docx`,
    );
  };
  const upd = () => {
    const leave = val('hoStay') === 'leave';
    document.querySelector('.hoL').style.display = leave ? '' : 'none';
    if (leave) $('#hoD').value = 'del';
    $('#hoD').disabled = leave;
    document.querySelector('.hoK').style.display = val('hoD') === 'keep' && !leave ? '' : 'none';
  };
  $('#hoStay').onchange = upd;
  $('#hoD').onchange = upd;
  upd();
}
// Does the handover. The caller has already checked the current password.
async function pmHandover({ mid, pw, leftOn, diaryPw }) {
  const old = ME.memberId;
  // 1. the outgoing PM's diary: kept under a password of their own, or removed
  await dOpen();
  if (diaryPw && D.st === 'open') {
    D.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    D.key = await deriveKey(diaryPw, ub64(D.salt));
    await dWrite();
  } else if (!diaryPw) {
    clearTimeout(D.timer);
    await D.q;
    await removeFile(dFile());
  }
  Object.assign(D, { st: 'init', who: null, days: {}, key: null, salt: null, dirty: false });
  // 2. private projects never reach the next PM
  PRDATA = { projects: {}, tasks: {}, settings: {} };
  await writeQ;
  await removeFile(PRFILE);
  // 3. the evaluations move to the new password; the roles change in that same write, so the folder
  //    never holds the new password with the old PM still in charge
  const outgoing = { isPM: false };
  if (leftOn) outgoing.leftOn = leftOn;
  await setPmPassword(pw, (doc) => {
    doc.records.members = doc.records.members || {};
    for (const [id, ch] of [
      [old, outgoing],
      [mid, { isPM: true }],
    ]) {
      const o = { ...S.members[id], ...ch };
      delete o.id;
      doc.records.members[id] = { ...clean(o), _u: stamp(), _by: 'pm' };
    }
  });
  rebuild();
  // 4. the new PM takes over the projects in progress
  const ps = arr('projects')
    .filter((p) => p.ownerId === old && !p.priv && p.status !== 'closed' && p.status !== 'cancelled')
    .map((p) => {
      const o = { ...p, ownerId: mid };
      delete o.id;
      return [p.id, o];
    });
  if (ps.length) await saveMany('projects', ps);
  await writeQ;
}
