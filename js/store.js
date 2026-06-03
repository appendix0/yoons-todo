/* Yoon's TO-DO — shared store (state, KST time, timebox builder).
   Loaded on both pages as global `S`. */
window.S = (() => {
  'use strict';

  const KEY = 'yoons-todo:v2';
  const TZ_OFFSET_MIN = 9 * 60; // KST = UTC+9, no DST
  const RESET_HOUR = 6;         // day resets at 06:00 KST

  // Timebox window. NOTE: "0630–1200" read as 06:30 → midnight (00:00).
  // For 06:30 → NOON instead, set DAY_END_MIN = 12 * 60.
  const DAY_START_MIN = 6 * 60 + 30;
  const DAY_END_MIN   = 24 * 60;
  const STEP_MIN      = 15;
  const SLOT_COUNT    = (DAY_END_MIN - DAY_START_MIN) / STEP_MIN;

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

  const uid = () =>
    (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now() + Math.random().toString(16).slice(2));
  const pad = (n) => String(n).padStart(2, '0');
  const round15 = (m) => Math.max(STEP_MIN, Math.round(m / STEP_MIN) * STEP_MIN);
  const snapToGrid = (m) => DAY_START_MIN + Math.round((m - DAY_START_MIN) / STEP_MIN) * STEP_MIN;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

  // ── KST helpers ──
  const kstShift = (d = new Date()) => new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
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
    return `${a.getUTCFullYear()}-${pad(a.getUTCMonth() + 1)}-${pad(a.getUTCDate())}`;
  }
  function msUntilReset(d = new Date()) {
    const k = kstShift(d);
    const next = new Date(k.getTime());
    next.setUTCHours(RESET_HOUR, 0, 0, 0);
    if (k.getUTCHours() >= RESET_HOUR) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - k.getTime();
  }
  function timeToMin(s) {
    if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
    const [h, m] = s.split(':').map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  const minToHHMM = (min) => { const m = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };

  // ── State + daily reset ──
  let state;
  const blank = (dayKey) => ({ planDay: dayKey, brainDump: '', scheduled: [], prioritized: [] });
  function loadRaw() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (_) { return null; } }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function ensureDay() {
    const dk = planDayKey();
    const s = loadRaw();
    let reset = false;
    if (!s || s.planDay !== dk) { state = blank(dk); save(); reset = true; }
    else state = s;
    return reset;
  }
  const findJob = (id) =>
    state.scheduled.find((j) => j.id === id) || state.prioritized.find((j) => j.id === id);

  // ── Timebox builder ──
  // Order of `prioritized` array IS the priority (index 0 = P1).
  function buildTimebox() {
    const occ = new Array(SLOT_COUNT).fill(false);
    const blocks = [];
    const mark = (s, e) => { for (let m = s; m < e; m += STEP_MIN) { const i = (m - DAY_START_MIN) / STEP_MIN; if (i >= 0 && i < SLOT_COUNT) occ[i] = true; } };

    state.scheduled.forEach((j) => {
      const s = timeToMin(j.start), e = timeToMin(j.end);
      if (s == null || e == null || e <= s) return;
      blocks.push({ jobId: j.id, kind: 'fixed', startMin: s, endMin: e, dur: e - s });
      mark(s, e);
    });

    const auto = [];
    state.prioritized.forEach((j, idx) => {
      const rank = idx + 1;
      const dur = round15(j.mins || 30);
      if (j.atMin != null) {
        const s = clamp(snapToGrid(j.atMin), DAY_START_MIN, DAY_END_MIN - dur);
        blocks.push({ jobId: j.id, kind: 'prio', rank, startMin: s, endMin: s + dur, dur });
        mark(s, s + dur);
      } else auto.push({ j, rank, dur });
    });

    let ptr = 0;
    auto.forEach(({ j, rank, dur }) => {
      const need = dur / STEP_MIN;
      while (ptr < SLOT_COUNT && occ[ptr]) ptr++;
      if (ptr >= SLOT_COUNT) { blocks.push({ jobId: j.id, kind: 'prio', rank, unscheduled: true, dur }); return; }
      const startIdx = ptr; let count = 0;
      while (ptr < SLOT_COUNT && !occ[ptr] && count < need) { occ[ptr] = true; ptr++; count++; }
      const s = DAY_START_MIN + startIdx * STEP_MIN;
      blocks.push({ jobId: j.id, kind: 'prio', rank, startMin: s, endMin: s + count * STEP_MIN, dur });
    });

    return blocks;
  }

  // Calendar column layout for overlapping blocks (returns positioned items).
  function layoutBlocks(blocks) {
    const items = blocks
      .filter((b) => b.startMin != null)
      .map((b) => ({ ...b, s: clamp(b.startMin, DAY_START_MIN, DAY_END_MIN), e: clamp(b.endMin, DAY_START_MIN, DAY_END_MIN) }))
      .filter((b) => b.e > b.s)
      .sort((a, b) => a.s - b.s || a.e - b.e);

    let cluster = [], clusterEnd = -1;
    const flush = () => {
      const cols = [];
      cluster.forEach((it) => {
        let placed = false;
        for (let c = 0; c < cols.length; c++) { if (it.s >= cols[c]) { it.col = c; cols[c] = it.e; placed = true; break; } }
        if (!placed) { it.col = cols.length; cols.push(it.e); }
      });
      cluster.forEach((it) => { it.cols = cols.length; });
      cluster = []; clusterEnd = -1;
    };
    items.forEach((it) => {
      if (cluster.length && it.s >= clusterEnd) flush();
      cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
    });
    if (cluster.length) flush();
    return items;
  }

  return {
    KEY, DAY_START_MIN, DAY_END_MIN, STEP_MIN, SLOT_COUNT, QUOTES,
    uid, pad, round15, snapToGrid, clamp,
    kstParts, planDayKey, msUntilReset, timeToMin, minToHHMM,
    save, ensureDay, findJob, buildTimebox, layoutBlocks,
    get state() { return state; },
  };
})();
