# Fan Favorite Voting

A small real-time crowd-voting web app. Visitors pick their favorite entry, an admin opens and closes voting, and a live results page updates as votes arrive. It is plain HTML, CSS and JavaScript with Firebase Realtime Database as the backend, so there is no build step.

## Pages

| Page | Purpose |
|---|---|
| `vote.html` | Voter page. One vote per visitor, and only while voting is open. |
| `vote-admin.html` | PIN-protected dashboard to manage entries, open or close voting, and schedule a voting cycle. |
| `vote-results.html` | Live results display. |
| `index.html` / `404.html` | Landing and not-found pages. |

## Run it

1. Create a Firebase project with a **Realtime Database**, and add a **Web app** to get its config.
2. Copy the template and fill in your values:
   ```
   cp constants.example.js constants.js
   ```
   Set `FIREBASE_CONFIG`, `VOTING_ADMIN_PIN`, `competitionName` and the seed `entries`. `constants.js` is git-ignored, so your config is not committed.
3. Paste `database.rules.json` into **Realtime Database → Rules**.
4. Open `vote-admin.html` in a browser, enter the PIN, and open voting. Voters use `vote.html`, and `vote-results.html` shows the live tally.

## Deploy (Firebase Hosting)

Set your project ID in `.firebaserc`, then run:

```
firebase deploy --only hosting
```

See `HOSTING.txt` for the full deploy and undeploy guide.

## How it works

- Each voter gets a generated visitor ID. The database rules allow writing `votes/<visitorId>` only if it does not exist yet, if the entry exists and if the session status is `open`. Timestamps use the server's `now`.
- Session state (`status`, cycle duration, scheduled open and close times) lives under `session/`, and entries under `entries/`.

## Security notes

This is a demo-grade project with a known limitation. The admin PIN is checked in client-side JavaScript, and the rules allow public writes to `session/` and `entries/`. Anyone who knows the database URL could change those paths. A production version should add Firebase Authentication for the admin and restrict those writes with `auth != null` (or a custom claim) in `database.rules.json`.

## Files

```
vote*.html / vote*-script.js / vote*-styles.css   the three pages
constants.example.js                              config template (copy to constants.js)
database.rules.json                               Realtime Database rules
firebase.json, .firebaserc                        Firebase Hosting config
```
