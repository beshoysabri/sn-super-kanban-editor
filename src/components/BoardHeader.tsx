import { useState, useRef, useEffect, memo } from 'react';
import type { BoardMeta, KanbanLane, ViewMode } from '../types/kanban';

interface Props {
  meta: BoardMeta;
  lanes: KanbanLane[];
  onUpdateMeta: (partial: Partial<BoardMeta>) => void;
}

export const BoardHeader = memo(function BoardHeader({ meta, lanes, onUpdateMeta }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(meta.title);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(meta.description);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitleDraft(meta.title); }, [meta.title]);
  useEffect(() => { setDescDraft(meta.description); }, [meta.description]);
  useEffect(() => { if (editingTitle) { titleRef.current?.focus(); titleRef.current?.select(); } }, [editingTitle]);
  useEffect(() => { if (editingDesc) { descRef.current?.focus(); descRef.current?.select(); } }, [editingDesc]);

  const columnCount = lanes.length;
  const cardCount = lanes.reduce((sum, l) => sum + l.cards.length, 0);

  const finishTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed !== meta.title) onUpdateMeta({ title: trimmed });
  };

  const finishDesc = () => {
    setEditingDesc(false);
    const trimmed = descDraft.trim();
    if (trimmed !== meta.description) onUpdateMeta({ description: trimmed });
  };

  const setView = (v: ViewMode) => onUpdateMeta({ viewMode: v });

  return (
    <div className="board-header">
      <div className="board-header-left">
        {editingTitle ? (
          <input
            ref={titleRef}
            className="board-title-input"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={finishTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishTitle();
              if (e.key === 'Escape') { setTitleDraft(meta.title); setEditingTitle(false); }
            }}
            placeholder="Board title..."
          />
        ) : (
          <h1 className="board-title" onClick={() => setEditingTitle(true)}>
            {meta.title || 'Untitled Board'}
          </h1>
        )}
        {editingDesc ? (
          <input
            ref={descRef}
            className="board-desc-input"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={finishDesc}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishDesc();
              if (e.key === 'Escape') { setDescDraft(meta.description); setEditingDesc(false); }
            }}
            placeholder="Add a description..."
          />
        ) : (
          <p className="board-desc" onClick={() => setEditingDesc(true)}>
            {meta.description || 'Add a description...'}
          </p>
        )}
        <div className="board-stats">
          <span>{columnCount} {columnCount === 1 ? 'column' : 'columns'}</span>
          <span className="board-stat-sep">&middot;</span>
          <span>{cardCount} {cardCount === 1 ? 'card' : 'cards'}</span>
        </div>
      </div>

      <div className="board-header-right">
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${meta.viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            List
          </button>
          <button
            className={`view-toggle-btn ${meta.viewMode === 'board' ? 'active' : ''}`}
            onClick={() => setView('board')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Board
          </button>
        </div>
      </div>
    </div>
  );
});
