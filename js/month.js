/* Yoon's TO-DO — Month page: a days-long planner, not a calendar.
   Method (Sam Altman, "Productivity", 2018): separate lists for the year, month and day;
   "make sure to get the important shit done"; "allocate your year optimally, not your day";
   start each day with something you can really make progress on; be ruthless about saying no.
   From Musk (as reported by Isaacson): a sense of urgency, and delete before you optimize.
   So: ≤3 month goals, a "not this month" list, one focus per day tagged to a goal, and a
   tally of how many days each goal actually gets. State per month in localStorage. */
(() => {
  'use strict';

  const MAX_GOALS = 3;
  const TAGS = ['A', 'B', 'C'];
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                  'August', 'September', 'October', 'November', 'December'];
  const $ = (id) => document.getElementById(id);

  // "Today" follows the app's day boundary (06:00 KST), like the Today page.
  const todayKey = S.planDayKey();
  const [ty, tm] = todayKey.split('-').map(Number);
  let year = ty, mon = tm - 1;     // month shown (0-based)
  let m;                           // state of the shown month

  const keyFor = (y, mo) => `yoons-todo:month:${y}-${S.pad(mo + 1)}`;
  const blank = () => ({ goals: [], notList: '', days: {}, updatedAt: 0 });
  function load() {
    try { m = JSON.parse(localStorage.getItem(keyFor(year, mon))) || blank(); } catch (_) { m = blank(); }
  }
  function save() {
    m.updatedAt = Date.now();
    try { localStorage.setItem(keyFor(year, mon), JSON.stringify(m)); } catch (_) { /* storage blocked */ }
  }
  const daysIn = (y, mo) => new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const dayKey = (d) => `${year}-${S.pad(mon + 1)}-${S.pad(d)}`;
  const day = (d) => (m.days[d] = m.days[d] || { focus: '', tag: '', done: false });

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // ── Goals ──
  function renderGoals() {
    const list = $('goalList');
    list.replaceChildren();
    m.goals.forEach((g, i) => {
      const row = el('div', 'editrow goalrow');
      const tag = el('span', `gtag gtag--${TAGS[i]}`, TAGS[i]);
      const input = el('input');
      input.type = 'text';
      input.value = g.text;
      input.placeholder = 'Outcome, with a finish line (e.g. CS285 HW2 submitted)';
      input.addEventListener('input', () => { g.text = input.value; save(); renderAlloc(); });
      const done = el('button', `check${g.done ? ' check--on' : ''}`, g.done ? '✓' : '');
      done.type = 'button';
      done.setAttribute('aria-label', 'Goal done');
      done.addEventListener('click', () => { g.done = !g.done; save(); renderGoals(); });
      const del = el('button', 'iconbtn', '×');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove goal');
      del.addEventListener('click', () => {
        // Removing a goal untags its days and shifts later tags down so letters stay in order.
        const t = TAGS[i];
        Object.values(m.days).forEach((dd) => {
          if (dd.tag === t) dd.tag = '';
          else if (dd.tag && TAGS.indexOf(dd.tag) > i) dd.tag = TAGS[TAGS.indexOf(dd.tag) - 1];
        });
        m.goals.splice(i, 1); save(); renderAll();
      });
      row.append(tag, input, done, del);
      list.append(row);
    });
    if (m.goals.length < MAX_GOALS) {
      const add = el('button', 'btn', '+ Add goal');
      add.type = 'button';
      add.addEventListener('click', () => { m.goals.push({ text: '', done: false }); save(); renderAll(); });
      const wrap = el('div', 'row-actions');
      wrap.append(add);
      list.append(wrap);
    }
  }

  // How many days each goal gets, and how many of those were done: the month's real allocation.
  function renderAlloc() {
    const box = $('alloc');
    box.replaceChildren();
    if (!m.goals.length) return;
    const n = daysIn(year, mon);
    let free = 0;
    const count = Object.fromEntries(TAGS.map((t) => [t, { days: 0, done: 0 }]));
    for (let d = 1; d <= n; d++) {
      const dd = m.days[d];
      if (dd && dd.tag && count[dd.tag]) { count[dd.tag].days++; if (dd.done) count[dd.tag].done++; }
      else free++;
    }
    m.goals.forEach((g, i) => {
      const c = count[TAGS[i]];
      const line = el('div', 'alloc__row');
      line.append(el('span', `gtag gtag--${TAGS[i]}`, TAGS[i]),
        el('span', 'alloc__name', g.text || 'Untitled goal'),
        el('span', 'alloc__num', `${c.done}/${c.days} days`));
      const bar = el('div', 'alloc__bar');
      const fill = el('div', `alloc__fill alloc__fill--${TAGS[i]}`);
      fill.style.width = `${(c.days / n) * 100}%`;
      const doneFill = el('div', 'alloc__done');
      doneFill.style.width = `${c.days ? (c.done / c.days) * 100 : 0}%`;
      fill.append(doneFill);
      bar.append(fill);
      line.append(bar);
      box.append(line);
    });
    box.append(el('div', 'alloc__free', `${free} day${free === 1 ? '' : 's'} not tied to a goal`));
  }

  // ── Days ──
  function renderDays() {
    const list = $('dayList');
    list.replaceChildren();
    const n = daysIn(year, mon);
    for (let d = 1; d <= n; d++) {
      const wd = new Date(Date.UTC(year, mon, d)).getUTCDay();
      if (wd === 1 && d !== 1) list.append(el('div', 'weekrule'));
      const k = dayKey(d);
      const dd = m.days[d] || { focus: '', tag: '', done: false };
      const row = el('div', 'dayrow');
      if (wd === 0 || wd === 6) row.classList.add('dayrow--weekend');
      if (k < todayKey) row.classList.add('dayrow--past');
      if (k === todayKey) { row.classList.add('dayrow--today'); row.id = 'todayRow'; }

      const date = el('div', 'dayrow__date');
      date.append(el('span', 'dayrow__num', String(d)), el('span', 'dayrow__wd', WEEKDAYS[wd]));

      const tag = el('button', `gtag gtag--btn gtag--${dd.tag || 'none'}`, dd.tag || '·');
      tag.type = 'button';
      tag.setAttribute('aria-label', 'Link to a goal');
      tag.disabled = !m.goals.length;
      tag.addEventListener('click', () => {
        const cycle = ['', ...TAGS.slice(0, m.goals.length)];
        const x = day(d);
        x.tag = cycle[(cycle.indexOf(x.tag) + 1) % cycle.length];
        save(); renderDays(); renderAlloc();
      });

      const focus = el('input', 'dayrow__focus');
      focus.type = 'text';
      focus.value = dd.focus;
      focus.placeholder = k === todayKey ? "Today's one thing" : '';
      focus.addEventListener('input', () => { day(d).focus = focus.value; save(); });

      const done = el('button', `check${dd.done ? ' check--on' : ''}`, dd.done ? '✓' : '');
      done.type = 'button';
      done.setAttribute('aria-label', 'Focus done');
      done.addEventListener('click', () => { const x = day(d); x.done = !x.done; save(); renderDays(); renderAlloc(); });

      row.append(date, tag, focus, done);
      list.append(row);
    }
  }

  function renderHead() {
    $('monthTitle').textContent = `${MONTHS[mon]} ${year}`;
    const n = daysIn(year, mon);
    const thisMonth = year === ty && mon === tm - 1;
    const isPast = year < ty || (year === ty && mon < tm - 1);
    const left = thisMonth ? n - Number(todayKey.slice(8)) + 1 : isPast ? 0 : n;
    $('daysLeft').textContent = thisMonth ? `${left} day${left === 1 ? '' : 's'} left, today included`
      : isPast ? 'Month over' : `${n} days`;
  }

  function renderAll() {
    renderHead(); renderGoals(); renderAlloc(); renderDays();
    $('notList').value = m.notList;
  }

  function show(y, mo) {
    year = y; mon = mo; load(); renderAll();
    const t = $('todayRow');
    if (t) t.scrollIntoView({ block: 'center' });
  }

  $('notList').addEventListener('input', (e) => { m.notList = e.target.value; save(); });
  $('prevMonth').addEventListener('click', () => (mon === 0 ? show(year - 1, 11) : show(year, mon - 1)));
  $('nextMonth').addEventListener('click', () => (mon === 11 ? show(year + 1, 0) : show(year, mon + 1)));

  show(year, mon);
})();
