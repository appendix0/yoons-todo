/* Yoon's TO-DO — Month: a two-page spread, by week, and inside each week by day.
   Plans usually run 3–5 days, so a plan is a bar across its days.
   Method (Sam Altman, "Productivity", 2018): separate lists for the year, month and day;
   "make sure to get the important shit done"; "allocate your year optimally, not your day";
   be ruthless about saying no. From Musk (as reported by Isaacson): urgency, and delete
   before you optimize. So: ≤3 month goals, a "not this month" list, plans tagged to goals,
   and a tally of how many days each goal gets.
   Storage: plans in one list (they can cross months); goals and "not" list per month. */
(() => {
  'use strict';

  const MAX_GOALS = 3;
  const TAGS = ['A', 'B', 'C'];
  const DEFAULT_DAYS = 3;
  const WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
  const PLANS_KEY = 'yoons-todo:plans';
  const $ = (id) => document.getElementById(id);

  // ── dates as 'YYYY-MM-DD' (UTC arithmetic, no time zone drift) ──
  const DAY = 86400000;
  const toMs = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  const toKey = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${S.pad(d.getUTCMonth() + 1)}-${S.pad(d.getUTCDate())}`; };
  const addDays = (k, n) => toKey(toMs(k) + n * DAY);
  const diff = (a, b) => Math.round((toMs(b) - toMs(a)) / DAY);

  const todayKey = S.planDayKey();          // follows the app's 06:00 KST day boundary
  let year = +todayKey.slice(0, 4), mon = +todayKey.slice(5, 7) - 1;
  let month;                                // {goals, notList} of the shown month
  let plans = [];

  const monthKey = () => `yoons-todo:month:${year}-${S.pad(mon + 1)}`;
  const read = (k, dflt) => { try { return JSON.parse(localStorage.getItem(k)) || dflt; } catch (_) { return dflt; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage blocked */ } };
  const saveMonth = () => { month.updatedAt = Date.now(); write(monthKey(), month); };
  const savePlans = () => write(PLANS_KEY, plans);
  const loadMonth = () => {
    month = read(monthKey(), { goals: [], notList: '' });
    month.goals = month.goals || [];
  };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const first = () => `${year}-${S.pad(mon + 1)}-01`;
  const last = () => toKey(Date.UTC(year, mon + 1, 0));
  const tagOf = (p) => (TAGS.indexOf(p.tag) < month.goals.length ? p.tag : '');

  // ── Goals ──
  function renderGoals() {
    const list = $('goalList');
    list.replaceChildren();
    month.goals.forEach((g, i) => {
      const row = el('div', 'editrow goalrow');
      const input = el('input');
      input.type = 'text';
      input.value = g.text;
      input.placeholder = 'Outcome with a finish line';
      input.addEventListener('input', () => { g.text = input.value; saveMonth(); renderAlloc(); });
      const done = el('button', `check${g.done ? ' check--on' : ''}`, g.done ? '✓' : '');
      done.type = 'button';
      done.setAttribute('aria-label', 'Goal done');
      done.addEventListener('click', () => { g.done = !g.done; saveMonth(); renderGoals(); });
      const del = el('button', 'iconbtn', '×');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove goal');
      del.addEventListener('click', () => {
        // Plans of this month keep their letters in step with the remaining goals.
        plans.filter(inMonth).forEach((p) => {
          const t = TAGS.indexOf(p.tag);
          if (t === i) p.tag = '';
          else if (t > i) p.tag = TAGS[t - 1];
        });
        month.goals.splice(i, 1); saveMonth(); savePlans(); renderAll();
      });
      row.append(el('span', `gtag gtag--${TAGS[i]}`, TAGS[i]), input, done, del);
      list.append(row);
    });
    if (month.goals.length < MAX_GOALS) {
      const add = el('button', 'btn btn--sm', '+ Add goal');
      add.type = 'button';
      add.addEventListener('click', () => { month.goals.push({ text: '', done: false }); saveMonth(); renderAll(); });
      list.append(add);
    }
  }

  const inMonth = (p) => p.start <= last() && p.end >= first();

  // Days of this month each goal's plans cover, and how many of those belong to done plans.
  function renderAlloc() {
    const box = $('alloc');
    box.replaceChildren();
    if (!month.goals.length) return;
    const n = diff(first(), last()) + 1;
    const cover = TAGS.map(() => new Set()), done = TAGS.map(() => new Set()), any = new Set();
    plans.filter(inMonth).forEach((p) => {
      const t = TAGS.indexOf(tagOf(p));
      for (let k = p.start > first() ? p.start : first(); k <= p.end && k <= last(); k = addDays(k, 1)) {
        any.add(k);
        if (t >= 0) { cover[t].add(k); if (p.done) done[t].add(k); }
      }
    });
    month.goals.forEach((g, i) => {
      const row = el('div', 'alloc__row');
      row.append(el('span', `gtag gtag--${TAGS[i]}`, TAGS[i]), el('span', 'alloc__name', g.text || 'Untitled goal'),
        el('span', 'alloc__num', `${done[i].size}/${cover[i].size} days`));
      const bar = el('div', 'alloc__bar');
      const fill = el('div', `alloc__fill alloc__fill--${TAGS[i]}`);
      fill.style.width = `${(cover[i].size / n) * 100}%`;
      const d = el('div', 'alloc__done');
      d.style.width = `${cover[i].size ? (done[i].size / cover[i].size) * 100 : 0}%`;
      fill.append(d); bar.append(fill); row.append(bar);
      box.append(row);
    });
    const free = n - any.size;
    box.append(el('div', 'alloc__free', `${free} day${free === 1 ? '' : 's'} with no plan`));
  }

  // ── Weeks (Monday first) ──
  function weeks() {
    const out = [];
    const f = first();
    let ws = addDays(f, -((new Date(toMs(f)).getUTCDay() + 6) % 7));
    while (ws <= last()) { out.push(ws); ws = addDays(ws, 7); }
    return out;
  }

  function renderWeek(ws, idx) {
    const we = addDays(ws, 6);
    const box = el('div', 'week');
    const lo = ws < first() ? first() : ws, hi = we > last() ? last() : we;
    const head = el('div', 'week__head');
    head.append(el('span', 'week__name', `Week ${idx + 1}`),
      el('span', 'week__range', `${+lo.slice(5, 7)}/${+lo.slice(8)} – ${+hi.slice(5, 7)}/${+hi.slice(8)}`));
    box.append(head);

    const grid = el('div', 'week__grid');
    for (let c = 0; c < 7; c++) {
      const k = addDays(ws, c);
      const out = k < first() || k > last();
      const cell = el('button', 'daycol');
      cell.type = 'button';
      cell.style.gridColumn = `${c + 1}`;
      if (out) cell.classList.add('daycol--out');
      if (c >= 5) cell.classList.add('daycol--weekend');
      if (k === todayKey) cell.classList.add('daycol--today');
      if (k < todayKey) cell.classList.add('daycol--past');
      cell.append(el('span', 'daycol__wd', WD[c]), el('span', 'daycol__num', String(+k.slice(8))));
      cell.setAttribute('aria-label', `New plan from ${k}`);
      cell.addEventListener('click', () => newPlan(k));
      grid.append(cell);
    }

    // Lay the week's plan segments into lanes so overlapping plans stack.
    const segs = plans.filter((p) => p.start <= we && p.end >= ws)
      .map((p) => ({ p, s: Math.max(0, diff(ws, p.start)), e: Math.min(6, diff(ws, p.end)) }))
      .sort((a, b) => a.s - b.s || b.e - a.e);
    const laneEnd = [];
    segs.forEach((g) => {
      let l = laneEnd.findIndex((end) => end < g.s);
      if (l < 0) { l = laneEnd.length; laneEnd.push(-1); }
      laneEnd[l] = g.e; g.lane = l;
    });
    grid.style.setProperty('--lanes', Math.max(2, laneEnd.length));
    segs.forEach((g) => grid.append(bar(g, ws)));
    box.append(grid);
    return box;
  }

  function bar({ p, s, e, lane }, ws) {
    const t = tagOf(p);
    const b = el('div', `bar bar--${t || 'none'}${p.done ? ' bar--done' : ''}`);
    b.style.gridColumn = `${s + 1} / ${e + 2}`;
    b.style.gridRow = `${lane + 2}`;
    if (p.start < ws) b.classList.add('bar--cont-l');
    if (p.end > addDays(ws, 6)) b.classList.add('bar--cont-r');
    const label = el('span', 'bar__label', p.text || 'Untitled');
    const len = diff(p.start, p.end) + 1;
    b.append(el('span', 'bar__h bar__h--l'), label, el('span', 'bar__len', `${len}d`), el('span', 'bar__h bar__h--r'));
    b.addEventListener('pointerdown', (ev) => dragStart(ev, p, b));
    return b;
  }

  // Drag: ends stretch or shrink by whole days, the body moves the plan; a tap opens it.
  function dragStart(ev, p, b) {
    ev.preventDefault();
    const mode = ev.target.classList.contains('bar__h--l') ? 'l' : ev.target.classList.contains('bar__h--r') ? 'r' : 'm';
    const col = b.parentElement.clientWidth / 7;
    const x0 = ev.clientX, orig = { start: p.start, end: p.end };
    const [c0, c1] = b.style.gridColumn.split('/').map((v) => +v);
    let delta = 0, moved = false;
    b.setPointerCapture(ev.pointerId);
    const move = (e2) => {
      const dx = e2.clientX - x0;
      if (Math.abs(dx) > 6) moved = true;
      delta = Math.round(dx / col);
      let a = c0, z = c1;
      if (mode === 'l') a = Math.min(c0 + delta, c1 - 1);
      else if (mode === 'r') z = Math.max(c1 + delta, c0 + 1);
      else { a = c0 + delta; z = c1 + delta; }
      b.style.gridColumn = `${Math.max(1, a)} / ${Math.min(8, z)}`;
    };
    const up = () => {
      b.removeEventListener('pointermove', move);
      b.removeEventListener('pointerup', up);
      b.removeEventListener('pointercancel', up);
      if (!moved) { openSheet(p); return; }
      if (mode === 'l') p.start = addDays(orig.start, delta) > p.end ? p.end : addDays(orig.start, delta);
      else if (mode === 'r') p.end = addDays(orig.end, delta) < p.start ? p.start : addDays(orig.end, delta);
      else { p.start = addDays(orig.start, delta); p.end = addDays(orig.end, delta); }
      savePlans(); renderAll();
    };
    b.addEventListener('pointermove', move);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }

  // ── Plan sheet ──
  let editing = null;
  function newPlan(k) {
    const p = { id: S.uid(), text: '', start: k, end: addDays(k, DEFAULT_DAYS - 1), tag: '', done: false };
    plans.push(p); savePlans(); renderAll(); openSheet(p, true);
  }
  function openSheet(p, fresh) {
    editing = p;
    $('pTitle').value = p.text;
    $('pStart').value = p.start;
    $('pEnd').value = p.end;
    $('pDone').textContent = p.done ? 'Not done' : 'Mark done';
    const tags = $('pTags');
    tags.replaceChildren();
    ['', ...TAGS.slice(0, month.goals.length)].forEach((t) => {
      const c = el('button', `chip${tagOf(p) === t ? ' chip--on' : ''}`);
      c.type = 'button';
      if (t) c.append(el('span', `gtag gtag--${t}`, t), document.createTextNode(` ${month.goals[TAGS.indexOf(t)].text || 'Goal'}`));
      else c.textContent = 'No goal';
      c.addEventListener('click', () => { p.tag = t; savePlans(); openSheet(p); renderAll(); });
      tags.append(c);
    });
    $('sheet').hidden = false;
    if (fresh) $('pTitle').focus();
  }
  function closeSheet() {
    // An untitled plan that was never named is dropped, so a stray tap leaves nothing behind.
    if (editing && !editing.text.trim()) plans = plans.filter((x) => x !== editing);
    editing = null; $('sheet').hidden = true; savePlans(); renderAll();
  }
  $('pTitle').addEventListener('input', (e) => { editing.text = e.target.value; savePlans(); });
  $('pStart').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const len = diff(editing.start, editing.end);
    editing.start = e.target.value;
    if (editing.end < editing.start) editing.end = addDays(editing.start, len);
    $('pEnd').value = editing.end; savePlans(); renderAll();
  });
  $('pEnd').addEventListener('change', (e) => {
    if (!e.target.value) return;
    editing.end = e.target.value < editing.start ? editing.start : e.target.value;
    $('pEnd').value = editing.end; savePlans(); renderAll();
  });
  $('pDone').addEventListener('click', () => { editing.done = !editing.done; savePlans(); openSheet(editing); renderAll(); });
  $('pDelete').addEventListener('click', () => { plans = plans.filter((x) => x !== editing); editing = null; $('sheet').hidden = true; savePlans(); renderAll(); });
  $('pClose').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  // ── Page ──
  function renderHead() {
    $('monthTitle').textContent = `${MONTHS[mon]} ${year}`;
    const n = diff(first(), last()) + 1;
    const left = todayKey >= first() && todayKey <= last() ? diff(todayKey, last()) + 1 : todayKey > last() ? 0 : n;
    $('daysLeft').textContent = todayKey > last() ? 'Month over' : `${left} day${left === 1 ? '' : 's'} left`;
  }

  function renderAll() {
    renderHead(); renderGoals(); renderAlloc();
    const ws = weeks(), half = Math.ceil(ws.length / 2);
    $('weeksLeft').replaceChildren(...ws.slice(0, half).map((w, i) => renderWeek(w, i)));
    $('weeksRight').replaceChildren(...ws.slice(half).map((w, i) => renderWeek(w, i + half)));
    $('notList').value = month.notList;
  }

  function show(y, mo) { year = y; mon = mo; loadMonth(); renderAll(); }

  plans = read(PLANS_KEY, []);
  $('notList').addEventListener('input', (e) => { month.notList = e.target.value; saveMonth(); });
  $('prevMonth').addEventListener('click', () => (mon === 0 ? show(year - 1, 11) : show(year, mon - 1)));
  $('nextMonth').addEventListener('click', () => (mon === 11 ? show(year + 1, 0) : show(year, mon + 1)));
  show(year, mon);
})();
