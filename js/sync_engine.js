/* OpeningOS real sync engine
 * Entity-level sync queue with conflict records, BroadcastChannel multi-tab
 * reconciliation, optional websocket updates, and backend integration.
 */
(function (global) {
  'use strict';
  const QUEUE_KEY = 'openingos.sync.queue.v2';
  const META_KEY = 'openingos.sync.meta.v2';
  const CHANNEL = 'openingos-sync-v2';
  const ENTITY_KINDS = ['line','position','edge','annotation','practice_card','review_event','game','deviation','assignment','share','setting'];
  let socket = null;
  let timer = null;
  let flushing = false;
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;

  function now() { return Date.now(); }
  function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || ''); } catch (_) { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function queue() { return read(QUEUE_KEY, []); }
  function saveQueue(q) { write(QUEUE_KEY, q.slice(-2000)); }
  function meta() { return read(META_KEY, { since: 0, deviceId: deviceId(), conflicts: [], lastPush: 0, lastPull: 0 }); }
  function saveMeta(m) { write(META_KEY, m); }
  function deviceId() { let m = read(META_KEY, null); if (m && m.deviceId) return m.deviceId; const id = 'device_' + Math.random().toString(36).slice(2, 11); write(META_KEY, Object.assign(m || {}, { deviceId: id })); return id; }
  function emit(name, detail) { if (global.OOSObservability) global.OOSObservability.emit(name, detail || {}, 'info'); }
  function toast(msg, kind) { if (global.OOSApp && global.OOSApp.toast) global.OOSApp.toast(msg, kind || 'info'); }

  function entity(kind, id, data, deleted) {
    return { id: id || (kind + '_' + now().toString(36)), kind, data: data || {}, deleted: !!deleted, updatedAt: now(), deviceId: deviceId(), version: 1 };
  }
  function enqueue(kind, id, data, deleted) {
    if (!ENTITY_KINDS.includes(kind)) kind = 'setting';
    const ev = entity(kind, id, data, deleted);
    const q = queue(); q.push(ev); saveQueue(q);
    if (bc) bc.postMessage({ type: 'local-change', event: ev });
    emit('sync.enqueued', { kind, id });
    schedule(); return ev;
  }
  function applyRemote(change) {
    if (!change || !change.kind) return;
    const DB = global.OOSData;
    if (!DB || !DB.state) return;
    const data = change.data || {};
    try {
      if (change.kind === 'line' && data.id) {
        if (change.deleted && DB.deleteUserLine) DB.deleteUserLine(data.id);
        else if (DB.addUserLine) DB.addUserLine(data);
      } else if (change.kind === 'review_event') {
        DB.state.reviewEvents = DB.state.reviewEvents || [];
        if (!DB.state.reviewEvents.some(e => e.id === data.id)) DB.state.reviewEvents.push(data);
        DB.persist && DB.persist();
      } else if (change.kind === 'game' && data.id) {
        DB.state.userGames = DB.state.userGames || [];
        const i = DB.state.userGames.findIndex(g => g.id === data.id);
        if (change.deleted && i >= 0) DB.state.userGames.splice(i, 1);
        else if (i >= 0) Object.assign(DB.state.userGames[i], data);
        else DB.state.userGames.push(data);
        DB.persist && DB.persist(); DB.init && DB.init();
      } else if (change.kind === 'annotation' && data.id) {
        DB.state.annotations = DB.state.annotations || {}; DB.state.annotations[data.id] = data; DB.persist && DB.persist();
      } else if (change.kind === 'assignment' && data.id) {
        DB.state.assignments = DB.state.assignments || [];
        const i = DB.state.assignments.findIndex(a => a.id === data.id);
        if (i >= 0) Object.assign(DB.state.assignments[i], data); else DB.state.assignments.push(data);
        DB.persist && DB.persist();
      } else if (change.kind === 'setting') {
        DB.state.settings = Object.assign({}, DB.state.settings || {}, data || {}); DB.persist && DB.persist();
      }
    } catch (e) { emit('sync.apply_failed', { message: e.message, kind: change.kind }); }
  }
  function conflict(a, b) {
    if (!a || !b) return null;
    if (a.deleted !== b.deleted) return 'delete-vs-update';
    if (JSON.stringify(a.data || {}) !== JSON.stringify(b.data || {}) && a.deviceId !== b.deviceId) return 'concurrent-update';
    return null;
  }
  function resolve(local, remote) {
    const c = conflict(local, remote);
    if (!c) return { winner: (remote.updatedAt || 0) >= (local.updatedAt || 0) ? remote : local, conflict: null };
    const merged = Object.assign({}, local, { data: Object.assign({}, remote.data || {}, local.data || {}), updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0), conflictResolved: true });
    const m = meta(); m.conflicts = (m.conflicts || []).concat([{ id: local.id, kind: local.kind, type: c, local, remote, resolvedAt: now() }]).slice(-100); saveMeta(m);
    return { winner: merged, conflict: c };
  }
  async function flush() {
    if (flushing || !global.OOSSaaS || !global.OOSSaaS.signedIn()) return { pushed: 0, pulled: 0 };
    flushing = true;
    try {
      const q = queue();
      let pushed = 0;
      if (q.length) {
        const out = await global.OOSSaaS.pushEntityChanges(q);
        pushed = q.length;
        saveQueue([]);
        const m = meta(); m.lastPush = now(); if (out && out.serverTime) m.since = Math.max(m.since || 0, Number(out.serverTime)); saveMeta(m);
      }
      const m = meta();
      const pulled = await global.OOSSaaS.pullEntityChanges(m.since || 0);
      let count = 0;
      (pulled.changes || []).forEach(remote => {
        if (remote.deviceId === deviceId()) return;
        applyRemote(remote); count++;
      });
      m.lastPull = now(); if (pulled.serverTime) m.since = Number(pulled.serverTime); saveMeta(m);
      if (pushed || count) toast(`Sync complete: ${pushed} pushed, ${count} pulled`, 'good');
      return { pushed, pulled: count };
    } catch (e) {
      emit('sync.flush_failed', { message: e.message });
      return { error: e.message };
    } finally { flushing = false; }
  }
  function schedule(delay) { clearTimeout(timer); timer = setTimeout(flush, delay || 1500); }
  async function connectRealtime() {
    if (!global.OOSSaaS || !global.OOSSaaS.signedIn()) return null;
    if (socket && socket.readyState <= 1) return socket;
    try {
      if (global.OOSSaaS.openRealtime) {
        socket = await global.OOSSaaS.openRealtime(msg => {
          if (msg && msg.type === 'change') applyRemote(msg.change);
          if (msg && msg.type === 'invalidate') schedule(100);
        });
        socket.onopen = () => emit('sync.websocket_open', {});
        socket.onclose = () => { emit('sync.websocket_closed', {}); setTimeout(connectRealtime, 5000); };
        return socket;
      }
    } catch (e) { emit('sync.websocket_failed', { message: e.message }); }
    try {
      const c = global.OOSSaaS.config ? global.OOSSaaS.config() : null;
      if (c && c.backendUrl && c.token && typeof EventSource !== 'undefined') {
        const es = new EventSource(c.backendUrl + '/sync/events?token=' + encodeURIComponent(c.token));
        es.onmessage = ev => { try { const msg = JSON.parse(ev.data); if (msg.type === 'change') applyRemote(msg.change); } catch (_) {} };
        es.addEventListener('heartbeat', () => schedule(500));
        es.onerror = () => { emit('sync.sse_closed', {}); es.close(); setTimeout(connectRealtime, 5000); };
        socket = { readyState: 1, close: () => es.close() };
        emit('sync.sse_open', {});
        return socket;
      }
    } catch (e) { emit('sync.sse_failed', { message: e.message }); }
    return null;
  }
  function patchDataLayer() {
    const DB = global.OOSData; if (!DB || DB.__syncPatched) return; DB.__syncPatched = true;
    const origAdd = DB.addUserLine && DB.addUserLine.bind(DB);
    if (origAdd) DB.addUserLine = function (line) { const saved = origAdd(line); enqueue('line', saved.id, saved); return saved; };
    const origUpdate = DB.updateUserLine && DB.updateUserLine.bind(DB);
    if (origUpdate) DB.updateUserLine = function (id, patch) { const saved = origUpdate(id, patch); if (saved) enqueue('line', id, saved); return saved; };
    const origDelete = DB.deleteUserLine && DB.deleteUserLine.bind(DB);
    if (origDelete) DB.deleteUserLine = function (id) { const old = DB.line(id); const ok = origDelete(id); if (ok) enqueue('line', id, old || { id }, true); return ok; };
    const origGrade = DB.grade && DB.grade.bind(DB);
    if (origGrade) DB.grade = function (cardId, grade, meta) { const r = origGrade(cardId, grade, meta); const events = DB.reviewEvents ? DB.reviewEvents(1) : []; if (events[0]) enqueue('review_event', events[0].id, events[0]); return r; };
    const origGame = DB.addUserGame && DB.addUserGame.bind(DB);
    if (origGame) DB.addUserGame = function (game) { const g = origGame(game); enqueue('game', g.id, g); return g; };
    const origSetting = DB.setSetting && DB.setSetting.bind(DB);
    if (origSetting) DB.setSetting = function (key, value) { const r = origSetting(key, value); enqueue('setting', 'settings', { [key]: value }); return r; };
  }
  if (bc) bc.onmessage = ev => { if (ev.data && ev.data.type === 'local-change') schedule(500); };
  window.addEventListener('online', () => schedule(100));
  window.addEventListener('DOMContentLoaded', () => { patchDataLayer(); if (global.OOSSaaS && global.OOSSaaS.signedIn()) { schedule(1200); connectRealtime(); } });
  setInterval(() => { if (global.OOSSaaS && global.OOSSaaS.signedIn()) schedule(100); }, 60000);

  global.OOSSyncEngine = { enqueue, flush, schedule, meta, queue, resolve, applyRemote, connectRealtime, patchDataLayer, deviceId };
})(window);
