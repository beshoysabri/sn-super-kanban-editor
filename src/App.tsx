import { useState, useEffect, useCallback, useRef } from 'react';
import { KanbanBoard } from './components/KanbanBoard';
import { parseMarkdown, boardToMarkdown, createEmptyBoard } from './lib/markdown';
import { snApi } from './lib/sn-api';
import type { KanbanBoard as BoardType } from './types/kanban';

function App() {
  const [board, setBoard] = useState<BoardType>(createEmptyBoard);
  const [loaded, setLoaded] = useState(false);
  const isInsideSN = useRef(window.parent !== window);

  useEffect(() => {
    if (isInsideSN.current) {
      snApi.initialize((text: string) => {
        if (text.trim()) {
          const { board: parsed } = parseMarkdown(text);
          setBoard(parsed);
        } else {
          setBoard(createEmptyBoard());
        }
        setLoaded(true);
      });
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

    return () => {
      if (isInsideSN.current) snApi.destroy();
    };
  }, []);

  const handleChange = useCallback(
    (newBoard: BoardType) => {
      setBoard(newBoard);
      const markdown = boardToMarkdown(newBoard);
      if (isInsideSN.current) {
        snApi.saveText(markdown);
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
    </div>
  );
}

export default App;
