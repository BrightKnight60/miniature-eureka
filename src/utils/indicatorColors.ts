const INDICATOR_COLORS = [
  '#FF9500', '#34C759', '#AF52DE', '#5AC8FA',
  '#FF2D55', '#5856D6', '#30B0C7', '#FF6482',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function indicatorColor(name: string): string {
  return INDICATOR_COLORS[hashName(name) % INDICATOR_COLORS.length];
}

