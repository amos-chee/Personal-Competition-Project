// Read-only smoke tests against the deployed app and its live database.
// They only send GET requests, so they cannot change any data.
// Run with: npm run test:live   (set LIVE_TESTS=1; skipped otherwise)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const live = process.env.LIVE_TESTS === '1';
const opts = { skip: live ? false : 'set LIVE_TESTS=1 to run' };

// Read the project config straight from constants.js
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'constants.js'), 'utf8');
const CONFIG = new Function(src + '\nreturn CONFIG;')();
const dbUrl = CONFIG.FIREBASE_CONFIG.databaseURL.replace(/\/$/, '');
const siteUrl = `https://${CONFIG.FIREBASE_CONFIG.projectId}.web.app`;

const get = (url) => fetch(url, { signal: AbortSignal.timeout(15000) });

// ── Realtime Database REST API ─────────────────────────────
for (const node of ['session', 'entries', 'votes']) {
  test(`DB REST: GET /${node}.json is publicly readable JSON`, opts, async () => {
    const res = await get(`${dbUrl}/${node}.json`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    await res.json(); // must parse (null is valid for an empty node)
  });
}

test('DB REST: session has the expected shape', opts, async () => {
  const session = await (await get(`${dbUrl}/session.json`)).json();
  if (session === null) return; // nothing configured yet
  assert.ok(['open', 'closed'].includes(session.status), `unexpected status ${session.status}`);
  for (const k of ['cycleStartedAt', 'openedAt', 'closedAt', 'scheduledOpenAt', 'scheduledCloseAt']) {
    if (session[k] != null) assert.equal(typeof session[k], 'number', k);
  }
});

test('DB REST: every entry is a non-empty string up to 80 chars', opts, async () => {
  const entries = await (await get(`${dbUrl}/entries.json`)).json();
  for (const [id, name] of Object.entries(entries || {})) {
    assert.equal(typeof name, 'string', id);
    assert.ok(name.length > 0 && name.length <= 80, `${id} has length ${name.length}`);
  }
});

test('DB REST: every vote references an existing entry and has a timestamp', opts, async () => {
  const [entries, votes] = await Promise.all(
    ['entries', 'votes'].map(async n => (await get(`${dbUrl}/${n}.json`)).json())
  );
  for (const [uid, v] of Object.entries(votes || {})) {
    assert.ok(entries && entries[v.entryId], `vote ${uid} points at missing entry ${v.entryId}`);
    assert.equal(typeof v.votedAt, 'number', `vote ${uid} has no timestamp`);
  }
});

test('DB REST: paths outside the schema are not readable', opts, async () => {
  const res = await get(`${dbUrl}/secrets.json`);
  assert.equal(res.status, 401);
});

// ── Hosting ────────────────────────────────────────────────
for (const page of ['vote.html', 'vote-admin.html', 'vote-results.html', 'lib.js', 'constants.js']) {
  test(`Hosting: /${page} is served`, opts, async () => {
    const res = await get(`${siteUrl}/${page}`);
    assert.equal(res.status, 200);
  });
}

for (const hidden of ['README.md', 'skills-lock.json', 'database.rules.json', 'package.json']) {
  test(`Hosting: /${hidden} is not published`, opts, async () => {
    const res = await get(`${siteUrl}/${hidden}`);
    assert.equal(res.status, 404);
  });
}

test('Hosting: the deployed lib.js exposes the helpers the pages use', opts, async () => {
  const code = await (await get(`${siteUrl}/lib.js`)).text();
  const mod = { exports: {} };
  new Function('module', 'self', code)(mod, undefined);
  for (const fn of ['escHtml', 'computeResults', 'scheduleUpdate', 'parseCSVFirstColumn']) {
    assert.equal(typeof mod.exports[fn], 'function', fn);
  }
});
