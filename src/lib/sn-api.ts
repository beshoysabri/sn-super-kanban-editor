/**
 * Standard Notes Component Relay - lightweight protocol-compliant integration
 *
 * Protocol flow (confirmed from official component-relay source):
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

// Debug log visible in the app for diagnosing SN communication
const debugLines: string[] = [];
function debugLog(msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  debugLines.push(line);
  if (debugLines.length > 50) debugLines.shift();
  // Also write to console for Electron dev tools
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

  getDebugLog(): string[] {
    return [...debugLines];
  }

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    debugLog('initialize() called, adding message listeners');
    window.addEventListener('message', this.handleMessage);
    document.addEventListener('message', this.handleMessage as EventListener);
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

        // Request the note content (this is a subscription — SN will call back on note switches too)
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
        // This handles 'reply' and any other response action
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
            // Call the callback — SN reuses this messageId on note switch
            sent.callback(message.data);
          } else {
            // Clean up non-streaming callbacks (save-items, etc.)
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
    debugLog(`setItem: uuid=${item.uuid?.slice(0, 8)} textLen=${item.content?.text?.length || 0}`);
    this.contentCallback?.(item.content.text || '');
    if (this.pendingSaveText !== null) {
      const text = this.pendingSaveText;
      this.pendingSaveText = null;
      debugLog('flushing pending save');
      this.saveText(text);
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
    window.removeEventListener('message', this.handleMessage);
    document.removeEventListener('message', this.handleMessage as EventListener);
    this.contentCallback = null;
    this.currentItem = null;
    this.pendingSaveText = null;
    this.sentMessages.clear();
  }
}

export const snApi = new SNExtensionAPI();
