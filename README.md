# Super Kanban Editor for Standard Notes

A modern, fully-featured Kanban board editor plugin for [Standard Notes](https://standardnotes.com). Organize your notes as Kanban boards with drag-and-drop, color labels, due dates, comments, and full theme support.

**Live:** [beshoysabri.github.io/sn-super-kanban-editor](https://beshoysabri.github.io/sn-super-kanban-editor/)

---

## Features

### Board & List Views
- **Kanban Board** — horizontal scrollable lanes with drag-and-drop cards between columns
- **List View** — grouped, collapsible card list with drag-and-drop between groups
- Toggle between views instantly; your preference is saved per note

### Cards
- Title, description, and label with custom color (8 presets + hex color picker)
- Due dates with smart formatting — "Overdue", "Today", "Tomorrow", "In 3d", etc.
- Color-coded urgency badges (red/yellow/orange/blue/gray)
- Comments system — add and delete comments per card
- Notion-style tinted cards based on label color

### Lanes / Groups
- Add, rename, delete, and duplicate lanes
- Lane accent colors
- Drag-and-drop to reorder lanes (board view)
- Card count per lane

### Board
- Editable board title and description
- Board statistics (columns and card count)
- Empty state with quick-start options ("Create Default Board" or "Start Empty")

### Standard Notes Integration
- Full theme support — automatically adapts to any SN theme (light or dark)
- Data persists as markdown inside your SN note
- Works on **desktop**, **web**, and **mobile** SN clients
- Offline fallback via localStorage when running standalone
- Debug panel (`Ctrl+Shift+D`) for troubleshooting SN communication

---

## Screenshots

| Board View | List View |
|:---:|:---:|
| Drag-and-drop kanban columns | Grouped collapsible list with drag-and-drop |

| Card Editor | Theme Support |
|:---:|:---:|
| Full card modal with all fields | Adapts to any SN theme automatically |

---

## Installation in Standard Notes

### From URL (Recommended)

1. Open **Standard Notes**
2. Go to **Preferences** > **General** > **Advanced Settings** > **Install Custom Plugin**
3. Paste the following URL:
   ```
   https://beshoysabri.github.io/sn-super-kanban-editor/ext.json
   ```
4. Click **Install**
5. Open any note, click the **Editor** selector, and choose **Super Kanban Editor**

### From Source

1. Clone and build (see [Development](#development) below)
2. Deploy the `dist/` folder to any static host
3. Update `public/ext.json` with your hosted URL
4. Install using your custom `ext.json` URL

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22 recommended)
- npm

### Setup

```bash
git clone https://github.com/beshoysabri/sn-super-kanban-editor.git
cd sn-super-kanban-editor
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

### Local Development with Standard Notes

1. Run `npm run dev` — Vite starts at `http://localhost:5173`
2. In Standard Notes, install a custom plugin with a local `ext.json`:
   ```json
   {
     "identifier": "com.yourname.kanban-dev",
     "name": "Kanban (Dev)",
     "content_type": "SN|Component",
     "area": "editor-editor",
     "version": "1.0.0",
     "url": "http://localhost:5173/index.html"
   }
   ```
3. Changes hot-reload instantly in the SN editor pane

> **Tip:** Use a different `identifier` for dev vs production so both can be installed simultaneously.

---

## Deployment

### GitHub Pages (Automated)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys to GitHub Pages on every push to `main`.

**Setup:**
1. Go to your repo **Settings** > **Pages**
2. Set **Source** to **GitHub Actions**
3. Push to `main` — the site deploys automatically

### Manual Deployment

```bash
npm run build
# Upload the contents of dist/ to any static host
```

Update the `url` and `latest_url` fields in `public/ext.json` to match your hosting URL.

---

## Project Structure

```
src/
  components/
    KanbanBoard.tsx      # Main board orchestrator and state management
    KanbanLane.tsx       # Lane with context menu and color picker
    KanbanCard.tsx       # Card with metadata badges
    CardModal.tsx        # Full card editor modal
    BoardHeader.tsx      # Title, description, stats, view toggle
    ListView.tsx         # List view with drag-and-drop groups
  lib/
    sn-api.ts            # Standard Notes postMessage API layer
    markdown.ts          # Markdown serialization/deserialization
    colors.ts            # Color palette and hex mapping
    dates.ts             # Due date formatting
  types/
    kanban.ts            # TypeScript interfaces
  App.tsx                # Root component, SN integration, localStorage fallback
  styles.css             # Complete theme-aware styling
  main.tsx               # Entry point
public/
  ext.json               # SN plugin manifest
docs/
  PLUGIN-DEVELOPMENT-GUIDE.md   # How to build SN plugins from scratch
  PROTOCOL-REFERENCE.md         # Full SN postMessage protocol spec
  CSS-VARIABLES.md              # Complete SN theme variable reference
  GOTCHAS.md                    # 20 critical pitfalls and best practices
```

---

## Data Format

Board data is stored as markdown inside the SN note, making it human-readable even outside the plugin:

```markdown
@title: My Project Board
@description: Sprint planning
@view: board

# To Do [color:blue]
* Design homepage
  * Description: Create wireframes and mockups
  * Label: Design
  * LabelColor: purple
  * DueDate: 2026-03-15
  * Comments:
    * Check competitor sites for inspiration
    * Use Figma for mockups

# In Progress [color:orange]
* Build API endpoints
  * Label: Backend
  * LabelColor: green

# Done [color:green]
* Setup CI/CD pipeline
```

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [React](https://react.dev/) 19 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) 5.9 | Type safety |
| [Vite](https://vite.dev/) 7 | Build tool and dev server |
| [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) | Drag-and-drop (maintained fork of react-beautiful-dnd) |
| [uuid](https://github.com/uuidjs/uuid) | Card/lane ID generation |

---

## Theme Support

The editor automatically adapts to any Standard Notes theme by reading SN's injected CSS variables (`--sn-stylekit-*`). No manual theme switching needed.

When running standalone (outside SN), it defaults to a dark theme.

See [docs/CSS-VARIABLES.md](docs/CSS-VARIABLES.md) for the full variable reference.

---

## Documentation

Comprehensive documentation for building Standard Notes plugins is included in the `docs/` folder:

- **[Plugin Development Guide](docs/PLUGIN-DEVELOPMENT-GUIDE.md)** — Step-by-step guide to building an SN editor plugin from scratch
- **[Protocol Reference](docs/PROTOCOL-REFERENCE.md)** — Full postMessage protocol specification with flow diagrams
- **[CSS Variables](docs/CSS-VARIABLES.md)** — Complete reference of 50+ SN theme CSS variables
- **[Gotchas & Best Practices](docs/GOTCHAS.md)** — 20 critical pitfalls and how to avoid them

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT

---

## Credits

Originally forked from [corvec/sn-kanban-editor](https://github.com/corvec/sn-kanban-editor). Rebuilt with modern React 19, full drag-and-drop, theme support, and mobile compatibility.
