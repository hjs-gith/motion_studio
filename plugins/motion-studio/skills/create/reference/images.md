# Generated images (image-model providers)

Slides can ask an image model for a picture instead of pointing at a file. It's optional and paid, so SVG stays the default for diagrams, icons and illustrations (see `svg-visuals.md`).

## When to generate vs. draw
| Need | Use |
|---|---|
| Diagram, process, framework, chart-like visual, icon | SVG (`visual`, `cards[].icon`); free, animated, on-theme |
| Photo-like scene, mood or atmosphere, product-in-context, texture | Generated image (`image`, `image-text`, `split` columns) |
| Real product screenshots, logos, people's faces | Files the user provides; never generate them |

Aim for at most 1–3 generated images per 10 slides. Too many makes a deck feel generic and costs more.

## Deck setup
```json
"images": { "provider": "openai", "model": "gpt-image-2.5-flare", "quality": "medium" }
```
- `provider`: `openai` (default). `placeholder` makes free local gradients, useful for testing.
- `model`: `gpt-image-2.5-flare` (fast, default), `gpt-image-2.5-sunburst` (premium detail, slower), `gpt-image-2`.
- `quality`: `low` | `medium` (default) | `high` | `xhigh` | `max` | `auto`. Use `low` for drafts. Higher quality costs more tokens.
- `style`: an optional house style appended to every prompt. When omitted it comes from the theme: minimal themes ask for "clean composition, negative space, restrained palette with one accent", expressive themes for "bold, cinematic".

## Per slide
```json
{ "id": "hero", "layout": "image", "title": "Morning rituals",
  "generate": { "prompt": "A sunlit kitchen table at dawn with a ceramic cup and an open notebook, low angle" } }
{ "id": "focus", "layout": "image-text", "title": "Start without a screen", "side": "right",
  "generate": { "prompt": "Hands writing in a paper journal by a window, soft morning light, no face visible" } }
{ "id": "vs", "layout": "split", "title": "Two ways to start",
  "left":  { "heading": "Rushed", "generate": { "prompt": "…" } },
  "right": { "heading": "Rested", "generate": { "prompt": "…" } } }
```
`generate` fields: `prompt` (required), and optionally `quality`, `model`, `provider`, `style` (replaces the house style), `background` (`opaque`/`transparent`/`auto`) and `allowText` (default false). If `src` is also set, `src` wins and nothing is generated.

Size and aspect ratio come from the layout: 16:9 for full-bleed `image`, portrait for the `image-text` panel, and 4:3 for `split` columns. For full-bleed images with a title, the prompt also asks for a calm lower third so the title stays readable.

## Writing prompts
- Describe the **subject, setting, light and camera**: "A ceramic cup on a linen tablecloth, morning window light, shallow depth of field, eye level".
- Stay concrete and literal. Metaphors produce clichés ("success" becomes a mountain summit).
- Leave text out. Slides render text natively, and the builder adds a no-text instruction.
- Keep one visual language per deck: the same lighting and palette words, and similar framing.
- Avoid real people, brands and logos, and anything the user didn't ask for. Don't make images that could pass as real documentary photos of events.

## Workflow (paid: always get approval)
1. Add `generate` to the slides and run `motionstudio validate`. Until images exist, slides show **placeholder gradients**, so layout review with `stills` works with no key.
2. Run `motionstudio images <deck>` (no `--yes`). It prints the plan: which images are pending, with model, quality and size. Nothing is generated or billed.
3. **Show the plan to the user and ask for approval.** Mention the count, the model and quality, and that it's billed per token to their OpenAI account. Don't run `--yes` without an explicit yes in chat.
4. Run `motionstudio images <deck> --yes`. Results go to `assets/generated/` with `manifest.json` (prompt, revised prompt, usage, estimated cost).
5. Review with `motionstudio stills`. To redo one image, change its prompt (or run `--force --only <id>`, which needs approval again) and re-run.

Images are cached by a hash of provider, model, quality, size, background and the full prompt (including style). Unchanged images are never regenerated or re-billed.

## API key
The user sets it themselves. Never ask them to paste a key into chat, and never write it into files:
- `export OPENAI_API_KEY=…` in `~/.zshrc` (then restart Claude Code), or
- `"env": { "OPENAI_API_KEY": "…" }` in `~/.claude/settings.json`.

`MOTION_STUDIO_OPENAI_API_KEY` works too, as do `OPENAI_BASE_URL`, `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID`. `motionstudio doctor` shows whether a provider is configured.

## Adding providers (for developers)
Implement `ImageProvider` in `engine/src/images/<name>.ts` (id, models, `normalizeSize`, `generate`, optional `costUSD`) and register it in `engine/src/images/index.ts`. Decks then select it with `"images": { "provider": "<id>" }` or per slide with `generate.provider`.
