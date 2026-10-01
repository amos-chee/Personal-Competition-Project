// ── DOM refs ───────────────────────────────────────────────
const loginOverlay         = document.getElementById('loginOverlay');
const loginForm            = document.getElementById('loginForm');
const emailInput           = document.getElementById('emailInput');
const passwordInput        = document.getElementById('passwordInput');
const loginBtn             = document.getElementById('loginBtn');
const loginError           = document.getElementById('loginError');
const signOutBtn           = document.getElementById('signOutBtn');
const adminApp            = document.getElementById('adminApp');
const competitionTitle     = document.getElementById('competitionTitle');
const totalVotesBadge      = document.getElementById('totalVotesBadge');
const sessionToggleBtn     = document.getElementById('sessionToggleBtn');
const refreshBtn           = document.getElementById('refreshBtn');
const exportCsvBtn         = document.getElementById('exportCsvBtn');
const resetVotesBtn        = document.getElementById('resetVotesBtn');
const cycleHoursInput      = document.getElementById('cycleHoursInput');
const cycleMinutesInput    = document.getElementById('cycleMinutesInput');
const saveCycleBtn         = document.getElementById('saveCycleBtn');
const resetCycleBtn        = document.getElementById('resetCycleBtn');
const scheduledOpenInput   = document.getElementById('scheduledOpenInput');
const scheduledCloseInput  = document.getElementById('scheduledCloseInput');
const saveScheduleBtn      = document.getElementById('saveScheduleBtn');
const clearScheduleBtn     = document.getElementById('clearScheduleBtn');
const scheduleStatusMsg    = document.getElementById('scheduleStatusMsg');
const resultsTable         = document.getElementById('resultsTable');
const resultsBody          = document.getElementById('resultsBody');
const noVotesMsg           = document.getElementById('noVotesMsg');
const newEntryInput        = document.getElementById('newEntryInput');
const addEntryBtn          = document.getElementById('addEntryBtn');
const entriesList          = document.getElementById('entriesList');
const noEntriesMsg         = document.getElementById('noEntriesMsg');
const importCsvBtn         = document.getElementById('importCsvBtn');
const importCsvInput       = document.getElementById('importCsvInput');
const exportEntriesCsvBtn  = document.getElementById('exportEntriesCsvBtn');
const deleteAllEntriesBtn  = document.getElementById('deleteAllEntriesBtn');
const confirmDialog        = document.getElementById('confirmDialog');
const confirmTitle         = document.getElementById('confirmTitle');
const confirmMsg           = document.getElementById('confirmMsg');
const confirmCancelBtn     = document.getElementById('confirmCancelBtn');
const confirmOkBtn         = document.getElementById('confirmOkBtn');
const deleteEntryDialog    = document.getElementById('deleteEntryDialog');
const deleteEntryNameEl    = document.getElementById('deleteEntryName');
const deleteEntryCancelBtn = document.getElementById('deleteEntryCancelBtn');
const deleteEntryConfirmBtn= document.getElementById('deleteEntryConfirmBtn');

// ── State ──────────────────────────────────────────────────
let db             = null;
let sessionStatus  = 'closed';
let sessionData    = {};
let entries        = {};  // { entryId: name }
let votes          = {};  // { fingerprint: { entryId, votedAt } }
let pendingDeleteId = null;

// ── Competition title ──────────────────────────────────────
competitionTitle.textContent = CONFIG.competitionName;
document.title = CONFIG.competitionName + ' — Admin';

// ── Admin authentication (Firebase Auth, email + password) ──
// Any signed-in user sees the dashboard, but database.rules.json only lets
// the admin's UID write, so everyone else just gets permission errors.
let auth = null;
let dashboardStarted = false;

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = false;
}

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.disabled = true;
  try {
    await auth.signInWithEmailAndPassword(emailInput.value.trim(), passwordInput.value);
  } catch (err) {
    console.error('Sign-in failed:', err);
    showLoginError('Incorrect email or password.');
    passwordInput.value = '';
    passwordInput.focus();
  } finally {
    loginBtn.disabled = false;
  }
});

signOutBtn.addEventListener('click', async () => {
  await auth.signOut();
  location.reload();
});

function showSetupBanner(html) {
  // No usable Firebase config, so sign-in is impossible: reveal the page so the banner is visible
  loginOverlay.hidden = true;
  adminApp.hidden     = false;
  showFirebaseBanner(html);
}

function initAuth() {
  // Detect unconfigured placeholder values
  if (CONFIG.FIREBASE_CONFIG.databaseURL.includes('REPLACE_ME')) {
    showSetupBanner(
      'Firebase setup required — open <code>constants.js</code> and replace the ' +
      '<code>REPLACE_ME</code> values with your Firebase project config.<br>' +
      '<span style="font-size:0.85rem;opacity:0.8">Firebase Console → Project Settings → Your apps → SDK setup &amp; config</span>'
    );
    return;
  }

  try {
    firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
  } catch (err) {
    showSetupBanner('Firebase initialization error — check the browser console for details.');
    return;
  }
  auth = firebase.auth();

  auth.onAuthStateChanged(user => {
    if (!user) {
      loginOverlay.hidden = false;
      adminApp.hidden     = true;
      return;
    }
    loginOverlay.hidden = true;
    adminApp.hidden     = false;
    startDashboard();
  });
}

// ── Dashboard (runs once, after the admin has signed in) ────
function startDashboard() {
  if (dashboardStarted) return;
  dashboardStarted = true;
  db = firebase.database();

  // Seed entries from CONFIG.entries if the Firebase entries node is empty
  db.ref('entries').once('value').then(snap => {
    if (!snap.val()) {
      Promise.all(CONFIG.entries.map(name => db.ref('entries').push(name)));
    }
  });

  // Auto-start a 3-hour cycle if none has been started yet
  db.ref('session/cycleStartedAt').once('value').then(snap => {
    if (!snap.val()) {
      db.ref('session').update({
        cycleDurationMinutes: 180,
        cycleStartedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  });

  // Real-time listeners
  let firstFire = false;
  const connectionTimeout = setTimeout(() => {
    if (!firstFire) {
      showFirebaseBanner(
        'Could not connect to Firebase after 10 seconds.<br>' +
        'Check your <code>databaseURL</code> in <code>constants.js</code> and your Firebase database rules.'
      );
    }
  }, 10000);

  db.ref('session').on('value', snap => {
    firstFire = true;
    clearTimeout(connectionTimeout);
    const data = snap.val() || {};
    sessionData   = data;
    sessionStatus = data.status || 'closed';
    renderSessionBtn();
    // Sync cycle inputs — support both new (cycleDurationMinutes) and old (cycleDurationHours) format
    if (document.activeElement !== cycleHoursInput && document.activeElement !== cycleMinutesInput) {
      const totalMins = data.cycleDurationMinutes != null ? data.cycleDurationMinutes
                      : data.cycleDurationHours   != null ? data.cycleDurationHours * 60
                      : 180;
      cycleHoursInput.value   = Math.floor(totalMins / 60);
      cycleMinutesInput.value = totalMins % 60;
    }
    syncScheduleInputs();
    checkSchedule();
  });

  db.ref('entries').on('value', snap => {
    entries = snap.val() || {};
    renderResults();
    renderEntriesList();
  });

  db.ref('votes').on('value', snap => {
    votes = snap.val() || {};
    renderResults();
    renderEntriesList();
  });
}

// ── Tab switching ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    btn.classList.add('tab-btn--active');
    const tab = btn.dataset.tab;
    document.getElementById('tabResults').hidden = (tab !== 'results');
    document.getElementById('tabEntries').hidden = (tab !== 'entries');
  });
});

// ── Session management ─────────────────────────────────────
function renderSessionBtn() {
  if (sessionStatus === 'open') {
    sessionToggleBtn.textContent = 'Close Voting';
    sessionToggleBtn.className   = 'btn btn-session-close';
  } else {
    sessionToggleBtn.textContent = 'Open Voting';
    sessionToggleBtn.className   = 'btn btn-session-open';
  }
}

sessionToggleBtn.addEventListener('click', () => {
  if (!db) return;
  const newStatus = sessionStatus === 'open' ? 'closed' : 'open';
  const now = firebase.database.ServerValue.TIMESTAMP;
  const update = { status: newStatus };
  if (newStatus === 'open')   update.openedAt = now;
  if (newStatus === 'closed') update.closedAt = now;
  db.ref('session').update(update);
});

// ── Manual refresh ─────────────────────────────────────────
refreshBtn.addEventListener('click', async () => {
  refreshBtn.textContent = 'Refreshing...';
  refreshBtn.disabled = true;
  try {
    const [entriesSnap, votesSnap] = await Promise.all([
      db.ref('entries').once('value'),
      db.ref('votes').once('value')
    ]);
    entries = entriesSnap.val() || {};
    votes   = votesSnap.val()   || {};
    renderResults();
    renderEntriesList();
  } finally {
    refreshBtn.textContent = 'Refresh';
    refreshBtn.disabled = false;
  }
});

// ── Generic confirm dialog ─────────────────────────────────
let pendingConfirmAction = null;

confirmCancelBtn.addEventListener('click', () => {
  confirmDialog.close();
  pendingConfirmAction = null;
});

confirmOkBtn.addEventListener('click', async () => {
  if (!pendingConfirmAction) return;
  confirmOkBtn.disabled     = true;
  confirmCancelBtn.disabled = true;
  try {
    await pendingConfirmAction();
    confirmDialog.close();
  } catch (err) {
    console.error('Action failed:', err);
    alert('Action failed: ' + (err.message || 'Permission denied. Check your Firebase database rules.'));
  } finally {
    confirmOkBtn.disabled     = false;
    confirmCancelBtn.disabled = false;
    pendingConfirmAction = null;
  }
});

function showConfirm(title, msg, okLabel, action) {
  confirmTitle.textContent  = title;
  confirmMsg.textContent    = msg;
  confirmOkBtn.textContent  = okLabel;
  pendingConfirmAction      = action;
  confirmDialog.showModal();
}

// ── Cycle configuration ────────────────────────────────────
saveCycleBtn.addEventListener('click', () => {
  if (!db) return;
  const hours     = Math.max(0, parseInt(cycleHoursInput.value)   || 0);
  const minutes   = Math.max(0, Math.min(59, parseInt(cycleMinutesInput.value) || 0));
  const totalMins = hours * 60 + minutes;
  if (totalMins < 1) {
    alert('Cycle duration must be at least 1 minute.');
    return;
  }
  const label = (hours > 0 ? hours + 'h ' : '') + minutes + 'min';
  showConfirm(
    'Save & start cycle?',
    'This will set the cycle to ' + label + ' and restart the countdown immediately.',
    'Save & Start',
    () => {
      cycleHoursInput.value   = hours;
      cycleMinutesInput.value = minutes;
      return db.ref('session').update({
        cycleDurationMinutes: totalMins,
        cycleStartedAt: firebase.database.ServerValue.TIMESTAMP
      });
    }
  );
});

resetCycleBtn.addEventListener('click', () => {
  if (!db) return;
  showConfirm(
    'Reset cycle now?',
    'The countdown will restart from the beginning. The displayed duration stays the same.',
    'Reset Cycle',
    () => db.ref('session/cycleStartedAt').set(firebase.database.ServerValue.TIMESTAMP)
  );
});

// ── Voting schedule (auto open/close) ──────────────────────
// Any of vote.html / vote-admin.html / vote-results.html may perform the
// actual flip — whichever page happens to have a tab open when the
// scheduled time arrives. The fired field is cleared on flip so it can't
// re-trigger after a later manual override.
function toLocalInputValue(epochMs) {
  if (!epochMs) return '';
  const d = new Date(epochMs - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function syncScheduleInputs() {
  if (document.activeElement !== scheduledOpenInput) {
    scheduledOpenInput.value = toLocalInputValue(sessionData.scheduledOpenAt);
  }
  if (document.activeElement !== scheduledCloseInput) {
    scheduledCloseInput.value = toLocalInputValue(sessionData.scheduledCloseAt);
  }
  const parts = [];
  if (sessionData.scheduledOpenAt)  parts.push('Auto-opens ' + new Date(sessionData.scheduledOpenAt).toLocaleString());
  if (sessionData.scheduledCloseAt) parts.push('Auto-closes ' + new Date(sessionData.scheduledCloseAt).toLocaleString());
  scheduleStatusMsg.textContent = parts.join(' · ');
}

function checkSchedule() {
  if (!db) return;
  const now = Date.now();
  if (sessionStatus === 'closed' && sessionData.scheduledOpenAt && now >= sessionData.scheduledOpenAt) {
    db.ref('session').update({
      status: 'open',
      openedAt: firebase.database.ServerValue.TIMESTAMP,
      scheduledOpenAt: null
    });
  } else if (sessionStatus === 'open' && sessionData.scheduledCloseAt && now >= sessionData.scheduledCloseAt) {
    db.ref('session').update({
      status: 'closed',
      closedAt: firebase.database.ServerValue.TIMESTAMP,
      scheduledCloseAt: null
    });
  }
}

setInterval(checkSchedule, 5000);

saveScheduleBtn.addEventListener('click', () => {
  if (!db) return;
  const openVal  = scheduledOpenInput.value  ? new Date(scheduledOpenInput.value).getTime()  : null;
  const closeVal = scheduledCloseInput.value ? new Date(scheduledCloseInput.value).getTime() : null;
  if (openVal && closeVal && openVal >= closeVal) {
    alert('Auto-open time must be before auto-close time.');
    return;
  }
  db.ref('session').update({ scheduledOpenAt: openVal, scheduledCloseAt: closeVal });
});

clearScheduleBtn.addEventListener('click', () => {
  if (!db) return;
  scheduledOpenInput.value  = '';
  scheduledCloseInput.value = '';
  db.ref('session').update({ scheduledOpenAt: null, scheduledCloseAt: null });
});

// ── Results rendering ──────────────────────────────────────
function computeResults() {
  const counts = {};
  for (const v of Object.values(votes)) {
    if (v && v.entryId) counts[v.entryId] = (counts[v.entryId] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return {
    rows: Object.entries(entries)
      .map(([id, name]) => ({
        id,
        name,
        votes: counts[id] || 0,
        pct: total > 0 ? Math.round((counts[id] || 0) / total * 100) : 0
      }))
      .sort((a, b) => b.votes - a.votes),
    total
  };
}

function renderResults() {
  const { rows, total } = computeResults();

  totalVotesBadge.textContent = total + ' vote' + (total !== 1 ? 's' : '');

  const hasVotes = total > 0;
  resultsTable.hidden = !hasVotes;
  noVotesMsg.hidden   = hasVotes;

  resultsBody.innerHTML = '';
  rows.forEach((r, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? 'rank-' + rank : 'rank-other';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="rank-badge ${rankClass}">${rank}</span></td>
      <td>${escHtml(r.name)}</td>
      <td>${r.votes}</td>
      <td>${r.pct}%</td>
      <td><div class="tbl-bar-bg"><div class="tbl-bar-fill" style="width:${r.pct}%"></div></div></td>
    `;
    resultsBody.appendChild(tr);
  });
}

// ── Entries management ─────────────────────────────────────
function getVoteCounts() {
  const counts = {};
  for (const v of Object.values(votes)) {
    if (v && v.entryId) counts[v.entryId] = (counts[v.entryId] || 0) + 1;
  }
  return counts;
}

function renderEntriesList() {
  const counts    = getVoteCounts();
  const entryArr  = Object.entries(entries);

  noEntriesMsg.hidden = entryArr.length > 0;
  entriesList.innerHTML = '';

  for (const [id, name] of entryArr) {
    const voteCount = counts[id] || 0;
    const hasVotes  = voteCount > 0;

    const li = document.createElement('li');
    li.className = 'entry-item';
    li.innerHTML = `
      <div class="entry-item__info">
        <span class="entry-item__name">${escHtml(name)}</span>
        <span class="entry-item__votes">${voteCount} vote${voteCount !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn-delete"
        data-id="${escAttr(id)}"
        data-name="${escAttr(name)}"
        ${hasVotes ? 'disabled title="Cannot delete an entry that has received votes"' : ''}>
        Delete
      </button>
    `;
    entriesList.appendChild(li);
  }

  entriesList.querySelectorAll('.btn-delete:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingDeleteId = btn.dataset.id;
      deleteEntryNameEl.textContent = btn.dataset.name;
      deleteEntryDialog.showModal();
    });
  });
}

// Add entry
addEntryBtn.addEventListener('click', addEntry);
newEntryInput.addEventListener('keydown', e => { if (e.key === 'Enter') addEntry(); });

function addEntry() {
  const name = newEntryInput.value.trim();
  if (!name || !db) return;
  db.ref('entries').push(name).then(() => {
    newEntryInput.value = '';
    newEntryInput.focus();
  });
}

// Delete entry
deleteEntryCancelBtn.addEventListener('click', () => {
  deleteEntryDialog.close();
  pendingDeleteId = null;
});

deleteEntryConfirmBtn.addEventListener('click', async () => {
  if (!pendingDeleteId || !db) return;
  deleteEntryConfirmBtn.disabled = true;
  try {
    await db.ref('entries/' + pendingDeleteId).remove();
    deleteEntryDialog.close();
  } catch {
    alert('Failed to delete entry. Please try again.');
  } finally {
    deleteEntryConfirmBtn.disabled = false;
    pendingDeleteId = null;
  }
});

// ── Import entries from CSV ────────────────────────────────
importCsvBtn.addEventListener('click', () => {
  importCsvInput.value = ''; // reset so same file can be re-selected
  importCsvInput.click();
});

importCsvInput.addEventListener('change', () => {
  const file = importCsvInput.files[0];
  if (!file || !db) return;

  const reader = new FileReader();
  reader.onload = e => {
    const parsed = parseCSVFirstColumn(e.target.result);

    // Skip header row if it matches the export format
    const names = parsed.filter(n => n.toLowerCase() !== 'entry');

    // Deduplicate against existing entries (case-insensitive)
    const existingNames = new Set(Object.values(entries).map(n => n.toLowerCase()));
    const newNames  = names.filter(n => !existingNames.has(n.toLowerCase()));
    const skipped   = names.length - newNames.length;

    if (newNames.length === 0) {
      alert('No new entries to import.' +
        (skipped > 0 ? ' ' + skipped + ' duplicate(s) were skipped.' : ' The CSV appears to be empty.'));
      return;
    }

    const dupeNote = skipped > 0 ? ' (' + skipped + ' duplicate' + (skipped > 1 ? 's' : '') + ' skipped)' : '';
    showConfirm(
      'Import entries from CSV',
      'Add ' + newNames.length + ' new entr' + (newNames.length === 1 ? 'y' : 'ies') + ' to the list?' + dupeNote,
      'Import',
      () => Promise.all(newNames.map(name => db.ref('entries').push(name)))
    );
  };
  reader.readAsText(file);
});

// Parse first column of each non-empty CSV row (handles quoted fields)
function parseCSVFirstColumn(text) {
  const results = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let name;
    if (line.startsWith('"')) {
      const close = line.indexOf('"', 1);
      name = close > 0 ? line.slice(1, close).replace(/""/g, '"') : line.slice(1);
    } else {
      name = line.split(',')[0];
    }
    name = name.trim();
    if (name) results.push(name);
  }
  return results;
}

// ── Delete all entries ─────────────────────────────────────
deleteAllEntriesBtn.addEventListener('click', () => {
  if (!db) return;
  const count = Object.keys(entries).length;
  if (count === 0) { alert('No entries to delete.'); return; }
  showConfirm(
    'Delete all entries?',
    'This will permanently delete all ' + count + ' entries. Entries that have received votes cannot be deleted.',
    'Delete All',
    async () => {
      const counts = getVoteCounts();
      const deletable = Object.keys(entries).filter(id => !counts[id]);
      if (deletable.length === 0) {
        throw new Error('All entries have votes and cannot be deleted.');
      }
      const updates = {};
      deletable.forEach(id => { updates['entries/' + id] = null; });
      await db.ref().update(updates);
      const skipped = count - deletable.length;
      if (skipped > 0) alert(skipped + ' entr' + (skipped === 1 ? 'y' : 'ies') + ' with votes were kept.');
    }
  );
});

// ── Export entries CSV ─────────────────────────────────────
exportEntriesCsvBtn.addEventListener('click', () => {
  const counts  = getVoteCounts();
  const entryArr = Object.entries(entries);
  if (entryArr.length === 0) { alert('No entries to export.'); return; }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows  = [['Entry', 'Votes', 'Percentage']];
  entryArr
    .map(([id, name]) => ({ name, votes: counts[id] || 0 }))
    .sort((a, b) => b.votes - a.votes)
    .forEach(r => {
      const pct = total > 0 ? Math.round(r.votes / total * 100) : 0;
      rows.push([r.name, r.votes, pct + '%']);
    });

  const csv = rows
    .map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'entries.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Reset votes ────────────────────────────────────────────
resetVotesBtn.addEventListener('click', () => {
  if (!db) return;
  showConfirm(
    'Reset all votes?',
    'This will permanently delete all votes. This cannot be undone.',
    'Reset Votes',
    async () => {
      // Parent-level remove() is blocked by rules — delete each vote individually
      const snap = await db.ref('votes').once('value');
      const existing = snap.val();
      if (existing) {
        const updates = {};
        Object.keys(existing).forEach(k => { updates['votes/' + k] = null; });
        await db.ref().update(updates);
      }
    }
  );
});

// ── CSV export ─────────────────────────────────────────────
exportCsvBtn.addEventListener('click', () => {
  const { rows, total } = computeResults();
  const csvRows = [
    ['Rank', 'Entry', 'Votes', 'Percentage'],
    ...rows.map((r, i) => [i + 1, r.name, r.votes, r.pct + '%']),
    ['', 'Total', total, '100%']
  ];

  const csv = csvRows
    .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'crowd-vote-results.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ── Firebase connection banner ─────────────────────────────
function showFirebaseBanner(html) {
  const banner = document.createElement('div');
  banner.style.cssText =
    'background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;' +
    'padding:1rem 1.5rem;margin:1.5rem;line-height:1.6;color:#92400e';
  banner.innerHTML = html;
  // Insert at the top of the currently visible tab panel
  const panel = document.getElementById('tabResults');
  panel.insertBefore(banner, panel.firstChild);
}

// ── Start ──────────────────────────────────────────────────
initAuth();

// ── Helpers ────────────────────────────────────────────────
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
