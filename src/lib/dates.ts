/**
 * Due date intelligence — formats dates relative to today
 * with appropriate urgency color coding.
 */

export interface DueDateInfo {
  text: string;
  status: 'overdue' | 'today' | 'soon' | 'upcoming' | 'future';
}

export function formatDueDate(dateStr: string): DueDateInfo | null {
  if (!dateStr) return null;

  const due = new Date(dateStr + 'T00:00:00');
  if (isNaN(due.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < -1) {
    const absDays = Math.abs(diffDays);
    return { text: `${absDays}d overdue`, status: 'overdue' };
  }
  if (diffDays === -1) {
    return { text: 'Yesterday', status: 'overdue' };
  }
  if (diffDays === 0) {
    return { text: 'Today', status: 'today' };
  }
  if (diffDays === 1) {
    return { text: 'Tomorrow', status: 'soon' };
  }
  if (diffDays <= 3) {
    return { text: `In ${diffDays}d`, status: 'soon' };
  }
  if (diffDays <= 7) {
    return { text: `In ${diffDays}d`, status: 'upcoming' };
  }

  // Format as short date
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const sameYear = due.getFullYear() === now.getFullYear();
  const text = sameYear
    ? `${monthNames[due.getMonth()]} ${due.getDate()}`
    : `${monthNames[due.getMonth()]} ${due.getDate()}, ${due.getFullYear()}`;

  return { text, status: 'future' };
}
