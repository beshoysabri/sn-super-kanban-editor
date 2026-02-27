import { useState, useRef, useEffect, memo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { KanbanCardComponent } from './KanbanCard';
import { getColorHex, LABEL_COLORS } from '../lib/colors';
import type { KanbanLane as LaneType, KanbanCard } from '../types/kanban';

interface Props {
  lane: LaneType;
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string, title: string) => void;
  onDeleteLane: (laneId: string) => void;
  onDuplicateLane: (laneId: string) => void;
  onRenameLane: (laneId: string, title: string) => void;
  onSetLaneColor: (laneId: string, color: string) => void;
}

export const KanbanLaneComponent = memo(function KanbanLaneComponent({
  lane,
  onCardClick,
  onAddCard,
  onDeleteLane,
  onDuplicateLane,
  onRenameLane,
  onSetLaneColor,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(lane.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const laneColor = getColorHex(lane.color);

  useEffect(() => {
    setTitle(lane.title);
  }, [lane.title]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (addingCard && cardInputRef.current) {
      cardInputRef.current.focus();
    }
  }, [addingCard]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowColorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const finishEditing = () => {
    setIsEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== lane.title) {
      onRenameLane(lane.id, trimmed);
    } else {
      setTitle(lane.title);
    }
  };

  const submitCard = () => {
    const trimmed = newCardTitle.trim();
    if (trimmed) {
      onAddCard(lane.id, trimmed);
      setNewCardTitle('');
    }
  };

  const cancelAddCard = () => {
    setAddingCard(false);
    setNewCardTitle('');
  };

  return (
    <div
      className={`kanban-lane ${laneColor ? 'lane-tinted' : ''}`}
      style={laneColor ? { '--lane-accent': laneColor } as React.CSSProperties : undefined}
    >
      <div className="lane-header">
        {laneColor && (
          <span className="lane-color-dot" style={{ backgroundColor: laneColor }} />
        )}
        {isEditing ? (
          <input
            ref={inputRef}
            className="lane-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishEditing();
              if (e.key === 'Escape') {
                setTitle(lane.title);
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <h3 className="lane-title" onDoubleClick={() => setIsEditing(true)}>
            {lane.title}
            <span className="lane-count">{lane.cards.length}</span>
          </h3>
        )}
        <div className="lane-actions" ref={menuRef}>
          <button
            className="lane-menu-btn"
            onClick={() => {
              setShowMenu(!showMenu);
              setShowColorPicker(false);
            }}
            aria-label="Lane options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {showMenu && (
            <div className="lane-menu">
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDuplicateLane(lane.id);
                }}
              >
                Duplicate
              </button>
              <button onClick={() => setShowColorPicker(!showColorPicker)}>
                Color
                {laneColor && (
                  <span className="menu-color-preview" style={{ backgroundColor: laneColor }} />
                )}
              </button>
              {showColorPicker && (
                <div className="lane-color-picker">
                  <button
                    className={`color-swatch-sm no-color ${!lane.color ? 'selected' : ''}`}
                    onClick={() => {
                      onSetLaneColor(lane.id, '');
                      setShowColorPicker(false);
                      setShowMenu(false);
                    }}
                    title="No color"
                  />
                  {LABEL_COLORS.map((c) => (
                    <button
                      key={c.name}
                      className={`color-swatch-sm ${lane.color === c.name ? 'selected' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => {
                        onSetLaneColor(lane.id, c.name);
                        setShowColorPicker(false);
                        setShowMenu(false);
                      }}
                      title={c.name}
                    />
                  ))}
                  <label
                    className={`color-swatch-sm custom-color ${lane.color.startsWith('#') ? 'selected' : ''}`}
                    style={{ backgroundColor: lane.color.startsWith('#') ? lane.color : undefined }}
                    title="Custom color"
                  >
                    <input
                      type="color"
                      className="hidden-color-input"
                      value={getColorHex(lane.color) || '#6366f1'}
                      onChange={(e) => {
                        onSetLaneColor(lane.id, e.target.value);
                      }}
                    />
                    {!lane.color.startsWith('#') && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    )}
                  </label>
                </div>
              )}
              <div className="lane-menu-divider" />
              <button
                className="danger"
                onClick={() => {
                  setShowMenu(false);
                  onDeleteLane(lane.id);
                }}
              >
                Delete Lane
              </button>
            </div>
          )}
        </div>
      </div>

      <Droppable droppableId={lane.id} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`lane-cards ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
          >
            {lane.cards.map((card, index) => (
              <KanbanCardComponent
                key={card.id}
                card={card}
                index={index}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {addingCard ? (
        <div className="inline-add-card">
          <input
            ref={cardInputRef}
            className="inline-card-input"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            placeholder="Card title..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCard();
              }
              if (e.key === 'Escape') cancelAddCard();
            }}
            onBlur={() => {
              if (!newCardTitle.trim()) cancelAddCard();
            }}
          />
          <div className="inline-add-actions">
            <button className="inline-add-confirm" onClick={submitCard} disabled={!newCardTitle.trim()}>
              Add
            </button>
            <button className="inline-add-cancel" onClick={cancelAddCard}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <button className="add-card-btn" onClick={() => setAddingCard(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Card
        </button>
      )}
    </div>
  );
});
