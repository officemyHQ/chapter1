# Submission Flow — myHQ Buddy

## Overview

The backend uses **two systems in parallel**:

| System | Purpose |
|--------|---------|
| **Firebase Auth** | Google SSO sign-in, session management |
| **Firebase Firestore** | User progress state (`completed`, `completedAt`) — drives hub unlock logic |
| **Google Apps Script + Sheets** | Permanent answer storage — responses written on chapter submission |

Both writes happen on submission. Firestore is the source of truth for access control; Sheets is the record of answers.

---

## Firebase Project

- **Project ID:** `myhq-td-fcf03`
- **Auth domain:** `myhq-td-fcf03.firebaseapp.com`
- **Config file:** `firebase-config.js` (loaded on every page via `<script>` tag)
- **Access restriction:** Only `@myhq.in` Google accounts can sign in — enforced in `firebase-config.js` via `onAuthStateChanged` which calls `signOut()` on any non-`@myhq.in` email

---

## Firestore Structure

### `users` collection

One document per user, keyed by Firebase `uid`.

```
users/{uid}
  name:         string        — first name from Google account
  email:        string        — full email
  lastLogin:    timestamp     — updated on every sign-in (server timestamp)
  masterAdmin:  boolean       — true only for rohit.bagga@myhq.in
  progress: {
    ch1: {
      completed:   boolean
      completedAt: timestamp
    }
    ch2: {
      completed:   boolean
      completedAt: timestamp
    }
  }
```

### `content` collection

One document per chapter, keyed by chapter ID (`ch1`, `ch2`).

```
content/{chapterId}
  unlockedFor: string[]   — array of emails that can access this chapter
```

Used to gate chapter access. Hub reads `content/ch1` and `content/ch2` to check if the current user's email is in `unlockedFor`.

---

## Google Apps Script

- **Script URL (shared by all chapters):** `https://script.google.com/macros/s/AKfycbwX0Z5vx6DSwdwZwK26pKZL3V3U9XwEyWgPa9Ek_cFEH1_tpULnWNcn7RlgE-wT8M9M/exec`
- **Source file:** `Code.gs`
- **Sheet name pattern:** `[chapterName] Responses` — e.g. `Who We Are Responses`, `Where We Play Responses`

### Google Sheet Structure

#### Response sheets (`[chapterName] Responses`)
Created automatically by `doPost` if they don't exist. One row per submission.

| Column | Value |
|--------|-------|
| A | Timestamp (IST) |
| B | Name |
| C | Email |
| D–M | Q1–Q10 (blank if unused) |

#### `User Progress` sheet
One row per user. Chapter columns are added dynamically on first submission.

| Column | Value |
|--------|-------|
| A | Email |
| B | Name |
| C | Course |
| D | Last Login (IST) |
| E | `[chapterName] Status` (e.g. `Completed`) |
| F | `[chapterName] Submitted At` (IST) |
| … | Additional chapter pairs added automatically |

---

## Login / Auth Flow

1. User lands on `landing.html`
2. Clicks **Sign in with Google** → `signInWithGoogle()` calls `auth.signInWithPopup()`
3. Firebase Auth handles OAuth — only `@myhq.in` accounts proceed
4. `onAuthStateChanged` fires in `firebase-config.js`:
   - Rejects non-`@myhq.in` emails with immediate `signOut()`
   - Upserts user document in Firestore `users` collection (name, email, lastLogin)
   - Sets `masterAdmin: true` for `rohit.bagga@myhq.in`
5. `onAuthStateChanged` in `landing.html` also fires:
   - Checks Firestore `users/{uid}` for existing doc
   - Reads `progress.ch1` and `progress.ch2` completed state
   - Stores `myhq_name`, `myhq_email` in `localStorage`
   - Redirects to `hub.html`

---

## Hub Access Control Flow

`hub.html` on load:

1. `onAuthStateChanged` checks Firebase Auth — if no user, redirects to `landing.html`
2. Reads `users/{uid}` from Firestore for progress state
3. Reads `content/ch1` and `content/ch2` from Firestore for `unlockedFor` arrays
4. Chapter card is shown as unlocked if:
   - User's email is in `content/{chapterId}.unlockedFor`, **OR**
   - `progress.ch1.completed === true` (for ch2 unlock)
5. Sign out → `auth.signOut()` → redirect to `landing.html`

---

## Chapter Submission Flow

On **Submit** in any chapter HTML file:

1. Frontend validates all questions answered + minimum word count met
2. Reads `myhq_name` and `myhq_email` from `localStorage`
3. Sets localStorage flags: `myhq_ch{n}_submitted`, `myhq_ch{n}_complete`
4. **Firestore write** — updates `users/{uid}.progress.ch{n}`:
   ```js
   firebaseDB.collection('users').doc(uid).update({
     'progress.ch2.completed': true,
     'progress.ch2.completedAt': firebase.firestore.FieldValue.serverTimestamp()
   })
   ```
5. **Apps Script write** — `fetch` POST to `SHEET_URL`:
   ```json
   {
     "chapter": "Chapter 2",
     "chapterName": "Who We Are",
     "status": "Completed",
     "name": "User Name",
     "email": "user@myhq.in",
     "timestamp": "2026-06-08T10:00:00.000Z",
     "q1": "Answer 1",
     "q2": "Answer 2",
     "q3": "Answer 3",
     "q4": "Answer 4"
   }
   ```
   Sent with `mode: 'no-cors'` and `Content-Type: text/plain` to avoid CORS preflight.

6. Apps Script `doPost`:
   - Appends row to `[chapterName] Responses` sheet (creates sheet if needed)
   - Finds user row in `User Progress` and writes status + IST timestamp

---

## Adding a Future Chapter

### Frontend (new chapter HTML file)

1. Set `CHAPTER_ID` to the new chapter key (e.g. `'ch3'`)
2. Add `onAuthStateChanged` check at top of script — same pattern as `ch1`/`ch2`
3. On submit, write to Firestore:
   ```js
   firebaseDB.collection('users').doc(uid).update({
     'progress.ch3.completed': true,
     'progress.ch3.completedAt': firebase.firestore.FieldValue.serverTimestamp()
   })
   ```
4. POST to the same `SHEET_URL` with `chapterName` set to the chapter title:
   ```js
   { chapter: 'Chapter 3', chapterName: 'How We Win', status: 'Completed', ... }
   ```
   Apps Script will auto-create `How We Win Responses` and `How We Win Status` columns.

### Firestore (unlock new chapter)

- Add the user's email to `content/ch3.unlockedFor` array via the admin panel or Firebase console
- No code changes needed in `Code.gs`

### Hub

- Add a new chapter card in `hub.html` that reads `content/ch3` and `progress.ch3.completed`

---

## localStorage Keys

| Key | Set when | Value |
|-----|----------|-------|
| `myhq_name` | Login | User's first name |
| `myhq_email` | Login | User's email |
| `myhq_ch1_answers` | Draft save + submit | JSON object of q1–q5 answers |
| `myhq_ch1_submitted` | Submit | `'true'` |
| `myhq_ch1_complete` | Submit | `'true'` |
| `myhq_ch2_answers` | Draft save + submit | JSON object of q1–q4 answers |
| `myhq_ch2_submitted` | Submit | `'true'` |
| `myhq_ch2_complete` | Submit | `'true'` |

---

## Sign Out

`auth.signOut()` → clears Firebase Auth session → `onAuthStateChanged` fires with `null` → redirect to `landing.html`. No localStorage is manually cleared on sign out — it persists across sessions for draft recovery.

---

## Apps Script Actions Reference (`doGet`)

| `?action=` | Purpose |
|------------|---------|
| `loginWithProgress` | Legacy — was used before Firebase Auth. Still present in `Code.gs` but no longer called by any page. |
| `getProgress` | Legacy — reads responses by email. No longer called. |
| `admin` | Returns all users + ch1/ch2 completion status. Used by `admin.html` with key `myHQBuddyadmin`. |
| `debug` | Returns list of sheet names. Dev utility only. |
