# Fan Favorite Voting

A small real-time crowd-voting web app. Visitors pick their favorite entry, an admin opens and closes voting, and a live results page updates as votes arrive. It is plain HTML, CSS and JavaScript with Firebase Realtime Database as the backend, so there is no build step.

## Pages

| Page | Purpose |
|---|---|
| `vote.html` | Voter page. One vote per visitor, and only while voting is open. |
| `vote-admin.html` | Dashboard behind Firebase Authentication (email and password) to manage entries, open or close voting, and schedule a voting cycle. |
| `vote-results.html` | Live results display. |
| `index.html` / `404.html` | Landing and not-found pages. |

## Run it

**Quick start (demo):** clone the repo and open `vote.html` or `vote-results.html` in a browser. `constants.js` already points at the demo Firebase project. Voting and results work for anyone. The admin dashboard needs the admin account's password, which is not published, so use your own Firebase project (below) to try it.

**Use your own Firebase project:**
1. Create a Firebase project with a **Realtime Database**, and add a **Web app** to get its config.
2. Edit `constants.js` (`constants.example.js` is a blank template): set `FIREBASE_CONFIG`, `competitionName` and the seed `entries`.
3. In **Authentication → Sign-in method**, enable **Email/Password** (for the admin) and **Anonymous** (for voters). Then in **Users**, add the admin user and copy its **User UID**.
4. Paste `database.rules.json` into **Realtime Database → Rules**, replacing every `REPLACE_WITH_ADMIN_UID` with that UID.
5. Open `vote-admin.html` in a browser, sign in, and open voting. Voters use `vote.html`, and `vote-results.html` shows the live tally.

## Deploy (Firebase Hosting)

Set your project ID in `.firebaserc`, then run:

```
firebase deploy --only hosting
```

See `HOSTING.txt` for the full deploy and undeploy guide.

## Testing

The app itself needs no tooling. The tests use Node 20+ (built-in test runner) and `npm install` for the dev dependencies.

| Command | What it covers | Needs |
|---|---|---|
| `npm run test:unit` | `lib.js` helpers: vote counting and ranking, CSV import, HTML escaping, date and duration formatting, results cycle, auto open/close decision | Node only |
| `npm run test:rules` | `database.rules.json` against the Firebase Realtime Database emulator: admin-only writes, one vote per uid, no forging, closed-session blocking, validation, scheduled open/close. It substitutes a test UID for `REPLACE_WITH_ADMIN_UID` and never touches live data. | Java 11+ and `firebase-tools` |
| `LIVE_TESTS=1 npm run test:live` | Read-only `GET` smoke tests of the deployed site and the live database REST API. They write nothing. | Network |
| `npm run test:all` | Unit and rules tests | as above |

On PowerShell, set the live flag with `$env:LIVE_TESTS=1; npm run test:live`.

## How it works

- Each browser signs in anonymously with Firebase Authentication and gets its own persistent user ID. The database rules allow writing `votes/<uid>` only for that same uid, only if it does not exist yet, if the entry exists and if the session status is `open`. Timestamps use the server's `now`.
- Session state (`status`, cycle duration, scheduled open and close times) lives under `session/`, and entries under `entries/`.

## Security notes

- The admin signs in with Firebase Authentication. `database.rules.json` only lets the account whose UID is in the rules write to `entries/`, delete votes, or change `session/`. The dashboard itself shows to any signed-in user, but the rules block everyone else's writes. The file ships with a `REPLACE_WITH_ADMIN_UID` placeholder, and running it unchanged locks out all admin writes.
- Anyone can still read data and cast one vote per device while voting is open. The anonymous ID is per browser, so a determined visitor can vote again from another browser or a private window.
- The one exception to admin-only writes is the scheduled open and close. There is no server to run it, so any open page may flip `session/status`, but only after the admin's scheduled time has passed. The rules enforce that condition.
- The Firebase web `apiKey` in `constants.js` is a public identifier and not a secret. The rules and the admin password protect the data.

## Files

```
vote*.html / vote*-script.js / vote*-styles.css   the three pages
lib.js                                            pure helpers shared by the pages (unit tested)
test/unit, test/rules, test/live                  unit, emulator rules and live smoke tests
constants.js                                      demo config (Firebase project, admin email)
constants.example.js                              blank config template
database.rules.json                               Realtime Database rules
firebase.json, .firebaserc                        Firebase Hosting config
```
