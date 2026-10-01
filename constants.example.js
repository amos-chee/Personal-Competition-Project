// ============================================================
//  CROWD VOTING — CONFIGURATION TEMPLATE
//  Copy this file to constants.js and fill in your own values.
//  The pages load constants.js, not this file.
//
//  FIREBASE SETUP (one-time):
//  1. Go to console.firebase.google.com → create a project
//  2. Build → Realtime Database → Create database
//  3. Project Settings → Your apps → Add app (Web) → copy config below
//  4. Build → Authentication → Sign-in method → enable Email/Password
//     (admin) and Anonymous (voters), then Users → Add user (this is the admin account)
//  5. Copy that user's UID, then Realtime Database → Rules → paste
//     database.rules.json, replacing REPLACE_WITH_ADMIN_UID with it
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
  }

};
