/* Yoon's TO-DO — Dashboard: live KST clock, quote, draggable calendar time box, to-do. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };
  const SLOT_PX = 14;                      // height of one 15-min block (keep in sync with .cal gridline px in app.css)
  const GRID_H = S.SLOT_COUNT * SLOT_PX;
  let quoteIdx = null;
  let lastMinute = -1;
  let lastQuoteSlot = -1;
  let scrolledOnce = false;

  function init() {
    S.ensureDay();
    quoteIdx = autoQuoteIndex();
    lastQuoteSlot = quoteSlot();
    $('#quoteCard').onclick = () => {
      let n = Math.floor(Math.random() * S.QUOTES.length);
      if (n === quoteIdx) n = (n + 1) % S.QUOTES.length;
      quoteIdx = n; renderQuote();
    };
    renderAll();
    setInterval(tick, 1000);
  }

  function tick() {
    renderClock();
    if (S.planDayKey() !== S.state.planDay) {
      S.ensureDay(); quoteIdx = autoQuoteIndex(); lastQuoteSlot = quoteSlot(); renderAll(); return;
    }
    const qs = quoteSlot();
    if (qs !== lastQuoteSlot) { lastQuoteSlot = qs; quoteIdx = autoQuoteIndex(); renderQuote(); }
    const m = S.kstParts().minutes;
    if (m !== lastMinute) { lastMinute = m; renderTimebox(); renderNowline(); }
  }

  function renderAll() { renderClock(); renderQuote(); renderBody(); }

  // ── Clock ──
  function renderClock() {
    const p = S.kstParts();
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    $('#clockDate').textContent = `${wd[p.weekday]}, ${mo[p.mon]} ${p.day}`;
    $('#clockTime').innerHTML = `${S.pad(p.h)}:${S.pad(p.mi)}<span class="clock__secs">${S.pad(p.s)}</span>`;
    const ms = S.msUntilReset();
    $('#clockSub').innerHTML =
      `<span>KST</span><span class="reset">resets in ${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m</span>`;
  }

  // ── Quote — rotates every 30 minutes ──
  const quoteSlot = () => Math.floor(Date.now() / (30 * 60 * 1000));
  const autoQuoteIndex = () => (Math.imul(quoteSlot(), 2654435761) >>> 0) % S.QUOTES.length;
  function renderQuote() {
    const [text, who] = S.QUOTES[quoteIdx];
    $('#quoteText').textContent = text;
    $('#quoteAttr').innerHTML = `<b>${who}</b>`;
  }

  // ── Body: empty-state vs dashboard ──
  function renderBody() {
    const has = S.state.scheduled.length || S.state.prioritized.length;
    $('#dashEmpty').hidden = !!has;
    ['#clockCard', '#quoteCard', '#timeboxCard', '#todoCard'].forEach((s) => { $(s).hidden = !has; });
    if (!has) return;
    renderTimebox();
    renderTodo();
  }

  // ── Calendar time box ──
  function renderTimebox() {
    if ($('#timeboxCard').hidden) return;
    const wrap = $('#cal');
    wrap.style.height = GRID_H + 'px';
    wrap.textContent = '';

    // hour gridlines + labels
    for (let m = S.DAY_START_MIN; m <= S.DAY_END_MIN; m += 60) {
      const top = ((m - S.DAY_START_MIN) / S.STEP_MIN) * SLOT_PX;
      const line = el('div', 'hourline'); line.style.top = top + 'px'; wrap.append(line);
      const lab = el('div', 'hourlabel'); lab.style.top = top + 'px'; lab.textContent = S.minToHHMM(m); wrap.append(lab);
    }

    const blocks = S.buildTimebox();
    const nowMin = S.kstParts().minutes;
    S.layoutBlocks(blocks).forEach((it) => {
      const job = S.findJob(it.jobId); if (!job) return;
      const top = ((it.s - S.DAY_START_MIN) / S.STEP_MIN) * SLOT_PX;
      const h = Math.max(SLOT_PX - 2, ((it.e - it.s) / S.STEP_MIN) * SLOT_PX - 2);
      const isFixed = it.kind === 'fixed';
      const isNow = nowMin >= it.s && nowMin < it.e;

      const b = el('div', 'block ' + (isFixed ? 'block--fixed' : 'block--p' + (it.rank <= 3 ? it.rank : 'x'))
        + (job.done ? ' is-done' : '') + (isNow ? ' is-now' : ''));
      b.style.top = top + 'px';
      b.style.height = h + 'px';
      b.style.left = `calc(${(it.col / it.cols) * 100}% + 2px)`;
      b.style.width = `calc(${(1 / it.cols) * 100}% - 4px)`;

      const main = el('div', 'block__main');
      const tl = isFixed ? `${job.start}–${job.end}` : `${S.minToHHMM(it.s)}–${S.minToHHMM(it.e)}`;
      main.append(Object.assign(el('div', 'block__t'), { textContent: (isNow ? '● ' : '') + tl + (isFixed ? ' · Fixed' : ' · P' + it.rank) }));
      main.append(Object.assign(el('div', 'block__title'), { textContent: job.title || '(untitled)' }));

      const chk = checkBtn(job);
      b.append(main, chk);
      enableBlockDrag(b, it);
      wrap.append(b);
    });

    renderNowline();
    // center on "now" only on first render — don't fight the user's scroll afterwards
    if (!scrolledOnce) {
      const scroller = $('#timeboxCard .scroll');
      if (scroller && scroller.clientHeight) {
        const nowTop = ((S.clamp(nowMin, S.DAY_START_MIN, S.DAY_END_MIN) - S.DAY_START_MIN) / S.STEP_MIN) * SLOT_PX;
        scroller.scrollTop = Math.max(0, nowTop - scroller.clientHeight / 2);
        scrolledOnce = true;
      }
    }
  }

  function renderNowline() {
    const wrap = $('#cal'); if (!wrap) return;
    let nl = wrap.querySelector('.nowline');
    const p = S.kstParts();
    if (p.minutes < S.DAY_START_MIN || p.minutes > S.DAY_END_MIN) { if (nl) nl.remove(); return; }
    if (!nl) { nl = el('div', 'nowline'); wrap.append(nl); }
    nl.style.top = ((p.minutes - S.DAY_START_MIN) / S.STEP_MIN) * SLOT_PX + 'px';
  }

  // pointer-drag a block to reschedule (snap 15 min). iPad-friendly.
  function enableBlockDrag(b, it) {
    b.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.check')) return; // checkbox handles its own tap
      e.preventDefault();
      const origTop = parseFloat(b.style.top);
      const startY = e.clientY;
      const maxTop = GRID_H - (it.dur / S.STEP_MIN) * SLOT_PX;
      let moved = false;
      b.setPointerCapture(e.pointerId);
      b.classList.add('dragging');

      const move = (ev) => {
        const dy = ev.clientY - startY;
        if (Math.abs(dy) > 4) moved = true;
        b.style.top = S.clamp(origTop + dy, 0, maxTop) + 'px';
      };
      const up = () => {
        b.releasePointerCapture(e.pointerId);
        b.classList.remove('dragging');
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        if (!moved) return;
        const newStart = S.clamp(
          S.DAY_START_MIN + Math.round(parseFloat(b.style.top) / SLOT_PX) * S.STEP_MIN,
          S.DAY_START_MIN, S.DAY_END_MIN - it.dur);
        const job = S.findJob(it.jobId);
        if (it.kind === 'prio') job.atMin = newStart;
        else { job.start = S.minToHHMM(newStart); job.end = S.minToHHMM(newStart + it.dur); }
        S.save();
        renderTimebox(); renderTodo();
      };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up);
    });
  }

  // ── To-do rail ──
  function renderTodo() {
    const all = [...S.state.scheduled, ...S.state.prioritized];
    const done = all.filter((j) => j.done).length;
    $('#progressText').textContent = `${done} / ${all.length} done`;
    $('#progressFill').style.width = all.length ? (done / all.length) * 100 + '%' : '0%';

    const blocks = S.buildTimebox();
    const byJob = {}; blocks.forEach((b) => { if (!byJob[b.jobId]) byJob[b.jobId] = b; });

    const list = $('#todoList');
    list.textContent = '';

    const sched = S.state.scheduled.slice().sort((a, b) => (S.timeToMin(a.start) ?? 9999) - (S.timeToMin(b.start) ?? 9999));
    if (sched.length) {
      list.append(Object.assign(el('div', 'group-label'), { textContent: 'Scheduled' }));
      sched.forEach((job) => list.append(todoRow(job, job.start && job.end ? `${job.start}–${job.end}` : '—', 'Fixed', 'tag--fixed')));
    }
    if (S.state.prioritized.length) {
      list.append(Object.assign(el('div', 'group-label'), { textContent: 'Prioritized' }));
      S.state.prioritized.forEach((job, idx) => {
        const b = byJob[job.id];
        const uns = !b || b.unscheduled;
        const time = uns ? 'No slot' : `${S.minToHHMM(b.startMin)}–${S.minToHHMM(b.endMin)}`;
        const tagCls = uns ? 'tag--warn' : (idx < 3 ? 'tag--p' + (idx + 1) : 'tag--px');
        list.append(todoRow(job, time, 'P' + (idx + 1), tagCls));
      });
    }
  }

  function todoRow(job, time, tagText, tagCls) {
    const row = el('div', 'litem' + (job.done ? ' is-done' : ''));
    row.append(Object.assign(el('div', 'litem__time'), { textContent: time }));
    const body = el('div');
    body.append(Object.assign(el('div', 'litem__title'), { textContent: job.title || '(untitled)' }));
    const meta = el('div', 'litem__meta');
    meta.append(Object.assign(el('span', 'tag ' + tagCls), { textContent: tagText }));
    body.append(meta);
    row.append(body, checkBtn(job));
    return row;
  }

  function checkBtn(job) {
    const chk = el('button', 'check');
    chk.setAttribute('aria-pressed', String(!!job.done));
    chk.setAttribute('aria-label', (job.done ? 'Mark not done: ' : 'Mark done: ') + (job.title || 'task'));
    chk.onclick = (e) => { e.stopPropagation(); job.done = !job.done; S.save(); renderTimebox(); renderTodo(); };
    return chk;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
