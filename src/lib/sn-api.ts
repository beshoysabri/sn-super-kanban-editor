/**
 * Standard Notes Extension API - lightweight integration
 * Communicates with Standard Notes via window.postMessage
 *
 * Based on the Standard Notes Component Relay protocol.
 * The component (this editor) runs inside an iframe.
 * SN sends messages to the component, and the component responds.
 */

type ContentCallback = (text: string) => void;

interface SNMessage {
  action: string;
  data?: Record<string, any>;
  messageId?: string;
  sessionKey?: string;
  componentData?: Record<string, any>;
  item?: SNItem;
  items?: SNItem[];
  original?: SNMessage;
}

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

class SNExtensionAPI {
  private sessionKey: string | null = null;
  private contentCallback: ContentCallback | null = null;
  private currentItem: SNItem | null = null;
  private origin: string = '*';
  private messageQueue: SNMessage[] = [];
  private registered = false;

  initialize(callback: ContentCallback) {
    this.contentCallback = callback;
    window.addEventListener('message', this.handleMessage);

    // Send ready signal - Standard Notes will reply with component-registered
    this.postMessage({ action: 'stream-context-item' });
  }

  private handleMessage = (event: MessageEvent) => {
    if (!event.data || typeof event.data !== 'object') return;

    const message = event.data as SNMessage;

    switch (message.action) {
      case 'component-registered':
        this.sessionKey = message.sessionKey || null;
        this.origin = event.origin;
        this.registered = true;

        // Flush any queued messages
        for (const queued of this.messageQueue) {
          this.postMessage(queued);
        }
        this.messageQueue = [];

        // Request the note content
        this.postMessage({
          action: 'stream-context-item',
        });
        break;

      case 'context-item':
      case 'reply': {
        const item = message.data?.item || message.item;
        if (item && item.content) {
          this.currentItem = item;
          const text = item.content.text || '';
          this.contentCallback?.(text);
        }
        break;
      }

      case 'themes':
        // Themes are injected via CSS variables by Standard Notes
        break;
    }
  };

  saveText(text: string) {
    if (!this.currentItem) return;

    // Create a plain-text preview from the markdown
    const previewLines = text.split('\n').filter((l) => l.trim()).slice(0, 3);
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

    this.postMessage({
      action: 'save-items',
      data: {
        items: [updatedItem],
      },
    });
  }

  private postMessage(message: SNMessage) {
    if (!this.registered && message.action !== 'stream-context-item') {
      this.messageQueue.push(message);
      return;
    }

    const msg = {
      ...message,
      sessionKey: this.sessionKey,
    };

    try {
      window.parent.postMessage(msg, this.origin);
    } catch {
      // Fallback to wildcard origin
      window.parent.postMessage(msg, '*');
    }
  }

  destroy() {
    window.removeEventListener('message', this.handleMessage);
    this.contentCallback = null;
    this.currentItem = null;
  }
}

export const snApi = new SNExtensionAPI();
