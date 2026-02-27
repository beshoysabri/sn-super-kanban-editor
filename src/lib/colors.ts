export const LABEL_COLORS = [
  { name: 'red', hex: '#ef4444' },
  { name: 'orange', hex: '#f97316' },
  { name: 'yellow', hex: '#eab308' },
  { name: 'green', hex: '#22c55e' },
  { name: 'teal', hex: '#14b8a6' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'purple', hex: '#a855f7' },
  { name: 'pink', hex: '#ec4899' },
] as const;

export function getColorHex(name: string): string {
  if (!name) return '';
  // Pass through raw hex values
  if (name.startsWith('#')) return name;
  return LABEL_COLORS.find((c) => c.name === name.toLowerCase())?.hex || '';
}
