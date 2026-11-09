/* ---------- arrastre de barras ---------- */
function bindDrag() {
  const gw = $('#gw');
  if (!gw) return;
  gw.addEventListener('pointerdown', (e) => {
    const bar = e.target.closest('.bar[data-id]');
    if (!bar || e.button !== 0) return;
    const id = bar.dataset.id,
      t = S.tasks[id];
    if (!t) return;
    if (!canEditTask(t)) {
      openTask(id);
      return;
    }
    e.preventDefault();
    const rz = e.target.classList.contains('rz'),
      x0 = e.clientX,
      l0 = bar.offsetLeft,
      w0 = bar.offsetWidth;
    let moved = false,
      dd = 0;
    dragging = true;
    bar.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 3) moved = true;
      dd = Math.round(dx / UI.ppd);
      if (rz) bar.style.width = Math.max(UI.ppd, w0 + dd * UI.ppd) + 'px';
      else bar.style.left = l0 + dd * UI.ppd + 'px';
    };
    const up = () => {
      bar.removeEventListener('pointermove', mv);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      dragging = false;
      if (!moved) {
        if (pendingRender) render();
        openTask(id);
        return;
      }
      if (dd === 0) {
        render();
        return;
      }
      const s = dn(t.start),
        en = dn(t.end),
        nt = { ...t };
      if (rz) nt.end = iso(Math.max(s, en + dd));
      else {
        nt.start = iso(s + dd);
        nt.end = iso(en + dd);
      }
      nt.updatedAt = new Date().toISOString();
      saveTask(id, nt);
      if (pendingRender) render();
    };
    bar.addEventListener('pointermove', mv);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
}

/* ---------- render ---------- */
function readHash() {
  const v = location.hash.slice(1);
  UI.view = ['gantt', 'equipo', 'tareas', 'reuniones', 'cumplimiento', 'ausencias', 'ajustes'].includes(v)
    ? v
    : 'gantt';
}
window.addEventListener('hashchange', () => {
  readHash();
  render();
});
function render() {
  if (!started && dirH) {
    return;
  }
  if (dragging || $('#modal').classList.contains('show')) {
    pendingRender = true;
    return;
  }
  pendingRender = false;
  resetCal();
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.v === UI.view));
  const old = $('#gw');
  const sl = old?.scrollLeft,
    st = old?.scrollTop;
  const keep = old && old.dataset.v === UI.view && old.dataset.y == UI.year && old.dataset.z == UI.ppd;
  const V = {
    gantt: vGantt,
    equipo: vCalendario,
    tareas: vTareas,
    reuniones: vReuniones,
    cumplimiento: vCumplimiento,
    ausencias: vAusencias,
    ajustes: vAjustes,
  }[UI.view];
  $('#main').innerHTML = V();
  const gw = $('#gw');
  if (gw) {
    gw.dataset.v = UI.view;
    gw.dataset.y = UI.year;
    gw.dataset.z = UI.ppd;
    if (keep) {
      gw.scrollLeft = sl;
      gw.scrollTop = st;
    } else {
      firstGantt = false;
      const R = range(),
        T = todayN();
      if (
        UI.calMonth &&
        +UI.calMonth.slice(0, 4) === UI.year &&
        !(T >= R.s && T < R.s + R.days && UI.calMonth === todayS().slice(0, 7))
      )
        scrollToMonth(+UI.calMonth.slice(5, 7) - 1);
      else if (T >= R.s && T < R.s + R.days) scrollToday();
      else gw.scrollLeft = 0;
    }
    bindDrag();
    bindTimeTools();
  }
  bindFilters();
  const m = $('#main');
  m.querySelectorAll('[data-task]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openTask(el.dataset.task);
    }),
  );
  m.querySelectorAll('[data-meet]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openMeeting(el.dataset.meet);
    }),
  );
  if (UI.view === 'equipo') bindCalendar(m);
  m.querySelectorAll('[data-editproj]').forEach(
    (el) => (el.onclick = () => openProject(el.dataset.editproj)),
  );
  m.querySelectorAll('[data-editmem]').forEach((el) => (el.onclick = () => openMember(el.dataset.editmem)));
  m.querySelectorAll('[data-tog]').forEach(
    (el) =>
      (el.onclick = () => {
        const p = el.dataset.tog;
        UI.collapsed.has(p) ? UI.collapsed.delete(p) : UI.collapsed.add(p);
        render();
      }),
  );
  m.querySelectorAll('[data-addin]').forEach(
    (el) => (el.onclick = () => openTask(null, { projectId: el.dataset.addin })),
  );
  const on = (id, f) => {
    const e = $('#' + id);
    if (e) e.onclick = f;
  };
  on('addTask2', () => openTask(null));
  on('addMeet2', () => openMeeting(null));
  on('impIcs', openImportICS);
  on('addProj', () => openProject(null));
  on('addMem', () => openMember(null));
  if (UI.view === 'reuniones') {
    on('yPrev', () => {
      UI.year--;
      if (UI.meetPeriod !== 'all' && UI.meetPeriod !== 'future')
        UI.meetPeriod = UI.year + UI.meetPeriod.slice(4);
      render();
    });
    on('yNext', () => {
      UI.year++;
      if (UI.meetPeriod !== 'all' && UI.meetPeriod !== 'future')
        UI.meetPeriod = UI.year + UI.meetPeriod.slice(4);
      render();
    });
    $('#perSel').onchange = (e) => {
      UI.meetPeriod = e.target.value;
      render();
    };
    $('#mmSel').onchange = (e) => {
      UI.meetMember = e.target.value;
      render();
    };
    {
      const mq = $('#mQ');
      let tm;
      mq.oninput = () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          UI.meetQ = mq.value;
          render();
          const n = $('#mQ');
          n.focus();
          n.setSelectionRange(n.value.length, n.value.length);
        }, 250);
      };
    }
    on('mSelT', () => {
      UI.meetSel = !UI.meetSel;
      UI.meetPick = new Set();
      render();
    });
    m.querySelectorAll('[data-msel]').forEach(
      (el) =>
        (el.onclick = () => {
          const id = el.dataset.msel;
          UI.meetPick.has(id) ? UI.meetPick.delete(id) : UI.meetPick.add(id);
          render();
        }),
    );
    on('mSelAll', () => {
      for (const el of m.querySelectorAll('[data-msel]')) UI.meetPick.add(el.dataset.msel);
      render();
    });
    on('mSelNone', () => {
      UI.meetPick = new Set();
      render();
    });
    on('mSelEdit', () => openBulkMeetings([...UI.meetPick]));
  }
  if (UI.view === 'ausencias') {
    on('yPrev', () => {
      UI.year--;
      render();
    });
    on('yNext', () => {
      UI.year++;
      render();
    });
    $('#aMem').onchange = (e) => {
      UI.member = e.target.value;
      render();
    };
    on('addAbs', () => openAbsence(null));
    on('addExt', () => openExtra(null));
    m.querySelectorAll('[data-ext]').forEach((r) => (r.onclick = () => openExtra(r.dataset.ext)));
    on('addHol', () => openHoliday(null));
    on('copyHol', copyHolidays);
    on('impHol', openImportHolidays);
    m.querySelectorAll('[data-abs]').forEach((el) => (el.onclick = () => openAbsence(el.dataset.abs)));
    m.querySelectorAll('[data-hol]').forEach((el) => (el.onclick = () => openHoliday(el.dataset.hol)));
  }
  if (UI.view === 'tareas')
    $('#sortSel').onchange = (e) => {
      UI.sort = e.target.value;
      render();
    };
  {
    const rows = () =>
      [...document.querySelectorAll('#ptT tr[data-pt]')].map((r) => ({
        id: r.dataset.pt,
        name: r.querySelector('.ptN').value.trim(),
        color: r.querySelector('.ptC').value,
      }));
    const put = async (list, msg) => {
      if (list.some((t) => !t.name)) {
        toast('Ningún tipo puede quedar sin nombre.');
        return;
      }
      const names = list.map((t) => norm(t.name));
      if (new Set(names).size !== names.length) {
        toast('Hay dos tipos con el mismo nombre.');
        return;
      }
      if (await save('config', 'settings', { ...(S.config.settings || {}), ptypes: list })) toast(msg);
    };
    on('savePt', () => put(rows(), 'Tipos de proyecto guardados.'));
    on('addPt', () => {
      const T = $('#ptT');
      if (!T.querySelector('tr[data-pt]')) T.innerHTML = '<tbody></tbody>';
      const tr = document.createElement('tr');
      tr.dataset.pt = 'pt-' + newId();
      tr.innerHTML = `<td style="width:46px"><input type="color" class="ptC" value="${PALETTE[T.rows.length % PALETTE.length]}" style="height:30px;width:40px;border:1px solid var(--line);border-radius:6px;padding:1px"></td><td><input type="text" class="ptN" placeholder="Nombre del nuevo tipo" style="width:100%"></td><td class="mut" style="width:110px">nuevo</td><td style="width:80px"><button class="btn sm ptDel" title="Quitar">✕</button></td>`;
      (T.tBodies[0] || T).appendChild(tr);
      tr.querySelector('.ptDel').onclick = () => tr.remove();
      tr.querySelector('.ptN').focus();
    });
    document.querySelectorAll('#ptT .ptDel').forEach(
      (b) =>
        (b.onclick = () => {
          const id = b.closest('tr').dataset.pt;
          put(
            rows().filter((t) => t.id !== id),
            'Tipo quitado.',
          );
        }),
    );
    document.querySelectorAll('#ptT .ptUp').forEach(
      (b) =>
        (b.onclick = () => {
          const l = rows(),
            i = l.findIndex((t) => t.id === b.closest('tr').dataset.pt);
          [l[i - 1], l[i]] = [l[i], l[i - 1]];
          put(l, 'Orden guardado.');
        }),
    );
  }
  on('saveRb', async () => {
    const r = [1, 2, 3, 4, 5].map((i) => $('#rb' + i).value.trim() || RUBRIC[i - 1]);
    if (await save('config', 'settings', { ...(S.config.settings || {}), rubric: r }))
      toast('Escala guardada.');
  });
  on('resetRb', async () => {
    const o = { ...(S.config.settings || {}) };
    delete o.rubric;
    if (await save('config', 'settings', o)) toast('Textos restaurados.');
  });
  on('saveW', async () => {
    const w = {
      plazo: +$('#wPlazo').value || 0,
      calidad: +$('#wCal').value || 0,
      alcance: +$('#wAlc').value || 0,
      retrabajo: +$('#wRet').value || 0,
    };
    if (!(w.plazo + w.calidad + w.alcance + w.retrabajo)) {
      toast('Al menos un peso debe ser mayor que 0.');
      return;
    }
    if (await save('config', 'settings', { ...(S.config.settings || {}), weights: w }))
      toast('Pesos guardados.');
  });
  on('addCenter', () => openCenter(null));
  m.querySelectorAll('[data-center]').forEach((el) => (el.onclick = () => openCenter(+el.dataset.center)));
  on('tbCreate', createTBFile);
  on('tbReload', () => refresh(true));
  m.querySelectorAll('[data-meetlink]').forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        openMeeting(a.dataset.meetlink);
      }),
  );
  on('icsMe', () => downloadICS(ME.memberId));
  on('icsTeam', () => downloadICS(null));
  on('bkExp', exportBackup);
  on('pvHs', async () => {
    const v = +val('pvH');
    if (!(v > 0)) {
      toast('Indica las horas.');
      return;
    }
    PRDATA.settings = { ...(PRDATA.settings || {}), hoursPerDay: v };
    await writePriv();
    rebuild();
    render();
    toast('Calendario privado: ' + v + ' h/día.');
  });
  const bi = $('#bkImp');
  if (bi)
    bi.onchange = () => {
      if (bi.files[0]) importBackup(bi.files[0]);
    };
  meBox();
}
init();
