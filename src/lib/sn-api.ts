/**
 * Standard Notes Component Relay - lightweight protocol-compliant integration
 *
 * CRITICAL: Message listeners are registered in the constructor (at module load),
 * NOT in initialize(). SN sends `component-registered` during iframe load, often
 * before React mounts. If we wait for useEffect → initialize(), we miss it entirely,
 * causing all saves to queue and never persist.
 *
 * Protocol flow:
 * 1. SN sends `component-registered` with sessionKey
 * 2. Editor sends `themes-activated` acknowledgment
 * 3. Editor sends `stream-context-item` (subscription for note data)
 * 4. SN replies via action:'reply' with original.messageId matching
 * 5. On note switch, SN sends another reply with same original.messageId
 * 6. Editor sends `save-items` when content changes
 */

type ContentCallback = (text: string) => void;

interface SNItem {
  uuid: string;
  content_type: string;
  content: {
    text: string;
    preview_plain?: string;
    preview_html?: string;
    appData?: Record<string, any>;
    [key: string]: any;
  };
  isMetadataUpdate?: boolean;
  [key: string]: any;
}

function generateUuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

interface SentMessage {
  action: string;
  callback: (data: any) => void;
}

const debugLines: string[] = [];
function debugLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  debugLines.push(line);
  if (debugLines.length > 50) debugLines.shift();
  console.log('[SN-API]', msg);
}

class SNExtensionAPI {
  private sessionKey: string | null = null;
  private contentCallback: ContentCallback | null = null;
  private currentItem: SNItem | null = null;
  private origin: string = '*';
  private registered = false;
  private sentMessages: Map<string, SentMessage> = new Map();
  private pendingSaveText: string | null = null;
  // Text received from SN before React mounted and set the callback
  private pendingItemText: string | null = null;

  constructor() {
    // Register listeners IMMEDIATELY at module load time.
    // SN sends component-registered during iframe load — often before React's
    // useEffect fires. Missing it means currentItem stays null and saves never persist.
    window.addEventListener('message', this.handleMessage);
    document.addEventListener('message', this.handleMessage as EventListener);
    debugLog('constructor: listeners registered at module load');
  }

  getDebugLog(): string[] {
    return [...debugLines];
  }

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    debugLog('initialize() called');

    // If SN already delivered note content before React mounted, deliver it now
    if (this.pendingItemText !== null) {
      const text = this.pendingItemText;
      this.pendingItemText = null;
      debugLog(`initialize: delivering buffered item (textLen=${text.length})`);
      callback(text);
    }
  }

  private handleMessage = (event: MessageEvent | Event) => {
    let data = (event as MessageEvent).data;
    // Mobile SN (React Native WebView) may send stringified JSON
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (!data || typeof data !== 'object') return;

    const message = data as Record<string, any>;
    if (!message.action) return;

    debugLog(`RECV action=${message.action} hasOriginal=${!!message.original} hasData=${!!message.data}`);

    switch (message.action) {
      case 'component-registered': {
        this.sessionKey = message.sessionKey || null;
        this.origin = (event as MessageEvent).origin || '*';
        this.registered = true;

        debugLog(`registered: sessionKey=${this.sessionKey?.slice(0, 8)}... origin=${this.origin}`);

        // Inject theme CSS
        const themeUrls: string[] =
          message.componentData?.activeThemeUrls ||
          message.data?.activeThemeUrls || [];
        this.activateThemes(themeUrls);

        // Acknowledge themes
        this.postMessage('themes-activated', {});

        // Subscribe to note content (SN reuses this callback on note switches)
        this.postMessage('stream-context-item', {}, (responseData) => {
          debugLog(`stream-context-item callback fired, keys=${responseData ? Object.keys(responseData).join(',') : 'null'}`);
          const item = this.extractItem(responseData);
          if (item) {
            debugLog(`item extracted: uuid=${item.uuid?.slice(0, 8)} hasText=${!!item.content?.text} textLen=${item.content?.text?.length || 0} isMetadata=${item.isMetadataUpdate}`);
            if (!item.isMetadataUpdate) {
              this.setItem(item);
            }
          } else {
            debugLog('WARNING: no item found in callback data');
          }
        });
        break;
      }

      case 'themes': {
        const urls: string[] = message.data?.themes || [];
        this.activateThemes(urls);
        break;
      }

      default: {
        // Official component-relay pattern: match ANY action by original.messageId
        if (!message.original) {
          debugLog(`unhandled action=${message.action} (no original)`);
          return;
        }

        const originalId = message.original.messageId;
        debugLog(`matching reply originalId=${originalId?.slice(0, 8)} found=${this.sentMessages.has(originalId)}`);

        if (originalId && this.sentMessages.has(originalId)) {
          const sent = this.sentMessages.get(originalId)!;
          debugLog(`matched to original action=${sent.action}`);

          if (sent.action === 'stream-context-item') {
            // Streaming subscription — keep the callback for future note switches
            sent.callback(message.data);
          } else {
            // One-time callbacks (save-items, etc.) — clean up
            this.sentMessages.delete(originalId);
          }
        }
        break;
      }
    }
  };

  private extractItem(data: any): SNItem | null {
    if (!data) return null;
    if (data.item && data.item.content) return data.item;
    if (Array.isArray(data.items) && data.items.length > 0 && data.items[0].content) {
      return data.items[0];
    }
    if (data.content && data.uuid) return data as SNItem;
    return null;
  }

  private setItem(item: SNItem) {
    this.currentItem = item;
    const text = item.content.text || '';
    debugLog(`setItem: uuid=${item.uuid?.slice(0, 8)} textLen=${text.length}`);

    if (this.contentCallback) {
      this.contentCallback(text);
    } else {
      // React hasn't mounted yet — buffer text for when initialize() is called
      this.pendingItemText = text;
      debugLog('setItem: buffered (callback not ready yet)');
    }

    // Flush any saves that were queued while waiting for currentItem
    if (this.pendingSaveText !== null) {
      const saveText = this.pendingSaveText;
      this.pendingSaveText = null;
      debugLog('flushing pending save');
      this.saveText(saveText);
    }
  }

  saveText(text: string) {
    if (!this.currentItem) {
      debugLog(`saveText: queued (no currentItem yet) textLen=${text.length}`);
      this.pendingSaveText = text;
      return;
    }

    const previewLines = text.split('\n').filter((l) => l.trim() && !l.startsWith('@')).slice(0, 3);
    const preview = previewLines
      .map((l) => l.replace(/^[#*\s]+/, ''))
      .join(' | ')
      .substring(0, 90);

    const updatedItem: SNItem = {
      ...this.currentItem,
      content: {
        ...this.currentItem.content,
        text,
        preview_plain: preview,
      },
    };

    this.currentItem = updatedItem;
    debugLog(`saveText: sending save-items uuid=${updatedItem.uuid?.slice(0, 8)} textLen=${text.length}`);
    this.postMessage('save-items', { items: [updatedItem] });
  }

  private postMessage(action: string, data: Record<string, any>, callback?: (data: any) => void) {
    const messageId = generateUuid();

    if (callback) {
      this.sentMessages.set(messageId, { action, callback });
    }

    const msg = {
      action,
      data,
      messageId,
      sessionKey: this.sessionKey,
      api: 'component',
    };

    if (!this.registered) {
      debugLog(`postMessage BLOCKED (not registered): ${action}`);
      return;
    }

    debugLog(`SEND action=${action} msgId=${messageId.slice(0, 8)}`);

    const target = window.parent !== window ? window.parent : window;
    try {
      target.postMessage(msg, this.origin);
    } catch {
      target.postMessage(msg, '*');
    }
  }

  private activateThemes(urls: string[]) {
    document.querySelectorAll('link[data-sn-theme]').forEach((el) => el.remove());
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
    // Only clear the React callback — keep everything else alive on the singleton.
    // Listeners MUST persist to catch SN messages between React unmount/remount.
    // currentItem and pendingSaveText are preserved so saves don't get lost.
    this.contentCallback = null;
    this.pendingItemText = null;
    debugLog('destroy: callback cleared, listeners preserved');
  }
}

export const snApi = new SNExtensionAPI();
