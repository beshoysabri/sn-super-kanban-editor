# Building Standard Notes Editor Plugins

A comprehensive guide to building custom editors for Standard Notes (SN), based on real-world experience building the Super Kanban Editor.

## Architecture Overview

SN editors run inside an **iframe** embedded in the Standard Notes app. The editor communicates with the parent SN app via `window.postMessage()`. You can use **any JavaScript framework** (React, Vue, Svelte, vanilla JS, etc.).

Three approaches to build the communication layer:

| Approach | Complexity | Flexibility |
|----------|------------|-------------|
| **Custom postMessage** (recommended) | Medium | Full control |
| [`sn-extension-api`](https://github.com/nienow/sn-extension-api) | Low | Simple text editors |
| [`@standardnotes/component-relay`](https://github.com/standardnotes/component-relay) | Medium | Official, heavier |

This guide covers the custom approach since it gives you the best understanding and control.

## Project Structure

```
my-sn-editor/
  public/
    ext.json              # Plugin manifest (copied to dist/ on build)
  src/
    main.tsx              # Entry point
    App.tsx               # Main component (SN init + state management)
    lib/
      sn-api.ts           # postMessage protocol implementation
    styles.css            # CSS with --sn-stylekit-* fallback pattern
  .github/
    workflows/
      deploy.yml          # GitHub Pages auto-deploy
  package.json
  vite.config.ts          # base: './' for relative paths
```

## Step 1: The Plugin Manifest (`ext.json`)

Create `public/ext.json`:

```json
{
  "identifier": "com.yourname.my-editor",
  "name": "My Custom Editor",
  "content_type": "SN|Component",
  "area": "editor-editor",
  "version": "1.0.0",
  "description": "A custom editor for Standard Notes",
  "url": "https://yourname.github.io/my-editor/index.html",
  "latest_url": "https://yourname.github.io/my-editor/ext.json",
  "marketing_url": "https://github.com/yourname/my-editor"
}
```

### Key Fields

| Field | Required | Description |
|-------|----------|-------------|
| `identifier` | Yes | Reverse-domain unique ID |
| `name` | Yes | Display name in Extensions browser |
| `content_type` | Yes | `"SN\|Component"` for editors, `"SN\|Theme"` for themes |
| `area` | Yes | `"editor-editor"` for main editors, `"editor-stack"` for bottom panels |
| `version` | Yes | Semver string |
| `url` | Yes | URL to your `index.html` |
| `latest_url` | No | URL for auto-update checks |
| `download_url` | No | ZIP for desktop offline use |

## Step 2: The Communication Layer (`sn-api.ts`)

This is the most critical file. See [PROTOCOL-REFERENCE.md](./PROTOCOL-REFERENCE.md) for the full protocol details.

### Minimal Implementation

```typescript
type ContentCallback = (text: string) => void;

class SNEditorAPI {
  private sessionKey: string | null = null;
  private contentCallback: ContentCallback | null = null;
  private currentItem: any = null;
  private origin: string = '*';
  private registered = false;
  private sentMessages = new Map<string, { action: string; callback: (data: any) => void }>();
  private pendingSaveText: string | null = null;
  private pendingItemText: string | null = null;

  constructor() {
    // CRITICAL: Register IMMEDIATELY at module load, not in useEffect!
    window.addEventListener('message', this.handleMessage);
    document.addEventListener('message', this.handleMessage as EventListener);
  }

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    // Deliver buffered content if SN sent it before React mounted
    if (this.pendingItemText !== null) {
      callback(this.pendingItemText);
      this.pendingItemText = null;
    }
  }

  private handleMessage = (event: MessageEvent | Event) => {
    let data = (event as MessageEvent).data;
    // Mobile SN sends stringified JSON
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data?.action) return;

    switch (data.action) {
      case 'component-registered':
        this.sessionKey = data.sessionKey;
        this.origin = (event as MessageEvent).origin || '*';
        this.registered = true;
        // Load themes
        const urls = data.componentData?.activeThemeUrls || data.data?.activeThemeUrls || [];
        this.activateThemes(urls);
        this.postMessage('themes-activated', {});
        // Subscribe to note content
        this.postMessage('stream-context-item', {}, (responseData) => {
          const item = responseData?.item || responseData?.items?.[0];
          if (item?.content && !item.isMetadataUpdate) {
            this.setItem(item);
          }
        });
        break;

      case 'themes':
        this.activateThemes(data.data?.themes || []);
        break;

      default:
        // Match replies by original.messageId
        if (!data.original) return;
        const sent = this.sentMessages.get(data.original.messageId);
        if (!sent) return;
        if (sent.action === 'stream-context-item') {
          sent.callback(data.data); // keep alive — reused on note switch
        } else {
          this.sentMessages.delete(data.original.messageId);
        }
    }
  };

  private setItem(item: any) {
    this.currentItem = item;
    const text = item.content.text || '';
    if (this.contentCallback) {
      this.contentCallback(text);
    } else {
      this.pendingItemText = text;
    }
    // Flush queued saves
    if (this.pendingSaveText !== null) {
      const t = this.pendingSaveText;
      this.pendingSaveText = null;
      this.saveText(t);
    }
  }

  saveText(text: string) {
    if (!this.currentItem) {
      this.pendingSaveText = text;
      return;
    }
    this.currentItem = {
      ...this.currentItem,
      content: { ...this.currentItem.content, text, preview_plain: text.substring(0, 90) },
    };
    this.postMessage('save-items', { items: [this.currentItem] });
  }

  private postMessage(action: string, data: any, callback?: (d: any) => void) {
    const messageId = crypto.randomUUID();
    if (callback) this.sentMessages.set(messageId, { action, callback });
    if (!this.registered) return;
    const target = window.parent !== window ? window.parent : window;
    try {
      target.postMessage({ action, data, messageId, sessionKey: this.sessionKey, api: 'component' }, this.origin);
    } catch {
      target.postMessage({ action, data, messageId, sessionKey: this.sessionKey, api: 'component' }, '*');
    }
  }

  private activateThemes(urls: string[]) {
    document.querySelectorAll('link[data-sn-theme]').forEach(el => el.remove());
    for (const url of urls) {
      if (!url) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-sn-theme', 'true');
      document.head.appendChild(link);
    }
  }

  destroy() {
    // Only clear callback — keep listeners alive on the singleton
    this.contentCallback = null;
    this.pendingItemText = null;
  }
}

export const snApi = new SNEditorAPI();
```

## Step 3: App Integration

```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { snApi } from './lib/sn-api';

function App() {
  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const isInsideSN = useRef(window.parent !== window);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInsideSN.current) {
      document.body.classList.add('sn-embedded');
      const timeout = setTimeout(() => setLoaded(true), 4000); // fallback

      snApi.initialize((text: string) => {
        clearTimeout(timeout);
        setContent(text);
        setLoaded(true);
      });

      return () => {
        clearTimeout(timeout);
        snApi.destroy();
      };
    } else {
      // Standalone mode — use localStorage
      setContent(localStorage.getItem('my-editor-content') || '');
      setLoaded(true);
    }
  }, []);

  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);
    if (isInsideSN.current) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => snApi.saveText(newContent), 300);
    } else {
      localStorage.setItem('my-editor-content', newContent);
    }
  }, []);

  if (!loaded) return <div>Loading...</div>;
  return <MyEditor content={content} onChange={handleChange} />;
}
```

## Step 4: Theme-Aware CSS

See [CSS-VARIABLES.md](./CSS-VARIABLES.md) for the complete variable reference.

```css
:root {
  /* Use fallback syntax — SN's values take precedence when present */
  --my-bg: var(--sn-stylekit-background-color, #1a1a1f);
  --my-fg: var(--sn-stylekit-foreground-color, #e4e4e7);
  --my-border: var(--sn-stylekit-border-color, #27272a);
  --my-accent: var(--sn-stylekit-info-color, #6366f1);
}

body {
  font-family: var(--sn-stylekit-font-family, sans-serif);
  color: var(--my-fg);
  background: var(--my-bg);
}

/* Transparent background when inside SN */
body.sn-embedded {
  background: transparent;
}
```

**Important**: Do NOT declare `--sn-stylekit-*` variables in your CSS. SN injects those into the iframe. If you declare them, your values override SN's theme.

## Step 5: Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // CRITICAL: relative paths for GitHub Pages
});
```

## Step 6: GitHub Pages Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: write
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Step 7: Install in Standard Notes

1. Push to GitHub, wait for Actions to deploy
2. Open Standard Notes > Preferences > Plugins
3. Scroll to "Install Custom Plugin"
4. Paste: `https://yourname.github.io/my-editor/ext.json`
5. Press Enter

## Local Development

```bash
npm run dev  # Vite dev server on localhost:5173
```

Create a `local-ext.json` for testing:
```json
{
  "identifier": "com.yourname.my-editor-dev",
  "name": "My Editor (Dev)",
  "content_type": "SN|Component",
  "area": "editor-editor",
  "version": "1.0.0",
  "url": "http://localhost:5173"
}
```

Use a **different identifier** for dev so you can have both installed simultaneously.

## Data Storage

SN editors store data as the `text` field of a Note item. For complex data:

- **Option A**: Store as markdown/plain text (human-readable in other editors)
- **Option B**: Store as JSON string (parse on load, stringify on save)
- **Option C**: Custom text format with metadata (e.g., `@key: value` headers)

Always generate a meaningful `preview_plain` so the note list shows useful info.

## Further Reading

- [PROTOCOL-REFERENCE.md](./PROTOCOL-REFERENCE.md) — Full postMessage protocol details
- [CSS-VARIABLES.md](./CSS-VARIABLES.md) — Complete SN theme CSS variable reference
- [GOTCHAS.md](./GOTCHAS.md) — Critical pitfalls and how to avoid them
