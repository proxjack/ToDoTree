# ToDoTree

Build **process trees and to-do trees** visually: draggable cloud-shaped nodes, with the root at the top and
the branches growing downwards. It is a single file, [`index.html`](index.html): open it with a double click in
any browser. It works **offline** and sends nothing over the network.

## Usage

Open `index.html` in your browser. Your data stays in the browser's `localStorage` and is saved automatically.

| Action | How |
| --- | --- |
| Open the node **card** (title, dates, checklist, tags, notes…) | double click / double tap, `F2`, or the **Details** button |
| Close the card | `Esc`, **Close**, `Enter` in the title, or click elsewhere |
| New child / sibling | `Tab` / `Enter` |
| Mark as done | `Space` (on a parent it sets every leaf below it) |
| Delete | `Delete` |
| Move between nodes | arrow keys |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` |
| Search | `Ctrl+F` |
| Reattach to another branch | drag a node **onto** another one |
| Free position | drag a node into empty space (passing a sibling reorders it) |
| Move without the grid | hold `Alt` while dragging |
| Reset manual moves | **Tidy up** button |
| Pan / zoom | drag the background / wheel or pinch |

### The node card

Double click a node to open a card where you can set, for every node:

- **Title** and **done** state;
- **Priority** (low, medium, high);
- **Dates**: start and due date, with the shortcuts *Today / Tomorrow / In 1 week*;
- **Repeat** (every day, week or month): when you mark the node as done, the due date moves to the next cycle
  and the checklist starts over;
- **Color**;
- **Checklist** of tickable items (`Enter` adds an item; pasting several lines creates several items);
- **Tags** (searchable from the search box);
- multi-line **Notes**.

The node shows a summary (priority, dates, `☑ 2/5`, tags, note). Everything you change in a card is undone with a
single `Ctrl+Z`. The Markdown export includes dates, priority, tags, notes and the checklist.

Numbering (1, 1.1, 1.2…) is computed from the order of siblings, left to right.

## Features

- **Bubble nodes**: nodes never overlap and push each other away like bubbles, even while you drag them.
- **Ceiling**: no node can go above the surface of the root.
- **Virtual 28 px grid** with snapping while dragging.
- **Vector graphics**: borders, text and links stay sharp at any zoom level.
- Multiple trees, undo/redo, search, "open only" filter, light/dark theme, touch support.
- **Backup**: export to JSON or Markdown and import from a file, so you never lose your data.

## Tests

You need Node.js and Chrome (or Edge, pointed to with `CHROME_PATH`).

```bash
npm install
npm test
```

`npm test` runs two Playwright suites:

- `tests/run.js`: a guided scenario (rename, drag, reattach, undo, search, zoom, saving, import…).
- `tests/fuzz.js`: random actions with invariant checks (no overlaps, no nodes above the ceiling, valid model,
  consistent undo/redo). Configurable with `FUZZ_SEEDS` and `FUZZ_STEPS`.

The tests also run on GitHub Actions on every push to `main`.

## Development notes

See [`DEVELOPMENT.md`](DEVELOPMENT.md): data model, structure of `index.html` and internal rules.

## License

Copyright © 2026 Jacopo Garau. **All rights reserved.** The code is visible for viewing purposes only; it may not
be copied, modified or distributed without written permission. See [`LICENSE`](LICENSE).
