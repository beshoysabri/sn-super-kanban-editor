import { useState, useRef, useEffect, memo } from 'react';
import { getColorHex } from '../lib/colors';
import { formatDueDate } from '../lib/dates';
import type { KanbanLane, KanbanCard } from '../types/kanban';

interface Props {
  lanes: KanbanLane[];
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string, title: string) => void;
  onAddLane: (title: string) => void;
  onMoveCard: (cardId: string, fromLaneId: string, toLaneId: string) => void;
}

export const ListView = memo(function ListView({ lanes, onCardClick, onAddCard, onAddLane, onMoveCard }: Props) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState('');

  const submitGroup = () => {
    const trimmed = newGroupTitle.trim();
    if (trimmed) {
      onAddLane(trimmed);
      setNewGroupTitle('');
      setAddingGroup(false);
    }
  };

  return (
    <div className="list-view">
      {lanes.map((lane) => (
        <ListGroup
          key={lane.id}
          lane={lane}
          allLanes={lanes}
          onCardClick={onCardClick}
          onAddCard={onAddCard}
          onMoveCard={onMoveCard}
        />
      ))}
      {addingGroup ? (
        <div className="list-add-group-form">
          <input
            className="list-add-group-input"
            value={newGroupTitle}
            onChange={(e) => setNewGroupTitle(e.target.value)}
            placeholder="Group title..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitGroup();
              if (e.key === 'Escape') { setAddingGroup(false); setNewGroupTitle(''); }
            }}
            onBlur={() => { if (!newGroupTitle.trim()) { setAddingGroup(false); setNewGroupTitle(''); } }}
          />
          <div className="list-add-group-actions">
            <button className="list-add-group-confirm" onClick={submitGroup} disabled={!newGroupTitle.trim()}>Add</button>
            <button className="list-add-group-cancel" onClick={() => { setAddingGroup(false); setNewGroupTitle(''); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="list-add-group-btn" onClick={() => setAddingGroup(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Group
        </button>
      )}
    </div>
  );
});

const ListGroup = memo(function ListGroup({
  lane,
  allLanes,
  onCardClick,
  onAddCard,
  onMoveCard,
}: {
  lane: KanbanLane;
  allLanes: KanbanLane[];
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string, title: string) => void;
  onMoveCard: (cardId: string, fromLaneId: string, toLaneId: string) => void;
}) {
  const laneColor = getColorHex(lane.color);
  const [collapsed, setCollapsed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const submitCard = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddCard(lane.id, trimmed);
      setNewTitle('');
    }
  };

  return (
    <div className="list-group">
      <div
        className="list-group-header"
        style={laneColor ? { '--lane-accent': laneColor } as React.CSSProperties : undefined}
        onClick={() => setCollapsed(!collapsed)}
      >
        <svg
          className={`list-group-chevron ${collapsed ? 'collapsed' : ''}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {laneColor && <span className="lane-color-dot" style={{ backgroundColor: laneColor }} />}
        <span className="list-group-title">{lane.title}</span>
        <span className="list-group-count">{lane.cards.length}</span>
      </div>
      {!collapsed && (
        <>
          {lane.cards.length === 0 && (
            <div className="list-empty-group">No cards</div>
          )}
          {lane.cards.map((card) => (
            <ListCard
              key={card.id}
              card={card}
              currentLaneId={lane.id}
              allLanes={allLanes}
              onClick={onCardClick}
              onMoveCard={onMoveCard}
            />
          ))}
          {adding ? (
            <div className="list-add-card">
              <input
                className="list-add-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Card title..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); submitCard(); }
                  if (e.key === 'Escape') { setAdding(false); setNewTitle(''); }
                }}
                onBlur={() => { if (!newTitle.trim()) { setAdding(false); setNewTitle(''); } }}
              />
              <button className="list-add-confirm" onClick={submitCard} disabled={!newTitle.trim()}>Add</button>
              <button className="list-add-cancel" onClick={() => { setAdding(false); setNewTitle(''); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <button className="list-add-btn" onClick={() => setAdding(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add card
            </button>
          )}
        </>
      )}
    </div>
  );
});

const ListCard = memo(function ListCard({
  card,
  currentLaneId,
  allLanes,
  onClick,
  onMoveCard,
}: {
  card: KanbanCard;
  currentLaneId: string;
  allLanes: KanbanLane[];
  onClick: (c: KanbanCard) => void;
  onMoveCard: (cardId: string, fromLaneId: string, toLaneId: string) => void;
}) {
  const labelBg = getColorHex(card.labelColor);
  const dateInfo = formatDueDate(card.dueDate);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const moveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMoveMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (moveRef.current && !moveRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveMenu]);

  const otherLanes = allLanes.filter((l) => l.id !== currentLaneId);

  return (
    <div
      className={`list-card ${labelBg ? 'list-card-tinted' : ''}`}
      onClick={() => onClick(card)}
      style={labelBg ? { '--card-accent': labelBg } as React.CSSProperties : undefined}
    >
      <div className="list-card-content">
        <div className="list-card-main">
          <span className="list-card-title">{card.title}</span>
          {card.description && <span className="list-card-desc">{card.description}</span>}
        </div>
        <div className="list-card-meta">
          {card.label && <span className="list-card-label">{card.label}</span>}
          {dateInfo && (
            <span className={`card-date-badge date-${dateInfo.status}`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              {dateInfo.text}
            </span>
          )}
          {card.comments.length > 0 && (
            <span className="card-comment-count">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {card.comments.length}
            </span>
          )}
          {otherLanes.length > 0 && (
            <div className="list-card-move" ref={moveRef}>
              <button
                className="list-card-move-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(!showMoveMenu);
                }}
                aria-label="Move card"
                title="Move to..."
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 9l4-4 4 4" />
                  <path d="M5 15l4 4 4-4" />
                  <line x1="15" y1="5" x2="19" y2="5" />
                  <line x1="15" y1="9" x2="19" y2="9" />
                  <line x1="15" y1="13" x2="19" y2="13" />
                  <line x1="15" y1="17" x2="19" y2="17" />
                </svg>
              </button>
              {showMoveMenu && (
                <div className="list-move-menu">
                  <div className="list-move-menu-label">Move to</div>
                  {otherLanes.map((lane) => {
                    const lc = getColorHex(lane.color);
                    return (
                      <button
                        key={lane.id}
                        className="list-move-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveCard(card.id, currentLaneId, lane.id);
                          setShowMoveMenu(false);
                        }}
                      >
                        {lc && <span className="lane-color-dot" style={{ backgroundColor: lc }} />}
                        {lane.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
