# ToDoTree — development notes

Personal app to build **process / to-do trees** visually: draggable cloud-shaped nodes, with the root at the top
growing downwards. A single file, `index.html`, that opens with a double click in any browser. Personal use, no
sharing or syncing.

## Constraints
- **A single `index.html` file** with HTML + CSS + JS: no build, no framework, no CDN.
- **Offline and local**: no network calls. Data lives in `localStorage` (key `trees:v1`; the legacy key `alberi:v1`
  written by earlier versions is still read and migrated).
- **Automatic** saving (350 ms debounce) plus JSON / Markdown backups so data is never lost.
- English UI. Node text is always written with `textContent` (never `innerHTML`) for safety.
- Touch compatible (pointer events, pinch-zoom) and light/dark theme.

## Data model
`data = { v, trees:[{ id, root, view:{x,y,k} }], current, theme, numbers }`

Node: `{ id, text, done, collapsed, children[], color?, dx?, dy?, prio? (1-3), due? ('YYYY-MM-DD'), start? ('YYYY-MM-DD'),
rep? ('d'|'w'|'m'), items? [{t, d}] (checklist, max 100), tags? [string] (max 12), note? }`
- In nodes with children the "done" state is **derived** from the leaves (`stats` in `index()`); a parent's checkbox
  sets every leaf below it.
- `dx/dy` are manual offsets **added along the branch**: moving a node also moves its subtree.
- The order of siblings (left → right) is the sequence of steps; the numbering 1, 1.1, 1.2… is computed.
- Any external data goes through `clean()` / `normalize()`.

## Structure of `index.html` (commented sections in the script)
constants and state → data and persistence → history (undo/redo with JSON snapshots) → index and visibility →
render (DOM, tree `layout()`, animation) → view (pan/zoom/fit) → selection and node toolbar → text editing →
node actions → node card → interaction (drag, pan, pinch) → keyboard → import/export → UI → startup.

Internal rules: every model change goes through `commit()` (snapshot for undo) or `mutate(fn)`, then `render()` and
`scheduleSave()`. `render()` reuses DOM elements by id and animates the nodes with `requestAnimationFrame`.
Every model change (including collapse/expand) must go through `commit()` to be undoable.

## Bubbles and ceiling
`layout()` computes the base positions (`baseT`, used for `dx/dy`) and then `relax()` pushes them apart like bubbles
(`BUBBLE` margin) into `tgt`; the repulsion is not stored in the model. While dragging, `bubbleLoop()` pushes the
other nodes away with a spring (the node under the pointer stays put so it can be a reattach target).
`CEIL` is the ceiling: no node can have y < `CEIL` (neither while dragging nor after the drop).

Repulsion priority (`rank`): fixed root > manually placed nodes (with `dx/dy`) > automatic nodes, which yield first;
so the dropped node stays where it is (and on the grid) and the others make room. If a vertical push would take a
node above the ceiling, `relax()` pushes sideways. `relax()` only compares nearby nodes (sorted by x); a rank
>= `FROZEN` means locked (dragged / drop target). If the first phase does not converge, a second phase ignores
the priorities (except locked nodes).

Grid: during and after a free drag the dragged node snaps to `GRID` (28 px, like the background); holding Alt makes
the move free.

## Node card
Double click/tap (or F2, or "Details" in the toolbar) opens `#card`: title, done, priority, start/due date
(+ "Today/Tomorrow/…"), repeat, color, checklist (Enter adds an item, pasting several lines creates several items),
tags, notes. Changes apply to the model immediately (`touchCard()`); when the card closes (`closeCard()`: Esc, Close,
Enter in the title, click elsewhere) they become ONE single undo step. The text of new nodes (Tab/Enter) stays in
inline editing (`startEdit`). `finishEdit()` also closes the card.

Repeat: a leaf node with `rep` marked "done" does not stay done; it moves its due date forward (`advanceRepeat`, in
`applyDone`) and resets its checklist. Search looks at title, tags and checklist items (`matches`). Markdown:
`@due ^start !priority #tag`, note in `> …` lines, checklist as nested items (`toMd`/`parseMd`).

## Interactions
Double click/tap: card · Tab: child · Enter: sibling · Space: done · Delete: delete · arrows: navigate ·
Ctrl+Z / Ctrl+Y: undo/redo · Ctrl+F: search · drag onto a node = reattach · drag into empty space = free position
(and reorder if you pass a sibling) · "Tidy up" resets manual moves.

## Tests
`npm install` then `npm test` (Playwright + an installed Chrome; or `CHROME_PATH=<exe>`).
`tests/run.js` loads `index.html` from file:// and tries editing, drag, reattach, undo, collapse, search, zoom, saving,
offline reload, new tree, Markdown import and the node card, and checks that there are no console errors. The tests
expose the state through `window.__trees` (debug only).
In the tests, clicks must be scaled by the current zoom (`view.k`).
`tests/fuzz.js` (also part of `npm test`; `FUZZ_SEEDS=1,2 FUZZ_STEPS=60 npm run test:fuzz`) performs random actions
with the real mouse and keyboard and, after each one, checks: no overlaps, no node above the ceiling, valid model,
DOM = visible nodes, undo/redo restoring the state. On failure it prints the seed and the actions to reproduce it.
CI: `.github/workflows/test.yml` runs `npm test` on every push to `main` and on pull requests.

## Ideas not done yet
PNG/SVG export · cross links between nodes (graph) · process templates · Markdown notes · multiple selection ·
File System Access API to save directly to a `.json` file.
