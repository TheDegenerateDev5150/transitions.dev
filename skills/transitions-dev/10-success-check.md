# Success check

## When to use

Confirmation icons that should land with a small flourish — a green check after publishing, a saved-state badge, a sent-message receipt. Stacks five sub-animations (fade, rotate, blur, Y-bob, path draw) so the icon arrives like a punctuation mark instead of just popping in.

## HTML usage

```html
<!-- Wrap your icon (SVG, image, anything) in .t-success-check.
     The wrapper drives fade + rotate + blur + Y-bob; if your
     icon is an SVG <path>, it gets the stroke-draw animation.
     Bring your own icon size / colors. -->
<span class="t-success-check" data-state="out" aria-hidden="true">
  <svg viewBox="0 0 48 48" fill="none">
    <!-- your icon path(s) here -->
  </svg>
</span>
```

Trigger:
  - Cold load is data-state="out" (opacity 0; no animation).
  - Show: set data-state="in" (fade + rotate + blur + Y-bob
    + path draw run in parallel).

Snippet covers the appear transition only — bring your own
hide behavior (e.g. unmount, opacity:0, or a custom exit).

## Tunable variables

| Variable | Default | Notes |
| --- | --- | --- |
| `--check-opacity-dur` | `550ms` | sourced from `--p10-opacity-dur` |
| `--check-rotate-dur` | `550ms` | sourced from `--p10-rotate-dur` |
| `--check-rotate-from` | `80deg` | sourced from `--p10-rotate-from` |
| `--check-bob-dur` | `450ms` | sourced from `--p10-bob-dur` |
| `--check-y-amount` | `40px` | sourced from `--p10-y-amount` |
| `--check-blur-dur` | `500ms` | sourced from `--p10-blur-dur` |
| `--check-blur-from` | `10px` | sourced from `--p10-blur-from` |
| `--check-path-dur` | `550ms` | sourced from `--p10-path-dur` |
| `--check-path-delay` | `80ms` | sourced from `--p10-path-delay` |
| `--check-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p10-ease-out` |
| `--check-ease-opacity` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p10-ease-opacity` |
| `--check-ease-rotate` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p10-ease-rotate` |
| `--check-ease-bob` | `cubic-bezier(0.34, 1.35, 0.64, 1)` | sourced from `--p10-ease-bob` |
| `--check-ease-path` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p10-ease-path` |

The `:root` defaults below match the live tuning on [transitions.dev](https://transitions.dev). Drop them into your global stylesheet once — every transition in this skill reads from semantic names like these, so multiple transitions can share a single `:root` block.

```css
:root {
  --check-opacity-dur: 550ms;
  --check-rotate-dur: 550ms;
  --check-rotate-from: 80deg;
  --check-bob-dur: 450ms;
  --check-y-amount: 40px;
  --check-blur-dur: 500ms;
  --check-blur-from: 10px;
  --check-path-dur: 550ms;
  --check-path-delay: 80ms;
  --check-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-opacity: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-rotate: cubic-bezier(0.22, 1, 0.36, 1);
  --check-ease-bob: cubic-bezier(0.34, 1.35, 0.64, 1);
  --check-ease-path: cubic-bezier(0.22, 1, 0.36, 1);
}
```

## CSS

```css
/* Wrapper drives the appear animation; it doesn't own any
   sizing or color so you can drop in any icon. */
.t-success-check {
  display: inline-block;
  transform-origin: center;
  opacity: 0;
  will-change: transform, opacity, filter;
}
/* overflow: visible keeps the stroke from clipping while it
   draws; display: block kills the inline whitespace under SVGs. */
.t-success-check svg { display: block; overflow: visible; }
/* Stroke-draw setup. Replace 20 with the result of
   path.getTotalLength() for your path; round caps mean any
   sub-pixel overshoot is invisible. */
.t-success-check svg path {
  stroke-dasharray: 20;
  stroke-dashoffset: 20;
}

.t-success-check[data-state="in"] {
  animation:
    t-check-fade   var(--check-opacity-dur) var(--check-ease-opacity) forwards,
    t-check-rotate var(--check-rotate-dur)  var(--check-ease-rotate)  forwards,
    t-check-blur   var(--check-blur-dur)    var(--check-ease-out)     forwards,
    t-check-bob    var(--check-bob-dur)     var(--check-ease-bob)     forwards;
}
.t-success-check[data-state="in"] svg path {
  animation: t-check-draw var(--check-path-dur) var(--check-ease-path) var(--check-path-delay, 0ms) forwards;
}

@keyframes t-check-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes t-check-rotate {
  from { transform: rotate(var(--check-rotate-from)); }
  to   { transform: rotate(0deg); }
}
@keyframes t-check-blur {
  from { filter: blur(var(--check-blur-from)); }
  to   { filter: blur(0); }
}
@keyframes t-check-bob {
  from { translate: 0 var(--check-y-amount); }
  to   { translate: 0 0; }
}
@keyframes t-check-draw { to { stroke-dashoffset: 0; } }

@media (prefers-reduced-motion: reduce) {
  .t-success-check { animation: none !important; opacity: 1; }
  .t-success-check svg path { animation: none !important; stroke-dashoffset: 0 !important; }
}
```

The `@media (prefers-reduced-motion: reduce)` guard at the bottom of the snippet is required — keep it. It zeroes the transition for users who have asked for less motion at the OS level.

## JavaScript orchestration

```js
// Replay the success-check entry: snap data-state to "out", force a
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
}
```

