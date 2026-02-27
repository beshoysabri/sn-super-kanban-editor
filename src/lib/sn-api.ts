/**
 * Standard Notes Component Relay - lightweight protocol-compliant integration
 *
 * Protocol flow:
 * 1. SN sends `component-registered` with sessionKey + theme URLs
 * 2. Editor sends `themes-activated` acknowledgment
 * 3. Editor sends `stream-context-item` to request note data
 * 4. SN replies with the note content (action: "reply")
 * 5. Editor sends `save-items` when content changes
 *
 * Every editor→SN message must include: action, data, messageId, sessionKey, api
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
  [key: string]: any;
}

function generateUuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

class SNExtensionAPI {
  private sessionKey: string | null = null;
  private contentCallback: ContentCallback | null = null;
  private currentItem: SNItem | null = null;
  private origin: string = '*';
  private registered = false;
  private sentMessages: Map<string, (data: any) => void> = new Map();
  private pendingSaveText: string | null = null;
  private streamRetryTimer: ReturnType<typeof setTimeout> | null = null;

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    window.addEventListener('message', this.handleMessage);
    // Also listen on document for older React Native WebViews
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

    switch (message.action) {
      case 'component-registered': {
        this.sessionKey = message.sessionKey || null;
        this.origin = (event as MessageEvent).origin || '*';
        this.registered = true;

        // Inject theme CSS
        const themeUrls: string[] =
          message.componentData?.activeThemeUrls ||
          message.data?.activeThemeUrls || [];
        this.activateThemes(themeUrls);

        // Check if registration message includes the item directly
        const regItem = message.componentData?.item || message.data?.item;
        if (regItem && regItem.content) {
          this.setItem(regItem);
        }

        // Acknowledge themes
        this.postMessage('themes-activated', {});

        // Request the note content
        this.requestStreamContextItem();
        break;
      }

      case 'themes': {
        const urls: string[] = message.data?.themes || [];
        this.activateThemes(urls);
        break;
      }

      case 'reply': {
        // Match reply to sent message via messageId
        const originalId = message.original?.messageId;
        if (originalId && this.sentMessages.has(originalId)) {
          const cb = this.sentMessages.get(originalId)!;
          cb(message.data);
          // Keep the callback for stream-context-item (SN re-uses it on note switch)
        }

        // Extract item from reply - handle both `item` and `items` array formats
        const item = this.extractItem(message.data);
        if (item) {
          this.setItem(item);
        }
        break;
      }

      // Direct context-item push (some SN versions)
      case 'context-item': {
        const item = this.extractItem(message.data) || this.extractItem(message);
        if (item) {
          this.setItem(item);
        }
        break;
      }
    }
  };

  /**
   * Extract an item from various possible response formats
   */
  private extractItem(data: any): SNItem | null {
    if (!data) return null;
    // Direct item property
    if (data.item && data.item.content) return data.item;
    // Items array (some SN versions)
    if (Array.isArray(data.items) && data.items.length > 0 && data.items[0].content) {
      return data.items[0];
    }
    // Item is the data itself
    if (data.content && data.uuid) return data as SNItem;
    return null;
  }

  /**
   * Set the current item and notify callback. Also flush any pending save.
   */
  private setItem(item: SNItem) {
    this.currentItem = item;
    // Cancel retry timer since we got data
    if (this.streamRetryTimer) {
      clearTimeout(this.streamRetryTimer);
      this.streamRetryTimer = null;
    }
    this.contentCallback?.(item.content.text || '');
    // Flush any pending save that was queued before we had the item
    if (this.pendingSaveText !== null) {
      const text = this.pendingSaveText;
      this.pendingSaveText = null;
      this.saveText(text);
    }
  }

  /**
   * Request note content, with automatic retry after 3s if no response
   */
  private requestStreamContextItem() {
    this.postMessage('stream-context-item', { content_types: ['Note'] }, (responseData) => {
      const item = this.extractItem(responseData);
      if (item) {
        this.setItem(item);
      }
    });

    // Retry once after 3s if we still don't have the item
    this.streamRetryTimer = setTimeout(() => {
      if (!this.currentItem && this.registered) {
        this.postMessage('stream-context-item', { content_types: ['Note'] }, (responseData) => {
          const item = this.extractItem(responseData);
          if (item) {
            this.setItem(item);
          }
        });
      }
    }, 3000);
  }

  saveText(text: string) {
    if (!this.currentItem) {
      // Queue the save - it will be flushed when we receive the item
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
    this.postMessage('save-items', { items: [updatedItem] });
  }

  private postMessage(action: string, data: Record<string, any>, callback?: (data: any) => void) {
    const messageId = generateUuid();

    if (callback) {
      this.sentMessages.set(messageId, callback);
    }

    const msg = {
      action,
      data,
      messageId,
      sessionKey: this.sessionKey,
      api: 'component',
    };

    if (!this.registered) {
      // Don't send anything before registration
      return;
    }

    const target = window.parent !== window ? window.parent : window;
    try {
      target.postMessage(msg, this.origin);
    } catch {
      target.postMessage(msg, '*');
    }
  }

  private activateThemes(urls: string[]) {
    // Remove old injected theme links
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
    if (this.streamRetryTimer) clearTimeout(this.streamRetryTimer);
    this.contentCallback = null;
    this.currentItem = null;
    this.pendingSaveText = null;
    this.sentMessages.clear();
  }
}

export const snApi = new SNExtensionAPI();
