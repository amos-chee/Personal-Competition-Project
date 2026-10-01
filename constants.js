// ============================================================
//  CROWD VOTING — CONFIGURATION
//  Edit this file to customise the competition.
//  Reload vote.html / vote-admin.html after saving changes.
//
//  FIREBASE SETUP (one-time):
//  1. Go to console.firebase.google.com → create a project
//  2. Build → Realtime Database → Create database (test mode)
//  3. Project Settings → Your apps → Add app (Web) → copy config below
//  4. Build → Authentication → Sign-in method → enable Email/Password,
//     then Users → Add user (this is the admin account)
//  5. Copy that user's UID, then Realtime Database → Rules → paste
//     database.rules.json, replacing REPLACE_WITH_ADMIN_UID with it
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
}

};
