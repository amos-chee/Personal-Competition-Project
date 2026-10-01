// ============================================================
//  Pure helpers shared by the voter, admin and results pages.
//  No DOM or Firebase access here, so they can be unit tested in
//  Node (see test/unit). Pages load this file with a <script> tag
//  and use window.VotingLib; Node uses require('./lib.js').
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VotingLib = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // ── HTML escaping ────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  // ── Vote counting ────────────────────────────────────────
  // votes: { visitorId: { entryId, votedAt } } → { entryId: count }
  function countVotes(votes) {
    const counts = {};
    for (const v of Object.values(votes || {})) {
      if (v && v.entryId) counts[v.entryId] = (counts[v.entryId] || 0) + 1;
    }
    return counts;
  }

  // Ranked rows for a counts map (entries: { entryId: name }).
  function rankRows(counts, entries) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const rows = Object.entries(entries || {})
      .map(([id, name]) => ({
        id,
        name,
        votes: counts[id] || 0,
        pct: total > 0 ? Math.round((counts[id] || 0) / total * 100) : 0
      }))
      .sort((a, b) => b.votes - a.votes);
    return { rows, total };
  }

  function computeResults(votes, entries) {
    return rankRows(countVotes(votes), entries);
  }

  // ── CSV import ───────────────────────────────────────────
  // First column of each non-empty row (handles quoted fields).
  function parseCSVFirstColumn(text) {
    const results = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let name;
      if (line.startsWith('"')) {
        // Quoted field: "" is an escaped quote, a lone " ends the field
        name = '';
        for (let i = 1; i < line.length; i++) {
          if (line[i] !== '"') { name += line[i]; continue; }
          if (line[i + 1] === '"') { name += '"'; i++; continue; }
          break;
        }
      } else {
        name = line.split(',')[0];
      }
      name = name.trim();
      if (name) results.push(name);
    }
    return results;
  }

  // ── Dates and durations ──────────────────────────────────
  // Epoch ms → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">.
  // tzOffsetMinutes defaults to the browser's, as Date#getTimezoneOffset reports it.
  function toLocalInputValue(epochMs, tzOffsetMinutes) {
    if (!epochMs) return '';
    const offset = tzOffsetMinutes != null ? tzOffsetMinutes : new Date().getTimezoneOffset();
    return new Date(epochMs - offset * 60000).toISOString().slice(0, 16);
  }

  function formatDuration(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return String(h).padStart(2, '0') + ':' +
           String(m).padStart(2, '0') + ':' +
           String(s).padStart(2, '0');
  }

  // ── Results display cycle ────────────────────────────────
  function getCycleDurationMinutes(sessionData) {
    // Supports both the new (cycleDurationMinutes) and old (cycleDurationHours) format
    if (sessionData.cycleDurationMinutes != null) return sessionData.cycleDurationMinutes;
    if (sessionData.cycleDurationHours   != null) return sessionData.cycleDurationHours * 60;
    return 180; // default 3 hours
  }

  function cycleInfo(sessionData, now) {
    const { cycleStartedAt } = sessionData;
    if (!cycleStartedAt) return { cycleNumber: 0, cycleStartedAt: null };
    const cycleNumber = Math.floor((now - cycleStartedAt) / (getCycleDurationMinutes(sessionData) * 60000));
    return { cycleNumber, cycleStartedAt };
  }

  // ── Voting schedule (auto open/close) ────────────────────
  // Returns the Firebase update to apply right now, or null. `serverTime` is
  // the value to store for openedAt/closedAt (ServerValue.TIMESTAMP in the pages).
  function scheduleUpdate(status, sessionData, now, serverTime) {
    if (status === 'closed' && sessionData.scheduledOpenAt && now >= sessionData.scheduledOpenAt) {
      return { status: 'open', openedAt: serverTime, scheduledOpenAt: null };
    }
    if (status === 'open' && sessionData.scheduledCloseAt && now >= sessionData.scheduledCloseAt) {
      return { status: 'closed', closedAt: serverTime, scheduledCloseAt: null };
    }
    return null;
  }

  return {
    escHtml, escAttr, countVotes, rankRows, computeResults, parseCSVFirstColumn,
    toLocalInputValue, formatDuration, getCycleDurationMinutes, cycleInfo, scheduleUpdate
  };
});
