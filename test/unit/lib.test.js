// Unit tests for the pure helpers in lib.js. Run with: npm run test:unit
const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../../lib.js');

test('escHtml escapes markup characters', () => {
  assert.equal(lib.escHtml('<b>"A" & B</b>'), '&lt;b&gt;&quot;A&quot; &amp; B&lt;/b&gt;');
  assert.equal(lib.escHtml(42), '42');
  assert.equal(lib.escHtml('&lt;'), '&amp;lt;', 'already-escaped text is escaped again');
});

test('escAttr escapes double quotes only', () => {
  assert.equal(lib.escAttr('say "hi"'), 'say &quot;hi&quot;');
  assert.equal(lib.escAttr('<a&b>'), '<a&b>');
});

test('countVotes tallies votes per entry', () => {
  const votes = {
    v1: { entryId: 'a', votedAt: 1 },
    v2: { entryId: 'b', votedAt: 2 },
    v3: { entryId: 'a', votedAt: 3 }
  };
  assert.deepEqual(lib.countVotes(votes), { a: 2, b: 1 });
});

test('countVotes tolerates empty, null and malformed votes', () => {
  assert.deepEqual(lib.countVotes({}), {});
  assert.deepEqual(lib.countVotes(null), {});
  assert.deepEqual(lib.countVotes({ v1: null, v2: {}, v3: { entryId: '' }, v4: { entryId: 'a' } }), { a: 1 });
});

test('computeResults ranks entries, including those with zero votes', () => {
  const entries = { a: 'Alpha', b: 'Beta', c: 'Gamma' };
  const votes = {
    v1: { entryId: 'b' }, v2: { entryId: 'b' }, v3: { entryId: 'b' }, v4: { entryId: 'a' }
  };
  const { rows, total } = lib.computeResults(votes, entries);
  assert.equal(total, 4);
  assert.deepEqual(rows.map(r => [r.name, r.votes, r.pct]), [
    ['Beta', 3, 75], ['Alpha', 1, 25], ['Gamma', 0, 0]
  ]);
});

test('computeResults with no votes gives 0% and total 0', () => {
  const { rows, total } = lib.computeResults({}, { a: 'Alpha' });
  assert.equal(total, 0);
  assert.deepEqual(rows, [{ id: 'a', name: 'Alpha', votes: 0, pct: 0 }]);
});

test('computeResults handles no entries and ignores votes for deleted entries', () => {
  assert.deepEqual(lib.computeResults({ v1: { entryId: 'a' } }, {}), { rows: [], total: 1 });
  assert.deepEqual(lib.computeResults({}, null), { rows: [], total: 0 });
});

test('computeResults rounds percentages', () => {
  const entries = { a: 'A', b: 'B', c: 'C' };
  const votes = { v1: { entryId: 'a' }, v2: { entryId: 'b' }, v3: { entryId: 'c' } };
  const { rows } = lib.computeResults(votes, entries);
  assert.deepEqual(rows.map(r => r.pct), [33, 33, 33]);
});

test('rankRows works from a plain counts map (results page)', () => {
  const { rows, total } = lib.rankRows({ a: 1, b: 3 }, { a: 'A', b: 'B' });
  assert.equal(total, 4);
  assert.deepEqual(rows.map(r => r.id), ['b', 'a']);
});

test('parseCSVFirstColumn reads the first column of each row', () => {
  assert.deepEqual(lib.parseCSVFirstColumn('Alpha,1\nBeta,2\n'), ['Alpha', 'Beta']);
});

test('parseCSVFirstColumn handles quotes, CRLF, blanks and whitespace', () => {
  const csv = '"Iron, Titan",5\r\n\r\n  Nova Striker  ,2\r\n"Say ""hi""",1\r\n   \r\n';
  assert.deepEqual(lib.parseCSVFirstColumn(csv), ['Iron, Titan', 'Nova Striker', 'Say "hi"']);
});

test('parseCSVFirstColumn handles an unterminated quote and empty input', () => {
  assert.deepEqual(lib.parseCSVFirstColumn('"Broken'), ['Broken']);
  assert.deepEqual(lib.parseCSVFirstColumn(''), []);
  assert.deepEqual(lib.parseCSVFirstColumn(',x\n'), [], 'rows with an empty first column are skipped');
});

test('toLocalInputValue formats for datetime-local using the given offset', () => {
  const utc = Date.UTC(2026, 9, 1, 12, 30);              // 2026-10-01 12:30 UTC
  assert.equal(lib.toLocalInputValue(utc, 0), '2026-10-01T12:30');
  assert.equal(lib.toLocalInputValue(utc, -480), '2026-10-01T20:30'); // UTC+8 reports -480
  assert.equal(lib.toLocalInputValue(utc, 300), '2026-10-01T07:30');  // UTC-5
});

test('toLocalInputValue returns empty string for missing values', () => {
  assert.equal(lib.toLocalInputValue(null), '');
  assert.equal(lib.toLocalInputValue(0), '');
  assert.equal(lib.toLocalInputValue(undefined), '');
});

test('toLocalInputValue falls back to the runtime timezone offset', () => {
  const t = Date.UTC(2026, 0, 15, 8, 0);
  const expected = new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  assert.equal(lib.toLocalInputValue(t), expected);
});

test('formatDuration formats seconds as HH:MM:SS', () => {
  assert.equal(lib.formatDuration(0), '00:00:00');
  assert.equal(lib.formatDuration(59), '00:00:59');
  assert.equal(lib.formatDuration(3661), '01:01:01');
  assert.equal(lib.formatDuration(10800), '03:00:00');
  assert.equal(lib.formatDuration(100 * 3600), '100:00:00');
  assert.equal(lib.formatDuration(61.9), '00:01:01');
});

test('getCycleDurationMinutes prefers minutes, then hours, then 3h default', () => {
  assert.equal(lib.getCycleDurationMinutes({ cycleDurationMinutes: 45, cycleDurationHours: 9 }), 45);
  assert.equal(lib.getCycleDurationMinutes({ cycleDurationHours: 2 }), 120);
  assert.equal(lib.getCycleDurationMinutes({}), 180);
  assert.equal(lib.getCycleDurationMinutes({ cycleDurationMinutes: 0 }), 0, '0 is a value, not "unset"');
});

test('cycleInfo returns cycle number from the cycle start', () => {
  const start = 1_000_000;
  const session = { cycleStartedAt: start, cycleDurationMinutes: 60 };
  assert.deepEqual(lib.cycleInfo(session, start), { cycleNumber: 0, cycleStartedAt: start });
  assert.equal(lib.cycleInfo(session, start + 59 * 60000).cycleNumber, 0);
  assert.equal(lib.cycleInfo(session, start + 60 * 60000).cycleNumber, 1);
  assert.equal(lib.cycleInfo(session, start + 190 * 60000).cycleNumber, 3);
});

test('cycleInfo before any cycle has started', () => {
  assert.deepEqual(lib.cycleInfo({}, Date.now()), { cycleNumber: 0, cycleStartedAt: null });
});

test('scheduleUpdate opens a closed session once the open time has passed', () => {
  const session = { scheduledOpenAt: 1000 };
  assert.equal(lib.scheduleUpdate('closed', session, 999, 'TS'), null, 'not yet');
  assert.deepEqual(lib.scheduleUpdate('closed', session, 1000, 'TS'),
    { status: 'open', openedAt: 'TS', scheduledOpenAt: null });
});

test('scheduleUpdate closes an open session once the close time has passed', () => {
  const session = { scheduledCloseAt: 2000 };
  assert.equal(lib.scheduleUpdate('open', session, 1999, 'TS'), null, 'not yet');
  assert.deepEqual(lib.scheduleUpdate('open', session, 5000, 'TS'),
    { status: 'closed', closedAt: 'TS', scheduledCloseAt: null });
});

test('scheduleUpdate ignores a schedule that does not apply to the current status', () => {
  assert.equal(lib.scheduleUpdate('open', { scheduledOpenAt: 1 }, 99, 'TS'), null);
  assert.equal(lib.scheduleUpdate('closed', { scheduledCloseAt: 1 }, 99, 'TS'), null);
  assert.equal(lib.scheduleUpdate('closed', {}, 99, 'TS'), null);
});
