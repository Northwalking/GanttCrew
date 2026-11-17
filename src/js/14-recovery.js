/* ---------- código de recuperación (contraseña de PM y contraseña de cada diario) ----------
   When a password is created, the tool also gives a recovery code (20 random characters, 100 bits)
   that is shown once and never stored. The data file keeps the password encrypted with a key derived
   from that code, so whoever holds the code can recover the password and set a new one; nobody else
   can, not even the PM for a member's diary. A new password or a new code invalidates the old code. */
const RC_ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function recNew() {
  const b = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(b, (x) => RC_ABC[x & 31])
    .join('')
    .match(/.{5}/g)
    .join('-');
}
// tolerant reading: lower case, spaces, dashes, and O/I/L typed for 0/1
const recNorm = (c) =>
  String(c || '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/[^0-9A-Z]/g, '');
async function recBox(code, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64(salt), box: await enc(await deriveKey(recNorm(code), salt), pw), on: todayS() };
}
async function recOpen(code, rec) {
  if (!rec || recNorm(code).length !== 20) return null;
  try {
    const pw = await dec(await deriveKey(recNorm(code), ub64(rec.salt)), rec.box);
    return typeof pw === 'string' ? pw : null;
  } catch (e) {
    return null;
  }
}
const pmRec = () => FILES[PMFILE]?.data.crypto?.rec || null;

// Shows a new code once. kind: 'pm' | 'diary'
function showRecCode(code, kind) {
  const pm = kind === 'pm';
  openDlg(
    '🔑 Código de recuperación',
    `<div class="full note warn"><b>Guárdalo ahora:</b> no se vuelve a mostrar y la herramienta no lo guarda.</div>
     <p class="full hint" style="margin:0">${
       pm
         ? 'Si olvidas la contraseña de project manager, este código te permite poner una nueva sin perder las evaluaciones, los proyectos privados ni tu diario.'
         : 'Si olvidas la contraseña de tu diario, este código te permite poner una nueva sin perder lo escrito.'
     }</p>
     <div class="full rcode" id="rcV" data-notr>${code}</div>
     <div class="full" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="rcCp">Copiar</button><button type="button" class="btn" id="rcDl">Descargar (.txt)</button></div>
     <p class="full hint" style="margin:0">Guárdalo fuera de la carpeta compartida: en un gestor de contraseñas, impreso o en un archivo personal. ${
       pm
         ? 'Quien tenga el código puede hacerse con el papel de project manager.'
         : 'Quien tenga el código puede leer tu diario.'
     }</p>
     <label class="full" style="flex-direction:row;align-items:center;gap:8px;font-weight:400"><input type="checkbox" id="rcOk" style="width:auto"> Lo he guardado en un lugar seguro</label>`,
    async () => {
      if (!$('#rcOk').checked) {
        toast('Marca la casilla cuando lo hayas guardado.');
        return false;
      }
    },
  );
  $('#mSave').textContent = 'Hecho';
  $('#mCancel').style.display = 'none';
  $('#rcCp').onclick = () =>
    navigator.clipboard?.writeText(code).then(
      () => toast('Código copiado.'),
      () => toast('No se pudo copiar: selecciónalo y cópialo a mano.'),
    );
  $('#rcDl').onclick = () => {
    const who = S.members[ME.memberId]?.name || '';
    const txt = (
      LANG === 'en'
        ? [
            'GanttCrew — recovery code',
            pm ? 'For: the project manager password' : 'For: the work diary of ' + who,
            'Team folder: ' + (dirH?.name || ''),
            'Created: ' + fmt(todayS()),
            '',
            code,
            '',
            'Keep it private. Whoever has this code can set a new password.',
          ]
        : [
            'GanttCrew — código de recuperación',
            pm ? 'Para: la contraseña de project manager' : 'Para: el diario de trabajo de ' + who,
            'Carpeta del equipo: ' + (dirH?.name || ''),
            'Creado: ' + fmt(todayS()),
            '',
            code,
            '',
            'Guárdalo en privado. Quien tenga este código puede poner una contraseña nueva.',
          ]
    ).join('\r\n');
    dDownload(
      new Blob([txt], { type: 'text/plain;charset=utf-8' }),
      (LANG === 'en' ? 'recovery-code-' : 'codigo-recuperacion-') + (pm ? 'pm' : 'diario') + '.txt',
    );
  };
}

/* ----- project manager ----- */
// Settings: a new code (the previous one stops working). Needs the current password.
function openPmRecNew() {
  if (!ME.owner) return;
  const had = !!pmRec();
  openDlg(
    had ? 'Crear un código de recuperación nuevo' : 'Crear el código de recuperación',
    `${had ? '<div class="full note info">El código anterior deja de servir.</div>' : ''}
     <label class="full">Contraseña de project manager<input type="password" id="rcPw" autocomplete="current-password"></label>`,
    async () => {
      const pw = $('#rcPw').value;
      if (!(await pmPasswordOk(pw))) {
        toast('La contraseña no es correcta.');
        return false;
      }
      const code = recNew();
      myRecords().crypto = { ...myRecords().crypto, rec: await recBox(code, pw) };
      await writeMine();
      setTimeout(() => showRecCode(code, 'pm'), 30);
    },
  );
  $('#mSave').textContent = 'Crear';
}
// Login screen: code + new password. Unlocks with the recovered password, then sets the new one.
function pmRecoverForm(box, id) {
  box.innerHTML = `<p class="hint" style="margin:0 0 8px">Escribe el código de recuperación que guardaste al crear la contraseña y elige una contraseña nueva.</p>
   <label>Código de recuperación<input type="text" id="wRc" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" data-notr></label>
   <label>Contraseña nueva<input type="password" id="wN" minlength="8" autocomplete="new-password"></label>
   <label>Repítela<input type="password" id="wN2" minlength="8" autocomplete="new-password"></label>
   <div id="wMsg" class="lmsg"></div><button class="btn pri" id="wRgo" style="width:100%;padding:9px">Recuperar y entrar</button>`;
  $('#wRc').focus();
  $('#wRgo').onclick = async () => {
    const msg = (t) => ($('#wMsg').textContent = t);
    const pw = $('#wN').value;
    if (pw.length < 8 || pw !== $('#wN2').value)
      return msg('La contraseña debe tener 8 caracteres o más y coincidir.');
    const rec = pmRec();
    if (!rec)
      return msg(
        'Este equipo no tiene código de recuperación: la contraseña no se puede recuperar. Consulta «Traspasos y copias de seguridad».',
      );
    $('#wRgo').disabled = true;
    const old = await recOpen($('#wRc').value, rec);
    const ok = old != null && (await unlockPM(old));
    $('#wRgo').disabled = false;
    if (!ok) return msg('El código no es correcto.');
    ME.memberId = id;
    ME.owner = true;
    try {
      localStorage.setItem(meKey(), id);
    } catch (e) {}
    startApp();
    const code = await setPmPassword(pw);
    toast('Contraseña nueva guardada.');
    showRecCode(code, 'pm');
  };
}

/* ----- diary ----- */
// New password for an open diary: new salt and key, and a new code
async function dSetPw(pw, remember) {
  D.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  D.key = await deriveKey(pw, ub64(D.salt));
  const code = recNew();
  D.rec = await recBox(code, pw);
  await dWrite();
  await kvSet('dkey-' + ME.memberId, remember ? D.key : null);
  return code;
}
// 'norec' when the diary has no code; false when the code is wrong; the new code on success
async function dRecover(code, pw, remember) {
  const r = await dRead();
  if (!r?.j.salt) return false;
  if (!r.j.rec) return 'norec';
  const old = await recOpen(code, r.j.rec);
  if (old == null) return false;
  D.salt = r.j.salt;
  if (!(await dDecrypt(await deriveKey(old, ub64(D.salt)), r))) return false;
  return dSetPw(pw, remember);
}
function dRecoverForm() {
  const f = $('#dPwF');
  f.innerHTML = `<p class="hint" style="margin:0">Escribe el código de recuperación que guardaste al crear el diario y elige una contraseña nueva.</p>
   <label>Código de recuperación<input type="text" id="dRc" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" data-notr></label>
   <label>Contraseña nueva<input type="password" id="dPw" required minlength="8" autocomplete="new-password"></label>
   <label>Repítela<input type="password" id="dPw2" required minlength="8" autocomplete="new-password"></label>
   <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" id="dRem" style="width:auto"> Recordar en este navegador (no la marques en un ordenador compartido)</label>
   <div style="display:flex;gap:8px"><button class="btn pri">Recuperar el diario</button><button type="button" class="btn" id="dRcBack">Volver</button></div>`;
  $('#dRc').focus();
  $('#dRcBack').onclick = () => dRender();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const pw = $('#dPw').value;
    if (pw.length < 8 || pw !== $('#dPw2').value)
      return toast('La contraseña debe tener 8 caracteres o más y coincidir.');
    const res = await dRecover($('#dRc').value, pw, $('#dRem').checked);
    if (res === 'norec') return toast('Este diario no tiene código de recuperación: no se puede recuperar.');
    if (!res) return toast('El código no es correcto.');
    dRender(true);
    toast('Contraseña nueva guardada.');
    showRecCode(res, 'diary');
  };
}
// Open diary: a new code (needs the diary password; the previous code stops working)
function openDiaryRecNew() {
  if (D.st !== 'open' || !D.salt) return;
  const had = !!D.rec;
  openDlg(
    had ? 'Crear un código de recuperación nuevo' : 'Crear el código de recuperación',
    `${had ? '<div class="full note info">El código anterior deja de servir.</div>' : ''}
     <label class="full">Contraseña del diario<input type="password" id="rcPw" autocomplete="current-password"></label>`,
    async () => {
      const pw = $('#rcPw').value;
      try {
        const k = await deriveKey(pw, ub64(D.salt));
        if ((await dec(k, (await dRead()).j.check)) !== 'diario-ok') throw 0;
      } catch (e) {
        toast('La contraseña no es correcta.');
        return false;
      }
      const code = recNew();
      D.rec = await recBox(code, pw);
      await dWrite();
      setTimeout(() => showRecCode(code, 'diary'), 30);
    },
  );
  $('#mSave').textContent = 'Crear';
}
