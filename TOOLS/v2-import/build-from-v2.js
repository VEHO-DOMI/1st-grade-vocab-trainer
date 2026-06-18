#!/usr/bin/env node
/**
 * build-from-v2.js — regenerate this app's grade-1 content from the reviewed
 * domigo-v2 corpus (FULL REPLACE), then splice it into index.html.
 *
 * Replaces three data blocks (vocabData / grammarStructures / grammarItems);
 * PRESERVES campaignLevels, VOCAB_TASKS, GRAMMAR_MM_DECKS (editorial), and
 * carries forward app-only fields (vocab `col`, structure `kf`). Emits a
 * referential-integrity + invariant report and refuses to write on a hard fail.
 *
 * Usage: node TOOLS/v2-import/build-from-v2.js [--write]
 *   (omit --write for a dry run that only prints the report)
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const V2 = "/Users/okivehab/Code/domigo-v2/content/corpus";
const INDEX = path.resolve(__dirname, "../../index.html");
const WRITE = process.argv.includes("--write");

const FORMAT_CODE = {
  "gap-fill": "gf", "multiple-choice": "mc", "error-correction": "ec",
  "transformation": "tf", "sentence-building": "sb", "matching": "mt",
  "context-picker": "cp", "free-form": "ff", "question-formation": "qf",
  "group-sort": "gs", "matching-pairs": "mp", "anagram": "an", "translation": "tr",
};

const FUNCTION_WORDS = new Set("the a an to of in on at for with from up down out off into over under and or but no not you your his her its our their my me him them it this that these those one two more most some any all".split(" "));
// GRAMMAR_MM_DECKS keys whose structure was renamed in v2 (old app sid -> new v2 sid)
const MM_REMAP = {
  "m1-u5-possessive-adjectives": "m1-u5-possessives",
  "m1-u6-present-simple-affirmative": "m1-u6-present-simple",
  "m1-u7-articles": "m1-u7-articles-a-an",
  "m1-u14-irregular-verbs": "m1-u14-past-simple-irregular",
};

const problems = [];
const warns = [];
const fail = (m) => problems.push(m);
const warn = (m) => warns.push(m);

// ---- helpers --------------------------------------------------------------
function readJson(f) { return JSON.parse(fs.readFileSync(f, "utf8")); }
function unitSlug(u) { return "g1-u" + String(u).padStart(2, "0"); }
function norm(s) { return String(s).toLowerCase().replace(/[()]/g, "").replace(/\s+/g, " ").trim(); }
function blanksToApp(t) { return t.includes("|") ? t.split("|").map((s) => s.trim()).join(" ... ") : t; }
// deterministic shuffle seeded by a string (mulberry32 over a tiny hash)
function seededShuffle(arr, seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---- sid map (v2 structureId -> app sid) ----------------------------------
const structures = readJson(path.join(V2, "structures/g1/structures.json")).structures;
const sidMap = {}; // g1uNN.s.key -> m1-uN-key
for (const s of structures) sidMap[s.id] = `m1-u${s.unit}-${s.key}`;

// ---- overlays -------------------------------------------------------------
const itemFixes = readJson(path.join(V2, "../overlays/item-fixes.json"));
function applyFix(slug, items) {
  const f = itemFixes[slug]; if (!f) return items;
  const drop = new Set(f.drop || []); const patch = f.patch || {};
  return items.filter((it) => !drop.has(it.id)).map((it) => (patch[it.id] ? { ...it, ...patch[it.id] } : it));
}

// ---- read old index.html (for carry-forward + validation) -----------------
const html = fs.readFileSync(INDEX, "utf8");
function evalBlock(re, label) {
  const m = html.match(re); if (!m) throw new Error("could not locate " + label);
  return new Function("return (" + m[1] + ")")();
}
const oldVocab = evalBlock(/const vocabData = (\{[\s\S]*?\n\});/, "vocabData");
const oldStructures = JSON.parse(html.split("\n").find((l) => l.startsWith("grammarStructures = ")).replace(/^grammarStructures = /, "").replace(/;\s*$/, ""));
const vocabTasksText = html.match(/const VOCAB_TASKS = \{[\s\S]*?\n\};/)[0];
const mmDecksText = html.match(/const GRAMMAR_MM_DECKS = \{[\s\S]*?\n\};/)[0];

// col carry-forward map: normalized w -> col
const colByW = new Map();
for (const arr of Object.values(oldVocab)) for (const e of arr) if (e.col) colByW.set(norm(e.w), e.col);
// kf carry-forward map: structure key -> kf
const kfByKey = new Map();
for (const s of oldStructures) { const key = s.id.replace(/^m1-u\d+-/, ""); if (s.kf) kfByKey.set(key, s.kf); }
// activity-game cat carry-forward (sibling app at activity/): normalized w -> draw/show/explain
const ACTIVITY_FILE = path.resolve(__dirname, "../../activity/data/activity-words.js");
global.window = global.window || {};
require(ACTIVITY_FILE);
const catByW = new Map((global.window.ACTIVITY_WORDS || []).map((a) => [norm(a.w), a.cat]));
const activityTitles = global.window.ACTIVITY_UNIT_TITLES || {};

// ---- VOCAB conversion -----------------------------------------------------
function convVocab(it) {
  const fullS = it.sAnswers.filter((a) => a.tier === "full").map((a) => a.text);
  const allAccept = [...new Set([...it.sAnswers, ...it.dAnswers].map((a) => a.text))];
  // cf: a full sentence-answer that differs from the headword (the app's `to give`->`give` pattern)
  let cf;
  if (!fullS.includes(it.w)) cf = fullS[0];
  const skip = new Set([norm(it.w), cf ? norm(cf) : null].filter(Boolean));
  const a = allAccept.filter((t) => !skip.has(norm(t)));
  const out = {
    w: it.w, g: it.g, d: it.d,
    s: it.s.replace(/___/g, "_____"), // app blank convention
    a, mc: it.mc.slice(0, 3),
  };
  if (cf) out.cf = cf;
  if (it.gloss && it.gloss.length) out.gloss = it.gloss.map((g) => ({ word: g.word, de: g.de }));
  if (it.hintDe) out.hintDe = it.hintDe;
  const col = colByW.get(norm(it.w)); if (col) out.col = col;
  // invariants
  if (out.mc.length !== 3) fail(`vocab ${it.id}: mc.length=${out.mc.length}`);
  if (!/_{3,}/.test(out.s)) fail(`vocab ${it.id}: carrier has no blank`);
  // definition-leak: no *content* word of w appears in d (function words are fine)
  const wWords = norm(it.w).split(" ").filter((x) => x.length > 2 && !FUNCTION_WORDS.has(x.replace(/[.,!?]/g, "")));
  const dn = " " + norm(it.d) + " ";
  for (const ww of wWords) if (dn.includes(" " + ww + " ")) warn(`vocab ${it.id}: possible def-leak of "${ww}"`);
  return out;
}

const vocabData = {};
let vocabCount = 0;
for (let u = 1; u <= 15; u++) {
  const items = readJson(path.join(V2, "units", unitSlug(u), "vocab.json")).items;
  vocabData["Unit " + u] = items.map(convVocab);
  vocabCount += items.length;
}

// ---- GRAMMAR STRUCTURES conversion ---------------------------------------
const grammarStructures = structures.map((s) => {
  const key = s.key;
  const out = {
    id: sidMap[s.id], u: s.unit, n: s.name, nd: s.nameDe, cat: s.category, desc: s.description,
    rules: (s.rules || []).map((r) => ({ id: r.id, t: r.en, td: r.de, ex: (r.examples || []).map((e) => ({ en: e.en, de: e.de })) })),
    kf: kfByKey.get(key) || { affirmative: [], negative: [], questions: [] },
    errs: (s.commonErrors || []).map((e) => ({ d: e.description, w: e.wrong, c: e.correct })),
  };
  return out;
});
const structureIds = new Set(grammarStructures.map((s) => s.id));

// ---- GRAMMAR ITEMS conversion ---------------------------------------------
const seq = {}; // `${sid}-${code}` -> running counter
function nextId(sid, fmt) {
  const code = FORMAT_CODE[fmt] || "xx";
  const k = `${sid}-${code}`; seq[k] = (seq[k] || 0) + 1;
  return `${sid}-${code}-${String(seq[k]).padStart(3, "0")}`;
}
function convGrammar(it) {
  const sid = sidMap[it.structureId];
  if (!sid) fail(`grammar ${it.id}: unmapped structureId ${it.structureId}`);
  const base = {
    id: nextId(sid, it.format), sid, u: structures.find((s) => s.id === it.structureId)?.unit, t: it.format,
    p: it.prompt.text, c: "", a: [], ds: (it.distractors || []).map(blanksToApp),
    h: it.hintEn || "", hd: it.hintDe || "", e: it.explainEn || "", ed: it.explainDe || "",
  };
  if (it.strict) base.strict = true;
  if (it.gloss && it.gloss.length) base.gloss = it.gloss.map((g) => ({ word: g.word, de: g.de }));

  const fulls = it.answers.filter((a) => a.tier === "full").map((a) => a.text);
  const parts = it.answers.filter((a) => a.tier !== "full").map((a) => a.text);

  if (it.format === "matching-pairs") {
    base.c = JSON.stringify(it.pairs.map((p) => [p.left, p.right])); base.a = []; base.ds = [];
  } else if (it.format === "group-sort") {
    const obj = {}; for (const g of it.groups) obj[g.label] = g.members.map((m) => `${m}|${m}`);
    base.c = JSON.stringify(obj); base.a = []; base.ds = [];
  } else if (it.format === "matching") {
    // synthesize "1) left … — a) right(shuffled) …" + a {num: letter} map
    const letters = "abcdefghijkl".split("");
    const order = seededShuffle(it.pairs.map((_, i) => i), it.id); // order[k] = original index shown at letter k
    const letterOf = {}; order.forEach((orig, k) => (letterOf[orig] = letters[k]));
    const cmap = {}; it.pairs.forEach((_, i) => (cmap[String(i + 1)] = letterOf[i]));
    const leftsTxt = it.pairs.map((p, i) => `${i + 1}) ${p.left}`).join(" ");
    const rightsTxt = order.map((orig, k) => `${letters[k]}) ${it.pairs[orig].right}`).join(" ");
    base.p = `${it.prompt.text} ${leftsTxt} — ${rightsTxt}`;
    base.c = JSON.stringify(cmap); base.a = [JSON.stringify(cmap)]; base.ds = [];
  } else {
    base.c = blanksToApp(fulls[0] || "");
    base.a = [...fulls.slice(1), ...parts].map(blanksToApp);
  }
  // invariant: structured c must parse
  if (["matching", "matching-pairs", "group-sort"].includes(it.format)) {
    try { JSON.parse(base.c); } catch { fail(`grammar ${base.id}: c not JSON-parseable`); }
  } else if (!base.c) {
    fail(`grammar ${base.id} (${it.format}): empty answer`);
  }
  return base;
}

const grammarItems = [];
let grammarCount = 0;
const perUnit = {};
for (let u = 1; u <= 15; u++) {
  const items = applyFix(unitSlug(u), readJson(path.join(V2, "units", unitSlug(u), "grammar.json")).items);
  perUnit[u] = items.length; grammarCount += items.length;
  for (const it of items) grammarItems.push(convGrammar(it));
  if (items.length > 120) warn(`unit ${u}: ${items.length} grammar items (deep pool)`);
}
for (const gi of grammarItems) if (!structureIds.has(gi.sid)) fail(`grammar ${gi.id}: sid ${gi.sid} not in structures`);

// ---- derived-data referential integrity (report only) ---------------------
const newVocabW = new Set(Object.values(vocabData).flat().map((e) => e.w));
const newVocabNorm = new Set([...newVocabW].map(norm));
// VOCAB_TASKS is self-contained (embeds its own EN/DE pairs + word lists; the
// consumer copies tasks without looking words up in vocabData) → preserve as-is.
// GRAMMAR_MM_DECKS is self-contained too but keyed by sid; remap the renamed sids.
const mmSids = [...new Set([...mmDecksText.matchAll(/"(m1-u[^"]+)"\s*:/g)].map((m) => m[1]))];
const mmAfterRemap = mmSids.map((s) => MM_REMAP[s] || s);
const mmDangling = mmAfterRemap.filter((s) => !structureIds.has(s));
for (const [from, to] of Object.entries(MM_REMAP)) if (!structureIds.has(to)) fail(`MM_REMAP target ${to} not in structures`);

// ---- report ---------------------------------------------------------------
console.log("=== build-from-v2 report ===");
console.log(`vocab:      ${vocabCount} entries across ${Object.keys(vocabData).length} units (${newVocabW.size} unique w)`);
console.log(`structures: ${grammarStructures.length}`);
console.log(`grammar:    ${grammarCount} items  | per-unit: ${Object.values(perUnit).join("/")}`);
console.log(`carry-fwd:  col=${[...colByW.keys()].filter((k) => newVocabNorm.has(k)).length} matched, kf=${grammarStructures.filter((s) => s.kf.affirmative.length || s.kf.negative.length || s.kf.questions.length).length} structures`);
console.log(`VOCAB_TASKS: self-contained, preserved untouched`);
console.log(`GRAMMAR_MM_DECKS: ${Object.keys(MM_REMAP).length} sid keys remapped; dangling after remap: ${mmDangling.length}${mmDangling.length ? " (" + mmDangling.join(", ") + ")" : ""}`);
console.log(`warnings: ${warns.length}`); warns.slice(0, 12).forEach((w) => console.log("  ⚠ " + w));
if (warns.length > 12) console.log(`  … +${warns.length - 12} more`);
if (problems.length) { console.log(`\nHARD FAILURES (${problems.length}):`); problems.slice(0, 30).forEach((p) => console.log("  ✗ " + p)); }

// ---- emit blocks ----------------------------------------------------------
function emitVocabValue(v) { return JSON.stringify(v); }
function emitVocabEntry(e) {
  const order = ["w", "g", "d", "s", "a", "mc", "cf", "gloss", "hintDe", "col"];
  const parts = order.filter((k) => e[k] !== undefined).map((k) => `${k}:${emitVocabValue(e[k])}`);
  return "{" + parts.join(",") + "}";
}
function emitVocabData() {
  const units = Object.keys(vocabData).map((u) => `"${u}": [\n` + vocabData[u].map((e) => emitVocabEntry(e)).join(",\n") + "\n]");
  return "const vocabData = {\n" + units.join(",\n") + "\n};";
}
const newVocabBlock = emitVocabData();
const newStructuresBlock = "grammarStructures = " + JSON.stringify(grammarStructures) + ";";
const newItemsBlock = "grammarItems = " + JSON.stringify(grammarItems) + ";";

if (!WRITE) { console.log("\n(dry run — pass --write to splice into index.html)"); process.exit(problems.length ? 1 : 0); }
if (problems.length) { console.log("\nrefusing to write: fix hard failures first."); process.exit(1); }

let out = html;
out = out.replace(/const vocabData = \{[\s\S]*?\n\};/, () => newVocabBlock);
out = out.replace(/^grammarStructures = \[[\s\S]*?\];$/m, () => newStructuresBlock);
out = out.replace(/^grammarItems = \[[\s\S]*?\];$/m, () => newItemsBlock);
// remap the renamed GRAMMAR_MM_DECKS sid keys (old sids exist nowhere else after the block swaps)
for (const [from, to] of Object.entries(MM_REMAP)) out = out.split(`"${from}"`).join(`"${to}"`);
fs.writeFileSync(INDEX, out);
console.log("\n✓ wrote index.html (vocabData, grammarStructures, grammarItems replaced; MM deck sids remapped)");

// regenerate the sibling activity game's word list from the new vocab (carry cat forward)
const actEntries = [];
let actCarried = 0;
for (let u = 1; u <= 15; u++) {
  for (const e of vocabData["Unit " + u]) {
    const cat = catByW.get(norm(e.w)); if (cat) actCarried++;
    actEntries.push(`  { unit: ${u}, w: ${JSON.stringify(e.w)}, g: ${JSON.stringify(e.g)}, cat: ${JSON.stringify(cat || "explain")} }`);
  }
}
const actOut =
  `// activity-words.js — auto-generated by TOOLS/v2-import/build-from-v2.js\n` +
  `// DO NOT EDIT BY HAND. Regenerated from the v2 corpus; cat carried forward by headword.\n` +
  `// Source: G1 vocabData (${actEntries.length} entries) + carried-forward A1 categorization.\n//\n` +
  `window.ACTIVITY_UNIT_TITLES = ${JSON.stringify(activityTitles)};\n\n` +
  `window.ACTIVITY_WORDS = [\n${actEntries.join(",\n")}\n];\n`;
fs.writeFileSync(ACTIVITY_FILE, actOut);
console.log(`✓ wrote activity-words.js (${actEntries.length} entries, ${actCarried} cats carried, ${actEntries.length - actCarried} defaulted to explain)`);
