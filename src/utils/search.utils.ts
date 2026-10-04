/**
 * Word-wise search: every word of the query must appear in at least one of
 * the fields, case-insensitively. A plain substring match on the whole query
 * missed "Digital Safety" unless that exact phrase appeared in one field —
 * and the category, which is where those words actually live, was never
 * searched at all (BUG-022 / BUG-023).
 */
export function matchesSearch(query: string, fields: readonly string[]): boolean {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return true;
  const haystack = fields.map((field) => field.toLowerCase());
  return words.every((word) => haystack.some((field) => field.includes(word)));
}
