# CHANGELOG — 1st Grade Vocab Trainer

Reverse-chronological release history. Going forward, update on each substantive change. Earlier history (pre-2026-04-11) lives only in `git log`.

## 2026-05-01 — Phase 0 polish
- Fix stray "60" timer always visible at top of Komplett / Sprint / MC / Flashcards (`speed-timer-wrap` is now properly hidden when not in Speed Round).
- Fix XP-for-zero-correct exploit: ending a session with no correct answers now awards 0 XP instead of streak-bonus + perfect-round bonus.
- Results page: show a friendly placeholder when a session ended without any attempted words, instead of a blank `RESULTS` box.
- Story Mode prologue: scene images now load (references corrected from `lp-prologue-0X.jpg` → `prologue-0X.jpg` to match the actual files on disk).
- Word Hunt failure UX softened: 2 mistakes allowed per round before the round ends (was 1). After the first wrong tap, a "Wrong — 1 try left!" / "Falsch — du hast noch 1 Versuch!" message shows.
- (Note: Memory Match — vocab and grammar — was already softly forgiving on wrong matches; no change needed there.)

## 2026-04-20 — The Lost Pages
- New thematic story campaign: *The Lost Pages / Die verlorenen Seiten* (G1 redesign with prologue scenes and characters Penny, Rex)

## 2026-04-19 — Bugfix sweep
- Fix Spelling Bee auto-click XP exploit
- Fix results-page navigation

## 2026-04-14 — Phase 7: Grammar arcade & vocab games
- New: Grammar Memory Match (10 curated form-pair decks)
- New: Grammar Blitz (60s speed round over MC + gap-fill items)
- New: Error Hunt (8 A1 paragraphs, click-to-fix)
- New: Memory Match, Spelling Bee, Word Hunt vocab games (curated VOCAB_TASKS per unit)
- Unified context/definition exercise types with progressive 2-tier Hint button (XP/combo cost)
- Spelling Bee: word-boundary wrap, backspace, Continue button, full DE/EN localization
- Word Hunt category matching: explicit keyword token match
- Vocab hint tier 2 rendering fix (gap-pattern class)

## 2026-04-13 — Grammar arcade additions
- Group Sort, Matching Pairs, Anagram mini-games added to grammar arcade
- Chat-sim campaign renderer
- Campaign card uses dynamic level count (was hardcoded /15)
- XP burst + combo tier-up animations across vocab modes
- Fix: gap-fill items without distractors fall back to typed input
- Fix: `saveSessionResults` flashcard-status preservation scoping bug

## 2026-04-12 — Flashcards, level badge, mode switch
- Tinder-style flashcard layout (multiple iterations to land on scoped CSS)
- Flashcard tracking + dictionary integration
- Flashcard status persistence across page refreshes (multiple critical fixes)
- Mode switch button restored on home screen and added to profile card
- Level badge: bigger + shadow, fix stuck popup
- Cleaner home-screen layout (review + mode switch repositioned)

## 2026-04-11 — Audit & cleanup
- Vocab audit fixes (2 CRITICAL + 27 HIGH issues)
- Grammar audit: removed 568 dupes, fixed 171 misclassified items, fixed 19 MC hint leaks, standardized prompts (1358 → 790 items)
- Added 3 Wordwall-inspired task types: Group Sort, Matching Pairs, Anagram (68 items across 34 structures)
- Fix Group Sort pedagogy + remove 10-item cap
- Fix 91 misclassified gap-fill items (showed only 1 button)

## Earlier
Phase 5 (prestige system, 13 skill badges) and Phase 6 (visual progression map / SVG journey) predate this changelog. See `git log` for raw history.
