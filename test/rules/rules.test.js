// Security-rules tests for database.rules.json, run against the Firebase
// Realtime Database emulator (it never touches live data).
// Run with: npm run test:rules   (needs Java; see README → Testing)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app');
require('firebase/compat/database');

const ADMIN_UID = 'admin-uid';
const rules = fs
  .readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')
  .replaceAll('REPLACE_WITH_ADMIN_UID', ADMIN_UID);

const TS = () => firebase.database.ServerValue.TIMESTAMP;
const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000').split(':');

let env;
const admin  = () => env.authenticatedContext(ADMIN_UID).database();
const voter  = uid => env.authenticatedContext(uid).database();
const anon   = () => env.unauthenticatedContext().database();

// Seed data bypassing the rules
async function seed(data) {
  await env.withSecurityRulesDisabled(async ctx => {
    await ctx.database().ref().set(data);
  });
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-voting-rules',
    database: { host, port: Number(port), rules }
  });
});

test.after(async () => { await env.cleanup(); });

test.beforeEach(async () => { await env.clearDatabase(); });

// ── Reads ──────────────────────────────────────────────────
test('anyone can read session, entries and votes', async () => {
  await seed({ session: { status: 'open' }, entries: { e1: 'Alpha' }, votes: { u1: { entryId: 'e1', votedAt: 1 } } });
  for (const p of ['session', 'entries', 'votes']) {
    await assertSucceeds(anon().ref(p).get());
  }
});

test('nothing outside the known paths is readable or writable', async () => {
  await assertFails(anon().ref('secrets').get());
  await assertFails(admin().ref('secrets').set('x'));
});

// ── Entries ────────────────────────────────────────────────
test('admin can add and delete entries', async () => {
  await assertSucceeds(admin().ref('entries').push('Alpha'));
  await assertSucceeds(admin().ref('entries/e2').set('Beta'));
  await assertSucceeds(admin().ref('entries/e2').remove());
});

test('unauthenticated users and other signed-in users cannot write entries', async () => {
  await assertFails(anon().ref('entries').push('Hacked'));
  await assertFails(voter('someone-else').ref('entries').push('Hacked'));
});

test('entry names are validated (non-empty, max 80 chars)', async () => {
  await assertFails(admin().ref('entries/e1').set(''));
  await assertFails(admin().ref('entries/e1').set('x'.repeat(81)));
  await assertSucceeds(admin().ref('entries/e1').set('x'.repeat(80)));
  await assertFails(admin().ref('entries/e1').set(123));
});

test('non-admins cannot delete entries', async () => {
  await seed({ entries: { e1: 'Alpha' } });
  await assertFails(anon().ref('entries/e1').remove());
  await assertFails(voter('u1').ref('entries/e1').remove());
});

// ── Session (admin-controlled) ─────────────────────────────
test('admin can open and close voting and set cycle values', async () => {
  const db = admin();
  await assertSucceeds(db.ref('session').update({ status: 'open', openedAt: TS() }));
  await assertSucceeds(db.ref('session').update({ status: 'closed', closedAt: TS() }));
  await assertSucceeds(db.ref('session').update({ cycleDurationMinutes: 90, cycleStartedAt: TS() }));
  await assertSucceeds(db.ref('session').update({ scheduledOpenAt: 5000, scheduledCloseAt: 9000 }));
});

test('non-admins cannot change session state', async () => {
  await seed({ session: { status: 'closed' } });
  for (const db of [anon(), voter('u1')]) {
    await assertFails(db.ref('session/status').set('open'));
    await assertFails(db.ref('session').update({ status: 'open', openedAt: TS() }));
    await assertFails(db.ref('session/cycleDurationMinutes').set(10));
    await assertFails(db.ref('session/cycleStartedAt').set(TS()));
    await assertFails(db.ref('session/scheduledOpenAt').set(1));
  }
});

test('session fields are validated', async () => {
  const db = admin();
  await assertFails(db.ref('session/status').set('paused'));
  await assertFails(db.ref('session/cycleDurationMinutes').set(0));
  await assertFails(db.ref('session/cycleDurationMinutes').set(4321));
  await assertFails(db.ref('session/scheduledOpenAt').set('tomorrow'));
  await assertFails(db.ref('session/unknownField').set(1));
});

// ── Scheduled open/close by any page ───────────────────────
test('anyone may open voting once the scheduled open time has passed', async () => {
  const past = Date.now() - 60_000;
  await seed({ session: { status: 'closed', scheduledOpenAt: past } });
  await assertSucceeds(anon().ref('session').update({
    status: 'open', openedAt: TS(), scheduledOpenAt: null
  }));
});

test('nobody but the admin may open voting before the scheduled time', async () => {
  const future = Date.now() + 3_600_000;
  await seed({ session: { status: 'closed', scheduledOpenAt: future } });
  await assertFails(anon().ref('session').update({ status: 'open', openedAt: TS(), scheduledOpenAt: null }));
  await assertFails(anon().ref('session/status').set('open'));
});

test('without any schedule only the admin can open voting', async () => {
  await seed({ session: { status: 'closed' } });
  await assertFails(anon().ref('session/status').set('open'));
});

test('anyone may close voting once the scheduled close time has passed', async () => {
  const past = Date.now() - 60_000;
  await seed({ session: { status: 'open', scheduledCloseAt: past } });
  await assertSucceeds(anon().ref('session').update({
    status: 'closed', closedAt: TS(), scheduledCloseAt: null
  }));
});

test('nobody but the admin may close voting before the scheduled time', async () => {
  const future = Date.now() + 3_600_000;
  await seed({ session: { status: 'open', scheduledCloseAt: future } });
  await assertFails(anon().ref('session').update({ status: 'closed', closedAt: TS(), scheduledCloseAt: null }));
});

test('a scheduled open cannot be used to close voting, or vice versa', async () => {
  const past = Date.now() - 60_000;
  await seed({ session: { status: 'open', scheduledOpenAt: past } });
  await assertFails(anon().ref('session/status').set('closed'));
});

test('a due schedule does not let anyone change other session fields', async () => {
  const past = Date.now() - 60_000;
  await seed({ session: { status: 'closed', scheduledOpenAt: past } });
  await assertFails(anon().ref('session/cycleDurationMinutes').set(5));
  await assertFails(anon().ref('session/scheduledCloseAt').set(Date.now() + 1000));
});

// ── Votes ──────────────────────────────────────────────────
const openSession = { session: { status: 'open' }, entries: { e1: 'Alpha', e2: 'Beta' } };

test('a signed-in voter can cast one vote under their own uid while voting is open', async () => {
  await seed(openSession);
  await assertSucceeds(voter('u1').ref('votes/u1').set({ entryId: 'e1', votedAt: TS() }));
});

test('a voter cannot vote twice or change their vote', async () => {
  await seed(openSession);
  const db = voter('u1');
  await assertSucceeds(db.ref('votes/u1').set({ entryId: 'e1', votedAt: TS() }));
  await assertFails(db.ref('votes/u1').set({ entryId: 'e2', votedAt: TS() }));
});

test('a voter cannot vote as someone else', async () => {
  await seed(openSession);
  await assertFails(voter('u1').ref('votes/u2').set({ entryId: 'e1', votedAt: TS() }));
});

test('unauthenticated users cannot vote', async () => {
  await seed(openSession);
  await assertFails(anon().ref('votes/u1').set({ entryId: 'e1', votedAt: TS() }));
});

test('nobody can vote while voting is closed', async () => {
  await seed({ session: { status: 'closed' }, entries: { e1: 'Alpha' } });
  await assertFails(voter('u1').ref('votes/u1').set({ entryId: 'e1', votedAt: TS() }));
});

test('votes must reference an existing entry', async () => {
  await seed(openSession);
  await assertFails(voter('u1').ref('votes/u1').set({ entryId: 'nope', votedAt: TS() }));
});

test('votes need a server timestamp and no extra fields', async () => {
  await seed(openSession);
  await assertFails(voter('u1').ref('votes/u1').set({ entryId: 'e1', votedAt: 123 }));
  await assertFails(voter('u1').ref('votes/u1').set({ entryId: 'e1' }));
  await assertFails(voter('u1').ref('votes/u1').set({ entryId: 'e1', votedAt: TS(), extra: 'x' }));
});

test('voters cannot delete their own or others\' votes; only the admin can', async () => {
  await seed({ ...openSession, votes: { u1: { entryId: 'e1', votedAt: 1 }, u2: { entryId: 'e2', votedAt: 2 } } });
  await assertFails(voter('u1').ref('votes/u1').remove());
  await assertFails(voter('u1').ref('votes/u2').remove());
  await assertFails(anon().ref('votes/u2').remove());
  await assertSucceeds(admin().ref().update({ 'votes/u1': null, 'votes/u2': null }));
});

test('votes cannot be bulk-written or wiped at the collection level', async () => {
  await seed({ ...openSession, votes: { u1: { entryId: 'e1', votedAt: 1 } } });
  await assertFails(voter('u2').ref('votes').set({}));
  await assertFails(anon().ref('votes').remove());
});
