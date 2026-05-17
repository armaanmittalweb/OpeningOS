/* OpeningOS — FSRS scheduler
 * Dependency-free FSRS-compatible scheduler surface for the browser build.
 * It follows the public FSRS memory-state contract: stability, difficulty,
 * retrievability, elapsed days, rating 1-4, requested retention, and full
 * scheduler metadata. Parameters are versioned so future official-package
 * migrations can be applied without changing stored review events.
 */
(function (global) {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;
  const DEFAULT_RETENTION = 0.9;
  const DEFAULT_PARAMS = Object.freeze([
    0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
    1.6160, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407,
    2.9466, 0.5034, 0.6567
  ]);
  let requestedRetention = DEFAULT_RETENTION;
  let parameters = DEFAULT_PARAMS.slice();

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) ? Number(n) : lo)); }
  function daysBetween(a, b) { return Math.max(0, ((b || Date.now()) - (a || Date.now())) / DAY); }
  function ratingName(r) { return ({ 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' })[Number(r)] || 'good'; }
  function retrievability(stability, elapsedDays) {
    const s = Math.max(0.01, Number(stability || 0.01));
    return Math.pow(1 + Number(elapsedDays || 0) / (9 * s), -1);
  }
  function intervalFromStability(stability, retention) {
    const s = Math.max(0.01, Number(stability || 0.01));
    const r = clamp(retention == null ? requestedRetention : retention, 0.7, 0.98);
    return clamp(Math.round(9 * s * (Math.pow(r, -1) - 1)), 1, 36500);
  }
  function initDifficulty(rating) {
    return clamp(parameters[4] - Math.exp((Number(rating) || 3) - 1) * parameters[5] + 1, 1, 10);
  }
  function initStability(rating) {
    const r = clamp(Number(rating || 3), 1, 4);
    return Math.max(0.01, parameters[r - 1]);
  }
  function nextDifficulty(d, rating) {
    const delta = -parameters[6] * (Number(rating) - 3);
    const next = d + meanReversion(parameters[4], delta * (10 - d) / 9);
    return clamp(next, 1, 10);
  }
  function meanReversion(init, current) { return parameters[7] * init + (1 - parameters[7]) * current; }
  function nextRecallStability(d, s, r, rating) {
    const hardPenalty = rating === 2 ? parameters[15] : 1;
    const easyBonus = rating === 4 ? parameters[16] : 1;
    const growth = Math.exp(parameters[8]) * (11 - d) * Math.pow(s, -parameters[9]) * (Math.exp((1 - r) * parameters[10]) - 1) * hardPenalty * easyBonus;
    return clamp(s * (1 + growth), 0.01, 36500);
  }
  function nextForgetStability(d, s, r) {
    const next = parameters[11] * Math.pow(d, -parameters[12]) * (Math.pow(s + 1, parameters[13]) - 1) * Math.exp((1 - r) * parameters[14]);
    return clamp(Math.min(next, s / Math.exp(parameters[17] * parameters[18])), 0.01, 36500);
  }
  function learningDelay(rating, hinted) {
    if (rating === 1) return hinted ? 3 * 60 * 1000 : 10 * 60 * 1000;
    if (rating === 2) return 12 * 60 * 60 * 1000;
    return 0;
  }

  function schedule(card, rating, meta) {
    const now = meta && meta.now ? meta.now : Date.now();
    const hinted = !!(meta && meta.hinted);
    const guessed = !!(meta && meta.guessed);
    let r = clamp(Number(rating || 3), 1, 4);
    if (guessed && r > 3) r = 3;
    if (hinted && r > 2) r = 2;
    const old = Object.assign({}, card || {});
    const reps = Number(old.reps || 0);
    let difficulty;
    let stability;
    let elapsedDays = 0;
    let retr = 1;
    let lapses = Number(old.lapses || 0);
    let missRate = Number(old.missRate || 0);
    if (!reps || !old.lastReview || !old.stability) {
      difficulty = initDifficulty(r);
      stability = initStability(r);
    } else {
      elapsedDays = daysBetween(old.lastReview, now);
      retr = retrievability(old.stability, elapsedDays);
      difficulty = nextDifficulty(Number(old.difficulty || 5), r);
      stability = r === 1
        ? nextForgetStability(difficulty, Number(old.stability || 0.1), retr)
        : nextRecallStability(difficulty, Number(old.stability || 0.1), retr, r);
    }
    if (r === 1) {
      lapses += 1;
      missRate = clamp(missRate * 0.72 + 0.28, 0, 1);
    } else {
      missRate = clamp(missRate * (r === 2 ? 0.86 : r === 3 ? 0.72 : 0.58) + (r === 2 ? 0.035 : 0), 0, 1);
    }
    const delay = learningDelay(r, hinted);
    const scheduledDays = delay ? 0 : intervalFromStability(stability, meta && meta.retentionTarget);
    const due = delay ? now + delay : now + scheduledDays * DAY;
    return {
      scheduler: 'fsrs-v5-compatible-local',
      schedulerVersion: 2,
      requestedRetention: meta && meta.retentionTarget || requestedRetention,
      rating: r,
      ratingLabel: ratingName(r),
      difficulty,
      stability,
      retrievability: retr,
      elapsedDays,
      scheduledDays,
      due,
      lapses,
      missRate,
      reps: reps + 1,
      lastReview: now,
      hinted,
      guessed,
    };
  }

  function preview(card, meta) {
    return [1, 2, 3, 4].map(r => ({ rating: r, label: ratingName(r), state: schedule(card, r, meta || {}) }));
  }
  function migrate(card) {
    if (!card) return card;
    if (card.scheduler === 'fsrs-v5-compatible-local' && card.schedulerVersion >= 2) return card;
    return Object.assign({}, card, { scheduler: 'fsrs-v5-compatible-local', schedulerVersion: 2, migratedAt: Date.now() });
  }
  function calibrate(events, opts) {
    const target = clamp(opts && opts.retentionTarget || requestedRetention, 0.7, 0.98);
    const total = (events || []).length;
    if (!total) return { retentionTarget: target, adjusted: false, parameters: parameters.slice() };
    const misses = (events || []).filter(e => Number(e.grade) === 1 || e.outcome === 'wrong').length;
    const observedRetention = clamp(1 - misses / Math.max(1, total), 0.1, 0.99);
    requestedRetention = target;
    return { retentionTarget: target, observedRetention, adjusted: true, parameters: parameters.slice(), events: total };
  }
  function setRetention(value) { requestedRetention = clamp(value, 0.7, 0.98); return requestedRetention; }
  function setParameters(next) { if (Array.isArray(next) && next.length >= 19) parameters = next.slice(0, 19).map(Number); return parameters.slice(); }
  function isDue(card, now) { return !card || !card.due || Number(card.due) <= (now || Date.now()); }
  function isWeak(card) { return !!card && ((card.lapses || 0) >= 2 || (card.missRate || 0) >= 0.4 || (card.difficulty || 0) >= 8); }
  function forecast(cards, days) {
    const now = Date.now();
    const horizon = Math.max(1, Number(days || 30));
    const buckets = Array.from({ length: horizon }, (_, i) => ({ day: i, due: 0 }));
    (cards || []).forEach(c => {
      const d = Math.floor((Number(c.due || now) - now) / DAY);
      if (d >= 0 && d < horizon) buckets[d].due += 1;
    });
    return buckets;
  }

  global.OOSFSRS = {
    DAY,
    DEFAULT_PARAMS: DEFAULT_PARAMS.slice(),
    schedule,
    preview,
    migrate,
    calibrate,
    setRetention,
    setParameters,
    retrievability,
    intervalFromStability,
    isDue,
    isWeak,
    forecast,
    ratingName,
  };
})(window);
