# CLAUDE.md — 1st Grade Vocab Trainer (G1)

Internal docs for Claude Code sessions and future maintainers. For users see [README.md](README.md). For workspace-wide rules see [`../DOMIGO.md`](../DOMIGO.md).

## Architecture

Single-file SPA: HTML, CSS, JS, and vocab data are all bundled into `index.html`. No build pipeline, no module system. Edit the file → commit → push → GitHub Pages serves it on the next deploy (~30s after push).

- Total: ~16,829 lines
- `const vocabData = {` starts at line **3813**

## File layout

```
1st-grade-vocab-trainer/
├── index.html         ← entire app (HTML + inline CSS + inline JS + vocabData)
├── avatars/           ← 50 PNG avatars (01.png … 50.png)
├── campaign/          ← story-mode assets (prologue images, character art for Lost Pages)
├── activity/          ← Activity Game sibling app (Draw / Show / Explain)
│   ├── index.html     ← standalone group game; no login, no Firebase, no XP
│   └── data/
│       └── activity-words.js  ← auto-generated; rebuild via TOOLS/activity-audit-g1/
└── README.md, CLAUDE.md, CHANGELOG.md
```

## Modes shipped

**Practice modes** (selected via setup wizard):
- Full — all selected words, mixed exercise types
- Sprint — 10 random words
- Speed Round — 60 seconds, answer fast
- Multiple Choice — 4-option only
- Flashcards — Tinder-style swipe study mode (no scoring)

**Exercise types** (per practice mode):
- Context (easy/hard) — fill-in-the-blank with optional first-letter/length hints
- Definition (easy/hard) — guess word from English definition
- Translation — German → English
- Mix — random across all types

**Vocab arcade** (curated per-unit, A1):
- Memory Match — 10 form-pair decks
- Word Hunt — category-based odd-one-out
- Spelling Bee — type the word, with backspace + word-boundary wrap

**Grammar arcade** (Phase 7, G1-only at the time of writing):
- Grammar Memory Match — form-pair grammar decks
- Grammar Blitz — 60s speed round over MC + gap-fill items
- Error Hunt — 8 A1 paragraphs, click-to-fix errors
- Group Sort, Matching Pairs, Anagram — Wordwall-inspired

**Story campaign:**
- *The Lost Pages / Die verlorenen Seiten* — chat-sim narrative levels with characters Penny and Rex (campaign-map-screen → chat-sim renderer)

**Live multiplayer:**
- Battle Arena — live duels vs classmates
- Class Quiz — Kahoot-style teacher-orchestrated round

**Activity Game (sibling app at `activity/`):** teacher-orchestrated group game — Draw / Show / Explain (multi-select), 30/60/90 s rounds, 3/5/8/∞ rounds-per-group, multi-select 15-unit picker, group scoring with tie-break, optional time bonus. No login. Words come from `activity/data/activity-words.js` (single primary category per word, 759 entries categorized through an A1 lens). Regenerate via `TOOLS/activity-audit-g1/build-activity-words.js` after editing `teacher-overrides.csv`.

## Firebase

- Project: `veho-vocab`
- Realtime DB: `https://veho-vocab-default-rtdb.europe-west1.firebasedatabase.app`
- Firestore path: `classes/<CLASS_ID>/students/<slug>/`
- `let CLASS_ID = null;` at module top — set per class during the login flow.
- Firebase config is hardcoded in `index.html`. That's the public client SDK config (apiKey, projectId, etc.) — not a secret. Firestore security rules govern access.

After firebase-tools is installed locally and `firebase login` is run:
```
firebase firestore:get classes/<CLASS_ID>/students --project veho-vocab
firebase database:get / --project veho-vocab        # Realtime DB (battles, lobbies)
```

## Deploy

Push to `main` → GitHub Pages publishes from repo root at https://veho-domi.github.io/1st-grade-vocab-trainer/. No CI, no build step. ~30 seconds from push to live.

## Conventions (the things that have bitten us)

- **Definitions must not leak the headword.** Never use content words from `w` in the `d` field. Function words (a/the/to/in/etc.) are fine. After any vocab change, run an overlap check.
- **Context sentences must be original.** Never copy the textbook example — write a fresh sentence with `_____` for the blank.
- **German `g` field is verbatim from textbook.** Never paraphrase or "improve". MORE! 1 is the source of truth.
- **`cf` field only when needed.** Use `cf` only if the sentence form differs from the headword. Adding it unnecessarily breaks matching.
- **Vary verb forms.** Don't put every verb in infinitive — practice past tense, 3rd person, -ing forms too.
- **Single-file edits at scale.** For mass changes (>10 vocab entries), don't loop the Edit tool. Split file into 3 parts (before vocabData / vocabData block / after), edit the chunk, concatenate.
- **Always `git pull` before editing.** Other sessions may have pushed; the iCloud copy can drift silently.

## Vocabulary source

`Domi Gym 2025:26/1ABC (2025:26)/MORE 1/` — the official MORE! 1 vocab list. Extract verbatim, do not hallucinate.

## Known issues / TODOs

- Phase 7 (G1 grammar games) only landed 2026-04-14 — additional content can still be curated per-unit.
- "Lost Pages" campaign is the most recent feature (2026-04-20); narrative depth is currently limited to the prologue.
- Long-term: this trainer will be folded into a unified DomiGo app (G1–G4 single login → grade → class → profile). Avoid changes that would make merging harder.
