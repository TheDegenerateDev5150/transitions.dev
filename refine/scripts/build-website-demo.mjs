// Builds a standalone, browser-testable website-demo.html for the Refine tool.
//
// Like server/inject.mjs, this transforms the already-tested code inside
// demo.html instead of maintaining a second copy of the timeline UI. It:
//   1. Extracts the panel <style> and the module <script> (up to the demo-boxes
//      CUT_MARKER — i.e. panel + runtime + the guarded mock, NOT the demo App).
//   2. Rewrites the bare-specifier imports to absolute esm.sh URLs (so the page
//      needs no import map).
//   3. Composes a single self-contained HTML document with a transitions.dev
//      site header, a namespaced .wd-dd Menu-dropdown prototype, and a website
//      App that scans it — with window.__TX_REFINE_MOCK = true so the panel's
//      Refine / Accept / grouped-scan are served by demo.html's built-in mock
//      (no relay, no LLM, no CLI).
//
// Run: node scripts/build-website-demo.mjs   (or: npm run build:website-demo)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DEMO_PATH = fileURLToPath(new URL("../demo.html", import.meta.url));
// Repo root, so the generated page's `assets/...` (header icons) resolve.
const OUT_PATH = fileURLToPath(new URL("../../website-demo.html", import.meta.url));

// Absolute module URLs so the page works without an import map (same as inject.mjs).
const REACT_URL = "https://esm.sh/react@19";
const REACT_DOM_URL = "https://esm.sh/react-dom@19";
const REACT_DOM_CLIENT_URL = "https://esm.sh/react-dom@19/client";
const BORDER_BEAM_URL = "https://esm.sh/border-beam@1.2.0?deps=react@19,react-dom@19";

const CUT_MARKER = "// ── demo boxes ──";

function extractBetween(src, openRe, closeTag) {
  const open = src.match(openRe);
  if (!open) return null;
  const start = open.index + open[0].length;
  const end = src.indexOf(closeTag, start);
  if (end === -1) return null;
  return src.slice(start, end);
}

function buildJs(scriptSrc) {
  let js = scriptSrc;
  // Drop everything from the demo-only boxes onward (App + createRoot render);
  // we supply our own website App below. Keep the panel + runtime + mock.
  const cut = js.indexOf(CUT_MARKER);
  if (cut !== -1) js = js.slice(0, cut);

  // Rewrite the demo's bare-specifier imports to absolute URLs (mirrors inject.mjs).
  js = js
    .replace(/import\s+React\s+from\s+["']react["'];?/, `import React from "${REACT_URL}";`)
    .replace(/import\s+\{\s*createRoot\s*\}\s+from\s+["']react-dom\/client["'];?/, `import { createRoot } from "${REACT_DOM_CLIENT_URL}";`)
    .replace(/import\s+\{\s*createPortal\s*\}\s+from\s+["']react-dom["'];?/, `import { createPortal } from "${REACT_DOM_URL}";`)
    .replace(/import\s+\{\s*BorderBeam\s*\}\s+from\s+["']border-beam["'];?/, `import { BorderBeam } from "${BORDER_BEAM_URL}";`);

  return js.trim();
}

// Site-header CSS, lifted from index.html's .header / .title / .subtitle rules
// (plus the icon light/dark swap). `--text`/`--text-muted` are defined here so
// the header reads the same tokens it does on the live site.
const HEADER_CSS = `
    /* ── transitions.dev site header (from index.html) ── */
    :root { --text: #0d0d0d; --text-muted: #6c6c6c; }
    .header {
      position: relative; width: 100%; box-sizing: border-box;
      display: flex; flex-direction: column; align-items: center;
      padding-top: 48px; padding-bottom: 24px; text-align: center;
    }
    .header-icon-wrap {
      position: relative; width: 136px; height: 140px;
      margin-top: -43px; margin-bottom: -27px; overflow: visible;
    }
    .header-icon-img {
      position: absolute; left: 0; top: 0; width: 136px; height: 140px;
      display: block; user-select: none; transform-origin: center;
      transition:
        filter 0.5s cubic-bezier(0.4, 0, 0.2, 1),
        transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (hover: hover) {
      .header-icon-wrap:hover .header-icon-img {
        filter: hue-rotate(60deg) saturate(1.6);
        transform: rotate(8deg) scale(1.06);
      }
    }
    html[data-theme="dark"] .header-icon-img--light,
    html:not([data-theme="dark"]) .header-icon-img--dark { display: none; }
    html:not([data-theme="dark"]) .header-icon-img--light,
    html[data-theme="dark"] .header-icon-img--dark { display: block; }
    .title {
      font-size: 22px; font-weight: 500; line-height: 34px;
      color: var(--text); letter-spacing: -0.01em;
    }
    .subtitle {
      margin-top: 4px; max-width: 560px; font-size: 15px; font-weight: 400;
      line-height: 22px; color: var(--text-muted);
    }`;

// "Demo mode" note pill shown under the header.
const NOTE_CSS = `
    /* ── demo-mode note ── */
    .wd-demo-note {
      display: flex; align-items: center; gap: 8px;
      max-width: 500px; margin: 0 auto 8px; padding: 7px 14px;
      font-size: 13px; font-weight: 500; color: var(--c-text-mut, #585858);
      background: rgba(0,117,237,0.06);
      border-radius: 999px;
      box-shadow: inset 0 0 0 1px rgba(0,117,237,0.14);
    }
    .wd-demo-note::before {
      content: ""; width: 7px; height: 7px; border-radius: 50%;
      background: #0071e2; flex: 0 0 auto;
    }`;

// Namespaced Menu-dropdown CSS (transitions.dev #05). `.wd-dd-*` so it never
// collides with the panel's own `.t-dropdown`. Authored slightly OFF the motion
// tokens (280ms open / 180ms close, plain `ease`) so the mock agent's token-snap
// + recipe suggestions visibly change the live transition when Applied. Keeps
// the skill's prefers-reduced-motion guard.
const DROPDOWN_CSS = `
    /* ── website demo: Menu dropdown (transitions.dev #05), namespaced .wd-dd-* ── */
    .wd-dd-wrap { display: flex; justify-content: center; padding: 8px 0 24px; }
    .wd-dd { position: relative; display: inline-block; font-family: "Inter", system-ui, sans-serif; }
    .wd-dd-trigger {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 14px; font-size: 14px; font-weight: 500; color: #1b1b1b;
      background: #fff; border: 0; border-radius: 10px; cursor: pointer;
      box-shadow: 0 1px 3px 0 rgba(0,0,0,0.04), inset 0 0 0 1px rgba(0,0,0,0.06), inset 0 -1px 0 0 rgba(0,0,0,0.10);
      transition: background-color 150ms ease, box-shadow 150ms ease;
    }
    .wd-dd-trigger:hover { background: #f9f9f9; }
    .wd-dd-trigger:active { background: #f4f4f4; }
    .wd-dd-caret { transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
    .wd-dd.is-open .wd-dd-caret { transform: rotate(180deg); }

    .wd-dd-menu {
      position: absolute; top: calc(100% + 8px); left: 0;
      min-width: 208px; padding: 6px;
      background: #fff; border-radius: 12px;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.05), 0 4px 42px rgba(0,0,0,0.06);
      transform-origin: top left;
      transform: scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition:
        transform 280ms ease,
        opacity   280ms ease;
      will-change: transform, opacity;
      z-index: 5;
    }
    .wd-dd.is-open .wd-dd-menu {
      transform: scale(1);
      opacity: 1;
      pointer-events: auto;
    }
    .wd-dd.is-closing .wd-dd-menu {
      transform: scale(0.99);
      opacity: 0;
      pointer-events: none;
      transition:
        transform 180ms ease,
        opacity   180ms ease;
    }
    .wd-dd-menu-title {
      padding: 6px 10px 4px; font-size: 11px; font-weight: 600;
      letter-spacing: 0.04em; text-transform: uppercase; color: #9b9b9b;
    }
    .wd-dd-item {
      display: flex; align-items: center; gap: 10px; width: 100%;
      padding: 8px 10px; font-size: 13px; font-weight: 500; color: #2f2f2f;
      background: transparent; border: 0; border-radius: 8px; cursor: pointer;
      text-align: left;
      transition: background-color 120ms ease;
    }
    .wd-dd-item:hover { background: #f4f4f5; }

    @media (prefers-reduced-motion: reduce) {
      .wd-dd-menu { transition: none !important; }
      .wd-dd-caret { transition: none !important; }
    }`;

// The website App + the Menu-dropdown component, appended after the extracted
// panel/runtime/mock code (so `h`, hooks, TransitionRegistry, DomScanner,
// TimelineCtx, TimelinePanel, Ic, cx, BorderBeam are all in scope).
const APPENDED_JS = `
    // ── website demo: Menu dropdown (transitions.dev #05 — open/close phases) ──
    // Namespaced .wd-dd-* so it can never collide with the panel's own .t-dropdown.
    // JS owns .is-open / .is-closing with a setTimeout cleanup (per the skill), so
    // the closing scale animates before the menu resets to its pre-open rest state.
    function BoxDropdown(){
      const [open,setOpen]=useState(false);
      const [closing,setClosing]=useState(false);
      const ref=useRef(null);
      const toRef=useRef(null);
      const close=useCallback(()=>{
        setOpen(false); setClosing(true);
        if(toRef.current) clearTimeout(toRef.current);
        toRef.current=setTimeout(()=>setClosing(false),180); // --close-dur
      },[]);
      const toggle=useCallback(()=>{ if(open){ close(); } else { setClosing(false); setOpen(true); } },[open,close]);
      useEffect(()=>{
        const onDoc=e=>{ if(ref.current && !ref.current.contains(e.target)) close(); };
        const onKey=e=>{ if(e.key==="Escape") close(); };
        document.addEventListener("click",onDoc);
        document.addEventListener("keydown",onKey);
        return()=>{ document.removeEventListener("click",onDoc); document.removeEventListener("keydown",onKey); };
      },[close]);
      const item=(label,icon)=>h("button",{className:"wd-dd-item",type:"button",onClick:close},
        h(Ic,{name:icon,size:16}),label);
      return h("div",{className:cx("wd-dd",open&&"is-open",closing&&"is-closing"),ref},
        h("button",{className:"wd-dd-trigger",type:"button","aria-haspopup":"menu",
          "aria-expanded":open?"true":"false",
          onClick:e=>{ e.stopPropagation(); toggle(); }},
          "Menu",
          h("svg",{className:"wd-dd-caret",width:14,height:14,viewBox:"0 0 16 16",fill:"none","aria-hidden":"true"},
            h("path",{d:"M4 6l4 4 4-4",stroke:"currentColor",strokeWidth:1.6,strokeLinecap:"round",strokeLinejoin:"round"}))),
        h("div",{className:"wd-dd-menu",role:"menu","data-origin":"top-left","aria-hidden":open?"false":"true"},
          h("div",{className:"wd-dd-menu-title"},"Actions"),
          item("New file","copy"),
          item("Refresh","restart"),
          item("Settings","gear")));
    }

    // Website App — models the demo App: a scanned demo-root + the TimelinePanel.
    function WebsiteApp(){
      const rootRef=useRef(null);
      const registry=useMemo(()=>new TransitionRegistry(),[]);
      const [activeId,setActiveId]=useState(null);
      useEffect(()=>{
        const root=rootRef.current||document.body;
        const scanner=new DomScanner(root,registry);
        scanner.start();
        return()=>scanner.stop();
      },[registry]);
      const ctx=useMemo(()=>({registry,activeId,setActiveId}),[registry,activeId]);
      return h(TimelineCtx.Provider,{value:ctx},
        h("div",{ref:rootRef,className:"demo-root"},
          h("div",{className:"wd-dd-wrap"}, h(BoxDropdown))),
        h(TimelinePanel));
    }

    createRoot(document.getElementById("root")).render(h(WebsiteApp));`;

function buildHtml({ css, js }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transitions \u2014 Refine demo</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
${css}
${HEADER_CSS}
${NOTE_CSS}
${DROPDOWN_CSS}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-icon-wrap" aria-hidden="true">
      <img class="header-icon-img header-icon-img--light" src="assets/icon%20light%202x.png" alt="" width="136" height="140" decoding="async" />
      <img class="header-icon-img header-icon-img--dark" src="assets/icon-dark-2x.png?v=2" alt="" width="136" height="140" decoding="async" />
    </div>
    <h1 class="title">Transitions</h1>
    <p class="subtitle">
      Refine demo \u2014 inspect a live transitions.dev component and refine its motion.<br />
      Agent responses are simulated locally; no relay or LLM required.
    </p>
  </header>
  <div class="wd-demo-note">Demo mode \u2014 agent responses are simulated</div>
  <div id="root"></div>
  <script type="module">
    // Standalone demo: route the panel's relay client through demo.html's
    // built-in mock instead of a live relay/LLM/CLI.
    window.__TX_REFINE_MOCK = true;
${js}
${APPENDED_JS}
  </script>
</body>
</html>
`;
}

async function main() {
  const html = await readFile(DEMO_PATH, "utf8");

  const styleSrc = extractBetween(html, /<style>/, "</style>");
  const scriptSrc = extractBetween(html, /<script\s+type="module">/, "</script>");
  if (!styleSrc || !scriptSrc) {
    throw new Error("build-website-demo: could not locate <style> or module <script> in demo.html");
  }

  const css = styleSrc.replace(/\s+$/g, "");
  const js = buildJs(scriptSrc);
  const out = buildHtml({ css, js });
  await writeFile(OUT_PATH, out, "utf8");
  console.log(`website-demo.html written (${out.length} bytes) → ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
