// Pure helpers live in lib.js (unit tested)
const { escHtml, escAttr, scheduleUpdate } = VotingLib;

// ── DOM refs ───────────────────────────────────────────────
const loadingOverlay     = document.getElementById('loadingOverlay');
const closedOverlay      = document.getElementById('closedOverlay');
const app                = document.getElementById('app');
const competitionTitle   = document.getElementById('competitionTitle');
const statusBadge        = document.getElementById('statusBadge');
const alreadyVotedBanner = document.getElementById('alreadyVotedBanner');
const yourVoteEntry      = document.getElementById('yourVoteEntry');
const entryGrid          = document.getElementById('entryGrid');
const searchInput        = document.getElementById('searchInput');
const confirmDialog      = document.getElementById('confirmDialog');
const confirmEntryName   = document.getElementById('confirmEntryName');
const confirmCancelBtn   = document.getElementById('confirmCancelBtn');
const confirmOkBtn       = document.getElementById('confirmOkBtn');

// ── State ──────────────────────────────────────────────────
let visitorId     = null;
let sessionStatus = null;
let sessionData   = {};
let entries       = {};
let votes         = {};
let sessionReady  = false;
let entriesReady  = false;
let votesReady    = false;
let pendingVoteEntryId = null;
let searchTerm = '';

// ── Competition title ──────────────────────────────────────
competitionTitle.textContent = CONFIG.competitionName;
document.title = CONFIG.competitionName + ' — Vote';

// ── Firebase init ──────────────────────────────────────────
// Detect unconfigured placeholder values before attempting to connect
if (CONFIG.FIREBASE_CONFIG.databaseURL.includes('REPLACE_ME')) {
  loadingOverlay.innerHTML = `
    <div style="max-width:480px;padding:2rem;text-align:center;line-height:1.6">
      <strong style="font-size:1.1rem">Firebase setup required</strong><br><br>
      Open <code>constants.js</code> and replace the <code>REPLACE_ME</code> values
      with your Firebase project config.<br><br>
      <span style="font-size:0.9rem;color:#6b7280">
        Firebase Console → Project Settings → Your apps → SDK setup &amp; config
      </span>
    </div>`;
  throw new Error('Firebase not configured');
}

// The voter page uses a *named* Firebase app so its anonymous sign-in is stored
// separately from the admin's. With the default app, voting in the same browser
// would replace the admin's login with an anonymous user and the admin's
// open/close/edit writes would start failing with permission denied.
let db, voterApp;
try {
  voterApp = firebase.initializeApp(CONFIG.FIREBASE_CONFIG, 'voter');
  db = voterApp.database();
} catch (err) {
  loadingOverlay.innerHTML =
    '<p style="color:#dc2626;padding:2rem;text-align:center;max-width:480px">' +
    'Firebase initialization error.<br>Check the console for details.</p>';
  throw err;
}

// Safety timeout: if Firebase never connects within 10 s, show an error
setTimeout(() => {
  if (!sessionReady || !entriesReady || !votesReady) {
    loadingOverlay.innerHTML =
      '<p style="color:#dc2626;padding:2rem;text-align:center;max-width:480px">' +
      'Could not connect to Firebase.<br>' +
      'Check your <code>databaseURL</code> in constants.js and your Firebase database rules.</p>';
  }
}, 10000);

// ── Voter identity (Firebase anonymous auth) ───────────────
// Each browser gets its own random, persistent user ID. Votes are stored
// under votes/<uid>, and the database rules only let a user write their own
// uid, so one browser = one vote and nobody can vote as someone else.
// (The earlier hardware + IP fingerprint made identical phones on the same
// venue Wi-Fi collide, so real voters were told they had already voted.)
async function getVisitorId() {
  const cred = await voterApp.auth().signInAnonymously();
  return cred.user.uid;
}

// ── Reveal app once all three listeners have fired ─────────
function maybeShowApp() {
  if (sessionReady && entriesReady && votesReady) {
    loadingOverlay.hidden = true;
    app.hidden = false;
  }
}

// ── Main init ──────────────────────────────────────────────
async function init() {
  try {
    visitorId = await getVisitorId();
  } catch (err) {
    console.error('Anonymous sign-in failed:', err);
    loadingOverlay.innerHTML =
      '<p style="color:#dc2626;padding:2rem;text-align:center;max-width:480px">' +
      'Could not start a voting session.<br>Please check your connection and reload the page.</p>';
    return;
  }

  db.ref('session').on('value', snap => {
    sessionData   = snap.val() || {};
    sessionStatus = sessionData.status || 'closed';
    sessionReady = true;
    maybeShowApp();
    checkSchedule();
    render();
  });

  db.ref('entries').on('value', snap => {
    entries = snap.val() || {};
    entriesReady = true;
    maybeShowApp();
    render();
  });

  db.ref('votes').on('value', snap => {
    votes = snap.val() || {};
    votesReady = true;
    maybeShowApp();
    render();
  });
}

// ── Render ─────────────────────────────────────────────────
function render() {
  if (!sessionReady || !entriesReady || !votesReady) return;

  const myVote   = votes[visitorId];
  const hasVoted = !!myVote;
  const isOpen   = sessionStatus === 'open';

  // Status badge
  statusBadge.textContent = isOpen ? 'Voting Open' : 'Voting Closed';
  statusBadge.className   = 'status-badge status-badge--' + (isOpen ? 'open' : 'closed');

  // Closed overlay: show only to users who have not yet voted
  closedOverlay.hidden = hasVoted || isOpen;

  // Always hide the old banner — thank you card replaces it
  alreadyVotedBanner.hidden = true;

  searchInput.hidden = hasVoted;

  if (hasVoted) {
    renderThankYou(entries[myVote.entryId] || '(deleted entry)');
  } else {
    renderCards(isOpen);
  }
}

function renderThankYou(entryName) {
  entryGrid.innerHTML = `
    <div class="thank-you-card">
      <div class="thank-you-check"></div>
      <h2 class="thank-you-title">Vote cast!</h2>
      <p class="thank-you-entry">You voted for <strong>${escHtml(entryName)}</strong></p>
      <p class="thank-you-note">Thank you for participating.</p>
    </div>`;
}

function renderCards(isOpen) {
  const entryList = Object.entries(entries)
    .filter(([, name]) => name.toLowerCase().includes(searchTerm));

  if (entryList.length === 0) {
    entryGrid.innerHTML = `<p class="no-entries">${searchTerm ? 'No entries match your search.' : 'No entries have been added yet.'}</p>`;
    return;
  }

  entryGrid.innerHTML = '';

  for (const [id, name] of entryList) {
    const card = document.createElement('div');
    card.className = 'entry-card';
    card.innerHTML = `
      <div class="entry-card__header">
        <span class="entry-card__name">${escHtml(name)}</span>
      </div>
      ${isOpen ? `
      <button class="btn btn-primary vote-btn"
        data-entry-id="${escAttr(id)}"
        data-entry-name="${escAttr(name)}">
        Vote for this entry
      </button>` : ''}
    `;
    entryGrid.appendChild(card);
  }

  // Vote button handlers
  entryGrid.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingVoteEntryId = btn.dataset.entryId;
      confirmEntryName.textContent = btn.dataset.entryName;
      confirmDialog.showModal();
    });
  });
}

// ── Search ─────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  render();
});

// ── Voting schedule (auto open/close) ───────────────────────
// Mirrors the same check in vote-admin-script.js / vote-results-script.js —
// whichever page has a tab open when the scheduled time arrives performs
// the flip, since this is a static site with no server to run it centrally.
function checkSchedule() {
  if (!db) return;
  const update = scheduleUpdate(sessionStatus, sessionData, Date.now(), firebase.database.ServerValue.TIMESTAMP);
  if (update) db.ref('session').update(update);
}

setInterval(checkSchedule, 5000);

// ── Vote submission ────────────────────────────────────────
confirmCancelBtn.addEventListener('click', () => {
  confirmDialog.close();
  pendingVoteEntryId = null;
});

confirmOkBtn.addEventListener('click', async () => {
  if (!pendingVoteEntryId) return;
  confirmOkBtn.disabled    = true;
  confirmCancelBtn.disabled = true;

  try {
    await db.ref('votes/' + visitorId).set({
      entryId: pendingVoteEntryId,
      votedAt: firebase.database.ServerValue.TIMESTAMP
    });
    confirmDialog.close();
  } catch {
    alert('Could not record your vote. Voting may have closed or you may have already voted from this device.');
    confirmDialog.close();
  } finally {
    confirmOkBtn.disabled    = false;
    confirmCancelBtn.disabled = false;
    pendingVoteEntryId = null;
  }
});

// ── Boot ───────────────────────────────────────────────────
init();
