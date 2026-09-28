# Storytelling, script and slide-writing guide

## Structure
Default arc for a 2–5 minute piece:

1. **Hook** (title or statement): a surprising fact, a question, or the promise of the talk. Within the first 10 seconds.
2. **Context / tension** (bullets, stat, image): why this matters now, and what's broken or at stake.
3. **Insight** (statement or section): the one idea the audience should remember.
4. **Evidence** (chart, stat, split, image, code): 2–4 slides that prove or demonstrate the insight.
5. **How / what next** (timeline or bullets): the path, the plan or the steps.
6. **Payoff + call to action** (end): what to do, where to go, whom to contact.

Variants:
- **Pitch**: problem → solution → demo → market → traction → team → ask.
- **Tutorial**: goal → prerequisites → steps (one per slide) → result → next steps.
- **Report**: headline result → key metrics → drivers → risks → outlook.

Aim for one idea per slide. When a slide needs two ideas, split it.

## Pacing
- Narration at ~150 words per minute. A 3-minute video is ~450 words and ~10–12 slides (15–25s each).
- Slides without narration hold for their layout default (4–6s). Use that for breathers such as section dividers.
- Put stat and chart slides after the claim they support, and give them 10–20s of narration to walk through the numbers.
- Change the layout at least every 2 slides. Use `transition` overrides sparingly (1–3 per deck) to mark chapter changes.

## On-screen text vs narration
The slide is the headline, and the narration is the story.
- Titles are assertions, not topics: "Churn fell 30% after onboarding v2", not "Churn".
- Bullets are ≤ 8 words, parallel in form, and have no ending periods.
- Never put the narration on screen. The narration explains, adds examples and connects slides ("That's why…", "Here's the surprising part…").
- Numbers on screen are rounded and have units; the narration can give context ("almost a third").

## Writing narration for TTS
TTS reads literally, so write the way people speak:
- Keep sentences short, mostly 8–20 words, with one clause each.
- Spell out symbols and abbreviations where it helps: "forty-two percent" (or "42 percent"), "Q3" → "the third quarter", "e.g." → "for example", "vs" → "versus", "API" is fine as-is.
- Avoid parentheses, slashes, emoji, markdown, URLs and long lists of numbers.
- Use commas and full stops for rhythm, since TTS pauses on them. `[pause]`-style bracketed stage directions are stripped before synthesis.
- Refer to what's on screen: "As you can see in this chart…" works because the slide is showing it.
- Keep narration in the deck's `lang`. For bilingual decks, pick one language per deck.

## Choosing layouts
| Content | Layout |
|---|---|
| Opening | `title` (or a bold `statement`) |
| Roadmap of the talk / chapter markers | `agenda` (reuse with `active`) or `section` |
| 3–5 short points | `bullets` |
| 2–4 parallel ideas, features or principles | `cards` (with SVG icons) |
| One headline number | `big-number` |
| 2–4 numbers | `stat` |
| A trend or breakdown | `chart` |
| Process, system, framework, relationships | `visual` (an SVG diagram you draw) |
| Product, place or person photo | `image` (full-bleed) or `image-text` |
| Concept plus explanation | `image-text` with an SVG illustration |
| Us vs them / options × criteria | `comparison` |
| Before/after, pros/cons | `split` |
| Sequence or milestones | `timeline` |
| Customer or expert voice | `quote` |
| Key insight | `statement` |
| Code | `code` |
| Close with a CTA | `end` |

## Visual variety checklist
- [ ] Opens with `title` or a bold `statement`
- [ ] At least one `visual` diagram when explaining how something works
- [ ] Numbers use `big-number`, `stat` or `chart`, never bullets
- [ ] No more than 2 text-list slides (`bullets`, `agenda`) in a row
- [ ] Comparisons use `comparison` or `split`
- [ ] Closes with `end` and a clear CTA
- [ ] Every slide passes the "glance test": its point is readable in 3 seconds
