# Authoring SVG visuals

You draw diagrams, flows, frameworks, icons and simple illustrations as SVG. They animate in the video and HTML deck (strokes draw on, fills and text fade in, step by step), follow the theme's colors, and are rasterized to crisp PNGs for PPTX/PDF.

## Where SVG goes
| Use | Layout / field |
|---|---|
| A diagram as the slide's centerpiece | `visual` with `src: "name.svg"` (`position: "center"`) |
| A diagram beside 2–4 notes | `visual` with `position: "left"` or `"right"` plus `bullets`/`text` |
| An illustration beside a headline and bullets | `image-text` with `src: "name.svg"` |
| Small icons on feature cards | `cards[].icon`: inline markup or a `.svg` file |

Write each non-trivial SVG to its own file in `<deck>/assets/` (easier to edit and review) and reference it by file name. Inline `svg` strings are fine for tiny icons.

## Rules
1. **Root**: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">`, with no width/height (it scales to fit). Match the space:
   - centered `visual`: wide, about 16:7 to 16:9 (e.g. `0 0 1600 700`)
   - `visual` left/right, or `image-text`: roughly square to portrait (`0 0 800 800`, `0 0 800 900`)
   - card icons: `0 0 48 48`
2. **Colors are theme tokens, never hex**: `var(--text)`, `var(--muted)`, `var(--accent)`, `var(--accent2)`, `var(--bg)`, `var(--bg2)`, `var(--surface)`. `currentColor` works too (icons use it: the card sets it to the accent). Tokens make the same SVG work in every theme and style.
3. **Minimal aesthetic**: 2–3px strokes, `fill="none"` outlines, small corner radii (`rx="4"`–`"8"`), and a single accent-filled element that marks the point of the diagram. Plenty of empty space. No drop shadows, gradients or filters unless the deck is expressive.
4. **Text**: no `font-family` (it inherits the theme font). Use `font-size` in viewBox units: labels 22–28, titles 40–56 in a 1600-wide viewBox. Keep labels to 1–3 words, and put explanations in the narration. Use `text-anchor="middle"` for centered labels.
5. **Animation order with `data-step`**: wrap each build step in `<g data-step="1">`, `<g data-step="2">`, … Groups with the same step appear together; unmarked content is visible from the start. Order the steps the way the narration explains them (box → arrow → box …). Without `data-step`, the top-level children animate in document order.
6. **Draw-on works on strokes**: outlines, connectors and arrows trace in; fills and text fade in right after. A filled shape with no stroke simply fades.
7. **Timing**: `stepSec` on a `visual` slide sets the gap between steps (default: spread over ~2s). For narrated diagrams, set `stepSec` ≈ narration length ÷ number of steps so each part appears as it's mentioned.
8. **No** scripts, event handlers, `<foreignObject>`, external images or fonts; they're stripped or won't render. Use simple paths so every renderer draws them the same way.
9. Arrowheads: draw them as their own small path (`M x-15 y-14 L x y L x-15 y+14`) with round caps rather than `<marker>`, so they animate with their connector.

## Patterns
- **Pipeline/flow**: equal boxes in a row with arrows between them; the last box is accent-filled.
- **Hub and spoke**: an accent circle in the middle, with satellite circles and connecting lines. Each spoke is its own step.
- **Layers/stack**: offset rectangles; label each layer on the right.
- **2×2 matrix**: two axes (`var(--muted)`), four quadrants labeled, one quadrant accent-tinted (`fill="var(--accent)" fill-opacity="0.12"`).
- **Before → after**: two mini-diagrams side by side, the right one using the accent.
- **Abstract UI illustration**: nested rounded rectangles with line placeholders (`stroke-linecap="round"`, thick strokes as "text lines") and one accent dot or button.

## Example (pipeline, 1600×560)
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560">
  <g data-step="1">
    <rect x="20" y="150" width="300" height="220" rx="6" fill="none" stroke="var(--text)" stroke-width="3"/>
    <text x="50" y="290" font-size="46" font-weight="600" fill="var(--text)">Capture</text>
  </g>
  <g data-step="2">
    <path d="M340 260 H 420" stroke="var(--muted)" stroke-width="3" fill="none"/>
    <path d="M405 246 L 422 260 L 405 274" stroke="var(--muted)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g data-step="3">
    <rect x="440" y="150" width="300" height="220" rx="6" fill="var(--accent)" stroke="var(--accent)" stroke-width="3"/>
    <text x="470" y="290" font-size="46" font-weight="600" fill="var(--bg)">Ship</text>
  </g>
</svg>
```
`examples/minimal/assets/` in the plugin repo has complete examples (`flow.svg`, `hub.svg`, `layers.svg`).

## Review
Always check SVG slides in `motionstudio stills`: look for labels overflowing boxes, crossing lines, text too small to read at slide size (below ~22 units in a 1600-wide viewBox), and unbalanced empty areas. To inspect the draw order, render a mid-animation still with `motionstudio stills <deck> --slides N --at 1.5`.
