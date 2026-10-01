// ============================================================
//  CROWD VOTING — CONFIGURATION TEMPLATE
//  Copy this file to constants.js (git-ignored) and fill in your
//  own values. The pages load constants.js, not this file.
//
//  FIREBASE SETUP (one-time):
//  1. Go to console.firebase.google.com → create a project
//  2. Build → Realtime Database → Create database
//  3. Project Settings → Your apps → Add app (Web) → copy config below
//  4. Realtime Database → Rules → paste the contents of database.rules.json
// ============================================================

const CONFIG = {

  // Name shown in the header of both pages
  competitionName: "My Competition",

  // Seed entries — written to Firebase the first time vote-admin.html is opened.
  // After the first launch, manage entries from the admin dashboard.
  entries: [
    "Entry One",
    "Entry Two",
    "Entry Three"
  ],

  // ── Firebase Realtime Database ───────────────────────────
  FIREBASE_CONFIG: {
    apiKey: "REPLACE_ME",
    authDomain: "REPLACE_ME.firebaseapp.com",
    databaseURL: "https://REPLACE_ME-default-rtdb.firebasedatabase.app",
    projectId: "REPLACE_ME",
    storageBucket: "REPLACE_ME.firebasestorage.app",
    messagingSenderId: "REPLACE_ME",
    appId: "REPLACE_ME"
  },

  // PIN to access the admin dashboard (vote-admin.html)
  VOTING_ADMIN_PIN: "CHANGE_ME"

};
