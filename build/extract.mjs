#!/usr/bin/env node
// Regenerates skills/transitions-dev/ from the live transitions.dev index.html.
//
// What this does:
//   1. Reads the source HTML (path via SOURCE_HTML env var, defaulting to a
//      sibling Essencial/ checkout).
//   2. Pulls PROTO_TEMPLATES out of the inline <script> by balanced-brace
//      matching, then evaluates it in a Node vm sandbox. The object only
//      uses string concatenation and array literals, so vm-eval is safe.
//   3. Pulls every --pX-* declaration out of the :root { … } block to use
//      as the "default value" for each tunable variable.
//   4. Renders SKILL.md, _root.css, and the per-transition reference docs
//      using the templates in build/templates/.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const skillDir = path.join(repoRoot, "skills", "transitions-dev");
const templateDir = path.join(here, "templates");

// The skill source-of-truth is index.html in this same repo (the
// transitions.dev showcase site). Override with SOURCE_HTML if you
// want to build against a checkout in a different location.
const sourceHtml = process.env.SOURCE_HTML
  ? path.resolve(process.env.SOURCE_HTML)
  : path.resolve(repoRoot, "index.html");

if (!fs.existsSync(sourceHtml)) {
  console.error(`extract.mjs: source HTML not found at ${sourceHtml}`);
  console.error("Set SOURCE_HTML=/path/to/transitions.dev/index.html");
  process.exit(1);
}

const html = fs.readFileSync(sourceHtml, "utf8");

// ── Parse PROTO_TEMPLATES ─────────────────────────────────────────
// Find the literal `var PROTO_TEMPLATES = {` and walk forward until the
// matching closing brace. We respect string boundaries so a `}` inside
// a CSS string never trips the counter.
function extractObjectLiteral(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`extract.mjs: marker not found: ${marker}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error("extract.mjs: unbalanced braces in PROTO_TEMPLATES");
}

const objLiteral = extractObjectLiteral(html, "var PROTO_TEMPLATES =");
const sandbox = { result: null };
vm.createContext(sandbox);
vm.runInContext(`result = ${objLiteral};`, sandbox);
const PROTO_TEMPLATES = sandbox.result;

// ── Parse :root { --pX-*: … } defaults ────────────────────────────
const rootMatch = html.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
if (!rootMatch) throw new Error("extract.mjs: no :root block found");
const rootBlock = rootMatch[1];
const defaults = new Map();
const declRe = /(--p\d{1,2}-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
let m;
while ((m = declRe.exec(rootBlock)) !== null) {
  defaults.set(m[1].trim(), m[2].trim().replace(/\s+/g, " "));
}

// ── Curated metadata: ordering, file names, decision-rule copy ────
// The README's published order (card → number → badge → text → menu →
// modal → panel → page → icon) is the canonical taxonomy users see, so
// the skill mirrors it. `summary` is a one-line cell for the quick-ref
// table; `when` is a longer paragraph for each per-transition file.
const ORDER = [
  { key: "p4", file: "01-card-resize",         summary: "Tween a container's width or height when its layout state changes",
    when: "Tweening a container's width or height when its layout state changes (compact ↔ expanded card, collapsing panel, list row toggling extra detail). Pure CSS — no JS required beyond the class toggle that drives the size change." },
  { key: "p9", file: "02-number-pop-in",       summary: "Re-enter each digit with a blurred slide when a number updates",
    when: "Counters, prices, balances, or any number that updates and should re-enter from a direction with blur. Each character animates independently and the last two digits stagger so decimals feel alive without looking chaotic." },
  { key: "p1", file: "03-notification-badge",  summary: "Slide a small badge onto a trigger and pop the dot",
    when: "A small badge appearing on top of a trigger (bell, inbox, button). Slides in diagonally and pops the dot independently of the trigger so the trigger itself never moves." },
  { key: "p6", file: "04-text-states-swap",    summary: "Swap text in place with a blurred up-and-down transition",
    when: "Swapping the text of a status indicator in place — \"Processing…\" → \"Done\", \"Save\" → \"Saved\". The old text exits up with blur, the new text enters from below." },
  { key: "p2", file: "05-menu-dropdown",       summary: "Open an origin-aware dropdown that grows from its trigger",
    when: "Contextual menus, dropdowns, popovers — anything that opens from a trigger and should visually grow from that trigger's position. Origin-aware via `data-origin` (top-left, top-center, top-right, bottom-*)." },
  { key: "p7", file: "06-modal",               summary: "Scale-up modal dialog with a softer scale-down on close",
    when: "Modal dialogs and full-overlay surfaces that scale up from center. Use when the surface is conceptually \"on top of\" the page rather than anchored to a trigger." },
  { key: "p3", file: "07-panel-reveal",        summary: "Slide a panel into a region with a cross-blur",
    when: "A panel that slides into view inside an existing container — e.g. detail panel inside a card, expanding section. Combines a short translate, opacity, and a 2px cross-blur so a half-height travel still reads as a full open." },
  { key: "p8", file: "08-page-side-by-side",   summary: "Slide between two side-by-side pages (list ↔ detail, step 1 ↔ step 2)",
    when: "Sliding between two full pages or screens that live side-by-side: list ↔ detail, step 1 ↔ step 2 in a wizard. Page 1 exits left, page 2 exits right." },
  { key: "p5", file: "09-icon-swap",           summary: "Cross-fade two icons in the same slot with blur and scale",
    when: "Cross-fading two icons in the same slot — hamburger ↔ close, sun ↔ moon, play ↔ pause, expand ↔ collapse. Both icons stay in the DOM stacked in the same grid cell." },
  { key: "p10", file: "10-success-check",      summary: "Reveal a success / confirmation icon with fade, rotate, blur, Y-bob, and SVG path draw",
    when: "Confirmation icons that should land with a small flourish — a green check after publishing, a saved-state badge, a sent-message receipt. Stacks five sub-animations (fade, rotate, blur, Y-bob, path draw) so the icon arrives like a punctuation mark instead of just popping in." },
  { key: "p11", file: "11-avatar-group-hover", summary: "Spring a hovered avatar up while neighbours follow with a falloff",
    when: "Avatar stacks, chip rows, or any horizontally clustered set of items where pointing at one should make the cluster react together. The hovered item scales up and lifts; siblings shift by `lift × falloff^distance` so the response decays cleanly with a directional ease-in / ease-out spring." },
  { key: "p12", file: "12-error-state-shake",  summary: "Shake an input on validation error and auto-revert to the neutral border + hide the message",
    when: "Form fields that need to call out an invalid submission — wrong email, password mismatch, required field empty. The input shakes briefly via a per-segment cubic-bezier shake, the error message fades in, and after a hold both auto-revert so the field returns to neutral once the user starts correcting." },
];

// ── Default-value rewrites ───────────────────────────────────────
// A handful of source defaults reference internal --pX-* tokens that
// we deliberately don't export (e.g. --p3-panel-height is a sizing
// token, not a transition knob). Substitute them with literal-friendly
// placeholders so the rendered defaults are self-contained.
const DEFAULT_REWRITES = [
  // Panel height is a per-call value, not a transition knob. Default
  // to half of a 200px panel; users override --panel-translate-y to
  // match their actual panel height.
  [/calc\(var\(--p3-panel-height\)\s*\*\s*0\.5\)/g, "100px"],
];

function rewriteDefault(value) {
  let out = value;
  for (const [re, rep] of DEFAULT_REWRITES) out = out.replace(re, rep);
  return out;
}

// Strip leading whitespace common to every non-empty line so HTML
// usage examples render flush-left in the markdown code fence.
function dedent(text) {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^\s*/)[0].length);
  if (indents.length === 0) return lines.join("\n");
  const min = Math.min(...indents);
  return lines.map((l) => (l.length >= min ? l.slice(min) : l)).join("\n");
}

// PROTO_TEMPLATES.usage strings start with HTML markup, then a blank
// line, then prose annotations (state machine notes, attribute legend,
// etc.). Split them so the HTML can render as a real code fence and
// the prose can render as plain text below it. Each section is dedented
// independently so the HTML sits flush left even when the prose was
// originally less indented than the markup in the source string.
function splitUsage(usage) {
  const trimmed = usage.replace(/^\n+|\n+$/g, "");
  const blankIdx = trimmed.indexOf("\n\n");
  if (blankIdx === -1) return { html: dedent(trimmed), prose: "" };
  return {
    html: dedent(trimmed.slice(0, blankIdx)),
    prose: dedent(trimmed.slice(blankIdx + 2)),
  };
}

// ── JS orchestration: shipped as small, copy-pasteable snippets ──
// Several transitions need a tiny bit of JS to drive the state changes
// (close-then-cleanup sequences, three-phase text swap, etc). These are
// distilled from prototypes.html, stripped of demo-only DOM. Any
// transition not listed here is pure CSS. JS reads from the semantic
// :root names this skill exports — not from the source --pX-* tokens.
const JS_SNIPPETS = {
  p2: `// Toggle .is-open / .is-closing with a setTimeout cleanup so the closing
// scale animates before the element resets to its pre-open rest state.
const dropdown = document.querySelector(".t-dropdown");
const closeMs = parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--dropdown-close-dur")
) || 150;

function openDropdown() {
  dropdown.classList.remove("is-closing");
  dropdown.classList.add("is-open");
}
function closeDropdown() {
  dropdown.classList.remove("is-open");
  dropdown.classList.add("is-closing");
  setTimeout(() => dropdown.classList.remove("is-closing"), closeMs);
}`,
  p7: `// Same close-then-cleanup pattern as the dropdown — modals scale from
// --modal-scale up to 1, then on close dip to --modal-scale-close.
const modal = document.querySelector(".t-modal");
const closeMs = parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur")
) || 150;

function openModal() {
  modal.classList.remove("is-closing");
  modal.classList.add("is-open");
}
function closeModal() {
  modal.classList.remove("is-open");
  modal.classList.add("is-closing");
  setTimeout(() => modal.classList.remove("is-closing"), closeMs);
}`,
  p6: `// Three-phase text swap:
//   1. Add .is-exit              — old text exits up with blur.
//   2. After --text-swap-dur, swap textContent and add .is-enter-start
//      (jumps to "below, no transition"), force a reflow.
//   3. Remove .is-enter-start    — new text animates back to rest.
const el = document.querySelector(".t-text-swap");
const dur = parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--text-swap-dur")
) || 200;

function swapText(next) {
  el.classList.add("is-exit");
  setTimeout(() => {
    el.textContent = next;
    el.classList.remove("is-exit");
    el.classList.add("is-enter-start");
    void el.offsetHeight; // force reflow so the next change transitions
    el.classList.remove("is-enter-start");
  }, dur);
}`,
  p9: `// Replay the digit pop-in: remove .is-animating, swap the digit spans,
// force a reflow, then re-add .is-animating. Mark the last two digits
// with data-stagger="1" / "2" so they ride in 1× / 2× --digit-stagger
// behind the leading digits.
const group = document.querySelector(".t-digit-group");

function setDigits(str) {
  group.classList.remove("is-animating");
  group.replaceChildren();
  const chars = str.split("");
  chars.forEach((ch, i) => {
    const span = document.createElement("span");
    span.className = "t-digit";
    span.textContent = ch;
    if (i === chars.length - 2) span.dataset.stagger = "1";
    else if (i === chars.length - 1) span.dataset.stagger = "2";
    group.appendChild(span);
  });
  void group.offsetHeight; // force reflow
  group.classList.add("is-animating");
}`,
  p8: `// Flip data-page on the container — the CSS handles the rest.
// Set --page-exit-enabled: 0 on the container if you want pages to
// fade without sliding (useful on first paint).
const slider = document.querySelector(".t-page-slide");
function showPage(n) {
  slider.setAttribute("data-page", String(n));
}`,
  p10: `// Replay the success-check entry: snap data-state to "out", force a
// reflow so the keyframes restart from 0, then flip back to "in". If
// your check stroke isn't 20 units long, measure once with
// path.getTotalLength() and update the stroke-dasharray inline.
const check = document.querySelector(".t-success-check");

function playSuccessCheck() {
  // Sync stroke-dasharray to the actual path length so the draw
  // animation lands exactly at the end of the stroke.
  const path = check.querySelector("svg path");
  if (path) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
  }
  check.setAttribute("data-state", "out");
  void check.offsetWidth; // reflow so the animation restarts
  check.setAttribute("data-state", "in");
}`,
  p11: `// Direction-aware spring on hover. Lift uses --avatar-ease-in on
// hover-in and --avatar-ease-out (typically a heavier overshoot) on
// hover-leave so the bounce only fires on the way back to rest.
const root  = document.querySelector(".t-avatar-group");
const items = Array.from(root.querySelectorAll(".t-avatar"));

function readNum(name) {
  const cs = getComputedStyle(root);
  return parseFloat(cs.getPropertyValue(name)) || 0;
}
function readEase(name) {
  return getComputedStyle(root).getPropertyValue(name).trim()
    || "cubic-bezier(0.22, 1, 0.36, 1)";
}

function setShifts(activeIdx, easeName) {
  const lift    = readNum("--avatar-lift");
  const falloff = readNum("--avatar-falloff");
  const scale   = readNum("--avatar-scale") || 1;
  const ease    = readEase(easeName);
  items.forEach((el, i) => {
    el.style.transitionTimingFunction = ease;
    if (activeIdx === null) {
      el.style.setProperty("--shift", "0px");
      el.style.setProperty("--scale-active", "1");
    } else {
      const d = Math.abs(i - activeIdx);
      el.style.setProperty("--shift",
        (lift * Math.pow(falloff, d)).toFixed(3) + "px");
      el.style.setProperty("--scale-active",
        i === activeIdx ? scale : 1);
    }
  });
}

items.forEach((el, i) => {
  el.addEventListener("mouseenter", () => setShifts(i, "--avatar-ease-in"));
});
root.addEventListener("mouseleave", () => setShifts(null, "--avatar-ease-out"));`,
  p12: `// Replay the shake + manage the auto-revert hold. The shake replays
// by removing/reflowing/re-adding .is-shaking; the revert timer drops
// .is-error from both the wrap and the input so the border + message
// fade back to neutral over --revert-dur.
const wrap   = document.querySelector(".t-input-wrap");
const input  = wrap.querySelector(".t-input");
const cs     = getComputedStyle(document.documentElement);
const holdMs = parseFloat(cs.getPropertyValue("--revert-hold")) || 3000;

let revertTimer = null;

function setError(show) {
  wrap.classList.toggle("is-error", show);
  input.classList.toggle("is-error", show);
  clearTimeout(revertTimer);
  if (show) {
    // Replay the shake from a clean baseline.
    input.classList.remove("is-shaking");
    void input.offsetWidth; // reflow so the keyframe restarts from 0
    input.classList.add("is-shaking");
    // Auto-revert: drop .is-error after the hold so the border +
    // message fade back. The shake itself ends much sooner.
    revertTimer = setTimeout(() => setError(false), holdMs);
  } else {
    input.classList.remove("is-shaking");
  }
}`,
};

// ── Render templates ──────────────────────────────────────────────
function renderTemplate(name, vars) {
  const tpl = fs.readFileSync(path.join(templateDir, name), "utf8");
  return tpl.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
    if (!(k in vars)) throw new Error(`template ${name}: missing var "${k}"`);
    return vars[k];
  });
}

function indentBlock(text, prefix) {
  return text.split("\n").map((line) => prefix + line).join("\n").trimEnd();
}

function defaultFor(internal) {
  const raw = defaults.get(internal);
  if (!raw) return "/* unset */";
  return rewriteDefault(raw);
}

function renderVarsTable(varsList) {
  const rows = varsList.map(([semantic, internal]) => {
    return `| \`${semantic}\` | \`${defaultFor(internal)}\` | sourced from \`${internal}\` |`;
  });
  return [
    "| Variable | Default | Notes |",
    "| --- | --- | --- |",
    ...rows,
  ].join("\n");
}

function renderRootBlock(varsList) {
  const lines = varsList.map(([semantic, internal]) => {
    return `  ${semantic}: ${defaultFor(internal)};`;
  });
  return `:root {\n${lines.join("\n")}\n}`;
}

// ── Reference files ───────────────────────────────────────────────
const generated = [];

for (const entry of ORDER) {
  const tpl = PROTO_TEMPLATES[entry.key];
  if (!tpl) throw new Error(`extract.mjs: PROTO_TEMPLATES.${entry.key} missing`);

  const { html: usageHtml, prose: usageProse } = splitUsage(tpl.usage);
  const rendered = renderTemplate("reference.md.tmpl", {
    name: tpl.name,
    when: entry.when,
    usage: usageHtml,
    usageProse: usageProse ? `${usageProse}\n\n` : "",
    varsTable: renderVarsTable(tpl.vars),
    rootBlock: renderRootBlock(tpl.vars),
    css: tpl.css.trim(),
    jsSection: JS_SNIPPETS[entry.key]
      ? `## JavaScript orchestration\n\n\`\`\`js\n${JS_SNIPPETS[entry.key]}\n\`\`\`\n`
      : "## JavaScript orchestration\n\nNone — pure CSS. Toggle the documented HTML attributes or class names from whatever already drives state in your app.\n",
  });

  const outPath = path.join(skillDir, `${entry.file}.md`);
  fs.writeFileSync(outPath, rendered);
  generated.push(path.relative(repoRoot, outPath));
}

// ── _root.css (the universal install block) ──────────────────────
const allDecls = [];
for (const entry of ORDER) {
  const tpl = PROTO_TEMPLATES[entry.key];
  allDecls.push(`  /* ${tpl.name} */`);
  for (const [semantic, internal] of tpl.vars) {
    allDecls.push(`  ${semantic}: ${defaultFor(internal)};`);
  }
}
const rootCss = `/* transitions-dev — copy this :root block into your project once.\n   Every transition snippet reads from these semantic names. */\n:root {\n${allDecls.join("\n")}\n}\n`;
const rootPath = path.join(skillDir, "_root.css");
fs.writeFileSync(rootPath, rootCss);
generated.push(path.relative(repoRoot, rootPath));

// ── SKILL.md ─────────────────────────────────────────────────────
const tableRows = ORDER.map((entry) => {
  const tpl = PROTO_TEMPLATES[entry.key];
  return `| **${tpl.name}** | ${entry.summary}. | [${entry.file}.md](./${entry.file}.md) |`;
}).join("\n");

const skillMd = renderTemplate("skill.md.tmpl", {
  table: tableRows,
  rootBlock: rootCss.trim(),
  fileList: ORDER.map((e) => `- [${e.file}.md](./${e.file}.md) — ${PROTO_TEMPLATES[e.key].name}`).join("\n"),
});
const skillPath = path.join(skillDir, "SKILL.md");
fs.writeFileSync(skillPath, skillMd);
generated.push(path.relative(repoRoot, skillPath));

// ── Summary ──────────────────────────────────────────────────────
console.log(`extract.mjs: rendered ${generated.length} files from ${path.relative(repoRoot, sourceHtml)}`);
for (const f of generated) console.log(`  ${f}`);
