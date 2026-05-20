# Error state shake

## When to use

Form fields that need to call out an invalid submission — wrong email, password mismatch, required field empty. The input shakes briefly via a per-segment cubic-bezier shake, the error message fades in, and after a hold both auto-revert so the field returns to neutral once the user starts correcting.

## HTML usage

```html
<!-- Apply .t-input-wrap to your wrapper, .t-input to the
     element that should shake (your input field, its
     bordered wrapper — whatever owns the visible border),
     and .t-error-msg to the message you want to reveal.
     Bring your own sizing, padding, border colors, and
     typography. -->
<div class="t-input-wrap">
  <div class="t-input">
    <input type="text">
  </div>
  <p class="t-error-msg">Please enter a valid email.</p>
</div>
```

Trigger:
  - Add `.is-error` to .t-input-wrap and .t-input. Your
    own border-color rules drive the visible color; this
    stylesheet only owns the tween.
  - Restart the shake by removing `.is-shaking` from
    .t-input, forcing a reflow, then re-adding it.
  - Optional: after --revert-hold ms, drop both
    `.is-error` classes so border + message fade back
    to neutral over --revert-dur.

Per-segment ease: each keyframe stop carries its own
animation-timing-function so each leg follows the Figma
cubic-bezier curve independently.

## Tunable variables

| Variable | Default | Notes |
| --- | --- | --- |
| `--shake-distance` | `6px` | sourced from `--p12-shake-distance` |
| `--shake-overshoot` | `4px` | sourced from `--p12-shake-overshoot` |
| `--shake-dur-a` | `80ms` | sourced from `--p12-shake-dur-a` |
| `--shake-dur-b` | `60ms` | sourced from `--p12-shake-dur-b` |
| `--shake-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p12-shake-ease` |
| `--revert-hold` | `3000ms` | sourced from `--p12-revert-hold` |
| `--revert-dur` | `280ms` | sourced from `--p12-revert-dur` |

The `:root` defaults below match the live tuning on [transitions.dev](https://transitions.dev). Drop them into your global stylesheet once — every transition in this skill reads from semantic names like these, so multiple transitions can share a single `:root` block.

```css
:root {
  --shake-distance: 6px;
  --shake-overshoot: 4px;
  --shake-dur-a: 80ms;
  --shake-dur-b: 60ms;
  --shake-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --revert-hold: 3000ms;
  --revert-dur: 280ms;
}
```

## CSS

```css
/* Border-color tween. Define your input's default / focused
   / error border-color in your own component CSS — this rule
   only owns the interpolation. Use a constant border-width
   across states so the tween never shifts inner content. */
.t-input {
  transition: border-color 150ms ease-out;
  will-change: transform;
}
.t-input.is-error {
  /* Error border auto-reverts on the hold timer, so the
     fade-out uses the slower revert duration (matches the
     message fade). */
  transition: border-color var(--revert-dur, 280ms) ease-out;
}

/* Error message reveal. Visibility is delayed by --revert-dur
   on hide so the message stays painted for the full opacity
   fade-out. Entering .is-error drops the delay to 0 so the
   message becomes visible immediately. */
.t-error-msg {
  opacity: 0;
  visibility: hidden;
  transition:
    opacity    var(--revert-dur, 280ms) ease-out,
    visibility 0s linear var(--revert-dur, 280ms);
}
.t-input-wrap.is-error .t-error-msg {
  opacity: 1;
  visibility: visible;
  transition:
    opacity    var(--revert-dur, 280ms) ease-out,
    visibility 0s linear 0s;
}

/* Multi-segment keyframe with per-stop easing so each leg
   of the shake follows its own cubic-bezier independently.
   %-stops are cumulative durations as a fraction of the
   total (80, 60, 80, 60 = 280ms): 28.57%, 57.14%, 78.57%,
   100%. Recompute if any segment duration changes. */
.t-input.is-shaking {
  animation: t-input-shake calc(
      var(--shake-dur-a) * 2 + var(--shake-dur-b) * 2
    ) linear;
}
@keyframes t-input-shake {
  0%      { transform: translateX(0);                                 animation-timing-function: var(--shake-ease); }
  28.57%  { transform: translateX(var(--shake-distance));             animation-timing-function: var(--shake-ease); }
  57.14%  { transform: translateX(calc(var(--shake-distance) * -1)); animation-timing-function: var(--shake-ease); }
  78.57%  { transform: translateX(var(--shake-overshoot));            animation-timing-function: var(--shake-ease); }
  100%    { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .t-input { animation: none !important; transform: none !important; }
}
```

The `@media (prefers-reduced-motion: reduce)` guard at the bottom of the snippet is required — keep it. It zeroes the transition for users who have asked for less motion at the OS level.

## JavaScript orchestration

```js
// Replay the shake + manage the auto-revert hold. The shake replays
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
}
```

