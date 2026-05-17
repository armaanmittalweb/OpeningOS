# OpeningOS — Feature Guide

**Your personal operating system for chess openings.**  
Build your repertoire, understand every critical position, and practice only what matters.

---

## Getting Started

### First Run
1. Open `http://localhost:4173/index.html` (or your deployed URL).
2. A **"Who's training today?"** modal appears.
3. Enter your name, choose a role (Player / Coach / Student), click **Create profile**.
4. You land on the **Today** dashboard — **empty by design**. Your profile starts with no lines, no games, no SRS state. The dashboard offers four ways to start:
   - **Choose a starter repertoire** (recommended) → opens the Library
   - **Import a PGN** → wizard for paste / Lichess / Chess.com
   - **Pull from Lichess or Chess.com** → fetch your real games
   - **Add a line by hand** → Repertoire view, manual entry

### Quick keyboard shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+K` / `⌘K` | Open command palette |
| `1` `2` `3` `4` | Grade a practice card (Again / Hard / Good / Easy) |
| `H` | Show next hint during practice |
| `Space` | Continue (same as Good) after grading |
| `N` | Note reminder (opens repertoire) |

---

## Navigation

The top bar has six primary views:

| View | Purpose |
|------|---------|
| **Today** | Daily command center — what to do right now |
| **Repertoire** | Build, edit, and browse your opening lines |
| **Practice** | Drill positions with spaced repetition |
| **Games** | Import real games and find deviations |
| **Library** | Curated starter courses and model games |
| **Insights** | Coverage map, weak positions, analytics |

Additional views accessible via the command palette or top-right icons:
- **Settings** (gear icon) — appearance, board, accessibility, privacy
- **Coach** — student dashboard and assignments
- **Opponent Prep** — analyze a specific opponent's habits

---

## Profiles

OpeningOS supports multiple profiles on the same device. Each profile has its own repertoire, SRS progress, notes, games, and settings.

### Create a profile
- Click the **avatar circle** (top-right) → **Create new profile**
- Or: first-run modal on a fresh install

### Switch profiles
- Click the avatar → select any profile from the list

### Rename / Delete
- Click the avatar → **Rename current profile** or **Delete current profile**

### Sign out
- Click the avatar → **Sign out (clears local data)**  
  ⚠️ This removes all profiles and data from this device.

---

## Today Dashboard

The dashboard answers one question: **"What should I do now?"**

| Card | What it shows |
|------|--------------|
| **Today's practice** | Number of positions due, estimated time, focus line. Click to start. |
| **Repertoire health** | Stability % per line. Click to view the coverage map. |
| **Recent game** | Last deviation found in an imported game. Click to fix it. |
| **Drill weak lines** | Positions with high miss rate. Click to drill immediately. |
| **Repertoire summary** | Total lines and positions. Buttons to import or open. |

When **Tournament mode** is active (trophy icon), the dashboard hides new-theory cards and focuses on confidence.

---

## Repertoire

### Structure
Your repertoire is organized into folders:
- **White repertoire** — lines you play as White
- **Black vs 1.e4** — responses to king-pawn openings
- **Black vs 1.d4** — queen-pawn and Indian defenses

Each line has a **label** (Must know / Nice to know / Surprise weapon / etc.) and a **line quality score** (0–100) shown as a ring in the header.

### Navigating a line
1. Click any line in the left folder tree.
2. The board shows the starting position.
3. Click **Next ▶** / **◀ Prev** to step through moves, or click any move in the move tree.
4. The **idea card** (right panel) updates at each prep position showing:
   - The repertoire move
   - Idea, Plan, Memory hook, Common mistake
   - **"Also occurs in"** — transposition links to other lines that reach the same position

### Adding a line
- Click **Add line** at the bottom of the folder tree.
- Or import via PGN / Lichess / Chess.com (see Import section).

### Board annotations (arrows & circles)
- **Right-click drag** from one square to another → green arrow
- **Right-click click** on a square → green circle
- Hold **Shift** while right-clicking → red
- Hold **Alt** → blue
- Hold **Ctrl** → yellow
- Annotations are saved per position and cleared when you make a real move.

### Notes
Each position has a notes panel (right sidebar):
1. Choose a **note type**: Idea / Warning / Memory hint / Plan / Tactical / Coach
2. Type your note (supports **Markdown** — see below)
3. Click **Preview** to render the markdown
4. Click **History (N)** to see previous versions and restore any of them
5. Add **tags** by clicking chips like `#pawn-break`, `#trap`, `#must-know`

#### Markdown in notes
| Syntax | Result |
|--------|--------|
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `code` |
| `[text](url)` | link |
| `- item` | bullet list |
| `1. item` | numbered list |
| `# Heading` | heading |

### Progress bar
At the bottom of the Repertoire view, colored squares show each prep position's health:
- 🟢 Green = stable
- 🟡 Amber = learning
- 🔴 Red = weak / needs review

Click any square to jump to that position.

---

## Practice

### Before you start
The pre-session screen shows:
- Cards due, estimated time, weak count
- **Focus line** (the line with the most due cards)
- **Mode picker** — choose how you want to drill

### Practice modes
| Mode | Description |
|------|-------------|
| **Daily review** | Cards due today, default mode |
| **Weak only** | Positions with high miss rate |
| **Learn new** | Shows the idea card first, then asks you to play the move |
| **Blind recall** | No hints at all — tournament prep |
| **Speed drill** | 8 seconds per move; auto-fails on timeout |
| **Classical** | After a correct move, asks a concept question ("Why this move?") |
| **Warmup** | 5 must-know cards only — pre-game confidence pass |

### During a session
1. A position appears on the board.
2. **Play your repertoire move** by clicking/dragging pieces.
3. Feedback appears:
   - ✅ **Correct** — shows the idea behind the move
   - ❌ **Wrong** — shows your move vs the prepared move

### After feedback
**If correct:**
- Show full line
- Add note
- "I guessed — review sooner" (downgrades the card)

**If wrong:**
- Try again (resets the board to the position)
- Accept as alternate
- Compare moves
- Mark as confusing

### Grading (SRS)
After seeing feedback, grade the card:
| Key | Grade | Meaning |
|-----|-------|---------|
| `1` | Again | Forgot — review in 10 minutes |
| `2` | Hard | Remembered with effort — review in 12 hours |
| `3` | Good | Knew it — review in days |
| `4` | Easy | Automatic — review in weeks |

### Hints
Press `H` to reveal hints one step at a time:
1. Strategic hint ("Prepare the …c5 break")
2. Piece hint ("Move a pawn")
3. Square hint ("The move targets d5")
4. Full move revealed

Using a hint downgrades the card's grade automatically.

### Session complete
Shows correct/total, percentage, minutes spent, and how many cards are still due.

---

## Games

### Import games
Click **Import PGN** (top-right of Games view) to open the import wizard.

**Three source tabs:**

**1. Paste PGN**
- Paste any PGN text (single game or multi-game bundle)
- Click **Parse PGN** — the wizard validates every move through chess.js
- If a move is illegal, you get a clear error with the ply number

**2. Lichess username**
- Enter any public Lichess username
- Choose how many games (1–50)
- Click **Fetch games** — calls the Lichess API directly from your browser

**3. Chess.com username**
- Enter any public Chess.com username
- Fetches from the monthly archive API

**After fetching:**
- Choose a game from the list (if multiple)
- Choose import mode: **Line** / **Games** / **Both**
- Choose your color (Auto / White / Black)
- Anti-overload warning appears if the import is large
- Click **Import**

### Deviation detection
After import, each game is compared against your repertoire:
- **"you @ N"** pill = you deviated on move N
- **"opp @ N"** pill = opponent played an uncovered move on move N
- **"on book"** pill = game stayed in your prep

### Game detail
Click any game to see:
- Full PGN in monospace
- **Opening Review** section with deviation cards showing:
  - Prepared move (green) vs played move (red)
  - Buttons: **Practice this position** / **Add as alternate** / **Ignore sideline** / **Open in repertoire**

---

## Library

### Starter repertoires
Six curated courses are available:
- London System (Beginner)
- Caro-Kann for Black (Club)
- Italian Game (Club)
- King's Indian for Black (Advanced)
- French Defence (Club)
- Sicilian Najdorf (Advanced)

Each card shows: level, author, ECO code, lines/positions count, estimated learning time, tags, and star rating.

### Clone a course
Click **Clone into mine** — this creates a real line in your active profile's repertoire using the course's mainline moves. You can then edit it, add notes, and practice it.

### Preview
Click **Preview** to see full course details before cloning.

### Model games
Three instructive master games are listed below the courses. Click **View details** to open the reference card and jump to the related repertoire line.

---

## Insights

### Metric cards
Four top-level numbers:
- **Stable positions** — positions with high stability and no lapses
- **Due now** — cards ready for review (with weak count)
- **Real-game relevance** — imported games and deviations found
- **Theory bloat** — % of positions never practiced (lower is better)

### Repertoire map tabs

**Coverage** — one colored square per prep position:
- 🟢 Strong (stability ≥ 5, no lapses)
- 🟡 Medium (learning)
- 🔴 Weak (lapses ≥ 2 or low stability)
- Click any square to jump to that position in Repertoire

**Tree** — text tree of all lines with color-coded moves:
- Red = weak position
- Amber = due for review
- Normal = stable

**Table** — per-line summary:
| Column | Meaning |
|--------|---------|
| Due | Cards due now |
| Weak | High-miss-rate positions |
| Real games | Times this line appeared in imported games |
| Confidence | % of positions stable |
| Quality | Line quality score (0–100) |

Click any row to open that line in Repertoire.

**Timeline** — chronological log of events (lines added, deviations found, positions stabilized, etc.)

### Weakest positions table
Lists the 8 most problematic positions with lapses, miss %, and last-seen date. Click any row to jump to it.

---

## Coach Mode

Access via the command palette (`Ctrl+K` → "Coach mode") or the URL `#coach`.

### Dashboard
- 4 KPI cards: active students, assignments due, avg completion, weakest topic
- Student table with name, rating, completion bar, weak line, last-seen

### Assigning work
1. Click **Assign** next to a student
2. Choose a **line** from your repertoire
3. Choose a **practice mode** (Learn + Review / Daily / Blind recall / Speed drill)
4. Set a **due date** (Tomorrow / Sunday / Next week / No deadline)
5. Add an optional **message** (e.g. "Focus on the …c5 break")
6. Click **Send assignment**

Assignments appear in the **Recent assignments** table below the student list. Click **Remove** to delete one.

---

## Opponent Prep

Access via `Ctrl+K` → "Opponent prep" or URL `#opponent`.

1. Choose source: **Lichess** / **Chess.com** / **PGN**
2. Enter the opponent's username
3. Click **Analyze games**
4. The report shows:
   - Their opening habits as White and vs your openings
   - A frequency + your-confidence table for each likely line
   - A **35-minute prep plan** with time-boxed tasks
   - An **anti-overprep warning** for rare lines

Click **Add plan to today** to surface the prep tasks on your Today dashboard.

---

## Settings

Access via the gear icon (top-right) or `Ctrl+K` → "Settings".

### Appearance
| Setting | Options |
|---------|---------|
| Light theme | Toggle (dark by default) |
| High contrast | Toggle (for low-vision use) |
| Font size | Small / Normal / Large |

### Board
| Setting | Options |
|---------|---------|
| Show coordinates | Toggle (on by default) |
| Notation | SAN / LAN / Figurine |
| Board size | Small / Medium / Large |
| Piece set | Classic / Merida / Wood |

### Practice
| Setting | Options |
|---------|---------|
| Sound effects | Toggle (off by default) |
| Reveal answer on wrong move | Toggle |
| Default mode | Daily / Weak only / Classical |

### Accessibility
| Setting | Options |
|---------|---------|
| Reduced motion | Toggle (disables all animations) |
| Screen-reader move announcements | Toggle |
| Color-blind safe statuses | Toggle (adds shapes alongside colors) |

### Privacy
- All data is **private by default** and stored only in this browser
- AI summaries: off by default
- Shared studies via link: off by default

### Data
- **Export everything** — downloads `openingos-export.json` with all repertoires, SRS state, and notes
- **Reset demo data** — wipes local progress and reseeds the demo repertoire

---

## Tournament Mode

Click the **trophy icon** (top-right) to toggle tournament mode.

**What changes:**
- Today dashboard hides "new theory" cards
- Practice pre-session hides Learn-new and Classical modes
- A warm amber banner appears at the top of Today
- Review queue prioritizes must-know and weak critical positions

**To exit:** click the trophy icon again, or click **Exit** on the banner.

---

## PWA — Install as an App

OpeningOS is a Progressive Web App. When served over HTTPS:
- Chrome/Edge: click the **install icon** in the address bar
- Safari (iOS): tap Share → **Add to Home Screen**
- The app works **offline** after first load (service worker caches all static assets)

---

## Tips & Tricks

- **Right-click drag** on the board to draw arrows; right-click a square for a circle. Modifiers: Shift=red, Alt=blue, Ctrl=yellow.
- **Transpositions**: if a position appears in multiple lines, the idea card shows "Also occurs in" links.
- **Note history**: every time you edit a note, the previous version is saved. Click "History (N)" to restore any version.
- **Anti-overload**: the import wizard warns you when an import would create a heavy review load.
- **Line quality score**: the ring in the Repertoire header (0–100) rewards having idea notes, low miss rate, real-game appearances, and a sensible line length.
- **Speed drill**: if you don't move within 8 seconds, the card is auto-failed and scheduled for immediate review.
- **Classical mode**: after a correct move, you're asked a concept question ("What's the strategic theme?"). Getting it right proves you understand, not just memorize.

---

## What Needs a Backend (for multi-device sync)

OpeningOS is fully client-side. Everything is stored in your browser's `localStorage`. This means:

| Works now | Needs a backend |
|-----------|----------------|
| Multiple profiles on one device | Sync across devices |
| Full offline use | Real coach ↔ student linking |
| PWA install | Account-based login |
| Export to JSON | Automatic cloud backup |

To add cloud sync: connect a Supabase project and wrap the `OOSProfiles.save`/`load` calls to dual-write. The data model is already clean for this.

---

## Honest Status: What's Still Incomplete

Things shipped but with some rough edges:

- **PGN parser** handles tags, comments, NAGs, variations, and result markers. Nested variation drilling exists in the parsed object but isn't exposed in the UI yet — the import wizard flattens to mainline only.
- **Notation choice** in Settings (SAN / LAN / Figurine) saves but doesn't yet reflect across the move tree (always renders SAN).
- **Board size** and **piece set** Settings persist but the board only renders the Unicode classic set right now.
- **Markdown** in notes supports bold/italic/code/lists/links/headings only. No images, tables, or arrows-on-diagrams syntax yet.
- **Insights timeline** now derives from real activity (lines added, games imported, assignments) but doesn't capture practice grading events yet.
- **Onboarding wizard** captures answers (goal/level/openings) but doesn't auto-pre-clone a suggested course based on them.
- **Anti-overload** warning fires above 30 games or 60 plies — fixed thresholds, not personalized to your existing review queue.

Things deliberately out of scope without a backend:

- **Real cloud sync across devices.** Connect Supabase or similar and dual-write `OOSProfiles.save` to your DB.
- **Real coach ↔ student linking.** Coach mode tracks student records locally; the actual student installs OpeningOS on their device for their own profile. A backend would let assignments flow between them.
- **Stockfish engine sanity check.** Skeleton plan: load `stockfish.js` as a Web Worker, send `position fen … / go depth 12`, parse `info depth … cp …` and `bestmove`. ~150 LOC. Heavy WASM (~2MB) so kept off until you opt-in.
- **Multiple piece sets** beyond Unicode (Cburnett SVG paths add ~50KB).
- **Lichess opening explorer / novelty tracker.** The endpoint is wired in `js/api.js` (`OOSApi.lichessExplorer`) but no UI surface uses it yet.
- **Sound effects** library is bare-bones synth tones; real chess piece sounds would need bundled audio assets.

---

## What's in the Box (final feature list)

This list is honest. Anything not labeled **Real** is either deferred or
needs a backend — see [`BACKEND_MIGRATION.md`](./BACKEND_MIGRATION.md).

| Area | Feature | Status |
|------|---------|--------|
| **Profiles** | Multi-profile registry, per-profile namespaced storage | Real (local) |
| | Create / switch / rename / delete / sign out | Real (local) |
| | First-run profile prompt | Real |
| **Repertoire** | Empty folder tree (White / Black-vs-e4 / Black-vs-d4 / flank) | Real |
| | Line editor with board + move tree + idea card + notes | Real |
| | Line quality score (0–100 ring) | Real |
| | Label tags (must-know / nice-to-know / surprise / avoid / investigate / coach / tournament) | Real |
| | Position graph with transposition lookup (FEN normalized: piece+side+castling+ep) | Real |
| | "Also occurs in" links in idea card | Real |
| | Right-click arrows + circles (green / red / yellow / blue) | Real |
| | Notes with 6 types, tag chips, debounced save (800ms), Markdown preview, version history | Real |
| | Manual line creation wizard (4 steps: Details → Moves → Review → Save) | Real |
| | PGN import (paste / Lichess / Chess.com tabs, illegal-move blocked unless opted in) | Real |
| | Library clone — real line creation in your repertoire | Real |
| **Practice** | 7 modes: Daily / Weak / Learn-new / Blind / Speed / Classical / Warmup | Real |
| | "Learn new" filters to cards with reps === 0 only | Real |
| | "Warmup" falls back to stable cards when no must-know lines exist | Real |
| | FSRS-lite SRS at position level | Real |
| | Skip persists "Again" to SRS state | Real |
| | Move evaluation: SAN match + alternates + resulting-FEN match | Real |
| | Wrong moves recorded for review-pattern detection | Real |
| | Hint ladder (4 levels) — using a hint downgrades the grade | Real |
| | Post-correct buttons (Show full / Add note / I guessed) | Real |
| | Post-wrong buttons (Try again / Accept as alternate / Compare moves / Mark confusing) | Real |
| | Concept question in Classical mode | Real |
| | 8s timer in Speed mode | Real |
| **Games** | Import wizard: paste / Lichess username / Chess.com username | Real |
| | Full PGN parser (tags, comments, line comments, NAGs, variations, results) | Real |
| | Deviation detection (compares against your saved line) | Real |
| | Unmatched games show "Create line from this game" + "Match to existing" | Real |
| | Opponent name correctly flips with your color (was hardcoded to Black) | Real |
| | Repair flow: Practice this position / Add alternate / Ignore / Open | Real |
| **Library** | 6 curated starter repertoires | Reference content |
| | 3 model games | Reference content with detail cards |
| | "Clone into mine" creates a real line | Real |
| **Insights** | 4 metric cards from live state | Real |
| | Coverage map (one cell per position) | Real |
| | Tree / Table / Timeline tabs | Real |
| | Weakest positions table | Real |
| **Coach** | Add / remove students, manage assignments | Local-only |
| | Real coach↔student syncing across devices | Requires backend |
| **Opponent Prep** | Lichess / Chess.com / PGN fetch + analysis | Real |
| | ECO-bucketed frequency table | Real |
| | Your-confidence per opening computed from your repertoire health | Real |
| | 35-min plan generator | Real |
| | Save profile actually persists state.opponentReports (last 10) | Real |
| **Settings** | Theme toggle, high contrast, reduced motion, font size | Real |
| | Coords toggle, sound, privacy default | Real |
| | Notation choice (SAN / LAN / Figurine) — saved | Local-only preference |
| | Piece set (Classic / Merida / Wood) — saved and lightly styled | Real |
| | Board size — saved and applied through layout variables | Real |
| | Full backup export / Import backup / Reset profile data | Real |
| **Tournament Mode** | Toggle, banner, mode-picker filtering | Real |
| **PWA** | Bundled chess.js, manifest.json, service worker oos-v3-real-product | Real (offline-capable) |
| **Mobile** | FAB + bottom-sheet (≤720px) | Real |
| **Empty states** | Today / Repertoire / Practice / Games / Insights / Coach | Real |
| **Command palette** | Cmd+K with arrow keys + fuzzy filter | Real |
| **Keyboard shortcuts** | 1-4 grade / H hint / N note / Space continue | Real |
| **Markdown** | Safe DOM-builder renderer (no innerHTML on user data; URL allowlist) | Real |

### Status legend

- **Real** — built and persisted; you can rely on it.
- **Local-only** — works on this device for this profile; needs a backend to sync.
- **Reference content** — curated, not your data; safe to keep across profiles.
- **Requires backend** — out of scope for the client-only build. See
  `BACKEND_MIGRATION.md`.

---

---

*OpeningOS — built as a deployable client-only chess preparation tool.*  
*All data stays in your browser. No account required.*
