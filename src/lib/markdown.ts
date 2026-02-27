import { v4 as uuid } from 'uuid';
import type { KanbanBoard, KanbanCard, KanbanLane, EditorState } from '../types/kanban';

/**
 * Parse markdown into a kanban board state.
 * Format (backward-compatible with original sn-kanban-editor):
 *
 * # Lane Title [color:blue]
 * * Card Title
 *   * Description: card description
 *   * Label: label text
 *   * LabelColor: blue
 *   * DueDate: 2026-03-01
 *   * Comments:
 *     * comment 1
 *     * comment 2
 */
export function parseMarkdown(markdown: string): EditorState {
  const lanes: KanbanLane[] = [];
  const parsingErrors: string[] = [];
  const lines = markdown.split('\n');

  let currentLane: KanbanLane | null = null;
  let currentCard: KanbanCard | null = null;
  let inComments = false;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (line.startsWith('# ')) {
      const laneText = line.slice(2).trim();
      const colorMatch = laneText.match(/^(.*?)\s*\[color:(\w+)\]\s*$/);
      currentLane = {
        id: uuid(),
        title: colorMatch ? colorMatch[1].trim() : laneText,
        color: colorMatch ? colorMatch[2] : '',
        cards: [],
      };
      lanes.push(currentLane);
      currentCard = null;
      inComments = false;
    } else if (line.startsWith('* ')) {
      if (!currentLane) {
        parsingErrors.push(`Card before lane: ${line}`);
        continue;
      }
      currentCard = {
        id: uuid(),
        title: line.slice(2).trim(),
        description: '',
        label: '',
        labelColor: '',
        dueDate: '',
        comments: [],
      };
      currentLane.cards.push(currentCard);
      inComments = false;
    } else if (line.toLowerCase().trimStart().startsWith('* links: ')) {
      // Legacy: silently ignore linked notes lines
    } else if (line.toLowerCase().trimStart().startsWith('* description: ')) {
      if (currentCard) {
        currentCard.description = line.slice(line.toLowerCase().indexOf('description: ') + 13).trim();
      }
    } else if (line.toLowerCase().trimStart().startsWith('* label: ')) {
      if (currentCard) {
        currentCard.label = line.slice(line.toLowerCase().indexOf('label: ') + 7).trim();
      }
    } else if (line.toLowerCase().trimStart().startsWith('* labelcolor: ')) {
      if (currentCard) {
        currentCard.labelColor = line.slice(line.toLowerCase().indexOf('labelcolor: ') + 12).trim();
      }
    } else if (line.toLowerCase().trimStart().startsWith('* duedate: ')) {
      if (currentCard) {
        currentCard.dueDate = line.slice(line.toLowerCase().indexOf('duedate: ') + 9).trim();
      }
    } else if (line.toLowerCase().trimStart().startsWith('* comments:')) {
      inComments = true;
    } else if (inComments && line.trimStart().startsWith('* ')) {
      if (currentCard) {
        currentCard.comments.push(line.trimStart().slice(2));
      }
    } else {
      parsingErrors.push(line);
    }
  }

  return { board: { lanes }, parsingErrors };
}

/**
 * Convert kanban board state back to markdown
 */
export function boardToMarkdown(board: KanbanBoard): string {
  const parts: string[] = [];

  for (const lane of board.lanes) {
    const colorTag = lane.color ? ` [color:${lane.color}]` : '';
    parts.push(`# ${lane.title}${colorTag}`);
    for (const card of lane.cards) {
      parts.push(`* ${card.title}`);
      if (card.description) {
        parts.push(`  * Description: ${card.description}`);
      }
      if (card.label) {
        parts.push(`  * Label: ${card.label}`);
      }
      if (card.labelColor) {
        parts.push(`  * LabelColor: ${card.labelColor}`);
      }
      if (card.dueDate) {
        parts.push(`  * DueDate: ${card.dueDate}`);
      }
      if (card.comments && card.comments.length > 0) {
        parts.push(`  * Comments:`);
        for (const comment of card.comments) {
          parts.push(`    * ${comment}`);
        }
      }
    }
    parts.push('');
  }

  return parts.join('\n').trim() + '\n';
}

export function createEmptyBoard(): KanbanBoard {
  return { lanes: [] };
}

export function createDefaultBoard(): KanbanBoard {
  return {
    lanes: [
      { id: uuid(), title: 'To Do', color: '', cards: [] },
      { id: uuid(), title: 'In Progress', color: 'blue', cards: [] },
      { id: uuid(), title: 'Done', color: 'green', cards: [] },
    ],
  };
}

export function createNewCard(title: string = ''): KanbanCard {
  return {
    id: uuid(),
    title,
    description: '',
    label: '',
    labelColor: '',
    dueDate: '',
    comments: [],
  };
}

export function createNewLane(title: string = 'New Lane'): KanbanLane {
  return {
    id: uuid(),
    title,
    color: '',
    cards: [],
  };
}
