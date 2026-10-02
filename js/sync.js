/* Yoon's TO-DO — optional sync to a private Cloudflare R2 bucket (S3 API).
   Lets Eva (Roy's manager bot) read and edit the same plan. Without a key on this
   device it does nothing. Setup: open the page with ?sync and paste
   "ACCOUNT_ID BUCKET ACCESS_KEY_ID SECRET_ACCESS_KEY" (an R2 token scoped to that bucket). */
(() => {
  'use strict';
  const CFG_KEY = 'yoons-todo:r2';
  const SYNCED_KEY = 'yoons-todo:r2:synced'; // set after this device's first merge
  const OBJECT = 'state.json';
  const POLL_MS = 60000;
  const PUSH_DELAY_MS = 1500;

  if (new URLSearchParams(location.search).has('sync')) {
    const v = prompt('R2 sync: ACCOUNT_ID BUCKET ACCESS_KEY_ID SECRET (blank = turn off)');
    if (v !== null) {
      const p = v.trim().split(/\s+/);
      try {
        if (p.length === 4) localStorage.setItem(CFG_KEY, JSON.stringify({ account: p[0], bucket: p[1], keyId: p[2], secret: p[3] }));
        else if (!v.trim()) localStorage.removeItem(CFG_KEY);
        else alert('Need 4 values separated by spaces.');
      } catch (_) { /* storage blocked */ }
    }
    history.replaceState(null, '', location.pathname);
  }

  let cfg;
  try { cfg = JSON.parse(localStorage.getItem(CFG_KEY)); } catch (_) { cfg = null; }

  // Small status label (bottom-left) so sync problems are visible without devtools.
  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;left:8px;bottom:6px;font:11px -apple-system,system-ui,sans-serif;' +
    'opacity:.55;z-index:9999;padding:2px 6px;border-radius:6px;background:rgba(127,127,127,.15);cursor:pointer';
  const status = (t) => { badge.textContent = t; };
  const mount = () => document.body && !badge.isConnected && document.body.appendChild(badge);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  if (!cfg) {
    status('sync: off on this device');
    return;
  }
  status('sync…');
  badge.onclick = () => { status('sync…'); pull(); };
  const hhmm = () => new Date().toTimeString().slice(0, 5);

  const enc = new TextEncoder();
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const sha256 = async (data) => hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data));
  async function hmac(key, msg) {
    const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return crypto.subtle.sign('HMAC', k, enc.encode(msg));
  }

  // AWS Signature V4, S3 flavour, region "auto" (R2).
  async function signed(method, body, extra) {
    const host = `${cfg.account}.r2.cloudflarestorage.com`;
    const path = `/${cfg.bucket}/${OBJECT}`;
    const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const day = amzDate.slice(0, 8);
    const payloadHash = await sha256(body || '');
    const h = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    Object.entries(extra || {}).forEach(([k, v]) => { h[k.toLowerCase()] = v; });
    const names = Object.keys(h).sort();
    const canonical = [method, path, '', ...names.map((n) => `${n}:${h[n]}`), '', names.join(';'), payloadHash].join('\n');
    const scope = `${day}/auto/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256(canonical)].join('\n');
    let k = await hmac('AWS4' + cfg.secret, day);
    for (const part of ['auto', 's3', 'aws4_request']) k = await hmac(k, part);
    const sig = hex(await hmac(k, toSign));
    h.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.keyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`;
    delete h.host; // the browser sets it
    return fetch(`https://${host}${path}`, { method, headers: h, body: method === 'PUT' ? body : undefined, cache: 'no-store' });
  }

  let etag = null;
  let pushTimer = null;
  let dirty = false;
  const local = () => { try { return JSON.parse(localStorage.getItem(S.KEY)); } catch (_) { return null; } };
  const editing = () => /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');

  const hasItems = (st) => st && (st.prioritized.length || st.scheduled.length || (st.brainDump || '').trim());
  function union(a, b) { const ids = new Set(a.map((j) => j.id)); return [...a, ...b.filter((j) => !ids.has(j.id))]; }
  function setLocal(st) { localStorage.setItem(S.KEY, JSON.stringify(st)); }

  async function pull() {
    let res;
    try { res = await signed('GET'); } catch (e) { console.warn('sync pull', e); status(`sync error: network (${e.message || e})`); return; }
    const first = !localStorage.getItem(SYNCED_KEY);
    const mine = local();
    const today = S.planDayKey();
    const mineToday = mine && mine.planDay === today ? mine : null;
    if (res.status === 404) {
      etag = null;
      // First sync: upload a plan made before sync existed (it has no timestamp yet).
      if (first && hasItems(mineToday) && !mineToday.updatedAt) { mineToday.updatedAt = Date.now(); setLocal(mineToday); }
      localStorage.setItem(SYNCED_KEY, '1');
      status(`synced ${hhmm()} (empty)`);
      if ((local() || {}).updatedAt) schedulePush();
      return;
    }
    if (!res.ok) { console.warn('sync pull', res.status); status(`sync error ${res.status}${res.status === 403 ? ' (key or account wrong?)' : ''}`); return; }
    status(`synced ${hhmm()}`);
    etag = res.headers.get('ETag');
    const remote = await res.json();
    if (first) {
      // First sync on this device: merge instead of picking a winner, so nothing is lost.
      localStorage.setItem(SYNCED_KEY, '1');
      if (remote.planDay === today && hasItems(mineToday)) {
        const merged = {
          ...remote,
          brainDump: [remote.brainDump, mineToday.brainDump].filter((x) => (x || '').trim()).join('\n'),
          prioritized: union(remote.prioritized, mineToday.prioritized),
          scheduled: union(remote.scheduled, mineToday.scheduled),
          updatedAt: Date.now(),
        };
        setLocal(merged);
        await push();
        location.reload();
        return;
      }
    }
    if (remote.planDay === today && (!mineToday || (remote.updatedAt || 0) > (mineToday.updatedAt || 0))) {
      if (editing() || dirty) return; // never yank the page mid-edit; next poll retries
      setLocal(remote);
      location.reload();
    } else if (mineToday && (mineToday.updatedAt || 0) > (remote.updatedAt || 0)) {
      schedulePush();
    }
  }

  async function push() {
    pushTimer = null;
    const mine = local();
    if (!mine || !mine.updatedAt) return;
    const cond = etag ? { 'If-Match': etag } : { 'If-None-Match': '*' };
    let res;
    try { res = await signed('PUT', JSON.stringify(mine), { 'content-type': 'application/json', ...cond }); }
    catch (e) { console.warn('sync push', e); status(`sync error: network (${e.message || e})`); return; }
    if (res.status === 412) { dirty = false; return pull(); } // changed elsewhere: newer copy wins
    if (!res.ok) { console.warn('sync push', res.status); status(`sync error ${res.status} on save`); return; }
    dirty = false;
    status(`saved ${hhmm()}`);
    etag = res.headers.get('ETag') || null;
    if (!etag) pull();
  }

  function schedulePush() {
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DELAY_MS);
  }

  const save = S.save;
  S.save = (...a) => { save(...a); schedulePush(); };
  pull();
  setInterval(pull, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
})();
