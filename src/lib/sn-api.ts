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

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    window.addEventListener('message', this.handleMessage);
    // Also listen on document for older React Native WebViews
    document.addEventListener('message', this.handleMessage as EventListener);
  }

  private handleMessage = (event: MessageEvent | Event) => {
    const data = (event as MessageEvent).data;
    if (!data || typeof data !== 'object') return;

    const message = data as Record<string, any>;

    switch (message.action) {
      case 'component-registered': {
        this.sessionKey = message.sessionKey || null;
        this.origin = (event as MessageEvent).origin || '*';
        this.registered = true;

        // Inject theme CSS
        const themeUrls: string[] = message.data?.activeThemeUrls || [];
        this.activateThemes(themeUrls);

        // Acknowledge themes
        this.postMessage('themes-activated', {});

        // Request the note content
        this.postMessage('stream-context-item', {}, (responseData) => {
          const item = responseData?.item;
          if (item && item.content) {
            this.currentItem = item;
            this.contentCallback?.(item.content.text || '');
          }
        });
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

        // Also handle as a general content push (SN sends updated content this way)
        const item = message.data?.item;
        if (item && item.content) {
          this.currentItem = item;
          this.contentCallback?.(item.content.text || '');
        }
        break;
      }

      // Direct context-item push (some SN versions)
      case 'context-item': {
        const item = message.data?.item || (message as any).item;
        if (item && item.content) {
          this.currentItem = item;
          this.contentCallback?.(item.content.text || '');
        }
        break;
      }
    }
  };

  saveText(text: string) {
    if (!this.currentItem) return;

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

    try {
      window.parent.postMessage(msg, this.origin);
    } catch {
      window.parent.postMessage(msg, '*');
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
    this.contentCallback = null;
    this.currentItem = null;
    this.sentMessages.clear();
  }
}

export const snApi = new SNExtensionAPI();
