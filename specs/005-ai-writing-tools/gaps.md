# Gaps: AI writing tools

Figma: `t9xEIr22yKOj7o2Ft32hxb`, page **`09 · Release 2 · AI writing tools`** (`292:100`), created 2026-11-24. Under constitution II these frames are drawn from page `01 · Design system`, matching pages 07–08, **before** the matching screen is built: Arabic desktop light first, then phone. English and dark layouts follow from them, as in releases 1 and 2. Each row's node id is filled in once the frame is drawn.

## Frames to draw

| # | Frame | States | Node |
|---|---|---|---|
| A1 | Editor writing tools with the AI items | Format for reading (cost line), Dictate, "suggestion waiting" | `293:150` (writing tools with the AI items and "suggestion waiting"); the items also show in `292:101` |
| A2 | Format drawer (side drawer on desktop, bottom sheet on phones; the History drawer layout) | cost (credits / own key / not enough / negative); formatting; preview with Show original; conflict; own key refused; changed words; unavailable | `292:101` cost · `293:260` formatting · `293:377` preview · `294:298` own key refused · `294:416` messages board (changed words, unavailable, not enough credits, negative, conflict) |
| A3 | Dictate dialog | recording (timer, level, stop); confirm cost + language; working steps; microphone refused | board `295:356`: recording, confirm cost, working, microphone refused |
| A4 | New from audio dialog | pick file; cost; working; result with Save as new script; file refused | board `295:428`: pick, cost, result, refused |
| A5 | Captions dialog on a take | cost; working; ready with SRT / VTT downloads | board `295:482`: cost, working, ready |
| A6 | Settings → AI & credits | balance card + entries; negative banner; own key empty / saved / refused / locked | `296:380` page · board `296:532` (negative banner, key locked / refused / empty; saved key in `296:380`) |
| A7 | Phone | format sheet preview; AI & credits | `297:461` format sheet preview · `297:504` AI & credits |

Plan & usage gains two rows in the existing limit style and Settings one row in the existing row style, so they need no new frame.

## Gaps found while building

- **G-A1 Messages as one board (2026-11-24)**: the drawer's error and blocking states share one layout (a card with a coloured start edge, title, text, actions), so they are drawn once as a board (`294:416`) instead of five full editor frames. The dialogs (A3–A5) are boards of dialog cards over a scrim for the same reason.
