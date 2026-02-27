export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  label: string;
  labelColor: string;
  dueDate: string; // ISO date string e.g. "2026-03-01" or ""
  comments: string[];
}

export interface KanbanLane {
  id: string;
  title: string;
  color: string; // lane accent color name e.g. "blue" or ""
  cards: KanbanCard[];
}

export interface KanbanBoard {
  lanes: KanbanLane[];
}

export interface EditorState {
  board: KanbanBoard;
  parsingErrors: string[];
}
