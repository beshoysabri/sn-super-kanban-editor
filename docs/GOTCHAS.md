# Standard Notes Plugin Gotchas & Best Practices

Critical pitfalls discovered while building SN editor plugins, and how to avoid them.

## 1. Register Message Listeners at Module Load, NOT in React Lifecycle

**The #1 cause of "empty editor" bugs.**

SN sends `component-registered` the moment the iframe loads — often before React mounts. If your listener is registered in `useEffect`, you miss the message entirely.

```typescript
// BAD — misses component-registered on fast SN delivery
useEffect(() => {
  window.addEventListener('message', handler); // too late!
}, []);

// GOOD — singleton registers at import time
class SNEditorAPI {
  constructor() {
    window.addEventListener('message', this.handleMessage);
    document.addEventListener('message', this.handleMessage as EventListener);
  }
}
export const snApi = new SNEditorAPI(); // runs at import, before React
```

Use a **pending buffer** pattern: if SN delivers content before your React callback is set, store it and replay when `initialize()` is called.

```typescript
initialize(callback: ContentCallback) {
  this.contentCallback = callback;
  if (this.pendingItemText !== null) {
    callback(this.pendingItemText);
    this.pendingItemText = null;
  }
}
```

## 2. Never Declare `--sn-stylekit-*` Variables in Your CSS

**Causes theme to stop working entirely.**

SN themes inject `--sn-stylekit-*` variables into your iframe via linked stylesheets. If you declare the same variables in your own CSS, your values **override** theirs because of specificity or load order.

```css
/* BAD — overrides whatever SN injects */
:root {
  --sn-stylekit-background-color: #1a1a1f;
  --sn-stylekit-foreground-color: #e4e4e7;
}

/* GOOD — map to your own tokens with fallbacks */
:root {
  --my-bg: var(--sn-stylekit-background-color, #1a1a1f);
  --my-fg: var(--sn-stylekit-foreground-color, #e4e4e7);
}
```

The fallback value (after the comma) is used only when the variable is undefined — i.e., standalone mode outside SN. When inside SN, the theme's injected values take precedence automatically.

## 3. Don't Use `@media (prefers-color-scheme)` for Theme Detection

SN themes are independent of the OS color scheme. A user can have OS dark mode on but use an SN light theme (or vice versa). Media queries will give the wrong answer.

Instead, rely entirely on `--sn-stylekit-*` CSS variables. They always reflect the active SN theme regardless of OS settings.

If you absolutely need to branch logic by theme type, use:
```css
/* SN sets this variable on theme load */
--sn-stylekit-theme-type: "light" | "dark";
```

## 4. The `stream-context-item` Callback is Permanent

When you send `stream-context-item`, SN replies with the current note. But it also **reuses the same `original.messageId`** every time the user switches notes. Your callback for this message must never be deleted.

```typescript
// In your reply handler:
if (sent.action === 'stream-context-item') {
  sent.callback(data.data);
  // DO NOT delete from sentMessages — SN will call this again
} else {
  sent.callback(data.data);
  sentMessages.delete(data.original.messageId); // one-shot, clean up
}
```

If you delete the `stream-context-item` callback, switching notes will silently fail — the editor will keep showing stale content.

## 5. Handle All Item Data Shapes

SN delivers note data in inconsistent shapes depending on the platform and action:

```typescript
// Sometimes it's data.item
// Sometimes it's data.items[0]
// Sometimes data itself IS the item

function extractItem(data: any) {
  if (data?.item?.content) return data.item;
  if (data?.items?.[0]?.content) return data.items[0];
  if (data?.content && data?.uuid) return data;
  return null;
}
```

Always check all three patterns. Mobile and desktop SN may use different shapes for the same action.

## 6. Skip `isMetadataUpdate` Replies

When SN pushes an item update with `isMetadataUpdate: true`, only metadata changed (locked, pinned, archived). The `content.text` may be stale or unchanged. If you process it, you'll overwrite the user's in-progress edits.

```typescript
if (item.isMetadataUpdate) return; // skip — don't touch the editor
```

## 7. Mobile SN Sends Stringified JSON

React Native WebView's `postMessage` sends strings, not objects. Always parse:

```typescript
let data = (event as MessageEvent).data;
if (typeof data === 'string') {
  try { data = JSON.parse(data); } catch { return; }
}
```

Without this, your editor silently ignores all messages on mobile.

## 8. Listen on Both `window` AND `document`

Some mobile platforms deliver messages to `document` instead of `window`:

```typescript
window.addEventListener('message', handler);
document.addEventListener('message', handler as EventListener);
```

## 9. Vite `base` Must Be Relative for GitHub Pages

```typescript
// vite.config.ts
export default defineConfig({
  base: './',  // NOT '/' — GitHub Pages serves from a subdirectory
});
```

Without `./`, all asset paths break when deployed to `https://user.github.io/repo/`.

## 10. `destroy()` Should NOT Remove Event Listeners

If your SN API is a singleton (recommended), removing listeners in a React cleanup function causes a race condition — React re-mounts, but the new `useEffect` registers listeners after SN has already sent its initial message.

```typescript
// BAD
destroy() {
  window.removeEventListener('message', this.handleMessage);
}

// GOOD — singleton stays alive, only clear the callback
destroy() {
  this.contentCallback = null;
}
```

## 11. Debounce Saves

Every `save-items` call triggers SN to sync, encrypt, and persist. Saving on every keystroke creates lag and sync conflicts.

```typescript
const SAVE_DELAY = 300; // ms
let saveTimeout: ReturnType<typeof setTimeout>;

function handleChange(text: string) {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => snApi.saveText(text), SAVE_DELAY);
}
```

300ms is a good balance between responsiveness and efficiency.

## 12. Queue Saves Before Item Arrives

There's a window between page load and receiving the first item where the user could trigger a save (especially with fast typers or auto-initialized content). If `currentItem` is null, the save fails silently.

```typescript
saveText(text: string) {
  if (!this.currentItem) {
    this.pendingSaveText = text; // queue it
    return;
  }
  // ... normal save
}

private setItem(item: any) {
  this.currentItem = item;
  // Flush queued save
  if (this.pendingSaveText !== null) {
    const t = this.pendingSaveText;
    this.pendingSaveText = null;
    this.saveText(t);
  }
}
```

## 13. Always Generate `preview_plain`

The SN note list shows a text preview of each note. If you don't set `preview_plain`, the list shows nothing useful (or raw JSON/markdown).

```typescript
content: {
  ...currentItem.content,
  text: newText,
  preview_plain: generatePreview(newText), // first 90 chars, summary, etc.
}
```

## 14. Use a Timeout Fallback for SN Init

Sometimes SN is slow, especially on mobile or when the app is resuming from background. Set a reasonable timeout (3-4 seconds) and show the editor anyway:

```typescript
const timeout = setTimeout(() => setLoaded(true), 4000);

snApi.initialize((text) => {
  clearTimeout(timeout);
  setContent(text);
  setLoaded(true);
});
```

Don't set it too high (8s+ makes the editor feel broken) or too low (1s will show empty state before SN responds on slow connections).

## 15. `postMessage` Origin Handling

Capture the origin from `component-registered` and use it for all outgoing messages. Fall back to `'*'` if the specific origin throws:

```typescript
case 'component-registered':
  this.origin = (event as MessageEvent).origin || '*';
  break;

// When sending:
try {
  window.parent.postMessage(msg, this.origin);
} catch {
  window.parent.postMessage(msg, '*');
}
```

## 16. Transparent Background When Embedded

SN's editor area already has a themed background. If your editor also has a background, you get double backgrounds (or a visible box inside the editor area).

```css
body.sn-embedded {
  background: transparent;
}
```

Add the class in your init:
```typescript
if (window.parent !== window) {
  document.body.classList.add('sn-embedded');
}
```

## 17. `ext.json` Must Be Accessible at the Published URL

SN fetches `ext.json` to install the plugin. Make sure:
- It's copied to your `dist/` folder on build (Vite's `public/` folder does this automatically)
- The `url` field points to your actual `index.html`
- The `latest_url` field points to the `ext.json` itself

```json
{
  "url": "https://user.github.io/my-editor/index.html",
  "latest_url": "https://user.github.io/my-editor/ext.json"
}
```

## 18. Use Different Identifiers for Dev vs Production

Install both your dev (localhost) and production builds simultaneously by using different identifiers:

```json
// public/ext.json (production)
{ "identifier": "com.yourname.my-editor" }

// local-ext.json (dev)
{ "identifier": "com.yourname.my-editor-dev" }
```

## 19. Drag-and-Drop: Merge Styles, Don't Override

If you use a drag library like `@hello-pangea/dnd`, the library sets transform styles via `provided.draggableProps.style`. If you set your own `style` prop, it **overrides** the drag transforms and the card freezes in place.

```tsx
// BAD — drag transform is lost
<div {...provided.draggableProps} style={{ '--my-var': value }}>

// GOOD — merge library styles with yours
<div
  {...provided.draggableProps}
  style={{
    ...provided.draggableProps.style,
    '--my-var': value,
  } as React.CSSProperties}
>
```

## 20. Date Inputs and Theme Adaptation

HTML date pickers have native browser styling that doesn't respect CSS variables. Use `color-scheme` to make them adapt:

```css
input[type="date"] {
  color-scheme: light dark;
}
```

This tells the browser to render the date picker in whichever scheme matches the current background.
