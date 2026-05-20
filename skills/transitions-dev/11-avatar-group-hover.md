# Avatar group hover

## When to use

Avatar stacks, chip rows, or any horizontally clustered set of items where pointing at one should make the cluster react together. The hovered item scales up and lifts; siblings shift by `lift × falloff^distance` so the response decays cleanly with a directional ease-in / ease-out spring.

## HTML usage

```html
<!-- Apply .t-avatar to each item in your group (avatar,
     chip, badge, button — anything). Bring your own size,
     shape, and stacking; this stylesheet only owns the
     hover transform + transition. -->
<div class="t-avatar-group">
  <div class="t-avatar"><!-- your item --></div>
  <div class="t-avatar"><!-- your item --></div>
  <!-- … -->
</div>
```

Wire-up (vanilla JS):
  On `mouseenter` of any .t-avatar, walk every sibling and
  set inline:
    el.style.setProperty('--shift',
      (lift * Math.pow(falloff, distance)).toFixed(3) + 'px');
    el.style.setProperty('--scale-active',
      i === activeIdx ? scale : 1);
  Set transition-timing-function inline BEFORE the
  variable writes — use --avatar-ease-in on hover-in and
  --avatar-ease-out on the root's `mouseleave` (resets
  --shift to 0 and --scale-active to 1).

## Tunable variables

| Variable | Default | Notes |
| --- | --- | --- |
| `--avatar-lift` | `-4px` | sourced from `--p11-lift` |
| `--avatar-dur` | `320ms` | sourced from `--p11-dur` |
| `--avatar-scale` | `1.05` | sourced from `--p11-scale` |
| `--avatar-falloff` | `0.45` | sourced from `--p11-falloff` |
| `--avatar-ease-in` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p11-ease-in` |
| `--avatar-ease-out` | `cubic-bezier(0.34, 3.85, 0.64, 1)` | sourced from `--p11-ease-out` |

The `:root` defaults below match the live tuning on [transitions.dev](https://transitions.dev). Drop them into your global stylesheet once — every transition in this skill reads from semantic names like these, so multiple transitions can share a single `:root` block.

```css
:root {
  --avatar-lift: -4px;
  --avatar-dur: 320ms;
  --avatar-scale: 1.05;
  --avatar-falloff: 0.45;
  --avatar-ease-in: cubic-bezier(0.22, 1, 0.36, 1);
  --avatar-ease-out: cubic-bezier(0.34, 3.85, 0.64, 1);
}
```

## CSS

```css
/* Hover-spring transition only — bring your own avatar/chip
   styling (size, shape, border, stacking, background). */
.t-avatar {
  transform-origin: center;
  /* translateY before scale so scale doesn't amplify the lift offset. */
  transform:
    translateY(var(--shift, 0px))
    scale(var(--scale-active, 1));
  transition: transform var(--avatar-dur) var(--avatar-ease-in);
  will-change: transform;
}

@media (prefers-reduced-motion: reduce) {
  .t-avatar { transition: none !important; transform: none !important; }
}
```

The `@media (prefers-reduced-motion: reduce)` guard at the bottom of the snippet is required — keep it. It zeroes the transition for users who have asked for less motion at the OS level.

## JavaScript orchestration

```js
// Direction-aware spring on hover. Lift uses --avatar-ease-in on
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
root.addEventListener("mouseleave", () => setShifts(null, "--avatar-ease-out"));
```

