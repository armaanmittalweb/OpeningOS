/* OpeningOS — local observability and audit bridge
 * Captures client errors, storage risks, sync conflicts, and performance marks
 * without sending data anywhere by default. A backend can later forward these
 * events after explicit user consent.
 */
(function (global) {
  'use strict';

  const KEY = 'openingos.observability.events';
  const LIMIT = 300;

  function nowIso() { return new Date().toISOString(); }
  function safe(obj) {
    try { return JSON.parse(JSON.stringify(obj || {})); }
    catch (_) { return { message: String(obj || '') }; }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch (_) { return []; }
  }
  function save(events) {
    try { localStorage.setItem(KEY, JSON.stringify(events.slice(-LIMIT))); }
    catch (_) {}
  }
  function emit(kind, details, severity) {
    const ev = {
      id: 'obs_' + Math.random().toString(36).slice(2, 9),
      kind,
      severity: severity || 'info',
      details: safe(details),
      at: Date.now(),
      iso: nowIso(),
      route: global.OOSApp && global.OOSApp.route ? global.OOSApp.route() : location.hash || '#today',
      userAgent: navigator.userAgent,
    };
    const events = load();
    events.push(ev);
    save(events);
    try {
      if (global.OOSData && global.OOSData.audit) global.OOSData.audit('observability.' + kind, { severity: ev.severity, details: ev.details });
      if (global.OOSStore && global.OOSStore.appendAudit) global.OOSStore.appendAudit(Object.assign({}, ev, { action: 'observability.' + kind })).catch(() => {});
    } catch (_) {}
    return ev;
  }
  function list() { return load(); }
  function clear() { save([]); }
  function mark(name, details) { return emit('mark.' + name, details || {}, 'info'); }
  function wrap(fn, label) {
    return function wrapped() {
      try { return fn.apply(this, arguments); }
      catch (err) {
        emit('caught_exception', { label, message: err && err.message, stack: err && err.stack }, 'error');
        throw err;
      }
    };
  }

  global.addEventListener('error', event => {
    emit('window_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack,
    }, 'error');
  });
  global.addEventListener('unhandledrejection', event => {
    emit('unhandled_rejection', {
      reason: event.reason && (event.reason.message || String(event.reason)),
      stack: event.reason && event.reason.stack,
    }, 'error');
  });
  global.addEventListener('online', () => emit('network_online', {}, 'info'));
  global.addEventListener('offline', () => emit('network_offline', {}, 'warn'));

  if ('storage' in navigator && navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(estimate => {
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      if (quota && usage / quota > 0.75) emit('storage_quota_warning', { usage, quota, ratio: usage / quota }, 'warn');
      else emit('storage_estimate', { usage, quota, ratio: quota ? usage / quota : null }, 'info');
    }).catch(() => {});
  }

  global.OOSObservability = { emit, list, clear, mark, wrap };
})(window);
