/* OpeningOS — profile registry
 * Manages multiple profiles in localStorage. Each profile has its own
 * namespaced state. The registry stores: profile list, active profile id.
 */
(function (global) {
  'use strict';

  const REGISTRY_KEY = 'openingos.profiles';

  function loadRegistry() {
    try {
      const raw = localStorage.getItem(REGISTRY_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }
  function saveRegistry(r) {
    try { localStorage.setItem(REGISTRY_KEY, JSON.stringify(r)); } catch (_) {}
  }

  function uid() {
    return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || '·';
  }

  // Pleasant, accessible avatar colors
  const COLORS = [
    '#91b89f', '#d4b27a', '#7aa3d9', '#c693c2', '#d97a7a', '#7fb98a', '#d9b27a', '#a597d9',
  ];
  function pickColor(seed) {
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return COLORS[Math.abs(h) % COLORS.length];
  }
  function cleanName(name) {
    return String(name || 'New profile').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || 'New profile';
  }
  function cleanRole(role) {
    return ['player', 'coach', 'student'].includes(role) ? role : 'player';
  }

  const Profiles = {
    state: null, // { activeId, profiles: [{id,name,color,initials,createdAt,role}] }
    init() {
      let s = loadRegistry();
      if (!s || !s.profiles || s.profiles.length === 0) {
        s = { activeId: null, profiles: [] };
      }
      this.state = s;
      // If no active profile, leave it null — UI will prompt to create.
      return s;
    },
    list() { return this.state.profiles.slice(); },
    activeId() { return this.state.activeId; },
    active() {
      return this.state.profiles.find(p => p.id === this.state.activeId) || null;
    },
    create({ name, role = 'player', accountEmail = '' }) {
      const id = uid();
      const safeName = cleanName(name);
      const profile = {
        id,
        name: safeName,
        role: cleanRole(role),
        color: pickColor(id),
        initials: initials(safeName),
        createdAt: Date.now(),
        accountEmail: String(accountEmail || '').toLowerCase(),
      };
      this.state.profiles.push(profile);
      this.state.activeId = id;
      saveRegistry(this.state);
      return profile;
    },
    rename(id, name) {
      const p = this.state.profiles.find(x => x.id === id);
      if (!p) return;
      const safeName = cleanName(name);
      p.name = safeName;
      p.initials = initials(safeName);
      saveRegistry(this.state);
    },
    setRole(id, role) {
      const p = this.state.profiles.find(x => x.id === id);
      if (!p) return;
      p.role = cleanRole(role);
      saveRegistry(this.state);
    },
    remove(id) {
      this.state.profiles = this.state.profiles.filter(x => x.id !== id);
      // Also remove namespaced storage
      const prefix = 'openingos.v2.' + id + '.';
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      if (this.state.activeId === id) {
        this.state.activeId = (this.state.profiles[0] || {}).id || null;
      }
      saveRegistry(this.state);
    },
    activate(id) {
      if (!this.state.profiles.find(x => x.id === id)) return;
      this.state.activeId = id;
      saveRegistry(this.state);
    },

    // Storage helpers — namespaced per active profile
    storageKey(suffix) {
      const id = this.state.activeId;
      if (!id) return null;
      return 'openingos.v2.' + id + '.' + suffix;
    },
    load(suffix) {
      const k = this.storageKey(suffix);
      if (!k) return null;
      try {
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
      } catch (_) { return null; }
    },
    save(suffix, value) {
      const k = this.storageKey(suffix);
      if (!k) return;
      try { localStorage.setItem(k, JSON.stringify(value)); } catch (_) {}
    },
  };

  global.OOSProfiles = Profiles;
})(window);
