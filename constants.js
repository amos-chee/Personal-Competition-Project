// ============================================================
//  CROWD VOTING — CONFIGURATION
//  Edit this file to customise the competition.
//  Reload vote.html / vote-admin.html after saving changes.
//
//  FIREBASE SETUP (one-time):
//  1. Go to console.firebase.google.com → create a project
//  2. Build → Realtime Database → Create database (test mode)
//  3. Project Settings → Your apps → Add app (Web) → copy config below
//  4. In Realtime Database → Rules, paste:
//
//  {
//    "rules": {
//      "session": { ".read": true, ".write": true },
//      "entries":  { ".read": true, ".write": true },
//      "votes": {
//        ".read": true,
//        "$fingerprint": {
//          ".write": "!data.exists() && root.child('session/status').val() === 'open'"
//        }
//      }
//    }
//  }
// ============================================================

const CONFIG = {

  // Name shown in the header of both pages
  competitionName: "Mecha Master 2026 Most Favorite",

  // Seed entries — written to Firebase the first time vote-admin.html is opened.
  // After the first launch, manage entries from the admin dashboard.
  entries: [
    "Iron Titan",
    "Steel Phantom",
    "Nova Striker",
    "Crimson Gear",
    "Apex Colossus",
    "Thunder Rig"
  ],

  // ── Firebase Realtime Database ───────────────────────────
  // Paste your project's web config object here.
  FIREBASE_CONFIG: {
  apiKey: "AIzaSyCnQIPGXB3gnaJv-LegJizetEnpxQ_KiOo",
  authDomain: "mecha-master-2026-voting.firebaseapp.com",
  databaseURL: "https://mecha-master-2026-voting-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mecha-master-2026-voting",
  storageBucket: "mecha-master-2026-voting.firebasestorage.app",
  messagingSenderId: "1008694811441",
  appId: "1:1008694811441:web:2104f54848e316946cee10"
},

  // PIN to access the admin dashboard (vote-admin.html)
  VOTING_ADMIN_PIN: "1234"

};
