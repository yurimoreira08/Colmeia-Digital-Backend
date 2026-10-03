export function normalizeBoxName(name: string): string {
  const match = name.trim().match(/^(Caixa|Cxa|Cx)\s*(\d+)$/i);
  if (match) {
    const num = parseInt(match[2], 10);
    return `Caixa ${String(num).padStart(2, '0')}`;
  }
  return name.trim();
}
