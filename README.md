# ToDoTree

Build **process trees and to-do trees** visually: draggable cloud-shaped nodes, with the root at the top and
the branches growing downwards. It is a single file, [`index.html`](index.html): open it with a double click in
any browser. It works **offline** and sends nothing over the network, unless you turn on the optional
[Google Drive backup](#google-drive-backup).

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

## Folder backup

The **Folder** button keeps an automatic copy of all your trees in a folder you choose (for example one synced by
OneDrive or Dropbox). It keeps a single file, `todotree-backup.json`, always the latest version,
a few seconds after every change. In Chrome and Edge the browser writes the files itself; after a restart the button
turns amber and the next click anywhere allows the folder again.

In **Firefox** (and any browser without folder access) run `npm start`, open <http://localhost:5173> and type the full
path of the folder in the dialog: the local server writes the files, no extension or browser permission needed. The
chosen folder is remembered in `.backup-dir.json` (not committed). You can also set the `BACKUP_DIR` environment variable.

## Google Drive backup

The **☁ Drive** button backs your trees up to a `ToDoTree` folder in **your own** Google Drive, automatically after
every change (a few seconds after you stop editing), and lets you restore them later. The app asks only for the
`drive.file` permission: it can see the files it created itself and nothing else. The backup is one file,
`todotree-backup.json`, updated in place (Drive keeps its revision history). Restoring replaces your trees and can be
undone with `Ctrl+Z`.

Google sign-in does not work from a `file://` page, so for this feature serve the page over `http://localhost` (or
https) and create your own OAuth client once:

1. In the [Google Cloud Console](https://console.cloud.google.com/) create a project and **enable the Google Drive API**.
2. *APIs & Services → OAuth consent screen*: choose **External**, fill in the basics and add your own Google account
   under **Test users**.
3. *Credentials → Create credentials → OAuth client ID → Web application*. Under **Authorized JavaScript origins** add
   `http://localhost:5173` (and your https address if you host the page). No redirect URI is needed.
4. Copy the client ID (it ends with `.apps.googleusercontent.com`).
5. Run `npm start` and open <http://localhost:5173>. Click **☁ Drive**, paste the client ID, press **Connect**, sign in
   and tick **Back up automatically after every change**.

Good to know:

- Google access tokens last about an hour. When one expires, the Drive button turns amber and the next click anywhere in
  the app renews the sign-in (a small Google window may flash) and uploads whatever is waiting.
- The client ID is stored in your browser's `localStorage`; the access token is kept in memory only.
- Disconnecting stops the backups and revokes the token; the backup stays on your Drive.
- Everything else in the app keeps working offline; the Drive code only talks to Google after you connect it.

## Several trees on the same page

Every tree you create is shown **side by side on the same canvas**, so you can keep a whole workspace in view:

- **+ New** adds a tree next to the others and brings it into view; the list at the top jumps to a tree.
- Drag a tree's **root** to move the whole tree anywhere; trees push each other away like the nodes do.
- Drag any node **onto a node of another tree** to move it there (undo with `Ctrl+Z`).
- The "current" tree is the one you last worked in: **Delete** removes it, **Markdown** exports it.
- Untick **All trees** to see one tree at a time (the list then switches between them). The choice is remembered.

## Features

- **Smooth**: wheel zoom glides, *Fit* and search animate the view, and large trees stay fluid.
- **Bubble nodes**: nodes never overlap and push each other away like bubbles, even while you drag them.
- **Ceiling**: no node can go above the surface of the root.
- **Virtual 28 px grid** with snapping while dragging.
- **Vector graphics**: borders, text and links stay sharp at any zoom level.
- Multiple trees, undo/redo, search, "open only" filter, light/dark theme, touch support.
- **Backup**: export to JSON or Markdown and import from a file, or let the app back up to Google Drive by itself.

## Tests

You need Node.js and Chrome (or Edge, pointed to with `CHROME_PATH`).

```bash
npm install
npm test
```

`npm test` runs three Playwright suites:

- `tests/run.js`: a guided scenario (rename, drag, reattach, undo, search, zoom, saving, import…).
- `tests/folder.js`: the folder backup against a fake folder: choose, automatic copies, lost permission, stop.
- `tests/folder-server.js`: the same backup through the local server (the Firefox path), against the real `tools/serve.js`.
- `tests/drive.js`: the Google Drive backup against a fake Google sign-in and a fake Drive (no credentials needed):
  connect, automatic backups, expired sign-in, restore, offline, disconnect.
- `tests/fuzz.js`: random actions with invariant checks (no overlaps, no nodes above the ceiling, valid model,
  consistent undo/redo). Configurable with `FUZZ_SEEDS` and `FUZZ_STEPS`.

`npm run bench` measures frame times while dragging, zooming and panning big trees with a throttled CPU.

The tests also run on GitHub Actions on every push to `main`.

## Development notes

See [`DEVELOPMENT.md`](DEVELOPMENT.md): data model, structure of `index.html` and internal rules.

## License

Copyright © 2026 Jacopo Garau. **All rights reserved.** The code is visible for viewing purposes only; it may not
be copied, modified or distributed without written permission. See [`LICENSE`](LICENSE).
