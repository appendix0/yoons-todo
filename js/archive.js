/* Yoon's TO-DO — Archive: past days' plans, saved by store.js at the 06:00 reset. Read-only. */
(() => {
  'use strict';
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  function item(job, label) {
    const row = el('div', 'aitem' + (job.done ? ' aitem--done' : ''));
    row.append(el('span', 'aitem__mark', job.done ? '✓' : ''), el('span', 'aitem__label', label),
      el('span', 'aitem__title', job.title || 'Untitled'));
    return row;
  }

  function day(st) {
    const [y, m, d] = st.planDay.split('-').map(Number);
    const all = [...(st.scheduled || []), ...(st.prioritized || [])];
    const done = all.filter((j) => j.done).length;
    const box = el('details', 'aday card');
    const sum = el('summary', 'aday__sum');
    sum.append(el('span', 'aday__date', `${m}/${d}`), el('span', 'aday__wd', WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]),
      el('span', 'aday__count', all.length ? `${done}/${all.length} done` : 'brain dump only'));
    const bar = el('span', 'aday__bar'); const fill = el('span', 'aday__fill');
    fill.style.width = all.length ? `${(done / all.length) * 100}%` : '0%';
    bar.append(fill); sum.append(bar);
    box.append(sum);
    const body = el('div', 'aday__body');
    if ((st.scheduled || []).length) {
      body.append(el('div', 'group-label', 'Fixed schedule'));
      [...st.scheduled].sort((a, b) => (a.start || '').localeCompare(b.start || ''))
        .forEach((j) => body.append(item(j, j.start ? `${j.start}–${j.end || ''}` : '—')));
    }
    if ((st.prioritized || []).length) {
      body.append(el('div', 'group-label', 'Priorities'));
      st.prioritized.forEach((j, i) => body.append(item(j, `P${i + 1} · ${j.mins || 30}m`)));
    }
    if ((st.brainDump || '').trim()) {
      body.append(el('div', 'group-label', 'Brain dump'), el('pre', 'aday__dump', st.brainDump.trim()));
    }
    box.append(body);
    return box;
  }

  const days = Object.values(S.loadArchive()).sort((a, b) => b.planDay.localeCompare(a.planDay));
  const root = document.getElementById('archive');
  if (!days.length) {
    root.append(el('div', 'card aempty', 'Nothing archived yet. Today’s plan lands here after the next 06:00 reset.'));
    return;
  }
  let cur = '';
  days.forEach((st) => {
    const mk = st.planDay.slice(0, 7);
    if (mk !== cur) {
      cur = mk;
      root.append(el('h2', 'amonth', `${MONTHS[+mk.slice(5) - 1]} ${mk.slice(0, 4)}`));
    }
    root.append(day(st));
  });
})();
