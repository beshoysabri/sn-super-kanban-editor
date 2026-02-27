import { useState, useEffect, useCallback, useRef } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { parseMarkdown, boardToMarkdown, createEmptyBoard } from './lib/markdown';
import { snApi } from './lib/sn-api';
import type { KanbanBoard as BoardType } from './types/kanban';

function DebugPanel() {
  const [visible, setVisible] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (visible) setLog(snApi.getDebugLog());
    }, 500);
    return () => clearInterval(interval);
  }, [visible]);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setVisible((v) => !v);
        setLog(snApi.getDebugLog());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      maxHeight: '40vh', overflow: 'auto', background: '#000', color: '#0f0',
      fontFamily: 'monospace', fontSize: '11px', padding: '8px', lineHeight: 1.4,
      borderTop: '2px solid #0f0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <strong>SN Debug Log (Ctrl+Shift+D to close)</strong>
        <span>{log.length} entries</span>
      </div>
      {log.map((line, i) => <div key={i}>{line}</div>)}
      {log.length === 0 && <div style={{ opacity: 0.5 }}>No messages yet...</div>}
    </div>
  );
}

function App() {
  const [board, setBoard] = useState<BoardType>(createEmptyBoard);
  const [loaded, setLoaded] = useState(false);
  const isInsideSN = useRef(window.parent !== window);
  const dataReceived = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInsideSN.current) {
      document.body.classList.add('sn-embedded');

      // Timeout fallback: if SN doesn't respond within 4s, show empty board
      const timeout = setTimeout(() => {
        if (!dataReceived.current) {
          setBoard(createEmptyBoard());
          setLoaded(true);
        }
      }, 4000);

      // snApi listeners are already active (registered at module load).
      // initialize() just sets the callback — and delivers any buffered content
      // that arrived before React mounted.
      snApi.initialize((text: string) => {
        dataReceived.current = true;
        clearTimeout(timeout);
        if (text.trim()) {
          const { board: parsed } = parseMarkdown(text);
          setBoard(parsed);
        } else {
          setBoard(createEmptyBoard());
        }
        setLoaded(true);
      });

      return () => {
        clearTimeout(timeout);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        document.body.classList.remove('sn-embedded');
        snApi.destroy();
      };
    } else {
      const saved = localStorage.getItem('sn-super-kanban-editor');
      if (saved) {
        try {
          const { board: parsed } = parseMarkdown(saved);
          setBoard(parsed);
        } catch {
          setBoard(createEmptyBoard());
        }
      }
      setLoaded(true);
    }
  }, []);

  const handleChange = useCallback(
    (newBoard: BoardType) => {
      setBoard(newBoard);
      const markdown = boardToMarkdown(newBoard);
      if (isInsideSN.current) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          snApi.saveText(markdown);
          saveTimeoutRef.current = null;
        }, 300);
      } else {
        localStorage.setItem('sn-super-kanban-editor', markdown);
      }
    },
    []
  );

  if (!loaded) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="app">
      <KanbanBoard board={board} onChange={handleChange} />
      <DebugPanel />
    </div>
  );
}

export default App;
