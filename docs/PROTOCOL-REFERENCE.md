# Standard Notes Component Relay Protocol Reference

The complete postMessage protocol between SN and editor iframes.

## Protocol Flow

```
Browser loads iframe
        |
        v
SN ---> "component-registered" (sessionKey, activeThemeUrls)
        |
Editor ---> "themes-activated" (acknowledgment)
Editor ---> "stream-context-item" (subscribe to note data)
        |
        v
SN ---> action:"reply" + original.messageId (note content)
        |
        v
[User edits content]
        |
Editor ---> "save-items" (updated note)
        |
[User switches notes]
        |
SN ---> action:"reply" + same original.messageId (new note content)
        |
[User changes theme]
        |
SN ---> "themes" (new theme URLs)
```

## Message Format

### Editor -> SN

Every message sent from the editor:

```typescript
{
  action: string;       // "stream-context-item", "save-items", etc.
  data: object;         // payload
  messageId: string;    // UUID — used by SN to send replies
  sessionKey: string;   // from component-registered
  api: "component";     // always this value
}
```

Sent via:
```typescript
window.parent.postMessage(message, origin);
```

### SN -> Editor

The editor listens on **both** `window` and `document` (needed for some mobile platforms):

```typescript
window.addEventListener('message', handler);
document.addEventListener('message', handler as EventListener);
```

**Mobile warning**: React Native WebView may send messages as stringified JSON strings:
```typescript
let data = event.data;
if (typeof data === 'string') {
  try { data = JSON.parse(data); } catch { return; }
}
```

## Actions Reference

### `component-registered` (SN -> Editor)

First message SN sends after loading the iframe.

```typescript
{
  action: "component-registered",
  sessionKey: "a1b2c3d4-...",
  componentData: {
    activeThemeUrls: ["https://...theme.css"]
  },
  data: {
    activeThemeUrls: ["https://...theme.css"]  // alternative location
  }
}
```

**You must**:
1. Store `sessionKey` — required for all future messages
2. Capture `event.origin` — use for secure postMessage targeting
3. Load theme stylesheets from `activeThemeUrls`
4. Send `themes-activated`
5. Send `stream-context-item` to subscribe to note data

### `stream-context-item` (Editor -> SN)

Subscribe to the current note's content. SN replies immediately with the current note and reuses the same `messageId` callback whenever the user switches notes.

```typescript
// Send:
postMessage('stream-context-item', {});

// SN replies with:
{
  action: "reply",  // or any action name
  original: {
    messageId: "the-id-you-sent"  // matches your stream-context-item
  },
  data: {
    item: {
      uuid: "ec677a63-...",
      content_type: "Note",
      content: {
        text: "the note content",
        title: "Note Title",
        preview_plain: "...",
        appData: { ... }
      },
      isMetadataUpdate: false
    }
  }
}
```

**Important**: The `data` structure may vary:
- `data.item` — single item object
- `data.items` — array (use first element)
- `data` itself may be the item (has `content` + `uuid`)

Always check all three patterns:
```typescript
function extractItem(data: any) {
  if (data?.item?.content) return data.item;
  if (data?.items?.[0]?.content) return data.items[0];
  if (data?.content && data?.uuid) return data;
  return null;
}
```

### `save-items` (Editor -> SN)

Persist note changes:

```typescript
postMessage('save-items', {
  items: [{
    uuid: currentItem.uuid,
    content_type: currentItem.content_type,
    content: {
      ...currentItem.content,
      text: newText,
      preview_plain: generatePreview(newText)
    }
  }]
});
```

### `themes-activated` (Editor -> SN)

Acknowledge theme loading:
```typescript
postMessage('themes-activated', {});
```

### `themes` (SN -> Editor)

Theme change notification:
```typescript
{
  action: "themes",
  data: {
    themes: ["https://...new-theme.css"]
  }
}
```

### Other Actions

| Action | Direction | Description |
|--------|-----------|-------------|
| `stream-items` | Editor -> SN | Request items by content_type |
| `create-items` | Editor -> SN | Create new items |
| `delete-items` | Editor -> SN | Remove items |
| `set-component-data` | Editor -> SN | Store editor-level metadata |
| `set-size` | Editor -> SN | Adjust iframe dimensions |
| `key-down` / `key-up` | Editor -> SN | Keyboard modifier forwarding |

## Reply/Callback Matching

SN replies to editor messages by including `original.messageId` that matches the sent message's `messageId`. The editor maintains a map:

```typescript
const sentMessages = new Map<string, { action: string; callback: Function }>();

// When sending:
sentMessages.set(messageId, { action, callback });

// When receiving ANY message with message.original:
const sent = sentMessages.get(message.original.messageId);
if (sent) {
  if (sent.action === 'stream-context-item') {
    sent.callback(message.data);
    // DO NOT delete — SN reuses this callback on note switch
  } else {
    sent.callback(message.data);
    sentMessages.delete(message.original.messageId);
  }
}
```

**Critical**: The `stream-context-item` callback is **never** deleted. SN reuses the same `original.messageId` every time the user switches notes. All other callbacks (like `save-items`) are one-shot and should be cleaned up.

## Note Item Structure

```typescript
interface SNItem {
  uuid: string;
  content_type: "Note";
  created_at: string;        // ISO timestamp
  updated_at: string;        // ISO timestamp
  isMetadataUpdate?: boolean; // true = only metadata changed, ignore content
  content: {
    text: string;            // The note's text content (your editor's data)
    title: string;           // Note title (managed by SN, not the editor)
    preview_plain?: string;  // Plain text preview for note list
    preview_html?: string;   // HTML preview for note list
    editorIdentifier?: string;
    references: any[];
    spellcheck?: boolean;
    appData?: {
      "org.standardnotes.sn": {
        locked?: boolean;
        pinned?: boolean;
        archived?: boolean;
      };
      "com.yourname.my-editor": {
        // Your custom per-note metadata (any JSON)
      };
    };
  };
}
```

### Key Points

- **`text`** is always a string. For complex data, use JSON.stringify or a custom format.
- **`preview_plain`** shows in the note list. Generate something meaningful (first 90 chars, summary, etc.).
- **`isMetadataUpdate`** — when `true`, skip updating the editor (only metadata like locked/pinned changed).
- **`appData`** uses reverse-domain keys. Store your editor's per-note settings under your identifier.
- **`title`** is managed by SN's title bar, not by your editor iframe.

## Detecting SN vs Standalone

```typescript
const isInsideSN = window.parent !== window;
```

When not inside SN, fall back to `localStorage` or show a demo mode.
