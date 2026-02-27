import { useState, memo } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { getColorHex } from '../lib/colors';
import { formatDueDate } from '../lib/dates';
import type { KanbanLane, KanbanCard } from '../types/kanban';

interface Props {
  lanes: KanbanLane[];
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string, title: string) => void;
  onAddLane: (title: string) => void;
  onDragEnd: (result: DropResult) => void;
}

export const ListView = memo(function ListView({ lanes, onCardClick, onAddCard, onAddLane, onDragEnd }: Props) {
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
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="list-view">
        {lanes.map((lane) => (
          <ListGroup
            key={lane.id}
            lane={lane}
            onCardClick={onCardClick}
            onAddCard={onAddCard}
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
    </DragDropContext>
  );
});

const ListGroup = memo(function ListGroup({
  lane,
  onCardClick,
  onAddCard,
}: {
  lane: KanbanLane;
  onCardClick: (card: KanbanCard) => void;
  onAddCard: (laneId: string, title: string) => void;
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
        <Droppable droppableId={lane.id} type="CARD">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`list-group-body ${snapshot.isDraggingOver ? 'list-drag-over' : ''}`}
            >
              {lane.cards.length === 0 && !snapshot.isDraggingOver && (
                <div className="list-empty-group">No cards</div>
              )}
              {lane.cards.map((card, index) => (
                <ListCard
                  key={card.id}
                  card={card}
                  index={index}
                  onClick={onCardClick}
                />
              ))}
              {provided.placeholder}
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
            </div>
          )}
        </Droppable>
      )}
    </div>
  );
});

const ListCard = memo(function ListCard({
  card,
  index,
  onClick,
}: {
  card: KanbanCard;
  index: number;
  onClick: (c: KanbanCard) => void;
}) {
  const labelBg = getColorHex(card.labelColor);
  const dateInfo = formatDueDate(card.dueDate);

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`list-card ${snapshot.isDragging ? 'list-card-dragging' : ''} ${labelBg ? 'list-card-tinted' : ''}`}
          onClick={() => onClick(card)}
          style={{
            ...provided.draggableProps.style,
            ...(labelBg ? { '--card-accent': labelBg } as React.CSSProperties : {}),
          }}
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
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
});
