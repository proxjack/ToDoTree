# Graph Report - ToDoTree  (2026-11-14)

## Corpus Check
- Corpus is ~20,101 words - fits in a single context window. You may not need a graph.

## Summary
- 275 nodes · 588 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Node actions and undo/redo
- Layout, bubbles and animation
- Google Drive backup
- Node card, dates and search
- CI workflow (test.yml)
- Docs, tests and CI overview
- Data model and persistence
- Import/export and Markdown format
- Guided test suite (run.js)
- Fuzz test suite (fuzz.js)
- package.json
- Drive test suite (drive.js)
- Local server (serve.js)
- npm scripts
- Benchmark (bench.js)
- Constraints
- Ideas not done yet
- License

## God Nodes (most connected - your core abstractions)
1. `render()` - 30 edges
2. `bindUI()` - 30 edges
3. `scheduleSave()` - 20 edges
4. `finishEdit()` - 17 edges
5. `driveRestore()` - 17 edges
6. `bindCard()` - 16 edges
7. `driveBackup()` - 16 edges
8. `tree()` - 16 edges
9. `commit()` - 15 edges
10. `layout()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Automatic saving plus JSON / Markdown backups` --references--> `scheduleSave()`  [INFERRED]
  DEVELOPMENT.md → index.html
- `Sibling order = step sequence; computed numbering 1, 1.1, 1.2` --references--> `index()`  [INFERRED]
  DEVELOPMENT.md → index.html
- `Node text written with textContent, never innerHTML` --references--> `updateNode()`  [INFERRED]
  DEVELOPMENT.md → index.html
- `dx/dy manual offsets added along the branch` --references--> `layout()`  [INFERRED]
  DEVELOPMENT.md → index.html
- `dx/dy manual offsets added along the branch` --references--> `freeDrop()`  [INFERRED]
  DEVELOPMENT.md → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Undoable model change pipeline (commit/mutate -> render -> scheduleSave)** — index_commit, index_mutate, index_pushhist, index_render, index_schedulesave [EXTRACTED 1.00]
- **Bubble layout and drag physics (layout, relax, relaxPass, bubbleLoop)** — index_layout, index_relax, index_relaxpass, index_bubbleloop, index_layout_constants [INFERRED 0.95]
- **Google Drive backup flow (token, folder, file, upload)** — index_drivebackup, index_gettoken, index_ensurefolder, index_findbackupfile, index_uploadbackup, index_drivefetch, index_backuphash [INFERRED 0.95]

## Communities (18 total, 3 thin omitted)

### Community 0 - "Node actions and undo/redo"
Cohesion: 0.11
Nodes (51): Interactions (keyboard, drag, reattach, tidy up), Node card (#card): details editor, Sibling order = step sequence; computed numbering 1, 1.1, 1.2, Undo/redo via JSON snapshots, abortGestures(), addNode(), addSibling(), applyDone() (+43 more)

### Community 1 - "Layout, bubbles and animation"
Cohesion: 0.10
Nodes (38): dx/dy manual offsets added along the branch, Bubbles and ceiling (layout, relax, bubbleLoop), CEIL ceiling: no node above y < CEIL, GRID 28 px snapping while dragging (Alt = free), Performance notes (cached sizes, paintKey, single-frame view updates), Repulsion priority (rank): root > manual nodes > automatic nodes; FROZEN locks, animateToTargets(), animateView() (+30 more)

### Community 2 - "Google Drive backup"
Cohesion: 0.12
Nodes (32): Upload only when the hash of the trees changed, Google Drive backup (optional), tools/serve.js local static server (npm start), authError(), backupHash(), backupText(), backupTrees(), bindDrive() (+24 more)

### Community 3 - "Node card, dates and search"
Cohesion: 0.13
Nodes (20): Search over title, tags and checklist items, addDays(), addItems(), addTag(), advanceRepeat(), bindCard(), buildSwatches(), cleanTag() (+12 more)

### Community 4 - "CI workflow (test.yml)"
Cohesion: 0.13
Nodes (14): jobs, test, name, on, pull_request, push, branches, run (+6 more)

### Community 5 - "Docs, tests and CI overview"
Cohesion: 0.22
Nodes (9): .github/workflows/test.yml CI workflow, Structure of index.html (commented script sections), Tests (Playwright), tests/bench.js frame-time benchmark, tests/drive.js Drive backup suite (Playwright routes as fake Google), tests/fuzz.js random-action invariant suite, tests/run.js guided scenario suite, Development notes (pointer to DEVELOPMENT.md) (+1 more)

### Community 6 - "Data model and persistence"
Cohesion: 0.23
Nodes (12): Data model (trees, nodes, view), clean(), CSS theme variables (light and dark), load(), mk(), normalize(), sample(), save() (+4 more)

### Community 7 - "Import/export and Markdown format"
Cohesion: 0.20
Nodes (9): Automatic saving plus JSON / Markdown backups, Markdown format @due ^start !priority #tag, Repeating leaf nodes (rep d/w/m), window.__trees debug hook, JSON backup and Markdown export handlers, parseMd(), toMd(), Backup: JSON / Markdown export and import, Drive backup (+1 more)

### Community 8 - "Guided test suite (run.js)"
Cohesion: 0.18
Nodes (5): { chromium }, fs, nodePath, os, path

### Community 9 - "Fuzz test suite (fuzz.js)"
Cohesion: 0.29
Nodes (10): check(), { chromium }, diff(), nodePath, outline(), rng(), run(), SEEDS (+2 more)

### Community 10 - "package.json"
Cohesion: 0.22
Nodes (9): author, description, devDependencies, playwright@^1.50.0, license, name, private, version (+1 more)

### Community 11 - "Drive test suite (drive.js)"
Cohesion: 0.20
Nodes (7): { chromium }, fakeDrive(), st, fs, html, indexPath, nodePath

### Community 12 - "Local server (serve.js)"
Cohesion: 0.25
Nodes (5): FILE, fs, http, path, PORT

### Community 13 - "npm scripts"
Cohesion: 0.33
Nodes (6): scripts, bench, start, test, test:drive, test:fuzz

### Community 14 - "Benchmark (bench.js)"
Cohesion: 0.33
Nodes (4): { chromium }, nodePath, SIZES, THROTTLE

## Knowledge Gaps
- **10 isolated node(s):** `stage wheel handler (zoom)`, `cloud-shaped .node CSS`, `Constraints`, `Sibling order = step sequence; computed numbering 1, 1.1, 1.2`, `Structure of index.html (commented script sections)` (+5 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 74 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `render()` connect `Node actions and undo/redo` to `Layout, bubbles and animation`, `Node card, dates and search`, `Import/export and Markdown format`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `stage wheel handler (zoom)`, `cloud-shaped .node CSS`, `Constraints` to the rest of the system?**
  _10 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Node actions and undo/redo` be split into smaller, more focused modules?**
  _Cohesion score 0.11178451178451178 - nodes in this community are weakly interconnected._
- **Why does `bindUI()` connect `Node actions and undo/redo` to `Layout, bubbles and animation`, `Google Drive backup`, `Node card, dates and search`, `Data model and persistence`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Layout, bubbles and animation` be split into smaller, more focused modules?**
  _Cohesion score 0.09743589743589744 - nodes in this community are weakly interconnected._
- **Why does `driveRestore()` connect `Google Drive backup` to `Node actions and undo/redo`, `Data model and persistence`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `Google Drive backup` be split into smaller, more focused modules?**
  _Cohesion score 0.11538461538461539 - nodes in this community are weakly interconnected._