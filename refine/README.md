# transitions-refine

A live, agent-driven **Refine** panel for CSS and [Motion](https://motion.dev) transitions. One command injects a docked timeline + Refine panel onto your running app — no `npm install`, no source edits of your own — and every "Refine" click asks a coding agent to review the selected transition against the [transitions.dev](https://transitions.dev) motion tokens and suggest token-aligned values (or a whole-transition replacement from the library).

The feedback shows up **in a panel that slides in from the right** — not in your chat — and you pick which suggestions to apply. Applied suggestions are **live overrides** (instant preview, reversible) — the same path as dragging the timeline bars. When you're happy, **Accept** writes those values back into your source via the agent.

Real components rarely live in one CSS rule. A dropdown has an **Open** and a **Close** phase, each animating several elements (panel, backdrop, staggered items) with different timings — and the close phase usually isn't even in the DOM while the panel is open. So when the panel opens it also asks the agent to **read your source and group** the page's transitions into components → phases → member elements. You then pick a whole phase (e.g. *Dropdown · Open*) and see every sub-transition as a labeled lane on one shared timeline; Play arms all of them together. If no agent is live, the panel falls back to the flat DOM scan with no regression.

Inspired by the [impeccable.style](https://impeccable.style/live-mode/) "live" pattern: the browser drops a job in a tiny local relay, and the relay answers it with **one agent run per click**. No standing loop, nothing to start per click — you just keep the relay running.

```
[Refine click] → POST /jobs → relay ──one run──► answer
[right panel]  ← GET /jobs/:id ← relay ◄── suggestions
```

## Use it

```bash
# inject the panel + start the relay (deterministic suggestions work immediately)
npx transitions-refine live

# remove the injected <script> tag again
npx transitions-refine stop
```

`live` sets everything up with no install and no edits of your own:

1. injects one `<script type="module" src=".../inject.js">` into your page (it looks for `index.html`, `public/index.html`, … or pass `--page <path>`),
2. drops the `refine-live` + `transitions-dev` skills into `.agents/skills/` (so the agent makes token-aware picks),
3. starts the local relay (which serves the panel at `/inject.js`).

Open your app — the panel is now on the page. Press Ctrl-C to stop the relay and remove the injected tag.

## LLM quality (recommended)

The default answerer snaps each value to the nearest motion token. For *usage-aware* picks (a 300 ms modal close → `Quick` 150 ms, a dropdown open → `Fast` 250 ms), back the panel with an LLM. Two ways:

```bash
# A) persistent: install/wire the Cursor CLI so the relay answers LLM jobs itself,
#    per click, with no /refine live loop to keep alive (one-time CLI install)
npx transitions-refine live --llm
```

After `--llm`, make sure the CLI is authenticated once: run `cursor-agent` to log in, or set `CURSOR_API_KEY`.

```
# B) in-IDE agent: run this in your editor to become the answerer yourself
/refine live
```

You can also point the relay at any one-shot agent CLI via `REFINE_AGENT_CMD` (the relay feeds it the prompt on stdin and reads a JSON result from stdout):

```bash
REFINE_AGENT_CMD='cursor-agent -p' npm run relay   # or: codex exec -  |  claude -p
```

The CLI must have the `transitions-dev` skill available (the prompt tells it to read the skill).

## Grouped scan — Open / Close phases

When the panel opens it posts a **scan job** to the relay; the agent reads your source and returns the page's animated components, each split into phases (`open`, `close`, …) with their **member elements** and the *real* per-state timings — including the close transition the DOM can't show you. The picker then groups by component, you select a phase, and the timeline renders one lane per member-property (each lane labeled with its member) on a single time axis so stagger and delays line up. **Play** arms every member of the phase at once (driving each element via its `toState` class/attribute), and **Accept** writes back to the correct state rule (`.is-open` vs `.is-closing`) per member.

Grouping needs the agent (`/refine live`, `--llm`, or `REFINE_AGENT_CMD`); with no agent the panel just shows the flat DOM scan as before.

## Refine modes

- **Small refinements** — keeps the transition, suggests motion-token tweaks (duration/easing), and may add a whole-transition replacement when one clearly fits better.
- **Replace transition** — only whole-transition replacements from the transitions.dev library (no token tweaks). This path needs the agent; the deterministic answerer will tell you to switch to the LLM.

## Accept — write changes to your code

The **Accept** button (next to Refine) is enabled whenever the selected transition has unsaved changes — whether you edited the bars/easing by hand or applied a Refine suggestion. Pressing it sends an **apply job** to the relay: the agent finds where that transition is declared in your source (plain CSS, CSS Modules, styled-components/emotion, Tailwind, or inline styles), edits only the changed timings, and reports back. The button shows a spinner while saving and flips to **Done** on success.

Like Replace, Accept needs the agent — run `/refine live` (or `--llm` / `REFINE_AGENT_CMD`). The deterministic answerer can't edit files. Play preview also no longer needs you to trigger the transition first: it recovers the end-state from your stylesheets (hover/focus pseudo-states and toggled classes like `.modal.open`), so opening the panel and pressing Play just works.

## Pieces

| Piece | File | Role |
|-------|------|------|
| CLI | `bin/cli.mjs` | inject the panel, drop skills, optionally install the Cursor CLI, start the relay |
| Relay (answers jobs) | `server/relay.mjs` | job queue + CORS + one-run-per-job dispatch; serves `/inject.js` |
| Injected UI | `server/inject.mjs` + `demo.html` | builds the browser module (timeline + Refine panel) with absolute esm.sh imports |
| Motion tokens | `server/motion-tokens.mjs` | token table + the nearest-token deterministic fallback |
| External poller (optional) | `server/refine-agent.mjs` | standing no-LLM poller for `REFINE_AUTO=0` mode |
| Skill (live agent) | `.agents/skills/refine-live/` | turns `/refine live` into the relay's answerer |

## Knobs

| Env / global | Default | Purpose |
|--------------|---------|---------|
| `REFINE_RELAY_PORT` | `7331` | relay port |
| `REFINE_AGENT_CMD` | — | one-shot LLM CLI the relay spawns per job |
| `REFINE_AGENT_TIMEOUT_MS` | `120000` | per-run timeout |
| `REFINE_AUTO=0` | — | disable auto-answer and wait for an external poller |
| `window.REFINE_RELAY_URL` | injected origin | browser override for the relay URL |

Endpoints: `POST /jobs` (refine, `kind: "apply"`, or `kind: "scan"`), `GET /jobs/:id` (browser). In `REFINE_AUTO=0` mode an external poller also uses `GET /jobs/next` and `POST /jobs/:id/{status,result,error}` (the result body accepts `suggestions`, `groups`, or `applied`).

Refine suggestions stay as live overrides until you press **Accept**, which is the explicit step that writes them into your source.

## License

MIT
