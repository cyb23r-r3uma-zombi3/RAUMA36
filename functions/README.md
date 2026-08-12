# Sky Edu — Cloud Functions

This folder contains the Firebase Cloud Functions for Sky Edu. They run
**server-side** so the user cannot tamper with grading, leaderboard or XP.

## Functions

| Function   | Type             | Purpose                                                   |
| ---------- | ---------------- | --------------------------------------------------------- |
| `scoreExam`| `httpsCallable`  | Server-side exam grading + validated result write         |

## Deploy

```bash
cd functions
npm install
firebase deploy --only functions
```

## Required Firebase Rules

The deploy must be paired with the updated `database.rules.json` at the
repository root (already updated). Key rule changes:

- `userStats`, `leaderboard`, `leaderboardByExam`, `examResults` are
  **read-only** for users (`.write: false`). Only the Cloud Functions
  service account can write to them.
- All written `examResults` records must have `validated: true`.
- All written `userStats` records must have `validated: true`.

If you forget to update the rules, the Cloud Function will fail with
`PERMISSION_DENIED`.

## Local testing

```bash
firebase emulators:start --only functions,database
```

The web app will automatically use the emulator when it detects
`firebase.useEmulator(...)`. See `firebase.json` for the emulator ports.

## Rollback

```bash
# Disable the function without deleting the code
firebase functions:delete scoreExam --region us-central1
```

The existing client-side fallback (now in `submitAndGoResult`) will keep
the app usable while you redeploy a fixed function.