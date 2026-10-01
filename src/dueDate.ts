/**
 * Accepts `YYYY-MM-DD`, a full ISO timestamp, `today`, `tomorrow`, or a relative
 * offset such as `+3d` / `+2w`. Returns `null` for `none` so callers can clear the field.
 */
export function resolveDueDate(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (value === 'none' || value === 'clear' || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(input.trim())) return input.trim();

  const days = (() => {
    if (value === 'today') return 0;
    if (value === 'tomorrow') return 1;
    if (value === 'yesterday') return -1;
    const relative = /^([+-]?\d+)\s*(d|w|day|days|week|weeks)$/.exec(value);
    if (relative === null) return undefined;
    return Number(relative[1]) * (relative[2]?.startsWith('w') === true ? 7 : 1);
  })();

  if (days === undefined) throw new Error(`Cannot parse date "${input}". Use YYYY-MM-DD, today, tomorrow, +3d, or none.`);

  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
