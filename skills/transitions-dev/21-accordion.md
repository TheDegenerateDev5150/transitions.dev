# Accordion expand

## When to use

A disclosure / accordion / collapsible section whose panel grows and shrinks in height when toggled, with the header chevron morphing between a downward "v" and an upward "^". Use for settings groups, FAQs, filter sections, "show more" details — any header + collapsible body.

Height animates via `grid-template-rows: 0fr ↔ 1fr`, so there's **no JS height measuring** and content of any size animates cleanly. The chevron's SVG `d` path morphs between two vertex sets rather than rotating, so it reads as a single fluid shape change.

## HTML usage

```html
<div class="t-acc" data-open="false">
  <button class="t-acc-head" aria-expanded="false">
    Title
    <span class="t-acc-chevron">
      <svg viewBox="0 0 16 16"><path d="M4 6.5L8 10.5L12 6.5"/></svg>
    </span>
  </button>
  <div class="t-acc-panel"><div class="t-acc-panel-inner"> … </div></div>
</div>
```

Toggle `data-open` on the item. The panel animates via
grid-template-rows 0fr ↔ 1fr (no JS height measuring) and
the chevron's `d` path morphs from a "v" to a "^".

## Tunable variables

| Variable | Default | Notes |
| --- | --- | --- |
| `--acc-expand` | `250ms` | sourced from `--p21-expand-dur` |
| `--acc-collapse` | `250ms` | sourced from `--p21-collapse-dur` |
| `--acc-chevron` | `250ms` | sourced from `--p21-chevron-dur` |
| `--acc-ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | sourced from `--p21-ease` |

The `:root` defaults below match the live tuning on [transitions.dev](https://transitions.dev). Drop them into your global stylesheet once — every transition in this skill reads from semantic names like these, so multiple transitions can share a single `:root` block.

```css
:root {
  --acc-expand: 250ms;
  --acc-collapse: 250ms;
  --acc-chevron: 250ms;
  --acc-ease: cubic-bezier(0.22, 1, 0.36, 1);
}
```

## CSS

```css
/* grid-template-rows 0fr → 1fr gives a clean height animation
   with no JS measurement; the inner element clips overflow. */
.t-acc-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--acc-collapse) var(--acc-ease);
}
.t-acc[data-open="true"] .t-acc-panel {
  grid-template-rows: 1fr;
  transition: grid-template-rows var(--acc-expand) var(--acc-ease);
}
.t-acc-panel-inner {
  overflow: hidden;
  opacity: 0;
  filter: blur(2px);
  transition:
    opacity var(--acc-collapse) var(--acc-ease),
    filter var(--acc-collapse) var(--acc-ease);
}
.t-acc[data-open="true"] .t-acc-panel-inner {
  opacity: 1;
  filter: blur(0);
  transition:
    opacity var(--acc-expand) var(--acc-ease),
    filter var(--acc-expand) var(--acc-ease);
}
/* The chevron does NOT rotate — its path morphs. Both `d`
   values share the same M/L/L structure so vertices tween. */
.t-acc-chevron path {
  d: path("M4 6.5L8 10.5L12 6.5");
  transition: d var(--acc-chevron) var(--acc-ease);
}
.t-acc[data-open="true"] .t-acc-chevron path {
  d: path("M4 9.5L8 5.5L12 9.5");
}

@media (prefers-reduced-motion: reduce) {
  .t-acc-panel, .t-acc-panel-inner, .t-acc-chevron path {
    transition: none !important;
  }
}
```

The `@media (prefers-reduced-motion: reduce)` guard at the bottom of the snippet is required — keep it. It zeroes the transition for users who have asked for less motion at the OS level.

## JavaScript orchestration

```js
// Toggle data-open on the item; CSS owns the height + chevron morph.
const acc = document.querySelector(".t-acc");
const head = acc.querySelector(".t-acc-head");

head.addEventListener("click", () => {
  const open = acc.getAttribute("data-open") === "true";
  acc.setAttribute("data-open", String(!open));
  head.setAttribute("aria-expanded", String(!open));
});
```

### Two-element panel + padding placement

The panel needs the two-element structure (`.t-acc-panel` grid track + `.t-acc-panel-inner` with `overflow: hidden`). The `0fr → 1fr` track can only collapse a child that clips its own overflow. Keep padding on `.t-acc-panel-inner`, never on `.t-acc-panel` — padding on the `0fr` track leaves a residual height strip so the panel never fully closes.

### The `d:` path morph is Chromium-only

CSS `d:` path interpolation animates in Chromium; in Firefox / Safari the chevron snaps between the two paths (everything else still animates). Both `d` values must share identical command structure (same count and order of `M` / `L`) to interpolate. If you need cross-browser chevron motion, swap the path morph for a `transform: rotate(180deg)` on the chevron instead.

