// Pure helpers live in lib.js (unit tested)
const { escHtml, formatDuration, scheduleUpdate } = VotingLib;

// ── DOM refs ───────────────────────────────────────────────
const loadingOverlay   = document.getElementById('loadingOverlay');
const resultsApp       = document.getElementById('resultsApp');
const competitionTitle = document.getElementById('competitionTitle');
const countdownTimer   = document.getElementById('countdownTimer');
const statusBadge      = document.getElementById('statusBadge');
const totalVotesEl     = document.getElementById('totalVotes');
const resultsList      = document.getElementById('resultsList');
const noVotesMsg       = document.getElementById('noVotesMsg');

// ── State ──────────────────────────────────────────────────
let sessionData     = {};
let entries         = {};
let displayedCounts = {}; // only updated at cycle boundaries — never from live votes

let lastCycleNumber    = null;
let lastCycleStartedAt = null;
let isFetching         = false;

let sessionReady = false;
let entriesReady = false;
let votesReady   = false; // set by the one-time initial fetch, not a live listener

// ── Competition title ──────────────────────────────────────
competitionTitle.textContent = CONFIG.competitionName;
document.title = CONFIG.competitionName + ' — Live Results';

// ── Firebase init ──────────────────────────────────────────
if (CONFIG.FIREBASE_CONFIG.databaseURL.includes('REPLACE_ME')) {
  loadingOverlay.innerHTML =
    '<p style="color:#dc2626;padding:2rem;text-align:center">Firebase not configured — update constants.js.</p>';
  throw new Error('Firebase not configured');
}

firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
const db = firebase.database();

// ── Firebase listeners ─────────────────────────────────────

// Session — live (controls countdown, status badge, cycle config)
db.ref('session').on('value', snap => {
  sessionData  = snap.val() || {};
  sessionReady = true;
  maybeShowApp();
  renderStatus();
  updateCountdown(); // reflect cycle changes immediately, don't wait for interval
  checkSchedule();
});

// Entries — live (entry names may change via admin)
db.ref('entries').on('value', snap => {
  entries      = snap.val() || {};
  entriesReady = true;
  maybeShowApp();
  renderResults(); // uses displayedCounts (frozen), not live votes
});

// Votes — ONE-TIME initial read only. No real-time listener.
// Results are re-fetched with once() at each cycle boundary.
db.ref('votes').once('value').then(snap => {
  // Store initial counts but don't display yet — maybeShowApp() handles that
  votesReady = true;
  maybeShowApp();
});

// ── Show app + take first snapshot when all data is ready ──
function maybeShowApp() {
  if (!sessionReady || !entriesReady || !votesReady) return;
  loadingOverlay.hidden = true;
  resultsApp.hidden     = false;

  // Initial fetch — runs only once, after all listeners have fired
  if (lastCycleNumber === null) {
    const info = currentCycleInfo();
    lastCycleNumber    = info.cycleNumber;
    lastCycleStartedAt = info.cycleStartedAt;
    fetchVotesAndDisplay();
  }
}

// ── Fetch votes from Firebase and freeze the display ───────
// Called only at: initial load, cycle boundary, admin cycle reset.
// Never called from the votes listener.
async function fetchVotesAndDisplay() {
  if (isFetching) return;
  isFetching = true;
  try {
    const snap     = await db.ref('votes').once('value');
    const rawVotes = snap.val() || {};
    const counts   = {};
    for (const v of Object.values(rawVotes)) {
      if (v && v.entryId) counts[v.entryId] = (counts[v.entryId] || 0) + 1;
    }
    displayedCounts = counts;
    renderResults();
  } finally {
    isFetching = false;
  }
}

// ── Voting schedule (auto open/close) ───────────────────────
// Mirrors the same check in vote-script.js / vote-admin-script.js —
// whichever page has a tab open when the scheduled time arrives performs
// the flip, since this is a static site with no server to run it centrally.
function checkSchedule() {
  const update = scheduleUpdate(sessionData.status, sessionData, Date.now(), firebase.database.ServerValue.TIMESTAMP);
  if (update) db.ref('session').update(update);
}

setInterval(checkSchedule, 5000);

// ── Countdown + cycle boundary detection ───────────────────
setInterval(updateCountdown, 1000);

function getCycleDurationMinutes() {
  return VotingLib.getCycleDurationMinutes(sessionData);
}

function updateCountdown() {
  const cycleDurationMinutes = getCycleDurationMinutes();
  const { cycleStartedAt } = sessionData;

  if (!cycleStartedAt) {
    countdownTimer.textContent = formatDuration(cycleDurationMinutes * 60);
    return;
  }

  const cycleDurationMs = cycleDurationMinutes * 60000;
  const elapsed         = Date.now() - cycleStartedAt;
  const cycleNumber     = Math.floor(elapsed / cycleDurationMs);
  const remainingMs     = cycleDurationMs - (elapsed % cycleDurationMs);

  countdownTimer.textContent = formatDuration(Math.floor(remainingMs / 1000));

  // Trigger a fresh fetch when: cycle number increments OR admin reset cycleStartedAt
  const cycleChanged     = cycleNumber      !== lastCycleNumber;
  const startedAtChanged = cycleStartedAt   !== lastCycleStartedAt;

  if ((cycleChanged || startedAtChanged) && lastCycleNumber !== null) {
    lastCycleNumber    = cycleNumber;
    lastCycleStartedAt = cycleStartedAt;
    fetchVotesAndDisplay();
  }
}

function currentCycleInfo() {
  return VotingLib.cycleInfo(sessionData, Date.now());
}

// ── Render status badge (always live) ─────────────────────
function renderStatus() {
  const isOpen = sessionData.status === 'open';
  statusBadge.textContent = isOpen ? 'Voting Open' : 'Voting Closed';
  statusBadge.className   = 'status-badge status-badge--' + (isOpen ? 'open' : 'closed');
}

// ── Render results (frozen snapshot only) ──────────────────
function renderResults() {
  if (!sessionReady || !entriesReady || !votesReady) return;

  renderStatus();

  const total = Object.values(displayedCounts).reduce((a, b) => a + b, 0);
  totalVotesEl.textContent = total + ' vote' + (total !== 1 ? 's' : '') + ' total';

  const { rows } = VotingLib.rankRows(displayedCounts, entries);

  noVotesMsg.hidden  = total > 0 || rows.length === 0;
  resultsList.hidden = total === 0;

  resultsList.innerHTML = '';
  rows.forEach((r, i) => {
    const rank       = i + 1;
    const rowClass   = rank === 1 ? 'result-row--first'
                     : rank === 2 ? 'result-row--second'
                     : rank === 3 ? 'result-row--third' : '';
    const badgeClass = rank <= 3 ? 'rank-badge--' + rank : 'rank-badge--n';

    const row = document.createElement('div');
    row.className = 'result-row ' + rowClass;
    row.innerHTML = `
      <div class="rank-badge ${badgeClass}">${rank}</div>
      <div class="result-entry">
        <div class="result-entry__name">${escHtml(r.name)}</div>
        <div class="result-bar-bg">
          <div class="result-bar-fill" style="width:${r.pct}%"></div>
        </div>
      </div>
      <div class="result-count">
        <div class="result-count__votes">${r.votes}</div>
        <div class="result-count__pct">${r.pct}%</div>
      </div>`;
    resultsList.appendChild(row);
  });
}

