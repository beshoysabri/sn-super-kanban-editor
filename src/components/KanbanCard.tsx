import { memo } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { formatDueDate } from '../lib/dates';
import { getColorHex } from '../lib/colors';
import type { KanbanCard as CardType } from '../types/kanban';

interface Props {
  card: CardType;
  index: number;
  onClick: (card: CardType) => void;
}

export const KanbanCardComponent = memo(function KanbanCardComponent({ card, index, onClick }: Props) {
  const labelBg = getColorHex(card.labelColor);
  const dateInfo = formatDueDate(card.dueDate);

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`kanban-card ${snapshot.isDragging ? 'dragging' : ''} ${labelBg ? 'card-tinted' : ''}`}
          onClick={() => onClick(card)}
          style={{
            ...provided.draggableProps.style,
            ...(labelBg ? { '--card-accent': labelBg } as React.CSSProperties : {}),
          }}
        >
          {/* Color bar at top */}
          {labelBg && (
            <div className="card-color-bar" style={{ backgroundColor: labelBg }} />
          )}

          <div className="card-body">
            {card.label && (
              <span className="card-label">{card.label}</span>
            )}

            <div className="card-title">{card.title}</div>

            {card.description && (
              <div className="card-description">{card.description}</div>
            )}

            {(dateInfo || (card.comments && card.comments.length > 0)) && (
              <div className="card-meta">
                {dateInfo && (
                  <span className={`card-date-badge date-${dateInfo.status}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {dateInfo.text}
                  </span>
                )}
                {card.comments && card.comments.length > 0 && (
                  <span className="card-comment-count">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {card.comments.length}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Hover edit icon */}
          <button
            className="card-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick(card);
            }}
            aria-label="Edit card"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      )}
    </Draggable>
  );
});
