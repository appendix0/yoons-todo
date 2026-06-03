/* Yoon's TO-DO — timeboxing planner with a 6:00 AM KST daily reset.
   No dependencies. State persists in localStorage. */
(() => {
  'use strict';

  const KEY = 'yoons-todo:v1';
  const VIEW_KEY = 'yoons-todo:view';

  // ── Korea Standard Time = UTC+9, no daylight saving ───────────────
  const TZ_OFFSET_MIN = 9 * 60;
  const RESET_HOUR = 6; // the day resets at 06:00 KST

  // ── Timebox window ────────────────────────────────────────────────
  // NOTE: "0630–1200" is read as 06:30 → midnight (00:00).
  // If you actually meant 06:30 → NOON, set DAY_END_MIN = 12 * 60.
  const DAY_START_MIN = 6 * 60 + 30; // 06:30
  const DAY_END_MIN   = 24 * 60;     // 24:00 (midnight)
  const STEP_MIN      = 15;
  const SLOT_COUNT    = (DAY_END_MIN - DAY_START_MIN) / STEP_MIN;

  // ── Real, attributed quotes from tech entrepreneurs ───────────────
  const QUOTES = [
    ['When something is important enough, you do it even if the odds are not in your favor.', 'Elon Musk'],
    ['Persistence is very important. You should not give up unless you are forced to give up.', 'Elon Musk'],
    ['Stay hungry, stay foolish.', 'Steve Jobs'],
    ['Focusing is about saying no.', 'Steve Jobs'],
    ['Innovation distinguishes between a leader and a follower.', 'Steve Jobs'],
    ['Your most unhappy customers are your greatest source of learning.', 'Bill Gates'],
    ['It is fine to celebrate success, but it is more important to heed the lessons of failure.', 'Bill Gates'],
    ['Your brand is what other people say about you when you are not in the room.', 'Jeff Bezos'],
    ['If you double the number of experiments you do per year, you double your inventiveness.', 'Jeff Bezos'],
    ['Move fast and break things.', 'Mark Zuckerberg'],
    ['The biggest risk is not taking any risk.', 'Mark Zuckerberg'],
    ['Done is better than perfect.', 'Sheryl Sandberg'],
    ['Ideas are easy. Execution is everything.', 'John Doerr'],
    ['I have not failed. I have just found 10,000 ways that will not work.', 'Thomas Edison'],
    ['Great things in business are never done by one person; they are done by a team.', 'Steve Jobs'],
    ['The first step is to establish that something is possible; then probability will occur.', 'Elon Musk'],
  ];

  // ── State ─────────────────────────────────────────────────────────
  let state;
  let lastMinuteRendered = -1;

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));

  const $  = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };

  // ── KST helpers ───────────────────────────────────────────────────
  function kstShift(d = new Date()) { return new Date(d.getTime() + TZ_OFFSET_MIN * 60000); }
  function kstParts(d = new Date()) {
    const k = kstShift(d);
    return {
      y: k.getUTCFullYear(), mon: k.getUTCMonth(), day: k.getUTCDate(),
      weekday: k.getUTCDay(), h: k.getUTCHours(), mi: k.getUTCMinutes(), s: k.getUTCSeconds(),
      minutes: k.getUTCHours() * 60 + k.getUTCMinutes(),
    };
  }
  function planDayKey(d = new Date()) {
    const a = new Date(d.getTime() + TZ_OFFSET_MIN * 60000 - RESET_HOUR * 3600000);
    return `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, '0')}-${String(a.getUTCDate()).padStart(2, '0')}`;
  }
  function msUntilReset(d = new Date()) {
    const k = kstShift(d);
    const next = new Date(k.getTime());
    next.setUTCHours(RESET_HOUR, 0, 0, 0);
    if (k.getUTCHours() >= RESET_HOUR) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - k.getTime();
  }

  const pad = (n) => String(n).padStart(2, '0');
  function timeToMin(s) {
    if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  function minToHHMM(min) {
    const m = ((min % 1440) + 1440) % 1440;
    return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  }

  // ── Persistence + daily reset ─────────────────────────────────────
  function blankState(dayKey) { return { planDay: dayKey, brainDump: '', scheduled: [], prioritized: [] }; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

  // Returns true if a reset (or first run) happened.
  function ensureDay() {
    const dk = planDayKey();
    const s = load();
    if (!s || s.planDay !== dk) { state = blankState(dk); save(); return true; }
    state = s;
    // back-fill seq for older items
    state.prioritized.forEach((j, i) => { if (j.seq == null) j.seq = i; });
    return false;
  }

  const findJob = (id) =>
    state.scheduled.find((j) => j.id === id) || state.prioritized.find((j) => j.id === id);

  function toggleDone(id) {
    const j = findJob(id);
    if (!j) return;
    j.done = !j.done;
    save();
    renderToday();
  }

  // ── Timebox builder ───────────────────────────────────────────────
  function buildTimebox() {
    const slots = new Array(SLOT_COUNT).fill(null);

    // fixed jobs occupy their exact blocks (first writer wins on overlap)
    state.scheduled.forEach((job) => {
      const s = timeToMin(job.start), e = timeToMin(job.end);
      if (s == null || e == null || e <= s) return;
      for (let m = s; m < e; m += STEP_MIN) {
        const idx = (m - DAY_START_MIN) / STEP_MIN;
        if (idx >= 0 && idx < SLOT_COUNT && !slots[idx]) slots[idx] = { jobId: job.id, kind: 'fixed' };
      }
    });

    // prioritized jobs greedily packed into free blocks, P1 → P3
    const order = [...state.prioritized].sort((a, b) => (a.priority - b.priority) || (a.seq - b.seq));
    let ptr = 0;
    order.forEach((job) => {
      job._unscheduled = false;
      const need = Math.max(1, Math.round((job.mins || 30) / STEP_MIN));
      while (ptr < SLOT_COUNT && slots[ptr]) ptr++;
      if (ptr >= SLOT_COUNT) { job._unscheduled = true; return; }
      let count = 0;
      while (ptr < SLOT_COUNT && !slots[ptr] && count < need) { slots[ptr] = { jobId: job.id, kind: 'prio' }; ptr++; count++; }
    });

    // merge consecutive same-job slots into entries
    const entries = [];
    let i = 0;
    while (i < SLOT_COUNT) {
      if (slots[i]) {
        const { jobId, kind } = slots[i];
        let j = i;
        while (j < SLOT_COUNT && slots[j] && slots[j].jobId === jobId) j++;
        entries.push({ startMin: DAY_START_MIN + i * STEP_MIN, endMin: DAY_START_MIN + j * STEP_MIN, jobId, kind });
        i = j;
      } else i++;
    }
    return entries;
  }

  // ── Quote of the day ──────────────────────────────────────────────
  let quoteIdx = null;
  function dailyQuoteIndex() {
    let h = 0;
    const k = planDayKey();
    for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return h % QUOTES.length;
  }

  // ════════════════════════ RENDER: PLAN ════════════════════════════
  function renderPlan() {
    $('#brainDump').value = state.brainDump || '';

    // prioritized rows
    const pl = $('#prioList');
    pl.textContent = '';
    if (!state.prioritized.length) {
      pl.append(Object.assign(el('p', 'empty'), { textContent: 'Nothing yet — brain-dump above, then “Break into tasks”.' }));
    }
    state.prioritized
      .slice()
      .sort((a, b) => (a.priority - b.priority) || (a.seq - b.seq))
      .forEach((job) => pl.append(prioRow(job)));

    // scheduled rows
    const sl = $('#schedList');
    sl.textContent = '';
    if (!state.scheduled.length) {
      sl.append(Object.assign(el('p', 'empty'), { textContent: 'No fixed-time jobs yet.' }));
    }
    state.scheduled
      .slice()
      .sort((a, b) => (timeToMin(a.start) ?? 9999) - (timeToMin(b.start) ?? 9999))
      .forEach((job) => sl.append(schedRow(job)));
  }

  function prioRow(job) {
    const row = el('div', 'editrow editrow--prio');

    const dot = el('button', 'pdot');
    dot.dataset.p = job.priority;
    dot.textContent = 'P' + job.priority;
    dot.title = 'Tap to change priority';
    dot.setAttribute('aria-label', 'Priority ' + job.priority + ', tap to change');
    dot.onclick = () => { job.priority = (job.priority % 3) + 1; save(); renderPlan(); };

    const title = el('input');
    title.type = 'text';
    title.value = job.title;
    title.placeholder = 'Task';
    title.oninput = () => { job.title = title.value; save(); };

    const mins = el('input', 'mins');
    mins.type = 'number'; mins.min = '15'; mins.step = '15'; mins.value = job.mins || 30;
    mins.setAttribute('aria-label', 'Estimated minutes');
    mins.oninput = () => { job.mins = Math.max(15, parseInt(mins.value, 10) || 15); save(); };

    const unit = Object.assign(el('span'), { textContent: 'min' });
    unit.style.color = 'var(--color-text-3)';
    unit.style.fontSize = 'var(--text-sm)';

    const del = el('button', 'iconbtn');
    del.innerHTML = '&times;';
    del.title = 'Remove';
    del.setAttribute('aria-label', 'Remove task');
    del.onclick = () => { state.prioritized = state.prioritized.filter((j) => j.id !== job.id); save(); renderPlan(); };

    row.append(dot, title, mins, unit, del);
    return row;
  }

  function schedRow(job) {
    const row = el('div', 'editrow editrow--sched');

    const title = el('input');
    title.type = 'text'; title.value = job.title; title.placeholder = 'e.g. Standup';
    title.oninput = () => { job.title = title.value; save(); };

    const start = el('input');
    start.type = 'time'; start.value = job.start || '';
    start.oninput = () => { job.start = start.value; save(); };

    const end = el('input');
    end.type = 'time'; end.value = job.end || '';
    end.oninput = () => { job.end = end.value; save(); };

    const del = el('button', 'iconbtn');
    del.innerHTML = '&times;'; del.title = 'Remove'; del.setAttribute('aria-label', 'Remove job');
    del.onclick = () => { state.scheduled = state.scheduled.filter((j) => j.id !== job.id); save(); renderPlan(); };

    row.append(title, start, end, del);
    return row;
  }

  // ════════════════════════ RENDER: TODAY ═══════════════════════════
  function renderClock() {
    const p = kstParts();
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    $('#clockDate').textContent = `${weekdays[p.weekday]}, ${months[p.mon]} ${p.day}`;
    $('#clockTime').innerHTML = `${pad(p.h)}:${pad(p.mi)}<span class="clock__secs">${pad(p.s)}</span>`;

    const ms = msUntilReset();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    $('#clockSub').innerHTML =
      `<span>KST</span><span class="reset">resets in ${h}h ${m}m</span>`;
  }

  function renderQuote() {
    if (quoteIdx == null) quoteIdx = dailyQuoteIndex();
    const [text, who] = QUOTES[quoteIdx];
    $('#quoteText').textContent = text;
    $('#quoteAttr').innerHTML = `<b>${who}</b>`;
  }

  function renderToday() {
    renderClock();
    renderQuote();

    const view = $('#view-today');
    const hasPlan = state.scheduled.length || state.prioritized.length;
    $('#dashEmpty').hidden = !!hasPlan;
    ['#clockCard', '#quoteCard', '#timeboxCard', '#todoCard'].forEach((s) => { $(s).hidden = !hasPlan; });
    if (!hasPlan) return;

    const entries = buildTimebox();
    const nowMin = kstParts().minutes;
    const byJob = {};
    entries.forEach((e) => { if (!byJob[e.jobId]) byJob[e.jobId] = e; });

    // ── time box ──
    const tb = $('#timeboxList');
    tb.textContent = '';
    if (!entries.length) {
      tb.append(Object.assign(el('p', 'empty'), { textContent: 'No blocks scheduled inside 06:30–24:00.' }));
    }
    let nowRow = null;
    entries.forEach((e) => {
      const job = findJob(e.jobId);
      if (!job) return;
      const isFixed = e.kind === 'fixed';
      const label = isFixed
        ? `${job.start}–${job.end}`
        : `${minToHHMM(e.startMin)}–${minToHHMM(e.endMin)}`;
      const tagClass = isFixed ? 'tag tag--fixed' : `tag tag--p${job.priority}`;
      const tagText = isFixed ? 'Fixed' : 'P' + job.priority;
      const isNow = nowMin >= e.startMin && nowMin < e.endMin;
      const row = listItem({
        id: job.id, time: label, title: job.title || '(untitled)',
        tagClass, tagText, done: job.done, now: isNow,
      });
      if (isNow) nowRow = row;
      tb.append(row);
    });

    // ── to-do rail ──
    const all = [...state.scheduled, ...state.prioritized];
    const doneCount = all.filter((j) => j.done).length;
    $('#progressText').textContent = `${doneCount} / ${all.length} done`;
    $('#progressFill').style.width = all.length ? (doneCount / all.length) * 100 + '%' : '0%';

    const list = $('#todoList');
    list.textContent = '';

    const sched = state.scheduled.slice().sort((a, b) => (timeToMin(a.start) ?? 9999) - (timeToMin(b.start) ?? 9999));
    if (sched.length) {
      list.append(Object.assign(el('div', 'group-label'), { textContent: 'Scheduled' }));
      sched.forEach((job) => list.append(listItem({
        id: job.id, time: job.start && job.end ? `${job.start}–${job.end}` : '—',
        title: job.title || '(untitled)', tagClass: 'tag tag--fixed', tagText: 'Fixed', done: job.done,
      })));
    }

    const prio = state.prioritized.slice().sort((a, b) => (a.priority - b.priority) || (a.seq - b.seq));
    if (prio.length) {
      list.append(Object.assign(el('div', 'group-label'), { textContent: 'Prioritized' }));
      prio.forEach((job) => {
        const e = byJob[job.id];
        const unscheduled = job._unscheduled || !e;
        list.append(listItem({
          id: job.id,
          time: unscheduled ? 'Unscheduled' : `${minToHHMM(e.startMin)}–${minToHHMM(e.endMin)}`,
          title: job.title || '(untitled)',
          tagClass: unscheduled ? 'tag tag--warn' : `tag tag--p${job.priority}`,
          tagText: unscheduled ? 'No slot' : 'P' + job.priority,
          done: job.done,
        }));
      });
    }

    // auto-scroll the time box to "now"
    if (nowRow) requestAnimationFrame(() => nowRow.scrollIntoView({ block: 'center' }));
  }

  function listItem({ id, time, title, tagClass, tagText, done, now }) {
    const row = el('div', 'litem' + (done ? ' is-done' : '') + (now ? ' is-now' : ''));

    const t = el('div', 'litem__time');
    t.textContent = time;

    const body = el('div');
    body.append(Object.assign(el('div', 'litem__title'), { textContent: title }));
    const meta = el('div', 'litem__meta');
    if (now) meta.append(Object.assign(el('span', 'nowchip'), { textContent: 'NOW' }));
    meta.append(Object.assign(el('span', tagClass), { textContent: tagText }));
    body.append(meta);

    const chk = el('button', 'check');
    chk.setAttribute('aria-pressed', String(!!done));
    chk.setAttribute('aria-label', (done ? 'Mark not done: ' : 'Mark done: ') + title);
    chk.onclick = () => toggleDone(id);

    row.append(t, body, chk);
    return row;
  }

  // ════════════════════════ View switching ══════════════════════════
  function showView(v) {
    localStorage.setItem(VIEW_KEY, v);
    $('#view-plan').hidden = v !== 'plan';
    $('#view-today').hidden = v !== 'today';
    document.querySelectorAll('.seg button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.view === v)));
    if (v === 'plan') renderPlan();
    else { lastMinuteRendered = kstParts().minutes; renderToday(); }
  }

  // ════════════════════════ Wire up ═════════════════════════════════
  function init() {
    ensureDay();

    document.querySelectorAll('.seg button').forEach((b) => { b.onclick = () => showView(b.dataset.view); });

    $('#brainDump').addEventListener('input', (e) => { state.brainDump = e.target.value; save(); });

    $('#btnAddTasks').onclick = () => {
      const lines = (state.brainDump || '').split('\n').map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      let seq = state.prioritized.length;
      lines.forEach((title) => state.prioritized.push({ id: uid(), seq: seq++, title, priority: 2, mins: 30, done: false }));
      state.brainDump = '';
      save();
      renderPlan();
    };

    $('#btnAddSched').onclick = () => {
      state.scheduled.push({ id: uid(), title: '', start: '', end: '', done: false });
      save();
      renderPlan();
      const inputs = $('#schedList').querySelectorAll('.editrow--sched input[type="text"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    };

    $('#btnBuild').onclick = () => showView('today');

    $('#quoteCard').onclick = () => {
      let n = Math.floor(Math.random() * QUOTES.length);
      if (n === quoteIdx) n = (n + 1) % QUOTES.length;
      quoteIdx = n;
      renderQuote();
    };

    // initial view: today if a plan exists, else plan
    const saved = localStorage.getItem(VIEW_KEY);
    const hasPlan = state.scheduled.length || state.prioritized.length;
    showView(saved || (hasPlan ? 'today' : 'plan'));

    // 1s tick: clock, reset-watch, per-minute "now" refresh
    setInterval(() => {
      if (!$('#view-today').hidden) renderClock();
      // daily reset crossing
      if (planDayKey() !== state.planDay) {
        ensureDay();
        quoteIdx = dailyQuoteIndex();
        if ($('#view-plan').hidden) renderToday(); else renderPlan();
        return;
      }
      const m = kstParts().minutes;
      if (m !== lastMinuteRendered && !$('#view-today').hidden) { lastMinuteRendered = m; renderToday(); }
    }, 1000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
