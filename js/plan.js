/* Yoon's TO-DO — Planning screen: brain dump, drag-rank priorities, fixed schedule. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };

  function init() {
    S.ensureDay();
    $('#brainDump').value = S.state.brainDump || '';

    $('#brainDump').addEventListener('input', (e) => { S.state.brainDump = e.target.value; S.save(); });

    $('#btnAddTasks').onclick = () => {
      const lines = (S.state.brainDump || '').split('\n').map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      lines.forEach((title) => S.state.prioritized.push({ id: S.uid(), title, mins: 30, atMin: null, done: false }));
      S.state.brainDump = '';
      S.save();
      render();
    };

    $('#btnAddSched').onclick = () => {
      S.state.scheduled.push({ id: S.uid(), title: '', start: '', end: '', done: false });
      S.save();
      render();
      const inputs = $('#schedList').querySelectorAll('.editrow--sched input[type="text"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    };

    render();
  }

  function render() { renderPrio(); renderSched(); }

  // ── Prioritize (drag to rank) ──
  function renderPrio() {
    const list = $('#prioList');
    list.textContent = '';
    if (!S.state.prioritized.length) {
      list.append(Object.assign(el('p', 'empty'), { textContent: 'Nothing yet — brain-dump above, then “Break into tasks”. Drag to rank.' }));
      return;
    }
    S.state.prioritized.forEach((job, idx) => list.append(prioRow(job, idx)));
    enableReorder(list, (ids) => {
      S.state.prioritized.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      S.save();
      renderPrio();
    });
  }

  function prioRow(job, idx) {
    const rank = idx + 1;
    const row = el('div', 'editrow editrow--prio');
    row.dataset.id = job.id;

    const handle = el('button', 'drag');
    handle.innerHTML = '&#8801;'; // ≡
    handle.setAttribute('aria-label', 'Drag to reorder');
    handle.title = 'Drag to reorder';

    const dot = el('span', 'pdot');
    dot.dataset.p = rank <= 3 ? rank : '0';
    dot.textContent = 'P' + rank;

    const title = el('input');
    title.type = 'text'; title.value = job.title; title.placeholder = 'Task';
    title.oninput = () => { job.title = title.value; S.save(); };

    const mins = el('input', 'mins');
    mins.type = 'number'; mins.min = '15'; mins.step = '15'; mins.value = job.mins || 30;
    mins.setAttribute('aria-label', 'Estimated minutes');
    mins.oninput = () => { job.mins = Math.max(15, parseInt(mins.value, 10) || 15); S.save(); };

    const unit = Object.assign(el('span', 'unit'), { textContent: 'min' });

    const del = el('button', 'iconbtn');
    del.innerHTML = '&times;'; del.title = 'Remove'; del.setAttribute('aria-label', 'Remove task');
    del.onclick = () => { S.state.prioritized = S.state.prioritized.filter((j) => j.id !== job.id); S.save(); renderPrio(); };

    row.append(handle, dot, title, mins, unit, del);
    return row;
  }

  // pointer-based reorder (works on iPad touch)
  function enableReorder(container, onReorder) {
    container.querySelectorAll('.editrow').forEach((row) => {
      const handle = row.querySelector('.drag');
      if (!handle) return;
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        row.classList.add('dragging');
        handle.setPointerCapture(e.pointerId);

        const move = (ev) => {
          const y = ev.clientY;
          const sibs = [...container.querySelectorAll('.editrow:not(.dragging)')];
          let after = null;
          for (const s of sibs) { const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2) { after = s; break; } }
          if (after) container.insertBefore(row, after); else container.appendChild(row);
        };
        const up = () => {
          row.classList.remove('dragging');
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', up);
          onReorder([...container.querySelectorAll('.editrow')].map((r) => r.dataset.id));
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
      });
    });
  }

  // ── Fixed schedule ──
  function renderSched() {
    const list = $('#schedList');
    list.textContent = '';
    if (!S.state.scheduled.length) {
      list.append(Object.assign(el('p', 'empty'), { textContent: 'No fixed-time jobs yet.' }));
      return;
    }
    S.state.scheduled
      .slice()
      .sort((a, b) => (S.timeToMin(a.start) ?? 9999) - (S.timeToMin(b.start) ?? 9999))
      .forEach((job) => list.append(schedRow(job)));
  }

  function schedRow(job) {
    const row = el('div', 'editrow editrow--sched');
    const title = el('input');
    title.type = 'text'; title.value = job.title; title.placeholder = 'e.g. Standup';
    title.oninput = () => { job.title = title.value; S.save(); };

    const start = el('input');
    start.type = 'time'; start.value = job.start || '';
    start.oninput = () => { job.start = start.value; S.save(); };

    const end = el('input');
    end.type = 'time'; end.value = job.end || '';
    end.oninput = () => { job.end = end.value; S.save(); };

    const del = el('button', 'iconbtn');
    del.innerHTML = '&times;'; del.title = 'Remove'; del.setAttribute('aria-label', 'Remove job');
    del.onclick = () => { S.state.scheduled = S.state.scheduled.filter((j) => j.id !== job.id); S.save(); renderSched(); };

    row.append(title, start, end, del);
    return row;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
